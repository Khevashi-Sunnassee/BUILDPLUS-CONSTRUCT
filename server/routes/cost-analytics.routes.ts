import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/reports/cost-analysis", requireAuth, async (req, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const jobId = req.query.jobId as string | undefined;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate required" });
  }
  
  const entries = await storage.getProductionEntriesInRange(startDate, endDate);
  const filteredEntries = jobId ? entries.filter(e => e.jobId === jobId) : entries;
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
  
  const jobCostOverridesCache = new Map<string, any[]>();
  const panelTypeCostComponentsCache = new Map<string, any[]>();
  const jobRatesCache = new Map<string, Map<string, any>>();
  
  const getCostComponents = async (jobId: string, panelTypeCode: string) => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    const panelType = panelTypesByCode.get(normalizedCode);
    if (!panelType) return [];
    
    if (!jobCostOverridesCache.has(jobId)) {
      jobCostOverridesCache.set(jobId, await storage.getJobCostOverrides(jobId));
    }
    const overrides = jobCostOverridesCache.get(jobId)!;
    const jobOverrides = overrides.filter(o => o.panelTypeId === panelType.id);
    
    if (jobOverrides.length > 0) {
      return jobOverrides.map(o => ({
        name: o.componentName,
        percentage: parseFloat(o.revisedPercentage || o.defaultPercentage),
        isRevised: !!o.revisedPercentage,
      }));
    }
    
    if (!panelTypeCostComponentsCache.has(panelType.id)) {
      panelTypeCostComponentsCache.set(panelType.id, await storage.getCostComponentsByPanelType(panelType.id));
    }
    const components = panelTypeCostComponentsCache.get(panelType.id)!;
    return components.map(c => ({
      name: c.name,
      percentage: parseFloat(c.percentageOfRevenue),
      isRevised: false,
    }));
  };
  
  const getRates = async (jobId: string, panelTypeCode: string) => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    if (!jobRatesCache.has(jobId)) {
      const rates = await storage.getJobPanelRates(jobId);
      jobRatesCache.set(jobId, new Map(rates.map(r => [r.panelType.code, r])));
    }
    const jobRates = jobRatesCache.get(jobId);
    const jobRate = jobRates?.get(normalizedCode);
    const defaultRate = panelTypesByCode.get(normalizedCode);
    
    return {
      sellRatePerM2: parseFloat(jobRate?.sellRatePerM2 || defaultRate?.sellRatePerM2 || "0"),
      sellRatePerM3: parseFloat(jobRate?.sellRatePerM3 || defaultRate?.sellRatePerM3 || "0"),
    };
  };
  
  const componentTotals = new Map<string, { name: string; expectedCost: number; count: number }>();
  let totalRevenue = 0;
  
  for (const entry of filteredEntries) {
    const panelType = normalizePanelType(entry.panel.panelType);
    const rates = await getRates(entry.jobId, panelType);
    const components = await getCostComponents(entry.jobId, panelType);
    
    const volumeM3 = parseFloat(entry.volumeM3 || "0");
    const areaM2 = parseFloat(entry.areaM2 || "0");
    const revenue = (volumeM3 * rates.sellRatePerM3) + (areaM2 * rates.sellRatePerM2);
    totalRevenue += revenue;
    
    for (const comp of components) {
      const expectedCost = revenue * (comp.percentage / 100);
      if (!componentTotals.has(comp.name)) {
        componentTotals.set(comp.name, { name: comp.name, expectedCost: 0, count: 0 });
      }
      const ct = componentTotals.get(comp.name)!;
      ct.expectedCost += expectedCost;
      ct.count += 1;
    }
  }
  
  const componentBreakdown = Array.from(componentTotals.values())
    .map(c => ({
      name: c.name,
      expectedCost: Math.round(c.expectedCost * 100) / 100,
      percentageOfRevenue: totalRevenue > 0 ? Math.round((c.expectedCost / totalRevenue) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.expectedCost - a.expectedCost);
  
  const totalExpectedCost = componentBreakdown.reduce((sum, c) => sum + c.expectedCost, 0);
  
  res.json({
    period: { startDate, endDate },
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpectedCost: Math.round(totalExpectedCost * 100) / 100,
    expectedProfit: Math.round((totalRevenue - totalExpectedCost) * 100) / 100,
    profitMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalExpectedCost) / totalRevenue) * 100 * 10) / 10 : 0,
    componentBreakdown,
    entryCount: filteredEntries.length,
  });
});

router.get("/api/reports/cost-analysis-daily", requireAuth, async (req, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const componentFilter = req.query.component as string | undefined;
  
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
  
  const jobCostOverridesCache = new Map<string, any[]>();
  const panelTypeCostComponentsCache = new Map<string, any[]>();
  const jobRatesCache = new Map<string, Map<string, any>>();
  
  const getCostComponents = async (jobId: string, panelTypeCode: string) => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    const panelType = panelTypesByCode.get(normalizedCode);
    if (!panelType) return [];
    
    if (!jobCostOverridesCache.has(jobId)) {
      jobCostOverridesCache.set(jobId, await storage.getJobCostOverrides(jobId));
    }
    const overrides = jobCostOverridesCache.get(jobId)!;
    const jobOverrides = overrides.filter(o => o.panelTypeId === panelType.id);
    
    if (jobOverrides.length > 0) {
      return jobOverrides.map(o => ({
        name: o.componentName,
        percentage: parseFloat(o.revisedPercentage || o.defaultPercentage),
      }));
    }
    
    if (!panelTypeCostComponentsCache.has(panelType.id)) {
      panelTypeCostComponentsCache.set(panelType.id, await storage.getCostComponentsByPanelType(panelType.id));
    }
    const components = panelTypeCostComponentsCache.get(panelType.id)!;
    return components.map(c => ({
      name: c.name,
      percentage: parseFloat(c.percentageOfRevenue),
    }));
  };
  
  const getRates = async (jobId: string, panelTypeCode: string) => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    if (!jobRatesCache.has(jobId)) {
      const rates = await storage.getJobPanelRates(jobId);
      jobRatesCache.set(jobId, new Map(rates.map(r => [r.panelType.code, r])));
    }
    const jobRates = jobRatesCache.get(jobId);
    const jobRate = jobRates?.get(normalizedCode);
    const defaultRate = panelTypesByCode.get(normalizedCode);
    
    return {
      sellRatePerM2: parseFloat(jobRate?.sellRatePerM2 || defaultRate?.sellRatePerM2 || "0"),
      sellRatePerM3: parseFloat(jobRate?.sellRatePerM3 || defaultRate?.sellRatePerM3 || "0"),
    };
  };
  
  const allComponentNames = new Set<string>();
  const dailyData = new Map<string, { 
    date: string; 
    revenue: number; 
    byComponent: Map<string, number>;
    entryCount: number;
  }>();
  
  for (const entry of entries) {
    const date = entry.productionDate;
    const panelType = normalizePanelType(entry.panel.panelType);
    const rates = await getRates(entry.jobId, panelType);
    const components = await getCostComponents(entry.jobId, panelType);
    
    const volumeM3 = parseFloat(entry.volumeM3 || "0");
    const areaM2 = parseFloat(entry.areaM2 || "0");
    const revenue = (volumeM3 * rates.sellRatePerM3) + (areaM2 * rates.sellRatePerM2);
    
    if (!dailyData.has(date)) {
      dailyData.set(date, { date, revenue: 0, byComponent: new Map(), entryCount: 0 });
    }
    const day = dailyData.get(date)!;
    day.revenue += revenue;
    day.entryCount += 1;
    
    for (const comp of components) {
      allComponentNames.add(comp.name);
      const expectedCost = revenue * (comp.percentage / 100);
      day.byComponent.set(comp.name, (day.byComponent.get(comp.name) || 0) + expectedCost);
    }
  }
  
  const componentNames = Array.from(allComponentNames).sort();
  const result = Array.from(dailyData.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => {
      const components: Record<string, number> = {};
      let totalCost = 0;
      for (const name of componentNames) {
        const cost = Math.round((d.byComponent.get(name) || 0) * 100) / 100;
        components[name] = cost;
        totalCost += cost;
      }
      return {
        date: d.date,
        revenue: Math.round(d.revenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        profit: Math.round((d.revenue - totalCost) * 100) / 100,
        entryCount: d.entryCount,
        ...components,
      };
    });
  
  const totals = {
    revenue: Math.round(result.reduce((s, d) => s + d.revenue, 0) * 100) / 100,
    totalCost: Math.round(result.reduce((s, d) => s + d.totalCost, 0) * 100) / 100,
    profit: Math.round(result.reduce((s, d) => s + d.profit, 0) * 100) / 100,
    entryCount: result.reduce((s, d) => s + d.entryCount, 0),
    byComponent: componentNames.reduce((acc, name) => {
      acc[name] = Math.round(result.reduce((s, d) => s + ((d as any)[name] || 0), 0) * 100) / 100;
      return acc;
    }, {} as Record<string, number>),
  };
  
  res.json({
    period: { startDate, endDate },
    dailyData: result,
    componentNames,
    totals,
    selectedComponent: componentFilter || null,
  });
});

router.get("/api/reports/labour-cost-analysis", requireAuth, async (req, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const factory = req.query.factory as string | undefined;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate required" });
  }
  
  const entries = await storage.getProductionEntriesInRange(startDate, endDate);
  const filteredEntries = factory && factory !== "all" 
    ? entries.filter(e => e.factory === factory) 
    : entries;
  
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
  
  const panelTypeCostComponentsCache = new Map<string, any[]>();
  const jobCostOverridesCache = new Map<string, any[]>();
  const jobRatesCache = new Map<string, Map<string, any>>();
  
  const getLabourPercentage = async (jobId: string, panelTypeCode: string): Promise<number> => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    const panelType = panelTypesByCode.get(normalizedCode);
    if (!panelType) return 0;
    
    if (!jobCostOverridesCache.has(jobId)) {
      jobCostOverridesCache.set(jobId, await storage.getJobCostOverrides(jobId));
    }
    const overrides = jobCostOverridesCache.get(jobId)!;
    const jobOverrides = overrides.filter(o => o.panelTypeId === panelType.id);
    
    if (jobOverrides.length > 0) {
      const labourOverride = jobOverrides.find(o => 
        o.componentName.toLowerCase().includes('labour') || 
        o.componentName.toLowerCase().includes('labor')
      );
      if (labourOverride) {
        return parseFloat(labourOverride.revisedPercentage || labourOverride.defaultPercentage || "0");
      }
    }
    
    if (!panelTypeCostComponentsCache.has(panelType.id)) {
      panelTypeCostComponentsCache.set(panelType.id, await storage.getCostComponentsByPanelType(panelType.id));
    }
    const components = panelTypeCostComponentsCache.get(panelType.id)!;
    const labourComponent = components.find(c => 
      c.name.toLowerCase().includes('labour') || 
      c.name.toLowerCase().includes('labor')
    );
    
    return labourComponent ? parseFloat(labourComponent.percentageOfRevenue) : 0;
  };
  
  const getRates = async (jobId: string, panelTypeCode: string) => {
    const normalizedCode = normalizePanelType(panelTypeCode);
    if (!jobRatesCache.has(jobId)) {
      const rates = await storage.getJobPanelRates(jobId);
      jobRatesCache.set(jobId, new Map(rates.map(r => [r.panelType.code, r])));
    }
    const jobRates = jobRatesCache.get(jobId);
    const jobRate = jobRates?.get(normalizedCode);
    const defaultRate = panelTypesByCode.get(normalizedCode);
    
    return {
      sellRatePerM2: parseFloat(jobRate?.sellRatePerM2 || defaultRate?.sellRatePerM2 || "0"),
      sellRatePerM3: parseFloat(jobRate?.sellRatePerM3 || defaultRate?.sellRatePerM3 || "0"),
    };
  };
  
  const dailyData = new Map<string, { 
    date: string; 
    revenue: number; 
    estimatedLabour: number;
    panelCount: number;
  }>();
  
  for (const entry of filteredEntries) {
    const date = entry.productionDate;
    const panelType = normalizePanelType(entry.panel.panelType);
    const rates = await getRates(entry.jobId, panelType);
    const labourPercent = await getLabourPercentage(entry.jobId, panelType);
    
    const volumeM3 = parseFloat(entry.volumeM3 || "0");
    const areaM2 = parseFloat(entry.areaM2 || "0");
    const revenue = (volumeM3 * rates.sellRatePerM3) + (areaM2 * rates.sellRatePerM2);
    const estimatedLabour = revenue * (labourPercent / 100);
    
    if (!dailyData.has(date)) {
      dailyData.set(date, { date, revenue: 0, estimatedLabour: 0, panelCount: 0 });
    }
    const day = dailyData.get(date)!;
    day.revenue += revenue;
    day.estimatedLabour += estimatedLabour;
    day.panelCount += 1;
  }
  
  const allWeeklyWages = await storage.getWeeklyWageReports(startDate, endDate);
  const weeklyWages = factory && factory !== "all" 
    ? allWeeklyWages.filter(w => w.factory === factory)
    : allWeeklyWages;
  
  const weeklyActualLabour = new Map<string, { 
    weekStart: string; 
    weekEnd: string; 
    productionWages: number;
    totalRevenue: number;
  }>();
  
  for (const wage of weeklyWages) {
    const weekKey = `${wage.weekStartDate}_${wage.weekEndDate}`;
    if (!weeklyActualLabour.has(weekKey)) {
      weeklyActualLabour.set(weekKey, {
        weekStart: wage.weekStartDate,
        weekEnd: wage.weekEndDate,
        productionWages: parseFloat(wage.productionWages || "0"),
        totalRevenue: 0,
      });
    }
  }
  
  const dailyDataArray = Array.from(dailyData.values());
  const weeklyArray = Array.from(weeklyActualLabour.values());
  
  for (const day of dailyDataArray) {
    for (const week of weeklyArray) {
      if (day.date >= week.weekStart && day.date <= week.weekEnd) {
        week.totalRevenue += day.revenue;
      }
    }
  }
  
  const result = dailyDataArray
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => {
      let actualLabour = 0;
      
      for (const week of weeklyArray) {
        if (d.date >= week.weekStart && d.date <= week.weekEnd && week.totalRevenue > 0) {
          actualLabour = (d.revenue / week.totalRevenue) * week.productionWages;
          break;
        }
      }
      
      const variance = actualLabour - d.estimatedLabour;
      const variancePercent = d.estimatedLabour > 0 ? (variance / d.estimatedLabour) * 100 : 0;
      const isOverBudget = variance > 0;
      
      return {
        date: d.date,
        revenue: Math.round(d.revenue * 100) / 100,
        estimatedLabour: Math.round(d.estimatedLabour * 100) / 100,
        actualLabour: Math.round(actualLabour * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePercent: Math.round(variancePercent * 10) / 10,
        isOverBudget,
        panelCount: d.panelCount,
      };
    });
  
  const totals = {
    revenue: Math.round(result.reduce((s, d) => s + d.revenue, 0) * 100) / 100,
    estimatedLabour: Math.round(result.reduce((s, d) => s + d.estimatedLabour, 0) * 100) / 100,
    actualLabour: Math.round(result.reduce((s, d) => s + d.actualLabour, 0) * 100) / 100,
    variance: 0,
    variancePercent: 0,
    isOverBudget: false,
    panelCount: result.reduce((s, d) => s + d.panelCount, 0),
  };
  totals.variance = Math.round((totals.actualLabour - totals.estimatedLabour) * 100) / 100;
  totals.variancePercent = totals.estimatedLabour > 0 
    ? Math.round((totals.variance / totals.estimatedLabour) * 1000) / 10 
    : 0;
  totals.isOverBudget = totals.variance > 0;
  
  res.json({
    period: { startDate, endDate },
    factory: factory || "all",
    dailyData: result,
    totals,
    hasWeeklyWageData: weeklyWages.length > 0,
  });
});

export const costAnalyticsRouter = router;
