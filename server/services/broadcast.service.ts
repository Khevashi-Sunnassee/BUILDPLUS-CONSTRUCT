import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import { users, broadcastMessages, broadcastDeliveries, customers, suppliers, employees } from "@shared/schema";
import { twilioService } from "./twilio.service";
import { emailService } from "./email.service";
import { emailDispatchService } from "./email-dispatch.service";
import { buildBrandedEmail } from "../lib/email-template";
import logger from "../lib/logger";

interface Recipient {
  name: string | null;
  phone: string | null;
  email: string | null;
}

class BroadcastService {
  async sendBroadcast(broadcastMessageId: string): Promise<void> {
    const [message] = await db
      .select()
      .from(broadcastMessages)
      .where(eq(broadcastMessages.id, broadcastMessageId));

    if (!message) {
      logger.error({ broadcastMessageId }, "Broadcast message not found");
      return;
    }

    await db
      .update(broadcastMessages)
      .set({ status: "SENDING", updatedAt: new Date() })
      .where(eq(broadcastMessages.id, broadcastMessageId));

    const recipients = await this.resolveRecipients(message);

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      for (const rawChannel of message.channels) {
        const channel = rawChannel.toUpperCase();
        const [delivery] = await db
          .insert(broadcastDeliveries)
          .values({
            broadcastMessageId,
            recipientName: recipient.name,
            recipientPhone: recipient.phone,
            recipientEmail: recipient.email,
            channel: channel as "SMS" | "WHATSAPP" | "EMAIL",
            status: "PENDING",
          })
          .returning();

        let result: { success: boolean; messageId?: string; error?: string };

        switch (channel) {
          case "SMS":
            if (!twilioService.isConfigured()) {
              result = { success: false, error: "Channel not configured" };
            } else if (!recipient.phone) {
              result = { success: false, error: "No phone number for recipient" };
            } else {
              result = await twilioService.sendSMS(recipient.phone, message.message);
            }
            break;

          case "WHATSAPP":
            if (!twilioService.isConfigured()) {
              result = { success: false, error: "Channel not configured" };
            } else if (!recipient.phone) {
              result = { success: false, error: "No phone number for recipient" };
            } else {
              result = await twilioService.sendWhatsApp(recipient.phone, message.message);
            }
            break;

          case "EMAIL":
            if (!emailService.isConfigured()) {
              result = { success: false, error: "Channel not configured" };
            } else if (!recipient.email) {
              result = { success: false, error: "No email address for recipient" };
            } else {
              const emailHtml = await buildBrandedEmail({
                title: message.subject || "Broadcast Message",
                recipientName: recipient.name || undefined,
                body: message.message,
                companyId: message.companyId,
              });
              try {
                await emailDispatchService.enqueueBroadcastDelivery({
                  deliveryId: delivery.id,
                  broadcastMessageId: broadcastMessageId,
                  companyId: message.companyId,
                  to: recipient.email,
                  subject: message.subject || "Broadcast Message",
                  htmlBody: emailHtml,
                  channel: "EMAIL",
                });
                result = { success: true, messageId: "queued" };
              } catch (err: any) {
                result = { success: false, error: err.message || "Failed to queue email" };
              }
            }
            break;

          default:
            result = { success: false, error: `Unknown channel: ${channel}` };
        }

        if (result.success) {
          sentCount++;
          await db
            .update(broadcastDeliveries)
            .set({
              status: "SENT",
              externalMessageId: result.messageId || null,
              sentAt: new Date(),
            })
            .where(eq(broadcastDeliveries.id, delivery.id));
        } else {
          failedCount++;
          await db
            .update(broadcastDeliveries)
            .set({
              status: "FAILED",
              errorMessage: result.error || "Unknown error",
            })
            .where(eq(broadcastDeliveries.id, delivery.id));
        }
      }
    }

    const finalStatus = sentCount === 0 && failedCount > 0 ? "FAILED" : "COMPLETED";

    await db
      .update(broadcastMessages)
      .set({
        sentCount,
        failedCount,
        status: finalStatus,
        updatedAt: new Date(),
      })
      .where(eq(broadcastMessages.id, broadcastMessageId));

    logger.info(
      { broadcastMessageId, sentCount, failedCount, status: finalStatus },
      "Broadcast delivery completed"
    );
  }

  private async resolveRecipients(
    message: typeof broadcastMessages.$inferSelect
  ): Promise<Recipient[]> {
    switch (message.recipientType) {
      case "ALL_USERS": {
        const allUsers = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.isActive, true),
              eq(users.companyId, message.companyId)
            )
          );
        return allUsers.map((u) => ({
          name: u.name || null,
          phone: u.phone || null,
          email: u.email || null,
        }));
      }

      case "SPECIFIC_USERS": {
        if (!message.recipientIds || message.recipientIds.length === 0) {
          return [];
        }
        const specificUsers = await db
          .select()
          .from(users)
          .where(inArray(users.id, message.recipientIds));
        return specificUsers.map((u) => ({
          name: u.name || null,
          phone: u.phone || null,
          email: u.email || null,
        }));
      }

      case "CUSTOM_CONTACTS": {
        const custom = message.customRecipients as Recipient[] | null;
        if (!custom || !Array.isArray(custom)) {
          return [];
        }
        return custom.map((c) => ({
          name: c.name || null,
          phone: c.phone || null,
          email: c.email || null,
        }));
      }

      case "SPECIFIC_CUSTOMERS": {
        if (!message.recipientIds || message.recipientIds.length === 0) return [];
        const result = await db
          .select()
          .from(customers)
          .where(inArray(customers.id, message.recipientIds));
        return result.map((c) => ({
          name: c.keyContact ? `${c.name} (${c.keyContact})` : c.name,
          phone: c.phone || null,
          email: c.email || null,
        }));
      }

      case "SPECIFIC_SUPPLIERS": {
        if (!message.recipientIds || message.recipientIds.length === 0) return [];
        const result = await db
          .select()
          .from(suppliers)
          .where(inArray(suppliers.id, message.recipientIds));
        return result.map((s) => ({
          name: s.keyContact ? `${s.name} (${s.keyContact})` : s.name,
          phone: s.phone || null,
          email: s.email || null,
        }));
      }

      case "SPECIFIC_EMPLOYEES": {
        if (!message.recipientIds || message.recipientIds.length === 0) return [];
        const result = await db
          .select()
          .from(employees)
          .where(inArray(employees.id, message.recipientIds));
        return result.map((e) => ({
          name: `${e.firstName} ${e.lastName}`,
          phone: e.phone || null,
          email: e.email || null,
        }));
      }

      default:
        logger.warn({ recipientType: message.recipientType }, "Unknown recipient type");
        return [];
    }
  }

  async resendDelivery(deliveryId: string, companyId: string): Promise<{ success: boolean; error?: string }> {
    const [delivery] = await db
      .select()
      .from(broadcastDeliveries)
      .where(eq(broadcastDeliveries.id, deliveryId));

    if (!delivery) {
      return { success: false, error: "Delivery not found" };
    }

    if (delivery.status !== "FAILED") {
      return { success: false, error: "Only failed deliveries can be resent" };
    }

    const [message] = await db
      .select()
      .from(broadcastMessages)
      .where(and(
        eq(broadcastMessages.id, delivery.broadcastMessageId),
        eq(broadcastMessages.companyId, companyId)
      ));

    if (!message) {
      return { success: false, error: "Broadcast message not found" };
    }

    let currentPhone = delivery.recipientPhone;
    let currentEmail = delivery.recipientEmail;
    let currentName = delivery.recipientName;

    if (message.recipientType === "ALL_USERS" || message.recipientType === "SPECIFIC_USERS") {
      if (delivery.recipientEmail) {
        const [freshUser] = await db
          .select()
          .from(users)
          .where(and(
            eq(users.email, delivery.recipientEmail),
            eq(users.companyId, companyId)
          ));
        if (freshUser) {
          currentPhone = freshUser.phone || null;
          currentEmail = freshUser.email || null;
          currentName = freshUser.name || null;
        }
      }
    }

    if (currentPhone !== delivery.recipientPhone || currentEmail !== delivery.recipientEmail || currentName !== delivery.recipientName) {
      await db
        .update(broadcastDeliveries)
        .set({
          recipientPhone: currentPhone,
          recipientEmail: currentEmail,
          recipientName: currentName,
        })
        .where(eq(broadcastDeliveries.id, deliveryId));
    }

    await db
      .update(broadcastDeliveries)
      .set({ status: "PENDING", errorMessage: null })
      .where(eq(broadcastDeliveries.id, deliveryId));

    let result: { success: boolean; messageId?: string; error?: string };

    switch (delivery.channel) {
      case "SMS":
        if (!twilioService.isConfigured()) {
          result = { success: false, error: "Channel not configured" };
        } else if (!currentPhone) {
          result = { success: false, error: "No phone number for recipient" };
        } else {
          result = await twilioService.sendSMS(currentPhone, message.message);
        }
        break;

      case "WHATSAPP":
        if (!twilioService.isConfigured()) {
          result = { success: false, error: "Channel not configured" };
        } else if (!currentPhone) {
          result = { success: false, error: "No phone number for recipient" };
        } else {
          result = await twilioService.sendWhatsApp(currentPhone, message.message);
        }
        break;

      case "EMAIL":
        if (!emailService.isConfigured()) {
          result = { success: false, error: "Channel not configured" };
        } else if (!currentEmail) {
          result = { success: false, error: "No email address for recipient" };
        } else {
          const resendEmailHtml = await buildBrandedEmail({
            title: message.subject || "Broadcast Message",
            recipientName: currentName || undefined,
            body: message.message,
            companyId: message.companyId,
          });
          try {
            await emailDispatchService.enqueueBroadcastDelivery({
              deliveryId: deliveryId,
              broadcastMessageId: message.id,
              companyId: message.companyId,
              to: currentEmail,
              subject: message.subject || "Broadcast Message",
              htmlBody: resendEmailHtml,
              channel: "EMAIL",
            });
            result = { success: true, messageId: "queued" };
          } catch (err: any) {
            result = { success: false, error: err.message || "Failed to queue email" };
          }
        }
        break;

      default:
        result = { success: false, error: `Unknown channel: ${delivery.channel}` };
    }

    if (result.success) {
      await db
        .update(broadcastDeliveries)
        .set({
          status: "SENT",
          externalMessageId: result.messageId || null,
          sentAt: new Date(),
          errorMessage: null,
        })
        .where(eq(broadcastDeliveries.id, deliveryId));

      await db
        .update(broadcastMessages)
        .set({
          sentCount: message.sentCount + 1,
          failedCount: Math.max(0, message.failedCount - 1),
          status: message.failedCount - 1 <= 0 ? "COMPLETED" : message.status,
          updatedAt: new Date(),
        })
        .where(eq(broadcastMessages.id, message.id));

      return { success: true };
    } else {
      await db
        .update(broadcastDeliveries)
        .set({
          status: "FAILED",
          errorMessage: result.error || "Unknown error",
        })
        .where(eq(broadcastDeliveries.id, deliveryId));

      return { success: false, error: result.error };
    }
  }

  getChannelStatus(): { sms: boolean; whatsapp: boolean; email: boolean } {
    return {
      sms: twilioService.isConfigured(),
      whatsapp: twilioService.isConfigured(),
      email: emailService.isConfigured(),
    };
  }
}

export const broadcastService = new BroadcastService();
