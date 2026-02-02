import { eq, and, desc, sql, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users, devices, mappingRules, dailyLogs, logRows,
  approvalEvents, auditEvents, globalSettings, jobs, panelRegister, productionEntries,
  panelTypes, jobPanelRates, workTypes, panelTypeCostComponents, jobCostOverrides,
  trailerTypes, loadLists, loadListPanels, deliveryRecords,
  type InsertUser, type User, type InsertDevice, type Device,
  type InsertMappingRule, type MappingRule,
  type InsertDailyLog, type DailyLog, type InsertLogRow, type LogRow,
  type InsertApprovalEvent, type ApprovalEvent, type GlobalSettings,
  type InsertJob, type Job, type InsertPanelRegister, type PanelRegister,
  type InsertProductionEntry, type ProductionEntry,
  type InsertPanelType, type PanelTypeConfig, type InsertJobPanelRate, type JobPanelRate,
  type InsertWorkType, type WorkType,
  type InsertPanelTypeCostComponent, type PanelTypeCostComponent,
  type InsertJobCostOverride, type JobCostOverride,
  type InsertTrailerType, type TrailerType,
  type InsertLoadList, type LoadList, type InsertLoadListPanel, type LoadListPanel,
  type InsertDeliveryRecord, type DeliveryRecord,
} from "@shared/schema";

export interface LoadListWithDetails extends LoadList {
  job: Job;
  trailerType?: TrailerType | null;
  panels: (LoadListPanel & { panel: PanelRegister })[];
  deliveryRecord?: DeliveryRecord | null;
  createdBy?: User | null;
}
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

  createMappingRule(data: InsertMappingRule): Promise<MappingRule>;
  deleteMappingRule(id: string): Promise<void>;
  getMappingRules(): Promise<MappingRule[]>;

  getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User }) | undefined>;
  getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]>;
  getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]>;
  upsertDailyLog(data: { userId: string; logDay: string; tz: string }): Promise<DailyLog>;
  updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined>;

  getLogRow(id: string): Promise<LogRow | undefined>;
  upsertLogRow(sourceEventId: string, data: Partial<InsertLogRow> & { dailyLogId: string }): Promise<LogRow>;
  updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; jobId: string; isUserEdited: boolean; workTypeId: number | null }>): Promise<LogRow | undefined>;

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
  getAllJobs(): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[] })[]>;
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
  getProductionEntriesInRange(startDate: string, endDate: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry>;
  updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined>;
  deleteProductionEntry(id: string): Promise<void>;
  getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionSummaryByDate(date: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]>;
  getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]>;
  getDailyLogsWithRowsInRange(startDate: string, endDate: string): Promise<Array<{
    log: DailyLog;
    user: User;
    rows: LogRow[];
  }>>;

  getPanelType(id: string): Promise<PanelTypeConfig | undefined>;
  getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined>;
  createPanelType(data: InsertPanelType): Promise<PanelTypeConfig>;
  updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined>;
  deletePanelType(id: string): Promise<void>;
  getAllPanelTypes(): Promise<PanelTypeConfig[]>;

  getJobPanelRate(id: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig }) | undefined>;
  getJobPanelRates(jobId: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig })[]>;
  upsertJobPanelRate(jobId: string, panelTypeId: string, data: Partial<InsertJobPanelRate>): Promise<JobPanelRate>;
  deleteJobPanelRate(id: string): Promise<void>;
  getEffectiveRates(jobId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; jobRate?: JobPanelRate })[]>;

  getWorkType(id: number): Promise<WorkType | undefined>;
  getWorkTypeByCode(code: string): Promise<WorkType | undefined>;
  createWorkType(data: InsertWorkType): Promise<WorkType>;
  updateWorkType(id: number, data: Partial<InsertWorkType>): Promise<WorkType | undefined>;
  deleteWorkType(id: number): Promise<void>;
  getAllWorkTypes(): Promise<WorkType[]>;
  getActiveWorkTypes(): Promise<WorkType[]>;

  getCostComponentsByPanelType(panelTypeId: string): Promise<PanelTypeCostComponent[]>;
  createCostComponent(data: InsertPanelTypeCostComponent): Promise<PanelTypeCostComponent>;
  updateCostComponent(id: string, data: Partial<InsertPanelTypeCostComponent>): Promise<PanelTypeCostComponent | undefined>;
  deleteCostComponent(id: string): Promise<void>;
  replaceCostComponents(panelTypeId: string, components: InsertPanelTypeCostComponent[]): Promise<PanelTypeCostComponent[]>;

  getJobCostOverrides(jobId: string): Promise<JobCostOverride[]>;
  getJobCostOverridesByPanelType(jobId: string, panelTypeId: string): Promise<JobCostOverride[]>;
  createJobCostOverride(data: InsertJobCostOverride): Promise<JobCostOverride>;
  updateJobCostOverride(id: string, data: Partial<InsertJobCostOverride>): Promise<JobCostOverride | undefined>;
  deleteJobCostOverride(id: string): Promise<void>;
  initializeJobCostOverrides(jobId: string): Promise<JobCostOverride[]>;

  // Panel production approval
  getPanelById(id: string): Promise<PanelRegister | undefined>;
  approvePanelForProduction(id: string, approvedById: string, data: {
    loadWidth?: string | null;
    loadHeight?: string | null;
    panelThickness?: string | null;
    panelVolume?: string | null;
    panelMass?: string | null;
    panelArea?: string | null;
    day28Fc?: string | null;
    liftFcm?: string | null;
    rotationalLifters?: string | null;
    primaryLifters?: string | null;
    productionPdfUrl?: string | null;
  }): Promise<PanelRegister | undefined>;
  revokePanelProductionApproval(id: string): Promise<PanelRegister | undefined>;
  getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]>;

  // Logistics - Trailer Types
  getAllTrailerTypes(): Promise<TrailerType[]>;
  getActiveTrailerTypes(): Promise<TrailerType[]>;
  getTrailerType(id: string): Promise<TrailerType | undefined>;
  createTrailerType(data: InsertTrailerType): Promise<TrailerType>;
  updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined>;
  deleteTrailerType(id: string): Promise<void>;

  // Logistics - Load Lists
  getAllLoadLists(): Promise<LoadListWithDetails[]>;
  getLoadList(id: string): Promise<LoadListWithDetails | undefined>;
  createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails>;
  updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined>;
  deleteLoadList(id: string): Promise<void>;
  addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel>;
  removePanelFromLoadList(loadListId: string, panelId: string): Promise<void>;
  getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]>;

  // Logistics - Delivery Records
  getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined>;
  createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord>;
  updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined>;
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

  async getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User }) | undefined> {
    const [log] = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id)).where(eq(dailyLogs.id, id));
    if (!log) return undefined;

    const rows = await db.select().from(logRows).leftJoin(jobs, eq(logRows.jobId, jobs.id))
      .where(eq(logRows.dailyLogId, id)).orderBy(asc(logRows.startAt));

    return {
      ...log.daily_logs,
      user: log.users,
      rows: rows.map(r => ({ ...r.log_rows, job: r.jobs || undefined })),
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

  async getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]> {
    const logs = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(eq(dailyLogs.status, "SUBMITTED")).orderBy(desc(dailyLogs.logDay));

    const result = [];
    for (const log of logs) {
      const rows = await db.select().from(logRows).leftJoin(jobs, eq(logRows.jobId, jobs.id))
        .where(eq(logRows.dailyLogId, log.daily_logs.id)).orderBy(asc(logRows.startAt));
      result.push({
        ...log.daily_logs,
        user: log.users,
        rows: rows.map(r => ({ ...r.log_rows, job: r.jobs || undefined })),
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

  async updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; jobId: string; isUserEdited: boolean }>): Promise<LogRow | undefined> {
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
      .leftJoin(jobs, eq(logRows.jobId, jobs.id))
      .leftJoin(users, eq(dailyLogs.userId, users.id))
      .where(gte(dailyLogs.logDay, startDateStr));

    const userMap = new Map<string, { name: string; email: string; totalMinutes: number; days: Set<string> }>();
    const jobMap = new Map<string, { name: string; code: string; totalMinutes: number }>();
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

      // By job
      if (row.jobs) {
        const jobId = row.jobs.id;
        if (!jobMap.has(jobId)) {
          jobMap.set(jobId, { name: row.jobs.name, code: row.jobs.code || row.jobs.jobNumber || "", totalMinutes: 0 });
        }
        jobMap.get(jobId)!.totalMinutes += row.log_rows.durationMin;
      }

      // By app
      const app = row.log_rows.app;
      appMap.set(app, (appMap.get(app) || 0) + row.log_rows.durationMin);

      // By sheet (Revit sheets)
      const sheetNumber = row.log_rows.revitSheetNumber;
      if (sheetNumber) {
        const sheetKey = `${sheetNumber}-${row.jobs?.name || "Unknown"}`;
        if (!sheetMap.has(sheetKey)) {
          sheetMap.set(sheetKey, { 
            sheetNumber, 
            sheetName: row.log_rows.revitSheetName || "", 
            totalMinutes: 0,
            projectName: row.jobs?.name || "Unknown"
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
        totalProjects: jobMap.size,
        totalSheets: sheetMap.size,
        avgMinutesPerDay: userMap.size > 0 ? Math.round(totalMinutes / Array.from(userMap.values()).reduce((sum, u) => sum + u.days.size, 0)) : 0,
      },
      byUser: Array.from(userMap.values()).map(u => ({ name: u.name, email: u.email, totalMinutes: u.totalMinutes, activeDays: u.days.size })),
      byProject: Array.from(jobMap.values()),
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

  async getAllJobs(): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[] })[]> {
    const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    const allPanels = await db.select().from(panelRegister);
    const allRules = await db.select().from(mappingRules);
    
    const panelsByJob = new Map<string, PanelRegister[]>();
    for (const panel of allPanels) {
      if (!panelsByJob.has(panel.jobId)) {
        panelsByJob.set(panel.jobId, []);
      }
      panelsByJob.get(panel.jobId)!.push(panel);
    }
    
    const rulesByJob = new Map<string, MappingRule[]>();
    for (const rule of allRules) {
      if (!rulesByJob.has(rule.jobId)) {
        rulesByJob.set(rule.jobId, []);
      }
      rulesByJob.get(rule.jobId)!.push(rule);
    }
    
    return allJobs.map(job => ({
      ...job,
      panels: panelsByJob.get(job.id) || [],
      mappingRules: rulesByJob.get(job.id) || [],
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

  async getProductionEntriesInRange(startDate: string, endDate: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        gte(productionEntries.productionDate, startDate),
        lte(productionEntries.productionDate, endDate)
      ))
      .orderBy(asc(productionEntries.productionDate), asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]> {
    return await db.select().from(dailyLogs)
      .where(and(
        gte(dailyLogs.logDay, startDate),
        lte(dailyLogs.logDay, endDate)
      ))
      .orderBy(asc(dailyLogs.logDay));
  }

  async getDailyLogsWithRowsInRange(startDate: string, endDate: string): Promise<Array<{
    log: DailyLog;
    user: User;
    rows: LogRow[];
  }>> {
    const logs = await db.select().from(dailyLogs)
      .innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(and(
        gte(dailyLogs.logDay, startDate),
        lte(dailyLogs.logDay, endDate)
      ))
      .orderBy(asc(dailyLogs.logDay));
    
    if (logs.length === 0) return [];
    
    const logIds = logs.map(l => l.daily_logs.id);
    const allRows = await db.select().from(logRows)
      .where(inArray(logRows.dailyLogId, logIds))
      .orderBy(asc(logRows.startAt));
    
    const rowsByLogId = new Map<string, LogRow[]>();
    for (const row of allRows) {
      if (!rowsByLogId.has(row.dailyLogId)) {
        rowsByLogId.set(row.dailyLogId, []);
      }
      rowsByLogId.get(row.dailyLogId)!.push(row);
    }
    
    return logs.map(l => ({
      log: l.daily_logs,
      user: l.users,
      rows: rowsByLogId.get(l.daily_logs.id) || [],
    }));
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

  async getJobPanelRate(id: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig }) | undefined> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.id, id));
    if (!result.length) return undefined;
    return { ...result[0].job_panel_rates, panelType: result[0].panel_types };
  }

  async getJobPanelRates(jobId: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig })[]> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.jobId, jobId));
    return result.map(r => ({ ...r.job_panel_rates, panelType: r.panel_types }));
  }

  async upsertJobPanelRate(jobId: string, panelTypeId: string, data: Partial<InsertJobPanelRate>): Promise<JobPanelRate> {
    const existing = await db.select().from(jobPanelRates)
      .where(and(eq(jobPanelRates.jobId, jobId), eq(jobPanelRates.panelTypeId, panelTypeId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(jobPanelRates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(jobPanelRates.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(jobPanelRates)
        .values({ jobId, panelTypeId, ...data })
        .returning();
      return created;
    }
  }

  async deleteJobPanelRate(id: string): Promise<void> {
    await db.delete(jobPanelRates).where(eq(jobPanelRates.id, id));
  }

  async getEffectiveRates(jobId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; jobRate?: JobPanelRate })[]> {
    const allTypes = await this.getAllPanelTypes();
    const jobRates = await this.getJobPanelRates(jobId);
    const ratesMap = new Map(jobRates.map(r => [r.panelTypeId, r]));
    
    return allTypes.map(pt => ({
      ...pt,
      isOverridden: ratesMap.has(pt.id),
      jobRate: ratesMap.get(pt.id),
    }));
  }

  async getWorkType(id: number): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.id, id));
    return workType;
  }

  async getWorkTypeByCode(code: string): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.code, code));
    return workType;
  }

  async createWorkType(data: InsertWorkType): Promise<WorkType> {
    const [workType] = await db.insert(workTypes).values(data).returning();
    return workType;
  }

  async updateWorkType(id: number, data: Partial<InsertWorkType>): Promise<WorkType | undefined> {
    const [workType] = await db.update(workTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workTypes.id, id))
      .returning();
    return workType;
  }

  async deleteWorkType(id: number): Promise<void> {
    await db.delete(workTypes).where(eq(workTypes.id, id));
  }

  async getAllWorkTypes(): Promise<WorkType[]> {
    return db.select().from(workTypes).orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
  }

  async getActiveWorkTypes(): Promise<WorkType[]> {
    return db.select().from(workTypes)
      .where(eq(workTypes.isActive, true))
      .orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
  }

  async getCostComponentsByPanelType(panelTypeId: string): Promise<PanelTypeCostComponent[]> {
    return db.select().from(panelTypeCostComponents)
      .where(eq(panelTypeCostComponents.panelTypeId, panelTypeId))
      .orderBy(asc(panelTypeCostComponents.sortOrder));
  }

  async createCostComponent(data: InsertPanelTypeCostComponent): Promise<PanelTypeCostComponent> {
    const [component] = await db.insert(panelTypeCostComponents).values(data).returning();
    return component;
  }

  async updateCostComponent(id: string, data: Partial<InsertPanelTypeCostComponent>): Promise<PanelTypeCostComponent | undefined> {
    const [component] = await db.update(panelTypeCostComponents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(panelTypeCostComponents.id, id))
      .returning();
    return component;
  }

  async deleteCostComponent(id: string): Promise<void> {
    await db.delete(panelTypeCostComponents).where(eq(panelTypeCostComponents.id, id));
  }

  async replaceCostComponents(panelTypeId: string, components: InsertPanelTypeCostComponent[]): Promise<PanelTypeCostComponent[]> {
    await db.delete(panelTypeCostComponents).where(eq(panelTypeCostComponents.panelTypeId, panelTypeId));
    if (components.length === 0) return [];
    const inserted = await db.insert(panelTypeCostComponents).values(components).returning();
    return inserted;
  }

  async getJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(eq(jobCostOverrides.jobId, jobId))
      .orderBy(asc(jobCostOverrides.panelTypeId), asc(jobCostOverrides.componentName));
  }

  async getJobCostOverridesByPanelType(jobId: string, panelTypeId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(and(
        eq(jobCostOverrides.jobId, jobId),
        eq(jobCostOverrides.panelTypeId, panelTypeId)
      ))
      .orderBy(asc(jobCostOverrides.componentName));
  }

  async createJobCostOverride(data: InsertJobCostOverride): Promise<JobCostOverride> {
    const [override] = await db.insert(jobCostOverrides).values(data).returning();
    return override;
  }

  async updateJobCostOverride(id: string, data: Partial<InsertJobCostOverride>): Promise<JobCostOverride | undefined> {
    const [override] = await db.update(jobCostOverrides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobCostOverrides.id, id))
      .returning();
    return override;
  }

  async deleteJobCostOverride(id: string): Promise<void> {
    await db.delete(jobCostOverrides).where(eq(jobCostOverrides.id, id));
  }

  async initializeJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    const allPanelTypes = await this.getAllPanelTypes();
    const existingOverrides = await this.getJobCostOverrides(jobId);
    const existingKeys = new Set(existingOverrides.map(o => `${o.panelTypeId}:${o.componentName}`));
    
    const newOverrides: InsertJobCostOverride[] = [];
    for (const pt of allPanelTypes) {
      const components = await this.getCostComponentsByPanelType(pt.id);
      for (const comp of components) {
        const key = `${pt.id}:${comp.name}`;
        if (!existingKeys.has(key)) {
          newOverrides.push({
            jobId,
            panelTypeId: pt.id,
            componentName: comp.name,
            defaultPercentage: comp.percentageOfRevenue,
            revisedPercentage: null,
            notes: null,
          });
        }
      }
    }
    
    if (newOverrides.length > 0) {
      await db.insert(jobCostOverrides).values(newOverrides);
    }
    
    return this.getJobCostOverrides(jobId);
  }

  // Panel production approval methods
  async getPanelById(id: string): Promise<PanelRegister | undefined> {
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, id));
    return panel;
  }

  async approvePanelForProduction(id: string, approvedById: string, data: {
    loadWidth?: string | null;
    loadHeight?: string | null;
    panelThickness?: string | null;
    panelVolume?: string | null;
    panelMass?: string | null;
    panelArea?: string | null;
    day28Fc?: string | null;
    liftFcm?: string | null;
    rotationalLifters?: string | null;
    primaryLifters?: string | null;
    productionPdfUrl?: string | null;
  }): Promise<PanelRegister | undefined> {
    const [updated] = await db.update(panelRegister)
      .set({
        ...data,
        approvedForProduction: true,
        approvedAt: new Date(),
        approvedById,
        updatedAt: new Date(),
      })
      .where(eq(panelRegister.id, id))
      .returning();
    return updated;
  }

  async revokePanelProductionApproval(id: string): Promise<PanelRegister | undefined> {
    const [updated] = await db.update(panelRegister)
      .set({
        approvedForProduction: false,
        approvedAt: null,
        approvedById: null,
        updatedAt: new Date(),
      })
      .where(eq(panelRegister.id, id))
      .returning();
    return updated;
  }

  async getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]> {
    let query = db.select()
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(panelRegister.approvedForProduction, true));
    
    if (jobId) {
      query = db.select()
        .from(panelRegister)
        .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
        .where(and(
          eq(panelRegister.approvedForProduction, true),
          eq(panelRegister.jobId, jobId)
        ));
    }
    
    const results = await query;
    return results.map(r => ({ ...r.panel_register, job: r.jobs }));
  }

  // Logistics - Trailer Types
  async getAllTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes).orderBy(asc(trailerTypes.sortOrder));
  }

  async getActiveTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes)
      .where(eq(trailerTypes.isActive, true))
      .orderBy(asc(trailerTypes.sortOrder));
  }

  async getTrailerType(id: string): Promise<TrailerType | undefined> {
    const [trailerType] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, id));
    return trailerType;
  }

  async createTrailerType(data: InsertTrailerType): Promise<TrailerType> {
    const [trailerType] = await db.insert(trailerTypes).values(data).returning();
    return trailerType;
  }

  async updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined> {
    const [updated] = await db.update(trailerTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trailerTypes.id, id))
      .returning();
    return updated;
  }

  async deleteTrailerType(id: string): Promise<void> {
    await db.delete(trailerTypes).where(eq(trailerTypes.id, id));
  }

  // Logistics - Load Lists
  async getAllLoadLists(): Promise<LoadListWithDetails[]> {
    const allLoadLists = await db.select().from(loadLists).orderBy(desc(loadLists.createdAt));
    
    const results: LoadListWithDetails[] = [];
    for (const loadList of allLoadLists) {
      const details = await this.getLoadList(loadList.id);
      if (details) results.push(details);
    }
    return results;
  }

  async getLoadList(id: string): Promise<LoadListWithDetails | undefined> {
    const [loadList] = await db.select().from(loadLists).where(eq(loadLists.id, id));
    if (!loadList) return undefined;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, loadList.jobId));
    if (!job) return undefined;

    let trailerType: TrailerType | null = null;
    if (loadList.trailerTypeId) {
      const [tt] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, loadList.trailerTypeId));
      trailerType = tt || null;
    }

    const panelResults = await db.select()
      .from(loadListPanels)
      .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
      .where(eq(loadListPanels.loadListId, id))
      .orderBy(asc(loadListPanels.sequence));

    const panels = panelResults.map(r => ({ ...r.load_list_panels, panel: r.panel_register }));

    const [deliveryRecord] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, id));

    let createdBy: User | null = null;
    if (loadList.createdById) {
      const [user] = await db.select().from(users).where(eq(users.id, loadList.createdById));
      createdBy = user || null;
    }

    return {
      ...loadList,
      job,
      trailerType,
      panels,
      deliveryRecord: deliveryRecord || null,
      createdBy,
    };
  }

  async createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails> {
    const [loadList] = await db.insert(loadLists).values(data).returning();

    // Add panels to the load list
    if (panelIds.length > 0) {
      const panelData = panelIds.map((panelId, index) => ({
        loadListId: loadList.id,
        panelId,
        sequence: index + 1,
      }));
      await db.insert(loadListPanels).values(panelData);
    }

    const details = await this.getLoadList(loadList.id);
    return details!;
  }

  async updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined> {
    const [updated] = await db.update(loadLists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loadLists.id, id))
      .returning();
    return updated;
  }

  async deleteLoadList(id: string): Promise<void> {
    await db.delete(loadLists).where(eq(loadLists.id, id));
  }

  async addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel> {
    // Get the max sequence if not provided
    if (!sequence) {
      const existingPanels = await db.select()
        .from(loadListPanels)
        .where(eq(loadListPanels.loadListId, loadListId));
      sequence = existingPanels.length + 1;
    }

    const [panel] = await db.insert(loadListPanels).values({
      loadListId,
      panelId,
      sequence,
    }).returning();
    return panel;
  }

  async removePanelFromLoadList(loadListId: string, panelId: string): Promise<void> {
    await db.delete(loadListPanels)
      .where(and(
        eq(loadListPanels.loadListId, loadListId),
        eq(loadListPanels.panelId, panelId)
      ));
  }

  async getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]> {
    const results = await db.select()
      .from(loadListPanels)
      .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
      .where(eq(loadListPanels.loadListId, loadListId))
      .orderBy(asc(loadListPanels.sequence));

    return results.map(r => ({ ...r.load_list_panels, panel: r.panel_register }));
  }

  // Logistics - Delivery Records
  async getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined> {
    const [record] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, loadListId));
    return record;
  }

  async createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord> {
    const [record] = await db.insert(deliveryRecords).values(data).returning();
    
    // Update load list status to COMPLETE
    await db.update(loadLists)
      .set({ status: "COMPLETE", updatedAt: new Date() })
      .where(eq(loadLists.id, data.loadListId));
    
    return record;
  }

  async updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined> {
    const [updated] = await db.update(deliveryRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deliveryRecords.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
