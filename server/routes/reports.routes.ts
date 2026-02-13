import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/reports", requireAuth, async (req, res) => {
  try {
    const period = req.query.period as string || "week";
    const reports = await storage.getReports(period, req.companyId);
    res.json(reports);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load reports" });
  }
});

export const reportsRouter = router;
