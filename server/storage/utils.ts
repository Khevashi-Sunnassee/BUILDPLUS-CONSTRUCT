import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { globalSettings, factories, cfmeuHolidays } from "@shared/schema";
import crypto from "crypto";

export function sha256Hex(raw: string | Buffer) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function randomKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function getFactoryWorkDays(factoryId: string | null, companyId?: string): Promise<boolean[]> {
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

export async function getCfmeuHolidaysInRange(
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

export function isWorkingDay(date: Date, workDays: boolean[], holidays: Date[]): boolean {
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

export function addWorkingDays(
  startDate: Date,
  workingDays: number,
  workDays: boolean[],
  holidays: Date[]
): Date {
  const result = new Date(startDate);
  const direction = workingDays >= 0 ? 1 : -1;
  let remaining = Math.abs(workingDays);
  
  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (isWorkingDay(result, workDays, holidays)) {
      remaining--;
    }
  }
  
  return result;
}

export function subtractWorkingDays(
  startDate: Date,
  workingDays: number,
  workDays: boolean[],
  holidays: Date[]
): Date {
  return addWorkingDays(startDate, -workingDays, workDays, holidays);
}
