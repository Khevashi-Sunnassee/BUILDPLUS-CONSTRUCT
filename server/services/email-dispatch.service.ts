import { db } from "../db";
import { mailRegister, emailSendLogs, broadcastDeliveries, broadcastMessages } from "@shared/schema";
import { eq, and, or, sql, lt, inArray } from "drizzle-orm";
import { emailService, isRetryableError } from "./email.service";
import { emailQueue } from "../lib/job-queue";
import { buildBrandedEmail } from "../lib/email-template";
import logger from "../lib/logger";

interface EmailJobPayload {
  type: "mail_register" | "broadcast_delivery" | "direct";
  referenceId: string;
  companyId: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
  attempt: number;
  maxAttempts: number;
  userId?: string;
}

const companyDailyCountCache = new Map<string, { count: number; resetAt: number }>();

const DAILY_QUOTA_PER_COMPANY = 5000;
const HOURLY_BURST_LIMIT = 500;

class EmailDispatchService {
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    emailQueue.register<EmailJobPayload>("send-email", async (payload) => {
      await this.processEmailJob(payload);
    });

    logger.info("[EmailDispatch] Email dispatch service initialized with queue handler");
  }

  async enqueueMailRegister(params: {
    mailRegisterId: string;
    companyId: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    htmlBody: string;
    userId: string;
  }): Promise<string> {
    const quotaCheck = await this.checkCompanyQuota(params.companyId);
    if (!quotaCheck.allowed) {
      logger.warn({ companyId: params.companyId, dailyCount: quotaCheck.count }, "[EmailDispatch] Company daily email quota exceeded");
      await db.update(mailRegister)
        .set({ status: "FAILED", lastError: `Daily email quota exceeded (${DAILY_QUOTA_PER_COMPANY} emails/day)`, updatedAt: new Date() })
        .where(eq(mailRegister.id, params.mailRegisterId));
      throw new Error(`Daily email quota exceeded for company`);
    }

    const payload: EmailJobPayload = {
      type: "mail_register",
      referenceId: params.mailRegisterId,
      companyId: params.companyId,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      htmlBody: params.htmlBody,
      attempt: 1,
      maxAttempts: 3,
      userId: params.userId,
    };

    try {
      const jobId = emailQueue.enqueue("send-email", payload, 5);
      logger.info({ jobId, mailRegisterId: params.mailRegisterId, to: params.to }, "[EmailDispatch] Mail register email enqueued");
      return jobId;
    } catch (err: any) {
      await db.update(mailRegister)
        .set({ status: "FAILED", lastError: err.message || "Queue full", updatedAt: new Date() })
        .where(eq(mailRegister.id, params.mailRegisterId));
      throw err;
    }
  }

  async enqueueBroadcastDelivery(params: {
    deliveryId: string;
    broadcastMessageId: string;
    companyId: string;
    to: string;
    subject: string;
    htmlBody: string;
    channel: string;
  }): Promise<string> {
    const payload: EmailJobPayload = {
      type: "broadcast_delivery",
      referenceId: params.deliveryId,
      companyId: params.companyId,
      to: params.to,
      subject: params.subject,
      htmlBody: params.htmlBody,
      attempt: 1,
      maxAttempts: 3,
    };

    try {
      const jobId = emailQueue.enqueue("send-email", payload, 1);
      return jobId;
    } catch (err: any) {
      await db.update(broadcastDeliveries)
        .set({ status: "FAILED", errorMessage: err.message || "Queue full", updatedAt: new Date() })
        .where(eq(broadcastDeliveries.id, params.deliveryId));
      throw err;
    }
  }

  async enqueueDirectEmail(params: {
    companyId: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    htmlBody: string;
    replyTo?: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
    userId?: string;
    logToDb?: boolean;
  }): Promise<{ jobId: string }> {
    const serializedAttachments = params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      contentType: a.contentType,
    }));

    const payload: EmailJobPayload = {
      type: "direct",
      referenceId: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      companyId: params.companyId,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      htmlBody: params.htmlBody,
      replyTo: params.replyTo,
      attachments: serializedAttachments,
      attempt: 1,
      maxAttempts: 3,
      userId: params.userId,
    };

    const jobId = emailQueue.enqueue("send-email", payload, 3);
    return { jobId };
  }

  private async processEmailJob(payload: EmailJobPayload): Promise<void> {
    const startTime = Date.now();

    const attachments = payload.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.contentType,
    }));

    const result = await emailService.sendEmailWithAttachment({
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      body: payload.htmlBody,
      replyTo: payload.replyTo,
      attachments,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.incrementCompanyCount(payload.companyId);

      if (payload.type === "mail_register") {
        await db.update(mailRegister)
          .set({
            status: "SENT",
            messageId: result.messageId || null,
            sentAt: new Date(),
            lastError: null,
            retryCount: payload.attempt - 1,
            updatedAt: new Date(),
          })
          .where(eq(mailRegister.id, payload.referenceId));
      } else if (payload.type === "broadcast_delivery") {
        await db.update(broadcastDeliveries)
          .set({
            status: "SENT",
            externalMessageId: result.messageId || null,
            sentAt: new Date(),
          })
          .where(eq(broadcastDeliveries.id, payload.referenceId));
      }

      logger.info({
        type: payload.type,
        referenceId: payload.referenceId,
        to: payload.to,
        durationMs,
        messageId: result.messageId,
      }, "[EmailDispatch] Email sent successfully");
    } else {
      const errorMsg = result.error || "Unknown error";

      if (result.retryable && payload.attempt < payload.maxAttempts) {
        logger.warn({
          type: payload.type,
          referenceId: payload.referenceId,
          attempt: payload.attempt,
          maxAttempts: payload.maxAttempts,
          error: errorMsg,
        }, "[EmailDispatch] Email send failed — will retry via queue");

        if (payload.type === "mail_register") {
          await db.update(mailRegister)
            .set({
              retryCount: payload.attempt,
              lastRetryAt: new Date(),
              lastError: errorMsg,
              updatedAt: new Date(),
            })
            .where(eq(mailRegister.id, payload.referenceId));
        }

        throw new Error(errorMsg);
      }

      if (payload.type === "mail_register") {
        await db.update(mailRegister)
          .set({
            status: "FAILED",
            lastError: errorMsg,
            retryCount: payload.attempt,
            lastRetryAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(mailRegister.id, payload.referenceId));
      } else if (payload.type === "broadcast_delivery") {
        await db.update(broadcastDeliveries)
          .set({
            status: "FAILED",
            errorMessage: errorMsg,
          })
          .where(eq(broadcastDeliveries.id, payload.referenceId));
      }

      logger.error({
        type: payload.type,
        referenceId: payload.referenceId,
        attempt: payload.attempt,
        error: errorMsg,
        retryable: result.retryable,
      }, "[EmailDispatch] Email permanently failed");
    }
  }

  async retryFailedEmails(): Promise<{ retried: number; errors: number }> {
    const failedEntries = await db
      .select({
        id: mailRegister.id,
        companyId: mailRegister.companyId,
        mailNumber: mailRegister.mailNumber,
        toAddresses: mailRegister.toAddresses,
        ccAddresses: mailRegister.ccAddresses,
        subject: mailRegister.subject,
        htmlBody: mailRegister.htmlBody,
        retryCount: mailRegister.retryCount,
        maxRetries: mailRegister.maxRetries,
        lastRetryAt: mailRegister.lastRetryAt,
      })
      .from(mailRegister)
      .where(
        and(
          or(
            eq(mailRegister.status, "QUEUED"),
            eq(mailRegister.status, "FAILED")
          ),
          sql`${mailRegister.retryCount} < ${mailRegister.maxRetries}`,
          or(
            sql`${mailRegister.lastRetryAt} IS NULL`,
            sql`${mailRegister.lastRetryAt} < NOW() - INTERVAL '2 minutes' * POWER(2, ${mailRegister.retryCount})`
          )
        )
      )
      .limit(50);

    let retried = 0;
    let errors = 0;

    for (const entry of failedEntries) {
      try {
        await db.update(mailRegister)
          .set({ status: "QUEUED", updatedAt: new Date() })
          .where(eq(mailRegister.id, entry.id));

        const payload: EmailJobPayload = {
          type: "mail_register",
          referenceId: entry.id,
          companyId: entry.companyId,
          to: entry.toAddresses,
          cc: entry.ccAddresses || undefined,
          subject: `[${entry.mailNumber}] ${entry.subject}`,
          htmlBody: entry.htmlBody,
          attempt: (entry.retryCount || 0) + 1,
          maxAttempts: entry.maxRetries || 3,
        };

        emailQueue.enqueue("send-email", payload, 2);
        retried++;
      } catch (err) {
        errors++;
        logger.error({ err, entryId: entry.id }, "[EmailDispatch] Failed to re-enqueue email");
      }
    }

    if (retried > 0) {
      logger.info({ retried, errors }, "[EmailDispatch] Retry sweep completed");
    }

    return { retried, errors };
  }

  private async checkCompanyQuota(companyId: string): Promise<{ allowed: boolean; count: number }> {
    const cached = companyDailyCountCache.get(companyId);
    const now = Date.now();

    if (cached && cached.resetAt > now) {
      return { allowed: cached.count < DAILY_QUOTA_PER_COMPANY, count: cached.count };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mailRegister)
      .where(
        and(
          eq(mailRegister.companyId, companyId),
          sql`${mailRegister.sentAt} >= ${todayStart}`,
          inArray(mailRegister.status, ["SENT", "QUEUED", "DELIVERED"])
        )
      )
      .limit(1);

    const count = result?.count || 0;
    const nextMidnight = new Date(todayStart);
    nextMidnight.setDate(nextMidnight.getDate() + 1);

    companyDailyCountCache.set(companyId, { count, resetAt: nextMidnight.getTime() });

    return { allowed: count < DAILY_QUOTA_PER_COMPANY, count };
  }

  private incrementCompanyCount(companyId: string): void {
    const cached = companyDailyCountCache.get(companyId);
    if (cached) {
      cached.count++;
    }
  }

  getStats(): {
    dailyQuotaPerCompany: number;
    hourlyBurstLimit: number;
    companyCacheSize: number;
  } {
    return {
      dailyQuotaPerCompany: DAILY_QUOTA_PER_COMPANY,
      hourlyBurstLimit: HOURLY_BURST_LIMIT,
      companyCacheSize: companyDailyCountCache.size,
    };
  }
}

export const emailDispatchService = new EmailDispatchService();
