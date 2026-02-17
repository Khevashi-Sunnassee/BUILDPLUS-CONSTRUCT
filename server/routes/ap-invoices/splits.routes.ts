import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { eq, and, asc, isNull } from "drizzle-orm";
import {
  apInvoices, apInvoiceExtractedFields, apInvoiceSplits,
  suppliers, costCodes, jobs,
} from "@shared/schema";
import { requireUUID } from "../../lib/api-utils";
import type { SharedDeps } from "./shared";

const splitSchema = z.object({
  description: z.string().nullable().optional(),
  percentage: z.string().nullable().optional(),
  amount: z.string(),
  costCodeId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  taxCodeId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export function registerSplitsRoutes(router: Router, deps: SharedDeps): void {
  const { db, logActivity } = deps;

  router.get("/api/ap-invoices/:id/splits", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [invoice] = await db
        .select({ id: apInvoices.id, supplierId: apInvoices.supplierId })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      let supplierDefaultCostCodeId: string | null = null;
      if (invoice.supplierId) {
        const [sup] = await db
          .select({ defaultCostCodeId: suppliers.defaultCostCodeId })
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId))
          .limit(1);
        supplierDefaultCostCodeId = sup?.defaultCostCodeId || null;
      }

      if (supplierDefaultCostCodeId) {
        const blanks = await db
          .select({ id: apInvoiceSplits.id })
          .from(apInvoiceSplits)
          .where(and(
            eq(apInvoiceSplits.invoiceId, id),
            isNull(apInvoiceSplits.costCodeId)
          ))
          .limit(1000);

        if (blanks.length > 0) {
          await db.update(apInvoiceSplits)
            .set({ costCodeId: supplierDefaultCostCodeId })
            .where(and(
              eq(apInvoiceSplits.invoiceId, id),
              isNull(apInvoiceSplits.costCodeId)
            ));
        }
      }

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
        .orderBy(asc(apInvoiceSplits.sortOrder))
        .limit(1000);

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
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const rawBody = req.body;
      const isWrapped = rawBody && typeof rawBody === "object" && Array.isArray(rawBody.splits);
      const splitRows = isWrapped ? rawBody.splits : rawBody;
      const updateSupplierDefault = isWrapped ? !!rawBody.updateSupplierDefault : false;

      const body = z.array(splitSchema).parse(splitRows);

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

      if (existing.supplierId && body.length > 0 && updateSupplierDefault) {
        const firstCostCode = body.find(s => s.costCodeId)?.costCodeId;
        if (firstCostCode) {
          await db.update(suppliers)
            .set({ defaultCostCodeId: firstCostCode })
            .where(and(eq(suppliers.id, existing.supplierId), eq(suppliers.companyId, companyId)));
          logger.info({ supplierId: existing.supplierId, costCodeId: firstCostCode }, "[AP Splits] Updated supplier default cost code per user request");
        }
      }

      await logActivity(id, "splits_updated", `Updated ${body.length} split lines`, userId);

      const splits = await db
        .select()
        .from(apInvoiceSplits)
        .where(eq(apInvoiceSplits.invoiceId, id))
        .orderBy(asc(apInvoiceSplits.sortOrder))
        .limit(1000);

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
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select({ id: apInvoices.id })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Invoice not found" });

      const fields = await db
        .select()
        .from(apInvoiceExtractedFields)
        .where(eq(apInvoiceExtractedFields.invoiceId, id))
        .limit(1000);

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
      const id = requireUUID(req, res, "id");
      if (!id) return;

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
}
