import {
  Router, Request, Response,
  eq, and, desc, dsql,
  db,
  checklistTemplates, checklistInstances, users,
  insertChecklistInstanceSchema,
  requireAuth, requireRole,
  logger,
  processWorkOrderTriggers,
} from "./shared";

const router = Router();

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

    const userIds = new Set<string>();
    instances.forEach(i => {
      if (i.assignedTo) userIds.add(i.assignedTo);
      if (i.staffId) userIds.add(i.staffId);
    });

    let userNameMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const userRows = await db.select({ id: users.id, name: users.name })
        .from(users)
        .where(dsql`${users.id} IN (${dsql.join([...userIds].map(id => dsql`${id}`), dsql`, `)})`);
      userRows.forEach(u => { if (u.name) userNameMap[u.id] = u.name; });
    }

    const enriched = instances.map(i => ({
      ...i,
      assignedToName: i.assignedTo ? (userNameMap[i.assignedTo] || null) : null,
      staffName: i.staffId ? (userNameMap[i.staffId] || null) : null,
    }));

    res.json(enriched);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch instances by panel");
    res.status(500).json({ error: "Failed to fetch instances" });
  }
});

router.post("/api/checklist/instances/from-asset", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const { assetId, assetName, assetTag, assetCategory, assetLocation, serialNumber } = req.body;
    if (!assetId) {
      return res.status(400).json({ error: "Asset ID is required" });
    }

    const [template] = await db.select().from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.companyId, companyId!),
        eq(checklistTemplates.name, "Equipment Maintenance Log"),
        eq(checklistTemplates.isSystem, true),
        eq(checklistTemplates.isActive, true)
      ));

    if (!template) {
      return res.status(404).json({ error: "Equipment Maintenance Log template not found. Please contact your administrator." });
    }

    const responses: Record<string, unknown> = {};
    if (assetName) responses["mf-1"] = assetName;
    if (assetTag) responses["mf-2a"] = assetTag;
    if (assetCategory) responses["mf-2b"] = assetCategory;
    if (assetLocation) responses["mf-2c"] = assetLocation;
    if (serialNumber) responses["mf-3"] = serialNumber;

    const instanceNumber = `SVC-${Date.now()}`;

    const [created] = await db.insert(checklistInstances)
      .values({
        companyId,
        templateId: template.id,
        instanceNumber,
        status: "draft",
        responses,
        location: assetLocation || null,
        entityTypeId: template.entityTypeId,
        entitySubtypeId: template.entitySubtypeId,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to create service checklist from asset");
    res.status(500).json({ error: "Failed to create service checklist" });
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

    let templateVersion = validation.data.templateVersion || 1;
    if (validation.data.templateId) {
      const [tmpl] = await db.select({ version: checklistTemplates.version })
        .from(checklistTemplates)
        .where(eq(checklistTemplates.id, validation.data.templateId));
      if (tmpl) {
        templateVersion = tmpl.version;
      }
    }

    const [created] = await db.insert(checklistInstances)
      .values({ ...validation.data, instanceNumber, templateVersion })
      .returning();

    res.status(201).json(created);
  } catch (error: unknown) {
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

    if (parsed.data.responses && updated.templateId) {
      processWorkOrderTriggers(
        companyId!,
        instanceId,
        parsed.data.responses as Record<string, unknown>,
        updated.templateId
      ).catch(err => logger.error({ err }, "Work order trigger processing failed"));
    }

    res.json(updated);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete instance");
    res.status(500).json({ error: "Failed to delete instance" });
  }
});

export default router;
