import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import OpenAI from "openai";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { ObjectStorageService, ObjectNotFoundError } from "../replit_integrations/object_storage";
import logger from "../lib/logger";
import { 
  insertDocumentSchema, 
  insertDocumentBundleSchema,
  insertDocumentTypeSchema,
  insertDocumentDisciplineSchema,
  insertDocumentCategorySchema,
} from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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
    const { page, limit, search, status, typeId, disciplineId, categoryId, jobId, panelId, supplierId, purchaseOrderId, taskId, showLatestOnly } = req.query;
    
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

    const { title, description, typeId, disciplineId, categoryId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential } = req.body;

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

    const document = await storage.createDocument({
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

    const newDocument = await storage.createNewVersion(parentId, {
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
      "Content-Disposition": `attachment; filename="${document.originalName}"`,
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

router.patch("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const document = await storage.updateDocument(String(req.params.id), req.body);
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

    const qrCodeId = `bundle-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

    const bundle = await storage.createDocumentBundle({
      bundleName,
      description: description || null,
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
    const bundle = await storage.updateDocumentBundle(String(req.params.id), {
      ...req.body,
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
      "Content-Disposition": `inline; filename="${document.originalName}"`,
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
      "Content-Disposition": `attachment; filename="${document.originalName}"`,
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

export default router;
