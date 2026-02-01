import { eq, and, desc, sql, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users, devices, projects, mappingRules, dailyLogs, logRows,
  approvalEvents, auditEvents, globalSettings,
  type InsertUser, type User, type InsertDevice, type Device,
  type InsertProject, type Project, type InsertMappingRule, type MappingRule,
  type InsertDailyLog, type DailyLog, type InsertLogRow, type LogRow,
  type InsertApprovalEvent, type ApprovalEvent, type GlobalSettings,
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
    let totalMinutes = 0;

    for (const row of allRows) {
      totalMinutes += row.log_rows.durationMin;

      const userId = row.daily_logs.userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, { name: row.users?.name || "", email: row.users?.email || "", totalMinutes: 0, days: new Set() });
      }
      const user = userMap.get(userId)!;
      user.totalMinutes += row.log_rows.durationMin;
      user.days.add(row.daily_logs.logDay);

      if (row.projects) {
        const projectId = row.projects.id;
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, { name: row.projects.name, code: row.projects.code || "", totalMinutes: 0 });
        }
        projectMap.get(projectId)!.totalMinutes += row.log_rows.durationMin;
      }

      const app = row.log_rows.app;
      appMap.set(app, (appMap.get(app) || 0) + row.log_rows.durationMin);
    }

    return {
      summary: {
        totalMinutes,
        totalUsers: userMap.size,
        totalProjects: projectMap.size,
        avgMinutesPerDay: userMap.size > 0 ? Math.round(totalMinutes / Array.from(userMap.values()).reduce((sum, u) => sum + u.days.size, 0)) : 0,
      },
      byUser: Array.from(userMap.values()).map(u => ({ name: u.name, email: u.email, totalMinutes: u.totalMinutes, activeDays: u.days.size })),
      byProject: Array.from(projectMap.values()),
      byApp: Array.from(appMap.entries()).map(([app, totalMinutes]) => ({ app, totalMinutes })),
      weeklyTrend: [],
    };
  }
}

export const storage = new DatabaseStorage();
