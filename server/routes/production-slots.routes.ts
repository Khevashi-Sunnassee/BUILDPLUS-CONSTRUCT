import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

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
    
    const slots = await storage.getProductionSlots(filters);
    res.json(slots);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching production slots");
    res.status(500).json({ error: error.message || "Failed to fetch production slots" });
  }
});

router.get("/api/production-slots/jobs-without-slots", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobsWithoutSlots = await storage.getJobsWithoutProductionSlots();
    res.json(jobsWithoutSlots);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching jobs without slots");
    res.status(500).json({ error: error.message || "Failed to fetch jobs" });
  }
});

router.get("/api/production-slots/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const slot = await storage.getProductionSlot(String(req.params.id));
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    res.json(slot);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching production slot");
    res.status(500).json({ error: error.message || "Failed to fetch production slot" });
  }
});

router.get("/api/production-slots/check-levels/:jobId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const result = await storage.checkPanelLevelCoverage(String(req.params.jobId));
    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, "Error checking panel level coverage");
    res.status(500).json({ error: error.message || "Failed to check level coverage" });
  }
});

router.post("/api/production-slots/generate/:jobId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { skipEmptyLevels } = req.body || {};
    const slots = await storage.generateProductionSlotsForJob(String(req.params.jobId), skipEmptyLevels);
    res.json(slots);
  } catch (error: any) {
    logger.error({ err: error }, "Error generating production slots");
    res.status(500).json({ error: error.message || "Failed to generate production slots" });
  }
});

router.post("/api/production-slots/:id/adjust", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { newDate, reason, clientConfirmed, cascadeToLater } = req.body;
    const changedById = req.session.userId!;
    
    const slot = await storage.adjustProductionSlot(String(req.params.id), {
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
  } catch (error: any) {
    logger.error({ err: error }, "Error adjusting production slot");
    res.status(500).json({ error: error.message || "Failed to adjust production slot" });
  }
});

router.post("/api/production-slots/:id/book", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const slot = await storage.bookProductionSlot(String(req.params.id));
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    res.json(slot);
  } catch (error: any) {
    logger.error({ err: error }, "Error booking production slot");
    res.status(500).json({ error: error.message || "Failed to book production slot" });
  }
});

router.post("/api/production-slots/:id/complete", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const slot = await storage.completeProductionSlot(String(req.params.id));
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    res.json(slot);
  } catch (error: any) {
    logger.error({ err: error }, "Error completing production slot");
    res.status(500).json({ error: error.message || "Failed to complete production slot" });
  }
});

router.get("/api/production-slots/:id/adjustments", requireAuth, async (req: Request, res: Response) => {
  try {
    const adjustments = await storage.getProductionSlotAdjustments(String(req.params.id));
    res.json(adjustments);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching production slot adjustments");
    res.status(500).json({ error: error.message || "Failed to fetch adjustments" });
  }
});

router.delete("/api/production-slots/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    await storage.deleteProductionSlot(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting production slot");
    res.status(500).json({ error: error.message || "Failed to delete production slot" });
  }
});

export const productionSlotsRouter = router;
