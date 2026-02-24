import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { eq, and, asc, sql, inArray, count } from "drizzle-orm";
import {
  apInvoices, apInvoiceSplits, apInvoiceApprovals,
  myobExportLogs, apInboundEmails, users,
} from "@shared/schema";
import { assignApprovalPathToInvoice } from "../../lib/ap-approval-assign";
import { requireUUID } from "../../lib/api-utils";
import type { SharedDeps } from "./shared";

export function registerWorkflowRoutes(router: Router, deps: SharedDeps): void {
  const { db, logActivity } = deps;

  router.post("/api/ap-invoices/:id/confirm", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });
      if (!["IMPORTED", "PROCESSED"].includes(existing.status)) {
        return res.status(400).json({ error: "Only imported or processed invoices can be confirmed" });
      }

      const missingFields: string[] = [];
      if (!existing.invoiceNumber) missingFields.push("Invoice Number");
      if (!existing.supplierId) missingFields.push("Supplier");
      const totalAmount = parseFloat(existing.totalInc || existing.totalEx || "0");
      if (!totalAmount || totalAmount <= 0) missingFields.push("Amount");

      const invoiceSplits = await db
        .select()
        .from(apInvoiceSplits)
        .where(eq(apInvoiceSplits.invoiceId, id))
        .limit(1000);

      if (invoiceSplits.length === 0) {
        missingFields.push("At least one coding split");
      } else {
        const hasJob = invoiceSplits.some(s => s.jobId);
        if (!hasJob) missingFields.push("Job on at least one coding split");
      }

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Cannot confirm: missing required fields - ${missingFields.join(", ")}`,
          missingFields,
        });
      }

      if (existing.invoiceNumber && existing.supplierId) {
        const totalAmount = existing.totalInc || existing.totalEx || "0";
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const conditions = [
          eq(apInvoices.companyId, companyId),
          eq(apInvoices.invoiceNumber, existing.invoiceNumber!),
          eq(apInvoices.supplierId, existing.supplierId!),
          sql`${apInvoices.id} != ${id}`,
          sql`${apInvoices.status} NOT IN ('REJECTED')`,
        ];

        if (parseFloat(totalAmount) > 0) {
          conditions.push(
            sql`COALESCE(${apInvoices.totalInc}, ${apInvoices.totalEx}, '0') = ${totalAmount}`
          );
        }

        conditions.push(sql`${apInvoices.createdAt} >= ${twentyFourHoursAgo}`);

        const [duplicate] = await db
          .select({ id: apInvoices.id, invoiceNumber: apInvoices.invoiceNumber, status: apInvoices.status })
          .from(apInvoices)
          .where(and(...conditions))
          .limit(1);

        if (duplicate) {
          return res.status(409).json({
            error: "A similar invoice was submitted recently. Please verify this is not a duplicate.",
            duplicateInvoiceId: duplicate.id,
            duplicateStatus: duplicate.status,
          });
        }
      }

      const [updated] = await db
        .update(apInvoices)
        .set({ status: "CONFIRMED", updatedAt: new Date() })
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      await logActivity(id, "confirmed", "Invoice confirmed by data entry clerk", userId);

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error confirming AP invoice");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/:id/submit", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });
      if (existing.status !== "CONFIRMED") {
        return res.status(400).json({ error: "Invoice must be confirmed before submitting for approval" });
      }

      const approvalResult = await assignApprovalPathToInvoice(id, companyId, userId);

      const existingApprovals = await db.select().from(apInvoiceApprovals)
        .where(eq(apInvoiceApprovals.invoiceId, id))
        .limit(100);

      let newStatus: typeof apInvoices.$inferSelect.status;
      if (approvalResult.matched && approvalResult.approverCount === 0) {
        newStatus = "APPROVED";
        await logActivity(id, "auto_approved", "Invoice auto-approved by rule", userId);
      } else if (existingApprovals.length > 0) {
        newStatus = "PARTIALLY_APPROVED";
      } else {
        newStatus = "PARTIALLY_APPROVED";
        logger.warn({ invoiceId: id, companyId }, "No approval path found - submitting as partially approved");
      }

      const [updated] = await db
        .update(apInvoices)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      await logActivity(id, "submitted", `Invoice submitted for approval (${existingApprovals.length} approver(s) via rule: ${approvalResult.ruleName || 'none'})`, userId);

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error submitting AP invoice");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/:id/assign", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const { assigneeUserId } = z.object({ assigneeUserId: z.string() }).parse(req.body);

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const [updated] = await db
        .update(apInvoices)
        .set({ assigneeUserId, updatedAt: new Date() })
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      await logActivity(id, "assigned", `Invoice assigned to user`, userId, { assigneeUserId });

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error assigning AP invoice");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/:id/approve", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const body = z.object({ note: z.string().optional() }).parse(req.body || {});

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const allSteps = await db
        .select()
        .from(apInvoiceApprovals)
        .where(eq(apInvoiceApprovals.invoiceId, id))
        .orderBy(asc(apInvoiceApprovals.stepIndex))
        .limit(1000);

      const currentStep = allSteps.find(s => s.status === "PENDING");

      if (!currentStep) {
        return res.status(400).json({ error: "No pending approval steps for this invoice" });
      }

      if (currentStep.approverUserId !== userId) {
        return res.status(403).json({ error: `It's not your turn to approve. Waiting on step ${currentStep.stepIndex} approver.` });
      }

      const invoiceTotal = parseFloat(existing.totalInc || "0");
      if (invoiceTotal > 0) {
        const [approver] = await db
          .select({ poApprovalLimit: users.poApprovalLimit })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const limit = parseFloat(approver?.poApprovalLimit || "0");
        if (limit > 0 && invoiceTotal > limit) {
          return res.status(403).json({
            error: `Invoice amount exceeds your approval limit of $${limit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Requires approval from a user with higher limit.`,
          });
        }
      }

      await db
        .update(apInvoiceApprovals)
        .set({ status: "APPROVED", decisionAt: new Date(), note: body.note || null })
        .where(eq(apInvoiceApprovals.id, currentStep.id));

      const remainingPending = await db
        .select({ cnt: count() })
        .from(apInvoiceApprovals)
        .where(
          and(
            eq(apInvoiceApprovals.invoiceId, id),
            eq(apInvoiceApprovals.status, "PENDING"),
          )
        );

      const allApproved = (remainingPending[0]?.cnt || 0) === 0;
      const newStatus = allApproved ? "APPROVED" : "PARTIALLY_APPROVED";

      const [updated] = await db
        .update(apInvoices)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      const totalSteps = allSteps.length;
      const completedSteps = allSteps.filter(s => s.status === "APPROVED").length + 1;
      const stepMessage = allApproved
        ? `Invoice fully approved (all ${totalSteps} steps completed)`
        : `Approval step ${completedSteps} of ${totalSteps} completed by approver`;

      await logActivity(id, "approved", stepMessage, userId, { note: body.note, stepIndex: currentStep.stepIndex, totalSteps, completedSteps });

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error approving AP invoice");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/:id/reject", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const body = z.object({ note: z.string().min(1, "Rejection note is required") }).parse(req.body);

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const [updated] = await db
        .update(apInvoices)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      const pendingApprovals = await db
        .select()
        .from(apInvoiceApprovals)
        .where(
          and(
            eq(apInvoiceApprovals.invoiceId, id),
            eq(apInvoiceApprovals.approverUserId, userId),
            eq(apInvoiceApprovals.status, "PENDING"),
          )
        )
        .limit(1000);

      for (const approval of pendingApprovals) {
        await db
          .update(apInvoiceApprovals)
          .set({ status: "REJECTED", decisionAt: new Date(), note: body.note })
          .where(eq(apInvoiceApprovals.id, approval.id));
      }

      await logActivity(id, "rejected", `Invoice rejected: ${body.note}`, userId, { note: body.note });

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error rejecting AP invoice");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/:id/on-hold", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const newValue = !existing.isOnHold;
      const updateData: Record<string, any> = { isOnHold: newValue, updatedAt: new Date() };

      if (newValue) {
        updateData.status = "ON_HOLD";
      } else {
        const previousStatus = existing.status === "ON_HOLD"
          ? (existing.totalInc ? "PROCESSED" : "IMPORTED")
          : existing.status;
        updateData.status = previousStatus;
      }

      const [updated] = await db
        .update(apInvoices)
        .set(updateData)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      await logActivity(id, "on_hold_toggled", newValue ? `Invoice placed on hold (was ${existing.status})` : `Invoice taken off hold (restored to ${updateData.status})`, userId);

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error toggling AP invoice on-hold");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/:id/urgent", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const newValue = !existing.isUrgent;
      const [updated] = await db
        .update(apInvoices)
        .set({ isUrgent: newValue, updatedAt: new Date() })
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .returning();

      await logActivity(id, "urgent_toggled", newValue ? "Invoice marked as urgent" : "Invoice unmarked as urgent", userId);

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error toggling AP invoice urgent");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-invoices/bulk-approve", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const userId = req.session.userId!;

      const body = z.object({ invoiceIds: z.array(z.string()).min(1) }).parse(req.body);

      const invoices = await db
        .select()
        .from(apInvoices)
        .where(
          and(
            eq(apInvoices.companyId, companyId),
            inArray(apInvoices.id, body.invoiceIds),
          )
        )
        .limit(1000);

      const [approverUser] = await db
        .select({ poApprovalLimit: users.poApprovalLimit })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const userLimit = parseFloat(approverUser?.poApprovalLimit || "0");

      const approved: string[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const invoice of invoices) {
        try {
          const invTotal = parseFloat(invoice.totalInc || "0");
          if (userLimit > 0 && invTotal > 0 && invTotal > userLimit) {
            errors.push({ id: invoice.id, error: `Invoice amount $${invTotal.toFixed(2)} exceeds your approval limit of $${userLimit.toFixed(2)}` });
            continue;
          }

          const allSteps = await db
            .select()
            .from(apInvoiceApprovals)
            .where(eq(apInvoiceApprovals.invoiceId, invoice.id))
            .orderBy(asc(apInvoiceApprovals.stepIndex))
            .limit(1000);

          const currentStep = allSteps.find(s => s.status === "PENDING");

          if (!currentStep) {
            errors.push({ id: invoice.id, error: "No pending approval steps" });
            continue;
          }

          if (currentStep.approverUserId !== userId) {
            errors.push({ id: invoice.id, error: "Not your turn to approve this invoice" });
            continue;
          }

          await db
            .update(apInvoiceApprovals)
            .set({ status: "APPROVED", decisionAt: new Date() })
            .where(eq(apInvoiceApprovals.id, currentStep.id));

          const remainingPending = allSteps.filter(s => s.status === "PENDING" && s.id !== currentStep.id);
          const allDone = remainingPending.length === 0;

          if (allDone) {
            await db
              .update(apInvoices)
              .set({ status: "APPROVED", updatedAt: new Date() })
              .where(eq(apInvoices.id, invoice.id));
          }

          const totalSteps = allSteps.length;
          const completedNow = allSteps.filter(s => s.status === "APPROVED").length + 1;
          await logActivity(
            invoice.id,
            "approved",
            allDone
              ? `Invoice bulk approved (all ${totalSteps} steps completed)`
              : `Bulk approval step ${completedNow} of ${totalSteps} completed`,
            userId
          );
          approved.push(invoice.id);
        } catch (err) {
          errors.push({ id: invoice.id, error: "Failed to approve" });
        }
      }

      res.json({ approved, errors });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error bulk approving AP invoices");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.delete("/api/ap-invoices/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      await db.delete(apInboundEmails).where(eq(apInboundEmails.invoiceId, id));
      await db.delete(myobExportLogs).where(eq(myobExportLogs.invoiceId, id));
      await db.delete(apInvoices).where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)));

      res.json({ success: true });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error deleting AP invoice");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });
}
