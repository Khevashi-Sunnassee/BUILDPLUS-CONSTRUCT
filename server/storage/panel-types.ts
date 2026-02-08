import { eq, and, asc } from "drizzle-orm";
import { db } from "../db";
import {
  panelTypes, jobPanelRates, workTypes, panelTypeCostComponents, jobCostOverrides,
  type PanelTypeConfig, type InsertPanelType,
  type JobPanelRate, type InsertJobPanelRate,
  type WorkType, type InsertWorkType,
  type PanelTypeCostComponent, type InsertPanelTypeCostComponent,
  type JobCostOverride, type InsertJobCostOverride,
} from "@shared/schema";

export const panelTypeMethods = {
  async getPanelType(id: string): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.select().from(panelTypes).where(eq(panelTypes.id, id));
    return pt;
  },

  async getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.select().from(panelTypes).where(eq(panelTypes.code, code));
    return pt;
  },

  async createPanelType(data: InsertPanelType): Promise<PanelTypeConfig> {
    const [pt] = await db.insert(panelTypes).values(data).returning();
    return pt;
  },

  async updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.update(panelTypes).set({ ...data, updatedAt: new Date() }).where(eq(panelTypes.id, id)).returning();
    return pt;
  },

  async deletePanelType(id: string): Promise<void> {
    await db.delete(panelTypes).where(eq(panelTypes.id, id));
  },

  async getAllPanelTypes(companyId?: string): Promise<PanelTypeConfig[]> {
    if (companyId) {
      return await db.select().from(panelTypes).where(eq(panelTypes.companyId, companyId)).orderBy(asc(panelTypes.name));
    }
    return await db.select().from(panelTypes).orderBy(asc(panelTypes.name));
  },

  async getJobPanelRate(id: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig }) | undefined> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.id, id));
    if (!result.length) return undefined;
    return { ...result[0].job_panel_rates, panelType: result[0].panel_types };
  },

  async getJobPanelRates(jobId: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig })[]> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.jobId, jobId));
    return result.map(r => ({ ...r.job_panel_rates, panelType: r.panel_types }));
  },

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
  },

  async deleteJobPanelRate(id: string): Promise<void> {
    await db.delete(jobPanelRates).where(eq(jobPanelRates.id, id));
  },

  async getEffectiveRates(jobId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; jobRate?: JobPanelRate })[]> {
    const allTypes = await panelTypeMethods.getAllPanelTypes();
    const jobRates = await panelTypeMethods.getJobPanelRates(jobId);
    const ratesMap = new Map(jobRates.map(r => [r.panelTypeId, r]));
    
    return allTypes.map(pt => ({
      ...pt,
      isOverridden: ratesMap.has(pt.id),
      jobRate: ratesMap.get(pt.id),
    }));
  },

  async getWorkType(id: number): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.id, id));
    return workType;
  },

  async getWorkTypeByCode(code: string): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.code, code));
    return workType;
  },

  async createWorkType(data: InsertWorkType): Promise<WorkType> {
    const [workType] = await db.insert(workTypes).values(data as any).returning();
    return workType;
  },

  async updateWorkType(id: number, data: Partial<InsertWorkType>): Promise<WorkType | undefined> {
    const [workType] = await db.update(workTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workTypes.id, id))
      .returning();
    return workType;
  },

  async deleteWorkType(id: number): Promise<void> {
    await db.delete(workTypes).where(eq(workTypes.id, id));
  },

  async getAllWorkTypes(companyId?: string): Promise<WorkType[]> {
    if (companyId) {
      return db.select().from(workTypes).where(eq(workTypes.companyId, companyId)).orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
    }
    return db.select().from(workTypes).orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
  },

  async getActiveWorkTypes(companyId?: string): Promise<WorkType[]> {
    if (companyId) {
      return db.select().from(workTypes).where(and(eq(workTypes.companyId, companyId), eq(workTypes.isActive, true))).orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
    }
    return db.select().from(workTypes)
      .where(eq(workTypes.isActive, true))
      .orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
  },

  async getCostComponentsByPanelType(panelTypeId: string): Promise<PanelTypeCostComponent[]> {
    return db.select().from(panelTypeCostComponents)
      .where(eq(panelTypeCostComponents.panelTypeId, panelTypeId))
      .orderBy(asc(panelTypeCostComponents.sortOrder));
  },

  async createCostComponent(data: InsertPanelTypeCostComponent): Promise<PanelTypeCostComponent> {
    const [component] = await db.insert(panelTypeCostComponents).values(data).returning();
    return component;
  },

  async updateCostComponent(id: string, data: Partial<InsertPanelTypeCostComponent>): Promise<PanelTypeCostComponent | undefined> {
    const [component] = await db.update(panelTypeCostComponents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(panelTypeCostComponents.id, id))
      .returning();
    return component;
  },

  async deleteCostComponent(id: string): Promise<void> {
    await db.delete(panelTypeCostComponents).where(eq(panelTypeCostComponents.id, id));
  },

  async replaceCostComponents(panelTypeId: string, components: InsertPanelTypeCostComponent[]): Promise<PanelTypeCostComponent[]> {
    await db.delete(panelTypeCostComponents).where(eq(panelTypeCostComponents.panelTypeId, panelTypeId));
    if (components.length === 0) return [];
    const inserted = await db.insert(panelTypeCostComponents).values(components).returning();
    return inserted;
  },

  async getJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(eq(jobCostOverrides.jobId, jobId))
      .orderBy(asc(jobCostOverrides.panelTypeId), asc(jobCostOverrides.componentName));
  },

  async getJobCostOverridesByPanelType(jobId: string, panelTypeId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(and(
        eq(jobCostOverrides.jobId, jobId),
        eq(jobCostOverrides.panelTypeId, panelTypeId)
      ))
      .orderBy(asc(jobCostOverrides.componentName));
  },

  async createJobCostOverride(data: InsertJobCostOverride): Promise<JobCostOverride> {
    const [override] = await db.insert(jobCostOverrides).values(data).returning();
    return override;
  },

  async updateJobCostOverride(id: string, data: Partial<InsertJobCostOverride>): Promise<JobCostOverride | undefined> {
    const [override] = await db.update(jobCostOverrides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobCostOverrides.id, id))
      .returning();
    return override;
  },

  async deleteJobCostOverride(id: string): Promise<void> {
    await db.delete(jobCostOverrides).where(eq(jobCostOverrides.id, id));
  },

  async initializeJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    const allPanelTypes = await panelTypeMethods.getAllPanelTypes();
    const existingOverrides = await panelTypeMethods.getJobCostOverrides(jobId);
    const existingKeys = new Set(existingOverrides.map(o => `${o.panelTypeId}:${o.componentName}`));
    
    const newOverrides: InsertJobCostOverride[] = [];
    for (const pt of allPanelTypes) {
      const components = await panelTypeMethods.getCostComponentsByPanelType(pt.id);
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
    
    return panelTypeMethods.getJobCostOverrides(jobId);
  },
};
