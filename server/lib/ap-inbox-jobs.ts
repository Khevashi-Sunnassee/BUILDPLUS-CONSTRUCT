import logger from "./logger";
import { db } from "../db";
import { eq, and, inArray, ilike, isNull, sql } from "drizzle-orm";
import {
  apInboundEmails, apInboxSettings, apInvoices, apInvoiceDocuments,
  apInvoiceActivity, apInvoiceSplits, apInvoiceExtractedFields, suppliers
} from "@shared/schema";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { getResendApiKey } from "../services/email.service";
import crypto from "crypto";

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

let lastPollResult: { timestamp: Date; totalFound: number; processed: number; skipped: number; errors: string[] } | null = null;
let lastExtractResult: { timestamp: Date; processed: number; failed: number; skipped: number } | null = null;

export function getLastPollResult() { return lastPollResult; }
export function getLastExtractResult() { return lastExtractResult; }

export async function pollEmailsJob(): Promise<void> {
  const allSettings = await db.select().from(apInboxSettings)
    .where(eq(apInboxSettings.isEnabled, true));

  if (allSettings.length === 0) {
    logger.debug("[AP Background] No enabled inbox settings found, skipping poll");
    return;
  }

  let apiKey: string;
  try {
    apiKey = await getResendApiKey();
  } catch {
    logger.debug("[AP Background] No Resend API key available, skipping poll");
    return;
  }

  let totalFound = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  for (const settings of allSettings) {
    if (!settings.inboundEmailAddress) continue;

    try {
      const result = await pollEmailsForCompany(settings, apiKey);
      totalFound += result.found;
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
      if (result.errors.length > 0) allErrors.push(...result.errors);
    } catch (err: any) {
      logger.error({ err, companyId: settings.companyId }, "[AP Background] Email poll failed for company");
      allErrors.push(`Company ${settings.companyId}: ${err.message}`);
    }
  }

  lastPollResult = {
    timestamp: new Date(),
    totalFound,
    processed: totalProcessed,
    skipped: totalSkipped,
    errors: allErrors,
  };

  if (totalProcessed > 0) {
    logger.info({ totalFound, processed: totalProcessed, skipped: totalSkipped }, "[AP Background] Email poll complete");
  }
}

async function pollEmailsForCompany(
  settings: typeof apInboxSettings.$inferSelect,
  apiKey: string
): Promise<{ found: number; processed: number; skipped: number; errors: string[] }> {
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
      logger.error({ status: listRes.status, body: errText }, "[AP Background] Failed to fetch emails from Resend");
      throw new Error(`Resend API error: ${listRes.status}`);
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

  const inboundAddr = settings.inboundEmailAddress!.toLowerCase().trim();
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
        } catch {
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
          logger.error({ err, inboundId: inboundRecord.id }, "[AP Background] Processing failed for email");
        }
      } else {
        await db.update(apInboundEmails)
          .set({ status: "NO_ATTACHMENTS", processedAt: new Date() })
          .where(eq(apInboundEmails.id, inboundRecord.id));
      }

      processed++;
    } catch (emailErr: any) {
      errors.push(`Email ${emailId}: ${emailErr.message}`);
    }
  }

  return { found: matchingEmails.length, processed, skipped, errors };
}

async function processInboundEmail(
  inboundId: string,
  resendEmailId: string,
  settings: typeof apInboxSettings.$inferSelect
) {
  await db.update(apInboundEmails)
    .set({ status: "PROCESSING" })
    .where(eq(apInboundEmails.id, inboundId));

  const apiKey = await getResendApiKey();

  const emailDetailRes = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!emailDetailRes.ok) {
    throw new Error(`Failed to fetch email details: ${emailDetailRes.status}`);
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
        if (!downloadRes.ok) continue;
        const arrayBuffer = await downloadRes.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        continue;
      }

      const fileExt = (attachment.filename || "invoice.pdf").split(".").pop() || "pdf";
      const mimeType = attachment.content_type || "application/pdf";
      const storageKey = `ap-invoices/${settings.companyId}/${crypto.randomUUID()}.${fileExt}`;

      await objectStorageService.uploadFile(storageKey, fileBuffer, mimeType);

      const [invoice] = await db.insert(apInvoices).values({
        companyId: settings.companyId,
        status: "IMPORTED" as const,
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
    } catch (attErr: any) {
      logger.error({ err: attErr, filename: attachment.filename }, "[AP Background] Failed to process attachment");
    }
  }

  await db.update(apInboundEmails)
    .set({
      status: firstInvoiceId ? "PROCESSED" : "FAILED",
      invoiceId: firstInvoiceId,
      processedAt: new Date(),
    })
    .where(eq(apInboundEmails.id, inboundId));
}

const MAX_EXTRACT_BATCH = 3;
const MAX_EXTRACT_RETRIES = 3;

const extractionRetryCount: Map<string, number> = new Map();

export async function processImportedInvoicesJob(): Promise<void> {
  const importedInvoices = await db
    .select({
      id: apInvoices.id,
      companyId: apInvoices.companyId,
      status: apInvoices.status,
    })
    .from(apInvoices)
    .where(eq(apInvoices.status, "IMPORTED"))
    .limit(MAX_EXTRACT_BATCH);

  if (importedInvoices.length === 0) {
    return;
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const invoice of importedInvoices) {
    try {
      const retries = extractionRetryCount.get(invoice.id) || 0;
      if (retries >= MAX_EXTRACT_RETRIES) {
        await db.update(apInvoices).set({
          status: "IMPORTED",
          riskScore: 100,
          riskReasons: [`Auto-extraction failed after ${MAX_EXTRACT_RETRIES} attempts`],
          updatedAt: new Date(),
        }).where(eq(apInvoices.id, invoice.id));
        await logActivity(invoice.id, "extraction_failed", `Auto-extraction failed after ${MAX_EXTRACT_RETRIES} attempts - manual extraction required`);
        extractionRetryCount.delete(invoice.id);
        failed++;
        continue;
      }

      const docs = await db.select().from(apInvoiceDocuments)
        .where(eq(apInvoiceDocuments.invoiceId, invoice.id)).limit(1);

      if (!docs.length) {
        skipped++;
        continue;
      }

      const [existingFields] = await db.select({ id: apInvoiceExtractedFields.id })
        .from(apInvoiceExtractedFields)
        .where(eq(apInvoiceExtractedFields.invoiceId, invoice.id))
        .limit(1);

      if (existingFields) {
        skipped++;
        continue;
      }

      await extractInvoiceData(invoice.id, invoice.companyId, docs[0]);
      extractionRetryCount.delete(invoice.id);
      processed++;
    } catch (err: any) {
      failed++;
      const retries = (extractionRetryCount.get(invoice.id) || 0) + 1;
      extractionRetryCount.set(invoice.id, retries);
      logger.error({ err, invoiceId: invoice.id, retryCount: retries, maxRetries: MAX_EXTRACT_RETRIES }, "[AP Background] Extraction failed for invoice");

      if (retries >= MAX_EXTRACT_RETRIES) {
        try {
          await db.update(apInvoices).set({
            status: "IMPORTED",
            riskScore: 100,
            riskReasons: [`Auto-extraction failed after ${MAX_EXTRACT_RETRIES} attempts: ${err.message}`],
            updatedAt: new Date(),
          }).where(eq(apInvoices.id, invoice.id));
          await logActivity(invoice.id, "extraction_failed", `Auto-extraction failed: ${err.message}. Manual extraction required.`);
          extractionRetryCount.delete(invoice.id);
        } catch {}
      }
    }
  }

  lastExtractResult = {
    timestamp: new Date(),
    processed,
    failed,
    skipped,
  };

  if (processed > 0) {
    logger.info({ processed, failed, skipped, total: importedInvoices.length }, "[AP Background] Invoice extraction batch complete");
  }
}

async function extractInvoiceData(
  invoiceId: string,
  companyId: string,
  doc: typeof apInvoiceDocuments.$inferSelect
): Promise<void> {
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ap-bg-extract-"));
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
    logger.warn({ invoiceId }, "[AP Background] Could not convert document to images");
    return;
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI();

  const { AP_EXTRACTION_SYSTEM_PROMPT, AP_EXTRACTION_USER_PROMPT, parseExtractedData, buildExtractedFieldRecords, buildInvoiceUpdateFromExtraction, sanitizeNumericValue } = await import("./ap-extraction-prompt");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: AP_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: AP_EXTRACTION_USER_PROMPT },
          ...imageBuffers.map(img => ({
            type: "image_url" as const,
            image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" as const },
          })),
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  let rawData: any;
  try {
    rawData = JSON.parse(responseText);
  } catch {
    logger.error({ invoiceId }, "[AP Background] Failed to parse extraction response");
    return;
  }

  const data = parseExtractedData(rawData);
  const fieldRecords = buildExtractedFieldRecords(invoiceId, data);

  for (const field of fieldRecords) {
    await db.insert(apInvoiceExtractedFields).values({
      invoiceId,
      fieldKey: field.fieldKey,
      fieldValue: field.fieldValue,
      confidence: field.confidence,
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

  updateData.status = "PROCESSED";
  updateData.updatedAt = new Date();

  await db.update(apInvoices).set(updateData).where(eq(apInvoices.id, invoiceId));

  const totalInc = parseFloat(sanitizeNumericValue(data.total_amount_inc_gst) || "0");
  if (totalInc > 0) {
    const gstAmount = parseFloat(sanitizeNumericValue(data.total_gst) || "0");
    const subtotal = parseFloat(sanitizeNumericValue(data.subtotal_ex_gst) || String(totalInc));
    const taxCodeLabel = gstAmount > 0 ? "GST" : "FRE";

    await db.insert(apInvoiceSplits).values({
      invoiceId,
      description: data.description || "Invoice total",
      percentage: "100",
      amount: subtotal > 0 ? subtotal.toFixed(2) : totalInc.toFixed(2),
      taxCodeId: taxCodeLabel,
      sortOrder: 0,
    });
  }

  await logActivity(invoiceId, "auto_extraction_completed", "AI extraction completed automatically in background", undefined, {
    fieldsExtracted: fieldRecords.length,
  });

  logger.info({ invoiceId, fieldsExtracted: fieldRecords.length }, "[AP Background] Extraction complete");
}
