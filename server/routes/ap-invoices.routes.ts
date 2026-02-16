import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { eq, and, desc, asc, sql, ilike, or, inArray, count } from "drizzle-orm";
import multer from "multer";
import crypto from "crypto";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import {
  apInvoices, apInvoiceDocuments, apInvoiceExtractedFields,
  apInvoiceSplits, apInvoiceActivity, apInvoiceComments,
  apInvoiceApprovals, apApprovalRules, users, suppliers,
  costCodes, jobs, companies, myobExportLogs, apInboundEmails
} from "@shared/schema";
import type { ApApprovalCondition } from "@shared/schema";
import { assignApprovalPathToInvoice, reassignApprovalPathsForCompany } from "../lib/ap-approval-assign";

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    cb(null, allowed.includes(file.mimetype));
  },
});

async function logActivity(invoiceId: string, type: string, message: string, actorUserId: string, meta?: any) {
  await db.insert(apInvoiceActivity).values({
    invoiceId,
    activityType: type,
    message,
    actorUserId,
    metaJson: meta || null,
  });
}

const assigneeUser = db.$with("assignee_user").as(
  db.select({ id: users.id, name: users.name, email: users.email }).from(users)
);
const creatorUser = db.$with("creator_user").as(
  db.select({ id: users.id, name: users.name, email: users.email }).from(users)
);

router.get("/api/ap-invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const assignee = req.query.assignee as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = (req.query.sortOrder as string || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(apInvoices.companyId, companyId)];

    if (status) {
      conditions.push(eq(apInvoices.status, status as any));
    }
    if (supplierId) {
      conditions.push(eq(apInvoices.supplierId, supplierId));
    }
    if (assignee) {
      conditions.push(eq(apInvoices.assigneeUserId, assignee));
    }
    if (q) {
      const search = `%${q}%`;
      conditions.push(
        or(
          ilike(apInvoices.invoiceNumber, search),
          ilike(apInvoices.description, search),
          ilike(suppliers.name, search),
        )
      );
    }

    const whereClause = and(...conditions);

    const supplierAlias = suppliers;
    const assigneeAlias = users;

    const [invoiceRows, countResult] = await Promise.all([
      db
        .select({
          id: apInvoices.id,
          companyId: apInvoices.companyId,
          supplierId: apInvoices.supplierId,
          invoiceNumber: apInvoices.invoiceNumber,
          invoiceDate: apInvoices.invoiceDate,
          dueDate: apInvoices.dueDate,
          description: apInvoices.description,
          totalEx: apInvoices.totalEx,
          totalTax: apInvoices.totalTax,
          totalInc: apInvoices.totalInc,
          currency: apInvoices.currency,
          status: apInvoices.status,
          assigneeUserId: apInvoices.assigneeUserId,
          createdByUserId: apInvoices.createdByUserId,
          uploadedAt: apInvoices.uploadedAt,
          riskScore: apInvoices.riskScore,
          isUrgent: apInvoices.isUrgent,
          isOnHold: apInvoices.isOnHold,
          postPeriod: apInvoices.postPeriod,
          createdAt: apInvoices.createdAt,
          updatedAt: apInvoices.updatedAt,
          supplierName: suppliers.name,
          assigneeName: sql<string>`COALESCE(assignee_u.name, (
            SELECT u2.name FROM ap_invoice_approvals aia
            JOIN users u2 ON aia.approver_user_id = u2.id
            WHERE aia.invoice_id = ${apInvoices.id} AND aia.status = 'PENDING'
            ORDER BY aia.step_index ASC LIMIT 1
          ))`,
          assigneeEmail: sql<string>`COALESCE(assignee_u.email, (
            SELECT u2.email FROM ap_invoice_approvals aia
            JOIN users u2 ON aia.approver_user_id = u2.id
            WHERE aia.invoice_id = ${apInvoices.id} AND aia.status = 'PENDING'
            ORDER BY aia.step_index ASC LIMIT 1
          ))`,
          createdByName: sql<string>`creator_u.name`,
          createdByEmail: sql<string>`creator_u.email`,
        })
        .from(apInvoices)
        .leftJoin(suppliers, eq(apInvoices.supplierId, suppliers.id))
        .leftJoin(
          sql`${users} as assignee_u`,
          sql`${apInvoices.assigneeUserId} = assignee_u.id`
        )
        .leftJoin(
          sql`${users} as creator_u`,
          sql`${apInvoices.createdByUserId} = creator_u.id`
        )
        .where(whereClause)
        .orderBy(
          (() => {
            const dir = sortOrder === "asc" ? asc : desc;
            switch (sortBy) {
              case "supplier": return dir(suppliers.name);
              case "uploadedAt": return dir(apInvoices.uploadedAt);
              case "invoiceDate": return dir(apInvoices.invoiceDate);
              case "totalInc": return dir(apInvoices.totalInc);
              default: return desc(apInvoices.uploadedAt);
            }
          })()
        )
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(apInvoices)
        .leftJoin(suppliers, eq(apInvoices.supplierId, suppliers.id))
        .where(whereClause),
    ]);

    res.json({
      invoices: invoiceRows,
      total: countResult[0]?.total || 0,
      page,
      limit,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoices");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch AP invoices" });
  }
});

router.get("/api/ap-invoices/counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;

    const [statusCounts, assignedToMe, pendingMyApproval] = await Promise.all([
      db
        .select({
          status: apInvoices.status,
          count: count(),
        })
        .from(apInvoices)
        .where(eq(apInvoices.companyId, companyId))
        .groupBy(apInvoices.status),
      db
        .select({ count: count() })
        .from(apInvoices)
        .where(
          and(
            eq(apInvoices.companyId, companyId),
            eq(apInvoices.assigneeUserId, userId),
            inArray(apInvoices.status, ["IMPORTED", "PROCESSED", "CONFIRMED", "PARTIALLY_APPROVED"] as any),
          )
        ),
      db
        .select({ count: sql<number>`count(distinct ${apInvoiceApprovals.invoiceId})` })
        .from(apInvoiceApprovals)
        .innerJoin(apInvoices, eq(apInvoiceApprovals.invoiceId, apInvoices.id))
        .where(
          and(
            eq(apInvoices.companyId, companyId),
            eq(apInvoiceApprovals.approverUserId, userId),
            eq(apInvoiceApprovals.status, "PENDING"),
          )
        ),
    ]);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = row.count;
    }
    const assignedCount = assignedToMe[0]?.count || 0;
    const approvalCount = pendingMyApproval[0]?.count || 0;
    counts.waitingOnMe = assignedCount + approvalCount;

    res.json(counts);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice counts");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch counts" });
  }
});

router.get("/api/ap-invoices/my-approvals", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;

    const invoiceRows = await db
      .select({
        id: apInvoices.id,
        invoiceNumber: apInvoices.invoiceNumber,
        invoiceDate: apInvoices.invoiceDate,
        dueDate: apInvoices.dueDate,
        description: apInvoices.description,
        totalEx: apInvoices.totalEx,
        totalTax: apInvoices.totalTax,
        totalInc: apInvoices.totalInc,
        currency: apInvoices.currency,
        status: apInvoices.status,
        isUrgent: apInvoices.isUrgent,
        isOnHold: apInvoices.isOnHold,
        uploadedAt: apInvoices.uploadedAt,
        riskScore: apInvoices.riskScore,
        supplierName: suppliers.name,
        supplierId: apInvoices.supplierId,
      })
      .from(apInvoiceApprovals)
      .innerJoin(apInvoices, eq(apInvoiceApprovals.invoiceId, apInvoices.id))
      .leftJoin(suppliers, eq(apInvoices.supplierId, suppliers.id))
      .where(
        and(
          eq(apInvoices.companyId, companyId),
          eq(apInvoiceApprovals.approverUserId, userId),
          eq(apInvoiceApprovals.status, "PENDING"),
        )
      )
      .orderBy(desc(apInvoices.uploadedAt))
      .limit(100);

    res.json(invoiceRows);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching my AP approvals");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch approvals" });
  }
});

router.get("/api/ap-invoices/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [invoice] = await db
      .select()
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const [
      supplier,
      assigneeUserRow,
      createdByUserRow,
      splits,
      extractedFields,
      documents,
      approvals,
      activity,
      comments,
    ] = await Promise.all([
      invoice.supplierId
        ? db.select().from(suppliers).where(eq(suppliers.id, invoice.supplierId)).limit(1).then(r => r[0])
        : Promise.resolve(null),
      invoice.assigneeUserId
        ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, invoice.assigneeUserId)).limit(1).then(r => r[0])
        : Promise.resolve(null),
      db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, invoice.createdByUserId)).limit(1).then(r => r[0]),
      db
        .select({
          id: apInvoiceSplits.id,
          invoiceId: apInvoiceSplits.invoiceId,
          description: apInvoiceSplits.description,
          percentage: apInvoiceSplits.percentage,
          amount: apInvoiceSplits.amount,
          costCodeId: apInvoiceSplits.costCodeId,
          jobId: apInvoiceSplits.jobId,
          taxCodeId: apInvoiceSplits.taxCodeId,
          sortOrder: apInvoiceSplits.sortOrder,
          createdAt: apInvoiceSplits.createdAt,
          costCodeCode: costCodes.code,
          costCodeName: costCodes.name,
          jobNumber: jobs.jobNumber,
          jobName: jobs.name,
        })
        .from(apInvoiceSplits)
        .leftJoin(costCodes, eq(apInvoiceSplits.costCodeId, costCodes.id))
        .leftJoin(jobs, eq(apInvoiceSplits.jobId, jobs.id))
        .where(eq(apInvoiceSplits.invoiceId, id))
        .orderBy(asc(apInvoiceSplits.sortOrder)),
      db.select().from(apInvoiceExtractedFields).where(eq(apInvoiceExtractedFields.invoiceId, id)),
      db.select().from(apInvoiceDocuments).where(eq(apInvoiceDocuments.invoiceId, id)),
      db
        .select({
          id: apInvoiceApprovals.id,
          invoiceId: apInvoiceApprovals.invoiceId,
          stepIndex: apInvoiceApprovals.stepIndex,
          approverUserId: apInvoiceApprovals.approverUserId,
          status: apInvoiceApprovals.status,
          decisionAt: apInvoiceApprovals.decisionAt,
          note: apInvoiceApprovals.note,
          ruleId: apInvoiceApprovals.ruleId,
          createdAt: apInvoiceApprovals.createdAt,
          approverName: users.name,
          approverEmail: users.email,
        })
        .from(apInvoiceApprovals)
        .leftJoin(users, eq(apInvoiceApprovals.approverUserId, users.id))
        .where(eq(apInvoiceApprovals.invoiceId, id))
        .orderBy(asc(apInvoiceApprovals.stepIndex)),
      db
        .select({
          id: apInvoiceActivity.id,
          invoiceId: apInvoiceActivity.invoiceId,
          activityType: apInvoiceActivity.activityType,
          message: apInvoiceActivity.message,
          actorUserId: apInvoiceActivity.actorUserId,
          metaJson: apInvoiceActivity.metaJson,
          createdAt: apInvoiceActivity.createdAt,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(apInvoiceActivity)
        .leftJoin(users, eq(apInvoiceActivity.actorUserId, users.id))
        .where(eq(apInvoiceActivity.invoiceId, id))
        .orderBy(desc(apInvoiceActivity.createdAt))
        .limit(50),
      db
        .select({
          id: apInvoiceComments.id,
          invoiceId: apInvoiceComments.invoiceId,
          userId: apInvoiceComments.userId,
          body: apInvoiceComments.body,
          createdAt: apInvoiceComments.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(apInvoiceComments)
        .leftJoin(users, eq(apInvoiceComments.userId, users.id))
        .where(eq(apInvoiceComments.invoiceId, id))
        .orderBy(asc(apInvoiceComments.createdAt)),
    ]);

    res.json({
      ...invoice,
      supplier: supplier || null,
      assigneeUser: assigneeUserRow || null,
      createdByUser: createdByUserRow || null,
      splits,
      extractedFields,
      documents,
      approvals,
      activity,
      comments,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice detail");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch invoice" });
  }
});

router.post("/api/ap-invoices/upload", requireAuth, upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "At least one file is required" });

    const createdInvoices = [];

    for (const file of files) {
      const fileExt = file.originalname.split(".").pop() || "pdf";
      const storageKey = `ap-invoices/${companyId}/${crypto.randomUUID()}.${fileExt}`;

      await objectStorageService.uploadFile(storageKey, file.buffer, file.mimetype);

      const [invoice] = await db
        .insert(apInvoices)
        .values({
          companyId,
          createdByUserId: userId,
          status: "IMPORTED",
          uploadedAt: new Date(),
        })
        .returning();

      await db.insert(apInvoiceDocuments).values({
        invoiceId: invoice.id,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      await logActivity(invoice.id, "uploaded", "Invoice uploaded", userId);

      try {
        const { extractInvoiceInline } = await import("../lib/ap-inbox-jobs");
        await extractInvoiceInline(invoice.id, companyId, file.buffer, file.mimetype);
        const [updated] = await db.select().from(apInvoices).where(eq(apInvoices.id, invoice.id)).limit(1);
        createdInvoices.push(updated || invoice);
      } catch (extractErr: any) {
        logger.warn({ err: extractErr, invoiceId: invoice.id }, "Inline extraction failed during upload, will retry in background");
        createdInvoices.push(invoice);
      }
    }

    res.json(createdInvoices.length === 1 ? createdInvoices[0] : { invoices: createdInvoices, count: createdInvoices.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading AP invoice");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload invoice" });
  }
});

const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  totalEx: z.string().nullable().optional(),
  totalTax: z.string().nullable().optional(),
  totalInc: z.string().nullable().optional(),
  postPeriod: z.string().nullable().optional(),
});

router.patch("/api/ap-invoices/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

    const [existing] = await db
      .select()
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const parsed = updateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const updates: any = { updatedAt: new Date() };
    const changedFields: string[] = [];

    if (parsed.data.invoiceNumber !== undefined) {
      updates.invoiceNumber = parsed.data.invoiceNumber;
      changedFields.push("invoiceNumber");
    }
    if (parsed.data.invoiceDate !== undefined) {
      updates.invoiceDate = parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : null;
      changedFields.push("invoiceDate");
    }
    if (parsed.data.dueDate !== undefined) {
      updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
      changedFields.push("dueDate");
    }
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
      changedFields.push("description");
    }
    if (parsed.data.supplierId !== undefined) {
      updates.supplierId = parsed.data.supplierId;
      changedFields.push("supplierId");
    }
    if (parsed.data.supplierName !== undefined && parsed.data.supplierId === undefined) {
      const name = parsed.data.supplierName?.trim();
      if (name) {
        const [existingSupplier] = await db.select({ id: suppliers.id })
          .from(suppliers)
          .where(and(eq(suppliers.companyId, companyId), ilike(suppliers.name, name)))
          .limit(1);
        if (existingSupplier) {
          updates.supplierId = existingSupplier.id;
        } else {
          const [newSupplier] = await db.insert(suppliers).values({
            companyId,
            name,
            isActive: true,
          }).returning();
          updates.supplierId = newSupplier.id;
        }
        changedFields.push("supplier");
      } else {
        updates.supplierId = null;
        changedFields.push("supplier");
      }
    }
    if (parsed.data.totalEx !== undefined) {
      updates.totalEx = parsed.data.totalEx;
      changedFields.push("totalEx");
    }
    if (parsed.data.totalTax !== undefined) {
      updates.totalTax = parsed.data.totalTax;
      changedFields.push("totalTax");
    }
    if (parsed.data.totalInc !== undefined) {
      updates.totalInc = parsed.data.totalInc;
      changedFields.push("totalInc");
    }
    if (parsed.data.postPeriod !== undefined) {
      updates.postPeriod = parsed.data.postPeriod;
      changedFields.push("postPeriod");
    }

    const [updated] = await db
      .update(apInvoices)
      .set(updates)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .returning();

    if (changedFields.length > 0) {
      await logActivity(id, "fields_updated", `Updated fields: ${changedFields.join(", ")}`, userId, { changedFields });
    }

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating AP invoice");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update invoice" });
  }
});

router.post("/api/ap-invoices/:id/confirm", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
      .where(eq(apInvoiceSplits.invoiceId, id));

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

    const [updated] = await db
      .update(apInvoices)
      .set({ status: "CONFIRMED", updatedAt: new Date() })
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .returning();

    await logActivity(id, "confirmed", "Invoice confirmed by data entry clerk", userId);

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error confirming AP invoice");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to confirm invoice" });
  }
});

router.post("/api/ap-invoices/:id/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
      .where(eq(apInvoiceApprovals.invoiceId, id));

    let newStatus: string;
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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to submit invoice" });
  }
});

router.post("/api/ap-invoices/:id/assign", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to assign invoice" });
  }
});

router.post("/api/ap-invoices/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
      .orderBy(asc(apInvoiceApprovals.stepIndex));

    const currentStep = allSteps.find(s => s.status === "PENDING");

    if (!currentStep) {
      return res.status(400).json({ error: "No pending approval steps for this invoice" });
    }

    if (currentStep.approverUserId !== userId) {
      return res.status(403).json({ error: `It's not your turn to approve. Waiting on step ${currentStep.stepIndex} approver.` });
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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to approve invoice" });
  }
});

router.post("/api/ap-invoices/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
      );

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reject invoice" });
  }
});

router.post("/api/ap-invoices/:id/on-hold", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to toggle on-hold" });
  }
});

router.post("/api/ap-invoices/:id/urgent", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to toggle urgent" });
  }
});

const splitSchema = z.object({
  description: z.string().nullable().optional(),
  percentage: z.string().nullable().optional(),
  amount: z.string(),
  costCodeId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  taxCodeId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

router.get("/api/ap-invoices/:id/splits", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [invoice] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const splits = await db
      .select({
        id: apInvoiceSplits.id,
        invoiceId: apInvoiceSplits.invoiceId,
        description: apInvoiceSplits.description,
        percentage: apInvoiceSplits.percentage,
        amount: apInvoiceSplits.amount,
        costCodeId: apInvoiceSplits.costCodeId,
        jobId: apInvoiceSplits.jobId,
        taxCodeId: apInvoiceSplits.taxCodeId,
        sortOrder: apInvoiceSplits.sortOrder,
        createdAt: apInvoiceSplits.createdAt,
        costCodeCode: costCodes.code,
        costCodeName: costCodes.name,
        jobNumber: jobs.jobNumber,
        jobName: jobs.name,
      })
      .from(apInvoiceSplits)
      .leftJoin(costCodes, eq(apInvoiceSplits.costCodeId, costCodes.id))
      .leftJoin(jobs, eq(apInvoiceSplits.jobId, jobs.id))
      .where(eq(apInvoiceSplits.invoiceId, id))
      .orderBy(asc(apInvoiceSplits.sortOrder));

    res.json(splits);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice splits");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch splits" });
  }
});

router.put("/api/ap-invoices/:id/splits", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

    const [existing] = await db
      .select()
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const body = z.array(splitSchema).parse(req.body);

    if (existing.totalInc) {
      const totalInc = parseFloat(existing.totalInc);
      const splitSum = body.reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const tolerance = 0.02;
      if (Math.abs(totalInc - splitSum) > tolerance) {
        return res.status(400).json({
          error: `Split total ($${splitSum.toFixed(2)}) does not match invoice total ($${totalInc.toFixed(2)})`,
        });
      }
    }

    await db.delete(apInvoiceSplits).where(eq(apInvoiceSplits.invoiceId, id));

    if (body.length > 0) {
      await db.insert(apInvoiceSplits).values(
        body.map((s, idx) => ({
          invoiceId: id,
          description: s.description || null,
          percentage: s.percentage || null,
          amount: s.amount,
          costCodeId: s.costCodeId || null,
          jobId: s.jobId || null,
          taxCodeId: s.taxCodeId || null,
          sortOrder: s.sortOrder ?? idx,
        }))
      );
    }

    if (existing.supplierId && body.length > 0) {
      const firstCostCode = body.find(s => s.costCodeId)?.costCodeId;
      if (firstCostCode) {
        const [supplier] = await db
          .select({ id: suppliers.id, defaultCostCodeId: suppliers.defaultCostCodeId })
          .from(suppliers)
          .where(and(eq(suppliers.id, existing.supplierId), eq(suppliers.companyId, companyId)))
          .limit(1);
        if (supplier && !supplier.defaultCostCodeId) {
          await db.update(suppliers)
            .set({ defaultCostCodeId: firstCostCode })
            .where(eq(suppliers.id, supplier.id));
          logger.info({ supplierId: supplier.id, costCodeId: firstCostCode }, "[AP Splits] Set supplier default cost code from first split save");
        }
      }
    }

    await logActivity(id, "splits_updated", `Updated ${body.length} split lines`, userId);

    const splits = await db
      .select()
      .from(apInvoiceSplits)
      .where(eq(apInvoiceSplits.invoiceId, id))
      .orderBy(asc(apInvoiceSplits.sortOrder));

    res.json(splits);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating AP invoice splits");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update splits" });
  }
});

router.get("/api/ap-invoices/:id/extracted-fields", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const fields = await db
      .select()
      .from(apInvoiceExtractedFields)
      .where(eq(apInvoiceExtractedFields.invoiceId, id));

    res.json(fields);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching extracted fields");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch extracted fields" });
  }
});

router.post("/api/ap-invoices/:id/field-map", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

    const body = z.object({
      fieldKey: z.string(),
      fieldValue: z.string().nullable(),
      source: z.string().optional(),
    }).parse(req.body);

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const [existingField] = await db
      .select()
      .from(apInvoiceExtractedFields)
      .where(
        and(
          eq(apInvoiceExtractedFields.invoiceId, id),
          eq(apInvoiceExtractedFields.fieldKey, body.fieldKey),
        )
      )
      .limit(1);

    if (existingField) {
      await db
        .update(apInvoiceExtractedFields)
        .set({
          fieldValue: body.fieldValue,
          source: body.source || "manual",
        })
        .where(eq(apInvoiceExtractedFields.id, existingField.id));
    } else {
      await db.insert(apInvoiceExtractedFields).values({
        invoiceId: id,
        fieldKey: body.fieldKey,
        fieldValue: body.fieldValue,
        source: body.source || "manual",
      });
    }

    await logActivity(id, "field_mapped", `Field "${body.fieldKey}" updated`, userId, { fieldKey: body.fieldKey });

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error mapping AP invoice field");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to map field" });
  }
});

router.get("/api/ap-invoices/:id/document", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const [doc] = await db
      .select()
      .from(apInvoiceDocuments)
      .where(eq(apInvoiceDocuments.invoiceId, id))
      .orderBy(desc(apInvoiceDocuments.createdAt))
      .limit(1);

    if (!doc) return res.status(404).json({ error: "Document not found" });

    res.json({
      storageKey: doc.storageKey,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch document" });
  }
});

router.get("/api/ap-invoices/:id/comments", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const comments = await db
      .select({
        id: apInvoiceComments.id,
        invoiceId: apInvoiceComments.invoiceId,
        userId: apInvoiceComments.userId,
        body: apInvoiceComments.body,
        createdAt: apInvoiceComments.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(apInvoiceComments)
      .leftJoin(users, eq(apInvoiceComments.userId, users.id))
      .where(eq(apInvoiceComments.invoiceId, id))
      .orderBy(asc(apInvoiceComments.createdAt));

    res.json(comments);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice comments");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch comments" });
  }
});

router.post("/api/ap-invoices/:id/comments", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

    const body = z.object({ body: z.string().min(1, "Comment body is required") }).parse(req.body);

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const [comment] = await db
      .insert(apInvoiceComments)
      .values({
        invoiceId: id,
        userId,
        body: body.body,
      })
      .returning();

    await logActivity(id, "comment_added", "Comment added", userId);

    res.json(comment);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error adding AP invoice comment");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add comment" });
  }
});

router.get("/api/ap-invoices/:id/activity", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const activity = await db
      .select({
        id: apInvoiceActivity.id,
        invoiceId: apInvoiceActivity.invoiceId,
        activityType: apInvoiceActivity.activityType,
        message: apInvoiceActivity.message,
        actorUserId: apInvoiceActivity.actorUserId,
        metaJson: apInvoiceActivity.metaJson,
        createdAt: apInvoiceActivity.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(apInvoiceActivity)
      .leftJoin(users, eq(apInvoiceActivity.actorUserId, users.id))
      .where(eq(apInvoiceActivity.invoiceId, id))
      .orderBy(desc(apInvoiceActivity.createdAt));

    res.json(activity);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice activity");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch activity" });
  }
});

router.get("/api/ap-invoices/:id/approval-path", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select({ id: apInvoices.id })
      .from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const approvals = await db
      .select({
        id: apInvoiceApprovals.id,
        invoiceId: apInvoiceApprovals.invoiceId,
        stepIndex: apInvoiceApprovals.stepIndex,
        approverUserId: apInvoiceApprovals.approverUserId,
        status: apInvoiceApprovals.status,
        decisionAt: apInvoiceApprovals.decisionAt,
        note: apInvoiceApprovals.note,
        ruleId: apInvoiceApprovals.ruleId,
        createdAt: apInvoiceApprovals.createdAt,
        approverName: users.name,
        approverEmail: users.email,
        ruleName: apApprovalRules.name,
        ruleConditions: apApprovalRules.conditions,
        ruleType: apApprovalRules.ruleType,
      })
      .from(apInvoiceApprovals)
      .leftJoin(users, eq(apInvoiceApprovals.approverUserId, users.id))
      .leftJoin(apApprovalRules, eq(apInvoiceApprovals.ruleId, apApprovalRules.id))
      .where(eq(apInvoiceApprovals.invoiceId, id))
      .orderBy(asc(apInvoiceApprovals.stepIndex));

    const ruleIds = [...new Set(approvals.map(a => a.ruleId).filter(Boolean))] as string[];
    let resolvedConditionLabels: Record<string, any[]> = {};

    if (ruleIds.length > 0) {
      const firstApproval = approvals.find(a => a.ruleConditions);
      if (firstApproval?.ruleConditions) {
        const conditions = firstApproval.ruleConditions as any[];
        if (Array.isArray(conditions)) {
          const resolvedConds = [];
          for (const cond of conditions) {
            const resolved: any = { field: cond.field, operator: cond.operator, values: cond.values, resolvedValues: [] };
            if (cond.values && cond.values.length > 0) {
              switch (cond.field) {
                case "COMPANY": {
                  const companyRows = await db.select({ id: companies.id, name: companies.name }).from(companies)
                    .where(inArray(companies.id, cond.values));
                  resolved.resolvedValues = cond.values.map((v: string) => {
                    const c = companyRows.find(r => r.id === v);
                    return c?.name || v;
                  });
                  break;
                }
                case "SUPPLIER": {
                  const supplierRows = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers)
                    .where(inArray(suppliers.id, cond.values));
                  resolved.resolvedValues = cond.values.map((v: string) => {
                    const s = supplierRows.find(r => r.id === v);
                    return s?.name || v;
                  });
                  break;
                }
                case "JOB": {
                  const jobRows = await db.select({ id: jobs.id, name: jobs.name, jobNumber: jobs.jobNumber }).from(jobs)
                    .where(inArray(jobs.id, cond.values));
                  resolved.resolvedValues = cond.values.map((v: string) => {
                    const j = jobRows.find(r => r.id === v);
                    return j ? `${j.jobNumber} - ${j.name}` : v;
                  });
                  break;
                }
                default:
                  resolved.resolvedValues = cond.values;
              }
            }
            resolvedConds.push(resolved);
          }
          if (firstApproval.ruleId) {
            resolvedConditionLabels[firstApproval.ruleId] = resolvedConds;
          }
        }
      }
    }

    const totalSteps = approvals.length;
    const completedSteps = approvals.filter(a => a.status === "APPROVED").length;
    const lowestPending = approvals.find(a => a.status === "PENDING");
    const currentStepIndex = lowestPending ? lowestPending.stepIndex : null;

    const steps = approvals.map(a => ({
      ...a,
      isCurrent: a.status === "PENDING" && a.stepIndex === currentStepIndex,
      ruleConditionsResolved: a.ruleId ? (resolvedConditionLabels[a.ruleId] || a.ruleConditions) : null,
    }));

    res.json({ steps, totalSteps, completedSteps, currentStepIndex });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP invoice approval path");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch approval path" });
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
      );

    const approved: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const invoice of invoices) {
      try {
        const allSteps = await db
          .select()
          .from(apInvoiceApprovals)
          .where(eq(apInvoiceApprovals.invoiceId, invoice.id))
          .orderBy(asc(apInvoiceApprovals.stepIndex));

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to bulk approve" });
  }
});

router.delete("/api/ap-invoices/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete invoice" });
  }
});

router.get("/api/ap-approval-rules", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const rules = await db
      .select()
      .from(apApprovalRules)
      .where(eq(apApprovalRules.companyId, companyId))
      .orderBy(asc(apApprovalRules.priority));

    res.json(rules);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching AP approval rules");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch approval rules" });
  }
});

const approvalRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ruleType: z.enum(["USER_CATCH_ALL", "USER", "AUTO_APPROVE"]).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  conditions: z.any(),
  approverUserIds: z.array(z.string()),
  autoApprove: z.boolean().optional(),
});

router.post("/api/ap-approval-rules", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const parsed = approvalRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const [rule] = await db
      .insert(apApprovalRules)
      .values({
        companyId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        ruleType: parsed.data.ruleType ?? "USER",
        isActive: parsed.data.isActive ?? true,
        priority: parsed.data.priority ?? 0,
        conditions: parsed.data.conditions,
        approverUserIds: parsed.data.approverUserIds,
        autoApprove: parsed.data.autoApprove ?? false,
      })
      .returning();

    reassignApprovalPathsForCompany(companyId).catch(err =>
      logger.error({ err }, "Failed to reassign approval paths after rule creation")
    );

    res.json(rule);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating AP approval rule");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create approval rule" });
  }
});

router.patch("/api/ap-approval-rules/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select()
      .from(apApprovalRules)
      .where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Approval rule not found" });

    const parsed = approvalRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const updates: any = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.ruleType !== undefined) updates.ruleType = parsed.data.ruleType;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
    if (parsed.data.conditions !== undefined) updates.conditions = parsed.data.conditions;
    if (parsed.data.approverUserIds !== undefined) updates.approverUserIds = parsed.data.approverUserIds;
    if (parsed.data.autoApprove !== undefined) updates.autoApprove = parsed.data.autoApprove;

    const [updated] = await db
      .update(apApprovalRules)
      .set(updates)
      .where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)))
      .returning();

    reassignApprovalPathsForCompany(companyId).catch(err =>
      logger.error({ err }, "Failed to reassign approval paths after rule update")
    );

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating AP approval rule");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update approval rule" });
  }
});

router.delete("/api/ap-approval-rules/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [existing] = await db
      .select()
      .from(apApprovalRules)
      .where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Approval rule not found" });

    await db.delete(apApprovalRules).where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)));

    reassignApprovalPathsForCompany(companyId).catch(err =>
      logger.error({ err }, "Failed to reassign approval paths after rule deletion")
    );

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting AP approval rule");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete approval rule" });
  }
});

// ============================================================================
// MYOB EXPORT - Create purchase bill from approved invoice
// ============================================================================
router.post("/api/ap-invoices/:id/export/myob", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

    const [invoice] = await db.select().from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status !== "APPROVED") return res.status(400).json({ error: "Only approved invoices can be exported to MYOB" });

    const splits = await db.select().from(apInvoiceSplits)
      .where(eq(apInvoiceSplits.invoiceId, id))
      .orderBy(asc(apInvoiceSplits.sortOrder));

    let supplierInfo: any = null;
    if (invoice.supplierId) {
      const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, invoice.supplierId)).limit(1);
      supplierInfo = sup || null;
    }

    const { createMyobClient, getConnectionStatus } = await import("../myob");
    const connectionStatus = await getConnectionStatus(companyId);
    if (!connectionStatus.connected) {
      return res.status(400).json({ error: "MYOB not connected. Please connect your MYOB account first." });
    }

    const myob = createMyobClient(companyId);

    const billLines = splits.map((split) => ({
      Description: split.description || invoice.description || "AP Invoice",
      Total: parseFloat(split.amount),
      Account: split.costCodeId ? { UID: split.costCodeId } : undefined,
      Job: split.jobId ? { UID: split.jobId } : undefined,
      TaxCode: split.taxCodeId ? { UID: split.taxCodeId } : undefined,
    }));

    if (billLines.length === 0) {
      billLines.push({
        Description: invoice.description || "AP Invoice",
        Total: parseFloat(invoice.totalInc || "0"),
        Account: undefined,
        Job: undefined,
        TaxCode: undefined,
      });
    }

    const bill = {
      Date: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : new Date().toISOString(),
      Supplier: supplierInfo ? { UID: supplierInfo.myobUid || supplierInfo.id, DisplayID: supplierInfo.name } : undefined,
      SupplierInvoiceNumber: invoice.invoiceNumber,
      Comment: invoice.description || "",
      Lines: billLines,
    };

    try {
      const result = await myob.createPurchaseBill(bill);

      await db.update(apInvoices)
        .set({ status: "EXPORTED", updatedAt: new Date() })
        .where(eq(apInvoices.id, id));

      await db.insert(myobExportLogs).values({
        companyId,
        invoiceId: id,
        userId,
        status: "SUCCESS",
        invoiceNumber: invoice.invoiceNumber || null,
        supplierName: supplierInfo?.name || null,
        totalAmount: invoice.totalInc || null,
        myobResponse: result || null,
      });

      await logActivity(id, "exported", "Invoice exported to MYOB", userId, { myobResult: result });

      res.json({ success: true, myobResult: result });
    } catch (myobError: any) {
      await db.update(apInvoices)
        .set({ status: "FAILED_EXPORT", updatedAt: new Date() })
        .where(eq(apInvoices.id, id));

      await db.insert(myobExportLogs).values({
        companyId,
        invoiceId: id,
        userId,
        status: "FAILED",
        invoiceNumber: invoice.invoiceNumber || null,
        supplierName: supplierInfo?.name || null,
        totalAmount: invoice.totalInc || null,
        errorMessage: myobError.message || "Unknown MYOB error",
      });

      await logActivity(id, "export_failed", `MYOB export failed: ${myobError.message}`, userId);

      res.status(500).json({ error: `MYOB export failed: ${myobError.message}` });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error exporting AP invoice to MYOB");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to export to MYOB" });
  }
});

// ============================================================================
// DOCUMENT SERVING - Stream PDF/image for the viewer
// ============================================================================
router.get("/api/ap-invoices/:id/document-view", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [invoice] = await db.select().from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const docs = await db.select().from(apInvoiceDocuments)
      .where(eq(apInvoiceDocuments.invoiceId, id)).limit(1);
    if (!docs.length) return res.status(404).json({ error: "No document found" });

    const doc = docs[0];
    try {
      const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": doc.mimeType || metadata.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      });
      const stream = file.createReadStream();
      stream.on("error", (err: any) => {
        logger.error({ err }, "Stream error serving AP invoice document");
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (storageErr: any) {
      logger.error({ err: storageErr }, "Error retrieving AP invoice document from storage");
      res.status(404).json({ error: "Document file not found in storage" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error serving AP invoice document");
    res.status(500).json({ error: "Failed to serve document" });
  }
});

// ============================================================================
// PAGE THUMBNAILS - Server-side PDF to image rendering (like Drawing Package)
// ============================================================================
router.get("/api/ap-invoices/:id/page-thumbnails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [invoice] = await db.select().from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const docs = await db.select().from(apInvoiceDocuments)
      .where(eq(apInvoiceDocuments.invoiceId, id)).limit(1);
    if (!docs.length) return res.status(404).json({ error: "No document found" });

    const doc = docs[0];

    const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
    const chunks: Buffer[] = [];
    const stream = file.createReadStream();
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    if (doc.mimeType?.includes("pdf")) {
      const { spawn } = await import("child_process");
      const fs = await import("fs");
      const os = await import("os");
      const path = await import("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ap-thumbs-"));
      const pdfPath = path.join(tmpDir, "invoice.pdf");
      fs.writeFileSync(pdfPath, buffer);

      try {
        const pythonScript = `
import fitz
import json
import sys
import base64

pdf_path = sys.argv[1]
doc = fitz.open(pdf_path)
pages = []

for i in range(len(doc)):
    page = doc[i]
    rect = page.rect
    w, h = rect.width, rect.height
    scale = min(1600 / max(w, h), 2.5)
    scale = max(scale, 1.0)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat)
    thumbnail = base64.b64encode(pix.tobytes("png")).decode("ascii")
    pages.append({
        "pageNumber": i + 1,
        "thumbnail": thumbnail,
        "width": pix.width,
        "height": pix.height,
    })

doc.close()
print(json.dumps({"totalPages": len(pages), "pages": pages}))
`;

        const result: string = await new Promise((resolve, reject) => {
          let output = "";
          let errorOutput = "";
          const proc = spawn("python3", ["-c", pythonScript, pdfPath], { timeout: 60000 });
          proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
          proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
          proc.on("close", (code: number | null) => {
            if (code === 0) resolve(output);
            else reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
          });
          proc.on("error", (err: Error) => reject(err));
        });

        const parsed = JSON.parse(result);
        res.json(parsed);
      } finally {
        try {
          const fs2 = await import("fs");
          fs2.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    } else if (doc.mimeType?.startsWith("image/")) {
      const thumbnail = buffer.toString("base64");
      res.json({
        totalPages: 1,
        pages: [{
          pageNumber: 1,
          thumbnail,
          width: 0,
          height: 0,
        }],
      });
    } else {
      res.status(400).json({ error: "Unsupported document type" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating page thumbnails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate thumbnails" });
  }
});

// ============================================================================
// OPENAI VISION EXTRACTION - Extract fields from invoice PDF/image
// ============================================================================
router.post("/api/ap-invoices/:id/extract", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId!;
    const id = req.params.id;

    const [invoice] = await db.select().from(apInvoices)
      .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const docs = await db.select().from(apInvoiceDocuments)
      .where(eq(apInvoiceDocuments.invoiceId, id)).limit(1);
    if (!docs.length) return res.status(400).json({ error: "No document to extract from" });

    const doc = docs[0];

    let extractedText: string | null = null;
    let imageBuffers: { base64: string; mimeType: string }[] = [];

    try {
      const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
      const chunks: Buffer[] = [];
      const stream = file.createReadStream();
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      const { prepareDocumentForExtraction } = await import("../lib/ap-document-prep");
      const prepared = await prepareDocumentForExtraction(buffer, doc.mimeType);
      extractedText = prepared.extractedText;
      imageBuffers = prepared.imageBuffers;

      if (imageBuffers.length === 0) {
        return res.status(500).json({ error: "Failed to convert document to images for extraction" });
      }
    } catch (err: any) {
      logger.error({ err }, "Error reading document for extraction");
      return res.status(500).json({ error: "Cannot read document file" });
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { AP_EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt, parseExtractedData, buildExtractedFieldRecords, buildInvoiceUpdateFromExtraction, sanitizeNumericValue } = await import("../lib/ap-extraction-prompt");
    const { getSupplierCostCodeContext } = await import("../lib/ap-auto-split");

    let supplierContext = "";
    if (invoice.supplierId) {
      supplierContext = await getSupplierCostCodeContext(invoice.supplierId, companyId);
    }
    const userPrompt = buildExtractionUserPrompt(extractedText, supplierContext);
    const hasText = extractedText && extractedText.length > 100;
    const imageDetail = hasText ? "low" as const : "high" as const;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: AP_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            ...imageBuffers.map(img => ({
              type: "image_url" as const,
              image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: imageDetail },
            })),
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    let rawData: any;
    try {
      rawData = JSON.parse(responseText);
    } catch {
      logger.error("Failed to parse extraction response as JSON");
      return res.status(500).json({ error: "Extraction produced invalid response" });
    }

    const data = parseExtractedData(rawData);
    const fieldRecords = buildExtractedFieldRecords(id, data);

    await db.delete(apInvoiceExtractedFields).where(eq(apInvoiceExtractedFields.invoiceId, id));

    for (const field of fieldRecords) {
      await db.insert(apInvoiceExtractedFields).values({
        invoiceId: id,
        fieldKey: field.fieldKey,
        fieldValue: field.fieldValue,
        confidence: field.confidence,
        page: 1,
        bboxJson: null,
        source: "extraction",
      });
    }

    const updateData = buildInvoiceUpdateFromExtraction(data);

    if (data.supplier_name) {
      const matchingSuppliers = await db.select().from(suppliers)
        .where(and(eq(suppliers.companyId, companyId), ilike(suppliers.name, `%${data.supplier_name}%`)))
        .limit(1);
      if (matchingSuppliers.length > 0) {
        updateData.supplierId = matchingSuppliers[0].id;
      }
    }

    if (invoice.status === "IMPORTED") {
      updateData.status = "PROCESSED";
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(apInvoices).set(updateData).where(eq(apInvoices.id, id));
    }

    const { createAutoSplit } = await import("../lib/ap-auto-split");
    const totalInc = parseFloat(sanitizeNumericValue(data.total_amount_inc_gst) || "0");
    const gstAmount = parseFloat(sanitizeNumericValue(data.total_gst) || "0");
    const subtotal = parseFloat(sanitizeNumericValue(data.subtotal_ex_gst) || String(totalInc));

    const autoSplitResult = await createAutoSplit(
      id,
      companyId,
      updateData.supplierId || invoice.supplierId || null,
      totalInc,
      gstAmount,
      subtotal,
      data.description
    );
    if (autoSplitResult.created) {
      logger.info({ invoiceId: id, ...autoSplitResult }, "Auto-split created with cost code after extraction");
    }

    await logActivity(id, "extraction_completed", "AI extraction completed", userId, {
      fieldsExtracted: fieldRecords.length,
    });

    try {
      const approvalResult = await assignApprovalPathToInvoice(id, companyId, userId);
      logger.info({ invoiceId: id, matched: approvalResult.matched, ruleName: approvalResult.ruleName }, "Approval path assigned after extraction");
    } catch (approvalErr) {
      logger.warn({ err: approvalErr, invoiceId: id }, "Failed to assign approval path after extraction (non-fatal)");
    }

    res.json({
      success: true,
      extractedData: data,
      fieldsStored: fieldRecords.length,
      riskScore: updateData.riskScore,
      riskReasons: updateData.riskReasons,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error extracting AP invoice fields");
    res.status(500).json({ error: error instanceof Error ? error.message : "Extraction failed" });
  }
});

export { router as apInvoicesRouter };
