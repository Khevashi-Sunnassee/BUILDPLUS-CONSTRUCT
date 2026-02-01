import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage, sha256Hex } from "./storage";
import { loginSchema, agentIngestSchema, insertJobSchema, insertPanelRegisterSchema } from "@shared/schema";
import { z } from "zod";
import * as XLSX from "xlsx";

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
        const missingProjectMinutes = fullLog.rows.filter(r => !r.projectId).reduce((sum, r) => sum + r.durationMin, 0);
        logsWithStats.push({
          id: log.id,
          logDay: log.logDay,
          status: log.status,
          totalMinutes,
          idleMinutes,
          missingPanelMarkMinutes,
          missingProjectMinutes,
          rowCount: fullLog.rows.length,
          userName: fullLog.user.name,
          userEmail: fullLog.user.email,
        });
      }
    }
    res.json(logsWithStats);
  });

  app.get("/api/daily-logs/submitted", requireRole("MANAGER", "ADMIN"), async (req, res) => {
    const logs = await storage.getSubmittedDailyLogs();
    res.json(logs);
  });

  app.get("/api/daily-logs/:id", requireAuth, async (req, res) => {
    const log = await storage.getDailyLog(req.params.id);
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
    const existingLog = await storage.getDailyLog(req.params.id);
    if (!existingLog) {
      return res.status(404).json({ error: "Log not found" });
    }
    if (existingLog.userId !== req.session.userId) {
      return res.status(403).json({ error: "You can only submit your own logs" });
    }
    const log = await storage.updateDailyLogStatus(req.params.id, {
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
    const log = await storage.updateDailyLogStatus(req.params.id, {
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
    const row = await storage.getLogRow(req.params.id);
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
    const { panelMark, drawingCode, notes, projectId } = req.body;
    const updatedRow = await storage.updateLogRow(req.params.id, {
      panelMark,
      drawingCode,
      notes,
      projectId,
      isUserEdited: true,
    });
    res.json({ row: updatedRow });
  });

  // Manual time entry - same structure as agent ingestion
  app.post("/api/manual-entry", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { logDay, projectId, jobId, panelRegisterId, app, startTime, endTime, fileName, filePath,
              revitViewName, revitSheetNumber, revitSheetName, acadLayoutName,
              panelMark, drawingCode, notes } = req.body;

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
        projectId: projectId || undefined,
        jobId: jobId || undefined,
        panelRegisterId: panelRegisterId || undefined,
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
        rawPanelMark: panelMark || undefined,
        rawDrawingCode: drawingCode || undefined,
        panelMark: panelMark || undefined,
        drawingCode: drawingCode || undefined,
        notes: notes || undefined,
        isUserEdited: true,
      });

      // Update panel's actualHours if linked to a panel register
      if (panelRegisterId) {
        await storage.updatePanelActualHours(panelRegisterId, durationMin);
      }

      res.json({ ok: true, dailyLogId: dailyLog.id });
    } catch (error) {
      console.error("Manual entry error:", error);
      res.status(500).json({ error: "Failed to create time entry" });
    }
  });

  app.get("/api/projects", requireAuth, async (req, res) => {
    const projects = await storage.getAllProjects();
    res.json(projects.map(p => ({ id: p.id, name: p.name, code: p.code })));
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

  app.get("/api/admin/projects", requireRole("ADMIN"), async (req, res) => {
    const projects = await storage.getAllProjects();
    res.json(projects);
  });

  app.post("/api/admin/projects", requireRole("ADMIN"), async (req, res) => {
    const project = await storage.createProject(req.body);
    res.json(project);
  });

  app.put("/api/admin/projects/:id", requireRole("ADMIN"), async (req, res) => {
    const project = await storage.updateProject(req.params.id, req.body);
    res.json(project);
  });

  app.delete("/api/admin/projects/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteProject(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/admin/projects/:id/rules", requireRole("ADMIN"), async (req, res) => {
    const rule = await storage.createMappingRule({
      projectId: req.params.id,
      pathContains: req.body.pathContains,
      priority: req.body.priority || 100,
    });
    res.json(rule);
  });

  app.delete("/api/admin/mapping-rules/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteMappingRule(req.params.id);
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
    const device = await storage.updateDevice(req.params.id, req.body);
    res.json(device);
  });

  app.delete("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteDevice(req.params.id);
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
    const user = await storage.updateUser(req.params.id, req.body);
    res.json({ ...user, passwordHash: undefined });
  });

  app.delete("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteUser(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/admin/jobs", requireRole("ADMIN"), async (req, res) => {
    const allJobs = await storage.getAllJobs();
    res.json(allJobs);
  });

  app.get("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    const job = await storage.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  app.post("/api/admin/jobs", requireRole("ADMIN"), async (req, res) => {
    try {
      const existing = await storage.getJobByNumber(req.body.jobNumber);
      if (existing) {
        return res.status(400).json({ error: "Job with this number already exists" });
      }
      const jobData = {
        ...req.body,
        projectId: req.body.projectId && req.body.projectId !== "none" ? req.body.projectId : null,
      };
      const job = await storage.createJob(jobData);
      res.json(job);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create job" });
    }
  });

  app.put("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    const jobData = {
      ...req.body,
      projectId: req.body.projectId && req.body.projectId !== "none" ? req.body.projectId : null,
    };
    const job = await storage.updateJob(req.params.id, jobData);
    res.json(job);
  });

  app.delete("/api/admin/jobs/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteJob(req.params.id);
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

  app.get("/api/admin/panels", requireRole("ADMIN"), async (req, res) => {
    const panels = await storage.getAllPanelRegisterItems();
    res.json(panels);
  });

  app.get("/api/admin/panels/by-job/:jobId", requireRole("ADMIN"), async (req, res) => {
    const panels = await storage.getPanelsByJob(req.params.jobId);
    res.json(panels);
  });

  app.get("/api/admin/panels/:id", requireRole("ADMIN"), async (req, res) => {
    const panel = await storage.getPanelRegisterItem(req.params.id);
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
    const panel = await storage.updatePanelRegisterItem(req.params.id, req.body);
    res.json(panel);
  });

  app.delete("/api/admin/panels/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deletePanelRegisterItem(req.params.id);
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
    const panels = await storage.getPanelsByJob(req.params.jobId);
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
    const entry = await storage.getProductionEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  });

  app.post("/api/production-entries", requireAuth, async (req, res) => {
    try {
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
    const entry = await storage.updateProductionEntry(req.params.id, req.body);
    res.json(entry);
  });

  app.delete("/api/production-entries/:id", requireAuth, async (req, res) => {
    await storage.deleteProductionEntry(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/production-summary", requireAuth, async (req, res) => {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: "Date required" });
    const summary = await storage.getProductionSummaryByDate(date);
    res.json(summary);
  });

  app.get("/api/admin/panel-types", requireRole("ADMIN"), async (req, res) => {
    const types = await storage.getAllPanelTypes();
    res.json(types);
  });

  app.get("/api/admin/panel-types/:id", requireRole("ADMIN"), async (req, res) => {
    const type = await storage.getPanelType(req.params.id);
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
    const type = await storage.updatePanelType(req.params.id, req.body);
    if (!type) return res.status(404).json({ error: "Panel type not found" });
    res.json(type);
  });

  app.delete("/api/admin/panel-types/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deletePanelType(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/panel-types", requireAuth, async (req, res) => {
    const types = await storage.getAllPanelTypes();
    res.json(types.filter(t => t.isActive));
  });

  app.get("/api/projects/:projectId/panel-rates", requireAuth, async (req, res) => {
    const rates = await storage.getEffectiveRates(req.params.projectId);
    res.json(rates);
  });

  app.put("/api/projects/:projectId/panel-rates/:panelTypeId", requireRole("ADMIN"), async (req, res) => {
    try {
      const rate = await storage.upsertProjectPanelRate(req.params.projectId, req.params.panelTypeId, req.body);
      res.json(rate);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update project rate" });
    }
  });

  app.delete("/api/projects/:projectId/panel-rates/:rateId", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteProjectPanelRate(req.params.rateId);
    res.json({ ok: true });
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

        let mappedProjectId: string | null = null;
        if (!b.projectId && b.filePath) {
          const match = rules.find(r => b.filePath!.toLowerCase().includes(r.pathContains.toLowerCase()));
          if (match) mappedProjectId = match.projectId;
        }

        await storage.upsertLogRow(b.sourceEventId, {
          dailyLogId: dailyLog.id,
          projectId: b.projectId || mappedProjectId || undefined,
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

  return httpServer;
}
