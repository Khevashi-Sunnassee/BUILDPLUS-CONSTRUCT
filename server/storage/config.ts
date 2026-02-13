import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import {
  globalSettings, zones,
  type GlobalSettings, type Zone, type InsertZone,
} from "@shared/schema";

export const configMethods = {
  async getGlobalSettings(companyId?: string): Promise<GlobalSettings | undefined> {
    if (companyId) {
      const [settings] = await db.select().from(globalSettings).where(eq(globalSettings.companyId, companyId));
      return settings;
    }
    const [settings] = await db.select().from(globalSettings).limit(1);
    return settings;
  },

  async updateGlobalSettings(data: Partial<GlobalSettings>, companyId?: string): Promise<GlobalSettings> {
    const existing = await configMethods.getGlobalSettings(companyId);
    if (existing) {
      const [settings] = await db.update(globalSettings).set({ ...data, updatedAt: new Date() }).where(eq(globalSettings.id, existing.id)).returning();
      return settings;
    }
    const insertData = { ...data } as any;
    if (companyId) {
      insertData.companyId = companyId;
    }
    const [settings] = await db.insert(globalSettings).values(insertData).returning();
    return settings;
  },

  async getAllZones(): Promise<Zone[]> {
    return db.select().from(zones).orderBy(asc(zones.name));
  },

  async getZone(id: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.id, id));
    return zone;
  },

  async getZoneByCode(code: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.code, code));
    return zone;
  },

  async createZone(data: InsertZone): Promise<Zone> {
    const [zone] = await db.insert(zones).values(data).returning();
    return zone;
  },

  async updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined> {
    const [zone] = await db.update(zones).set({ ...data, updatedAt: new Date() }).where(eq(zones.id, id)).returning();
    return zone;
  },

  async deleteZone(id: string): Promise<void> {
    await db.delete(zones).where(eq(zones.id, id));
  },
};
