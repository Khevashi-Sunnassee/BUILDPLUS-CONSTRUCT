import Mailgun from "mailgun.js";
import FormData from "form-data";
import logger from "../lib/logger";

class EmailService {
  private mg: ReturnType<InstanceType<typeof Mailgun>["client"]> | null = null;
  private domain: string | undefined;
  private fromAddress: string | undefined;

  constructor() {
    const apiKey = process.env.MAILGUN_API_KEY;
    this.domain = process.env.MAILGUN_DOMAIN;
    this.fromAddress = process.env.MAILGUN_FROM;

    if (apiKey && this.domain) {
      try {
        const mailgun = new Mailgun(FormData);
        this.mg = mailgun.client({
          username: "api",
          key: apiKey,
        });

        if (!this.fromAddress) {
          this.fromAddress = `LTE System <noreply@${this.domain}>`;
        }

        logger.info("Mailgun email client initialized successfully");
      } catch (err) {
        logger.warn({ err }, "Failed to initialize Mailgun client");
        this.mg = null;
      }
    } else {
      logger.info("Mailgun credentials not configured — email disabled");
    }
  }

  isConfigured(): boolean {
    return this.mg !== null && !!this.domain;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.mg || !this.domain) {
      return { success: false, error: "Email service is not configured" };
    }

    try {
      const textBody = body.replace(/<[^>]*>/g, "");

      const result = await this.mg.messages.create(this.domain, {
        from: this.fromAddress || `noreply@${this.domain}`,
        to: [to],
        subject,
        text: textBody,
        html: body,
      });

      const messageId = result.id || result.message;
      logger.info({ messageId, to }, "Email sent successfully via Mailgun");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown email error";
      logger.error({ err, to }, "Failed to send email via Mailgun");
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
    if (!this.mg || !this.domain) {
      return { success: false, error: "Email service is not configured" };
    }

    try {
      const textBody = options.body.replace(/<[^>]*>/g, "");

      const messageData: any = {
        from: this.fromAddress || `noreply@${this.domain}`,
        to: [options.to],
        subject: options.subject,
        text: textBody,
        html: options.body,
      };

      if (options.cc) messageData.cc = [options.cc];
      if (options.bcc) messageData.bcc = [options.bcc];
      if (options.replyTo) messageData["h:Reply-To"] = options.replyTo;

      if (options.attachments && options.attachments.length > 0) {
        messageData.attachment = options.attachments.map((att) => ({
          filename: att.filename,
          data: att.content,
        }));
      }

      const result = await this.mg.messages.create(this.domain, messageData);
      const messageId = result.id || result.message;
      logger.info({ messageId, to: options.to }, "Email with attachment sent successfully via Mailgun");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown email error";
      logger.error({ err, to: options.to }, "Failed to send email with attachment via Mailgun");
      return { success: false, error: errorMessage };
    }
  }
}

export const emailService = new EmailService();
