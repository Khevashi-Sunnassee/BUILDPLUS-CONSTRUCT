import { Router, Request, Response } from "express";
import crypto from "crypto";
import sharp from "sharp";
import { storage, db } from "../../storage";
import { eq, and } from "drizzle-orm";
import { jobMembers, documents, insertDocumentSchema, kbDocuments, kbProjects, kbChunks, conversationMembers, chatMessages } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { ObjectNotFoundError } from "../../replit_integrations/object_storage";
import logger from "../../lib/logger";
import { chunkText } from "../../services/kb-chunking.service";
import { generateEmbeddingsBatch } from "../../services/kb-embedding.service";
import { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden, sendServerError, sendError } from "../../lib/api-response";
import {
  objectStorageService,
  upload,
  findAffectedOpenTenders,
  buildContentDisposition,
  thumbnailCache,
  THUMBNAIL_WIDTH,
  evictOldestThumbnails,
} from "./shared";

const router = Router();

async function checkChatDocumentAccess(doc: any, userId: string): Promise<boolean> {
  if (!doc.conversationId && !doc.messageId) return true;
  let convoId = doc.conversationId;
  if (!convoId && doc.messageId) {
    const [msg] = await db.select({ conversationId: chatMessages.conversationId })
      .from(chatMessages)
      .where(eq(chatMessages.id, doc.messageId))
      .limit(1);
    if (!msg) return false;
    convoId = msg.conversationId;
  }
  const [membership] = await db.select({ id: conversationMembers.id })
    .from(conversationMembers)
    .where(and(
      eq(conversationMembers.conversationId, convoId),
      eq(conversationMembers.userId, userId),
    ))
    .limit(1);
  return !!membership;
}

// ==================== DOCUMENTS ====================

router.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const { page, limit, search, status, typeId, disciplineId, categoryId, jobId, panelId, supplierId, purchaseOrderId, taskId, kbFilter, showLatestOnly, mimeTypePrefix, excludeChat } = req.query;
    
    let allowedJobIds: string[] | undefined;
    const user = await storage.getUser(req.session.userId!);
    if (user && user.role !== "ADMIN" && user.role !== "MANAGER") {
      const memberships = await db.select({ jobId: jobMembers.jobId })
        .from(jobMembers)
        .where(eq(jobMembers.userId, req.session.userId!))
        .limit(1000);
      allowedJobIds = memberships.map(m => m.jobId);
    }

    const result = await storage.getDocuments({
      companyId: req.companyId,
      page: page ? parseInt(String(page)) : 1,
      limit: limit ? parseInt(String(limit)) : 50,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      typeId: typeId ? String(typeId) : undefined,
      disciplineId: disciplineId ? String(disciplineId) : undefined,
      categoryId: categoryId ? String(categoryId) : undefined,
      jobId: jobId ? String(jobId) : undefined,
      panelId: panelId ? String(panelId) : undefined,
      supplierId: supplierId ? String(supplierId) : undefined,
      purchaseOrderId: purchaseOrderId ? String(purchaseOrderId) : undefined,
      taskId: taskId ? String(taskId) : undefined,
      kbFilter: kbFilter ? String(kbFilter) : undefined,
      showLatestOnly: showLatestOnly === "true",
      mimeTypePrefix: mimeTypePrefix ? String(mimeTypePrefix) : undefined,
      excludeChat: excludeChat === "true",
      chatUserId: req.session.userId!,
      allowedJobIds,
    });
    
    sendSuccess(res, result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching documents");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/documents/next-number", requireAuth, async (req, res) => {
  try {
    const { typeId } = req.query;
    if (!typeId) {
      return sendBadRequest(res, "typeId is required");
    }
    const nextNumber = await storage.getNextDocumentNumber(String(typeId));
    sendSuccess(res, { documentNumber: nextNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next document number");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) return sendNotFound(res, "Document not found");
    if (!await checkChatDocumentAccess(document, req.session.userId!)) {
      return sendForbidden(res, "You do not have access to this document");
    }
    sendSuccess(res, document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/documents/:id/versions", requireAuth, async (req, res) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) return sendNotFound(res, "Document not found");
    if (!await checkChatDocumentAccess(document, req.session.userId!)) {
      return sendForbidden(res, "You do not have access to this document");
    }
    const versions = await storage.getDocumentVersionHistory(String(req.params.id));
    sendSuccess(res, versions);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document versions");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/documents/check-duplicates", requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentNumbers } = req.body;
    if (!documentNumbers || !Array.isArray(documentNumbers) || documentNumbers.length === 0) {
      return sendBadRequest(res, "documentNumbers array is required");
    }

    const companyId = req.companyId;
    if (!companyId) {
      return sendBadRequest(res, "Company context required");
    }

    const duplicates: Record<string, { id: string; title: string; version: string; revision: string; documentNumber: string; status: string; isLatestVersion: boolean }[]> = {};

    for (const docNum of documentNumbers) {
      if (!docNum || typeof docNum !== "string") continue;
      const trimmed = docNum.trim();
      if (!trimmed) continue;

      const result = await db.select({
        id: documents.id,
        title: documents.title,
        version: documents.version,
        revision: documents.revision,
        documentNumber: documents.documentNumber,
        status: documents.status,
        isLatestVersion: documents.isLatestVersion,
      })
        .from(documents)
        .where(
          and(
            eq(documents.companyId, companyId),
            eq(documents.documentNumber, trimmed),
            eq(documents.isLatestVersion, true),
          )
        )
        .limit(1000);

      if (result.length > 0) {
        duplicates[trimmed] = result.map(r => ({
          id: r.id,
          title: r.title,
          version: r.version || "1.0",
          revision: r.revision || "A",
          documentNumber: r.documentNumber || trimmed,
          status: r.status,
          isLatestVersion: r.isLatestVersion ?? true,
        }));
      }
    }

    sendSuccess(res, { duplicates });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error checking document duplicates");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/documents/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return sendBadRequest(res, "No file provided");
    }

    const { title, description, typeId, disciplineId, categoryId, documentTypeStatusId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential, documentNumber: manualDocNumber, revision: manualRevision, supersedeDocumentId } = req.body;

    if (!title) {
      return sendBadRequest(res, "Title is required");
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      body: req.file.buffer,
      headers: {
        "Content-Type": req.file.mimetype,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to storage");
    }

    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: req.session.userId!,
      visibility: "private",
    });

    const fileSha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    
    let documentNumber: string | undefined;
    if (manualDocNumber) {
      documentNumber = manualDocNumber;
    } else if (typeId) {
      documentNumber = await storage.getNextDocumentNumber(typeId);
    }

    const companyId = req.companyId;
    if (!companyId) {
      return sendBadRequest(res, "Company context required");
    }

    if (supersedeDocumentId) {
      const parentDoc = await storage.getDocument(supersedeDocumentId);
      if (!parentDoc) {
        return sendNotFound(res, "Document to supersede not found");
      }
      if (parentDoc.companyId !== companyId) {
        return sendForbidden(res);
      }

      const currentVersion = parseFloat(parentDoc.version || "1.0");
      const newVersion = String((currentVersion + 1).toFixed(1));

      const affectedTenders = await findAffectedOpenTenders(supersedeDocumentId, companyId);

      const newDocument = await storage.createNewVersion(supersedeDocumentId, {
        companyId,
        title: title || parentDoc.title,
        description: description || parentDoc.description,
        fileName: `${Date.now()}-${req.file.originalname}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageKey: objectPath,
        fileSha256,
        documentNumber: parentDoc.documentNumber,
        typeId: typeId || parentDoc.typeId,
        disciplineId: disciplineId || parentDoc.disciplineId,
        categoryId: categoryId || parentDoc.categoryId,
        documentTypeStatusId: documentTypeStatusId || parentDoc.documentTypeStatusId,
        jobId: jobId || parentDoc.jobId,
        panelId: panelId || parentDoc.panelId,
        supplierId: supplierId || parentDoc.supplierId,
        purchaseOrderId: purchaseOrderId || parentDoc.purchaseOrderId,
        taskId: taskId || parentDoc.taskId,
        tags: tags || parentDoc.tags,
        isConfidential: isConfidential === "true",
        uploadedBy: req.session.userId!,
        status: "DRAFT",
        version: newVersion,
        revision: manualRevision || "A",
        isLatestVersion: true,
      });

      return sendSuccess(res, {
        ...newDocument,
        affectedTenders: affectedTenders.length > 0 ? affectedTenders : undefined,
        supersededDocumentId: supersedeDocumentId,
      });
    }

    const document = await storage.createDocument({
      companyId,
      title,
      description: description || null,
      fileName: `${Date.now()}-${req.file.originalname}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey: objectPath,
      fileSha256,
      documentNumber,
      ...(manualRevision ? { revision: manualRevision } : {}),
      typeId: typeId || null,
      disciplineId: disciplineId || null,
      categoryId: categoryId || null,
      documentTypeStatusId: documentTypeStatusId || null,
      jobId: jobId || null,
      panelId: panelId || null,
      supplierId: supplierId || null,
      purchaseOrderId: purchaseOrderId || null,
      taskId: taskId || null,
      tags: tags || null,
      isConfidential: isConfidential === "true",
      uploadedBy: req.session.userId!,
      status: "DRAFT",
      version: "1.0",
      revision: "A",
      isLatestVersion: true,
    });

    sendSuccess(res, document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading document");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/documents/:id/new-version", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const parentId = String(req.params.id);
    const parentDoc = await storage.getDocument(parentId);
    
    if (!parentDoc) {
      return sendNotFound(res, "Parent document not found");
    }

    if (!req.file) {
      return sendBadRequest(res, "No file provided");
    }

    const { changeSummary, version, revision } = req.body;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      body: req.file.buffer,
      headers: {
        "Content-Type": req.file.mimetype,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to storage");
    }

    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: req.session.userId!,
      visibility: "private",
    });

    const fileSha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    
    const currentVersion = parseFloat(parentDoc.version || "1.0");
    const newVersion = version || String((currentVersion + 1).toFixed(1));
    const newRevision = revision || "A";

    const companyId = req.companyId;
    if (!companyId) {
      return sendBadRequest(res, "Company context required");
    }

    const affectedTenders = await findAffectedOpenTenders(parentId, companyId);

    const newDocument = await storage.createNewVersion(parentId, {
      companyId,
      title: parentDoc.title,
      description: parentDoc.description,
      fileName: `${Date.now()}-${req.file.originalname}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey: objectPath,
      fileSha256,
      documentNumber: parentDoc.documentNumber,
      typeId: parentDoc.typeId,
      disciplineId: parentDoc.disciplineId,
      categoryId: parentDoc.categoryId,
      jobId: parentDoc.jobId,
      panelId: parentDoc.panelId,
      supplierId: parentDoc.supplierId,
      purchaseOrderId: parentDoc.purchaseOrderId,
      taskId: parentDoc.taskId,
      tags: parentDoc.tags,
      isConfidential: parentDoc.isConfidential,
      uploadedBy: req.session.userId!,
      changeSummary: changeSummary || null,
      status: "DRAFT",
      version: newVersion,
      revision: newRevision,
      isLatestVersion: true,
    });

    sendSuccess(res, {
      ...newDocument,
      affectedTenders: affectedTenders.length > 0 ? affectedTenders : undefined,
      supersededDocumentId: parentId,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating new document version");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/documents/:id/view", requireAuth, async (req: Request, res: Response) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) {
      return sendNotFound(res, "Document not found");
    }
    if (!await checkChatDocumentAccess(document, req.session.userId!)) {
      return sendForbidden(res, "You do not have access to this document");
    }

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    await objectStorageService.downloadObject(objectFile, res);
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return sendNotFound(res, "File not found in storage");
    }
    logger.error({ err: error }, "Error viewing document");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/documents/:id/thumbnail", requireAuth, async (req: Request, res: Response) => {
  try {
    const docId = String(req.params.id);
    const cached = thumbnailCache.get(docId);
    if (cached) {
      cached.timestamp = Date.now();
      res.set({
        "Content-Type": cached.contentType,
        "Content-Length": String(cached.buffer.length),
        "Cache-Control": "private, max-age=86400",
      });
      return res.send(cached.buffer);
    }

    const document = await storage.getDocument(docId);
    if (!document) {
      return sendNotFound(res, "Document not found");
    }
    if (!await checkChatDocumentAccess(document, req.session.userId!)) {
      return sendForbidden(res, "You do not have access to this document");
    }

    const mimeType = (document.mimeType || "").toLowerCase();
    if (!mimeType.startsWith("image/")) {
      return sendError(res, 415, "Thumbnails only available for image files");
    }

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const stream = objectFile.createReadStream();

    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", (err) => {
      logger.error({ err }, "Error streaming for thumbnail");
      if (!res.headersSent) {
        sendServerError(res, "Error generating thumbnail");
      }
    });
    stream.on("end", async () => {
      try {
        const original = Buffer.concat(chunks);
        const resized = await sharp(original)
          .rotate()
          .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer();

        thumbnailCache.set(docId, {
          buffer: resized,
          contentType: "image/jpeg",
          timestamp: Date.now(),
        });
        evictOldestThumbnails();

        res.set({
          "Content-Type": "image/jpeg",
          "Content-Length": String(resized.length),
          "Cache-Control": "private, max-age=86400",
        });
        res.send(resized);
      } catch (sharpErr) {
        logger.error({ err: sharpErr }, "Error resizing image for thumbnail");
        if (!res.headersSent) {
          sendServerError(res, "Error generating thumbnail");
        }
      }
    });
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return sendNotFound(res, "File not found in storage");
    }
    logger.error({ err: error }, "Error generating thumbnail");
    if (!res.headersSent) {
      sendServerError(res, "An internal error occurred");
    }
  }
});

router.get("/api/documents/:id/download", requireAuth, async (req: Request, res: Response) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) {
      return sendNotFound(res, "Document not found");
    }
    if (!await checkChatDocumentAccess(document, req.session.userId!)) {
      return sendForbidden(res, "You do not have access to this document");
    }

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const [metadata] = await objectFile.getMetadata();
    
    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition("attachment", document.originalName),
    });

    const stream = objectFile.createReadStream();
    stream.pipe(res);
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return sendNotFound(res, "File not found in storage");
    }
    logger.error({ err: error }, "Error downloading document");
    sendServerError(res, "An internal error occurred");
  }
});

router.patch("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const parsed = insertDocumentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Validation failed");
    }
    const document = await storage.updateDocument(String(req.params.id), parsed.data);
    if (!document) return sendNotFound(res, "Document not found");
    sendSuccess(res, document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document");
    sendServerError(res, "An internal error occurred");
  }
});

router.patch("/api/documents/:id/status", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { status, approvedBy } = req.body;
    const updateData: Record<string, unknown> = { status };
    
    if (status === "APPROVED") {
      updateData.approvedBy = req.session.userId;
      updateData.approvedAt = new Date();
    }
    
    const document = await storage.updateDocument(String(req.params.id), updateData);
    if (!document) return sendNotFound(res, "Document not found");
    sendSuccess(res, document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document status");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/documents/:id/add-to-kb", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const userId = req.session.userId!;
    const { projectId } = req.body;

    if (!projectId) return sendBadRequest(res, "Knowledge Base project is required");

    const [project] = await db.select()
      .from(kbProjects)
      .where(and(eq(kbProjects.id, String(projectId)), eq(kbProjects.companyId, companyId)))
      .limit(1);

    if (!project) return sendNotFound(res, "Knowledge Base project not found");

    const doc = await storage.getDocument(String(req.params.id));
    if (!doc) return sendNotFound(res, "Document not found");
    if (doc.companyId !== companyId) return sendForbidden(res);
    if (doc.kbDocumentId) return sendBadRequest(res, "Document is already in the Knowledge Base");

    let rawText = "";
    const mime = (doc.mimeType || "").toLowerCase();
    const isTextBased = mime.startsWith("text/") || mime === "application/json" || mime === "application/xml";

    if (isTextBased) {
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(doc.storageKey);
        const stream = objectFile.createReadStream();
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve());
          stream.on("error", reject);
        });
        rawText = Buffer.concat(chunks).toString("utf-8");
      } catch (err) {
        logger.warn({ err, docId: doc.id }, "Failed to read document file for KB");
      }
    }

    if (!rawText && doc.description) {
      rawText = doc.description;
    }

    if (!rawText) {
      rawText = `Document: ${doc.title}\nType: ${doc.originalName}\nUploaded: ${doc.createdAt}`;
      if (doc.description) rawText += `\nDescription: ${doc.description}`;
    }

    const [kbDoc] = await db.insert(kbDocuments).values({
      companyId,
      projectId: project.id,
      title: doc.title,
      sourceType: "TEXT",
      rawText,
      status: "UPLOADED",
      createdById: userId,
    }).returning();

    await db.update(documents)
      .set({ kbDocumentId: kbDoc.id, updatedAt: new Date() })
      .where(eq(documents.id, String(req.params.id)));

    sendCreated(res, { kbDocumentId: kbDoc.id, status: "PROCESSING" });

    processKbDocumentAsync(kbDoc.id, rawText, doc.title, companyId, project.id).catch(err => {
      logger.error({ err, docId: doc.id, kbDocId: kbDoc.id }, "[KB] Background processing failed for document register doc");
    });
  } catch (error) {
    logger.error({ err: error }, "Error adding document to Knowledge Base");
    sendServerError(res, "Failed to add document to Knowledge Base");
  }
});

async function processKbDocumentAsync(
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

    logger.info({ docId, chunkCount: chunks.length }, "[KB] Document register doc processed successfully");
  } catch (error: any) {
    logger.error({ err: error, docId }, "[KB] Document register doc processing failed");
    await db.update(kbDocuments)
      .set({ status: "FAILED", errorMessage: error.message || "Processing failed" })
      .where(eq(kbDocuments.id, docId));
  }
}

router.post("/api/documents/:id/remove-from-kb", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const doc = await storage.getDocument(String(req.params.id));
    if (!doc) return sendNotFound(res, "Document not found");
    if (doc.companyId !== companyId) return sendForbidden(res);
    if (!doc.kbDocumentId) return sendBadRequest(res, "Document is not in the Knowledge Base");

    await db.delete(kbDocuments)
      .where(and(eq(kbDocuments.id, doc.kbDocumentId), eq(kbDocuments.companyId, companyId)));

    await db.update(documents)
      .set({ kbDocumentId: null, updatedAt: new Date() })
      .where(eq(documents.id, String(req.params.id)));

    sendSuccess(res, { success: true });
  } catch (error) {
    logger.error({ err: error }, "Error removing document from Knowledge Base");
    sendServerError(res, "Failed to remove from Knowledge Base");
  }
});

router.delete("/api/documents/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    await storage.deleteDocument(String(req.params.id));
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document");
    sendServerError(res, "An internal error occurred");
  }
});

export default router;
