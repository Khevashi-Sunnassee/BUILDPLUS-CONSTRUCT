import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import { logger } from "../lib/logger";
import { format } from "date-fns";
import { z } from "zod";
import { FactoryRepository } from "../repositories/factory.repository";

const router = Router();
const factoryRepository = new FactoryRepository();

const daysQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format"),
  factoryId: z.string().optional(),
  status: z.string().optional(),
});

interface PanelStats {
  draft: number;
  ifa: number;
  ifc: number;
  approved: number;
  scheduled: number;
  completed: number;
}

router.get("/api/production-schedule/stats", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string | undefined;
    const factoryId = req.query.factoryId as string | undefined;

    const panels = await storage.getAllPanelRegisterItems();
    
    let filteredPanels = panels;
    if (jobId) {
      filteredPanels = filteredPanels.filter(p => p.jobId === jobId);
    }
    if (factoryId) {
      filteredPanels = filteredPanels.filter(p => p.job.factoryId === factoryId);
    }

    const allEntries = await storage.getAllProductionEntries();
    const scheduledPanelIds = new Set(allEntries.filter(e => e.status === "PENDING").map(e => e.panelId));
    const completedPanelIds = new Set(allEntries.filter(e => e.status === "COMPLETED").map(e => e.panelId));

    const stats: PanelStats = {
      draft: 0,
      ifa: 0,
      ifc: 0,
      approved: 0,
      scheduled: 0,
      completed: 0,
    };

    for (const panel of filteredPanels) {
      if (completedPanelIds.has(panel.id)) {
        stats.completed++;
      } else if (scheduledPanelIds.has(panel.id)) {
        stats.scheduled++;
      } else {
        switch (panel.documentStatus) {
          case "DRAFT":
            stats.draft++;
            break;
          case "IFA":
            stats.ifa++;
            break;
          case "IFC":
            stats.ifc++;
            break;
          case "APPROVED":
            stats.approved++;
            break;
        }
      }
    }

    res.json(stats);
  } catch (error: unknown) {
    logger.error(`Error fetching production schedule stats: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch stats" });
  }
});

interface ReadyPanel {
  id: string;
  panelMark: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  level: string | null;
  documentStatus: string;
  productionWindowDate: string | null;
  dueDate: string | null;
  daysDue: number | null;
  isOverdue: boolean;
}

router.get("/api/production-schedule/ready-panels", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string | undefined;
    const factoryId = req.query.factoryId as string | undefined;
    const search = req.query.search as string | undefined;

    const panels = await storage.getAllPanelRegisterItems();
    const allEntries = await storage.getAllProductionEntries();
    const scheduledPanelIds = new Set(allEntries.map(e => e.panelId));
    
    let filteredPanels = panels.filter(p => 
      (p.documentStatus === "IFC" || p.documentStatus === "APPROVED") &&
      p.approvedForProduction === true &&
      (p.lifecycleStatus ?? 1) !== 0 &&
      !scheduledPanelIds.has(p.id)
    );
    
    if (jobId) {
      filteredPanels = filteredPanels.filter(p => p.jobId === jobId);
    }
    if (factoryId) {
      filteredPanels = filteredPanels.filter(p => p.job.factoryId === factoryId);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPanels = filteredPanels.filter(p =>
        p.panelMark.toLowerCase().includes(searchLower) ||
        p.job.jobNumber.toLowerCase().includes(searchLower) ||
        (p.job.name && p.job.name.toLowerCase().includes(searchLower))
      );
    }

    const draftingPrograms = await storage.getDraftingPrograms();
    const panelDraftingMap = new Map<string, any>();
    for (const dp of draftingPrograms) {
      panelDraftingMap.set(dp.panelId, dp);
    }

    const today = new Date();
    const readyPanels: ReadyPanel[] = filteredPanels.map(panel => {
      const drafting = panelDraftingMap.get(panel.id);
      let productionWindowDate: string | null = null;
      let dueDate: string | null = null;
      let daysDue: number | null = null;
      let isOverdue = false;

      if (drafting?.productionDate) {
        const prodDate = new Date(drafting.productionDate);
        productionWindowDate = format(prodDate, "yyyy-MM-dd");
        dueDate = format(prodDate, "yyyy-MM-dd");
        
        const diffTime = prodDate.getTime() - today.getTime();
        daysDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysDue < 0;
      } else if (drafting?.drawingDueDate) {
        const drawingDue = new Date(drafting.drawingDueDate);
        dueDate = format(drawingDue, "yyyy-MM-dd");
        
        const diffTime = drawingDue.getTime() - today.getTime();
        daysDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysDue < 0;
      }

      return {
        id: panel.id,
        panelMark: panel.panelMark,
        jobId: panel.jobId,
        jobNumber: panel.job.jobNumber,
        jobName: panel.job.name || "",
        level: panel.level,
        documentStatus: panel.documentStatus,
        productionWindowDate,
        dueDate,
        daysDue,
        isOverdue,
      };
    });

    readyPanels.sort((a, b) => {
      if (a.productionWindowDate && !b.productionWindowDate) return -1;
      if (!a.productionWindowDate && b.productionWindowDate) return 1;
      if (a.productionWindowDate && b.productionWindowDate) {
        return a.productionWindowDate.localeCompare(b.productionWindowDate);
      }
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.panelMark.localeCompare(b.panelMark);
    });

    res.json(readyPanels);
  } catch (error: unknown) {
    logger.error(`Error fetching ready panels: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch ready panels" });
  }
});

interface ScheduleProductionDay {
  date: string;
  factoryId: string | null;
  factoryName: string | null;
  panelCount: number;
  panels: {
    id: string;
    panelMark: string;
    jobNumber: string;
    status: string;
  }[];
}

router.get("/api/production-schedule/days", requireAuth, requirePermission("production_report"), async (req: Request, res: Response) => {
  try {
    const parseResult = daysQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors.map(e => e.message) 
      });
    }
    
    const { startDate, endDate, factoryId, status } = parseResult.data;

    const entries = await storage.getProductionEntriesInRange(startDate, endDate);
    
    const factories = await factoryRepository.getAllFactories();
    const factoryIdToName = new Map<string, string>();
    for (const factory of factories) {
      factoryIdToName.set(factory.id, factory.name);
    }

    let filteredEntries = entries;
    if (factoryId) {
      filteredEntries = filteredEntries.filter(e => e.factoryId === factoryId);
    }
    if (status) {
      filteredEntries = filteredEntries.filter(e => e.status === status);
    }

    const dayMap = new Map<string, ScheduleProductionDay>();

    for (const entry of filteredEntries) {
      const key = `${entry.productionDate}-${entry.factoryId || "no-factory"}`;
      
      if (!dayMap.has(key)) {
        const factoryName = entry.factoryId ? factoryIdToName.get(entry.factoryId) || null : null;
        dayMap.set(key, {
          date: entry.productionDate,
          factoryId: entry.factoryId,
          factoryName,
          panelCount: 0,
          panels: [],
        });
      }

      const day = dayMap.get(key)!;
      day.panelCount++;
      day.panels.push({
        id: entry.panelId,
        panelMark: entry.panel.panelMark,
        jobNumber: entry.job.jobNumber,
        status: entry.status,
      });
    }

    const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json(days);
  } catch (error: unknown) {
    logger.error(`Error fetching production days: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch production days" });
  }
});

const addPanelsSchema = z.object({
  panelIds: z.array(z.string()).min(1, "At least one panel ID is required"),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Production date must be in YYYY-MM-DD format"),
  factoryId: z.string().optional(),
});

router.post("/api/production-schedule/add-panels", requireAuth, requirePermission("production_report", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const parseResult = addPanelsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.errors.map(e => e.message) 
      });
    }
    
    const { panelIds, productionDate, factoryId } = parseResult.data;

    const userId = req.session.userId!;
    const created: string[] = [];
    const errors: string[] = [];

    for (const panelId of panelIds) {
      try {
        const panel = await storage.getPanelById(panelId);
        if (!panel) {
          errors.push(`Panel ${panelId} not found`);
          continue;
        }
        
        if (!panel.approvedForProduction) {
          errors.push(`Panel ${panel.panelMark} is not approved for production`);
          continue;
        }
        
        if (panel.documentStatus !== "APPROVED" && panel.documentStatus !== "IFC") {
          errors.push(`Panel ${panel.panelMark} document status must be IFC or Approved`);
          continue;
        }

        const existingEntry = await storage.getProductionEntryByPanelId(panelId);
        if (existingEntry) {
          errors.push(`Panel ${panel.panelMark} is already scheduled for ${existingEntry.productionDate}`);
          continue;
        }

        await storage.createProductionEntry({
          panelId,
          jobId: panel.jobId,
          userId,
          productionDate,
          factoryId: factoryId || null,
          status: "PENDING",
        });
        created.push(panelId);
      } catch (err: any) {
        errors.push(`Failed to add panel ${panelId}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    logger.error(`Error adding panels to production: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add panels" });
  }
});

export default router;
