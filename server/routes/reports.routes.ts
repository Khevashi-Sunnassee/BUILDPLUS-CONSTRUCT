import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/reports", requireAuth, async (req, res) => {
  const period = req.query.period as string || "week";
  const reports = await storage.getReports(period);
  res.json(reports);
});

export const reportsRouter = router;
