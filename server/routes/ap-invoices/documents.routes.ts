import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { eq, and, desc, asc, ilike, inArray } from "drizzle-orm";
import {
  apInvoices, apInvoiceDocuments, apInvoiceExtractedFields,
  apInvoiceSplits, apInvoiceActivity, apInvoiceComments,
  apInvoiceApprovals, apApprovalRules, users, suppliers,
  companies, jobs, myobExportLogs,
  myobAccountMappings, myobTaxCodeMappings, myobSupplierMappings,
} from "@shared/schema";
import { assignApprovalPathToInvoice } from "../../lib/ap-approval-assign";
import { requireUUID, safeJsonParse } from "../../lib/api-utils";
import type { SharedDeps } from "./shared";
import { sendSuccess, sendBadRequest, sendNotFound, sendServerError } from "../../lib/api-response";

export function registerDocumentsRoutes(router: Router, deps: SharedDeps): void {
  const { db, objectStorageService, logActivity } = deps;

  router.get("/api/ap-invoices/:id/document", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select({ id: apInvoices.id })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return sendNotFound(res, "Invoice not found");

      const [doc] = await db
        .select()
        .from(apInvoiceDocuments)
        .where(eq(apInvoiceDocuments.invoiceId, id))
        .orderBy(desc(apInvoiceDocuments.createdAt))
        .limit(1);

      if (!doc) return sendNotFound(res, "Document not found");

      sendSuccess(res, {
        storageKey: doc.storageKey,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
      });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching AP invoice document");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.get("/api/ap-invoices/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select({ id: apInvoices.id })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return sendNotFound(res, "Invoice not found");

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
        .orderBy(asc(apInvoiceComments.createdAt))
        .limit(1000);

      sendSuccess(res, comments);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching AP invoice comments");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.post("/api/ap-invoices/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const body = z.object({ body: z.string().min(1, "Comment body is required") }).parse(req.body);

      const [existing] = await db
        .select({ id: apInvoices.id })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return sendNotFound(res, "Invoice not found");

      const [comment] = await db
        .insert(apInvoiceComments)
        .values({
          invoiceId: id,
          userId,
          body: body.body,
        })
        .returning();

      await logActivity(id, "comment_added", "Comment added", userId);

      sendSuccess(res, comment);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error adding AP invoice comment");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.get("/api/ap-invoices/:id/activity", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select({ id: apInvoices.id })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return sendNotFound(res, "Invoice not found");

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
        .orderBy(desc(apInvoiceActivity.createdAt))
        .limit(1000);

      sendSuccess(res, activity);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching AP invoice activity");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.get("/api/ap-invoices/:id/approval-path", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select({ id: apInvoices.id })
        .from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)))
        .limit(1);

      if (!existing) return sendNotFound(res, "Invoice not found");

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
        .orderBy(asc(apInvoiceApprovals.stepIndex))
        .limit(1000);

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
                      .where(inArray(companies.id, cond.values)).limit(1000);
                    resolved.resolvedValues = cond.values.map((v: string) => {
                      const c = companyRows.find(r => r.id === v);
                      return c?.name || v;
                    });
                    break;
                  }
                  case "SUPPLIER": {
                    const supplierRows = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers)
                      .where(inArray(suppliers.id, cond.values)).limit(1000);
                    resolved.resolvedValues = cond.values.map((v: string) => {
                      const s = supplierRows.find(r => r.id === v);
                      return s?.name || v;
                    });
                    break;
                  }
                  case "JOB": {
                    const jobRows = await db.select({ id: jobs.id, name: jobs.name, jobNumber: jobs.jobNumber }).from(jobs)
                      .where(inArray(jobs.id, cond.values)).limit(1000);
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

      sendSuccess(res, { steps, totalSteps, completedSteps, currentStepIndex });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching AP invoice approval path");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.post("/api/ap-invoices/:id/export/myob", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [invoice] = await db.select().from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);

      if (!invoice) return sendNotFound(res, "Invoice not found");
      if (invoice.status !== "APPROVED") return sendBadRequest(res, "Only approved invoices can be exported to MYOB");

      const splits = await db.select().from(apInvoiceSplits)
        .where(eq(apInvoiceSplits.invoiceId, id))
        .orderBy(asc(apInvoiceSplits.sortOrder))
        .limit(200);

      let supplierInfo: any = null;
      if (invoice.supplierId) {
        const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, invoice.supplierId)).limit(1);
        supplierInfo = sup || null;
      }

      const { createMyobClient, getConnectionStatus } = await import("../../myob");
      const connectionStatus = await getConnectionStatus(companyId);
      if (!connectionStatus.connected) {
        return sendBadRequest(res, "MYOB not connected. Please connect your MYOB account first.");
      }

      const myob = createMyobClient(companyId);

      const accountMaps = await db.select().from(myobAccountMappings)
        .where(eq(myobAccountMappings.companyId, companyId)).limit(500);
      const taxCodeMaps = await db.select().from(myobTaxCodeMappings)
        .where(eq(myobTaxCodeMappings.companyId, companyId)).limit(200);
      const supplierMaps = await db.select().from(myobSupplierMappings)
        .where(eq(myobSupplierMappings.companyId, companyId)).limit(500);

      const accountMapByCostCode = new Map(accountMaps.map((m) => [m.costCodeId, m]));
      const taxMapByCode = new Map(taxCodeMaps.map((m) => [m.bpTaxCode, m]));
      const supplierMapById = new Map(supplierMaps.map((m) => [m.supplierId, m]));

      let defaultTaxCodeUid: string | null = null;
      try {
        const myobTaxCodesResp: any = await myob.getTaxCodes();
        const taxItems: any[] = myobTaxCodesResp?.Items || [];
        const gstCode = taxItems.find((t: any) => t.Code === "GST") || taxItems.find((t: any) => t.Code?.includes("GST")) || taxItems[0];
        if (gstCode?.UID) defaultTaxCodeUid = gstCode.UID;
      } catch (e) {
        logger.warn({ err: e }, "Failed to fetch MYOB tax codes for export default");
      }

      const splitJobIds = [...new Set(splits.map((s) => s.jobId).filter(Boolean))] as string[];
      const jobMyobMap = new Map<string, string>();
      if (splitJobIds.length > 0) {
        const jobRows = await db.select({ id: jobs.id, myobJobUid: jobs.myobJobUid })
          .from(jobs)
          .where(and(inArray(jobs.id, splitJobIds), eq(jobs.companyId, companyId)))
          .limit(200);
        for (const j of jobRows) {
          if (j.myobJobUid) jobMyobMap.set(j.id, j.myobJobUid);
        }
      }

      const billLines = splits.map((split) => {
        const acctMap = split.costCodeId ? accountMapByCostCode.get(split.costCodeId) : null;
        const taxMap = split.taxCodeId ? taxMapByCode.get(split.taxCodeId) : null;
        const myobJobUid = split.jobId ? jobMyobMap.get(split.jobId) : undefined;
        const lineTotal = parseFloat(split.amount) + parseFloat(split.gstAmount || "0");
        const lineTaxCodeUid = taxMap?.myobTaxCodeUid || defaultTaxCodeUid;
        return {
          Type: "Transaction" as const,
          Description: split.description || invoice.description || "AP Invoice",
          Total: lineTotal,
          Account: acctMap ? { UID: acctMap.myobAccountUid } : undefined,
          Job: myobJobUid ? { UID: myobJobUid } : undefined,
          TaxCode: lineTaxCodeUid ? { UID: lineTaxCodeUid } : undefined,
        };
      });

      if (billLines.length === 0) {
        billLines.push({
          Type: "Transaction" as const,
          Description: invoice.description || "AP Invoice",
          Total: parseFloat(invoice.totalInc || "0"),
          Account: undefined,
          Job: undefined,
          TaxCode: defaultTaxCodeUid ? { UID: defaultTaxCodeUid } : undefined,
        });
      }

      const supplierMap = invoice.supplierId ? supplierMapById.get(invoice.supplierId) : null;
      const supplierUid = supplierMap?.myobSupplierUid;

      if (!supplierUid) {
        return sendBadRequest(res, `Supplier "${supplierInfo?.name || 'unknown'}" is not mapped to a MYOB supplier. Please add the mapping in MYOB Integration → Code Mapping → Suppliers before exporting.`);
      }

      const bill: any = {
        Date: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : new Date().toISOString(),
        Supplier: { UID: supplierUid },
        SupplierInvoiceNumber: invoice.invoiceNumber,
        IsTaxInclusive: true,
        Comment: invoice.description || "",
        Lines: billLines,
      };
      if (defaultTaxCodeUid) {
        bill.FreightTaxCode = { UID: defaultTaxCodeUid };
      }

      try {
        const result: any = await myob.createPurchaseBill(bill);

        let attachmentResult: any = null;
        const billLocation = result?._location;
        const billUid = billLocation ? billLocation.split("/").pop() : null;

        if (billUid) {
          try {
            const docs = await db.select().from(apInvoiceDocuments)
              .where(eq(apInvoiceDocuments.invoiceId, id))
              .orderBy(desc(apInvoiceDocuments.createdAt))
              .limit(5);

            for (const doc of docs) {
              try {
                const objectFile = await objectStorageService.getObjectEntityFile(doc.storageKey);
                const [buffer] = await objectFile.download();
                const fileSizeMB = buffer.length / (1024 * 1024);

                if (fileSizeMB > 3) {
                  logger.warn({ fileName: doc.fileName, sizeMB: fileSizeMB.toFixed(2) }, "[MYOB Export] Skipping attachment - file exceeds 3MB MYOB limit");
                  continue;
                }

                const fileBase64 = buffer.toString("base64");
                attachmentResult = await myob.attachFileToBill(billUid, doc.fileName, fileBase64);
                logger.info({ fileName: doc.fileName, billUid }, "[MYOB Export] Attached invoice document to MYOB bill");
              } catch (attachErr: any) {
                logger.warn({ err: attachErr?.message, fileName: doc.fileName, billUid }, "[MYOB Export] Failed to attach document to MYOB bill (non-fatal)");
              }
            }
          } catch (docErr: any) {
            logger.warn({ err: docErr?.message }, "[MYOB Export] Failed to fetch documents for attachment (non-fatal)");
          }
        }

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

        await logActivity(id, "exported", "Invoice exported to MYOB" + (attachmentResult ? " with attachment" : ""), userId, { myobResult: result });

        sendSuccess(res, { success: true, myobResult: result, attachmentResult });
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

        sendServerError(res, `MYOB export failed: ${myobError.message}`);
      }
    } catch (error: unknown) {
      logger.error({ err: error }, "Error exporting AP invoice to MYOB");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.get("/api/ap-invoices/:id/document-view", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [invoice] = await db.select().from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);
      if (!invoice) return sendNotFound(res, "Invoice not found");

      const docs = await db.select().from(apInvoiceDocuments)
        .where(eq(apInvoiceDocuments.invoiceId, id)).limit(200);
      if (!docs.length) return sendNotFound(res, "No document found");

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
          if (!res.headersSent) sendServerError(res, "Error streaming file");
        });
        stream.pipe(res);
      } catch (storageErr: any) {
        logger.error({ err: storageErr }, "Error retrieving AP invoice document from storage");
        sendNotFound(res, "Document file not found in storage");
      }
    } catch (error: unknown) {
      logger.error({ err: error }, "Error serving AP invoice document");
      sendServerError(res, "Failed to serve document");
    }
  });

  router.get("/api/ap-invoices/:id/page-thumbnails", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [invoice] = await db.select().from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);
      if (!invoice) return sendNotFound(res, "Invoice not found");

      const docs = await db.select().from(apInvoiceDocuments)
        .where(eq(apInvoiceDocuments.invoiceId, id)).limit(200);
      if (!docs.length) return sendNotFound(res, "No document found");

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

          const parseResult = safeJsonParse(result);
          const parsed = parseResult.success ? parseResult.data : { error: "Failed to parse extraction result", raw: result.slice(0, 500) };
          sendSuccess(res, parsed);
        } finally {
          try {
            const fs2 = await import("fs");
            fs2.rmSync(tmpDir, { recursive: true, force: true });
          } catch {}
        }
      } else if (doc.mimeType?.startsWith("image/")) {
        const thumbnail = buffer.toString("base64");
        sendSuccess(res, {
          totalPages: 1,
          pages: [{
            pageNumber: 1,
            thumbnail,
            width: 0,
            height: 0,
          }],
        });
      } else {
        sendBadRequest(res, "Unsupported document type");
      }
    } catch (error: unknown) {
      logger.error({ err: error }, "Error generating page thumbnails");
      sendServerError(res, "An internal error occurred");
    }
  });

  router.post("/api/ap-invoices/:id/extract", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return sendBadRequest(res, "Company context required");
      const userId = req.session.userId!;
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [invoice] = await db.select().from(apInvoices)
        .where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId))).limit(1);
      if (!invoice) return sendNotFound(res, "Invoice not found");

      const docs = await db.select().from(apInvoiceDocuments)
        .where(eq(apInvoiceDocuments.invoiceId, id)).limit(200);
      if (!docs.length) return sendBadRequest(res, "No document to extract from");

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

        const { prepareDocumentForExtraction } = await import("../../lib/ap-document-prep");
        const prepared = await prepareDocumentForExtraction(buffer, doc.mimeType);
        extractedText = prepared.extractedText;
        imageBuffers = prepared.imageBuffers;

        if (imageBuffers.length === 0) {
          return sendServerError(res, "Failed to convert document to images for extraction");
        }
      } catch (err: any) {
        logger.error({ err }, "Error reading document for extraction");
        return sendServerError(res, "Cannot read document file");
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { AP_EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt, parseExtractedData, buildExtractedFieldRecords, buildInvoiceUpdateFromExtraction, sanitizeNumericValue } = await import("../../lib/ap-extraction-prompt");
      const { getSupplierCostCodeContext } = await import("../../lib/ap-auto-split");

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
        return sendServerError(res, "Extraction produced invalid response");
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
          .limit(100);
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

      const { createAutoSplit } = await import("../../lib/ap-auto-split");
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

      sendSuccess(res, {
        success: true,
        extractedData: data,
        fieldsStored: fieldRecords.length,
        riskScore: updateData.riskScore,
        riskReasons: updateData.riskReasons,
      });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error extracting AP invoice fields");
      sendServerError(res, "An internal error occurred");
    }
  });
}
