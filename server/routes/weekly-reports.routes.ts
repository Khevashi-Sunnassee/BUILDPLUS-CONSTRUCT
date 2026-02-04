import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import { insertWeeklyWageReportSchema } from "@shared/schema";
import logger from "../lib/logger";

const router = Router();

router.get("/api/weekly-wage-reports", requireAuth, requirePermission("weekly_wages"), async (req, res) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const reports = await storage.getWeeklyWageReports(startDate, endDate);
    res.json(reports);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching weekly wage reports");
    res.status(500).json({ error: error.message || "Failed to fetch weekly wage reports" });
  }
});

router.get("/api/weekly-wage-reports/:id", requireAuth, requirePermission("weekly_wages"), async (req, res) => {
  try {
    const report = await storage.getWeeklyWageReport(String(req.params.id));
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching weekly wage report");
    res.status(500).json({ error: error.message || "Failed to fetch weekly wage report" });
  }
});

router.post("/api/weekly-wage-reports", requireAuth, requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const parseResult = insertWeeklyWageReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request data" });
    }
    
    const { weekStartDate, weekEndDate, factory } = parseResult.data;
    
    const existing = await storage.getWeeklyWageReportByWeek(weekStartDate, weekEndDate, factory || "");
    if (existing) {
      return res.status(400).json({ error: "Weekly wage report already exists for this week and factory" });
    }
    
    const report = await storage.createWeeklyWageReport({
      ...parseResult.data,
      createdById: req.session.userId!,
    });
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating weekly wage report");
    res.status(500).json({ error: error.message || "Failed to create weekly wage report" });
  }
});

router.put("/api/weekly-wage-reports/:id", requireAuth, requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const parseResult = insertWeeklyWageReportSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request data" });
    }
    
    const report = await storage.updateWeeklyWageReport(String(req.params.id), parseResult.data);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating weekly wage report");
    res.status(500).json({ error: error.message || "Failed to update weekly wage report" });
  }
});

router.delete("/api/weekly-wage-reports/:id", requireRole("ADMIN", "MANAGER"), requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteWeeklyWageReport(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting weekly wage report");
    res.status(500).json({ error: error.message || "Failed to delete weekly wage report" });
  }
});

router.get("/api/weekly-wage-reports/:id/analysis", requireAuth, async (req, res) => {
  try {
    const report = await storage.getWeeklyWageReport(String(req.params.id));
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    const entries = await storage.getProductionEntriesInRange(report.weekStartDate, report.weekEndDate);
    const factoryEntries = entries.filter(e => e.factory === report.factory);
    
    const allPanelTypes = await storage.getAllPanelTypes();
    const panelTypesMap = new Map(allPanelTypes.map(pt => [pt.code, pt]));
    
    let totalRevenue = 0;
    let expectedProductionWages = 0;
    let expectedDraftingWages = 0;
    
    for (const entry of factoryEntries) {
      const panelType = panelTypesMap.get(entry.panel?.panelType || "");
      if (!panelType) continue;
      
      const volume = parseFloat(entry.volumeM3 || "0");
      const area = parseFloat(entry.areaM2 || "0");
      const sellRateM3 = parseFloat(panelType.sellRatePerM3 || "0");
      const sellRateM2 = parseFloat(panelType.sellRatePerM2 || "0");
      const entryRevenue = (volume * sellRateM3) + (area * sellRateM2);
      totalRevenue += entryRevenue;
      
      const costComponents = await storage.getCostComponentsByPanelType(panelType.id);
      for (const component of costComponents) {
        const percentage = parseFloat(component.percentageOfRevenue) / 100;
        const cost = entryRevenue * percentage;
        
        const componentName = component.name.toLowerCase();
        if (componentName.includes("labour") || componentName.includes("production")) {
          expectedProductionWages += cost;
        }
        if (componentName.includes("drafting")) {
          expectedDraftingWages += cost;
        }
      }
    }
    
    const actualProductionWages = parseFloat(report.productionWages || "0");
    const actualOfficeWages = parseFloat(report.officeWages || "0");
    const actualEstimatingWages = parseFloat(report.estimatingWages || "0");
    const actualOnsiteWages = parseFloat(report.onsiteWages || "0");
    const actualDraftingWages = parseFloat(report.draftingWages || "0");
    const actualCivilWages = parseFloat(report.civilWages || "0");
    const totalActualWages = actualProductionWages + actualOfficeWages + actualEstimatingWages + 
                             actualOnsiteWages + actualDraftingWages + actualCivilWages;
    
    res.json({
      report,
      analysis: {
        weekStartDate: report.weekStartDate,
        weekEndDate: report.weekEndDate,
        factory: report.factory,
        productionEntryCount: factoryEntries.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        actualWages: {
          production: actualProductionWages,
          office: actualOfficeWages,
          estimating: actualEstimatingWages,
          onsite: actualOnsiteWages,
          drafting: actualDraftingWages,
          civil: actualCivilWages,
          total: totalActualWages,
        },
        estimatedWages: {
          production: Math.round(expectedProductionWages * 100) / 100,
          drafting: Math.round(expectedDraftingWages * 100) / 100,
        },
        variance: {
          production: Math.round((actualProductionWages - expectedProductionWages) * 100) / 100,
          productionPercentage: expectedProductionWages > 0 
            ? Math.round(((actualProductionWages - expectedProductionWages) / expectedProductionWages) * 100 * 10) / 10 
            : 0,
          drafting: Math.round((actualDraftingWages - expectedDraftingWages) * 100) / 100,
          draftingPercentage: expectedDraftingWages > 0 
            ? Math.round(((actualDraftingWages - expectedDraftingWages) / expectedDraftingWages) * 100 * 10) / 10 
            : 0,
        },
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error generating wage analysis");
    res.status(500).json({ error: error.message || "Failed to generate wage analysis" });
  }
});

router.get("/api/weekly-job-reports", requireAuth, requirePermission("weekly_job_logs"), async (req, res) => {
  try {
    const projectManagerId = req.query.projectManagerId as string | undefined;
    const reports = await storage.getWeeklyJobReports(projectManagerId);
    res.json(reports);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching weekly job reports");
    res.status(500).json({ error: error.message || "Failed to fetch weekly job reports" });
  }
});

router.get("/api/weekly-job-reports/my-reports", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const reports = await storage.getWeeklyJobReports(userId);
    res.json(reports);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching my weekly job reports");
    res.status(500).json({ error: error.message || "Failed to fetch weekly job reports" });
  }
});

router.get("/api/weekly-job-reports/pending-approval", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const reports = await storage.getWeeklyJobReportsByStatus("SUBMITTED");
    res.json(reports);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching pending approval reports");
    res.status(500).json({ error: error.message || "Failed to fetch pending reports" });
  }
});

router.get("/api/weekly-job-reports/approved", requireAuth, async (req, res) => {
  try {
    const reports = await storage.getApprovedWeeklyJobReports();
    res.json(reports);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching approved reports");
    res.status(500).json({ error: error.message || "Failed to fetch approved reports" });
  }
});

router.get("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
  try {
    const report = await storage.getWeeklyJobReport(String(req.params.id));
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching weekly job report");
    res.status(500).json({ error: error.message || "Failed to fetch report" });
  }
});

router.post("/api/weekly-job-reports", requireAuth, async (req, res) => {
  try {
    const { schedules, ...reportData } = req.body;
    const userId = req.session.userId!;
    
    const report = await storage.createWeeklyJobReport(
      { ...reportData, projectManagerId: userId },
      schedules || []
    );
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating weekly job report");
    res.status(500).json({ error: error.message || "Failed to create report" });
  }
});

router.put("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
  try {
    const { schedules, ...reportData } = req.body;
    const report = await storage.updateWeeklyJobReport(String(req.params.id), reportData, schedules);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating weekly job report");
    res.status(500).json({ error: error.message || "Failed to update report" });
  }
});

router.post("/api/weekly-job-reports/:id/submit", requireAuth, async (req, res) => {
  try {
    const report = await storage.submitWeeklyJobReport(String(req.params.id));
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error submitting weekly job report");
    res.status(500).json({ error: error.message || "Failed to submit report" });
  }
});

router.post("/api/weekly-job-reports/:id/approve", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const approvedById = req.session.userId!;
    const report = await storage.approveWeeklyJobReport(String(req.params.id), approvedById);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error approving weekly job report");
    res.status(500).json({ error: error.message || "Failed to approve report" });
  }
});

router.post("/api/weekly-job-reports/:id/reject", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const approvedById = req.session.userId!;
    const { rejectionReason } = req.body;
    const report = await storage.rejectWeeklyJobReport(String(req.params.id), approvedById, rejectionReason || "No reason provided");
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error: any) {
    logger.error({ err: error }, "Error rejecting weekly job report");
    res.status(500).json({ error: error.message || "Failed to reject report" });
  }
});

router.delete("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteWeeklyJobReport(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting weekly job report");
    res.status(500).json({ error: error.message || "Failed to delete report" });
  }
});

export const weeklyReportsRouter = router;
