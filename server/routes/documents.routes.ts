import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { ObjectStorageService, ObjectNotFoundError } from "../replit_integrations/object_storage";
import { emailService } from "../services/email.service";
import logger from "../lib/logger";
import { 
  insertDocumentSchema, 
  insertDocumentBundleSchema,
  insertDocumentTypeSchema,
  insertDocumentTypeStatusSchema,
  insertDocumentDisciplineSchema,
  insertDocumentCategorySchema,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const router = Router();
const objectStorageService = new ObjectStorageService();

const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_MAX_CACHE = 500;
const thumbnailCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();

function evictOldestThumbnails() {
  if (thumbnailCache.size <= THUMBNAIL_MAX_CACHE) return;
  const entries = [...thumbnailCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = entries.slice(0, thumbnailCache.size - THUMBNAIL_MAX_CACHE);
  for (const [key] of toRemove) {
    thumbnailCache.delete(key);
  }
}

function buildContentDisposition(disposition: "attachment" | "inline", originalName: string): string {
  const asciiName = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encodedName = encodeURIComponent(originalName).replace(/'/g, '%27');
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/html", "text/xml", "application/json",
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
  "application/acad", "application/x-autocad", "image/vnd.dwg", "image/x-dwg",
  "application/dxf", "image/vnd.dxf",
  "application/x-step", "application/ifc",
  "application/rtf", "application/xml",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// ==================== DOCUMENT TYPES ====================

router.get("/api/document-types", requireAuth, async (req, res) => {
  try {
    const types = await storage.getAllDocumentTypes();
    res.json(types);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document types");
    res.status(500).json({ error: error.message || "Failed to fetch document types" });
  }
});

router.get("/api/document-types/active", requireAuth, async (req, res) => {
  try {
    const types = await storage.getActiveDocumentTypes();
    res.json(types);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active document types");
    res.status(500).json({ error: error.message || "Failed to fetch document types" });
  }
});

router.get("/api/document-types/:id", requireAuth, async (req, res) => {
  try {
    const type = await storage.getDocumentType(String(req.params.id));
    if (!type) return res.status(404).json({ error: "Document type not found" });
    res.json(type);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document type");
    res.status(500).json({ error: error.message || "Failed to fetch document type" });
  }
});

router.post("/api/document-types", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const type = await storage.createDocumentType(parsed.data);
    
    await storage.createDocumentTypeStatus({
      companyId: parsed.data.companyId,
      typeId: type.id,
      statusName: "DRAFT",
      color: "#EF4444",
      sortOrder: 0,
      isDefault: true,
      isActive: true,
    });
    await storage.createDocumentTypeStatus({
      companyId: parsed.data.companyId,
      typeId: type.id,
      statusName: "FINAL",
      color: "#22C55E",
      sortOrder: 1,
      isDefault: false,
      isActive: true,
    });
    
    res.json(type);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating document type");
    res.status(500).json({ error: error.message || "Failed to create document type" });
  }
});

router.patch("/api/document-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const type = await storage.updateDocumentType(String(req.params.id), parsed.data);
    if (!type) return res.status(404).json({ error: "Document type not found" });
    res.json(type);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document type");
    res.status(500).json({ error: error.message || "Failed to update document type" });
  }
});

router.delete("/api/document-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentType(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting document type");
    res.status(500).json({ error: error.message || "Failed to delete document type" });
  }
});

// ==================== DOCUMENT TYPE STATUSES ====================

router.get("/api/document-types/:typeId/statuses", requireAuth, async (req, res) => {
  try {
    const statuses = await storage.getDocumentTypeStatuses(String(req.params.typeId));
    res.json(statuses);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document type statuses");
    res.status(500).json({ error: error.message || "Failed to fetch statuses" });
  }
});

router.post("/api/document-types/:typeId/statuses", requireRole("ADMIN"), async (req, res) => {
  try {
    const data = {
      ...req.body,
      typeId: String(req.params.typeId),
    };
    const parsed = insertDocumentTypeStatusSchema.safeParse(data);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const status = await storage.createDocumentTypeStatus(parsed.data);
    res.json(status);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating document type status");
    res.status(500).json({ error: error.message || "Failed to create status" });
  }
});

router.patch("/api/document-types/:typeId/statuses/:statusId", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentTypeStatusSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const status = await storage.updateDocumentTypeStatus(String(req.params.statusId), parsed.data);
    if (!status) return res.status(404).json({ error: "Status not found" });
    res.json(status);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document type status");
    res.status(500).json({ error: error.message || "Failed to update status" });
  }
});

router.delete("/api/document-types/:typeId/statuses/:statusId", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentTypeStatus(String(req.params.statusId));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting document type status");
    res.status(500).json({ error: error.message || "Failed to delete status" });
  }
});

// ==================== DOCUMENT DISCIPLINES ====================

router.get("/api/document-disciplines", requireAuth, async (req, res) => {
  try {
    const disciplines = await storage.getAllDocumentDisciplines();
    res.json(disciplines);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document disciplines");
    res.status(500).json({ error: error.message || "Failed to fetch document disciplines" });
  }
});

router.get("/api/document-disciplines/active", requireAuth, async (req, res) => {
  try {
    const disciplines = await storage.getActiveDocumentDisciplines();
    res.json(disciplines);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active document disciplines");
    res.status(500).json({ error: error.message || "Failed to fetch document disciplines" });
  }
});

router.get("/api/document-disciplines/:id", requireAuth, async (req, res) => {
  try {
    const discipline = await storage.getDocumentDiscipline(String(req.params.id));
    if (!discipline) return res.status(404).json({ error: "Document discipline not found" });
    res.json(discipline);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document discipline");
    res.status(500).json({ error: error.message || "Failed to fetch document discipline" });
  }
});

router.post("/api/document-disciplines", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentDisciplineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const discipline = await storage.createDocumentDiscipline(parsed.data);
    res.json(discipline);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating document discipline");
    res.status(500).json({ error: error.message || "Failed to create document discipline" });
  }
});

router.patch("/api/document-disciplines/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentDisciplineSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const discipline = await storage.updateDocumentDiscipline(String(req.params.id), parsed.data);
    if (!discipline) return res.status(404).json({ error: "Document discipline not found" });
    res.json(discipline);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document discipline");
    res.status(500).json({ error: error.message || "Failed to update document discipline" });
  }
});

router.delete("/api/document-disciplines/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentDiscipline(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting document discipline");
    res.status(500).json({ error: error.message || "Failed to delete document discipline" });
  }
});

// ==================== DOCUMENT CATEGORIES ====================

router.get("/api/document-categories", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getAllDocumentCategories();
    res.json(categories);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document categories");
    res.status(500).json({ error: error.message || "Failed to fetch document categories" });
  }
});

router.get("/api/document-categories/active", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getActiveDocumentCategories();
    res.json(categories);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active document categories");
    res.status(500).json({ error: error.message || "Failed to fetch document categories" });
  }
});

router.get("/api/document-categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await storage.getDocumentCategory(String(req.params.id));
    if (!category) return res.status(404).json({ error: "Document category not found" });
    res.json(category);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document category");
    res.status(500).json({ error: error.message || "Failed to fetch document category" });
  }
});

router.post("/api/document-categories", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const category = await storage.createDocumentCategory(parsed.data);
    res.json(category);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating document category");
    res.status(500).json({ error: error.message || "Failed to create document category" });
  }
});

router.patch("/api/document-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertDocumentCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const category = await storage.updateDocumentCategory(String(req.params.id), parsed.data);
    if (!category) return res.status(404).json({ error: "Document category not found" });
    res.json(category);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document category");
    res.status(500).json({ error: error.message || "Failed to update document category" });
  }
});

router.delete("/api/document-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentCategory(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting document category");
    res.status(500).json({ error: error.message || "Failed to delete document category" });
  }
});

// ==================== DOCUMENTS ====================

router.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const { page, limit, search, status, typeId, disciplineId, categoryId, jobId, panelId, supplierId, purchaseOrderId, taskId, showLatestOnly, mimeTypePrefix, excludeChat } = req.query;
    
    const result = await storage.getDocuments({
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
    });
    
    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching documents");
    res.status(500).json({ error: error.message || "Failed to fetch documents" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error getting next document number");
    res.status(500).json({ error: error.message || "Failed to get next document number" });
  }
});

router.get("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const document = await storage.getDocument(String(req.params.id));
    if (!document) return res.status(404).json({ error: "Document not found" });
    res.json(document);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document");
    res.status(500).json({ error: error.message || "Failed to fetch document" });
  }
});

router.get("/api/documents/:id/versions", requireAuth, async (req, res) => {
  try {
    const versions = await storage.getDocumentVersionHistory(String(req.params.id));
    res.json(versions);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document versions");
    res.status(500).json({ error: error.message || "Failed to fetch document versions" });
  }
});

router.post("/api/documents/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { title, description, typeId, disciplineId, categoryId, documentTypeStatusId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential } = req.body;

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
    if (typeId) {
      documentNumber = await storage.getNextDocumentNumber(typeId);
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error uploading document");
    res.status(500).json({ error: error.message || "Failed to upload document" });
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

    res.json(newDocument);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating new document version");
    res.status(500).json({ error: error.message || "Failed to create new version" });
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
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error viewing document");
    res.status(500).json({ error: error.message || "Failed to view document" });
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
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error generating thumbnail");
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Failed to generate thumbnail" });
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
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error downloading document");
    res.status(500).json({ error: error.message || "Failed to download document" });
  }
});

// ============================================================================
// Visual Diff / Overlay Comparison
// ============================================================================

const visualDiffSchema = z.object({
  docId1: z.string().min(1),
  docId2: z.string().min(1),
  page: z.number().int().min(0).default(0),
  dpi: z.number().int().min(72).max(300).default(150),
  sensitivity: z.number().int().min(1).max(255).default(30),
  mode: z.enum(["overlay", "side-by-side", "both"]).default("overlay"),
});

router.post("/api/documents/visual-diff", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = visualDiffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid parameters", details: parsed.error.flatten() });
    }

    const userId = req.session.userId;
    const companyId = req.companyId;
    if (!userId || !companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { generateVisualDiff } = await import("../services/visual-diff.service");

    const result = await generateVisualDiff({
      ...parsed.data,
      uploadedBy: userId,
      companyId,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, "Visual diff endpoint error");
    res.status(500).json({ error: error.message || "Failed to generate visual diff" });
  }
});

const sendDocumentsEmailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  documentIds: z.array(z.string()).min(1, "At least one document is required"),
  sendCopy: z.boolean().default(false),
});

router.post("/api/documents/send-email", requireAuth, async (req, res) => {
  try {
    const parsed = sendDocumentsEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, documentIds, sendCopy } = parsed.data;

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure Mailgun settings (MAILGUN_API_KEY, MAILGUN_DOMAIN)." });
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    const docs = await storage.getDocumentsByIds(documentIds);
    const docsMap = new Map(docs.map(d => [d.id, d]));

    for (const docId of documentIds) {
      try {
        const doc = docsMap.get(docId);
        if (!doc) {
          logger.warn({ docId }, "Document not found for email attachment, skipping");
          continue;
        }

        const objectFile = await objectStorageService.getObjectEntityFile(doc.storageKey);
        const [metadata] = await objectFile.getMetadata();

        const chunks: Buffer[] = [];
        const stream = objectFile.createReadStream();
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve());
          stream.on("error", (err: Error) => reject(err));
        });

        attachments.push({
          filename: doc.originalName,
          content: Buffer.concat(chunks),
          contentType: (metadata as Record<string, string>).contentType || "application/octet-stream",
        });
      } catch (err) {
        logger.warn({ docId, err }, "Failed to load document for email attachment, skipping");
      }
    }

    if (attachments.length === 0) {
      return res.status(400).json({ error: "No documents could be loaded for attachment" });
    }

    let bcc: string | undefined;
    if (sendCopy && req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (currentUser?.email) {
        bcc = currentUser.email;
      }
    }

    const htmlBody = message.replace(/\n/g, "<br>");

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments,
    });

    if (result.success) {
      logger.info({ documentCount: attachments.length, to }, "Documents email sent successfully");
      res.json({ success: true, messageId: result.messageId, attachedCount: attachments.length });
    } else {
      logger.error({ error: result.error }, "Failed to send documents email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: any) {
    logger.error({ err: error }, "Error sending documents email");
    res.status(500).json({ error: error.message || "Failed to send email" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document");
    res.status(500).json({ error: error.message || "Failed to update document" });
  }
});

router.patch("/api/documents/:id/status", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { status, approvedBy } = req.body;
    const updateData: any = { status };
    
    if (status === "APPROVED") {
      updateData.approvedBy = req.session.userId;
      updateData.approvedAt = new Date();
    }
    
    const document = await storage.updateDocument(String(req.params.id), updateData);
    if (!document) return res.status(404).json({ error: "Document not found" });
    res.json(document);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document status");
    res.status(500).json({ error: error.message || "Failed to update document status" });
  }
});

router.delete("/api/documents/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    await storage.deleteDocument(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting document");
    res.status(500).json({ error: error.message || "Failed to delete document" });
  }
});

// ==================== DOCUMENT BUNDLES ====================

router.get("/api/document-bundles", requireAuth, async (req, res) => {
  try {
    const bundles = await storage.getAllDocumentBundles();
    res.json(bundles);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document bundles");
    res.status(500).json({ error: error.message || "Failed to fetch document bundles" });
  }
});

router.get("/api/document-bundles/:id", requireAuth, async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundle(String(req.params.id));
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document bundle");
    res.status(500).json({ error: error.message || "Failed to fetch document bundle" });
  }
});

router.get("/api/document-bundles/qr/:qrCodeId", requireAuth, async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching document bundle by QR");
    res.status(500).json({ error: error.message || "Failed to fetch document bundle" });
  }
});

router.post("/api/document-bundles", requireAuth, async (req, res) => {
  try {
    const { bundleName, description, jobId, supplierId, allowGuestAccess, expiresAt, documentIds } = req.body;

    if (!bundleName) {
      return res.status(400).json({ error: "Bundle name is required" });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    let finalDescription = description || null;

    if (!finalDescription && documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      try {
        const bundleDocs = await storage.getDocumentsByIds(documentIds);
        const docDetails: string[] = [];
        for (const doc of bundleDocs) {
          const parts = [doc.title];
          if (doc.type?.typeName) parts.push(`(${doc.type.typeName})`);
          if (doc.discipline?.disciplineName) parts.push(`[${doc.discipline.disciplineName}]`);
          docDetails.push(parts.join(" "));
        }

        if (docDetails.length > 0) {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a document management assistant for a construction/precast company. Generate a brief 1-2 sentence description of what a document bundle contains based on the document names provided. Be concise and professional. Do not use quotes around the description."
              },
              {
                role: "user",
                content: `Bundle name: "${bundleName}"\nDocuments included:\n${docDetails.map((d, i) => `${i + 1}. ${d}`).join("\n")}`
              }
            ],
            max_completion_tokens: 100,
          });
          finalDescription = completion.choices[0]?.message?.content?.trim() || null;
        }
      } catch (aiError) {
        logger.warn({ err: aiError }, "Failed to generate AI bundle description, continuing without it");
      }
    }

    const qrCodeId = `bundle-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

    const bundle = await storage.createDocumentBundle({
      companyId,
      bundleName,
      description: finalDescription,
      qrCodeId,
      jobId: jobId || null,
      supplierId: supplierId || null,
      isPublic: false,
      allowGuestAccess: allowGuestAccess || false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.session.userId!,
    });

    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      await storage.addDocumentsToBundle(bundle.id, documentIds, req.session.userId!);
    }

    const fullBundle = await storage.getDocumentBundle(bundle.id);
    res.json(fullBundle);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating document bundle");
    res.status(500).json({ error: error.message || "Failed to create document bundle" });
  }
});

router.patch("/api/document-bundles/:id", requireAuth, async (req, res) => {
  try {
    const parsed = insertDocumentBundleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const bundle = await storage.updateDocumentBundle(String(req.params.id), {
      ...parsed.data,
      updatedBy: req.session.userId,
    });
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating document bundle");
    res.status(500).json({ error: error.message || "Failed to update document bundle" });
  }
});

router.post("/api/document-bundles/:id/documents", requireAuth, async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({ error: "documentIds array is required" });
    }

    const items = await storage.addDocumentsToBundle(String(req.params.id), documentIds, req.session.userId!);
    res.json(items);
  } catch (error: any) {
    logger.error({ err: error }, "Error adding documents to bundle");
    res.status(500).json({ error: error.message || "Failed to add documents to bundle" });
  }
});

router.delete("/api/document-bundles/:bundleId/documents/:documentId", requireAuth, async (req, res) => {
  try {
    await storage.removeDocumentFromBundle(String(req.params.bundleId), String(req.params.documentId));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error removing document from bundle");
    res.status(500).json({ error: error.message || "Failed to remove document from bundle" });
  }
});

router.delete("/api/document-bundles/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundle(String(req.params.id));
    if (!bundle || bundle.companyId !== req.companyId) {
      return res.status(404).json({ error: "Bundle not found" });
    }
    await storage.deleteDocumentBundle(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting document bundle");
    res.status(500).json({ error: error.message || "Failed to delete document bundle" });
  }
});

// ==================== PUBLIC BUNDLE ACCESS (No Auth) ====================

// Helper to get client IP address
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

// Helper to validate bundle access and log failed attempts
async function validateBundleAccess(
  bundle: any, 
  req: Request, 
  res: Response, 
  accessType: string
): Promise<boolean> {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || undefined;
  
  if (!bundle) {
    res.status(404).json({ error: "Bundle not found" });
    return false;
  }

  if (!bundle.allowGuestAccess) {
    // Log denied access attempt
    await storage.logBundleAccess(bundle.id, `DENIED_${accessType}`, undefined, ipAddress, userAgent);
    res.status(403).json({ error: "Guest access is not allowed for this bundle" });
    return false;
  }

  if (bundle.expiresAt && new Date(bundle.expiresAt) < new Date()) {
    // Log denied access attempt
    await storage.logBundleAccess(bundle.id, `DENIED_EXPIRED_${accessType}`, undefined, ipAddress, userAgent);
    res.status(410).json({ error: "This bundle has expired" });
    return false;
  }

  return true;
}

router.get("/api/public/bundles/:qrCodeId", async (req, res) => {
  try {
    const qrCodeId = String(req.params.qrCodeId);
    const bundle = await storage.getDocumentBundleByQr(qrCodeId);
    
    if (!await validateBundleAccess(bundle, req, res, "VIEW_BUNDLE")) return;

    // Log the access
    await storage.logBundleAccess(
      bundle!.id,
      "VIEW_BUNDLE",
      undefined,
      getClientIp(req),
      req.headers["user-agent"] || undefined
    );

    res.json({
      bundleName: bundle!.bundleName,
      description: bundle!.description,
      items: bundle!.items.map(item => ({
        id: item.document.id,
        title: item.document.title,
        fileName: item.document.originalName,
        mimeType: item.document.mimeType,
        fileSize: item.document.fileSize,
      })),
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching public bundle");
    res.status(500).json({ error: error.message || "Failed to fetch bundle" });
  }
});

// View document inline (for PDFs, images in browser)
router.get("/api/public/bundles/:qrCodeId/documents/:documentId/view", async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    const documentId = String(req.params.documentId);
    
    if (!await validateBundleAccess(bundle, req, res, "VIEW_DOCUMENT")) return;

    const bundleItem = bundle!.items.find(item => item.documentId === documentId);
    
    if (!bundleItem) {
      // Log attempt to access document not in bundle
      await storage.logBundleAccess(bundle!.id, "DENIED_VIEW_DOCUMENT_NOT_IN_BUNDLE", documentId, getClientIp(req), req.headers["user-agent"] || undefined);
      return res.status(404).json({ error: "Document not found in this bundle" });
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Log the successful view access
    await storage.logBundleAccess(
      bundle!.id,
      "VIEW_DOCUMENT",
      documentId,
      getClientIp(req),
      req.headers["user-agent"] || undefined
    );

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const [metadata] = await objectFile.getMetadata();
    
    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition("inline", document.originalName),
    });

    const stream = objectFile.createReadStream();
    stream.pipe(res);
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error viewing public bundle document");
    res.status(500).json({ error: error.message || "Failed to view document" });
  }
});

// Download document as attachment
router.get("/api/public/bundles/:qrCodeId/documents/:documentId/download", async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    const documentId = String(req.params.documentId);
    
    if (!await validateBundleAccess(bundle, req, res, "DOWNLOAD_DOCUMENT")) return;

    const bundleItem = bundle!.items.find(item => item.documentId === documentId);
    
    if (!bundleItem) {
      // Log attempt to download document not in bundle
      await storage.logBundleAccess(bundle!.id, "DENIED_DOWNLOAD_DOCUMENT_NOT_IN_BUNDLE", documentId, getClientIp(req), req.headers["user-agent"] || undefined);
      return res.status(404).json({ error: "Document not found in this bundle" });
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Log the successful download access
    await storage.logBundleAccess(
      bundle!.id,
      "DOWNLOAD_DOCUMENT",
      documentId,
      getClientIp(req),
      req.headers["user-agent"] || undefined
    );

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const [metadata] = await objectFile.getMetadata();
    
    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition("attachment", document.originalName),
    });

    const stream = objectFile.createReadStream();
    stream.pipe(res);
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error downloading public bundle document");
    res.status(500).json({ error: error.message || "Failed to download document" });
  }
});

// Get bundle access logs (admin only)
router.get("/api/document-bundles/:id/access-logs", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const logs = await storage.getBundleAccessLogs(String(req.params.id));
    res.json(logs);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching bundle access logs");
    res.status(500).json({ error: error.message || "Failed to fetch access logs" });
  }
});

// ==================== AI DOCUMENT ANALYSIS ====================

router.post("/api/documents/analyze-version", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const originalDocumentId = req.body.originalDocumentId;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!originalDocumentId) {
      return res.status(400).json({ error: "Original document ID required" });
    }

    const originalDocument = await storage.getDocument(originalDocumentId);
    if (!originalDocument) {
      return res.status(404).json({ error: "Original document not found" });
    }

    // For text-based files, analyze content differences
    const newFileName = file.originalname;
    const originalFileName = originalDocument.originalName;
    const newFileSize = file.size;
    const originalFileSize = originalDocument.fileSize || 0;
    const mimeType = file.mimetype;

    // Build context for AI analysis
    let prompt = `You are analyzing a document version update. Compare the new version to the original and provide a brief, professional summary of what likely changed.

Original Document:
- Title: ${originalDocument.title}
- File Name: ${originalFileName}
- File Size: ${originalFileSize} bytes
- Type: ${originalDocument.type?.typeName || 'Unknown'}
- Discipline: ${originalDocument.discipline?.disciplineName || 'Unknown'}

New Version:
- File Name: ${newFileName}
- File Size: ${newFileSize} bytes
- Size Change: ${newFileSize > originalFileSize ? `+${newFileSize - originalFileSize}` : newFileSize - originalFileSize} bytes

Based on the file information and typical document workflows, provide a concise 1-2 sentence summary of what likely changed. Focus on professional, construction/engineering document terminology where appropriate. Examples: "Updated drawing with revised dimensions", "Incorporated client feedback on specifications", "Minor text corrections and formatting updates".`;

    // For PDF/text files, try to extract and compare content
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
      prompt += `\n\nNote: This is a ${mimeType} file. Consider typical changes for this document type.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a document management assistant that provides brief, professional summaries of document changes. Keep responses concise and relevant to construction/engineering workflows."
        },
        { role: "user", content: prompt }
      ],
      max_completion_tokens: 150,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "";

    logger.info({ originalDocumentId, newFileName }, "AI version analysis completed");
    res.json({ summary });
  } catch (error: any) {
    logger.error({ err: error }, "Error analyzing document version with AI");
    res.status(500).json({ error: "Failed to analyze document", summary: "" });
  }
});

// ============================================================================
// PANEL DOCUMENTS (Mini Document Register)
// ============================================================================

router.get("/api/panels/:panelId/documents", requireAuth, async (req, res) => {
  try {
    const panelId = String(req.params.panelId);
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const panel = await storage.getPanelById(panelId);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    const result = await storage.getDocuments({
      page: 1,
      limit: 100,
      panelId: panelId,
      showLatestOnly: true,
    });

    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching panel documents");
    res.status(500).json({ error: error.message || "Failed to fetch panel documents" });
  }
});

router.post("/api/panels/:panelId/documents/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const panelId = String(req.params.panelId);
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const panel = await storage.getPanelById(panelId);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { title, description, status, typeId, supersededDocumentId } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!status || !["PRELIM", "IFA", "IFC"].includes(status)) {
      return res.status(400).json({ error: "Status must be PRELIM, IFA, or IFC" });
    }

    if (status === "IFC") {
      const existingDocs = await storage.getDocuments({
        page: 1,
        limit: 100,
        panelId: panelId,
        showLatestOnly: true,
      });
      
      const existingIfcDocs = existingDocs.documents.filter(
        d => d.status === "IFC" && d.isLatestVersion
      );

      if (existingIfcDocs.length > 0 && !supersededDocumentId) {
        return res.status(400).json({ 
          error: "IFC document already exists. You must supersede the existing IFC document.",
          existingIfcDocuments: existingIfcDocs.map(d => ({ id: d.id, title: d.title, documentNumber: d.documentNumber }))
        });
      }

      if (supersededDocumentId) {
        const docToSupersede = existingIfcDocs.find(d => d.id === supersededDocumentId);
        if (!docToSupersede) {
          return res.status(400).json({ error: "Superseded document not found or is not an IFC document" });
        }
      }
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
    if (typeId) {
      documentNumber = await storage.getNextDocumentNumber(typeId);
    }

    let parentDocumentId: string | undefined;
    let version = "1.0";
    let revision = "A";

    if (supersededDocumentId) {
      const parentDoc = await storage.getDocument(supersededDocumentId);
      if (parentDoc) {
        await storage.updateDocument(supersededDocumentId, {
          isLatestVersion: false,
          status: "SUPERSEDED",
        });
        
        parentDocumentId = supersededDocumentId;
        const currentVersion = parseFloat(parentDoc.version || "1.0");
        version = String((currentVersion + 1).toFixed(1));
      }
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
      typeId: typeId || null,
      disciplineId: null,
      categoryId: null,
      jobId: panel.jobId || null,
      panelId,
      supplierId: null,
      purchaseOrderId: null,
      taskId: null,
      tags: null,
      isConfidential: false,
      uploadedBy: req.session.userId!,
      status: status as "PRELIM" | "IFA" | "IFC",
      version,
      revision,
      isLatestVersion: true,
      parentDocumentId,
    });

    logger.info({ documentId: document.id, panelId, status }, "Panel document uploaded");
    res.json(document);
  } catch (error: any) {
    logger.error({ err: error }, "Error uploading panel document");
    res.status(500).json({ error: error.message || "Failed to upload panel document" });
  }
});

router.patch("/api/panels/:panelId/documents/:documentId/status", requireAuth, async (req, res) => {
  try {
    const panelId = String(req.params.panelId);
    const documentId = String(req.params.documentId);
    const { status } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const panel = await storage.getPanelById(panelId);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    const document = await storage.getDocument(documentId);
    if (!document || document.panelId !== panelId) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!["PRELIM", "IFA", "IFC", "SUPERSEDED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === "IFC") {
      const existingDocs = await storage.getDocuments({
        page: 1,
        limit: 100,
        panelId: panelId,
        showLatestOnly: true,
      });
      
      const existingIfcDocs = existingDocs.documents.filter(
        d => d.status === "IFC" && d.isLatestVersion && d.id !== documentId
      );

      if (existingIfcDocs.length > 0) {
        return res.status(400).json({ 
          error: "Cannot change status to IFC - another IFC document already exists for this panel"
        });
      }
    }

    const updated = await storage.updateDocument(documentId, { status });
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating panel document status");
    res.status(500).json({ error: error.message || "Failed to update status" });
  }
});

export default router;
