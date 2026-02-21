import { Router } from "express";
import { storage } from "../../storage";
import { requireRole } from "../middleware/auth.middleware";
import { sendSuccess, sendNotFound, sendForbidden, sendBadRequest } from "../../lib/api-response";
import { insertZoneSchema } from "@shared/schema";

const router = Router();

router.get("/api/admin/zones", requireRole("ADMIN"), async (req, res) => {
  const zones = await storage.getAllZones(req.companyId as string);
  sendSuccess(res, zones);
});

router.get("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  const zone = await storage.getZone(req.params.id as string);
  if (!zone) return sendNotFound(res, "Zone not found");
  if (req.companyId && zone.companyId !== req.companyId) return sendForbidden(res);
  sendSuccess(res, zone);
});

router.post("/api/admin/zones", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    req.body.companyId = companyId;
    const existing = await storage.getZoneByCode(req.body.code, companyId);
    if (existing) {
      return sendBadRequest(res, "Zone with this code already exists");
    }
    const zone = await storage.createZone(req.body);
    sendSuccess(res, zone);
  } catch (error: unknown) {
    sendBadRequest(res, error instanceof Error ? error.message : "Failed to create zone");
  }
});

router.put("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  const existingZone = await storage.getZone(req.params.id as string);
  if (!existingZone) return sendNotFound(res, "Zone not found");
  if (req.companyId && existingZone.companyId !== req.companyId) return sendForbidden(res);
  const parsed = insertZoneSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "Validation failed");
  }
  const zone = await storage.updateZone(req.params.id as string, parsed.data);
  sendSuccess(res, zone);
});

router.delete("/api/admin/zones/:id", requireRole("ADMIN"), async (req, res) => {
  const existingZone = await storage.getZone(req.params.id as string);
  if (!existingZone) return sendNotFound(res, "Zone not found");
  if (req.companyId && existingZone.companyId !== req.companyId) return sendForbidden(res);
  await storage.deleteZone(req.params.id as string);
  sendSuccess(res, { ok: true });
});

export default router;
