import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db";
import {
  trailerTypes, loadLists, loadListPanels, deliveryRecords,
  loadReturns, loadReturnPanels, panelRegister, jobs, users,
  type TrailerType, type InsertTrailerType,
  type LoadList, type InsertLoadList, type LoadListPanel,
  type DeliveryRecord, type InsertDeliveryRecord,
  type InsertLoadReturn, type LoadReturnPanel,
  type PanelRegister, type Job, type User,
} from "@shared/schema";
import type { LoadListWithDetails, LoadReturnWithDetails } from "./types";

export const logisticsMethods = {
  async getAllTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes).orderBy(asc(trailerTypes.sortOrder));
  },

  async getActiveTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes)
      .where(eq(trailerTypes.isActive, true))
      .orderBy(asc(trailerTypes.sortOrder));
  },

  async getTrailerType(id: string): Promise<TrailerType | undefined> {
    const [trailerType] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, id));
    return trailerType;
  },

  async createTrailerType(data: InsertTrailerType): Promise<TrailerType> {
    const [trailerType] = await db.insert(trailerTypes).values(data).returning();
    return trailerType;
  },

  async updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined> {
    const [updated] = await db.update(trailerTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trailerTypes.id, id))
      .returning();
    return updated;
  },

  async deleteTrailerType(id: string): Promise<void> {
    await db.delete(trailerTypes).where(eq(trailerTypes.id, id));
  },

  async getLoadReturn(loadListId: string): Promise<LoadReturnWithDetails | null> {
    const [returnRecord] = await db.select().from(loadReturns).where(eq(loadReturns.loadListId, loadListId));
    if (!returnRecord) return null;

    const [returnedByUser] = returnRecord.returnedById
      ? await db.select().from(users).where(eq(users.id, returnRecord.returnedById))
      : [];

    const returnPanelLinks = await db.select().from(loadReturnPanels)
      .where(eq(loadReturnPanels.loadReturnId, returnRecord.id));

    const panels: (LoadReturnPanel & { panel: PanelRegister })[] = [];
    for (const link of returnPanelLinks) {
      const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, link.panelId));
      if (panel) {
        panels.push({ ...link, panel });
      }
    }

    return {
      ...returnRecord,
      returnedBy: returnedByUser || null,
      panels,
    };
  },

  async getAllLoadLists(): Promise<LoadListWithDetails[]> {
    const allLoadLists = await db.select().from(loadLists).orderBy(desc(loadLists.createdAt));
    
    const results: LoadListWithDetails[] = [];
    for (const loadList of allLoadLists) {
      const details = await logisticsMethods.getLoadList(loadList.id);
      if (details) results.push(details);
    }
    return results;
  },

  async getLoadList(id: string): Promise<LoadListWithDetails | undefined> {
    const [loadList] = await db.select().from(loadLists).where(eq(loadLists.id, id));
    if (!loadList) return undefined;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, loadList.jobId));
    if (!job) return undefined;

    let trailerType: TrailerType | null = null;
    if (loadList.trailerTypeId) {
      const [tt] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, loadList.trailerTypeId));
      trailerType = tt || null;
    }

    const panelResults = await db.select()
      .from(loadListPanels)
      .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
      .where(eq(loadListPanels.loadListId, id))
      .orderBy(asc(loadListPanels.sequence));

    const panels = panelResults.map(r => ({ ...r.load_list_panels, panel: r.panel_register }));

    const [deliveryRecord] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, id));

    const loadReturn = await logisticsMethods.getLoadReturn(id);

    let createdBy: User | null = null;
    if (loadList.createdById) {
      const [user] = await db.select().from(users).where(eq(users.id, loadList.createdById));
      createdBy = user || null;
    }

    return {
      ...loadList,
      job,
      trailerType,
      panels,
      deliveryRecord: deliveryRecord || null,
      loadReturn,
      createdBy,
    };
  },

  async createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails> {
    const [loadList] = await db.insert(loadLists).values(data).returning();

    if (panelIds.length > 0) {
      const panelData = panelIds.map((panelId, index) => ({
        loadListId: loadList.id,
        panelId,
        sequence: index + 1,
      }));
      await db.insert(loadListPanels).values(panelData);
    }

    const details = await logisticsMethods.getLoadList(loadList.id);
    return details!;
  },

  async updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined> {
    const [updated] = await db.update(loadLists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loadLists.id, id))
      .returning();
    return updated;
  },

  async deleteLoadList(id: string): Promise<void> {
    await db.delete(loadLists).where(eq(loadLists.id, id));
  },

  async addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel> {
    if (!sequence) {
      const existingPanels = await db.select()
        .from(loadListPanels)
        .where(eq(loadListPanels.loadListId, loadListId));
      sequence = existingPanels.length + 1;
    }

    const [panel] = await db.insert(loadListPanels).values({
      loadListId,
      panelId,
      sequence,
    }).returning();
    return panel;
  },

  async removePanelFromLoadList(loadListId: string, panelId: string): Promise<void> {
    await db.delete(loadListPanels)
      .where(and(
        eq(loadListPanels.loadListId, loadListId),
        eq(loadListPanels.panelId, panelId)
      ));
  },

  async getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]> {
    const results = await db.select()
      .from(loadListPanels)
      .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
      .where(eq(loadListPanels.loadListId, loadListId))
      .orderBy(asc(loadListPanels.sequence));

    return results.map(r => ({ ...r.load_list_panels, panel: r.panel_register }));
  },

  async getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined> {
    const [record] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, loadListId));
    return record;
  },

  async getDeliveryRecordById(id: string): Promise<DeliveryRecord | undefined> {
    const [record] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.id, id));
    return record;
  },

  async createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord> {
    const [record] = await db.insert(deliveryRecords).values(data).returning();
    
    await db.update(loadLists)
      .set({ status: "COMPLETE", updatedAt: new Date() })
      .where(eq(loadLists.id, data.loadListId));
    
    return record;
  },

  async updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined> {
    const [updated] = await db.update(deliveryRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deliveryRecords.id, id))
      .returning();
    return updated;
  },

  async createLoadReturn(data: InsertLoadReturn, panelIds: string[]): Promise<LoadReturnWithDetails> {
    const [returnRecord] = await db.insert(loadReturns).values(data).returning();

    for (const panelId of panelIds) {
      await db.insert(loadReturnPanels).values({
        loadReturnId: returnRecord.id,
        panelId,
      });
    }

    return logisticsMethods.getLoadReturn(data.loadListId) as Promise<LoadReturnWithDetails>;
  },
};
