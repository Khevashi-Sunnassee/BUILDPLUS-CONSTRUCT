import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import multer from "multer";
import { storage, sha256Hex } from "./storage";
import { loginSchema, agentIngestSchema, insertJobSchema, insertPanelRegisterSchema, insertWorkTypeSchema, insertWeeklyWageReportSchema, InsertItem } from "@shared/schema";
import { z } from "zod";
import * as XLSX from "xlsx";
import { format, subDays } from "date-fns";

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

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats(req.session.userId!);
    res.json(stats);
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
      const job = await storage.createJob(data);
      res.json(job);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create job" });
    }
  });

  app.put("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const data = { ...req.body };
      // Convert productionStartDate string to Date if present
      if (data.productionStartDate && typeof data.productionStartDate === 'string') {
        data.productionStartDate = new Date(data.productionStartDate);
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
    
    const result = await storage.getPaginatedPanelRegisterItems({ page, limit, jobId, search, status, documentStatus });
    res.json(result);
  });

  app.get("/api/admin/panels/by-job/:jobId", requireRole("ADMIN"), async (req, res) => {
    const panels = await storage.getPanelsByJob(req.params.jobId as string);
    res.json(panels);
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
      
      // If a specific jobId is provided, use it as fallback
      let fallbackJob = null;
      if (jobId) {
        fallbackJob = await storage.getJob(jobId);
      }
      
      const panelsToImport: any[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // Excel row (1-indexed + header row)
        
        // Get job number from Excel row
        const jobNumber = String(row.jobNumber || row["Job Number"] || row.job_number || row["Job"] || "").trim();
        
        // Look up job by number or use fallback
        let resolvedJob = null;
        if (jobNumber) {
          resolvedJob = jobsByNumber[jobNumber.toLowerCase()];
          if (!resolvedJob) {
            errors.push(`Row ${rowNumber}: Job "${jobNumber}" not found`);
            continue;
          }
        } else if (fallbackJob) {
          resolvedJob = fallbackJob;
        } else {
          errors.push(`Row ${rowNumber}: No job specified and no fallback job selected`);
          continue;
        }
        
        const panelMark = String(row.panelMark || row["Panel Mark"] || row.panel_mark || row["Mark"] || "").trim();
        if (!panelMark) {
          errors.push(`Row ${rowNumber}: Missing panel mark`);
          continue;
        }
        
        const typeRaw = (row.panelType || row["Panel Type"] || row.panel_type || row["Type"] || "WALL").toUpperCase().replace(/ /g, "_");
        const validTypes = ["WALL", "COLUMN", "CUBE_BASE", "CUBE_RING", "LANDING_WALL", "OTHER"];
        const panelType = validTypes.includes(typeRaw) ? typeRaw as any : "OTHER";
        
        panelsToImport.push({
          jobId: resolvedJob.id,
          panelMark,
          panelType,
          description: row.description || row["Description"] || null,
          drawingCode: row.drawingCode || row["Drawing Code"] || row.drawing_code || null,
          sheetNumber: row.sheetNumber || row["Sheet Number"] || row.sheet_number || null,
          building: row.building || row["Building"] || null,
          level: row.level || row["Level"] || null,
          structuralElevation: row.structuralElevation || row["Structural Elevation"] || row.structural_elevation || null,
          reckliDetail: row.reckliDetail || row["Reckli Detail"] || row.reckli_detail || null,
          source: 2, // Excel Template import
          estimatedHours: row.estimatedHours || row["Estimated Hours"] || row.estimated_hours ? Number(row.estimatedHours || row["Estimated Hours"] || row.estimated_hours) : null,
          status: "NOT_STARTED" as const,
        });
      }
      
      if (panelsToImport.length === 0) {
        return res.status(400).json({ 
          error: "No valid panels to import", 
          details: errors.slice(0, 10) // Show first 10 errors
        });
      }
      
      const result = await storage.importPanelRegister(panelsToImport);
      res.json({ 
        ...result, 
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined 
      });
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
            let panelType = "WALL";
            const typeRaw = String(rowData.panelType || category || "").toUpperCase().replace(/\s+/g, "_");
            if (typeRaw.includes("COLUMN")) panelType = "COLUMN";
            else if (typeRaw.includes("CUBE")) panelType = "CUBE_BASE";
            else if (typeRaw.includes("LID")) panelType = "OTHER";
            else if (typeRaw.includes("BEAM")) panelType = "OTHER";
            else if (typeRaw.includes("SLAB")) panelType = "OTHER";
            else if (typeRaw.includes("BALUSTRADE")) panelType = "OTHER";
            
            // Default building to "1" if no building and no zone provided
            const buildingValue = rowData.building ? String(rowData.building) : (rowData.zone ? "" : "1");
            
            // Normalize level by stripping "L" prefix (e.g., "L1" -> "1", "L10" -> "10")
            const rawLevel = String(rowData.level || "").trim();
            const normalizedLevel = rawLevel.replace(/^L/i, "");
            
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
        
        // Import all panels
        let imported = 0;
        let importErrors: string[] = [];
        
        if (panelsToImport.length > 0) {
          try {
            const importResult = await storage.importEstimatePanels(panelsToImport);
            imported = importResult.imported;
            importErrors = importResult.errors || [];
          } catch (err: any) {
            importErrors.push(err.message);
          }
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
      
      await storage.deleteProductionEntry(entryId);
      res.json({ success: true });
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
      
      const settings = await storage.getGlobalSettings();
      const productionWindowDays = settings?.productionWindowDays ?? 10;
      
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
      const filters: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date } = {};
      if (jobId) filters.jobId = jobId as string;
      if (status) filters.status = status as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
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

  app.post("/api/production-slots/generate/:jobId", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const slots = await storage.generateProductionSlotsForJob(req.params.jobId);
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

  return httpServer;
}
