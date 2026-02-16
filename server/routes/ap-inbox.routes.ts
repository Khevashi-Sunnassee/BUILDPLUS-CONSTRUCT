import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import {
  apInboundEmails, apInboxSettings, apInvoices, apInvoiceDocuments,
  apInvoiceActivity, companies
} from "@shared/schema";
import { getResendApiKey } from "../services/email.service";

const router = Router();
const objectStorageService = new ObjectStorageService();

async function logActivity(invoiceId: string, activityType: string, message: string, actorUserId?: string, metaJson?: any) {
  await db.insert(apInvoiceActivity).values({
    invoiceId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

router.get("/api/ap-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(apInboxSettings)
      .where(eq(apInboxSettings.companyId, companyId)).limit(1);

    if (!settings) {
      return res.json({
        companyId,
        isEnabled: false,
        inboundEmailAddress: null,
        autoExtract: true,
        autoSubmit: false,
        defaultStatus: "DRAFT",
        notifyUserIds: [],
      });
    }

    res.json(settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inbox settings" });
  }
});

router.put("/api/ap-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const body = z.object({
      isEnabled: z.boolean().optional(),
      inboundEmailAddress: z.string().nullable().optional(),
      autoExtract: z.boolean().optional(),
      autoSubmit: z.boolean().optional(),
      defaultStatus: z.enum(["DRAFT", "PENDING_REVIEW"]).optional(),
      notifyUserIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(apInboxSettings)
      .where(eq(apInboxSettings.companyId, companyId)).limit(1);

    let settings;
    if (existing) {
      [settings] = await db.update(apInboxSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(apInboxSettings.companyId, companyId))
        .returning();
    } else {
      [settings] = await db.insert(apInboxSettings)
        .values({ companyId, ...body })
        .returning();
    }

    res.json(settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update inbox settings" });
  }
});

router.get("/api/ap-inbox/emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const emails = await db.select().from(apInboundEmails)
      .where(eq(apInboundEmails.companyId, companyId))
      .orderBy(desc(apInboundEmails.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(emails);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching inbound emails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch inbound emails" });
  }
});

router.post("/api/webhooks/resend-inbound", async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (!event || event.type !== "email.received") {
      return res.status(200).json({ status: "ignored", reason: "Not an email.received event" });
    }

    const { email_id, from, to, subject, has_attachments } = event.data || {};

    if (!email_id || !from) {
      return res.status(200).json({ status: "ignored", reason: "Missing email data" });
    }

    logger.info({ emailId: email_id, from, to, subject }, "[AP Inbox] Received inbound email webhook");

    const toAddresses: string[] = Array.isArray(to) ? to : (to ? [to] : []);

    const allSettings = await db.select({
      settings: apInboxSettings,
      companyName: companies.name,
    })
      .from(apInboxSettings)
      .leftJoin(companies, eq(apInboxSettings.companyId, companies.id))
      .where(eq(apInboxSettings.isEnabled, true));

    let matchedSettings = null;
    for (const { settings } of allSettings) {
      if (settings.inboundEmailAddress) {
        const normalizedInbound = settings.inboundEmailAddress.toLowerCase().trim();
        if (toAddresses.some(addr => addr.toLowerCase().trim() === normalizedInbound || addr.toLowerCase().includes(normalizedInbound))) {
          matchedSettings = settings;
          break;
        }
      }
    }

    if (!matchedSettings) {
      if (allSettings.length === 1) {
        matchedSettings = allSettings[0].settings;
      } else {
        logger.warn({ to: toAddresses, enabledCount: allSettings.length }, "[AP Inbox] No matching inbox settings for inbound email");
        return res.status(200).json({ status: "ignored", reason: "No matching company inbox" });
      }
    }

    const [existingEmail] = await db.select().from(apInboundEmails)
      .where(eq(apInboundEmails.resendEmailId, email_id)).limit(1);

    if (existingEmail) {
      logger.info({ emailId: email_id }, "[AP Inbox] Duplicate email webhook, skipping");
      return res.status(200).json({ status: "duplicate" });
    }

    const [inboundRecord] = await db.insert(apInboundEmails).values({
      companyId: matchedSettings.companyId,
      resendEmailId: email_id,
      fromAddress: typeof from === "string" ? from : (from?.email || from?.address || JSON.stringify(from)),
      toAddress: toAddresses[0] || null,
      subject: subject || null,
      status: "RECEIVED",
      attachmentCount: 0,
    }).returning();

    if (has_attachments) {
      processInboundEmail(inboundRecord.id, email_id, matchedSettings).catch(err => {
        logger.error({ err, inboundId: inboundRecord.id }, "[AP Inbox] Background processing failed");
      });
    } else {
      await db.update(apInboundEmails)
        .set({ status: "NO_ATTACHMENTS", processedAt: new Date() })
        .where(eq(apInboundEmails.id, inboundRecord.id));

      logger.info({ emailId: email_id }, "[AP Inbox] Email has no attachments, skipping");
    }

    res.status(200).json({ status: "accepted", inboundId: inboundRecord.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "[AP Inbox] Error processing webhook");
    res.status(200).json({ status: "error" });
  }
});

async function processInboundEmail(
  inboundId: string,
  resendEmailId: string,
  settings: typeof apInboxSettings.$inferSelect
) {
  try {
    await db.update(apInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(apInboundEmails.id, inboundId));

    const apiKey = await getResendApiKey();

    const emailDetailRes = await fetch(`https://api.resend.com/emails/${resendEmailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!emailDetailRes.ok) {
      throw new Error(`Failed to fetch email details: ${emailDetailRes.status} ${emailDetailRes.statusText}`);
    }

    const emailDetail = await emailDetailRes.json();

    const attachmentsRes = await fetch(`https://api.resend.com/emails/${resendEmailId}/attachments`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    let attachments: any[] = [];
    if (attachmentsRes.ok) {
      const attachData = await attachmentsRes.json();
      attachments = attachData.data || attachData || [];
    }

    const pdfAttachments = attachments.filter((att: any) =>
      att.content_type === "application/pdf" ||
      att.filename?.toLowerCase().endsWith(".pdf")
    );

    const imageAttachments = attachments.filter((att: any) =>
      att.content_type?.startsWith("image/") &&
      (att.content_type.includes("jpeg") || att.content_type.includes("png") || att.content_type.includes("tiff"))
    );

    const relevantAttachments = [...pdfAttachments, ...imageAttachments];

    await db.update(apInboundEmails)
      .set({ attachmentCount: attachments.length })
      .where(eq(apInboundEmails.id, inboundId));

    if (relevantAttachments.length === 0) {
      await db.update(apInboundEmails)
        .set({ status: "NO_PDF_ATTACHMENTS", processedAt: new Date() })
        .where(eq(apInboundEmails.id, inboundId));
      logger.info({ inboundId, totalAttachments: attachments.length }, "[AP Inbox] No PDF/image attachments found");
      return;
    }

    let firstInvoiceId: string | null = null;

    for (const attachment of relevantAttachments) {
      try {
        let fileBuffer: Buffer;

        if (attachment.content) {
          fileBuffer = Buffer.from(attachment.content, "base64");
        } else if (attachment.download_url || attachment.url) {
          const downloadUrl = attachment.download_url || attachment.url;
          const downloadRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!downloadRes.ok) {
            logger.error({ filename: attachment.filename }, "[AP Inbox] Failed to download attachment");
            continue;
          }
          const arrayBuffer = await downloadRes.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        } else {
          logger.warn({ attachment: attachment.filename }, "[AP Inbox] No content or download URL for attachment");
          continue;
        }

        const fileExt = (attachment.filename || "invoice.pdf").split(".").pop() || "pdf";
        const mimeType = attachment.content_type || "application/pdf";
        const storageKey = `ap-invoices/${settings.companyId}/${crypto.randomUUID()}.${fileExt}`;

        await objectStorageService.uploadFile(storageKey, fileBuffer, mimeType);

        const invoiceStatus = (settings.defaultStatus === "PENDING_REVIEW" ? "PENDING_REVIEW" : "DRAFT") as "DRAFT" | "PENDING_REVIEW";
        const [invoice] = await db.insert(apInvoices).values({
          companyId: settings.companyId,
          status: invoiceStatus,
          uploadedAt: new Date(),
          sourceEmail: typeof emailDetail.from === "string" ? emailDetail.from : (emailDetail.from?.email || null),
        }).returning();

        await db.insert(apInvoiceDocuments).values({
          invoiceId: invoice.id,
          storageKey,
          fileName: attachment.filename || `invoice-${Date.now()}.${fileExt}`,
          mimeType,
          fileSize: fileBuffer.length,
        });

        await logActivity(invoice.id, "email_received", `Invoice received via email from ${emailDetail.from?.email || emailDetail.from || "unknown"}`, undefined, {
          inboundEmailId: inboundId,
          subject: emailDetail.subject,
          fromAddress: emailDetail.from,
        });

        if (!firstInvoiceId) firstInvoiceId = invoice.id;

        logger.info({ invoiceId: invoice.id, filename: attachment.filename }, "[AP Inbox] Created invoice from email attachment");

        if (settings.autoExtract) {
          triggerAutoExtract(invoice.id, settings.companyId).catch(err => {
            logger.error({ err, invoiceId: invoice.id }, "[AP Inbox] Auto-extraction failed");
          });
        }
      } catch (attErr: any) {
        logger.error({ err: attErr, filename: attachment.filename }, "[AP Inbox] Failed to process attachment");
      }
    }

    await db.update(apInboundEmails)
      .set({
        status: firstInvoiceId ? "PROCESSED" : "FAILED",
        invoiceId: firstInvoiceId,
        processedAt: new Date(),
      })
      .where(eq(apInboundEmails.id, inboundId));

    logger.info({ inboundId, invoiceId: firstInvoiceId }, "[AP Inbox] Email processing complete");
  } catch (error: any) {
    logger.error({ err: error, inboundId }, "[AP Inbox] Processing error");
    await db.update(apInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(apInboundEmails.id, inboundId));
  }
}

async function triggerAutoExtract(invoiceId: string, companyId: string) {
  try {
    const docs = await db.select().from(apInvoiceDocuments)
      .where(eq(apInvoiceDocuments.invoiceId, invoiceId)).limit(1);

    if (!docs.length) return;

    const doc = docs[0];
    const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
    const chunks: Buffer[] = [];
    const stream = file.createReadStream();
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    let imageBuffers: { base64: string; mimeType: string }[] = [];

    if (doc.mimeType?.includes("pdf")) {
      const { execSync } = await import("child_process");
      const fs = await import("fs");
      const os = await import("os");
      const path = await import("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ap-inbox-extract-"));
      const pdfPath = path.join(tmpDir, "invoice.pdf");
      fs.writeFileSync(pdfPath, buffer);
      try {
        execSync(`pdftoppm -png -r 300 -l 3 "${pdfPath}" "${path.join(tmpDir, 'page')}"`, { timeout: 30000 });
        const pageFiles = fs.readdirSync(tmpDir)
          .filter((f: string) => f.startsWith("page") && f.endsWith(".png"))
          .sort();
        for (const pageFile of pageFiles) {
          const pageBuffer = fs.readFileSync(path.join(tmpDir, pageFile));
          imageBuffers.push({ base64: pageBuffer.toString("base64"), mimeType: "image/png" });
        }
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      }
    } else {
      imageBuffers.push({ base64: buffer.toString("base64"), mimeType: doc.mimeType || "image/jpeg" });
    }

    if (imageBuffers.length === 0) {
      logger.warn({ invoiceId }, "[AP Inbox] Could not convert document to images for extraction");
      return;
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI();

    const extractionPrompt = `You are an expert invoice data extraction system. Analyze this invoice image/document and extract the following fields.
For each field, return an object with:
- key: the field name (use snake_case)
- value: the extracted value
- confidence: a number from 0 to 1 indicating extraction confidence
- bounding_box: approximate bounding box as {x, y, width, height} in percentage (0-100) of the image dimensions, or null if not locatable

Extract these fields: invoice_number, invoice_date, due_date, supplier_name, supplier_abn, total_amount, gst_amount, subtotal, purchase_order_number, description, payment_terms

Also extract line items if visible as an array called "line_items" where each item has:
- description, quantity, unit_price, amount, gst, account_code

Return as JSON: { "fields": [...], "line_items": [...] }`;

    const messages: any[] = [{
      role: "user",
      content: [
        { type: "text", text: extractionPrompt },
        ...imageBuffers.map(img => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" },
        })),
      ],
    }];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      logger.error("[AP Inbox] Failed to parse extraction response as JSON");
      return;
    }

    const fields = extractedData.fields || [];
    const { apInvoiceExtractedFields } = await import("@shared/schema");

    for (const field of fields) {
      await db.insert(apInvoiceExtractedFields).values({
        invoiceId,
        fieldKey: field.key,
        fieldValue: field.value || null,
        confidence: field.confidence != null ? Number(field.confidence) : null,
        bboxJson: field.bounding_box || null,
        source: "extraction",
      });
    }

    const fieldMap: Record<string, string> = {};
    for (const f of fields) {
      if (f.value) fieldMap[f.key] = f.value;
    }

    const updateData: any = {};
    if (fieldMap.invoice_number) updateData.invoiceNumber = fieldMap.invoice_number;
    if (fieldMap.invoice_date) updateData.invoiceDate = fieldMap.invoice_date;
    if (fieldMap.due_date) updateData.dueDate = fieldMap.due_date;
    if (fieldMap.total_amount) updateData.totalAmount = fieldMap.total_amount;
    if (fieldMap.gst_amount) updateData.gstAmount = fieldMap.gst_amount;
    if (fieldMap.subtotal) updateData.subtotal = fieldMap.subtotal;
    if (fieldMap.description) updateData.description = fieldMap.description;
    if (fieldMap.supplier_name) updateData.supplierName = fieldMap.supplier_name;

    if (Object.keys(updateData).length > 0) {
      await db.update(apInvoices).set(updateData).where(eq(apInvoices.id, invoiceId));
    }

    await logActivity(invoiceId, "auto_extraction_completed", "AI extraction completed automatically from email", undefined, {
      fieldsExtracted: fields.length,
      lineItemsFound: (extractedData.line_items || []).length,
    });

    logger.info({ invoiceId, fieldsExtracted: fields.length }, "[AP Inbox] Auto-extraction complete");
  } catch (error: any) {
    logger.error({ err: error, invoiceId }, "[AP Inbox] Auto-extraction error");
    await logActivity(invoiceId, "auto_extraction_failed", `Auto-extraction failed: ${error.message}`);
  }
}

export { router as apInboxRouter };
