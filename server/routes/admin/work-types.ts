import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { sendSuccess, sendBadRequest, sendNotFound } from "../../lib/api-response";
import { insertWorkTypeSchema } from "@shared/schema";

const router = Router();

router.get("/api/work-types", requireAuth, async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return sendBadRequest(res, "Company context required");
  const types = await storage.getActiveWorkTypes(companyId);
  sendSuccess(res, types);
});

router.get("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return sendBadRequest(res, "Company context required");
  const types = await storage.getAllWorkTypes(companyId);
  sendSuccess(res, types);
});

router.post("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const parsed = insertWorkTypeSchema.safeParse({ ...req.body, companyId });
    if (!parsed.success) {
      return sendBadRequest(res, "Invalid work type data");
    }
    const workType = await storage.createWorkType(parsed.data);
    sendSuccess(res, workType);
  } catch (error: unknown) {
    sendBadRequest(res, "An internal error occurred");
  }
});

router.put("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const existing = await storage.getWorkType(parseInt(req.params.id as string));
    if (!existing || existing.companyId !== companyId) {
      return sendNotFound(res, "Work type not found");
    }
    const parsed = insertWorkTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendBadRequest(res, "Invalid work type data");
    }
    const workType = await storage.updateWorkType(parseInt(req.params.id as string), parsed.data);
    if (!workType) {
      return sendNotFound(res, "Work type not found");
    }
    sendSuccess(res, workType);
  } catch (error: unknown) {
    sendBadRequest(res, "An internal error occurred");
  }
});

router.delete("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return sendBadRequest(res, "Company context required");
  const existing = await storage.getWorkType(parseInt(req.params.id as string));
  if (!existing || existing.companyId !== companyId) {
    return sendNotFound(res, "Work type not found");
  }
  await storage.deleteWorkType(parseInt(req.params.id as string));
  sendSuccess(res, { ok: true });
});

export default router;
