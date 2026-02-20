import { Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, logger, objectStorageService, getResendApiKey } from "./shared";
import {
  tenderInboundEmails, tenderInboxSettings, tenderEmailDocuments, tenderEmailActivity
} from "@shared/schema";

export async function handleTenderInboundEmail(
  res: Response,
  email_id: string,
  from: any,
  toAddresses: string[],
  subject: string | null,
  has_attachments: boolean,
  settings: typeof tenderInboxSettings.$inferSelect
) {
  logger.info({ emailId: email_id, to: toAddresses }, "[Tender Inbox] Routing inbound email to tender inbox");

  const [existingEmail] = await db.select().from(tenderInboundEmails)
    .where(eq(tenderInboundEmails.resendEmailId, email_id)).limit(1);

  if (existingEmail) {
    logger.info({ emailId: email_id }, "[Tender Inbox] Duplicate email webhook, skipping");
    return res.status(200).json({ status: "duplicate", inbox: "tender" });
  }

  const fromAddress = typeof from === "string" ? from : (from?.email || from?.address || JSON.stringify(from));

  const [inboundRecord] = await db.insert(tenderInboundEmails).values({
    companyId: settings.companyId,
    resendEmailId: email_id,
    fromAddress,
    toAddress: toAddresses[0] || null,
    subject: subject || null,
    status: "RECEIVED",
    attachmentCount: 0,
  }).returning();

  await db.insert(tenderEmailActivity).values({
    inboundEmailId: inboundRecord.id,
    activityType: "received",
    message: `Tender email received from ${fromAddress}`,
    metaJson: { subject, from: fromAddress },
  });

  processTenderInboundEmail(inboundRecord.id, email_id, settings).catch(err => {
    logger.error({ err, inboundId: inboundRecord.id }, "[Tender Inbox] Background processing failed");
  });

  return res.status(200).json({ status: "accepted", inbox: "tender", inboundId: inboundRecord.id });
}

async function processTenderInboundEmail(
  inboundId: string,
  resendEmailId: string,
  settings: typeof tenderInboxSettings.$inferSelect
) {
  try {
    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(tenderInboundEmails.id, inboundId));

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

    await db.update(tenderInboundEmails)
      .set({ attachmentCount: attachments.length })
      .where(eq(tenderInboundEmails.id, inboundId));

    if (relevantAttachments.length === 0) {
      const emailBodyText = emailDetail.text || emailDetail.html || "";
      if (emailBodyText && settings.autoExtract) {
        try {
          const { extractTenderEmailFromText } = await import("../../lib/tender-inbox-jobs");
          await extractTenderEmailFromText(inboundId, settings.companyId, emailBodyText);
          await db.update(tenderInboundEmails)
            .set({ status: "PROCESSED", processedAt: new Date() })
            .where(eq(tenderInboundEmails.id, inboundId));
          await db.insert(tenderEmailActivity).values({
            inboundEmailId: inboundId,
            activityType: "processed",
            message: "Email processed from body text (no attachments)",
            metaJson: { source: "email_body", totalAttachments: attachments.length },
          });
          logger.info({ inboundId }, "[Tender Inbox] Processed email from body text (no attachments)");
        } catch (extractErr: any) {
          logger.warn({ err: extractErr, inboundId }, "[Tender Inbox] Body text extraction failed");
          await db.update(tenderInboundEmails)
            .set({ status: "PROCESSED", processedAt: new Date() })
            .where(eq(tenderInboundEmails.id, inboundId));
        }
      } else {
        await db.update(tenderInboundEmails)
          .set({ status: "PROCESSED", processedAt: new Date() })
          .where(eq(tenderInboundEmails.id, inboundId));
      }
      await db.insert(tenderEmailActivity).values({
        inboundEmailId: inboundId,
        activityType: "processed",
        message: `Email received with ${attachments.length} attachment(s), no PDF/images found`,
        metaJson: { totalAttachments: attachments.length },
      });
      logger.info({ inboundId, totalAttachments: attachments.length }, "[Tender Inbox] No PDF/image attachments found, email still recorded");
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
            logger.error({ filename: attachment.filename }, "[Tender Inbox] Failed to download attachment");
            continue;
          }
          const arrayBuffer = await downloadRes.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        } else {
          logger.warn({ attachment: attachment.filename }, "[Tender Inbox] No content or download URL for attachment");
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

        logger.info({ inboundId, filename: attachment.filename }, "[Tender Inbox] Stored tender email attachment");

        if (settings.autoExtract && docsCreated === 1) {
          try {
            const { extractTenderEmailInline } = await import("../../lib/tender-inbox-jobs");
            await extractTenderEmailInline(inboundId, settings.companyId, fileBuffer, mimeType);
          } catch (extractErr: any) {
            logger.warn({ err: extractErr, inboundId }, "[Tender Inbox] Auto-extraction failed, will retry");
          }
        }
      } catch (attErr: any) {
        logger.error({ err: attErr, filename: attachment.filename }, "[Tender Inbox] Failed to process attachment");
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

    logger.info({ inboundId, docsCreated }, "[Tender Inbox] Email processing complete");
  } catch (error: any) {
    logger.error({ err: error, inboundId }, "[Tender Inbox] Processing error");
    await db.update(tenderInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(tenderInboundEmails.id, inboundId));
  }
}
