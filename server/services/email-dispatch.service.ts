import { db } from "../db";
import { mailRegister, emailSendLogs, broadcastDeliveries, broadcastMessages, emailQueueJobs, emailDeadLetters } from "@shared/schema";
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
  fromEmail?: string;
  fromName?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
  attempt: number;
  maxAttempts: number;
  userId?: string;
  dbJobId?: string;
}

const companyDailyCountCache = new Map<string, { count: number; resetAt: number }>();
const MAX_CACHE_SIZE = 100;

const DAILY_QUOTA_PER_COMPANY = 5000;
const HOURLY_BURST_LIMIT = 500;

function pruneCompanyCache(): void {
  if (companyDailyCountCache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  for (const [key, val] of companyDailyCountCache) {
    if (val.resetAt <= now) companyDailyCountCache.delete(key);
  }
  if (companyDailyCountCache.size > MAX_CACHE_SIZE) {
    const entries = [...companyDailyCountCache.entries()];
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key] of toRemove) companyDailyCountCache.delete(key);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of companyDailyCountCache) {
    if (val.resetAt <= now) companyDailyCountCache.delete(key);
  }
}, 10 * 60 * 1000);

class EmailDispatchService {
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    emailQueue.register<EmailJobPayload>("send-email", async (payload) => {
      await this.processEmailJob(payload);
    });

    this.recoverStaleJobs().catch(err => {
      logger.error({ err }, "[EmailDispatch] Failed to recover stale jobs on startup");
    });

    logger.info("[EmailDispatch] Email dispatch service initialized with queue handler");
  }

  private async recoverStaleJobs(): Promise<void> {
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    const recovered = await db.update(emailQueueJobs)
      .set({ status: "PENDING", startedAt: null })
      .where(
        and(
          eq(emailQueueJobs.status, "PROCESSING"),
          sql`${emailQueueJobs.startedAt} < ${staleThreshold}`
        )
      )
      .returning({ id: emailQueueJobs.id });

    if (recovered.length > 0) {
      logger.info({ count: recovered.length }, "[EmailDispatch] Recovered stale PROCESSING jobs to PENDING");
    }

    const pendingJobs = await db.select()
      .from(emailQueueJobs)
      .where(
        and(
          eq(emailQueueJobs.status, "PENDING"),
          or(
            sql`${emailQueueJobs.nextRetryAt} IS NULL`,
            sql`${emailQueueJobs.nextRetryAt} <= NOW()`
          )
        )
      )
      .orderBy(sql`${emailQueueJobs.priority} DESC, ${emailQueueJobs.createdAt} ASC`)
      .limit(100);

    for (const job of pendingJobs) {
      try {
        const payload = job.payload as EmailJobPayload;
        payload.dbJobId = job.id;
        payload.attempt = job.attempts + 1;
        payload.maxAttempts = job.maxAttempts;
        emailQueue.enqueue("send-email", payload, job.priority);
      } catch (err) {
        logger.error({ err, jobId: job.id }, "[EmailDispatch] Failed to re-enqueue recovered job");
      }
    }

    if (pendingJobs.length > 0) {
      logger.info({ count: pendingJobs.length }, "[EmailDispatch] Re-enqueued pending jobs from database");
    }
  }

  private async persistJob(payload: EmailJobPayload, priority: number): Promise<string> {
    const [row] = await db.insert(emailQueueJobs).values({
      companyId: payload.companyId,
      type: payload.type,
      referenceId: payload.referenceId,
      payload: payload as any,
      status: "PENDING",
      priority,
      attempts: 0,
      maxAttempts: payload.maxAttempts,
    }).returning({ id: emailQueueJobs.id });
    return row.id;
  }

  private async markJobProcessing(dbJobId: string): Promise<void> {
    await db.update(emailQueueJobs)
      .set({ status: "PROCESSING", startedAt: new Date() })
      .where(eq(emailQueueJobs.id, dbJobId));
  }

  private async markJobCompleted(dbJobId: string): Promise<void> {
    await db.update(emailQueueJobs)
      .set({ status: "COMPLETED", completedAt: new Date(), error: null })
      .where(eq(emailQueueJobs.id, dbJobId));
  }

  private async markJobFailed(dbJobId: string, error: string, attempts: number): Promise<void> {
    const retryDelay = 5000 * Math.pow(2, attempts);
    const nextRetryAt = new Date(Date.now() + retryDelay);
    await db.update(emailQueueJobs)
      .set({
        status: "FAILED",
        error,
        attempts,
        nextRetryAt,
      })
      .where(eq(emailQueueJobs.id, dbJobId));
  }

  private async markJobDead(dbJobId: string, payload: EmailJobPayload, error: string, attempts: number): Promise<void> {
    await db.update(emailQueueJobs)
      .set({ status: "DEAD", error, attempts, completedAt: new Date() })
      .where(eq(emailQueueJobs.id, dbJobId));

    await db.insert(emailDeadLetters).values({
      originalJobId: dbJobId,
      companyId: payload.companyId,
      type: payload.type,
      referenceId: payload.referenceId,
      payload: payload as any,
      error,
      attempts,
    });

    logger.error({
      dbJobId,
      type: payload.type,
      referenceId: payload.referenceId,
      attempts,
    }, "[EmailDispatch] Email moved to dead letter queue");
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
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
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
      replyTo: params.replyTo,
      attempt: 1,
      maxAttempts: 3,
      userId: params.userId,
      fromEmail: params.fromEmail,
      fromName: params.fromName,
    };

    try {
      const dbJobId = await this.persistJob(payload, 5);
      payload.dbJobId = dbJobId;
      const jobId = emailQueue.enqueue("send-email", payload, 5);
      logger.info({ jobId, dbJobId, mailRegisterId: params.mailRegisterId, to: params.to }, "[EmailDispatch] Mail register email enqueued");
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
      const dbJobId = await this.persistJob(payload, 1);
      payload.dbJobId = dbJobId;
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

    const dbJobId = await this.persistJob(payload, 3);
    payload.dbJobId = dbJobId;
    const jobId = emailQueue.enqueue("send-email", payload, 3);
    return { jobId };
  }

  private async processEmailJob(payload: EmailJobPayload): Promise<void> {
    const startTime = Date.now();
    const dbJobId = payload.dbJobId;

    if (dbJobId) {
      await this.markJobProcessing(dbJobId);
    }

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
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      attachments,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.incrementCompanyCount(payload.companyId);

      if (dbJobId) {
        await this.markJobCompleted(dbJobId);
      }

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

        if (dbJobId) {
          await db.update(emailQueueJobs)
            .set({
              status: "FAILED",
              error: errorMsg,
              attempts: sql`${emailQueueJobs.attempts} + 1`,
              nextRetryAt: new Date(Date.now() + 5000 * Math.pow(2, payload.attempt)),
            })
            .where(eq(emailQueueJobs.id, dbJobId));
        }

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

      if (dbJobId) {
        await this.markJobDead(dbJobId, payload, errorMsg, payload.attempt);
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
    const failedDbJobs = await db.select()
      .from(emailQueueJobs)
      .where(
        and(
          eq(emailQueueJobs.status, "FAILED"),
          sql`${emailQueueJobs.attempts} < ${emailQueueJobs.maxAttempts}`,
          or(
            sql`${emailQueueJobs.nextRetryAt} IS NULL`,
            sql`${emailQueueJobs.nextRetryAt} <= NOW()`
          )
        )
      )
      .orderBy(sql`${emailQueueJobs.priority} DESC`)
      .limit(50);

    let retried = 0;
    let errors = 0;

    for (const job of failedDbJobs) {
      try {
        await db.update(emailQueueJobs)
          .set({ status: "PENDING" })
          .where(eq(emailQueueJobs.id, job.id));

        const payload = job.payload as EmailJobPayload;
        payload.dbJobId = job.id;
        payload.attempt = job.attempts + 1;
        payload.maxAttempts = job.maxAttempts;
        emailQueue.enqueue("send-email", payload, job.priority);
        retried++;
      } catch (err) {
        errors++;
        logger.error({ err, jobId: job.id }, "[EmailDispatch] Failed to re-enqueue DB job");
      }
    }

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

        const dbJobId = await this.persistJob(payload, 2);
        payload.dbJobId = dbJobId;
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

  async getDeadLetters(companyId?: string): Promise<any[]> {
    const query = db.select().from(emailDeadLetters);
    if (companyId) {
      return query.where(
        and(
          eq(emailDeadLetters.companyId, companyId),
          sql`${emailDeadLetters.resolvedAt} IS NULL`
        )
      ).orderBy(sql`${emailDeadLetters.failedAt} DESC`).limit(100);
    }
    return query.where(sql`${emailDeadLetters.resolvedAt} IS NULL`)
      .orderBy(sql`${emailDeadLetters.failedAt} DESC`).limit(100);
  }

  async resolveDeadLetter(deadLetterId: string, resolvedBy: string): Promise<void> {
    await db.update(emailDeadLetters)
      .set({ resolvedAt: new Date(), resolvedBy })
      .where(eq(emailDeadLetters.id, deadLetterId));
  }

  async retryDeadLetter(deadLetterId: string): Promise<string | null> {
    const [dl] = await db.select().from(emailDeadLetters)
      .where(
        and(
          eq(emailDeadLetters.id, deadLetterId),
          sql`${emailDeadLetters.resolvedAt} IS NULL`
        )
      ).limit(1);

    if (!dl) return null;

    const payload = dl.payload as EmailJobPayload;
    payload.attempt = 1;
    payload.maxAttempts = 3;

    const dbJobId = await this.persistJob(payload, 5);
    payload.dbJobId = dbJobId;
    emailQueue.enqueue("send-email", payload, 5);

    await db.update(emailDeadLetters)
      .set({ resolvedAt: new Date() })
      .where(eq(emailDeadLetters.id, deadLetterId));

    logger.info({ deadLetterId, newJobId: dbJobId }, "[EmailDispatch] Dead letter retried");
    return dbJobId;
  }

  private async checkCompanyQuota(companyId: string): Promise<{ allowed: boolean; count: number }> {
    const cached = companyDailyCountCache.get(companyId);
    const now = Date.now();

    if (cached && cached.resetAt > now) {
      return { allowed: cached.count < DAILY_QUOTA_PER_COMPANY, count: cached.count };
    }

    const todayUTC = new Date().toISOString().slice(0, 10);
    const todayStartUTC = new Date(todayUTC + "T00:00:00.000Z");

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mailRegister)
      .where(
        and(
          eq(mailRegister.companyId, companyId),
          sql`${mailRegister.sentAt} >= ${todayStartUTC}`,
          inArray(mailRegister.status, ["SENT", "QUEUED", "DELIVERED"])
        )
      )
      .limit(1);

    const count = result?.count || 0;
    const nextMidnightUTC = new Date(todayUTC + "T00:00:00.000Z");
    nextMidnightUTC.setUTCDate(nextMidnightUTC.getUTCDate() + 1);

    companyDailyCountCache.set(companyId, { count, resetAt: nextMidnightUTC.getTime() });
    pruneCompanyCache();

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
