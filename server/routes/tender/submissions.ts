import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenderSubmissions, tenderLineItems, tenderInboundEmails, tenderEmailExtractedFields, suppliers, users, costCodes } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import {
  isValidId,
  verifyTenderOwnership,
  verifySubmissionOwnership,
  verifyTenderEditable,
  submissionSchema,
  lineItemSchema,
} from "./shared";

const router = Router();

router.get("/api/tenders/:tenderId/submissions", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, req.params.tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        submission: tenderSubmissions,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          keyContact: suppliers.keyContact,
          defaultCostCodeId: suppliers.defaultCostCodeId,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenderSubmissions)
      .leftJoin(suppliers, eq(tenderSubmissions.supplierId, suppliers.id))
      .leftJoin(users, eq(tenderSubmissions.createdById, users.id))
      .where(and(eq(tenderSubmissions.tenderId, req.params.tenderId), eq(tenderSubmissions.companyId, companyId)))
      .orderBy(desc(tenderSubmissions.createdAt))
      .limit(50);

    const submissionIds = results.map(r => r.submission.id);

    let emailsBySubmission = new Map<string, { fromAddress: string; subject: string | null; createdAt: Date }>();
    let extractedBySubmission = new Map<string, Array<{ fieldKey: string; fieldValue: string | null }>>();

    if (submissionIds.length > 0) {
      const linkedEmails = await db.select({
        tenderSubmissionId: tenderInboundEmails.tenderSubmissionId,
        fromAddress: tenderInboundEmails.fromAddress,
        subject: tenderInboundEmails.subject,
        createdAt: tenderInboundEmails.createdAt,
        id: tenderInboundEmails.id,
      })
        .from(tenderInboundEmails)
        .where(and(
          inArray(tenderInboundEmails.tenderSubmissionId, submissionIds),
          eq(tenderInboundEmails.companyId, companyId)
        ))
        .limit(200);

      for (const le of linkedEmails) {
        if (le.tenderSubmissionId) {
          emailsBySubmission.set(le.tenderSubmissionId, {
            fromAddress: le.fromAddress,
            subject: le.subject,
            createdAt: le.createdAt,
          });
        }
      }

      const emailIds = linkedEmails.map(e => e.id);
      if (emailIds.length > 0) {
        const extractedFields = await db.select({
          inboundEmailId: tenderEmailExtractedFields.inboundEmailId,
          fieldKey: tenderEmailExtractedFields.fieldKey,
          fieldValue: tenderEmailExtractedFields.fieldValue,
        })
          .from(tenderEmailExtractedFields)
          .where(inArray(tenderEmailExtractedFields.inboundEmailId, emailIds))
          .limit(500);

        const emailToSubmission = new Map<string, string>();
        for (const le of linkedEmails) {
          if (le.tenderSubmissionId) emailToSubmission.set(le.id, le.tenderSubmissionId);
        }

        for (const ef of extractedFields) {
          const subId = emailToSubmission.get(ef.inboundEmailId);
          if (subId) {
            if (!extractedBySubmission.has(subId)) extractedBySubmission.set(subId, []);
            extractedBySubmission.get(subId)!.push({ fieldKey: ef.fieldKey, fieldValue: ef.fieldValue });
          }
        }
      }
    }

    const costCodeIds = [...new Set(results.map(r => r.supplier?.defaultCostCodeId).filter(Boolean))] as string[];
    let costCodeMap = new Map<string, { code: string; name: string }>();
    if (costCodeIds.length > 0) {
      const codes = await db.select({ id: costCodes.id, code: costCodes.code, name: costCodes.name })
        .from(costCodes)
        .where(and(inArray(costCodes.id, costCodeIds), eq(costCodes.companyId, companyId)))
        .limit(100);
      for (const c of codes) {
        costCodeMap.set(c.id, { code: c.code, name: c.name });
      }
    }

    const mapped = results.map((row) => {
      const supplierCostCode = row.supplier?.defaultCostCodeId ? costCodeMap.get(row.supplier.defaultCostCodeId) : null;
      const sourceEmail = emailsBySubmission.get(row.submission.id) || null;
      const extracted = extractedBySubmission.get(row.submission.id) || [];

      const extractedMap: Record<string, string | null> = {};
      for (const ef of extracted) {
        extractedMap[ef.fieldKey] = ef.fieldValue;
      }

      return {
        ...row.submission,
        supplier: row.supplier,
        supplierTrade: supplierCostCode ? `${supplierCostCode.code} - ${supplierCostCode.name}` : null,
        createdBy: row.createdBy,
        sourceEmail: sourceEmail ? {
          fromAddress: sourceEmail.fromAddress,
          subject: sourceEmail.subject,
          receivedAt: sourceEmail.createdAt,
        } : null,
        extractedFields: Object.keys(extractedMap).length > 0 ? extractedMap : null,
      };
    });

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender submissions:", error);
    res.status(500).json({ message: "Failed to fetch tender submissions", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:tenderId/submissions", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    if (!isValidId(req.params.tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });
    const data = submissionSchema.parse(req.body);

    const { editable, tender } = await verifyTenderEditable(companyId, req.params.tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, data.supplierId), eq(suppliers.companyId, companyId)));
    if (!supplier) return res.status(400).json({ message: "Supplier not found", code: "VALIDATION_ERROR" });

    const [result] = await db
      .insert(tenderSubmissions)
      .values({
        companyId,
        tenderId: req.params.tenderId,
        supplierId: data.supplierId,
        coverNote: data.coverNote || null,
        status: data.status || "SUBMITTED",
        subtotal: data.subtotal || "0",
        taxAmount: data.taxAmount || "0",
        totalPrice: data.totalPrice || "0",
        notes: data.notes || null,
        createdById: userId,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error creating tender submission:", error);
    res.status(500).json({ message: "Failed to create tender submission", code: "INTERNAL_ERROR" });
  }
});

router.patch("/api/tenders/:tenderId/submissions/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.tenderId) || !isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifySubmissionOwnership(companyId, req.params.tenderId, req.params.id))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const data = submissionSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.coverNote !== undefined) updateData.coverNote = data.coverNote || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal || "0";
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount || "0";
    if (data.totalPrice !== undefined) updateData.totalPrice = data.totalPrice || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const [result] = await db
      .update(tenderSubmissions)
      .set(updateData)
      .where(and(eq(tenderSubmissions.id, req.params.id), eq(tenderSubmissions.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Tender submission not found", code: "NOT_FOUND" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error updating tender submission:", error);
    res.status(500).json({ message: "Failed to update tender submission", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:tenderId/submissions/:id/approve", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    if (!isValidId(req.params.tenderId) || !isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifySubmissionOwnership(companyId, req.params.tenderId, req.params.id))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const [result] = await db
      .update(tenderSubmissions)
      .set({
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tenderSubmissions.id, req.params.id), eq(tenderSubmissions.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Tender submission not found", code: "NOT_FOUND" });
    }
    res.json(result);
  } catch (error: unknown) {
    logger.error("Error approving tender submission:", error);
    res.status(500).json({ message: "Failed to approve tender submission", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:tenderId/submissions/:submissionId/line-items", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.tenderId) || !isValidId(req.params.submissionId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifySubmissionOwnership(companyId, req.params.tenderId, req.params.submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        lineItem: tenderLineItems,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
      })
      .from(tenderLineItems)
      .leftJoin(costCodes, eq(tenderLineItems.costCodeId, costCodes.id))
      .where(and(eq(tenderLineItems.tenderSubmissionId, req.params.submissionId), eq(tenderLineItems.companyId, companyId)))
      .orderBy(asc(tenderLineItems.sortOrder))
      .limit(500);

    const mapped = results.map((row) => ({
      ...row.lineItem,
      costCode: row.costCode,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender line items:", error);
    res.status(500).json({ message: "Failed to fetch tender line items", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:tenderId/submissions/:submissionId/line-items", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, submissionId } = req.params;
    if (!isValidId(tenderId) || !isValidId(submissionId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender } = await verifyTenderEditable(companyId, tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    if (!(await verifySubmissionOwnership(companyId, tenderId, submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const data = lineItemSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      const [lineItem] = await tx
        .insert(tenderLineItems)
        .values({
          companyId,
          tenderSubmissionId: submissionId,
          costCodeId: data.costCodeId || null,
          description: data.description,
          quantity: data.quantity || "1",
          unit: data.unit || "EA",
          unitPrice: data.unitPrice || "0",
          lineTotal: data.lineTotal || "0",
          notes: data.notes || null,
          sortOrder: data.sortOrder ?? 0,
        })
        .returning();

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(eq(tenderLineItems.tenderSubmissionId, submissionId), eq(tenderLineItems.companyId, companyId)));
      await tx.update(tenderSubmissions).set({ totalPrice: totalResult[0]?.total || "0", subtotal: totalResult[0]?.total || "0", updatedAt: new Date() })
        .where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.companyId, companyId)));

      return lineItem;
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error creating tender line item:", error);
    res.status(500).json({ message: "Failed to create tender line item", code: "INTERNAL_ERROR" });
  }
});

router.patch("/api/tenders/:tenderId/submissions/:submissionId/line-items/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, submissionId, id } = req.params;
    if (!isValidId(tenderId) || !isValidId(submissionId) || !isValidId(id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender } = await verifyTenderEditable(companyId, tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    if (!(await verifySubmissionOwnership(companyId, tenderId, submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const data = lineItemSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId || null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.quantity !== undefined) updateData.quantity = data.quantity || "1";
    if (data.unit !== undefined) updateData.unit = data.unit || "EA";
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice || "0";
    if (data.lineTotal !== undefined) updateData.lineTotal = data.lineTotal || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const result = await db.transaction(async (tx) => {
      const [lineItem] = await tx
        .update(tenderLineItems)
        .set(updateData)
        .where(and(eq(tenderLineItems.id, id), eq(tenderLineItems.companyId, companyId)))
        .returning();

      if (!lineItem) return null;

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(eq(tenderLineItems.tenderSubmissionId, submissionId), eq(tenderLineItems.companyId, companyId)));
      await tx.update(tenderSubmissions).set({ totalPrice: totalResult[0]?.total || "0", subtotal: totalResult[0]?.total || "0", updatedAt: new Date() })
        .where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.companyId, companyId)));

      return lineItem;
    });

    if (!result) {
      return res.status(404).json({ message: "Tender line item not found", code: "NOT_FOUND" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error updating tender line item:", error);
    res.status(500).json({ message: "Failed to update tender line item", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/tenders/:tenderId/submissions/:submissionId/line-items/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, submissionId, id } = req.params;
    if (!isValidId(tenderId) || !isValidId(submissionId) || !isValidId(id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender } = await verifyTenderEditable(companyId, tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    if (!(await verifySubmissionOwnership(companyId, tenderId, submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const result = await db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(tenderLineItems)
        .where(and(eq(tenderLineItems.id, id), eq(tenderLineItems.companyId, companyId)))
        .returning();

      if (!deleted) return null;

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(eq(tenderLineItems.tenderSubmissionId, submissionId), eq(tenderLineItems.companyId, companyId)));
      await tx.update(tenderSubmissions).set({ totalPrice: totalResult[0]?.total || "0", subtotal: totalResult[0]?.total || "0", updatedAt: new Date() })
        .where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.companyId, companyId)));

      return deleted;
    });

    if (!result) {
      return res.status(404).json({ message: "Tender line item not found", code: "NOT_FOUND" });
    }
    res.json({ message: "Tender line item deleted", id: result.id });
  } catch (error: unknown) {
    logger.error("Error deleting tender line item:", error);
    res.status(500).json({ message: "Failed to delete tender line item", code: "INTERNAL_ERROR" });
  }
});

export default router;
