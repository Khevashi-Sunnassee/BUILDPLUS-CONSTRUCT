import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  globalSettings, mappingRules, zones,
  type GlobalSettings, type InsertMappingRule, type MappingRule,
  type InsertZone, type Zone
} from "@shared/schema";

export class SettingsRepository {
  async getGlobalSettings(): Promise<GlobalSettings | undefined> {
    const [settings] = await db.select().from(globalSettings).limit(1);
    return settings;
  }

  async updateGlobalSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const existing = await this.getGlobalSettings();
    if (existing) {
      const [updated] = await db.update(globalSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(globalSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(globalSettings).values(data as any).returning();
    return created;
  }

  async createMappingRule(data: InsertMappingRule): Promise<MappingRule> {
    const [rule] = await db.insert(mappingRules).values(data).returning();
    return rule;
  }

  async deleteMappingRule(id: string): Promise<void> {
    await db.delete(mappingRules).where(eq(mappingRules.id, id));
  }

  async getMappingRules(): Promise<MappingRule[]> {
    return db.select().from(mappingRules).orderBy(desc(mappingRules.createdAt));
  }

  async getAllZones(): Promise<Zone[]> {
    return db.select().from(zones).orderBy(zones.name);
  }

  async getZone(id: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.id, id));
    return zone;
  }

  async getZoneByCode(code: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.code, code));
    return zone;
  }

  async createZone(data: InsertZone): Promise<Zone> {
    const [zone] = await db.insert(zones).values(data).returning();
    return zone;
  }

  async updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined> {
    const [zone] = await db.update(zones).set({ ...data, updatedAt: new Date() }).where(eq(zones.id, id)).returning();
    return zone;
  }

  async deleteZone(id: string): Promise<void> {
    await db.delete(zones).where(eq(zones.id, id));
  }
}

export const settingsRepository = new SettingsRepository();
