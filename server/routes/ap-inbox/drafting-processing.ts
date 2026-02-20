import { Response } from "express";
import { eq } from "drizzle-orm";
import { db, logger, getResendApiKey } from "./shared";
import {
  draftingInboundEmails, draftingInboxSettings, draftingEmailActivity
} from "@shared/schema";

export async function handleDraftingInboundEmail(
  res: Response,
  email_id: string,
  from: any,
  toAddresses: string[],
  subject: string | null,
  has_attachments: boolean,
  settings: typeof draftingInboxSettings.$inferSelect
) {
  logger.info({ emailId: email_id, to: toAddresses }, "[Drafting Inbox] Routing inbound email to drafting inbox");

  const [existingEmail] = await db.select().from(draftingInboundEmails)
    .where(eq(draftingInboundEmails.resendEmailId, email_id)).limit(1);

  if (existingEmail) {
    logger.info({ emailId: email_id }, "[Drafting Inbox] Duplicate email webhook, skipping");
    return res.status(200).json({ status: "duplicate", inbox: "drafting" });
  }

  const fromAddress = typeof from === "string" ? from : (from?.email || from?.address || JSON.stringify(from));

  const [inboundRecord] = await db.insert(draftingInboundEmails).values({
    companyId: settings.companyId,
    resendEmailId: email_id,
    fromAddress,
    toAddress: toAddresses[0] || null,
    subject: subject || null,
    status: "RECEIVED",
    attachmentCount: 0,
  }).returning();

  await db.insert(draftingEmailActivity).values({
    inboundEmailId: inboundRecord.id,
    activityType: "received",
    message: `Drafting email received from ${fromAddress}`,
    metaJson: { subject, from: fromAddress },
  });

  processDraftingInboundEmailWebhook(inboundRecord.id, email_id, settings).catch(err => {
    logger.error({ err, inboundId: inboundRecord.id }, "[Drafting Inbox] Background processing failed");
  });

  return res.status(200).json({ status: "accepted", inbox: "drafting", inboundId: inboundRecord.id });
}

async function processDraftingInboundEmailWebhook(
  inboundId: string,
  resendEmailId: string,
  settings: typeof draftingInboxSettings.$inferSelect
) {
  try {
    const { processDraftingEmailFromPoll: processFromPoll } = await import("../../lib/drafting-inbox-jobs");
    const apiKey = await getResendApiKey();
    await processFromPoll(inboundId, resendEmailId, settings, apiKey);
  } catch (error: any) {
    logger.error({ err: error, inboundId }, "[Drafting Inbox] Webhook processing error");
    await db.update(draftingInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(draftingInboundEmails.id, inboundId));
  }
}
