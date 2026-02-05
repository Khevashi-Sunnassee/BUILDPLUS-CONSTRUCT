import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

router.get("/api/panels", requireAuth, async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  
  const jobId = req.query.jobId as string | undefined;
  const level = req.query.level as string | undefined;
  
  if (jobId) {
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (level) {
      const panels = await storage.getPanelsByJobAndLevel(jobId, level);
      res.json(panels);
    } else {
      const panels = await storage.getPanelsByJob(jobId);
      res.json(panels);
    }
  } else {
    const allPanels = await storage.getAllPanelRegisterItems();
    const filtered = allPanels.filter(p => p.job?.companyId === companyId);
    res.json(filtered);
  }
});

router.get("/api/panels/by-job/:jobId", requireAuth, async (req: Request, res: Response) => {
  const companyId = req.companyId;
  const job = await storage.getJob(req.params.jobId as string);
  if (!job || job.companyId !== companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  const panels = await storage.getPanelsByJob(req.params.jobId as string);
  res.json(panels);
});

router.get("/api/panels/approved-for-production", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { jobId } = req.query;
    if (jobId) {
      const job = await storage.getJob(jobId as string);
      if (!job || job.companyId !== companyId) {
        return res.status(404).json({ error: "Job not found" });
      }
    }
    const panels = await storage.getPanelsApprovedForProduction(jobId as string | undefined);
    const filtered = panels.filter((p: any) => p.job?.companyId === companyId);
    res.json(filtered);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching approved panels");
    res.status(500).json({ error: "Failed to fetch approved panels" });
  }
});

router.put("/api/panels/:id/document-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const { documentStatus } = req.body;
    if (!documentStatus || !["DRAFT", "IFA", "IFC", "APPROVED"].includes(documentStatus)) {
      return res.status(400).json({ error: "Invalid document status. Must be DRAFT, IFA, IFC, or APPROVED" });
    }
    
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    if (documentStatus === "APPROVED") {
      const userId = req.session.userId;
      const user = userId ? await storage.getUser(userId) : null;
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

router.get("/api/panels/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const jobId = req.query.jobId as string | undefined;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    
    const panels = await storage.getAllPanelRegisterItems();
    
    let filtered = panels.filter(p => p.job?.companyId === companyId);
    if (jobId) {
      filtered = filtered.filter(p => p.jobId === jobId);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.panelMark?.toLowerCase().includes(searchLower) ||
        p.panelType?.toLowerCase().includes(searchLower)
      );
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(p => p.approvedForProduction === (status === 'approved'));
    }
    
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);
    
    res.json({
      panels: paginated,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize)
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to get admin panels");
    res.status(500).json({ error: "Failed to get panels" });
  }
});

router.get("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const companyId = req.companyId;
  const panel = await storage.getPanelRegisterItem(req.params.id as string);
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  const job = await storage.getJob(panel.jobId);
  if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
  res.json(panel);
});

router.post("/api/panels/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const job = await storage.getJob(req.body.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(400).json({ error: "Invalid job" });
    }
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
  const companyId = req.companyId;
  const existing = await storage.getPanelRegisterItem(req.params.id as string);
  if (!existing) return res.status(404).json({ error: "Panel not found" });
  const job = await storage.getJob(existing.jobId);
  if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
  const panel = await storage.updatePanelRegisterItem(req.params.id as string, req.body);
  res.json(panel);
});

router.post("/api/panels/admin/:id/validate", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
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
  const companyId = req.companyId;
  const panel = await storage.getPanelRegisterItem(req.params.id as string);
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  const job = await storage.getJob(panel.jobId);
  if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
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
