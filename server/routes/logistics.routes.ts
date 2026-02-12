import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import { emailService } from "../services/email.service";
import { logPanelChange, advancePanelLifecycleIfLower, updatePanelLifecycleStatus } from "../services/panel-audit.service";
import { PANEL_LIFECYCLE_STATUS, insertTrailerTypeSchema, insertZoneSchema, insertLoadListSchema, insertDeliveryRecordSchema } from "@shared/schema";
import type { JobPhase } from "@shared/job-phases";

const router = Router();

// =============== TRAILER TYPES ===============

router.get("/api/trailer-types", requireAuth, async (req, res) => {
  const trailerTypes = await storage.getActiveTrailerTypes();
  res.json(trailerTypes);
});

router.get("/api/admin/trailer-types", requireRole("ADMIN"), async (req, res) => {
  const trailerTypes = await storage.getAllTrailerTypes();
  res.json(trailerTypes);
});

router.post("/api/admin/trailer-types", requireRole("ADMIN"), async (req, res) => {
  const trailerType = await storage.createTrailerType(req.body);
  res.json(trailerType);
});

router.put("/api/admin/trailer-types/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = insertTrailerTypeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const trailerType = await storage.updateTrailerType(req.params.id as string, parsed.data);
  res.json(trailerType);
});

router.delete("/api/admin/trailer-types/:id", requireRole("ADMIN"), async (req, res) => {
  await storage.deleteTrailerType(req.params.id as string);
  res.json({ success: true });
});

// =============== ZONES ===============

router.get("/api/admin/zones", requireRole("ADMIN"), async (req, res) => {
  const zones = await storage.getAllZones();
  res.json(zones);
});

router.get("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  const zone = await storage.getZone(req.params.id as string);
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  res.json(zone);
});

router.post("/api/admin/zones", requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await storage.getZoneByCode(req.body.code);
    if (existing) {
      return res.status(400).json({ error: "Zone with this code already exists" });
    }
    const zone = await storage.createZone(req.body);
    res.json(zone);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create zone" });
  }
});

router.put("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = insertZoneSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const zone = await storage.updateZone(req.params.id as string, parsed.data);
  res.json(zone);
});

router.delete("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  await storage.deleteZone(req.params.id as string);
  res.json({ success: true });
});

// =============== LOAD LISTS ===============

router.get("/api/load-lists", requireAuth, requirePermission("logistics"), async (req, res) => {
  const loadLists = await storage.getAllLoadLists();
  res.json(loadLists);
});

router.get("/api/load-lists/:id", requireAuth, requirePermission("logistics"), async (req, res) => {
  const loadList = await storage.getLoadList(req.params.id as string);
  if (!loadList) return res.status(404).json({ error: "Load list not found" });
  res.json(loadList);
});

router.post("/api/load-lists", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  try {
    const { panelIds, docketNumber, scheduledDate, ...data } = req.body;
    
    const existingLoadLists = await storage.getAllLoadLists();
    const loadNumber = `LL-${String(existingLoadLists.length + 1).padStart(4, '0')}`;
    
    const date = scheduledDate ? new Date(scheduledDate) : new Date();
    const loadDate = date.toISOString().split('T')[0];
    const loadTime = date.toTimeString().split(' ')[0].substring(0, 5);
    
    const loadList = await storage.createLoadList({
      ...data,
      loadNumber,
      loadDate,
      loadTime,
      createdById: req.session.userId!,
    }, panelIds || []);
    res.json(loadList);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create load list" });
  }
});

router.put("/api/load-lists/:id", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const companyId = req.session.companyId;
  const existing = await storage.getLoadList(req.params.id as string);
  if (!existing || (existing as Record<string, unknown>).companyId !== companyId) {
    return res.status(404).json({ error: "Load list not found" });
  }
  const parsed = insertLoadListSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const loadList = await storage.updateLoadList(req.params.id as string, parsed.data);
  res.json(loadList);
});

router.delete("/api/load-lists/:id", requireRole("ADMIN", "MANAGER"), requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const companyId = req.session.companyId;
  const existing = await storage.getLoadList(req.params.id as string);
  if (!existing || (existing as Record<string, unknown>).companyId !== companyId) {
    return res.status(404).json({ error: "Load list not found" });
  }
  await storage.deleteLoadList(req.params.id as string);
  res.json({ success: true });
});

router.post("/api/load-lists/:id/panels", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const { panelId, sequence } = req.body;
  const panel = await storage.addPanelToLoadList(req.params.id as string, panelId, sequence);
  advancePanelLifecycleIfLower(panelId, PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST, "Added to load list", req.session.userId, { loadListId: req.params.id });
  res.json(panel);
});

router.delete("/api/load-lists/:id/panels/:panelId", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  await storage.removePanelFromLoadList(req.params.id as string, req.params.panelId as string);
  logPanelChange(req.params.panelId as string, "Removed from load list", req.session.userId, { changedFields: { loadListId: req.params.id } });
  res.json({ success: true });
});

// =============== DELIVERY RECORDS ===============

router.get("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
  const record = await storage.getDeliveryRecord(req.params.id as string);
  res.json(record || null);
});

router.post("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
  try {
    const loadListForPhaseCheck = await storage.getLoadList(req.params.id as string);
    if (loadListForPhaseCheck?.jobId) {
      const { jobHasCapability } = await import("@shared/job-phases");
      const job = await storage.getJob(loadListForPhaseCheck.jobId);
      if (job) {
        const { intToPhase } = await import("@shared/job-phases");
        const phase = (typeof job.jobPhase === 'number' ? intToPhase(job.jobPhase) : (job.jobPhase || "CONTRACTED")) as string;
        if (!jobHasCapability(phase as JobPhase, "DELIVER_PANELS")) {
          return res.status(403).json({ error: `Cannot record deliveries while job is in "${phase}" phase` });
        }
      }
    }
    const record = await storage.createDeliveryRecord({
      ...req.body,
      loadListId: req.params.id as string,
      enteredById: req.session.userId!,
    });
    const loadList = await storage.getLoadList(req.params.id as string);
    if (loadList?.panels) {
      for (const lp of loadList.panels) {
        advancePanelLifecycleIfLower(lp.panel.id, PANEL_LIFECYCLE_STATUS.SHIPPED, "Delivered to site", req.session.userId, { loadListId: req.params.id });
      }
    }
    res.json(record);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create delivery record" });
  }
});

router.put("/api/delivery-records/:id", requireAuth, async (req, res) => {
  const record = await storage.getDeliveryRecordById(req.params.id as string);
  if (!record) {
    return res.status(404).json({ error: "Delivery record not found" });
  }
  const loadList = await storage.getLoadList(record.loadListId);
  const companyId = req.session.companyId;
  if (!loadList || (loadList as Record<string, unknown>).companyId !== companyId) {
    return res.status(404).json({ error: "Delivery record not found" });
  }
  const parsed = insertDeliveryRecordSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const updated = await storage.updateDeliveryRecord(req.params.id as string, parsed.data);
  res.json(updated);
});

// =============== LOAD RETURNS ===============

router.get("/api/load-lists/:id/return", requireAuth, async (req, res) => {
  try {
    const loadReturn = await storage.getLoadReturn(req.params.id as string);
    res.json(loadReturn || null);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get load return" });
  }
});

router.post("/api/load-lists/:id/return", requireAuth, async (req, res) => {
  try {
    const loadList = await storage.getLoadList(req.params.id as string);
    if (!loadList) return res.status(404).json({ error: "Load list not found" });

    const existingReturn = await storage.getLoadReturn(req.params.id as string);
    if (existingReturn) {
      return res.status(400).json({ error: "A return record already exists for this load list" });
    }

    const { panelIds, ...returnData } = req.body;

    if (!returnData.returnReason) {
      return res.status(400).json({ error: "Return reason is required" });
    }

    if (!returnData.returnType || !["FULL", "PARTIAL"].includes(returnData.returnType)) {
      return res.status(400).json({ error: "Return type must be FULL or PARTIAL" });
    }

    if (returnData.returnType === "PARTIAL" && (!panelIds || panelIds.length === 0)) {
      return res.status(400).json({ error: "At least one panel must be selected for partial return" });
    }

    const selectedPanelIds = returnData.returnType === "FULL"
      ? loadList.panels.map(p => p.panel.id)
      : (panelIds || []);

    const loadReturn = await storage.createLoadReturn({
      ...returnData,
      loadListId: req.params.id as string,
      returnedById: req.session.userId || undefined,
    }, selectedPanelIds);

    for (const panelId of selectedPanelIds) {
      updatePanelLifecycleStatus(panelId, PANEL_LIFECYCLE_STATUS.RETURNED, "Panel returned from site", req.session.userId, { returnType: returnData.returnType, returnReason: returnData.returnReason });
    }

    res.json(loadReturn);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create load return" });
  }
});

router.post("/api/test-gmail", requireAuth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });
    const result = await emailService.sendEmail(
      to,
      "Test Email from LTE System (via Gmail)",
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #1a56db;">LTE Performance Management System</h2><p>This is a test email sent via <strong>Gmail</strong> from the LTE system.</p><p><strong>Sent at:</strong> ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}</p><p style="color: #666; font-size: 12px; margin-top: 20px;">This is an automated test message.</p></div>`
    );
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export const logisticsRouter = router;
