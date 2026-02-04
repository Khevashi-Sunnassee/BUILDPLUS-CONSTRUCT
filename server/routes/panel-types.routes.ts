import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/panel-types/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const types = await storage.getAllPanelTypes();
  res.json(types);
});

router.get("/api/panel-types/admin/cost-summaries", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const types = await storage.getAllPanelTypes();
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch cost summaries" });
  }
});

router.get("/api/panel-types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const type = await storage.getPanelType(req.params.id as string);
  if (!type) return res.status(404).json({ error: "Panel type not found" });
  res.json(type);
});

router.post("/api/panel-types/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const type = await storage.createPanelType(req.body);
    res.json(type);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create panel type" });
  }
});

router.put("/api/panel-types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const type = await storage.updatePanelType(req.params.id as string, req.body);
  if (!type) return res.status(404).json({ error: "Panel type not found" });
  res.json(type);
});

router.delete("/api/panel-types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await storage.deletePanelType(req.params.id as string);
  res.json({ ok: true });
});

router.get("/api/panel-types/:id/cost-components", requireAuth, async (req: Request, res: Response) => {
  const components = await storage.getCostComponentsByPanelType(req.params.id as string);
  res.json(components);
});

router.put("/api/panel-types/:id/cost-components", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { components } = req.body;
    if (!Array.isArray(components)) {
      return res.status(400).json({ error: "components array required" });
    }
    const total = components.reduce((sum: number, c: any) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
    if (total > 100) {
      return res.status(400).json({ error: "Total percentage cannot exceed 100%" });
    }
    const inserted = await storage.replaceCostComponents(req.params.id as string, 
      components.map((c: any, i: number) => ({
        panelTypeId: req.params.id as string,
        name: c.name,
        percentageOfRevenue: String(c.percentageOfRevenue),
        sortOrder: i,
      }))
    );
    res.json(inserted);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update cost components" });
  }
});

router.get("/api/panel-types", requireAuth, async (req: Request, res: Response) => {
  const types = await storage.getAllPanelTypes();
  res.json(types.filter(t => t.isActive));
});

export const panelTypesRouter = router;
