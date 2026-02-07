import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  trailerTypes, loadLists, loadListPanels, deliveryRecords, panelRegister, jobs, users,
  loadReturns, loadReturnPanels,
  type InsertTrailerType, type TrailerType,
  type InsertLoadList, type LoadList, type InsertLoadListPanel, type LoadListPanel,
  type InsertDeliveryRecord, type DeliveryRecord,
  type PanelRegister, type Job, type User,
  type LoadReturn, type LoadReturnPanel
} from "@shared/schema";

export interface LoadReturnWithPanels extends LoadReturn {
  panels: (LoadReturnPanel & { panel: PanelRegister })[];
  returnedBy?: User;
}

export interface LoadListWithDetails extends LoadList {
  job?: Job;
  trailerType?: TrailerType;
  panels?: (LoadListPanel & { panel: PanelRegister })[];
  deliveryRecord?: DeliveryRecord;
  createdBy?: User;
  loadReturn?: LoadReturnWithPanels;
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
    const [jobPromise, trailerPromise, deliveryPromise, createdByPromise, panelLinksPromise, returnRecordPromise] = await Promise.all([
      list.jobId ? db.select().from(jobs).where(eq(jobs.id, list.jobId)) : Promise.resolve([]),
      list.trailerTypeId ? db.select().from(trailerTypes).where(eq(trailerTypes.id, list.trailerTypeId)) : Promise.resolve([]),
      db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, list.id)),
      list.createdById ? db.select().from(users).where(eq(users.id, list.createdById)) : Promise.resolve([]),
      db.select().from(loadListPanels).where(eq(loadListPanels.loadListId, list.id)).orderBy(asc(loadListPanels.sequence)),
      db.select().from(loadReturns).where(eq(loadReturns.loadListId, list.id)),
    ]);

    const [job] = jobPromise;
    const [trailer] = trailerPromise;
    const [delivery] = deliveryPromise;
    const [createdByUser] = createdByPromise;
    const panelLinks = panelLinksPromise;
    const [returnRecord] = returnRecordPromise;

    const panelIds = panelLinks.map(l => l.panelId);
    const panelsMap = new Map<string, PanelRegister>();
    if (panelIds.length > 0) {
      const panelsList = await db.select().from(panelRegister).where(inArray(panelRegister.id, panelIds));
      for (const p of panelsList) panelsMap.set(p.id, p);
    }
    
    const panels: (LoadListPanel & { panel: PanelRegister })[] = [];
    for (const link of panelLinks) {
      const panel = panelsMap.get(link.panelId);
      if (panel) panels.push({ ...link, panel });
    }
    
    let loadReturn: LoadReturnWithPanels | undefined;
    if (returnRecord) {
      const returnPanelLinks = await db.select().from(loadReturnPanels).where(eq(loadReturnPanels.loadReturnId, returnRecord.id));
      const returnPanelIds = returnPanelLinks.map(rp => rp.panelId);
      const returnPanelsMap = new Map<string, PanelRegister>();
      if (returnPanelIds.length > 0) {
        const rpList = await db.select().from(panelRegister).where(inArray(panelRegister.id, returnPanelIds));
        for (const p of rpList) returnPanelsMap.set(p.id, p);
      }
      const returnPanels: (LoadReturnPanel & { panel: PanelRegister })[] = [];
      for (const rp of returnPanelLinks) {
        const panel = returnPanelsMap.get(rp.panelId);
        if (panel) returnPanels.push({ ...rp, panel });
      }
      const [returnedByUser] = returnRecord.returnedById ? await db.select().from(users).where(eq(users.id, returnRecord.returnedById)) : [];
      loadReturn = { ...returnRecord, panels: returnPanels, returnedBy: returnedByUser || undefined };
    }

    return {
      ...list,
      job: job || undefined,
      trailerType: trailer || undefined,
      panels,
      deliveryRecord: delivery || undefined,
      createdBy: createdByUser || undefined,
      loadReturn,
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
