import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import { logPanelChange, advancePanelLifecycleIfLower } from "../../services/panel-audit.service";
import { sendSuccess, sendBadRequest, sendNotFound, sendForbidden, sendServerError, sendPaginated } from "../../lib/api-response";
import { PANEL_LIFECYCLE_STATUS, insertLoadListSchema, loadLists, loadListPanels, jobs, trailerTypes, deliveryRecords, loadReturns, panelRegister, users } from "@shared/schema";
import { db } from "../../db";
import { eq, and, asc, desc, count, inArray } from "drizzle-orm";

const router = Router();

router.get("/api/load-lists", requireAuth, requirePermission("logistics"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const queryLimit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * queryLimit;
    const statusFilter = req.query.status as string | undefined;
    const jobIdFilter = req.query.jobId as string | undefined;

    const conditions = [eq(jobs.companyId, companyId)];
    if (statusFilter) conditions.push(eq(loadLists.status, statusFilter as any));
    if (jobIdFilter) conditions.push(eq(loadLists.jobId, jobIdFilter));

    const [{ total }] = await db
      .select({ total: count() })
      .from(loadLists)
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(and(...conditions));

    const results = await db
      .select({
        id: loadLists.id,
        jobId: loadLists.jobId,
        loadNumber: loadLists.loadNumber,
        loadDate: loadLists.loadDate,
        loadTime: loadLists.loadTime,
        trailerTypeId: loadLists.trailerTypeId,
        factory: loadLists.factory,
        factoryId: loadLists.factoryId,
        uhf: loadLists.uhf,
        status: loadLists.status,
        notes: loadLists.notes,
        createdById: loadLists.createdById,
        createdAt: loadLists.createdAt,
        updatedAt: loadLists.updatedAt,
        jobNumber: jobs.jobNumber,
        jobName: jobs.name,
        jobCode: jobs.code,
      })
      .from(loadLists)
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(desc(loadLists.createdAt))
      .limit(queryLimit)
      .offset(offset);

    const loadListIds = results.map(r => r.id);

    if (loadListIds.length === 0) {
      return sendPaginated(res, [], { page, limit: queryLimit, total });
    }

    const [allPanelRows, allDeliveryRows, allLoadReturnRows] = await Promise.all([
      db.select()
        .from(loadListPanels)
        .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
        .where(inArray(loadListPanels.loadListId, loadListIds))
        .orderBy(asc(loadListPanels.sequence))
        .limit(1000),
      db.select().from(deliveryRecords)
        .where(inArray(deliveryRecords.loadListId, loadListIds))
        .limit(1000),
      db.select().from(loadReturns)
        .where(inArray(loadReturns.loadListId, loadListIds))
        .limit(1000),
    ]);

    const panelsByLoadList = new Map<string, typeof allPanelRows>();
    for (const row of allPanelRows) {
      const arr = panelsByLoadList.get(row.load_list_panels.loadListId) || [];
      arr.push(row);
      panelsByLoadList.set(row.load_list_panels.loadListId, arr);
    }

    const deliveryByLoadList = new Map(allDeliveryRows.map(d => [d.loadListId, d]));
    const returnByLoadList = new Map(allLoadReturnRows.map(r => [r.loadListId, r]));

    const trailerTypeIds = [...new Set(results.filter(r => r.trailerTypeId).map(r => r.trailerTypeId!))];
    const allTrailerTypes = trailerTypeIds.length > 0
      ? await db.select().from(trailerTypes).where(inArray(trailerTypes.id, trailerTypeIds))
      : [];
    const trailerTypeMap = new Map(allTrailerTypes.map(t => [t.id, t]));

    const createdByIds = [...new Set(results.filter(r => r.createdById).map(r => r.createdById!))];
    const allCreatedBy = createdByIds.length > 0
      ? await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users).where(inArray(users.id, createdByIds))
      : [];
    const createdByMap = new Map(allCreatedBy.map(u => [u.id, u]));

    const enriched = results.map(r => {
      const panelRows = panelsByLoadList.get(r.id) || [];
      return {
        ...r,
        job: { id: r.jobId, jobNumber: r.jobNumber, name: r.jobName, code: r.jobCode },
        trailerType: r.trailerTypeId ? trailerTypeMap.get(r.trailerTypeId) || null : null,
        panels: panelRows.map(p => ({ ...p.load_list_panels, panel: p.panel_register })),
        deliveryRecord: deliveryByLoadList.get(r.id) || null,
        loadReturn: returnByLoadList.get(r.id) || null,
        createdBy: r.createdById ? createdByMap.get(r.createdById) || null : null,
        panelCount: panelRows.length,
      };
    });

    sendPaginated(res, enriched, { page, limit: queryLimit, total });
  } catch (error: unknown) {
    sendServerError(res, error instanceof Error ? error.message : "Failed to fetch load lists");
  }
});

router.get("/api/load-lists/:id", requireAuth, requirePermission("logistics"), async (req, res) => {
  const loadList = await storage.getLoadList(req.params.id as string);
  if (!loadList) return sendNotFound(res, "Load list not found");
  if (req.companyId && loadList.jobId) {
    const job = await storage.getJob(loadList.jobId);
    if (!job || job.companyId !== req.companyId) return sendForbidden(res);
  }
  sendSuccess(res, loadList);
});

router.post("/api/load-lists", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { panelIds, docketNumber, scheduledDate, ...data } = req.body;
    
    const [{ existingCount }] = await db
      .select({ existingCount: count() })
      .from(loadLists)
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(eq(jobs.companyId, req.companyId!));
    const loadNumber = `LL-${String(existingCount + 1).padStart(4, '0')}`;
    
    const date = scheduledDate ? new Date(scheduledDate) : new Date();
    const loadDate = date.toISOString().split('T')[0];
    const loadTime = date.toTimeString().split(' ')[0].substring(0, 5);
    
    if (data.jobId && req.companyId) {
      const job = await storage.getJob(data.jobId);
      if (!job || job.companyId !== req.companyId) {
        return sendForbidden(res);
      }
    }

    if (panelIds && panelIds.length > 0) {
      for (const pId of panelIds) {
        const panelCheck = await storage.getPanelById(pId);
        if (!panelCheck) {
          return sendNotFound(res, `Panel ${pId} not found`);
        }
        if (panelCheck.lifecycleStatus < PANEL_LIFECYCLE_STATUS.PRODUCED) {
          return sendBadRequest(res, `Panel ${panelCheck.panelMark} must be produced before it can be added to a load list.`);
        }
      }
    }

    const loadList = await storage.createLoadList({
      ...data,
      loadNumber,
      loadDate,
      loadTime,
      createdById: req.session.userId!,
    }, panelIds || []);
    if (panelIds && panelIds.length > 0) {
      for (const panelId of panelIds) {
        await advancePanelLifecycleIfLower(panelId, PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST, "Added to load list", req.session.userId, { loadListId: loadList.id });
      }
    }
    sendSuccess(res, loadList);
  } catch (error: unknown) {
    sendBadRequest(res, error instanceof Error ? error.message : "Failed to create load list");
  }
});

router.put("/api/load-lists/:id", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const companyId = req.session.companyId;
  const existing = await storage.getLoadList(req.params.id as string);
  if (!existing || (existing as unknown as Record<string, unknown>).companyId !== companyId) {
    return sendNotFound(res, "Load list not found");
  }
  const parsed = insertLoadListSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "Validation failed");
  }
  const loadList = await storage.updateLoadList(req.params.id as string, parsed.data);
  sendSuccess(res, loadList);
});

router.delete("/api/load-lists/:id", requireRole("ADMIN", "MANAGER"), requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const companyId = req.session.companyId;
  const existing = await storage.getLoadList(req.params.id as string);
  if (!existing || (existing as unknown as Record<string, unknown>).companyId !== companyId) {
    return sendNotFound(res, "Load list not found");
  }
  await storage.deleteLoadList(req.params.id as string);
  sendSuccess(res, { ok: true });
});

router.post("/api/load-lists/:id/panels", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const loadList = await storage.getLoadList(req.params.id as string);
  if (!loadList) return sendNotFound(res, "Load list not found");
  if (req.companyId && loadList.jobId) {
    const job = await storage.getJob(loadList.jobId);
    if (!job || job.companyId !== req.companyId) return sendForbidden(res);
  }
  const { panelId, sequence } = req.body;
  const panelRecord = await storage.getPanelById(panelId);
  if (!panelRecord) {
    return sendNotFound(res, "Panel not found");
  }
  if (panelRecord.lifecycleStatus < PANEL_LIFECYCLE_STATUS.PRODUCED) {
    return sendBadRequest(res, "Panel must be produced before it can be added to a load list. Current lifecycle status does not meet the minimum requirement.");
  }
  const panel = await storage.addPanelToLoadList(req.params.id as string, panelId, sequence);
  await advancePanelLifecycleIfLower(panelId, PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST, "Added to load list", req.session.userId, { loadListId: req.params.id });
  sendSuccess(res, panel);
});

router.delete("/api/load-lists/:id/panels/:panelId", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const loadList = await storage.getLoadList(req.params.id as string);
  if (!loadList) return sendNotFound(res, "Load list not found");
  if (req.companyId && loadList.jobId) {
    const job = await storage.getJob(loadList.jobId);
    if (!job || job.companyId !== req.companyId) return sendForbidden(res);
  }
  await storage.removePanelFromLoadList(req.params.id as string, req.params.panelId as string);
  logPanelChange(req.params.panelId as string, "Removed from load list", req.session.userId, { changedFields: { loadListId: req.params.id } });
  sendSuccess(res, { ok: true });
});

export default router;
