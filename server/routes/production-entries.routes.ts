import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import { requireJobCapability } from "./middleware/job-capability.middleware";
import { logPanelChange, advancePanelLifecycleIfLower } from "../services/panel-audit.service";
import { PANEL_LIFECYCLE_STATUS } from "@shared/schema";
import { z } from "zod";

const createProductionEntrySchema = z.object({
  panelId: z.string().optional(),
  loadWidth: z.string().optional(),
  loadHeight: z.string().optional(),
  panelThickness: z.string().optional(),
  panelVolume: z.string().optional(),
  panelMass: z.string().optional(),
}).passthrough();

const updateProductionEntrySchema = z.object({
  loadWidth: z.string().optional(),
  loadHeight: z.string().optional(),
  panelThickness: z.string().optional(),
  panelVolume: z.string().optional(),
  panelMass: z.string().optional(),
  panelId: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

const batchStatusSchema = z.object({
  entryIds: z.array(z.string()),
  status: z.string(),
});

const assignPanelsSchema = z.object({
  panelAssignments: z.array(z.object({
    panelId: z.string(),
    productionDate: z.string(),
  })),
  factory: z.string().optional(),
});

const router = Router();

router.get("/api/production-entries", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (date) {
    const entries = await storage.getProductionEntriesByDate(date);
    res.json(entries);
  } else {
    const entries = await storage.getAllProductionEntries();
    res.json(entries);
  }
});

router.get("/api/production-entries/:id", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  const entry = await storage.getProductionEntry(String(req.params.id));
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json(entry);
});

router.post("/api/production-entries", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), requireJobCapability("PRODUCE_PANELS"), async (req: Request, res: Response) => {
  try {
    const result = createProductionEntrySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { panelId, loadWidth, loadHeight, panelThickness, panelVolume, panelMass, ...entryFields } = result.data as any;
    if (panelId) {
      const panel = await storage.getPanelById(panelId);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      if (!panel.approvedForProduction) {
        return res.status(400).json({ error: "Panel is not approved for production. Please approve the panel in the Panel Register first." });
      }
      if (panel.documentStatus !== "APPROVED") {
        return res.status(400).json({ error: "Panel document status must be 'Approved for Production'. Current status: " + (panel.documentStatus || "DRAFT") + ". Please update the document status in the Drafting Register first." });
      }
      
      const panelUpdates: any = {};
      if (loadWidth !== undefined) panelUpdates.loadWidth = loadWidth;
      if (loadHeight !== undefined) panelUpdates.loadHeight = loadHeight;
      if (panelThickness !== undefined) panelUpdates.panelThickness = panelThickness;
      if (panelVolume !== undefined) panelUpdates.panelVolume = panelVolume;
      if (panelMass !== undefined) panelUpdates.panelMass = panelMass;
      
      if (Object.keys(panelUpdates).length > 0) {
        await storage.updatePanelRegisterItem(panelId, panelUpdates);
      }
    }
    
    const entryData = {
      ...entryFields,
      panelId,
      userId: req.session.userId!,
    };
    const entry = await storage.createProductionEntry(entryData);
    res.json(entry);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create production entry" });
  }
});

router.put("/api/production-entries/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const result = updateProductionEntrySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { loadWidth, loadHeight, panelThickness, panelVolume, panelMass, panelId, status, ...entryFields } = result.data as any;
    
    if (panelId) {
      const panelUpdates: any = {};
      if (loadWidth !== undefined) panelUpdates.loadWidth = loadWidth;
      if (loadHeight !== undefined) panelUpdates.loadHeight = loadHeight;
      if (panelThickness !== undefined) panelUpdates.panelThickness = panelThickness;
      if (panelVolume !== undefined) panelUpdates.panelVolume = panelVolume;
      if (panelMass !== undefined) panelUpdates.panelMass = panelMass;
      
      if (Object.keys(panelUpdates).length > 0) {
        await storage.updatePanelRegisterItem(panelId, panelUpdates);
        logPanelChange(panelId, "Production entry dimensions updated", req.session.userId, { changedFields: panelUpdates });
        if (panelUpdates.loadWidth || panelUpdates.loadHeight || panelUpdates.panelThickness) {
          advancePanelLifecycleIfLower(panelId, PANEL_LIFECYCLE_STATUS.DIMENSIONS_CONFIRMED, "Dimensions confirmed via production entry", req.session.userId);
        }
      }
      
      if (status === "COMPLETED") {
        await storage.updatePanelRegisterItem(panelId, { status: "COMPLETED" });
        advancePanelLifecycleIfLower(panelId, PANEL_LIFECYCLE_STATUS.PRODUCED, "Production completed", req.session.userId);
        
        const panel = await storage.getPanelRegisterItem(panelId);
        if (panel && panel.level && panel.building) {
          await storage.checkAndCompleteSlotByPanelCompletion(
            panel.jobId, 
            panel.level, 
            parseInt(panel.building) || 1
          );
        }
      }
    }
    
    const entry = await storage.updateProductionEntry(String(req.params.id), { ...entryFields, panelId, status });
    res.json(entry);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update production entry" });
  }
});

router.delete("/api/production-entries/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const entryId = String(req.params.id);
    const entry = await storage.getProductionEntry(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Production entry not found" });
    }
    
    if (entry.panelId) {
      await storage.updatePanelRegisterItem(entry.panelId, { status: "PENDING" });
    }
    
    await storage.deleteProductionEntry(entryId);
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete production entry" });
  }
});

router.put("/api/production-entries/batch-status", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  const batchResult = batchStatusSchema.safeParse(req.body);
  if (!batchResult.success) {
    return res.status(400).json({ error: batchResult.error.format() });
  }
  const { entryIds, status } = batchResult.data;
  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0 || !status) {
    return res.status(400).json({ error: "entryIds array and status required" });
  }
  if (!["PENDING", "COMPLETED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be PENDING or COMPLETED" });
  }
  const validEntries: { id: string; panelId: string }[] = [];
  for (const id of entryIds) {
    const entry = await storage.getProductionEntry(id);
    if (entry) {
      validEntries.push({ id, panelId: entry.panelId });
    }
  }
  if (validEntries.length === 0) {
    return res.status(404).json({ error: "No valid entries found" });
  }
  const updated = await Promise.all(
    validEntries.map(e => storage.updateProductionEntry(e.id, { status }))
  );
  
  if (status === "COMPLETED") {
    const uniquePanelIds = Array.from(new Set(validEntries.map(e => e.panelId)));
    
    await Promise.all(
      uniquePanelIds.map(panelId => storage.updatePanelRegisterItem(panelId, { status: "COMPLETED" }))
    );
    for (const panelId of uniquePanelIds) {
      advancePanelLifecycleIfLower(panelId, PANEL_LIFECYCLE_STATUS.PRODUCED, "Production completed (batch)", req.session.userId);
    }
    
    const slotsToCheck = new Map<string, { jobId: string; level: string; building: number }>();
    for (const panelId of uniquePanelIds) {
      const panel = await storage.getPanelRegisterItem(panelId);
      if (panel && panel.level && panel.building) {
        const key = `${panel.jobId}-${panel.level}-${panel.building}`;
        if (!slotsToCheck.has(key)) {
          slotsToCheck.set(key, {
            jobId: panel.jobId,
            level: panel.level,
            building: parseInt(panel.building) || 1
          });
        }
      }
    }
    
    for (const item of Array.from(slotsToCheck.values())) {
      await storage.checkAndCompleteSlotByPanelCompletion(item.jobId, item.level, item.building);
    }
  }
  
  res.json({ updated: updated.length });
});

router.get("/api/production-slots/:slotId/panel-entries", requireAuth, requirePermission("production_report", "VIEW"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.slotId);
    const slot = await storage.getProductionSlot(slotId);
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    
    const panels = await storage.getPanelsByJobAndLevel(slot.jobId, slot.level);
    
    const entries: Record<string, { productionDate: string; entryId: string }> = {};
    for (const panel of panels) {
      const entry = await storage.getProductionEntryByPanelId(panel.id);
      if (entry) {
        entries[panel.id] = { productionDate: entry.productionDate, entryId: entry.id };
      }
    }
    
    res.json(entries);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to fetch panel entries" });
  }
});

router.post("/api/production-slots/:slotId/assign-panels", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.slotId);
    const assignResult = assignPanelsSchema.safeParse(req.body);
    if (!assignResult.success) {
      return res.status(400).json({ error: assignResult.error.format() });
    }
    const { panelAssignments, factory } = assignResult.data;

    if (!panelAssignments || !Array.isArray(panelAssignments) || panelAssignments.length === 0) {
      return res.status(400).json({ error: "Panel assignments are required" });
    }

    const slot = await storage.getProductionSlot(slotId);
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    
    if (slot.status !== "BOOKED") {
      return res.status(400).json({ error: "Production slot must be in BOOKED status to assign panels" });
    }
    
    const job = await storage.getJob(slot.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found for production slot" });
    }
    
    const settings = await storage.getGlobalSettings();
    const productionWindowDays = job.productionWindowDays ?? settings?.productionWindowDays ?? 10;
    
    const dueDate = new Date(slot.productionSlotDate);
    const startDate = new Date(dueDate);
    startDate.setDate(startDate.getDate() - productionWindowDays);

    const results: { created: number; skipped: number; errors: string[] } = { created: 0, skipped: 0, errors: [] };
    const targetFactory = job.state === "QLD" ? "QLD" : "VIC";

    for (const assignment of panelAssignments) {
      try {
        const assignmentDate = new Date(assignment.productionDate);
        if (assignmentDate < startDate || assignmentDate > dueDate) {
          results.errors.push(`Date ${assignment.productionDate} is outside the production window`);
          results.skipped++;
          continue;
        }
        
        const panel = await storage.getPanelById(assignment.panelId);
        if (!panel) {
          results.errors.push(`Panel ${assignment.panelId} not found`);
          results.skipped++;
          continue;
        }
        
        if (panel.jobId !== slot.jobId) {
          results.errors.push(`Panel ${panel.panelMark} does not belong to this job`);
          results.skipped++;
          continue;
        }
        if (panel.level !== slot.level) {
          results.errors.push(`Panel ${panel.panelMark} is not on level ${slot.level}`);
          results.skipped++;
          continue;
        }

        const existingEntry = await storage.getProductionEntryByPanelId(assignment.panelId);
        if (existingEntry) {
          results.errors.push(`Panel ${panel.panelMark} already has a production entry`);
          results.skipped++;
          continue;
        }

        await storage.createProductionEntry({
          panelId: assignment.panelId,
          jobId: panel.jobId,
          productionDate: assignment.productionDate,
          factory: targetFactory,
          status: "PENDING",
          volumeM3: panel.panelVolume || null,
          areaM2: panel.panelArea || null,
          userId: req.session.userId!,
        });
        
        await storage.updatePanelRegisterItem(assignment.panelId, { status: "IN_PROGRESS" });
        advancePanelLifecycleIfLower(assignment.panelId, PANEL_LIFECYCLE_STATUS.IN_PRODUCTION, "Assigned to production slot", req.session.userId, { productionDate: assignment.productionDate });
        
        results.created++;
      } catch (err: any) {
        results.errors.push(`Failed to assign panel: ${err.message}`);
        results.skipped++;
      }
    }

    res.json(results);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to assign panels" });
  }
});

export const productionEntriesRouter = router;
