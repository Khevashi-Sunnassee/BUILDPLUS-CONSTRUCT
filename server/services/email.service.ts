import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import logger from "../lib/logger";

class EmailService {
  private transporter: Transporter | null = null;
  private fromAddress: string | undefined;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.fromAddress = process.env.SMTP_FROM;

    if (host && port && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port: parseInt(port, 10),
          secure: parseInt(port, 10) === 465,
          auth: { user, pass },
        });
        logger.info("Email transporter initialized successfully");
      } catch (err) {
        logger.warn({ err }, "Failed to initialize email transporter");
        this.transporter = null;
      }
    } else {
      logger.info("SMTP credentials not configured — email disabled");
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null && !!this.fromAddress;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter || !this.fromAddress) {
      return { success: false, error: "Email service is not configured" };
    }

    try {
      const textBody = body.replace(/<[^>]*>/g, "");

      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text: textBody,
        html: body,
      });

      const messageId = info.messageId || info.response;
      logger.info({ messageId, to }, "Email sent successfully");
      return { success: true, messageId };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown email error";
      logger.error({ err, to }, "Failed to send email");
      return { success: false, error: errorMessage };
    }
  }
}

export const emailService = new EmailService();
