import { eq, and, desc, asc, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  productionEntries, productionDays, productionSlots, productionSlotAdjustments,
  panelRegister, jobs, users,
  type InsertProductionEntry, type ProductionEntry,
  type InsertProductionDay, type ProductionDay,
  type InsertProductionSlot, type ProductionSlot,
  type InsertProductionSlotAdjustment, type ProductionSlotAdjustment,
  type PanelRegister, type Job, type User
} from "@shared/schema";

export interface ProductionSlotWithDetails extends ProductionSlot {
  job?: Job;
  panels?: PanelRegister[];
}

export interface ProductionSlotAdjustmentWithDetails extends ProductionSlotAdjustment {
  changedBy?: User;
}

export class ProductionRepository {
  async getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined> {
    const [entry] = await db.select().from(productionEntries).where(eq(productionEntries.id, id));
    if (!entry) return undefined;
    
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, entry.panelId));
    if (!panel) return undefined;
    
    const [job] = await db.select().from(jobs).where(eq(jobs.id, panel.jobId));
    if (!job) return undefined;
    
    return { ...entry, panel, job };
  }

  async getProductionEntriesByDate(date: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const entries = await db.select().from(productionEntries).where(eq(productionEntries.productionDate, date));
    return this.enrichProductionEntries(entries);
  }

  async getProductionEntriesByDateAndFactory(date: string, factory: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const entries = await db.select().from(productionEntries)
      .where(and(eq(productionEntries.productionDate, date), eq(productionEntries.factory, factory)));
    return this.enrichProductionEntries(entries);
  }

  async getProductionEntriesByDateAndFactoryId(date: string, factoryId: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const entries = await db.select().from(productionEntries)
      .where(and(eq(productionEntries.productionDate, date), eq(productionEntries.factoryId, factoryId)));
    return this.enrichProductionEntries(entries);
  }

  async getProductionEntriesInRange(startDate: string, endDate: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const entries = await db.select().from(productionEntries)
      .where(and(gte(productionEntries.productionDate, startDate), lte(productionEntries.productionDate, endDate)));
    return this.enrichProductionEntries(entries);
  }

  private async enrichProductionEntries(entries: ProductionEntry[]): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result: (ProductionEntry & { panel: PanelRegister; job: Job; user: User })[] = [];
    for (const entry of entries) {
      const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, entry.panelId));
      if (!panel) continue;
      const [job] = await db.select().from(jobs).where(eq(jobs.id, panel.jobId));
      if (!job) continue;
      const [user] = await db.select().from(users).where(eq(users.id, entry.createdById));
      if (!user) continue;
      result.push({ ...entry, panel, job, user });
    }
    return result;
  }

  async createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry> {
    const [entry] = await db.insert(productionEntries).values(data).returning();
    return entry;
  }

  async updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined> {
    const [entry] = await db.update(productionEntries).set({ ...data, updatedAt: new Date() }).where(eq(productionEntries.id, id)).returning();
    return entry;
  }

  async deleteProductionEntry(id: string): Promise<void> {
    await db.delete(productionEntries).where(eq(productionEntries.id, id));
  }

  async getProductionEntryByPanelId(panelId: string): Promise<ProductionEntry | undefined> {
    const [entry] = await db.select().from(productionEntries).where(eq(productionEntries.panelId, panelId));
    return entry;
  }

  async getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const entries = await db.select().from(productionEntries).orderBy(desc(productionEntries.productionDate));
    return this.enrichProductionEntries(entries);
  }

  async getProductionDays(startDate: string, endDate: string): Promise<ProductionDay[]> {
    return db.select().from(productionDays)
      .where(and(gte(productionDays.productionDate, startDate), lte(productionDays.productionDate, endDate)))
      .orderBy(asc(productionDays.productionDate));
  }

  async getProductionDay(date: string, factory: string): Promise<ProductionDay | undefined> {
    const [day] = await db.select().from(productionDays)
      .where(and(eq(productionDays.productionDate, date), eq(productionDays.factory, factory)));
    return day;
  }

  async getProductionDayByFactoryId(date: string, factoryId: string): Promise<ProductionDay | undefined> {
    const [day] = await db.select().from(productionDays)
      .where(and(eq(productionDays.productionDate, date), eq(productionDays.factoryId, factoryId)));
    return day;
  }

  async createProductionDay(data: InsertProductionDay): Promise<ProductionDay> {
    const [day] = await db.insert(productionDays).values(data).returning();
    return day;
  }

  async deleteProductionDay(id: string): Promise<void> {
    await db.delete(productionDays).where(eq(productionDays.id, id));
  }

  async deleteProductionDayByDateAndFactory(date: string, factory: string): Promise<void> {
    await db.delete(productionDays).where(and(eq(productionDays.productionDate, date), eq(productionDays.factory, factory)));
  }

  async deleteProductionDayByDateAndFactoryId(date: string, factoryId: string): Promise<void> {
    await db.delete(productionDays).where(and(eq(productionDays.productionDate, date), eq(productionDays.factoryId, factoryId)));
  }

  async getProductionSlots(filters?: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<ProductionSlotWithDetails[]> {
    let query = db.select().from(productionSlots);
    const conditions: any[] = [];
    
    if (filters?.jobId) conditions.push(eq(productionSlots.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(productionSlots.status, filters.status as typeof productionSlots.status.enumValues[number]));
    if (filters?.dateFrom) conditions.push(gte(productionSlots.productionSlotDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(productionSlots.productionSlotDate, filters.dateTo));
    
    const slots = conditions.length > 0 
      ? await db.select().from(productionSlots).where(and(...conditions)).orderBy(asc(productionSlots.productionSlotDate))
      : await db.select().from(productionSlots).orderBy(asc(productionSlots.productionSlotDate));
    
    return this.enrichProductionSlots(slots);
  }

  private async enrichProductionSlots(slots: ProductionSlot[]): Promise<ProductionSlotWithDetails[]> {
    const result: ProductionSlotWithDetails[] = [];
    for (const slot of slots) {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, slot.jobId));
      const panels = await db.select().from(panelRegister)
        .where(and(eq(panelRegister.jobId, slot.jobId), eq(panelRegister.level, slot.level)));
      result.push({ ...slot, job: job || undefined, panels });
    }
    return result;
  }

  async getProductionSlot(id: string): Promise<ProductionSlotWithDetails | undefined> {
    const [slot] = await db.select().from(productionSlots).where(eq(productionSlots.id, id));
    if (!slot) return undefined;
    const enriched = await this.enrichProductionSlots([slot]);
    return enriched[0];
  }

  async createProductionSlot(data: InsertProductionSlot): Promise<ProductionSlot> {
    const [slot] = await db.insert(productionSlots).values(data).returning();
    return slot;
  }

  async updateProductionSlot(id: string, data: Partial<InsertProductionSlot>): Promise<ProductionSlot | undefined> {
    const [slot] = await db.update(productionSlots).set({ ...data, updatedAt: new Date() }).where(eq(productionSlots.id, id)).returning();
    return slot;
  }

  async deleteProductionSlot(id: string): Promise<void> {
    await db.delete(productionSlotAdjustments).where(eq(productionSlotAdjustments.productionSlotId, id));
    await db.delete(productionSlots).where(eq(productionSlots.id, id));
  }

  async getProductionSlotAdjustments(slotId: string): Promise<ProductionSlotAdjustmentWithDetails[]> {
    const adjustments = await db.select().from(productionSlotAdjustments)
      .where(eq(productionSlotAdjustments.productionSlotId, slotId))
      .orderBy(desc(productionSlotAdjustments.createdAt));
    
    const result: ProductionSlotAdjustmentWithDetails[] = [];
    for (const adj of adjustments) {
      const [user] = adj.changedById ? await db.select().from(users).where(eq(users.id, adj.changedById)) : [];
      result.push({ ...adj, changedBy: user || undefined });
    }
    return result;
  }

  async createProductionSlotAdjustment(data: InsertProductionSlotAdjustment): Promise<ProductionSlotAdjustment> {
    const [adj] = await db.insert(productionSlotAdjustments).values(data).returning();
    return adj;
  }

  async bookProductionSlot(id: string): Promise<ProductionSlot | undefined> {
    return this.updateProductionSlot(id, { status: "BOOKED" });
  }

  async completeProductionSlot(id: string): Promise<ProductionSlot | undefined> {
    return this.updateProductionSlot(id, { status: "COMPLETED" });
  }
}

export const productionRepository = new ProductionRepository();
