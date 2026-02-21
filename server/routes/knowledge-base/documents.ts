import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db } from "../../db";
import {
  kbProjects, kbDocuments, kbChunks,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import { chunkText } from "../../services/kb-chunking.service";
import { generateEmbeddingsBatch } from "../../services/kb-embedding.service";
import logger from "../../lib/logger";

const router = Router();

const kbUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

export { router as documentsRouter };
