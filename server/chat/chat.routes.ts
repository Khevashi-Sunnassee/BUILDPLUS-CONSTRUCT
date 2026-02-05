import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "../db";
import {
  users,
  jobs,
  panelRegister,
  conversations,
  conversationMembers,
  chatMessages,
  chatMessageAttachments,
  chatNotifications,
  userChatSettings,
  chatMessageMentions,
  userPermissions,
} from "@shared/schema";
import { and, eq, desc, gt, isNull, sql, inArray } from "drizzle-orm";
import { chatUpload } from "./chat.files";
import { extractMentionUserIds } from "./chat.utils";
import { documentRegisterService } from "../services/document-register.service";
import logger from "../lib/logger";

export const chatRouter = Router();

let chatAttachmentTypeId: string | null = null;
async function getChatAttachmentTypeId(): Promise<string> {
  if (chatAttachmentTypeId) return chatAttachmentTypeId;
  chatAttachmentTypeId = await documentRegisterService.getDocumentTypeIdByPrefix("CHAT");
  if (!chatAttachmentTypeId) {
    logger.error("Chat attachment document type not found in database (prefix: CHAT)");
    throw new Error("Document type 'CHAT' not configured in database");
  }
  return chatAttachmentTypeId;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function requireChatPermission(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const permission = await db.select()
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, userId), eq(userPermissions.functionKey, "chat")))
    .limit(1);
  
  if (permission.length > 0 && permission[0].permissionLevel === "HIDDEN") {
    return res.status(403).json({ error: "Access denied to chat" });
  }
  
  next();
}

async function assertMember(userId: string, conversationId: string) {
  const row = await db
    .select({ id: conversationMembers.id })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.userId, userId), eq(conversationMembers.conversationId, conversationId)))
    .limit(1);
  if (!row.length) throw new Error("Not a member of conversation");
}

chatRouter.get("/health", (_req, res) => res.json({ ok: true }));

chatRouter.get("/conversations", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;

    const memberships = await db
      .select({
        conversationId: conversationMembers.conversationId,
        lastReadAt: conversationMembers.lastReadAt,
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    const convIds = memberships.map((m) => m.conversationId);
    if (!convIds.length) return res.json([]);

    // Batch fetch conversations
    const convRows = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds));

    // Batch fetch all members for all conversations
    const allMembers = await db
      .select({
        id: conversationMembers.id,
        conversationId: conversationMembers.conversationId,
        userId: conversationMembers.userId,
        role: conversationMembers.role,
        joinedAt: conversationMembers.joinedAt,
      })
      .from(conversationMembers)
      .where(inArray(conversationMembers.conversationId, convIds));

    // Batch fetch all unique users
    const memberUserIds = Array.from(new Set(allMembers.map(m => m.userId)));
    const allUsers = memberUserIds.length > 0 
      ? await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users).where(inArray(users.id, memberUserIds))
      : [];
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Batch fetch last messages for all conversations using window function
    const convIdsArray = sql`${sql.raw(`ARRAY[${convIds.map(id => `'${id}'`).join(",")}]::varchar[]`)}`;
    const lastMessages = await db.execute(sql`
      SELECT DISTINCT ON (conversation_id) *
      FROM chat_messages
      WHERE conversation_id = ANY(${convIdsArray})
        AND deleted_at IS NULL
      ORDER BY conversation_id, created_at DESC
    `);
    const lastMsgMap = new Map((lastMessages.rows as any[]).map(m => [m.conversation_id, m]));

    // Batch fetch unread counts per conversation
    const membershipMap = new Map(memberships.map(m => [m.conversationId, m.lastReadAt ?? new Date(0)]));
    const unreadCounts = await db.execute(sql`
      SELECT conversation_id, COUNT(*) as count
      FROM chat_messages
      WHERE conversation_id = ANY(${convIdsArray})
        AND deleted_at IS NULL
      GROUP BY conversation_id
    `);
    
    // Calculate unread per conversation based on lastReadAt
    const unreadCountMap = new Map<string, number>();
    for (const convId of convIds) {
      const lastReadAt = membershipMap.get(convId) ?? new Date(0);
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(and(
          eq(chatMessages.conversationId, convId),
          gt(chatMessages.createdAt, lastReadAt),
          isNull(chatMessages.deletedAt)
        ));
      unreadCountMap.set(convId, Number(result?.count || 0));
    }

    // Batch fetch unread mentions
    const unreadMentionsResult = await db
      .select({ 
        conversationId: chatNotifications.conversationId,
        count: sql<number>`count(*)` 
      })
      .from(chatNotifications)
      .where(and(
        eq(chatNotifications.userId, userId),
        eq(chatNotifications.type, "MENTION"),
        inArray(chatNotifications.conversationId, convIds),
        isNull(chatNotifications.readAt),
      ))
      .groupBy(chatNotifications.conversationId);
    const unreadMentionsMap = new Map(unreadMentionsResult.map(r => [r.conversationId, Number(r.count)]));

    // Batch fetch jobs
    const jobIds = convRows.filter(c => c.jobId).map(c => c.jobId!);
    const allJobs = jobIds.length > 0 
      ? await db.select().from(jobs).where(inArray(jobs.id, jobIds))
      : [];
    const jobMap = new Map(allJobs.map(j => [j.id, j]));

    // Batch fetch panels
    const panelIds = convRows.filter(c => c.panelId).map(c => c.panelId!);
    const allPanels = panelIds.length > 0 
      ? await db.select().from(panelRegister).where(inArray(panelRegister.id, panelIds))
      : [];
    const panelMap = new Map(allPanels.map(p => [p.id, p]));

    // Build results
    const results = convRows.map(conv => {
      const convMembers = allMembers.filter(m => m.conversationId === conv.id);
      const membersWithUsers = convMembers.map(m => ({
        ...m,
        user: userMap.get(m.userId) || null,
      }));

      return {
        ...conv,
        members: membersWithUsers,
        lastMessage: lastMsgMap.get(conv.id) || null,
        unreadCount: unreadCountMap.get(conv.id) || 0,
        unreadMentions: unreadMentionsMap.get(conv.id) || 0,
        job: conv.jobId ? jobMap.get(conv.jobId) || null : null,
        panel: conv.panelId ? panelMap.get(conv.panelId) || null : null,
      };
    });

    res.json(results);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/messages", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.query.conversationId || "");
    await assertMember(userId, conversationId);

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), isNull(chatMessages.deletedAt)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(50);

    const messagesWithSender = await Promise.all(rows.map(async (msg) => {
      const senderRows = await db.select({ id: users.id, name: users.name, email: users.email })
        .from(users).where(eq(users.id, msg.senderId)).limit(1);
      const attachments = await db.select().from(chatMessageAttachments).where(eq(chatMessageAttachments.messageId, msg.id));
      const mentions = await db.select().from(chatMessageMentions).where(eq(chatMessageMentions.messageId, msg.id));
      const mentionsWithUsers = await Promise.all(mentions.map(async (m) => {
        const userRows = await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users).where(eq(users.id, m.mentionedUserId)).limit(1);
        return { ...m, user: userRows[0] || null };
      }));
      return { ...msg, sender: senderRows[0] || null, attachments, mentions: mentionsWithUsers };
    }));

    res.json({ items: messagesWithSender.reverse(), nextCursor: null });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/conversations/:conversationId/messages", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.params.conversationId);
    await assertMember(userId, conversationId);

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), isNull(chatMessages.deletedAt)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(50);

    const messagesWithSender = await Promise.all(rows.map(async (msg) => {
      const senderRows = await db.select({ id: users.id, name: users.name, email: users.email })
        .from(users).where(eq(users.id, msg.senderId)).limit(1);
      const attachments = await db.select().from(chatMessageAttachments).where(eq(chatMessageAttachments.messageId, msg.id));
      const mentions = await db.select().from(chatMessageMentions).where(eq(chatMessageMentions.messageId, msg.id));
      const mentionsWithUsers = await Promise.all(mentions.map(async (m) => {
        const userRows = await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users).where(eq(users.id, m.mentionedUserId)).limit(1);
        return { ...m, user: userRows[0] || null };
      }));
      return { ...msg, sender: senderRows[0] || null, attachments, mentions: mentionsWithUsers };
    }));

    res.json(messagesWithSender.reverse());
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/conversations/:conversationId/messages", requireAuth, requireChatPermission, chatUpload.array("files", 10), async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.params.conversationId);
    await assertMember(userId, conversationId);

    const content = String(req.body.content || "");
    
    // Validate message body length (max 10,000 characters)
    if (content.length > 10000) {
      return res.status(400).json({ error: "Message too long (max 10,000 characters)" });
    }
    
    let mentionedUserIds: string[] = [];
    const rawMentions = req.body.mentionedUserIds;
    if (Array.isArray(rawMentions)) {
      mentionedUserIds = rawMentions.map(String);
    } else if (typeof rawMentions === "string" && rawMentions) {
      try {
        const parsed = JSON.parse(rawMentions);
        mentionedUserIds = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        mentionedUserIds = [];
      }
    }

    const messageId = createId();
    await db.insert(chatMessages).values({
      id: messageId,
      conversationId,
      senderId: userId,
      body: content,
    });

    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      const conv = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
      const jobId = conv[0]?.jobId || null;
      const panelId = conv[0]?.panelId || null;
      const typeId = await getChatAttachmentTypeId();
      
      for (const file of files) {
        try {
          const registeredDoc = await documentRegisterService.registerDocument({
            file: {
              buffer: file.buffer,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            },
            uploadedBy: userId,
            source: "CHAT_ATTACHMENT",
            typeId,
            jobId,
            panelId,
            conversationId,
            messageId,
          });
          
          await db.insert(chatMessageAttachments).values({
            messageId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageKey: registeredDoc.storageKey,
            url: `/api/documents/${registeredDoc.id}/view`,
          });
        } catch (err) {
          logger.error({ err, fileName: file.originalname }, "Failed to register chat attachment");
          throw new Error(`Failed to upload file: ${file.originalname}`);
        }
      }
    }

    for (const mentionUserId of mentionedUserIds) {
      await db.insert(chatMessageMentions).values({
        messageId,
        mentionedUserId: mentionUserId,
      });
      
      await db.insert(chatNotifications).values({
        userId: mentionUserId,
        messageId,
        conversationId,
        type: "MENTION",
        title: "You were mentioned in a message",
      });
    }

    const msgRows = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    const senderRows = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);
    const attachments = await db.select().from(chatMessageAttachments).where(eq(chatMessageAttachments.messageId, messageId));
    const mentions = await db.select().from(chatMessageMentions).where(eq(chatMessageMentions.messageId, messageId));
    const mentionsWithUsers = await Promise.all(mentions.map(async (m) => {
      const userRows = await db.select({ id: users.id, name: users.name, email: users.email })
        .from(users).where(eq(users.id, m.mentionedUserId)).limit(1);
      return { ...m, user: userRows[0] || null };
    }));

    res.json({ ...msgRows[0], sender: senderRows[0] || null, attachments, mentions: mentionsWithUsers });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/upload", requireAuth, requireChatPermission, chatUpload.single("file"), async (req, res) => {
  try {
    const userId = req.session.userId!;

    const schema = z.object({
      conversationId: z.string(),
    });
    const { conversationId } = schema.parse(req.body);
    await assertMember(userId, conversationId);

    if (!req.file) return res.status(400).json({ error: "No file" });

    const conv = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    const jobId = conv[0]?.jobId || null;
    const panelId = conv[0]?.panelId || null;
    const typeId = await getChatAttachmentTypeId();

    const registeredDoc = await documentRegisterService.registerDocument({
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      uploadedBy: userId,
      source: "CHAT_ATTACHMENT",
      typeId,
      jobId,
      panelId,
      conversationId,
    });

    res.json({
      storageKey: registeredDoc.storageKey,
      url: `/api/documents/${registeredDoc.id}/view`,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      documentId: registeredDoc.id,
    });
  } catch (e: any) {
    logger.error({ err: e }, "Failed to upload chat file");
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/mentions", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.query.conversationId || "");
    const q = String(req.query.q || "").toLowerCase();

    await assertMember(userId, conversationId);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, conversationId));

    const filtered = rows
      .filter((u) => (u.name || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 10);

    res.json(filtered);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/settings", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const rows = await db.select().from(userChatSettings).where(eq(userChatSettings.userId, userId)).limit(1);
    res.json(rows[0] || { userId, popupEnabled: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/settings/popup", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const schema = z.object({ popupEnabled: z.boolean() });
    const { popupEnabled } = schema.parse(req.body);

    const updated = await db
      .update(userChatSettings)
      .set({ popupEnabled, updatedAt: new Date() })
      .where(eq(userChatSettings.userId, userId))
      .returning({ userId: userChatSettings.userId });

    if (!updated.length) {
      await db.insert(userChatSettings).values({
        userId,
        popupEnabled,
        updatedAt: new Date(),
      });
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/conversations", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const schema = z.object({
      type: z.enum(["DM", "GROUP", "CHANNEL"]),
      name: z.string().optional(),
      memberIds: z.array(z.string()).min(1),
      jobId: z.string().optional().nullable(),
      panelId: z.string().optional().nullable(),
    });
    const { type, name, memberIds, jobId, panelId } = schema.parse(req.body);

    const convId = createId();
    await db.insert(conversations).values({
      id: convId,
      type,
      name: name || null,
      jobId: jobId || null,
      panelId: panelId || null,
    });

    await db.insert(conversationMembers).values({
      id: createId(),
      conversationId: convId,
      userId,
      role: "OWNER",
    });

    for (const memberId of memberIds) {
      if (memberId !== userId) {
        await db.insert(conversationMembers).values({
          id: createId(),
          conversationId: convId,
          userId: memberId,
          role: "MEMBER",
        });
      }
    }

    const conv = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
    res.json(conv[0]);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/panels/:panelId/conversation", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const panelId = String(req.params.panelId);

    const existingConv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.panelId, panelId))
      .limit(1);

    if (existingConv.length > 0) {
      const conv = existingConv[0];
      
      const membership = await db
        .select()
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conv.id), eq(conversationMembers.userId, userId)))
        .limit(1);
      
      if (!membership.length) {
        await db.insert(conversationMembers).values({
          id: createId(),
          conversationId: conv.id,
          userId,
          role: "MEMBER",
        });
      }
      
      const members = await db
        .select({
          id: conversationMembers.id,
          conversationId: conversationMembers.conversationId,
          userId: conversationMembers.userId,
          role: conversationMembers.role,
          joinedAt: conversationMembers.joinedAt,
        })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, conv.id));
      
      const membersWithUsers = await Promise.all(members.map(async (m) => {
        const userRows = await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users).where(eq(users.id, m.userId)).limit(1);
        return { ...m, user: userRows[0] || null };
      }));
      
      return res.json({ ...conv, members: membersWithUsers });
    }
    
    const panel = await db.select().from(panelRegister).where(eq(panelRegister.id, panelId)).limit(1);
    if (!panel.length) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const convId = createId();
    await db.insert(conversations).values({
      id: convId,
      type: "GROUP",
      name: `Panel: ${panel[0].panelMark}`,
      panelId,
      jobId: panel[0].jobId,
    });
    
    await db.insert(conversationMembers).values({
      id: createId(),
      conversationId: convId,
      userId,
      role: "OWNER",
    });
    
    const conv = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
    
    const members = await db
      .select({
        id: conversationMembers.id,
        conversationId: conversationMembers.conversationId,
        userId: conversationMembers.userId,
        role: conversationMembers.role,
        joinedAt: conversationMembers.joinedAt,
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, convId));
    
    const membersWithUsers = await Promise.all(members.map(async (m) => {
      const userRows = await db.select({ id: users.id, name: users.name, email: users.email })
        .from(users).where(eq(users.id, m.userId)).limit(1);
      return { ...m, user: userRows[0] || null };
    }));
    
    res.json({ ...conv[0], members: membersWithUsers });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/panels/counts", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const schema = z.object({
      panelIds: z.array(z.string()).min(1),
    });
    const { panelIds } = schema.parse(req.body);

    const result: Record<string, { messageCount: number; documentCount: number }> = {};
    for (const panelId of panelIds) {
      result[panelId] = { messageCount: 0, documentCount: 0 };
    }

    const messageCounts = await db
      .select({
        panelId: conversations.panelId,
        messageCount: sql<number>`count(${chatMessages.id})`,
      })
      .from(conversations)
      .leftJoin(chatMessages, eq(chatMessages.conversationId, conversations.id))
      .where(inArray(conversations.panelId, panelIds))
      .groupBy(conversations.panelId);

    for (const row of messageCounts) {
      if (row.panelId) {
        result[row.panelId].messageCount = Number(row.messageCount || 0);
      }
    }

    const documentCounts = await db
      .select({
        panelId: conversations.panelId,
        documentCount: sql<number>`count(${chatMessageAttachments.id})`,
      })
      .from(conversations)
      .leftJoin(chatMessages, eq(chatMessages.conversationId, conversations.id))
      .leftJoin(chatMessageAttachments, eq(chatMessageAttachments.messageId, chatMessages.id))
      .where(inArray(conversations.panelId, panelIds))
      .groupBy(conversations.panelId);

    for (const row of documentCounts) {
      if (row.panelId) {
        result[row.panelId].documentCount = Number(row.documentCount || 0);
      }
    }

    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.delete("/conversations/:conversationId", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.params.conversationId);

    const membership = await db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
      .limit(1);

    if (!membership.length) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }

    if (membership[0].role !== "OWNER" && membership[0].role !== "ADMIN") {
      return res.status(403).json({ error: "Only owners and admins can delete conversations" });
    }

    await db.delete(conversations).where(eq(conversations.id, conversationId));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.delete("/conversations/:conversationId/messages/:messageId", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.params.conversationId);
    const messageId = String(req.params.messageId);

    const message = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.conversationId, conversationId)))
      .limit(1);

    if (!message.length) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message[0].senderId !== userId) {
      const membership = await db
        .select()
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
        .limit(1);

      if (!membership.length || (membership[0].role !== "OWNER" && membership[0].role !== "ADMIN")) {
        return res.status(403).json({ error: "Only message sender or admins can delete messages" });
      }
    }

    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

// Edit a message
chatRouter.patch("/conversations/:conversationId/messages/:messageId", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.params.conversationId);
    const messageId = String(req.params.messageId);
    const { body } = req.body;

    if (!body || typeof body !== "string") {
      return res.status(400).json({ error: "Message body is required" });
    }
    
    // Validate message body length (max 10,000 characters)
    if (body.length > 10000) {
      return res.status(400).json({ error: "Message too long (max 10,000 characters)" });
    }

    const message = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.conversationId, conversationId)))
      .limit(1);

    if (!message.length) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only the message sender can edit their own messages
    if (message[0].senderId !== userId) {
      return res.status(403).json({ error: "Only the message sender can edit messages" });
    }

    // Update the message
    const [updatedMessage] = await db
      .update(chatMessages)
      .set({ 
        body, 
        editedAt: new Date(),
      })
      .where(eq(chatMessages.id, messageId))
      .returning();

    // Fetch sender info
    const senderRows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Fetch attachments
    const attachments = await db
      .select()
      .from(chatMessageAttachments)
      .where(eq(chatMessageAttachments.messageId, messageId));

    res.json({ 
      ...updatedMessage, 
      sender: senderRows[0] || null, 
      attachments 
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/messages", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const schema = z.object({
      conversationId: z.string(),
      body: z.string(),
      attachments: z.array(z.object({
        fileName: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number(),
        storageKey: z.string(),
        url: z.string(),
      })).optional(),
      replyToId: z.string().optional().nullable(),
    });
    const { conversationId, body, attachments = [], replyToId } = schema.parse(req.body);

    await assertMember(userId, conversationId);

    const messageId = createId();
    const createdAt = new Date();

    await db.insert(chatMessages).values({
      id: messageId,
      conversationId,
      senderId: userId,
      body: body || "",
      bodyFormat: "MARKDOWN",
      createdAt,
      replyToId: replyToId || null,
    });

    for (const a of attachments) {
      await db.insert(chatMessageAttachments).values({
        id: createId(),
        messageId,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storageKey: a.storageKey,
        url: a.url,
      });
    }

    const mentionedUserIds = extractMentionUserIds(body || "");
    for (const mentionedUserId of mentionedUserIds) {
      try {
        await assertMember(mentionedUserId, conversationId);
        await db.insert(chatNotifications).values({
          id: createId(),
          userId: mentionedUserId,
          type: "MENTION",
          title: "You were mentioned",
          body: (body || "").slice(0, 140),
          conversationId,
          messageId,
        });
      } catch (e) {}
    }

    const members = await db
      .select({ memberId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));

    for (const m of members) {
      if (m.memberId === userId) continue;
      if (!mentionedUserIds.includes(m.memberId)) {
        await db.insert(chatNotifications).values({
          id: createId(),
          userId: m.memberId,
          type: "MESSAGE",
          title: "New message",
          body: (body || "").slice(0, 140),
          conversationId,
          messageId,
        });
      }
    }

    const message = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    const senderRows = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);

    res.json({ ...message[0], sender: senderRows[0], attachments });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/users", requireAuth, requireChatPermission, async (_req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users).where(eq(users.isActive, true));
    res.json(allUsers);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/jobs", requireAuth, requireChatPermission, async (_req, res) => {
  try {
    const allJobs = await db.select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      name: jobs.name,
    }).from(jobs).where(eq(jobs.status, "ACTIVE"));
    res.json(allJobs);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/panels", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const jobId = String(req.query.jobId || "");
    if (!jobId) return res.json([]);

    const panels = await db.select({
      id: panelRegister.id,
      panelMark: panelRegister.panelMark,
      level: panelRegister.level,
    }).from(panelRegister).where(eq(panelRegister.jobId, jobId)).limit(100);
    res.json(panels);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/mark-read", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const schema = z.object({
      conversationId: z.string(),
      lastReadMsgId: z.string().optional(),
    });
    const { conversationId, lastReadMsgId } = schema.parse(req.body);

    await assertMember(userId, conversationId);

    await db
      .update(conversationMembers)
      .set({ lastReadAt: new Date(), lastReadMsgId: lastReadMsgId || null })
      .where(and(eq(conversationMembers.userId, userId), eq(conversationMembers.conversationId, conversationId)));

    await db
      .update(chatNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(chatNotifications.userId, userId),
          eq(chatNotifications.conversationId, conversationId),
          isNull(chatNotifications.readAt)
        )
      );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/unread-counts", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;

    const unreadNotifs = await db
      .select({ id: chatNotifications.id, type: chatNotifications.type })
      .from(chatNotifications)
      .where(and(eq(chatNotifications.userId, userId), isNull(chatNotifications.readAt)));

    const unread = unreadNotifs.filter(n => n.type === "MESSAGE").length;
    const mentions = unreadNotifs.filter(n => n.type === "MENTION").length;

    res.json({ unread, mentions });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/conversations/:conversationId/members", requireAuth, requireChatPermission, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const conversationId = String(req.params.conversationId);
    await assertMember(userId, conversationId);

    const schema = z.object({
      userIds: z.array(z.string()).min(1),
    });
    const { userIds } = schema.parse(req.body);

    for (const uid of userIds) {
      const existing = await db.select().from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, uid)))
        .limit(1);
      if (!existing.length) {
        await db.insert(conversationMembers).values({
          conversationId,
          userId: uid,
          role: "MEMBER",
        });
      }
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});
