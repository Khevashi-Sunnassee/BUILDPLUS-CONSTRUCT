import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { documents } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import { 
  insertDocumentTypeSchema, 
  insertDocumentTypeStatusSchema,
  insertDocumentDisciplineSchema,
  insertDocumentCategorySchema,
} from "@shared/schema";

const router = Router();

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
    const companyId = req.companyId as string;
    const parsed = insertDocumentTypeSchema.safeParse({ ...req.body, companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const type = await storage.createDocumentType(parsed.data);
    
    await storage.createDocumentTypeStatus({
      companyId,
      typeId: type.id,
      statusName: "DRAFT",
      color: "#EF4444",
      sortOrder: 0,
      isDefault: true,
      isActive: true,
    });
    await storage.createDocumentTypeStatus({
      companyId,
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
    const typeId = String(req.params.id);
    const [usage] = await db.select({ total: count() }).from(documents).where(eq(documents.typeId, typeId));
    if (usage && usage.total > 0) {
      return res.status(409).json({
        error: `This document type is used by ${usage.total} document(s) and cannot be deleted. Deactivate it instead.`,
        code: "IN_USE",
        count: usage.total,
      });
    }
    await storage.deleteDocumentType(typeId);
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
    const companyId = req.companyId as string;
    const data = {
      ...req.body,
      companyId,
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
    const companyId = req.companyId as string;
    const parsed = insertDocumentDisciplineSchema.safeParse({ ...req.body, companyId });
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
    const discId = String(req.params.id);
    const [usage] = await db.select({ total: count() }).from(documents).where(eq(documents.disciplineId, discId));
    if (usage && usage.total > 0) {
      return res.status(409).json({
        error: `This discipline is used by ${usage.total} document(s) and cannot be deleted. Deactivate it instead.`,
        code: "IN_USE",
        count: usage.total,
      });
    }
    await storage.deleteDocumentDiscipline(discId);
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
    const companyId = req.companyId as string;
    const parsed = insertDocumentCategorySchema.safeParse({ ...req.body, companyId });
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
    const catId = String(req.params.id);
    const [usage] = await db.select({ total: count() }).from(documents).where(eq(documents.categoryId, catId));
    if (usage && usage.total > 0) {
      return res.status(409).json({
        error: `This category is used by ${usage.total} document(s) and cannot be deleted. Deactivate it instead.`,
        code: "IN_USE",
        count: usage.total,
      });
    }
    await storage.deleteDocumentCategory(catId);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document category" });
  }
});

export default router;
