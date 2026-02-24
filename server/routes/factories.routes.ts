import { Router } from "express";
import { db } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { factories, productionBeds, cfmeuHolidays, insertFactorySchema, insertProductionBedSchema } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import ICAL from "ical.js";
import logger from "../lib/logger";

const router = Router();

type CfmeuCalendarType = "VIC_ONSITE" | "VIC_OFFSITE" | "QLD";
const CFMEU_CALENDAR_URLS: Record<CfmeuCalendarType, { url: string; years: number[] }[]> = {
  VIC_ONSITE: [
    { url: "https://vic.cfmeu.org/wp-content/uploads/2024/11/rdo-onsite-2025.ics", years: [2025] },
    { url: "https://vic.cfmeu.org/wp-content/uploads/2025/11/36hr-onsite-rdo-calendar.ics", years: [2026] },
  ],
  VIC_OFFSITE: [
    { url: "https://vic.cfmeu.org/wp-content/uploads/2024/11/rdo-offsite-2025.ics", years: [2025] },
    { url: "https://vic.cfmeu.org/wp-content/uploads/2025/11/38hr-offsite-rdo-calendar.ics", years: [2026] },
  ],
  QLD: [],
};

async function parseIcsAndSaveHolidays(
  calendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD",
  icsContent: string,
  targetYears: number[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  try {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const events = comp.getAllSubcomponents("vevent");

    for (const event of events) {
      const icalEvent = new ICAL.Event(event);
      const dtstart = icalEvent.startDate;
      if (!dtstart) continue;

      const eventDate = dtstart.toJSDate();
      const eventYear = eventDate.getFullYear();

      if (!targetYears.includes(eventYear)) continue;

      const summary = icalEvent.summary || "Unnamed Holiday";
      
      let holidayType: "RDO" | "PUBLIC_HOLIDAY" | "OTHER" = "RDO";
      const lowerSummary = summary.toLowerCase();
      if (lowerSummary.includes("public holiday") || 
          lowerSummary.includes("australia day") || 
          lowerSummary.includes("anzac") ||
          lowerSummary.includes("christmas") ||
          lowerSummary.includes("good friday") ||
          lowerSummary.includes("easter") ||
          lowerSummary.includes("queen") ||
          lowerSummary.includes("king") ||
          lowerSummary.includes("labour day") ||
          lowerSummary.includes("melbourne cup")) {
        holidayType = "PUBLIC_HOLIDAY";
      } else if (lowerSummary.includes("branch meeting") || lowerSummary.includes("school")) {
        holidayType = "OTHER";
      }

      try {
        await db.insert(cfmeuHolidays).values({
          calendarType,
          date: eventDate,
          name: summary,
          holidayType,
          year: eventYear,
          companyId: "system",
        }).onConflictDoUpdate({
          target: [cfmeuHolidays.calendarType, cfmeuHolidays.date],
          set: {
            name: summary,
            holidayType,
            year: eventYear,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
      }
    }
  } catch (err) {
    logger.error({ err }, "Error parsing ICS");
    throw new Error("Failed to parse ICS file");
  }

  return { imported, skipped };
}

export async function syncAllCfmeuCalendars(): Promise<Record<string, { imported: number; skipped: number }>> {
  const results: Record<string, { imported: number; skipped: number }> = {};
  logger.info("[CFMEU] Starting automatic calendar sync...");

  for (const calendarType of Object.keys(CFMEU_CALENDAR_URLS) as CfmeuCalendarType[]) {
    const urls = CFMEU_CALENDAR_URLS[calendarType];
    let totalImported = 0;
    let totalSkipped = 0;

    for (const { url, years } of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          logger.error(`[CFMEU] Failed to fetch ${calendarType} from ${url}: ${response.status}`);
          continue;
        }
        const icsContent = await response.text();
        const result = await parseIcsAndSaveHolidays(calendarType, icsContent, years);
        totalImported += result.imported;
        totalSkipped += result.skipped;
      } catch (err) {
        logger.error({ err }, `[CFMEU] Error fetching ${calendarType}`);
      }
    }

    results[calendarType] = { imported: totalImported, skipped: totalSkipped };
    logger.info(`[CFMEU] Synced ${calendarType}: ${totalImported} holidays imported, ${totalSkipped} skipped`);
  }

  logger.info("[CFMEU] Automatic calendar sync complete");
  return results;
}

export function scheduleMonthlyCalendarSync() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const msUntilNextMonth = nextMonth.getTime() - now.getTime();

  logger.info(`[CFMEU] Next scheduled sync: ${nextMonth.toISOString()}`);

  setTimeout(async () => {
    try {
      await syncAllCfmeuCalendars();
    } catch (err) {
      logger.error({ err }, "[CFMEU] Scheduled sync failed");
    }
    scheduleMonthlyCalendarSync();
  }, msUntilNextMonth);
}

export function initializeCfmeuSync() {
  setTimeout(async () => {
    try {
      await syncAllCfmeuCalendars();
      scheduleMonthlyCalendarSync();
    } catch (err) {
      logger.error({ err }, "[CFMEU] Startup sync failed");
      scheduleMonthlyCalendarSync();
    }
  }, 5000);
}

router.get("/api/admin/factories", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allFactories = await db.select().from(factories).where(eq(factories.companyId, companyId)).orderBy(factories.name).limit(1000);
    res.json(allFactories);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching factories");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/factories", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const activeFactories = await db.select().from(factories).where(and(eq(factories.companyId, companyId), eq(factories.isActive, true))).orderBy(factories.name).limit(1000);
    res.json(activeFactories);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching factories");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/factories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const factoryId = String(req.params.id);
    const factory = await db.select().from(factories).where(and(eq(factories.id, factoryId), eq(factories.companyId, companyId!))).limit(1);
    if (factory.length === 0) {
      return res.status(404).json({ error: "Factory not found" });
    }
    const beds = await db.select().from(productionBeds).where(eq(productionBeds.factoryId, factoryId)).orderBy(productionBeds.name).limit(1000);
    res.json({ ...factory[0], beds });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching factory");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/factories", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const body = { ...req.body, companyId };
    if (body.latitude !== undefined && body.latitude !== null) {
      body.latitude = String(body.latitude);
    }
    if (body.longitude !== undefined && body.longitude !== null) {
      body.longitude = String(body.longitude);
    }
    const parsed = insertFactorySchema.parse(body);
    const [created] = await db.insert(factories).values(parsed).returning();
    res.json(created);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating factory");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/admin/factories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const { beds, ...factoryData } = req.body;
    const factoryId = String(req.params.id);
    if (factoryData.latitude !== undefined && factoryData.latitude !== null) {
      factoryData.latitude = String(factoryData.latitude);
    }
    if (factoryData.longitude !== undefined && factoryData.longitude !== null) {
      factoryData.longitude = String(factoryData.longitude);
    }
    const parsed = insertFactorySchema.partial().safeParse(factoryData);
    if (!parsed.success) {
      logger.error({ details: parsed.error.flatten() }, "Factory update validation failed");
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [updated] = await db.update(factories)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(factories.id, factoryId), eq(factories.companyId, companyId!)))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Factory not found" });
    }
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating factory");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/factories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const [deleted] = await db.delete(factories).where(and(eq(factories.id, String(req.params.id)), eq(factories.companyId, companyId!))).returning();
    if (!deleted) {
      return res.status(404).json({ error: "Factory not found" });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting factory");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/factories/:factoryId/beds", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const factory = await db.select().from(factories).where(and(eq(factories.id, String(req.params.factoryId)), eq(factories.companyId, companyId!))).limit(1);
    if (factory.length === 0) return res.status(404).json({ error: "Factory not found" });
    const beds = await db.select().from(productionBeds).where(eq(productionBeds.factoryId, String(req.params.factoryId))).orderBy(productionBeds.name).limit(1000);
    res.json(beds);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching production beds");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/factories/:factoryId/beds", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const factory = await db.select().from(factories).where(and(eq(factories.id, String(req.params.factoryId)), eq(factories.companyId, companyId!))).limit(1);
    if (factory.length === 0) return res.status(404).json({ error: "Factory not found" });
    const parsed = insertProductionBedSchema.parse({ ...req.body, factoryId: String(req.params.factoryId) });
    const [created] = await db.insert(productionBeds).values(parsed).returning();
    res.json(created);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating production bed");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/admin/factories/:factoryId/beds/:bedId", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const factory = await db.select().from(factories).where(and(eq(factories.id, String(req.params.factoryId)), eq(factories.companyId, companyId!))).limit(1);
    if (factory.length === 0) return res.status(404).json({ error: "Factory not found" });
    const parsed = insertProductionBedSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [updated] = await db.update(productionBeds)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(productionBeds.id, String(req.params.bedId)), eq(productionBeds.factoryId, String(req.params.factoryId))))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Production bed not found" });
    }
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating production bed");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/factories/:factoryId/beds/:bedId", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const factory = await db.select().from(factories).where(and(eq(factories.id, String(req.params.factoryId)), eq(factories.companyId, companyId!))).limit(1);
    if (factory.length === 0) return res.status(404).json({ error: "Factory not found" });
    const [deleted] = await db.delete(productionBeds)
      .where(and(eq(productionBeds.id, String(req.params.bedId)), eq(productionBeds.factoryId, String(req.params.factoryId))))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "Production bed not found" });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting production bed");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/cfmeu-holidays", requireAuth, async (req, res) => {
  try {
    const { calendarType, startDate, endDate } = req.query;
    
    if (!calendarType || !startDate || !endDate) {
      return res.status(400).json({ error: "calendarType, startDate, and endDate are required" });
    }
    
    if (!["VIC_ONSITE", "VIC_OFFSITE", "QLD"].includes(calendarType as string)) {
      return res.status(400).json({ error: "Invalid calendar type" });
    }
    
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const holidays = await db.select()
      .from(cfmeuHolidays)
      .where(
        and(
          eq(cfmeuHolidays.calendarType, calendarType as CfmeuCalendarType),
          gte(cfmeuHolidays.date, new Date(startDate as string)),
          lte(cfmeuHolidays.date, new Date(endDate as string))
        )
      )
      .orderBy(cfmeuHolidays.date)
      .limit(safeLimit);
    
    res.json(holidays);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching CFMEU holidays");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/cfmeu-calendars", requireRole("ADMIN"), async (req, res) => {
  try {
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const holidays = await db.select().from(cfmeuHolidays).orderBy(cfmeuHolidays.date).limit(safeLimit);
    
    const summary: Record<string, { count: number; years: number[] }> = {};
    for (const h of holidays) {
      if (!summary[h.calendarType]) {
        summary[h.calendarType] = { count: 0, years: [] };
      }
      summary[h.calendarType].count++;
      if (!summary[h.calendarType].years.includes(h.year)) {
        summary[h.calendarType].years.push(h.year);
      }
    }

    res.json({ holidays, summary });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching CFMEU calendars");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/cfmeu-calendars/sync", requireRole("ADMIN"), async (req, res) => {
  const { calendarType } = req.body;

  if (!calendarType || !["VIC_ONSITE", "VIC_OFFSITE", "QLD"].includes(calendarType)) {
    return res.status(400).json({ error: "Invalid calendar type" });
  }

  try {
    const urls = CFMEU_CALENDAR_URLS[calendarType as CfmeuCalendarType];
    let totalImported = 0;
    let totalSkipped = 0;

    for (const { url, years } of urls) {
      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`Failed to fetch ${url}: ${response.status}`);
        continue;
      }
      const icsContent = await response.text();
      const result = await parseIcsAndSaveHolidays(calendarType as CfmeuCalendarType, icsContent, years);
      totalImported += result.imported;
      totalSkipped += result.skipped;
    }

    res.json({ 
      success: true, 
      imported: totalImported, 
      skipped: totalSkipped,
      message: `Synced ${calendarType} calendar: ${totalImported} holidays imported`
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error syncing CFMEU calendar");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/cfmeu-calendars/sync-all", requireRole("ADMIN"), async (req, res) => {
  try {
    const results: Record<string, { imported: number; skipped: number }> = {};

    for (const calendarType of Object.keys(CFMEU_CALENDAR_URLS) as CfmeuCalendarType[]) {
      const urls = CFMEU_CALENDAR_URLS[calendarType];
      let totalImported = 0;
      let totalSkipped = 0;

      for (const { url, years } of urls) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            logger.error(`Failed to fetch ${url}: ${response.status}`);
            continue;
          }
          const icsContent = await response.text();
          const result = await parseIcsAndSaveHolidays(calendarType as CfmeuCalendarType, icsContent, years);
          totalImported += result.imported;
          totalSkipped += result.skipped;
        } catch (err) {
          logger.error({ err }, `Error fetching ${url}`);
        }
      }

      results[calendarType] = { imported: totalImported, skipped: totalSkipped };
    }

    res.json({ success: true, results });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error syncing all CFMEU calendars");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/cfmeu-calendars/:calendarType", requireRole("ADMIN"), async (req, res) => {
  const calendarType = String(req.params.calendarType);

  if (!["VIC_ONSITE", "VIC_OFFSITE", "QLD"].includes(calendarType)) {
    return res.status(400).json({ error: "Invalid calendar type" });
  }

  try {
    const result = await db.delete(cfmeuHolidays).where(eq(cfmeuHolidays.calendarType, calendarType as CfmeuCalendarType));
    res.json({ success: true, deleted: result.rowCount || 0 });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting CFMEU calendar");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/geocode", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.trim().length < 3) {
      return res.status(400).json({ error: "Query must be at least 3 characters" });
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=au&limit=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "BuildPlus-Ai-Management/1.0" },
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Geocoding service unavailable" });
    }
    const results = await response.json();
    if (results.length === 0) {
      return res.json({ lat: null, lon: null });
    }
    res.json({ lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error geocoding address");
    res.status(500).json({ error: "Failed to geocode address" });
  }
});

export const factoriesRouter = router;
