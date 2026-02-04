import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";

const router = Router();

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
    logger.error({ err: error }, "Error creating daily log");
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
    logger.error({ err: error }, "Error deleting log row");
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
    logger.error({ err: error }, "Error deleting daily log");
    res.status(500).json({ error: error.message || "Failed to delete daily log" });
  }
});

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
    logger.error({ err: error }, "Manual entry error");
    res.status(500).json({ error: "Failed to create time entry" });
  }
});

export const dailyLogsRouter = router;
