import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { draftingInboundEmails, draftingInboxSettings, draftingEmailDocuments, jobs } from "@shared/schema";
import { requireUUID } from "../../lib/api-utils";
import { objectStorageService, logDraftingEmailActivity } from "./shared";

const router = Router();

router.post("/api/drafting-inbox/emails/:id/extract", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const docs = await db.select().from(draftingEmailDocuments)
      .where(eq(draftingEmailDocuments.inboundEmailId, id)).limit(200);

    if (docs.length > 0) {
      const doc = docs[0];

      await db.update(draftingInboundEmails)
        .set({ status: "PROCESSING" })
        .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)));

      const file = await objectStorageService.getObjectEntityFile(doc.storageKey);
      const chunks: Buffer[] = [];
      const stream = file.createReadStream();
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);
      const mimeType = doc.mimeType || "application/pdf";

      try {
        const { extractDraftingEmailFromDocument } = await import("../../lib/drafting-inbox-jobs");
        await extractDraftingEmailFromDocument(id, companyId, fileBuffer, mimeType);
      } catch (extractErr: any) {
        logger.warn({ err: extractErr }, "Drafting email document extraction failed");
      }
    } else if (email.textBody || email.htmlBody) {
      await db.update(draftingInboundEmails)
        .set({ status: "PROCESSING" })
        .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)));

      try {
        const { extractDraftingEmail } = await import("../../lib/drafting-inbox-jobs");
        await extractDraftingEmail(id, companyId, email.textBody || email.htmlBody || "", email.subject || "");
      } catch (extractErr: any) {
        logger.warn({ err: extractErr }, "Drafting email text extraction failed");
      }
    } else {
      return res.status(404).json({ error: "No document or email body found for extraction" });
    }

    await logDraftingEmailActivity(id, "extraction_triggered", "AI extraction triggered", userId || undefined);

    const [updated] = await db.select().from(draftingInboundEmails)
      .where(eq(draftingInboundEmails.id, id)).limit(1);

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error triggering drafting email extraction");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/drafting-inbox/emails/:id/match", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session.userId;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const body = z.object({
      jobId: z.string(),
    }).parse(req.body);

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, body.jobId), eq(jobs.companyId, companyId))).limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const [updated] = await db.update(draftingInboundEmails)
      .set({
        jobId: body.jobId,
        status: "MATCHED",
        matchedAt: new Date(),
      })
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId)))
      .returning();

    await logDraftingEmailActivity(id, "matched", `Matched to job: ${job.jobNumber} - ${job.name}`, userId || undefined, {
      jobId: body.jobId,
      jobNumber: job.jobNumber,
      jobName: job.name,
    });

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error matching drafting email");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/drafting-inbox/check-emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(draftingInboxSettings)
      .where(and(eq(draftingInboxSettings.companyId, companyId), eq(draftingInboxSettings.isEnabled, true)))
      .limit(1);

    if (!settings || !settings.inboundEmailAddress) {
      return res.status(400).json({ error: "Drafting email inbox not configured. Set up inbox settings first." });
    }

    const { scheduler } = await import("../../lib/background-scheduler");
    const isRunning = scheduler.isJobRunning("drafting-email-poll");
    if (isRunning) {
      return res.json({ triggered: true, message: "Drafting email check is already running in the background" });
    }

    const triggered = await scheduler.triggerNow("drafting-email-poll");
    res.json({
      triggered,
      message: triggered
        ? "Drafting email check started in background. New emails will appear shortly."
        : "Could not start drafting email check. Job may not be registered yet.",
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[Drafting Inbox] Error triggering email check");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/drafting-inbox/background-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { scheduler } = await import("../../lib/background-scheduler");

    const jobStatus = scheduler.getStatus();

    const companyId = req.companyId;
    const [receivedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(draftingInboundEmails)
      .where(and(
        eq(draftingInboundEmails.status, "RECEIVED"),
        companyId ? eq(draftingInboundEmails.companyId, companyId) : sql`true`
      ));

    res.json({
      emailPoll: jobStatus["drafting-email-poll"] || { running: false },
      pendingProcessing: receivedCount?.count || 0,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to get background status" });
  }
});

router.post("/api/drafting-inbox/emails/:id/suggest-due-date", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const { actionType } = z.object({ actionType: z.string().optional() }).parse(req.body);

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const prompt = `You are a construction project management assistant. Based on the following drafting email details, suggest how many days from today the task should be due. Consider urgency, complexity, and typical construction timelines.

Email Subject: ${email.subject || "No subject"}
Request Type: ${email.requestType || "Unknown"}
Impact Area: ${email.impactArea || "Unknown"}
Action Type: ${actionType || "General"}
Today's Date: ${todayStr}

Respond with ONLY a JSON object: {"days": <number>, "reason": "<brief reason>"}
The days should be one of: 0 (today/urgent), 1 (tomorrow), 7, 14, or 21. Pick the most appropriate.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 100,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const days = [0, 1, 7, 14, 21].includes(parsed.days) ? parsed.days : 7;
      const suggestedDate = new Date(today);
      suggestedDate.setDate(suggestedDate.getDate() + days);
      res.json({
        days,
        date: suggestedDate.toISOString().split("T")[0],
        reason: parsed.reason || "AI suggestion",
      });
    } else {
      res.json({ days: 7, date: new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0], reason: "Default suggestion" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error suggesting due date");
    res.json({ days: 7, date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0], reason: "Default (AI unavailable)" });
  }
});

export default router;
