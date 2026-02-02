import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage, sha256Hex } from "./storage";
import { loginSchema, agentIngestSchema, insertJobSchema, insertPanelRegisterSchema, insertWorkTypeSchema, insertWeeklyWageReportSchema } from "@shared/schema";
import { z } from "zod";
import * as XLSX from "xlsx";
import { format, subDays } from "date-fns";

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

  app.get("/api/daily-logs", requireAuth, async (req, res) => {
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
        logsWithStats.push({
          id: log.id,
          logDay: log.logDay,
          status: log.status,
          totalMinutes,
          idleMinutes,
          missingPanelMarkMinutes,
          missingJobMinutes,
          rowCount: fullLog.rows.length,
          userName: fullLog.user.name,
          userEmail: fullLog.user.email,
          rows: fullLog.rows, // Include rows for auto-fill in Manual Entry
        });
      }
    }
    res.json(logsWithStats);
  });

  app.post("/api/daily-logs", requireAuth, async (req, res) => {
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

  app.delete("/api/daily-logs/:id", requireAuth, async (req, res) => {
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
    const panels = await storage.getAllPanelRegisterItems();
    res.json(panels);
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
    const settings = await storage.updateGlobalSettings(req.body);
    res.json(settings);
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
      const job = await storage.createJob(req.body);
      res.json(job);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create job" });
    }
  });

  app.put("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    const job = await storage.updateJob(req.params.id as string, req.body);
    res.json(job);
  });

  app.delete("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteJob(req.params.id as string);
    res.json({ ok: true });
  });

  app.post("/api/admin/jobs/import", requireRole("ADMIN"), async (req, res) => {
    try {
      const { data } = req.body;
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid import data" });
      }
      
      const jobsToImport = data.map((row: any) => ({
        jobNumber: String(row.jobNumber || row["Job Number"] || row.job_number || "").trim(),
        name: String(row.name || row["Name"] || row["Job Name"] || "").trim(),
        client: row.client || row["Client"] || null,
        address: row.address || row["Address"] || null,
        description: row.description || row["Description"] || null,
        status: "ACTIVE" as const,
      })).filter((j: any) => j.jobNumber && j.name);
      
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
    const panels = await storage.getAllPanelRegisterItems();
    res.json(panels);
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

  app.delete("/api/admin/panels/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deletePanelRegisterItem(req.params.id as string);
    res.json({ ok: true });
  });

  app.post("/api/admin/panels/import", requireRole("ADMIN"), async (req, res) => {
    try {
      const { data, jobId } = req.body;
      if (!data || !Array.isArray(data) || !jobId) {
        return res.status(400).json({ error: "Invalid import data or missing job ID" });
      }
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const panelsToImport = data.map((row: any) => {
        const typeRaw = (row.panelType || row["Panel Type"] || row.panel_type || row["Type"] || "WALL").toUpperCase().replace(/ /g, "_");
        const validTypes = ["WALL", "COLUMN", "CUBE_BASE", "CUBE_RING", "LANDING_WALL", "OTHER"];
        const panelType = validTypes.includes(typeRaw) ? typeRaw as any : "OTHER";
        return {
          jobId,
          panelMark: String(row.panelMark || row["Panel Mark"] || row.panel_mark || row["Mark"] || "").trim(),
          panelType,
          description: row.description || row["Description"] || null,
          drawingCode: row.drawingCode || row["Drawing Code"] || row.drawing_code || null,
          sheetNumber: row.sheetNumber || row["Sheet Number"] || row.sheet_number || null,
          estimatedHours: row.estimatedHours || row["Estimated Hours"] || row.estimated_hours ? Number(row.estimatedHours || row["Estimated Hours"] || row.estimated_hours) : null,
          status: "NOT_STARTED" as const,
        };
      }).filter((p: any) => p.panelMark);
      
      const result = await storage.importPanelRegister(panelsToImport);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Import failed" });
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

  app.get("/api/production-entries", requireAuth, async (req, res) => {
    const date = req.query.date as string;
    if (date) {
      const entries = await storage.getProductionEntriesByDate(date);
      res.json(entries);
    } else {
      const entries = await storage.getAllProductionEntries();
      res.json(entries);
    }
  });

  app.get("/api/production-entries/:id", requireAuth, async (req, res) => {
    const entry = await storage.getProductionEntry(req.params.id as string);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  });

  app.post("/api/production-entries", requireAuth, async (req, res) => {
    try {
      // Validate that the panel is approved for production
      const { panelId } = req.body;
      if (panelId) {
        const panel = await storage.getPanelById(panelId);
        if (!panel) {
          return res.status(404).json({ error: "Panel not found" });
        }
        if (!panel.approvedForProduction) {
          return res.status(400).json({ error: "Panel is not approved for production. Please approve the panel in the Panel Register first." });
        }
      }
      
      const entryData = {
        ...req.body,
        userId: req.session.userId!,
      };
      const entry = await storage.createProductionEntry(entryData);
      res.json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create production entry" });
    }
  });

  app.put("/api/production-entries/:id", requireAuth, async (req, res) => {
    const entry = await storage.updateProductionEntry(req.params.id as string, req.body);
    res.json(entry);
  });

  app.delete("/api/production-entries/:id", requireAuth, async (req, res) => {
    await storage.deleteProductionEntry(req.params.id as string);
    res.json({ ok: true });
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
        });
      }
      
      const report = reportsByKey.get(key)!;
      report.entryCount++;
      report.panelCount++;
      report.totalVolumeM3 += parseFloat(entry.volumeM3 || "0");
      report.totalAreaM2 += parseFloat(entry.areaM2 || "0");
      report.jobIds.add(entry.jobId);
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

  // Load Lists
  app.get("/api/load-lists", requireAuth, async (req, res) => {
    const loadLists = await storage.getAllLoadLists();
    res.json(loadLists);
  });

  app.get("/api/load-lists/:id", requireAuth, async (req, res) => {
    const loadList = await storage.getLoadList(req.params.id as string);
    if (!loadList) return res.status(404).json({ error: "Load list not found" });
    res.json(loadList);
  });

  app.post("/api/load-lists", requireAuth, async (req, res) => {
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

  app.put("/api/load-lists/:id", requireAuth, async (req, res) => {
    const loadList = await storage.updateLoadList(req.params.id as string, req.body);
    res.json(loadList);
  });

  app.delete("/api/load-lists/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    await storage.deleteLoadList(req.params.id as string);
    res.json({ success: true });
  });

  app.post("/api/load-lists/:id/panels", requireAuth, async (req, res) => {
    const { panelId, sequence } = req.body;
    const panel = await storage.addPanelToLoadList(req.params.id as string, panelId, sequence);
    res.json(panel);
  });

  app.delete("/api/load-lists/:id/panels/:panelId", requireAuth, async (req, res) => {
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
  app.get("/api/weekly-wage-reports", requireAuth, async (req, res) => {
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

  app.get("/api/weekly-wage-reports/:id", requireAuth, async (req, res) => {
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

  app.post("/api/weekly-wage-reports", requireAuth, async (req, res) => {
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

  app.put("/api/weekly-wage-reports/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/weekly-wage-reports/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
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
        const costComponents = await storage.getCostComponentsForPanelType(panelType.id);
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

  return httpServer;
}
