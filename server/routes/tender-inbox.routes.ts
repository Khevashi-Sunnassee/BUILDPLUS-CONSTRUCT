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
  tenderInboundEmails, tenderInboxSettings, tenderEmailDocuments,
  tenderEmailExtractedFields, tenderEmailActivity,
  tenders, tenderSubmissions, suppliers, companies
} from "@shared/schema";
import { getResendApiKey } from "../services/email.service";

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(tenderInboxSettings)
      .where(eq(tenderInboxSettings.companyId, companyId)).limit(1);

    if (!settings) {
      return res.json({
        companyId,
        isEnabled: false,
        inboundEmailAddress: null,
        autoExtract: true,
        notifyUserIds: [],
      });
    }

    res.json(settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch tender inbox settings" });
  }
});

router.put("/api/tender-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const body = z.object({
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

    res.json(settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating tender inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update tender inbox settings" });
  }
});

router.get("/api/tender-inbox/emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

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

    res.json({
      emails: emailRows,
      total: countResult[0]?.total || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender inbound emails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch tender inbound emails" });
  }
});

router.get("/api/tender-inbox/counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

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

    res.json(counts);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender inbox counts");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch counts" });
  }
});

router.get("/api/tender-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)))
      .limit(1);

    if (!email) return res.status(404).json({ error: "Tender email not found" });

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

    res.json({
      ...email,
      documents,
      extractedFields,
      supplier: supplier || null,
      tender: tender || null,
      tenderSubmission: submission || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender email detail");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch tender email" });
  }
});

router.post("/api/tender-inbox/upload", requireAuth, upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "At least one file is required" });

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

    res.json(createdEmails.length === 1 ? createdEmails[0] : { emails: createdEmails, count: createdEmails.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading tender email document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
});

router.get("/api/tender-inbox/emails/:id/document-view", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(1);
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
        logger.error({ err }, "Stream error serving tender email document");
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (storageErr: any) {
      logger.error({ err: storageErr }, "Error retrieving tender email document from storage");
      res.status(404).json({ error: "Document file not found in storage" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error serving tender email document");
    res.status(500).json({ error: "Failed to serve document" });
  }
});

router.get("/api/tender-inbox/emails/:id/extracted-fields", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const fields = await db.select().from(tenderEmailExtractedFields)
      .where(eq(tenderEmailExtractedFields.inboundEmailId, id)).limit(1000);

    res.json(fields);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender email extracted fields");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch extracted fields" });
  }
});

router.post("/api/tender-inbox/emails/:id/extract", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(1);
    if (!docs.length) return res.status(404).json({ error: "No document found for extraction" });

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

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error triggering tender email extraction");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to trigger extraction" });
  }
});

router.post("/api/tender-inbox/emails/:id/match", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = req.params.id;

    const body = z.object({
      tenderId: z.string(),
      supplierId: z.string(),
      tenderSubmissionId: z.string().optional(),
    }).parse(req.body);

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const [updated] = await db.update(tenderInboundEmails)
      .set({
        tenderId: body.tenderId,
        supplierId: body.supplierId,
        tenderSubmissionId: body.tenderSubmissionId || null,
        status: "MATCHED",
        matchedAt: new Date(),
      })
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)))
      .returning();

    await logTenderEmailActivity(id, "matched", `Matched to tender and supplier`, userId || undefined, {
      tenderId: body.tenderId,
      supplierId: body.supplierId,
      tenderSubmissionId: body.tenderSubmissionId,
    });

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error matching tender email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to match tender email" });
  }
});

router.patch("/api/tender-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = req.params.id;

    const [existing] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Tender email not found" });

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
      return res.json(existing);
    }

    const [updated] = await db.update(tenderInboundEmails)
      .set(updates)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)))
      .returning();

    if (changedFields.length > 0) {
      await logTenderEmailActivity(id, "fields_updated", `Updated fields: ${changedFields.join(", ")}`, userId || undefined, { changedFields });
    }

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating tender email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update tender email" });
  }
});

router.delete("/api/tender-inbox/emails/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(1000);

    for (const doc of docs) {
      try {
        await objectStorageService.deleteFile(doc.storageKey);
      } catch (delErr: any) {
        logger.warn({ err: delErr, storageKey: doc.storageKey }, "Failed to delete tender email document from storage");
      }
    }

    await db.delete(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId)));

    res.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting tender email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete tender email" });
  }
});

router.get("/api/tender-inbox/emails/:id/activity", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const activity = await db.select().from(tenderEmailActivity)
      .where(eq(tenderEmailActivity.inboundEmailId, id))
      .orderBy(desc(tenderEmailActivity.createdAt))
      .limit(1000);

    res.json(activity);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender email activity");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch activity" });
  }
});

router.get("/api/tender-inbox/emails/:id/page-thumbnails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id;

    const [email] = await db.select().from(tenderInboundEmails)
      .where(and(eq(tenderInboundEmails.id, id), eq(tenderInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Tender email not found" });

    const docs = await db.select().from(tenderEmailDocuments)
      .where(eq(tenderEmailDocuments.inboundEmailId, id)).limit(1);
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
    logger.error({ err: error }, "Error generating tender email page thumbnails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate thumbnails" });
  }
});

router.post("/api/tender-inbox/check-emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(tenderInboxSettings)
      .where(and(eq(tenderInboxSettings.companyId, companyId), eq(tenderInboxSettings.isEnabled, true)))
      .limit(1);

    if (!settings || !settings.inboundEmailAddress) {
      return res.status(400).json({ error: "Tender email inbox not configured. Set up inbox settings first." });
    }

    const { scheduler } = await import("../lib/background-scheduler");
    const isRunning = scheduler.isJobRunning("tender-email-poll");
    if (isRunning) {
      return res.json({ triggered: true, message: "Tender email check is already running in the background" });
    }

    const triggered = await scheduler.triggerNow("tender-email-poll");
    res.json({
      triggered,
      message: triggered
        ? "Tender email check started in background. New emails will appear shortly."
        : "Could not start tender email check. Job may not be registered yet.",
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[Tender Inbox] Error triggering email check");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check emails" });
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

    res.json({
      emailPoll: jobStatus["tender-email-poll"] || { running: false },
      pendingProcessing: receivedCount?.count || 0,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to get background status" });
  }
});

export { router as tenderInboxRouter };
export default router;
