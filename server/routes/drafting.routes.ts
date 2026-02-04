import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";

const router = Router();

router.get("/api/drafting-program", requireAuth, requirePermission("production_report", "VIEW"), async (req, res) => {
  try {
    const { jobId, status, assignedToId, dateFrom, dateTo } = req.query;
    const filters: any = {};
    if (jobId) filters.jobId = jobId as string;
    if (status) filters.status = status as string;
    if (assignedToId) filters.assignedToId = assignedToId as string;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    
    const user = await storage.getUser(req.session.userId!);
    if (user?.selectedFactoryIds && user.selectedFactoryIds.length > 0) {
      filters.factoryIds = user.selectedFactoryIds;
    }
    
    const programs = await storage.getDraftingPrograms(Object.keys(filters).length > 0 ? filters : undefined);
    res.json(programs);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching drafting program");
    res.status(500).json({ error: error.message || "Failed to fetch drafting program" });
  }
});

router.get("/api/drafting-program/my-allocated", requireAuth, requirePermission("daily_reports", "VIEW"), async (req, res) => {
  try {
    const userId = req.session.userId!;
    
    const user = await storage.getUser(userId);
    const factoryIds = (user?.selectedFactoryIds && user.selectedFactoryIds.length > 0) 
      ? user.selectedFactoryIds 
      : undefined;
    
    const programs = await storage.getDraftingPrograms({ assignedToId: userId, factoryIds });
    
    const completed = programs.filter(p => p.status === "COMPLETED");
    const inProgress = programs.filter(p => p.status === "IN_PROGRESS");
    const scheduled = programs.filter(p => p.status === "SCHEDULED");
    const notScheduled = programs.filter(p => p.status === "NOT_SCHEDULED");
    const onHold = programs.filter(p => p.status === "ON_HOLD");
    
    const totalActualHours = programs.reduce((sum, p) => sum + (parseFloat(p.actualHours || "0")), 0);
    const totalEstimatedHours = programs.reduce((sum, p) => sum + (parseFloat(p.estimatedHours || "0")), 0);
    
    res.json({
      programs,
      stats: {
        total: programs.length,
        completed: completed.length,
        inProgress: inProgress.length,
        scheduled: scheduled.length,
        notScheduled: notScheduled.length,
        onHold: onHold.length,
        totalActualHours,
        totalEstimatedHours,
      }
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching my allocated panels");
    res.status(500).json({ error: error.message || "Failed to fetch allocated panels" });
  }
});

router.get("/api/drafting-program/:id", requireAuth, requirePermission("production_report", "VIEW"), async (req, res) => {
  try {
    const program = await storage.getDraftingProgram(String(req.params.id));
    if (!program) return res.status(404).json({ error: "Drafting program entry not found" });
    res.json(program);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching drafting program entry");
    res.status(500).json({ error: error.message || "Failed to fetch drafting program entry" });
  }
});

router.post("/api/drafting-program/generate", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const result = await storage.generateDraftingProgramFromProductionSlots();
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error({ err: error }, "Error generating drafting program");
    res.status(500).json({ error: error.message || "Failed to generate drafting program" });
  }
});

const assignDraftingResourceSchema = z.object({
  assignedToId: z.string().min(1, "assignedToId is required"),
  proposedStartDate: z.string().min(1, "proposedStartDate is required"),
});

router.post("/api/drafting-program/:id/assign", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const parsed = assignDraftingResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
    }
    const { assignedToId, proposedStartDate } = parsed.data;
    const updated = await storage.assignDraftingResource(String(req.params.id), assignedToId, new Date(proposedStartDate));
    if (!updated) return res.status(404).json({ error: "Drafting program entry not found" });
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error assigning drafting resource");
    res.status(500).json({ error: error.message || "Failed to assign drafting resource" });
  }
});

const updateDraftingProgramSchema = z.object({
  status: z.enum(["NOT_SCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]).optional(),
  priority: z.number().optional(),
  estimatedHours: z.string().optional(),
  actualHours: z.string().optional(),
  notes: z.string().optional(),
  completedAt: z.string().nullable().optional(),
});

router.patch("/api/drafting-program/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const parsed = updateDraftingProgramSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
    }
    const updateData: any = { ...parsed.data };
    if (updateData.completedAt) {
      updateData.completedAt = new Date(updateData.completedAt);
    }
    const updated = await storage.updateDraftingProgram(String(req.params.id), updateData);
    if (!updated) return res.status(404).json({ error: "Drafting program entry not found" });
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating drafting program");
    res.status(500).json({ error: error.message || "Failed to update drafting program" });
  }
});

router.delete("/api/drafting-program/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteDraftingProgram(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting drafting program entry");
    res.status(500).json({ error: error.message || "Failed to delete drafting program entry" });
  }
});

router.delete("/api/drafting-program/job/:jobId", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const jobId = String(req.params.jobId);
    const deleted = await storage.deleteDraftingProgramByJob(jobId);
    res.json({ success: true, deleted });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting drafting program entries for job");
    res.status(500).json({ error: error.message || "Failed to delete drafting program entries" });
  }
});

export const draftingRouter = router;
