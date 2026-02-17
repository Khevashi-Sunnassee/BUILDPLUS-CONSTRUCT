import { db } from "../db";
import { jobs, customers, opportunitySubmissionReminders } from "@shared/schema";
import { eq, and, gte, lte, isNotNull, notInArray, inArray } from "drizzle-orm";

import { emailService } from "../services/email.service";
import logger from "./logger";

const SEVEN_DAY_REMINDER = "7_day_submission_reminder";

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSubmissionReminderHtml(
  contactName: string,
  projectName: string,
  submissionDate: Date,
  daysUntilSubmission: number,
  customerName: string | null,
): string {
  const formattedDate = formatDateTime(submissionDate);
  const urgencyColor = daysUntilSubmission <= 2 ? "#dc2626" : daysUntilSubmission <= 4 ? "#ea580c" : "#d97706";
  const urgencyText = daysUntilSubmission <= 0
    ? "The submission deadline has passed"
    : daysUntilSubmission === 1
    ? "The submission deadline is tomorrow"
    : `The submission deadline is in ${daysUntilSubmission} days`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8fafc; border-radius: 8px; padding: 24px; border-left: 4px solid ${urgencyColor};">
        <h2 style="margin: 0 0 16px 0; color: #1e293b;">Opportunity Submission Reminder</h2>
        <p style="color: #475569; margin: 0 0 12px 0;">Hi ${contactName},</p>
        <p style="color: ${urgencyColor}; font-weight: 600; font-size: 16px; margin: 0 0 16px 0;">
          ${urgencyText}
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Project:</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${projectName}</td>
          </tr>
          ${customerName ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Customer:</td>
            <td style="padding: 8px 0; color: #1e293b;">${customerName}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Submission Due:</td>
            <td style="padding: 8px 0; color: ${urgencyColor}; font-weight: 600;">${formattedDate}</td>
          </tr>
        </table>
        <p style="color: #475569; margin: 0 0 8px 0;">
          ${daysUntilSubmission <= 0
            ? "The submission deadline for this opportunity has passed. Please update the opportunity status if you have not yet done so."
            : "Please ensure your submission is prepared and submitted before the deadline. If this opportunity has already been actioned, please update the status."}
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">
          This is an automated notification from BuildPlus AI Management System.
        </p>
      </div>
    </div>
  `;
}

export async function checkOpportunitySubmissionRemindersJob(): Promise<void> {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const opportunitiesNearDeadline = await db
      .select({
        job: jobs,
        customer: customers,
      })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(
        and(
          isNotNull(jobs.submissionDate),
          lte(jobs.submissionDate, sevenDaysFromNow),
          gte(jobs.submissionDate, now),
          inArray(jobs.jobPhase, [0, 1, 4]),
          notInArray(
            jobs.salesStage,
            ["AWARDED", "LOST"] as const
          )
        )
      )
      .limit(500);

    if (opportunitiesNearDeadline.length === 0) {
      logger.debug("[OpportunityReminder] No opportunities near submission deadline");
      return;
    }

    logger.info({ count: opportunitiesNearDeadline.length }, "[OpportunityReminder] Found opportunities near submission deadline");

    let sentCount = 0;
    const maxEmailsPerRun = 20;

    for (const { job, customer } of opportunitiesNearDeadline) {
      if (sentCount >= maxEmailsPerRun) break;

      if (!job.submissionDate) continue;

      const recipientEmail = customer?.email || null;
      if (!recipientEmail) {
        logger.debug({ jobId: job.id }, "[OpportunityReminder] No customer email found, skipping");
        continue;
      }

      const submissionDate = new Date(job.submissionDate);
      const daysUntilSubmission = Math.ceil((submissionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const existingReminder = await db
        .select({ id: opportunitySubmissionReminders.id })
        .from(opportunitySubmissionReminders)
        .where(
          and(
            eq(opportunitySubmissionReminders.jobId, job.id),
            eq(opportunitySubmissionReminders.notificationType, SEVEN_DAY_REMINDER),
            eq(opportunitySubmissionReminders.status, "sent")
          )
        )
        .limit(1);

      if (existingReminder.length > 0) {
        continue;
      }

      const contactName = customer?.keyContact || customer?.name || job.primaryContact || "Team";
      const subject = daysUntilSubmission <= 0
        ? `OVERDUE: Submission deadline passed for ${job.name}`
        : daysUntilSubmission <= 2
        ? `URGENT: Submission due in ${daysUntilSubmission} day${daysUntilSubmission === 1 ? "" : "s"} - ${job.name}`
        : `Reminder: Submission due in ${daysUntilSubmission} days - ${job.name}`;

      const html = buildSubmissionReminderHtml(
        contactName,
        job.name,
        submissionDate,
        daysUntilSubmission,
        customer?.name || null,
      );

      let status = "sent";
      let errorMessage: string | null = null;

      if (emailService.isConfigured()) {
        const result = await emailService.sendEmail(recipientEmail, subject, html);
        if (!result.success) {
          status = "failed";
          errorMessage = result.error || "Unknown error";
          logger.warn({ jobId: job.id, error: errorMessage }, "[OpportunityReminder] Failed to send reminder");
        } else {
          logger.info({ jobId: job.id, type: SEVEN_DAY_REMINDER }, "[OpportunityReminder] Reminder sent");
        }
      } else {
        status = "skipped";
        errorMessage = "Email service not configured";
        logger.debug("[OpportunityReminder] Email service not configured, recording as skipped");
      }

      await db.insert(opportunitySubmissionReminders).values({
        jobId: job.id,
        companyId: job.companyId,
        notificationType: SEVEN_DAY_REMINDER,
        emailTo: recipientEmail,
        status,
        errorMessage,
      });

      sentCount++;
    }

    if (sentCount > 0) {
      logger.info({ sentCount }, "[OpportunityReminder] Submission reminders processed");
    }
  } catch (error) {
    logger.error({ err: error }, "[OpportunityReminder] Error in submission reminder check job");
    throw error;
  }
}
