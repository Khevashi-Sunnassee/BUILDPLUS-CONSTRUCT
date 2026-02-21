import { Router, type Request, type Response } from "express";
import { db } from "../../db";
import {
  kbProjects, kbDocuments, kbChunks, kbConversations,
  kbProjectMembers, kbConversationMembers, users,
} from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import { searchKnowledgeBase } from "../../services/kb-retrieval.service";
import logger from "../../lib/logger";
import { getProjectAccess, getConversationAccess } from "./shared";

const router = Router();

router.get("/api/kb/projects/:projectId/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getProjectAccess(String(userId), String(req.params.projectId), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });

    const members = await db
      .select({
        id: kbProjectMembers.id,
        userId: kbProjectMembers.userId,
        role: kbProjectMembers.role,
        status: kbProjectMembers.status,
        createdAt: kbProjectMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(kbProjectMembers)
      .innerJoin(users, eq(kbProjectMembers.userId, users.id))
      .where(eq(kbProjectMembers.projectId, String(req.params.projectId)))
      .orderBy(kbProjectMembers.createdAt);

    res.json(members);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch project members");
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.post("/api/kb/projects/:projectId/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getProjectAccess(String(userId), String(req.params.projectId), String(companyId));
    if (!access.hasAccess || access.role === "VIEWER") return res.status(403).json({ error: "Edit access required to invite members" });

    const { userIds, role } = req.body;
    if (!userIds?.length) return res.status(400).json({ error: "User IDs are required" });
    const memberRole = ["EDITOR", "VIEWER"].includes(role) ? role : "VIEWER";

    const added = [];
    for (const inviteeId of userIds) {
      try {
        const [member] = await db.insert(kbProjectMembers).values({
          projectId: String(req.params.projectId),
          userId: String(inviteeId),
          role: memberRole,
          status: "ACCEPTED",
          invitedById: String(userId),
        }).onConflictDoNothing().returning();
        if (member) added.push(member);
      } catch (e) {
        logger.warn({ err: e, inviteeId }, "[KB] Failed to add project member");
      }
    }

    res.status(201).json({ added: added.length });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to add project members");
    res.status(500).json({ error: "Failed to add members" });
  }
});

router.patch("/api/kb/projects/:projectId/members/:memberId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getProjectAccess(String(userId), String(req.params.projectId), String(companyId));
    if (!access.hasAccess || (access.role !== "OWNER" && !access.isCreator)) return res.status(403).json({ error: "Owner access required" });

    const { role } = req.body;
    if (!["EDITOR", "VIEWER"].includes(role)) return res.status(400).json({ error: "Invalid role" });

    const [updated] = await db.update(kbProjectMembers)
      .set({ role })
      .where(and(
        eq(kbProjectMembers.id, String(req.params.memberId)),
        eq(kbProjectMembers.projectId, String(req.params.projectId))
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: "Member not found" });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to update member role");
    res.status(500).json({ error: "Failed to update member" });
  }
});

router.delete("/api/kb/projects/:projectId/members/:memberId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getProjectAccess(String(userId), String(req.params.projectId), String(companyId));
    if (!access.hasAccess || (access.role !== "OWNER" && !access.isCreator)) return res.status(403).json({ error: "Owner access required" });

    await db.delete(kbProjectMembers)
      .where(and(
        eq(kbProjectMembers.id, String(req.params.memberId)),
        eq(kbProjectMembers.projectId, String(req.params.projectId))
      ));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to remove project member");
    res.status(500).json({ error: "Failed to remove member" });
  }
});

router.get("/api/kb/conversations/:convoId/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getConversationAccess(String(userId), String(req.params.convoId), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });

    const members = await db
      .select({
        id: kbConversationMembers.id,
        userId: kbConversationMembers.userId,
        role: kbConversationMembers.role,
        status: kbConversationMembers.status,
        createdAt: kbConversationMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(kbConversationMembers)
      .innerJoin(users, eq(kbConversationMembers.userId, users.id))
      .where(eq(kbConversationMembers.conversationId, String(req.params.convoId)))
      .orderBy(kbConversationMembers.createdAt);

    res.json(members);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch conversation members");
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.post("/api/kb/conversations/:convoId/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getConversationAccess(String(userId), String(req.params.convoId), String(companyId));
    if (!access.hasAccess || access.role === "VIEWER") return res.status(403).json({ error: "Edit access required" });

    const { userIds, role } = req.body;
    if (!userIds?.length) return res.status(400).json({ error: "User IDs are required" });
    const memberRole = ["EDITOR", "VIEWER"].includes(role) ? role : "VIEWER";

    const added = [];
    for (const inviteeId of userIds) {
      try {
        const [member] = await db.insert(kbConversationMembers).values({
          conversationId: String(req.params.convoId),
          userId: String(inviteeId),
          role: memberRole,
          status: "ACCEPTED",
          invitedById: String(userId),
        }).onConflictDoNothing().returning();
        if (member) added.push(member);
      } catch (e) {
        logger.warn({ err: e, inviteeId }, "[KB] Failed to add conversation member");
      }
    }

    res.status(201).json({ added: added.length });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to add conversation members");
    res.status(500).json({ error: "Failed to add members" });
  }
});

router.delete("/api/kb/conversations/:convoId/members/:memberId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getConversationAccess(String(userId), String(req.params.convoId), String(companyId));
    if (!access.hasAccess || (access.role !== "OWNER" && !access.isCreator)) return res.status(403).json({ error: "Owner access required" });

    await db.delete(kbConversationMembers)
      .where(and(
        eq(kbConversationMembers.id, String(req.params.memberId)),
        eq(kbConversationMembers.conversationId, String(req.params.convoId))
      ));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to remove conversation member");
    res.status(500).json({ error: "Failed to remove member" });
  }
});

router.get("/api/kb/invitations", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(403).json({ error: "Auth required" });

    const projectInvites = await db
      .select({
        id: kbProjectMembers.id,
        type: sql<string>`'project'`,
        entityId: kbProjectMembers.projectId,
        role: kbProjectMembers.role,
        status: kbProjectMembers.status,
        createdAt: kbProjectMembers.createdAt,
        projectName: kbProjects.name,
      })
      .from(kbProjectMembers)
      .innerJoin(kbProjects, eq(kbProjectMembers.projectId, kbProjects.id))
      .where(and(eq(kbProjectMembers.userId, String(userId)), eq(kbProjectMembers.status, "INVITED")));

    const convoInvites = await db
      .select({
        id: kbConversationMembers.id,
        type: sql<string>`'conversation'`,
        entityId: kbConversationMembers.conversationId,
        role: kbConversationMembers.role,
        status: kbConversationMembers.status,
        createdAt: kbConversationMembers.createdAt,
        conversationTitle: kbConversations.title,
      })
      .from(kbConversationMembers)
      .innerJoin(kbConversations, eq(kbConversationMembers.conversationId, kbConversations.id))
      .where(and(eq(kbConversationMembers.userId, String(userId)), eq(kbConversationMembers.status, "INVITED")));

    res.json({ projectInvites, conversationInvites: convoInvites });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch invitations");
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

router.post("/api/kb/invitations/:id/accept", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(403).json({ error: "Auth required" });
    const { type } = req.body;

    if (type === "project") {
      const [updated] = await db.update(kbProjectMembers)
        .set({ status: "ACCEPTED" })
        .where(and(eq(kbProjectMembers.id, String(req.params.id)), eq(kbProjectMembers.userId, String(userId))))
        .returning();
      if (!updated) return res.status(404).json({ error: "Invitation not found" });
    } else {
      const [updated] = await db.update(kbConversationMembers)
        .set({ status: "ACCEPTED" })
        .where(and(eq(kbConversationMembers.id, String(req.params.id)), eq(kbConversationMembers.userId, String(userId))))
        .returning();
      if (!updated) return res.status(404).json({ error: "Invitation not found" });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to accept invitation");
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

router.post("/api/kb/invitations/:id/decline", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(403).json({ error: "Auth required" });
    const { type } = req.body;

    if (type === "project") {
      await db.update(kbProjectMembers)
        .set({ status: "DECLINED" })
        .where(and(eq(kbProjectMembers.id, String(req.params.id)), eq(kbProjectMembers.userId, String(userId))));
    } else {
      await db.update(kbConversationMembers)
        .set({ status: "DECLINED" })
        .where(and(eq(kbConversationMembers.id, String(req.params.id)), eq(kbConversationMembers.userId, String(userId))));
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to decline invitation");
    res.status(500).json({ error: "Failed to decline invitation" });
  }
});

router.get("/api/kb/company-users", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const companyUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.companyId, String(companyId)), eq(users.isActive, true)))
      .orderBy(users.name)
      .limit(200);

    res.json(companyUsers.filter(u => u.id !== String(userId)));
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch company users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/api/kb/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const { query, projectId, topK } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: "Query is required" });

    const results = await searchKnowledgeBase(query.trim(), String(companyId), projectId, topK || 8);
    res.json(results);
  } catch (error) {
    logger.error({ err: error }, "[KB] Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/api/kb/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const [projectCount] = await db.select({ count: count() })
      .from(kbProjects)
      .where(eq(kbProjects.companyId, String(companyId)));

    const [docCount] = await db.select({ count: count() })
      .from(kbDocuments)
      .where(eq(kbDocuments.companyId, String(companyId)));

    const [chunkCount] = await db.select({ count: count() })
      .from(kbChunks)
      .where(eq(kbChunks.companyId, String(companyId)));

    const [convoCount] = await db.select({ count: count() })
      .from(kbConversations)
      .where(eq(kbConversations.companyId, String(companyId)));

    res.json({
      projects: projectCount?.count || 0,
      documents: docCount?.count || 0,
      chunks: chunkCount?.count || 0,
      conversations: convoCount?.count || 0,
    });
  } catch (error) {
    logger.error({ err: error }, "[KB] Stats failed");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export { router as membersRouter };
