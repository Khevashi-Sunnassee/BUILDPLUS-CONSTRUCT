import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

router.get("/api/panels", requireAuth, async (req: Request, res: Response) => {
  const jobId = req.query.jobId as string | undefined;
  const level = req.query.level as string | undefined;
  
  if (jobId && level) {
    const panels = await storage.getPanelsByJobAndLevel(jobId, level);
    res.json(panels);
  } else if (jobId) {
    const panels = await storage.getPanelsByJob(jobId);
    res.json(panels);
  } else {
    const panels = await storage.getAllPanelRegisterItems();
    res.json(panels);
  }
});

router.get("/api/panels/by-job/:jobId", requireAuth, async (req: Request, res: Response) => {
  const panels = await storage.getPanelsByJob(req.params.jobId as string);
  res.json(panels);
});

router.get("/api/panels/approved-for-production", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.query;
    const panels = await storage.getPanelsApprovedForProduction(jobId as string | undefined);
    res.json(panels);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching approved panels");
    res.status(500).json({ error: "Failed to fetch approved panels" });
  }
});

router.put("/api/panels/:id/document-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentStatus } = req.body;
    if (!documentStatus || !["DRAFT", "IFA", "IFC", "APPROVED"].includes(documentStatus)) {
      return res.status(400).json({ error: "Invalid document status. Must be DRAFT, IFA, IFC, or APPROVED" });
    }
    
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    if (documentStatus === "APPROVED") {
      const user = (req as any).user;
      if (!user || !["MANAGER", "ADMIN"].includes(user.role)) {
        return res.status(403).json({ error: "Only managers or admins can approve documents for production" });
      }
      if (panel.documentStatus !== "IFC") {
        return res.status(400).json({ error: "Panel must be in IFC status before it can be approved for production" });
      }
    }
    
    const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
      documentStatus 
    });
    res.json(updatedPanel);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update document status" });
  }
});

router.get("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const panel = await storage.getPanelRegisterItem(req.params.id as string);
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  res.json(panel);
});

router.post("/api/panels/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const panel = await storage.createPanelRegisterItem(req.body);
    res.json(panel);
  } catch (error: any) {
    if (error.message?.includes("duplicate")) {
      return res.status(400).json({ error: "Panel with this mark already exists for this job" });
    }
    res.status(400).json({ error: error.message || "Failed to create panel" });
  }
});

router.put("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const panel = await storage.updatePanelRegisterItem(req.params.id as string, req.body);
  res.json(panel);
});

router.post("/api/panels/admin/:id/validate", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    if (panel.status !== "PENDING") {
      return res.status(400).json({ error: "Only panels with PENDING status can be validated" });
    }
    const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
      status: "NOT_STARTED" 
    });
    res.json(updatedPanel);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to validate panel" });
  }
});

router.delete("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await storage.deletePanelRegisterItem(req.params.id as string);
  res.json({ ok: true });
});

router.get("/api/panels/admin/source-counts", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const counts = await storage.getPanelCountsBySource();
  res.json(counts);
});

router.delete("/api/panels/admin/by-source/:source", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const source = parseInt(String(req.params.source));
    if (![1, 2, 3].includes(source)) {
      return res.status(400).json({ error: "Invalid source. Must be 1 (Manual), 2 (Excel), or 3 (Estimate)" });
    }
    
    const hasRecords = await storage.panelsWithSourceHaveRecords(source);
    if (hasRecords) {
      return res.status(400).json({ 
        error: "Cannot delete panels that have production records or are approved for production" 
      });
    }
    
    const deletedCount = await storage.deletePanelsBySource(source);
    res.json({ deleted: deletedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete panels" });
  }
});

export const panelsRouter = router;
