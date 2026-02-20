import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "../db";
import {
  kbProjects, kbDocuments, kbChunks, kbConversations, kbMessages,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { requireAuth } from "./middleware/auth.middleware";
import { chunkText } from "../services/kb-chunking.service";
import { generateEmbeddingsBatch, generateEmbedding } from "../services/kb-embedding.service";
import { searchKnowledgeBase, buildRAGContext, buildSystemPrompt, getConversationHistory } from "../services/kb-retrieval.service";
import { openAIBreaker } from "../lib/circuit-breaker";
import logger from "../lib/logger";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.get("/api/kb/projects", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const projects = await db
      .select()
      .from(kbProjects)
      .where(eq(kbProjects.companyId, companyId))
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

    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Project name is required" });

    const [project] = await db.insert(kbProjects).values({
      companyId,
      name: name.trim(),
      description: description?.trim() || null,
      createdById: userId,
    }).returning();

    res.status(201).json(project);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to create project");
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/api/kb/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const [project] = await db
      .select()
      .from(kbProjects)
      .where(and(eq(kbProjects.id, req.params.id), eq(kbProjects.companyId, companyId)));

    if (!project) return res.status(404).json({ error: "Project not found" });

    const docs = await db
      .select()
      .from(kbDocuments)
      .where(eq(kbDocuments.projectId, project.id))
      .orderBy(desc(kbDocuments.createdAt))
      .limit(200);

    res.json({ ...project, documents: docs });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch project");
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.patch("/api/kb/projects/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const { name, description } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name?.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    const [updated] = await db.update(kbProjects)
      .set(updates)
      .where(and(eq(kbProjects.id, req.params.id), eq(kbProjects.companyId, companyId)))
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
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    await db.delete(kbProjects)
      .where(and(eq(kbProjects.id, req.params.id), eq(kbProjects.companyId, companyId)));

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
      .where(and(eq(kbProjects.id, req.params.projectId), eq(kbProjects.companyId, companyId)));

    if (!project) return res.status(404).json({ error: "Project not found" });

    const [doc] = await db.insert(kbDocuments).values({
      companyId,
      projectId: project.id,
      title: title.trim(),
      sourceType: sourceType || "TEXT",
      rawText: content.trim(),
      status: "UPLOADED",
      createdById: userId,
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
        eq(kbDocuments.projectId, req.params.projectId),
        eq(kbDocuments.companyId, companyId)
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
      .where(and(eq(kbDocuments.id, req.params.id), eq(kbDocuments.companyId, companyId)));

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
      .where(and(eq(kbDocuments.id, req.params.id), eq(kbDocuments.companyId, companyId)));

    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!doc.rawText) return res.status(400).json({ error: "Document has no text content" });

    await db.update(kbDocuments)
      .set({ status: "PROCESSING" })
      .where(eq(kbDocuments.id, doc.id));

    res.json({ status: "PROCESSING", message: "Document processing started" });

    processDocumentAsync(doc.id, doc.rawText, doc.title, companyId, doc.projectId).catch(err => {
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

router.get("/api/kb/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const projectId = req.query.projectId as string | undefined;

    const conditions = [
      eq(kbConversations.companyId, companyId),
      eq(kbConversations.createdById, userId),
    ];
    if (projectId) conditions.push(eq(kbConversations.projectId, projectId));

    const convos = await db
      .select()
      .from(kbConversations)
      .where(and(...conditions))
      .orderBy(desc(kbConversations.updatedAt))
      .limit(100);

    res.json(convos);
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
      companyId,
      projectId: projectId || null,
      title: title?.trim() || "New Chat",
      createdById: userId,
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
      .where(and(eq(kbConversations.id, req.params.id), eq(kbConversations.companyId, companyId)))
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
      .where(and(eq(kbConversations.id, req.params.id), eq(kbConversations.companyId, companyId)));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/api/kb/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const messages = await db
      .select()
      .from(kbMessages)
      .where(and(
        eq(kbMessages.conversationId, req.params.id),
        eq(kbMessages.companyId, companyId)
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

    const answerMode = mode === "HYBRID" ? "HYBRID" : "KB_ONLY";

    const [convo] = await db.select()
      .from(kbConversations)
      .where(and(eq(kbConversations.id, req.params.id), eq(kbConversations.companyId, companyId)));

    if (!convo) return res.status(404).json({ error: "Conversation not found" });

    await db.insert(kbMessages).values({
      companyId,
      conversationId: convo.id,
      role: "USER",
      content: content.trim(),
      mode: answerMode,
    });

    const chunks = await searchKnowledgeBase(content.trim(), companyId, convo.projectId || undefined);
    const context = buildRAGContext(chunks, answerMode);

    let projectName: string | undefined;
    if (convo.projectId) {
      const [proj] = await db.select({ name: kbProjects.name })
        .from(kbProjects)
        .where(eq(kbProjects.id, convo.projectId));
      projectName = proj?.name;
    }

    const systemPrompt = buildSystemPrompt(answerMode, context, projectName);
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
        companyId,
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

      if (history.length === 0) {
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

router.post("/api/kb/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const { query, projectId, topK } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: "Query is required" });

    const results = await searchKnowledgeBase(query.trim(), companyId, projectId, topK || 8);
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
      .where(eq(kbProjects.companyId, companyId));

    const [docCount] = await db.select({ count: count() })
      .from(kbDocuments)
      .where(eq(kbDocuments.companyId, companyId));

    const [chunkCount] = await db.select({ count: count() })
      .from(kbChunks)
      .where(eq(kbChunks.companyId, companyId));

    const [convoCount] = await db.select({ count: count() })
      .from(kbConversations)
      .where(eq(kbConversations.companyId, companyId));

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
