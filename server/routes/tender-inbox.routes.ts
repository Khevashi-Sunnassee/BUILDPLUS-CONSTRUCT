import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { validateUploads } from "../middleware/file-validation";
import { db } from "../db";
import { eq, and, desc, sql, ilike, or, count } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import {
  tenderInboundEmails, tenderInboxSettings, tenderEmailDocuments,
  tenderEmailExtractedFields, tenderEmailActivity,
  tenders, tenderSubmissions, suppliers, companies
} from "@shared/schema";
import { getResendApiKey } from "../services/email.service";
import { requireUUID, safeJsonParse } from "../lib/api-utils";
import { sendSuccess, sendBadRequest, sendNotFound, sendServerError } from "../lib/api-response";

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Records an audit trail entry for a tender inbound email lifecycle event.
 * Every state change (upload, extraction, matching) is logged with an actor
 * and optional metadata so the full processing history can be reconstructed.
 */
async function logTenderEmailActivity(
  inboundEmailId: string,
  activityType: string,
  message: string,
  actorUserId?: string,
  metaJson?: any
) {
  await db.insert(tenderEmailActivity).values({
    inboundEmailId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

router.get("/api/tender-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");

    const [settings] = await db.select().from(tenderInboxSettings)
      .where(eq(tenderInboxSettings.companyId, companyId)).limit(1);

    const [company] = await db.select({ tenderInboxEmail: companies.tenderInboxEmail })
      .from(companies).where(eq(companies.id, companyId)).limit(1);
    const centralEmail = company?.tenderInboxEmail || null;

    if (!settings) {
      return sendSuccess(res, {
        companyId,
        isEnabled: false,
        inboundEmailAddress: centralEmail,
        autoExtract: true,
        notifyUserIds: [],
      });
    }

    sendSuccess(res, { ...settings, inboundEmailAddress: centralEmail || settings.inboundEmailAddress });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender inbox settings");
    sendServerError(res, "An internal error occurred");
  }
});

router.put("/api/tender-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");

    const { inboundEmailAddress: _ignored, ...body } = z.object({
      isEnabled: z.boolean().optional(),
      inboundEmailAddress: z.string().nullable().optional(),
      autoExtract: z.boolean().optional(),
      notifyUserIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(tenderInboxSettings)
      .where(eq(tenderInboxSettings.companyId, companyId)).limit(1);

    let settings;
    if (existing) {
      [settings] = await db.update(tenderInboxSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(tenderInboxSettings.companyId, companyId))
        .returning();
    } else {
      [settings] = await db.insert(tenderInboxSettings)
        .values({ companyId, ...body })
        .returning();
    }

    sendSuccess(res, settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating tender inbox settings");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;

    const conditions: any[] = [eq(tenderInboundEmails.companyId, companyId)];

    if (status) {
      conditions.push(eq(tenderInboundEmails.status, status));
    }

    if (q) {
      const search = `%${q}%`;
      conditions.push(
        or(
          ilike(tenderInboundEmails.fromAddress, search),
          ilike(tenderInboundEmails.subject, search),
          ilike(suppliers.name, search),
        )
      );
    }

    const whereClause = and(...conditions);

    const [emailRows, countResult] = await Promise.all([
      db
        .select({
          id: tenderInboundEmails.id,
          companyId: tenderInboundEmails.companyId,
          resendEmailId: tenderInboundEmails.resendEmailId,
          fromAddress: tenderInboundEmails.fromAddress,
          toAddress: tenderInboundEmails.toAddress,
          subject: tenderInboundEmails.subject,
          status: tenderInboundEmails.status,
          supplierId: tenderInboundEmails.supplierId,
          tenderId: tenderInboundEmails.tenderId,
          tenderSubmissionId: tenderInboundEmails.tenderSubmissionId,
          attachmentCount: tenderInboundEmails.attachmentCount,
          processingError: tenderInboundEmails.processingError,
          processedAt: tenderInboundEmails.processedAt,
          matchedAt: tenderInboundEmails.matchedAt,
          createdAt: tenderInboundEmails.createdAt,
          supplierName: suppliers.name,
        })
        .from(tenderInboundEmails)
        .leftJoin(suppliers, eq(tenderInboundEmails.supplierId, suppliers.id))
        .where(whereClause)
        .orderBy(desc(tenderInboundEmails.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(tenderInboundEmails)
        .leftJoin(suppliers, eq(tenderInboundEmails.supplierId, suppliers.id))
        .where(whereClause),
    ]);

    sendSuccess(res, {
      emails: emailRows,
      total: countResult[0]?.total || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender inbound emails");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");

    const statusCounts = await db
      .select({
        status: tenderInboundEmails.status,
        count: count(),
      })
      .from(tenderInboundEmails)
      .where(eq(tenderInboundEmails.companyId, companyId))
      .groupBy(tenderInboundEmails.status);

    const counts: Record<string, number> = {
      received: 0,
      processing: 0,
      processed: 0,
      matched: 0,
      archived: 0,
      failed: 0,
      all: 0,
    };

    for (const row of statusCounts) {
      const key = row.status.toLowerCase();
      if (key in counts) {
        counts[key] = row.count;
      }
      counts.all += row.count;
    }

    sendSuccess(res, counts);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender inbox counts");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)))
      .limit(1);

    if (!email) return sendNotFound(res, "Tender email not found");

    const [
      documents,
      extractedFields,
      supplier,
      tender,
      submission,
    ] = await Promise.all([
      db.select().from(tenderEmailDocuments)
        .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(1000),
      db.select().from(tenderEmailExtractedFields)
        .where(eq(tenderEmailExtractedFields.inboundEmailId, id)).limit(1000),
      email.supplierId
        ? db.select().from(suppliers).where(eq(suppliers.id, email.supplierId)).limit(1).then(r => r[0])
        : Promise.resolve(null),
      email.tenderId
        ? db.select().from(tenders).where(eq(tenders.id, email.tenderId)).limit(1).then(r => r[0])
        : Promise.resolve(null),
      email.tenderSubmissionId
        ? db.select().from(tenderSubmissions).where(eq(tenderSubmissions.id, email.tenderSubmissionId)).limit(1).then(r => r[0])
        : Promise.resolve(null),
    ]);

    sendSuccess(res, {
      ...email,
      documents,
      extractedFields,
      supplier: supplier || null,
      tender: tender || null,
      tenderSubmission: submission || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender email detail");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/tender-inbox/upload", requireAuth, upload.array("files", 20), validateUploads(), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return sendBadRequest(res, "Company context required");

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return sendBadRequest(res, "At least one file is required");

    const [settings] = await db.select().from(tenderInboxSettings)
      .where(eq(tenderInboxSettings.companyId, companyId)).limit(1);

    const createdEmails = [];

    for (const file of files) {
      const fileExt = file.originalname.split(".").pop() || "pdf";
      const storageKey = `tender-emails/${companyId}/${crypto.randomUUID()}.${fileExt}`;

      await objectStorageService.uploadFile(storageKey, file.buffer, file.mimetype);

      const [emailRecord] = await db.insert(tenderInboundEmails).values({
        companyId,
        resendEmailId: `manual-upload-${crypto.randomUUID()}`,
        fromAddress: "manual-upload",
        toAddress: null,
        subject: file.originalname,
        status: "RECEIVED",
        attachmentCount: 1,
      }).returning();

      await db.insert(tenderEmailDocuments).values({
        inboundEmailId: emailRecord.id,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      await logTenderEmailActivity(emailRecord.id, "uploaded", `Document uploaded manually by user`, userId, {
        fileName: file.originalname,
        fileSize: file.size,
      });

      if (settings?.autoExtract) {
        try {
          const { extractTenderEmailInline } = await import("../lib/tender-inbox-jobs");
          await extractTenderEmailInline(emailRecord.id, companyId, file.buffer, file.mimetype);
        } catch (extractErr: any) {
          logger.warn({ err: extractErr }, "Tender email extraction failed");
        }
      }

      const [updated] = await db.select().from(tenderInboundEmails)
        .where(eq(tenderInboundEmails.id, emailRecord.id)).limit(1);
      createdEmails.push(updated || emailRecord);
    }

    sendSuccess(res, createdEmails.length === 1 ? createdEmails[0] : { emails: createdEmails, count: createdEmails.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading tender email document");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/emails/:id/document-view", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(200);
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
        logger.error({ err }, "Stream error serving tender email document");
        if (!res.headersSent) sendServerError(res, "Error streaming file");
      });
      stream.pipe(res);
    } catch (storageErr: any) {
      logger.error({ err: storageErr }, "Error retrieving tender email document from storage");
      sendNotFound(res, "Document file not found in storage");
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error serving tender email document");
    sendServerError(res, "Failed to serve document");
  }
});

router.get("/api/tender-inbox/emails/:id/extracted-fields", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    const fields = await db.select().from(tenderEmailExtractedFields)
      .where(eq(tenderEmailExtractedFields.inboundEmailId, id)).limit(200);

    sendSuccess(res, fields);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender email extracted fields");
    sendServerError(res, "An internal error occurred");
  }
});

/**
 * Triggers AI/OCR extraction on a tender email's attached document.
 * Flow: sets status to PROCESSING → downloads the document from object storage
 * into memory → delegates to extractTenderEmailInline which runs OCR/AI parsing
 * to populate tenderEmailExtractedFields (subtotal, tax, total, cover note, etc.).
 * Extraction failures are logged but non-fatal — the email remains in PROCESSING.
 */
router.post("/api/tender-inbox/emails/:id/extract", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(200);
    if (!docs.length) return sendNotFound(res, "No document found for extraction");

    const doc = docs[0];

    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)));

    const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
    const chunks: Buffer[] = [];
    const stream = file.createReadStream();
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);
    const mimeType = doc.mimeType || "application/pdf";

    try {
      const { extractTenderEmailInline } = await import("../lib/tender-inbox-jobs");
      await extractTenderEmailInline(id, companyId, fileBuffer, mimeType);
    } catch (extractErr: any) {
      logger.warn({ err: extractErr }, "Tender email extraction failed");
    }

    await logTenderEmailActivity(id, "extraction_triggered", "OCR extraction triggered", userId || undefined);

    const [updated] = await db.select().from(tenderInboundEmails)
      .where(eq(tenderInboundEmails.id, id)).limit(1);

    sendSuccess(res, updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error triggering tender email extraction");
    sendServerError(res, "An internal error occurred");
  }
});

/**
 * Matches an inbound tender email to a tender + supplier, creating a submission
 * if one doesn't already exist. When no submissionId is provided, it builds a
 * new tenderSubmission from extracted fields (subtotal/tax/total/cover note),
 * computing totalPrice from subtotal+tax when total is missing.
 * Sets the email status to MATCHED with a timestamp for audit purposes.
 */
router.post("/api/tender-inbox/emails/:id/match", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const body = z.object({
      tenderId: z.string(),
      supplierId: z.string(),
      tenderSubmissionId: z.string().optional(),
    }).parse(req.body);

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    let submissionId = body.tenderSubmissionId || null;

    if (!submissionId && email.tenderSubmissionId) {
      submissionId = email.tenderSubmissionId;
    }

    if (!submissionId) {
      const extractedFields = await db.select().from(tenderEmailExtractedFields)
        .where(eq(tenderEmailExtractedFields.inboundEmailId, id)).limit(200);

      let subtotal = "0";
      let taxAmount = "0";
      let totalPrice = "0";
      let coverNote: string | null = null;

      for (const field of extractedFields) {
        const val = field.fieldValue || "0";
        if (field.fieldKey === "subtotal") subtotal = val;
        else if (field.fieldKey === "tax_amount" || field.fieldKey === "gst") taxAmount = val;
        else if (field.fieldKey === "total" || field.fieldKey === "total_price") totalPrice = val;
        else if (field.fieldKey === "cover_note" || field.fieldKey === "description") coverNote = field.fieldValue;
      }

      if (totalPrice === "0" && subtotal !== "0") {
        totalPrice = (parseFloat(subtotal) + parseFloat(taxAmount)).toFixed(2);
      }

      const [newSubmission] = await db.insert(tenderSubmissions).values({
        companyId,
        tenderId: body.tenderId,
        supplierId: body.supplierId,
        status: "SUBMITTED",
        subtotal,
        taxAmount,
        totalPrice,
        coverNote: coverNote || `Submission from email: ${email.subject || "No subject"}`,
        submittedAt: new Date(),
        createdById: userId!,
      }).returning();

      submissionId = newSubmission.id;
    }

    const [updated] = await db.update(tenderInboundEmails)
      .set({
        tenderId: body.tenderId,
        supplierId: body.supplierId,
        tenderSubmissionId: submissionId,
        status: "MATCHED",
        matchedAt: new Date(),
      })
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)))
      .returning();

    await logTenderEmailActivity(id, "matched", `Matched to tender and supplier`, userId || undefined, {
      tenderId: body.tenderId,
      supplierId: body.supplierId,
      tenderSubmissionId: submissionId,
    });

    sendSuccess(res, updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error matching tender email");
    sendServerError(res, "An internal error occurred");
  }
});

router.patch("/api/tender-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [existing] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!existing) return sendNotFound(res, "Tender email not found");

    const body = z.object({
      supplierId: z.string().nullable().optional(),
      tenderId: z.string().nullable().optional(),
      tenderSubmissionId: z.string().nullable().optional(),
      status: z.string().optional(),
    }).parse(req.body);

    const updates: any = {};
    const changedFields: string[] = [];

    if (body.supplierId !== undefined) {
      updates.supplierId = body.supplierId;
      changedFields.push("supplierId");
    }
    if (body.tenderId !== undefined) {
      updates.tenderId = body.tenderId;
      changedFields.push("tenderId");
    }
    if (body.tenderSubmissionId !== undefined) {
      updates.tenderSubmissionId = body.tenderSubmissionId;
      changedFields.push("tenderSubmissionId");
    }
    if (body.status !== undefined) {
      updates.status = body.status;
      changedFields.push("status");
    }

    if (Object.keys(updates).length === 0) {
      return sendSuccess(res, existing);
    }

    const [updated] = await db.update(tenderInboundEmails)
      .set(updates)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)))
      .returning();

    if (changedFields.length > 0) {
      await logTenderEmailActivity(id, "fields_updated", `Updated fields: ${changedFields.join(", ")}`, userId || undefined, { changedFields });
    }

    sendSuccess(res, updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating tender email");
    sendServerError(res, "An internal error occurred");
  }
});

router.delete("/api/tender-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(200);

    for (const doc of docs) {
      try {
        await objectStorageService.deleteFile(doc.storageKey);
      } catch (delErr: any) {
        logger.warn({ err: delErr, storageKey: doc.storageKey }, "Failed to delete tender email document from storage");
      }
    }

    await db.delete(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)));

    sendSuccess(res, { success: true, deletedId: id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting tender email");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/emails/:id/activity", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    const activity = await db.select().from(tenderEmailActivity)
      .where(eq(tenderEmailActivity.inboundEmailId, id))
      .orderBy(desc(tenderEmailActivity.createdAt))
      .limit(500);

    sendSuccess(res, activity);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender email activity");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/emails/:id/page-thumbnails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return sendNotFound(res, "Tender email not found");

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(200);
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
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tender-thumbs-"));
      const pdfPath = path.join(tmpDir, "tender.pdf");
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
    logger.error({ err: error }, "Error generating tender email page thumbnails");
    sendServerError(res, "An internal error occurred");
  }
});

router.post("/api/tender-inbox/check-emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");

    const [settings] = await db.select().from(tenderInboxSettings)
      .where(and(eq(tenderInboxSettings.companyId, companyId), eq(tenderInboxSettings.isEnabled, true)))
      .limit(1);

    if (!settings || !settings.inboundEmailAddress) {
      return sendBadRequest(res, "Tender email inbox not configured. Set up inbox settings first.");
    }

    const { scheduler } = await import("../lib/background-scheduler");
    const isRunning = scheduler.isJobRunning("tender-email-poll");
    if (isRunning) {
      return sendSuccess(res, { triggered: true, message: "Tender email check is already running in the background" });
    }

    const triggered = await scheduler.triggerNow("tender-email-poll");
    sendSuccess(res, {
      triggered,
      message: triggered
        ? "Tender email check started in background. New emails will appear shortly."
        : "Could not start tender email check. Job may not be registered yet.",
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[Tender Inbox] Error triggering email check");
    sendServerError(res, "An internal error occurred");
  }
});

router.get("/api/tender-inbox/background-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { scheduler } = await import("../lib/background-scheduler");

    const jobStatus = scheduler.getStatus();

    const companyId = req.companyId;
    const [receivedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenderInboundEmails)
      .where(and(
        eq(tenderInboundEmails.status, "RECEIVED"),
        companyId ? eq(tenderInboundEmails.companyId, companyId) : sql`true`
      ));

    sendSuccess(res, {
      emailPoll: jobStatus["tender-email-poll"] || { running: false },
      pendingProcessing: receivedCount?.count || 0,
    });
  } catch (error: unknown) {
    sendServerError(res, "Failed to get background status");
  }
});

export { router as tenderInboxRouter };
export default router;
