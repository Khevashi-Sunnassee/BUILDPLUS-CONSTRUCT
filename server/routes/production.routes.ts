import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { format, subDays } from "date-fns";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";

const router = Router();

// ============== Production Entries ==============

router.get("/api/production-entries", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (date) {
    const entries = await storage.getProductionEntriesByDate(date);
    res.json(entries);
  } else {
    const entries = await storage.getAllProductionEntries();
    res.json(entries);
  }
});

router.get("/api/production-entries/:id", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  const entry = await storage.getProductionEntry(req.params.id as string);
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json(entry);
});

router.post("/api/production-entries", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const { panelId, loadWidth, loadHeight, panelThickness, panelVolume, panelMass, ...entryFields } = req.body;
    if (panelId) {
      const panel = await storage.getPanelById(panelId);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      if (!panel.approvedForProduction) {
        return res.status(400).json({ error: "Panel is not approved for production. Please approve the panel in the Panel Register first." });
      }
      if (panel.documentStatus !== "APPROVED") {
        return res.status(400).json({ error: "Panel document status must be 'Approved for Production'. Current status: " + (panel.documentStatus || "DRAFT") + ". Please update the document status in the Drafting Register first." });
      }
      
      const panelUpdates: any = {};
      if (loadWidth !== undefined) panelUpdates.loadWidth = loadWidth;
      if (loadHeight !== undefined) panelUpdates.loadHeight = loadHeight;
      if (panelThickness !== undefined) panelUpdates.panelThickness = panelThickness;
      if (panelVolume !== undefined) panelUpdates.panelVolume = panelVolume;
      if (panelMass !== undefined) panelUpdates.panelMass = panelMass;
      
      if (Object.keys(panelUpdates).length > 0) {
        await storage.updatePanelRegisterItem(panelId, panelUpdates);
      }
    }
    
    const entryData = {
      ...entryFields,
      panelId,
      userId: req.session.userId!,
    };
    const entry = await storage.createProductionEntry(entryData);
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create production entry" });
  }
});

router.put("/api/production-entries/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const { loadWidth, loadHeight, panelThickness, panelVolume, panelMass, panelId, status, ...entryFields } = req.body;
    
    if (panelId) {
      const panelUpdates: any = {};
      if (loadWidth !== undefined) panelUpdates.loadWidth = loadWidth;
      if (loadHeight !== undefined) panelUpdates.loadHeight = loadHeight;
      if (panelThickness !== undefined) panelUpdates.panelThickness = panelThickness;
      if (panelVolume !== undefined) panelUpdates.panelVolume = panelVolume;
      if (panelMass !== undefined) panelUpdates.panelMass = panelMass;
      
      if (Object.keys(panelUpdates).length > 0) {
        await storage.updatePanelRegisterItem(panelId, panelUpdates);
      }
      
      if (status === "COMPLETED") {
        await storage.updatePanelRegisterItem(panelId, { status: "COMPLETED" });
        
        const panel = await storage.getPanelRegisterItem(panelId);
        if (panel && panel.level && panel.building) {
          await storage.checkAndCompleteSlotByPanelCompletion(
            panel.jobId, 
            panel.level, 
            parseInt(panel.building) || 1
          );
        }
      }
    }
    
    const entry = await storage.updateProductionEntry(req.params.id as string, { ...entryFields, panelId, status });
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update production entry" });
  }
});

router.delete("/api/production-entries/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  await storage.deleteProductionEntry(req.params.id as string);
  res.json({ ok: true });
});

router.put("/api/production-entries/batch-status", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  const { entryIds, status } = req.body;
  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0 || !status) {
    return res.status(400).json({ error: "entryIds array and status required" });
  }
  if (!["PENDING", "COMPLETED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be PENDING or COMPLETED" });
  }
  const validEntries: { id: string; panelId: string }[] = [];
  for (const id of entryIds) {
    const entry = await storage.getProductionEntry(id);
    if (entry) {
      validEntries.push({ id, panelId: entry.panelId });
    }
  }
  if (validEntries.length === 0) {
    return res.status(404).json({ error: "No valid entries found" });
  }
  const updated = await Promise.all(
    validEntries.map(e => storage.updateProductionEntry(e.id, { status }))
  );
  
  if (status === "COMPLETED") {
    const uniquePanelIds = Array.from(new Set(validEntries.map(e => e.panelId)));
    
    await Promise.all(
      uniquePanelIds.map(panelId => storage.updatePanelRegisterItem(panelId, { status: "COMPLETED" }))
    );
    
    const slotsToCheck = new Map<string, { jobId: string; level: string; building: number }>();
    for (const panelId of uniquePanelIds) {
      const panel = await storage.getPanelRegisterItem(panelId);
      if (panel && panel.level && panel.building) {
        const key = `${panel.jobId}-${panel.level}-${panel.building}`;
        if (!slotsToCheck.has(key)) {
          slotsToCheck.set(key, {
            jobId: panel.jobId,
            level: panel.level,
            building: parseInt(panel.building) || 1
          });
        }
      }
    }
    
    for (const item of Array.from(slotsToCheck.values())) {
      await storage.checkAndCompleteSlotByPanelCompletion(item.jobId, item.level, item.building);
    }
  }
  
  res.json({ updated: updated.length });
});

router.get("/api/production-slots/:slotId/panel-entries", requireAuth, requirePermission("production_report", "VIEW"), async (req: Request, res: Response) => {
  try {
    const slotId = String(req.params.slotId);
    const slot = await storage.getProductionSlot(slotId);
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    
    const panels = await storage.getPanelsByJobAndLevel(slot.jobId, slot.level);
    
    const entries: Record<string, { productionDate: string; entryId: string }> = {};
    for (const panel of panels) {
      const entry = await storage.getProductionEntryByPanelId(panel.id);
      if (entry) {
        entries[panel.id] = { productionDate: entry.productionDate, entryId: entry.id };
      }
    }
    
    res.json(entries);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to fetch panel entries" });
  }
});

router.delete("/api/production-entries/:entryId", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const entryId = String(req.params.entryId);
    const entry = await storage.getProductionEntry(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Production entry not found" });
    }
    
    if (entry.panelId) {
      await storage.updatePanelRegisterItem(entry.panelId, { status: "PENDING" });
    }
    
    await storage.deleteProductionEntry(entryId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete production entry" });
  }
});

router.post("/api/production-slots/:slotId/assign-panels", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const { panelAssignments, factory } = req.body as {
      panelAssignments: { panelId: string; productionDate: string }[];
      factory?: string;
    };

    if (!panelAssignments || !Array.isArray(panelAssignments) || panelAssignments.length === 0) {
      return res.status(400).json({ error: "Panel assignments are required" });
    }

    const slot = await storage.getProductionSlot(String(slotId));
    if (!slot) {
      return res.status(404).json({ error: "Production slot not found" });
    }
    
    if (slot.status !== "BOOKED") {
      return res.status(400).json({ error: "Production slot must be in BOOKED status to assign panels" });
    }
    
    const job = await storage.getJob(slot.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found for production slot" });
    }
    
    const settings = await storage.getGlobalSettings();
    const productionWindowDays = job.productionWindowDays ?? settings?.productionWindowDays ?? 10;
    
    const dueDate = new Date(slot.productionSlotDate);
    const startDate = new Date(dueDate);
    startDate.setDate(startDate.getDate() - productionWindowDays);

    const results: { created: number; skipped: number; errors: string[] } = { created: 0, skipped: 0, errors: [] };
    const targetFactory = job.state === "QLD" ? "QLD" : "VIC";

    for (const assignment of panelAssignments) {
      try {
        const assignmentDate = new Date(assignment.productionDate);
        if (assignmentDate < startDate || assignmentDate > dueDate) {
          results.errors.push(`Date ${assignment.productionDate} is outside the production window`);
          results.skipped++;
          continue;
        }
        
        const panel = await storage.getPanelById(assignment.panelId);
        if (!panel) {
          results.errors.push(`Panel ${assignment.panelId} not found`);
          results.skipped++;
          continue;
        }
        
        if (panel.jobId !== slot.jobId) {
          results.errors.push(`Panel ${panel.panelMark} does not belong to this job`);
          results.skipped++;
          continue;
        }
        if (panel.level !== slot.level) {
          results.errors.push(`Panel ${panel.panelMark} is not on level ${slot.level}`);
          results.skipped++;
          continue;
        }

        const existingEntry = await storage.getProductionEntryByPanelId(assignment.panelId);
        if (existingEntry) {
          results.errors.push(`Panel ${panel.panelMark} already has a production entry`);
          results.skipped++;
          continue;
        }

        await storage.createProductionEntry({
          panelId: assignment.panelId,
          jobId: panel.jobId,
          productionDate: assignment.productionDate,
          factory: targetFactory,
          status: "PENDING",
          volumeM3: panel.panelVolume || null,
          areaM2: panel.panelArea || null,
          userId: req.session.userId!,
        });
        
        await storage.updatePanelRegisterItem(assignment.panelId, { status: "IN_PROGRESS" });
        
        results.created++;
      } catch (err: any) {
        results.errors.push(`Failed to assign panel: ${err.message}`);
        results.skipped++;
      }
    }

    res.json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to assign panels" });
  }
});

// ============== Production Summary/Reports ==============

router.get("/api/production-summary", requireAuth, async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: "Date required" });
  const summary = await storage.getProductionSummaryByDate(date);
  res.json(summary);
});

router.get("/api/production-summary-with-costs", requireAuth, async (req: Request, res: Response) => {
  const date = req.query.date as string;
  const factoryFilter = req.query.factory as string | undefined;
  if (!date) return res.status(400).json({ error: "Date required" });
  
  const entries = factoryFilter 
    ? await storage.getProductionEntriesByDateAndFactory(date, factoryFilter)
    : await storage.getProductionEntriesByDate(date);
  const allPanelTypes = await storage.getAllPanelTypes();
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
  
  const productionDaysData = await storage.getProductionDays(start, end);
  
  const entries = await storage.getProductionEntriesInRange(start, end);
  
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
    const factory = (entry as any).factory || "QLD";
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
    
    const status = (entry as any).status || "PENDING";
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

// ============== Production Days ==============

router.post("/api/production-days", requireAuth, async (req: Request, res: Response) => {
  try {
    const { productionDate, factory, notes } = req.body;
    
    if (!productionDate || !factory) {
      return res.status(400).json({ error: "Date and factory are required" });
    }
    
    const existing = await storage.getProductionDay(productionDate, factory);
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
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create production day" });
  }
});

router.delete("/api/production-days/:date", requireRole("MANAGER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const date = String(req.params.date);
    const factory = String(req.query.factory || "QLD");
    await storage.deleteProductionDayByDateAndFactory(date, factory);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting production day:", error);
    res.status(500).json({ error: error.message || "Failed to delete production day" });
  }
});

// ============== Production Slots ==============

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
    console.error("Error fetching production slots:", error);
    res.status(500).json({ error: error.message || "Failed to fetch production slots" });
  }
});

router.get("/api/production-slots/jobs-without-slots", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobsWithoutSlots = await storage.getJobsWithoutProductionSlots();
    res.json(jobsWithoutSlots);
  } catch (error: any) {
    console.error("Error fetching jobs without slots:", error);
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
    console.error("Error fetching production slot:", error);
    res.status(500).json({ error: error.message || "Failed to fetch production slot" });
  }
});

router.get("/api/production-slots/check-levels/:jobId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const result = await storage.checkPanelLevelCoverage(String(req.params.jobId));
    res.json(result);
  } catch (error: any) {
    console.error("Error checking panel level coverage:", error);
    res.status(500).json({ error: error.message || "Failed to check level coverage" });
  }
});

router.post("/api/production-slots/generate/:jobId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { skipEmptyLevels } = req.body || {};
    const slots = await storage.generateProductionSlotsForJob(String(req.params.jobId), skipEmptyLevels);
    res.json(slots);
  } catch (error: any) {
    console.error("Error generating production slots:", error);
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
    console.error("Error adjusting production slot:", error);
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
    console.error("Error booking production slot:", error);
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
    console.error("Error completing production slot:", error);
    res.status(500).json({ error: error.message || "Failed to complete production slot" });
  }
});

router.get("/api/production-slots/:id/adjustments", requireAuth, async (req: Request, res: Response) => {
  try {
    const adjustments = await storage.getProductionSlotAdjustments(String(req.params.id));
    res.json(adjustments);
  } catch (error: any) {
    console.error("Error fetching production slot adjustments:", error);
    res.status(500).json({ error: error.message || "Failed to fetch adjustments" });
  }
});

router.delete("/api/production-slots/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    await storage.deleteProductionSlot(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting production slot:", error);
    res.status(500).json({ error: error.message || "Failed to delete production slot" });
  }
});

export const productionRouter = router;
