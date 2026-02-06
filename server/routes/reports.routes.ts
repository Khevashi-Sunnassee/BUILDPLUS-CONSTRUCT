import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/reports", requireAuth, async (req, res) => {
  try {
    const period = req.query.period as string || "week";
    const reports = await storage.getReports(period);
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load reports" });
  }
});

export const reportsRouter = router;
