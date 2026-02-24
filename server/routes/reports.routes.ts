import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

router.get("/api/reports", requireAuth, async (req, res) => {
  try {
    const period = req.query.period as string || "week";
    const reports = await storage.getReports(period, req.companyId);
    res.json(reports);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching reports");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export const reportsRouter = router;
