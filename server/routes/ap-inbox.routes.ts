import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import crypto from "crypto";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import {
  apInboundEmails, apInboxSettings, apInvoices, apInvoiceDocuments,
  apInvoiceActivity, apInvoiceSplits, companies, suppliers
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
        defaultStatus: "IMPORTED",
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
      defaultStatus: z.enum(["IMPORTED", "PROCESSED"]).optional(),
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

router.post("/api/ap-inbox/check-emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(apInboxSettings)
      .where(and(eq(apInboxSettings.companyId, companyId), eq(apInboxSettings.isEnabled, true)))
      .limit(1);

    if (!settings || !settings.inboundEmailAddress) {
      return res.status(400).json({ error: "Email inbox not configured. Set up inbox settings first." });
    }

    const apiKey = await getResendApiKey();

    const allReceivedEmails: any[] = [];
    let hasMore = true;
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 10;

    while (hasMore && pageCount < maxPages) {
      const url = new URL("https://api.resend.com/emails/receiving");
      if (cursor) url.searchParams.set("after", cursor);

      const listRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!listRes.ok) {
        const errText = await listRes.text();
        logger.error({ status: listRes.status, body: errText }, "[AP Inbox] Failed to fetch received emails from Resend");
        return res.status(502).json({ error: `Failed to fetch emails from Resend: ${listRes.status}` });
      }

      const listData = await listRes.json();
      const pageEmails: any[] = Array.isArray(listData.data) ? listData.data : (Array.isArray(listData) ? listData : []);

      if (pageEmails.length === 0) {
        hasMore = false;
      } else {
        allReceivedEmails.push(...pageEmails);
        cursor = pageEmails[pageEmails.length - 1]?.id || null;
        hasMore = listData.has_more === true;
      }
      pageCount++;
    }

    const inboundAddr = settings.inboundEmailAddress.toLowerCase().trim();
    const matchingEmails = allReceivedEmails.filter((email: any) => {
      const toAddrs: string[] = Array.isArray(email.to) ? email.to : (email.to ? [email.to] : []);
      return toAddrs.some((addr: string) => addr.toLowerCase().trim() === inboundAddr);
    });

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const email of matchingEmails) {
      const emailId = email.id;
      if (!emailId) { skipped++; continue; }

      const [existing] = await db.select().from(apInboundEmails)
        .where(eq(apInboundEmails.resendEmailId, emailId)).limit(1);

      if (existing) {
        if (existing.status === "PROCESSED" && !existing.invoiceId) {
          try {
            await db.delete(apInboundEmails).where(eq(apInboundEmails.id, existing.id));
            logger.info({ emailId, inboundId: existing.id }, "[AP Inbox] Re-processing email whose invoice was deleted");
          } catch (delErr) {
            logger.error({ err: delErr, emailId }, "[AP Inbox] Failed to reset orphaned inbound record");
            skipped++;
            continue;
          }
        } else {
          skipped++;
          continue;
        }
      }

      try {
        const fromAddr = typeof email.from === "string" ? email.from : (email.from?.email || email.from?.address || JSON.stringify(email.from));
        const toAddrs: string[] = Array.isArray(email.to) ? email.to : (email.to ? [email.to] : []);

        const [inboundRecord] = await db.insert(apInboundEmails).values({
          companyId: settings.companyId,
          resendEmailId: emailId,
          fromAddress: fromAddr,
          toAddress: toAddrs[0] || null,
          subject: email.subject || null,
          status: "RECEIVED",
          attachmentCount: 0,
        }).returning();

        let hasAttachments = false;
        try {
          const emailAttachments = Array.isArray(email.attachments) ? email.attachments : [];
          if (emailAttachments.length > 0) {
            hasAttachments = true;
            await db.update(apInboundEmails)
              .set({ attachmentCount: emailAttachments.length })
              .where(eq(apInboundEmails.id, inboundRecord.id));
          } else {
            const attRes = await fetch(`https://api.resend.com/emails/${emailId}/receiving/attachments`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (attRes.ok) {
              const attData = await attRes.json();
              const attachments = Array.isArray(attData.data) ? attData.data : (Array.isArray(attData) ? attData : []);
              hasAttachments = attachments.length > 0;
              await db.update(apInboundEmails)
                .set({ attachmentCount: attachments.length })
                .where(eq(apInboundEmails.id, inboundRecord.id));
            }
          }
        } catch {}

        if (hasAttachments) {
          try {
            await processInboundEmail(inboundRecord.id, emailId, settings);
          } catch (err) {
            logger.error({ err, inboundId: inboundRecord.id }, "[AP Inbox] Processing failed for polled email");
          }
        } else {
          await db.update(apInboundEmails)
            .set({ status: "NO_ATTACHMENTS", processedAt: new Date() })
            .where(eq(apInboundEmails.id, inboundRecord.id));
        }

        processed++;
        logger.info({ emailId, from: fromAddr, subject: email.subject }, "[AP Inbox] Processed email from poll");
      } catch (emailErr: any) {
        errors.push(`Email ${emailId}: ${emailErr.message}`);
        logger.error({ err: emailErr, emailId }, "[AP Inbox] Failed to process polled email");
      }
    }

    res.json({
      totalFound: matchingEmails.length,
      processed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[AP Inbox] Error polling emails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check emails" });
  }
});

router.post("/api/webhooks/resend-inbound", async (req: Request, res: Response) => {
  try {
    const svixId = req.headers["svix-id"] as string;
    const svixTimestamp = req.headers["svix-timestamp"] as string;
    const svixSignature = req.headers["svix-signature"] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      logger.warn("[AP Inbox] Missing Svix webhook headers - rejecting request");
      return res.status(401).json({ error: "Missing webhook signature headers" });
    }

    const timestampAge = Math.abs(Date.now() / 1000 - parseInt(svixTimestamp));
    if (isNaN(timestampAge) || timestampAge > 300) {
      logger.warn({ timestampAge }, "[AP Inbox] Webhook timestamp too old or invalid");
      return res.status(401).json({ error: "Webhook timestamp expired" });
    }

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ""), "base64");
      const rawBody = (req as any).rawBody ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
      const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");

      const signatures = svixSignature.split(" ");
      const verified = signatures.some(sig => {
        const sigValue = sig.replace(/^v1,/, "");
        try {
          const expectedBuf = Buffer.from(expectedSignature);
          const actualBuf = Buffer.from(sigValue);
          if (expectedBuf.length !== actualBuf.length) return false;
          return crypto.timingSafeEqual(expectedBuf, actualBuf);
        } catch {
          return false;
        }
      });

      if (!verified) {
        logger.warn("[AP Inbox] Webhook signature verification failed");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
      logger.info("[AP Inbox] Webhook signature verified successfully");
    } else {
      logger.warn("[AP Inbox] No RESEND_WEBHOOK_SECRET configured - skipping signature verification");
    }

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
        if (toAddresses.some(addr => addr.toLowerCase().trim() === normalizedInbound)) {
          matchedSettings = settings;
          break;
        }
      }
    }

    if (!matchedSettings) {
      logger.warn({ to: toAddresses, enabledCount: allSettings.length }, "[AP Inbox] No matching inbox settings for inbound email");
      return res.status(200).json({ status: "ignored", reason: "No matching company inbox" });
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

    const emailDetailRes = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!emailDetailRes.ok) {
      throw new Error(`Failed to fetch email details: ${emailDetailRes.status} ${emailDetailRes.statusText}`);
    }

    const emailDetail = await emailDetailRes.json();

    let attachments: any[] = [];
    if (Array.isArray(emailDetail.attachments) && emailDetail.attachments.length > 0) {
      for (const att of emailDetail.attachments) {
        const attDetailRes = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}/attachments/${att.id}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (attDetailRes.ok) {
          const attDetail = await attDetailRes.json();
          attachments.push({ ...att, ...attDetail });
        } else {
          attachments.push(att);
        }
      }
    }

    const pdfAttachments = attachments.filter((att: any) =>
      att.content_type === "application/pdf" ||
      att.filename?.toLowerCase().endsWith(".pdf")
    );

    const imageAttachments = attachments.filter((att: any) => {
      if (!att.content_type?.startsWith("image/")) return false;
      if (!(att.content_type.includes("jpeg") || att.content_type.includes("png") || att.content_type.includes("tiff"))) return false;
      if (att.content_disposition === "inline" || att.content_id) return false;
      const fname = (att.filename || "").toLowerCase();
      if (fname.startsWith("outlook-") || fname.startsWith("image0") || fname.includes("signature") || fname.includes("banner") || fname.includes("logo")) return false;
      return true;
    });

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

        const invoiceStatus = "IMPORTED" as const;
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
- bbox: approximate bounding box as {x1, y1, x2, y2} in normalized coordinates (0-1 range relative to page dimensions), or null if you cannot determine the location

Extract these fields:
1. "invoice_number" - The invoice number/reference
2. "supplier_name" - The supplier/vendor company name
3. "supplier_abn" - The supplier ABN (Australian Business Number) if present
4. "invoice_date" - The invoice date (return in YYYY-MM-DD format)
5. "due_date" - The due/payment date if present (YYYY-MM-DD format)
6. "subtotal" - The subtotal/amount before tax
7. "gst" - The GST/tax amount
8. "total" - The total amount including tax
9. "po_number" - Purchase order number if present
10. "description" - Brief description of goods/services

Also extract line items if visible as an array called "line_items" where each item has:
- description, quantity, unit_price, amount

Return your response as valid JSON with this exact structure:
{
  "fields": [
    {"key": "invoice_number", "value": "...", "confidence": 0.95, "bbox": {"x1": 0.5, "y1": 0.1, "x2": 0.8, "y2": 0.15}},
    ...
  ],
  "line_items": [
    {"description": "...", "quantity": "...", "unit_price": "...", "amount": "..."},
    ...
  ]
}`;

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
      temperature: 0,
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
        bboxJson: field.bbox || null,
        source: "extraction",
      });
    }

    const fieldMap: Record<string, string> = {};
    for (const f of fields) {
      if (f.value) fieldMap[f.key] = f.value;
    }

    const updateData: any = {};
    if (fieldMap.invoice_number) updateData.invoiceNumber = fieldMap.invoice_number;
    if (fieldMap.invoice_date) {
      try { updateData.invoiceDate = new Date(fieldMap.invoice_date); } catch {}
    }
    if (fieldMap.due_date) {
      try { updateData.dueDate = new Date(fieldMap.due_date); } catch {}
    }
    if (fieldMap.total) updateData.totalInc = fieldMap.total.replace(/[^0-9.-]/g, "");
    if (fieldMap.gst) updateData.totalTax = fieldMap.gst.replace(/[^0-9.-]/g, "");
    if (fieldMap.subtotal) updateData.totalEx = fieldMap.subtotal.replace(/[^0-9.-]/g, "");
    if (fieldMap.description) updateData.description = fieldMap.description;

    if (fieldMap.supplier_name) {
      const matchingSuppliers = await db.select().from(suppliers)
        .where(and(eq(suppliers.companyId, companyId), ilike(suppliers.name, `%${fieldMap.supplier_name}%`)))
        .limit(1);
      if (matchingSuppliers.length > 0) {
        updateData.supplierId = matchingSuppliers[0].id;
      }
    }

    let riskScore = 0;
    const riskReasons: string[] = [];
    for (const field of fields) {
      if (field.confidence !== null && field.confidence < 0.7) {
        riskScore += 15;
        riskReasons.push(`Low confidence on ${field.key}: ${(field.confidence * 100).toFixed(0)}%`);
      }
    }
    if (!fieldMap.invoice_number) {
      riskScore += 20;
      riskReasons.push("Missing invoice number");
    }
    if (!fieldMap.total) {
      riskScore += 20;
      riskReasons.push("Missing total amount");
    }
    updateData.riskScore = Math.min(riskScore, 100);
    updateData.riskReasons = riskReasons;
    updateData.updatedAt = new Date();

    await db.update(apInvoices).set(updateData).where(eq(apInvoices.id, invoiceId));

    const totalInc = parseFloat(updateData.totalInc || "0");
    if (totalInc > 0) {
      const gstAmount = parseFloat(updateData.totalTax || "0");
      const subtotal = parseFloat(updateData.totalEx || String(totalInc));
      const taxCodeLabel = gstAmount > 0 ? "GST" : "FRE";

      await db.insert(apInvoiceSplits).values({
        invoiceId,
        description: fieldMap.description || "Invoice total",
        percentage: "100",
        amount: subtotal > 0 ? subtotal.toFixed(2) : totalInc.toFixed(2),
        taxCodeId: taxCodeLabel,
        sortOrder: 0,
      });

      logger.info({ invoiceId, taxCode: taxCodeLabel, amount: subtotal || totalInc }, "[AP Inbox] Auto-created split with lowest applicable tax code");
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
