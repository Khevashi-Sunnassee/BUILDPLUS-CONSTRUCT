import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  dailyLogs, logRows, jobs, users, approvalEvents,
  type DailyLog, type InsertDailyLog, type LogRow, type InsertLogRow,
  type Job, type User, type ApprovalEvent, type InsertApprovalEvent,
} from "@shared/schema";

export const dailyLogMethods = {
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
  },

  async getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]> {
    const conditions = [eq(dailyLogs.userId, userId)];
    
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(dailyLogs.status, filters.status as typeof dailyLogs.status.enumValues[number]));
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
  },

  async getSubmittedDailyLogs(companyId?: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]> {
    const conditions = [eq(dailyLogs.status, "SUBMITTED")];
    if (companyId) {
      conditions.push(eq(users.companyId, companyId));
    }
    const logs = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(and(...conditions)).orderBy(desc(dailyLogs.logDay));

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
  },

  async getDailyLogByUserAndDay(userId: string, logDay: string): Promise<DailyLog | undefined> {
    const [log] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDay, logDay), eq(dailyLogs.discipline, "DRAFTING")));
    return log;
  },

  async createDailyLog(data: { userId: string; logDay: string; status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" }): Promise<DailyLog> {
    const [log] = await db.insert(dailyLogs).values({
      userId: data.userId,
      logDay: data.logDay,
      tz: "Australia/Melbourne",
      discipline: "DRAFTING",
      status: data.status,
    }).returning();
    return log;
  },

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
  },

  async updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined> {
    const [log] = await db.update(dailyLogs).set({ ...data, updatedAt: new Date() } as any).where(eq(dailyLogs.id, id)).returning();
    return log;
  },

  async getLogRow(id: string): Promise<LogRow | undefined> {
    const [row] = await db.select().from(logRows).where(eq(logRows.id, id));
    return row;
  },

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
  },

  async updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; jobId: string; isUserEdited: boolean; workTypeId: number | null }>): Promise<LogRow | undefined> {
    const [row] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.id, id)).returning();
    return row;
  },

  async deleteLogRow(id: string): Promise<void> {
    await db.delete(logRows).where(eq(logRows.id, id));
  },

  async deleteDailyLog(id: string): Promise<void> {
    await db.delete(logRows).where(eq(logRows.dailyLogId, id));
    await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  },

  async createApprovalEvent(data: InsertApprovalEvent): Promise<ApprovalEvent> {
    const [event] = await db.insert(approvalEvents).values(data).returning();
    return event;
  },

  async getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]> {
    return await db.select().from(dailyLogs)
      .where(and(
        gte(dailyLogs.logDay, startDate),
        lte(dailyLogs.logDay, endDate)
      ))
      .orderBy(asc(dailyLogs.logDay));
  },

  async getDailyLogsWithRowsInRange(startDate: string, endDate: string, companyId?: string): Promise<Array<{
    log: DailyLog;
    user: User;
    rows: LogRow[];
  }>> {
    const conditions: any[] = [
      gte(dailyLogs.logDay, startDate),
      lte(dailyLogs.logDay, endDate),
    ];
    if (companyId) {
      conditions.push(eq(users.companyId, companyId));
    }
    const logs = await db.select().from(dailyLogs)
      .innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(and(...conditions))
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
  },
};
