import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { format, subDays } from "date-fns";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { z } from "zod";

const createProductionDaySchema = z.object({
  productionDate: z.string(),
  factory: z.string(),
  notes: z.string().nullable().optional(),
});

const router = Router();

router.get("/api/production-summary", requireAuth, async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Date required" });
  const summary = await storage.getProductionSummaryByDate(date, req.companyId);
  res.json(summary);
});

router.get("/api/production-summary-with-costs", requireAuth, async (req: Request, res: Response) => {
  const date = req.query.date as string;
  const factoryFilter = req.query.factory as string | undefined;
  if (!date) return res.status(400).json({ error: "Date required" });
  
  const entries = factoryFilter 
    ? await storage.getProductionEntriesByDateAndFactory(date, factoryFilter, req.companyId)
    : await storage.getProductionEntriesByDate(date, req.companyId);
  const allPanelTypes = await storage.getAllPanelTypes(req.companyId);
  const panelTypesByCode = new Map(allPanelTypes.map(pt => [pt.code, pt]));
  
  const jobRatesCache = new Map<string, Map<string, any>>();
  
  const getRatesForEntry = async (jobId: string, panelTypeCode: string) => {
    if (!jobRatesCache.has(jobId)) {
      const rates = await storage.getJobPanelRates(jobId);
      jobRatesCache.set(jobId, new Map(rates.map(r => [r.panelType.code, r])));
    }
    
    const jobRates = jobRatesCache.get(jobId);
    const jobRate = jobRates?.get(panelTypeCode);
    const defaultRate = panelTypesByCode.get(panelTypeCode);
    
    return {
      labourCostPerM2: jobRate?.labourCostPerM2 || defaultRate?.labourCostPerM2 || "0",
      labourCostPerM3: jobRate?.labourCostPerM3 || defaultRate?.labourCostPerM3 || "0",
      supplyCostPerM2: jobRate?.supplyCostPerM2 || defaultRate?.supplyCostPerM2 || "0",
      supplyCostPerM3: jobRate?.supplyCostPerM3 || defaultRate?.supplyCostPerM3 || "0",
      totalRatePerM2: jobRate?.totalRatePerM2 || defaultRate?.totalRatePerM2 || "0",
      totalRatePerM3: jobRate?.totalRatePerM3 || defaultRate?.totalRatePerM3 || "0",
      sellRatePerM2: jobRate?.sellRatePerM2 || defaultRate?.sellRatePerM2 || "0",
      sellRatePerM3: jobRate?.sellRatePerM3 || defaultRate?.sellRatePerM3 || "0",
    };
  };
  
  const entriesWithCosts = await Promise.all(entries.map(async (entry) => {
    const panelTypeCode = entry.panel.panelType || "OTHER";
    const rates = await getRatesForEntry(entry.jobId, panelTypeCode);
    
    const volumeM3 = parseFloat(entry.volumeM3 || "0");
    const areaM2 = parseFloat(entry.areaM2 || "0");
    
    const labourCost = (volumeM3 * parseFloat(rates.labourCostPerM3)) + (areaM2 * parseFloat(rates.labourCostPerM2));
    const supplyCost = (volumeM3 * parseFloat(rates.supplyCostPerM3)) + (areaM2 * parseFloat(rates.supplyCostPerM2));
    const totalCost = labourCost + supplyCost;
    const revenue = (volumeM3 * parseFloat(rates.sellRatePerM3)) + (areaM2 * parseFloat(rates.sellRatePerM2));
    const profit = revenue - totalCost;
    
    return {
      ...entry,
      rates,
      labourCost: Math.round(labourCost * 100) / 100,
      supplyCost: Math.round(supplyCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
    };
  }));
  
  const totals = entriesWithCosts.reduce((acc, e) => ({
    labourCost: acc.labourCost + e.labourCost,
    supplyCost: acc.supplyCost + e.supplyCost,
    totalCost: acc.totalCost + e.totalCost,
    revenue: acc.revenue + e.revenue,
    profit: acc.profit + e.profit,
    volumeM3: acc.volumeM3 + parseFloat(e.volumeM3 || "0"),
    areaM2: acc.areaM2 + parseFloat(e.areaM2 || "0"),
  }), { labourCost: 0, supplyCost: 0, totalCost: 0, revenue: 0, profit: 0, volumeM3: 0, areaM2: 0 });
  
  res.json({
    entries: entriesWithCosts,
    totals: {
      labourCost: Math.round(totals.labourCost * 100) / 100,
      supplyCost: Math.round(totals.supplyCost * 100) / 100,
      totalCost: Math.round(totals.totalCost * 100) / 100,
      revenue: Math.round(totals.revenue * 100) / 100,
      profit: Math.round(totals.profit * 100) / 100,
      volumeM3: Math.round(totals.volumeM3 * 100) / 100,
      areaM2: Math.round(totals.areaM2 * 100) / 100,
      panelCount: entriesWithCosts.length,
    },
  });
});

router.get("/api/production-reports", requireAuth, async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const end = endDate ? String(endDate) : format(new Date(), "yyyy-MM-dd");
  const start = startDate ? String(startDate) : format(subDays(new Date(), 30), "yyyy-MM-dd");
  
  const productionDaysData = await storage.getProductionDays(start, end, req.companyId);
  
  const entries = await storage.getProductionEntriesInRange(start, end, req.companyId);
  
  const reportsByKey = new Map<string, {
    date: string;
    factory: string;
    entryCount: number;
    panelCount: number;
    totalVolumeM3: number;
    totalAreaM2: number;
    jobIds: Set<string>;
    draftCount: number;
    completedCount: number;
  }>();
  
  for (const day of productionDaysData) {
    const key = `${day.productionDate}-${day.factory}`;
    if (!reportsByKey.has(key)) {
      reportsByKey.set(key, {
        date: day.productionDate,
        factory: day.factory,
        entryCount: 0,
        panelCount: 0,
        totalVolumeM3: 0,
        totalAreaM2: 0,
        jobIds: new Set(),
        draftCount: 0,
        completedCount: 0,
      });
    }
  }
  
  for (const entry of entries) {
    const date = entry.productionDate;
    const factory = (entry as Record<string, unknown>).factory as string || "QLD";
    const key = `${date}-${factory}`;
    
    if (!reportsByKey.has(key)) {
      reportsByKey.set(key, {
        date,
        factory,
        entryCount: 0,
        panelCount: 0,
        totalVolumeM3: 0,
        totalAreaM2: 0,
        jobIds: new Set(),
        draftCount: 0,
        completedCount: 0,
      });
    }
    
    const report = reportsByKey.get(key)!;
    report.entryCount++;
    report.panelCount++;
    report.totalVolumeM3 += parseFloat(entry.volumeM3 || "0");
    report.totalAreaM2 += parseFloat(entry.areaM2 || "0");
    report.jobIds.add(entry.jobId);
    
    const status = (entry as Record<string, unknown>).status as string || "PENDING";
    if (status === "COMPLETED") {
      report.completedCount++;
    } else {
      report.draftCount++;
    }
  }
  
  const reports = Array.from(reportsByKey.values())
    .map(r => ({
      ...r,
      jobCount: r.jobIds.size,
      jobIds: undefined,
    }))
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.factory.localeCompare(b.factory);
    });
  
  res.json(reports);
});

router.get("/api/production-days", requireAuth, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const productionDaysData = await storage.getProductionDays(startDate, endDate, req.companyId);
    res.json(productionDaysData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching production days");
    res.status(500).json({ error: "Failed to fetch production days" });
  }
});

router.post("/api/production-days", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = createProductionDaySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { productionDate, factory, notes } = result.data;
    
    if (!productionDate || !factory) {
      return res.status(400).json({ error: "Date and factory are required" });
    }
    
    const existing = await storage.getProductionDay(productionDate, factory, req.companyId);
    if (existing) {
      return res.status(400).json({ error: "Production day already exists for this date and factory" });
    }
    
    const day = await storage.createProductionDay({
      productionDate,
      factory,
      notes,
      createdById: req.session.userId!,
    });
    
    res.json(day);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create production day" });
  }
});

router.delete("/api/production-days/:date", requireRole("MANAGER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const date = String(req.params.date);
    const factory = String(req.query.factory || "QLD");
    await storage.deleteProductionDayByDateAndFactory(date, factory, req.companyId);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting production day");
    res.status(500).json({ error: "Failed to delete production day" });
  }
});

export const productionRouter = router;
