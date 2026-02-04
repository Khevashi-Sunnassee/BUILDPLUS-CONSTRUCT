import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import { insertWeeklyWageReportSchema } from "@shared/schema";

const router = Router();

// Main reports endpoint
router.get("/api/reports", requireAuth, async (req, res) => {
  const period = req.query.period as string || "week";
  const reports = await storage.getReports(period);
  res.json(reports);
});

// Daily logs endpoints
router.get("/api/daily-logs", requireAuth, requirePermission("daily_reports"), async (req, res) => {
  const user = await storage.getUser(req.session.userId!);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const logs = await storage.getDailyLogsByUser(user.id, {
    status: req.query.status as string,
    dateRange: req.query.dateRange as string,
  });

  const logsWithStats = [];
  for (const log of logs) {
    const fullLog = await storage.getDailyLog(log.id);
    if (fullLog) {
      const totalMinutes = fullLog.rows.reduce((sum, r) => sum + r.durationMin, 0);
      const idleMinutes = fullLog.rows.reduce((sum, r) => sum + r.idleMin, 0);
      const missingPanelMarkMinutes = fullLog.rows.filter(r => !r.panelMark).reduce((sum, r) => sum + r.durationMin, 0);
      const missingJobMinutes = fullLog.rows.filter(r => !r.jobId).reduce((sum, r) => sum + r.durationMin, 0);
      
      let lastEntryEndTime: string | null = null;
      if (fullLog.rows.length > 0) {
        const sortedRows = [...fullLog.rows].sort((a, b) => 
          new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
        );
        lastEntryEndTime = sortedRows[0].endAt.toISOString();
      }
      
      logsWithStats.push({
        id: log.id,
        logDay: log.logDay,
        factory: log.factory,
        status: log.status,
        totalMinutes,
        idleMinutes,
        missingPanelMarkMinutes,
        missingJobMinutes,
        rowCount: fullLog.rows.length,
        userName: fullLog.user.name,
        userEmail: fullLog.user.email,
        userId: fullLog.user.id,
        lastEntryEndTime,
        rows: fullLog.rows,
        userWorkHours: {
          mondayStartTime: (fullLog.user as any).mondayStartTime,
          mondayHours: (fullLog.user as any).mondayHours,
          tuesdayStartTime: (fullLog.user as any).tuesdayStartTime,
          tuesdayHours: (fullLog.user as any).tuesdayHours,
          wednesdayStartTime: (fullLog.user as any).wednesdayStartTime,
          wednesdayHours: (fullLog.user as any).wednesdayHours,
          thursdayStartTime: (fullLog.user as any).thursdayStartTime,
          thursdayHours: (fullLog.user as any).thursdayHours,
          fridayStartTime: (fullLog.user as any).fridayStartTime,
          fridayHours: (fullLog.user as any).fridayHours,
          saturdayStartTime: (fullLog.user as any).saturdayStartTime,
          saturdayHours: (fullLog.user as any).saturdayHours,
          sundayStartTime: (fullLog.user as any).sundayStartTime,
          sundayHours: (fullLog.user as any).sundayHours,
        },
      });
    }
  }
  res.json(logsWithStats);
});

router.post("/api/daily-logs", requireAuth, requirePermission("daily_reports", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const { logDay } = req.body;
    if (!logDay) {
      return res.status(400).json({ error: "logDay is required" });
    }
    
    const existingLog = await storage.getDailyLogByUserAndDay(user.id, logDay);
    if (existingLog) {
      return res.json(existingLog);
    }
    
    const newLog = await storage.createDailyLog({
      userId: user.id,
      logDay: logDay,
      status: "PENDING",
    });
    
    res.status(201).json(newLog);
  } catch (error: any) {
    console.error("Error creating daily log:", error);
    res.status(500).json({ error: error.message || "Failed to create daily log" });
  }
});

router.get("/api/daily-logs/submitted", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const logs = await storage.getSubmittedDailyLogs();
  res.json(logs);
});

router.get("/api/daily-logs/:id", requireAuth, async (req, res) => {
  const log = await storage.getDailyLog(req.params.id as string);
  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }
  const currentUser = await storage.getUser(req.session.userId!);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
  if (log.userId !== currentUser.id && currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(log);
});

router.post("/api/daily-logs/:id/submit", requireAuth, async (req, res) => {
  const existingLog = await storage.getDailyLog(req.params.id as string);
  if (!existingLog) {
    return res.status(404).json({ error: "Log not found" });
  }
  if (existingLog.userId !== req.session.userId) {
    return res.status(403).json({ error: "You can only submit your own logs" });
  }
  const log = await storage.updateDailyLogStatus(req.params.id as string, {
    status: "SUBMITTED",
    submittedAt: new Date(),
  });
  if (log) {
    await storage.createApprovalEvent({
      dailyLogId: log.id,
      action: "SUBMIT",
      actorId: req.session.userId!,
    });
  }
  res.json({ log });
});

router.post("/api/daily-logs/:id/approve", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const { approve, comment } = req.body;
  const status = approve ? "APPROVED" : "REJECTED";
  const log = await storage.updateDailyLogStatus(req.params.id as string, {
    status,
    approvedAt: approve ? new Date() : undefined,
    approvedBy: approve ? req.session.userId : undefined,
    managerComment: comment || undefined,
  });
  if (log) {
    await storage.createApprovalEvent({
      dailyLogId: log.id,
      action: approve ? "APPROVE" : "REJECT",
      actorId: req.session.userId!,
      comment,
    });
  }
  res.json({ log });
});

router.post("/api/daily-logs/:id/merge", requireAuth, async (req, res) => {
  res.json({ ok: true, message: "Merge functionality - rows with same project/app/file within 2 minutes would be merged" });
});

router.patch("/api/log-rows/:id", requireAuth, async (req, res) => {
  const row = await storage.getLogRow(req.params.id as string);
  if (!row) {
    return res.status(404).json({ error: "Row not found" });
  }
  const log = await storage.getDailyLog(row.dailyLogId);
  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }
  const currentUser = await storage.getUser(req.session.userId!);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
  if (log.userId !== currentUser.id && currentUser.role !== "ADMIN") {
    return res.status(403).json({ error: "You can only edit your own log rows" });
  }
  if (log.status !== "PENDING" && log.status !== "REJECTED") {
    return res.status(400).json({ error: "Cannot edit rows in submitted/approved logs" });
  }
  const { panelMark, drawingCode, notes, jobId, workTypeId } = req.body;
  const updatedRow = await storage.updateLogRow(req.params.id as string, {
    panelMark,
    drawingCode,
    notes,
    jobId,
    workTypeId: workTypeId === null ? null : (workTypeId !== undefined ? workTypeId : undefined),
    isUserEdited: true,
  });
  res.json({ row: updatedRow });
});

router.delete("/api/log-rows/:id", requireAuth, async (req, res) => {
  try {
    const row = await storage.getLogRow(req.params.id as string);
    if (!row) {
      return res.status(404).json({ error: "Row not found" });
    }
    const log = await storage.getDailyLog(row.dailyLogId);
    if (!log) {
      return res.status(404).json({ error: "Log not found" });
    }
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    if (log.userId !== currentUser.id && currentUser.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only delete your own log rows" });
    }
    if (log.status !== "PENDING" && log.status !== "REJECTED" && currentUser.role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot delete rows in submitted/approved logs" });
    }
    await storage.deleteLogRow(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting log row:", error);
    res.status(500).json({ error: error.message || "Failed to delete log row" });
  }
});

router.delete("/api/daily-logs/:id", requireAuth, requirePermission("daily_reports", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const log = await storage.getDailyLog(req.params.id as string);
    if (!log) {
      return res.status(404).json({ error: "Log not found" });
    }
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
    if (log.userId !== currentUser.id && currentUser.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only delete your own daily logs" });
    }
    if (log.status === "APPROVED" && currentUser.role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot delete approved logs" });
    }
    await storage.deleteDailyLog(req.params.id as string);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting daily log:", error);
    res.status(500).json({ error: error.message || "Failed to delete daily log" });
  }
});

// Manual time entry
router.post("/api/manual-entry", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { logDay, jobId, panelRegisterId, workTypeId, app, startTime, endTime, fileName, filePath,
            revitViewName, revitSheetNumber, revitSheetName, acadLayoutName,
            panelMark, drawingCode, notes, createNewPanel, newPanelMark, panelDetails } = req.body;

    if (!logDay || !app || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const durationMin = endMinutes - startMinutes;

    if (durationMin <= 0) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    let actualPanelRegisterId = panelRegisterId;
    let actualPanelMark = panelMark;
    
    if (createNewPanel && newPanelMark && jobId) {
      const newPanel = await storage.createPanelRegisterItem({
        jobId,
        panelMark: newPanelMark,
        panelType: "OTHER",
        status: "IN_PROGRESS",
        estimatedHours: 0,
        actualHours: 0,
      });
      actualPanelRegisterId = newPanel.id;
      actualPanelMark = newPanelMark;
    }

    const dailyLog = await storage.upsertDailyLog({
      userId: user.id,
      logDay,
      tz: "Australia/Melbourne",
    });

    const sourceEventId = `manual-${user.id}-${logDay}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const startAt = new Date(`${logDay}T${startTime}:00+11:00`);
    const endAt = new Date(`${logDay}T${endTime}:00+11:00`);

    await storage.upsertLogRow(sourceEventId, {
      dailyLogId: dailyLog.id,
      jobId: jobId || undefined,
      panelRegisterId: actualPanelRegisterId || undefined,
      workTypeId: workTypeId || undefined,
      startAt,
      endAt,
      durationMin,
      idleMin: 0,
      source: "manual",
      tz: "Australia/Melbourne",
      app,
      filePath: filePath || undefined,
      fileName: fileName || undefined,
      revitViewName: revitViewName || undefined,
      revitSheetNumber: revitSheetNumber || undefined,
      revitSheetName: revitSheetName || undefined,
      acadLayoutName: acadLayoutName || undefined,
      rawPanelMark: actualPanelMark || undefined,
      rawDrawingCode: drawingCode || undefined,
      panelMark: actualPanelMark || undefined,
      drawingCode: drawingCode || undefined,
      notes: notes || undefined,
      isUserEdited: true,
    });

    if (actualPanelRegisterId) {
      await storage.updatePanelActualHours(actualPanelRegisterId, durationMin);
    }

    if (actualPanelRegisterId && panelDetails) {
      const panel = await storage.getPanelRegisterItem(actualPanelRegisterId);
      if (panel && panel.jobId === jobId) {
        const updateData: Record<string, string | number | undefined> = {};
        if (panelDetails.loadWidth && panelDetails.loadWidth.trim()) updateData.loadWidth = panelDetails.loadWidth;
        if (panelDetails.loadHeight && panelDetails.loadHeight.trim()) updateData.loadHeight = panelDetails.loadHeight;
        if (panelDetails.panelThickness && panelDetails.panelThickness.trim()) updateData.panelThickness = panelDetails.panelThickness;
        if (panelDetails.panelVolume && panelDetails.panelVolume.trim()) updateData.panelVolume = panelDetails.panelVolume;
        if (panelDetails.panelMass && panelDetails.panelMass.trim()) updateData.panelMass = panelDetails.panelMass;
        if (panelDetails.panelArea && panelDetails.panelArea.trim()) updateData.panelArea = panelDetails.panelArea;
        if (panelDetails.day28Fc && panelDetails.day28Fc.trim()) updateData.day28Fc = panelDetails.day28Fc;
        if (panelDetails.liftFcm && panelDetails.liftFcm.trim()) updateData.liftFcm = panelDetails.liftFcm;
        if (panelDetails.rotationalLifters && panelDetails.rotationalLifters.trim()) updateData.rotationalLifters = panelDetails.rotationalLifters;
        if (panelDetails.primaryLifters && panelDetails.primaryLifters.trim()) updateData.primaryLifters = panelDetails.primaryLifters;

        if (Object.keys(updateData).length > 0) {
          await storage.updatePanelRegisterItem(actualPanelRegisterId, updateData);
        }
      }
    }

    res.json({ ok: true, dailyLogId: dailyLog.id, newPanelCreated: createNewPanel && newPanelMark ? true : false });
  } catch (error) {
    console.error("Manual entry error:", error);
    res.status(500).json({ error: "Failed to create time entry" });
  }
});

// Report analytics endpoints
router.get("/api/reports/production-daily", requireAuth, async (req, res) => {
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
});

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
  
  const allJobs = await storage.getAllJobs();
  const jobsMap = new Map(allJobs.filter(j => jobIds.has(j.id)).map(j => [j.id, j]));
  
  const allWorkTypes = await storage.getActiveWorkTypes();
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

router.get("/api/reports/production-with-costs", requireAuth, async (req, res) => {
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
});

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

router.get("/api/reports/logistics", requireAuth, async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }
    
    const allLoadLists = await storage.getAllLoadLists();
    const completedLoadLists = allLoadLists.filter(ll => 
      ll.status === 'COMPLETE' && 
      ll.deliveryRecord?.deliveryDate &&
      ll.deliveryRecord.deliveryDate >= startDate &&
      ll.deliveryRecord.deliveryDate <= endDate
    );
    
    const byDate = new Map<string, { 
      panelCount: number; 
      loadListCount: number;
      deliveries: any[];
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
  } catch (error: any) {
    console.error("Logistics report error:", error);
    res.status(500).json({ error: error.message || "Failed to generate logistics report" });
  }
});

// Weekly Wage Reports
router.get("/api/weekly-wage-reports", requireAuth, requirePermission("weekly_wages"), async (req, res) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const reports = await storage.getWeeklyWageReports(startDate, endDate);
    res.json(reports);
  } catch (error: any) {
    console.error("Error fetching weekly wage reports:", error);
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
    console.error("Error fetching weekly wage report:", error);
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
    console.error("Error creating weekly wage report:", error);
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
    console.error("Error updating weekly wage report:", error);
    res.status(500).json({ error: error.message || "Failed to update weekly wage report" });
  }
});

router.delete("/api/weekly-wage-reports/:id", requireRole("ADMIN", "MANAGER"), requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    await storage.deleteWeeklyWageReport(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting weekly wage report:", error);
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
    console.error("Error generating wage analysis:", error);
    res.status(500).json({ error: error.message || "Failed to generate wage analysis" });
  }
});

// Weekly Job Reports (Project Manager Reports)
router.get("/api/weekly-job-reports", requireAuth, requirePermission("weekly_job_logs"), async (req, res) => {
  try {
    const projectManagerId = req.query.projectManagerId as string | undefined;
    const reports = await storage.getWeeklyJobReports(projectManagerId);
    res.json(reports);
  } catch (error: any) {
    console.error("Error fetching weekly job reports:", error);
    res.status(500).json({ error: error.message || "Failed to fetch weekly job reports" });
  }
});

router.get("/api/weekly-job-reports/my-reports", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const reports = await storage.getWeeklyJobReports(userId);
    res.json(reports);
  } catch (error: any) {
    console.error("Error fetching my weekly job reports:", error);
    res.status(500).json({ error: error.message || "Failed to fetch weekly job reports" });
  }
});

router.get("/api/weekly-job-reports/pending-approval", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const reports = await storage.getWeeklyJobReportsByStatus("SUBMITTED");
    res.json(reports);
  } catch (error: any) {
    console.error("Error fetching pending approval reports:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending reports" });
  }
});

router.get("/api/weekly-job-reports/approved", requireAuth, async (req, res) => {
  try {
    const reports = await storage.getApprovedWeeklyJobReports();
    res.json(reports);
  } catch (error: any) {
    console.error("Error fetching approved reports:", error);
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
    console.error("Error fetching weekly job report:", error);
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
    console.error("Error creating weekly job report:", error);
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
    console.error("Error updating weekly job report:", error);
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
    console.error("Error submitting weekly job report:", error);
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
    console.error("Error approving weekly job report:", error);
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
    console.error("Error rejecting weekly job report:", error);
    res.status(500).json({ error: error.message || "Failed to reject report" });
  }
});

router.delete("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteWeeklyJobReport(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting weekly job report:", error);
    res.status(500).json({ error: error.message || "Failed to delete report" });
  }
});

export const reportsRouter = router;
