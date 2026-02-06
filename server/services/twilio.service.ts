import Twilio from "twilio";
import logger from "../lib/logger";

function formatAustralianPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "+61" + cleaned.slice(1);
  } else if (cleaned.startsWith("61") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+61" + cleaned;
  }
  return cleaned;
}

class TwilioService {
  private client: ReturnType<typeof Twilio> | null = null;
  private phoneNumber: string | undefined;
  private whatsappNumber: string | undefined;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (accountSid && authToken) {
      try {
        this.client = Twilio(accountSid, authToken);
        logger.info("Twilio client initialized successfully");
      } catch (err) {
        logger.warn({ err }, "Failed to initialize Twilio client");
        this.client = null;
      }
    } else {
      logger.info("Twilio credentials not configured — SMS/WhatsApp disabled");
    }
  }

  isConfigured(): boolean {
    return this.client !== null && !!this.phoneNumber;
  }

  async sendSMS(
    to: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || !this.phoneNumber) {
      return { success: false, error: "Twilio SMS is not configured" };
    }

    try {
      const formattedTo = formatAustralianPhone(to);
      const message = await this.client.messages.create({
        to: formattedTo,
        from: this.phoneNumber,
        body,
      });
      logger.info({ messageId: message.sid, to: formattedTo }, "SMS sent successfully");
      return { success: true, messageId: message.sid };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Twilio SMS error";
      logger.error({ err, to }, "Failed to send SMS");
      return { success: false, error: errorMessage };
    }
  }

  async sendWhatsApp(
    to: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || !this.whatsappNumber) {
      return { success: false, error: "Twilio WhatsApp is not configured" };
    }

    try {
      const formattedTo = formatAustralianPhone(to.replace(/^whatsapp:/, ""));
      const whatsappTo = `whatsapp:${formattedTo}`;
      const whatsappFrom = this.whatsappNumber.startsWith("whatsapp:")
        ? this.whatsappNumber
        : `whatsapp:${this.whatsappNumber}`;

      const message = await this.client.messages.create({
        to: whatsappTo,
        from: whatsappFrom,
        body,
      });
      logger.info({ messageId: message.sid, to: whatsappTo }, "WhatsApp message sent successfully");
      return { success: true, messageId: message.sid };
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown Twilio WhatsApp error";
      logger.error({ err, to }, "Failed to send WhatsApp message");
      return { success: false, error: errorMessage };
    }
  }
}

export const twilioService = new TwilioService();
