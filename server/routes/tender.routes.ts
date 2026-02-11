import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { tenders, tenderPackages, tenderSubmissions, tenderLineItems, tenderLineActivities, tenderLineFiles, tenderLineRisks, suppliers, users, jobs, costCodes } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

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
    .orderBy(desc(tenders.createdAt))
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
      .where(eq(tenderSubmissions.tenderId, req.params.id))
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

export const tenderRouter = router;
