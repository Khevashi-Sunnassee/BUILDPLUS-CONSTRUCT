import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { z } from "zod";

const router = Router();

const createPanelTypeSchema = z.object({
  code: z.string(),
  name: z.string(),
  companyId: z.string(),
  description: z.string().nullish(),
  labourCostPerM2: z.string().nullish(),
  labourCostPerM3: z.string().nullish(),
  supplyCostPerM2: z.string().nullish(),
  supplyCostPerM3: z.string().nullish(),
  installCostPerM2: z.string().nullish(),
  installCostPerM3: z.string().nullish(),
  totalRatePerM2: z.string().nullish(),
  totalRatePerM3: z.string().nullish(),
  sellRatePerM2: z.string().nullish(),
  sellRatePerM3: z.string().nullish(),
  expectedWeightPerM3: z.string().nullish(),
  isActive: z.boolean().optional(),
}).passthrough();

const updatePanelTypeSchema = createPanelTypeSchema.partial().passthrough();

const costComponentSchema = z.object({
  name: z.string(),
  percentageOfRevenue: z.union([z.string(), z.number()]),
});

const costComponentsBodySchema = z.object({
  components: z.array(costComponentSchema),
});

router.get("/api/panel-types/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const types = await storage.getAllPanelTypes(req.companyId);
    res.json(types);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch panel types" });
  }
});

router.get("/api/panel-types/admin/cost-summaries", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const types = await storage.getAllPanelTypes(req.companyId);
    const summaries: Record<string, { totalCostPercent: number; profitMargin: number }> = {};
    
    for (const type of types) {
      const components = await storage.getCostComponentsByPanelType(type.id);
      const totalCostPercent = components.reduce((sum, c) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
      summaries[type.id] = {
        totalCostPercent,
        profitMargin: 100 - totalCostPercent,
      };
    }
    
    res.json(summaries);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch cost summaries" });
  }
});

router.get("/api/panel-types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const type = await storage.getPanelType(req.params.id as string);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    if (req.companyId && type.companyId !== req.companyId) return res.status(403).json({ error: "Access denied" });
    res.json(type);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch panel type" });
  }
});

router.post("/api/panel-types/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const result = createPanelTypeSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    if (req.companyId) result.data.companyId = req.companyId;
    const type = await storage.createPanelType(result.data);
    res.json(type);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create panel type" });
  }
});

router.put("/api/panel-types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPanelType(req.params.id as string);
    if (!existing) return res.status(404).json({ error: "Panel type not found" });
    if (req.companyId && existing.companyId !== req.companyId) return res.status(403).json({ error: "Access denied" });
    const result = updatePanelTypeSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    const type = await storage.updatePanelType(req.params.id as string, result.data);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    res.json(type);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update panel type" });
  }
});

router.delete("/api/panel-types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPanelType(req.params.id as string);
    if (!existing) return res.status(404).json({ error: "Panel type not found" });
    if (req.companyId && existing.companyId !== req.companyId) return res.status(403).json({ error: "Access denied" });
    await storage.deletePanelType(req.params.id as string);
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete panel type" });
  }
});

router.get("/api/panel-types/:id/cost-components", requireAuth, async (req: Request, res: Response) => {
  try {
    const type = await storage.getPanelType(req.params.id as string);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    if (req.companyId && type.companyId !== req.companyId) return res.status(403).json({ error: "Access denied" });
    const components = await storage.getCostComponentsByPanelType(req.params.id as string);
    res.json(components);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch cost components" });
  }
});

router.put("/api/panel-types/:id/cost-components", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const type = await storage.getPanelType(req.params.id as string);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    if (req.companyId && type.companyId !== req.companyId) return res.status(403).json({ error: "Access denied" });
    const result = costComponentsBodySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    const { components } = result.data;
    const total = components.reduce((sum: number, c) => sum + (parseFloat(String(c.percentageOfRevenue)) || 0), 0);
    if (total > 100) {
      return res.status(400).json({ error: "Total percentage cannot exceed 100%" });
    }
    const inserted = await storage.replaceCostComponents(req.params.id as string, 
      components.map((c, i: number) => ({
        panelTypeId: req.params.id as string,
        name: c.name,
        percentageOfRevenue: String(c.percentageOfRevenue),
        sortOrder: i,
      }))
    );
    res.json(inserted);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update cost components" });
  }
});

router.get("/api/panel-types", requireAuth, async (req: Request, res: Response) => {
  try {
    const types = await storage.getAllPanelTypes(req.companyId);
    res.json(types.filter(t => t.isActive));
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch panel types" });
  }
});

export const panelTypesRouter = router;
