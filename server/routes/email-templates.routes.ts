import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { emailTemplates, emailSendLogs } from "@shared/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { emailService } from "../services/email.service";

const router = Router();

const TEMPLATE_TYPES = ["ACTIVITY", "GENERAL", "TENDER", "PROCUREMENT", "DRAFTING", "INVOICE", "OTHER"] as const;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailList(emailStr: string): boolean {
  if (!emailStr || !emailStr.trim()) return false;
  const emails = emailStr.split(",").map(e => e.trim()).filter(Boolean);
  return emails.length > 0 && emails.every(e => emailRegex.test(e));
}

const templateCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  templateType: z.enum(TEMPLATE_TYPES),
  subject: z.string().max(500).default(""),
  htmlBody: z.string().default(""),
  placeholders: z.array(z.object({
    key: z.string(),
    label: z.string(),
    sample: z.string().optional(),
  })).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  templateType: z.enum(TEMPLATE_TYPES).optional(),
  subject: z.string().max(500).optional(),
  htmlBody: z.string().optional(),
  placeholders: z.array(z.object({
    key: z.string(),
    label: z.string(),
    sample: z.string().optional(),
  })).optional(),
  isActive: z.boolean().optional(),
});

const emailSendSchema = z.object({
  templateId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  to: z.string().min(1, "To address is required").refine(
    (val) => validateEmailList(val),
    { message: "Invalid email address format in To field" }
  ),
  cc: z.string().nullable().optional().refine(
    (val) => !val || val.trim() === "" || validateEmailList(val),
    { message: "Invalid email address format in CC field" }
  ),
  bcc: z.string().nullable().optional().refine(
    (val) => !val || val.trim() === "" || validateEmailList(val),
    { message: "Invalid email address format in BCC field" }
  ),
  subject: z.string().min(1, "Subject is required").max(500),
  htmlBody: z.string().min(1, "Email body is required").max(500000, "Email body too large (max 500KB)"),
});

router.get("/api/email-templates", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const typeFilter = req.query.type as string | undefined;

    const conditions: any[] = [eq(emailTemplates.companyId, companyId)];
    if (typeFilter && TEMPLATE_TYPES.includes(typeFilter as any)) {
      conditions.push(eq(emailTemplates.templateType, typeFilter as any));
    }

    const results = await db.select().from(emailTemplates)
      .where(and(...conditions))
      .orderBy(desc(emailTemplates.updatedAt))
      .limit(200);

    res.json(results);
  } catch (err) {
    logger.error({ err }, "Error fetching email templates");
    res.status(500).json({ error: "Failed to fetch email templates" });
  }
});

router.get("/api/email-templates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const templateId = String(req.params.id);
    const [template] = await db.select().from(emailTemplates)
      .where(and(eq(emailTemplates.id, templateId), eq(emailTemplates.companyId, companyId)))
      .limit(1);

    if (!template) return res.status(404).json({ error: "Template not found" });

    res.json(template);
  } catch (err) {
    logger.error({ err }, "Error fetching email template");
    res.status(500).json({ error: "Failed to fetch email template" });
  }
});

router.post("/api/email-templates", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).session?.userId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const parsed = templateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [template] = await db.insert(emailTemplates).values({
      ...parsed.data,
      companyId,
      createdById: userId,
    }).returning();

    res.status(201).json(template);
  } catch (err) {
    logger.error({ err }, "Error creating email template");
    res.status(500).json({ error: "Failed to create email template" });
  }
});

router.patch("/api/email-templates/:id", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const parsed = templateUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const templateId = String(req.params.id);
    const [existing] = await db.select({ id: emailTemplates.id }).from(emailTemplates)
      .where(and(eq(emailTemplates.id, templateId), eq(emailTemplates.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Template not found" });

    const [updated] = await db.update(emailTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, templateId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Error updating email template");
    res.status(500).json({ error: "Failed to update email template" });
  }
});

router.delete("/api/email-templates/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const templateId = String(req.params.id);
    const [existing] = await db.select({ id: emailTemplates.id }).from(emailTemplates)
      .where(and(eq(emailTemplates.id, templateId), eq(emailTemplates.companyId, companyId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Template not found" });

    await db.delete(emailTemplates).where(eq(emailTemplates.id, templateId));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting email template");
    res.status(500).json({ error: "Failed to delete email template" });
  }
});

router.post("/api/emails/send", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).session?.userId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = emailSendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { to, cc, bcc, subject, htmlBody, templateId, taskId, jobId } = parsed.data;

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    let result: { success: boolean; messageId?: string; error?: string };
    try {
      result = await emailService.sendEmailWithAttachment({
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body: htmlBody,
      });
    } catch (sendErr: any) {
      result = { success: false, error: sendErr?.message || "Send failed" };
    }

    await db.insert(emailSendLogs).values({
      companyId,
      templateId: templateId || null,
      taskId: taskId || null,
      jobId: jobId || null,
      sentById: userId,
      toAddresses: to,
      ccAddresses: cc || null,
      bccAddresses: bcc || null,
      subject,
      htmlBody,
      status: result.success ? "SENT" : "FAILED",
      messageId: result.messageId || null,
      errorMessage: result.error || null,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to send email" });
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    logger.error({ err }, "Error sending email");
    res.status(500).json({ error: "Failed to send email" });
  }
});

router.get("/api/email-send-logs", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const taskId = req.query.taskId as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(emailSendLogs.companyId, companyId)];
    if (taskId) {
      conditions.push(eq(emailSendLogs.taskId, taskId));
    }
    if (status) {
      conditions.push(eq(emailSendLogs.status, status));
    }

    const [totalResult] = await db.select({ count: count() }).from(emailSendLogs)
      .where(and(...conditions));

    const logs = await db.select().from(emailSendLogs)
      .where(and(...conditions))
      .orderBy(desc(emailSendLogs.sentAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
    });
  } catch (err) {
    logger.error({ err }, "Error fetching email send logs");
    res.status(500).json({ error: "Failed to fetch email send logs" });
  }
});

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>.*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    .replace(/<form\b[^>]*>.*?<\/form>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*\S+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

const aiGenerateSchema = z.object({
  purpose: z.string().min(1, "Purpose is required").max(2000),
  tone: z.string().min(1, "Tone is required").max(100),
  jobType: z.string().max(200).optional().default(""),
  templateType: z.enum(TEMPLATE_TYPES).optional().default("GENERAL"),
  templateName: z.string().max(255).optional().default(""),
  subjectLine: z.string().max(500).optional().default(""),
});

router.post("/api/email-templates/ai/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const parsed = aiGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { purpose, tone, jobType, templateType, templateName, subjectLine } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "AI service is not configured" });
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a professional email template writer for a construction and manufacturing company called BuildPlus. 
You create well-structured, professional email templates that can be used for business communication.
The company manages panel production, delivery, construction projects, and related operations.

Important rules:
- Write in clean HTML format suitable for email clients
- Use professional formatting with proper paragraphs
- Include placeholders where appropriate using {{placeholder_name}} syntax (e.g., {{recipient_name}}, {{job_number}}, {{project_name}}, {{company_name}}, {{sender_name}})
- Make the email feel professional yet personable
- Include a proper greeting and sign-off
- Structure with clear sections if the content is detailed
- Do NOT include <html>, <head>, or <body> tags - just the inner HTML content
- Use simple inline styles for formatting if needed (bold, lists, etc.)`;

    let userPrompt = `Generate a professional email template with the following requirements:

PURPOSE: ${purpose}
TONE: ${tone}`;

    if (jobType) {
      userPrompt += `\nJOB TYPE / CONTEXT: ${jobType}`;
    }
    if (templateType && templateType !== "GENERAL") {
      userPrompt += `\nTEMPLATE CATEGORY: ${templateType}`;
    }
    if (templateName) {
      userPrompt += `\nTEMPLATE NAME: ${templateName}`;
    }
    if (subjectLine) {
      userPrompt += `\nSUBJECT LINE CONTEXT: ${subjectLine}`;
    }

    userPrompt += `\n\nPlease generate the email body HTML content only. Use {{placeholder_name}} syntax for any dynamic values like names, dates, job numbers etc. Make sure to include common placeholders like {{recipient_name}} and {{sender_name}}.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const generatedContent = completion.choices[0]?.message?.content || "";

    let cleanContent = generatedContent
      .replace(/```html\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    cleanContent = sanitizeHtml(cleanContent);

    res.json({
      htmlBody: cleanContent,
      tokensUsed: completion.usage?.total_tokens || 0,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Error generating email template with AI");
    res.status(500).json({ error: "Failed to generate email content" });
  }
});

export { router as emailTemplatesRouter };
