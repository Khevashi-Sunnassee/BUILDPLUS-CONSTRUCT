import { Router, Request, Response } from "express";
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
} from "@shared/schema";
import { and, eq, desc, gt, isNull, sql, inArray } from "drizzle-orm";
import { chatUpload } from "./chat.files";
import { extractMentionUserIds } from "./chat.utils";

export const chatRouter = Router();

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
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

chatRouter.get("/conversations", requireAuth, async (req, res) => {
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

    const convRows = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds));

    const results = [];
    for (const conv of convRows) {
      const membership = memberships.find((m) => m.conversationId === conv.id);
      const lastReadAt = membership?.lastReadAt ?? new Date(0);

      const lastMsg = await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.conversationId, conv.id), isNull(chatMessages.deletedAt)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);

      const unreadCount = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(and(eq(chatMessages.conversationId, conv.id), gt(chatMessages.createdAt, lastReadAt), isNull(chatMessages.deletedAt)));

      const unreadMentions = await db
        .select({ id: chatNotifications.id })
        .from(chatNotifications)
        .where(
          and(
            eq(chatNotifications.userId, userId),
            eq(chatNotifications.type, "MENTION"),
            eq(chatNotifications.conversationId, conv.id),
            isNull(chatNotifications.readAt),
          )
        );

      let job = null;
      let panel = null;

      if (conv.jobId) {
        const jobRows = await db.select().from(jobs).where(eq(jobs.id, conv.jobId)).limit(1);
        job = jobRows[0] || null;
      }

      if (conv.panelId) {
        const panelRows = await db.select().from(panelRegister).where(eq(panelRegister.id, conv.panelId)).limit(1);
        panel = panelRows[0] || null;
      }

      results.push({
        conversation: conv,
        unreadCount: unreadCount.length,
        unreadMentions: unreadMentions.length,
        lastMessage: lastMsg[0] || null,
        job,
        panel,
      });
    }

    res.json(results);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/messages", requireAuth, async (req, res) => {
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
      return { ...msg, sender: senderRows[0] || null, attachments };
    }));

    res.json({ items: messagesWithSender.reverse(), nextCursor: null });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/upload", requireAuth, chatUpload.single("file"), async (req, res) => {
  try {
    const userId = req.session.userId!;

    const schema = z.object({
      conversationId: z.string(),
    });
    const { conversationId } = schema.parse(req.body);
    await assertMember(userId, conversationId);

    if (!req.file) return res.status(400).json({ error: "No file" });

    const storageKey = req.file.filename;
    const url = `/uploads/chat/${storageKey}`;

    res.json({
      storageKey,
      url,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.get("/mentions", requireAuth, async (req, res) => {
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

chatRouter.get("/settings", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const rows = await db.select().from(userChatSettings).where(eq(userChatSettings.userId, userId)).limit(1);
    res.json(rows[0] || { userId, popupEnabled: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

chatRouter.post("/settings/popup", requireAuth, async (req, res) => {
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

chatRouter.post("/conversations", requireAuth, async (req, res) => {
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

chatRouter.post("/messages", requireAuth, async (req, res) => {
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

chatRouter.get("/users", requireAuth, async (_req, res) => {
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

chatRouter.get("/jobs", requireAuth, async (_req, res) => {
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

chatRouter.get("/panels", requireAuth, async (req, res) => {
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

chatRouter.post("/mark-read", requireAuth, async (req, res) => {
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

chatRouter.get("/unread-counts", requireAuth, async (req, res) => {
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

chatRouter.post("/conversations/:conversationId/members", requireAuth, async (req, res) => {
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
