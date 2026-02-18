import logger from "./logger";
import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import { resendBreaker } from "./circuit-breaker";
import {
  draftingInboundEmails, draftingEmailDocuments, draftingEmailExtractedFields,
  draftingEmailActivity, draftingInboxSettings, jobs, companies
} from "@shared/schema";
import OpenAI from "openai";
import { getResendApiKey } from "../services/email.service";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const objectStorageService = new ObjectStorageService();

let lastDraftingPollResult: { timestamp: Date; totalFound: number; processed: number; skipped: number; errors: string[] } | null = null;
export function getLastDraftingPollResult() { return lastDraftingPollResult; }

export async function pollDraftingEmailsJob(): Promise<void> {
  const allSettings = await db.select().from(draftingInboxSettings)
    .where(eq(draftingInboxSettings.isEnabled, true))
    .limit(100);

  if (allSettings.length === 0) {
    logger.debug("[Drafting Background] No enabled drafting inbox settings found, skipping poll");
    return;
  }

  let apiKey: string;
  try {
    apiKey = await getResendApiKey();
  } catch {
    logger.debug("[Drafting Background] No Resend API key available, skipping poll");
    return;
  }

  let totalFound = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  const companyIds = allSettings.map(s => s.companyId);
  const companyRows = companyIds.length > 0 ? await db.select({ id: companies.id, draftingInboxEmail: companies.draftingInboxEmail })
    .from(companies).where(inArray(companies.id, companyIds)).limit(100) : [];
  const companyEmailMap = new Map(companyRows.map(c => [c.id, c.draftingInboxEmail]));

  for (const settings of allSettings) {
    const emailAddr = companyEmailMap.get(settings.companyId) || settings.inboundEmailAddress;
    if (!emailAddr) continue;

    try {
      const settingsWithEmail = { ...settings, inboundEmailAddress: emailAddr };
      const result = await resendBreaker.execute(
        () => pollDraftingEmailsForCompany(settingsWithEmail, apiKey),
        () => ({ found: 0, processed: 0, skipped: 0, errors: [`Resend circuit breaker open for company ${settings.companyId}`] })
      );
      totalFound += result.found;
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
      if (result.errors.length > 0) allErrors.push(...result.errors);
    } catch (err: any) {
      logger.error({ err, companyId: settings.companyId }, "[Drafting Background] Email poll failed for company");
      allErrors.push(`Company ${settings.companyId}: ${err.message}`);
    }
  }

  lastDraftingPollResult = {
    timestamp: new Date(),
    totalFound,
    processed: totalProcessed,
    skipped: totalSkipped,
    errors: allErrors,
  };

  if (totalProcessed > 0) {
    logger.info({ totalFound, processed: totalProcessed, skipped: totalSkipped }, "[Drafting Background] Email poll complete");
  }
}

export async function pollDraftingEmailsForCompany(
  settings: typeof draftingInboxSettings.$inferSelect,
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
      logger.error({ status: listRes.status, body: errText }, "[Drafting Background] Failed to fetch emails from Resend");
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

  if (matchingEmails.length === 0) {
    return { found: 0, processed: 0, skipped: 0, errors: [] };
  }

  const matchingIds = matchingEmails.map((e: any) => e.id).filter(Boolean);
  const existingRecords = await db.select({ resendEmailId: draftingInboundEmails.resendEmailId })
    .from(draftingInboundEmails)
    .where(inArray(draftingInboundEmails.resendEmailId, matchingIds))
    .limit(1000);
  const existingSet = new Set(existingRecords.map(r => r.resendEmailId));

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const email of matchingEmails) {
    const emailId = email.id;
    if (!emailId) { skipped++; continue; }

    if (existingSet.has(emailId)) {
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

      const [inboundRecord] = await db.insert(draftingInboundEmails).values({
        companyId: settings.companyId,
        resendEmailId: emailId,
        fromAddress: fromAddr,
        toAddress: toAddrs[0] || null,
        subject: email.subject || null,
        status: "RECEIVED",
        attachmentCount: earlyAttachmentCount,
      }).returning();

      await db.insert(draftingEmailActivity).values({
        inboundEmailId: inboundRecord.id,
        activityType: "received",
        message: `Drafting email received from ${fromAddr}`,
        metaJson: { subject: email.subject, from: fromAddr, earlyAttachmentCount },
      });

      await processDraftingEmailFromPoll(inboundRecord.id, emailId, settings, apiKey);
      processed++;
    } catch (emailErr: any) {
      errors.push(`Email ${emailId}: ${emailErr.message}`);
    }
  }

  return { found: matchingEmails.length, processed, skipped, errors };
}

export async function processDraftingEmailFromPoll(
  inboundId: string,
  resendEmailId: string,
  settings: typeof draftingInboxSettings.$inferSelect,
  apiKey: string
) {
  try {
    await db.update(draftingInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(draftingInboundEmails.id, inboundId));

    const emailDetailRes = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!emailDetailRes.ok) {
      throw new Error(`Failed to fetch email details: ${emailDetailRes.status}`);
    }

    const emailDetail = await emailDetailRes.json();

    await db.update(draftingInboundEmails)
      .set({
        htmlBody: emailDetail.html || null,
        textBody: emailDetail.text || null,
      })
      .where(eq(draftingInboundEmails.id, inboundId));

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

    const relevantAttachments = attachments.filter((att: any) => {
      const ct = att.content_type || "";
      const fname = (att.filename || "").toLowerCase();
      if (ct === "application/pdf" || fname.endsWith(".pdf")) return true;
      if (ct.startsWith("image/") && (ct.includes("jpeg") || ct.includes("png") || ct.includes("tiff"))) {
        if (att.content_disposition === "inline" || att.content_id) return false;
        if (fname.startsWith("outlook-") || fname.startsWith("image0") || fname.includes("signature") || fname.includes("banner") || fname.includes("logo")) return false;
        return true;
      }
      if (fname.endsWith(".dwg") || fname.endsWith(".dxf") || fname.endsWith(".rvt") || fname.endsWith(".ifc")) return true;
      return false;
    });

    await db.update(draftingInboundEmails)
      .set({ attachmentCount: attachments.length })
      .where(eq(draftingInboundEmails.id, inboundId));

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
            logger.error({ filename: attachment.filename }, "[Drafting Background] Failed to download attachment");
            continue;
          }
          const arrayBuffer = await downloadRes.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        } else {
          logger.warn({ attachment: attachment.filename }, "[Drafting Background] No content or download URL for attachment");
          continue;
        }

        const fileExt = (attachment.filename || "file.pdf").split(".").pop() || "pdf";
        const mimeType = attachment.content_type || "application/octet-stream";
        const storageKey = `drafting-emails/${settings.companyId}/${crypto.randomUUID()}.${fileExt}`;

        await objectStorageService.uploadFile(storageKey, fileBuffer, mimeType);

        await db.insert(draftingEmailDocuments).values({
          inboundEmailId: inboundId,
          storageKey,
          fileName: attachment.filename || `drafting-${Date.now()}.${fileExt}`,
          mimeType,
          fileSize: fileBuffer.length,
        });

        docsCreated++;
        logger.info({ inboundId, filename: attachment.filename }, "[Drafting Background] Stored drafting email attachment");
      } catch (attErr: any) {
        logger.error({ err: attErr, filename: attachment.filename }, "[Drafting Background] Failed to process attachment");
      }
    }

    if (settings.autoExtract) {
      try {
        await extractDraftingEmail(inboundId, settings.companyId, emailDetail.text || emailDetail.html || "", emailDetail.subject || "");
      } catch (extractErr: any) {
        logger.warn({ err: extractErr, inboundId }, "[Drafting Background] Auto-extraction failed");
      }
    }

    await db.update(draftingInboundEmails)
      .set({
        status: docsCreated > 0 || (emailDetail.text || emailDetail.html) ? "PROCESSED" : "FAILED",
        processedAt: new Date(),
      })
      .where(eq(draftingInboundEmails.id, inboundId));

    await db.insert(draftingEmailActivity).values({
      inboundEmailId: inboundId,
      activityType: "processed",
      message: `Email processed: ${docsCreated} document(s) stored`,
      metaJson: { docsCreated, totalAttachments: attachments.length },
    });

    logger.info({ inboundId, docsCreated }, "[Drafting Background] Email processing complete");
  } catch (error: any) {
    logger.error({ err: error, inboundId }, "[Drafting Background] Processing error");
    await db.update(draftingInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(draftingInboundEmails.id, inboundId));
  }
}

async function logDraftingActivity(inboundEmailId: string, activityType: string, message: string, actorUserId?: string, metaJson?: any) {
  await db.insert(draftingEmailActivity).values({
    inboundEmailId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

export async function extractDraftingEmail(
  inboundEmailId: string,
  companyId: string,
  emailBodyText: string,
  emailSubject: string
): Promise<void> {
  try {
    await db.update(draftingInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(draftingInboundEmails.id, inboundEmailId));

    await logDraftingActivity(inboundEmailId, "extraction_started", "AI extraction started");

    const allJobs = await db.select({
      id: jobs.id,
      name: jobs.name,
      jobNumber: jobs.jobNumber,
    }).from(jobs)
      .where(eq(jobs.companyId, companyId))
      .limit(500);

    const jobListForAI = allJobs.map(j => `${j.jobNumber || ""} - ${j.name} (ID: ${j.id})`).join("\n");

    const systemPrompt = `You are an AI assistant that analyzes drafting-related emails in a construction/manufacturing context. These emails come from clients, engineers, or project managers about panel drawings, structural designs, and related modifications.

Analyze the email and extract the following information. Return a JSON object with these keys:

- request_type: One of: "change_request", "drawing_update", "rfi" (request for information), "approval", "revision", "new_drawing", "general_query", "error_report", "other"
- impact_area: One of: "production", "drawing", "design", "scheduling", "quality", "cost", "multiple", "none"
- urgency: One of: "critical", "high", "medium", "low"
- summary: Brief summary of what the email is about (1-2 sentences)
- job_reference: Any job number or project name referenced in the email
- matched_job_id: If you can match the job reference to one of the known jobs listed below, provide the job ID. Otherwise null.
- panel_references: Array of panel marks/IDs mentioned (e.g. ["W1", "W2", "FL-01"])
- drawing_numbers: Array of drawing numbers referenced
- change_description: Description of any changes being requested
- action_required: What action is needed (brief description)
- sender_company: The company name of the sender if identifiable
- sender_name: Name of the person sending the email

Known jobs in the system:
${jobListForAI || "No jobs currently in system"}

Only include fields where you can find or reasonably infer the value. Return valid JSON only.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this drafting email:\n\nSubject: ${emailSubject}\n\n${emailBodyText.substring(0, 15000)}` },
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
      logger.warn({ err: parseErr, inboundEmailId }, "[Drafting Extract] Failed to parse AI response");
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
      await db.delete(draftingEmailExtractedFields)
        .where(eq(draftingEmailExtractedFields.inboundEmailId, inboundEmailId));

      for (const field of fields) {
        await db.insert(draftingEmailExtractedFields).values(field);
      }
    }

    const updateData: Record<string, any> = {};

    if (extractedData.request_type) {
      updateData.requestType = extractedData.request_type;
    }
    if (extractedData.impact_area) {
      updateData.impactArea = extractedData.impact_area;
    }

    if (extractedData.matched_job_id) {
      const matchedJob = allJobs.find(j => j.id === extractedData.matched_job_id);
      if (matchedJob) {
        updateData.jobId = matchedJob.id;
        logger.info({ inboundEmailId, jobId: matchedJob.id, jobName: matchedJob.name }, "[Drafting Extract] Auto-matched job");
      }
    }

    if (!updateData.jobId && extractedData.job_reference) {
      const jobRef = extractedData.job_reference.toLowerCase().trim();
      const matchedJob = allJobs.find(j => {
        const jNum = (j.jobNumber || "").toLowerCase().trim();
        const jName = j.name.toLowerCase().trim();
        return jNum === jobRef || jName === jobRef ||
          jNum.includes(jobRef) || jobRef.includes(jNum) ||
          jName.includes(jobRef) || jobRef.includes(jName);
      });
      if (matchedJob) {
        updateData.jobId = matchedJob.id;
        logger.info({ inboundEmailId, jobId: matchedJob.id, jobName: matchedJob.name }, "[Drafting Extract] Fuzzy-matched job by reference");
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(draftingInboundEmails)
        .set(updateData)
        .where(eq(draftingInboundEmails.id, inboundEmailId));
    }

    await db.update(draftingInboundEmails)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(draftingInboundEmails.id, inboundEmailId));

    await logDraftingActivity(inboundEmailId, "extraction_completed", `AI extraction completed: ${fields.length} fields extracted`, undefined, {
      fieldsExtracted: fields.length,
      requestType: extractedData.request_type || null,
      impactArea: extractedData.impact_area || null,
      jobMatched: !!updateData.jobId,
    });

    logger.info({ inboundEmailId, fieldsExtracted: fields.length }, "[Drafting Extract] Extraction complete");
  } catch (error: any) {
    logger.error({ err: error, inboundEmailId }, "[Drafting Extract] Extraction error");

    await db.update(draftingInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Extraction failed",
      })
      .where(eq(draftingInboundEmails.id, inboundEmailId));

    await logDraftingActivity(inboundEmailId, "extraction_failed", `Extraction failed: ${error.message}`);
  }
}

export async function extractDraftingEmailFromDocument(
  inboundEmailId: string,
  companyId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  try {
    await db.update(draftingInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(draftingInboundEmails.id, inboundEmailId));

    await logDraftingActivity(inboundEmailId, "extraction_started", "AI extraction started from document");

    const base64Content = fileBuffer.toString("base64");
    const isPdf = mimeType === "application/pdf";

    const allJobs = await db.select({
      id: jobs.id,
      name: jobs.name,
      jobNumber: jobs.jobNumber,
    }).from(jobs)
      .where(eq(jobs.companyId, companyId))
      .limit(500);

    const jobListForAI = allJobs.map(j => `${j.jobNumber || ""} - ${j.name} (ID: ${j.id})`).join("\n");

    const systemPrompt = `You are an AI assistant that analyzes drafting-related documents in a construction/manufacturing context.

Analyze the document and extract the following. Return a JSON object:
- request_type: One of: "change_request", "drawing_update", "rfi", "approval", "revision", "new_drawing", "error_report", "other"
- impact_area: One of: "production", "drawing", "design", "scheduling", "quality", "cost", "multiple", "none"
- urgency: One of: "critical", "high", "medium", "low"
- summary: Brief summary (1-2 sentences)
- job_reference: Any job number or project name
- matched_job_id: Match to known job ID if possible, otherwise null
- panel_references: Array of panel marks/IDs
- drawing_numbers: Array of drawing numbers
- change_description: Description of changes requested
- action_required: What action is needed

Known jobs: ${jobListForAI || "None"}

Return valid JSON only.`;

    let content: any[];
    if (isPdf) {
      content = [
        { type: "file" as const, file: { filename: "drawing.pdf", file_data: `data:application/pdf;base64,${base64Content}` } },
        { type: "text" as const, text: "Analyze this drafting document for change requests, drawing updates, and job references." },
      ];
    } else {
      content = [
        { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${base64Content}` } },
        { type: "text" as const, text: "Analyze this drafting document/image for change requests, drawing updates, and job references." },
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
      logger.warn({ err: parseErr, inboundEmailId }, "[Drafting Extract] Failed to parse AI response from document");
      extractedData = { raw_response: responseText };
    }

    const fields: { inboundEmailId: string; fieldKey: string; fieldValue: string | null; confidence: string; source: string }[] = [];
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== "") {
        fields.push({
          inboundEmailId,
          fieldKey: key,
          fieldValue: typeof value === "object" ? JSON.stringify(value) : String(value),
          confidence: "0.8000",
          source: "document_extraction",
        });
      }
    }

    if (fields.length > 0) {
      await db.delete(draftingEmailExtractedFields)
        .where(eq(draftingEmailExtractedFields.inboundEmailId, inboundEmailId));

      for (const field of fields) {
        await db.insert(draftingEmailExtractedFields).values(field);
      }
    }

    const updateData: Record<string, any> = {};
    if (extractedData.request_type) updateData.requestType = extractedData.request_type;
    if (extractedData.impact_area) updateData.impactArea = extractedData.impact_area;

    if (extractedData.matched_job_id) {
      const matchedJob = allJobs.find(j => j.id === extractedData.matched_job_id);
      if (matchedJob) updateData.jobId = matchedJob.id;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(draftingInboundEmails)
        .set(updateData)
        .where(eq(draftingInboundEmails.id, inboundEmailId));
    }

    await db.update(draftingInboundEmails)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(draftingInboundEmails.id, inboundEmailId));

    await logDraftingActivity(inboundEmailId, "extraction_completed", `AI document extraction completed: ${fields.length} fields`, undefined, {
      fieldsExtracted: fields.length,
      source: "document",
    });
  } catch (error: any) {
    logger.error({ err: error, inboundEmailId }, "[Drafting Extract] Document extraction error");
    await logDraftingActivity(inboundEmailId, "extraction_failed", `Document extraction failed: ${error.message}`);
  }
}
