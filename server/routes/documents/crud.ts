import { Router, Request, Response } from "express";
import crypto from "crypto";
import sharp from "sharp";
import { storage, db } from "../../storage";
import { eq, and } from "drizzle-orm";
import { jobMembers, documents, insertDocumentSchema } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { ObjectNotFoundError } from "../../replit_integrations/object_storage";
import logger from "../../lib/logger";
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

// ==================== DOCUMENTS ====================

router.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const { page, limit, search, status, typeId, disciplineId, categoryId, jobId, panelId, supplierId, purchaseOrderId, taskId, showLatestOnly, mimeTypePrefix, excludeChat } = req.query;
    
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
      showLatestOnly: showLatestOnly === "true",
      mimeTypePrefix: mimeTypePrefix ? String(mimeTypePrefix) : undefined,
      excludeChat: excludeChat === "true",
      allowedJobIds,
    });
    
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching documents");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch documents" });
  }
});

router.get("/api/documents/next-number", requireAuth, async (req, res) => {
  try {
    const { typeId } = req.query;
    if (!typeId) {
      return res.status(400).json({ error: "typeId is required" });
    }
    const nextNumber = await storage.getNextDocumentNumber(String(typeId));
    res.json({ documentNumber: nextNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next document number");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get next document number" });
  }
});

router.get("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) return res.status(404).json({ error: "Document not found" });
    res.json(document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document" });
  }
});

router.get("/api/documents/:id/versions", requireAuth, async (req, res) => {
  try {
    const versions = await storage.getDocumentVersionHistory(String(req.params.id));
    res.json(versions);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document versions");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document versions" });
  }
});

router.post("/api/documents/check-duplicates", requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentNumbers } = req.body;
    if (!documentNumbers || !Array.isArray(documentNumbers) || documentNumbers.length === 0) {
      return res.status(400).json({ error: "documentNumbers array is required" });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
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

    res.json({ duplicates });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error checking document duplicates");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check duplicates" });
  }
});

router.post("/api/documents/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { title, description, typeId, disciplineId, categoryId, documentTypeStatusId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential, documentNumber: manualDocNumber, revision: manualRevision, supersedeDocumentId } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
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
      return res.status(400).json({ error: "Company context required" });
    }

    if (supersedeDocumentId) {
      const parentDoc = await storage.getDocument(supersedeDocumentId);
      if (!parentDoc) {
        return res.status(404).json({ error: "Document to supersede not found" });
      }
      if (parentDoc.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
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

      return res.json({
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

    res.json(document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
});

router.post("/api/documents/:id/new-version", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const parentId = String(req.params.id);
    const parentDoc = await storage.getDocument(parentId);
    
    if (!parentDoc) {
      return res.status(404).json({ error: "Parent document not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
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
      return res.status(400).json({ error: "Company context required" });
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

    res.json({
      ...newDocument,
      affectedTenders: affectedTenders.length > 0 ? affectedTenders : undefined,
      supersededDocumentId: parentId,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating new document version");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create new version" });
  }
});

router.get("/api/documents/:id/view", requireAuth, async (req: Request, res: Response) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    await objectStorageService.downloadObject(objectFile, res);
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error viewing document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to view document" });
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
      return res.status(404).json({ error: "Document not found" });
    }

    const mimeType = (document.mimeType || "").toLowerCase();
    if (!mimeType.startsWith("image/")) {
      return res.status(415).json({ error: "Thumbnails only available for image files" });
    }

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const stream = objectFile.createReadStream();

    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", (err) => {
      logger.error({ err }, "Error streaming for thumbnail");
      if (!res.headersSent) {
        res.status(500).json({ error: "Error generating thumbnail" });
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
          res.status(500).json({ error: "Error generating thumbnail" });
        }
      }
    });
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error generating thumbnail");
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate thumbnail" });
    }
  }
});

router.get("/api/documents/:id/download", requireAuth, async (req: Request, res: Response) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
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
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error downloading document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to download document" });
  }
});

router.patch("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const parsed = insertDocumentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const document = await storage.updateDocument(String(req.params.id), parsed.data);
    if (!document) return res.status(404).json({ error: "Document not found" });
    res.json(document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document" });
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
    if (!document) return res.status(404).json({ error: "Document not found" });
    res.json(document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document status");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document status" });
  }
});

router.delete("/api/documents/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    await storage.deleteDocument(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document" });
  }
});

export default router;
