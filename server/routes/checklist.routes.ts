import { Router, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import {
  entityTypes,
  entitySubtypes,
  checklistTemplates,
  checklistInstances,
  insertEntityTypeSchema,
  insertEntitySubtypeSchema,
  insertChecklistTemplateSchema,
  insertChecklistInstanceSchema,
} from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

// ============================================================================
// ENTITY TYPES (Checklist Types) CRUD
// ============================================================================

router.get("/api/checklist/entity-types", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const types = await db.select()
      .from(entityTypes)
      .where(and(
        eq(entityTypes.companyId, companyId),
        eq(entityTypes.isActive, true)
      ))
      .orderBy(entityTypes.sortOrder);

    res.json(types);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch entity types");
    res.status(500).json({ error: "Failed to fetch entity types" });
  }
});

router.post("/api/checklist/entity-types", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const validation = insertEntityTypeSchema.safeParse({ ...req.body, companyId });
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error });
    }

    const [created] = await db.insert(entityTypes).values(validation.data).returning();
    res.status(201).json(created);
  } catch (error) {
    logger.error({ err: error }, "Failed to create entity type");
    res.status(500).json({ error: "Failed to create entity type" });
  }
});

router.put("/api/checklist/entity-types/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const typeId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const parsed = insertEntityTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [updated] = await db.update(entityTypes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(entityTypes.id, typeId), eq(entityTypes.companyId, companyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Entity type not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update entity type");
    res.status(500).json({ error: "Failed to update entity type" });
  }
});

router.delete("/api/checklist/entity-types/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const typeId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [existing] = await db.select().from(entityTypes)
      .where(and(eq(entityTypes.id, typeId), eq(entityTypes.companyId, companyId!)));

    if (!existing) {
      return res.status(404).json({ error: "Entity type not found" });
    }

    if (existing.isSystem) {
      return res.status(403).json({ error: "System modules cannot be deleted" });
    }

    const [deleted] = await db.update(entityTypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(entityTypes.id, typeId), eq(entityTypes.companyId, companyId!)))
      .returning();

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete entity type");
    res.status(500).json({ error: "Failed to delete entity type" });
  }
});

// ============================================================================
// ENTITY SUBTYPES CRUD
// ============================================================================

router.get("/api/checklist/entity-subtypes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const subtypes = await db.select()
      .from(entitySubtypes)
      .where(and(
        eq(entitySubtypes.companyId, companyId),
        eq(entitySubtypes.isActive, true)
      ))
      .orderBy(entitySubtypes.sortOrder);

    res.json(subtypes);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch entity subtypes");
    res.status(500).json({ error: "Failed to fetch entity subtypes" });
  }
});

router.get("/api/checklist/entity-types/:entityTypeId/subtypes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const entityTypeId = String(req.params.entityTypeId);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const subtypes = await db.select()
      .from(entitySubtypes)
      .where(and(
        eq(entitySubtypes.companyId, companyId!),
        eq(entitySubtypes.entityTypeId, entityTypeId),
        eq(entitySubtypes.isActive, true)
      ))
      .orderBy(entitySubtypes.sortOrder);

    res.json(subtypes);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch entity subtypes by type");
    res.status(500).json({ error: "Failed to fetch entity subtypes" });
  }
});

router.post("/api/checklist/entity-subtypes", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const validation = insertEntitySubtypeSchema.safeParse({ ...req.body, companyId });
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error });
    }

    const [created] = await db.insert(entitySubtypes).values(validation.data).returning();
    res.status(201).json(created);
  } catch (error) {
    logger.error({ err: error }, "Failed to create entity subtype");
    res.status(500).json({ error: "Failed to create entity subtype" });
  }
});

router.put("/api/checklist/entity-subtypes/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const subtypeId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const parsed = insertEntitySubtypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [updated] = await db.update(entitySubtypes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(entitySubtypes.id, subtypeId), eq(entitySubtypes.companyId, companyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Entity subtype not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update entity subtype");
    res.status(500).json({ error: "Failed to update entity subtype" });
  }
});

router.delete("/api/checklist/entity-subtypes/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const subtypeId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [deleted] = await db.update(entitySubtypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(entitySubtypes.id, subtypeId), eq(entitySubtypes.companyId, companyId!)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Entity subtype not found" });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete entity subtype");
    res.status(500).json({ error: "Failed to delete entity subtype" });
  }
});

// ============================================================================
// CHECKLIST TEMPLATES CRUD
// ============================================================================

router.get("/api/checklist/templates", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const templates = await db.select()
      .from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.companyId, companyId),
        eq(checklistTemplates.isActive, true)
      ))
      .orderBy(desc(checklistTemplates.createdAt));

    res.json(templates);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch templates");
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.get("/api/checklist/templates/by-type/:entityTypeId/:entitySubtypeId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const entityTypeId = String(req.params.entityTypeId);
    const entitySubtypeId = String(req.params.entitySubtypeId);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const templates = await db.select()
      .from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.companyId, companyId!),
        eq(checklistTemplates.entityTypeId, entityTypeId),
        eq(checklistTemplates.entitySubtypeId, entitySubtypeId),
        eq(checklistTemplates.isActive, true)
      ))
      .orderBy(checklistTemplates.name);

    res.json(templates);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch templates by checklist type and subtype");
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.get("/api/checklist/templates/by-type/:entityTypeId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const entityTypeId = String(req.params.entityTypeId);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const templates = await db.select()
      .from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.companyId, companyId!),
        eq(checklistTemplates.entityTypeId, entityTypeId),
        eq(checklistTemplates.isActive, true)
      ))
      .orderBy(checklistTemplates.name);

    res.json(templates);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch templates by checklist type");
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.get("/api/checklist/templates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const templateId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [template] = await db.select()
      .from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.id, templateId),
        eq(checklistTemplates.companyId, companyId!)
      ));

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch template");
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

router.post("/api/checklist/templates", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const body = { ...req.body };
    if (!body.entityTypeId) body.entityTypeId = null;
    if (!body.entitySubtypeId) body.entitySubtypeId = null;

    const validation = insertChecklistTemplateSchema.safeParse({
      ...body,
      companyId,
      createdBy: userId,
    });

    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error });
    }

    const [created] = await db.insert(checklistTemplates).values(validation.data).returning();
    res.status(201).json(created);
  } catch (error) {
    logger.error({ err: error }, "Failed to create template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/api/checklist/templates/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const templateId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const body = { ...req.body };
    if (body.entityTypeId === "") body.entityTypeId = null;
    if (body.entitySubtypeId === "") body.entitySubtypeId = null;

    const parsed = insertChecklistTemplateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [updated] = await db.update(checklistTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(checklistTemplates.id, templateId), eq(checklistTemplates.companyId, companyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.post("/api/checklist/templates/:id/duplicate", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    const templateId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [original] = await db.select()
      .from(checklistTemplates)
      .where(and(eq(checklistTemplates.id, templateId), eq(checklistTemplates.companyId, companyId!)));

    if (!original) {
      return res.status(404).json({ error: "Template not found" });
    }

    const { id: _id, createdAt, updatedAt, ...templateData } = original;
    const [duplicated] = await db.insert(checklistTemplates)
      .values({
        ...templateData,
        name: `${original.name} (Copy)`,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(duplicated);
  } catch (error) {
    logger.error({ err: error }, "Failed to duplicate template");
    res.status(500).json({ error: "Failed to duplicate template" });
  }
});

router.delete("/api/checklist/templates/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const templateId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [existing] = await db.select().from(checklistTemplates)
      .where(and(eq(checklistTemplates.id, templateId), eq(checklistTemplates.companyId, companyId!)));

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (existing.isSystem) {
      return res.status(403).json({ error: "System templates cannot be deleted" });
    }

    const [deleted] = await db.update(checklistTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(checklistTemplates.id, templateId), eq(checklistTemplates.companyId, companyId!)))
      .returning();

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ============================================================================
// CHECKLIST INSTANCES CRUD
// ============================================================================

router.get("/api/checklist/instances", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const { templateId, status, jobId, panelId } = req.query;

    const conditions = [eq(checklistInstances.companyId, companyId)];
    
    if (templateId) {
      conditions.push(eq(checklistInstances.templateId, templateId as string));
    }
    if (status) {
      conditions.push(eq(checklistInstances.status, status as typeof checklistInstances.status.enumValues[number]));
    }
    if (jobId) {
      conditions.push(eq(checklistInstances.jobId, jobId as string));
    }
    if (panelId) {
      conditions.push(eq(checklistInstances.panelId, panelId as string));
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const instances = await db.select()
      .from(checklistInstances)
      .where(and(...conditions))
      .orderBy(desc(checklistInstances.createdAt))
      .limit(safeLimit);

    res.json(instances);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch instances");
    res.status(500).json({ error: "Failed to fetch instances" });
  }
});

router.get("/api/checklist/instances/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const instanceId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [instance] = await db.select()
      .from(checklistInstances)
      .where(and(
        eq(checklistInstances.id, instanceId),
        eq(checklistInstances.companyId, companyId!)
      ));

    if (!instance) {
      return res.status(404).json({ error: "Instance not found" });
    }

    res.json(instance);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch instance");
    res.status(500).json({ error: "Failed to fetch instance" });
  }
});

router.get("/api/checklist/templates/:templateId/instances", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const templateId = String(req.params.templateId);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const instances = await db.select()
      .from(checklistInstances)
      .where(and(
        eq(checklistInstances.companyId, companyId!),
        eq(checklistInstances.templateId, templateId)
      ))
      .orderBy(desc(checklistInstances.createdAt))
      .limit(safeLimit);

    res.json(instances);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch instances by template");
    res.status(500).json({ error: "Failed to fetch instances" });
  }
});

router.get("/api/checklist/jobs/:jobId/instances", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const jobId = String(req.params.jobId);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const instances = await db.select()
      .from(checklistInstances)
      .where(and(
        eq(checklistInstances.companyId, companyId!),
        eq(checklistInstances.jobId, jobId)
      ))
      .orderBy(desc(checklistInstances.createdAt))
      .limit(safeLimit);

    res.json(instances);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch instances by job");
    res.status(500).json({ error: "Failed to fetch instances" });
  }
});

router.get("/api/checklist/panels/:panelId/instances", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const panelId = String(req.params.panelId);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const instances = await db.select()
      .from(checklistInstances)
      .where(and(
        eq(checklistInstances.companyId, companyId!),
        eq(checklistInstances.panelId, panelId)
      ))
      .orderBy(desc(checklistInstances.createdAt))
      .limit(safeLimit);

    res.json(instances);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch instances by panel");
    res.status(500).json({ error: "Failed to fetch instances" });
  }
});

router.post("/api/checklist/instances", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const validation = insertChecklistInstanceSchema.safeParse({
      ...req.body,
      companyId,
    });

    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error });
    }

    const instanceNumber = `CHK-${Date.now()}`;

    const [created] = await db.insert(checklistInstances)
      .values({ ...validation.data, instanceNumber })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    logger.error({ err: error }, "Failed to create instance");
    res.status(500).json({ error: "Failed to create instance" });
  }
});

router.put("/api/checklist/instances/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const instanceId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const parsed = insertChecklistInstanceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [updated] = await db.update(checklistInstances)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(checklistInstances.id, instanceId), eq(checklistInstances.companyId, companyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Instance not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to update instance");
    res.status(500).json({ error: "Failed to update instance" });
  }
});

router.patch("/api/checklist/instances/:id/complete", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    const instanceId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [updated] = await db.update(checklistInstances)
      .set({
        status: "completed",
        completedAt: new Date(),
        completedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(checklistInstances.id, instanceId), eq(checklistInstances.companyId, companyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Instance not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to complete instance");
    res.status(500).json({ error: "Failed to complete instance" });
  }
});

router.patch("/api/checklist/instances/:id/sign-off", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    const instanceId = String(req.params.id);
    const { comments } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [updated] = await db.update(checklistInstances)
      .set({
        status: "signed_off",
        signedOffAt: new Date(),
        signedOffBy: userId,
        signOffComments: comments,
        updatedAt: new Date(),
      })
      .where(and(eq(checklistInstances.id, instanceId), eq(checklistInstances.companyId, companyId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Instance not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Failed to sign off instance");
    res.status(500).json({ error: "Failed to sign off instance" });
  }
});

router.delete("/api/checklist/instances/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const instanceId = String(req.params.id);

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const [deleted] = await db.update(checklistInstances)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(checklistInstances.id, instanceId), eq(checklistInstances.companyId, companyId!)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Instance not found" });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete instance");
    res.status(500).json({ error: "Failed to delete instance" });
  }
});

// ============================================================================
// REPORTING ENDPOINTS
// ============================================================================

router.get("/api/checklist/reports/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const instances = await db.select()
      .from(checklistInstances)
      .where(eq(checklistInstances.companyId, companyId));

    const summary = {
      total: instances.length,
      byStatus: {
        draft: instances.filter(i => i.status === "draft").length,
        in_progress: instances.filter(i => i.status === "in_progress").length,
        completed: instances.filter(i => i.status === "completed").length,
        signed_off: instances.filter(i => i.status === "signed_off").length,
        cancelled: instances.filter(i => i.status === "cancelled").length,
      },
      completedThisMonth: instances.filter(i => {
        if (!i.completedAt) return false;
        const now = new Date();
        const completedDate = new Date(i.completedAt);
        return completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear();
      }).length,
    };

    res.json(summary);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch report summary");
    res.status(500).json({ error: "Failed to fetch report summary" });
  }
});

export default router;
