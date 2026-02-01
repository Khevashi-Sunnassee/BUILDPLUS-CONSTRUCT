import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage, sha256Hex } from "./storage";
import { loginSchema, agentIngestSchema } from "@shared/schema";
import { z } from "zod";

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

  app.get("/api/projects", requireAuth, async (req, res) => {
    const projects = await storage.getAllProjects();
    res.json(projects.map(p => ({ id: p.id, name: p.name, code: p.code })));
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
