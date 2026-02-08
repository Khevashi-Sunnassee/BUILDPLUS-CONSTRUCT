import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  draftingProgram, productionSlots, panelRegister, jobs, users, globalSettings,
  reoSchedules, reoScheduleItems, documents,
  type DraftingProgram, type InsertDraftingProgram,
  type Job,
  type ReoSchedule, type InsertReoSchedule, type ReoScheduleWithDetails,
  type ReoScheduleItem, type InsertReoScheduleItem, type ReoScheduleItemStatus,
} from "@shared/schema";
import type { DraftingProgramWithDetails } from "./types";
import { subtractWorkingDays } from "./utils";

export const schedulingMethods = {
  async getDraftingPrograms(filters?: { jobId?: string; status?: string; assignedToId?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<DraftingProgramWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.jobId) conditions.push(eq(draftingProgram.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(draftingProgram.status, filters.status as typeof draftingProgram.status.enumValues[number]));
    if (filters?.assignedToId) conditions.push(eq(draftingProgram.assignedToId, filters.assignedToId));
    if (filters?.dateFrom) conditions.push(sql`${draftingProgram.drawingDueDate} >= ${filters.dateFrom}`);
    if (filters?.dateTo) conditions.push(sql`${draftingProgram.drawingDueDate} <= ${filters.dateTo}`);
    if (filters?.factoryIds && filters.factoryIds.length > 0) {
      conditions.push(inArray(jobs.factoryId, filters.factoryIds));
    }
    
    const query = db.select({
      draftingProgram: draftingProgram,
      job: jobs
    })
      .from(draftingProgram)
      .innerJoin(jobs, eq(draftingProgram.jobId, jobs.id))
      .orderBy(asc(draftingProgram.drawingDueDate));
    
    const results = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;
    
    const detailedResults: DraftingProgramWithDetails[] = [];
    for (const r of results) {
      const dp = r.draftingProgram;
      const job = r.job;
      const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, dp.panelId));
      const slot = dp.productionSlotId ? (await db.select().from(productionSlots).where(eq(productionSlots.id, dp.productionSlotId)))[0] : null;
      const assignedTo = dp.assignedToId ? (await db.select().from(users).where(eq(users.id, dp.assignedToId)))[0] : null;
      
      if (panel) {
        detailedResults.push({ ...dp, panel, job, productionSlot: slot, assignedTo });
      }
    }
    return detailedResults;
  },

  async getDraftingProgram(id: string): Promise<DraftingProgramWithDetails | undefined> {
    const [dp] = await db.select().from(draftingProgram).where(eq(draftingProgram.id, id));
    if (!dp) return undefined;
    
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, dp.panelId));
    const [job] = await db.select().from(jobs).where(eq(jobs.id, dp.jobId));
    const slot = dp.productionSlotId ? (await db.select().from(productionSlots).where(eq(productionSlots.id, dp.productionSlotId)))[0] : null;
    const assignedTo = dp.assignedToId ? (await db.select().from(users).where(eq(users.id, dp.assignedToId)))[0] : null;
    
    if (!panel || !job) return undefined;
    return { ...dp, panel, job, productionSlot: slot, assignedTo };
  },

  async getDraftingProgramByPanelId(panelId: string): Promise<DraftingProgram | undefined> {
    const [dp] = await db.select().from(draftingProgram).where(eq(draftingProgram.panelId, panelId));
    return dp;
  },

  async createDraftingProgram(data: InsertDraftingProgram): Promise<DraftingProgram> {
    const [created] = await db.insert(draftingProgram).values(data).returning();
    return created;
  },

  async updateDraftingProgram(id: string, data: Partial<InsertDraftingProgram>): Promise<DraftingProgram | undefined> {
    const [updated] = await db.update(draftingProgram).set({ ...data, updatedAt: new Date() }).where(eq(draftingProgram.id, id)).returning();
    return updated;
  },

  async deleteDraftingProgram(id: string): Promise<void> {
    await db.delete(draftingProgram).where(eq(draftingProgram.id, id));
  },

  async deleteDraftingProgramByJob(jobId: string): Promise<number> {
    const result = await db.delete(draftingProgram).where(eq(draftingProgram.jobId, jobId)).returning();
    return result.length;
  },

  async generateDraftingProgramFromProductionSlots(): Promise<{ created: number; updated: number }> {
    const [settings] = await db.select().from(globalSettings);
    const defaultIfcDaysInAdvance = settings?.ifcDaysInAdvance ?? 14;
    const defaultDaysToAchieveIfc = settings?.daysToAchieveIfc ?? 21;
    
    const draftingWorkDays = (settings?.draftingWorkDays as boolean[]) ?? [false, true, true, true, true, true, false];
    const noHolidays: Date[] = [];
    
    const slots = await db.select().from(productionSlots).where(
      sql`${productionSlots.status} != 'COMPLETED'`
    );
    
    const jobCache = new Map<string, Job>();
    
    let created = 0;
    let updated = 0;
    
    for (const slot of slots) {
      let job = jobCache.get(slot.jobId);
      if (!job) {
        const [jobData] = await db.select().from(jobs).where(eq(jobs.id, slot.jobId));
        if (jobData) {
          job = jobData;
          jobCache.set(slot.jobId, jobData);
        }
      }
      
      const ifcDaysInAdvance = job?.daysInAdvance ?? defaultIfcDaysInAdvance;
      const daysToAchieveIfc = job?.daysToAchieveIfc ?? defaultDaysToAchieveIfc;
      const productionWindowDays = job?.productionWindowDays ?? settings?.productionWindowDays ?? 10;
      
      const panels = await db.select().from(panelRegister).where(and(
        eq(panelRegister.jobId, slot.jobId),
        eq(panelRegister.level, slot.level)
      ));
      
      for (const panel of panels) {
        const existing = await schedulingMethods.getDraftingProgramByPanelId(panel.id);
        
        const productionDate = slot.productionSlotDate;
        
        const productionWindowStart = subtractWorkingDays(productionDate, productionWindowDays, draftingWorkDays, noHolidays);
        const drawingDueDate = subtractWorkingDays(productionWindowStart, ifcDaysInAdvance, draftingWorkDays, noHolidays);
        const draftingWindowStart = subtractWorkingDays(drawingDueDate, daysToAchieveIfc, draftingWorkDays, noHolidays);
        
        if (existing) {
          await schedulingMethods.updateDraftingProgram(existing.id, {
            productionSlotId: slot.id,
            productionDate,
            drawingDueDate,
            draftingWindowStart,
          });
          updated++;
        } else {
          await schedulingMethods.createDraftingProgram({
            panelId: panel.id,
            jobId: slot.jobId,
            productionSlotId: slot.id,
            level: slot.level,
            productionDate,
            drawingDueDate,
            draftingWindowStart,
            status: "NOT_SCHEDULED",
          });
          created++;
        }
      }
    }
    
    return { created, updated };
  },

  async assignDraftingResource(id: string, assignedToId: string, proposedStartDate: Date): Promise<DraftingProgram | undefined> {
    const [updated] = await db.update(draftingProgram).set({
      assignedToId,
      proposedStartDate,
      status: "SCHEDULED",
      updatedAt: new Date(),
    }).where(eq(draftingProgram.id, id)).returning();
    return updated;
  },

  async getIfcPanelsForProcurement(companyId: string): Promise<any[]> {
    const panels = await db.select({
      panel: panelRegister,
      job: jobs,
    })
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(and(
        eq(jobs.companyId, companyId),
        eq(panelRegister.documentStatus, "IFC")
      ))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    
    return panels;
  },

  async createReoSchedule(data: InsertReoSchedule): Promise<ReoSchedule> {
    const [result] = await db.insert(reoSchedules).values(data).returning();
    return result;
  },

  async getReoSchedule(id: string): Promise<ReoSchedule | undefined> {
    const [result] = await db.select().from(reoSchedules).where(eq(reoSchedules.id, id));
    return result;
  },

  async getReoScheduleByPanel(panelId: string): Promise<ReoSchedule | undefined> {
    const [result] = await db.select().from(reoSchedules)
      .where(eq(reoSchedules.panelId, panelId))
      .orderBy(desc(reoSchedules.createdAt))
      .limit(1);
    return result;
  },

  async getReoScheduleWithDetails(id: string): Promise<ReoScheduleWithDetails | undefined> {
    const [schedule] = await db.select().from(reoSchedules).where(eq(reoSchedules.id, id));
    if (!schedule) return undefined;

    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, schedule.panelId));
    const [job] = await db.select().from(jobs).where(eq(jobs.id, schedule.jobId));
    const [sourceDocument] = schedule.sourceDocumentId 
      ? await db.select().from(documents).where(eq(documents.id, schedule.sourceDocumentId))
      : [null];
    const [createdByUser] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    }).from(users).where(eq(users.id, schedule.createdById));
    const items = await db.select().from(reoScheduleItems)
      .where(eq(reoScheduleItems.scheduleId, id))
      .orderBy(asc(reoScheduleItems.sortOrder), asc(reoScheduleItems.reoType));

    return {
      ...schedule,
      panel: panel || null,
      job: job || null,
      sourceDocument: sourceDocument || null,
      createdBy: createdByUser || null,
      items,
    };
  },

  async updateReoSchedule(id: string, data: Partial<InsertReoSchedule>): Promise<ReoSchedule | undefined> {
    const [result] = await db.update(reoSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reoSchedules.id, id))
      .returning();
    return result;
  },

  async getReoSchedulesByCompany(companyId: string): Promise<ReoSchedule[]> {
    return db.select().from(reoSchedules)
      .where(eq(reoSchedules.companyId, companyId))
      .orderBy(desc(reoSchedules.createdAt));
  },

  async createReoScheduleItem(data: InsertReoScheduleItem): Promise<ReoScheduleItem> {
    const [result] = await db.insert(reoScheduleItems).values(data).returning();
    return result;
  },

  async createReoScheduleItemsBulk(items: InsertReoScheduleItem[]): Promise<ReoScheduleItem[]> {
    if (items.length === 0) return [];
    return db.insert(reoScheduleItems).values(items).returning();
  },

  async getReoScheduleItems(scheduleId: string): Promise<ReoScheduleItem[]> {
    return db.select().from(reoScheduleItems)
      .where(eq(reoScheduleItems.scheduleId, scheduleId))
      .orderBy(asc(reoScheduleItems.sortOrder), asc(reoScheduleItems.reoType));
  },

  async updateReoScheduleItem(id: string, data: Partial<InsertReoScheduleItem>): Promise<ReoScheduleItem | undefined> {
    const [result] = await db.update(reoScheduleItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reoScheduleItems.id, id))
      .returning();
    return result;
  },

  async deleteReoScheduleItem(id: string): Promise<void> {
    await db.delete(reoScheduleItems).where(eq(reoScheduleItems.id, id));
  },

  async updateReoScheduleItemsStatus(scheduleId: string, itemIds: string[], status: ReoScheduleItemStatus): Promise<ReoScheduleItem[]> {
    return db.update(reoScheduleItems)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(reoScheduleItems.scheduleId, scheduleId),
        inArray(reoScheduleItems.id, itemIds)
      ))
      .returning();
  },

  async linkReoScheduleItemsToPO(itemIds: string[], purchaseOrderId: string): Promise<void> {
    await db.update(reoScheduleItems)
      .set({ purchaseOrderId, status: "ORDERED" as ReoScheduleItemStatus, updatedAt: new Date() })
      .where(inArray(reoScheduleItems.id, itemIds));
  },
};
