import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { z } from "zod";

const generateSlotsSchema = z.object({
  skipEmptyLevels: z.boolean().optional(),
});

const adjustSlotSchema = z.object({
  newDate: z.string(),
  reason: z.string().optional(),
  clientConfirmed: z.boolean().optional(),
  cascadeToLater: z.boolean().optional(),
});

const router = Router();

async function verifySlotCompanyAccess(req: Request, slotId: string): Promise<{ allowed: boolean; slot?: any }> {
  const slot = await storage.getProductionSlot(slotId);
  if (!slot) return { allowed: false };
  if (req.companyId && slot.job && slot.job.companyId !== req.companyId) return { allowed: false };
  return { allowed: true, slot };
}

async function verifyJobCompanyAccess(req: Request, jobId: string): Promise<boolean> {
  if (!req.companyId) return true;
  const job = await storage.getJob(jobId);
  if (!job) return false;
  return job.companyId === req.companyId;
}

router.get("/api/production-slots", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId, status, dateFrom, dateTo, factoryId } = req.query;
    const filters: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] } = {};
    if (jobId) filters.jobId = jobId as string;
    if (status) filters.status = status as string;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    
    const user = await storage.getUser(req.session.userId!);
    const userFactoryIds = user?.selectedFactoryIds && user.selectedFactoryIds.length > 0 
      ? user.selectedFactoryIds 
      : undefined;
    
    if (factoryId) {
      const requestedFactoryId = factoryId as string;
      if (userFactoryIds) {
        if (userFactoryIds.includes(requestedFactoryId)) {
          filters.factoryIds = [requestedFactoryId];
        } else {
          filters.factoryIds = [];
        }
      } else {
        filters.factoryIds = [requestedFactoryId];
      }
    } else if (userFactoryIds) {
      filters.factoryIds = userFactoryIds;
    }
    
    if (req.companyId) filters.companyId = req.companyId;
    const slots = await storage.getProductionSlots(filters);
    res.json(slots);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching production slots");
    res.status(500).json({ error: "Failed to fetch production slots" });
  }
});

router.get("/api/production-slots/jobs-without-slots", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobsWithoutSlots = await storage.getJobsWithoutProductionSlots(req.companyId);
    res.json(jobsWithoutSlots);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching jobs without slots");
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/api/production-slots/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const slot = await storage.getProductionSlot(String(req.params.id));
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    if (req.companyId && slot.job && slot.job.companyId !== req.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(slot);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching production slot");
    res.status(500).json({ error: "Failed to fetch production slot" });
  }
});

router.get("/api/production-slots/check-levels/:jobId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId);
    if (!(await verifyJobCompanyAccess(req, jobId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const result = await storage.checkPanelLevelCoverage(jobId);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error checking panel level coverage");
    res.status(500).json({ error: "Failed to check level coverage" });
  }
});

router.post("/api/production-slots/generate/:jobId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId);
    if (!(await verifyJobCompanyAccess(req, jobId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const result = generateSlotsSchema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { skipEmptyLevels } = result.data;
    const slots = await storage.generateProductionSlotsForJob(jobId, skipEmptyLevels);
    res.json(slots);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating production slots");
    res.status(500).json({ error: "Failed to generate production slots" });
  }
});

router.post("/api/production-slots/:id/adjust", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.id);
    const { allowed } = await verifySlotCompanyAccess(req, slotId);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }
    const result = adjustSlotSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { newDate, reason, clientConfirmed, cascadeToLater } = result.data;
    const changedById = req.session.userId!;
    
    const slot = await storage.adjustProductionSlot(slotId, {
      newDate: new Date(newDate),
      reason,
      changedById,
      clientConfirmed,
      cascadeToLater,
    });
    
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    res.json(slot);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error adjusting production slot");
    res.status(500).json({ error: "Failed to adjust production slot" });
  }
});

router.post("/api/production-slots/:id/book", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.id);
    const { allowed } = await verifySlotCompanyAccess(req, slotId);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }
    const slot = await storage.bookProductionSlot(slotId);
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    res.json(slot);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error booking production slot");
    res.status(500).json({ error: "Failed to book production slot" });
  }
});

router.post("/api/production-slots/:id/complete", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.id);
    const { allowed } = await verifySlotCompanyAccess(req, slotId);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }
    const slot = await storage.completeProductionSlot(slotId);
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    res.json(slot);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error completing production slot");
    res.status(500).json({ error: "Failed to complete production slot" });
  }
});

router.get("/api/production-slots/:id/adjustments", requireAuth, async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.id);
    const { allowed } = await verifySlotCompanyAccess(req, slotId);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }
    const adjustments = await storage.getProductionSlotAdjustments(slotId);
    res.json(adjustments);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching production slot adjustments");
    res.status(500).json({ error: "Failed to fetch adjustments" });
  }
});

router.delete("/api/production-slots/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.id);
    const { allowed } = await verifySlotCompanyAccess(req, slotId);
    if (!allowed) {
      return res.status(403).json({ error: "Access denied" });
    }
    await storage.deleteProductionSlot(slotId);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting production slot");
    res.status(500).json({ error: "Failed to delete production slot" });
  }
});

export const productionSlotsRouter = router;
