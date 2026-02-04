import ICAL from "ical.js";
import { db } from "./server/db";
import { cfmeuHolidays } from "./shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const VIC_OFFSITE_2025_URL = "https://vic.cfmeu.org/wp-content/uploads/2024/11/rdo-offsite-2025.ics";
const VIC_OFFSITE_2026_URL = "https://vic.cfmeu.org/wp-content/uploads/2025/11/38hr-offsite-rdo-calendar.ics";

async function syncCalendar(url: string, targetYears: number[]) {
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch: ${response.status}`);
    return 0;
  }
  const icsContent = await response.text();
  
  const jcalData = ICAL.parse(icsContent);
  const comp = new ICAL.Component(jcalData);
  const events = comp.getAllSubcomponents("vevent");
  
  let imported = 0;
  for (const event of events) {
    const icalEvent = new ICAL.Event(event);
    const dtstart = icalEvent.startDate;
    if (!dtstart) continue;
    
    const eventDate = dtstart.toJSDate();
    const eventYear = eventDate.getFullYear();
    
    if (!targetYears.includes(eventYear)) continue;
    
    const summary = icalEvent.summary || "Unnamed Holiday";
    const lowerSummary = summary.toLowerCase();
    
    let holidayType: "RDO" | "PUBLIC_HOLIDAY" | "OTHER" = "RDO";
    if (lowerSummary.includes("public holiday") || 
        lowerSummary.includes("australia day") || 
        lowerSummary.includes("anzac") ||
        lowerSummary.includes("christmas") ||
        lowerSummary.includes("good friday") ||
        lowerSummary.includes("easter") ||
        lowerSummary.includes("queen") ||
        lowerSummary.includes("king") ||
        lowerSummary.includes("labour day") ||
        lowerSummary.includes("melbourne cup") ||
        lowerSummary.includes("invasion day")) {
      holidayType = "PUBLIC_HOLIDAY";
    } else if (lowerSummary.includes("branch meeting") || lowerSummary.includes("school")) {
      holidayType = "OTHER";
    }
    
    try {
      await db.insert(cfmeuHolidays).values({
        calendarType: "VIC_OFFSITE",
        date: eventDate,
        name: summary,
        holidayType,
        year: eventYear,
      }).onConflictDoUpdate({
        target: [cfmeuHolidays.calendarType, cfmeuHolidays.date],
        set: { name: summary, holidayType, year: eventYear },
      });
      imported++;
      console.log(`  - ${eventDate.toISOString().split('T')[0]}: ${summary} (${holidayType})`);
    } catch(e: any) {
      console.log("Error inserting:", summary, e.message);
    }
  }
  return imported;
}

async function calculateJan2026WorkDays() {
  const holidays = await db.select()
    .from(cfmeuHolidays)
    .where(
      and(
        eq(cfmeuHolidays.calendarType, "VIC_OFFSITE"),
        gte(cfmeuHolidays.date, new Date("2026-01-01")),
        lte(cfmeuHolidays.date, new Date("2026-01-31"))
      )
    );
  
  const holidayDates = new Map<string, string>();
  for (const h of holidays) {
    const d = new Date(h.date);
    holidayDates.set(d.toISOString().split('T')[0], `${h.name} (${h.holidayType})`);
  }
  
  console.log("\n========================================================================");
  console.log("         JANUARY 2026 WORKING DAYS CALCULATION");
  console.log("========================================================================");
  console.log("Settings:");
  console.log("  - Work days: Monday to Saturday (6 days/week)");
  console.log("  - Regular day off: Sunday");
  console.log("  - Calendar: CFMEU VIC Off-Site (38hr)");
  console.log("========================================================================\n");
  
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let workDays = 0;
  let nonWorkDays = 0;
  
  for (let day = 1; day <= 31; day++) {
    const date = new Date(2026, 0, day);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const dayName = dayNames[dayOfWeek];
    
    let status = "";
    let isWorkDay = true;
    
    if (dayOfWeek === 0) {
      status = "NOT WORKING - Sunday (regular day off)";
      isWorkDay = false;
    } else if (holidayDates.has(dateStr)) {
      status = `NOT WORKING - ${holidayDates.get(dateStr)}`;
      isWorkDay = false;
    } else {
      status = "WORKING";
      workDays++;
    }
    
    if (!isWorkDay) nonWorkDays++;
    
    const emoji = isWorkDay ? "✓" : "✗";
    console.log(`${emoji} ${dateStr} (${dayName.padEnd(9)}): ${status}`);
  }
  
  console.log("\n========================================================================");
  console.log("                           SUMMARY");
  console.log("========================================================================");
  console.log(`Total days in January 2026: 31`);
  console.log(`Working days:     ${workDays}`);
  console.log(`Non-working days: ${nonWorkDays}`);
  console.log("========================================================================\n");
}

async function main() {
  console.log("Syncing CFMEU VIC Offsite calendars...\n");
  const imported2025 = await syncCalendar(VIC_OFFSITE_2025_URL, [2025]);
  const imported2026 = await syncCalendar(VIC_OFFSITE_2026_URL, [2026]);
  console.log(`\nTotal imported: ${imported2025 + imported2026} holidays`);
  
  await calculateJan2026WorkDays();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
