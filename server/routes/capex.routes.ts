import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { purchaseOrders } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

const router = Router();

const createCapexSchema = z.object({
  jobId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  proposedAssetManagerId: z.string().nullable().optional(),
  approvingManagerId: z.string().nullable().optional(),
  equipmentTitle: z.string().min(1, "Equipment title is required"),
  equipmentCategory: z.string().nullable().optional(),
  equipmentDescription: z.string().nullable().optional(),
  purchaseReasons: z.array(z.string()).optional(),
  isReplacement: z.boolean().optional(),
  replacementAssetId: z.string().nullable().optional(),
  replacementReason: z.string().nullable().optional(),
  totalEquipmentCost: z.string().nullable().optional(),
  transportationCost: z.string().nullable().optional(),
  insuranceCost: z.string().nullable().optional(),
  monthlyMaintenanceCost: z.string().nullable().optional(),
  monthlyResourceCost: z.string().nullable().optional(),
  additionalCosts: z.string().nullable().optional(),
  expectedPaybackPeriod: z.string().nullable().optional(),
  expectedResourceSavings: z.string().nullable().optional(),
  riskAnalysis: z.string().nullable().optional(),
  expectedUsefulLife: z.string().nullable().optional(),
  preferredSupplierId: z.string().nullable().optional(),
  alternativeSuppliers: z.string().nullable().optional(),
  equipmentLocation: z.string().nullable().optional(),
  factoryId: z.string().nullable().optional(),
  factoryZone: z.string().nullable().optional(),
  proximityToInputMaterials: z.string().nullable().optional(),
  siteReadiness: z.string().nullable().optional(),
  newWorkflowDescription: z.string().nullable().optional(),
  safetyConsiderations: z.string().nullable().optional(),
  purchaseOrderId: z.string().nullable().optional(),
});

const rejectCapexSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

router.get("/api/capex-requests", requireAuth, requirePermission("capex_requests"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const status = req.query.status as string | undefined;
    let requests;
    if (status) {
      requests = await storage.getCapexRequestsByStatus(status, companyId);
    } else {
      requests = await storage.getAllCapexRequests(companyId);
    }
    const level = req.permissionLevel;
    if (level === "VIEW_OWN" || level === "VIEW_AND_UPDATE_OWN") {
      const userId = req.session.userId;
      requests = requests.filter((r: any) => r.requestedById === userId);
    }
    res.json(requests);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching CAPEX requests");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch CAPEX requests" });
  }
});

router.get("/api/capex-requests/pending-my-approval", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const companyId = req.companyId;
    if (!userId || !companyId) return res.status(401).json({ error: "Unauthorized" });
    const requests = await storage.getPendingCapexApprovals(userId, companyId);
    res.json(requests);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching pending CAPEX approvals");
    res.status(500).json({ error: "Failed to fetch pending approvals" });
  }
});

router.get("/api/capex-requests/by-po/:poId", requireAuth, requirePermission("capex_requests"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const capex = await storage.getCapexRequestByPurchaseOrder(req.params.poId);
    if (capex && capex.companyId !== companyId) return res.status(403).json({ error: "Forbidden" });
    res.json(capex || null);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching CAPEX by PO");
    res.status(500).json({ error: "Failed to fetch CAPEX request" });
  }
});

router.get("/api/users/approvers", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const type = req.query.type as string;
    if (type === "capex") {
      const approvers = await storage.getCapexApprovers(companyId);
      res.json(approvers);
    } else {
      res.status(400).json({ error: "Invalid approver type" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching approvers");
    res.status(500).json({ error: "Failed to fetch approvers" });
  }
});

router.get("/api/capex-requests/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const capex = await storage.getCapexRequest(req.params.id);
    if (!capex) return res.status(404).json({ error: "CAPEX request not found" });
    if (capex.companyId !== companyId) return res.status(403).json({ error: "Forbidden" });
    res.json(capex);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching CAPEX request");
    res.status(500).json({ error: "Failed to fetch CAPEX request" });
  }
});

router.get("/api/capex-requests/:id/audit-history", requireAuth, async (req, res) => {
  try {
    const events = await storage.getCapexAuditHistory(req.params.id);
    res.json(events);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching CAPEX audit history");
    res.status(500).json({ error: "Failed to fetch audit history" });
  }
});

router.post("/api/capex-requests", requireAuth, requirePermission("capex_requests"), async (req, res) => {
  try {
    const parsed = createCapexSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const capexNumber = await storage.getNextCapexNumber(companyId);
    const user = await storage.getUser(userId);

    const request = await storage.createCapexRequest({
      ...parsed.data,
      companyId,
      capexNumber,
      requestedById: userId,
      status: "DRAFT",
      requestedDate: new Date(),
    });

    await storage.createCapexAuditEvent({
      capexRequestId: request.id,
      eventType: "created",
      actorId: userId,
      actorName: user?.name || user?.email || "Unknown",
      metadata: { equipmentTitle: parsed.data.equipmentTitle },
    });

    const detailed = await storage.getCapexRequest(request.id);
    res.json(detailed);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating CAPEX request");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create CAPEX request" });
  }
});

router.put("/api/capex-requests/:id", requireAuth, requirePermission("capex_requests"), async (req, res) => {
  try {
    const existing = await storage.getCapexRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "CAPEX request not found" });

    const parsed = createCapexSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const userId = req.session.userId!;
    const user = await storage.getUser(userId);

    await storage.updateCapexRequest(req.params.id, parsed.data);

    await storage.createCapexAuditEvent({
      capexRequestId: req.params.id,
      eventType: "edited",
      actorId: userId,
      actorName: user?.name || user?.email || "Unknown",
      metadata: { changes: parsed.data },
    });

    const detailed = await storage.getCapexRequest(req.params.id);
    res.json(detailed);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating CAPEX request");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update CAPEX request" });
  }
});

router.put("/api/capex-requests/:id/submit", requireAuth, async (req, res) => {
  try {
    const existing = await storage.getCapexRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "CAPEX request not found" });
    if (existing.status !== "DRAFT") return res.status(400).json({ error: "Only draft requests can be submitted" });

    const userId = req.session.userId!;
    if (existing.requestedById !== userId) {
      return res.status(403).json({ error: "Only the creator can submit this request" });
    }

    if (!existing.approvingManagerId) {
      return res.status(400).json({ error: "An approving manager must be assigned before submitting" });
    }

    const request = await storage.submitCapexRequest(req.params.id);
    const user = await storage.getUser(userId);

    await storage.createCapexAuditEvent({
      capexRequestId: req.params.id,
      eventType: "submitted",
      actorId: userId,
      actorName: user?.name || user?.email || "Unknown",
      metadata: { totalCost: existing.totalEquipmentCost },
    });

    const detailed = await storage.getCapexRequest(req.params.id);
    res.json(detailed);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error submitting CAPEX request");
    res.status(500).json({ error: "Failed to submit CAPEX request" });
  }
});

router.post("/api/capex-requests/:id/approve", requireAuth, async (req, res) => {
  try {
    const existing = await storage.getCapexRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "CAPEX request not found" });
    if (existing.status !== "SUBMITTED") return res.status(400).json({ error: "Only submitted requests can be approved" });

    const userId = req.session.userId!;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isAdmin = user.role === "ADMIN";
    const isAssignedApprover = existing.approvingManagerId === userId;
    const isCapexApprover = user.capexApprover;

    if (!isAdmin && !isAssignedApprover && !isCapexApprover) {
      return res.status(403).json({ error: "You do not have permission to approve this request" });
    }

    if (!isAdmin && isCapexApprover && user.capexApprovalLimit) {
      const totalCost = parseFloat(existing.totalEquipmentCost || "0");
      const limit = parseFloat(user.capexApprovalLimit);
      if (totalCost > limit) {
        return res.status(403).json({
          error: `Total cost ($${totalCost.toLocaleString()}) exceeds your approval limit ($${limit.toLocaleString()})`,
        });
      }
    }

    const correlationId = crypto.randomUUID();
    const request = await storage.approveCapexRequest(req.params.id, userId);

    await storage.createCapexAuditEvent({
      capexRequestId: req.params.id,
      eventType: "approved",
      actorId: userId,
      actorName: user.name || user.email || "Unknown",
      metadata: { approvalMode: isAdmin ? "admin" : "capex_approver" },
      correlationId,
    });

    if (existing.purchaseOrderId) {
      try {
        await storage.approvePurchaseOrder(existing.purchaseOrderId, userId);
        await storage.createCapexAuditEvent({
          capexRequestId: req.params.id,
          eventType: "linked_po_approved",
          actorId: userId,
          actorName: user.name || user.email || "Unknown",
          metadata: { purchaseOrderId: existing.purchaseOrderId },
          correlationId,
        });
      } catch (poErr) {
        logger.warn({ err: poErr }, "Failed to auto-approve linked PO");
      }
    }

    const detailed = await storage.getCapexRequest(req.params.id);
    res.json(detailed);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error approving CAPEX request");
    res.status(500).json({ error: "Failed to approve CAPEX request" });
  }
});

router.post("/api/capex-requests/:id/reject", requireAuth, async (req, res) => {
  try {
    const existing = await storage.getCapexRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "CAPEX request not found" });
    if (existing.status !== "SUBMITTED") return res.status(400).json({ error: "Only submitted requests can be rejected" });

    const parsed = rejectCapexSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Rejection reason is required" });

    const userId = req.session.userId!;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isAdmin = user.role === "ADMIN";
    const isAssignedApprover = existing.approvingManagerId === userId;
    const isCapexApprover = user.capexApprover;

    if (!isAdmin && !isAssignedApprover && !isCapexApprover) {
      return res.status(403).json({ error: "You do not have permission to reject this request" });
    }

    const request = await storage.rejectCapexRequest(req.params.id, userId, parsed.data.reason);

    await storage.createCapexAuditEvent({
      capexRequestId: req.params.id,
      eventType: "rejected",
      actorId: userId,
      actorName: user.name || user.email || "Unknown",
      metadata: { reason: parsed.data.reason },
    });

    const detailed = await storage.getCapexRequest(req.params.id);
    res.json(detailed);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error rejecting CAPEX request");
    res.status(500).json({ error: "Failed to reject CAPEX request" });
  }
});

router.post("/api/capex-requests/:id/withdraw", requireAuth, async (req, res) => {
  try {
    const existing = await storage.getCapexRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "CAPEX request not found" });
    if (existing.status !== "SUBMITTED") return res.status(400).json({ error: "Only submitted requests can be withdrawn" });

    const userId = req.session.userId!;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isCreator = existing.requestedById === userId;
    const isAdmin = user.role === "ADMIN";
    const isCapexApprover = user.capexApprover;

    if (!isCreator && !isAdmin && !isCapexApprover) {
      return res.status(403).json({ error: "You do not have permission to withdraw this request" });
    }

    const correlationId = crypto.randomUUID();
    const request = await storage.withdrawCapexRequest(req.params.id);

    await storage.createCapexAuditEvent({
      capexRequestId: req.params.id,
      eventType: "withdrawn",
      actorId: userId,
      actorName: user.name || user.email || "Unknown",
      metadata: {},
      correlationId,
    });

    const detailed = await storage.getCapexRequest(req.params.id);
    res.json(detailed);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error withdrawing CAPEX request");
    res.status(500).json({ error: "Failed to withdraw CAPEX request" });
  }
});

router.delete("/api/capex-requests/:id/draft", requireAuth, async (req, res) => {
  try {
    const existing = await storage.getCapexRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "CAPEX request not found" });
    if (existing.status !== "DRAFT") return res.status(400).json({ error: "Only draft requests can be discarded" });

    const userId = req.session.userId!;
    if (existing.requestedById !== userId) {
      return res.status(403).json({ error: "Only the creator can discard this draft" });
    }

    await storage.deleteCapexRequest(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error discarding CAPEX draft");
    res.status(500).json({ error: "Failed to discard draft" });
  }
});

export default router;
