import { eq, and, desc, asc, sql, like, or, inArray, notInArray, ne } from "drizzle-orm";
import { db } from "../db";
import {
  panelRegister, jobs, panelTypes, jobPanelRates, panelTypeCostComponents, jobCostOverrides, loadListPanels,
  type InsertPanelRegister, type PanelRegister, type Job,
  type InsertPanelType, type PanelTypeConfig,
  type InsertJobPanelRate, type JobPanelRate,
  type InsertPanelTypeCostComponent, type PanelTypeCostComponent,
  type InsertJobCostOverride, type JobCostOverride
} from "@shared/schema";

export class PanelRepository {
  async getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined> {
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(panelRegister.id, id));
    if (result.length === 0) return undefined;
    return { ...result[0].panel_register, job: result[0].jobs };
  }

  async getPanelsByJob(jobId: string, includeRetired: boolean = false): Promise<PanelRegister[]> {
    const conditions = [eq(panelRegister.jobId, jobId)];
    if (!includeRetired) {
      conditions.push(ne(panelRegister.lifecycleStatus, 0));
    }
    return db.select().from(panelRegister).where(and(...conditions)).orderBy(asc(panelRegister.panelMark));
  }

  async getPanelsByJobAndLevel(jobId: string, level: string, includeRetired: boolean = false): Promise<PanelRegister[]> {
    const conditions = [eq(panelRegister.jobId, jobId), eq(panelRegister.level, level)];
    if (!includeRetired) {
      conditions.push(ne(panelRegister.lifecycleStatus, 0));
    }
    return db.select().from(panelRegister)
      .where(and(...conditions))
      .orderBy(asc(panelRegister.panelMark));
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

  async getPanelById(id: string): Promise<PanelRegister | undefined> {
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, id));
    return panel;
  }

  async getPanelType(id: string): Promise<PanelTypeConfig | undefined> {
    const [type] = await db.select().from(panelTypes).where(eq(panelTypes.id, id));
    return type;
  }

  async getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined> {
    const [type] = await db.select().from(panelTypes).where(eq(panelTypes.code, code));
    return type;
  }

  async createPanelType(data: InsertPanelType): Promise<PanelTypeConfig> {
    const [type] = await db.insert(panelTypes).values(data).returning();
    return type;
  }

  async updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined> {
    const [type] = await db.update(panelTypes).set({ ...data, updatedAt: new Date() }).where(eq(panelTypes.id, id)).returning();
    return type;
  }

  async deletePanelType(id: string): Promise<void> {
    await db.delete(panelTypes).where(eq(panelTypes.id, id));
  }

  async getAllPanelTypes(): Promise<PanelTypeConfig[]> {
    return db.select().from(panelTypes).orderBy(asc(panelTypes.code));
  }

  async getJobPanelRate(id: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig }) | undefined> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.id, id));
    if (result.length === 0) return undefined;
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
    }
    const [created] = await db.insert(jobPanelRates)
      .values({ jobId, panelTypeId, ...data })
      .returning();
    return created;
  }

  async deleteJobPanelRate(id: string): Promise<void> {
    await db.delete(jobPanelRates).where(eq(jobPanelRates.id, id));
  }

  async getCostComponentsByPanelType(panelTypeId: string): Promise<PanelTypeCostComponent[]> {
    return db.select().from(panelTypeCostComponents).where(eq(panelTypeCostComponents.panelTypeId, panelTypeId));
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
    return db.insert(panelTypeCostComponents).values(components).returning();
  }

  async getJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides).where(eq(jobCostOverrides.jobId, jobId));
  }

  async getJobCostOverridesByPanelType(jobId: string, panelTypeId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(and(eq(jobCostOverrides.jobId, jobId), eq(jobCostOverrides.panelTypeId, panelTypeId)));
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

  async updatePanelActualHours(panelId: string, additionalMinutes: number): Promise<void> {
    const panel = await this.getPanelById(panelId);
    if (!panel) return;
    const currentMinutes = parseFloat(String(panel.actualHours ?? 0)) * 60;
    const newHours = (currentMinutes + additionalMinutes) / 60;
    await db.update(panelRegister)
      .set({ actualHours: newHours, updatedAt: new Date() } as any)
      .where(eq(panelRegister.id, panelId));
  }

  async getPanelCountsBySource(): Promise<{ source: number; count: number }[]> {
    const result = await db.select({
      source: panelRegister.source,
      count: sql<number>`count(*)`
    }).from(panelRegister).groupBy(panelRegister.source);
    return result.map(r => ({ source: r.source ?? 0, count: Number(r.count) }));
  }

  async deletePanelsBySource(source: number): Promise<number> {
    const result = await db.delete(panelRegister).where(eq(panelRegister.source, source)).returning();
    return result.length;
  }

  async deletePanelsByJobAndSource(jobId: string, source: number): Promise<number> {
    const result = await db.delete(panelRegister)
      .where(and(eq(panelRegister.jobId, jobId), eq(panelRegister.source, source)))
      .returning();
    return result.length;
  }

  async getExistingPanelSourceIds(jobId: string): Promise<Set<string>> {
    const panels = await db.select({ panelSourceId: panelRegister.panelSourceId })
      .from(panelRegister)
      .where(eq(panelRegister.jobId, jobId));
    return new Set(panels.filter(p => p.panelSourceId).map(p => p.panelSourceId!));
  }

  async getPanelsReadyForLoading(): Promise<(PanelRegister & { job: Job })[]> {
    const panelsOnLoadLists = db.select({ panelId: loadListPanels.panelId }).from(loadListPanels);
    
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(and(
        eq(panelRegister.approvedForProduction, true),
        eq(panelRegister.status, "COMPLETED"),
        ne(panelRegister.lifecycleStatus, 0),
        notInArray(panelRegister.id, panelsOnLoadLists)
      ))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.panel_register, job: r.jobs }));
  }

  async getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]> {
    const conditions = [eq(panelRegister.approvedForProduction, true), ne(panelRegister.lifecycleStatus, 0)];
    if (jobId) conditions.push(eq(panelRegister.jobId, jobId));
    
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.panel_register, job: r.jobs }));
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
    concreteStrengthMpa?: string | null;
    rotationalLifters?: string | null;
    primaryLifters?: string | null;
    productionPdfUrl?: string | null;
  }): Promise<PanelRegister | undefined> {
    const [panel] = await db.update(panelRegister)
      .set({
        ...data,
        approvedForProduction: true,
        approvedAt: new Date(),
        approvedById,
        updatedAt: new Date()
      })
      .where(eq(panelRegister.id, id))
      .returning();
    return panel;
  }

  async revokePanelProductionApproval(id: string): Promise<PanelRegister | undefined> {
    const [panel] = await db.update(panelRegister)
      .set({
        approvedForProduction: false,
        approvedAt: null,
        approvedById: null,
        updatedAt: new Date()
      })
      .where(eq(panelRegister.id, id))
      .returning();
    return panel;
  }
}

export const panelRepository = new PanelRepository();
