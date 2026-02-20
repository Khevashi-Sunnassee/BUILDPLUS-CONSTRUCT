import { Resend } from "resend";
import logger from "../lib/logger";
import { resendBreaker } from "../lib/circuit-breaker";
import { resendRateLimiter } from "../lib/rate-limiter";

let connectionSettings: any;
let cachedCredentials: { apiKey: string; fromEmail: string; cachedAt: number } | null = null;
let cachedClient: { client: Resend; apiKey: string } | null = null;
const CREDENTIAL_CACHE_TTL = 5 * 60 * 1000;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  if (cachedCredentials && (Date.now() - cachedCredentials.cachedAt) < CREDENTIAL_CACHE_TTL) {
    return { apiKey: cachedCredentials.apiKey, fromEmail: cachedCredentials.fromEmail };
  }

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

  const creds = {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email || "noreply@send.lfrmanagement.com.au",
  };

  cachedCredentials = { ...creds, cachedAt: Date.now() };
  return creds;
}

async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const { apiKey, fromEmail } = await getCredentials();

  if (cachedClient && cachedClient.apiKey === apiKey) {
    return { client: cachedClient.client, fromEmail };
  }

  const client = new Resend(apiKey);
  cachedClient = { client, apiKey };
  return { client, fromEmail };
}

function isRetryableError(err: any): boolean {
  const statusCode = err?.statusCode || err?.status;
  if (statusCode === 429) return true;
  if (statusCode >= 500) return true;
  if (err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED") return true;
  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("rate limit") || msg.includes("too many requests")) return true;
  if (msg.includes("timeout") || msg.includes("network")) return true;
  return false;
}

function isRateLimitError(err: any): boolean {
  const statusCode = err?.statusCode || err?.status;
  if (statusCode === 429) return true;
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("too many requests");
}

class EmailService {
  isConfigured(): boolean {
    return !!process.env.REPLIT_CONNECTORS_HOSTNAME;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; retryable?: boolean }> {
    return this.sendEmailWithAttachment({ to, subject, body });
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
    fromEmail?: string;
    fromName?: string;
    skipRateLimit?: boolean;
  }): Promise<{ success: boolean; messageId?: string; error?: string; retryable?: boolean }> {
    type EmailResult = { success: boolean; messageId?: string; error?: string; retryable?: boolean };
    try {
      return await resendBreaker.execute<EmailResult>(async () => {
        if (!options.skipRateLimit) {
          await resendRateLimiter.acquire();
        }

        const { client, fromEmail: defaultFromEmail } = await getResendClient();

        const resendAttachments = options.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
        }));

        let fromAddress: string;
        if (options.fromEmail) {
          fromAddress = options.fromName
            ? `${options.fromName} <${options.fromEmail}>`
            : options.fromEmail;
        } else {
          fromAddress = defaultFromEmail;
        }

        const sendOptions: any = {
          from: fromAddress,
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
          const retryable = isRetryableError(result.error);
          logger.error({ err: result.error, to: options.to, retryable }, "Failed to send email via Resend");
          const error: any = new Error(result.error.message);
          error.statusCode = (result.error as any).statusCode;
          throw error;
        }

        const messageId = result.data?.id || undefined;
        logger.info({ messageId, to: options.to }, "Email sent successfully via Resend");
        return { success: true, messageId };
      }, () => ({ success: false, error: "Resend circuit breaker open — email service temporarily unavailable", retryable: true }));
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Resend error";
      const retryable = isRetryableError(err);
      logger.error({ err, to: options.to, retryable }, "Failed to send email via Resend");
      return { success: false, error: errorMessage, retryable };
    }
  }
}

export const emailService = new EmailService();

export async function getResendApiKey(): Promise<string> {
  const { apiKey } = await getCredentials();
  return apiKey;
}

export { isRetryableError, isRateLimitError };
