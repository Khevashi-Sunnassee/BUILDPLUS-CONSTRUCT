import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";

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
  const trailerType = await storage.updateTrailerType(req.params.id as string, req.body);
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
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create zone" });
  }
});

router.put("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  const zone = await storage.updateZone(req.params.id as string, req.body);
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
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create load list" });
  }
});

router.put("/api/load-lists/:id", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const loadList = await storage.updateLoadList(req.params.id as string, req.body);
  res.json(loadList);
});

router.delete("/api/load-lists/:id", requireRole("ADMIN", "MANAGER"), requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  await storage.deleteLoadList(req.params.id as string);
  res.json({ success: true });
});

router.post("/api/load-lists/:id/panels", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  const { panelId, sequence } = req.body;
  const panel = await storage.addPanelToLoadList(req.params.id as string, panelId, sequence);
  res.json(panel);
});

router.delete("/api/load-lists/:id/panels/:panelId", requireAuth, requirePermission("logistics", "VIEW_AND_UPDATE"), async (req, res) => {
  await storage.removePanelFromLoadList(req.params.id as string, req.params.panelId as string);
  res.json({ success: true });
});

// =============== DELIVERY RECORDS ===============

router.get("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
  const record = await storage.getDeliveryRecord(req.params.id as string);
  res.json(record || null);
});

router.post("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
  try {
    const record = await storage.createDeliveryRecord({
      ...req.body,
      loadListId: req.params.id as string,
      enteredById: req.session.userId!,
    });
    res.json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create delivery record" });
  }
});

router.put("/api/delivery-records/:id", requireAuth, async (req, res) => {
  const record = await storage.updateDeliveryRecord(req.params.id as string, req.body);
  res.json(record);
});

export const logisticsRouter = router;
