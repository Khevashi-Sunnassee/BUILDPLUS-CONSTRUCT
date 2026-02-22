import { Router, type Request, type Response } from "express";
import { db } from "../../db";
import {
  kbProjects, kbDocuments, kbProjectMembers, users,
} from "@shared/schema";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { getProjectAccess } from "./shared";

const router = Router();

router.get("/api/kb/projects", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Company context required" });

    const memberProjectIds = await db.select({ projectId: kbProjectMembers.projectId })
      .from(kbProjectMembers)
      .where(and(eq(kbProjectMembers.userId, String(userId)), eq(kbProjectMembers.status, "ACCEPTED")));

    const memberIds = memberProjectIds.map(m => m.projectId);

    const projects = await db
      .select()
      .from(kbProjects)
      .where(and(
        eq(kbProjects.companyId, String(companyId)),
        memberIds.length > 0
          ? or(eq(kbProjects.createdById, String(userId)), inArray(kbProjects.id, memberIds))
          : eq(kbProjects.createdById, String(userId))
      ))
      .orderBy(desc(kbProjects.updatedAt))
      .limit(100);

    res.json(projects);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch projects");
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/api/kb/projects", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const { name, description, instructions, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Project name is required" });

    const [project] = await db.insert(kbProjects).values({
      companyId: String(companyId),
      name: name.trim(),
      description: description?.trim() || null,
      instructions: instructions?.trim() || null,
      color: color?.trim() || null,
      createdById: String(userId),
    }).returning();

    await db.insert(kbProjectMembers).values({
      projectId: project.id,
      userId: String(userId),
      role: "OWNER",
      status: "ACCEPTED",
      invitedById: String(userId),
    });

    res.status(201).json(project);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to create project");
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/api/kb/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Company context required" });

    const access = await getProjectAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });

    const [project] = await db
      .select()
      .from(kbProjects)
      .where(and(eq(kbProjects.id, String(req.params.id)), eq(kbProjects.companyId, String(companyId))));

    if (!project) return res.status(404).json({ error: "Project not found" });

    const docs = await db
      .select()
      .from(kbDocuments)
      .where(eq(kbDocuments.projectId, project.id))
      .orderBy(desc(kbDocuments.createdAt))
      .limit(200);

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
      .where(eq(kbProjectMembers.projectId, project.id))
      .orderBy(kbProjectMembers.createdAt);

    res.json({ ...project, documents: docs, members, userRole: access.role });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch project");
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.patch("/api/kb/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Company context required" });

    const access = await getProjectAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess || access.role === "VIEWER") return res.status(403).json({ error: "Edit access required" });

    const { name, description, instructions, color } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name?.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (instructions !== undefined) updates.instructions = instructions?.trim() || null;
    if (color !== undefined) updates.color = color || null;

    const [updated] = await db.update(kbProjects)
      .set(updates)
      .where(and(eq(kbProjects.id, String(req.params.id)), eq(kbProjects.companyId, String(companyId))))
      .returning();

    if (!updated) return res.status(404).json({ error: "Project not found" });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to update project");
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/api/kb/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Company context required" });

    const access = await getProjectAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess || !access.isCreator) return res.status(403).json({ error: "Only the project owner can delete it" });

    await db.delete(kbProjects)
      .where(and(eq(kbProjects.id, String(req.params.id)), eq(kbProjects.companyId, String(companyId))));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to delete project");
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export { router as projectsRouter };
