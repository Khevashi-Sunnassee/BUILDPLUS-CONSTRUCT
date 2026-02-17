import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { eq, and, desc, sql, ilike, or, count } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import {
  draftingInboundEmails, draftingInboxSettings, draftingEmailDocuments,
  draftingEmailExtractedFields, draftingEmailActivity, jobs, taskGroups, users, companies
} from "@shared/schema";
import { requireUUID, safeJsonParse } from "../lib/api-utils";
import { storage } from "../storage";

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function logDraftingEmailActivity(
  inboundEmailId: string,
  activityType: string,
  message: string,
  actorUserId?: string,
  metaJson?: any
) {
  await db.insert(draftingEmailActivity).values({
    inboundEmailId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

router.get("/api/drafting-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(draftingInboxSettings)
      .where(eq(draftingInboxSettings.companyId, companyId)).limit(1);

    const [company] = await db.select({ draftingInboxEmail: companies.draftingInboxEmail })
      .from(companies).where(eq(companies.id, companyId)).limit(1);
    const centralEmail = company?.draftingInboxEmail || null;

    if (!settings) {
      return res.json({
        companyId,
        isEnabled: false,
        inboundEmailAddress: centralEmail,
        autoExtract: true,
        notifyUserIds: [],
      });
    }

    res.json({ ...settings, inboundEmailAddress: centralEmail || settings.inboundEmailAddress });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch drafting inbox settings" });
  }
});

router.put("/api/drafting-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { inboundEmailAddress: _ignored, ...body } = z.object({
      isEnabled: z.boolean().optional(),
      inboundEmailAddress: z.string().nullable().optional(),
      autoExtract: z.boolean().optional(),
      notifyUserIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(draftingInboxSettings)
      .where(eq(draftingInboxSettings.companyId, companyId)).limit(1);

    let settings;
    if (existing) {
      [settings] = await db.update(draftingInboxSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(draftingInboxSettings.companyId, companyId))
        .returning();
    } else {
      [settings] = await db.insert(draftingInboxSettings)
        .values({ companyId, ...body })
        .returning();
    }

    res.json(settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating drafting inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update drafting inbox settings" });
  }
});

router.get("/api/drafting-inbox/emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;

    const conditions: any[] = [eq(draftingInboundEmails.companyId, companyId)];

    if (status) {
      conditions.push(eq(draftingInboundEmails.status, status));
    }

    if (q) {
      const search = `%${q}%`;
      conditions.push(
        or(
          ilike(draftingInboundEmails.fromAddress, search),
          ilike(draftingInboundEmails.subject, search),
          ilike(jobs.name, search),
          ilike(jobs.jobNumber, search),
        )
      );
    }

    const whereClause = and(...conditions);

    const [emailRows, countResult] = await Promise.all([
      db
        .select({
          id: draftingInboundEmails.id,
          companyId: draftingInboundEmails.companyId,
          resendEmailId: draftingInboundEmails.resendEmailId,
          fromAddress: draftingInboundEmails.fromAddress,
          toAddress: draftingInboundEmails.toAddress,
          subject: draftingInboundEmails.subject,
          status: draftingInboundEmails.status,
          jobId: draftingInboundEmails.jobId,
          requestType: draftingInboundEmails.requestType,
          impactArea: draftingInboundEmails.impactArea,
          attachmentCount: draftingInboundEmails.attachmentCount,
          processingError: draftingInboundEmails.processingError,
          processedAt: draftingInboundEmails.processedAt,
          matchedAt: draftingInboundEmails.matchedAt,
          createdAt: draftingInboundEmails.createdAt,
          jobName: jobs.name,
          jobNumber: jobs.jobNumber,
        })
        .from(draftingInboundEmails)
        .leftJoin(jobs, eq(draftingInboundEmails.jobId, jobs.id))
        .where(whereClause)
        .orderBy(desc(draftingInboundEmails.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(draftingInboundEmails)
        .leftJoin(jobs, eq(draftingInboundEmails.jobId, jobs.id))
        .where(whereClause),
    ]);

    res.json({
      emails: emailRows,
      total: countResult[0]?.total || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting inbound emails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch drafting inbound emails" });
  }
});

router.get("/api/drafting-inbox/counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const statusCounts = await db
      .select({
        status: draftingInboundEmails.status,
        count: count(),
      })
      .from(draftingInboundEmails)
      .where(eq(draftingInboundEmails.companyId, companyId))
      .groupBy(draftingInboundEmails.status);

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

    res.json(counts);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting inbox counts");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch counts" });
  }
});

router.get("/api/drafting-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)))
      .limit(1);

    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const [
      documents,
      extractedFields,
      job,
    ] = await Promise.all([
      db.select().from(draftingEmailDocuments)
        .where(eq(draftingEmailDocuments.inboundEmailId, id)).limit(1000),
      db.select().from(draftingEmailExtractedFields)
        .where(eq(draftingEmailExtractedFields.inboundEmailId, id)).limit(1000),
      email.jobId
        ? db.select().from(jobs).where(eq(jobs.id, email.jobId)).limit(1).then(r => r[0])
        : Promise.resolve(null),
    ]);

    res.json({
      ...email,
      documents,
      extractedFields,
      job: job || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting email detail");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch drafting email" });
  }
});

router.post("/api/drafting-inbox/upload", requireAuth, upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "At least one file is required" });

    const [settings] = await db.select().from(draftingInboxSettings)
      .where(eq(draftingInboxSettings.companyId, companyId)).limit(1);

    const createdEmails = [];

    for (const file of files) {
      const fileExt = file.originalname.split(".").pop() || "pdf";
      const storageKey = `drafting-emails/${companyId}/${crypto.randomUUID()}.${fileExt}`;

      await objectStorageService.uploadFile(storageKey, file.buffer, file.mimetype);

      const [emailRecord] = await db.insert(draftingInboundEmails).values({
        companyId,
        resendEmailId: `manual-upload-${crypto.randomUUID()}`,
        fromAddress: "manual-upload",
        toAddress: null,
        subject: file.originalname,
        status: "RECEIVED",
        attachmentCount: 1,
      }).returning();

      await db.insert(draftingEmailDocuments).values({
        inboundEmailId: emailRecord.id,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      await logDraftingEmailActivity(emailRecord.id, "uploaded", `Document uploaded manually by user`, userId, {
        fileName: file.originalname,
        fileSize: file.size,
      });

      if (settings?.autoExtract) {
        try {
          const { extractDraftingEmailFromDocument } = await import("../lib/drafting-inbox-jobs");
          await extractDraftingEmailFromDocument(emailRecord.id, companyId, file.buffer, file.mimetype);
        } catch (extractErr: any) {
          logger.warn({ err: extractErr }, "Drafting email extraction failed");
        }
      }

      const [updated] = await db.select().from(draftingInboundEmails)
        .where(eq(draftingInboundEmails.id, emailRecord.id)).limit(1);
      createdEmails.push(updated || emailRecord);
    }

    res.json(createdEmails.length === 1 ? createdEmails[0] : { emails: createdEmails, count: createdEmails.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading drafting email document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
});

router.get("/api/drafting-inbox/emails/:id/document-view", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const docs = await db.select().from(draftingEmailDocuments)
      .where(eq(draftingEmailDocuments.inboundEmailId, id)).limit(200);
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
        logger.error({ err }, "Stream error serving drafting email document");
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (storageErr: any) {
      logger.error({ err: storageErr }, "Error retrieving drafting email document from storage");
      res.status(404).json({ error: "Document file not found in storage" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error serving drafting email document");
    res.status(500).json({ error: "Failed to serve document" });
  }
});

router.get("/api/drafting-inbox/emails/:id/extracted-fields", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const fields = await db.select().from(draftingEmailExtractedFields)
      .where(eq(draftingEmailExtractedFields.inboundEmailId, id)).limit(200);

    res.json(fields);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting email extracted fields");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch extracted fields" });
  }
});

router.post("/api/drafting-inbox/emails/:id/extract", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const docs = await db.select().from(draftingEmailDocuments)
      .where(eq(draftingEmailDocuments.inboundEmailId, id)).limit(200);

    if (docs.length > 0) {
      const doc = docs[0];

      await db.update(draftingInboundEmails)
        .set({ status: "PROCESSING" })
        .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)));

      const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
      const chunks: Buffer[] = [];
      const stream = file.createReadStream();
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);
      const mimeType = doc.mimeType || "application/pdf";

      try {
        const { extractDraftingEmailFromDocument } = await import("../lib/drafting-inbox-jobs");
        await extractDraftingEmailFromDocument(id, companyId, fileBuffer, mimeType);
      } catch (extractErr: any) {
        logger.warn({ err: extractErr }, "Drafting email document extraction failed");
      }
    } else if (email.textBody || email.htmlBody) {
      await db.update(draftingInboundEmails)
        .set({ status: "PROCESSING" })
        .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)));

      try {
        const { extractDraftingEmail } = await import("../lib/drafting-inbox-jobs");
        await extractDraftingEmail(id, companyId, email.textBody || email.htmlBody || "", email.subject || "");
      } catch (extractErr: any) {
        logger.warn({ err: extractErr }, "Drafting email text extraction failed");
      }
    } else {
      return res.status(404).json({ error: "No document or email body found for extraction" });
    }

    await logDraftingEmailActivity(id, "extraction_triggered", "AI extraction triggered", userId || undefined);

    const [updated] = await db.select().from(draftingInboundEmails)
      .where(eq(draftingInboundEmails.id, id)).limit(1);

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error triggering drafting email extraction");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to trigger extraction" });
  }
});

router.post("/api/drafting-inbox/emails/:id/match", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const body = z.object({
      jobId: z.string(),
    }).parse(req.body);

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, body.jobId), eq(jobs.companyId, companyId))).limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const [updated] = await db.update(draftingInboundEmails)
      .set({
        jobId: body.jobId,
        status: "MATCHED",
        matchedAt: new Date(),
      })
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)))
      .returning();

    await logDraftingEmailActivity(id, "matched", `Matched to job: ${job.jobNumber} - ${job.name}`, userId || undefined, {
      jobId: body.jobId,
      jobNumber: job.jobNumber,
      jobName: job.name,
    });

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error matching drafting email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to match drafting email" });
  }
});

router.patch("/api/drafting-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [existing] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Drafting email not found" });

    const body = z.object({
      jobId: z.string().nullable().optional(),
      status: z.string().optional(),
      requestType: z.string().nullable().optional(),
      impactArea: z.string().nullable().optional(),
    }).parse(req.body);

    const updates: any = {};
    const changedFields: string[] = [];

    if (body.jobId !== undefined) {
      updates.jobId = body.jobId;
      changedFields.push("jobId");
    }
    if (body.status !== undefined) {
      updates.status = body.status;
      changedFields.push("status");
    }
    if (body.requestType !== undefined) {
      updates.requestType = body.requestType;
      changedFields.push("requestType");
    }
    if (body.impactArea !== undefined) {
      updates.impactArea = body.impactArea;
      changedFields.push("impactArea");
    }

    if (Object.keys(updates).length === 0) {
      return res.json(existing);
    }

    const [updated] = await db.update(draftingInboundEmails)
      .set(updates)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)))
      .returning();

    if (changedFields.length > 0) {
      await logDraftingEmailActivity(id, "fields_updated", `Updated fields: ${changedFields.join(", ")}`, userId || undefined, { changedFields });
    }

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating drafting email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update drafting email" });
  }
});

router.delete("/api/drafting-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const docs = await db.select().from(draftingEmailDocuments)
      .where(eq(draftingEmailDocuments.inboundEmailId, id)).limit(200);

    for (const doc of docs) {
      try {
        await objectStorageService.deleteFile(doc.storageKey);
      } catch (delErr: any) {
        logger.warn({ err: delErr, storageKey: doc.storageKey }, "Failed to delete drafting email document from storage");
      }
    }

    await db.delete(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)));

    res.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting drafting email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete drafting email" });
  }
});

router.get("/api/drafting-inbox/emails/:id/activity", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const activity = await db.select().from(draftingEmailActivity)
      .where(eq(draftingEmailActivity.inboundEmailId, id))
      .orderBy(desc(draftingEmailActivity.createdAt))
      .limit(500);

    res.json(activity);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting email activity");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch activity" });
  }
});

router.get("/api/drafting-inbox/emails/:id/page-thumbnails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const docs = await db.select().from(draftingEmailDocuments)
      .where(eq(draftingEmailDocuments.inboundEmailId, id)).limit(200);
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
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "drafting-thumbs-"));
      const pdfPath = path.join(tmpDir, "drafting.pdf");
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
    logger.error({ err: error }, "Error generating drafting email page thumbnails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate thumbnails" });
  }
});

router.post("/api/drafting-inbox/check-emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(draftingInboxSettings)
      .where(and(eq(draftingInboxSettings.companyId, companyId), eq(draftingInboxSettings.isEnabled, true)))
      .limit(1);

    if (!settings || !settings.inboundEmailAddress) {
      return res.status(400).json({ error: "Drafting email inbox not configured. Set up inbox settings first." });
    }

    const { scheduler } = await import("../lib/background-scheduler");
    const isRunning = scheduler.isJobRunning("drafting-email-poll");
    if (isRunning) {
      return res.json({ triggered: true, message: "Drafting email check is already running in the background" });
    }

    const triggered = await scheduler.triggerNow("drafting-email-poll");
    res.json({
      triggered,
      message: triggered
        ? "Drafting email check started in background. New emails will appear shortly."
        : "Could not start drafting email check. Job may not be registered yet.",
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[Drafting Inbox] Error triggering email check");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check emails" });
  }
});

router.get("/api/drafting-inbox/background-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { scheduler } = await import("../lib/background-scheduler");

    const jobStatus = scheduler.getStatus();

    const companyId = req.companyId;
    const [receivedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(draftingInboundEmails)
      .where(and(
        eq(draftingInboundEmails.status, "RECEIVED"),
        companyId ? eq(draftingInboundEmails.companyId, companyId) : sql`true`
      ));

    res.json({
      emailPoll: jobStatus["drafting-email-poll"] || { running: false },
      pendingProcessing: receivedCount?.count || 0,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to get background status" });
  }
});

router.get("/api/drafting-inbox/emails/:id/body", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select({
      htmlBody: draftingInboundEmails.htmlBody,
      textBody: draftingInboundEmails.textBody,
    }).from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);

    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    res.json({
      html: email.htmlBody || null,
      text: email.textBody || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting email body");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch email body" });
  }
});

const draftingTaskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  actionType: z.string().min(1, "Action type is required").max(100),
  description: z.string().max(2000).optional(),
  jobId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

router.get("/api/drafting-inbox/emails/:id/tasks", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const linkedTasks = await storage.getTasksByDraftingEmailId(id, companyId);
    res.json(linkedTasks);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting email tasks");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch tasks" });
  }
});

router.post("/api/drafting-inbox/emails/:id/tasks", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const parsed = draftingTaskCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { title, actionType, description, jobId, dueDate, priority, assigneeIds } = parsed.data;

    if (jobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) {
        return res.status(400).json({ error: "Invalid job for this company" });
      }
    }

    let draftingGroupId: string | null = null;
    const [draftingGroup] = await db.select().from(taskGroups)
      .where(and(eq(taskGroups.companyId, companyId), eq(taskGroups.name, "DRAFTING")))
      .limit(1);
    if (draftingGroup) {
      draftingGroupId = draftingGroup.id;
    } else {
      const newGroup = await storage.createTaskGroup({
        name: "DRAFTING",
        companyId,
        createdById: userId,
      });
      draftingGroupId = newGroup.id;
    }

    const fullTitle = `[${actionType}] ${title}`;
    const task = await storage.createTask({
      groupId: draftingGroupId,
      title: fullTitle,
      status: "NOT_STARTED",
      jobId: jobId || null,
      draftingEmailId: id,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "MEDIUM",
      consultant: description || null,
      createdById: userId,
    });

    const assignees = new Set<string>();
    if (assigneeIds && assigneeIds.length > 0) {
      assigneeIds.forEach(uid => assignees.add(uid));
    } else {
      const managers = await db.select().from(users)
        .where(and(eq(users.companyId, companyId), eq(users.role, "MANAGER")))
        .limit(20);
      managers.forEach(m => assignees.add(m.id));
    }
    assignees.add(userId);

    if (assignees.size > 0) {
      await storage.setTaskAssignees(task.id, Array.from(assignees));
    }

    await logDraftingEmailActivity(
      id,
      "task_created",
      `Task created: ${fullTitle}`,
      userId,
      { taskId: task.id, actionType, priority }
    );

    const taskWithDetails = await storage.getTask(task.id);
    res.status(201).json(taskWithDetails || task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating drafting email task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task" });
  }
});

router.post("/api/drafting-inbox/emails/:id/suggest-due-date", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const { actionType } = z.object({ actionType: z.string().optional() }).parse(req.body);

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const prompt = `You are a construction project management assistant. Based on the following drafting email details, suggest how many days from today the task should be due. Consider urgency, complexity, and typical construction timelines.

Email Subject: ${email.subject || "No subject"}
Request Type: ${email.requestType || "Unknown"}
Impact Area: ${email.impactArea || "Unknown"}
Action Type: ${actionType || "General"}
Today's Date: ${todayStr}

Respond with ONLY a JSON object: {"days": <number>, "reason": "<brief reason>"}
The days should be one of: 0 (today/urgent), 1 (tomorrow), 7, 14, or 21. Pick the most appropriate.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 100,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const days = [0, 1, 7, 14, 21].includes(parsed.days) ? parsed.days : 7;
      const suggestedDate = new Date(today);
      suggestedDate.setDate(suggestedDate.getDate() + days);
      res.json({
        days,
        date: suggestedDate.toISOString().split("T")[0],
        reason: parsed.reason || "AI suggestion",
      });
    } else {
      res.json({ days: 7, date: new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0], reason: "Default suggestion" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error suggesting due date");
    res.json({ days: 7, date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0], reason: "Default (AI unavailable)" });
  }
});

export { router as draftingInboxRouter };
export default router;
