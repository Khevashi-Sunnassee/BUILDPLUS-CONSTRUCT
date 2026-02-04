import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  draftingProgram, panelRegister, jobs, users, productionSlots,
  type InsertDraftingProgram, type DraftingProgram,
  type PanelRegister, type Job, type User, type ProductionSlot
} from "@shared/schema";

export interface DraftingProgramWithDetails extends DraftingProgram {
  panel?: PanelRegister;
  job?: Job;
  assignedTo?: User;
  productionSlot?: ProductionSlot;
}

export class DraftingRepository {
  async getDraftingPrograms(filters?: { jobId?: string; status?: string; assignedToId?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<DraftingProgramWithDetails[]> {
    const conditions: any[] = [];
    
    if (filters?.jobId) conditions.push(eq(draftingProgram.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(draftingProgram.status, filters.status as any));
    if (filters?.assignedToId) conditions.push(eq(draftingProgram.assignedToId, filters.assignedToId));
    if (filters?.dateFrom) conditions.push(gte(draftingProgram.drawingDueDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(draftingProgram.drawingDueDate, filters.dateTo));
    if (filters?.factoryIds && filters.factoryIds.length > 0) {
      conditions.push(inArray(jobs.factoryId, filters.factoryIds));
    }
    
    // If filtering by factoryIds, need to join with jobs table
    let programs: DraftingProgram[];
    if (filters?.factoryIds && filters.factoryIds.length > 0) {
      const result = conditions.length > 0
        ? await db.select({ draftingProgram }).from(draftingProgram)
            .innerJoin(jobs, eq(draftingProgram.jobId, jobs.id))
            .where(and(...conditions))
            .orderBy(asc(draftingProgram.drawingDueDate))
        : await db.select({ draftingProgram }).from(draftingProgram)
            .innerJoin(jobs, eq(draftingProgram.jobId, jobs.id))
            .orderBy(asc(draftingProgram.drawingDueDate));
      programs = result.map(r => r.draftingProgram);
    } else {
      programs = conditions.length > 0
        ? await db.select().from(draftingProgram).where(and(...conditions)).orderBy(asc(draftingProgram.drawingDueDate))
        : await db.select().from(draftingProgram).orderBy(asc(draftingProgram.drawingDueDate));
    }
    
    return this.enrichDraftingPrograms(programs);
  }

  private async enrichDraftingPrograms(programs: DraftingProgram[]): Promise<DraftingProgramWithDetails[]> {
    const result: DraftingProgramWithDetails[] = [];
    for (const program of programs) {
      const [panel] = program.panelId ? await db.select().from(panelRegister).where(eq(panelRegister.id, program.panelId)) : [];
      const [job] = await db.select().from(jobs).where(eq(jobs.id, program.jobId));
      const [assignedTo] = program.assignedToId ? await db.select().from(users).where(eq(users.id, program.assignedToId)) : [];
      const [slot] = program.productionSlotId ? await db.select().from(productionSlots).where(eq(productionSlots.id, program.productionSlotId)) : [];
      
      result.push({
        ...program,
        panel: panel || undefined,
        job: job || undefined,
        assignedTo: assignedTo || undefined,
        productionSlot: slot || undefined
      });
    }
    return result;
  }

  async getDraftingProgram(id: string): Promise<DraftingProgramWithDetails | undefined> {
    const [program] = await db.select().from(draftingProgram).where(eq(draftingProgram.id, id));
    if (!program) return undefined;
    const enriched = await this.enrichDraftingPrograms([program]);
    return enriched[0];
  }

  async getDraftingProgramByPanelId(panelId: string): Promise<DraftingProgram | undefined> {
    const [program] = await db.select().from(draftingProgram).where(eq(draftingProgram.panelId, panelId));
    return program;
  }

  async createDraftingProgram(data: InsertDraftingProgram): Promise<DraftingProgram> {
    const [program] = await db.insert(draftingProgram).values(data).returning();
    return program;
  }

  async updateDraftingProgram(id: string, data: Partial<InsertDraftingProgram>): Promise<DraftingProgram | undefined> {
    const [program] = await db.update(draftingProgram).set({ ...data, updatedAt: new Date() }).where(eq(draftingProgram.id, id)).returning();
    return program;
  }

  async deleteDraftingProgram(id: string): Promise<void> {
    await db.delete(draftingProgram).where(eq(draftingProgram.id, id));
  }

  async deleteDraftingProgramByJob(jobId: string): Promise<number> {
    const result = await db.delete(draftingProgram).where(eq(draftingProgram.jobId, jobId)).returning();
    return result.length;
  }

  async assignDraftingResource(id: string, assignedToId: string, proposedStartDate: Date): Promise<DraftingProgram | undefined> {
    return this.updateDraftingProgram(id, {
      assignedToId,
      proposedStartDate,
      status: "SCHEDULED"
    });
  }

  async getMyAllocatedDraftingPrograms(userId: string): Promise<DraftingProgramWithDetails[]> {
    const programs = await db.select().from(draftingProgram)
      .where(eq(draftingProgram.assignedToId, userId))
      .orderBy(asc(draftingProgram.drawingDueDate));
    return this.enrichDraftingPrograms(programs);
  }
}

export const draftingRepository = new DraftingRepository();
