// Gmail integration via Replit Gmail connector
import { google } from "googleapis";
import logger from "../lib/logger";

let connectionSettings: any;

async function getAccessToken() {
  connectionSettings = null;

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
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=google-mail",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("Gmail not connected");
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function buildMimeMessage(options: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}): string {
  const boundary = "boundary_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const hasAttachments = options.attachments && options.attachments.length > 0;

  let headers = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `MIME-Version: 1.0`,
  ];
  if (options.cc) headers.push(`Cc: ${options.cc}`);
  if (options.bcc) headers.push(`Bcc: ${options.bcc}`);
  if (options.replyTo) headers.push(`Reply-To: ${options.replyTo}`);

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const altBoundary = "alt_" + boundary;
    let body = headers.join("\r\n") + "\r\n\r\n";
    body += `--${boundary}\r\n`;
    body += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    body += `--${altBoundary}\r\n`;
    body += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    body += options.textBody + "\r\n\r\n";
    body += `--${altBoundary}\r\n`;
    body += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    body += options.htmlBody + "\r\n\r\n";
    body += `--${altBoundary}--\r\n`;

    for (const att of options.attachments!) {
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
      body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n\r\n`;
      body += att.content.toString("base64") + "\r\n";
    }
    body += `--${boundary}--`;
    return body;
  } else {
    const altBoundary = "alt_" + boundary;
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

    let body = headers.join("\r\n") + "\r\n\r\n";
    body += `--${altBoundary}\r\n`;
    body += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    body += options.textBody + "\r\n\r\n";
    body += `--${altBoundary}\r\n`;
    body += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    body += options.htmlBody + "\r\n\r\n";
    body += `--${altBoundary}--`;
    return body;
  }
}

function toBase64Url(str: string): string {
  return Buffer.from(str).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
      const gmail = await getGmailClient();
      const textBody = body.replace(/<[^>]*>/g, "");

      const raw = toBase64Url(
        buildMimeMessage({ to, subject, textBody, htmlBody: body })
      );

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });

      const messageId = result.data.id || undefined;
      logger.info({ messageId, to }, "Email sent successfully via Gmail");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Gmail error";
      logger.error({ err, to }, "Failed to send email via Gmail");
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
      const gmail = await getGmailClient();
      const textBody = options.body.replace(/<[^>]*>/g, "");

      const raw = toBase64Url(
        buildMimeMessage({
          to: options.to,
          cc: options.cc,
          bcc: options.bcc,
          subject: options.subject,
          textBody,
          htmlBody: options.body,
          replyTo: options.replyTo,
          attachments: options.attachments,
        })
      );

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });

      const messageId = result.data.id || undefined;
      logger.info({ messageId, to: options.to }, "Email with attachment sent successfully via Gmail");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Gmail error";
      logger.error({ err, to: options.to }, "Failed to send email with attachment via Gmail");
      return { success: false, error: errorMessage };
    }
  }
}

export const emailService = new EmailService();
