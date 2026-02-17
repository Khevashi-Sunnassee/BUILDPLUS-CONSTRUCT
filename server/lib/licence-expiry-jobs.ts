import { db } from "../db";
import { employeeLicences, employees, licenceExpiryNotifications } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { emailService } from "../services/email.service";
import logger from "./logger";

const THIRTY_DAY_TYPE = "30_day_warning";
const SEVEN_DAY_TYPE = "7_day_warning";
const EXPIRED_TYPE = "expired_notice";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function buildExpiryEmailHtml(employeeName: string, licenceType: string, expiryDate: string, daysUntilExpiry: number): string {
  const formattedDate = formatDate(expiryDate);
  const isExpired = daysUntilExpiry <= 0;
  const urgencyColor = isExpired ? "#dc2626" : daysUntilExpiry <= 7 ? "#ea580c" : "#d97706";
  const urgencyText = isExpired
    ? "Your licence/ticket has expired"
    : daysUntilExpiry <= 7
    ? `Your licence/ticket expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`
    : `Your licence/ticket expires in ${daysUntilExpiry} days`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8fafc; border-radius: 8px; padding: 24px; border-left: 4px solid ${urgencyColor};">
        <h2 style="margin: 0 0 16px 0; color: #1e293b;">Licence / Ticket Expiry Notice</h2>
        <p style="color: #475569; margin: 0 0 12px 0;">Hi ${employeeName},</p>
        <p style="color: ${urgencyColor}; font-weight: 600; font-size: 16px; margin: 0 0 16px 0;">
          ${urgencyText}
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Licence/Ticket:</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${licenceType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Expiry Date:</td>
            <td style="padding: 8px 0; color: ${urgencyColor}; font-weight: 600;">${formattedDate}</td>
          </tr>
        </table>
        <p style="color: #475569; margin: 0 0 8px 0;">
          ${isExpired
            ? "Please arrange renewal as soon as possible and update your details with the office."
            : "Please arrange renewal before the expiry date and update your details with the office."}
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">
          This is an automated notification from BuildPlus AI Management System.
        </p>
      </div>
    </div>
  `;
}

export async function checkLicenceExpiriesJob(): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDayStr = thirtyDaysFromNow.toISOString().split("T")[0];

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const expiringLicences = await db
      .select({
        licence: employeeLicences,
        employee: employees,
      })
      .from(employeeLicences)
      .innerJoin(employees, eq(employeeLicences.employeeId, employees.id))
      .where(
        and(
          lte(employeeLicences.expiryDate, thirtyDayStr),
          gte(employeeLicences.expiryDate, thirtyDaysAgoStr),
          eq(employees.isActive, true)
        )
      )
      .limit(500);

    if (expiringLicences.length === 0) {
      logger.debug("[LicenceExpiry] No expiring licences found");
      return;
    }

    logger.info({ count: expiringLicences.length }, "[LicenceExpiry] Found licences to check for notifications");

    let sentCount = 0;
    const maxEmailsPerRun = 20;

    for (const { licence, employee } of expiringLicences) {
      if (sentCount >= maxEmailsPerRun) break;

      if (!licence.expiryDate) continue;

      const employeeEmail = employee.email;
      if (!employeeEmail) {
        logger.debug({ employeeId: employee.id, licenceId: licence.id }, "[LicenceExpiry] Employee has no email, skipping");
        continue;
      }

      const expiryDate = new Date(licence.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let notificationType: string | null = null;
      if (daysUntilExpiry <= 0) {
        notificationType = EXPIRED_TYPE;
      } else if (daysUntilExpiry <= 7) {
        notificationType = SEVEN_DAY_TYPE;
      } else if (daysUntilExpiry <= 30) {
        notificationType = THIRTY_DAY_TYPE;
      }

      if (!notificationType) continue;

      const existingNotification = await db
        .select({ id: licenceExpiryNotifications.id })
        .from(licenceExpiryNotifications)
        .where(
          and(
            eq(licenceExpiryNotifications.licenceId, licence.id),
            eq(licenceExpiryNotifications.notificationType, notificationType),
            eq(licenceExpiryNotifications.status, "sent")
          )
        )
        .limit(1);

      if (existingNotification.length > 0) {
        continue;
      }

      const employeeName = employee.preferredName || employee.firstName;
      const subject = daysUntilExpiry <= 0
        ? `EXPIRED: Your ${licence.licenceType} has expired`
        : `Reminder: Your ${licence.licenceType} expires ${daysUntilExpiry <= 7 ? "soon" : `in ${daysUntilExpiry} days`}`;

      const html = buildExpiryEmailHtml(employeeName, licence.licenceType, licence.expiryDate, daysUntilExpiry);

      let status = "sent";
      let errorMessage: string | null = null;

      if (emailService.isConfigured()) {
        const result = await emailService.sendEmail(employeeEmail, subject, html);
        if (!result.success) {
          status = "failed";
          errorMessage = result.error || "Unknown error";
          logger.warn({ licenceId: licence.id, employeeId: employee.id, error: errorMessage }, "[LicenceExpiry] Failed to send notification");
        } else {
          logger.info({ licenceId: licence.id, employeeId: employee.id, type: notificationType }, "[LicenceExpiry] Notification sent");
        }
      } else {
        status = "skipped";
        errorMessage = "Email service not configured";
        logger.debug("[LicenceExpiry] Email service not configured, recording notification as skipped");
      }

      await db.insert(licenceExpiryNotifications).values({
        licenceId: licence.id,
        employeeId: employee.id,
        companyId: licence.companyId,
        notificationType,
        emailTo: employeeEmail,
        status,
        errorMessage,
      });

      sentCount++;
    }

    if (sentCount > 0) {
      logger.info({ sentCount }, "[LicenceExpiry] Licence expiry notifications processed");
    }
  } catch (error) {
    logger.error({ err: error }, "[LicenceExpiry] Error in licence expiry check job");
    throw error;
  }
}
