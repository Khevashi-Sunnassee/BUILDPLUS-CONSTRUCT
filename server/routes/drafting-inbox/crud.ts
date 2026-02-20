import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import { draftingInboundEmails, draftingEmailDocuments, draftingEmailExtractedFields, draftingEmailActivity, jobs } from "@shared/schema";
import { requireUUID, safeJsonParse } from "../../lib/api-utils";
import { objectStorageService, logDraftingEmailActivity } from "./shared";

const router = Router();

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

    if (docs.length > 0) {
      logger.info({ emailId: id, docCount: docs.length }, "Storage cleanup skipped for drafting email documents (no delete method available)");
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

export default router;
