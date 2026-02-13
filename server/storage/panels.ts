import { eq, and, asc, sql, ne, inArray, notInArray } from "drizzle-orm";
import { db } from "../db";
import {
  panelRegister, jobs, productionEntries, loadListPanels,
  type PanelRegister, type InsertPanelRegister, type Job,
} from "@shared/schema";

export const panelMethods = {
  async getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined> {
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(panelRegister.id, id));
    if (result.length === 0) return undefined;
    return { ...result[0].panel_register, job: result[0].jobs };
  },

  async getPanelsByJob(jobId: string, includeRetired: boolean = false): Promise<PanelRegister[]> {
    const conditions = [eq(panelRegister.jobId, jobId)];
    if (!includeRetired) {
      conditions.push(ne(panelRegister.lifecycleStatus, 0));
    }
    return db.select().from(panelRegister).where(and(...conditions)).orderBy(asc(panelRegister.panelMark));
  },

  async getPanelsByJobAndLevel(jobId: string, level: string, includeRetired: boolean = false): Promise<PanelRegister[]> {
    const conditions = [eq(panelRegister.jobId, jobId), eq(panelRegister.level, level)];
    if (!includeRetired) {
      conditions.push(ne(panelRegister.lifecycleStatus, 0));
    }
    return db.select().from(panelRegister)
      .where(and(...conditions))
      .orderBy(asc(panelRegister.panelMark));
  },

  async createPanelRegisterItem(data: InsertPanelRegister): Promise<PanelRegister> {
    const [panel] = await db.insert(panelRegister).values(data).returning();
    return panel;
  },

  async updatePanelRegisterItem(id: string, data: Partial<InsertPanelRegister>): Promise<PanelRegister | undefined> {
    const [panel] = await db.update(panelRegister).set({ ...data, updatedAt: new Date() }).where(eq(panelRegister.id, id)).returning();
    return panel;
  },

  async deletePanelRegisterItem(id: string): Promise<void> {
    await db.delete(panelRegister).where(eq(panelRegister.id, id));
  },

  async getAllPanelRegisterItems(companyId?: string): Promise<(PanelRegister & { job: Job })[]> {
    const conditions = [];
    if (companyId) {
      conditions.push(eq(jobs.companyId, companyId));
    }
    const query = db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id));
    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark))
      : await query.orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.panel_register, job: r.jobs }));
  },

  async getPaginatedPanelRegisterItems(options: { page: number; limit: number; jobId?: string; search?: string; status?: string; documentStatus?: string; factoryId?: string }): Promise<{ panels: (PanelRegister & { job: Job })[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page, limit, jobId, search, status, documentStatus, factoryId } = options;
    const offset = (page - 1) * limit;
    
    const conditions = [];
    if (jobId) {
      conditions.push(eq(panelRegister.jobId, jobId));
    }
    if (factoryId) {
      conditions.push(eq(jobs.factoryId, factoryId));
    }
    if (status) {
      conditions.push(eq(panelRegister.status, status as typeof panelRegister.status.enumValues[number]));
    }
    if (documentStatus) {
      conditions.push(eq(panelRegister.documentStatus, documentStatus as typeof panelRegister.documentStatus.enumValues[number]));
    }
    if (search) {
      conditions.push(sql`(
        ${panelRegister.panelMark} ILIKE ${'%' + search + '%'} OR 
        ${panelRegister.description} ILIKE ${'%' + search + '%'} OR
        ${jobs.jobNumber} ILIKE ${'%' + search + '%'}
      )`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(whereClause);
    const total = countResult[0]?.count || 0;
    
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(whereClause)
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark))
      .limit(limit)
      .offset(offset);
    
    const panels = result.map(r => ({ ...r.panel_register, job: r.jobs }));
    const totalPages = Math.ceil(total / limit);
    
    return { panels, total, page, limit, totalPages };
  },

  async importPanelRegister(data: InsertPanelRegister[]): Promise<{ imported: number; skipped: number; importedIds: string[] }> {
    let imported = 0;
    let skipped = 0;
    const importedIds: string[] = [];
    
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
        const created = await panelMethods.createPanelRegisterItem(panelData);
        importedIds.push(created.id);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped, importedIds };
  },

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
  },

  async getPanelCountsBySource(companyId?: string): Promise<{ source: number; count: number }[]> {
    if (companyId) {
      const result = await db.select({
        source: panelRegister.source,
        count: sql<number>`count(*)::int`
      })
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(jobs.companyId, companyId))
      .groupBy(panelRegister.source);
      return result;
    }
    const result = await db.select({
      source: panelRegister.source,
      count: sql<number>`count(*)::int`
    })
    .from(panelRegister)
    .groupBy(panelRegister.source);
    return result;
  },

  async panelsWithSourceHaveRecords(source: number): Promise<boolean> {
    const panelsFromSource = await db.select({ id: panelRegister.id })
      .from(panelRegister)
      .where(eq(panelRegister.source, source));
    
    if (panelsFromSource.length === 0) return false;
    
    const panelIds = panelsFromSource.map(p => p.id);
    
    const approvedPanels = await db.select({ id: panelRegister.id })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.source, source),
        eq(panelRegister.approvedForProduction, true)
      ))
      .limit(1);
    
    if (approvedPanels.length > 0) return true;
    
    const productionRecords = await db.select({ id: productionEntries.id })
      .from(productionEntries)
      .where(sql`${productionEntries.panelId} = ANY(${panelIds})`)
      .limit(1);
    
    return productionRecords.length > 0;
  },

  async deletePanelsBySource(source: number): Promise<number> {
    const result = await db.delete(panelRegister)
      .where(eq(panelRegister.source, source))
      .returning({ id: panelRegister.id });
    return result.length;
  },

  async deletePanelsByJobAndSource(jobId: string, source: number): Promise<number> {
    const panels = await db.select({ id: panelRegister.id })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.jobId, jobId),
        eq(panelRegister.source, source),
        eq(panelRegister.approvedForProduction, false)
      ));
    
    if (panels.length === 0) return 0;
    
    const panelIds = panels.map(p => p.id);
    
    const panelsWithRecords = await db.select({ panelId: productionEntries.panelId })
      .from(productionEntries)
      .where(inArray(productionEntries.panelId, panelIds));
    
    const panelIdsWithRecords = new Set(panelsWithRecords.map(p => p.panelId));
    const deletableIds = panelIds.filter(id => !panelIdsWithRecords.has(id));
    
    if (deletableIds.length === 0) return 0;
    
    const result = await db.delete(panelRegister)
      .where(inArray(panelRegister.id, deletableIds))
      .returning({ id: panelRegister.id });
    return result.length;
  },

  async getExistingPanelSourceIds(jobId: string): Promise<Set<string>> {
    const panels = await db.select({ panelSourceId: panelRegister.panelSourceId })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.jobId, jobId),
        sql`${panelRegister.panelSourceId} IS NOT NULL`
      ));
    return new Set(panels.map(p => p.panelSourceId).filter(Boolean) as string[]);
  },

  async importEstimatePanels(data: any[]): Promise<{ imported: number; errors: string[]; importedIds: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    const importedIds: string[] = [];
    
    for (const panel of data) {
      try {
        const existing = await db.select().from(panelRegister)
          .where(and(
            eq(panelRegister.jobId, panel.jobId),
            eq(panelRegister.panelMark, panel.panelMark)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          if (existing[0].panelSourceId === panel.panelSourceId) {
            await db.update(panelRegister)
              .set({
                ...panel,
                updatedAt: new Date(),
              })
              .where(eq(panelRegister.id, existing[0].id));
            importedIds.push(existing[0].id);
            imported++;
          } else {
            const newMark = `${panel.panelMark}_${panel.sourceRow}`;
            const [created] = await db.insert(panelRegister).values({
              ...panel,
              panelMark: newMark,
            }).returning();
            importedIds.push(created.id);
            imported++;
          }
        } else {
          const [created] = await db.insert(panelRegister).values(panel).returning();
          importedIds.push(created.id);
          imported++;
        }
      } catch (err: any) {
        errors.push(`Row ${panel.sourceRow}: ${err.message}`);
      }
    }
    
    return { imported, errors, importedIds };
  },

  async getPanelById(id: string): Promise<PanelRegister | undefined> {
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, id));
    return panel;
  },

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
  },

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
  },

  async getPanelsReadyForLoading(companyId?: string): Promise<(PanelRegister & { job: Job })[]> {
    const panelsOnLoadListsSubquery = db.select({ panelId: loadListPanels.panelId }).from(loadListPanels);
    
    const conditions = [
      eq(panelRegister.approvedForProduction, true),
      eq(panelRegister.status, "COMPLETED"),
      ne(panelRegister.lifecycleStatus, 0),
      notInArray(panelRegister.id, panelsOnLoadListsSubquery)
    ];
    if (companyId) {
      conditions.push(eq(jobs.companyId, companyId));
    }
    
    const results = await db.select()
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return results.map(r => ({ ...r.panel_register, job: r.jobs }));
  },

  async getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]> {
    const conditions = [eq(panelRegister.approvedForProduction, true), ne(panelRegister.lifecycleStatus, 0)];
    if (jobId) {
      conditions.push(eq(panelRegister.jobId, jobId));
    }
    
    const results = await db.select()
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(and(...conditions));
    return results.map(r => ({ ...r.panel_register, job: r.jobs }));
  },
};
