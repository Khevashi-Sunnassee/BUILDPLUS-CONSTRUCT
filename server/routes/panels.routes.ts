import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { logPanelChange, advancePanelLifecycleIfLower, updatePanelLifecycleStatus } from "../services/panel-audit.service";
import { db } from "../db";
import { panelAuditLogs, panelRegister, logRows, timerSessions, loadListPanels, jobs, users, PANEL_LIFECYCLE_STATUS } from "@shared/schema";
import { eq, desc, inArray, sql, and } from "drizzle-orm";
import { z } from "zod";
import { getAllowedJobIds, isJobMember } from "../lib/job-membership";

const router = Router();

router.get("/api/panels", requireAuth, async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  
  const jobId = req.query.jobId as string | undefined;
  const level = req.query.level as string | undefined;
  
  if (jobId) {
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Job not found" });
    }
    const allowed = await isJobMember(req, jobId);
    if (!allowed) {
      return res.status(403).json({ error: "You are not a member of this job" });
    }
    if (level) {
      const panels = await storage.getPanelsByJobAndLevel(jobId, level);
      res.json(panels);
    } else {
      const panels = await storage.getPanelsByJob(jobId);
      res.json(panels);
    }
  } else {
    const allPanels = await storage.getAllPanelRegisterItems(req.companyId);

    const allowedIds = await getAllowedJobIds(req);
    let filtered = allPanels;
    if (allowedIds !== null) {
      filtered = filtered.filter(p => p.job && allowedIds.has(p.job.id));
    }

    res.json(filtered);
  }
});

router.get("/api/panels/by-job/:jobId", requireAuth, async (req: Request, res: Response) => {
  const companyId = req.companyId;
  const job = await storage.getJob(req.params.jobId as string);
  if (!job || job.companyId !== companyId) {
    return res.status(404).json({ error: "Job not found" });
  }
  const allowed = await isJobMember(req, job.id);
  if (!allowed) {
    return res.status(403).json({ error: "You are not a member of this job" });
  }
  const panels = await storage.getPanelsByJob(req.params.jobId as string);
  res.json(panels);
});

router.get("/api/panels/ready-for-loading", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const panels = await storage.getPanelsReadyForLoading(req.companyId);

    const allowedIds = await getAllowedJobIds(req);
    let filtered = panels;
    if (allowedIds !== null) {
      filtered = filtered.filter((p) => p.job && allowedIds.has(p.job.id));
    }

    res.json(filtered);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching panels ready for loading");
    res.status(500).json({ error: "Failed to fetch panels ready for loading" });
  }
});

router.get("/api/panels/approved-for-production", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { jobId } = req.query;
    if (jobId) {
      const job = await storage.getJob(jobId as string);
      if (!job || job.companyId !== companyId) {
        return res.status(404).json({ error: "Job not found" });
      }
      const allowed = await isJobMember(req, jobId as string);
      if (!allowed) {
        return res.status(403).json({ error: "You are not a member of this job" });
      }
    }
    const panels = await storage.getPanelsApprovedForProduction(jobId as string | undefined);
    let filtered = panels.filter((p) => p.job?.companyId === companyId);

    if (!jobId) {
      const allowedIds = await getAllowedJobIds(req);
      if (allowedIds !== null) {
        filtered = filtered.filter((p) => p.job && allowedIds.has(p.job.id));
      }
    }

    res.json(filtered);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching approved panels");
    res.status(500).json({ error: "Failed to fetch approved panels" });
  }
});

const documentStatusSchema = z.object({
  documentStatus: z.enum(["DRAFT", "IFA", "IFC", "APPROVED"]),
});

router.put("/api/panels/:id/document-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = documentStatusSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    const companyId = req.companyId;
    const { documentStatus } = result.data;
    
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    if (documentStatus === "APPROVED") {
      const userId = req.session.userId;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || !["MANAGER", "ADMIN"].includes(user.role)) {
        return res.status(403).json({ error: "Only managers or admins can approve documents for production" });
      }
      if (panel.documentStatus !== "IFC") {
        return res.status(400).json({ error: "Panel must be in IFC status before it can be approved for production" });
      }
    }
    
    const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
      documentStatus 
    });
    
    const panelId = req.params.id as string;
    const userId = req.session.userId;
    const docToLifecycle: Record<string, number> = { DRAFT: 2, IFA: 3, IFC: 4, APPROVED: 6 };
    const mappedStatus = docToLifecycle[documentStatus];
    if (mappedStatus !== undefined) {
      advancePanelLifecycleIfLower(panelId, mappedStatus, "Document status changed to " + documentStatus, userId, { documentStatus, previousDocumentStatus: panel.documentStatus });
    }
    
    res.json(updatedPanel);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update document status" });
  }
});

router.get("/api/panels/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.limit as string) || parseInt(req.query.pageSize as string) || 50;
    const jobId = req.query.jobId as string | undefined;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const factoryId = req.query.factoryId as string | undefined;
    
    const panels = await storage.getAllPanelRegisterItems(req.companyId);
    
    let filtered = panels;
    if (jobId) {
      filtered = filtered.filter(p => p.jobId === jobId);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.panelMark?.toLowerCase().includes(searchLower) ||
        p.panelType?.toLowerCase().includes(searchLower)
      );
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(p => p.status === status);
    }
    if (factoryId) {
      filtered = filtered.filter(p => p.job?.factoryId === factoryId || !p.job?.factoryId);
    }
    
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);
    
    res.json({
      panels: paginated,
      total: filtered.length,
      page,
      limit: pageSize,
      totalPages: Math.ceil(filtered.length / pageSize)
    });
  } catch (error: unknown) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to get admin panels");
    res.status(500).json({ error: "Failed to get panels" });
  }
});

router.get("/api/panels/:id/details", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
    const allowed = await isJobMember(req, panel.jobId);
    if (!allowed) return res.status(403).json({ error: "You are not a member of this job" });
    res.json(panel);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching panel details");
    res.status(500).json({ error: "Failed to fetch panel details" });
  }
});

router.get("/api/panels/admin/source-counts", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const counts = await storage.getPanelCountsBySource(req.companyId);
  res.json(counts);
});

router.get("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const companyId = req.companyId;
  const panel = await storage.getPanelRegisterItem(req.params.id as string);
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  const job = await storage.getJob(panel.jobId);
  if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
  res.json(panel);
});

const createPanelSchema = z.object({
  jobId: z.string(),
  panelMark: z.string(),
  panelType: z.string(),
  description: z.string().nullish(),
  drawingCode: z.string().nullish(),
  sheetNumber: z.string().nullish(),
  building: z.string().nullish(),
  zone: z.string().nullish(),
  level: z.string().nullish(),
  structuralElevation: z.string().nullish(),
  reckliDetail: z.string().nullish(),
  qty: z.number().optional(),
  loadWidth: z.string().nullish(),
  loadHeight: z.string().nullish(),
  panelThickness: z.string().nullish(),
  panelArea: z.string().nullish(),
  panelVolume: z.string().nullish(),
  panelMass: z.string().nullish(),
  concreteStrengthMpa: z.string().nullish(),
  estimatedHours: z.number().nullish(),
  status: z.enum(["PENDING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "NOT_STARTED"]).optional(),
}).passthrough();

const updatePanelSchema = createPanelSchema.partial().passthrough();

router.post("/api/panels/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const result = createPanelSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const job = await storage.getJob(result.data.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(400).json({ error: "Invalid job" });
    }
    const panel = await storage.createPanelRegisterItem(result.data);
    logPanelChange(panel.id, "Panel created", req.session.userId, { changedFields: { panelMark: panel.panelMark, panelType: panel.panelType, jobId: panel.jobId }, newLifecycleStatus: 0 });
    res.json(panel);
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes("duplicate")) {
      return res.status(400).json({ error: "Panel with this mark already exists for this job" });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create panel" });
  }
});

router.put("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const validationResult = updatePanelSchema.safeParse(req.body);
  if (!validationResult.success) return res.status(400).json({ error: "Validation failed", details: validationResult.error.format() });
  const companyId = req.companyId;
  const existing = await storage.getPanelRegisterItem(req.params.id as string);
  if (!existing) return res.status(404).json({ error: "Panel not found" });
  const job = await storage.getJob(existing.jobId);
  if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
  const panel = await storage.updatePanelRegisterItem(req.params.id as string, validationResult.data);
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(validationResult.data)) {
    if ((validationResult.data as Record<string, unknown>)[key] !== (existing as Record<string, unknown>)[key]) {
      diff[key] = (validationResult.data as Record<string, unknown>)[key];
    }
  }
  logPanelChange(panel!.id, "Panel updated", req.session.userId, { changedFields: diff });
  if (diff.loadWidth !== undefined || diff.loadHeight !== undefined || diff.panelThickness !== undefined) {
    advancePanelLifecycleIfLower(panel!.id, PANEL_LIFECYCLE_STATUS.DIMENSIONS_CONFIRMED, "Dimensions confirmed", req.session.userId);
  }
  res.json(panel);
});

router.post("/api/panels/admin/:id/validate", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }
    if (panel.status !== "PENDING") {
      return res.status(400).json({ error: "Only panels with PENDING status can be validated" });
    }
    const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
      status: "NOT_STARTED" 
    });
    logPanelChange(updatedPanel!.id, "Panel validated", req.session.userId);
    res.json(updatedPanel);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to validate panel" });
  }
});

router.delete("/api/panels/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const companyId = req.companyId;
  const panel = await storage.getPanelRegisterItem(req.params.id as string);
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  const job = await storage.getJob(panel.jobId);
  if (!job || job.companyId !== companyId) return res.status(404).json({ error: "Panel not found" });
  logPanelChange(panel.id, "Panel deleted", req.session.userId, { changedFields: { panelMark: panel.panelMark } });
  await storage.deletePanelRegisterItem(req.params.id as string);
  res.json({ ok: true });
});

router.delete("/api/panels/admin/by-source/:source", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const source = parseInt(String(req.params.source));
    if (![1, 2, 3].includes(source)) {
      return res.status(400).json({ error: "Invalid source. Must be 1 (Manual), 2 (Excel), or 3 (Estimate)" });
    }
    
    const hasRecords = await storage.panelsWithSourceHaveRecords(source);
    if (hasRecords) {
      return res.status(400).json({ 
        error: "Cannot delete panels that have production records or are approved for production" 
      });
    }
    
    const deletedCount = await storage.deletePanelsBySource(source);
    res.json({ deleted: deletedCount });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete panels" });
  }
});

router.get("/api/panels/:id/audit-logs", requireAuth, async (req: Request, res: Response) => {
  try {
    const panelId = req.params.id as string;
    const panel = await storage.getPanelRegisterItem(panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await db.select({
      id: panelAuditLogs.id,
      panelId: panelAuditLogs.panelId,
      action: panelAuditLogs.action,
      changedFields: panelAuditLogs.changedFields,
      previousLifecycleStatus: panelAuditLogs.previousLifecycleStatus,
      newLifecycleStatus: panelAuditLogs.newLifecycleStatus,
      changedById: panelAuditLogs.changedById,
      createdAt: panelAuditLogs.createdAt,
      changedByName: users.name,
    }).from(panelAuditLogs)
      .leftJoin(users, eq(panelAuditLogs.changedById, users.id))
      .where(eq(panelAuditLogs.panelId, panelId))
      .orderBy(desc(panelAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching panel audit logs");
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

const consolidationCheckSchema = z.object({
  panelIds: z.array(z.string()).min(2, "Must provide at least 2 panel IDs"),
});

router.post("/api/panels/consolidation-check", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const result = consolidationCheckSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { panelIds } = result.data;

    const panels = await db.select({ panel: panelRegister, job: jobs })
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(and(inArray(panelRegister.id, panelIds), eq(jobs.companyId, companyId)))
      .limit(1000);

    if (panels.length === 0) {
      return res.status(404).json({ error: "No authorized panels found" });
    }

    const [draftingCounts, timerCounts, loadListCounts] = await Promise.all([
      db.select({ panelId: logRows.panelRegisterId, count: sql<number>`count(*)::int` })
        .from(logRows)
        .where(inArray(logRows.panelRegisterId, panelIds))
        .groupBy(logRows.panelRegisterId),
      db.select({ panelId: timerSessions.panelRegisterId, count: sql<number>`count(*)::int` })
        .from(timerSessions)
        .where(inArray(timerSessions.panelRegisterId, panelIds))
        .groupBy(timerSessions.panelRegisterId),
      db.select({ panelId: loadListPanels.panelId, count: sql<number>`count(*)::int` })
        .from(loadListPanels)
        .where(inArray(loadListPanels.panelId, panelIds))
        .groupBy(loadListPanels.panelId),
    ]);

    const draftingMap = new Map(draftingCounts.map(r => [r.panelId, r.count]));
    const timerMap = new Map(timerCounts.map(r => [r.panelId, r.count]));
    const loadListMap = new Map(loadListCounts.map(r => [r.panelId, r.count]));

    const results: Record<string, { panelMark: string; draftingLogs: number; timerSessions: number; loadListEntries: number; lifecycleStatus: number }> = {};

    for (const { panel } of panels) {
      results[panel.id] = {
        panelMark: panel.panelMark,
        draftingLogs: draftingMap.get(panel.id) ?? 0,
        timerSessions: timerMap.get(panel.id) ?? 0,
        loadListEntries: loadListMap.get(panel.id) ?? 0,
        lifecycleStatus: panel.lifecycleStatus ?? 0,
      };
    }

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error checking panel consolidation records");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check panel records" });
  }
});

const consolidateSchema = z.object({
  panelIds: z.array(z.string()).min(2, "Must select at least 2 panels to consolidate"),
  primaryPanelId: z.string(),
  newPanelMark: z.string(),
  newLoadWidth: z.string().optional(),
  newLoadHeight: z.string().optional(),
});

router.post("/api/panels/consolidate", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const consolidateResult = consolidateSchema.safeParse(req.body);
    if (!consolidateResult.success) return res.status(400).json({ error: "Validation failed", details: consolidateResult.error.format() });
    const { panelIds, primaryPanelId, newPanelMark, newLoadWidth, newLoadHeight } = consolidateResult.data;

    if (!panelIds.includes(primaryPanelId)) {
      return res.status(400).json({ error: "Primary panel must be one of the selected panels" });
    }

    const panels = await db.select().from(panelRegister).where(inArray(panelRegister.id, panelIds)).limit(1000);
    if (panels.length !== panelIds.length) {
      return res.status(400).json({ error: "One or more panels not found" });
    }

    const primaryPanel = panels.find(p => p.id === primaryPanelId);
    if (!primaryPanel) {
      return res.status(400).json({ error: "Primary panel not found" });
    }

    const companyId = req.companyId;
    if (companyId) {
      const job = await storage.getJob(primaryPanel.jobId);
      if (!job || job.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const jobIds = new Set(panels.map(p => p.jobId));
    if (jobIds.size > 1) {
      return res.status(400).json({ error: "All panels must belong to the same job" });
    }

    const panelTypes = new Set(panels.map(p => p.panelType));
    if (panelTypes.size > 1) {
      return res.status(400).json({ error: "All panels must be the same panel type" });
    }

    const mpas = new Set(panels.map(p => p.concreteStrengthMpa || ""));
    if (mpas.size > 1) {
      return res.status(400).json({ error: "Cannot consolidate panels with different concrete strengths (MPa)" });
    }

    const thicknesses = new Set(panels.map(p => p.panelThickness || ""));
    if (thicknesses.size > 1) {
      return res.status(400).json({ error: "Cannot consolidate panels with different thicknesses" });
    }

    const widths = panels.map(p => parseFloat(p.loadWidth || "0"));
    const heights = panels.map(p => parseFloat(p.loadHeight || "0"));
    const allWidthsSame = new Set(widths).size === 1;
    const allHeightsSame = new Set(heights).size === 1;

    if (!allWidthsSame && !allHeightsSame) {
      return res.status(400).json({ error: "Cannot consolidate panels: widths or heights must match across all selected panels" });
    }

    const consumedPanelIds = panelIds.filter(id => id !== primaryPanelId);

    let widthNum: number, heightNum: number;
    if (allWidthsSame) {
      widthNum = widths[0];
      heightNum = heights.reduce((sum, h) => sum + h, 0);
    } else {
      widthNum = widths.reduce((sum, w) => sum + w, 0);
      heightNum = heights[0];
    }
    const width = newLoadWidth || String(widthNum);
    const height = newLoadHeight || String(heightNum);
    const thicknessNum = parseFloat(primaryPanel.panelThickness || "0");
    const areaM2 = ((widthNum * heightNum) / 1_000_000).toFixed(4);
    const volumeM3 = ((widthNum * heightNum * thicknessNum) / 1_000_000_000).toFixed(6);

    await db.transaction(async (tx) => {
      await tx.update(panelRegister)
        .set({
          panelMark: newPanelMark,
          loadWidth: width,
          loadHeight: height,
          panelArea: areaM2,
          panelVolume: volumeM3,
          updatedAt: new Date(),
        })
        .where(eq(panelRegister.id, primaryPanelId));

      await tx.insert(panelAuditLogs).values({
        panelId: primaryPanelId,
        action: "Panel consolidated",
        changedById: req.session.userId || null,
        changedFields: {
          panelMark: newPanelMark,
          loadWidth: width,
          loadHeight: height,
          panelArea: areaM2,
          panelVolume: volumeM3,
          consolidatedFrom: consumedPanelIds,
        },
        previousLifecycleStatus: null,
        newLifecycleStatus: null,
      });

      for (const consumedId of consumedPanelIds) {
        await tx.update(panelRegister)
          .set({
            consolidatedIntoPanelId: primaryPanelId,
            lifecycleStatus: 0,
            status: "ON_HOLD",
            updatedAt: new Date(),
          })
          .where(eq(panelRegister.id, consumedId));

        const consumedPanel = panels.find(p => p.id === consumedId);
        await tx.insert(panelAuditLogs).values({
          panelId: consumedId,
          action: `Panel consolidated into ${newPanelMark}`,
          changedById: req.session.userId || null,
          changedFields: {
            consolidatedIntoPanelId: primaryPanelId,
            originalPanelMark: consumedPanel?.panelMark,
          },
          newLifecycleStatus: 0,
          previousLifecycleStatus: consumedPanel?.lifecycleStatus ?? 0,
        });
      }
    });

    const updatedPanel = await storage.getPanelRegisterItem(primaryPanelId);
    res.json({ panel: updatedPanel, consumedPanelIds });
  } catch (error: unknown) {
    logger.error({ err: error }, "Panel consolidation error");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to consolidate panels" });
  }
});

const ALLOWED_MOBILE_TRANSITIONS: Record<number, { action: string }> = {
  [PANEL_LIFECYCLE_STATUS.QA_PASSED]: { action: "QA passed (mobile)" },
  [PANEL_LIFECYCLE_STATUS.RETURNED]: { action: "Panel returned (mobile)" },
};

const lifecycleSchema = z.object({
  targetStatus: z.number(),
});

router.post("/api/panels/:id/lifecycle", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = lifecycleSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.format() });
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const panelId = req.params.id as string;
    const { targetStatus } = result.data;

    if (!ALLOWED_MOBILE_TRANSITIONS[targetStatus]) {
      return res.status(400).json({ error: "Invalid lifecycle transition" });
    }

    const panel = await storage.getPanelRegisterItem(panelId);
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    const transition = ALLOWED_MOBILE_TRANSITIONS[targetStatus];

    if (targetStatus === PANEL_LIFECYCLE_STATUS.QA_PASSED) {
      if (panel.lifecycleStatus < PANEL_LIFECYCLE_STATUS.PRODUCED) {
        return res.status(400).json({ error: "Panel must be produced before QA" });
      }
      if (panel.lifecycleStatus >= PANEL_LIFECYCLE_STATUS.QA_PASSED) {
        return res.status(400).json({ error: "Panel has already passed QA" });
      }
    }

    if (targetStatus === PANEL_LIFECYCLE_STATUS.RETURNED && panel.lifecycleStatus !== PANEL_LIFECYCLE_STATUS.SHIPPED) {
      return res.status(400).json({ error: "Only shipped panels can be returned" });
    }

    await updatePanelLifecycleStatus(panelId, targetStatus, transition.action, req.session.userId);

    const updated = await storage.getPanelRegisterItem(panelId);
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Panel lifecycle update error");
    res.status(500).json({ error: "Failed to update panel lifecycle" });
  }
});

export const panelsRouter = router;
