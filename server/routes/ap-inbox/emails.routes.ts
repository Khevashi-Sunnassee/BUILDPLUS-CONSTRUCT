import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { db, logger } from "./shared";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { apInboundEmails, apInboxSettings, apInvoices } from "@shared/schema";

export function registerEmailsRoutes(router: Router) {
  router.get("/api/ap-inbox/counts", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const statusCounts = await db
        .select({
          status: apInboundEmails.status,
          count: count(),
        })
        .from(apInboundEmails)
        .where(eq(apInboundEmails.companyId, companyId))
        .groupBy(apInboundEmails.status);

      const counts: Record<string, number> = {
        received: 0,
        processing: 0,
        processed: 0,
        matched: 0,
        archived: 0,
        failed: 0,
        all: 0,
      };

      for (const row of statusCounts) {
        const key = row.status.toLowerCase();
        if (key in counts) {
          counts[key] = row.count;
        }
        counts.all += row.count;
      }

      res.json(counts);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching AP inbox counts");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.get("/api/ap-inbox/emails", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const emails = await db.select().from(apInboundEmails)
        .where(eq(apInboundEmails.companyId, companyId))
        .orderBy(desc(apInboundEmails.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(emails);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching inbound emails");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-inbox/check-emails", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const [settings] = await db.select().from(apInboxSettings)
        .where(and(eq(apInboxSettings.companyId, companyId), eq(apInboxSettings.isEnabled, true)))
        .limit(1);

      if (!settings || !settings.inboundEmailAddress) {
        return res.status(400).json({ error: "Email inbox not configured. Set up inbox settings first." });
      }

      const { scheduler } = await import("../../lib/background-scheduler");
      const isRunning = scheduler.isJobRunning("ap-email-poll");
      if (isRunning) {
        return res.json({ triggered: true, message: "Email check is already running in the background" });
      }

      const triggered = await scheduler.triggerNow("ap-email-poll");
      res.json({ triggered, message: triggered ? "Email check started in background. New invoices will appear shortly." : "Could not start email check" });
    } catch (error: unknown) {
      logger.error({ err: error }, "[AP Inbox] Error triggering email check");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.get("/api/ap-inbox/background-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const { scheduler } = await import("../../lib/background-scheduler");
      const { getLastPollResult, getLastExtractResult } = await import("../../lib/ap-inbox-jobs");

      const jobStatus = scheduler.getStatus();
      const lastPoll = getLastPollResult();
      const lastExtract = getLastExtractResult();

      const [importedCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(apInvoices)
        .where(eq(apInvoices.status, "IMPORTED"));

      res.json({
        emailPoll: {
          ...jobStatus["ap-email-poll"],
          lastResult: lastPoll,
        },
        invoiceExtraction: {
          ...jobStatus["ap-invoice-extract"],
          lastResult: lastExtract,
        },
        pendingExtraction: importedCount?.count || 0,
      });
    } catch (error: unknown) {
      res.status(500).json({ error: "Failed to get background status" });
    }
  });
}
