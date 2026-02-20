import { Router } from "express";
import { db } from "../db";
import { mailTypes, mailRegister, mailTypeSequences, companies, users, emailSendLogs } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "./middleware/auth.middleware";
import { z } from "zod";
import { emailService } from "../services/email.service";
import logger from "../lib/logger";

export const mailRegisterRouter = Router();

mailRegisterRouter.get("/api/mail-register/types", requireAuth, async (req, res) => {
  try {
    const types = await db
      .select()
      .from(mailTypes)
      .where(eq(mailTypes.isActive, true))
      .orderBy(mailTypes.sortOrder)
      .limit(100);
    res.json(types);
  } catch (error) {
    logger.error({ err: error }, "Error fetching mail types");
    res.status(500).json({ error: "Failed to fetch mail types" });
  }
});

mailRegisterRouter.get("/api/mail-register/next-number", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const mailTypeId = req.query.mailTypeId as string;
    if (!mailTypeId) {
      return res.status(400).json({ error: "mailTypeId is required" });
    }

    const mailNumber = await generateMailNumber(companyId, mailTypeId);
    res.json({ mailNumber });
  } catch (error) {
    logger.error({ err: error }, "Error generating mail number");
    res.status(500).json({ error: "Failed to generate mail number" });
  }
});

mailRegisterRouter.get("/api/mail-register", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const { mailTypeId, status, search, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const offset = parseInt(offsetStr as string) || 0;

    const conditions = [eq(mailRegister.companyId, companyId)];
    if (mailTypeId) {
      conditions.push(eq(mailRegister.mailTypeId, String(mailTypeId)));
    }
    if (status) {
      conditions.push(eq(mailRegister.status, status as any));
    }
    if (search) {
      conditions.push(
        sql`(${mailRegister.subject} ILIKE ${'%' + search + '%'} OR ${mailRegister.mailNumber} ILIKE ${'%' + search + '%'} OR ${mailRegister.toAddresses} ILIKE ${'%' + search + '%'})`
      );
    }

    const results = await db
      .select({
        id: mailRegister.id,
        mailNumber: mailRegister.mailNumber,
        mailTypeId: mailRegister.mailTypeId,
        mailTypeName: mailTypes.name,
        mailTypeCategory: mailTypes.category,
        mailTypeAbbreviation: mailTypes.abbreviation,
        jobId: mailRegister.jobId,
        taskId: mailRegister.taskId,
        toAddresses: mailRegister.toAddresses,
        ccAddresses: mailRegister.ccAddresses,
        subject: mailRegister.subject,
        responseRequired: mailRegister.responseRequired,
        responseDueDate: mailRegister.responseDueDate,
        status: mailRegister.status,
        sentById: mailRegister.sentById,
        sentByName: users.name,
        messageId: mailRegister.messageId,
        threadId: mailRegister.threadId,
        parentMailId: mailRegister.parentMailId,
        sentAt: mailRegister.sentAt,
      })
      .from(mailRegister)
      .innerJoin(mailTypes, eq(mailRegister.mailTypeId, mailTypes.id))
      .leftJoin(users, eq(mailRegister.sentById, users.id))
      .where(and(...conditions))
      .orderBy(desc(mailRegister.sentAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mailRegister)
      .where(and(...conditions))
      .limit(1);

    res.json({ items: results, total: countResult?.count || 0 });
  } catch (error) {
    logger.error({ err: error }, "Error fetching mail register");
    res.status(500).json({ error: "Failed to fetch mail register" });
  }
});

mailRegisterRouter.get("/api/mail-register/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const [entry] = await db
      .select({
        id: mailRegister.id,
        companyId: mailRegister.companyId,
        mailNumber: mailRegister.mailNumber,
        mailTypeId: mailRegister.mailTypeId,
        mailTypeName: mailTypes.name,
        mailTypeCategory: mailTypes.category,
        mailTypeAbbreviation: mailTypes.abbreviation,
        jobId: mailRegister.jobId,
        taskId: mailRegister.taskId,
        toAddresses: mailRegister.toAddresses,
        ccAddresses: mailRegister.ccAddresses,
        subject: mailRegister.subject,
        htmlBody: mailRegister.htmlBody,
        responseRequired: mailRegister.responseRequired,
        responseDueDate: mailRegister.responseDueDate,
        status: mailRegister.status,
        sentById: mailRegister.sentById,
        sentByName: users.name,
        messageId: mailRegister.messageId,
        threadId: mailRegister.threadId,
        parentMailId: mailRegister.parentMailId,
        sentAt: mailRegister.sentAt,
      })
      .from(mailRegister)
      .innerJoin(mailTypes, eq(mailRegister.mailTypeId, mailTypes.id))
      .leftJoin(users, eq(mailRegister.sentById, users.id))
      .where(and(eq(mailRegister.id, String(req.params.id)), eq(mailRegister.companyId, companyId)))
      .limit(1);

    if (!entry) {
      return res.status(404).json({ error: "Mail register entry not found" });
    }

    const thread = await db
      .select({
        id: mailRegister.id,
        mailNumber: mailRegister.mailNumber,
        subject: mailRegister.subject,
        toAddresses: mailRegister.toAddresses,
        sentByName: users.name,
        sentAt: mailRegister.sentAt,
        status: mailRegister.status,
      })
      .from(mailRegister)
      .leftJoin(users, eq(mailRegister.sentById, users.id))
      .where(
        and(
          eq(mailRegister.companyId, companyId),
          sql`(${mailRegister.threadId} = ${entry.threadId} OR ${mailRegister.id} = ${entry.parentMailId} OR ${mailRegister.parentMailId} = ${entry.id})`,
          sql`${mailRegister.id} != ${entry.id}`
        )
      )
      .orderBy(mailRegister.sentAt)
      .limit(50);

    res.json({ ...entry, thread });
  } catch (error) {
    logger.error({ err: error }, "Error fetching mail register entry");
    res.status(500).json({ error: "Failed to fetch mail register entry" });
  }
});

const createMailSchema = z.object({
  mailTypeId: z.string().min(1),
  toAddresses: z.string().min(1),
  ccAddresses: z.string().optional(),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  responseRequired: z.enum(["YES", "NO", "FOR_INFORMATION"]).nullable().optional(),
  responseDueDate: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  parentMailId: z.string().nullable().optional(),
  sendCopy: z.boolean().optional(),
});

mailRegisterRouter.post("/api/mail-register", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const userId = req.session.userId!;

    const parsed = createMailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const data = parsed.data;

    const mailNumber = await generateMailNumber(companyId, data.mailTypeId);

    const htmlBody = data.htmlBody || `<p>${data.subject}</p>`;

    const emailResult = await emailService.sendEmailWithAttachment({
      to: data.toAddresses,
      cc: data.ccAddresses || undefined,
      bcc: data.sendCopy ? (await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1))?.[0]?.email || undefined : undefined,
      subject: `[${mailNumber}] ${data.subject}`,
    body: htmlBody,
    });

    let parentThread: string | null = null;
    if (data.parentMailId) {
      const [parent] = await db.select({ threadId: mailRegister.threadId }).from(mailRegister).where(and(eq(mailRegister.id, data.parentMailId), eq(mailRegister.companyId, companyId))).limit(1);
      parentThread = parent?.threadId || data.parentMailId;
    }

    const [entry] = await db.insert(mailRegister).values({
      companyId,
      mailNumber,
      mailTypeId: data.mailTypeId,
      jobId: data.jobId || null,
      taskId: data.taskId || null,
      toAddresses: data.toAddresses,
      ccAddresses: data.ccAddresses || null,
      subject: data.subject,
      htmlBody,
      responseRequired: data.responseRequired || null,
      responseDueDate: data.responseDueDate ? new Date(data.responseDueDate) : null,
      status: emailResult.success ? "SENT" : "FAILED",
      sentById: userId,
      messageId: emailResult.messageId || null,
      threadId: parentThread || mailNumber,
      parentMailId: data.parentMailId || null,
    }).returning();

    await db.insert(emailSendLogs).values({
      companyId,
      sentById: userId,
      toAddresses: data.toAddresses,
      ccAddresses: data.ccAddresses || null,
      subject: `[${mailNumber}] ${data.subject}`,
      htmlBody,
      status: emailResult.success ? "SENT" : "FAILED",
      messageId: emailResult.messageId || null,
      errorMessage: emailResult.error || null,
    });

    if (!emailResult.success) {
      logger.error({ error: emailResult.error, mailNumber }, "Mail register email failed to send");
      return res.status(500).json({ error: emailResult.error || "Failed to send email", mailNumber, entry });
    }

    res.json({ success: true, mailNumber, entry });
  } catch (error) {
    logger.error({ err: error }, "Error creating mail register entry");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create mail register entry" });
  }
});

async function generateMailNumber(companyId: string, mailTypeId: string): Promise<string> {
  const [company] = await db
    .select({ code: companies.code })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const [mailType] = await db
    .select({ abbreviation: mailTypes.abbreviation })
    .from(mailTypes)
    .where(eq(mailTypes.id, mailTypeId))
    .limit(1);

  if (!company || !mailType) {
    throw new Error("Company or mail type not found");
  }

  const result = await db.execute(sql`
    INSERT INTO mail_type_sequences (id, company_id, mail_type_id, last_sequence)
    VALUES (gen_random_uuid(), ${companyId}, ${mailTypeId}, 1)
    ON CONFLICT (company_id, mail_type_id)
    DO UPDATE SET last_sequence = mail_type_sequences.last_sequence + 1
    RETURNING last_sequence
  `);

  const seq = (result as any).rows?.[0]?.last_sequence || (result as any)[0]?.last_sequence || 1;
  const paddedSeq = String(seq).padStart(6, "0");

  return `${company.code}-${mailType.abbreviation}-${paddedSeq}`;
}
