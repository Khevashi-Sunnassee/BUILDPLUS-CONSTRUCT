import {
  Router, Request, Response,
  eq, and,
  db,
  entityTypes, entitySubtypes,
  insertEntityTypeSchema, insertEntitySubtypeSchema,
  requireAuth, requireRole,
  logger,
} from "./shared";

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
      .orderBy(entityTypes.sortOrder)
      .limit(200);

    res.json(types);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
      .orderBy(entitySubtypes.sortOrder)
      .limit(200);

    res.json(subtypes);
  } catch (error: unknown) {
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
      .orderBy(entitySubtypes.sortOrder)
      .limit(200);

    res.json(subtypes);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete entity subtype");
    res.status(500).json({ error: "Failed to delete entity subtype" });
  }
});

export default router;
