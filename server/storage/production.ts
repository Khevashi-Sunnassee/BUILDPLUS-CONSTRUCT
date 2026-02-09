import { eq, and, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import { getFactoryWorkDays, getCfmeuHolidaysInRange, addWorkingDays, subtractWorkingDays } from "./utils";
import {
  productionEntries, productionDays, productionSlots, productionSlotAdjustments,
  panelRegister, jobs, users, jobLevelCycleTimes, factories,
  type ProductionEntry, type InsertProductionEntry,
  type ProductionDay, type InsertProductionDay,
  type ProductionSlot, type InsertProductionSlot,
  type PanelRegister, type Job, type User,
  type JobLevelCycleTime,
} from "@shared/schema";
import type { ProductionSlotWithDetails, ProductionSlotAdjustmentWithDetails } from "./types";

function generateLevelRange(lowestLevel: string, highestLevel: string): string[] {
  const levels: string[] = [];
  
  const lowMatch = lowestLevel.match(/^L?(\d+)$/i);
  const highMatch = highestLevel.match(/^L?(\d+)$/i);
  
  if (lowMatch && highMatch) {
    const lowNum = parseInt(lowMatch[1], 10);
    const highNum = parseInt(highMatch[1], 10);
    
    const useLPrefix = lowestLevel.toLowerCase().startsWith('l') || highestLevel.toLowerCase().startsWith('l');
    
    for (let i = lowNum; i <= highNum; i++) {
      levels.push(useLPrefix ? `L${i}` : String(i));
    }
    return levels;
  }
  
  const specialLevels = ["Basement 2", "B2", "Basement 1", "B1", "Basement", "Ground", "G", "GF", "Mezzanine", "Mezz"];
  const lowIdx = specialLevels.findIndex(l => l.toLowerCase() === lowestLevel.toLowerCase());
  const highIdx = specialLevels.findIndex(l => l.toLowerCase() === highestLevel.toLowerCase());
  
  if (lowIdx !== -1 && highIdx !== -1 && lowIdx <= highIdx) {
    return specialLevels.slice(lowIdx, highIdx + 1);
  }
  
  if (lowestLevel === highestLevel) {
    return [lowestLevel];
  }
  return [lowestLevel, highestLevel];
}

function sortLevelsIntelligently(levels: string[], lowestLevel?: string | null, highestLevel?: string | null): string[] {
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

  return [...levels].sort((a, b) => parseLevelNumber(a) - parseLevelNumber(b));
}

export const productionMethods = {
  async getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .where(eq(productionEntries.id, id));
    if (!result.length) return undefined;
    return { ...result[0].production_entries, panel: result[0].panel_register, job: result[0].jobs };
  },

  async getProductionEntriesByDate(date: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(eq(productionEntries.productionDate, date))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  },

  async getProductionEntriesInRange(startDate: string, endDate: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        gte(productionEntries.productionDate, startDate),
        lte(productionEntries.productionDate, endDate)
      ))
      .orderBy(asc(productionEntries.productionDate), asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  },

  async createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry> {
    const [entry] = await db.insert(productionEntries).values(data).returning();
    return entry;
  },

  async updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined> {
    const [entry] = await db.update(productionEntries).set({ ...data, updatedAt: new Date() }).where(eq(productionEntries.id, id)).returning();
    return entry;
  },

  async deleteProductionEntry(id: string): Promise<void> {
    await db.delete(productionEntries).where(eq(productionEntries.id, id));
  },

  async getProductionEntryByPanelId(panelId: string): Promise<ProductionEntry | undefined> {
    const [entry] = await db.select().from(productionEntries)
      .where(eq(productionEntries.panelId, panelId))
      .limit(1);
    return entry;
  },

  async getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .orderBy(desc(productionEntries.productionDate), asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  },

  async getProductionSummaryByDate(date: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]> {
    const entries = await productionMethods.getProductionEntriesByDate(date);
    const summary: Record<string, { count: number; totalVolumeM3: number; totalAreaM2: number }> = {};
    
    for (const entry of entries) {
      const panelType = entry.panel.panelType || "OTHER";
      if (!summary[panelType]) {
        summary[panelType] = { count: 0, totalVolumeM3: 0, totalAreaM2: 0 };
      }
      summary[panelType].count++;
      summary[panelType].totalVolumeM3 += parseFloat(entry.volumeM3 || "0");
      summary[panelType].totalAreaM2 += parseFloat(entry.areaM2 || "0");
    }
    
    return Object.entries(summary).map(([panelType, data]) => ({ panelType, ...data }));
  },

  async getProductionEntriesByDateAndFactory(date: string, factory: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factory, factory)
      ))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  },

  async getProductionEntriesByDateAndFactoryId(date: string, factoryId: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factoryId, factoryId)
      ))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  },

  async getProductionDays(startDate: string, endDate: string): Promise<ProductionDay[]> {
    return await db.select().from(productionDays)
      .where(and(
        gte(productionDays.productionDate, startDate),
        lte(productionDays.productionDate, endDate)
      ))
      .orderBy(desc(productionDays.productionDate), asc(productionDays.factory));
  },

  async getProductionDay(date: string, factory: string): Promise<ProductionDay | undefined> {
    const [day] = await db.select().from(productionDays)
      .where(and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factory, factory)
      ));
    return day;
  },

  async getProductionDayByFactoryId(date: string, factoryId: string): Promise<ProductionDay | undefined> {
    const [day] = await db.select().from(productionDays)
      .where(and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factoryId, factoryId)
      ));
    return day;
  },

  async createProductionDay(data: InsertProductionDay): Promise<ProductionDay> {
    const [day] = await db.insert(productionDays).values(data).returning();
    return day;
  },

  async deleteProductionDay(id: string): Promise<void> {
    await db.delete(productionDays).where(eq(productionDays.id, id));
  },

  async deleteProductionDayByDateAndFactory(date: string, factory: string): Promise<void> {
    await db.delete(productionEntries).where(
      and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factory, factory)
      )
    );
    await db.delete(productionDays).where(
      and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factory, factory)
      )
    );
  },

  async deleteProductionDayByDateAndFactoryId(date: string, factoryId: string): Promise<void> {
    await db.delete(productionEntries).where(
      and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factoryId, factoryId)
      )
    );
    await db.delete(productionDays).where(
      and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factoryId, factoryId)
      )
    );
  },

  async getProductionSlots(filters?: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<ProductionSlotWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.jobId) conditions.push(eq(productionSlots.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(productionSlots.status, filters.status as typeof productionSlots.status.enumValues[number]));
    if (filters?.dateFrom) conditions.push(gte(productionSlots.productionSlotDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(productionSlots.productionSlotDate, filters.dateTo));
    
    if (filters?.factoryIds && filters.factoryIds.length > 0) {
      conditions.push(inArray(jobs.factoryId, filters.factoryIds));
    }
    
    const query = db.select({
      productionSlot: productionSlots,
      job: jobs
    })
      .from(productionSlots)
      .innerJoin(jobs, eq(productionSlots.jobId, jobs.id))
      .orderBy(asc(productionSlots.productionSlotDate), asc(productionSlots.levelOrder));
    
    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    
    const jobIds = Array.from(new Set(results.map(r => r.job.id)));
    const levelCycleTimes = jobIds.length > 0 
      ? await db.select().from(jobLevelCycleTimes).where(inArray(jobLevelCycleTimes.jobId, jobIds))
      : [];
    
    const cycleTimeMap = new Map<string, number>();
    for (const ct of levelCycleTimes) {
      cycleTimeMap.set(`${ct.jobId}-${ct.level}`, ct.cycleDays);
    }
    
    return results.map(r => {
      const levelCycleTime = cycleTimeMap.get(`${r.job.id}-${r.productionSlot.level}`);
      return { 
        ...r.productionSlot, 
        job: r.job,
        levelCycleTime: levelCycleTime ?? null
      };
    });
  },

  async getProductionSlot(id: string): Promise<ProductionSlotWithDetails | undefined> {
    const [slot] = await db.select().from(productionSlots).where(eq(productionSlots.id, id));
    if (!slot) return undefined;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, slot.jobId));
    if (!job) return undefined;
    return { ...slot, job };
  },

  async checkPanelLevelCoverage(jobId: string): Promise<{ jobLevels: number; panelLevels: number; highestJobLevel: string; highestPanelLevel: string; hasMismatch: boolean; emptyLevels: string[] }> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error("Job not found");
    
    let jobLevelList: string[] = [];
    if (job.lowestLevel && job.highestLevel) {
      jobLevelList = generateLevelRange(job.lowestLevel, job.highestLevel);
    } else if (job.levels) {
      jobLevelList = job.levels.split(",").map(l => l.trim()).filter(l => l);
    }
    
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, jobId));
    const panelLevelSet = new Set<string>();
    for (const panel of panels) {
      if (panel.level) {
        panelLevelSet.add(panel.level);
      }
    }
    const panelLevels = Array.from(panelLevelSet);
    
    const sortedJobLevels = sortLevelsIntelligently(jobLevelList, job.lowestLevel, job.highestLevel);
    const sortedPanelLevels = sortLevelsIntelligently(panelLevels);
    
    const emptyLevels = sortedJobLevels.filter(level => !panelLevelSet.has(level));
    
    const highestJobLevel = sortedJobLevels.length > 0 ? sortedJobLevels[sortedJobLevels.length - 1] : "";
    const highestPanelLevel = sortedPanelLevels.length > 0 ? sortedPanelLevels[sortedPanelLevels.length - 1] : "";
    
    const hasMismatch = emptyLevels.length > 0 && sortedPanelLevels.length > 0;
    
    return {
      jobLevels: sortedJobLevels.length,
      panelLevels: sortedPanelLevels.length,
      highestJobLevel,
      highestPanelLevel,
      hasMismatch,
      emptyLevels
    };
  },

  async generateProductionSlotsForJob(jobId: string, skipEmptyLevels: boolean = false): Promise<ProductionSlot[]> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error("Job not found");
    if (!job.productionStartDate || !job.expectedCycleTimePerFloor) {
      throw new Error("Job missing required fields: productionStartDate or expectedCycleTimePerFloor");
    }
    
    let levelList: string[] = [];
    
    if (job.lowestLevel && job.highestLevel) {
      levelList = generateLevelRange(job.lowestLevel, job.highestLevel);
    } else if (job.levels) {
      levelList = job.levels.split(",").map(l => l.trim()).filter(l => l);
    }
    
    if (levelList.length === 0) {
      throw new Error("Job must have either lowestLevel/highestLevel or levels defined");
    }

    await db.delete(productionSlots).where(eq(productionSlots.jobId, jobId));

    const sortedLevels = sortLevelsIntelligently(levelList, job.lowestLevel, job.highestLevel);

    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, jobId));
    const panelCountByLevel: Record<string, number> = {};
    for (const panel of panels) {
      const level = panel.level || "Unknown";
      panelCountByLevel[level] = (panelCountByLevel[level] || 0) + 1;
    }
    
    const levelsToProcess = skipEmptyLevels 
      ? sortedLevels.filter(level => (panelCountByLevel[level] || 0) > 0)
      : sortedLevels;

    const levelCycleTimesData = await productionMethods.getJobLevelCycleTimes(jobId);
    const cycleTimeMap = new Map<string, number>(
      levelCycleTimesData.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays])
    );
    const defaultCycleTime = job.expectedCycleTimePerFloor;

    const workDays = await getFactoryWorkDays(job.factoryId);
    
    let cfmeuCalendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null = null;
    if (job.factoryId) {
      const [factory] = await db.select().from(factories).where(eq(factories.id, job.factoryId));
      if (factory?.cfmeuCalendar) {
        cfmeuCalendarType = factory.cfmeuCalendar;
      }
    }
    
    const onsiteStartBaseDate = new Date(job.productionStartDate);
    const holidayRangeStart = new Date(onsiteStartBaseDate);
    holidayRangeStart.setFullYear(holidayRangeStart.getFullYear() - 2);
    const holidayRangeEnd = new Date(onsiteStartBaseDate);
    holidayRangeEnd.setFullYear(holidayRangeEnd.getFullYear() + 2);
    
    const holidays = await getCfmeuHolidaysInRange(cfmeuCalendarType, holidayRangeStart, holidayRangeEnd);

    const productionDaysInAdvance = job.productionDaysInAdvance ?? 10;

    const createdSlots: ProductionSlot[] = [];
    let cumulativeWorkingDays = 0;
    
    for (let i = 0; i < levelsToProcess.length; i++) {
      const level = levelsToProcess[i];
      
      const onsiteDate = addWorkingDays(onsiteStartBaseDate, cumulativeWorkingDays, workDays, holidays);
      
      const panelProductionDue = subtractWorkingDays(onsiteDate, productionDaysInAdvance, workDays, holidays);
      
      const levelCycleTime = cycleTimeMap.get(`1-${level}`) ?? defaultCycleTime;

      const [slot] = await db.insert(productionSlots).values({
        jobId,
        buildingNumber: 1,
        level,
        levelOrder: i,
        panelCount: panelCountByLevel[level] || 0,
        productionSlotDate: panelProductionDue,
        status: "SCHEDULED",
        isBooked: false,
      }).returning();
      createdSlots.push(slot);
      
      cumulativeWorkingDays += levelCycleTime;
    }
    return createdSlots;
  },

  async adjustProductionSlot(id: string, data: { newDate: Date; reason: string; changedById: string; clientConfirmed?: boolean; cascadeToLater?: boolean }): Promise<ProductionSlot | undefined> {
    const [slot] = await db.select().from(productionSlots).where(eq(productionSlots.id, id));
    if (!slot) return undefined;

    const previousDate = slot.productionSlotDate;
    const dateDiff = data.newDate.getTime() - previousDate.getTime();
    const daysDiff = Math.round(dateDiff / (1000 * 60 * 60 * 24));

    await db.insert(productionSlotAdjustments).values({
      productionSlotId: id,
      previousDate,
      newDate: data.newDate,
      reason: data.reason,
      changedById: data.changedById,
      clientConfirmed: data.clientConfirmed || false,
      cascadedToOtherSlots: data.cascadeToLater || false,
    });

    const [updatedSlot] = await db.update(productionSlots).set({
      productionSlotDate: data.newDate,
      status: "PENDING_UPDATE",
      updatedAt: new Date(),
    }).where(eq(productionSlots.id, id)).returning();

    if (data.cascadeToLater && daysDiff !== 0) {
      const laterSlots = await db.select().from(productionSlots)
        .where(and(
          eq(productionSlots.jobId, slot.jobId),
          gte(productionSlots.levelOrder, slot.levelOrder),
          sql`${productionSlots.id} != ${id}`
        ));
      
      for (const laterSlot of laterSlots) {
        const newLaterDate = new Date(laterSlot.productionSlotDate);
        newLaterDate.setTime(newLaterDate.getTime() + dateDiff);
        
        await db.insert(productionSlotAdjustments).values({
          productionSlotId: laterSlot.id,
          previousDate: laterSlot.productionSlotDate,
          newDate: newLaterDate,
          reason: `Cascaded from ${slot.level} adjustment: ${data.reason}`,
          changedById: data.changedById,
          clientConfirmed: data.clientConfirmed || false,
          cascadedToOtherSlots: true,
        });

        await db.update(productionSlots).set({
          productionSlotDate: newLaterDate,
          status: "PENDING_UPDATE",
          updatedAt: new Date(),
        }).where(eq(productionSlots.id, laterSlot.id));
      }
    }

    return updatedSlot;
  },

  async bookProductionSlot(id: string): Promise<ProductionSlot | undefined> {
    const [slot] = await db.update(productionSlots).set({
      status: "BOOKED",
      isBooked: true,
      updatedAt: new Date(),
    }).where(eq(productionSlots.id, id)).returning();
    return slot;
  },

  async completeProductionSlot(id: string): Promise<ProductionSlot | undefined> {
    const [slot] = await db.update(productionSlots).set({
      status: "COMPLETED",
      updatedAt: new Date(),
    }).where(eq(productionSlots.id, id)).returning();
    return slot;
  },

  async getProductionSlotAdjustments(slotId: string): Promise<ProductionSlotAdjustmentWithDetails[]> {
    const adjustments = await db.select().from(productionSlotAdjustments)
      .where(eq(productionSlotAdjustments.productionSlotId, slotId))
      .orderBy(desc(productionSlotAdjustments.createdAt));
    
    const adjustmentsWithDetails: ProductionSlotAdjustmentWithDetails[] = [];
    for (const adj of adjustments) {
      const [changedBy] = await db.select().from(users).where(eq(users.id, adj.changedById));
      if (changedBy) {
        adjustmentsWithDetails.push({ ...adj, changedBy });
      }
    }
    return adjustmentsWithDetails;
  },

  async getJobsWithoutProductionSlots(): Promise<Job[]> {
    const jobsWithSlots = await db.selectDistinct({ jobId: productionSlots.jobId }).from(productionSlots);
    const jobIdsWithSlots = jobsWithSlots.map(j => j.jobId);
    
    if (jobIdsWithSlots.length === 0) {
      return db.select().from(jobs)
        .where(and(
          eq(jobs.status, "ACTIVE"),
          sql`${jobs.productionStartDate} IS NOT NULL`,
          sql`${jobs.expectedCycleTimePerFloor} IS NOT NULL`,
          sql`${jobs.levels} IS NOT NULL`
        ))
        .orderBy(asc(jobs.jobNumber));
    }
    
    return db.select().from(jobs)
      .where(and(
        eq(jobs.status, "ACTIVE"),
        sql`${jobs.productionStartDate} IS NOT NULL`,
        sql`${jobs.expectedCycleTimePerFloor} IS NOT NULL`,
        sql`${jobs.levels} IS NOT NULL`,
        sql`${jobs.id} NOT IN (${sql.join(jobIdsWithSlots.map(id => sql`${id}`), sql`, `)})`
      ))
      .orderBy(asc(jobs.jobNumber));
  },

  async deleteProductionSlot(id: string): Promise<void> {
    await db.delete(productionSlotAdjustments).where(eq(productionSlotAdjustments.productionSlotId, id));
    await db.delete(productionSlots).where(eq(productionSlots.id, id));
  },

  async checkAndCompleteSlotByPanelCompletion(jobId: string, level: string, buildingNumber: number): Promise<void> {
    const panels = await db.select().from(panelRegister).where(and(
      eq(panelRegister.jobId, jobId),
      eq(panelRegister.level, level),
      eq(panelRegister.building, String(buildingNumber))
    ));

    const allCompleted = panels.length > 0 && panels.every(p => p.status === "COMPLETED");
    
    if (allCompleted) {
      const [slot] = await db.select().from(productionSlots).where(and(
        eq(productionSlots.jobId, jobId),
        eq(productionSlots.level, level),
        eq(productionSlots.buildingNumber, buildingNumber)
      ));
      
      if (slot && slot.status !== "COMPLETED") {
        await db.update(productionSlots).set({
          status: "COMPLETED",
          updatedAt: new Date(),
        }).where(eq(productionSlots.id, slot.id));
      }
    }
  },

  async getJobLevelCycleTimes(jobId: string): Promise<JobLevelCycleTime[]> {
    return db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder), asc(jobLevelCycleTimes.buildingNumber), asc(jobLevelCycleTimes.levelOrder));
  },

  async saveJobLevelCycleTimes(jobId: string, cycleTimes: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[]): Promise<void> {
    await db.delete(jobLevelCycleTimes).where(eq(jobLevelCycleTimes.jobId, jobId));
    
    if (cycleTimes.length > 0) {
      await db.insert(jobLevelCycleTimes).values(
        cycleTimes.map((ct, idx) => ({
          jobId,
          buildingNumber: ct.buildingNumber,
          level: ct.level,
          levelOrder: ct.levelOrder,
          sequenceOrder: idx,
          cycleDays: ct.cycleDays,
        }))
      );
    }
  },

  async getJobLevelCycleTime(jobId: string, buildingNumber: number, level: string): Promise<JobLevelCycleTime | null> {
    const [result] = await db.select().from(jobLevelCycleTimes)
      .where(and(
        eq(jobLevelCycleTimes.jobId, jobId),
        eq(jobLevelCycleTimes.buildingNumber, buildingNumber),
        eq(jobLevelCycleTimes.level, level)
      ));
    return result || null;
  },

  async getJobProgramme(jobId: string): Promise<JobLevelCycleTime[]> {
    return db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder));
  },

  async saveJobProgramme(jobId: string, entries: {
    id?: string;
    buildingNumber: number;
    level: string;
    levelOrder: number;
    pourLabel?: string | null;
    sequenceOrder: number;
    cycleDays: number;
    estimatedStartDate?: Date | null;
    estimatedEndDate?: Date | null;
    manualStartDate?: Date | null;
    manualEndDate?: Date | null;
    notes?: string | null;
  }[]): Promise<JobLevelCycleTime[]> {
    await db.delete(jobLevelCycleTimes).where(eq(jobLevelCycleTimes.jobId, jobId));
    
    if (entries.length === 0) return [];

    const result = await db.insert(jobLevelCycleTimes).values(
      entries.map(entry => ({
        jobId,
        buildingNumber: entry.buildingNumber,
        level: entry.level,
        levelOrder: entry.levelOrder,
        pourLabel: entry.pourLabel || null,
        sequenceOrder: entry.sequenceOrder,
        cycleDays: entry.cycleDays,
        estimatedStartDate: entry.estimatedStartDate || null,
        estimatedEndDate: entry.estimatedEndDate || null,
        manualStartDate: entry.manualStartDate || null,
        manualEndDate: entry.manualEndDate || null,
        notes: entry.notes || null,
      }))
    ).returning();

    return result;
  },

  async splitProgrammeEntry(jobId: string, entryId: string): Promise<JobLevelCycleTime[]> {
    const entries = await db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder));

    const entryIndex = entries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) throw new Error("Programme entry not found");

    const entry = entries[entryIndex];

    const existingSplits = entries.filter(e => e.level === entry.level && e.buildingNumber === entry.buildingNumber);
    
    let newPourLabelA: string;
    let newPourLabelB: string;

    if (entry.pourLabel) {
      newPourLabelA = entry.pourLabel;
      const lastChar = entry.pourLabel.charCodeAt(entry.pourLabel.length - 1);
      newPourLabelB = entry.pourLabel.slice(0, -1) + String.fromCharCode(lastChar + 1);
    } else if (existingSplits.length === 1) {
      newPourLabelA = "A";
      newPourLabelB = "B";
    } else {
      const usedLabels = existingSplits.map(e => e.pourLabel).filter(Boolean).sort();
      const lastLabel = usedLabels.length > 0 ? usedLabels[usedLabels.length - 1]! : "A";
      newPourLabelA = entry.pourLabel || lastLabel;
      newPourLabelB = String.fromCharCode(lastLabel.charCodeAt(0) + 1);
    }

    const halfCycleDays = Math.max(1, Math.ceil(entry.cycleDays / 2));

    const newEntries = [...entries];
    newEntries[entryIndex] = { ...entry, pourLabel: newPourLabelA, cycleDays: halfCycleDays };
    newEntries.splice(entryIndex + 1, 0, {
      ...entry,
      id: '',
      pourLabel: newPourLabelB,
      cycleDays: halfCycleDays,
      estimatedStartDate: null,
      estimatedEndDate: null,
      manualStartDate: null,
      manualEndDate: null,
    });

    const resequenced = newEntries.map((e, idx) => ({ ...e, sequenceOrder: idx }));

    await db.delete(jobLevelCycleTimes).where(eq(jobLevelCycleTimes.jobId, jobId));
    
    const result = await db.insert(jobLevelCycleTimes).values(
      resequenced.map(e => ({
        jobId,
        buildingNumber: e.buildingNumber,
        level: e.level,
        levelOrder: e.levelOrder,
        pourLabel: e.pourLabel || null,
        sequenceOrder: e.sequenceOrder,
        cycleDays: e.cycleDays,
        estimatedStartDate: e.estimatedStartDate || null,
        estimatedEndDate: e.estimatedEndDate || null,
        manualStartDate: e.manualStartDate || null,
        manualEndDate: e.manualEndDate || null,
        notes: e.notes || null,
      }))
    ).returning();

    return result.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  },

  async reorderProgramme(jobId: string, orderedIds: string[]): Promise<JobLevelCycleTime[]> {
    const entries = await db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId));

    const entryMap = new Map(entries.map(e => [e.id, e]));

    for (let i = 0; i < orderedIds.length; i++) {
      const entry = entryMap.get(orderedIds[i]);
      if (entry) {
        await db.update(jobLevelCycleTimes)
          .set({ sequenceOrder: i, updatedAt: new Date() })
          .where(eq(jobLevelCycleTimes.id, orderedIds[i]));
      }
    }

    return db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder));
  },

  async deleteProgrammeEntry(jobId: string, entryId: string): Promise<JobLevelCycleTime[]> {
    await db.delete(jobLevelCycleTimes).where(
      and(eq(jobLevelCycleTimes.id, entryId), eq(jobLevelCycleTimes.jobId, jobId))
    );
    
    const remaining = await db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder));

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sequenceOrder !== i) {
        await db.update(jobLevelCycleTimes)
          .set({ sequenceOrder: i, updatedAt: new Date() })
          .where(eq(jobLevelCycleTimes.id, remaining[i].id));
      }
    }

    return db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.sequenceOrder));
  },
};
