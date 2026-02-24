import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { logPanelChange, advancePanelLifecycleIfLower } from "../services/panel-audit.service";
import { PANEL_LIFECYCLE_STATUS } from "@shared/schema";
import { z } from "zod";
import { db } from "../db";
import { dailyLogs, logRows, users, jobs } from "@shared/schema";
import { eq, and, desc, asc, gte, sql, count, inArray } from "drizzle-orm";

const createDailyLogSchema = z.object({
  logDay: z.string(),
});

const approveDailyLogSchema = z.object({
  approve: z.boolean(),
  comment: z.string().optional(),
});

const updateLogRowSchema = z.object({
  panelMark: z.string().optional(),
  drawingCode: z.string().optional(),
  notes: z.string().optional(),
  jobId: z.string().optional(),
  workTypeId: z.any().optional(),
});

const manualEntrySchema = z.object({
  logDay: z.string(),
  jobId: z.string().nullable().optional(),
  panelRegisterId: z.string().nullable().optional(),
  workTypeId: z.any().optional(),
  app: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  fileName: z.string().optional(),
  filePath: z.string().optional(),
  revitViewName: z.string().optional(),
  revitSheetNumber: z.string().optional(),
  revitSheetName: z.string().optional(),
  acadLayoutName: z.string().optional(),
  panelMark: z.string().nullable().optional(),
  drawingCode: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createNewPanel: z.boolean().optional(),
  newPanelMark: z.string().optional(),
  panelDetails: z.object({
    loadWidth: z.string().optional(),
    loadHeight: z.string().optional(),
    panelThickness: z.string().optional(),
    panelVolume: z.string().optional(),
    panelMass: z.string().optional(),
    panelArea: z.string().optional(),
    day28Fc: z.string().optional(),
    liftFcm: z.string().optional(),
    rotationalLifters: z.string().optional(),
    primaryLifters: z.string().optional(),
  }).optional(),
});

const router = Router();

router.get("/api/daily-logs", requireAuth, requirePermission("daily_reports"), async (req, res) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string;
    const dateRange = req.query.dateRange as string;

    const conditions: any[] = [eq(dailyLogs.userId, user.id)];

    if (statusFilter && statusFilter !== "all") {
      conditions.push(eq(dailyLogs.status, statusFilter as any));
    }

    if (dateRange && dateRange !== "all") {
      const today = new Date();
      let startDate: Date | null = null;
      if (dateRange === "today") {
        startDate = today;
      } else if (dateRange === "week") {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
      } else if (dateRange === "month") {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
      }
      if (startDate) {
        const startDateStr = startDate.toISOString().split("T")[0];
        conditions.push(gte(dailyLogs.logDay, startDateStr));
      }
    }

    const whereClause = and(...conditions);

    const [{ total: totalCount }] = await db.select({ total: count() }).from(dailyLogs).where(whereClause);
    const total = Number(totalCount);
    const totalPages = Math.ceil(total / limit);

    const pageLogs = await db.select().from(dailyLogs)
      .where(whereClause)
      .orderBy(desc(dailyLogs.logDay))
      .limit(limit)
      .offset(offset);

    if (pageLogs.length === 0) {
      return res.json({ data: [], pagination: { page, limit, total, totalPages } });
    }

    const pageIds = pageLogs.map(l => l.id);

    const allRows = await db.select().from(logRows)
      .leftJoin(jobs, eq(logRows.jobId, jobs.id))
      .where(inArray(logRows.dailyLogId, pageIds))
      .orderBy(asc(logRows.startAt))
      .limit(1000);

    const rowsByLogId = new Map<string, Array<typeof allRows[number]>>();
    for (const row of allRows) {
      const logId = row.log_rows.dailyLogId;
      if (!rowsByLogId.has(logId)) {
        rowsByLogId.set(logId, []);
      }
      rowsByLogId.get(logId)!.push(row);
    }

    const logsWithStats = pageLogs.map(log => {
      const logRowEntries = rowsByLogId.get(log.id) || [];
      const rows = logRowEntries.map(r => ({ ...r.log_rows, job: r.jobs || undefined }));

      const totalMinutes = rows.reduce((sum, r) => sum + r.durationMin, 0);
      const idleMinutes = rows.reduce((sum, r) => sum + r.idleMin, 0);
      const missingPanelMarkMinutes = rows.filter(r => !r.panelMark).reduce((sum, r) => sum + r.durationMin, 0);
      const missingJobMinutes = rows.filter(r => !r.jobId).reduce((sum, r) => sum + r.durationMin, 0);

      let lastEntryEndTime: string | null = null;
      if (rows.length > 0) {
        const sortedRows = [...rows].sort((a, b) =>
          new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
        );
        lastEntryEndTime = sortedRows[0].endAt.toISOString();
      }

      return {
        id: log.id,
        logDay: log.logDay,
        factory: log.factory,
        status: log.status,
        totalMinutes,
        idleMinutes,
        missingPanelMarkMinutes,
        missingJobMinutes,
        rowCount: rows.length,
        userName: user.name,
        userEmail: user.email,
        userId: user.id,
        lastEntryEndTime,
        rows,
        userWorkHours: {
          mondayStartTime: user.mondayStartTime,
          mondayHours: user.mondayHours,
          tuesdayStartTime: user.tuesdayStartTime,
          tuesdayHours: user.tuesdayHours,
          wednesdayStartTime: user.wednesdayStartTime,
          wednesdayHours: user.wednesdayHours,
          thursdayStartTime: user.thursdayStartTime,
          thursdayHours: user.thursdayHours,
          fridayStartTime: user.fridayStartTime,
          fridayHours: user.fridayHours,
          saturdayStartTime: user.saturdayStartTime,
          saturdayHours: user.saturdayHours,
          sundayStartTime: user.sundayStartTime,
          sundayHours: user.sundayHours,
        },
      };
    });

    res.json({ data: logsWithStats, pagination: { page, limit, total, totalPages } });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching daily logs");
    res.status(500).json({ error: "Failed to fetch daily logs" });
  }
});

router.post("/api/daily-logs", requireAuth, requirePermission("daily_reports", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const result = createDailyLogSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { logDay } = result.data;
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating daily log");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/daily-logs/submitted", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(dailyLogs.status, "SUBMITTED")];
    if (req.companyId) {
      conditions.push(eq(users.companyId, req.companyId));
    }
    const whereClause = and(...conditions);

    const [{ total: totalCount }] = await db.select({ total: count() })
      .from(dailyLogs)
      .innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(whereClause);
    const total = Number(totalCount);
    const totalPages = Math.ceil(total / limit);

    const pageLogs = await db.select().from(dailyLogs)
      .innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(dailyLogs.logDay))
      .limit(limit)
      .offset(offset);

    if (pageLogs.length === 0) {
      return res.json({ data: [], pagination: { page, limit, total, totalPages } });
    }

    const pageIds = pageLogs.map(l => l.daily_logs.id);

    const allRows = await db.select().from(logRows)
      .leftJoin(jobs, eq(logRows.jobId, jobs.id))
      .where(inArray(logRows.dailyLogId, pageIds))
      .orderBy(asc(logRows.startAt))
      .limit(1000);

    const rowsByLogId = new Map<string, Array<typeof allRows[number]>>();
    for (const row of allRows) {
      const logId = row.log_rows.dailyLogId;
      if (!rowsByLogId.has(logId)) {
        rowsByLogId.set(logId, []);
      }
      rowsByLogId.get(logId)!.push(row);
    }

    const data = pageLogs.map(logEntry => {
      const logRowEntries = rowsByLogId.get(logEntry.daily_logs.id) || [];
      const rows = logRowEntries.map(r => ({ ...r.log_rows, job: r.jobs || undefined }));
      return {
        ...logEntry.daily_logs,
        user: logEntry.users,
        rows,
      };
    });

    res.json({ data, pagination: { page, limit, total, totalPages } });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching submitted daily logs");
    res.status(500).json({ error: "Failed to fetch submitted daily logs" });
  }
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
  if (log.userId !== currentUser.id && req.companyId) {
    const logOwner = await storage.getUser(log.userId);
    if (!logOwner || logOwner.companyId !== req.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
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
  const existingLog = await storage.getDailyLog(req.params.id as string);
  if (!existingLog) {
    return res.status(404).json({ error: "Log not found" });
  }
  if (req.companyId) {
    const logOwner = await storage.getUser(existingLog.userId);
    if (!logOwner || logOwner.companyId !== req.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
  }
  const result = approveDailyLogSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  const { approve, comment } = result.data;
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
  if (log.userId !== currentUser.id && req.companyId) {
    const logOwner = await storage.getUser(log.userId);
    if (!logOwner || logOwner.companyId !== req.companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
  }
  if (log.status !== "PENDING" && log.status !== "REJECTED") {
    return res.status(400).json({ error: "Cannot edit rows in submitted/approved logs" });
  }
  const result = updateLogRowSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  const { panelMark, drawingCode, notes, jobId, workTypeId } = result.data;
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
    if (log.userId !== currentUser.id && req.companyId) {
      const logOwner = await storage.getUser(log.userId);
      if (!logOwner || logOwner.companyId !== req.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    if (log.status !== "PENDING" && log.status !== "REJECTED" && currentUser.role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot delete rows in submitted/approved logs" });
    }
    await storage.deleteLogRow(req.params.id as string);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting log row");
    res.status(500).json({ error: "An internal error occurred" });
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
    if (log.userId !== currentUser.id && req.companyId) {
      const logOwner = await storage.getUser(log.userId);
      if (!logOwner || logOwner.companyId !== req.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    if (log.status === "APPROVED" && currentUser.role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot delete approved logs" });
    }
    await storage.deleteDailyLog(req.params.id as string);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting daily log");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/manual-entry", requireAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const result = manualEntrySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { logDay, jobId, panelRegisterId, workTypeId, app, startTime, endTime, fileName, filePath,
            revitViewName, revitSheetNumber, revitSheetName, acadLayoutName,
            panelMark, drawingCode, notes, createNewPanel, newPanelMark, panelDetails } = result.data;

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
      logPanelChange(newPanel.id, "Panel created via manual entry", req.session.userId, { changedFields: { panelMark: newPanelMark, jobId }, newLifecycleStatus: 0 });
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
          logPanelChange(actualPanelRegisterId, "Panel details updated via manual entry", req.session.userId, { changedFields: updateData });
        }
      }
    }

    res.json({ ok: true, dailyLogId: dailyLog.id, newPanelCreated: createNewPanel && newPanelMark ? true : false });
  } catch (error: unknown) {
    logger.error({ err: error }, "Manual entry error");
    res.status(500).json({ error: "Failed to create time entry" });
  }
});

export const dailyLogsRouter = router;
