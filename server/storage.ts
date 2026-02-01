import { eq, and, desc, sql, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users, devices, projects, mappingRules, dailyLogs, logRows,
  approvalEvents, auditEvents, globalSettings, jobs, panelRegister, productionEntries,
  panelTypes, projectPanelRates,
  type InsertUser, type User, type InsertDevice, type Device,
  type InsertProject, type Project, type InsertMappingRule, type MappingRule,
  type InsertDailyLog, type DailyLog, type InsertLogRow, type LogRow,
  type InsertApprovalEvent, type ApprovalEvent, type GlobalSettings,
  type InsertJob, type Job, type InsertPanelRegister, type PanelRegister,
  type InsertProductionEntry, type ProductionEntry,
  type InsertPanelType, type PanelTypeConfig, type InsertProjectPanelRate, type ProjectPanelRate,
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

export function sha256Hex(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function randomKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password?: string }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser & { isActive?: boolean; password?: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  validatePassword(user: User, password: string): Promise<boolean>;

  getDevice(id: string): Promise<(Device & { user: User }) | undefined>;
  getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined>;
  createDevice(data: { userId: string; deviceName: string; os: string }): Promise<{ device: Device; deviceKey: string }>;
  updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;
  getAllDevices(): Promise<(Device & { user: User })[]>;

  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  getAllProjects(): Promise<(Project & { mappingRules: MappingRule[] })[]>;

  createMappingRule(data: InsertMappingRule): Promise<MappingRule>;
  deleteMappingRule(id: string): Promise<void>;
  getMappingRules(): Promise<MappingRule[]>;

  getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { project?: Project })[]; user: User }) | undefined>;
  getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]>;
  getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { project?: Project })[]; user: User })[]>;
  upsertDailyLog(data: { userId: string; logDay: string; tz: string }): Promise<DailyLog>;
  updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined>;

  getLogRow(id: string): Promise<LogRow | undefined>;
  upsertLogRow(sourceEventId: string, data: Partial<InsertLogRow> & { dailyLogId: string }): Promise<LogRow>;
  updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; projectId: string; isUserEdited: boolean }>): Promise<LogRow | undefined>;

  createApprovalEvent(data: InsertApprovalEvent): Promise<ApprovalEvent>;

  getGlobalSettings(): Promise<GlobalSettings | undefined>;
  updateGlobalSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings>;

  getDashboardStats(userId: string): Promise<any>;
  getReports(period: string): Promise<any>;

  getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined>;
  getJobByNumber(jobNumber: string): Promise<Job | undefined>;
  createJob(data: InsertJob): Promise<Job>;
  updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;
  getAllJobs(): Promise<(Job & { panels: PanelRegister[]; project?: Project })[]>;
  importJobs(data: InsertJob[]): Promise<{ imported: number; skipped: number }>;

  getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined>;
  getPanelsByJob(jobId: string): Promise<PanelRegister[]>;
  createPanelRegisterItem(data: InsertPanelRegister): Promise<PanelRegister>;
  updatePanelRegisterItem(id: string, data: Partial<InsertPanelRegister>): Promise<PanelRegister | undefined>;
  deletePanelRegisterItem(id: string): Promise<void>;
  getAllPanelRegisterItems(): Promise<(PanelRegister & { job: Job })[]>;
  importPanelRegister(data: InsertPanelRegister[]): Promise<{ imported: number; skipped: number }>;
  updatePanelActualHours(panelId: string, additionalMinutes: number): Promise<void>;

  getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined>;
  getProductionEntriesByDate(date: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry>;
  updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined>;
  deleteProductionEntry(id: string): Promise<void>;
  getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionSummaryByDate(date: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]>;

  getPanelType(id: string): Promise<PanelTypeConfig | undefined>;
  getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined>;
  createPanelType(data: InsertPanelType): Promise<PanelTypeConfig>;
  updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined>;
  deletePanelType(id: string): Promise<void>;
  getAllPanelTypes(): Promise<PanelTypeConfig[]>;

  getProjectPanelRate(id: string): Promise<(ProjectPanelRate & { panelType: PanelTypeConfig }) | undefined>;
  getProjectPanelRates(projectId: string): Promise<(ProjectPanelRate & { panelType: PanelTypeConfig })[]>;
  upsertProjectPanelRate(projectId: string, panelTypeId: string, data: Partial<InsertProjectPanelRate>): Promise<ProjectPanelRate>;
  deleteProjectPanelRate(id: string): Promise<void>;
  getEffectiveRates(projectId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; projectRate?: ProjectPanelRate })[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(data: InsertUser & { password?: string }): Promise<User> {
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
      role: data.role || "USER",
      isActive: data.isActive ?? true,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser & { isActive?: boolean; password?: string }>): Promise<User | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async getDevice(id: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).where(eq(devices.id, id));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  }

  async getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id))
      .where(and(eq(devices.apiKeyHash, apiKeyHash), eq(devices.isActive, true)));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  }

  async createDevice(data: { userId: string; deviceName: string; os: string }): Promise<{ device: Device; deviceKey: string }> {
    const deviceKey = randomKey();
    const apiKeyHash = sha256Hex(deviceKey);
    const [device] = await db.insert(devices).values({
      userId: data.userId,
      deviceName: data.deviceName,
      os: data.os || "Windows",
      apiKeyHash,
      isActive: true,
    }).returning();
    return { device, deviceKey };
  }

  async updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set({ ...data, updatedAt: new Date() }).where(eq(devices.id, id)).returning();
    return device;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getAllDevices(): Promise<(Device & { user: User })[]> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).orderBy(desc(devices.createdAt));
    return result.map(r => ({ ...r.devices, user: r.users }));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(mappingRules).where(eq(mappingRules.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getAllProjects(): Promise<(Project & { mappingRules: MappingRule[] })[]> {
    const projectList = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const rules = await db.select().from(mappingRules).orderBy(asc(mappingRules.priority));
    return projectList.map(p => ({
      ...p,
      mappingRules: rules.filter(r => r.projectId === p.id),
    }));
  }

  async createMappingRule(data: InsertMappingRule): Promise<MappingRule> {
    const [rule] = await db.insert(mappingRules).values(data).returning();
    return rule;
  }

  async deleteMappingRule(id: string): Promise<void> {
    await db.delete(mappingRules).where(eq(mappingRules.id, id));
  }

  async getMappingRules(): Promise<MappingRule[]> {
    return db.select().from(mappingRules).orderBy(asc(mappingRules.priority));
  }

  async getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { project?: Project })[]; user: User }) | undefined> {
    const [log] = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id)).where(eq(dailyLogs.id, id));
    if (!log) return undefined;

    const rows = await db.select().from(logRows).leftJoin(projects, eq(logRows.projectId, projects.id))
      .where(eq(logRows.dailyLogId, id)).orderBy(asc(logRows.startAt));

    return {
      ...log.daily_logs,
      user: log.users,
      rows: rows.map(r => ({ ...r.log_rows, project: r.projects || undefined })),
    };
  }

  async getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]> {
    const conditions = [eq(dailyLogs.userId, userId)];
    
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(dailyLogs.status, filters.status as any));
    }
    
    if (filters?.dateRange && filters.dateRange !== "all") {
      const today = new Date();
      let startDate: Date;
      
      if (filters.dateRange === "today") {
        startDate = today;
      } else if (filters.dateRange === "week") {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
      } else if (filters.dateRange === "month") {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
      } else {
        startDate = new Date(0);
      }
      
      if (startDate.getTime() > 0) {
        const startDateStr = startDate.toISOString().split("T")[0];
        conditions.push(gte(dailyLogs.logDay, startDateStr));
      }
    }
    
    return db.select().from(dailyLogs).where(and(...conditions)).orderBy(desc(dailyLogs.logDay));
  }

  async getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { project?: Project })[]; user: User })[]> {
    const logs = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(eq(dailyLogs.status, "SUBMITTED")).orderBy(desc(dailyLogs.logDay));

    const result = [];
    for (const log of logs) {
      const rows = await db.select().from(logRows).leftJoin(projects, eq(logRows.projectId, projects.id))
        .where(eq(logRows.dailyLogId, log.daily_logs.id)).orderBy(asc(logRows.startAt));
      result.push({
        ...log.daily_logs,
        user: log.users,
        rows: rows.map(r => ({ ...r.log_rows, project: r.projects || undefined })),
      });
    }
    return result;
  }

  async upsertDailyLog(data: { userId: string; logDay: string; tz: string }): Promise<DailyLog> {
    const existing = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, data.userId), eq(dailyLogs.logDay, data.logDay), eq(dailyLogs.discipline, "DRAFTING")));
    if (existing[0]) return existing[0];

    const [log] = await db.insert(dailyLogs).values({
      userId: data.userId,
      logDay: data.logDay,
      tz: data.tz,
      discipline: "DRAFTING",
      status: "PENDING",
    }).returning();
    return log;
  }

  async updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined> {
    const [log] = await db.update(dailyLogs).set({ ...data, updatedAt: new Date() } as any).where(eq(dailyLogs.id, id)).returning();
    return log;
  }

  async getLogRow(id: string): Promise<LogRow | undefined> {
    const [row] = await db.select().from(logRows).where(eq(logRows.id, id));
    return row;
  }

  async upsertLogRow(sourceEventId: string, data: Partial<InsertLogRow> & { dailyLogId: string }): Promise<LogRow> {
    const existing = await db.select().from(logRows).where(eq(logRows.sourceEventId, sourceEventId));
    if (existing[0]) {
      const [row] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.sourceEventId, sourceEventId)).returning();
      return row;
    }

    const [row] = await db.insert(logRows).values({
      ...data,
      sourceEventId,
    } as any).returning();
    return row;
  }

  async updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; projectId: string; isUserEdited: boolean }>): Promise<LogRow | undefined> {
    const [row] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.id, id)).returning();
    return row;
  }

  async createApprovalEvent(data: InsertApprovalEvent): Promise<ApprovalEvent> {
    const [event] = await db.insert(approvalEvents).values(data).returning();
    return event;
  }

  async getGlobalSettings(): Promise<GlobalSettings | undefined> {
    const [settings] = await db.select().from(globalSettings);
    return settings;
  }

  async updateGlobalSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const existing = await this.getGlobalSettings();
    if (existing) {
      const [settings] = await db.update(globalSettings).set({ ...data, updatedAt: new Date() }).where(eq(globalSettings.id, existing.id)).returning();
      return settings;
    }
    const [settings] = await db.insert(globalSettings).values(data as any).returning();
    return settings;
  }

  async getDashboardStats(userId: string): Promise<any> {
    const today = new Date().toISOString().split("T")[0];

    const todayLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDay, today)));
    let todayMinutes = 0;
    let todayIdleMinutes = 0;
    if (todayLogs[0]) {
      const rows = await db.select().from(logRows).where(eq(logRows.dailyLogId, todayLogs[0].id));
      todayMinutes = rows.reduce((sum, r) => sum + r.durationMin, 0);
      todayIdleMinutes = rows.reduce((sum, r) => sum + r.idleMin, 0);
    }

    const pendingLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.status, "PENDING")));
    const submittedLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.status, "SUBMITTED")));
    const approvedLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.status, "APPROVED")));

    const recentLogs = await db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId)).orderBy(desc(dailyLogs.logDay)).limit(5);
    const recentLogsWithTotal = [];
    for (const log of recentLogs) {
      const rows = await db.select().from(logRows).where(eq(logRows.dailyLogId, log.id));
      const totalMinutes = rows.reduce((sum, r) => sum + r.durationMin, 0);
      recentLogsWithTotal.push({
        id: log.id,
        logDay: log.logDay,
        status: log.status,
        totalMinutes,
        app: rows[0]?.app || "revit",
      });
    }

    return {
      todayMinutes,
      todayIdleMinutes,
      pendingDays: pendingLogs.length,
      submittedAwaitingApproval: submittedLogs.length,
      approvedThisWeek: approvedLogs.length,
      recentLogs: recentLogsWithTotal,
    };
  }

  async getReports(period: string): Promise<any> {
    const today = new Date();
    let startDate: Date;
    
    if (period === "week") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
    } else if (period === "month") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
    } else if (period === "quarter") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
    } else if (period === "year") {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
    } else {
      startDate = new Date(0);
    }
    
    const startDateStr = startDate.toISOString().split("T")[0];
    
    const allRows = await db.select().from(logRows)
      .innerJoin(dailyLogs, eq(logRows.dailyLogId, dailyLogs.id))
      .leftJoin(projects, eq(logRows.projectId, projects.id))
      .leftJoin(users, eq(dailyLogs.userId, users.id))
      .where(gte(dailyLogs.logDay, startDateStr));

    const userMap = new Map<string, { name: string; email: string; totalMinutes: number; days: Set<string> }>();
    const projectMap = new Map<string, { name: string; code: string; totalMinutes: number }>();
    const appMap = new Map<string, number>();
    const sheetMap = new Map<string, { sheetNumber: string; sheetName: string; totalMinutes: number; projectName: string }>();
    const dailyMap = new Map<string, { date: string; totalMinutes: number; users: Set<string> }>();
    const userDailyMap = new Map<string, Map<string, number>>(); // userId -> date -> minutes
    let totalMinutes = 0;

    for (const row of allRows) {
      totalMinutes += row.log_rows.durationMin;
      const logDay = row.daily_logs.logDay;

      // By user
      const userId = row.daily_logs.userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, { name: row.users?.name || "", email: row.users?.email || "", totalMinutes: 0, days: new Set() });
      }
      const user = userMap.get(userId)!;
      user.totalMinutes += row.log_rows.durationMin;
      user.days.add(logDay);

      // By project
      if (row.projects) {
        const projectId = row.projects.id;
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, { name: row.projects.name, code: row.projects.code || "", totalMinutes: 0 });
        }
        projectMap.get(projectId)!.totalMinutes += row.log_rows.durationMin;
      }

      // By app
      const app = row.log_rows.app;
      appMap.set(app, (appMap.get(app) || 0) + row.log_rows.durationMin);

      // By sheet (Revit sheets)
      const sheetNumber = row.log_rows.revitSheetNumber;
      if (sheetNumber) {
        const sheetKey = `${sheetNumber}-${row.projects?.name || "Unknown"}`;
        if (!sheetMap.has(sheetKey)) {
          sheetMap.set(sheetKey, { 
            sheetNumber, 
            sheetName: row.log_rows.revitSheetName || "", 
            totalMinutes: 0,
            projectName: row.projects?.name || "Unknown"
          });
        }
        sheetMap.get(sheetKey)!.totalMinutes += row.log_rows.durationMin;
      }

      // Daily breakdown
      if (!dailyMap.has(logDay)) {
        dailyMap.set(logDay, { date: logDay, totalMinutes: 0, users: new Set() });
      }
      const dayData = dailyMap.get(logDay)!;
      dayData.totalMinutes += row.log_rows.durationMin;
      dayData.users.add(userId);

      // User daily breakdown (for per-resource charts)
      if (!userDailyMap.has(userId)) {
        userDailyMap.set(userId, new Map());
      }
      const userDays = userDailyMap.get(userId)!;
      userDays.set(logDay, (userDays.get(logDay) || 0) + row.log_rows.durationMin);
    }

    // Build daily trend data
    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: d.date, totalMinutes: d.totalMinutes, userCount: d.users.size }));

    // Build user daily breakdown for resource chart
    const resourceDaily = Array.from(userMap.entries()).map(([userId, userData]) => {
      const userDays = userDailyMap.get(userId) || new Map();
      const dailyData = Array.from(userDays.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, minutes]) => ({ date, minutes }));
      return {
        userId,
        name: userData.name,
        email: userData.email,
        totalMinutes: userData.totalMinutes,
        activeDays: userData.days.size,
        dailyBreakdown: dailyData,
      };
    });

    return {
      summary: {
        totalMinutes,
        totalUsers: userMap.size,
        totalProjects: projectMap.size,
        totalSheets: sheetMap.size,
        avgMinutesPerDay: userMap.size > 0 ? Math.round(totalMinutes / Array.from(userMap.values()).reduce((sum, u) => sum + u.days.size, 0)) : 0,
      },
      byUser: Array.from(userMap.values()).map(u => ({ name: u.name, email: u.email, totalMinutes: u.totalMinutes, activeDays: u.days.size })),
      byProject: Array.from(projectMap.values()),
      byApp: Array.from(appMap.entries()).map(([app, totalMinutes]) => ({ app, totalMinutes })),
      bySheet: Array.from(sheetMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
      dailyTrend,
      resourceDaily,
    };
  }

  async getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) return undefined;
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, id)).orderBy(asc(panelRegister.panelMark));
    return { ...job, panels };
  }

  async getJobByNumber(jobNumber: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobNumber, jobNumber));
    return job;
  }

  async createJob(data: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(data).returning();
    return job;
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db.update(jobs).set({ ...data, updatedAt: new Date() }).where(eq(jobs.id, id)).returning();
    return job;
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(panelRegister).where(eq(panelRegister.jobId, id));
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async getAllJobs(): Promise<(Job & { panels: PanelRegister[]; project?: Project })[]> {
    const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    const allPanels = await db.select().from(panelRegister);
    const allProjects = await db.select().from(projects);
    
    const panelsByJob = new Map<string, PanelRegister[]>();
    for (const panel of allPanels) {
      if (!panelsByJob.has(panel.jobId)) {
        panelsByJob.set(panel.jobId, []);
      }
      panelsByJob.get(panel.jobId)!.push(panel);
    }
    
    const projectsById = new Map(allProjects.map(p => [p.id, p]));
    
    return allJobs.map(job => ({
      ...job,
      panels: panelsByJob.get(job.id) || [],
      project: job.projectId ? projectsById.get(job.projectId) : undefined,
    }));
  }

  async importJobs(data: InsertJob[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    for (const jobData of data) {
      try {
        const existing = await this.getJobByNumber(jobData.jobNumber);
        if (existing) {
          skipped++;
          continue;
        }
        await this.createJob(jobData);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped };
  }

  async getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined> {
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(panelRegister.id, id));
    if (result.length === 0) return undefined;
    return { ...result[0].panel_register, job: result[0].jobs };
  }

  async getPanelsByJob(jobId: string): Promise<PanelRegister[]> {
    return db.select().from(panelRegister).where(eq(panelRegister.jobId, jobId)).orderBy(asc(panelRegister.panelMark));
  }

  async createPanelRegisterItem(data: InsertPanelRegister): Promise<PanelRegister> {
    const [panel] = await db.insert(panelRegister).values(data).returning();
    return panel;
  }

  async updatePanelRegisterItem(id: string, data: Partial<InsertPanelRegister>): Promise<PanelRegister | undefined> {
    const [panel] = await db.update(panelRegister).set({ ...data, updatedAt: new Date() }).where(eq(panelRegister.id, id)).returning();
    return panel;
  }

  async deletePanelRegisterItem(id: string): Promise<void> {
    await db.delete(panelRegister).where(eq(panelRegister.id, id));
  }

  async getAllPanelRegisterItems(): Promise<(PanelRegister & { job: Job })[]> {
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.panel_register, job: r.jobs }));
  }

  async importPanelRegister(data: InsertPanelRegister[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    for (const panelData of data) {
      try {
        const existing = await db.select().from(panelRegister)
          .where(and(
            eq(panelRegister.jobId, panelData.jobId),
            eq(panelRegister.panelMark, panelData.panelMark)
          ));
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        await this.createPanelRegisterItem(panelData);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped };
  }

  async updatePanelActualHours(panelId: string, additionalMinutes: number): Promise<void> {
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, panelId));
    if (panel) {
      const newActualHours = (panel.actualHours || 0) + Math.round(additionalMinutes / 60);
      await db.update(panelRegister).set({ 
        actualHours: newActualHours, 
        updatedAt: new Date(),
        status: newActualHours > 0 ? "IN_PROGRESS" : panel.status,
      }).where(eq(panelRegister.id, panelId));
    }
  }

  async getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .where(eq(productionEntries.id, id));
    if (!result.length) return undefined;
    return { ...result[0].production_entries, panel: result[0].panel_register, job: result[0].jobs };
  }

  async getProductionEntriesByDate(date: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(eq(productionEntries.productionDate, date))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry> {
    const [entry] = await db.insert(productionEntries).values(data).returning();
    return entry;
  }

  async updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined> {
    const [entry] = await db.update(productionEntries).set({ ...data, updatedAt: new Date() }).where(eq(productionEntries.id, id)).returning();
    return entry;
  }

  async deleteProductionEntry(id: string): Promise<void> {
    await db.delete(productionEntries).where(eq(productionEntries.id, id));
  }

  async getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .orderBy(desc(productionEntries.productionDate), asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getProductionSummaryByDate(date: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]> {
    const entries = await this.getProductionEntriesByDate(date);
    const summary: Record<string, { count: number; totalVolumeM3: number; totalAreaM2: number }> = {};
    
    for (const entry of entries) {
      const panelType = entry.panel.panelType || "OTHER";
      if (!summary[panelType]) {
        summary[panelType] = { count: 0, totalVolumeM3: 0, totalAreaM2: 0 };
      }
      summary[panelType].count++;
      summary[panelType].totalVolumeM3 += parseFloat(entry.volumeM3 || "0");
      summary[panelType].totalAreaM2 += parseFloat(entry.areaM2 || "0");
    }
    
    return Object.entries(summary).map(([panelType, data]) => ({ panelType, ...data }));
  }

  async getPanelType(id: string): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.select().from(panelTypes).where(eq(panelTypes.id, id));
    return pt;
  }

  async getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.select().from(panelTypes).where(eq(panelTypes.code, code));
    return pt;
  }

  async createPanelType(data: InsertPanelType): Promise<PanelTypeConfig> {
    const [pt] = await db.insert(panelTypes).values(data).returning();
    return pt;
  }

  async updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.update(panelTypes).set({ ...data, updatedAt: new Date() }).where(eq(panelTypes.id, id)).returning();
    return pt;
  }

  async deletePanelType(id: string): Promise<void> {
    await db.delete(panelTypes).where(eq(panelTypes.id, id));
  }

  async getAllPanelTypes(): Promise<PanelTypeConfig[]> {
    return await db.select().from(panelTypes).orderBy(asc(panelTypes.name));
  }

  async getProjectPanelRate(id: string): Promise<(ProjectPanelRate & { panelType: PanelTypeConfig }) | undefined> {
    const result = await db.select().from(projectPanelRates)
      .innerJoin(panelTypes, eq(projectPanelRates.panelTypeId, panelTypes.id))
      .where(eq(projectPanelRates.id, id));
    if (!result.length) return undefined;
    return { ...result[0].project_panel_rates, panelType: result[0].panel_types };
  }

  async getProjectPanelRates(projectId: string): Promise<(ProjectPanelRate & { panelType: PanelTypeConfig })[]> {
    const result = await db.select().from(projectPanelRates)
      .innerJoin(panelTypes, eq(projectPanelRates.panelTypeId, panelTypes.id))
      .where(eq(projectPanelRates.projectId, projectId));
    return result.map(r => ({ ...r.project_panel_rates, panelType: r.panel_types }));
  }

  async upsertProjectPanelRate(projectId: string, panelTypeId: string, data: Partial<InsertProjectPanelRate>): Promise<ProjectPanelRate> {
    const existing = await db.select().from(projectPanelRates)
      .where(and(eq(projectPanelRates.projectId, projectId), eq(projectPanelRates.panelTypeId, panelTypeId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(projectPanelRates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projectPanelRates.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(projectPanelRates)
        .values({ projectId, panelTypeId, ...data })
        .returning();
      return created;
    }
  }

  async deleteProjectPanelRate(id: string): Promise<void> {
    await db.delete(projectPanelRates).where(eq(projectPanelRates.id, id));
  }

  async getEffectiveRates(projectId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; projectRate?: ProjectPanelRate })[]> {
    const allTypes = await this.getAllPanelTypes();
    const projectRates = await this.getProjectPanelRates(projectId);
    const ratesMap = new Map(projectRates.map(r => [r.panelTypeId, r]));
    
    return allTypes.map(pt => ({
      ...pt,
      isOverridden: ratesMap.has(pt.id),
      projectRate: ratesMap.get(pt.id),
    }));
  }
}

export const storage = new DatabaseStorage();
