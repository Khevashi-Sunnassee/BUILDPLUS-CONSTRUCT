import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { storage, db, getFactoryWorkDays, getCfmeuHolidaysInRange, isWorkingDay, subtractWorkingDays, addWorkingDays } from "../../storage";
import { factories, jobLevelCycleTimes } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { logJobChange } from "../../services/job-audit.service";

const router = Router();

router.get("/api/admin/jobs/:id/generate-levels", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (!job.lowestLevel || !job.highestLevel) {
      return res.status(400).json({ error: "Job must have lowest and highest level configured to generate levels" });
    }

    const numberOfBuildings = job.numberOfBuildings || 1;
    const defaultCycleDays = job.expectedCycleTimePerFloor || 5;

    const lowMatch = job.lowestLevel.match(/^L?(\d+)$/i);
    const highMatch = job.highestLevel.match(/^L?(\d+)$/i);

    const levelOrder: Record<string, number> = {
      "Basement 2": -2, "B2": -2,
      "Basement 1": -1, "B1": -1, "Basement": -1,
      "Ground": 0, "G": 0, "GF": 0,
      "Mezzanine": 0.5, "Mezz": 0.5,
    };

    let levels: string[] = [];
    if (lowMatch && highMatch) {
      const lowNum = parseInt(lowMatch[1], 10);
      const highNum = parseInt(highMatch[1], 10);
      const useLPrefix = job.lowestLevel.toLowerCase().startsWith('l') || job.highestLevel.toLowerCase().startsWith('l');
      for (let i = lowNum; i <= highNum; i++) {
        levels.push(useLPrefix ? `L${i}` : String(i));
      }
    } else {
      const specialLevels = ["Basement 2", "B2", "Basement 1", "B1", "Basement", "Ground", "G", "GF", "Mezzanine", "Mezz"];
      const lowIdx = specialLevels.findIndex(l => l.toLowerCase() === job.lowestLevel!.toLowerCase());
      const highIdx = specialLevels.findIndex(l => l.toLowerCase() === job.highestLevel!.toLowerCase());
      if (lowIdx !== -1 && highIdx !== -1 && lowIdx <= highIdx) {
        levels = specialLevels.slice(lowIdx, highIdx + 1);
      } else if (job.lowestLevel === job.highestLevel) {
        levels = [job.lowestLevel];
      } else {
        levels = [job.lowestLevel, job.highestLevel];
      }
    }

    const result: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[] = [];
    for (let b = 1; b <= numberOfBuildings; b++) {
      levels.forEach((level, idx) => {
        const order = levelOrder[level] !== undefined ? levelOrder[level] : (lowMatch ? parseInt(level.replace(/^L/i, ''), 10) : idx);
        result.push({
          buildingNumber: b,
          level,
          levelOrder: order,
          cycleDays: defaultCycleDays,
        });
      });
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating levels from settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate levels" });
  }
});

router.get("/api/admin/jobs/:id/build-levels", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const panels = await storage.getPanelsByJob(String(req.params.id));
    const defaultCycleDays = job.expectedCycleTimePerFloor || 5;

    const levelOrder: Record<string, number> = {
      "Basement 2": -2, "B2": -2,
      "Basement 1": -1, "B1": -1, "Basement": -1,
      "Ground": 0, "G": 0, "GF": 0,
      "Mezzanine": 0.5, "Mezz": 0.5,
    };

    const parseLevelNumber = (level: string): number => {
      if (levelOrder[level] !== undefined) return levelOrder[level];
      const match = level.match(/^L?(\d+)$/i);
      if (match) return parseInt(match[1], 10);
      if (level.toLowerCase() === "roof") return 999;
      return 500;
    };

    const existingCycleTimes = await storage.getJobLevelCycleTimes(String(req.params.id));
    const existingMap = new Map(existingCycleTimes.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays]));

    const uniqueLevels = new Map<string, { buildingNumber: number; level: string }>();
    for (const panel of panels) {
      const level = panel.level || "Unknown";
      const building = parseInt(panel.building || "1", 10) || 1;
      const key = `${building}-${level}`;
      if (!uniqueLevels.has(key)) {
        uniqueLevels.set(key, { buildingNumber: building, level });
      }
    }

    const result = Array.from(uniqueLevels.values())
      .sort((a, b) => {
        if (a.buildingNumber !== b.buildingNumber) return a.buildingNumber - b.buildingNumber;
        return parseLevelNumber(a.level) - parseLevelNumber(b.level);
      })
      .map(item => ({
        buildingNumber: item.buildingNumber,
        level: item.level,
        levelOrder: parseLevelNumber(item.level),
        cycleDays: existingMap.get(`${item.buildingNumber}-${item.level}`) || defaultCycleDays,
      }));

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error building levels from panels");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build levels from panels" });
  }
});

router.get("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const cycleTimes = await storage.getJobLevelCycleTimes(req.params.id as string);
    res.json(cycleTimes);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get level cycle times" });
  }
});

router.post("/api/admin/jobs/:id/level-cycle-times", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(req.params.id as string);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const cycleTimeSchema = z.object({
      buildingNumber: z.number().int().min(1),
      level: z.string().min(1),
      levelOrder: z.number().min(0),
      cycleDays: z.number().int().min(1),
    });
    
    const bodySchema = z.object({
      cycleTimes: z.array(cycleTimeSchema),
    });
    
    const parseResult = bodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid cycle times data", details: parseResult.error.format() });
    }
    
    await storage.saveJobLevelCycleTimes(req.params.id as string, parseResult.data.cycleTimes);
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save level cycle times" });
  }
});

router.get("/api/admin/jobs/:id/programme", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const programme = await storage.getJobProgramme(String(req.params.id));
    res.json(programme);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting job programme");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get job programme" });
  }
});

router.patch("/api/admin/jobs/:id/programme/:entryId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const updateSchema = z.object({
      cycleDays: z.number().int().min(1).optional(),
      predecessorSequenceOrder: z.number().int().nullable().optional(),
      relationship: z.enum(["FS", "SS", "FF", "SF"]).nullable().optional(),
      manualStartDate: z.string().nullable().optional(),
      manualEndDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    });

    const parseResult = updateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid update data", details: parseResult.error.format() });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parseResult.data.cycleDays !== undefined) updateData.cycleDays = parseResult.data.cycleDays;
    if (parseResult.data.predecessorSequenceOrder !== undefined) {
      updateData.predecessorSequenceOrder = parseResult.data.predecessorSequenceOrder;
      if (parseResult.data.predecessorSequenceOrder === null) {
        updateData.relationship = null;
      }
    }
    if (parseResult.data.relationship !== undefined) {
      updateData.relationship = parseResult.data.relationship;
    }
    if (parseResult.data.manualStartDate !== undefined) {
      updateData.manualStartDate = parseResult.data.manualStartDate ? new Date(parseResult.data.manualStartDate) : null;
    }
    if (parseResult.data.manualEndDate !== undefined) {
      updateData.manualEndDate = parseResult.data.manualEndDate ? new Date(parseResult.data.manualEndDate) : null;
    }
    if (parseResult.data.notes !== undefined) updateData.notes = parseResult.data.notes;

    const [existing] = await db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.id, String(req.params.entryId)))
      .limit(1);

    const [updated] = await db.update(jobLevelCycleTimes)
      .set(updateData)
      .where(eq(jobLevelCycleTimes.id, String(req.params.entryId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Programme entry not found" });
    }

    if (existing) {
      const changedFields: Record<string, { from: unknown; to: unknown }> = {};
      const trackKeys = ["cycleDays", "predecessorSequenceOrder", "relationship", "manualStartDate", "manualEndDate", "notes"];
      for (const key of trackKeys) {
        if (updateData[key] !== undefined) {
          const oldVal = (existing as Record<string, unknown>)[key];
          const newVal = updateData[key];
          const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "");
          const newStr = newVal instanceof Date ? newVal.toISOString() : String(newVal ?? "");
          if (oldStr !== newStr) {
            changedFields[key] = { from: oldVal ?? null, to: newVal ?? null };
          }
        }
      }
      if (Object.keys(changedFields).length > 0) {
        const entryLabel = existing.pourLabel ? `${existing.level} Pour ${existing.pourLabel}` : existing.level;
        const actionType = (changedFields.manualStartDate || changedFields.manualEndDate) ? "PROGRAMME_DATES_CHANGED" :
          (changedFields.predecessorSequenceOrder || changedFields.relationship) ? "PROGRAMME_PREDECESSOR_CHANGED" :
          "PROGRAMME_ENTRY_UPDATED";
        logJobChange(job.id, actionType, req.session?.userId || null, req.session?.name || null, {
          changedFields: { entryId: existing.id, entryLabel, ...changedFields },
        });
      }
    }

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating programme entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update programme entry" });
  }
});

router.post("/api/admin/jobs/:id/programme", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const entrySchema = z.object({
      id: z.string().optional(),
      buildingNumber: z.number().int().min(1),
      level: z.string().min(1),
      levelOrder: z.number(),
      pourLabel: z.string().nullable().optional(),
      sequenceOrder: z.number().int().min(0),
      cycleDays: z.number().int().min(1),
      predecessorSequenceOrder: z.number().int().nullable().optional(),
      relationship: z.enum(["FS", "SS", "FF", "SF"]).nullable().optional(),
      estimatedStartDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      estimatedEndDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      manualStartDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      manualEndDate: z.string().nullable().optional().refine(v => !v || !isNaN(Date.parse(v)), "Invalid date"),
      notes: z.string().nullable().optional(),
    });

    const bodySchema = z.object({ entries: z.array(entrySchema) });
    const parseResult = bodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid programme data", details: parseResult.error.format() });
    }

    const entries = parseResult.data.entries.map(e => ({
      ...e,
      predecessorSequenceOrder: e.predecessorSequenceOrder ?? null,
      relationship: e.predecessorSequenceOrder != null ? (e.relationship || "FS") : null,
      estimatedStartDate: e.estimatedStartDate ? new Date(e.estimatedStartDate) : null,
      estimatedEndDate: e.estimatedEndDate ? new Date(e.estimatedEndDate) : null,
      manualStartDate: e.manualStartDate ? new Date(e.manualStartDate) : null,
      manualEndDate: e.manualEndDate ? new Date(e.manualEndDate) : null,
    }));

    const result = await storage.saveJobProgramme(String(req.params.id), entries);
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error saving job programme");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save job programme" });
  }
});

router.post("/api/admin/jobs/:id/programme/split", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const { entryId } = z.object({ entryId: z.string() }).parse(req.body);
    const result = await storage.splitProgrammeEntry(String(req.params.id), entryId);

    logJobChange(job.id, "PROGRAMME_LEVEL_SPLIT", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entryId, newEntryCount: result.length },
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error splitting programme entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to split level" });
  }
});

router.post("/api/admin/jobs/:id/programme/reorder", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const { orderedIds } = z.object({ orderedIds: z.array(z.string()) }).parse(req.body);
    const result = await storage.reorderProgramme(String(req.params.id), orderedIds);

    logJobChange(job.id, "PROGRAMME_REORDERED", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entriesReordered: orderedIds.length },
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error reordering programme");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reorder programme" });
  }
});

router.post("/api/admin/jobs/:id/programme/recalculate", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (!job.productionStartDate) {
      return res.status(400).json({ error: "Job must have a production start date configured to calculate programme dates" });
    }

    const entries = await storage.getJobProgramme(String(req.params.id));
    if (entries.length === 0) {
      return res.json([]);
    }

    const factoryWorkDays = await getFactoryWorkDays(job.factoryId ?? null, req.companyId);
    const baseDate = new Date(job.productionStartDate);
    const rangeEnd = new Date(baseDate);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 5);

    let cfmeuCalendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null = null;
    if (job.factoryId) {
      const factoryData = await db.select().from(factories).where(eq(factories.id, job.factoryId)).limit(1);
      if (factoryData[0]?.cfmeuCalendar) {
        cfmeuCalendarType = factoryData[0].cfmeuCalendar;
      }
    }
    const holidays = await getCfmeuHolidaysInRange(cfmeuCalendarType, baseDate, rangeEnd);

    function ensureWorkDay(d: Date): Date {
      const result = new Date(d);
      while (!isWorkingDay(result, factoryWorkDays, holidays)) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    function nextWorkDay(d: Date): Date {
      const result = new Date(d);
      result.setDate(result.getDate() + 1);
      while (!isWorkingDay(result, factoryWorkDays, holidays)) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    function resolvePredecessorStart(
      predDates: { start: Date; end: Date },
      rel: string,
      cycleDays: number
    ): Date {
      let start: Date;
      switch (rel) {
        case "FS":
          start = nextWorkDay(predDates.end);
          break;
        case "SS":
          start = new Date(predDates.start);
          break;
        case "FF":
          start = subtractWorkingDays(new Date(predDates.end), cycleDays - 1, factoryWorkDays, holidays);
          break;
        case "SF":
          start = subtractWorkingDays(new Date(predDates.start), cycleDays - 1, factoryWorkDays, holidays);
          break;
        default:
          start = nextWorkDay(predDates.end);
      }
      return ensureWorkDay(start);
    }

    const projectStart = ensureWorkDay(new Date(job.productionStartDate));
    const resolvedDates = new Map<number, { start: Date; end: Date }>();

    const updatedEntries = entries.map((entry, idx) => {
      const cycleDays = entry.cycleDays || 1;
      const predOrder = entry.predecessorSequenceOrder;
      const rel = entry.relationship || "FS";
      let entryStart: Date;

      if (entry.manualStartDate) {
        entryStart = ensureWorkDay(new Date(entry.manualStartDate));
      } else if (predOrder != null && resolvedDates.has(predOrder)) {
        const predDates = resolvedDates.get(predOrder)!;
        entryStart = resolvePredecessorStart(predDates, rel, cycleDays);
      } else if (predOrder != null && !resolvedDates.has(predOrder)) {
        const prevEntry = idx > 0 ? resolvedDates.get(entries[idx - 1].sequenceOrder) : null;
        entryStart = prevEntry ? nextWorkDay(prevEntry.end) : new Date(projectStart);
        logger.warn({ entryId: entry.id, predOrder }, "Predecessor sequenceOrder not found, falling back");
      } else {
        const prevEntry = idx > 0 ? resolvedDates.get(entries[idx - 1].sequenceOrder) : null;
        entryStart = prevEntry ? nextWorkDay(prevEntry.end) : new Date(projectStart);
      }

      const entryEnd = entry.manualEndDate
        ? ensureWorkDay(new Date(entry.manualEndDate))
        : addWorkingDays(new Date(entryStart), cycleDays - 1, factoryWorkDays, holidays);

      resolvedDates.set(entry.sequenceOrder, { start: entryStart, end: entryEnd });

      return {
        ...entry,
        sequenceOrder: idx,
        estimatedStartDate: entryStart,
        estimatedEndDate: entryEnd,
      };
    });

    const result = await storage.saveJobProgramme(String(req.params.id), updatedEntries);

    logJobChange(job.id, "PROGRAMME_DATES_RECALCULATED", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entriesRecalculated: updatedEntries.length },
    });

    res.json(result.sort((a, b) => a.sequenceOrder - b.sequenceOrder));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error recalculating programme dates");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to recalculate dates" });
  }
});

router.delete("/api/admin/jobs/:id/programme/:entryId", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const job = await storage.getJob(String(req.params.id));
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const entryId = String(req.params.entryId);
    const result = await storage.deleteProgrammeEntry(String(req.params.id), entryId);

    logJobChange(job.id, "PROGRAMME_ENTRY_DELETED", req.session?.userId || null, req.session?.name || null, {
      changedFields: { entryId },
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting programme entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete programme entry" });
  }
});

export default router;
