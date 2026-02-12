import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { tenders, tenderPackages, tenderSubmissions, tenderLineItems, tenderLineActivities, tenderLineFiles, tenderLineRisks, suppliers, users, jobs, costCodes, childCostCodes, budgetLines, jobBudgets, documents, documentBundles, documentBundleItems } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

const tenderSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "OPEN", "UNDER_REVIEW", "APPROVED", "CLOSED", "CANCELLED"]).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const submissionSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  coverNote: z.string().nullable().optional(),
  status: z.enum(["SUBMITTED", "REVISED", "APPROVED", "REJECTED"]).optional(),
  subtotal: z.string().nullable().optional(),
  taxAmount: z.string().nullable().optional(),
  totalPrice: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const lineItemSchema = z.object({
  costCodeId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.string().nullable().optional(),
  lineTotal: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

async function getNextTenderNumber(companyId: string): Promise<string> {
  const result = await db
    .select({ tenderNumber: tenders.tenderNumber })
    .from(tenders)
    .where(eq(tenders.companyId, companyId))
    .orderBy(desc(tenders.tenderNumber))
    .limit(1);

  if (result.length === 0) {
    return "TDR-000001";
  }

  const lastNumber = result[0].tenderNumber;
  const match = lastNumber.match(/TDR-(\d+)/);
  if (match) {
    const next = parseInt(match[1], 10) + 1;
    return `TDR-${String(next).padStart(6, "0")}`;
  }
  return "TDR-000001";
}

router.get("/api/tenders", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { jobId, status } = req.query;

    let conditions = [eq(tenders.companyId, companyId)];

    if (jobId && typeof jobId === "string") {
      conditions.push(eq(tenders.jobId, jobId));
    }
    if (status && typeof status === "string") {
      conditions.push(eq(tenders.status, status as any));
    }

    const results = await db
      .select({
        tender: tenders,
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenders)
      .leftJoin(jobs, eq(tenders.jobId, jobs.id))
      .leftJoin(users, eq(tenders.createdById, users.id))
      .where(and(...conditions))
      .orderBy(desc(tenders.createdAt));

    const mapped = results.map((row) => ({
      ...row.tender,
      job: row.job,
      createdBy: row.createdBy,
    }));

    res.json(mapped);
  } catch (error: any) {
    logger.error("Error fetching tenders:", error);
    res.status(500).json({ message: "Failed to fetch tenders" });
  }
});

router.get("/api/tenders/:id", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const result = await db
      .select({
        tender: tenders,
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenders)
      .leftJoin(jobs, eq(tenders.jobId, jobs.id))
      .leftJoin(users, eq(tenders.createdById, users.id))
      .where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ message: "Tender not found" });
    }

    const row = result[0];
    res.json({
      ...row.tender,
      job: row.job,
      createdBy: row.createdBy,
    });
  } catch (error: any) {
    logger.error("Error fetching tender:", error);
    res.status(500).json({ message: "Failed to fetch tender" });
  }
});

router.post("/api/tenders", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const data = tenderSchema.parse(req.body);
    const documentIds: string[] = Array.isArray(req.body.documentIds) ? req.body.documentIds : [];

    const tenderNumber = await getNextTenderNumber(companyId);

    const [result] = await db
      .insert(tenders)
      .values({
        companyId,
        jobId: data.jobId,
        tenderNumber,
        title: data.title,
        description: data.description || null,
        status: data.status || "DRAFT",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
        createdById: userId,
      })
      .returning();

    if (documentIds.length > 0) {
      const validDocs = await db.select({ id: documents.id })
        .from(documents)
        .where(and(
          inArray(documents.id, documentIds),
          eq(documents.companyId, companyId)
        ));
      const validDocIds = validDocs.map(d => d.id);

      if (validDocIds.length > 0) {
        await db.transaction(async (tx) => {
          const qrCodeId = `bundle-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
          const [bundle] = await tx.insert(documentBundles).values({
            companyId,
            bundleName: `Tender ${tenderNumber} - ${data.title}`,
            description: `Document bundle for tender ${tenderNumber}`,
            qrCodeId,
            jobId: data.jobId,
            isPublic: false,
            allowGuestAccess: false,
            createdBy: userId,
          }).returning();

          for (let i = 0; i < validDocIds.length; i++) {
            await tx.insert(documentBundleItems).values({
              bundleId: bundle.id,
              documentId: validDocIds[i],
              sortOrder: i,
              addedBy: userId,
            });
          }

          await tx.insert(tenderPackages).values({
            companyId,
            tenderId: result.id,
            bundleId: bundle.id,
            name: `Tender Documents - ${data.title}`,
            description: `${validDocIds.length} document(s) attached`,
            sortOrder: 0,
          });
        });
      }
    }

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating tender:", error);
    res.status(500).json({ message: "Failed to create tender" });
  }
});

router.patch("/api/tenders/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = tenderSchema.partial().parse(req.body);

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (data.jobId !== undefined) updateData.jobId = data.jobId;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const [result] = await db
      .update(tenders)
      .set(updateData)
      .where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Tender not found" });
    }
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating tender:", error);
    res.status(500).json({ message: "Failed to update tender" });
  }
});

router.delete("/api/tenders/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const submissions = await db
      .select({ id: tenderSubmissions.id })
      .from(tenderSubmissions)
      .where(and(eq(tenderSubmissions.tenderId, req.params.id), eq(tenderSubmissions.companyId, companyId)))
      .limit(1);

    if (submissions.length > 0) {
      return res.status(400).json({ message: "Cannot delete tender with existing submissions" });
    }

    const [deleted] = await db
      .delete(tenders)
      .where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Tender not found" });
    }
    res.json({ message: "Tender deleted", id: deleted.id });
  } catch (error: any) {
    logger.error("Error deleting tender:", error);
    res.status(500).json({ message: "Failed to delete tender" });
  }
});

router.get("/api/tenders/:tenderId/submissions", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const results = await db
      .select({
        submission: tenderSubmissions,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
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
      .orderBy(desc(tenderSubmissions.createdAt));

    const mapped = results.map((row) => ({
      ...row.submission,
      supplier: row.supplier,
      createdBy: row.createdBy,
    }));

    res.json(mapped);
  } catch (error: any) {
    logger.error("Error fetching tender submissions:", error);
    res.status(500).json({ message: "Failed to fetch tender submissions" });
  }
});

router.post("/api/tenders/:tenderId/submissions", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const data = submissionSchema.parse(req.body);

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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating tender submission:", error);
    res.status(500).json({ message: "Failed to create tender submission" });
  }
});

router.patch("/api/tenders/:tenderId/submissions/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = submissionSchema.partial().parse(req.body);

    const updateData: Record<string, any> = { updatedAt: new Date() };

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
      return res.status(404).json({ message: "Tender submission not found" });
    }
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating tender submission:", error);
    res.status(500).json({ message: "Failed to update tender submission" });
  }
});

router.post("/api/tenders/:tenderId/submissions/:id/approve", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;

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
      return res.status(404).json({ message: "Tender submission not found" });
    }
    res.json(result);
  } catch (error: any) {
    logger.error("Error approving tender submission:", error);
    res.status(500).json({ message: "Failed to approve tender submission" });
  }
});

router.get("/api/tenders/:tenderId/submissions/:submissionId/line-items", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

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
      .orderBy(asc(tenderLineItems.sortOrder));

    const mapped = results.map((row) => ({
      ...row.lineItem,
      costCode: row.costCode,
    }));

    res.json(mapped);
  } catch (error: any) {
    logger.error("Error fetching tender line items:", error);
    res.status(500).json({ message: "Failed to fetch tender line items" });
  }
});

router.post("/api/tenders/:tenderId/submissions/:submissionId/line-items", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = lineItemSchema.parse(req.body);

    const [result] = await db
      .insert(tenderLineItems)
      .values({
        companyId,
        tenderSubmissionId: req.params.submissionId,
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

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating tender line item:", error);
    res.status(500).json({ message: "Failed to create tender line item" });
  }
});

router.patch("/api/tenders/:tenderId/submissions/:submissionId/line-items/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = lineItemSchema.partial().parse(req.body);

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId || null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.quantity !== undefined) updateData.quantity = data.quantity || "1";
    if (data.unit !== undefined) updateData.unit = data.unit || "EA";
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice || "0";
    if (data.lineTotal !== undefined) updateData.lineTotal = data.lineTotal || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const [result] = await db
      .update(tenderLineItems)
      .set(updateData)
      .where(and(eq(tenderLineItems.id, req.params.id), eq(tenderLineItems.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Tender line item not found" });
    }
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating tender line item:", error);
    res.status(500).json({ message: "Failed to update tender line item" });
  }
});

router.delete("/api/tenders/:tenderId/submissions/:submissionId/line-items/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const [deleted] = await db
      .delete(tenderLineItems)
      .where(and(eq(tenderLineItems.id, req.params.id), eq(tenderLineItems.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Tender line item not found" });
    }
    res.json({ message: "Tender line item deleted", id: deleted.id });
  } catch (error: any) {
    logger.error("Error deleting tender line item:", error);
    res.status(500).json({ message: "Failed to delete tender line item" });
  }
});

router.get("/api/jobs/:jobId/tenders", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

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
      .orderBy(desc(tenders.createdAt));

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
        .orderBy(desc(tenderSubmissions.createdAt));

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
  } catch (error: any) {
    logger.error("Error fetching job tenders:", error);
    res.status(500).json({ message: "Failed to fetch job tenders" });
  }
});

router.get("/api/jobs/:jobId/tenders/:tenderId/sheet", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const tenderId = req.params.tenderId;

    const [tender] = await db
      .select()
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }

    const [budget] = await db
      .select()
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
      .orderBy(asc(budgetLines.sortOrder));

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
      .orderBy(desc(tenderSubmissions.createdAt));

    const submissionIds = submissions.map(s => s.submission.id);
    let lineItemsBySubmission: Record<string, any[]> = {};

    if (submissionIds.length > 0) {
      const allLineItems = await db
        .select()
        .from(tenderLineItems)
        .where(and(
          inArray(tenderLineItems.tenderSubmissionId, submissionIds),
          eq(tenderLineItems.companyId, companyId),
        ))
        .orderBy(asc(tenderLineItems.sortOrder));

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
      .orderBy(asc(tenderPackages.sortOrder));

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
  } catch (error: any) {
    logger.error("Error fetching tender sheet:", error);
    res.status(500).json({ message: "Failed to fetch tender sheet" });
  }
});

router.post("/api/jobs/:jobId/tenders/:tenderId/submissions/:submissionId/upsert-lines", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { submissionId, tenderId } = req.params;

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
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
      return res.status(404).json({ message: "Submission not found" });
    }

    const schema = z.object({
      lines: z.array(z.object({
        costCodeId: z.string(),
        childCostCodeId: z.string().nullable().optional(),
        amount: z.string(),
      })),
    });

    const { lines } = schema.parse(req.body);

    let finalTotalPrice = "0";

    await db.transaction(async (tx) => {
      const existingItems = await tx
        .select()
        .from(tenderLineItems)
        .where(and(
          eq(tenderLineItems.tenderSubmissionId, submissionId),
          eq(tenderLineItems.companyId, companyId),
        ));

      const existingMap = new Map<string, typeof existingItems[0]>();
      for (const item of existingItems) {
        const key = `${item.costCodeId || ""}:${item.childCostCodeId || ""}`;
        existingMap.set(key, item);
      }

      for (const line of lines) {
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error upserting tender lines:", error);
    res.status(500).json({ message: "Failed to update tender lines" });
  }
});

router.post("/api/jobs/:jobId/tenders/:tenderId/documents", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, jobId } = req.params;

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
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
      return res.status(404).json({ message: "Document bundle not found" });
    }

    const existing = await db
      .select({ id: tenderPackages.id })
      .from(tenderPackages)
      .where(and(
        eq(tenderPackages.tenderId, tenderId),
        eq(tenderPackages.bundleId, data.bundleId),
        eq(tenderPackages.companyId, companyId),
      ));

    if (existing.length > 0) {
      return res.status(400).json({ message: "This bundle is already attached to this tender" });
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error adding tender document:", error);
    res.status(500).json({ message: "Failed to add tender document" });
  }
});

router.delete("/api/jobs/:jobId/tenders/:tenderId/documents/:packageId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, jobId, packageId } = req.params;

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }

    await db.delete(tenderPackages)
      .where(and(
        eq(tenderPackages.id, packageId),
        eq(tenderPackages.tenderId, tenderId),
        eq(tenderPackages.companyId, companyId),
      ));

    res.json({ message: "Document removed from tender" });
  } catch (error: any) {
    logger.error("Error removing tender document:", error);
    res.status(500).json({ message: "Failed to remove tender document" });
  }
});

export const tenderRouter = router;
