import { Router } from "express";
import { storage } from "../../storage";
import { requireRoleOrSuperAdmin } from "../middleware/auth.middleware";
import { sendSuccess, sendBadRequest, sendNotFound } from "../../lib/api-response";
import { insertDeviceSchema } from "@shared/schema";

const router = Router();

router.get("/api/admin/devices", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return sendBadRequest(res, "Company context required");
  const filtered = await storage.getAllDevices(companyId);
  sendSuccess(res, filtered);
});

router.post("/api/admin/devices", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  const { userId, deviceName } = req.body;
  const companyId = req.companyId;
  if (!companyId) return sendBadRequest(res, "Company context required");
  const { device, deviceKey } = await storage.createDevice({ userId, deviceName, os: "Windows", companyId });
  sendSuccess(res, { deviceId: device.id, deviceKey });
});

router.patch("/api/admin/devices/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  const existing = await storage.getDevice(req.params.id as string);
  if (!existing || existing.companyId !== companyId) {
    return sendNotFound(res, "Device not found");
  }
  const parsed = insertDeviceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "Validation failed");
  }
  const device = await storage.updateDevice(req.params.id as string, parsed.data as Record<string, unknown>);
  sendSuccess(res, device);
});

router.delete("/api/admin/devices/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  const existing = await storage.getDevice(req.params.id as string);
  if (!existing || existing.companyId !== companyId) {
    return sendNotFound(res, "Device not found");
  }
  await storage.deleteDevice(req.params.id as string);
  sendSuccess(res, { ok: true });
});

export default router;
