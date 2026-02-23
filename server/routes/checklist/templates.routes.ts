import {
  Router, Request, Response,
  eq, and, desc, dsql,
  db,
  checklistTemplates,
  insertChecklistTemplateSchema,
  requireAuth, requireRole,
  logger,
} from "./shared";
import { users } from "@shared/schema";

const router = Router();

// ============================================================================
// CHECKLIST TEMPLATES CRUD (with version tracking)
// ============================================================================

router.get("/api/checklist/templates", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const includeAllVersions = req.query.allVersions === "true";

    if (includeAllVersions) {
      const templates = await db.select()
        .from(checklistTemplates)
        .where(eq(checklistTemplates.companyId, companyId))
        .orderBy(desc(checklistTemplates.createdAt))
        .limit(500);
      return res.json(templates);
    }

    const templates = await db.select()
      .from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.companyId, companyId),
        eq(checklistTemplates.isActive, true)
      ))
      .orderBy(desc(checklistTemplates.createdAt))
      .limit(500);

    res.json(templates);
  } catch (error: unknown) {
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
      .orderBy(checklistTemplates.name)
      .limit(500);

    res.json(templates);
  } catch (error: unknown) {
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
      .orderBy(checklistTemplates.name)
      .limit(500);

    res.json(templates);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch template");
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

router.get("/api/checklist/templates/:id/versions", requireAuth, async (req: Request, res: Response) => {
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

    const parentId = template.parentTemplateId || template.id;

    const versions = await db
      .select({
        id: checklistTemplates.id,
        version: checklistTemplates.version,
        name: checklistTemplates.name,
        isActive: checklistTemplates.isActive,
        createdAt: checklistTemplates.createdAt,
        createdBy: checklistTemplates.createdBy,
        createdByName: users.name,
      })
      .from(checklistTemplates)
      .leftJoin(users, eq(checklistTemplates.createdBy, users.id))
      .where(and(
        eq(checklistTemplates.companyId, companyId!),
        dsql`(${checklistTemplates.parentTemplateId} = ${parentId} OR ${checklistTemplates.id} = ${parentId})`
      ))
      .orderBy(desc(checklistTemplates.version))
      .limit(100);

    res.json(versions);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch template versions");
    res.status(500).json({ error: "Failed to fetch template versions" });
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
      version: 1,
    });

    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error });
    }

    const [created] = await db.insert(checklistTemplates).values(validation.data).returning();

    await db.update(checklistTemplates)
      .set({ parentTemplateId: created.id })
      .where(eq(checklistTemplates.id, created.id));

    const [result] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, created.id));
    res.status(201).json(result);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.post("/api/checklist/templates/:id/new-version", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
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

    const parentId = original.parentTemplateId || original.id;

    const [maxVersionRow] = await db
      .select({ maxVersion: dsql<number>`COALESCE(MAX(${checklistTemplates.version}), 0)` })
      .from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.companyId, companyId!),
        dsql`(${checklistTemplates.parentTemplateId} = ${parentId} OR ${checklistTemplates.id} = ${parentId})`
      ));

    const newVersion = (maxVersionRow?.maxVersion || 0) + 1;

    await db.update(checklistTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(checklistTemplates.companyId, companyId!),
        dsql`(${checklistTemplates.parentTemplateId} = ${parentId} OR ${checklistTemplates.id} = ${parentId})`,
        eq(checklistTemplates.isActive, true)
      ));

    const { id: _id, createdAt, updatedAt, ...templateData } = original;
    const [newVersionTemplate] = await db.insert(checklistTemplates)
      .values({
        ...templateData,
        version: newVersion,
        parentTemplateId: parentId,
        isActive: true,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(newVersionTemplate);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to create new template version");
    res.status(500).json({ error: "Failed to create new template version" });
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

    const { id: _id, createdAt, updatedAt, parentTemplateId, ...templateData } = original;
    const [duplicated] = await db.insert(checklistTemplates)
      .values({
        ...templateData,
        name: `${original.name} (Copy)`,
        version: 1,
        createdBy: userId,
      })
      .returning();

    await db.update(checklistTemplates)
      .set({ parentTemplateId: duplicated.id })
      .where(eq(checklistTemplates.id, duplicated.id));

    const [result] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, duplicated.id));
    res.status(201).json(result);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
