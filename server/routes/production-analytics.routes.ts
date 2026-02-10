import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/reports/production-daily", requireAuth, async (req, res) => {
  try {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate required" });
  }
  
  const entries = await storage.getProductionEntriesInRange(startDate, endDate);
  const allPanelTypes = await storage.getAllPanelTypes();
  const panelTypesByCode = new Map(allPanelTypes.map(pt => [pt.code, pt]));
  
  const normalizePanelType = (code: string | null): string => {
    if (!code) return "OTHER";
    if (panelTypesByCode.has(code)) return code;
    for (const [configuredCode] of Array.from(panelTypesByCode)) {
      if (configuredCode.toLowerCase() === code.toLowerCase()) return configuredCode;
    }
    return code;
  };
  
  const dailyData = new Map<string, {
    date: string;
    panelCount: number;
    volumeM3: number;
    areaM2: number;
    byPanelType: Map<string, { count: number; volumeM3: number; areaM2: number }>;
  }>();
  
  for (const entry of entries) {
    const date = entry.productionDate;
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        date,
        panelCount: 0,
        volumeM3: 0,
        areaM2: 0,
        byPanelType: new Map(),
      });
    }
    const day = dailyData.get(date)!;
    day.panelCount += 1;
    day.volumeM3 += parseFloat(entry.volumeM3 || "0");
    day.areaM2 += parseFloat(entry.areaM2 || "0");
    
    const panelType = normalizePanelType(entry.panel.panelType);
    if (!day.byPanelType.has(panelType)) {
      day.byPanelType.set(panelType, { count: 0, volumeM3: 0, areaM2: 0 });
    }
    const typeData = day.byPanelType.get(panelType)!;
    typeData.count += 1;
    typeData.volumeM3 += parseFloat(entry.volumeM3 || "0");
    typeData.areaM2 += parseFloat(entry.areaM2 || "0");
  }
  
  const result = Array.from(dailyData.values())
    .map(d => ({
      ...d,
      volumeM3: Math.round(d.volumeM3 * 100) / 100,
      areaM2: Math.round(d.areaM2 * 100) / 100,
      byPanelType: Object.fromEntries(
        Array.from(d.byPanelType.entries()).map(([k, v]) => [
          k,
          {
            ...v,
            volumeM3: Math.round(v.volumeM3 * 100) / 100,
            areaM2: Math.round(v.areaM2 * 100) / 100,
          },
        ])
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const totals = {
    panelCount: result.reduce((sum, d) => sum + d.panelCount, 0),
    volumeM3: Math.round(result.reduce((sum, d) => sum + d.volumeM3, 0) * 100) / 100,
    areaM2: Math.round(result.reduce((sum, d) => sum + d.areaM2, 0) * 100) / 100,
  };
  
  const panelTypesUsed = Array.from(new Set(entries.map(e => normalizePanelType(e.panel.panelType))));
  
  res.json({
    dailyData: result,
    totals,
    panelTypes: panelTypesUsed,
    period: { startDate, endDate },
  });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate production report" });
  }
});

router.get("/api/reports/production-with-costs", requireAuth, async (req, res) => {
  try {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate required" });
  }
  
  const entries = await storage.getProductionEntriesInRange(startDate, endDate);
  const allPanelTypes = await storage.getAllPanelTypes();
  const panelTypesByCode = new Map(allPanelTypes.map(pt => [pt.code, pt]));
  
  const normalizePanelType = (code: string | null): string => {
    if (!code) return "OTHER";
    if (panelTypesByCode.has(code)) return code;
    for (const [configuredCode] of Array.from(panelTypesByCode)) {
      if (configuredCode.toLowerCase() === code.toLowerCase()) return configuredCode;
    }
    return code;
  };
  
  const jobRatesCache = new Map<string, Map<string, any>>();
  
  const getRatesForEntry = async (jobId: string, panelTypeCode: string) => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    if (!jobRatesCache.has(jobId)) {
      const rates = await storage.getJobPanelRates(jobId);
      jobRatesCache.set(jobId, new Map(rates.map(r => [r.panelType.code, r])));
    }
    
    const jobRates = jobRatesCache.get(jobId);
    const jobRate = jobRates?.get(normalizedCode);
    const defaultRate = panelTypesByCode.get(normalizedCode);
    
    return {
      labourCostPerM2: jobRate?.labourCostPerM2 || defaultRate?.labourCostPerM2 || "0",
      labourCostPerM3: jobRate?.labourCostPerM3 || defaultRate?.labourCostPerM3 || "0",
      supplyCostPerM2: jobRate?.supplyCostPerM2 || defaultRate?.supplyCostPerM2 || "0",
      supplyCostPerM3: jobRate?.supplyCostPerM3 || defaultRate?.supplyCostPerM3 || "0",
      sellRatePerM2: jobRate?.sellRatePerM2 || defaultRate?.sellRatePerM2 || "0",
      sellRatePerM3: jobRate?.sellRatePerM3 || defaultRate?.sellRatePerM3 || "0",
    };
  };
  
  const dailyData = new Map<string, {
    date: string;
    panelCount: number;
    volumeM3: number;
    areaM2: number;
    labourCost: number;
    supplyCost: number;
    totalCost: number;
    revenue: number;
    profit: number;
    byPanelType: Map<string, { count: number; volumeM3: number; areaM2: number; cost: number; revenue: number }>;
  }>();
  
  for (const entry of entries) {
    const date = entry.productionDate;
    const panelType = normalizePanelType(entry.panel.panelType);
    const rates = await getRatesForEntry(entry.jobId, panelType);
    
    const volumeM3 = parseFloat(entry.volumeM3 || "0");
    const areaM2 = parseFloat(entry.areaM2 || "0");
    
    const labourCost = (volumeM3 * parseFloat(rates.labourCostPerM3)) + (areaM2 * parseFloat(rates.labourCostPerM2));
    const supplyCost = (volumeM3 * parseFloat(rates.supplyCostPerM3)) + (areaM2 * parseFloat(rates.supplyCostPerM2));
    const totalCost = labourCost + supplyCost;
    const revenue = (volumeM3 * parseFloat(rates.sellRatePerM3)) + (areaM2 * parseFloat(rates.sellRatePerM2));
    const profit = revenue - totalCost;
    
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        date,
        panelCount: 0,
        volumeM3: 0,
        areaM2: 0,
        labourCost: 0,
        supplyCost: 0,
        totalCost: 0,
        revenue: 0,
        profit: 0,
        byPanelType: new Map(),
      });
    }
    const day = dailyData.get(date)!;
    day.panelCount += 1;
    day.volumeM3 += volumeM3;
    day.areaM2 += areaM2;
    day.labourCost += labourCost;
    day.supplyCost += supplyCost;
    day.totalCost += totalCost;
    day.revenue += revenue;
    day.profit += profit;
    
    if (!day.byPanelType.has(panelType)) {
      day.byPanelType.set(panelType, { count: 0, volumeM3: 0, areaM2: 0, cost: 0, revenue: 0 });
    }
    const typeData = day.byPanelType.get(panelType)!;
    typeData.count += 1;
    typeData.volumeM3 += volumeM3;
    typeData.areaM2 += areaM2;
    typeData.cost += totalCost;
    typeData.revenue += revenue;
  }
  
  const result = Array.from(dailyData.values())
    .map(d => ({
      date: d.date,
      panelCount: d.panelCount,
      volumeM3: Math.round(d.volumeM3 * 100) / 100,
      areaM2: Math.round(d.areaM2 * 100) / 100,
      labourCost: Math.round(d.labourCost * 100) / 100,
      supplyCost: Math.round(d.supplyCost * 100) / 100,
      totalCost: Math.round(d.totalCost * 100) / 100,
      revenue: Math.round(d.revenue * 100) / 100,
      profit: Math.round(d.profit * 100) / 100,
      byPanelType: Object.fromEntries(
        Array.from(d.byPanelType.entries()).map(([k, v]) => [
          k,
          {
            ...v,
            volumeM3: Math.round(v.volumeM3 * 100) / 100,
            areaM2: Math.round(v.areaM2 * 100) / 100,
            cost: Math.round(v.cost * 100) / 100,
            revenue: Math.round(v.revenue * 100) / 100,
          },
        ])
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const totals = {
    panelCount: result.reduce((sum, d) => sum + d.panelCount, 0),
    volumeM3: Math.round(result.reduce((sum, d) => sum + d.volumeM3, 0) * 100) / 100,
    areaM2: Math.round(result.reduce((sum, d) => sum + d.areaM2, 0) * 100) / 100,
    labourCost: Math.round(result.reduce((sum, d) => sum + d.labourCost, 0) * 100) / 100,
    supplyCost: Math.round(result.reduce((sum, d) => sum + d.supplyCost, 0) * 100) / 100,
    totalCost: Math.round(result.reduce((sum, d) => sum + d.totalCost, 0) * 100) / 100,
    revenue: Math.round(result.reduce((sum, d) => sum + d.revenue, 0) * 100) / 100,
    profit: Math.round(result.reduce((sum, d) => sum + d.profit, 0) * 100) / 100,
  };
  
  const panelTypesUsed = Array.from(new Set(entries.map(e => normalizePanelType(e.panel.panelType))));
  
  res.json({
    dailyData: result,
    totals,
    panelTypes: panelTypesUsed,
    period: { startDate, endDate },
  });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate production cost report" });
  }
});

export const productionAnalyticsRouter = router;
