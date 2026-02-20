import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  jobs, panelRegister, mappingRules, workTypes, jobLevelCycleTimes,
  type InsertJob, type Job, type PanelRegister, type MappingRule,
  type InsertWorkType, type WorkType,
  type InsertJobLevelCycleTime, type JobLevelCycleTime
} from "@shared/schema";

export class JobRepository {
  async getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) return undefined;
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, id)).orderBy(asc(panelRegister.panelMark)).limit(1000);
    return { ...job, panels };
  }

  async getJobByNumber(jobNumber: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobNumber, jobNumber)).limit(1);
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

  async getAllJobs(): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[]; panelCount: number; completedPanelCount: number })[]> {
    const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1000);
    const allRules = await db.select().from(mappingRules).limit(1000);
    
    const panelCounts = await db.select({
      jobId: panelRegister.jobId,
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${panelRegister.status} = 'COMPLETED')`
    }).from(panelRegister).groupBy(panelRegister.jobId);
    
    const countsByJob = new Map<string, { total: number; completed: number }>();
    for (const row of panelCounts) {
      countsByJob.set(row.jobId, { total: Number(row.total), completed: Number(row.completed) });
    }
    
    const rulesByJob = new Map<string, MappingRule[]>();
    for (const rule of allRules) {
      if (!rulesByJob.has(rule.jobId)) {
        rulesByJob.set(rule.jobId, []);
      }
      rulesByJob.get(rule.jobId)!.push(rule);
    }
    
    return allJobs.map(job => {
      const counts = countsByJob.get(job.id) || { total: 0, completed: 0 };
      return {
        ...job,
        panels: [],
        mappingRules: rulesByJob.get(job.id) || [],
        panelCount: counts.total,
        completedPanelCount: counts.completed,
      };
    });
  }

  async getActiveJobs(): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.status, "ACTIVE")).orderBy(desc(jobs.createdAt)).limit(1000);
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

  async getWorkType(id: number): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.id, id)).limit(1);
    return workType;
  }

  async getWorkTypeByCode(code: string): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.code, code)).limit(1);
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
    return db.select().from(workTypes).orderBy(asc(workTypes.name)).limit(1000);
  }

  async getActiveWorkTypes(): Promise<WorkType[]> {
    return db.select().from(workTypes).where(eq(workTypes.isActive, true)).orderBy(asc(workTypes.name)).limit(1000);
  }

  async getJobLevelCycleTimes(jobId: string): Promise<JobLevelCycleTime[]> {
    return db.select().from(jobLevelCycleTimes).where(eq(jobLevelCycleTimes.jobId, jobId)).limit(1000);
  }

  async createJobLevelCycleTime(data: InsertJobLevelCycleTime): Promise<JobLevelCycleTime> {
    const [cycleTime] = await db.insert(jobLevelCycleTimes).values(data).returning();
    return cycleTime;
  }

  async updateJobLevelCycleTime(id: string, data: Partial<InsertJobLevelCycleTime>): Promise<JobLevelCycleTime | undefined> {
    const [cycleTime] = await db.update(jobLevelCycleTimes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobLevelCycleTimes.id, id))
      .returning();
    return cycleTime;
  }

  async deleteJobLevelCycleTime(id: string): Promise<void> {
    await db.delete(jobLevelCycleTimes).where(eq(jobLevelCycleTimes.id, id));
  }

  async getJobsForProjectManager(projectManagerId: string): Promise<Job[]> {
    return db.select().from(jobs)
      .where(eq(jobs.projectManagerId, projectManagerId))
      .orderBy(desc(jobs.createdAt))
      .limit(1000);
  }

  async getJobsWithoutProductionSlots(): Promise<Job[]> {
    return db.select().from(jobs)
      .where(eq(jobs.status, "ACTIVE"))
      .orderBy(desc(jobs.createdAt))
      .limit(1000);
  }
}

export const jobRepository = new JobRepository();
