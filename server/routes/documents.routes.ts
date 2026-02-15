import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import OpenAI from "openai";
import sharp from "sharp";
import archiver from "archiver";
import { PassThrough } from "stream";
import { z } from "zod";
import { storage, db } from "../storage";
import { eq, and, desc, or, isNull, inArray } from "drizzle-orm";
import { jobMembers, documents, documentBundles, tenderPackages, tenders, documentBundleItems } from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { ObjectStorageService, ObjectNotFoundError } from "../replit_integrations/object_storage";
import { emailService } from "../services/email.service";
import { buildBrandedEmail } from "../lib/email-template";
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

async function findAffectedOpenTenders(documentId: string, companyId: string) {
  const directPackages = await db
    .select({
      tenderId: tenders.id,
      tenderTitle: tenders.title,
      tenderNumber: tenders.tenderNumber,
      tenderStatus: tenders.status,
      packageId: tenderPackages.id,
    })
    .from(tenderPackages)
    .innerJoin(tenders, eq(tenderPackages.tenderId, tenders.id))
    .where(and(
      eq(tenderPackages.documentId, documentId),
      eq(tenderPackages.companyId, companyId),
      inArray(tenders.status, ["DRAFT", "OPEN", "UNDER_REVIEW"]),
    ));

  const bundleItems = await db
    .select({ bundleId: documentBundleItems.bundleId })
    .from(documentBundleItems)
    .innerJoin(documentBundles, eq(documentBundleItems.bundleId, documentBundles.id))
    .where(and(eq(documentBundleItems.documentId, documentId), eq(documentBundles.companyId, companyId)));

  const bundleIds = bundleItems.map(b => b.bundleId);
  let bundlePackages: typeof directPackages = [];
  if (bundleIds.length > 0) {
    bundlePackages = await db
      .select({
        tenderId: tenders.id,
        tenderTitle: tenders.title,
        tenderNumber: tenders.tenderNumber,
        tenderStatus: tenders.status,
        packageId: tenderPackages.id,
      })
      .from(tenderPackages)
      .innerJoin(tenders, eq(tenderPackages.tenderId, tenders.id))
      .where(and(
        inArray(tenderPackages.bundleId, bundleIds),
        eq(tenderPackages.companyId, companyId),
        inArray(tenders.status, ["DRAFT", "OPEN", "UNDER_REVIEW"]),
      ));
  }

  const allHits = [...directPackages, ...bundlePackages];
  const tenderMap = new Map<string, { tenderId: string; tenderTitle: string; tenderNumber: string; tenderStatus: string; packageIds: string[] }>();
  for (const hit of allHits) {
    const existing = tenderMap.get(hit.tenderId);
    if (existing) {
      if (!existing.packageIds.includes(hit.packageId)) existing.packageIds.push(hit.packageId);
    } else {
      tenderMap.set(hit.tenderId, {
        tenderId: hit.tenderId,
        tenderTitle: hit.tenderTitle,
        tenderNumber: hit.tenderNumber,
        tenderStatus: hit.tenderStatus,
        packageIds: [hit.packageId],
      });
    }
  }
  return Array.from(tenderMap.values());
}

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

const bulkUpload = multer({
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
    const types = await storage.getAllDocumentTypes(req.companyId);
    res.json(types);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document types");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document types" });
  }
});

router.get("/api/document-types/active", requireAuth, async (req, res) => {
  try {
    const types = await storage.getActiveDocumentTypes(req.companyId);
    res.json(types);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active document types");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document types" });
  }
});

router.get("/api/document-types/:id", requireAuth, async (req, res) => {
  try {
    const type = await storage.getDocumentType(String(req.params.id));
    if (!type) return res.status(404).json({ error: "Document type not found" });
    res.json(type);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document type");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document type" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating document type");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create document type" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document type");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document type" });
  }
});

router.delete("/api/document-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentType(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document type");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document type" });
  }
});

// ==================== DOCUMENT TYPE STATUSES ====================

router.get("/api/document-types/:typeId/statuses", requireAuth, async (req, res) => {
  try {
    const statuses = await storage.getDocumentTypeStatuses(String(req.params.typeId));
    res.json(statuses);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document type statuses");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch statuses" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating document type status");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create status" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document type status");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update status" });
  }
});

router.delete("/api/document-types/:typeId/statuses/:statusId", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentTypeStatus(String(req.params.statusId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document type status");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete status" });
  }
});

// ==================== DOCUMENT DISCIPLINES ====================

router.get("/api/document-disciplines", requireAuth, async (req, res) => {
  try {
    const disciplines = await storage.getAllDocumentDisciplines(req.companyId);
    res.json(disciplines);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document disciplines");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document disciplines" });
  }
});

router.get("/api/document-disciplines/active", requireAuth, async (req, res) => {
  try {
    const disciplines = await storage.getActiveDocumentDisciplines(req.companyId);
    res.json(disciplines);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active document disciplines");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document disciplines" });
  }
});

router.get("/api/document-disciplines/:id", requireAuth, async (req, res) => {
  try {
    const discipline = await storage.getDocumentDiscipline(String(req.params.id));
    if (!discipline) return res.status(404).json({ error: "Document discipline not found" });
    res.json(discipline);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document discipline");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document discipline" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating document discipline");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create document discipline" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document discipline");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document discipline" });
  }
});

router.delete("/api/document-disciplines/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentDiscipline(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document discipline");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document discipline" });
  }
});

// ==================== DOCUMENT CATEGORIES ====================

router.get("/api/document-categories", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getAllDocumentCategories(req.companyId);
    res.json(categories);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document categories");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document categories" });
  }
});

router.get("/api/document-categories/active", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getActiveDocumentCategories(req.companyId);
    res.json(categories);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active document categories");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document categories" });
  }
});

router.get("/api/document-categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await storage.getDocumentCategory(String(req.params.id));
    if (!category) return res.status(404).json({ error: "Document category not found" });
    res.json(category);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document category" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating document category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create document category" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document category" });
  }
});

router.delete("/api/document-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteDocumentCategory(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document category" });
  }
});

// ==================== DOCUMENTS ====================

router.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const { page, limit, search, status, typeId, disciplineId, categoryId, jobId, panelId, supplierId, purchaseOrderId, taskId, showLatestOnly, mimeTypePrefix, excludeChat } = req.query;
    
    let allowedJobIds: string[] | undefined;
    const user = await storage.getUser(req.session.userId!);
    if (user && user.role !== "ADMIN" && user.role !== "MANAGER") {
      const memberships = await db.select({ jobId: jobMembers.jobId })
        .from(jobMembers)
        .where(eq(jobMembers.userId, req.session.userId!));
      allowedJobIds = memberships.map(m => m.jobId);
    }

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
        );

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
  } catch (error: unknown) {
    logger.error({ err: error }, "Visual diff endpoint error");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate visual diff" });
  }
});

const sendDocumentsEmailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  documentIds: z.array(z.string()).min(1, "At least one document is required"),
  sendCopy: z.boolean().default(false),
  combinePdf: z.boolean().default(false),
});

router.post("/api/documents/send-email", requireAuth, async (req, res) => {
  try {
    const parsed = sendDocumentsEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, documentIds, sendCopy, combinePdf } = parsed.data;

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure the Resend email integration." });
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    const failedDocs: string[] = [];

    const docs = await storage.getDocumentsByIds(documentIds);
    const docsMap = new Map(docs.map(d => [d.id, d]));

    for (const docId of documentIds) {
      try {
        const doc = docsMap.get(docId);
        if (!doc) {
          failedDocs.push(`Unknown document (${docId})`);
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
        const doc = docsMap.get(docId);
        failedDocs.push(doc ? `${doc.title} (${doc.originalName})` : docId);
        logger.warn({ docId, err }, "Failed to load document for email attachment, skipping");
      }
    }

    if (attachments.length === 0) {
      const failedList = failedDocs.join(", ");
      return res.status(400).json({ error: `Could not load document files for attachment: ${failedList}. The files may have been deleted from storage.` });
    }

    let bcc: string | undefined;
    let senderName = "A team member";
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (sendCopy && currentUser?.email) {
        bcc = currentUser.email;
      }
      if (currentUser) {
        senderName = currentUser.name || currentUser.email;
      }
    }

    const docListHtml = docs
      .filter(d => d !== undefined)
      .map(d => `<tr>
        <td style="padding: 4px 8px; font-size: 13px; color: #334155;">${d.title}</td>
        <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">${d.originalName}</td>
        <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">${d.revision || "-"}</td>
      </tr>`)
      .join("");

    const attachmentSummary = `
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #334155;">${attachments.length} Document${attachments.length !== 1 ? "s" : ""} Attached:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr style="background-color: #e2e8f0;">
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Title</td>
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">File</td>
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Rev</td>
        </tr>
        ${docListHtml}
      </table>`;

    const htmlBody = await buildBrandedEmail({
      title: "Documents Shared With You",
      subtitle: `Sent by ${senderName}`,
      body: message.replace(/\n/g, "<br>"),
      attachmentSummary,
      footerNote: "Please download the attached documents. If you have any questions, reply directly to this email.",
    });

    let finalAttachments = attachments;
    let wasZipped = false;
    let wasCombined = false;

    if (combinePdf && attachments.length > 1) {
      const pdfAttachments = attachments.filter(a => a.contentType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf"));
      const nonPdfAttachments = attachments.filter(a => a.contentType !== "application/pdf" && !a.filename.toLowerCase().endsWith(".pdf"));

      if (pdfAttachments.length >= 2) {
        const fs = await import("fs");
        const pathMod = await import("path");
        const os = await import("os");
        const { spawn } = await import("child_process");

        const tempDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), "combine-pdf-"));
        const inputFiles: string[] = [];
        try {
          for (let i = 0; i < pdfAttachments.length; i++) {
            const filePath = pathMod.join(tempDir, `input_${i}.pdf`);
            fs.writeFileSync(filePath, pdfAttachments[i].content);
            inputFiles.push(filePath);
          }
          const outputPath = pathMod.join(tempDir, "combined.pdf");

          const combineScript = `
import fitz
import sys
import json

input_files = json.loads(sys.argv[1])
output_path = sys.argv[2]
combined = fitz.open()

for f in input_files:
    try:
        doc = fitz.open(f)
        combined.insert_pdf(doc)
        doc.close()
    except Exception as e:
        print(f"Warning: Could not add {f}: {e}", file=sys.stderr)

page_count = len(combined)
combined.save(output_path)
combined.close()
print(json.dumps({"pages": page_count}))
`;

          await new Promise<void>((resolve, reject) => {
            let errorOutput = "";
            const proc = spawn("python3", ["-c", combineScript, JSON.stringify(inputFiles), outputPath], { timeout: 60000 });
            proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
            proc.on("close", (code: number | null) => {
              if (code === 0) resolve();
              else reject(new Error(`PDF combine failed: ${errorOutput}`));
            });
            proc.on("error", (err: Error) => reject(err));
          });

          const combinedBuffer = fs.readFileSync(outputPath);
          finalAttachments = [
            { filename: "Combined Documents.pdf", content: combinedBuffer, contentType: "application/pdf" },
            ...nonPdfAttachments,
          ];
          wasCombined = true;

          logger.info({ inputCount: pdfAttachments.length, combinedSize: combinedBuffer.length }, "Documents combined into single PDF for email");
        } catch (combineErr) {
          logger.warn({ err: combineErr }, "Failed to combine PDFs, sending individually instead");
        } finally {
          try {
            for (const f of inputFiles) { try { fs.unlinkSync(f); } catch {} }
            const outputPath = pathMod.join(tempDir, "combined.pdf");
            try { fs.unlinkSync(outputPath); } catch {}
            fs.rmdirSync(tempDir);
          } catch {}
        }
      }
    }

    const ZIP_THRESHOLD = 5 * 1024 * 1024; // 5MB
    const totalSize = finalAttachments.reduce((sum, att) => sum + att.content.length, 0);

    if (!wasCombined && totalSize > ZIP_THRESHOLD) {
      try {
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const passthrough = new PassThrough();
          const archive = archiver("zip", { zlib: { level: 6 } });

          archive.on("error", (err: Error) => reject(err));
          passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
          passthrough.on("end", () => resolve(Buffer.concat(chunks)));
          passthrough.on("error", (err: Error) => reject(err));

          archive.pipe(passthrough);

          for (const att of attachments) {
            archive.append(att.content, { name: att.filename });
          }
          archive.finalize();
        });

        finalAttachments = [{
          filename: "documents.zip",
          content: zipBuffer,
          contentType: "application/zip",
        }];
        wasZipped = true;
        logger.info(
          { originalSize: totalSize, zippedSize: zipBuffer.length, fileCount: attachments.length },
          "Documents zipped for email (total exceeded 5MB)"
        );
      } catch (zipErr) {
        logger.warn({ err: zipErr }, "Failed to zip documents, sending individually instead");
      }
    }

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments: finalAttachments,
    });

    if (result.success) {
      logger.info({ documentCount: attachments.length, to, zipped: wasZipped, combined: wasCombined }, "Documents email sent successfully");
      res.json({ success: true, messageId: result.messageId, attachedCount: finalAttachments.length, zipped: wasZipped, combined: wasCombined });
    } else {
      logger.error({ error: result.error }, "Failed to send documents email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending documents email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send email" });
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

// ==================== DOCUMENT BUNDLES ====================

router.get("/api/document-bundles", requireAuth, async (req, res) => {
  try {
    const jobId = req.query.jobId as string | undefined;
    if (jobId) {
      const companyId = req.session.companyId!;
      const bundles = await db
        .select()
        .from(documentBundles)
        .where(and(
          or(eq(documentBundles.jobId, jobId), isNull(documentBundles.jobId)),
          eq(documentBundles.companyId, companyId),
        ))
        .orderBy(desc(documentBundles.createdAt));
      return res.json(bundles);
    }
    const bundles = await storage.getAllDocumentBundles(req.companyId);
    res.json(bundles);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document bundles");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document bundles" });
  }
});

router.get("/api/document-bundles/:id", requireAuth, async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundle(String(req.params.id));
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document bundle" });
  }
});

router.get("/api/document-bundles/qr/:qrCodeId", requireAuth, async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document bundle by QR");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document bundle" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating document bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create document bundle" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document bundle" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error adding documents to bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add documents to bundle" });
  }
});

router.delete("/api/document-bundles/:bundleId/documents/:documentId", requireAuth, async (req, res) => {
  try {
    await storage.removeDocumentFromBundle(String(req.params.bundleId), String(req.params.documentId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error removing document from bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to remove document from bundle" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document bundle" });
  }
});

// Request latest version of a document in a bundle
router.post("/api/document-bundles/:bundleId/items/:itemId/request-latest", requireAuth, async (req, res) => {
  try {
    const bundleId = req.params.bundleId as string;
    const itemId = req.params.itemId as string;
    const companyId = req.companyId;

    const bundle = await storage.getDocumentBundle(bundleId);
    if (!bundle || bundle.companyId !== companyId) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    const bundleItem = bundle.items.find(item => item.id === itemId);
    if (!bundleItem) {
      return res.status(404).json({ error: "Bundle item not found" });
    }

    const currentDoc = bundleItem.document;
    if (!currentDoc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (currentDoc.isLatestVersion) {
      return res.status(400).json({ error: "Document is already the latest version" });
    }

    let latestDoc = null;
    if (currentDoc.documentNumber) {
      const [latest] = await db.select().from(documents)
        .where(and(
          eq(documents.documentNumber, currentDoc.documentNumber),
          eq(documents.companyId, companyId),
          eq(documents.isLatestVersion, true)
        ))
        .limit(1);
      latestDoc = latest;
    }

    if (!latestDoc) {
      const allVersions = await db.select().from(documents)
        .where(and(
          eq(documents.companyId, companyId),
          eq(documents.isLatestVersion, true),
          eq(documents.parentDocumentId, currentDoc.parentDocumentId || currentDoc.id)
        ))
        .limit(1);
      if (allVersions.length > 0) {
        latestDoc = allVersions[0];
      }
    }

    if (!latestDoc) {
      return res.status(404).json({ error: "Latest version not found" });
    }

    await db.update(documentBundleItems)
      .set({ documentId: latestDoc.id })
      .where(eq(documentBundleItems.id, itemId));

    const updatedBundle = await storage.getDocumentBundle(bundleId);
    res.json({ success: true, bundle: updatedBundle });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating bundle item to latest version");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update bundle item" });
  }
});

router.post("/api/document-bundles/:bundleId/notify-updates", requireAuth, async (req, res) => {
  try {
    const bundleId = req.params.bundleId as string;
    const companyId = req.companyId;

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      recipientEmail: z.string().email(),
      recipientName: z.string().optional(),
      updatedDocuments: z.array(z.object({
        documentTitle: z.string(),
        documentNumber: z.string().optional(),
        oldVersion: z.string().optional(),
        newVersion: z.string().optional(),
      })).min(1),
    });
    const data = schema.parse(req.body);

    const bundle = await storage.getDocumentBundle(bundleId);
    if (!bundle || bundle.companyId !== companyId) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    const docListHtml = data.updatedDocuments.map(d =>
      `<li><strong>${d.documentTitle}</strong>${d.documentNumber ? ` (${d.documentNumber})` : ""}${d.oldVersion && d.newVersion ? ` — updated from v${d.oldVersion} to v${d.newVersion}` : ""}</li>`
    ).join("");

    const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Document Bundle Update Notice</h2>
      <p>Dear ${data.recipientName || "Recipient"},</p>
      <p>Please be advised that the following documents in bundle <strong>${bundle.bundleName}</strong> have been updated:</p>
      <ul>${docListHtml}</ul>
      <p>Please ensure you are referencing the latest versions of these documents.</p>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999;">
        <p>This is an automated notification from BuildPlus AI. Please do not reply directly to this email.</p>
      </div>
    </div>`;

    const result = await emailService.sendEmailWithAttachment({
      to: data.recipientEmail,
      subject: `Document Bundle Update - ${bundle.bundleName}`,
      body: htmlBody,
    });

    if (result.success) {
      res.json({ sent: true, messageId: result.messageId, recipientEmail: data.recipientEmail });
    } else {
      res.status(500).json({ sent: false, error: result.error });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error({ err: error }, "Error sending bundle update notification");
    res.status(500).json({ error: "Failed to send notification" });
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
  bundle: { id: string; allowGuestAccess: boolean | null; expiresAt: string | Date | null } | null | undefined, 
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
        version: item.document.version,
        revision: item.document.revision,
        documentNumber: item.document.documentNumber,
        isLatestVersion: item.document.isLatestVersion,
        isStale: item.document.isLatestVersion === false,
      })),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching public bundle");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch bundle" });
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
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error viewing public bundle document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to view document" });
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
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error downloading public bundle document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to download document" });
  }
});

// Get bundle access logs (admin only)
router.get("/api/document-bundles/:id/access-logs", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const logs = await storage.getBundleAccessLogs(String(req.params.id));
    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching bundle access logs");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch access logs" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error analyzing document version with AI");
    res.status(500).json({ error: "Failed to analyze document", summary: "" });
  }
});

router.post("/api/documents/:id/analyze-changes", requireAuth, async (req: Request, res: Response) => {
  try {
    const documentId = String(req.params.id);
    const doc = await storage.getDocument(documentId);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!doc.parentDocumentId) {
      return res.status(400).json({ error: "This is the original version - no previous version to compare against" });
    }

    const parentDoc = await storage.getDocument(doc.parentDocumentId);
    if (!parentDoc) {
      return res.status(404).json({ error: "Parent document not found" });
    }

    let prompt = `You are analyzing a document version update in a construction/engineering document management system. Compare the new version to the original and provide a brief, professional summary of what likely changed.

Original Document (Previous Version):
- Title: ${parentDoc.title}
- File Name: ${parentDoc.originalName}
- File Size: ${parentDoc.fileSize || 0} bytes
- Version: ${parentDoc.version}${parentDoc.revision || ''}
- Status: ${parentDoc.status}
- Type: ${parentDoc.type?.typeName || 'Unknown'}
- Discipline: ${parentDoc.discipline?.disciplineName || 'Unknown'}

New Document (Current Version):
- Title: ${doc.title}
- File Name: ${doc.originalName}
- File Size: ${doc.fileSize || 0} bytes
- Version: ${doc.version}${doc.revision || ''}
- Status: ${doc.status}
- Size Change: ${(doc.fileSize || 0) > (parentDoc.fileSize || 0) ? `+${(doc.fileSize || 0) - (parentDoc.fileSize || 0)}` : (doc.fileSize || 0) - (parentDoc.fileSize || 0)} bytes

Based on the file information, version numbers, and typical construction/engineering document workflows, provide a concise 2-3 sentence summary of what likely changed between v${parentDoc.version}${parentDoc.revision || ''} and v${doc.version}${doc.revision || ''}. Focus on professional, construction/engineering document terminology. Consider common reasons for version updates such as design revisions, client feedback, RFI responses, specification changes, or coordination updates.`;

    const mimeType = doc.mimeType || '';
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      prompt += `\n\nNote: This is a ${mimeType} file (likely a drawing or specification document). Consider typical changes for this document type in construction projects.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a document management assistant for construction and engineering projects. Provide brief, professional summaries of document version changes. Keep responses concise (2-3 sentences) and relevant to construction/engineering workflows."
        },
        { role: "user", content: prompt }
      ],
      max_completion_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "";

    if (summary) {
      await storage.updateDocument(documentId, { changeSummary: summary });
    }

    logger.info({ documentId, parentId: doc.parentDocumentId }, "AI version change analysis completed");
    res.json({ summary });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error analyzing document version changes");
    res.status(500).json({ error: "Failed to analyze document changes", summary: "" });
  }
});

// ==================== AI FILE METADATA EXTRACTION ====================

router.post("/api/documents/extract-metadata", requireAuth, bulkUpload.array("files", 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        try {
          let fileContentHint = "";

          if (file.mimetype === "application/pdf") {
            const textChunk = file.buffer.toString("utf-8", 0, Math.min(file.buffer.length, 4000));
            const printable = textChunk.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
            if (printable.length > 50) {
              fileContentHint = `\nExtracted text from PDF (partial): "${printable.substring(0, 2000)}"`;
            }
          } else if (
            file.mimetype.startsWith("text/") ||
            file.mimetype === "application/json" ||
            file.mimetype === "application/xml" ||
            file.mimetype === "application/rtf"
          ) {
            const textContent = file.buffer.toString("utf-8", 0, Math.min(file.buffer.length, 3000));
            fileContentHint = `\nFile text content (partial): "${textContent.substring(0, 2000)}"`;
          }

          const prompt = `You are a document management assistant for a construction/precast manufacturing company. Analyze this file and extract metadata.

File name: "${file.originalname}"
File type: ${file.mimetype}
File size: ${file.size} bytes
${fileContentHint}

Extract the following information from the file name and any available content. Use construction/engineering document naming conventions:

1. **Title**: A clean, professional document title. Remove file extensions, prefixes like rev/version numbers. If the filename contains a meaningful title, use it. Otherwise generate one based on the content/filename.
2. **Document Number**: Look for patterns like "DOC-001", "DWG-A-001", "XX-YYY-NNN", alphanumeric codes at the start of filenames, or any structured numbering. Return empty string if none found.
3. **Revision**: Look for revision indicators like "Rev A", "R1", "RevB", "-A", "v2", etc. in the filename or content. Return empty string if none found.
4. **Version**: A numeric version like "1.0", "2.0". Default to "1.0" if not identifiable.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"title": "...", "documentNumber": "...", "revision": "...", "version": "1.0"}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a metadata extraction assistant. Always respond with valid JSON only, no markdown formatting or code blocks."
              },
              { role: "user", content: prompt }
            ],
            max_completion_tokens: 200,
          });

          const rawResponse = completion.choices[0]?.message?.content?.trim() || "";
          const jsonStr = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

          try {
            const parsed = JSON.parse(jsonStr);
            return {
              fileName: file.originalname,
              title: parsed.title || file.originalname.replace(/\.[^/.]+$/, ""),
              documentNumber: parsed.documentNumber || "",
              revision: parsed.revision || "",
              version: parsed.version || "1.0",
              success: true,
            };
          } catch {
            return {
              fileName: file.originalname,
              title: file.originalname.replace(/\.[^/.]+$/, ""),
              documentNumber: "",
              revision: "",
              version: "1.0",
              success: false,
            };
          }
        } catch (aiError) {
          logger.warn({ err: aiError, fileName: file.originalname }, "AI metadata extraction failed for file");
          return {
            fileName: file.originalname,
            title: file.originalname.replace(/\.[^/.]+$/, ""),
            documentNumber: "",
            revision: "",
            version: "1.0",
            success: false,
          };
        }
      })
    );

    res.json({ results });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error extracting metadata from files");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to extract metadata" });
  }
});

// ==================== BULK DOCUMENT UPLOAD ====================

router.post("/api/documents/bulk-upload", requireAuth, bulkUpload.array("files", 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const metadataStr = req.body.metadata;
    let fileMetadata: Array<{
      fileName: string;
      title: string;
      documentNumber: string;
      revision: string;
      version: string;
      supersedeDocumentId?: string;
    }> = [];

    try {
      fileMetadata = JSON.parse(metadataStr || "[]");
    } catch {
      return res.status(400).json({ error: "Invalid metadata format" });
    }

    const { typeId, disciplineId, categoryId, documentTypeStatusId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential } = req.body;

    if (jobId) {
      const user = await storage.getUser(req.session.userId!);
      if (user && user.role !== "ADMIN" && user.role !== "MANAGER") {
        const memberships = await db.select({ jobId: jobMembers.jobId })
          .from(jobMembers)
          .where(eq(jobMembers.userId, req.session.userId!));
        const allowedJobIds = memberships.map(m => m.jobId);
        if (!allowedJobIds.includes(jobId)) {
          return res.status(403).json({ error: "You do not have access to the selected job" });
        }
      }
    }

    const uploaded: Record<string, unknown>[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const file of files) {
      try {
        const meta = fileMetadata.find(m => m.fileName === file.originalname) || {
          fileName: file.originalname,
          title: file.originalname.replace(/\.[^/.]+$/, ""),
          documentNumber: "",
          revision: "A",
          version: "1.0",
        };

        if (!meta.title || meta.title.trim().length === 0) {
          meta.title = file.originalname.replace(/\.[^/.]+$/, "");
        }

        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file.buffer,
          headers: { "Content-Type": file.mimetype },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: req.session.userId!,
          visibility: "private",
        });

        const fileSha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

        let documentNumber = meta.documentNumber || undefined;
        if (!documentNumber && typeId) {
          documentNumber = await storage.getNextDocumentNumber(typeId);
        }

        let document;

        if (meta.supersedeDocumentId) {
          const parentDoc = await storage.getDocument(meta.supersedeDocumentId);
          if (!parentDoc || parentDoc.companyId !== companyId) {
            throw new Error("Document to supersede not found or access denied");
          }
          const currentVersion = parseFloat(parentDoc.version || "1.0");
          const newVersion = String((currentVersion + 1).toFixed(1));

          document = await storage.createNewVersion(meta.supersedeDocumentId, {
            companyId,
            title: meta.title || parentDoc.title,
            description: parentDoc.description,
            fileName: `${Date.now()}-${file.originalname}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
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
            revision: meta.revision || "A",
            isLatestVersion: true,
          });
        } else {
          document = await storage.createDocument({
            companyId,
            title: meta.title,
            description: null,
            fileName: `${Date.now()}-${file.originalname}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storageKey: objectPath,
            fileSha256,
            documentNumber,
            revision: meta.revision || "A",
            version: meta.version || "1.0",
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
            isLatestVersion: true,
          });
        }

        uploaded.push(document);
      } catch (fileError: unknown) {
        logger.error({ err: fileError, fileName: file.originalname }, "Error uploading file in bulk");
        errors.push({
          fileName: file.originalname,
          error: fileError instanceof Error ? fileError.message : "Upload failed",
        });
      }
    }

    logger.info({ uploadedCount: uploaded.length, errorCount: errors.length }, "Bulk upload completed");
    res.json({ uploaded, errors, total: files.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error in bulk document upload");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process bulk upload" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching panel documents");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch panel documents" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading panel document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload panel document" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating panel document status");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update status" });
  }
});

// ============================================================================
// Drawing Package Processor
// ============================================================================

const drawingPackageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are supported for drawing packages"));
  },
});

router.post("/api/documents/drawing-package/analyze", requireAuth, drawingPackageUpload.single("file"), async (req: Request, res: Response) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendProgress = (phase: string, current: number, total: number, detail?: string) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    try { res.write(`data: ${JSON.stringify({ type: "progress", phase, current, total, percent, detail })}\n\n`); } catch {}
  };

  try {
    const file = req.file;
    if (!file) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "No PDF file provided" })}\n\n`);
      res.end();
      return;
    }

    sendProgress("pdf_extract", 0, 1, "Extracting pages from PDF...");

    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { spawn } = await import("child_process");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drawing-pkg-"));
    const inputPath = path.join(tempDir, "input.pdf");
    fs.writeFileSync(inputPath, file.buffer);

    const pythonScript = `
import fitz
import json
import re
import sys
import os
import base64

pdf_path = sys.argv[1]
doc = fitz.open(pdf_path)
pages = []

def extract_field(text, patterns, default=""):
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return default

def find_drawing_number(txt):
    lines = txt.split("\\n")
    bad_words = {"REV", "REVISION", "SCALE", "DATE", "DRAWN", "TITLE", "CLIENT", "PROJECT", "COVER", "PAGE", "SHEET", "OF", "NO", "NUMBER", "DWG", "DRAWING", "DESCRIPTION"}
    for idx, line in enumerate(lines):
        upper = line.strip().upper()
        if "DRAWING" in upper and ("NO" in upper or "NUM" in upper or "#" in upper):
            for offset in range(1, 6):
                if idx + offset < len(lines):
                    candidate = lines[idx + offset].strip()
                    if candidate and candidate.upper() not in bad_words and len(candidate) >= 2:
                        clean = re.sub(r'\\s+', ' ', candidate).strip()
                        if re.match(r'^[A-Z0-9]', clean, re.IGNORECASE) and not clean.upper().startswith("REV"):
                            return clean
            break
    patterns = [
        r'\\b([A-Z]{1,4}\\d{1,3}[.]\\d{1,4})\\b',
        r'\\b(\\d{2,3}[\\-][A-Z]{1,4}[\\-]\\d{2,5})\\b',
        r'([A-Z]{2,6}[\\-_][A-Z]{2,6}[\\-_]\\d{3,6})',
        r'([A-Z]{2,}[\\-_]\\d{4,})',
    ]
    for p in patterns:
        m = re.search(p, txt, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if val.upper() not in bad_words:
                return val
    return ""

def make_thumbnail(page_obj, max_dim=1200):
    try:
        rect = page_obj.rect
        w, h = rect.width, rect.height
        scale = min(max_dim / max(w, h), 2.0)
        scale = max(scale, 0.5)
        mat = fitz.Matrix(scale, scale)
        pix = page_obj.get_pixmap(matrix=mat)
        return base64.b64encode(pix.tobytes("png")).decode("ascii")
    except:
        return ""

for i in range(len(doc)):
    page = doc[i]
    text = page.get_text("text")
    
    drawing_number = find_drawing_number(text)
    
    title = extract_field(text, [
        r'(?:TITLE|DESCRIPTION)[:\\s]+([A-Z][A-Z\\s\\-0-9]+(?:PLAN|VIEW|SECTION|ELEVATION|DETAIL|ARRANGEMENT|LAYOUT|SCHEDULE))',
        r'((?:GENERAL\\s+ARRANGEMENT|FLOOR\\s+PLAN|SITE\\s+PLAN|ROOF\\s+PLAN|ELEVATION|SECTION|DETAIL|LAYOUT)[\\sA-Z0-9\\-]*)',
    ])
    
    revision = extract_field(text, [
        r'(?:REV|REVISION)[\\s.:\\-]*([A-Z0-9]{1,4})',
        r'\\b(P\\d{1,3})\\b',
        r'\\b(Rev\\s*[A-Z0-9]{1,3})\\b',
    ])
    
    scale = extract_field(text, [
        r'(?:SCALE)[:\\s]*(1\\s*:\\s*\\d+)',
        r'(1\\s*:\\s*\\d{2,4})',
    ])
    
    project_name = extract_field(text, [
        r'(?:CLIENT|EMPLOYER)[:\\s]+([A-Za-z][A-Za-z\\s&.,]+)',
        r'(?:PROJECT|JOB|SITE)[:\\s]+([A-Za-z][A-Za-z\\s&.,0-9]+)',
    ])
    
    project_number = extract_field(text, [
        r'(?:PROJECT|JOB)\\s*(?:NO|NUMBER|#|NUM)[.:\\s]*(\\d{3,}[A-Z0-9\\-]*)',
    ])
    
    discipline = ""
    if drawing_number:
        dn_upper = drawing_number.upper()
        if "ARCH" in dn_upper: discipline = "Architecture"
        elif "STRUC" in dn_upper or "STR" in dn_upper: discipline = "Structural"
        elif "MECH" in dn_upper or "MEC" in dn_upper: discipline = "Mechanical"
        elif "ELEC" in dn_upper or "ELE" in dn_upper: discipline = "Electrical"
        elif "CIVIL" in dn_upper or "CIV" in dn_upper: discipline = "Civil"
        elif "PLUMB" in dn_upper or "HYD" in dn_upper: discipline = "Hydraulic"
    
    level = extract_field(text, [
        r'(?:LEVEL|LVL|FLOOR)\\s*(\\d+)',
        r'\\bL(\\d{1,2})\\b',
    ])
    
    client = extract_field(text, [
        r'(?:CLIENT|EMPLOYER)[:\\s]+([A-Za-z][A-Za-z\\s&.,]+)',
    ])
    
    date = extract_field(text, [
        r'(?:DATE|DATED)[:\\s]*(\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4})',
        r'(\\d{1,2}[/.]\\d{1,2}[/.]\\d{4})',
    ])
    
    version = extract_field(text, [
        r'(?:VERSION|VER)[.:\\s]*(\\d+\\.?\\d*)',
        r'\\bV(\\d+\\.?\\d*)\\b',
    ])
    if not version:
        version = "1.0"

    thumbnail = make_thumbnail(page)

    pages.append({
        "pageNumber": i + 1,
        "drawingNumber": drawing_number,
        "title": title if title else f"Page {i+1}",
        "revision": revision,
        "version": version,
        "scale": scale,
        "projectName": project_name,
        "projectNumber": project_number,
        "discipline": discipline,
        "level": level,
        "client": client,
        "date": date,
        "textPreview": text[:300].replace("\\n", " ").strip(),
        "thumbnail": thumbnail,
    })

doc.close()
print(json.dumps({"totalPages": len(pages), "pages": pages}))
`;

    logger.info({ filename: file.originalname, fileSize: file.size }, "Starting drawing package analysis");

    const result: string = await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      const proc = spawn("python3", ["-c", pythonScript, inputPath], { timeout: 120000 });
      proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
      proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
      proc.on("close", (code: number | null) => {
        if (code === 0) {
          logger.info({ outputLength: output.length }, "Drawing package analysis completed");
          resolve(output);
        } else {
          logger.error({ code, errorOutput }, "Drawing package Python analysis failed");
          reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
        }
      });
      proc.on("error", (err: Error) => {
        logger.error({ err }, "Drawing package Python process error");
        reject(err);
      });
    });

    const analysisResult = JSON.parse(result);
    sendProgress("pdf_extract", 1, 1, `Extracted ${analysisResult.pages?.length || 0} pages`);

    const aiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (aiApiKey && analysisResult.pages && analysisResult.pages.length > 0) {
      logger.info({ pageCount: analysisResult.pages.length }, "Starting OpenAI vision analysis for drawing metadata");

      const aiClient = new OpenAI({
        apiKey: aiApiKey,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
      });

      const analyzePageWithAI = async (page: any): Promise<any> => {
        if (!page.thumbnail) return page;
        try {
          const completion = await aiClient.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 500,
            messages: [
              {
                role: "system",
                content: `You are an expert construction drawing analyst. Extract metadata from the title block of this engineering/architectural drawing page. Return ONLY valid JSON with these fields:
{
  "drawingNumber": "the unique drawing/sheet number identifier (e.g. S-101, AR-200, DWG-001, 12345-STR-001)",
  "title": "the drawing title or description",
  "revision": "revision letter or number (e.g. A, B, C, P1, P2, 01)",
  "scale": "drawing scale (e.g. 1:100, 1:50, NTS)",
  "projectName": "project or job name",
  "projectNumber": "project or job number",
  "discipline": "discipline like Architecture, Structural, Mechanical, Electrical, Civil, Hydraulic",
  "client": "client or employer name",
  "date": "date shown on drawing",
  "level": "floor or level number if shown"
}
CRITICAL RULES:
- drawingNumber is the UNIQUE IDENTIFIER for this drawing sheet, often found labeled as "Drawing No", "Dwg No", "Sheet No", or similar in the title block. It typically contains a mix of letters, numbers, and dashes (e.g. S-101, AR-200, DWG-001, 12345-STR-001).
- drawingNumber is NEVER the scale (like 1:100), NEVER the revision (like A, B, Rev C), NEVER just a page number (like 1, 2, 3), and NEVER a date.
- If you cannot confidently identify the drawing number, set it to "".
- Leave any field as empty string "" if not clearly visible or identifiable.`
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract the drawing metadata from this engineering drawing page. Focus on the title block area (usually bottom-right corner) to find the drawing number, title, revision, and other metadata." },
                  { type: "image_url", image_url: { url: `data:image/png;base64,${page.thumbnail}`, detail: "high" } },
                ],
              },
            ],
          });

          const aiText = completion.choices[0]?.message?.content || "";
          const jsonMatch = aiText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let aiData: any;
            try {
              aiData = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
              logger.warn({ pageNumber: page.pageNumber, rawResponse: aiText.substring(0, 200) }, "Failed to parse AI JSON response");
              return page;
            }

            if (aiData.drawingNumber && /^[0-9:]+$/.test(aiData.drawingNumber.replace(/\s/g, ""))) {
              logger.warn({ pageNumber: page.pageNumber, suspectedScale: aiData.drawingNumber }, "AI returned what looks like a scale, not a drawing number - discarding");
              aiData.drawingNumber = "";
            }

            logger.info({ pageNumber: page.pageNumber, aiDrawingNumber: aiData.drawingNumber, regexDrawingNumber: page.drawingNumber }, "AI vs regex drawing number comparison");

            if (aiData.drawingNumber && aiData.drawingNumber.trim()) page.drawingNumber = aiData.drawingNumber.trim();
            if (aiData.title && aiData.title.trim()) page.title = aiData.title.trim();
            if (aiData.revision && aiData.revision.trim()) page.revision = aiData.revision.trim();
            if (aiData.scale && aiData.scale.trim()) page.scale = aiData.scale.trim();
            if (aiData.projectName && aiData.projectName.trim()) page.projectName = aiData.projectName.trim();
            if (aiData.projectNumber && aiData.projectNumber.trim()) page.projectNumber = aiData.projectNumber.trim();
            if (aiData.discipline && aiData.discipline.trim()) page.discipline = aiData.discipline.trim();
            if (aiData.client && aiData.client.trim()) page.client = aiData.client.trim();
            if (aiData.date && aiData.date.trim()) page.date = aiData.date.trim();
            if (aiData.level && aiData.level.trim()) page.level = aiData.level.trim();
          }
        } catch (aiErr: any) {
          logger.warn({ pageNumber: page.pageNumber, error: aiErr.message }, "OpenAI vision analysis failed for page, using regex fallback");
        }
        return page;
      };

      sendProgress("ai_analysis", 0, analysisResult.pages.length, "Starting AI analysis...");

      const CONCURRENCY = 10;
      const pages = analysisResult.pages;
      let completedPages = 0;
      for (let i = 0; i < pages.length; i += CONCURRENCY) {
        const batch = pages.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (page: any) => {
          const result = await analyzePageWithAI(page);
          completedPages++;
          sendProgress("ai_analysis", completedPages, pages.length, `Analyzing page ${completedPages} of ${pages.length}`);
          return result;
        }));
        for (let j = 0; j < results.length; j++) {
          pages[i + j] = results[j];
        }
      }
      analysisResult.pages = pages;
      logger.info("OpenAI vision analysis complete for all pages");
    }

    sendProgress("matching", 0, 1, "Matching jobs and checking conflicts...");

    const allJobs = await storage.getAllJobs(req.companyId!);
    const jobs = allJobs;
    let matchedJobId: string | null = null;
    let matchedJobName: string | null = null;
    const projectName = analysisResult.pages[0]?.projectName || "";
    const projectNumber = analysisResult.pages[0]?.projectNumber || "";

    if (projectName || projectNumber) {
      let bestScore = 0;
      for (const job of jobs) {
        let score = 0;
        const jobName = (job.name || "").toLowerCase();
        const jobNum = (job.jobNumber || "").toLowerCase();
        const pName = projectName.toLowerCase();
        const pNum = projectNumber.toLowerCase();

        if (pNum && jobNum && jobNum === pNum) score += 100;
        if (pName && jobName && jobName === pName) score += 100;
        if (pName && jobName && jobName.includes(pName)) score += 50;
        if (pName && jobName) {
          const words = pName.split(/\s+/).filter((w: string) => w.length > 2);
          const matches = words.filter((w: string) => jobName.includes(w)).length;
          score += matches * 20;
        }

        if (score > bestScore) {
          bestScore = score;
          matchedJobId = job.id;
          matchedJobName = `${job.jobNumber} - ${job.name}`;
        }
      }
      if (bestScore < 30) {
        matchedJobId = null;
        matchedJobName = null;
      }
    }

    const drawingNumbers = analysisResult.pages
      .map((p: any) => p.drawingNumber)
      .filter((n: string) => n);

    let existingDocuments: any[] = [];
    if (drawingNumbers.length > 0) {
      const docsResult = await storage.getDocuments({ limit: 10000 });
      existingDocuments = docsResult.documents.filter((d: any) =>
        d.companyId === req.companyId && d.documentNumber && drawingNumbers.includes(d.documentNumber)
      );
    }

    const pagesWithConflicts = analysisResult.pages.map((page: any) => {
      const existing = existingDocuments.filter(
        (d: any) => d.documentNumber === page.drawingNumber
      );
      let conflictAction = "none";
      let conflictDocument: any = null;

      if (existing.length > 0) {
        const latestExisting = existing.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        conflictDocument = {
          id: latestExisting.id,
          title: latestExisting.title,
          revision: latestExisting.revision || "",
          version: latestExisting.version || "1.0",
        };

        const newRev = (page.revision || "").toUpperCase();
        const oldRev = (latestExisting.revision || "").toUpperCase();

        if (newRev === oldRev) {
          conflictAction = "skip";
        } else if (compareRevisions(newRev, oldRev) > 0) {
          conflictAction = "supersede";
        } else {
          conflictAction = "keep_both";
        }
      }

      return { ...page, conflictAction, conflictDocument };
    });

    try { fs.unlinkSync(inputPath); fs.rmdirSync(tempDir); } catch {}

    sendProgress("matching", 1, 1, "Complete");

    const finalResult = {
      totalPages: analysisResult.totalPages,
      pages: pagesWithConflicts,
      matchedJob: matchedJobId ? { id: matchedJobId, name: matchedJobName } : null,
      jobs: jobs.map((j: any) => ({ id: j.id, name: `${j.jobNumber} - ${j.name}` })),
      originalFileName: file.originalname,
    };

    res.write(`data: ${JSON.stringify({ type: "result", data: finalResult })}\n\n`);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error analyzing drawing package");
    try {
      res.write(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Failed to analyze drawing package" })}\n\n`);
      res.end();
    } catch {}
  }
});

function compareRevisions(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const pMatch = (s: string) => s.match(/^P(\d+)$/i);
  const pA = pMatch(a);
  const pB = pMatch(b);
  if (pA && pB) return parseInt(pA[1]) - parseInt(pB[1]);
  const revMatch = (s: string) => s.match(/^(?:REV\s*)?([A-Z])$/i);
  const rA = revMatch(a);
  const rB = revMatch(b);
  if (rA && rB) return rA[1].charCodeAt(0) - rB[1].charCodeAt(0);
  return a.localeCompare(b);
}

router.post("/api/documents/drawing-package/register", requireAuth, drawingPackageUpload.single("file"), async (req: Request, res: Response) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendProgress = (phase: string, current: number, total: number, detail?: string) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    try { res.write(`data: ${JSON.stringify({ type: "progress", phase, current, total, percent, detail })}\n\n`); } catch {}
  };

  try {
    const file = req.file;
    if (!file) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "No PDF file provided" })}\n\n`);
      res.end();
      return;
    }

    const drawingsData = JSON.parse(req.body.drawings || "[]");
    const globalJobId = req.body.jobId || null;

    if (!drawingsData.length) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "No drawings to register" })}\n\n`);
      res.end();
      return;
    }

    sendProgress("splitting", 0, drawingsData.length, "Splitting PDF into individual pages...");

    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { spawn } = await import("child_process");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drawing-split-"));
    const inputPath = path.join(tempDir, "input.pdf");
    fs.writeFileSync(inputPath, file.buffer);

    const splitScript = `
import fitz
import os
import json
import sys

pdf_path = sys.argv[1]
output_dir = sys.argv[2]
doc = fitz.open(pdf_path)
extracted = []

os.makedirs(output_dir, exist_ok=True)

for page_num in range(len(doc)):
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
    filename = f"drawing_{page_num + 1}.pdf"
    filepath = os.path.join(output_dir, filename)
    new_doc.save(filepath)
    new_doc.close()
    extracted.append({"filename": filename, "filepath": filepath, "pageNumber": page_num + 1})

doc.close()
print(json.dumps(extracted))
`;

    const outputDir = path.join(tempDir, "pages");
    const splitResult: string = await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      const proc = spawn("python3", ["-c", splitScript, inputPath, outputDir], { timeout: 120000 });
      proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
      proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
      proc.on("close", (code: number | null) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Split failed: ${errorOutput}`));
      });
      proc.on("error", (err: Error) => reject(err));
    });

    const extractedFiles: Array<{ filename: string; filepath: string; pageNumber: number }> = JSON.parse(splitResult);

    sendProgress("splitting", drawingsData.length, drawingsData.length, "PDF split complete");

    const results: any[] = [];
    let processedCount = 0;
    const totalToProcess = drawingsData.length;

    for (const drawing of drawingsData) {
      processedCount++;

      if (drawing.action === "skip") {
        results.push({ pageNumber: drawing.pageNumber, status: "skipped", drawingNumber: drawing.drawingNumber });
        sendProgress("registering", processedCount, totalToProcess, `Skipped ${drawing.drawingNumber || `page ${drawing.pageNumber}`}`);
        continue;
      }

      sendProgress("registering", processedCount, totalToProcess, `Uploading ${drawing.drawingNumber || `page ${drawing.pageNumber}`}...`);

      const pageFile = extractedFiles.find((f) => f.pageNumber === drawing.pageNumber);
      if (!pageFile) {
        results.push({ pageNumber: drawing.pageNumber, status: "error", error: "Page file not found" });
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(pageFile.filepath);
        const timestamp = Date.now();
        const safeDrawingNum = (drawing.drawingNumber || `page_${drawing.pageNumber}`).replace(/[^a-zA-Z0-9_\-]/g, "_");
        const storedFileName = `${safeDrawingNum}_${timestamp}.pdf`;

        const storagePath = `documents/${storedFileName}`;
        await objectStorageService.uploadFile(storagePath, fileBuffer, "application/pdf");

        const tags: string[] = [];
        if (drawing.revision) tags.push(`Rev ${drawing.revision}`);
        if (drawing.scale) tags.push(`Scale ${drawing.scale}`);
        if (drawing.level) tags.push(`Level ${drawing.level}`);
        if (drawing.drawingNumber) tags.push(drawing.drawingNumber);

        let supersedeDocId: string | null = null;
        if (drawing.action === "supersede" && drawing.conflictDocumentId) {
          supersedeDocId = drawing.conflictDocumentId;
          await storage.updateDocument(supersedeDocId as string, {
            status: "SUPERSEDED",
            isLatestVersion: false,
          });
        }

        const doc = await storage.createDocument({
          companyId: req.companyId!,
          title: drawing.title || `Drawing ${drawing.pageNumber}`,
          documentNumber: drawing.drawingNumber || null,
          revision: drawing.revision || "A",
          version: supersedeDocId ? "2.0" : (drawing.version || "1.0"),
          fileName: storedFileName,
          originalName: `${drawing.drawingNumber || `page_${drawing.pageNumber}`}.pdf`,
          storageKey: storagePath,
          fileSize: fileBuffer.length,
          mimeType: "application/pdf",
          status: "DRAFT",
          isLatestVersion: true,
          jobId: drawing.jobId || globalJobId || null,
          tags: tags.join(", "),
          uploadedBy: req.session.userId!,
          typeId: drawing.typeId || null,
          disciplineId: drawing.disciplineId || null,
          categoryId: drawing.categoryId || null,
        });

        results.push({
          pageNumber: drawing.pageNumber,
          status: "registered",
          documentId: doc.id,
          drawingNumber: drawing.drawingNumber,
          title: drawing.title,
        });
      } catch (err: unknown) {
        logger.error({ err, pageNumber: drawing.pageNumber }, "Error registering drawing page");
        results.push({ pageNumber: drawing.pageNumber, status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }

    try {
      const cleanupFiles = (dir: string) => {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            if (fs.statSync(fp).isDirectory()) cleanupFiles(fp);
            else fs.unlinkSync(fp);
          }
          fs.rmdirSync(dir);
        }
      };
      cleanupFiles(tempDir);
    } catch {}

    const registered = results.filter((r) => r.status === "registered").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    res.write(`data: ${JSON.stringify({ type: "result", data: { success: true, summary: { total: drawingsData.length, registered, skipped, errors }, results } })}\n\n`);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error registering drawing package");
    try {
      res.write(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Failed to register drawing package" })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
