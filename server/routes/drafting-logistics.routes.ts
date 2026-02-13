import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

router.get("/api/reports/drafting-daily", requireAuth, async (req, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate required" });
  }
  
  const logsWithRows = await storage.getDailyLogsWithRowsInRange(startDate, endDate);
  
  const jobIds = new Set<string>();
  for (const { rows } of logsWithRows) {
    for (const row of rows) {
      if (row.jobId) jobIds.add(row.jobId);
    }
  }
  
  const allJobs = await storage.getAllJobs(req.companyId);
  const jobsMap = new Map(allJobs.filter(j => jobIds.has(j.id)).map(j => [j.id, j]));
  
  const allWorkTypes = await storage.getActiveWorkTypes(req.companyId);
  const workTypesMap = new Map(allWorkTypes.map(wt => [wt.id, wt]));
  
  const dailyData = new Map<string, {
    date: string;
    totalMinutes: number;
    idleMinutes: number;
    activeMinutes: number;
    byUser: Map<string, { name: string; minutes: number; idle: number }>;
    byApp: Map<string, number>;
    byJob: Map<string, { name: string; minutes: number }>;
    byWorkType: Map<number | string, { name: string; code: string; minutes: number }>;
    byPanel: Map<string, { panelMark: string; minutes: number; jobName: string }>;
  }>();
  
  for (const { log, user, rows } of logsWithRows) {
    const date = log.logDay;
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        date,
        totalMinutes: 0,
        idleMinutes: 0,
        activeMinutes: 0,
        byUser: new Map(),
        byApp: new Map(),
        byJob: new Map(),
        byWorkType: new Map(),
        byPanel: new Map(),
      });
    }
    const day = dailyData.get(date)!;
    
    for (const row of rows) {
      day.totalMinutes += row.durationMin;
      day.idleMinutes += row.idleMin;
      day.activeMinutes += (row.durationMin - row.idleMin);
      
      const userName = user.name || user.email;
      if (!day.byUser.has(user.id)) {
        day.byUser.set(user.id, { name: userName, minutes: 0, idle: 0 });
      }
      const userData = day.byUser.get(user.id)!;
      userData.minutes += row.durationMin;
      userData.idle += row.idleMin;
      
      const app = row.app;
      day.byApp.set(app, (day.byApp.get(app) || 0) + row.durationMin);
      
      if (row.jobId) {
        const job = jobsMap.get(row.jobId);
        if (job) {
          if (!day.byJob.has(job.id)) {
            day.byJob.set(job.id, { name: job.name, minutes: 0 });
          }
          day.byJob.get(job.id)!.minutes += row.durationMin;
        }
      }
      
      const workTypeKey = row.workTypeId || "unassigned";
      if (!day.byWorkType.has(workTypeKey)) {
        const wt = row.workTypeId ? workTypesMap.get(row.workTypeId) : null;
        day.byWorkType.set(workTypeKey, {
          name: wt?.name || "Unassigned",
          code: wt?.code || "UNASSIGNED",
          minutes: 0,
        });
      }
      day.byWorkType.get(workTypeKey)!.minutes += row.durationMin;
      
      if (row.panelMark) {
        const panelKey = row.panelMark;
        if (!day.byPanel.has(panelKey)) {
          const job = row.jobId ? jobsMap.get(row.jobId) : null;
          day.byPanel.set(panelKey, {
            panelMark: row.panelMark,
            minutes: 0,
            jobName: job?.name || "Unknown",
          });
        }
        day.byPanel.get(panelKey)!.minutes += row.durationMin;
      }
    }
  }
  
  const result = Array.from(dailyData.values())
    .map(d => ({
      date: d.date,
      totalMinutes: d.totalMinutes,
      idleMinutes: d.idleMinutes,
      activeMinutes: d.activeMinutes,
      totalHours: Math.round(d.totalMinutes / 60 * 100) / 100,
      activeHours: Math.round((d.totalMinutes - d.idleMinutes) / 60 * 100) / 100,
      byUser: Object.fromEntries(d.byUser),
      byApp: Object.fromEntries(d.byApp),
      byProject: Object.fromEntries(d.byJob),
      byWorkType: Object.fromEntries(d.byWorkType),
      byPanel: Object.fromEntries(d.byPanel),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const workTypeTotals = new Map<string, { name: string; code: string; minutes: number }>();
  const panelTotals = new Map<string, { panelMark: string; minutes: number; jobName: string }>();
  
  for (const day of result) {
    for (const [key, wt] of Object.entries(day.byWorkType) as [string, any][]) {
      if (!workTypeTotals.has(key)) {
        workTypeTotals.set(key, { name: wt.name, code: wt.code, minutes: 0 });
      }
      workTypeTotals.get(key)!.minutes += wt.minutes;
    }
    for (const [key, panel] of Object.entries(day.byPanel) as [string, any][]) {
      if (!panelTotals.has(key)) {
        panelTotals.set(key, { panelMark: panel.panelMark, minutes: 0, jobName: panel.jobName });
      }
      panelTotals.get(key)!.minutes += panel.minutes;
    }
  }
  
  const reworkMinutes = Array.from(workTypeTotals.values())
    .filter(wt => wt.code === "ERROR_REWORK")
    .reduce((sum, wt) => sum + wt.minutes, 0);
  const clientChangeMinutes = Array.from(workTypeTotals.values())
    .filter(wt => wt.code === "CLIENT_CHANGE")
    .reduce((sum, wt) => sum + wt.minutes, 0);
  const generalMinutes = Array.from(workTypeTotals.values())
    .filter(wt => wt.code === "GENERAL")
    .reduce((sum, wt) => sum + wt.minutes, 0);
  const unassignedMinutes = Array.from(workTypeTotals.values())
    .filter(wt => wt.code === "UNASSIGNED")
    .reduce((sum, wt) => sum + wt.minutes, 0);
  
  const totalMinutesAll = result.reduce((sum, d) => sum + d.totalMinutes, 0);
  const assignedMinutes = totalMinutesAll - unassignedMinutes;
  
  const totals = {
    totalMinutes: totalMinutesAll,
    idleMinutes: result.reduce((sum, d) => sum + d.idleMinutes, 0),
    activeMinutes: result.reduce((sum, d) => sum + d.activeMinutes, 0),
    totalHours: Math.round(totalMinutesAll / 60 * 100) / 100,
    activeHours: Math.round(result.reduce((sum, d) => sum + d.activeMinutes, 0) / 60 * 100) / 100,
    reworkHours: Math.round(reworkMinutes / 60 * 100) / 100,
    reworkPercentage: assignedMinutes > 0 ? Math.round((reworkMinutes / assignedMinutes) * 100 * 10) / 10 : 0,
    clientChangeHours: Math.round(clientChangeMinutes / 60 * 100) / 100,
    clientChangePercentage: assignedMinutes > 0 ? Math.round((clientChangeMinutes / assignedMinutes) * 100 * 10) / 10 : 0,
    generalHours: Math.round(generalMinutes / 60 * 100) / 100,
    generalPercentage: assignedMinutes > 0 ? Math.round((generalMinutes / assignedMinutes) * 100 * 10) / 10 : 0,
    unassignedHours: Math.round(unassignedMinutes / 60 * 100) / 100,
    byWorkType: Array.from(workTypeTotals.values()).map(wt => ({
      ...wt,
      hours: Math.round(wt.minutes / 60 * 100) / 100,
      percentage: wt.code === 'UNASSIGNED' 
        ? (totalMinutesAll > 0 ? Math.round((wt.minutes / totalMinutesAll) * 100 * 10) / 10 : 0)
        : (assignedMinutes > 0 ? Math.round((wt.minutes / assignedMinutes) * 100 * 10) / 10 : 0),
    })),
    byPanel: Array.from(panelTotals.values())
      .map(p => ({ ...p, hours: Math.round(p.minutes / 60 * 100) / 100 }))
      .sort((a, b) => b.minutes - a.minutes),
  };
  
  res.json({
    dailyData: result,
    totals,
    period: { startDate, endDate },
  });
});

router.get("/api/reports/logistics", requireAuth, async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }
    
    const allLoadLists = await storage.getAllLoadLists(req.companyId);
    const completedLoadLists = allLoadLists.filter(ll => 
      ll.status === 'COMPLETE' && 
      ll.deliveryRecord?.deliveryDate &&
      ll.deliveryRecord.deliveryDate >= startDate &&
      ll.deliveryRecord.deliveryDate <= endDate
    );
    
    const byDate = new Map<string, { 
      panelCount: number; 
      loadListCount: number;
      deliveries: (typeof completedLoadLists[number]["deliveryRecord"])[];
    }>();
    
    for (const loadList of completedLoadLists) {
      const date = loadList.deliveryRecord!.deliveryDate!;
      const panelCount = loadList.panels?.length || 0;
      
      if (!byDate.has(date)) {
        byDate.set(date, { panelCount: 0, loadListCount: 0, deliveries: [] });
      }
      
      const data = byDate.get(date)!;
      data.panelCount += panelCount;
      data.loadListCount += 1;
      data.deliveries.push(loadList.deliveryRecord);
    }
    
    const parseTimeToMinutes = (timeStr: string | null): number | null => {
      if (!timeStr) return null;
      const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    };
    
    const calculateDuration = (start: string | null, end: string | null): number | null => {
      const startMins = parseTimeToMinutes(start);
      const endMins = parseTimeToMinutes(end);
      if (startMins === null || endMins === null) return null;
      let diff = endMins - startMins;
      if (diff < 0) diff += 24 * 60;
      return diff;
    };
    
    const phaseTimings = {
      depotToLte: [] as number[],
      pickupTime: [] as number[],
      holdingTime: [] as number[],
      unloadTime: [] as number[],
      totalOnsite: [] as number[],
    };
    
    for (const loadList of completedLoadLists) {
      const dr = loadList.deliveryRecord!;
      
      const depotToLte = calculateDuration(dr.leaveDepotTime, dr.arriveLteTime);
      if (depotToLte !== null) phaseTimings.depotToLte.push(depotToLte);
      
      const pickupTime = calculateDuration(dr.pickupArriveTime, dr.pickupLeaveTime);
      if (pickupTime !== null) phaseTimings.pickupTime.push(pickupTime);
      
      const holdingTime = calculateDuration(dr.arriveHoldingTime, dr.leaveHoldingTime);
      if (holdingTime !== null) phaseTimings.holdingTime.push(holdingTime);
      
      const unloadTime = calculateDuration(dr.siteFirstLiftTime, dr.siteLastLiftTime);
      if (unloadTime !== null) phaseTimings.unloadTime.push(unloadTime);
    }
    
    const average = (arr: number[]): number | null => {
      if (arr.length === 0) return null;
      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    };
    
    const formatMinutes = (mins: number | null): string => {
      if (mins === null) return "N/A";
      const hours = Math.floor(mins / 60);
      const minutes = mins % 60;
      if (hours === 0) return `${minutes}m`;
      return `${hours}h ${minutes}m`;
    };
    
    const dailyData = Array.from(byDate.entries())
      .map(([date, data]) => ({
        date,
        panelCount: data.panelCount,
        loadListCount: data.loadListCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const totals = {
      totalPanels: dailyData.reduce((sum, d) => sum + d.panelCount, 0),
      totalLoadLists: dailyData.reduce((sum, d) => sum + d.loadListCount, 0),
      avgPanelsPerDay: dailyData.length > 0 
        ? Math.round(dailyData.reduce((sum, d) => sum + d.panelCount, 0) / dailyData.length * 10) / 10
        : 0,
    };
    
    const phaseAverages = {
      depotToLte: {
        avgMinutes: average(phaseTimings.depotToLte),
        formatted: formatMinutes(average(phaseTimings.depotToLte)),
        count: phaseTimings.depotToLte.length,
      },
      pickupTime: {
        avgMinutes: average(phaseTimings.pickupTime),
        formatted: formatMinutes(average(phaseTimings.pickupTime)),
        count: phaseTimings.pickupTime.length,
      },
      holdingTime: {
        avgMinutes: average(phaseTimings.holdingTime),
        formatted: formatMinutes(average(phaseTimings.holdingTime)),
        count: phaseTimings.holdingTime.length,
      },
      unloadTime: {
        avgMinutes: average(phaseTimings.unloadTime),
        formatted: formatMinutes(average(phaseTimings.unloadTime)),
        count: phaseTimings.unloadTime.length,
      },
    };
    
    res.json({
      period: { startDate, endDate },
      dailyData,
      totals,
      phaseAverages,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Logistics report error");
    res.status(500).json({ error: "Failed to generate logistics report" });
  }
});

export const draftingLogisticsRouter = router;
