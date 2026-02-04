import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { storage, db, getFactoryWorkDays, getCfmeuHolidaysInRange, subtractWorkingDays } from "../storage";
import { insertJobSchema, jobs, factories } from "@shared/schema";
import { requireAuth, requireRole } from "./middleware/auth.middleware";

const router = Router();

// GET /api/projects - Legacy endpoint for backward compatibility
router.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
  const jobs = await storage.getAllJobs();
  res.json(jobs.map(j => ({ id: j.id, name: j.name, code: j.code || j.jobNumber })));
});

// GET /api/jobs - Get all jobs (active only, for general use)
router.get("/api/jobs", requireAuth, async (req: Request, res: Response) => {
  const allJobs = await storage.getAllJobs();
  res.json(allJobs.filter(j => j.status === "ACTIVE"));
});

// GET /api/jobs/:jobId/totals - Get job totals (m2, m3, elements)
router.get("/api/jobs/:jobId/totals", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId);
    const panels = await storage.getPanelsByJob(jobId);
    
    let totalAreaM2 = 0;
    let totalVolumeM3 = 0;
    let totalElements = 0;
    let pendingCount = 0;
    let validatedCount = 0;
    
    for (const panel of panels) {
      const qty = panel.qty || 1;
      totalElements += qty;
      
      if (panel.panelArea) {
        totalAreaM2 += parseFloat(panel.panelArea) * qty;
      }
      if (panel.panelVolume) {
        totalVolumeM3 += parseFloat(panel.panelVolume) * qty;
      }
      
      if (panel.status === "PENDING") {
        pendingCount += qty;
      } else {
        validatedCount += qty;
      }
    }
    
    res.json({
      totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
      totalVolumeM3: Math.round(totalVolumeM3 * 1000) / 1000,
      totalElements,
      pendingCount,
      validatedCount,
      panelCount: panels.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get job totals" });
  }
});

// GET /api/jobs/:jobId/panel-rates - Get panel rates for a job
router.get("/api/jobs/:jobId/panel-rates", requireAuth, async (req: Request, res: Response) => {
  const rates = await storage.getEffectiveRates(req.params.jobId as string);
  res.json(rates);
});

// PUT /api/jobs/:jobId/panel-rates/:panelTypeId - Update panel rate for a job
router.put("/api/jobs/:jobId/panel-rates/:panelTypeId", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const rate = await storage.upsertJobPanelRate(req.params.jobId as string, req.params.panelTypeId as string, req.body);
    res.json(rate);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update job rate" });
  }
});

// DELETE /api/jobs/:jobId/panel-rates/:rateId - Delete panel rate
router.delete("/api/jobs/:jobId/panel-rates/:rateId", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await storage.deleteJobPanelRate(req.params.rateId as string);
  res.json({ ok: true });
});

// Admin job endpoints

// GET /api/admin/jobs - Get all jobs (for admin)
router.get("/api/admin/jobs", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const allJobs = await storage.getAllJobs();
  res.json(allJobs);
});

// GET /api/admin/jobs/:id - Get single job
router.get("/api/admin/jobs/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const job = await storage.getJob(req.params.id as string);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// POST /api/admin/jobs - Create job
router.post("/api/admin/jobs", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await storage.getJobByNumber(req.body.jobNumber);
    if (existing) {
      return res.status(400).json({ error: "Job with this number already exists" });
    }
    const data = { ...req.body };
    if (data.productionStartDate && typeof data.productionStartDate === 'string') {
      data.productionStartDate = new Date(data.productionStartDate);
    }
    const globalSettings = await storage.getGlobalSettings();
    if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
      const val = parseInt(data.procurementDaysInAdvance, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
      }
      const ifcDays = data.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14;
      if (val >= ifcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
      }
      data.procurementDaysInAdvance = val;
    }
    if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
      const val = parseInt(data.procurementTimeDays, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementTimeDays must be a positive number" });
      }
      data.procurementTimeDays = val;
    }
    const job = await storage.createJob(data);
    res.json(job);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create job" });
  }
});

// PUT /api/admin/jobs/:id - Update job
router.put("/api/admin/jobs/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = { ...req.body };
    if (data.productionStartDate !== undefined) {
      if (data.productionStartDate && typeof data.productionStartDate === 'string') {
        data.productionStartDate = new Date(data.productionStartDate);
      } else {
        data.productionStartDate = null;
      }
    }
    if (data.daysToAchieveIfc !== undefined && data.daysToAchieveIfc !== null) {
      const val = parseInt(data.daysToAchieveIfc, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "daysToAchieveIfc must be a positive number" });
      }
      data.daysToAchieveIfc = val;
    }
    if (data.productionWindowDays !== undefined && data.productionWindowDays !== null) {
      const val = parseInt(data.productionWindowDays, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "productionWindowDays must be a positive number" });
      }
      data.productionWindowDays = val;
    }
    if (data.productionDaysInAdvance !== undefined && data.productionDaysInAdvance !== null) {
      const val = parseInt(data.productionDaysInAdvance, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "productionDaysInAdvance must be a positive number" });
      }
      data.productionDaysInAdvance = val;
    }
    const globalSettings = await storage.getGlobalSettings();
    const existingJob = await storage.getJob(req.params.id as string);
    
    if (data.daysInAdvance !== undefined && data.daysInAdvance !== null) {
      const newIfcDays = parseInt(data.daysInAdvance, 10);
      const effectiveProcurementDays = data.procurementDaysInAdvance ?? existingJob?.procurementDaysInAdvance ?? globalSettings?.procurementDaysInAdvance ?? 7;
      if (!isNaN(newIfcDays) && newIfcDays <= effectiveProcurementDays) {
        return res.status(400).json({ error: `daysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
      }
    }
    
    if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
      const val = parseInt(data.procurementDaysInAdvance, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
      }
      const ifcDays = data.daysInAdvance ?? existingJob?.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14;
      if (val >= ifcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
      }
      data.procurementDaysInAdvance = val;
    }
    if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
      const val = parseInt(data.procurementTimeDays, 10);
      if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "procurementTimeDays must be a positive number" });
      }
      data.procurementTimeDays = val;
    }
    const job = await storage.updateJob(req.params.id as string, data);
    res.json(job);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update job" });
  }
});

// DELETE /api/admin/jobs/:id - Delete job
router.delete("/api/admin/jobs/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const jobId = req.params.id as string;
  
  const panels = await storage.getPanelsByJob(jobId);
  if (panels.length > 0) {
    return res.status(400).json({ 
      error: "Cannot delete job with panels",
      message: `This job has ${panels.length} panel(s) registered. Please delete or reassign them first.`
    });
  }
  
  await storage.deleteJob(jobId);
  res.json({ ok: true });
});

// GET /api/admin/jobs/:id/level-cycle-times - Get level cycle times
router.get("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const cycleTimes = await storage.getJobLevelCycleTimes(req.params.id as string);
    res.json(cycleTimes);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get level cycle times" });
  }
});

// POST /api/admin/jobs/:id/level-cycle-times - Update level cycle times
router.post("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const cycleTimeSchema = z.object({
      buildingNumber: z.number().int().min(1),
      level: z.string().min(1),
      levelOrder: z.number().min(0),
      cycleDays: z.number().int().min(1),
    });
    
    const bodySchema = z.object({
      cycleTimes: z.array(cycleTimeSchema),
    });
    
    const parseResult = bodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid cycle times data", details: parseResult.error.format() });
    }
    
    await storage.saveJobLevelCycleTimes(req.params.id as string, parseResult.data.cycleTimes);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save level cycle times" });
  }
});

// GET /api/admin/jobs/:id/production-slot-status - Get production slot status
router.get("/api/admin/jobs/:id/production-slot-status", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id as string;
    const slots = await storage.getProductionSlots({ jobId });
    
    const hasSlots = slots.length > 0;
    const nonStartedSlots = slots.filter(s => s.status === "SCHEDULED" || s.status === "PENDING_UPDATE");
    const hasNonStartedSlots = nonStartedSlots.length > 0;
    const allStarted = hasSlots && !hasNonStartedSlots;
    
    res.json({
      hasSlots,
      hasNonStartedSlots,
      allStarted,
      totalSlots: slots.length,
      nonStartedCount: nonStartedSlots.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get production slot status" });
  }
});

// POST /api/admin/jobs/:id/rules - Create mapping rule
router.post("/api/admin/jobs/:id/rules", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const rule = await storage.createMappingRule({
    jobId: req.params.id as string,
    pathContains: req.body.pathContains,
    priority: req.body.priority || 100,
  });
  res.json(rule);
});

// DELETE /api/admin/mapping-rules/:id - Delete mapping rule
router.delete("/api/admin/mapping-rules/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await storage.deleteMappingRule(req.params.id as string);
  res.json({ ok: true });
});

export const jobsRouter = router;
