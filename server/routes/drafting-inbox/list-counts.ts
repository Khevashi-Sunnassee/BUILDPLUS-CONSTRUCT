import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { eq, and, desc, asc, ilike, or, count, gte, sql } from "drizzle-orm";
import { draftingInboundEmails, jobs } from "@shared/schema";

const router = Router();

router.get("/api/drafting-inbox/emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const conditions: any[] = [eq(draftingInboundEmails.companyId, companyId)];

    if (status) {
      conditions.push(eq(draftingInboundEmails.status, status));
    }

    if (q) {
      const search = `%${q}%`;
      conditions.push(
        or(
          ilike(draftingInboundEmails.fromAddress, search),
          ilike(draftingInboundEmails.subject, search),
          ilike(jobs.name, search),
          ilike(jobs.jobNumber, search),
        )
      );
    }

    const whereClause = and(...conditions);

    const [emailRows, countResult] = await Promise.all([
      db
        .select({
          id: draftingInboundEmails.id,
          companyId: draftingInboundEmails.companyId,
          resendEmailId: draftingInboundEmails.resendEmailId,
          fromAddress: draftingInboundEmails.fromAddress,
          toAddress: draftingInboundEmails.toAddress,
          subject: draftingInboundEmails.subject,
          status: draftingInboundEmails.status,
          jobId: draftingInboundEmails.jobId,
          requestType: draftingInboundEmails.requestType,
          impactArea: draftingInboundEmails.impactArea,
          attachmentCount: draftingInboundEmails.attachmentCount,
          processingError: draftingInboundEmails.processingError,
          processedAt: draftingInboundEmails.processedAt,
          matchedAt: draftingInboundEmails.matchedAt,
          createdAt: draftingInboundEmails.createdAt,
          jobName: jobs.name,
          jobNumber: jobs.jobNumber,
        })
        .from(draftingInboundEmails)
        .leftJoin(jobs, eq(draftingInboundEmails.jobId, jobs.id))
        .where(whereClause)
        .orderBy((() => {
          const sortFn = sortOrder === "asc" ? asc : desc;
          const sortColumns: Record<string, any> = {
            fromAddress: draftingInboundEmails.fromAddress,
            subject: draftingInboundEmails.subject,
            status: draftingInboundEmails.status,
            requestType: draftingInboundEmails.requestType,
            impactArea: draftingInboundEmails.impactArea,
            createdAt: draftingInboundEmails.createdAt,
          };
          const col = sortBy && sortColumns[sortBy] ? sortColumns[sortBy] : draftingInboundEmails.createdAt;
          return sortFn(col);
        })())
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(draftingInboundEmails)
        .leftJoin(jobs, eq(draftingInboundEmails.jobId, jobs.id))
        .where(whereClause),
    ]);

    res.json({
      emails: emailRows,
      total: countResult[0]?.total || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting inbound emails");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch drafting inbound emails" });
  }
});

router.get("/api/drafting-inbox/counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const statusCounts = await db
      .select({
        status: draftingInboundEmails.status,
        count: count(),
      })
      .from(draftingInboundEmails)
      .where(eq(draftingInboundEmails.companyId, companyId))
      .groupBy(draftingInboundEmails.status);

    const counts: Record<string, number> = {
      received: 0,
      processing: 0,
      processed: 0,
      matched: 0,
      archived: 0,
      failed: 0,
      allocated: 0,
      duplicate: 0,
      irrelevant: 0,
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
    logger.error({ err: error }, "Error fetching drafting inbox counts");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch counts" });
  }
});

router.get("/api/drafting-inbox/trends", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        date: sql<string>`DATE(${draftingInboundEmails.createdAt})`.as("date"),
        status: draftingInboundEmails.status,
        count: count(),
      })
      .from(draftingInboundEmails)
      .where(and(
        eq(draftingInboundEmails.companyId, companyId),
        gte(draftingInboundEmails.createdAt, startDate),
      ))
      .groupBy(sql`DATE(${draftingInboundEmails.createdAt})`, draftingInboundEmails.status)
      .orderBy(sql`DATE(${draftingInboundEmails.createdAt})`);

    const trendMap: Record<string, Record<string, number>> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      trendMap[key] = { received: 0, processing: 0, processed: 0, matched: 0, allocated: 0, total: 0 };
    }

    for (const row of rows) {
      const dateKey = typeof row.date === "string" ? row.date : new Date(row.date).toISOString().split("T")[0];
      const statusKey = row.status.toLowerCase();
      if (trendMap[dateKey]) {
        if (statusKey in trendMap[dateKey] && statusKey !== "total") {
          trendMap[dateKey][statusKey] = row.count;
        }
        trendMap[dateKey].total += row.count;
      }
    }

    const sortedDates = Object.keys(trendMap).sort();
    const trends = sortedDates.map((date) => ({
      date,
      ...trendMap[date],
    }));

    res.json({ trends, days });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting inbox trends");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch trends" });
  }
});

export default router;
