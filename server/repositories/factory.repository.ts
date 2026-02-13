import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "../db";
import {
  factories, cfmeuHolidays, globalSettings,
  type Factory, type CfmeuHoliday
} from "@shared/schema";

export interface WorkingDaysConfig {
  workDays: boolean[];
  holidays: Date[];
}

export class FactoryRepository {
  async getAllFactories(companyId?: string): Promise<Factory[]> {
    if (companyId) {
      return db.select().from(factories).where(eq(factories.companyId, companyId)).orderBy(factories.name);
    }
    return db.select().from(factories).orderBy(factories.name);
  }

  async getActiveFactories(companyId?: string): Promise<Factory[]> {
    const conditions = [eq(factories.isActive, true)];
    if (companyId) conditions.push(eq(factories.companyId, companyId));
    return db.select().from(factories).where(and(...conditions)).orderBy(factories.name);
  }

  async getFactory(id: string): Promise<Factory | undefined> {
    const [factory] = await db.select().from(factories).where(eq(factories.id, id));
    return factory;
  }

  async getFactoryByCode(code: string): Promise<Factory | undefined> {
    const [factory] = await db.select().from(factories).where(eq(factories.code, code));
    return factory;
  }

  async createFactory(data: Partial<Factory>): Promise<Factory> {
    const [factory] = await db.insert(factories).values(data as any).returning();
    return factory;
  }

  async updateFactory(id: string, data: Partial<Factory>): Promise<Factory | undefined> {
    const [factory] = await db.update(factories).set({ ...data, updatedAt: new Date() }).where(eq(factories.id, id)).returning();
    return factory;
  }

  async deleteFactory(id: string): Promise<void> {
    await db.delete(factories).where(eq(factories.id, id));
  }

  async getFactoryWorkDays(factoryId: string | null, companyId?: string): Promise<boolean[]> {
    const defaultWorkDays = [false, true, true, true, true, true, false];
    
    if (!factoryId) {
      if (companyId) {
        const settings = await db.select().from(globalSettings).where(eq(globalSettings.companyId, companyId));
        return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
      }
      const settings = await db.select().from(globalSettings).limit(1);
      return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
    }
    
    const [factory] = await db.select().from(factories).where(eq(factories.id, factoryId));
    if (!factory) {
      if (companyId) {
        const settings = await db.select().from(globalSettings).where(eq(globalSettings.companyId, companyId));
        return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
      }
      const settings = await db.select().from(globalSettings).limit(1);
      return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
    }
    
    if (factory.inheritWorkDays) {
      const effectiveCompanyId = companyId || factory.companyId;
      const settings = await db.select().from(globalSettings).where(eq(globalSettings.companyId, effectiveCompanyId));
      return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
    }
    
    return (factory.workDays as boolean[]) ?? defaultWorkDays;
  }

  async getCfmeuHolidaysInRange(
    calendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null,
    startDate: Date,
    endDate: Date
  ): Promise<Date[]> {
    if (!calendarType) return [];
    
    const holidays = await db.select()
      .from(cfmeuHolidays)
      .where(
        and(
          eq(cfmeuHolidays.calendarType, calendarType),
          gte(cfmeuHolidays.date, startDate),
          lte(cfmeuHolidays.date, endDate)
        )
      );
    
    return holidays.map(h => new Date(h.date));
  }

  async getAllCfmeuHolidays(calendarType?: string): Promise<CfmeuHoliday[]> {
    if (calendarType) {
      return db.select().from(cfmeuHolidays)
        .where(eq(cfmeuHolidays.calendarType, calendarType as "VIC_ONSITE" | "VIC_OFFSITE" | "QLD"))
        .orderBy(cfmeuHolidays.date);
    }
    return db.select().from(cfmeuHolidays).orderBy(cfmeuHolidays.date);
  }

  async createCfmeuHoliday(data: Partial<CfmeuHoliday>): Promise<CfmeuHoliday> {
    const [holiday] = await db.insert(cfmeuHolidays).values(data as any).returning();
    return holiday;
  }

  async deleteCfmeuHoliday(id: string): Promise<void> {
    await db.delete(cfmeuHolidays).where(eq(cfmeuHolidays.id, id));
  }

  async bulkCreateCfmeuHolidays(data: Partial<CfmeuHoliday>[]): Promise<CfmeuHoliday[]> {
    if (data.length === 0) return [];
    return db.insert(cfmeuHolidays).values(data as any).returning();
  }

  isWorkingDay(date: Date, workDays: boolean[], holidays: Date[]): boolean {
    const dayOfWeek = date.getDay();
    if (!workDays[dayOfWeek]) return false;
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const isHoliday = holidays.some(h => 
      h.getFullYear() === year && h.getMonth() === month && h.getDate() === day
    );
    
    return !isHoliday;
  }

  addWorkingDays(startDate: Date, workingDays: number, workDays: boolean[], holidays: Date[]): Date {
    const result = new Date(startDate);
    const direction = workingDays >= 0 ? 1 : -1;
    let remaining = Math.abs(workingDays);
    
    while (remaining > 0) {
      result.setDate(result.getDate() + direction);
      if (this.isWorkingDay(result, workDays, holidays)) {
        remaining--;
      }
    }
    
    return result;
  }

  subtractWorkingDays(startDate: Date, workingDays: number, workDays: boolean[], holidays: Date[]): Date {
    return this.addWorkingDays(startDate, -workingDays, workDays, holidays);
  }
}

export const factoryRepository = new FactoryRepository();
