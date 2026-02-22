import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { validateUploads } from "../../middleware/file-validation";
import { eq, and, desc, asc, sql, ilike, or, inArray, count } from "drizzle-orm";
import crypto from "crypto";
import {
  apInvoices, apInvoiceDocuments, apInvoiceExtractedFields,
  apInvoiceSplits, apInvoiceActivity, apInvoiceComments,
  apInvoiceApprovals, users, suppliers, costCodes, jobs,
} from "@shared/schema";
import { requireUUID } from "../../lib/api-utils";
import type { SharedDeps } from "./shared";

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

export function registerCoreRoutes(router: Router, deps: SharedDeps): void {
  const { db, objectStorageService, upload, logActivity } = deps;

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

      const [statusCounts, assignedToMe, pendingMyApproval, totalValueResult] = await Promise.all([
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
        db
          .select({ total: sql<string>`COALESCE(SUM(CAST(${apInvoices.totalInc} AS NUMERIC)), 0)` })
          .from(apInvoices)
          .where(eq(apInvoices.companyId, companyId)),
      ]);

      const counts: Record<string, number | string> = {};
      for (const row of statusCounts) {
        counts[row.status] = row.count;
      }
      const assignedCount = assignedToMe[0]?.count || 0;
      const approvalCount = pendingMyApproval[0]?.count || 0;
      counts.waitingOnMe = assignedCount + approvalCount;
      counts.totalValue = totalValueResult[0]?.total || "0";

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
      const id = requireUUID(req, res, "id");
      if (!id) return;

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
        invoice.createdByUserId
          ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, invoice.createdByUserId)).limit(1).then(r => r[0])
          : Promise.resolve(null),
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
          .orderBy(asc(apInvoiceSplits.sortOrder))
          .limit(1000),
        db.select().from(apInvoiceExtractedFields).where(eq(apInvoiceExtractedFields.invoiceId, id)).limit(1000),
        db.select().from(apInvoiceDocuments).where(eq(apInvoiceDocuments.invoiceId, id)).limit(1000),
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
          .orderBy(asc(apInvoiceApprovals.stepIndex))
          .limit(1000),
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
          .orderBy(asc(apInvoiceComments.createdAt))
          .limit(1000),
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

  router.post("/api/ap-invoices/upload", requireAuth, upload.array("files", 20), validateUploads(), async (req: Request, res: Response) => {
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
          const { extractInvoiceInline } = await import("../../lib/ap-inbox-jobs");
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

  router.patch("/api/ap-invoices/:id", requireAuth, async (req: Request, res: Response) => {
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
}
