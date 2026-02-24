import { Router } from "express";
import {
  requireAuth, requireRole, Request, Response,
  db, logger, assets, and, eq, desc,
  createAssetSchema, generateAssetTag, getOpenAI,
} from "./shared";
import { assetMaintenanceRecords, departments } from "@shared/schema";

const router = Router();

router.get("/api/assets/simple", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db.select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      category: assets.category,
      status: assets.status,
      serialNumber: assets.serialNumber,
      manufacturer: assets.manufacturer,
      model: assets.model,
      location: assets.location,
      registrationNumber: assets.registrationNumber,
    }).from(assets)
      .where(eq(assets.companyId, companyId))
      .orderBy(assets.name)
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch simple assets list");
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.get("/api/admin/assets", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const result = await db.select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      category: assets.category,
      status: assets.status,
      condition: assets.condition,
      location: assets.location,
      department: assets.department,
      fundingMethod: assets.fundingMethod,
      purchaseDate: assets.purchaseDate,
      purchasePrice: assets.purchasePrice,
      currentValue: assets.currentValue,
      usefulLifeYears: assets.usefulLifeYears,
      accumulatedDepreciation: assets.accumulatedDepreciation,
      depreciationThisPeriod: assets.depreciationThisPeriod,
      bookValue: assets.bookValue,
      yearsDepreciated: assets.yearsDepreciated,
      depreciationRate: assets.depreciationRate,
      depreciationMethod: assets.depreciationMethod,
      manufacturer: assets.manufacturer,
      model: assets.model,
      serialNumber: assets.serialNumber,
      registrationNumber: assets.registrationNumber,
      assignedTo: assets.assignedTo,
      supplier: assets.supplier,
      quantity: assets.quantity,
      remarks: assets.remarks,
      createdAt: assets.createdAt,
    }).from(assets)
      .where(eq(assets.companyId, companyId))
      .orderBy(desc(assets.createdAt))
      .limit(safeLimit);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch assets");
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.get("/api/admin/assets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to fetch asset");
    res.status(500).json({ error: "Failed to fetch asset" });
  }
});

router.post("/api/admin/assets", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const assetTag = await generateAssetTag(companyId);
    const data: Record<string, unknown> = {
      ...parsed.data,
      companyId,
      assetTag,
      createdBy: req.session?.userId || null,
    };
    if (data.departmentId) {
      const [dept] = await db.select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(and(eq(departments.id, data.departmentId as string), eq(departments.companyId, companyId)))
        .limit(1);
      if (!dept) return res.status(400).json({ error: "Selected department not found" });
      data.department = dept.name;
    } else {
      data.departmentId = null;
    }
    const [created] = await db.insert(assets).values(data as any).returning();
    res.status(201).json(created);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to create asset");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/admin/assets/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [existing] = await db.select().from(assets)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Asset not found" });

    const parsed = createAssetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const { id: _id, companyId: _cid, assetTag: _tag, createdAt: _ca, ...safeData } = parsed.data as Record<string, unknown>;
    if (safeData.departmentId !== undefined) {
      if (safeData.departmentId) {
        const [dept] = await db.select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(and(eq(departments.id, safeData.departmentId as string), eq(departments.companyId, companyId)))
          .limit(1);
        if (!dept) return res.status(400).json({ error: "Selected department not found" });
        safeData.department = dept.name;
      } else {
        safeData.departmentId = null;
        if (safeData.department === undefined) safeData.department = null;
      }
    }
    const [updated] = await db.update(assets)
      .set({ ...safeData, updatedAt: new Date() } as any)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to update asset");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/assets/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [existing] = await db.select().from(assets)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Asset not found" });
    await db.delete(assets).where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to delete asset");
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

router.post("/api/admin/assets/:id/ai-summary", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, String(req.params.id)), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    if (!asset.manufacturer && !asset.model) {
      return res.status(400).json({ error: "Manufacturer and model are required for AI analysis" });
    }

    const maintenanceHistory = await db.select().from(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.assetId, asset.id), eq(assetMaintenanceRecords.companyId, companyId)))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate))
      .limit(20);

    const prompt = `Analyze this construction/manufacturing asset and provide a comprehensive summary:

Asset: ${asset.name}
Manufacturer: ${asset.manufacturer || 'Unknown'}
Model: ${asset.model || 'Unknown'}
Category: ${asset.category}
Condition: ${asset.condition || 'Not assessed'}
Year of Manufacture: ${asset.yearOfManufacture || 'Unknown'}
Purchase Price: ${asset.purchasePrice ? `$${asset.purchasePrice}` : 'Unknown'}
Current Value: ${asset.currentValue ? `$${asset.currentValue}` : 'Unknown'}
Operating Hours: ${asset.operatingHours || 'Unknown'}
Serial Number: ${asset.serialNumber || 'N/A'}
Status: ${asset.status || 'active'}
${maintenanceHistory.length > 0 ? `\nRecent Maintenance (${maintenanceHistory.length} records):\n${maintenanceHistory.map(m => `- ${m.maintenanceDate}: ${m.maintenanceType} - ${m.description || 'No details'} ($${m.cost || '0'})`).join('\n')}` : ''}

Please provide:
1. Asset Overview & Market Context
2. Expected Remaining Useful Life
3. Current Market Value Assessment
4. Recommended Maintenance Schedule
5. Risk Assessment & Recommendations
6. Depreciation Analysis

Format as clean HTML with headings and bullet points.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an asset management specialist for construction and manufacturing companies. Provide practical, data-driven analysis." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content || "";
    const [updated] = await db.update(assets)
      .set({ aiSummary: summary, updatedAt: new Date() })
      .where(and(eq(assets.id, asset.id), eq(assets.companyId, companyId)))
      .returning();
    res.json({ aiSummary: summary });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to generate AI summary");
    res.status(500).json({ error: "Failed to generate AI summary" });
  }
});

export default router;
