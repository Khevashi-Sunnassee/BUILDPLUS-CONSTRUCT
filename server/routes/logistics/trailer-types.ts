import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { sendSuccess, sendNotFound, sendForbidden, sendBadRequest } from "../../lib/api-response";
import { insertTrailerTypeSchema } from "@shared/schema";

const router = Router();

router.get("/api/trailer-types", requireAuth, async (req, res) => {
  const trailerTypes = await storage.getActiveTrailerTypes(req.companyId);
  sendSuccess(res, trailerTypes);
});

router.get("/api/admin/trailer-types", requireRole("ADMIN"), async (req, res) => {
  const trailerTypes = await storage.getAllTrailerTypes(req.companyId);
  sendSuccess(res, trailerTypes);
});

router.post("/api/admin/trailer-types", requireRole("ADMIN"), async (req, res) => {
  if (req.companyId) req.body.companyId = req.companyId;
  const trailerType = await storage.createTrailerType(req.body);
  sendSuccess(res, trailerType);
});

router.put("/api/admin/trailer-types/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await storage.getTrailerType(req.params.id as string);
  if (!existing) return sendNotFound(res, "Trailer type not found");
  if (req.companyId && existing.companyId !== req.companyId) return sendForbidden(res);
  const parsed = insertTrailerTypeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "Validation failed");
  }
  const trailerType = await storage.updateTrailerType(req.params.id as string, parsed.data);
  sendSuccess(res, trailerType);
});

router.delete("/api/admin/trailer-types/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await storage.getTrailerType(req.params.id as string);
  if (!existing) return sendNotFound(res, "Trailer type not found");
  if (req.companyId && existing.companyId !== req.companyId) return sendForbidden(res);
  await storage.deleteTrailerType(req.params.id as string);
  sendSuccess(res, { ok: true });
});

export default router;
