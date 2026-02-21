import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { db } from "../db";
import {
  kbProjects, kbDocuments, kbChunks, kbConversations, kbMessages, aiUsageTracking,
  kbProjectMembers, kbConversationMembers, users,
} from "@shared/schema";
import { eq, and, desc, sql, count, or, inArray } from "drizzle-orm";
import { requireAuth } from "./middleware/auth.middleware";
import { chunkText } from "../services/kb-chunking.service";
import { generateEmbeddingsBatch, generateEmbedding } from "../services/kb-embedding.service";
import { searchKnowledgeBase, buildRAGContext, buildSystemPrompt, getConversationHistory, getProjectThreadContext } from "../services/kb-retrieval.service";
import { searchHelpEntries, buildHelpContext } from "../seed-kb-help";
import { openAIBreaker } from "../lib/circuit-breaker";
import logger from "../lib/logger";

const router = Router();

const kbUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function getProjectAccess(userId: string, projectId: string, companyId?: string): Promise<{ hasAccess: boolean; role: string | null; isCreator: boolean }> {
  const conditions = [eq(kbProjects.id, projectId)];
  if (companyId) conditions.push(eq(kbProjects.companyId, companyId));
  const [project] = await db.select({ createdById: kbProjects.createdById, companyId: kbProjects.companyId })
    .from(kbProjects).where(and(...conditions)).limit(1);
  if (!project) return { hasAccess: false, role: null, isCreator: false };
  const isCreator = project.createdById === userId;
  if (isCreator) return { hasAccess: true, role: "OWNER", isCreator: true };
  const [membership] = await db.select({ role: kbProjectMembers.role, status: kbProjectMembers.status })
    .from(kbProjectMembers)
    .where(and(eq(kbProjectMembers.projectId, projectId), eq(kbProjectMembers.userId, userId)))
    .limit(1);
  if (membership && membership.status === "ACCEPTED") return { hasAccess: true, role: membership.role, isCreator: false };
  return { hasAccess: false, role: null, isCreator: false };
}

async function getConversationAccess(userId: string, conversationId: string, companyId?: string): Promise<{ hasAccess: boolean; role: string | null; isCreator: boolean }> {
  const [convo] = await db.select({ createdById: kbConversations.createdById, projectId: kbConversations.projectId, companyId: kbConversations.companyId })
    .from(kbConversations).where(and(eq(kbConversations.id, conversationId), companyId ? eq(kbConversations.companyId, companyId) : undefined)).limit(1);
  if (!convo) return { hasAccess: false, role: null, isCreator: false };
  const isCreator = convo.createdById === userId;
  if (isCreator) return { hasAccess: true, role: "OWNER", isCreator: true };
  const [membership] = await db.select({ role: kbConversationMembers.role, status: kbConversationMembers.status })
    .from(kbConversationMembers)
    .where(and(eq(kbConversationMembers.conversationId, conversationId), eq(kbConversationMembers.userId, userId)))
    .limit(1);
  if (membership && membership.status === "ACCEPTED") return { hasAccess: true, role: membership.role, isCreator: false };
  if (convo.projectId) {
    const projectAccess = await getProjectAccess(userId, convo.projectId, companyId);
    if (projectAccess.hasAccess) return { hasAccess: true, role: projectAccess.role, isCreator: false };
  }
  return { hasAccess: false, role: null, isCreator: false };
}

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

    const { name, description, instructions } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Project name is required" });

    const [project] = await db.insert(kbProjects).values({
      companyId: String(companyId),
      name: name.trim(),
      description: description?.trim() || null,
      instructions: instructions?.trim() || null,
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

    const { name, description, instructions } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name?.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (instructions !== undefined) updates.instructions = instructions?.trim() || null;

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

router.post("/api/kb/projects/:projectId/documents", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const { title, content, sourceType } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Document title is required" });
    if (!content?.trim()) return res.status(400).json({ error: "Document content is required" });

    const [project] = await db.select()
      .from(kbProjects)
      .where(and(eq(kbProjects.id, String(req.params.projectId)), eq(kbProjects.companyId, String(companyId))));

    if (!project) return res.status(404).json({ error: "Project not found" });

    const [doc] = await db.insert(kbDocuments).values({
      companyId: String(companyId),
      projectId: project.id,
      title: title.trim(),
      sourceType: sourceType || "TEXT",
      rawText: content.trim(),
      status: "UPLOADED",
      createdById: String(userId),
    }).returning();

    res.status(201).json(doc);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to create document");
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.get("/api/kb/projects/:projectId/documents", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const docs = await db
      .select()
      .from(kbDocuments)
      .where(and(
        eq(kbDocuments.projectId, String(req.params.projectId)),
        eq(kbDocuments.companyId, String(companyId))
      ))
      .orderBy(desc(kbDocuments.createdAt))
      .limit(200);

    res.json(docs);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch documents");
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.delete("/api/kb/documents/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    await db.delete(kbDocuments)
      .where(and(eq(kbDocuments.id, String(req.params.id)), eq(kbDocuments.companyId, String(companyId))));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to delete document");
    res.status(500).json({ error: "Failed to delete document" });
  }
});

router.post("/api/kb/documents/:id/process", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const [doc] = await db.select()
      .from(kbDocuments)
      .where(and(eq(kbDocuments.id, String(req.params.id)), eq(kbDocuments.companyId, String(companyId))));

    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!doc.rawText) return res.status(400).json({ error: "Document has no text content" });

    await db.update(kbDocuments)
      .set({ status: "PROCESSING" })
      .where(eq(kbDocuments.id, doc.id));

    res.json({ status: "PROCESSING", message: "Document processing started" });

    processDocumentAsync(doc.id, doc.rawText, doc.title, String(companyId), doc.projectId).catch(err => {
      logger.error({ err, docId: doc.id }, "[KB] Background processing failed");
    });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to start document processing");
    res.status(500).json({ error: "Failed to process document" });
  }
});

async function processDocumentAsync(
  docId: string,
  rawText: string,
  title: string,
  companyId: string,
  projectId: string
) {
  try {
    await db.delete(kbChunks).where(eq(kbChunks.documentId, docId));

    const chunks = chunkText(rawText, title);
    if (chunks.length === 0) {
      await db.update(kbDocuments)
        .set({ status: "FAILED", errorMessage: "No content to chunk", chunkCount: 0 })
        .where(eq(kbDocuments.id, docId));
      return;
    }

    const texts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    const chunkValues = chunks.map((chunk, i) => ({
      companyId,
      projectId,
      documentId: docId,
      chunkIndex: chunk.metadata.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      metadata: { section: chunk.metadata.section, headings: chunk.metadata.headings },
    }));

    for (let i = 0; i < chunkValues.length; i += 50) {
      const batch = chunkValues.slice(i, i + 50);
      await db.insert(kbChunks).values(batch as any);
    }

    await db.update(kbDocuments)
      .set({ status: "READY", chunkCount: chunks.length, errorMessage: null })
      .where(eq(kbDocuments.id, docId));

    logger.info({ docId, chunkCount: chunks.length }, "[KB] Document processed successfully");
  } catch (error: any) {
    logger.error({ err: error, docId }, "[KB] Document processing failed");
    await db.update(kbDocuments)
      .set({ status: "FAILED", errorMessage: error.message || "Processing failed" })
      .where(eq(kbDocuments.id, docId));
  }
}

router.post("/api/kb/projects/:projectId/documents/upload", requireAuth, kbUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const title = (req.body.title || file.originalname).trim();

    const [project] = await db.select()
      .from(kbProjects)
      .where(and(eq(kbProjects.id, String(req.params.projectId)), eq(kbProjects.companyId, String(companyId))));
    if (!project) return res.status(404).json({ error: "Project not found" });

    let rawText = "";
    const mime = (file.mimetype || "").toLowerCase();

    if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml" || mime === "text/markdown") {
      rawText = file.buffer.toString("utf-8");
    } else if (mime === "application/pdf") {
      rawText = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
    } else {
      rawText = file.buffer.toString("utf-8");
    }

    rawText = rawText.replace(/\0/g, "");

    if (!rawText.trim()) {
      return res.status(400).json({ error: "Could not extract text from file. Try pasting the content directly." });
    }

    const [doc] = await db.insert(kbDocuments).values({
      companyId: String(companyId),
      projectId: project.id,
      title,
      sourceType: "UPLOAD",
      rawText: rawText.trim(),
      status: "UPLOADED",
      createdById: String(userId),
    }).returning();

    await db.update(kbDocuments)
      .set({ status: "PROCESSING" })
      .where(eq(kbDocuments.id, doc.id));

    res.status(201).json(doc);

    processDocumentAsync(doc.id, rawText.trim(), title, String(companyId), project.id).catch(err => {
      logger.error({ err, docId: doc.id }, "[KB] Background file processing failed");
    });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to upload KB document");
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.get("/api/kb/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const projectId = req.query.projectId as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const sharedConvoIds = await db.select({ conversationId: kbConversationMembers.conversationId })
      .from(kbConversationMembers)
      .where(and(eq(kbConversationMembers.userId, String(userId)), eq(kbConversationMembers.status, "ACCEPTED")));

    const sharedProjectIds = await db.select({ projectId: kbProjectMembers.projectId })
      .from(kbProjectMembers)
      .where(and(eq(kbProjectMembers.userId, String(userId)), eq(kbProjectMembers.status, "ACCEPTED")));

    const convoMemberIds = sharedConvoIds.map(c => c.conversationId);
    const projectMemberIds = sharedProjectIds.map(p => p.projectId);

    const accessConditions = [eq(kbConversations.createdById, String(userId))];
    if (convoMemberIds.length > 0) accessConditions.push(inArray(kbConversations.id, convoMemberIds));
    if (projectMemberIds.length > 0) accessConditions.push(inArray(kbConversations.projectId, projectMemberIds));

    const baseConditions = [
      eq(kbConversations.companyId, String(companyId)),
      or(...accessConditions)!,
    ];
    if (projectId) baseConditions.push(eq(kbConversations.projectId, String(projectId)));

    const [totalResult] = await db.select({ count: count() })
      .from(kbConversations)
      .where(and(...baseConditions));

    const convos = await db
      .select()
      .from(kbConversations)
      .where(and(...baseConditions))
      .orderBy(desc(kbConversations.updatedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: convos,
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch conversations");
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/api/kb/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const { title, projectId } = req.body;

    const [convo] = await db.insert(kbConversations).values({
      companyId: String(companyId),
      projectId: projectId || null,
      title: title?.trim() || "New Chat",
      createdById: String(userId),
    }).returning();

    res.status(201).json(convo);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.patch("/api/kb/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const { title } = req.body;
    const [updated] = await db.update(kbConversations)
      .set({ title: title?.trim() || "New Chat", updatedAt: new Date() })
      .where(and(eq(kbConversations.id, String(req.params.id)), eq(kbConversations.companyId, String(companyId))))
      .returning();

    if (!updated) return res.status(404).json({ error: "Conversation not found" });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to update conversation");
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

router.delete("/api/kb/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    await db.delete(kbConversations)
      .where(and(eq(kbConversations.id, String(req.params.id)), eq(kbConversations.companyId, String(companyId))));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/api/kb/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getConversationAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });

    const messages = await db
      .select()
      .from(kbMessages)
      .where(and(
        eq(kbMessages.conversationId, String(req.params.id)),
        eq(kbMessages.companyId, String(companyId))
      ))
      .orderBy(kbMessages.createdAt)
      .limit(200);

    res.json(messages);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/api/kb/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const { content, mode } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Message content is required" });
    if (content.length > 10000) return res.status(400).json({ error: "Message too long (max 10,000 characters)" });

    const answerMode = mode === "HYBRID" ? "HYBRID" : "KB_ONLY";

    const access = await getConversationAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });
    if (access.role === "VIEWER") return res.status(403).json({ error: "Viewer access does not allow sending messages" });

    const [convo] = await db.select()
      .from(kbConversations)
      .where(and(eq(kbConversations.id, String(req.params.id)), eq(kbConversations.companyId, String(companyId))));

    if (!convo) return res.status(404).json({ error: "Conversation not found" });

    const today = new Date().toISOString().slice(0, 10);
    const [usage] = await db.select()
      .from(aiUsageTracking)
      .where(and(eq(aiUsageTracking.userId, String(userId)), eq(aiUsageTracking.usageDate, today)))
      .limit(1);

    const MAX_DAILY_REQUESTS = 200;
    if (usage && usage.requestCount >= MAX_DAILY_REQUESTS) {
      return res.status(429).json({ error: `Daily AI request limit reached (${MAX_DAILY_REQUESTS}). Try again tomorrow.` });
    }

    await db.execute(sql`
      INSERT INTO ai_usage_tracking (id, company_id, user_id, usage_date, request_count, total_tokens, last_request_at)
      VALUES (gen_random_uuid(), ${companyId}, ${userId}, ${today}, 1, 0, NOW())
      ON CONFLICT (user_id, usage_date)
      DO UPDATE SET request_count = ai_usage_tracking.request_count + 1, last_request_at = NOW()
    `).catch(err => {
      logger.warn({ err }, "[KB] Failed to update AI usage tracking");
    });

    await db.insert(kbMessages).values({
      companyId: String(companyId),
      conversationId: convo.id,
      role: "USER",
      content: content.trim(),
      mode: answerMode,
    });

    const chunks = await searchKnowledgeBase(content.trim(), String(companyId), convo.projectId || undefined);
    const context = buildRAGContext(chunks, answerMode);

    const helpResults = await searchHelpEntries(content.trim());
    const helpContext = buildHelpContext(helpResults);

    let projectName: string | undefined;
    let projectInstructions: string | undefined;
    let threadContext = "";
    if (convo.projectId) {
      const [proj] = await db.select({ name: kbProjects.name, instructions: kbProjects.instructions })
        .from(kbProjects)
        .where(eq(kbProjects.id, convo.projectId));
      projectName = proj?.name;
      projectInstructions = proj?.instructions || undefined;
      threadContext = await getProjectThreadContext(convo.projectId, convo.id);
    }

    const fullContext = [context, helpContext, threadContext].filter(Boolean).join("\n\n---\n\n");
    const systemPrompt = buildSystemPrompt(answerMode, fullContext, projectName, projectInstructions);
    const history = await getConversationHistory(convo.id, 16);

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-14),
      { role: "user", content: content.trim() },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";
    const sourceChunkIds = chunks.map(c => c.id);
    let clientDisconnected = false;

    req.on("close", () => {
      clientDisconnected = true;
    });

    try {
      const stream = await openAIBreaker.execute(async () => {
        return openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: chatMessages,
          stream: true,
          max_completion_tokens: 4096,
          temperature: 0.3,
        });
      });

      for await (const chunk of stream as any) {
        if (clientDisconnected) break;
        const delta = chunk.choices?.[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      await db.insert(kbMessages).values({
        companyId: String(companyId),
        conversationId: convo.id,
        role: "ASSISTANT",
        content: fullResponse,
        mode: answerMode,
        sourceChunkIds,
      });

      const sources = chunks.map(c => ({
        id: c.id,
        documentTitle: c.documentTitle,
        section: c.metadata?.section,
        similarity: Math.round(c.similarity * 100),
      }));

      res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);

      if (history.length <= 1) {
        const shortTitle = content.trim().slice(0, 60) + (content.trim().length > 60 ? "..." : "");
        await db.update(kbConversations)
          .set({ title: shortTitle, updatedAt: new Date() })
          .where(eq(kbConversations.id, convo.id));

        res.write(`data: ${JSON.stringify({ titleUpdate: shortTitle })}\n\n`);
      } else {
        await db.update(kbConversations)
          .set({ updatedAt: new Date() })
          .where(eq(kbConversations.id, convo.id));
      }

      res.end();
    } catch (streamError: any) {
      logger.error({ err: streamError }, "[KB] Streaming error");
      if (!res.headersSent) {
        res.status(500).json({ error: "AI service unavailable" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "AI service temporarily unavailable. Please try again." })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
});

// ============ PROJECT MEMBER MANAGEMENT ============

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

// ============ CONVERSATION MEMBER MANAGEMENT ============

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

// ============ PENDING INVITATIONS ============

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

// ============ COMPANY USERS FOR INVITING ============

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

export { router as knowledgeBaseRouter };
