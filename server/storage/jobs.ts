import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  jobs, panelRegister, mappingRules,
  type Job, type InsertJob, type PanelRegister, type MappingRule,
} from "@shared/schema";

export const jobMethods = {
  async getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) return undefined;
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, id)).orderBy(asc(panelRegister.panelMark)).limit(1000);
    return { ...job, panels };
  },

  async getJobByNumber(jobNumber: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobNumber, jobNumber)).limit(1);
    return job;
  },

  async createJob(data: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(data).returning();
    return job;
  },

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db.update(jobs).set({ ...data, updatedAt: new Date() }).where(eq(jobs.id, id)).returning();
    return job;
  },

  async deleteJob(id: string): Promise<void> {
    await db.delete(panelRegister).where(eq(panelRegister.jobId, id));
    await db.delete(jobs).where(eq(jobs.id, id));
  },

  async getAllJobs(companyId?: string): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[]; panelCount: number; completedPanelCount: number })[]> {
    const allJobs = companyId 
      ? await db.select().from(jobs).where(eq(jobs.companyId, companyId)).orderBy(desc(jobs.createdAt)).limit(1000)
      : await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1000);
    const allRules = companyId
      ? await db.select().from(mappingRules).where(eq(mappingRules.companyId, companyId)).limit(1000)
      : await db.select().from(mappingRules).limit(1000);
    
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
  },

  async importJobs(data: InsertJob[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    for (const jobData of data) {
      try {
        const existing = await jobMethods.getJobByNumber(jobData.jobNumber);
        if (existing) {
          skipped++;
          continue;
        }
        await jobMethods.createJob(jobData);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped };
  },
};
