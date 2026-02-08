import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import { db } from "../db";
import {
  dailyLogs, logRows, jobs, users, weeklyWageReports,
  weeklyJobReports, weeklyJobReportSchedules, eotClaims,
  type DailyLog, type LogRow, type Job, type User,
  type WeeklyWageReport, type InsertWeeklyWageReport,
  type WeeklyJobReport, type InsertWeeklyJobReport,
  type InsertWeeklyJobReportSchedule,
  type EotClaim, type InsertEotClaim,
} from "@shared/schema";
import type { WeeklyJobReportWithDetails, EotClaimWithDetails } from "./types";

async function enrichWeeklyJobReport(report: WeeklyJobReport): Promise<WeeklyJobReportWithDetails> {
  const [projectManager] = await db.select().from(users).where(eq(users.id, report.projectManagerId));
  let approvedBy = null;
  if (report.approvedById) {
    const [approver] = await db.select().from(users).where(eq(users.id, report.approvedById));
    approvedBy = approver || null;
  }
  const schedules = await db.select()
    .from(weeklyJobReportSchedules)
    .where(eq(weeklyJobReportSchedules.reportId, report.id))
    .orderBy(asc(weeklyJobReportSchedules.priority));
  
  const schedulesWithJobs = await Promise.all(schedules.map(async (schedule) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, schedule.jobId));
    return { ...schedule, job };
  }));

  return { ...report, projectManager, approvedBy, schedules: schedulesWithJobs };
}

async function enrichEotClaim(claim: EotClaim): Promise<EotClaimWithDetails> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, claim.jobId));
  const [createdBy] = await db.select().from(users).where(eq(users.id, claim.createdById));
  let reviewedBy = null;
  if (claim.reviewedById) {
    const [reviewer] = await db.select().from(users).where(eq(users.id, claim.reviewedById));
    reviewedBy = reviewer || null;
  }
  return { ...claim, job, createdBy, reviewedBy };
}

export const reportMethods = {
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
  },

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
    const userDailyMap = new Map<string, Map<string, number>>();
    let totalMinutes = 0;

    for (const row of allRows) {
      totalMinutes += row.log_rows.durationMin;
      const logDay = row.daily_logs.logDay;

      const userId = row.daily_logs.userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, { name: row.users?.name || "", email: row.users?.email || "", totalMinutes: 0, days: new Set() });
      }
      const user = userMap.get(userId)!;
      user.totalMinutes += row.log_rows.durationMin;
      user.days.add(logDay);

      if (row.jobs) {
        const jobId = row.jobs.id;
        if (!jobMap.has(jobId)) {
          jobMap.set(jobId, { name: row.jobs.name, code: row.jobs.code || row.jobs.jobNumber || "", totalMinutes: 0 });
        }
        jobMap.get(jobId)!.totalMinutes += row.log_rows.durationMin;
      }

      const app = row.log_rows.app;
      appMap.set(app, (appMap.get(app) || 0) + row.log_rows.durationMin);

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

      if (!dailyMap.has(logDay)) {
        dailyMap.set(logDay, { date: logDay, totalMinutes: 0, users: new Set() });
      }
      const dayData = dailyMap.get(logDay)!;
      dayData.totalMinutes += row.log_rows.durationMin;
      dayData.users.add(userId);

      if (!userDailyMap.has(userId)) {
        userDailyMap.set(userId, new Map());
      }
      const userDays = userDailyMap.get(userId)!;
      userDays.set(logDay, (userDays.get(logDay) || 0) + row.log_rows.durationMin);
    }

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: d.date, totalMinutes: d.totalMinutes, userCount: d.users.size }));

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
  },

  async getWeeklyWageReports(startDate?: string, endDate?: string): Promise<WeeklyWageReport[]> {
    let query = db.select().from(weeklyWageReports);
    if (startDate && endDate) {
      query = query.where(and(
        gte(weeklyWageReports.weekStartDate, startDate),
        lte(weeklyWageReports.weekEndDate, endDate)
      )) as typeof query;
    }
    return await query.orderBy(desc(weeklyWageReports.weekStartDate), asc(weeklyWageReports.factory));
  },

  async getWeeklyWageReport(id: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports).where(eq(weeklyWageReports.id, id));
    return report;
  },

  async getWeeklyWageReportByWeek(weekStartDate: string, weekEndDate: string, factory: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports)
      .where(and(
        eq(weeklyWageReports.weekStartDate, weekStartDate),
        eq(weeklyWageReports.weekEndDate, weekEndDate),
        eq(weeklyWageReports.factory, factory)
      ));
    return report;
  },

  async getWeeklyWageReportByWeekAndFactoryId(weekStartDate: string, weekEndDate: string, factoryId: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports)
      .where(and(
        eq(weeklyWageReports.weekStartDate, weekStartDate),
        eq(weeklyWageReports.weekEndDate, weekEndDate),
        eq(weeklyWageReports.factoryId, factoryId)
      ));
    return report;
  },

  async createWeeklyWageReport(data: InsertWeeklyWageReport & { createdById: string }): Promise<WeeklyWageReport> {
    const [report] = await db.insert(weeklyWageReports).values(data).returning();
    return report;
  },

  async updateWeeklyWageReport(id: string, data: Partial<InsertWeeklyWageReport>): Promise<WeeklyWageReport | undefined> {
    const [updated] = await db.update(weeklyWageReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(weeklyWageReports.id, id))
      .returning();
    return updated;
  },

  async deleteWeeklyWageReport(id: string): Promise<void> {
    await db.delete(weeklyWageReports).where(eq(weeklyWageReports.id, id));
  },

  async getWeeklyJobReports(projectManagerId?: string): Promise<WeeklyJobReportWithDetails[]> {
    let query = db.select().from(weeklyJobReports);
    if (projectManagerId) {
      query = query.where(eq(weeklyJobReports.projectManagerId, projectManagerId)) as typeof query;
    }
    const reports = await query.orderBy(desc(weeklyJobReports.reportDate));
    return Promise.all(reports.map(r => enrichWeeklyJobReport(r)));
  },

  async getWeeklyJobReport(id: string): Promise<WeeklyJobReportWithDetails | undefined> {
    const [report] = await db.select().from(weeklyJobReports).where(eq(weeklyJobReports.id, id));
    if (!report) return undefined;
    return enrichWeeklyJobReport(report);
  },

  async getWeeklyJobReportsByStatus(status: string): Promise<WeeklyJobReportWithDetails[]> {
    const reports = await db.select().from(weeklyJobReports)
      .where(eq(weeklyJobReports.status, status as typeof weeklyJobReports.status.enumValues[number]))
      .orderBy(desc(weeklyJobReports.reportDate));
    return Promise.all(reports.map(r => enrichWeeklyJobReport(r)));
  },

  async createWeeklyJobReport(data: InsertWeeklyJobReport, schedules: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails> {
    const [report] = await db.insert(weeklyJobReports).values(data).returning();
    
    if (schedules.length > 0) {
      await db.insert(weeklyJobReportSchedules).values(
        schedules.map(s => ({ ...s, reportId: report.id }))
      );
    }
    
    return enrichWeeklyJobReport(report);
  },

  async updateWeeklyJobReport(id: string, data: Partial<InsertWeeklyJobReport>, schedules?: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    
    if (!updated) return undefined;

    if (schedules) {
      await db.delete(weeklyJobReportSchedules).where(eq(weeklyJobReportSchedules.reportId, id));
      if (schedules.length > 0) {
        await db.insert(weeklyJobReportSchedules).values(
          schedules.map(s => ({ ...s, reportId: id }))
        );
      }
    }
    
    return enrichWeeklyJobReport(updated);
  },

  async submitWeeklyJobReport(id: string): Promise<WeeklyJobReport | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    return updated;
  },

  async approveWeeklyJobReport(id: string, approvedById: string): Promise<WeeklyJobReport | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ status: "APPROVED", approvedById, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    return updated;
  },

  async rejectWeeklyJobReport(id: string, approvedById: string, rejectionReason: string): Promise<WeeklyJobReport | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ status: "REJECTED", approvedById, rejectionReason, updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    return updated;
  },

  async deleteWeeklyJobReport(id: string): Promise<void> {
    await db.delete(weeklyJobReportSchedules).where(eq(weeklyJobReportSchedules.reportId, id));
    await db.delete(weeklyJobReports).where(eq(weeklyJobReports.id, id));
  },

  async getJobsForProjectManager(projectManagerId: string): Promise<Job[]> {
    return db.select().from(jobs)
      .where(and(
        eq(jobs.projectManagerId, projectManagerId),
        eq(jobs.status, "ACTIVE")
      ))
      .orderBy(asc(jobs.jobNumber));
  },

  async getApprovedWeeklyJobReports(): Promise<WeeklyJobReportWithDetails[]> {
    const reports = await db.select().from(weeklyJobReports)
      .where(eq(weeklyJobReports.status, "APPROVED"))
      .orderBy(desc(weeklyJobReports.reportDate));
    return Promise.all(reports.map(r => enrichWeeklyJobReport(r)));
  },

  async getEotClaims(): Promise<EotClaimWithDetails[]> {
    const claims = await db.select().from(eotClaims).orderBy(desc(eotClaims.createdAt));
    return Promise.all(claims.map(c => enrichEotClaim(c)));
  },

  async getEotClaim(id: string): Promise<EotClaimWithDetails | undefined> {
    const [claim] = await db.select().from(eotClaims).where(eq(eotClaims.id, id));
    if (!claim) return undefined;
    return enrichEotClaim(claim);
  },

  async getEotClaimsByJob(jobId: string): Promise<EotClaimWithDetails[]> {
    const claims = await db.select().from(eotClaims)
      .where(eq(eotClaims.jobId, jobId))
      .orderBy(desc(eotClaims.createdAt));
    return Promise.all(claims.map(c => enrichEotClaim(c)));
  },

  async createEotClaim(data: InsertEotClaim): Promise<EotClaim> {
    const [claim] = await db.insert(eotClaims).values(data).returning();
    return claim;
  },

  async updateEotClaim(id: string, data: Partial<InsertEotClaim>): Promise<EotClaim | undefined> {
    const [updated] = await db.update(eotClaims)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eotClaims.id, id))
      .returning();
    return updated;
  },

  async submitEotClaim(id: string): Promise<EotClaim | undefined> {
    const [updated] = await db.update(eotClaims)
      .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(eotClaims.id, id))
      .returning();
    return updated;
  },

  async approveEotClaim(id: string, reviewedById: string, reviewNotes: string, approvedDays: number): Promise<EotClaim | undefined> {
    const [updated] = await db.update(eotClaims)
      .set({ status: "APPROVED", reviewedById, reviewedAt: new Date(), reviewNotes, approvedDays, updatedAt: new Date() })
      .where(eq(eotClaims.id, id))
      .returning();
    return updated;
  },

  async rejectEotClaim(id: string, reviewedById: string, reviewNotes: string): Promise<EotClaim | undefined> {
    const [updated] = await db.update(eotClaims)
      .set({ status: "REJECTED", reviewedById, reviewedAt: new Date(), reviewNotes, updatedAt: new Date() })
      .where(eq(eotClaims.id, id))
      .returning();
    return updated;
  },

  async deleteEotClaim(id: string): Promise<void> {
    await db.delete(eotClaims).where(eq(eotClaims.id, id));
  },

  async getNextEotClaimNumber(jobId: string): Promise<string> {
    const existing = await db.select().from(eotClaims)
      .where(eq(eotClaims.jobId, jobId));
    const count = existing.length + 1;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    const jobNum = job?.jobNumber || "UNK";
    return `EOT-${jobNum}-${String(count).padStart(3, "0")}`;
  },
};
