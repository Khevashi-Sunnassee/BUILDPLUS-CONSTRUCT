import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenders, tenderPackages, tenderSubmissions, tenderLineItems, suppliers, users, jobs, costCodes, childCostCodes, budgetLines, jobBudgets, documents, documentBundles } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { isValidId, verifyTenderEditable } from "./shared";

const router = Router();

router.get("/api/jobs/:jobId/tenders", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    if (!isValidId(jobId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const results = await db
      .select({
        tender: tenders,
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenders)
      .leftJoin(users, eq(tenders.createdById, users.id))
      .where(and(eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)))
      .orderBy(desc(tenders.createdAt))
      .limit(100);

    const tenderIds = results.map(r => r.tender.id);
    let submissionsByTender: Record<string, any[]> = {};

    if (tenderIds.length > 0) {
      const allSubmissions = await db
        .select({
          submission: tenderSubmissions,
          supplier: {
            id: suppliers.id,
            name: suppliers.name,
          },
        })
        .from(tenderSubmissions)
        .leftJoin(suppliers, eq(tenderSubmissions.supplierId, suppliers.id))
        .where(and(
          inArray(tenderSubmissions.tenderId, tenderIds),
          eq(tenderSubmissions.companyId, companyId),
        ))
        .orderBy(desc(tenderSubmissions.createdAt))
        .limit(1000);

      for (const row of allSubmissions) {
        const tid = row.submission.tenderId;
        if (!submissionsByTender[tid]) submissionsByTender[tid] = [];
        submissionsByTender[tid].push({
          ...row.submission,
          supplier: row.supplier,
        });
      }
    }

    const mapped = results.map((row) => ({
      ...row.tender,
      createdBy: row.createdBy,
      submissions: submissionsByTender[row.tender.id] || [],
      submissionCount: (submissionsByTender[row.tender.id] || []).length,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching job tenders:", error);
    res.status(500).json({ message: "Failed to fetch job tenders", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/jobs/:jobId/tenders/:tenderId/sheet", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const tenderId = req.params.tenderId;
    if (!isValidId(jobId) || !isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [tender] = await db
      .select({
        id: tenders.id,
        jobId: tenders.jobId,
        tenderNumber: tenders.tenderNumber,
        title: tenders.title,
        description: tenders.description,
        status: tenders.status,
        dueDate: tenders.dueDate,
        notes: tenders.notes,
        companyId: tenders.companyId,
        createdById: tenders.createdById,
        createdAt: tenders.createdAt,
      })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    const [budget] = await db
      .select({ id: jobBudgets.id })
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.json({ tender, budgetLines: [], submissions: [], lineItems: {} });
    }

    const lines = await db
      .select({
        line: budgetLines,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
        childCostCode: {
          id: childCostCodes.id,
          code: childCostCodes.code,
          name: childCostCodes.name,
        },
      })
      .from(budgetLines)
      .innerJoin(costCodes, eq(budgetLines.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(budgetLines.childCostCodeId, childCostCodes.id))
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)))
      .orderBy(asc(budgetLines.sortOrder))
      .limit(5000);

    const submissions = await db
      .select({
        submission: tenderSubmissions,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(tenderSubmissions)
      .leftJoin(suppliers, eq(tenderSubmissions.supplierId, suppliers.id))
      .where(and(eq(tenderSubmissions.tenderId, tenderId), eq(tenderSubmissions.companyId, companyId)))
      .orderBy(desc(tenderSubmissions.createdAt))
      .limit(1000);

    const submissionIds = submissions.map(s => s.submission.id);
    let lineItemsBySubmission: Record<string, any[]> = {};

    if (submissionIds.length > 0) {
      const allLineItems = await db
        .select({
          id: tenderLineItems.id,
          tenderSubmissionId: tenderLineItems.tenderSubmissionId,
          costCodeId: tenderLineItems.costCodeId,
          childCostCodeId: tenderLineItems.childCostCodeId,
          lineTotal: tenderLineItems.lineTotal,
          unitPrice: tenderLineItems.unitPrice,
          quantity: tenderLineItems.quantity,
          unit: tenderLineItems.unit,
          sortOrder: tenderLineItems.sortOrder,
        })
        .from(tenderLineItems)
        .where(and(
          inArray(tenderLineItems.tenderSubmissionId, submissionIds),
          eq(tenderLineItems.companyId, companyId),
        ))
        .orderBy(asc(tenderLineItems.sortOrder))
        .limit(5000);

      for (const item of allLineItems) {
        if (!lineItemsBySubmission[item.tenderSubmissionId]) {
          lineItemsBySubmission[item.tenderSubmissionId] = [];
        }
        lineItemsBySubmission[item.tenderSubmissionId].push(item);
      }
    }

    const mappedLines = lines.map((row) => ({
      ...row.line,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
    }));

    const mappedSubmissions = submissions.map((row) => ({
      ...row.submission,
      supplier: row.supplier,
      lineItems: lineItemsBySubmission[row.submission.id] || [],
    }));

    const packages = await db
      .select({
        pkg: tenderPackages,
        document: {
          id: documents.id,
          title: documents.title,
          documentNumber: documents.documentNumber,
          fileName: documents.fileName,
        },
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          description: documentBundles.description,
        },
      })
      .from(tenderPackages)
      .leftJoin(documents, eq(tenderPackages.documentId, documents.id))
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder))
      .limit(1000);

    const mappedPackages = packages.map(p => ({
      ...p.pkg,
      document: p.document?.id ? p.document : null,
      bundle: p.bundle?.id ? p.bundle : null,
    }));

    res.json({
      tender,
      budgetLines: mappedLines,
      submissions: mappedSubmissions,
      documents: mappedPackages,
    });
  } catch (error: unknown) {
    logger.error("Error fetching tender sheet:", error);
    res.status(500).json({ message: "Failed to fetch tender sheet", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/jobs/:jobId/tenders/:tenderId/submissions/:submissionId/upsert-lines", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { submissionId, tenderId, jobId } = req.params;
    if (!isValidId(jobId) || !isValidId(tenderId) || !isValidId(submissionId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender: tenderRecord } = await verifyTenderEditable(companyId, tenderId);
    if (!tenderRecord) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tenderRecord.status}`, code: "STATUS_LOCKED" });
    }

    const [submission] = await db
      .select({ id: tenderSubmissions.id })
      .from(tenderSubmissions)
      .where(and(
        eq(tenderSubmissions.id, submissionId),
        eq(tenderSubmissions.tenderId, tenderId),
        eq(tenderSubmissions.companyId, companyId),
      ));

    if (!submission) {
      return res.status(404).json({ message: "Submission not found", code: "NOT_FOUND" });
    }

    const schema = z.object({
      lines: z.array(z.object({
        costCodeId: z.string(),
        childCostCodeId: z.string().nullable().optional(),
        amount: z.string(),
      })),
    });

    const { lines: linesData } = schema.parse(req.body);

    let finalTotalPrice = "0";

    await db.transaction(async (tx) => {
      const existingItems = await tx
        .select()
        .from(tenderLineItems)
        .where(and(
          eq(tenderLineItems.tenderSubmissionId, submissionId),
          eq(tenderLineItems.companyId, companyId),
        ))
        .limit(5000);

      const existingMap = new Map<string, typeof existingItems[0]>();
      for (const item of existingItems) {
        const key = `${item.costCodeId || ""}:${item.childCostCodeId || ""}`;
        existingMap.set(key, item);
      }

      for (const line of linesData) {
        const amount = parseFloat(line.amount) || 0;
        const key = `${line.costCodeId}:${line.childCostCodeId || ""}`;
        const existing = existingMap.get(key);

        if (amount === 0 && existing) {
          await tx.delete(tenderLineItems).where(eq(tenderLineItems.id, existing.id));
        } else if (amount !== 0 && existing) {
          await tx.update(tenderLineItems)
            .set({
              lineTotal: String(amount),
              unitPrice: String(amount),
              updatedAt: new Date(),
            })
            .where(eq(tenderLineItems.id, existing.id));
        } else if (amount !== 0) {
          await tx.insert(tenderLineItems).values({
            companyId,
            tenderSubmissionId: submissionId,
            costCodeId: line.costCodeId,
            childCostCodeId: line.childCostCodeId || null,
            description: "Tender amount",
            quantity: "1",
            unit: "EA",
            unitPrice: String(amount),
            lineTotal: String(amount),
          });
        }
      }

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(
          eq(tenderLineItems.tenderSubmissionId, submissionId),
          eq(tenderLineItems.companyId, companyId),
        ));
      finalTotalPrice = totalResult[0]?.total || "0";

      await tx.update(tenderSubmissions)
        .set({
          totalPrice: finalTotalPrice,
          subtotal: finalTotalPrice,
          updatedAt: new Date(),
        })
        .where(and(
          eq(tenderSubmissions.id, submissionId),
          eq(tenderSubmissions.companyId, companyId),
        ));
    });

    res.json({ message: "Lines updated", totalPrice: finalTotalPrice });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error upserting tender lines:", error);
    res.status(500).json({ message: "Failed to update tender lines", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/jobs/:jobId/tenders/:tenderId/documents", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, jobId } = req.params;
    if (!isValidId(jobId) || !isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender: tenderRecord } = await verifyTenderEditable(companyId, tenderId);
    if (!tenderRecord) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tenderRecord.status}`, code: "STATUS_LOCKED" });
    }

    const [tenderJobCheck] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tenderJobCheck) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    const schema = z.object({
      bundleId: z.string().min(1, "Bundle is required"),
    });

    const data = schema.parse(req.body);

    const [bundle] = await db
      .select({ id: documentBundles.id, bundleName: documentBundles.bundleName })
      .from(documentBundles)
      .where(and(eq(documentBundles.id, data.bundleId), eq(documentBundles.companyId, companyId)));

    if (!bundle) {
      return res.status(404).json({ message: "Document bundle not found", code: "NOT_FOUND" });
    }

    const existing = await db
      .select({ id: tenderPackages.id })
      .from(tenderPackages)
      .where(and(
        eq(tenderPackages.tenderId, tenderId),
        eq(tenderPackages.bundleId, data.bundleId),
        eq(tenderPackages.companyId, companyId),
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ message: "This bundle is already attached to this tender", code: "DUPLICATE" });
    }

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${tenderPackages.sortOrder}), -1)` })
      .from(tenderPackages)
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)));

    const [pkg] = await db.insert(tenderPackages).values({
      companyId,
      tenderId,
      bundleId: data.bundleId,
      name: bundle.bundleName,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    }).returning();

    res.json(pkg);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error adding tender document:", error);
    res.status(500).json({ message: "Failed to add tender document", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/jobs/:jobId/tenders/:tenderId/documents/:packageId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, jobId, packageId } = req.params;
    if (!isValidId(jobId) || !isValidId(tenderId) || !isValidId(packageId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    await db.delete(tenderPackages)
      .where(and(
        eq(tenderPackages.id, packageId),
        eq(tenderPackages.tenderId, tenderId),
        eq(tenderPackages.companyId, companyId),
      ));

    res.json({ message: "Document removed from tender" });
  } catch (error: unknown) {
    logger.error("Error removing tender document:", error);
    res.status(500).json({ message: "Failed to remove tender document", code: "INTERNAL_ERROR" });
  }
});

export default router;
