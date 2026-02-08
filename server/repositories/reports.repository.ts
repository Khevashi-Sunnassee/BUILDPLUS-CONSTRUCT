import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  dailyLogs, logRows, approvalEvents, weeklyWageReports, weeklyJobReports, weeklyJobReportSchedules,
  jobs, users,
  type InsertDailyLog, type DailyLog, type InsertLogRow, type LogRow,
  type InsertApprovalEvent, type ApprovalEvent,
  type InsertWeeklyWageReport, type WeeklyWageReport,
  type InsertWeeklyJobReport, type WeeklyJobReport,
  type InsertWeeklyJobReportSchedule, type WeeklyJobReportSchedule,
  type Job, type User
} from "@shared/schema";

export interface WeeklyJobReportWithDetails extends WeeklyJobReport {
  job?: Job;
  projectManager?: User;
  schedules?: WeeklyJobReportSchedule[];
}

export class ReportsRepository {
  async getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User }) | undefined> {
    const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, id));
    if (!log) return undefined;
    
    const [user] = await db.select().from(users).where(eq(users.id, log.userId));
    if (!user) return undefined;
    
    const rows = await db.select().from(logRows).where(eq(logRows.dailyLogId, id)).orderBy(asc(logRows.startAt));
    
    const jobIds = [...new Set(rows.filter(r => r.jobId).map(r => r.jobId!))];
    const jobsMap = new Map<string, Job>();
    if (jobIds.length > 0) {
      const jobsList = await db.select().from(jobs).where(inArray(jobs.id, jobIds));
      for (const job of jobsList) {
        jobsMap.set(job.id, job);
      }
    }
    
    const enrichedRows = rows.map(row => ({
      ...row,
      job: row.jobId ? jobsMap.get(row.jobId) : undefined,
    }));
    
    return { ...log, rows: enrichedRows, user };
  }

  async getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]> {
    const conditions = [eq(dailyLogs.userId, userId)];
    if (filters?.status) conditions.push(eq(dailyLogs.status, filters.status as typeof dailyLogs.status.enumValues[number]));
    
    return db.select().from(dailyLogs).where(and(...conditions)).orderBy(desc(dailyLogs.logDay));
  }

  async getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]> {
    const logs = await db.select().from(dailyLogs).where(eq(dailyLogs.status, "SUBMITTED")).orderBy(desc(dailyLogs.logDay));
    if (logs.length === 0) return [];
    
    const logIds = logs.map(l => l.id);
    const userIds = [...new Set(logs.map(l => l.userId))];
    
    const [allRows, allUsers] = await Promise.all([
      db.select().from(logRows).where(inArray(logRows.dailyLogId, logIds)).orderBy(asc(logRows.startAt)),
      db.select().from(users).where(inArray(users.id, userIds)),
    ]);
    
    const jobIds = [...new Set(allRows.filter(r => r.jobId).map(r => r.jobId!))];
    const jobsMap = new Map<string, Job>();
    if (jobIds.length > 0) {
      const jobsList = await db.select().from(jobs).where(inArray(jobs.id, jobIds));
      for (const job of jobsList) jobsMap.set(job.id, job);
    }
    
    const usersMap = new Map(allUsers.map(u => [u.id, u]));
    const rowsByLog = new Map<string, (LogRow & { job?: Job })[]>();
    for (const row of allRows) {
      const enriched = { ...row, job: row.jobId ? jobsMap.get(row.jobId) : undefined };
      if (!rowsByLog.has(row.dailyLogId)) rowsByLog.set(row.dailyLogId, []);
      rowsByLog.get(row.dailyLogId)!.push(enriched);
    }
    
    const result: (DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[] = [];
    for (const log of logs) {
      const user = usersMap.get(log.userId);
      if (!user) continue;
      result.push({ ...log, rows: rowsByLog.get(log.id) || [], user });
    }
    
    return result;
  }

  async getDailyLogByUserAndDay(userId: string, logDay: string): Promise<DailyLog | undefined> {
    const [log] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDay, logDay)));
    return log;
  }

  async createDailyLog(data: { userId: string; logDay: string; status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" }): Promise<DailyLog> {
    const [log] = await db.insert(dailyLogs).values(data).returning();
    return log;
  }

  async upsertDailyLog(data: { userId: string; logDay: string; tz: string }): Promise<DailyLog> {
    const existing = await this.getDailyLogByUserAndDay(data.userId, data.logDay);
    if (existing) return existing;
    return this.createDailyLog({ userId: data.userId, logDay: data.logDay, status: "PENDING" });
  }

  async updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined> {
    const [log] = await db.update(dailyLogs).set({ ...data, updatedAt: new Date() }).where(eq(dailyLogs.id, id)).returning();
    return log;
  }

  async getLogRow(id: string): Promise<LogRow | undefined> {
    const [row] = await db.select().from(logRows).where(eq(logRows.id, id));
    return row;
  }

  async upsertLogRow(sourceEventId: string, data: Partial<InsertLogRow> & { dailyLogId: string }): Promise<LogRow> {
    const [existing] = await db.select().from(logRows).where(eq(logRows.sourceEventId, sourceEventId));
    if (existing) {
      const [updated] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(logRows).values({ ...data, sourceEventId }).returning();
    return created;
  }

  async updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; jobId: string; isUserEdited: boolean; workTypeId: number | null }>): Promise<LogRow | undefined> {
    const [row] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.id, id)).returning();
    return row;
  }

  async deleteLogRow(id: string): Promise<void> {
    await db.delete(logRows).where(eq(logRows.id, id));
  }

  async deleteDailyLog(id: string): Promise<void> {
    await db.delete(logRows).where(eq(logRows.dailyLogId, id));
    await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  }

  async createApprovalEvent(data: InsertApprovalEvent): Promise<ApprovalEvent> {
    const [event] = await db.insert(approvalEvents).values(data).returning();
    return event;
  }

  async getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]> {
    return db.select().from(dailyLogs)
      .where(and(gte(dailyLogs.logDay, startDate), lte(dailyLogs.logDay, endDate)))
      .orderBy(asc(dailyLogs.logDay));
  }

  async getWeeklyWageReports(startDate?: string, endDate?: string): Promise<WeeklyWageReport[]> {
    if (startDate && endDate) {
      return db.select().from(weeklyWageReports)
        .where(and(gte(weeklyWageReports.weekStartDate, startDate), lte(weeklyWageReports.weekEndDate, endDate)))
        .orderBy(desc(weeklyWageReports.weekStartDate));
    }
    return db.select().from(weeklyWageReports).orderBy(desc(weeklyWageReports.weekStartDate));
  }

  async getWeeklyWageReport(id: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports).where(eq(weeklyWageReports.id, id));
    return report;
  }

  async getWeeklyWageReportByWeek(weekStartDate: string, weekEndDate: string, factory: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports)
      .where(and(
        eq(weeklyWageReports.weekStartDate, weekStartDate),
        eq(weeklyWageReports.weekEndDate, weekEndDate),
        eq(weeklyWageReports.factory, factory)
      ));
    return report;
  }

  async getWeeklyWageReportByWeekAndFactoryId(weekStartDate: string, weekEndDate: string, factoryId: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports)
      .where(and(
        eq(weeklyWageReports.weekStartDate, weekStartDate),
        eq(weeklyWageReports.weekEndDate, weekEndDate),
        eq(weeklyWageReports.factoryId, factoryId)
      ));
    return report;
  }

  async createWeeklyWageReport(data: InsertWeeklyWageReport & { createdById: string }): Promise<WeeklyWageReport> {
    const [report] = await db.insert(weeklyWageReports).values(data).returning();
    return report;
  }

  async updateWeeklyWageReport(id: string, data: Partial<InsertWeeklyWageReport>): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.update(weeklyWageReports).set({ ...data, updatedAt: new Date() }).where(eq(weeklyWageReports.id, id)).returning();
    return report;
  }

  async deleteWeeklyWageReport(id: string): Promise<void> {
    await db.delete(weeklyWageReports).where(eq(weeklyWageReports.id, id));
  }

  async getWeeklyJobReports(projectManagerId?: string): Promise<WeeklyJobReportWithDetails[]> {
    const reports = projectManagerId
      ? await db.select().from(weeklyJobReports).where(eq(weeklyJobReports.projectManagerId, projectManagerId)).orderBy(desc(weeklyJobReports.createdAt))
      : await db.select().from(weeklyJobReports).orderBy(desc(weeklyJobReports.createdAt));
    
    return this.enrichWeeklyJobReports(reports);
  }

  private async enrichWeeklyJobReports(reports: WeeklyJobReport[]): Promise<WeeklyJobReportWithDetails[]> {
    const result: WeeklyJobReportWithDetails[] = [];
    for (const report of reports) {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, report.jobId));
      const [pm] = await db.select().from(users).where(eq(users.id, report.projectManagerId));
      const schedules = await db.select().from(weeklyJobReportSchedules).where(eq(weeklyJobReportSchedules.reportId, report.id));
      result.push({ ...report, job: job || undefined, projectManager: pm || undefined, schedules });
    }
    return result;
  }

  async getWeeklyJobReport(id: string): Promise<WeeklyJobReportWithDetails | undefined> {
    const [report] = await db.select().from(weeklyJobReports).where(eq(weeklyJobReports.id, id));
    if (!report) return undefined;
    const enriched = await this.enrichWeeklyJobReports([report]);
    return enriched[0];
  }
}

export const reportsRepository = new ReportsRepository();
