// Resend integration via Replit Resend connector
import { Resend } from "resend";
import logger from "../lib/logger";

let connectionSettings: any;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    throw new Error("Resend not connected");
  }

  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email || "noreply@send.lfrmanagement.com.au",
  };
}

async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

class EmailService {
  isConfigured(): boolean {
    return !!process.env.REPLIT_CONNECTORS_HOSTNAME;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { client, fromEmail } = await getResendClient();

      const result = await client.emails.send({
        from: fromEmail,
        to: to.split(",").map((e) => e.trim()),
        subject,
        html: body,
      });

      if (result.error) {
        logger.error({ err: result.error, to }, "Failed to send email via Resend");
        return { success: false, error: result.error.message };
      }

      const messageId = result.data?.id || undefined;
      logger.info({ messageId, to }, "Email sent successfully via Resend");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Resend error";
      logger.error({ err, to }, "Failed to send email via Resend");
      return { success: false, error: errorMessage };
    }
  }

  async sendEmailWithAttachment(options: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { client, fromEmail } = await getResendClient();

      const resendAttachments = options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        content_type: att.contentType,
      }));

      const sendOptions: any = {
        from: fromEmail,
        to: options.to.split(",").map((e) => e.trim()),
        subject: options.subject,
        html: options.body,
      };

      if (options.cc) {
        sendOptions.cc = options.cc.split(",").map((e) => e.trim());
      }
      if (options.bcc) {
        sendOptions.bcc = options.bcc.split(",").map((e) => e.trim());
      }
      if (options.replyTo) {
        sendOptions.reply_to = options.replyTo;
      }
      if (resendAttachments && resendAttachments.length > 0) {
        sendOptions.attachments = resendAttachments;
      }

      const result = await client.emails.send(sendOptions);

      if (result.error) {
        logger.error({ err: result.error, to: options.to }, "Failed to send email with attachment via Resend");
        return { success: false, error: result.error.message };
      }

      const messageId = result.data?.id || undefined;
      logger.info({ messageId, to: options.to }, "Email with attachment sent successfully via Resend");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Resend error";
      logger.error({ err, to: options.to }, "Failed to send email with attachment via Resend");
      return { success: false, error: errorMessage };
    }
  }
}

export const emailService = new EmailService();
