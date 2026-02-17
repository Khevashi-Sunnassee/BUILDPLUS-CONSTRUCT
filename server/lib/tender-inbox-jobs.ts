import logger from "./logger";
import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  tenderInboundEmails, tenderEmailDocuments, tenderEmailExtractedFields,
  tenderEmailActivity, tenderInboxSettings, suppliers, companies
} from "@shared/schema";
import OpenAI from "openai";
import { getResendApiKey } from "../services/email.service";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const objectStorageService = new ObjectStorageService();

let lastTenderPollResult: { timestamp: Date; totalFound: number; processed: number; skipped: number; errors: string[] } | null = null;
export function getLastTenderPollResult() { return lastTenderPollResult; }

export async function pollTenderEmailsJob(): Promise<void> {
  const allSettings = await db.select().from(tenderInboxSettings)
    .where(eq(tenderInboxSettings.isEnabled, true))
    .limit(100);

  if (allSettings.length === 0) {
    logger.debug("[Tender Background] No enabled tender inbox settings found, skipping poll");
    return;
  }

  let apiKey: string;
  try {
    apiKey = await getResendApiKey();
  } catch {
    logger.debug("[Tender Background] No Resend API key available, skipping poll");
    return;
  }

  let totalFound = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  const companyIds = allSettings.map(s => s.companyId);
  const companyRows = companyIds.length > 0 ? await db.select({ id: companies.id, tenderInboxEmail: companies.tenderInboxEmail })
    .from(companies).where(inArray(companies.id, companyIds)).limit(100) : [];
  const companyEmailMap = new Map(companyRows.map(c => [c.id, c.tenderInboxEmail]));

  for (const settings of allSettings) {
    const emailAddr = companyEmailMap.get(settings.companyId) || settings.inboundEmailAddress;
    if (!emailAddr) continue;

    try {
      const settingsWithEmail = { ...settings, inboundEmailAddress: emailAddr };
      const result = await pollTenderEmailsForCompany(settingsWithEmail, apiKey);
      totalFound += result.found;
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
      if (result.errors.length > 0) allErrors.push(...result.errors);
    } catch (err: any) {
      logger.error({ err, companyId: settings.companyId }, "[Tender Background] Email poll failed for company");
      allErrors.push(`Company ${settings.companyId}: ${err.message}`);
    }
  }

  lastTenderPollResult = {
    timestamp: new Date(),
    totalFound,
    processed: totalProcessed,
    skipped: totalSkipped,
    errors: allErrors,
  };

  if (totalProcessed > 0) {
    logger.info({ totalFound, processed: totalProcessed, skipped: totalSkipped }, "[Tender Background] Email poll complete");
  }
}

async function pollTenderEmailsForCompany(
  settings: typeof tenderInboxSettings.$inferSelect,
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
      logger.error({ status: listRes.status, body: errText }, "[Tender Background] Failed to fetch emails from Resend");
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

    const [existing] = await db.select().from(tenderInboundEmails)
      .where(eq(tenderInboundEmails.resendEmailId, emailId)).limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    try {
      const fromAddr = typeof email.from === "string" ? email.from : (email.from?.email || email.from?.address || JSON.stringify(email.from));
      const toAddrs: string[] = Array.isArray(email.to) ? email.to : (email.to ? [email.to] : []);

      let earlyAttachmentCount = 0;
      try {
        const emailAttachments = Array.isArray(email.attachments) ? email.attachments : [];
        if (emailAttachments.length > 0) {
          earlyAttachmentCount = emailAttachments.length;
        } else {
          const attRes = await fetch(`https://api.resend.com/emails/${emailId}/receiving/attachments`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (attRes.ok) {
            const attData = await attRes.json();
            const attachments = Array.isArray(attData.data) ? attData.data : (Array.isArray(attData) ? attData : []);
            earlyAttachmentCount = attachments.length;
          }
        }
      } catch {}

      const [inboundRecord] = await db.insert(tenderInboundEmails).values({
        companyId: settings.companyId,
        resendEmailId: emailId,
        fromAddress: fromAddr,
        toAddress: toAddrs[0] || null,
        subject: email.subject || null,
        status: "RECEIVED",
        attachmentCount: earlyAttachmentCount,
      }).returning();

      await db.insert(tenderEmailActivity).values({
        inboundEmailId: inboundRecord.id,
        activityType: "received",
        message: `Tender email received from ${fromAddr}`,
        metaJson: { subject: email.subject, from: fromAddr, earlyAttachmentCount },
      });

      await processTenderEmailFromPoll(inboundRecord.id, emailId, settings, apiKey);
      processed++;
    } catch (emailErr: any) {
      errors.push(`Email ${emailId}: ${emailErr.message}`);
    }
  }

  return { found: matchingEmails.length, processed, skipped, errors };
}

async function processTenderEmailFromPoll(
  inboundId: string,
  resendEmailId: string,
  settings: typeof tenderInboxSettings.$inferSelect,
  apiKey: string
) {
  try {
    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(tenderInboundEmails.id, inboundId));

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

    await db.update(tenderInboundEmails)
      .set({ attachmentCount: attachments.length })
      .where(eq(tenderInboundEmails.id, inboundId));

    if (relevantAttachments.length === 0) {
      const emailBodyText = emailDetail.text || emailDetail.html || "";
      if (emailBodyText && settings.autoExtract) {
        try {
          await extractTenderEmailFromText(inboundId, settings.companyId, emailBodyText);
        } catch (extractErr: any) {
          logger.warn({ err: extractErr, inboundId }, "[Tender Background] Body text extraction failed");
        }
      }
      await db.update(tenderInboundEmails)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(tenderInboundEmails.id, inboundId));

      await db.insert(tenderEmailActivity).values({
        inboundEmailId: inboundId,
        activityType: "processed",
        message: `Email received with ${attachments.length} attachment(s), no PDF/images found`,
        metaJson: { totalAttachments: attachments.length },
      });
      return;
    }

    let docsCreated = 0;

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
            logger.error({ filename: attachment.filename }, "[Tender Background] Failed to download attachment");
            continue;
          }
          const arrayBuffer = await downloadRes.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        } else {
          logger.warn({ attachment: attachment.filename }, "[Tender Background] No content or download URL for attachment");
          continue;
        }

        const fileExt = (attachment.filename || "tender.pdf").split(".").pop() || "pdf";
        const mimeType = attachment.content_type || "application/pdf";
        const storageKey = `tender-emails/${settings.companyId}/${crypto.randomUUID()}.${fileExt}`;

        await objectStorageService.uploadFile(storageKey, fileBuffer, mimeType);

        await db.insert(tenderEmailDocuments).values({
          inboundEmailId: inboundId,
          storageKey,
          fileName: attachment.filename || `tender-${Date.now()}.${fileExt}`,
          mimeType,
          fileSize: fileBuffer.length,
        });

        docsCreated++;
        logger.info({ inboundId, filename: attachment.filename }, "[Tender Background] Stored tender email attachment");

        if (settings.autoExtract && docsCreated === 1) {
          try {
            await extractTenderEmailInline(inboundId, settings.companyId, fileBuffer, mimeType);
          } catch (extractErr: any) {
            logger.warn({ err: extractErr, inboundId }, "[Tender Background] Auto-extraction failed");
          }
        }
      } catch (attErr: any) {
        logger.error({ err: attErr, filename: attachment.filename }, "[Tender Background] Failed to process attachment");
      }
    }

    await db.update(tenderInboundEmails)
      .set({
        status: docsCreated > 0 ? "PROCESSED" : "FAILED",
        processedAt: new Date(),
      })
      .where(eq(tenderInboundEmails.id, inboundId));

    await db.insert(tenderEmailActivity).values({
      inboundEmailId: inboundId,
      activityType: "processed",
      message: `Email processed: ${docsCreated} document(s) stored`,
      metaJson: { docsCreated, totalAttachments: attachments.length },
    });

    logger.info({ inboundId, docsCreated }, "[Tender Background] Email processing complete");
  } catch (error: any) {
    logger.error({ err: error, inboundId }, "[Tender Background] Processing error");
    await db.update(tenderInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(tenderInboundEmails.id, inboundId));
  }
}

async function logTenderActivity(inboundEmailId: string, activityType: string, message: string, actorUserId?: string, metaJson?: any) {
  await db.insert(tenderEmailActivity).values({
    inboundEmailId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

export async function extractTenderEmailInline(
  inboundEmailId: string,
  companyId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  try {
    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_started", "AI extraction started");

    const base64Content = fileBuffer.toString("base64");
    const isPdf = mimeType === "application/pdf";

    const systemPrompt = `You are an AI assistant that extracts structured information from tender/quote submission documents received via email in a construction/manufacturing context.

Extract the following fields from the document. Return a JSON object with these keys:
- supplier_name: The company/supplier name submitting the tender or quote
- supplier_abn: Australian Business Number if found
- supplier_email: Email address of the supplier
- supplier_phone: Phone number
- supplier_contact_name: Contact person name
- tender_reference: Any tender/quote reference number
- project_name: The project or job name referenced
- total_amount: Total quoted/tendered amount (numeric string)
- currency: Currency code (default AUD)
- gst_included: Whether GST is included (true/false)
- gst_amount: GST amount if separately stated
- scope_summary: Brief summary of the scope of works being quoted
- validity_period: How long the quote is valid
- delivery_timeline: Proposed delivery or completion timeline
- payment_terms: Payment terms stated
- exclusions: Any noted exclusions
- inclusions: Any noted inclusions
- notes: Any other relevant notes

Only include fields where you can find or reasonably infer the value. Return valid JSON only.`;

    let content: any[];
    if (isPdf) {
      content = [
        { type: "file" as const, file: { filename: "tender.pdf", file_data: `data:application/pdf;base64,${base64Content}` } },
        { type: "text" as const, text: "Extract tender/quote information from this PDF document." },
      ];
    } else {
      content = [
        { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${base64Content}` } },
        { type: "text" as const, text: "Extract tender/quote information from this document image." },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || "";

    let extractedData: Record<string, any> = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      logger.warn({ err: parseErr, inboundEmailId }, "[Tender Extract] Failed to parse AI response");
      extractedData = { raw_response: responseText };
    }

    const fields: { inboundEmailId: string; fieldKey: string; fieldValue: string | null; confidence: string; source: string }[] = [];
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== "") {
        fields.push({
          inboundEmailId,
          fieldKey: key,
          fieldValue: typeof value === "object" ? JSON.stringify(value) : String(value),
          confidence: "0.8500",
          source: "ai_extraction",
        });
      }
    }

    if (fields.length > 0) {
      await db.delete(tenderEmailExtractedFields)
        .where(eq(tenderEmailExtractedFields.inboundEmailId, inboundEmailId));

      for (const field of fields) {
        await db.insert(tenderEmailExtractedFields).values(field);
      }
    }

    const allSuppliers = await db.select().from(suppliers)
      .where(and(
        eq(suppliers.companyId, companyId),
        eq(suppliers.isActive, true),
      ))
      .limit(1000);

    let matchedSupplier: typeof allSuppliers[0] | null = null;

    if (extractedData.supplier_name) {
      const supplierName = extractedData.supplier_name;
      const normalizedName = supplierName.toLowerCase().trim();
      matchedSupplier = allSuppliers.find(s => {
        const sName = s.name.toLowerCase().trim();
        return sName === normalizedName ||
          sName.includes(normalizedName) ||
          normalizedName.includes(sName);
      }) || null;
    }

    if (!matchedSupplier) {
      const [emailRecord] = await db.select().from(tenderInboundEmails)
        .where(eq(tenderInboundEmails.id, inboundEmailId)).limit(1);

      if (emailRecord?.fromAddress) {
        const fromAddr = emailRecord.fromAddress.toLowerCase().trim();
        const emailMatch = fromAddr.match(/<([^>]+)>/) || [null, fromAddr];
        const emailAddr = (emailMatch[1] || fromAddr).trim();
        const domain = emailAddr.split("@")[1];

        if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com"].includes(domain)) {
          matchedSupplier = allSuppliers.find(s => {
            if (!s.email) return false;
            const supplierEmail = s.email.toLowerCase().trim();
            const supplierDomain = supplierEmail.split("@")[1];
            return supplierDomain === domain;
          }) || null;

          if (matchedSupplier) {
            logger.info({ inboundEmailId, supplierId: matchedSupplier.id, domain }, "[Tender Extract] Auto-matched supplier by email domain");
          }
        }

        if (!matchedSupplier && extractedData.supplier_email) {
          const extractedEmail = extractedData.supplier_email.toLowerCase().trim();
          matchedSupplier = allSuppliers.find(s => {
            if (!s.email) return false;
            return s.email.toLowerCase().trim() === extractedEmail;
          }) || null;
        }
      }
    }

    if (matchedSupplier) {
      await db.update(tenderInboundEmails)
        .set({ supplierId: matchedSupplier.id })
        .where(eq(tenderInboundEmails.id, inboundEmailId));

      logger.info({ inboundEmailId, supplierId: matchedSupplier.id, supplierName: matchedSupplier.name }, "[Tender Extract] Auto-matched supplier");
    }

    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_completed", `AI extraction completed: ${fields.length} fields extracted`, undefined, {
      fieldsExtracted: fields.length,
      supplierFound: !!extractedData.supplier_name,
    });

    logger.info({ inboundEmailId, fieldsExtracted: fields.length }, "[Tender Extract] Extraction complete");
  } catch (error: any) {
    logger.error({ err: error, inboundEmailId }, "[Tender Extract] Extraction error");

    await db.update(tenderInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Extraction failed",
      })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_failed", `Extraction failed: ${error.message}`);
  }
}

export async function extractTenderEmailFromText(
  inboundEmailId: string,
  companyId: string,
  emailBodyText: string
): Promise<void> {
  try {
    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_started", "AI extraction started from email body text");

    const systemPrompt = `You are an AI assistant that extracts structured information from tender/quote submission emails in a construction/manufacturing context.

Extract the following fields from the email text. Return a JSON object with these keys:
- supplier_name: The company/supplier name submitting the tender or quote
- supplier_abn: Australian Business Number if found
- supplier_email: Email address of the supplier
- supplier_phone: Phone number
- supplier_contact_name: Contact person name
- tender_reference: Any tender/quote reference number
- project_name: The project or job name referenced
- total_amount: Total quoted/tendered amount (numeric string)
- currency: Currency code (default AUD)
- gst_included: Whether GST is included (true/false)
- gst_amount: GST amount if separately stated
- scope_summary: Brief summary of the scope of works being quoted
- validity_period: How long the quote is valid
- delivery_timeline: Proposed delivery or completion timeline
- payment_terms: Payment terms stated
- exclusions: Any noted exclusions
- inclusions: Any noted inclusions
- notes: Any other relevant notes

Only include fields where you can find or reasonably infer the value. Return valid JSON only.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract tender/quote information from this email:\n\n${emailBodyText.substring(0, 15000)}` },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || "";

    let extractedData: Record<string, any> = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      logger.warn({ err: parseErr, inboundEmailId }, "[Tender Extract] Failed to parse AI response from text");
      extractedData = { raw_response: responseText };
    }

    const fields: { inboundEmailId: string; fieldKey: string; fieldValue: string | null; confidence: string; source: string }[] = [];
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== "") {
        fields.push({
          inboundEmailId,
          fieldKey: key,
          fieldValue: typeof value === "object" ? JSON.stringify(value) : String(value),
          confidence: "0.7000",
          source: "email_body_extraction",
        });
      }
    }

    if (fields.length > 0) {
      await db.delete(tenderEmailExtractedFields)
        .where(eq(tenderEmailExtractedFields.inboundEmailId, inboundEmailId));

      for (const field of fields) {
        await db.insert(tenderEmailExtractedFields).values(field);
      }
    }

    if (extractedData.supplier_name) {
      const supplierName = extractedData.supplier_name;
      const matchedSuppliers = await db.select().from(suppliers)
        .where(and(
          eq(suppliers.companyId, companyId),
          eq(suppliers.isActive, true),
        ))
        .limit(1000);

      const normalizedName = supplierName.toLowerCase().trim();
      const match = matchedSuppliers.find(s => {
        const sName = s.name.toLowerCase().trim();
        return sName === normalizedName ||
          sName.includes(normalizedName) ||
          normalizedName.includes(sName);
      });

      if (match) {
        await db.update(tenderInboundEmails)
          .set({ supplierId: match.id })
          .where(eq(tenderInboundEmails.id, inboundEmailId));

        logger.info({ inboundEmailId, supplierId: match.id, supplierName: match.name }, "[Tender Extract] Auto-matched supplier from email text");
      }
    }

    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_completed", `AI extraction from email body completed: ${fields.length} fields extracted`, undefined, {
      fieldsExtracted: fields.length,
      supplierFound: !!extractedData.supplier_name,
      source: "email_body",
    });

    logger.info({ inboundEmailId, fieldsExtracted: fields.length }, "[Tender Extract] Email body extraction complete");
  } catch (error: any) {
    logger.error({ err: error, inboundEmailId }, "[Tender Extract] Email body extraction error");
    await logTenderActivity(inboundEmailId, "extraction_failed", `Email body extraction failed: ${error.message}`);
  }
}
