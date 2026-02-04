import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import multer from "multer";
import { storage, sha256Hex, db, getFactoryWorkDays, getCfmeuHolidaysInRange, addWorkingDays, subtractWorkingDays } from "./storage";
import { 
  loginSchema, agentIngestSchema, insertJobSchema, insertPanelRegisterSchema, insertWorkTypeSchema, insertWeeklyWageReportSchema, InsertItem, 
  jobs, productionSlots, panelRegister, draftingProgram, dailyLogs, logRows, productionEntries, weeklyWageReports, weeklyJobReports, weeklyJobReportSchedules,
  loadLists, loadListPanels, purchaseOrders, purchaseOrderItems, purchaseOrderAttachments, suppliers, items, itemCategories,
  conversations, conversationMembers, chatMessages, chatMessageAttachments, chatMessageReactions, chatMessageMentions, chatNotifications, userChatSettings,
  tasks, taskGroups, taskAssignees, taskUpdates, taskFiles, taskNotifications,
  productionSlotAdjustments, jobLevelCycleTimes, mappingRules, approvalEvents, productionDays, jobPanelRates, deliveryRecords,
  cfmeuHolidays, factories, productionBeds, insertFactorySchema, insertProductionBedSchema
} from "@shared/schema";
import ICAL from "ical.js";
import { z } from "zod";
import * as XLSX from "xlsx";
import { format, subDays } from "date-fns";
import { chatRouter } from "./chat/chat.routes";
import { eq, sql, inArray, and, isNotNull } from "drizzle-orm";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireRole = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
};

type PermissionLevel = "VIEW" | "VIEW_AND_UPDATE";

const requirePermission = (functionKey: string, minimumLevel: PermissionLevel = "VIEW") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (user.role === "ADMIN") {
      return next();
    }
    
    const permission = await storage.getUserPermission(req.session.userId, functionKey);
    
    if (!permission || permission.permissionLevel === "HIDDEN") {
      return res.status(403).json({ error: "Access denied to this function" });
    }
    
    if (minimumLevel === "VIEW_AND_UPDATE" && permission.permissionLevel === "VIEW") {
      return res.status(403).json({ error: "You only have view access to this function" });
    }
    
    next();
  };
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "lte-time-tracking-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // Mount chat routes
  app.use("/api/chat", chatRouter);

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const valid = await storage.validatePassword(user, data.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json({ user: { ...user, passwordHash: undefined } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", issues: error.issues });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    res.json({ user: { ...user, passwordHash: undefined } });
  });

  app.get("/api/user/settings", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    res.json({
      selectedFactoryIds: user.selectedFactoryIds || []
    });
  });

  app.put("/api/user/settings", requireAuth, async (req, res) => {
    const { selectedFactoryIds } = req.body;
    if (selectedFactoryIds !== undefined && !Array.isArray(selectedFactoryIds)) {
      return res.status(400).json({ error: "selectedFactoryIds must be an array" });
    }
    await storage.updateUserSettings(req.session.userId!, {
      selectedFactoryIds: selectedFactoryIds || null
    });
    res.json({ success: true });
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats(req.session.userId!);
    res.json(stats);
  });

  // Get all users for chat member selection (accessible to all authenticated users)
  app.get("/api/users", requireAuth, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  });

  app.get("/api/daily-logs", requireAuth, requirePermission("daily_reports"), async (req, res) => {
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
        
        // Calculate last entry end time from rows
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
          rows: fullLog.rows, // Include rows for auto-fill in Manual Entry
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

  app.post("/api/daily-logs", requireAuth, requirePermission("daily_reports", "VIEW_AND_UPDATE"), async (req, res) => {
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

  app.get("/api/daily-logs/submitted", requireRole("MANAGER", "ADMIN"), async (req, res) => {
    const logs = await storage.getSubmittedDailyLogs();
    res.json(logs);
  });

  app.get("/api/daily-logs/:id", requireAuth, async (req, res) => {
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

  app.post("/api/daily-logs/:id/submit", requireAuth, async (req, res) => {
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

  app.post("/api/daily-logs/:id/approve", requireRole("MANAGER", "ADMIN"), async (req, res) => {
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

  app.post("/api/daily-logs/:id/merge", requireAuth, async (req, res) => {
    res.json({ ok: true, message: "Merge functionality - rows with same project/app/file within 2 minutes would be merged" });
  });

  app.patch("/api/log-rows/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/log-rows/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/daily-logs/:id", requireAuth, requirePermission("daily_reports", "VIEW_AND_UPDATE"), async (req, res) => {
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

  app.delete("/api/production-days/:date", requireRole("MANAGER", "ADMIN"), async (req, res) => {
    try {
      const date = req.params.date;
      const factory = (req.query.factory as string) || "QLD";
      await storage.deleteProductionDayByDateAndFactory(date, factory);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting production day:", error);
      res.status(500).json({ error: error.message || "Failed to delete production day" });
    }
  });

  // Manual time entry - same structure as agent ingestion
  app.post("/api/manual-entry", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { logDay, jobId, panelRegisterId, workTypeId, app, startTime, endTime, fileName, filePath,
              revitViewName, revitSheetNumber, revitSheetName, acadLayoutName,
              panelMark, drawingCode, notes, createNewPanel, newPanelMark, panelDetails } = req.body;

      if (!logDay || !app || !startTime || !endTime) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Calculate duration in minutes
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const durationMin = endMinutes - startMinutes;

      if (durationMin <= 0) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      // Handle creating a new panel if requested
      let actualPanelRegisterId = panelRegisterId;
      let actualPanelMark = panelMark;
      
      if (createNewPanel && newPanelMark && jobId) {
        // Create new panel in register
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

      // Create or get daily log
      const dailyLog = await storage.upsertDailyLog({
        userId: user.id,
        logDay,
        tz: "Australia/Melbourne",
      });

      // Create a unique source event ID for manual entries
      const sourceEventId = `manual-${user.id}-${logDay}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create the log row
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

      // Update panel's actualHours if linked to a panel register
      if (actualPanelRegisterId) {
        await storage.updatePanelActualHours(actualPanelRegisterId, durationMin);
      }

      // Update panel details if provided - only update fields that have non-empty values
      if (actualPanelRegisterId && panelDetails) {
        // First verify the panel belongs to the selected job
        const panel = await storage.getPanelRegisterItem(actualPanelRegisterId);
        if (panel && panel.jobId === jobId) {
          // Filter out undefined/empty fields to avoid clearing existing values
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

          // Only update if there are fields to update
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

  // Legacy /api/projects endpoint - now redirects to jobs for backward compatibility
  app.get("/api/projects", requireAuth, async (req, res) => {
    const jobs = await storage.getAllJobs();
    res.json(jobs.map(j => ({ id: j.id, name: j.name, code: j.code || j.jobNumber })));
  });

  app.get("/api/jobs", requireAuth, async (req, res) => {
    const jobs = await storage.getAllJobs();
    res.json(jobs);
  });

  app.get("/api/panels", requireAuth, async (req, res) => {
    const jobId = req.query.jobId as string | undefined;
    const level = req.query.level as string | undefined;
    
    if (jobId && level) {
      // Filter by job and level for production slot panel breakdown
      const panels = await storage.getPanelsByJobAndLevel(jobId, level);
      res.json(panels);
    } else if (jobId) {
      const panels = await storage.getPanelsByJob(jobId);
      res.json(panels);
    } else {
      const panels = await storage.getAllPanelRegisterItems();
      res.json(panels);
    }
  });

  app.get("/api/reports", requireAuth, async (req, res) => {
    const period = req.query.period as string || "week";
    const reports = await storage.getReports(period);
    res.json(reports);
  });

  app.get("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
    let settings = await storage.getGlobalSettings();
    if (!settings) {
      settings = await storage.updateGlobalSettings({
        tz: "Australia/Melbourne",
        captureIntervalS: 300,
        idleThresholdS: 300,
        trackedApps: "revit,acad",
        requireAddins: true,
      });
    }
    res.json(settings);
  });

  app.put("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
    if (req.body.weekStartDay !== undefined) {
      const weekStartDay = parseInt(req.body.weekStartDay, 10);
      if (isNaN(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
        return res.status(400).json({ error: "weekStartDay must be a number between 0 (Sunday) and 6 (Saturday)" });
      }
      req.body.weekStartDay = weekStartDay;
    }
    if (req.body.productionWindowDays !== undefined) {
      const productionWindowDays = parseInt(req.body.productionWindowDays, 10);
      if (isNaN(productionWindowDays) || productionWindowDays < 1 || productionWindowDays > 60) {
        return res.status(400).json({ error: "productionWindowDays must be a number between 1 and 60" });
      }
      req.body.productionWindowDays = productionWindowDays;
    }
    if (req.body.ifcDaysInAdvance !== undefined) {
      const ifcDaysInAdvance = parseInt(req.body.ifcDaysInAdvance, 10);
      if (isNaN(ifcDaysInAdvance) || ifcDaysInAdvance < 1 || ifcDaysInAdvance > 60) {
        return res.status(400).json({ error: "ifcDaysInAdvance must be a number between 1 and 60" });
      }
      const currentSettings = await storage.getGlobalSettings();
      const effectiveProcurementDays = req.body.procurementDaysInAdvance ?? currentSettings?.procurementDaysInAdvance ?? 7;
      if (ifcDaysInAdvance <= effectiveProcurementDays) {
        return res.status(400).json({ error: `ifcDaysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
      }
      req.body.ifcDaysInAdvance = ifcDaysInAdvance;
    }
    if (req.body.daysToAchieveIfc !== undefined) {
      const daysToAchieveIfc = parseInt(req.body.daysToAchieveIfc, 10);
      if (isNaN(daysToAchieveIfc) || daysToAchieveIfc < 1 || daysToAchieveIfc > 90) {
        return res.status(400).json({ error: "daysToAchieveIfc must be a number between 1 and 90" });
      }
      req.body.daysToAchieveIfc = daysToAchieveIfc;
    }
    if (req.body.productionDaysInAdvance !== undefined) {
      const productionDaysInAdvance = parseInt(req.body.productionDaysInAdvance, 10);
      if (isNaN(productionDaysInAdvance) || productionDaysInAdvance < 1 || productionDaysInAdvance > 60) {
        return res.status(400).json({ error: "productionDaysInAdvance must be a number between 1 and 60" });
      }
      req.body.productionDaysInAdvance = productionDaysInAdvance;
    }
    if (req.body.procurementDaysInAdvance !== undefined) {
      const procurementDaysInAdvance = parseInt(req.body.procurementDaysInAdvance, 10);
      if (isNaN(procurementDaysInAdvance) || procurementDaysInAdvance < 1 || procurementDaysInAdvance > 60) {
        return res.status(400).json({ error: "procurementDaysInAdvance must be a number between 1 and 60" });
      }
      const currentSettings = await storage.getGlobalSettings();
      const effectiveIfcDays = req.body.ifcDaysInAdvance ?? currentSettings?.ifcDaysInAdvance ?? 14;
      if (procurementDaysInAdvance >= effectiveIfcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than ifcDaysInAdvance (${effectiveIfcDays})` });
      }
      req.body.procurementDaysInAdvance = procurementDaysInAdvance;
    }
    if (req.body.procurementTimeDays !== undefined) {
      const procurementTimeDays = parseInt(req.body.procurementTimeDays, 10);
      if (isNaN(procurementTimeDays) || procurementTimeDays < 1 || procurementTimeDays > 90) {
        return res.status(400).json({ error: "procurementTimeDays must be a number between 1 and 90" });
      }
      req.body.procurementTimeDays = procurementTimeDays;
    }
    const settings = await storage.updateGlobalSettings(req.body);
    res.json(settings);
  });

  // Logo upload endpoint
  app.post("/api/admin/settings/logo", requireRole("ADMIN"), async (req, res) => {
    try {
      const { logoBase64 } = req.body;
      if (typeof logoBase64 !== "string") {
        return res.status(400).json({ error: "Logo data is required" });
      }
      // Allow empty string to remove logo, otherwise validate it's a data URL
      if (logoBase64 !== "" && !logoBase64.startsWith("data:image/")) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      const settings = await storage.updateGlobalSettings({ logoBase64: logoBase64 || null });
      res.json({ success: true, logoBase64: settings.logoBase64 });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to upload logo" });
    }
  });

  // Company name update endpoint
  app.post("/api/admin/settings/company-name", requireRole("ADMIN"), async (req, res) => {
    try {
      const { companyName } = req.body;
      if (!companyName || typeof companyName !== "string") {
        return res.status(400).json({ error: "Company name is required" });
      }
      const settings = await storage.updateGlobalSettings({ companyName });
      res.json({ success: true, companyName: settings.companyName });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to save company name" });
    }
  });

  // Public endpoint to get the logo and company name (for reports)
  app.get("/api/settings/logo", async (req, res) => {
    const settings = await storage.getGlobalSettings();
    res.json({ 
      logoBase64: settings?.logoBase64 || null,
      companyName: settings?.companyName || "LTE Precast Concrete Structures"
    });
  });

  // Legacy /api/admin/projects endpoints - redirect to jobs for backward compatibility
  app.get("/api/admin/projects", requireRole("ADMIN"), async (req, res) => {
    const jobs = await storage.getAllJobs();
    res.json(jobs);
  });

  // Mapping rules now use jobId instead of projectId
  app.post("/api/admin/jobs/:id/rules", requireRole("ADMIN"), async (req, res) => {
    const rule = await storage.createMappingRule({
      jobId: req.params.id as string,
      pathContains: req.body.pathContains,
      priority: req.body.priority || 100,
    });
    res.json(rule);
  });

  app.delete("/api/admin/mapping-rules/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteMappingRule(req.params.id as string);
    res.json({ ok: true });
  });

  app.get("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
    const devices = await storage.getAllDevices();
    res.json(devices);
  });

  app.post("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
    const { userId, deviceName } = req.body;
    const { device, deviceKey } = await storage.createDevice({ userId, deviceName, os: "Windows" });
    res.json({ deviceId: device.id, deviceKey });
  });

  app.patch("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
    const device = await storage.updateDevice(req.params.id as string, req.body);
    res.json(device);
  });

  app.delete("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteDevice(req.params.id as string);
    res.json({ ok: true });
  });

  app.get("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  });

  app.post("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
    try {
      const existing = await storage.getUserByEmail(req.body.email);
      if (existing) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      const user = await storage.createUser(req.body);
      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create user" });
    }
  });

  app.put("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
    const user = await storage.updateUser(req.params.id as string, req.body);
    res.json({ ...user, passwordHash: undefined });
  });

  const workHoursSchema = z.object({
    mondayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    mondayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
    tuesdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    tuesdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
    wednesdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    wednesdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
    thursdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    thursdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
    fridayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    fridayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
    saturdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    saturdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
    sundayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    sundayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  });

  app.put("/api/admin/users/:id/work-hours", requireRole("ADMIN"), async (req, res) => {
    try {
      const validatedData = workHoursSchema.parse(req.body);
      const user = await storage.updateUser(req.params.id as string, validatedData);
      res.json({ ...user, passwordHash: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid work hours data", details: error.errors });
      }
      throw error;
    }
  });

  app.delete("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteUser(req.params.id as string);
    res.json({ ok: true });
  });

  app.get("/api/admin/jobs", requireRole("ADMIN"), async (req, res) => {
    const allJobs = await storage.getAllJobs();
    res.json(allJobs);
  });

  app.get("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    const job = await storage.getJob(req.params.id as string);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  app.post("/api/admin/jobs", requireRole("ADMIN"), async (req, res) => {
    try {
      const existing = await storage.getJobByNumber(req.body.jobNumber);
      if (existing) {
        return res.status(400).json({ error: "Job with this number already exists" });
      }
      const data = { ...req.body };
      // Convert productionStartDate string to Date if present
      if (data.productionStartDate && typeof data.productionStartDate === 'string') {
        data.productionStartDate = new Date(data.productionStartDate);
      }
      // Validate procurement settings - get global settings for default IFC days
      const globalSettings = await storage.getGlobalSettings();
      if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
        const val = parseInt(data.procurementDaysInAdvance, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
        }
        const ifcDays = data.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14;
        if (val >= ifcDays) {
          return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
        }
        data.procurementDaysInAdvance = val;
      }
      if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
        const val = parseInt(data.procurementTimeDays, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "procurementTimeDays must be a positive number" });
        }
        data.procurementTimeDays = val;
      }
      const job = await storage.createJob(data);
      res.json(job);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create job" });
    }
  });

  app.put("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const data = { ...req.body };
      // Convert productionStartDate string to Date if present, or null if empty
      if (data.productionStartDate !== undefined) {
        if (data.productionStartDate && typeof data.productionStartDate === 'string') {
          data.productionStartDate = new Date(data.productionStartDate);
        } else {
          data.productionStartDate = null;
        }
      }
      // Validate and parse production configuration fields
      if (data.daysToAchieveIfc !== undefined && data.daysToAchieveIfc !== null) {
        const val = parseInt(data.daysToAchieveIfc, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "daysToAchieveIfc must be a positive number" });
        }
        data.daysToAchieveIfc = val;
      }
      if (data.productionWindowDays !== undefined && data.productionWindowDays !== null) {
        const val = parseInt(data.productionWindowDays, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "productionWindowDays must be a positive number" });
        }
        data.productionWindowDays = val;
      }
      if (data.productionDaysInAdvance !== undefined && data.productionDaysInAdvance !== null) {
        const val = parseInt(data.productionDaysInAdvance, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "productionDaysInAdvance must be a positive number" });
        }
        data.productionDaysInAdvance = val;
      }
      // Validate procurement settings - get global settings and existing job for defaults
      const globalSettings = await storage.getGlobalSettings();
      const existingJob = await storage.getJob(req.params.id as string);
      
      // Cross-validate when daysInAdvance is updated
      if (data.daysInAdvance !== undefined && data.daysInAdvance !== null) {
        const newIfcDays = parseInt(data.daysInAdvance, 10);
        const effectiveProcurementDays = data.procurementDaysInAdvance ?? existingJob?.procurementDaysInAdvance ?? globalSettings?.procurementDaysInAdvance ?? 7;
        if (!isNaN(newIfcDays) && newIfcDays <= effectiveProcurementDays) {
          return res.status(400).json({ error: `daysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
        }
      }
      
      if (data.procurementDaysInAdvance !== undefined && data.procurementDaysInAdvance !== null) {
        const val = parseInt(data.procurementDaysInAdvance, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "procurementDaysInAdvance must be a positive number" });
        }
        const ifcDays = data.daysInAdvance ?? existingJob?.daysInAdvance ?? globalSettings?.ifcDaysInAdvance ?? 14;
        if (val >= ifcDays) {
          return res.status(400).json({ error: `procurementDaysInAdvance must be less than IFC days in advance (${ifcDays})` });
        }
        data.procurementDaysInAdvance = val;
      }
      if (data.procurementTimeDays !== undefined && data.procurementTimeDays !== null) {
        const val = parseInt(data.procurementTimeDays, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ error: "procurementTimeDays must be a positive number" });
        }
        data.procurementTimeDays = val;
      }
      const job = await storage.updateJob(req.params.id as string, data);
      res.json(job);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update job" });
    }
  });

  app.delete("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    const jobId = req.params.id as string;
    
    // Check if job has panels
    const panels = await storage.getPanelsByJob(jobId);
    if (panels.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete job with panels",
        message: `This job has ${panels.length} panel(s) registered. Please delete or reassign them first.`
      });
    }
    
    await storage.deleteJob(jobId);
    res.json({ ok: true });
  });

  // Job Level Cycle Times
  app.get("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req, res) => {
    try {
      const cycleTimes = await storage.getJobLevelCycleTimes(req.params.id as string);
      res.json(cycleTimes);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get level cycle times" });
    }
  });

  app.post("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req, res) => {
    try {
      const cycleTimeSchema = z.object({
        buildingNumber: z.number().int().min(1),
        level: z.string().min(1),
        levelOrder: z.number().min(0),
        cycleDays: z.number().int().min(1),
      });
      
      const bodySchema = z.object({
        cycleTimes: z.array(cycleTimeSchema),
      });
      
      const parseResult = bodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid cycle times data", details: parseResult.error.format() });
      }
      
      await storage.saveJobLevelCycleTimes(req.params.id as string, parseResult.data.cycleTimes);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to save level cycle times" });
    }
  });

  app.get("/api/admin/jobs/:id/production-slot-status", requireRole("ADMIN"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      const slots = await storage.getProductionSlots({ jobId });
      
      const hasSlots = slots.length > 0;
      const nonStartedSlots = slots.filter(s => s.status === "SCHEDULED" || s.status === "PENDING_UPDATE");
      const hasNonStartedSlots = nonStartedSlots.length > 0;
      const allStarted = hasSlots && !hasNonStartedSlots;
      
      res.json({
        hasSlots,
        hasNonStartedSlots,
        allStarted,
        totalSlots: slots.length,
        nonStartedCount: nonStartedSlots.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get production slot status" });
    }
  });

  app.post("/api/admin/jobs/:id/update-production-slots", requireRole("ADMIN"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      const { action } = req.body;
      
      if (action === "create") {
        const slots = await storage.generateProductionSlotsForJob(jobId);
        res.json({ ok: true, action: "created", count: slots.length });
      } else if (action === "update") {
        const existingSlots = await storage.getProductionSlots({ jobId });
        const nonStartedSlots = existingSlots.filter(s => s.status === "SCHEDULED" || s.status === "PENDING_UPDATE");
        
        if (nonStartedSlots.length === 0) {
          return res.json({ ok: true, action: "none", count: 0 });
        }
        
        const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
        if (!job || !job.productionStartDate || !job.expectedCycleTimePerFloor) {
          return res.status(400).json({ error: "Job missing required production fields" });
        }
        
        const levelCycleTimes = await storage.getJobLevelCycleTimes(jobId);
        const cycleTimeMap = new Map<string, number>(
          levelCycleTimes.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays])
        );
        const defaultCycleTime = job.expectedCycleTimePerFloor;
        
        // Get factory work days and CFMEU holidays for working day calculations
        const workDays = await getFactoryWorkDays(job.factoryId);
        
        // Get factory's CFMEU calendar type (if any)
        let cfmeuCalendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null = null;
        if (job.factoryId) {
          const [factory] = await db.select().from(factories).where(eq(factories.id, job.factoryId));
          if (factory?.cfmeuCalendar) {
            cfmeuCalendarType = factory.cfmeuCalendar;
          }
        }
        
        // Calculate date range for fetching holidays (2 years forward/back from onsite start)
        const onsiteStartBaseDate = new Date(job.productionStartDate);
        const holidayRangeStart = new Date(onsiteStartBaseDate);
        holidayRangeStart.setFullYear(holidayRangeStart.getFullYear() - 2);
        const holidayRangeEnd = new Date(onsiteStartBaseDate);
        holidayRangeEnd.setFullYear(holidayRangeEnd.getFullYear() + 2);
        
        const holidays = await getCfmeuHolidaysInRange(cfmeuCalendarType, holidayRangeStart, holidayRangeEnd);
        
        // Date calculation logic using WORKING DAYS:
        // 1. productionStartDate = Onsite Start Date (when builder wants us on site)
        // 2. Each level's onsite date = productionStartDate + cumulative WORKING days
        // 3. productionSlotDate = Onsite Date - production_days_in_advance WORKING days (Panel Production Due)
        const productionDaysInAdvance = job.productionDaysInAdvance ?? 10;
        
        const allSlots = existingSlots.sort((a, b) => a.levelOrder - b.levelOrder);
        let cumulativeWorkingDays = 0;
        let updatedCount = 0;
        
        for (const slot of allSlots) {
          // Calculate onsite date for this level using working days
          const onsiteDate = addWorkingDays(onsiteStartBaseDate, cumulativeWorkingDays, workDays, holidays);
          
          // Calculate panel production due date using working days
          const panelProductionDue = subtractWorkingDays(onsiteDate, productionDaysInAdvance, workDays, holidays);
          
          const levelCycleTime = cycleTimeMap.get(`${slot.buildingNumber || 1}-${slot.level}`) ?? defaultCycleTime;
          
          if (slot.status === "SCHEDULED" || slot.status === "PENDING_UPDATE") {
            await db.update(productionSlots)
              .set({ productionSlotDate: panelProductionDue, updatedAt: new Date() })
              .where(eq(productionSlots.id, slot.id));
            updatedCount++;
          }
          
          cumulativeWorkingDays += levelCycleTime;
        }
        
        res.json({ ok: true, action: "updated", count: updatedCount });
      } else {
        res.status(400).json({ error: "Invalid action" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update production slots" });
    }
  });

  // Build levels from panels for a job
  app.get("/api/admin/jobs/:id/build-levels", requireRole("ADMIN"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      const panels = await storage.getPanelsByJob(jobId);
      
      // Get existing cycle times
      const existingCycleTimes = await storage.getJobLevelCycleTimes(jobId);
      const existingMap = new Map(
        existingCycleTimes.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays])
      );
      
      // Extract unique building/level combinations
      const levelMap = new Map<string, { buildingNumber: number; level: string }>();
      
      for (const panel of panels) {
        const buildingNumber = parseInt(panel.building || '1', 10) || 1;
        let level = panel.level || 'Ground';
        
        // Extract lowest level from ranges and normalize:
        // "5-L6" -> "5", "3-L4" -> "3", "13-R" -> "13", "B1-L1" -> "1"
        // First check for range format with dash
        if (level.includes('-')) {
          const parts = level.split('-');
          // Take the first part (lowest level)
          let firstPart = parts[0].trim();
          // Strip B prefix if present (e.g., "B1" -> "1")
          firstPart = firstPart.replace(/^B/i, '');
          // Strip L prefix if present
          firstPart = firstPart.replace(/^L/i, '');
          level = firstPart;
        } else {
          // No range - just normalize the level
          // Handle mezzanine levels (ML1, M1, Mezzanine -> Mezzanine)
          if (/^M(L?\d*|ezzanine)$/i.test(level)) {
            level = 'Mezzanine';
          }
          // Strip L prefix (e.g., "L1" -> "1")
          else if (/^L\d+$/i.test(level)) {
            level = level.replace(/^L/i, '');
          }
          // Handle roof (R -> Roof)
          else if (level.toUpperCase() === 'R') {
            level = 'Roof';
          }
          // Strip B prefix if it looks like "B1" level
          else if (/^B\d+$/i.test(level)) {
            level = level.replace(/^B/i, '');
          }
        }
        
        const key = `${buildingNumber}-${level}`;
        
        if (!levelMap.has(key)) {
          levelMap.set(key, { buildingNumber, level });
        }
      }
      
      // Helper to parse level for sorting (Ground=0, Mezzanine=0.5, numbers as-is, Roof=999)
      const parseLevelOrder = (level: string): number => {
        const lowerLevel = level.toLowerCase();
        if (lowerLevel === 'ground' || lowerLevel === 'g') return 0;
        if (lowerLevel === 'mezzanine' || lowerLevel.startsWith('m')) return 0.5;
        if (lowerLevel === 'roof' || lowerLevel === 'r') return 999;
        const num = parseInt(lowerLevel, 10);
        return isNaN(num) ? 500 : num; // Unknown levels in middle
      };
      
      // Get job settings for filtering
      const job = await storage.getJob(jobId);
      const lowestLevel = parseInt(job?.lowestLevel || '0', 10);
      const highestLevel = parseInt(job?.highestLevel || '999', 10);
      const hasValidRange = !isNaN(lowestLevel) && !isNaN(highestLevel) && highestLevel >= lowestLevel;
      
      // Also add levels from existing saved cycle times (may not have panels yet)
      for (const ct of existingCycleTimes) {
        const key = `${ct.buildingNumber}-${ct.level}`;
        if (!levelMap.has(key)) {
          levelMap.set(key, { buildingNumber: ct.buildingNumber, level: ct.level });
        }
      }
      
      // Sort by building number then level order (lowest to highest)
      // Filter to only include numeric levels within the lowest/highest range
      const levels = Array.from(levelMap.values())
        .map(l => ({ ...l, levelOrder: parseLevelOrder(l.level) }))
        .filter(l => {
          // If we have a valid numeric range, filter out non-numeric levels and levels outside range
          if (hasValidRange) {
            const levelNum = parseInt(l.level, 10);
            if (isNaN(levelNum)) return false; // Skip Ground, Mezzanine, Roof, etc.
            return levelNum >= lowestLevel && levelNum <= highestLevel;
          }
          return true; // No valid range, include all levels
        })
        .sort((a, b) => {
          if (a.buildingNumber !== b.buildingNumber) return a.buildingNumber - b.buildingNumber;
          return a.levelOrder - b.levelOrder;
        });
      
      // Add existing cycle days or default (use expectedCycleTimePerFloor to match slot generation)
      const globalSettings = await storage.getGlobalSettings();
      const defaultCycleDays = job?.expectedCycleTimePerFloor ?? globalSettings?.productionCycleDays ?? 3;
      
      const result = levels.map(l => ({
        ...l,
        cycleDays: existingMap.get(`${l.buildingNumber}-${l.level}`) ?? defaultCycleDays,
      }));
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to build levels" });
    }
  });

  // Generate levels from job settings (lowest/highest level) without needing panels
  app.get("/api/admin/jobs/:id/generate-levels", requireRole("ADMIN"), async (req, res) => {
    try {
      const jobId = req.params.id as string;
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const lowestLevel = parseInt(job.lowestLevel || '1', 10);
      const highestLevel = parseInt(job.highestLevel || '1', 10);
      const numberOfBuildings = job.numberOfBuildings || 1;
      
      if (isNaN(lowestLevel) || isNaN(highestLevel) || highestLevel < lowestLevel) {
        return res.status(400).json({ error: "Invalid lowest/highest level values. Please set numeric values in Production Details." });
      }
      
      // Get existing cycle times
      const existingCycleTimes = await storage.getJobLevelCycleTimes(jobId);
      const existingMap = new Map(
        existingCycleTimes.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays])
      );
      
      const globalSettings = await storage.getGlobalSettings();
      const defaultCycleDays = job.expectedCycleTimePerFloor ?? globalSettings?.productionCycleDays ?? 3;
      
      // Generate levels for each building
      const result: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[] = [];
      
      for (let building = 1; building <= numberOfBuildings; building++) {
        for (let level = lowestLevel; level <= highestLevel; level++) {
          const key = `${building}-${level}`;
          result.push({
            buildingNumber: building,
            level: String(level),
            levelOrder: level,
            cycleDays: existingMap.get(key) ?? defaultCycleDays,
          });
        }
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate levels" });
    }
  });

  app.post("/api/admin/jobs/import", requireRole("ADMIN"), async (req, res) => {
    try {
      const { data } = req.body;
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid import data" });
      }
      
      const validStatuses = ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];
      const validStates = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
      
      const jobsToImport = data.map((row: any) => {
        const statusRaw = String(row.status || row["Status"] || "ACTIVE").toUpperCase().replace(/ /g, "_");
        const status = validStatuses.includes(statusRaw) ? statusRaw as "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED" : "ACTIVE";
        
        const stateRaw = String(row.state || row["State"] || "").toUpperCase().trim();
        const state = validStates.includes(stateRaw) ? stateRaw as "VIC" | "NSW" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT" : null;
        
        const numberOfBuildingsRaw = row.numberOfBuildings || row["Number of Buildings"] || row.number_of_buildings;
        const numberOfBuildings = numberOfBuildingsRaw ? parseInt(String(numberOfBuildingsRaw), 10) : null;
        
        return {
          jobNumber: String(row.jobNumber || row["Job Number"] || row.job_number || "").trim(),
          name: String(row.name || row["Name"] || row["Job Name"] || "").trim(),
          client: row.client || row["Client"] || null,
          address: row.address || row["Address"] || null,
          city: row.city || row["City"] || null,
          state,
          siteContact: row.siteContact || row["Site Contact"] || row.site_contact || null,
          siteContactPhone: row.siteContactPhone || row["Site Contact Phone"] || row.site_contact_phone || null,
          description: row.description || row["Description"] || null,
          numberOfBuildings: !isNaN(numberOfBuildings!) ? numberOfBuildings : null,
          levels: row.levels || row["Levels"] || null,
          status,
        };
      }).filter((j: any) => j.jobNumber && j.name);
      
      const result = await storage.importJobs(jobsToImport);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Import failed" });
    }
  });

  app.get("/api/jobs/:id/cost-overrides", requireAuth, async (req, res) => {
    const overrides = await storage.getJobCostOverrides(req.params.id as string);
    res.json(overrides);
  });

  app.post("/api/jobs/:id/cost-overrides/initialize", requireRole("ADMIN"), async (req, res) => {
    try {
      const overrides = await storage.initializeJobCostOverrides(req.params.id as string);
      res.json(overrides);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to initialize cost overrides" });
    }
  });

  app.put("/api/jobs/:jobId/cost-overrides/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const { revisedPercentage, notes } = req.body;
      if (revisedPercentage !== null && revisedPercentage !== undefined) {
        const pct = parseFloat(revisedPercentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          return res.status(400).json({ error: "Revised percentage must be between 0 and 100" });
        }
      }
      const override = await storage.updateJobCostOverride(req.params.id as string, {
        revisedPercentage: revisedPercentage !== null && revisedPercentage !== undefined ? String(revisedPercentage) : null,
        notes: notes || null,
      });
      if (!override) return res.status(404).json({ error: "Cost override not found" });
      res.json(override);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update cost override" });
    }
  });

  app.get("/api/admin/panels", requireRole("ADMIN"), async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const jobId = req.query.jobId as string | undefined;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const documentStatus = req.query.documentStatus as string | undefined;
    const factoryId = req.query.factoryId as string | undefined;
    
    const result = await storage.getPaginatedPanelRegisterItems({ page, limit, jobId, search, status, documentStatus, factoryId });
    res.json(result);
  });

  app.get("/api/admin/panels/by-job/:jobId", requireRole("ADMIN"), async (req, res) => {
    const panels = await storage.getPanelsByJob(req.params.jobId as string);
    res.json(panels);
  });

  // Panel details with history for QR code scanning
  app.get("/api/panels/:id/details", requireAuth, async (req, res) => {
    try {
      const panel = await storage.getPanelById(req.params.id as string);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      
      // Get related data
      const job = panel.jobId ? await storage.getJob(panel.jobId) : null;
      const panelType = panel.panelType ? await storage.getPanelType(panel.panelType) : null;
      const zone = panel.currentZone ? await storage.getZone(panel.currentZone) : null;
      
      // Get production entry if exists
      const productionEntry = await storage.getProductionEntryByPanelId(panel.id);
      
      // Build history from available data - only include events with real supporting data
      const history: { id: string; action: string; description: string; createdAt: string; createdBy: string | null }[] = [];
      
      // Panel creation - this is always a real event
      history.push({
        id: `${panel.id}-created`,
        action: "CREATED",
        description: `Panel ${panel.panelMark} registered in the system`,
        createdAt: panel.createdAt?.toISOString() || new Date().toISOString(),
        createdBy: null,
      });
      
      // Document validation - only if documentStatus indicates it was validated
      if (panel.documentStatus === "VALIDATED" || panel.documentStatus === "APPROVED") {
        history.push({
          id: `${panel.id}-validated`,
          action: "STATUS_CHANGED",
          description: `Document status: ${panel.documentStatus}`,
          createdAt: panel.updatedAt?.toISOString() || panel.createdAt?.toISOString() || new Date().toISOString(),
          createdBy: null,
        });
      }
      
      // Production booking - only if there's an actual production entry
      if (productionEntry) {
        history.push({
          id: `${panel.id}-booked`,
          action: "PRODUCTION",
          description: `Scheduled for production on ${new Date(productionEntry.productionDate).toLocaleDateString("en-AU")} at ${productionEntry.factory || "factory"}`,
          createdAt: productionEntry.createdAt?.toISOString() || new Date().toISOString(),
          createdBy: null,
        });
        
        // Production completion - only if the entry is marked completed
        if (productionEntry.status === "COMPLETED") {
          history.push({
            id: `${panel.id}-completed`,
            action: "STATUS_CHANGED",
            description: "Production completed",
            createdAt: productionEntry.updatedAt?.toISOString() || new Date().toISOString(),
            createdBy: null,
          });
        }
      }
      
      // Zone assignment - only if there's actually a zone assigned
      if (zone && panel.currentZone) {
        history.push({
          id: `${panel.id}-zone`,
          action: "ZONE_CHANGED",
          description: `Assigned to zone: ${zone.name}`,
          createdAt: panel.updatedAt?.toISOString() || new Date().toISOString(),
          createdBy: null,
        });
      }
      
      // Sort history by date
      history.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      res.json({
        id: panel.id,
        panelMark: panel.panelMark,
        panelType: panel.panelType,
        panelTypeName: panelType?.name || null,
        status: panel.status,
        documentStatus: panel.documentStatus,
        currentZone: panel.currentZone,
        zoneName: zone?.name || null,
        level: panel.level,
        loadWidth: panel.loadWidth,
        loadHeight: panel.loadHeight,
        panelThickness: panel.panelThickness,
        estimatedVolume: panel.estimatedVolume,
        estimatedWeight: panel.estimatedWeight,
        jobNumber: job?.jobNumber || null,
        jobName: job?.name || null,
        productionDate: productionEntry?.productionDate || null,
        deliveryDate: null, // Would come from logistics if delivered
        factory: productionEntry?.factory || null,
        createdAt: panel.createdAt?.toISOString() || new Date().toISOString(),
        history,
      });
    } catch (error: any) {
      console.error("Error fetching panel details:", error);
      res.status(500).json({ error: error.message || "Failed to fetch panel details" });
    }
  });

  app.get("/api/admin/panels/:id", requireRole("ADMIN"), async (req, res) => {
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    res.json(panel);
  });

  app.post("/api/admin/panels", requireRole("ADMIN"), async (req, res) => {
    try {
      const panel = await storage.createPanelRegisterItem(req.body);
      res.json(panel);
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        return res.status(400).json({ error: "Panel with this mark already exists for this job" });
      }
      res.status(400).json({ error: error.message || "Failed to create panel" });
    }
  });

  app.put("/api/admin/panels/:id", requireRole("ADMIN"), async (req, res) => {
    const panel = await storage.updatePanelRegisterItem(req.params.id as string, req.body);
    res.json(panel);
  });

  app.post("/api/admin/panels/:id/validate", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const panel = await storage.getPanelRegisterItem(req.params.id as string);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      if (panel.status !== "PENDING") {
        return res.status(400).json({ error: "Only panels with PENDING status can be validated" });
      }
      const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
        status: "NOT_STARTED" 
      });
      res.json(updatedPanel);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to validate panel" });
    }
  });

  // Update panel document status (for drafting register workflow)
  app.put("/api/panels/:id/document-status", requireAuth, async (req, res) => {
    try {
      const { documentStatus } = req.body;
      if (!documentStatus || !["DRAFT", "IFA", "IFC", "APPROVED"].includes(documentStatus)) {
        return res.status(400).json({ error: "Invalid document status. Must be DRAFT, IFA, IFC, or APPROVED" });
      }
      
      const panel = await storage.getPanelRegisterItem(req.params.id as string);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      
      // Only MANAGER or ADMIN can approve IFC documents for production
      if (documentStatus === "APPROVED") {
        const user = req.user as any;
        if (!["MANAGER", "ADMIN"].includes(user.role)) {
          return res.status(403).json({ error: "Only managers or admins can approve documents for production" });
        }
        // Must be in IFC status to approve
        if (panel.documentStatus !== "IFC") {
          return res.status(400).json({ error: "Panel must be in IFC status before it can be approved for production" });
        }
      }
      
      const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
        documentStatus 
      });
      res.json(updatedPanel);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update document status" });
    }
  });

  app.delete("/api/admin/panels/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deletePanelRegisterItem(req.params.id as string);
    res.json({ ok: true });
  });

  // Get panel counts by source
  app.get("/api/admin/panels/source-counts", requireRole("ADMIN"), async (req, res) => {
    const counts = await storage.getPanelCountsBySource();
    res.json(counts);
  });

  // Delete all panels by source (only if they have no production records)
  app.delete("/api/admin/panels/by-source/:source", requireRole("ADMIN"), async (req, res) => {
    try {
      const source = parseInt(req.params.source);
      if (![1, 2, 3].includes(source)) {
        return res.status(400).json({ error: "Invalid source. Must be 1 (Manual), 2 (Excel), or 3 (Estimate)" });
      }
      
      // Check if any panels from this source have production records
      const hasRecords = await storage.panelsWithSourceHaveRecords(source);
      if (hasRecords) {
        return res.status(400).json({ 
          error: "Cannot delete panels that have production records or are approved for production" 
        });
      }
      
      const deletedCount = await storage.deletePanelsBySource(source);
      res.json({ deleted: deletedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete panels" });
    }
  });

  app.post("/api/admin/panels/import", requireRole("ADMIN"), async (req, res) => {
    try {
      const { data, jobId } = req.body;
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid import data" });
      }
      
      // Get all jobs for lookup by job number
      const allJobs = await storage.getAllJobs();
      const jobsByNumber: Record<string, typeof allJobs[0]> = {};
      allJobs.forEach(job => {
        jobsByNumber[job.jobNumber.toLowerCase()] = job;
      });
      
      // Get valid panel types from the system - accept both name and code, store CODE
      const panelTypeConfigs = await storage.getAllPanelTypes();
      if (panelTypeConfigs.length === 0) {
        return res.status(400).json({ 
          error: "No panel types configured in system. Please add panel types in Settings before importing." 
        });
      }
      const panelTypesByNameOrCode = new Map<string, string>();
      panelTypeConfigs.forEach(pt => {
        const normalizedName = pt.name.toUpperCase().replace(/ /g, "_");
        const normalizedCode = pt.code.toUpperCase().replace(/ /g, "_");
        // Map both name and code to the CODE (which is what the dropdown uses)
        panelTypesByNameOrCode.set(normalizedName, pt.code);
        panelTypesByNameOrCode.set(normalizedCode, pt.code);
      });
      const panelTypesList = panelTypeConfigs.map(pt => `${pt.name} (${pt.code})`).join(", ");
      
      // If a specific jobId is provided, use it as fallback
      let fallbackJob = null;
      if (jobId) {
        fallbackJob = await storage.getJob(jobId);
      }
      
      // PHASE 1: Validate ALL rows first - collect all errors before importing anything
      const validatedRows: Array<{
        row: any;
        rowNumber: number;
        resolvedJob: any;
        panelType: string;
      }> = [];
      const errors: string[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // Excel row (1-indexed + header row)
        const rowErrors: string[] = [];
        
        // Get job number from Excel row
        const jobNumber = String(row.jobNumber || row["Job Number"] || row.job_number || row["Job"] || "").trim();
        
        // Look up job by number or use fallback
        let resolvedJob = null;
        if (jobNumber) {
          resolvedJob = jobsByNumber[jobNumber.toLowerCase()];
          if (!resolvedJob) {
            rowErrors.push(`Job "${jobNumber}" not found`);
          }
        } else if (fallbackJob) {
          resolvedJob = fallbackJob;
        } else {
          rowErrors.push(`No job specified and no fallback job selected`);
        }
        
        const panelMark = String(row.panelMark || row["Panel Mark"] || row.panel_mark || row["Mark"] || "").trim();
        if (!panelMark) {
          rowErrors.push(`Missing panel mark`);
        }
        
        const typeRaw = String(row.panelType || row["Panel Type"] || row.panel_type || row["Type"] || "").toUpperCase().replace(/ /g, "_");
        let resolvedPanelType: string | undefined;
        if (!typeRaw) {
          rowErrors.push(`Missing panel type`);
        } else {
          resolvedPanelType = panelTypesByNameOrCode.get(typeRaw);
          if (!resolvedPanelType) {
            rowErrors.push(`Invalid panel type "${typeRaw}". Valid types are: ${panelTypesList}`);
          }
        }
        
        // Collect all errors for this row
        if (rowErrors.length > 0) {
          errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}`);
        } else if (resolvedJob && resolvedPanelType) {
          validatedRows.push({ row, rowNumber, resolvedJob, panelType: resolvedPanelType });
        }
      }
      
      // PHASE 2: If ANY errors, fail the entire import - don't import anything
      if (errors.length > 0) {
        return res.status(400).json({ 
          error: `Import failed: ${errors.length} row(s) have errors. No panels were imported.`,
          details: errors.slice(0, 20) // Show first 20 errors
        });
      }
      
      if (validatedRows.length === 0) {
        return res.status(400).json({ 
          error: "No panels found in the file to import" 
        });
      }
      
      // PHASE 3: All rows validated - now build import data
      const panelsToImport = validatedRows.map(({ row, resolvedJob, panelType }) => {
        const widthRaw = row.width || row["Width"] || row["Width (mm)"] || row.loadWidth || row["Load Width"] || null;
        const heightRaw = row.height || row["Height"] || row["Height (mm)"] || row.loadHeight || row["Load Height"] || null;
        const thicknessRaw = row.thickness || row["Thickness"] || row["Thickness (mm)"] || row.panelThickness || row["Panel Thickness"] || null;
        const areaRaw = row.area || row["Area"] || row["Area (m²)"] || row["Area (m2)"] || row.panelArea || row["Panel Area"] || null;
        const volumeRaw = row.volume || row["Volume"] || row["Volume (m³)"] || row["Volume (m3)"] || row.panelVolume || row["Panel Volume"] || null;
        const weightRaw = row.weight || row["Weight"] || row["Weight (kg)"] || row.mass || row["Mass"] || row.panelMass || row["Panel Mass"] || null;
        const qtyRaw = row.qty || row["Qty"] || row.quantity || row["Quantity"] || 1;
        const panelMark = String(row.panelMark || row["Panel Mark"] || row.panel_mark || row["Mark"] || "").trim();
        
        return {
          jobId: resolvedJob.id,
          panelMark,
          panelType,
          description: row.description || row["Description"] || null,
          drawingCode: row.drawingCode || row["Drawing Code"] || row.drawing_code || null,
          sheetNumber: row.sheetNumber || row["Sheet Number"] || row.sheet_number || null,
          building: row.building || row["Building"] || null,
          zone: row.zone || row["Zone"] || null,
          level: row.level || row["Level"] || null,
          structuralElevation: row.structuralElevation || row["Structural Elevation"] || row.structural_elevation || null,
          reckliDetail: row.reckliDetail || row["Reckli Detail"] || row.reckli_detail || null,
          qty: parseInt(String(qtyRaw)) || 1,
          loadWidth: widthRaw ? String(widthRaw) : null,
          loadHeight: heightRaw ? String(heightRaw) : null,
          panelThickness: thicknessRaw ? String(thicknessRaw) : null,
          panelArea: areaRaw ? String(areaRaw) : null,
          panelVolume: volumeRaw ? String(volumeRaw) : null,
          panelMass: weightRaw ? String(weightRaw) : null,
          concreteStrengthMpa: row.concreteStrength || row["Concrete Strength"] || row["Concrete Strength (MPa)"] || row.concreteStrengthMpa || null,
          takeoffCategory: row.takeoffCategory || row["Takeoff Category"] || row["TakeOff Category"] || null,
          source: 2, // Excel Template import
          estimatedHours: row.estimatedHours || row["Estimated Hours"] || row.estimated_hours ? Number(row.estimatedHours || row["Estimated Hours"] || row.estimated_hours) : null,
          status: "NOT_STARTED" as const,
        };
      });
      
      const result = await storage.importPanelRegister(panelsToImport);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Import failed" });
    }
  });

  // Estimate Import - dynamically parses TakeOff sheets from estimate Excel files
  app.post("/api/jobs/:jobId/panels/import-estimate", 
    requireAuth, 
    requireRole("ADMIN", "MANAGER"),
    upload.single("file"),
    async (req, res) => {
      try {
        const { jobId } = req.params;
        const replace = req.body.replace === "true";
        
        // Validate job exists
        const job = await storage.getJob(jobId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        
        // Check for file
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }
        
        const fileName = req.file.originalname;
        const fileBuffer = req.file.buffer;
        const fileHash = sha256Hex(fileBuffer);
        
        console.log(`[Estimate Import] ======= NEW IMPORT STARTED =======`);
        console.log(`[Estimate Import] File: "${fileName}" (${fileBuffer.length} bytes, hash: ${fileHash.substring(0, 12)}...)`);
        
        // Parse workbook
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        
        console.log(`[Estimate Import] All sheet names in workbook:`, workbook.SheetNames);
        
        // Find TakeOff sheets
        const takeoffSheets = workbook.SheetNames.filter(name => {
          const normalized = name.toLowerCase().replace(/[\s\-]/g, "");
          return normalized.includes("takeoff");
        });
        
        console.log(`[Estimate Import] Detected TakeOff sheets:`, takeoffSheets);
        
        if (takeoffSheets.length === 0) {
          console.log(`[Estimate Import] ERROR: No TakeOff sheets found`);
          return res.status(400).json({ error: "No TakeOff sheets found in the workbook" });
        }
        
        // If replace is true, delete existing source=3 panels for this job
        if (replace) {
          await storage.deletePanelsByJobAndSource(jobId, 3);
        }
        
        // Get valid panel types from the system for validation - accept both name and code, store CODE
        const panelTypeConfigs = await storage.getAllPanelTypes();
        if (panelTypeConfigs.length === 0) {
          return res.status(400).json({ 
            error: "No panel types configured in system. Please add panel types in Settings before importing." 
          });
        }
        const panelTypesByNameOrCode = new Map<string, string>();
        panelTypeConfigs.forEach(pt => {
          const normalizedName = pt.name.toUpperCase().replace(/ /g, "_");
          const normalizedCode = pt.code.toUpperCase().replace(/ /g, "_");
          // Map both name and code to the CODE (which is what the dropdown uses)
          panelTypesByNameOrCode.set(normalizedName, pt.code);
          panelTypesByNameOrCode.set(normalizedCode, pt.code);
        });
        const panelTypesList = panelTypeConfigs.map(pt => `${pt.name} (${pt.code})`).join(", ");
        
        const results: any[] = [];
        const panelsToImport: any[] = [];
        const existingPanelSourceIds = await storage.getExistingPanelSourceIds(jobId);
        
        // Header mapping - normalized patterns (no #, (), ², ³ as these are stripped during header detection)
        const headerMapping: Record<string, string> = {
          "column": "panelMark",        // "Column #" becomes "column" after normalization
          "column no": "panelMark",
          "columnno": "panelMark",
          "panelmark": "panelMark",
          "panel mark": "panelMark",
          "mark": "panelMark",
          "element": "panelMark",       // Some sheets use "Element" for panel mark
          "building": "building",
          "zone": "zone",
          "structural elevation number": "structuralElevation",
          "structural elevation no": "structuralElevation",
          "structuralelevation": "structuralElevation",
          "structuralelevationno": "structuralElevation",
          "level": "level",
          "column type": "panelType",
          "columntype": "panelType",
          "paneltype": "panelType",
          "panel type": "panelType",
          "type": "panelType",
          "reckli detail": "reckliDetail",
          "recklidetail": "reckliDetail",
          "thickness": "thickness",
          "width": "width",
          "height": "height",
          "gross area m2": "areaM2",    // "(m²)" becomes "m2" after removing () and ²
          "gross area": "areaM2",
          "grossaream2": "areaM2",
          "net area m2": "areaM2",
          "net area": "areaM2",
          "netaream2": "areaM2",
          "area": "areaM2",
          "concrete strength mpa": "concreteStrength",
          "concrete strength": "concreteStrength",
          "concretestrength": "concreteStrength",
          "concretestrengthmpa": "concreteStrength",
          "vol m3": "volumeM3",         // "(m³)" becomes "m3" after removing () and ³
          "vol": "volumeM3",
          "volm3": "volumeM3",
          "volume": "volumeM3",
          "weight t": "weightT",
          "weight": "weightT",
          "weightt": "weightT",
          "mass": "weightT",
          "colum qty": "qty",
          "columqty": "qty",
          "qty": "qty",
          "quantity": "qty",
          "rebates": "rebates",
        };
        
        // Process each TakeOff sheet
        for (const sheetName of takeoffSheets) {
          const sheetResult = {
            sheetName,
            takeoffCategory: "",
            headerRow: -1,
            created: 0,
            duplicates: 0,
            skipped: 0,
            errors: [] as string[],
          };
          
          // Derive takeoffCategory from sheet name
          let category = sheetName
            .replace(/takeoff/gi, "")
            .replace(/take off/gi, "")
            .replace(/take-off/gi, "")
            .trim();
          if (!category) category = "Uncategorised";
          sheetResult.takeoffCategory = category;
          
          const sheet = workbook.Sheets[sheetName];
          const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });
          
          // Find header row - look for row with key headers
          let headerRow = -1;
          let headers: string[] = [];
          const requiredHeaders = ["column", "level", "thickness", "width", "height", "vol", "weight"];
          
          for (let i = 0; i < Math.min(20, data.length); i++) {
            const row = data[i];
            if (!row || row.length < 5) continue;
            
            const normalizedCells = row.map((cell: any) => 
              String(cell || "").toLowerCase().replace(/[()#²³]/g, "").trim()
            );
            
            let matches = 0;
            for (const required of requiredHeaders) {
              if (normalizedCells.some(c => c.includes(required))) matches++;
            }
            
            if (matches >= 4) {
              headerRow = i;
              headers = normalizedCells;
              break;
            }
          }
          
          if (headerRow === -1) {
            // Log first few rows for debugging
            console.log(`[Estimate Import] Sheet "${sheetName}" - Could not find header row`);
            console.log(`[Estimate Import] First 5 rows:`, data.slice(0, 5).map((r: any) => 
              r?.slice(0, 8).map((c: any) => String(c || "").substring(0, 30))
            ));
            sheetResult.errors.push("Could not find header row - sheet may have different column structure");
            results.push(sheetResult);
            continue;
          }
          
          sheetResult.headerRow = headerRow + 1; // 1-indexed for user
          
          // Log detected headers for debugging
          console.log(`[Estimate Import] Sheet "${sheetName}" - Headers found at row ${headerRow + 1}:`, headers.slice(0, 15));
          
          // Map headers to field names with priority ordering (more specific patterns first)
          const colMapping: Record<number, string> = {};
          const priorityPatterns = [
            // Panel mark patterns (most specific first)
            { patterns: ["column no", "columnno", "panel mark", "panelmark", "element", "mark", "column"], field: "panelMark" },
            { patterns: ["column type", "columntype", "panel type", "paneltype"], field: "panelType" },
            { patterns: ["structural elevation no", "structural elevation number", "structuralelevationno", "structuralelevation"], field: "structuralElevation" },
            { patterns: ["building"], field: "building" },
            { patterns: ["zone"], field: "zone" },
            { patterns: ["level"], field: "level" },
            { patterns: ["type"], field: "panelType" },
            { patterns: ["reckli detail", "recklidetail"], field: "reckliDetail" },
            { patterns: ["thickness"], field: "thickness" },
            { patterns: ["width"], field: "width" },
            { patterns: ["height"], field: "height" },
            { patterns: ["gross area", "net area", "area"], field: "areaM2" },
            { patterns: ["concrete strength", "concretestrength"], field: "concreteStrength" },
            { patterns: ["vol", "volume"], field: "volumeM3" },
            { patterns: ["weight", "mass"], field: "weightT" },
            { patterns: ["colum qty", "columqty", "qty", "quantity"], field: "qty" },
            { patterns: ["rebates"], field: "rebates" },
          ];
          
          headers.forEach((header, idx) => {
            if (colMapping[idx]) return; // Already mapped
            const normalizedHeader = header.replace(/\s+/g, " ").toLowerCase().trim();
            if (!normalizedHeader) return;
            
            for (const { patterns, field } of priorityPatterns) {
              // Skip if we already found this field
              if (Object.values(colMapping).includes(field)) continue;
              
              for (const pattern of patterns) {
                if (normalizedHeader === pattern || normalizedHeader.includes(pattern)) {
                  colMapping[idx] = field;
                  console.log(`[Estimate Import] Sheet "${sheetName}" - Mapped column ${idx}: "${header}" -> ${field}`);
                  break;
                }
              }
              if (colMapping[idx]) break;
            }
          });
          
          // Check for required columns
          const mappedFields = Object.values(colMapping);
          console.log(`[Estimate Import] Sheet "${sheetName}" - Mapped fields:`, mappedFields);
          
          if (!mappedFields.includes("panelMark")) {
            sheetResult.errors.push(`Missing required column: Column # / Panel Mark. Detected headers: ${headers.slice(0, 10).join(", ")}`);
            results.push(sheetResult);
            continue;
          }
          if (!mappedFields.includes("level") && !mappedFields.includes("thickness")) {
            sheetResult.errors.push("Missing required columns: Level or Thickness");
            results.push(sheetResult);
            continue;
          }
          
          // Find panelMark column index for key
          const panelMarkColIdx = Object.entries(colMapping).find(([_, v]) => v === "panelMark")?.[0];
          
          // Process data rows
          for (let i = headerRow + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            // Get panel mark
            const panelMark = String(row[Number(panelMarkColIdx)] || "").trim();
            
            // Skip total/summary rows
            const firstCell = String(row[0] || "").toLowerCase();
            if (["total", "subtotal", "summary"].some(t => firstCell.includes(t))) {
              continue;
            }
            
            // Skip if no panel mark and row is mostly empty
            const nonEmptyCells = row.filter((c: any) => c !== null && c !== undefined && c !== "").length;
            if (!panelMark && nonEmptyCells < 3) {
              continue; // End of data
            }
            
            if (!panelMark) {
              sheetResult.skipped++;
              continue;
            }
            
            // Extract row data
            const rowData: Record<string, any> = {};
            Object.entries(colMapping).forEach(([colIdx, field]) => {
              rowData[field] = row[Number(colIdx)];
            });
            
            // Convert numeric fields
            const thickness = parseFloat(rowData.thickness) || null;
            const width = parseFloat(rowData.width) || null;
            const height = parseFloat(rowData.height) || null;
            const areaM2 = parseFloat(rowData.areaM2) || null;
            const volumeM3 = parseFloat(rowData.volumeM3) || null;
            const weightT = parseFloat(rowData.weightT) || null;
            const qty = parseInt(rowData.qty) || 1;
            const concreteStrength = String(rowData.concreteStrength || "");
            
            // Convert measurements (thickness might be in meters, convert to mm if < 1)
            const thicknessMm = thickness ? (thickness < 1 ? thickness * 1000 : thickness) : null;
            const widthMm = width ? (width < 10 ? width * 1000 : width) : null;
            const heightMm = height ? (height < 10 ? height * 1000 : height) : null;
            
            // Weight conversion (T to kg)
            const weightKg = weightT ? weightT * 1000 : null;
            
            // Calculate panelSourceId for idempotency
            const sourceRowNum = i + 1; // 1-indexed
            const panelSourceId = sha256Hex(
              `${jobId}-${fileHash}-${sheetName}-${sourceRowNum}-${panelMark}-${rowData.structuralElevation || ""}`
            );
            
            // Check if already exists
            if (existingPanelSourceIds.has(panelSourceId)) {
              sheetResult.duplicates++;
              continue;
            }
            
            // Determine panel type from column type or category
            const typeRaw = String(rowData.panelType || category || "").toUpperCase().replace(/\s+/g, "_");
            let panelType: string | undefined;
            
            // First check if the exact type (name or code) is in the valid panel types
            if (panelTypesByNameOrCode.has(typeRaw)) {
              panelType = panelTypesByNameOrCode.get(typeRaw);
            } else {
              // Try to match by keyword from configured panel type NAMES (not codes)
              // The map values are codes, so we need to search the keys (which include names)
              const matchedKey = Array.from(panelTypesByNameOrCode.keys()).find(key => 
                typeRaw.includes(key) || key.includes(typeRaw)
              );
              if (matchedKey) {
                panelType = panelTypesByNameOrCode.get(matchedKey);
              } else {
                // Error on unrecognized panel type - don't silently default
                sheetResult.errors.push(`Row ${sourceRowNum}: Invalid panel type "${typeRaw}". Valid types are: ${panelTypesList}`);
                continue;
              }
            }
            
            // Default building to "1" if no building and no zone provided
            const buildingValue = rowData.building ? String(rowData.building) : (rowData.zone ? "" : "1");
            
            // Normalize level: extract lowest level from ranges like "5-L6" -> "5", "3-L4" -> "3"
            // Also strip "L" prefix (e.g., "L1" -> "1", "L10" -> "10")
            const rawLevel = String(rowData.level || "").trim();
            let normalizedLevel = rawLevel;
            
            // Check for range format like "5-L6", "3-L4", "7-L8"
            const rangeMatch = rawLevel.match(/^(\d+|L\d+|Ground)-?(L?\d+|Roof)?$/i);
            if (rangeMatch && rangeMatch[2]) {
              // It's a range - take the first (lowest) part
              normalizedLevel = rangeMatch[1];
            }
            // Strip "L" prefix from the result
            normalizedLevel = normalizedLevel.replace(/^L/i, "");
            
            panelsToImport.push({
              jobId,
              panelMark,
              panelType,
              building: buildingValue,
              zone: String(rowData.zone || ""),
              level: normalizedLevel,
              structuralElevation: String(rowData.structuralElevation || ""),
              reckliDetail: String(rowData.reckliDetail || ""),
              qty,
              takeoffCategory: category,
              concreteStrengthMpa: concreteStrength,
              panelThickness: thicknessMm ? String(thicknessMm) : null,
              loadWidth: widthMm ? String(widthMm) : null,
              loadHeight: heightMm ? String(heightMm) : null,
              panelArea: areaM2 ? String(areaM2) : null,
              panelVolume: volumeM3 ? String(volumeM3) : null,
              panelMass: weightKg ? String(weightKg) : null,
              sourceFileName: fileName,
              sourceSheet: sheetName,
              sourceRow: sourceRowNum,
              panelSourceId,
              source: 3, // Estimate import
              status: "PENDING" as const,
            });
            
            sheetResult.created++;
            existingPanelSourceIds.add(panelSourceId);
          }
          
          results.push(sheetResult);
        }
        
        // ALL-OR-NOTHING: Check if any sheet has errors before importing anything
        const allErrors: string[] = [];
        for (const sheetResult of results) {
          for (const err of sheetResult.errors) {
            allErrors.push(`[${sheetResult.sheetName}] ${err}`);
          }
        }
        
        if (allErrors.length > 0) {
          return res.status(400).json({
            error: `Import failed: ${allErrors.length} error(s) found. No panels were imported.`,
            details: allErrors.slice(0, 20),
            sheets: results.map(r => ({
              sheetName: r.sheetName,
              errors: r.errors,
            })),
          });
        }
        
        if (panelsToImport.length === 0) {
          return res.status(400).json({
            error: "No panels found to import. Check that the file has valid TakeOff data.",
          });
        }
        
        // No errors - proceed with import
        let imported = 0;
        let importErrors: string[] = [];
        
        try {
          const importResult = await storage.importEstimatePanels(panelsToImport);
          imported = importResult.imported;
          importErrors = importResult.errors || [];
        } catch (err: any) {
          importErrors.push(err.message);
        }
        
        // Calculate totals
        const totals = {
          created: results.reduce((sum, r) => sum + r.created, 0),
          duplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
          skipped: results.reduce((sum, r) => sum + r.skipped, 0),
          imported,
          sheetsProcessed: results.length,
        };
        
        res.json({
          success: true,
          totals,
          sheets: results,
          errors: importErrors.length > 0 ? importErrors.slice(0, 10) : undefined,
        });
      } catch (error: any) {
        console.error("Estimate import error:", error);
        res.status(500).json({ error: error.message || "Failed to import estimate" });
      }
    }
  );

  // Get job totals (m2, m3, elements)
  app.get("/api/jobs/:jobId/totals", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const panels = await storage.getPanelsByJob(jobId);
      
      let totalAreaM2 = 0;
      let totalVolumeM3 = 0;
      let totalElements = 0;
      let pendingCount = 0;
      let validatedCount = 0;
      
      for (const panel of panels) {
        const qty = panel.qty || 1;
        totalElements += qty;
        
        if (panel.panelArea) {
          totalAreaM2 += parseFloat(panel.panelArea) * qty;
        }
        if (panel.panelVolume) {
          totalVolumeM3 += parseFloat(panel.panelVolume) * qty;
        }
        
        if (panel.status === "PENDING") {
          pendingCount += qty;
        } else {
          validatedCount += qty;
        }
      }
      
      res.json({
        totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
        totalVolumeM3: Math.round(totalVolumeM3 * 1000) / 1000,
        totalElements,
        pendingCount,
        validatedCount,
        panelCount: panels.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get job totals" });
    }
  });

  app.get("/api/jobs", requireAuth, async (req, res) => {
    const allJobs = await storage.getAllJobs();
    res.json(allJobs.filter(j => j.status === "ACTIVE"));
  });

  app.get("/api/panels/by-job/:jobId", requireAuth, async (req, res) => {
    const panels = await storage.getPanelsByJob(req.params.jobId as string);
    res.json(panels);
  });

  app.get("/api/production-entries", requireAuth, requirePermission("production_report"), async (req, res) => {
    const date = req.query.date as string;
    if (date) {
      const entries = await storage.getProductionEntriesByDate(date);
      res.json(entries);
    } else {
      const entries = await storage.getAllProductionEntries();
      res.json(entries);
    }
  });

  app.get("/api/production-entries/:id", requireAuth, requirePermission("production_report"), async (req, res) => {
    const entry = await storage.getProductionEntry(req.params.id as string);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  });

  app.post("/api/production-entries", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      // Validate that the panel is approved for production
      const { panelId, loadWidth, loadHeight, panelThickness, panelVolume, panelMass, ...entryFields } = req.body;
      if (panelId) {
        const panel = await storage.getPanelById(panelId);
        if (!panel) {
          return res.status(404).json({ error: "Panel not found" });
        }
        // Check both approvedForProduction flag and documentStatus
        if (!panel.approvedForProduction) {
          return res.status(400).json({ error: "Panel is not approved for production. Please approve the panel in the Panel Register first." });
        }
        if (panel.documentStatus !== "APPROVED") {
          return res.status(400).json({ error: "Panel document status must be 'Approved for Production'. Current status: " + (panel.documentStatus || "DRAFT") + ". Please update the document status in the Drafting Register first." });
        }
        
        // Update panel with final dimensions if provided
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

  app.put("/api/production-entries/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { loadWidth, loadHeight, panelThickness, panelVolume, panelMass, panelId, status, ...entryFields } = req.body;
      
      // Update panel with final dimensions if provided
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
        
        // Update panel status to COMPLETED when production entry is marked as completed
        if (status === "COMPLETED") {
          await storage.updatePanelRegisterItem(panelId, { status: "COMPLETED" });
          
          // Check if all panels for this slot are completed and auto-complete the slot
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

  app.delete("/api/production-entries/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    await storage.deleteProductionEntry(req.params.id as string);
    res.json({ ok: true });
  });

  // Batch update production entry statuses
  app.put("/api/production-entries/batch-status", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    const { entryIds, status } = req.body;
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0 || !status) {
      return res.status(400).json({ error: "entryIds array and status required" });
    }
    if (!["PENDING", "COMPLETED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be PENDING or COMPLETED" });
    }
    // Validate all entries exist before updating and collect panel IDs
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
    // Update production entry statuses
    const updated = await Promise.all(
      validEntries.map(e => storage.updateProductionEntry(e.id, { status }))
    );
    
    // When marking as COMPLETED, also update the panel status to COMPLETED and check slot completion
    if (status === "COMPLETED") {
      const uniquePanelIds = Array.from(new Set(validEntries.map(e => e.panelId)));
      
      // Update all panels to COMPLETED
      await Promise.all(
        uniquePanelIds.map(panelId => storage.updatePanelRegisterItem(panelId, { status: "COMPLETED" }))
      );
      
      // Check if slots should be auto-completed for each affected panel's level
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
      
      // Check and complete slots for each unique level
      for (const { jobId, level, building } of slotsToCheck.values()) {
        await storage.checkAndCompleteSlotByPanelCompletion(jobId, level, building);
      }
    }
    
    res.json({ updated: updated.length });
  });

  // Get production entries for panels in a slot (job + level)
  app.get("/api/production-slots/:slotId/panel-entries", requireAuth, requirePermission("production_report", "VIEW"), async (req, res) => {
    try {
      const { slotId } = req.params;
      const slot = await storage.getProductionSlot(slotId);
      if (!slot) {
        return res.status(404).json({ error: "Production slot not found" });
      }
      
      // Get all panels for this job/level
      const panels = await storage.getPanelsByJobAndLevel(slot.jobId, slot.level);
      
      // Get production entries for these panels
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
  
  // Unbook a panel (delete production entry)
  app.delete("/api/production-entries/:entryId", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { entryId } = req.params;
      const entry = await storage.getProductionEntry(entryId);
      if (!entry) {
        return res.status(404).json({ error: "Production entry not found" });
      }
      
      // Reset panel status back to PENDING
      if (entry.panelId) {
        await storage.updatePanelRegisterItem(entry.panelId, { status: "PENDING" });
      }
      
      await storage.deleteProductionEntry(entryId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete production entry" });
    }
  });

  // Bulk assign panels to production dates (for Production Slots workflow)
  app.post("/api/production-slots/:slotId/assign-panels", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { slotId } = req.params;
      const { panelAssignments, factory } = req.body as {
        panelAssignments: { panelId: string; productionDate: string }[];
        factory?: string;
      };

      if (!panelAssignments || !Array.isArray(panelAssignments) || panelAssignments.length === 0) {
        return res.status(400).json({ error: "Panel assignments are required" });
      }

      // Get the production slot and global settings for validation
      const slot = await storage.getProductionSlot(slotId);
      if (!slot) {
        return res.status(404).json({ error: "Production slot not found" });
      }
      
      // Verify slot is in BOOKED status
      if (slot.status !== "BOOKED") {
        return res.status(400).json({ error: "Production slot must be in BOOKED status to assign panels" });
      }
      
      // Get job details to derive factory
      const job = await storage.getJob(slot.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found for production slot" });
      }
      
      // Use job-level productionWindowDays or fall back to global settings
      const settings = await storage.getGlobalSettings();
      const productionWindowDays = job.productionWindowDays ?? settings?.productionWindowDays ?? 10;
      
      // Calculate production window boundaries
      const dueDate = new Date(slot.productionSlotDate);
      const startDate = new Date(dueDate);
      startDate.setDate(startDate.getDate() - productionWindowDays);

      const results: { created: number; skipped: number; errors: string[] } = { created: 0, skipped: 0, errors: [] };
      // Derive factory from job state (QLD vs VIC)
      const targetFactory = job.state === "QLD" ? "QLD" : "VIC";

      for (const assignment of panelAssignments) {
        try {
          // Validate production date is within the window
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
          
          // Verify panel belongs to the slot's job and level
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

          // Check if panel already has a production entry
          const existingEntry = await storage.getProductionEntryByPanelId(assignment.panelId);
          if (existingEntry) {
            results.errors.push(`Panel ${panel.panelMark} already has a production entry`);
            results.skipped++;
            continue;
          }

          // Create the production entry
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
          
          // Update panel status to BOOKED
          await storage.updatePanelRegisterItem(assignment.panelId, { status: "BOOKED" });
          
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

  app.get("/api/production-summary", requireAuth, async (req, res) => {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: "Date required" });
    const summary = await storage.getProductionSummaryByDate(date);
    res.json(summary);
  });

  app.get("/api/production-summary-with-costs", requireAuth, async (req, res) => {
    const date = req.query.date as string;
    const factoryFilter = req.query.factory as string | undefined;
    if (!date) return res.status(400).json({ error: "Date required" });
    
    // If factory filter specified, use the factory-filtered query
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

  // Get production reports list (grouped by date and factory)
  app.get("/api/production-reports", requireAuth, async (req, res) => {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no range specified
    const end = endDate ? String(endDate) : format(new Date(), "yyyy-MM-dd");
    const start = startDate ? String(startDate) : format(subDays(new Date(), 30), "yyyy-MM-dd");
    
    // Get production days (manually created)
    const productionDaysData = await storage.getProductionDays(start, end);
    
    // Get entries
    const entries = await storage.getProductionEntriesInRange(start, end);
    
    // Group entries by date + factory
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
    
    // First, add all production days (even empty ones)
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
    
    // Then add entries
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
      
      // Count by status
      const status = (entry as any).status || "PENDING";
      if (status === "COMPLETED") {
        report.completedCount++;
      } else {
        report.draftCount++;
      }
    }
    
    // Convert to array and sort by date descending, then factory
    const reports = Array.from(reportsByKey.values())
      .map(r => ({
        ...r,
        jobCount: r.jobIds.size,
        jobIds: undefined, // Remove the Set from response
      }))
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return a.factory.localeCompare(b.factory);
      });
    
    res.json(reports);
  });

  // Create a new production day
  app.post("/api/production-days", requireAuth, async (req, res) => {
    try {
      const { productionDate, factory, notes } = req.body;
      
      if (!productionDate || !factory) {
        return res.status(400).json({ error: "Date and factory are required" });
      }
      
      // Check if day already exists
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

  app.get("/api/admin/panel-types", requireRole("ADMIN"), async (req, res) => {
    const types = await storage.getAllPanelTypes();
    res.json(types);
  });

  // Get cost breakup summaries for all panel types (for margin validation) - MUST be before :id route
  app.get("/api/admin/panel-types/cost-summaries", requireRole("ADMIN"), async (req, res) => {
    try {
      const types = await storage.getAllPanelTypes();
      const summaries: Record<string, { totalCostPercent: number; profitMargin: number }> = {};
      
      for (const type of types) {
        const components = await storage.getCostComponentsByPanelType(type.id);
        const totalCostPercent = components.reduce((sum, c) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
        summaries[type.id] = {
          totalCostPercent,
          profitMargin: 100 - totalCostPercent,
        };
      }
      
      res.json(summaries);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch cost summaries" });
    }
  });

  app.get("/api/admin/panel-types/:id", requireRole("ADMIN"), async (req, res) => {
    const type = await storage.getPanelType(req.params.id as string);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    res.json(type);
  });

  app.post("/api/admin/panel-types", requireRole("ADMIN"), async (req, res) => {
    try {
      const type = await storage.createPanelType(req.body);
      res.json(type);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create panel type" });
    }
  });

  app.put("/api/admin/panel-types/:id", requireRole("ADMIN"), async (req, res) => {
    const type = await storage.updatePanelType(req.params.id as string, req.body);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    res.json(type);
  });

  app.delete("/api/admin/panel-types/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deletePanelType(req.params.id as string);
    res.json({ ok: true });
  });

  app.get("/api/panel-types/:id/cost-components", requireAuth, async (req, res) => {
    const components = await storage.getCostComponentsByPanelType(req.params.id as string);
    res.json(components);
  });

  app.put("/api/panel-types/:id/cost-components", requireRole("ADMIN"), async (req, res) => {
    try {
      const { components } = req.body;
      if (!Array.isArray(components)) {
        return res.status(400).json({ error: "components array required" });
      }
      const total = components.reduce((sum: number, c: any) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
      if (total > 100) {
        return res.status(400).json({ error: "Total percentage cannot exceed 100%" });
      }
      const inserted = await storage.replaceCostComponents(req.params.id as string, 
        components.map((c: any, i: number) => ({
          panelTypeId: req.params.id as string,
          name: c.name,
          percentageOfRevenue: String(c.percentageOfRevenue),
          sortOrder: i,
        }))
      );
      res.json(inserted);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update cost components" });
    }
  });

  app.get("/api/panel-types", requireAuth, async (req, res) => {
    const types = await storage.getAllPanelTypes();
    res.json(types.filter(t => t.isActive));
  });

  // Panel rates now use jobs instead of projects
  app.get("/api/jobs/:jobId/panel-rates", requireAuth, async (req, res) => {
    const rates = await storage.getEffectiveRates(req.params.jobId as string);
    res.json(rates);
  });

  app.put("/api/jobs/:jobId/panel-rates/:panelTypeId", requireRole("ADMIN"), async (req, res) => {
    try {
      const rate = await storage.upsertJobPanelRate(req.params.jobId as string, req.params.panelTypeId as string, req.body);
      res.json(rate);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update job rate" });
    }
  });

  app.delete("/api/jobs/:jobId/panel-rates/:rateId", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteJobPanelRate(req.params.rateId as string);
    res.json({ ok: true });
  });

  // Work Types Routes
  app.get("/api/work-types", requireAuth, async (req, res) => {
    const types = await storage.getActiveWorkTypes();
    res.json(types);
  });

  app.get("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
    const types = await storage.getAllWorkTypes();
    res.json(types);
  });

  app.post("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = insertWorkTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid work type data", issues: parsed.error.issues });
      }
      const workType = await storage.createWorkType(parsed.data);
      res.json(workType);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create work type" });
    }
  });

  app.put("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = insertWorkTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid work type data", issues: parsed.error.issues });
      }
      const workType = await storage.updateWorkType(parseInt(req.params.id as string), parsed.data);
      if (!workType) {
        return res.status(404).json({ error: "Work type not found" });
      }
      res.json(workType);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update work type" });
    }
  });

  app.delete("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteWorkType(parseInt(req.params.id as string));
    res.json({ ok: true });
  });

  // User Permissions
  app.get("/api/admin/user-permissions", requireRole("ADMIN"), async (req, res) => {
    const data = await storage.getAllUserPermissionsForAdmin();
    res.json(data);
  });

  app.get("/api/admin/user-permissions/:userId", requireRole("ADMIN"), async (req, res) => {
    const permissions = await storage.getUserPermissions(req.params.userId);
    res.json(permissions);
  });

  app.post("/api/admin/user-permissions/:userId/initialize", requireRole("ADMIN"), async (req, res) => {
    const permissions = await storage.initializeUserPermissions(req.params.userId);
    res.json(permissions);
  });

  app.put("/api/admin/user-permissions/:userId/:functionKey", requireRole("ADMIN"), async (req, res) => {
    const { permissionLevel } = req.body;
    if (!permissionLevel || !["HIDDEN", "VIEW", "VIEW_AND_UPDATE"].includes(permissionLevel)) {
      return res.status(400).json({ error: "Invalid permission level" });
    }
    const permission = await storage.setUserPermission(
      req.params.userId,
      req.params.functionKey as any,
      permissionLevel
    );
    res.json(permission);
  });

  app.get("/api/my-permissions", requireAuth, async (req, res) => {
    const permissions = await storage.getUserPermissions(req.user!.id);
    res.json(permissions);
  });

  app.post("/api/agent/ingest", async (req, res) => {
    try {
      const rawKey = req.headers["x-device-key"] as string;
      if (!rawKey) {
        return res.status(401).json({ error: "Missing device key" });
      }

      const deviceKeyHash = sha256Hex(rawKey);
      const device = await storage.getDeviceByApiKey(deviceKeyHash);
      if (!device) {
        return res.status(401).json({ error: "Invalid device key" });
      }

      const parsed = agentIngestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
      }

      const body = parsed.data;

      await storage.updateDevice(device.id, {
        lastSeenAt: new Date(),
        deviceName: body.deviceName,
        os: body.os,
        agentVersion: body.agentVersion || undefined,
      });

      const createdOrUpdated: string[] = [];
      const rules = await storage.getMappingRules();

      for (const b of body.blocks) {
        if (b.userEmail.toLowerCase() !== device.user.email.toLowerCase()) continue;

        const dailyLog = await storage.upsertDailyLog({
          userId: device.user.id,
          logDay: b.logDay,
          tz: body.tz,
        });

        let mappedJobId: string | null = null;
        if (!b.jobId && b.filePath) {
          const match = rules.find(r => b.filePath!.toLowerCase().includes(r.pathContains.toLowerCase()));
          if (match) mappedJobId = match.jobId;
        }

        await storage.upsertLogRow(b.sourceEventId, {
          dailyLogId: dailyLog.id,
          jobId: b.jobId || mappedJobId || undefined,
          startAt: new Date(b.startedAt),
          endAt: new Date(b.endedAt),
          durationMin: b.durationMin,
          idleMin: b.idleMin,
          source: b.source || "agent",
          tz: body.tz,
          app: b.app,
          filePath: b.filePath || undefined,
          fileName: b.fileName || undefined,
          revitViewName: b.revit?.viewName || undefined,
          revitSheetNumber: b.revit?.sheetNumber || undefined,
          revitSheetName: b.revit?.sheetName || undefined,
          acadLayoutName: b.acad?.layoutName || undefined,
          rawPanelMark: b.rawPanelMark || undefined,
          rawDrawingCode: b.rawDrawingCode || undefined,
          panelMark: b.rawPanelMark || undefined,
          drawingCode: b.rawDrawingCode || undefined,
        });

        createdOrUpdated.push(b.sourceEventId);
      }

      res.json({ ok: true, count: createdOrUpdated.length });
    } catch (error) {
      console.error("Agent ingest error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // KPI Reporting endpoints for period-based data
  app.get("/api/reports/production-daily", requireAuth, async (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }
    
    const entries = await storage.getProductionEntriesInRange(startDate, endDate);
    const allPanelTypes = await storage.getAllPanelTypes();
    const panelTypesByCode = new Map(allPanelTypes.map(pt => [pt.code, pt]));
    
    // Helper to normalize panel type code using configured types
    const normalizePanelType = (code: string | null): string => {
      if (!code) return "OTHER";
      // Check if code exists in configured panel types
      if (panelTypesByCode.has(code)) return code;
      // Check case-insensitive match
      for (const [configuredCode] of Array.from(panelTypesByCode)) {
        if (configuredCode.toLowerCase() === code.toLowerCase()) return configuredCode;
      }
      return code; // Return original code if no configured match
    };
    
    // Aggregate by date
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
      
      // Normalize panel type using configured types
      const panelType = normalizePanelType(entry.panel.panelType);
      if (!day.byPanelType.has(panelType)) {
        day.byPanelType.set(panelType, { count: 0, volumeM3: 0, areaM2: 0 });
      }
      const typeData = day.byPanelType.get(panelType)!;
      typeData.count += 1;
      typeData.volumeM3 += parseFloat(entry.volumeM3 || "0");
      typeData.areaM2 += parseFloat(entry.areaM2 || "0");
    }
    
    // Convert to array and sort by date
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
    
    // Calculate totals
    const totals = {
      panelCount: result.reduce((sum, d) => sum + d.panelCount, 0),
      volumeM3: Math.round(result.reduce((sum, d) => sum + d.volumeM3, 0) * 100) / 100,
      areaM2: Math.round(result.reduce((sum, d) => sum + d.areaM2, 0) * 100) / 100,
    };
    
    // Get unique panel types used in period (normalized to match configured types)
    const panelTypesUsed = Array.from(new Set(entries.map(e => normalizePanelType(e.panel.panelType))));
    
    res.json({
      dailyData: result,
      totals,
      panelTypes: panelTypesUsed,
      period: { startDate, endDate },
    });
  });

  app.get("/api/reports/drafting-daily", requireAuth, async (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }
    
    // Batch fetch logs with rows and users in efficient queries (2 queries total)
    const logsWithRows = await storage.getDailyLogsWithRowsInRange(startDate, endDate);
    
    // Collect unique job IDs from rows to batch fetch only needed jobs
    const jobIds = new Set<string>();
    for (const { rows } of logsWithRows) {
      for (const row of rows) {
        if (row.jobId) jobIds.add(row.jobId);
      }
    }
    
    // Fetch only jobs that are referenced in the data
    const allJobs = await storage.getAllJobs();
    const jobsMap = new Map(allJobs.filter(j => jobIds.has(j.id)).map(j => [j.id, j]));
    
    // Fetch work types for mapping
    const allWorkTypes = await storage.getActiveWorkTypes();
    const workTypesMap = new Map(allWorkTypes.map(wt => [wt.id, wt]));
    
    // Aggregate by date
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
        
        // By user - use preloaded user data
        const userName = user.name || user.email;
        if (!day.byUser.has(user.id)) {
          day.byUser.set(user.id, { name: userName, minutes: 0, idle: 0 });
        }
        const userData = day.byUser.get(user.id)!;
        userData.minutes += row.durationMin;
        userData.idle += row.idleMin;
        
        // By app
        const app = row.app;
        day.byApp.set(app, (day.byApp.get(app) || 0) + row.durationMin);
        
        // By job - use preloaded job data
        if (row.jobId) {
          const job = jobsMap.get(row.jobId);
          if (job) {
            if (!day.byJob.has(job.id)) {
              day.byJob.set(job.id, { name: job.name, minutes: 0 });
            }
            day.byJob.get(job.id)!.minutes += row.durationMin;
          }
        }
        
        // By work type
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
        
        // By panel mark
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
    
    // Convert to array and sort by date
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
    
    // Aggregate work type totals across all days
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
    
    // Calculate rework metrics
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
    
    // Calculate totals
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

  app.get("/api/reports/production-with-costs", requireAuth, async (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate required" });
    }
    
    const entries = await storage.getProductionEntriesInRange(startDate, endDate);
    const allPanelTypes = await storage.getAllPanelTypes();
    const panelTypesByCode = new Map(allPanelTypes.map(pt => [pt.code, pt]));
    
    // Helper to normalize panel type code using configured types
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
    
    // Aggregate by date with costs
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
    
    // Convert to array and round values
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
    
    // Calculate totals
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
    
    // Get unique panel types used in period (normalized to match configured types)
    const panelTypesUsed = Array.from(new Set(entries.map(e => normalizePanelType(e.panel.panelType))));
    
    res.json({
      dailyData: result,
      totals,
      panelTypes: panelTypesUsed,
      period: { startDate, endDate },
    });
  });

  app.get("/api/reports/cost-analysis", requireAuth, async (req, res) => {
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
    const panelTypesById = new Map(allPanelTypes.map(pt => [pt.id, pt]));
    
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

  app.get("/api/reports/cost-analysis-daily", requireAuth, async (req, res) => {
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

  // Labour Cost Analysis - compares estimated labour (from cost components %) vs actual labour (from weekly wages)
  app.get("/api/reports/labour-cost-analysis", requireAuth, async (req, res) => {
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
    
    // Get labour percentage from cost components
    const getLabourPercentage = async (jobId: string, panelTypeCode: string): Promise<number> => {
      const normalizedCode = normalizePanelType(panelTypeCode);
      const panelType = panelTypesByCode.get(normalizedCode);
      if (!panelType) return 0;
      
      // Check for job-level overrides first
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
      
      // Fall back to panel type cost components
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
    
    // Calculate daily estimated labour
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
    
    // Get weekly wage reports to calculate actual labour
    const allWeeklyWages = await storage.getWeeklyWageReports(startDate, endDate);
    const weeklyWages = factory && factory !== "all" 
      ? allWeeklyWages.filter(w => w.factory === factory)
      : allWeeklyWages;
    
    // Calculate actual production wages per day by distributing weekly wages
    // We'll distribute weekly production wages across days proportionally to production volume
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
    
    // Calculate total revenue per week for proportional distribution
    const dailyDataArray = Array.from(dailyData.values());
    const weeklyArray = Array.from(weeklyActualLabour.values());
    
    for (const day of dailyDataArray) {
      for (const week of weeklyArray) {
        if (day.date >= week.weekStart && day.date <= week.weekEnd) {
          week.totalRevenue += day.revenue;
        }
      }
    }
    
    // Build daily results with actual labour distributed proportionally
    const result = dailyDataArray
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => {
        let actualLabour = 0;
        
        // Find which week this day belongs to and distribute wages proportionally
        for (const week of weeklyArray) {
          if (d.date >= week.weekStart && d.date <= week.weekEnd && week.totalRevenue > 0) {
            // Distribute production wages proportionally to this day's revenue share
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
    
    // Calculate totals
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

  // Logistics reporting - panels shipped per day and delivery phase timing
  app.get("/api/reports/logistics", requireAuth, async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate required" });
      }
      
      // Get all completed load lists with delivery records in the date range
      const allLoadLists = await storage.getAllLoadLists();
      const completedLoadLists = allLoadLists.filter(ll => 
        ll.status === 'COMPLETE' && 
        ll.deliveryRecord?.deliveryDate &&
        ll.deliveryRecord.deliveryDate >= startDate &&
        ll.deliveryRecord.deliveryDate <= endDate
      );
      
      // Group by delivery date
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
      
      // Calculate phase timings from delivery records
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
        if (diff < 0) diff += 24 * 60; // Handle overnight
        return diff;
      };
      
      // Aggregate all delivery timings for phase analysis
      const phaseTimings = {
        depotToLte: [] as number[],        // leaveDepotTime -> arriveLteTime
        pickupTime: [] as number[],         // pickupArriveTime -> pickupLeaveTime
        holdingTime: [] as number[],        // arriveHoldingTime -> leaveHoldingTime
        unloadTime: [] as number[],         // siteFirstLiftTime -> siteLastLiftTime
        totalOnsite: [] as number[],        // siteFirstLiftTime -> returnDepotArriveTime (or siteLastLiftTime as proxy)
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
      
      // Build daily data array
      const dailyData = Array.from(byDate.entries())
        .map(([date, data]) => ({
          date,
          panelCount: data.panelCount,
          loadListCount: data.loadListCount,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate totals
      const totals = {
        totalPanels: dailyData.reduce((sum, d) => sum + d.panelCount, 0),
        totalLoadLists: dailyData.reduce((sum, d) => sum + d.loadListCount, 0),
        avgPanelsPerDay: dailyData.length > 0 
          ? Math.round(dailyData.reduce((sum, d) => sum + d.panelCount, 0) / dailyData.length * 10) / 10
          : 0,
      };
      
      // Phase averages
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

  // Panel production approval - Analyze PDF using OpenAI
  app.post("/api/admin/panels/:id/analyze-pdf", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const { id } = req.params;
      const { pdfBase64 } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      const panel = await storage.getPanelById(id as string);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      
      // Use OpenAI to analyze the PDF and extract panel specifications
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are a technical document analyzer specializing in precast concrete panel specifications.
Extract the following fields from the provided panel drawing/specification document. Return a JSON object with these fields:
- loadWidth: Panel load width in mm (string)
- loadHeight: Panel load height in mm (string)  
- panelThickness: Panel thickness in mm (string)
- panelVolume: Panel volume in cubic meters (string)
- panelMass: Panel mass in kg (string)
- panelArea: Panel area in square meters (string)
- day28Fc: 28-day concrete compressive strength in MPa (string)
- liftFcm: Minimum concrete strength at lift in MPa (string)
- panelMark: Panel mark/identifier (string)

If a value cannot be determined from the document, use null for that field.
Return ONLY valid JSON, no explanation text.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this precast panel specification document and extract the panel properties. Panel Mark on file: ${panel.panelMark}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_completion_tokens: 1000,
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      let extractedData;
      try {
        // Clean the response - remove markdown code blocks if present
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(cleanContent);
      } catch (e) {
        console.error("Failed to parse OpenAI response:", content);
        extractedData = {};
      }
      
      res.json({
        success: true,
        extracted: extractedData,
        panelId: id,
      });
    } catch (error: any) {
      console.error("PDF analysis error:", error);
      res.status(500).json({ 
        error: "Failed to analyze PDF", 
        details: error.message 
      });
    }
  });

  // Panel production approval - Approve panel for production
  app.post("/api/admin/panels/:id/approve-production", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;
      const { 
        loadWidth, 
        loadHeight, 
        panelThickness, 
        panelVolume, 
        panelMass, 
        panelArea, 
        day28Fc, 
        liftFcm,
        concreteStrengthMpa,
        rotationalLifters,
        primaryLifters,
        productionPdfUrl 
      } = req.body;
      
      const panel = await storage.getPanelById(id as string);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      
      const updated = await storage.approvePanelForProduction(id as string, userId, {
        loadWidth,
        loadHeight,
        panelThickness,
        panelVolume,
        panelMass,
        panelArea,
        day28Fc,
        liftFcm,
        concreteStrengthMpa,
        rotationalLifters,
        primaryLifters,
        productionPdfUrl,
      });
      
      res.json({ success: true, panel: updated });
    } catch (error: any) {
      console.error("Approval error:", error);
      res.status(500).json({ error: "Failed to approve panel", details: error.message });
    }
  });

  // Panel production approval - Revoke approval
  app.post("/api/admin/panels/:id/revoke-production", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const panel = await storage.getPanelById(id as string);
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }
      
      const updated = await storage.revokePanelProductionApproval(id as string);
      
      res.json({ success: true, panel: updated });
    } catch (error: any) {
      console.error("Revoke error:", error);
      res.status(500).json({ error: "Failed to revoke approval", details: error.message });
    }
  });

  // Get panels approved for production (for production report)
  app.get("/api/panels/approved-for-production", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.query;
      const panels = await storage.getPanelsApprovedForProduction(jobId as string | undefined);
      res.json(panels);
    } catch (error: any) {
      console.error("Error fetching approved panels:", error);
      res.status(500).json({ error: "Failed to fetch approved panels" });
    }
  });

  // =============== LOGISTICS ROUTES ===============

  // Trailer Types
  app.get("/api/trailer-types", requireAuth, async (req, res) => {
    const trailerTypes = await storage.getActiveTrailerTypes();
    res.json(trailerTypes);
  });

  app.get("/api/admin/trailer-types", requireRole("ADMIN"), async (req, res) => {
    const trailerTypes = await storage.getAllTrailerTypes();
    res.json(trailerTypes);
  });

  app.post("/api/admin/trailer-types", requireRole("ADMIN"), async (req, res) => {
    const trailerType = await storage.createTrailerType(req.body);
    res.json(trailerType);
  });

  app.put("/api/admin/trailer-types/:id", requireRole("ADMIN"), async (req, res) => {
    const trailerType = await storage.updateTrailerType(req.params.id as string, req.body);
    res.json(trailerType);
  });

  app.delete("/api/admin/trailer-types/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteTrailerType(req.params.id as string);
    res.json({ success: true });
  });

  // Zones
  app.get("/api/admin/zones", requireRole("ADMIN"), async (req, res) => {
    const zones = await storage.getAllZones();
    res.json(zones);
  });

  app.get("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
    const zone = await storage.getZone(req.params.id as string);
    if (!zone) return res.status(404).json({ error: "Zone not found" });
    res.json(zone);
  });

  app.post("/api/admin/zones", requireRole("ADMIN"), async (req, res) => {
    try {
      const existing = await storage.getZoneByCode(req.body.code);
      if (existing) {
        return res.status(400).json({ error: "Zone with this code already exists" });
      }
      const zone = await storage.createZone(req.body);
      res.json(zone);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create zone" });
    }
  });

  app.put("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
    const zone = await storage.updateZone(req.params.id as string, req.body);
    res.json(zone);
  });

  app.delete("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteZone(req.params.id as string);
    res.json({ success: true });
  });

  // Load Lists
  app.get("/api/load-lists", requireAuth, requirePermission("logistics"), async (req, res) => {
    const loadLists = await storage.getAllLoadLists();
    res.json(loadLists);
  });

  app.get("/api/load-lists/:id", requireAuth, requirePermission("logistics"), async (req, res) => {
    const loadList = await storage.getLoadList(req.params.id as string);
    if (!loadList) return res.status(404).json({ error: "Load list not found" });
    res.json(loadList);
  });

  app.post("/api/load-lists", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { panelIds, docketNumber, scheduledDate, ...data } = req.body;
      
      // Generate a sequential load number
      const existingLoadLists = await storage.getAllLoadLists();
      const loadNumber = `LL-${String(existingLoadLists.length + 1).padStart(4, '0')}`;
      
      // Parse the scheduled date or use today
      const date = scheduledDate ? new Date(scheduledDate) : new Date();
      const loadDate = date.toISOString().split('T')[0];
      const loadTime = date.toTimeString().split(' ')[0].substring(0, 5);
      
      const loadList = await storage.createLoadList({
        ...data,
        loadNumber,
        loadDate,
        loadTime,
        createdById: req.session.userId!,
      }, panelIds || []);
      res.json(loadList);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create load list" });
    }
  });

  app.put("/api/load-lists/:id", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
    const loadList = await storage.updateLoadList(req.params.id as string, req.body);
    res.json(loadList);
  });

  app.delete("/api/load-lists/:id", requireRole("ADMIN", "MANAGER"), requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
    await storage.deleteLoadList(req.params.id as string);
    res.json({ success: true });
  });

  app.post("/api/load-lists/:id/panels", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
    const { panelId, sequence } = req.body;
    const panel = await storage.addPanelToLoadList(req.params.id as string, panelId, sequence);
    res.json(panel);
  });

  app.delete("/api/load-lists/:id/panels/:panelId", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
    await storage.removePanelFromLoadList(req.params.id as string, req.params.panelId as string);
    res.json({ success: true });
  });

  // Delivery Records
  app.get("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
    const record = await storage.getDeliveryRecord(req.params.id as string);
    res.json(record || null);
  });

  app.post("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
    try {
      const record = await storage.createDeliveryRecord({
        ...req.body,
        loadListId: req.params.id as string,
        enteredById: req.session.userId!,
      });
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create delivery record" });
    }
  });

  app.put("/api/delivery-records/:id", requireAuth, async (req, res) => {
    const record = await storage.updateDeliveryRecord(req.params.id as string, req.body);
    res.json(record);
  });

  // Weekly Wage Reports
  app.get("/api/weekly-wage-reports", requireAuth, requirePermission("weekly_wages"), async (req, res) => {
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

  app.get("/api/weekly-wage-reports/:id", requireAuth, requirePermission("weekly_wages"), async (req, res) => {
    try {
      const report = await storage.getWeeklyWageReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error fetching weekly wage report:", error);
      res.status(500).json({ error: error.message || "Failed to fetch weekly wage report" });
    }
  });

  app.post("/api/weekly-wage-reports", requireAuth, requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const parseResult = insertWeeklyWageReportSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request data" });
      }
      
      const { weekStartDate, weekEndDate, factory } = parseResult.data;
      
      // Check if report already exists
      const existing = await storage.getWeeklyWageReportByWeek(weekStartDate, weekEndDate, factory);
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

  app.put("/api/weekly-wage-reports/:id", requireAuth, requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const parseResult = insertWeeklyWageReportSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request data" });
      }
      
      const report = await storage.updateWeeklyWageReport(req.params.id, parseResult.data);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error updating weekly wage report:", error);
      res.status(500).json({ error: error.message || "Failed to update weekly wage report" });
    }
  });

  app.delete("/api/weekly-wage-reports/:id", requireRole("ADMIN", "MANAGER"), requirePermission("weekly_wages", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      await storage.deleteWeeklyWageReport(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting weekly wage report:", error);
      res.status(500).json({ error: error.message || "Failed to delete weekly wage report" });
    }
  });

  // Weekly Wage Analysis - compare actual wages vs estimated wages based on production
  app.get("/api/weekly-wage-reports/:id/analysis", requireAuth, async (req, res) => {
    try {
      const report = await storage.getWeeklyWageReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      // Get production entries for the week
      const entries = await storage.getProductionEntriesInRange(report.weekStartDate, report.weekEndDate);
      
      // Filter by factory
      const factoryEntries = entries.filter(e => e.factory === report.factory);
      
      // Get all panel types and their cost components
      const allPanelTypes = await storage.getAllPanelTypes();
      const panelTypesMap = new Map(allPanelTypes.map(pt => [pt.code, pt]));
      
      // Calculate expected wages based on production revenue and cost percentages
      let totalRevenue = 0;
      let expectedProductionWages = 0;
      let expectedDraftingWages = 0;
      
      for (const entry of factoryEntries) {
        // Get panel type to find cost components
        const panelType = panelTypesMap.get(entry.panel?.panelType || "");
        if (!panelType) continue;
        
        // Calculate revenue from this entry
        const volume = parseFloat(entry.volumeM3 || "0");
        const area = parseFloat(entry.areaM2 || "0");
        const sellRateM3 = parseFloat(panelType.sellRatePerM3 || "0");
        const sellRateM2 = parseFloat(panelType.sellRatePerM2 || "0");
        const entryRevenue = (volume * sellRateM3) + (area * sellRateM2);
        totalRevenue += entryRevenue;
        
        // Get cost components for this panel type
        const costComponents = await storage.getCostComponentsByPanelType(panelType.id);
        for (const component of costComponents) {
          const percentage = parseFloat(component.percentageOfRevenue) / 100;
          const cost = entryRevenue * percentage;
          
          // Map cost components to wage categories (e.g., "Labour" -> Production Wages)
          const componentName = component.name.toLowerCase();
          if (componentName.includes("labour") || componentName.includes("production")) {
            expectedProductionWages += cost;
          }
          if (componentName.includes("drafting")) {
            expectedDraftingWages += cost;
          }
        }
      }
      
      // Parse actual wages from the report
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
  app.get("/api/weekly-job-reports", requireAuth, requirePermission("weekly_job_logs"), async (req, res) => {
    try {
      const projectManagerId = req.query.projectManagerId as string | undefined;
      const reports = await storage.getWeeklyJobReports(projectManagerId);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching weekly job reports:", error);
      res.status(500).json({ error: error.message || "Failed to fetch weekly job reports" });
    }
  });

  app.get("/api/weekly-job-reports/my-reports", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const reports = await storage.getWeeklyJobReports(userId);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching my weekly job reports:", error);
      res.status(500).json({ error: error.message || "Failed to fetch weekly job reports" });
    }
  });

  app.get("/api/weekly-job-reports/pending-approval", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const reports = await storage.getWeeklyJobReportsByStatus("SUBMITTED");
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching pending approval reports:", error);
      res.status(500).json({ error: error.message || "Failed to fetch pending reports" });
    }
  });

  app.get("/api/weekly-job-reports/approved", requireAuth, async (req, res) => {
    try {
      const reports = await storage.getApprovedWeeklyJobReports();
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching approved reports:", error);
      res.status(500).json({ error: error.message || "Failed to fetch approved reports" });
    }
  });

  app.get("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
    try {
      const report = await storage.getWeeklyJobReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error fetching weekly job report:", error);
      res.status(500).json({ error: error.message || "Failed to fetch report" });
    }
  });

  app.get("/api/my-jobs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const myJobs = await storage.getJobsForProjectManager(userId);
      res.json(myJobs);
    } catch (error: any) {
      console.error("Error fetching jobs for project manager:", error);
      res.status(500).json({ error: error.message || "Failed to fetch jobs" });
    }
  });

  app.post("/api/weekly-job-reports", requireAuth, async (req, res) => {
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

  app.put("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
    try {
      const { schedules, ...reportData } = req.body;
      const report = await storage.updateWeeklyJobReport(req.params.id, reportData, schedules);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error updating weekly job report:", error);
      res.status(500).json({ error: error.message || "Failed to update report" });
    }
  });

  app.post("/api/weekly-job-reports/:id/submit", requireAuth, async (req, res) => {
    try {
      const report = await storage.submitWeeklyJobReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error submitting weekly job report:", error);
      res.status(500).json({ error: error.message || "Failed to submit report" });
    }
  });

  app.post("/api/weekly-job-reports/:id/approve", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const approvedById = req.session.userId!;
      const report = await storage.approveWeeklyJobReport(req.params.id, approvedById);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error approving weekly job report:", error);
      res.status(500).json({ error: error.message || "Failed to approve report" });
    }
  });

  app.post("/api/weekly-job-reports/:id/reject", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const approvedById = req.session.userId!;
      const { rejectionReason } = req.body;
      const report = await storage.rejectWeeklyJobReport(req.params.id, approvedById, rejectionReason || "No reason provided");
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("Error rejecting weekly job report:", error);
      res.status(500).json({ error: error.message || "Failed to reject report" });
    }
  });

  app.delete("/api/weekly-job-reports/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteWeeklyJobReport(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting weekly job report:", error);
      res.status(500).json({ error: error.message || "Failed to delete report" });
    }
  });

  // Production Slots Routes
  app.get("/api/production-slots", requireAuth, async (req, res) => {
    try {
      const { jobId, status, dateFrom, dateTo } = req.query;
      const filters: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] } = {};
      if (jobId) filters.jobId = jobId as string;
      if (status) filters.status = status as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      // Get user's selected factory IDs for filtering
      const user = await storage.getUser(req.session.userId!);
      if (user?.selectedFactoryIds && user.selectedFactoryIds.length > 0) {
        filters.factoryIds = user.selectedFactoryIds;
      }
      
      const slots = await storage.getProductionSlots(filters);
      res.json(slots);
    } catch (error: any) {
      console.error("Error fetching production slots:", error);
      res.status(500).json({ error: error.message || "Failed to fetch production slots" });
    }
  });

  app.get("/api/production-slots/jobs-without-slots", requireAuth, async (req, res) => {
    try {
      const jobsWithoutSlots = await storage.getJobsWithoutProductionSlots();
      res.json(jobsWithoutSlots);
    } catch (error: any) {
      console.error("Error fetching jobs without slots:", error);
      res.status(500).json({ error: error.message || "Failed to fetch jobs" });
    }
  });

  app.get("/api/production-slots/:id", requireAuth, async (req, res) => {
    try {
      const slot = await storage.getProductionSlot(req.params.id);
      if (!slot) {
        return res.status(404).json({ error: "Production slot not found" });
      }
      res.json(slot);
    } catch (error: any) {
      console.error("Error fetching production slot:", error);
      res.status(500).json({ error: error.message || "Failed to fetch production slot" });
    }
  });

  app.get("/api/production-slots/check-levels/:jobId", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const result = await storage.checkPanelLevelCoverage(req.params.jobId);
      res.json(result);
    } catch (error: any) {
      console.error("Error checking panel level coverage:", error);
      res.status(500).json({ error: error.message || "Failed to check level coverage" });
    }
  });

  app.post("/api/production-slots/generate/:jobId", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const { skipEmptyLevels } = req.body || {};
      const slots = await storage.generateProductionSlotsForJob(req.params.jobId, skipEmptyLevels);
      res.json(slots);
    } catch (error: any) {
      console.error("Error generating production slots:", error);
      res.status(500).json({ error: error.message || "Failed to generate production slots" });
    }
  });

  app.post("/api/production-slots/:id/adjust", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const { newDate, reason, clientConfirmed, cascadeToLater } = req.body;
      const changedById = req.session.userId!;
      
      const slot = await storage.adjustProductionSlot(req.params.id, {
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

  app.post("/api/production-slots/:id/book", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const slot = await storage.bookProductionSlot(req.params.id);
      if (!slot) {
        return res.status(404).json({ error: "Production slot not found" });
      }
      res.json(slot);
    } catch (error: any) {
      console.error("Error booking production slot:", error);
      res.status(500).json({ error: error.message || "Failed to book production slot" });
    }
  });

  app.post("/api/production-slots/:id/complete", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const slot = await storage.completeProductionSlot(req.params.id);
      if (!slot) {
        return res.status(404).json({ error: "Production slot not found" });
      }
      res.json(slot);
    } catch (error: any) {
      console.error("Error completing production slot:", error);
      res.status(500).json({ error: error.message || "Failed to complete production slot" });
    }
  });

  app.get("/api/production-slots/:id/adjustments", requireAuth, async (req, res) => {
    try {
      const adjustments = await storage.getProductionSlotAdjustments(req.params.id);
      res.json(adjustments);
    } catch (error: any) {
      console.error("Error fetching production slot adjustments:", error);
      res.status(500).json({ error: error.message || "Failed to fetch adjustments" });
    }
  });

  app.delete("/api/production-slots/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteProductionSlot(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting production slot:", error);
      res.status(500).json({ error: error.message || "Failed to delete production slot" });
    }
  });

  // ============== Drafting Program ==============
  app.get("/api/drafting-program", requireAuth, requirePermission("production_report", "VIEW"), async (req, res) => {
    try {
      const { jobId, status, assignedToId, dateFrom, dateTo } = req.query;
      const filters: any = {};
      if (jobId) filters.jobId = jobId as string;
      if (status) filters.status = status as string;
      if (assignedToId) filters.assignedToId = assignedToId as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      // Get user's selected factory IDs for filtering
      const user = await storage.getUser(req.session.userId!);
      if (user?.selectedFactoryIds && user.selectedFactoryIds.length > 0) {
        filters.factoryIds = user.selectedFactoryIds;
      }
      
      const programs = await storage.getDraftingPrograms(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(programs);
    } catch (error: any) {
      console.error("Error fetching drafting program:", error);
      res.status(500).json({ error: error.message || "Failed to fetch drafting program" });
    }
  });

  app.get("/api/drafting-program/my-allocated", requireAuth, requirePermission("daily_reports", "VIEW"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Get user's selected factory IDs for filtering
      const user = await storage.getUser(userId);
      const factoryIds = (user?.selectedFactoryIds && user.selectedFactoryIds.length > 0) 
        ? user.selectedFactoryIds 
        : undefined;
      
      const programs = await storage.getDraftingPrograms({ assignedToId: userId, factoryIds });
      
      const completed = programs.filter(p => p.status === "COMPLETED");
      const inProgress = programs.filter(p => p.status === "IN_PROGRESS");
      const scheduled = programs.filter(p => p.status === "SCHEDULED");
      const notScheduled = programs.filter(p => p.status === "NOT_SCHEDULED");
      const onHold = programs.filter(p => p.status === "ON_HOLD");
      
      const totalActualHours = programs.reduce((sum, p) => sum + (parseFloat(p.actualHours || "0")), 0);
      const totalEstimatedHours = programs.reduce((sum, p) => sum + (parseFloat(p.estimatedHours || "0")), 0);
      
      res.json({
        programs,
        stats: {
          total: programs.length,
          completed: completed.length,
          inProgress: inProgress.length,
          scheduled: scheduled.length,
          notScheduled: notScheduled.length,
          onHold: onHold.length,
          totalActualHours,
          totalEstimatedHours,
        }
      });
    } catch (error: any) {
      console.error("Error fetching my allocated panels:", error);
      res.status(500).json({ error: error.message || "Failed to fetch allocated panels" });
    }
  });

  app.get("/api/drafting-program/:id", requireAuth, requirePermission("production_report", "VIEW"), async (req, res) => {
    try {
      const program = await storage.getDraftingProgram(req.params.id);
      if (!program) return res.status(404).json({ error: "Drafting program entry not found" });
      res.json(program);
    } catch (error: any) {
      console.error("Error fetching drafting program entry:", error);
      res.status(500).json({ error: error.message || "Failed to fetch drafting program entry" });
    }
  });

  app.post("/api/drafting-program/generate", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const result = await storage.generateDraftingProgramFromProductionSlots();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error generating drafting program:", error);
      res.status(500).json({ error: error.message || "Failed to generate drafting program" });
    }
  });

  const assignDraftingResourceSchema = z.object({
    assignedToId: z.string().min(1, "assignedToId is required"),
    proposedStartDate: z.string().min(1, "proposedStartDate is required"),
  });

  app.post("/api/drafting-program/:id/assign", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const parsed = assignDraftingResourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const { assignedToId, proposedStartDate } = parsed.data;
      const updated = await storage.assignDraftingResource(req.params.id, assignedToId, new Date(proposedStartDate));
      if (!updated) return res.status(404).json({ error: "Drafting program entry not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error assigning drafting resource:", error);
      res.status(500).json({ error: error.message || "Failed to assign drafting resource" });
    }
  });

  const updateDraftingProgramSchema = z.object({
    status: z.enum(["NOT_SCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]).optional(),
    priority: z.number().optional(),
    estimatedHours: z.string().optional(),
    actualHours: z.string().optional(),
    notes: z.string().optional(),
    completedAt: z.string().nullable().optional(),
  });

  app.patch("/api/drafting-program/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const parsed = updateDraftingProgramSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const updateData: any = { ...parsed.data };
      if (updateData.completedAt) {
        updateData.completedAt = new Date(updateData.completedAt);
      }
      const updated = await storage.updateDraftingProgram(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: "Drafting program entry not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating drafting program:", error);
      res.status(500).json({ error: error.message || "Failed to update drafting program" });
    }
  });

  app.delete("/api/drafting-program/:id", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      await storage.deleteDraftingProgram(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting drafting program entry:", error);
      res.status(500).json({ error: error.message || "Failed to delete drafting program entry" });
    }
  });

  app.delete("/api/drafting-program/job/:jobId", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { jobId } = req.params;
      const deleted = await storage.deleteDraftingProgramByJob(jobId);
      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error("Error deleting drafting program entries for job:", error);
      res.status(500).json({ error: error.message || "Failed to delete drafting program entries" });
    }
  });

  // ============== Suppliers ==============
  app.get("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const suppliersData = await storage.getAllSuppliers();
      res.json(suppliersData);
    } catch (error: any) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/active", requireAuth, async (req, res) => {
    try {
      const suppliersData = await storage.getActiveSuppliers();
      res.json(suppliersData);
    } catch (error: any) {
      console.error("Error fetching active suppliers:", error);
      res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const supplier = await storage.getSupplier(req.params.id);
      if (!supplier) return res.status(404).json({ error: "Supplier not found" });
      res.json(supplier);
    } catch (error: any) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ error: error.message || "Failed to fetch supplier" });
    }
  });

  app.post("/api/suppliers", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const supplier = await storage.createSupplier(req.body);
      res.json(supplier);
    } catch (error: any) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ error: error.message || "Failed to create supplier" });
    }
  });

  app.patch("/api/suppliers/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(req.params.id, req.body);
      if (!supplier) return res.status(404).json({ error: "Supplier not found" });
      res.json(supplier);
    } catch (error: any) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: error.message || "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteSupplier(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: error.message || "Failed to delete supplier" });
    }
  });

  // ============== Item Categories ==============
  app.get("/api/item-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getAllItemCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching item categories:", error);
      res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
  });

  app.get("/api/item-categories/active", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getActiveItemCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching active item categories:", error);
      res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
  });

  app.get("/api/item-categories/:id", requireAuth, async (req, res) => {
    try {
      const category = await storage.getItemCategory(req.params.id);
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json(category);
    } catch (error: any) {
      console.error("Error fetching category:", error);
      res.status(500).json({ error: error.message || "Failed to fetch category" });
    }
  });

  app.post("/api/item-categories", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const category = await storage.createItemCategory(req.body);
      res.json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: error.message || "Failed to create category" });
    }
  });

  app.patch("/api/item-categories/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const category = await storage.updateItemCategory(req.params.id, req.body);
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json(category);
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: error.message || "Failed to update category" });
    }
  });

  app.delete("/api/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteItemCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message || "Failed to delete category" });
    }
  });

  // ============== Items ==============
  app.get("/api/items", requireAuth, async (req, res) => {
    try {
      const itemsData = await storage.getAllItems();
      res.json(itemsData);
    } catch (error: any) {
      console.error("Error fetching items:", error);
      res.status(500).json({ error: error.message || "Failed to fetch items" });
    }
  });

  app.get("/api/items/active", requireAuth, async (req, res) => {
    try {
      const itemsData = await storage.getActiveItems();
      res.json(itemsData);
    } catch (error: any) {
      console.error("Error fetching active items:", error);
      res.status(500).json({ error: error.message || "Failed to fetch items" });
    }
  });

  app.get("/api/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error: any) {
      console.error("Error fetching item:", error);
      res.status(500).json({ error: error.message || "Failed to fetch item" });
    }
  });

  app.post("/api/items", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const item = await storage.createItem(req.body);
      res.json(item);
    } catch (error: any) {
      console.error("Error creating item:", error);
      res.status(500).json({ error: error.message || "Failed to create item" });
    }
  });

  app.patch("/api/items/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const item = await storage.updateItem(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error: any) {
      console.error("Error updating item:", error);
      res.status(500).json({ error: error.message || "Failed to update item" });
    }
  });

  app.delete("/api/items/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteItem(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting item:", error);
      res.status(500).json({ error: error.message || "Failed to delete item" });
    }
  });

  // Item Import from Excel
  app.post("/api/items/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0]; // Use first sheet (Products)
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) {
        return res.status(400).json({ error: "No data found in Excel file" });
      }

      // Get all categories to map names to IDs
      const categories = await storage.getAllItemCategories();
      const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

      // Process rows and prepare items for import
      const itemsToImport: InsertItem[] = [];
      const categoriesToCreate: string[] = [];

      for (const row of rows) {
        const categoryName = row["Category"] || row["category"] || "";
        
        // Check if we need to create the category
        if (categoryName && !categoryMap.has(categoryName.toLowerCase())) {
          if (!categoriesToCreate.includes(categoryName)) {
            categoriesToCreate.push(categoryName);
          }
        }
      }

      // Create missing categories
      for (const catName of categoriesToCreate) {
        try {
          const newCat = await storage.createItemCategory({ name: catName, isActive: true });
          categoryMap.set(catName.toLowerCase(), newCat.id);
        } catch (error) {
          console.error(`Error creating category ${catName}:`, error);
        }
      }

      // Now process items
      for (const row of rows) {
        const productId = row["Product Id"] || row["product_id"] || row["ProductId"] || "";
        const description = row["Product Description"] || row["Description"] || row["description"] || row["Name"] || row["name"] || "";
        const categoryName = row["Category"] || row["category"] || "";
        const unitPrice = parseFloat(row["Avg Unit Price Aud"] || row["Unit Price"] || row["unit_price"] || "0") || null;
        const hsCode = row["Hs Code Guess"] || row["HS Code"] || row["hs_code"] || "";
        const adRisk = row["Ad Risk"] || row["AD Risk"] || row["ad_risk"] || "";
        const adReferenceUrl = row["Ad Reference Url"] || row["ad_reference_url"] || "";
        const complianceNotes = row["Compliance Notes"] || row["compliance_notes"] || "";
        const supplierShortlist = row["Supplier Shortlist"] || row["supplier_shortlist"] || "";
        const sources = row["Sources"] || row["sources"] || "";

        if (!description) continue; // Skip rows without description

        const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;

        itemsToImport.push({
          code: productId,
          name: description,
          description: description,
          categoryId,
          unitPrice: unitPrice?.toString() || null,
          hsCode,
          adRisk,
          adReferenceUrl,
          complianceNotes,
          supplierShortlist,
          sources,
          isActive: true,
        });
      }

      const result = await storage.bulkImportItems(itemsToImport);

      res.json({
        success: true,
        message: `Import completed: ${result.created} items created, ${result.updated} items updated`,
        created: result.created,
        updated: result.updated,
        categoriesCreated: categoriesToCreate.length,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error("Error importing items:", error);
      res.status(500).json({ error: error.message || "Failed to import items" });
    }
  });

  // ============== Purchase Orders ==============
  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      let orders;
      if (status) {
        orders = await storage.getPurchaseOrdersByStatus(status);
      } else {
        orders = await storage.getAllPurchaseOrders();
      }
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/my", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const orders = await storage.getPurchaseOrdersByUser(userId);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching my purchase orders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/next-number", requireAuth, async (req, res) => {
    try {
      const poNumber = await storage.getNextPONumber();
      res.json({ poNumber });
    } catch (error: any) {
      console.error("Error getting next PO number:", error);
      res.status(500).json({ error: error.message || "Failed to get next PO number" });
    }
  });

  app.get("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      res.json(order);
    } catch (error: any) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to fetch purchase order" });
    }
  });

  app.post("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { items: lineItems, ...poData } = req.body;
      const poNumber = await storage.getNextPONumber();
      // Convert empty string supplierId to null to avoid foreign key constraint
      if (poData.supplierId === "") {
        poData.supplierId = null;
      }
      const order = await storage.createPurchaseOrder(
        { ...poData, poNumber, requestedById: userId },
        lineItems || []
      );
      res.json(order);
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to create purchase order" });
    }
  });

  app.patch("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      
      const userId = (req.session as any).userId;
      if (order.requestedById !== userId && order.status !== "DRAFT") {
        return res.status(403).json({ error: "Cannot edit this purchase order" });
      }
      
      const { items: lineItems, ...poData } = req.body;
      // Convert empty string supplierId to null to avoid foreign key constraint
      if (poData.supplierId === "") {
        poData.supplierId = null;
      }
      const updated = await storage.updatePurchaseOrder(req.params.id, poData, lineItems);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to update purchase order" });
    }
  });

  app.post("/api/purchase-orders/:id/submit", requireAuth, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      
      const userId = (req.session as any).userId;
      if (order.requestedById !== userId) {
        return res.status(403).json({ error: "Only the requester can submit this PO" });
      }
      
      if (order.status !== "DRAFT") {
        return res.status(400).json({ error: "Only draft POs can be submitted" });
      }

      const submitted = await storage.submitPurchaseOrder(req.params.id);
      res.json(submitted);
    } catch (error: any) {
      console.error("Error submitting purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to submit purchase order" });
    }
  });

  app.post("/api/purchase-orders/:id/approve", requireAuth, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      
      if (order.status !== "SUBMITTED") {
        return res.status(400).json({ error: "Only submitted POs can be approved" });
      }

      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Check if user can approve POs
      if (!user.poApprover && user.role !== "ADMIN") {
        return res.status(403).json({ error: "You are not authorized to approve purchase orders" });
      }

      // Check approval limit (if not admin)
      if (user.role !== "ADMIN" && user.poApprovalLimit) {
        const orderTotal = parseFloat(order.total || "0");
        const limit = parseFloat(user.poApprovalLimit);
        if (orderTotal > limit) {
          return res.status(403).json({ 
            error: `PO total ($${orderTotal.toFixed(2)}) exceeds your approval limit ($${limit.toFixed(2)})` 
          });
        }
      }

      const approved = await storage.approvePurchaseOrder(req.params.id, userId);
      res.json(approved);
    } catch (error: any) {
      console.error("Error approving purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to approve purchase order" });
    }
  });

  app.post("/api/purchase-orders/:id/reject", requireAuth, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      
      if (order.status !== "SUBMITTED") {
        return res.status(400).json({ error: "Only submitted POs can be rejected" });
      }

      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Check if user can approve/reject POs
      if (!user.poApprover && user.role !== "ADMIN") {
        return res.status(403).json({ error: "You are not authorized to reject purchase orders" });
      }

      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const rejected = await storage.rejectPurchaseOrder(req.params.id, userId, reason);
      res.json(rejected);
    } catch (error: any) {
      console.error("Error rejecting purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to reject purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      // Only owner can delete DRAFT, only ADMIN can delete any
      if (order.requestedById !== userId && user?.role !== "ADMIN") {
        return res.status(403).json({ error: "Cannot delete this purchase order" });
      }
      
      if (order.status !== "DRAFT" && user?.role !== "ADMIN") {
        return res.status(400).json({ error: "Only draft POs can be deleted" });
      }

      await storage.deletePurchaseOrder(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to delete purchase order" });
    }
  });

  // ==================== PO Attachments ====================

  app.get("/api/purchase-orders/:id/attachments", requireAuth, async (req, res) => {
    try {
      const attachments = await storage.getPurchaseOrderAttachments(req.params.id);
      res.json(attachments);
    } catch (error: any) {
      console.error("Error fetching PO attachments:", error);
      res.status(500).json({ error: error.message || "Failed to fetch attachments" });
    }
  });

  app.post("/api/purchase-orders/:id/attachments", requireAuth, upload.array("files", 10), async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });

      const fs = await import("fs/promises");
      const path = await import("path");
      const uploadsDir = path.join(process.cwd(), "uploads", "po-attachments");
      await fs.mkdir(uploadsDir, { recursive: true });

      const attachments = [];
      for (const file of files) {
        const timestamp = Date.now();
        const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileName = `${req.params.id}_${timestamp}_${safeFileName}`;
        const filePath = path.join(uploadsDir, fileName);
        
        await fs.writeFile(filePath, file.buffer);

        const attachment = await storage.createPurchaseOrderAttachment({
          purchaseOrderId: req.params.id,
          fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          filePath,
          uploadedById: userId,
        });
        attachments.push(attachment);
      }

      res.status(201).json(attachments);
    } catch (error: any) {
      console.error("Error uploading PO attachments:", error);
      res.status(500).json({ error: error.message || "Failed to upload attachments" });
    }
  });

  app.get("/api/po-attachments/:id/download", requireAuth, async (req, res) => {
    try {
      const attachment = await storage.getPurchaseOrderAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });

      const fs = await import("fs");
      if (!fs.existsSync(attachment.filePath)) {
        return res.status(404).json({ error: "File not found on server" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalName}"`);
      res.setHeader("Content-Type", attachment.mimeType);
      fs.createReadStream(attachment.filePath).pipe(res);
    } catch (error: any) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ error: error.message || "Failed to download attachment" });
    }
  });

  app.delete("/api/po-attachments/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      const attachment = await storage.getPurchaseOrderAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });

      const order = await storage.getPurchaseOrder(attachment.purchaseOrderId);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });

      // Only uploader, PO owner, or admin can delete
      if (attachment.uploadedById !== userId && order.requestedById !== userId && user?.role !== "ADMIN") {
        return res.status(403).json({ error: "Cannot delete this attachment" });
      }

      // Delete file from disk
      const fs = await import("fs/promises");
      try {
        await fs.unlink(attachment.filePath);
      } catch (e) {
        console.warn("Could not delete file from disk:", e);
      }

      await storage.deletePurchaseOrderAttachment(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: error.message || "Failed to delete attachment" });
    }
  });

  // ==================== Task Management (Monday.com-style) ====================
  
  // Task Groups
  app.get("/api/task-groups", requireAuth, requirePermission("tasks"), async (req, res) => {
    try {
      const groups = await storage.getAllTaskGroups();
      res.json(groups);
    } catch (error: any) {
      console.error("Error fetching task groups:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task groups" });
    }
  });

  app.get("/api/task-groups/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
    try {
      const group = await storage.getTaskGroup(req.params.id);
      if (!group) return res.status(404).json({ error: "Task group not found" });
      res.json(group);
    } catch (error: any) {
      console.error("Error fetching task group:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task group" });
    }
  });

  app.post("/api/task-groups", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const group = await storage.createTaskGroup(req.body);
      res.status(201).json(group);
    } catch (error: any) {
      console.error("Error creating task group:", error);
      res.status(500).json({ error: error.message || "Failed to create task group" });
    }
  });

  app.patch("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const group = await storage.updateTaskGroup(req.params.id, req.body);
      if (!group) return res.status(404).json({ error: "Task group not found" });
      res.json(group);
    } catch (error: any) {
      console.error("Error updating task group:", error);
      res.status(500).json({ error: error.message || "Failed to update task group" });
    }
  });

  app.delete("/api/task-groups/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      await storage.deleteTaskGroup(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting task group:", error);
      res.status(500).json({ error: error.message || "Failed to delete task group" });
    }
  });

  app.post("/api/task-groups/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { groupIds } = req.body;
      if (!Array.isArray(groupIds)) {
        return res.status(400).json({ error: "groupIds must be an array" });
      }
      await storage.reorderTaskGroups(groupIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering task groups:", error);
      res.status(500).json({ error: error.message || "Failed to reorder task groups" });
    }
  });

  // Tasks
  app.get("/api/tasks/:id", requireAuth, requirePermission("tasks"), async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error: any) {
      console.error("Error fetching task:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const task = await storage.createTask({
        ...req.body,
        createdById: userId,
      });
      res.status(201).json(task);
    } catch (error: any) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: error.message || "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      // Convert date string to Date object if present
      const updateData = { ...req.body };
      if (updateData.dueDate !== undefined) {
        updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
      }
      const task = await storage.updateTask(req.params.id, updateData);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error: any) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: error.message || "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: error.message || "Failed to delete task" });
    }
  });

  app.post("/api/tasks/reorder", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { groupId, taskIds } = req.body;
      if (!groupId || !Array.isArray(taskIds)) {
        return res.status(400).json({ error: "groupId and taskIds array are required" });
      }
      await storage.reorderTasks(groupId, taskIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering tasks:", error);
      res.status(500).json({ error: error.message || "Failed to reorder tasks" });
    }
  });

  // Task Assignees
  app.get("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks"), async (req, res) => {
    try {
      const assignees = await storage.getTaskAssignees(req.params.id);
      res.json(assignees);
    } catch (error: any) {
      console.error("Error fetching task assignees:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task assignees" });
    }
  });

  app.put("/api/tasks/:id/assignees", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ error: "userIds must be an array" });
      }
      const assignees = await storage.setTaskAssignees(req.params.id, userIds);
      res.json(assignees);
    } catch (error: any) {
      console.error("Error setting task assignees:", error);
      res.status(500).json({ error: error.message || "Failed to set task assignees" });
    }
  });

  // Task Updates (Activity Log)
  app.get("/api/tasks/:id/updates", requireAuth, requirePermission("tasks"), async (req, res) => {
    try {
      const updates = await storage.getTaskUpdates(req.params.id);
      res.json(updates);
    } catch (error: any) {
      console.error("Error fetching task updates:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task updates" });
    }
  });

  app.post("/api/tasks/:id/updates", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const taskId = req.params.id;
      const update = await storage.createTaskUpdate({
        taskId,
        userId,
        content: req.body.content,
      });
      
      // Get task details for notification title
      const taskGroups = await storage.getAllTaskGroups();
      let taskTitle = "Task";
      for (const group of taskGroups) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          taskTitle = task.title;
          break;
        }
      }
      
      // Get user who posted the update
      const fromUser = await storage.getUser(userId);
      const fromName = fromUser?.name || fromUser?.email || "Someone";
      
      // Create notifications for all assignees (except the poster)
      await storage.createTaskNotificationsForAssignees(
        taskId,
        userId,
        "COMMENT",
        `New comment on "${taskTitle}"`,
        `${fromName}: ${req.body.content.substring(0, 100)}${req.body.content.length > 100 ? '...' : ''}`,
        update.id
      );
      
      res.status(201).json(update);
    } catch (error: any) {
      console.error("Error creating task update:", error);
      res.status(500).json({ error: error.message || "Failed to create task update" });
    }
  });

  app.delete("/api/task-updates/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      await storage.deleteTaskUpdate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting task update:", error);
      res.status(500).json({ error: error.message || "Failed to delete task update" });
    }
  });

  // Task Files
  app.get("/api/tasks/:id/files", requireAuth, requirePermission("tasks"), async (req, res) => {
    try {
      const files = await storage.getTaskFiles(req.params.id);
      res.json(files);
    } catch (error: any) {
      console.error("Error fetching task files:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task files" });
    }
  });

  app.post("/api/tasks/:id/files", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), upload.single("file"), async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // For now, store file as base64 data URL (in production, use cloud storage)
      const base64 = file.buffer.toString("base64");
      const dataUrl = `data:${file.mimetype};base64,${base64}`;

      const taskFile = await storage.createTaskFile({
        taskId: req.params.id,
        fileName: file.originalname,
        fileUrl: dataUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      });
      res.status(201).json(taskFile);
    } catch (error: any) {
      console.error("Error uploading task file:", error);
      res.status(500).json({ error: error.message || "Failed to upload task file" });
    }
  });

  app.delete("/api/task-files/:id", requireAuth, requirePermission("tasks", "VIEW_AND_UPDATE"), async (req, res) => {
    try {
      await storage.deleteTaskFile(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting task file:", error);
      res.status(500).json({ error: error.message || "Failed to delete task file" });
    }
  });

  // Task Notifications
  app.get("/api/task-notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const notifications = await storage.getTaskNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching task notifications:", error);
      res.status(500).json({ error: error.message || "Failed to fetch task notifications" });
    }
  });

  app.get("/api/task-notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const count = await storage.getUnreadTaskNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread task notification count:", error);
      res.status(500).json({ error: error.message || "Failed to fetch count" });
    }
  });

  app.post("/api/task-notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const notification = await storage.getTaskNotificationById(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (notification.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to mark this notification" });
      }
      await storage.markTaskNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: error.message || "Failed to mark notification read" });
    }
  });

  app.post("/api/task-notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      await storage.markAllTaskNotificationsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ error: error.message || "Failed to mark notifications read" });
    }
  });

  // ==================== DATA DELETION MANAGEMENT ====================

  const dataDeletionCategories = [
    "panels",
    "production_slots", 
    "drafting_program",
    "daily_logs",
    "purchase_orders",
    "logistics",
    "weekly_wages",
    "chats",
    "tasks",
    "suppliers",
    "jobs"
  ] as const;

  type DeletionCategory = typeof dataDeletionCategories[number];

  app.get("/api/admin/data-deletion/counts", requireRole("ADMIN"), async (req, res) => {
    try {
      const counts: Record<string, number> = {};
      
      const [panelCount] = await db.select({ count: sql<number>`count(*)` }).from(panelRegister);
      counts.panels = Number(panelCount.count);
      
      const [slotCount] = await db.select({ count: sql<number>`count(*)` }).from(productionSlots);
      counts.production_slots = Number(slotCount.count);
      
      const [draftingCount] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram);
      counts.drafting_program = Number(draftingCount.count);
      
      const [logCount] = await db.select({ count: sql<number>`count(*)` }).from(dailyLogs);
      counts.daily_logs = Number(logCount.count);
      
      const [poCount] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
      counts.purchase_orders = Number(poCount.count);
      
      const [loadListCount] = await db.select({ count: sql<number>`count(*)` }).from(loadLists);
      counts.logistics = Number(loadListCount.count);
      
      const [wageCount] = await db.select({ count: sql<number>`count(*)` }).from(weeklyWageReports);
      counts.weekly_wages = Number(wageCount.count);
      
      const [chatCount] = await db.select({ count: sql<number>`count(*)` }).from(conversations);
      counts.chats = Number(chatCount.count);
      
      const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks);
      counts.tasks = Number(taskCount.count);
      
      const [supplierCount] = await db.select({ count: sql<number>`count(*)` }).from(suppliers);
      counts.suppliers = Number(supplierCount.count);
      
      const [jobCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs);
      counts.jobs = Number(jobCount.count);
      
      res.json(counts);
    } catch (error: any) {
      console.error("Error fetching data counts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch data counts" });
    }
  });

  app.post("/api/admin/data-deletion/validate", requireRole("ADMIN"), async (req, res) => {
    try {
      const { categories } = req.body as { categories: DeletionCategory[] };
      
      if (!categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: "No categories selected" });
      }
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      const selected = new Set(categories);
      
      if (selected.has("suppliers") && !selected.has("purchase_orders")) {
        const [poWithSupplier] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
        if (Number(poWithSupplier.count) > 0) {
          errors.push("Cannot delete Suppliers while Purchase Orders exist. Select Purchase Orders for deletion first, or delete them manually.");
        }
      }
      
      if (selected.has("jobs")) {
        if (!selected.has("panels")) {
          const [panelWithJob] = await db.select({ count: sql<number>`count(*)` }).from(panelRegister);
          if (Number(panelWithJob.count) > 0) {
            errors.push("Cannot delete Jobs while Panels exist. Select Panels for deletion first.");
          }
        }
        if (!selected.has("production_slots")) {
          const [slotWithJob] = await db.select({ count: sql<number>`count(*)` }).from(productionSlots);
          if (Number(slotWithJob.count) > 0) {
            errors.push("Cannot delete Jobs while Production Slots exist. Select Production Slots for deletion first.");
          }
        }
        if (!selected.has("drafting_program")) {
          const [draftingWithJob] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram);
          if (Number(draftingWithJob.count) > 0) {
            errors.push("Cannot delete Jobs while Drafting Program entries exist. Select Drafting Program for deletion first.");
          }
        }
        if (!selected.has("logistics")) {
          const [loadListWithJob] = await db.select({ count: sql<number>`count(*)` }).from(loadLists);
          if (Number(loadListWithJob.count) > 0) {
            errors.push("Cannot delete Jobs while Load Lists exist. Select Logistics for deletion first.");
          }
        }
        if (!selected.has("daily_logs")) {
          const [logsWithJob] = await db.select({ count: sql<number>`count(*)` })
            .from(logRows)
            .where(isNotNull(logRows.jobId));
          if (Number(logsWithJob.count) > 0) {
            warnings.push("Some Daily Logs reference Jobs. Job references in logs will be cleared.");
          }
        }
        const [weeklyJobReportCount] = await db.select({ count: sql<number>`count(*)` }).from(weeklyJobReports);
        if (Number(weeklyJobReportCount.count) > 0) {
          warnings.push(`${weeklyJobReportCount.count} Weekly Job Reports will also be deleted with Jobs.`);
        }
      }
      
      if (selected.has("panels")) {
        if (!selected.has("drafting_program")) {
          const [draftingWithPanel] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram);
          if (Number(draftingWithPanel.count) > 0) {
            errors.push("Cannot delete Panels while Drafting Program entries exist. Select Drafting Program for deletion first.");
          }
        }
        if (!selected.has("logistics")) {
          const [loadPanels] = await db.select({ count: sql<number>`count(*)` }).from(loadListPanels);
          if (Number(loadPanels.count) > 0) {
            errors.push("Cannot delete Panels while Load Lists contain panels. Select Logistics for deletion first.");
          }
        }
        const [prodEntries] = await db.select({ count: sql<number>`count(*)` }).from(productionEntries);
        if (Number(prodEntries.count) > 0) {
          warnings.push(`${prodEntries.count} Production Entries will also be deleted with Panels.`);
        }
      }
      
      if (selected.has("production_slots") && !selected.has("drafting_program")) {
        const [draftingWithSlot] = await db.select({ count: sql<number>`count(*)` })
          .from(draftingProgram)
          .where(isNotNull(draftingProgram.productionSlotId));
        if (Number(draftingWithSlot.count) > 0) {
          warnings.push("Production slot references in Drafting Program will be cleared.");
        }
      }
      
      if (selected.has("tasks")) {
        const [taskGroupCount] = await db.select({ count: sql<number>`count(*)` }).from(taskGroups);
        if (Number(taskGroupCount.count) > 0) {
          warnings.push("Task Groups will also be deleted along with Tasks.");
        }
      }
      
      res.json({ 
        valid: errors.length === 0,
        errors,
        warnings
      });
    } catch (error: any) {
      console.error("Error validating deletion:", error);
      res.status(500).json({ error: error.message || "Failed to validate deletion" });
    }
  });

  app.post("/api/admin/data-deletion/delete", requireRole("ADMIN"), async (req, res) => {
    try {
      const { categories } = req.body as { categories: DeletionCategory[] };
      
      if (!categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: "No categories selected" });
      }
      
      const selected = new Set(categories);
      const deletedCounts: Record<string, number> = {};
      
      if (selected.has("drafting_program")) {
        const result = await db.delete(draftingProgram);
        deletedCounts.drafting_program = result.rowCount || 0;
      }
      
      if (selected.has("logistics")) {
        await db.delete(deliveryRecords);
        await db.delete(loadListPanels);
        const result = await db.delete(loadLists);
        deletedCounts.logistics = result.rowCount || 0;
      }
      
      if (selected.has("daily_logs")) {
        await db.delete(approvalEvents);
        await db.delete(logRows);
        const result = await db.delete(dailyLogs);
        deletedCounts.daily_logs = result.rowCount || 0;
      }
      
      if (selected.has("weekly_wages")) {
        const result = await db.delete(weeklyWageReports);
        deletedCounts.weekly_wages = result.rowCount || 0;
      }
      
      if (selected.has("purchase_orders")) {
        await db.delete(purchaseOrderAttachments);
        await db.delete(purchaseOrderItems);
        const result = await db.delete(purchaseOrders);
        deletedCounts.purchase_orders = result.rowCount || 0;
      }
      
      if (selected.has("chats")) {
        await db.delete(chatNotifications);
        await db.delete(chatMessageMentions);
        await db.delete(chatMessageReactions);
        await db.delete(chatMessageAttachments);
        await db.delete(chatMessages);
        await db.delete(conversationMembers);
        const result = await db.delete(conversations);
        deletedCounts.chats = result.rowCount || 0;
        await db.delete(userChatSettings);
      }
      
      if (selected.has("tasks")) {
        await db.delete(taskNotifications);
        await db.delete(taskFiles);
        await db.delete(taskUpdates);
        await db.delete(taskAssignees);
        await db.delete(tasks);
        const result = await db.delete(taskGroups);
        deletedCounts.tasks = result.rowCount || 0;
      }
      
      if (selected.has("panels")) {
        await db.update(conversations).set({ panelId: null }).where(isNotNull(conversations.panelId));
        await db.update(logRows).set({ panelRegisterId: null }).where(isNotNull(logRows.panelRegisterId));
        await db.delete(productionEntries);
        const result = await db.delete(panelRegister);
        deletedCounts.panels = result.rowCount || 0;
      }
      
      if (selected.has("production_slots")) {
        await db.update(draftingProgram).set({ productionSlotId: null }).where(isNotNull(draftingProgram.productionSlotId));
        await db.delete(productionSlotAdjustments);
        const result = await db.delete(productionSlots);
        deletedCounts.production_slots = result.rowCount || 0;
      }
      
      if (selected.has("suppliers")) {
        await db.delete(items);
        await db.delete(itemCategories);
        const result = await db.delete(suppliers);
        deletedCounts.suppliers = result.rowCount || 0;
      }
      
      if (selected.has("jobs")) {
        await db.update(conversations).set({ jobId: null }).where(isNotNull(conversations.jobId));
        await db.update(logRows).set({ jobId: null }).where(isNotNull(logRows.jobId));
        await db.delete(weeklyJobReportSchedules);
        await db.delete(weeklyJobReports);
        await db.delete(productionDays);
        await db.delete(jobPanelRates);
        await db.delete(mappingRules);
        await db.delete(jobLevelCycleTimes);
        const result = await db.delete(jobs);
        deletedCounts.jobs = result.rowCount || 0;
      }
      
      res.json({ 
        success: true,
        deleted: deletedCounts
      });
    } catch (error: any) {
      console.error("Error performing deletion:", error);
      res.status(500).json({ error: error.message || "Failed to delete data" });
    }
  });

  // Factory Management Routes
  app.get("/api/admin/factories", requireRole("ADMIN"), async (req, res) => {
    try {
      const allFactories = await db.select().from(factories).orderBy(factories.name);
      res.json(allFactories);
    } catch (error: any) {
      console.error("Error fetching factories:", error);
      res.status(500).json({ error: error.message || "Failed to fetch factories" });
    }
  });

  app.get("/api/factories", requireAuth, async (req, res) => {
    try {
      const activeFactories = await db.select().from(factories).where(eq(factories.isActive, true)).orderBy(factories.name);
      res.json(activeFactories);
    } catch (error: any) {
      console.error("Error fetching factories:", error);
      res.status(500).json({ error: error.message || "Failed to fetch factories" });
    }
  });

  app.get("/api/admin/factories/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const factory = await db.select().from(factories).where(eq(factories.id, req.params.id)).limit(1);
      if (factory.length === 0) {
        return res.status(404).json({ error: "Factory not found" });
      }
      const beds = await db.select().from(productionBeds).where(eq(productionBeds.factoryId, req.params.id)).orderBy(productionBeds.name);
      res.json({ ...factory[0], beds });
    } catch (error: any) {
      console.error("Error fetching factory:", error);
      res.status(500).json({ error: error.message || "Failed to fetch factory" });
    }
  });

  app.post("/api/admin/factories", requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = insertFactorySchema.parse(req.body);
      const [created] = await db.insert(factories).values(parsed).returning();
      res.json(created);
    } catch (error: any) {
      console.error("Error creating factory:", error);
      res.status(500).json({ error: error.message || "Failed to create factory" });
    }
  });

  app.patch("/api/admin/factories/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const { beds, ...factoryData } = req.body;
      const [updated] = await db.update(factories)
        .set({ ...factoryData, updatedAt: new Date() })
        .where(eq(factories.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Factory not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating factory:", error);
      res.status(500).json({ error: error.message || "Failed to update factory" });
    }
  });

  app.delete("/api/admin/factories/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const [deleted] = await db.delete(factories).where(eq(factories.id, req.params.id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "Factory not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting factory:", error);
      res.status(500).json({ error: error.message || "Failed to delete factory" });
    }
  });

  // Production Beds Routes
  app.get("/api/admin/factories/:factoryId/beds", requireRole("ADMIN"), async (req, res) => {
    try {
      const beds = await db.select().from(productionBeds).where(eq(productionBeds.factoryId, req.params.factoryId)).orderBy(productionBeds.name);
      res.json(beds);
    } catch (error: any) {
      console.error("Error fetching production beds:", error);
      res.status(500).json({ error: error.message || "Failed to fetch production beds" });
    }
  });

  app.post("/api/admin/factories/:factoryId/beds", requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = insertProductionBedSchema.parse({ ...req.body, factoryId: req.params.factoryId });
      const [created] = await db.insert(productionBeds).values(parsed).returning();
      res.json(created);
    } catch (error: any) {
      console.error("Error creating production bed:", error);
      res.status(500).json({ error: error.message || "Failed to create production bed" });
    }
  });

  app.patch("/api/admin/factories/:factoryId/beds/:bedId", requireRole("ADMIN"), async (req, res) => {
    try {
      const [updated] = await db.update(productionBeds)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(productionBeds.id, req.params.bedId), eq(productionBeds.factoryId, req.params.factoryId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Production bed not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating production bed:", error);
      res.status(500).json({ error: error.message || "Failed to update production bed" });
    }
  });

  app.delete("/api/admin/factories/:factoryId/beds/:bedId", requireRole("ADMIN"), async (req, res) => {
    try {
      const [deleted] = await db.delete(productionBeds)
        .where(and(eq(productionBeds.id, req.params.bedId), eq(productionBeds.factoryId, req.params.factoryId)))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: "Production bed not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting production bed:", error);
      res.status(500).json({ error: error.message || "Failed to delete production bed" });
    }
  });

  // CFMEU Calendar Routes
  const CFMEU_CALENDAR_URLS: Record<string, { url: string; years: number[] }[]> = {
    VIC_ONSITE: [
      { url: "https://vic.cfmeu.org/wp-content/uploads/2024/11/rdo-onsite-2025.ics", years: [2025] },
      { url: "https://vic.cfmeu.org/wp-content/uploads/2025/11/36hr-onsite-rdo-calendar.ics", years: [2026] },
    ],
    VIC_OFFSITE: [
      { url: "https://vic.cfmeu.org/wp-content/uploads/2024/11/rdo-offsite-2025.ics", years: [2025] },
      { url: "https://vic.cfmeu.org/wp-content/uploads/2025/11/38hr-offsite-rdo-calendar.ics", years: [2026] },
    ],
    QLD: [
      { url: "https://qnt.cfmeu.org/rdo-calendar/?ical=1", years: [2025, 2026] },
    ],
  };

  async function parseIcsAndSaveHolidays(
    calendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD",
    icsContent: string,
    targetYears: number[]
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    try {
      const jcalData = ICAL.parse(icsContent);
      const comp = new ICAL.Component(jcalData);
      const events = comp.getAllSubcomponents("vevent");

      for (const event of events) {
        const icalEvent = new ICAL.Event(event);
        const dtstart = icalEvent.startDate;
        if (!dtstart) continue;

        const eventDate = dtstart.toJSDate();
        const eventYear = eventDate.getFullYear();

        if (!targetYears.includes(eventYear)) continue;

        const summary = icalEvent.summary || "Unnamed Holiday";
        
        let holidayType: "RDO" | "PUBLIC_HOLIDAY" | "OTHER" = "RDO";
        const lowerSummary = summary.toLowerCase();
        if (lowerSummary.includes("public holiday") || 
            lowerSummary.includes("australia day") || 
            lowerSummary.includes("anzac") ||
            lowerSummary.includes("christmas") ||
            lowerSummary.includes("good friday") ||
            lowerSummary.includes("easter") ||
            lowerSummary.includes("queen") ||
            lowerSummary.includes("king") ||
            lowerSummary.includes("labour day") ||
            lowerSummary.includes("melbourne cup")) {
          holidayType = "PUBLIC_HOLIDAY";
        } else if (lowerSummary.includes("branch meeting") || lowerSummary.includes("school")) {
          holidayType = "OTHER";
        }

        try {
          await db.insert(cfmeuHolidays).values({
            calendarType,
            date: eventDate,
            name: summary,
            holidayType,
            year: eventYear,
          }).onConflictDoUpdate({
            target: [cfmeuHolidays.calendarType, cfmeuHolidays.date],
            set: {
              name: summary,
              holidayType,
              year: eventYear,
            },
          });
          imported++;
        } catch (err) {
          skipped++;
        }
      }
    } catch (err) {
      console.error("Error parsing ICS:", err);
      throw new Error("Failed to parse ICS file");
    }

    return { imported, skipped };
  }

  app.get("/api/admin/cfmeu-calendars", requireRole("ADMIN"), async (req, res) => {
    try {
      const holidays = await db.select().from(cfmeuHolidays).orderBy(cfmeuHolidays.date);
      
      const summary: Record<string, { count: number; years: number[] }> = {};
      for (const h of holidays) {
        if (!summary[h.calendarType]) {
          summary[h.calendarType] = { count: 0, years: [] };
        }
        summary[h.calendarType].count++;
        if (!summary[h.calendarType].years.includes(h.year)) {
          summary[h.calendarType].years.push(h.year);
        }
      }

      res.json({ holidays, summary });
    } catch (error: any) {
      console.error("Error fetching CFMEU calendars:", error);
      res.status(500).json({ error: error.message || "Failed to fetch calendars" });
    }
  });

  app.post("/api/admin/cfmeu-calendars/sync", requireRole("ADMIN"), async (req, res) => {
    const { calendarType } = req.body;

    if (!calendarType || !["VIC_ONSITE", "VIC_OFFSITE", "QLD"].includes(calendarType)) {
      return res.status(400).json({ error: "Invalid calendar type" });
    }

    try {
      const urls = CFMEU_CALENDAR_URLS[calendarType];
      let totalImported = 0;
      let totalSkipped = 0;

      for (const { url, years } of urls) {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch ${url}: ${response.status}`);
          continue;
        }
        const icsContent = await response.text();
        const result = await parseIcsAndSaveHolidays(calendarType as any, icsContent, years);
        totalImported += result.imported;
        totalSkipped += result.skipped;
      }

      res.json({ 
        success: true, 
        imported: totalImported, 
        skipped: totalSkipped,
        message: `Synced ${calendarType} calendar: ${totalImported} holidays imported`
      });
    } catch (error: any) {
      console.error("Error syncing CFMEU calendar:", error);
      res.status(500).json({ error: error.message || "Failed to sync calendar" });
    }
  });

  app.post("/api/admin/cfmeu-calendars/sync-all", requireRole("ADMIN"), async (req, res) => {
    try {
      const results: Record<string, { imported: number; skipped: number }> = {};

      for (const calendarType of Object.keys(CFMEU_CALENDAR_URLS)) {
        const urls = CFMEU_CALENDAR_URLS[calendarType];
        let totalImported = 0;
        let totalSkipped = 0;

        for (const { url, years } of urls) {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              console.error(`Failed to fetch ${url}: ${response.status}`);
              continue;
            }
            const icsContent = await response.text();
            const result = await parseIcsAndSaveHolidays(calendarType as any, icsContent, years);
            totalImported += result.imported;
            totalSkipped += result.skipped;
          } catch (err) {
            console.error(`Error fetching ${url}:`, err);
          }
        }

        results[calendarType] = { imported: totalImported, skipped: totalSkipped };
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Error syncing all CFMEU calendars:", error);
      res.status(500).json({ error: error.message || "Failed to sync calendars" });
    }
  });

  app.delete("/api/admin/cfmeu-calendars/:calendarType", requireRole("ADMIN"), async (req, res) => {
    const { calendarType } = req.params;

    if (!["VIC_ONSITE", "VIC_OFFSITE", "QLD"].includes(calendarType)) {
      return res.status(400).json({ error: "Invalid calendar type" });
    }

    try {
      const result = await db.delete(cfmeuHolidays).where(eq(cfmeuHolidays.calendarType, calendarType as any));
      res.json({ success: true, deleted: result.rowCount || 0 });
    } catch (error: any) {
      console.error("Error deleting CFMEU calendar:", error);
      res.status(500).json({ error: error.message || "Failed to delete calendar" });
    }
  });

  return httpServer;
}
