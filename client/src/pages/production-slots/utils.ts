import { startOfWeek, endOfWeek, addDays, getDay, format, parseISO } from "date-fns";
import type { CfmeuHoliday } from "@shared/schema";

export const getWeekBoundaries = (date: Date, weekStartDay: number) => {
  const weekStart = startOfWeek(date, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const weekEnd = endOfWeek(date, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  return { weekStart, weekEnd };
};

export const getWeekKey = (date: Date, weekStartDay: number) => {
  const { weekStart } = getWeekBoundaries(new Date(date), weekStartDay);
  return format(weekStart, "yyyy-MM-dd");
};

export const getWeekLabel = (weekStartStr: string) => {
  const weekStart = parseISO(weekStartStr);
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, "dd MMM")} - ${format(weekEnd, "dd MMM yyyy")}`;
};

export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 70%, 45%)`;
};

export const HOLIDAY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  RDO: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  PUBLIC_HOLIDAY: { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444" },
  OTHER: { bg: "#E0E7FF", text: "#3730A3", border: "#6366F1" },
};

export function addWorkingDays(
  startDate: Date, 
  workingDays: number, 
  factoryWorkDays: boolean[] | null, 
  holidays: CfmeuHoliday[]
): Date {
  const workDays = factoryWorkDays || [false, true, true, true, true, true, false];
  
  const holidayDates = new Set(
    holidays.map(h => format(new Date(h.date), "yyyy-MM-dd"))
  );
  
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  
  const startDayOfWeek = getDay(currentDate);
  const startDateStr = format(currentDate, "yyyy-MM-dd");
  if (workDays[startDayOfWeek] && !holidayDates.has(startDateStr)) {
    daysAdded = 1;
  }
  
  while (daysAdded < workingDays) {
    currentDate = addDays(currentDate, 1);
    const dayOfWeek = getDay(currentDate);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    
    if (workDays[dayOfWeek] && !holidayDates.has(dateStr)) {
      daysAdded++;
    }
  }
  
  return currentDate;
}
