import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db";
import {
  trailerTypes, loadLists, loadListPanels, deliveryRecords, panelRegister, jobs, users,
  type InsertTrailerType, type TrailerType,
  type InsertLoadList, type LoadList, type InsertLoadListPanel, type LoadListPanel,
  type InsertDeliveryRecord, type DeliveryRecord,
  type PanelRegister, type Job, type User
} from "@shared/schema";

export interface LoadListWithDetails extends LoadList {
  job?: Job;
  trailerType?: TrailerType;
  panels?: (LoadListPanel & { panel: PanelRegister })[];
  deliveryRecord?: DeliveryRecord;
  createdBy?: User;
}

export class LogisticsRepository {
  async getAllTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes).orderBy(asc(trailerTypes.name));
  }

  async getActiveTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes).where(eq(trailerTypes.isActive, true)).orderBy(asc(trailerTypes.name));
  }

  async getTrailerType(id: string): Promise<TrailerType | undefined> {
    const [type] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, id));
    return type;
  }

  async createTrailerType(data: InsertTrailerType): Promise<TrailerType> {
    const [type] = await db.insert(trailerTypes).values(data).returning();
    return type;
  }

  async updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined> {
    const [type] = await db.update(trailerTypes).set({ ...data, updatedAt: new Date() }).where(eq(trailerTypes.id, id)).returning();
    return type;
  }

  async deleteTrailerType(id: string): Promise<void> {
    await db.delete(trailerTypes).where(eq(trailerTypes.id, id));
  }

  async getAllLoadLists(): Promise<LoadListWithDetails[]> {
    const lists = await db.select().from(loadLists).orderBy(desc(loadLists.createdAt));
    const results: LoadListWithDetails[] = [];
    
    for (const list of lists) {
      const details = await this.getLoadListDetails(list);
      results.push(details);
    }
    
    return results;
  }

  async getLoadList(id: string): Promise<LoadListWithDetails | undefined> {
    const [list] = await db.select().from(loadLists).where(eq(loadLists.id, id));
    if (!list) return undefined;
    return this.getLoadListDetails(list);
  }

  private async getLoadListDetails(list: LoadList): Promise<LoadListWithDetails> {
    const [job] = list.jobId ? await db.select().from(jobs).where(eq(jobs.id, list.jobId)) : [];
    const [trailer] = list.trailerTypeId ? await db.select().from(trailerTypes).where(eq(trailerTypes.id, list.trailerTypeId)) : [];
    const [delivery] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, list.id));
    const [createdByUser] = list.createdById ? await db.select().from(users).where(eq(users.id, list.createdById)) : [];
    
    const panelLinks = await db.select().from(loadListPanels)
      .where(eq(loadListPanels.loadListId, list.id))
      .orderBy(asc(loadListPanels.sequence));
    
    const panels: (LoadListPanel & { panel: PanelRegister })[] = [];
    for (const link of panelLinks) {
      const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, link.panelId));
      if (panel) {
        panels.push({ ...link, panel });
      }
    }
    
    return {
      ...list,
      job: job || undefined,
      trailerType: trailer || undefined,
      panels,
      deliveryRecord: delivery || undefined,
      createdBy: createdByUser || undefined
    };
  }

  async createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails> {
    const [list] = await db.insert(loadLists).values(data).returning();
    
    for (let i = 0; i < panelIds.length; i++) {
      await db.insert(loadListPanels).values({
        loadListId: list.id,
        panelId: panelIds[i],
        sequence: i + 1
      });
    }
    
    return this.getLoadList(list.id) as Promise<LoadListWithDetails>;
  }

  async updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined> {
    const [list] = await db.update(loadLists).set({ ...data, updatedAt: new Date() }).where(eq(loadLists.id, id)).returning();
    return list;
  }

  async deleteLoadList(id: string): Promise<void> {
    await db.delete(loadListPanels).where(eq(loadListPanels.loadListId, id));
    await db.delete(deliveryRecords).where(eq(deliveryRecords.loadListId, id));
    await db.delete(loadLists).where(eq(loadLists.id, id));
  }

  async addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel> {
    const existingPanels = await db.select().from(loadListPanels).where(eq(loadListPanels.loadListId, loadListId));
    const newSequence = sequence ?? existingPanels.length + 1;
    const [panel] = await db.insert(loadListPanels).values({ loadListId, panelId, sequence: newSequence }).returning();
    return panel;
  }

  async removePanelFromLoadList(loadListId: string, panelId: string): Promise<void> {
    await db.delete(loadListPanels)
      .where(and(eq(loadListPanels.loadListId, loadListId), eq(loadListPanels.panelId, panelId)));
  }

  async getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]> {
    const links = await db.select().from(loadListPanels)
      .where(eq(loadListPanels.loadListId, loadListId))
      .orderBy(asc(loadListPanels.sequence));
    
    const result: (LoadListPanel & { panel: PanelRegister })[] = [];
    for (const link of links) {
      const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, link.panelId));
      if (panel) {
        result.push({ ...link, panel });
      }
    }
    return result;
  }

  async getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined> {
    const [record] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, loadListId));
    return record;
  }

  async createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord> {
    const [record] = await db.insert(deliveryRecords).values(data).returning();
    await db.update(loadLists).set({ status: "DELIVERED", updatedAt: new Date() }).where(eq(loadLists.id, data.loadListId));
    return record;
  }

  async updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined> {
    const [record] = await db.update(deliveryRecords).set({ ...data, updatedAt: new Date() }).where(eq(deliveryRecords.id, id)).returning();
    return record;
  }
}

export const logisticsRepository = new LogisticsRepository();
