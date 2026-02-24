import { Router, Request, Response } from "express";
import crypto from "crypto";
import { requireAuth } from "./middleware/auth.middleware";
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  storeTokens,
  getConnectionStatus,
  disconnectMyob,
  createMyobClient,
} from "../myob";
import logger from "../lib/logger";
import { db } from "../db";
import { myobTokens, myobExportLogs, users, myobAccountMappings, myobTaxCodeMappings, myobSupplierMappings, myobCustomerMappings, costCodes, suppliers, jobs, customers, progressClaims, assets } from "@shared/schema";
import { eq, desc, and, asc, sql, ilike, gte, lte, not, inArray } from "drizzle-orm";
import { apInvoices } from "@shared/schema";

const router = Router();

const pendingOAuthStates = new Map<string, { companyId: string; userId: string; redirectUri: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingOAuthStates) {
    if (val.expiresAt < now) pendingOAuthStates.delete(key);
  }
}, 60000);

function buildRedirectUri(req: Request): string {
  if (process.env.MYOB_REDIRECT_URI) {
    return process.env.MYOB_REDIRECT_URI;
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
  return `${protocol}://${host}/api/myob/callback`;
}

router.get("/api/myob/auth", requireAuth, (req: Request, res: Response) => {
  const companyId = req.companyId;
  const userId = req.session?.userId;
  if (!companyId || !userId) {
    return res.status(400).json({ error: "Authentication required" });
  }

  const stateNonce = crypto.randomBytes(32).toString("hex");
  const redirectUri = buildRedirectUri(req);

  pendingOAuthStates.set(stateNonce, {
    companyId,
    userId,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const authUrl = getAuthorizationUrl(redirectUri);
  res.redirect(`${authUrl}&state=${encodeURIComponent(stateNonce)}`);
});

router.get("/api/myob/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const businessId = req.query.businessId as string | undefined;
  const stateNonce = req.query.state as string | undefined;

  const sendHtml = (title: string, message: string, isError = false) => {
    res.status(isError ? 400 : 200).send(
      `<!DOCTYPE html><html><head><title>${title}</title></head><body>` +
      `<h1>${title}</h1><p>${message}</p>` +
      `<script>setTimeout(function(){window.close()},${isError ? 5000 : 2000})</script>` +
      `</body></html>`
    );
  };

  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

  logger.info({ 
    hasCode: !!code, 
    hasBusinessId: !!businessId, 
    hasState: !!stateNonce,
    error,
    errorDescription,
    queryKeys: Object.keys(req.query),
    fullUrl: req.originalUrl
  }, "MYOB OAuth callback received");

  if (error) {
    logger.warn({ error, errorDescription }, "MYOB OAuth returned error");
    return sendHtml("MYOB Connection Error", `${error}: ${errorDescription || 'Unknown error'}`, true);
  }

  if (!code || !businessId || !stateNonce) {
    logger.warn({ code: !!code, businessId: !!businessId, state: !!stateNonce, query: req.query }, "MYOB callback missing parameters");
    return sendHtml("OAuth Error", `Missing parameters: ${!code ? 'code ' : ''}${!businessId ? 'businessId ' : ''}${!stateNonce ? 'state' : ''}`, true);
  }

  const stateData = pendingOAuthStates.get(stateNonce);
  if (!stateData) {
    return sendHtml("OAuth Error", "Invalid or expired OAuth state. Please try connecting again.", true);
  }

  pendingOAuthStates.delete(stateNonce);

  if (stateData.expiresAt < Date.now()) {
    return sendHtml("OAuth Error", "OAuth session expired. Please try connecting again.", true);
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code, businessId, stateData.redirectUri);
    await storeTokens(stateData.companyId, stateData.userId, tokenResponse, businessId);
    logger.info({ companyId: stateData.companyId }, "MYOB OAuth connected successfully");

    const origin = new URL(stateData.redirectUri).origin;
    res.send(
      `<!DOCTYPE html><html><head><title>MYOB Connected</title></head><body>` +
      `<h1>MYOB Connected Successfully</h1>` +
      `<p>Your MYOB account has been linked. This window will close automatically.</p>` +
      `<script>` +
      `if(window.opener){window.opener.postMessage({type:'MYOB_OAUTH_SUCCESS'},${JSON.stringify(origin)})}` +
      `setTimeout(function(){window.close()},2000)` +
      `</script></body></html>`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "MYOB OAuth token exchange failed");
    sendHtml("Connection Failed", "Token exchange failed. Please try again.", true);
  }
});

router.get("/api/myob/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const status = await getConnectionStatus(companyId);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to check MYOB status", details: message });
  }
});

router.post("/api/myob/disconnect", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    await disconnectMyob(companyId);
    logger.info({ companyId }, "MYOB disconnected");
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to disconnect MYOB", details: message });
  }
});

function handleMyobError(err: unknown, res: Response, context: string) {
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error({ err: message }, `Error in MYOB ${context}`);
  const isAuthError = message.includes("401") || message.includes("authentication failed") || message.includes("OAuthTokenIsInvalid");
  const userMessage = isAuthError
    ? "MYOB authentication expired. Please disconnect and reconnect your MYOB account from the Overview tab."
    : `MYOB request failed: ${message}`;
  res.status(isAuthError ? 401 : 500).json({ error: userMessage });
}

router.get("/api/myob/company", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    const data = await myob.getCompany();
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "company");
  }
});

router.get("/api/myob/customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getCustomers(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "customers");
  }
});

router.get("/api/myob/suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getSuppliers(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "suppliers");
  }
});

router.get("/api/myob/accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getAccounts(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "accounts");
  }
});

router.get("/api/myob/invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getInvoices(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "invoices");
  }
});

router.get("/api/myob/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getItems(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "items");
  }
});

router.get("/api/myob/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getJobs(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "jobs");
  }
});

router.get("/api/myob/job-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const bpJobs = await db.select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      name: jobs.name,
      myobJobUid: jobs.myobJobUid,
    })
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .orderBy(asc(jobs.jobNumber))
      .limit(500);

    res.json(bpJobs);
  } catch (err) {
    handleMyobError(err, res, "job-mappings-list");
  }
});

router.post("/api/myob/job-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { jobId, myobJobUid } = req.body;
    if (!jobId || !myobJobUid) return res.status(400).json({ error: "jobId and myobJobUid are required" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const [updated] = await db.update(jobs)
      .set({ myobJobUid, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();

    res.json(updated);
  } catch (err) {
    handleMyobError(err, res, "job-mappings-link");
  }
});

router.delete("/api/myob/job-mappings/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, req.params.jobId), eq(jobs.companyId, companyId))).limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await db.update(jobs)
      .set({ myobJobUid: null, updatedAt: new Date() })
      .where(eq(jobs.id, req.params.jobId));

    res.json({ ok: true });
  } catch (err) {
    handleMyobError(err, res, "job-mappings-unlink");
  }
});

router.get("/api/myob/export-logs", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await db.select({
      id: myobExportLogs.id,
      invoiceId: myobExportLogs.invoiceId,
      status: myobExportLogs.status,
      invoiceNumber: myobExportLogs.invoiceNumber,
      supplierName: myobExportLogs.supplierName,
      totalAmount: myobExportLogs.totalAmount,
      errorMessage: myobExportLogs.errorMessage,
      exportedAt: myobExportLogs.exportedAt,
      userName: users.name,
    })
      .from(myobExportLogs)
      .leftJoin(users, eq(myobExportLogs.userId, users.id))
      .where(eq(myobExportLogs.companyId, companyId))
      .orderBy(desc(myobExportLogs.exportedAt))
      .limit(limit)
      .offset(offset);

    res.json(logs);
  } catch (err) {
    logger.error({ err }, "Error fetching MYOB export logs");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to fetch export logs", details: message });
  }
});

router.get("/api/myob/profit-and-loss", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const reportingBasis = (req.query.reportingBasis as string) || "Accrual";
    const yearEndAdjust = req.query.yearEndAdjust === "true";

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate query parameters are required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ error: "startDate and endDate must be in YYYY-MM-DD format" });
    }

    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      return res.status(400).json({ error: "Invalid date values provided" });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: "startDate must be before endDate" });
    }

    const allowedBasis = ["Accrual", "Cash"];
    if (!allowedBasis.includes(reportingBasis)) {
      return res.status(400).json({ error: "reportingBasis must be 'Accrual' or 'Cash'" });
    }

    const params = new URLSearchParams({
      StartDate: startDate,
      EndDate: endDate,
      ReportingBasis: reportingBasis,
      YearEndAdjust: String(yearEndAdjust),
    });

    const myob = createMyobClient(companyId);
    const data = await myob.getProfitAndLoss(params.toString());
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "profit-and-loss");
  }
});

router.get("/api/myob/monthly-pnl", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const months = parseInt(req.query.months as string) || 12;
    const reportingBasis = (req.query.reportingBasis as string) || "Accrual";
    const yearEndAdjust = req.query.yearEndAdjust === "true";
    const endDateParam = req.query.endDate as string | undefined;

    const allowedBasis = ["Accrual", "Cash"];
    if (!allowedBasis.includes(reportingBasis)) {
      return res.status(400).json({ error: "reportingBasis must be 'Accrual' or 'Cash'" });
    }

    if (months < 1 || months > 24) {
      return res.status(400).json({ error: "months must be between 1 and 24" });
    }

    const startDateParam = req.query.startDate as string | undefined;
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const monthRanges: { start: string; end: string; label: string }[] = [];

    if (startDateParam) {
      const startDate = new Date(startDateParam);
      const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      let cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const start = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const end = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const label = cursor.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
        monthRanges.push({ start, end, label });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else {
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
        monthRanges.push({ start, end, label });
      }
    }

    const myob = createMyobClient(companyId);

    const results = await Promise.all(
      monthRanges.map(async (range) => {
        try {
          const params = new URLSearchParams({
            StartDate: range.start,
            EndDate: range.end,
            ReportingBasis: reportingBasis,
            YearEndAdjust: String(yearEndAdjust),
          });
          const data = await myob.getProfitAndLoss(params.toString());
          return { ...range, data, error: null };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          logger.warn({ month: range.label, err: message }, "[MYOB] Monthly P&L fetch failed for month");
          return { ...range, data: null, error: message };
        }
      })
    );

    res.json({
      months: results,
      reportingBasis,
      yearEndAdjust,
    });
  } catch (err) {
    handleMyobError(err, res, "monthly-pnl");
  }
});

router.get("/api/myob/buildplus-adjustments", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const months = parseInt(req.query.months as string) || 12;

    const endDt = endDate ? new Date(endDate) : new Date();
    const monthRanges: { start: string; end: string; label: string }[] = [];

    if (startDate) {
      const startDt = new Date(startDate);
      const rangeStart = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
      const rangeEnd = new Date(endDt.getFullYear(), endDt.getMonth(), 1);
      let cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const s = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const e = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const label = cursor.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
        monthRanges.push({ start: s, end: e, label });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else {
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(endDt.getFullYear(), endDt.getMonth() - i, 1);
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const e = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
        monthRanges.push({ start: s, end: e, label });
      }
    }

    const periodStart = monthRanges[0]?.start;
    const periodEnd = monthRanges[monthRanges.length - 1]?.end;

    const unprocessedInvoices = await db.select({
      count: sql<number>`count(*)::int`,
      totalEx: sql<string>`COALESCE(sum(${apInvoices.totalEx}), 0)`,
      totalInc: sql<string>`COALESCE(sum(${apInvoices.totalInc}), 0)`,
    })
    .from(apInvoices)
    .where(
      and(
        eq(apInvoices.companyId, companyId),
        not(eq(apInvoices.status, "EXPORTED")),
        ...(periodStart ? [gte(apInvoices.invoiceDate, new Date(periodStart))] : []),
        ...(periodEnd ? [lte(apInvoices.invoiceDate, new Date(periodEnd + "T23:59:59"))] : [])
      )
    );

    const unprocessedByStatus = await db.select({
      status: apInvoices.status,
      count: sql<number>`count(*)::int`,
      totalEx: sql<string>`COALESCE(sum(${apInvoices.totalEx}), 0)`,
      totalInc: sql<string>`COALESCE(sum(${apInvoices.totalInc}), 0)`,
    })
    .from(apInvoices)
    .where(
      and(
        eq(apInvoices.companyId, companyId),
        not(eq(apInvoices.status, "EXPORTED")),
        ...(periodStart ? [gte(apInvoices.invoiceDate, new Date(periodStart))] : []),
        ...(periodEnd ? [lte(apInvoices.invoiceDate, new Date(periodEnd + "T23:59:59"))] : [])
      )
    )
    .groupBy(apInvoices.status);

    const unprocessedByMonth = await db.select({
      month: sql<string>`to_char(${apInvoices.invoiceDate}, 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
      totalEx: sql<string>`COALESCE(sum(${apInvoices.totalEx}), 0)`,
      totalInc: sql<string>`COALESCE(sum(${apInvoices.totalInc}), 0)`,
    })
    .from(apInvoices)
    .where(
      and(
        eq(apInvoices.companyId, companyId),
        not(eq(apInvoices.status, "EXPORTED")),
        ...(periodStart ? [gte(apInvoices.invoiceDate, new Date(periodStart))] : []),
        ...(periodEnd ? [lte(apInvoices.invoiceDate, new Date(periodEnd + "T23:59:59"))] : [])
      )
    )
    .groupBy(sql`to_char(${apInvoices.invoiceDate}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${apInvoices.invoiceDate}, 'YYYY-MM')`);

    const retentionData = await db.select({
      totalRetention: sql<string>`COALESCE(sum(${progressClaims.retentionAmount}), 0)`,
      totalRetentionHeld: sql<string>`COALESCE(sum(${progressClaims.retentionHeldToDate}), 0)`,
      claimCount: sql<number>`count(*)::int`,
    })
    .from(progressClaims)
    .where(
      and(
        eq(progressClaims.companyId, companyId),
        ...(periodStart ? [gte(progressClaims.claimDate, new Date(periodStart))] : []),
        ...(periodEnd ? [lte(progressClaims.claimDate, new Date(periodEnd + "T23:59:59"))] : [])
      )
    );

    const retentionByJob = await db.select({
      jobId: progressClaims.jobId,
      jobName: jobs.name,
      totalRetention: sql<string>`COALESCE(sum(${progressClaims.retentionAmount}), 0)`,
      totalRetentionHeld: sql<string>`COALESCE(sum(${progressClaims.retentionHeldToDate}), 0)`,
      claimCount: sql<number>`count(*)::int`,
    })
    .from(progressClaims)
    .leftJoin(jobs, eq(progressClaims.jobId, jobs.id))
    .where(
      and(
        eq(progressClaims.companyId, companyId),
        ...(periodStart ? [gte(progressClaims.claimDate, new Date(periodStart))] : []),
        ...(periodEnd ? [lte(progressClaims.claimDate, new Date(periodEnd + "T23:59:59"))] : [])
      )
    )
    .groupBy(progressClaims.jobId, jobs.name)
    .orderBy(sql`sum(${progressClaims.retentionHeldToDate}) DESC`);

    const assetDateFilter = and(
      eq(assets.companyId, companyId),
      sql`${assets.purchaseDate} IS NOT NULL AND ${assets.purchaseDate} <> '' AND ${assets.purchaseDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
      ...(periodStart ? [sql`${assets.purchaseDate} >= ${periodStart}`] : []),
      ...(periodEnd ? [sql`${assets.purchaseDate} <= ${periodEnd}`] : [])
    );

    const assetPurchases = await db.select({
      count: sql<number>`count(*)::int`,
      totalPurchasePrice: sql<string>`COALESCE(sum(${assets.purchasePrice}), 0)`,
    })
    .from(assets)
    .where(assetDateFilter);

    const assetPurchasesByMonth = await db.select({
      month: sql<string>`substring(${assets.purchaseDate} from 1 for 7)`,
      count: sql<number>`count(*)::int`,
      totalPurchasePrice: sql<string>`COALESCE(sum(${assets.purchasePrice}), 0)`,
    })
    .from(assets)
    .where(assetDateFilter)
    .groupBy(sql`substring(${assets.purchaseDate} from 1 for 7)`)
    .orderBy(sql`substring(${assets.purchaseDate} from 1 for 7)`);

    const assetPurchasesByCategory = await db.select({
      category: assets.category,
      count: sql<number>`count(*)::int`,
      totalPurchasePrice: sql<string>`COALESCE(sum(${assets.purchasePrice}), 0)`,
    })
    .from(assets)
    .where(assetDateFilter)
    .groupBy(assets.category)
    .orderBy(sql`sum(${assets.purchasePrice}) DESC`);

    const retentionByMonth = await db.select({
      month: sql<string>`to_char(${progressClaims.claimDate}, 'YYYY-MM')`,
      totalRetention: sql<string>`COALESCE(sum(${progressClaims.retentionAmount}), 0)`,
      totalRetentionHeld: sql<string>`COALESCE(sum(${progressClaims.retentionHeldToDate}), 0)`,
      claimCount: sql<number>`count(*)::int`,
    })
    .from(progressClaims)
    .where(
      and(
        eq(progressClaims.companyId, companyId),
        ...(periodStart ? [gte(progressClaims.claimDate, new Date(periodStart))] : []),
        ...(periodEnd ? [lte(progressClaims.claimDate, new Date(periodEnd + "T23:59:59"))] : [])
      )
    )
    .groupBy(sql`to_char(${progressClaims.claimDate}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${progressClaims.claimDate}, 'YYYY-MM')`);

    res.json({
      period: { start: periodStart, end: periodEnd },
      unprocessedInvoices: {
        summary: unprocessedInvoices[0] || { count: 0, totalEx: "0", totalInc: "0" },
        byStatus: unprocessedByStatus,
        byMonth: unprocessedByMonth,
      },
      retention: {
        summary: retentionData[0] || { totalRetention: "0", totalRetentionHeld: "0", claimCount: 0 },
        byJob: retentionByJob,
        byMonth: retentionByMonth,
      },
      assetPurchases: {
        summary: assetPurchases[0] || { count: 0, totalPurchasePrice: "0" },
        byMonth: assetPurchasesByMonth,
        byCategory: assetPurchasesByCategory,
      },
    });
  } catch (err) {
    logger.error({ err }, "[MYOB] BuildPlus adjustments endpoint error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch BuildPlus adjustment data" });
  }
});

router.get("/api/myob/tax-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const myob = createMyobClient(companyId);
    const data = await myob.getTaxCodes();
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "tax-codes");
  }
});

router.get("/api/myob/supplier-bills/:supplierId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { supplierId } = req.params;

    const [mapping] = await db.select()
      .from(myobSupplierMappings)
      .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
      .limit(1);

    if (!mapping) {
      return res.json({ linked: false, bills: [], myobSupplier: null });
    }

    const client = createMyobClient(companyId);
    const myobUid = mapping.myobSupplierUid;
    const query = `$filter=Supplier/UID eq guid'${myobUid}'&$orderby=Date desc&$top=1000`;
    const result = await client.getPurchaseBills(query);
    const bills = result?.Items || [];

    res.json({
      linked: true,
      myobSupplier: {
        uid: mapping.myobSupplierUid,
        name: mapping.myobSupplierName,
        displayId: mapping.myobSupplierDisplayId,
      },
      bills: bills.map((b: any) => ({
        uid: b.UID,
        number: b.Number,
        date: b.Date,
        supplierInvoiceNumber: b.SupplierInvoiceNumber,
        status: b.Status,
        subtotal: b.Subtotal,
        totalTax: b.TotalTax,
        totalAmount: b.TotalAmount,
        amountPaid: b.AmountPaid,
        balanceDue: b.BalanceDueAmount,
        comment: b.Comment,
        journalMemo: b.JournalMemo,
      })),
      totalCount: bills.length,
    });
  } catch (err) {
    handleMyobError(err, res, "supplier-bills");
  }
});

router.get("/api/myob/customer-invoices/:customerId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { customerId } = req.params;

    const [mapping] = await db.select()
      .from(myobCustomerMappings)
      .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, customerId)))
      .limit(1);

    if (!mapping) {
      return res.json({ linked: false, invoices: [], myobCustomer: null });
    }

    const client = createMyobClient(companyId);
    const myobUid = mapping.myobCustomerUid;
    const query = `$filter=Customer/UID eq guid'${myobUid}'&$orderby=Date desc&$top=1000`;
    const result = await client.getInvoices(query);
    const invoices = result?.Items || [];

    res.json({
      linked: true,
      myobCustomer: {
        uid: mapping.myobCustomerUid,
        name: mapping.myobCustomerName,
        displayId: mapping.myobCustomerDisplayId,
      },
      invoices: invoices.map((inv: any) => ({
        uid: inv.UID,
        number: inv.Number,
        date: inv.Date,
        customerPO: inv.CustomerPurchaseOrderNumber,
        status: inv.Status,
        subtotal: inv.Subtotal,
        totalTax: inv.TotalTax,
        totalAmount: inv.TotalAmount,
        amountPaid: inv.AmountPaid,
        balanceDue: inv.BalanceDueAmount,
        comment: inv.Comment,
        journalMemo: inv.JournalMemo,
      })),
      totalCount: invoices.length,
    });
  } catch (err) {
    handleMyobError(err, res, "customer-invoices");
  }
});

router.get("/api/myob/account-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select({
      mapping: myobAccountMappings,
      costCode: { code: costCodes.code, name: costCodes.name },
    })
    .from(myobAccountMappings)
    .leftJoin(costCodes, eq(myobAccountMappings.costCodeId, costCodes.id))
    .where(eq(myobAccountMappings.companyId, companyId))
    .orderBy(asc(costCodes.code))
    .limit(500);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "account-mappings-list");
  }
});

router.post("/api/myob/account-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { costCodeId, myobAccountUid, myobAccountName, myobAccountDisplayId, notes } = req.body;
    if (!costCodeId || !myobAccountUid) return res.status(400).json({ error: "costCodeId and myobAccountUid are required" });

    const existing = await db.select().from(myobAccountMappings)
      .where(and(eq(myobAccountMappings.companyId, companyId), eq(myobAccountMappings.costCodeId, costCodeId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobAccountMappings)
        .set({ myobAccountUid, myobAccountName, myobAccountDisplayId, notes, updatedAt: new Date() })
        .where(eq(myobAccountMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobAccountMappings).values({
      companyId, costCodeId, myobAccountUid, myobAccountName, myobAccountDisplayId, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "account-mappings-create");
  }
});

router.delete("/api/myob/account-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappingId = req.params.id;
    await db.delete(myobAccountMappings)
      .where(and(eq(myobAccountMappings.id, mappingId), eq(myobAccountMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "account-mappings-delete");
  }
});

router.get("/api/myob/tax-code-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select().from(myobTaxCodeMappings)
      .where(eq(myobTaxCodeMappings.companyId, companyId))
      .orderBy(asc(myobTaxCodeMappings.bpTaxCode))
      .limit(200);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "tax-code-mappings-list");
  }
});

router.post("/api/myob/tax-code-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { bpTaxCode, myobTaxCodeUid, myobTaxCodeName, myobTaxCodeCode, notes } = req.body;
    if (!bpTaxCode || !myobTaxCodeUid) return res.status(400).json({ error: "bpTaxCode and myobTaxCodeUid are required" });

    const existing = await db.select().from(myobTaxCodeMappings)
      .where(and(eq(myobTaxCodeMappings.companyId, companyId), eq(myobTaxCodeMappings.bpTaxCode, bpTaxCode)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobTaxCodeMappings)
        .set({ myobTaxCodeUid, myobTaxCodeName, myobTaxCodeCode, notes, updatedAt: new Date() })
        .where(eq(myobTaxCodeMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobTaxCodeMappings).values({
      companyId, bpTaxCode, myobTaxCodeUid, myobTaxCodeName, myobTaxCodeCode, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "tax-code-mappings-create");
  }
});

router.delete("/api/myob/tax-code-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(myobTaxCodeMappings)
      .where(and(eq(myobTaxCodeMappings.id, req.params.id), eq(myobTaxCodeMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "tax-code-mappings-delete");
  }
});

router.get("/api/myob/supplier-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select({
      mapping: myobSupplierMappings,
      supplier: { name: suppliers.name },
    })
    .from(myobSupplierMappings)
    .leftJoin(suppliers, eq(myobSupplierMappings.supplierId, suppliers.id))
    .where(eq(myobSupplierMappings.companyId, companyId))
    .orderBy(asc(suppliers.name))
    .limit(500);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "supplier-mappings-list");
  }
});

router.post("/api/myob/supplier-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { supplierId, myobSupplierUid, myobSupplierName, myobSupplierDisplayId, notes } = req.body;
    if (!supplierId || !myobSupplierUid) return res.status(400).json({ error: "supplierId and myobSupplierUid are required" });

    const existing = await db.select().from(myobSupplierMappings)
      .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobSupplierMappings)
        .set({ myobSupplierUid, myobSupplierName, myobSupplierDisplayId, notes, updatedAt: new Date() })
        .where(eq(myobSupplierMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobSupplierMappings).values({
      companyId, supplierId, myobSupplierUid, myobSupplierName, myobSupplierDisplayId, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "supplier-mappings-create");
  }
});

router.delete("/api/myob/supplier-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(myobSupplierMappings)
      .where(and(eq(myobSupplierMappings.id, req.params.id), eq(myobSupplierMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "supplier-mappings-delete");
  }
});

router.get("/api/myob/customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const myob = createMyobClient(companyId);
    const data = await myob.getCustomers();
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "customers");
  }
});

router.get("/api/myob/customer-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select({
      mapping: myobCustomerMappings,
      customer: { name: customers.name },
    })
    .from(myobCustomerMappings)
    .leftJoin(customers, eq(myobCustomerMappings.customerId, customers.id))
    .where(eq(myobCustomerMappings.companyId, companyId))
    .orderBy(asc(customers.name))
    .limit(500);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "customer-mappings-list");
  }
});

router.post("/api/myob/customer-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { customerId, myobCustomerUid, myobCustomerName, myobCustomerDisplayId, notes } = req.body;
    if (!customerId || !myobCustomerUid) return res.status(400).json({ error: "customerId and myobCustomerUid are required" });

    const existing = await db.select().from(myobCustomerMappings)
      .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, customerId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobCustomerMappings)
        .set({ myobCustomerUid, myobCustomerName, myobCustomerDisplayId, notes, updatedAt: new Date() })
        .where(eq(myobCustomerMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobCustomerMappings).values({
      companyId, customerId, myobCustomerUid, myobCustomerName, myobCustomerDisplayId, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "customer-mappings-create");
  }
});

router.delete("/api/myob/customer-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(myobCustomerMappings)
      .where(and(eq(myobCustomerMappings.id, req.params.id), eq(myobCustomerMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "customer-mappings-delete");
  }
});

router.post("/api/myob/import-customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobDisplayId, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        const bpCustomer = await db.select().from(customers)
          .where(and(eq(customers.id, existingBpId), eq(customers.companyId, companyId)))
          .limit(1);
        if (bpCustomer.length === 0) { skipped++; continue; }
        const existing = await db.select().from(myobCustomerMappings)
          .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, existingBpId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(myobCustomerMappings)
            .set({ myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null, updatedAt: new Date() })
            .where(eq(myobCustomerMappings.id, existing[0].id));
        } else {
          await db.insert(myobCustomerMappings).values({
            companyId, customerId: existingBpId, myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null,
          });
        }
        linked++;
      } else if (action === "create") {
        try {
          const existingCustomer = await db.select().from(customers)
            .where(and(eq(customers.name, myobName), eq(customers.companyId, companyId)))
            .limit(1);
          let customerId: string;
          if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
            linked++;
          } else {
            const [newCustomer] = await db.insert(customers).values({ companyId, name: myobName }).returning();
            customerId = newCustomer.id;
            created++;
          }
          const existingMapping = await db.select().from(myobCustomerMappings)
            .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, customerId)))
            .limit(1);
          if (existingMapping.length > 0) {
            await db.update(myobCustomerMappings)
              .set({ myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null, updatedAt: new Date() })
              .where(eq(myobCustomerMappings.id, existingMapping[0].id));
          } else {
            await db.insert(myobCustomerMappings).values({
              companyId, customerId, myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null,
            });
          }
        } catch (itemErr) {
          logger.warn({ err: itemErr, myobName, myobUid }, "[MYOB Import] Failed to import customer, skipping");
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-customers");
  }
});

router.post("/api/myob/import-suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobDisplayId, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        const bpSupplier = await db.select().from(suppliers)
          .where(and(eq(suppliers.id, existingBpId), eq(suppliers.companyId, companyId)))
          .limit(1);
        if (bpSupplier.length === 0) { skipped++; continue; }
        const existing = await db.select().from(myobSupplierMappings)
          .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, existingBpId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(myobSupplierMappings)
            .set({ myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null, updatedAt: new Date() })
            .where(eq(myobSupplierMappings.id, existing[0].id));
        } else {
          await db.insert(myobSupplierMappings).values({
            companyId, supplierId: existingBpId, myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null,
          });
        }
        linked++;
      } else if (action === "create") {
        try {
          const existingSupplier = await db.select().from(suppliers)
            .where(and(eq(suppliers.name, myobName), eq(suppliers.companyId, companyId)))
            .limit(1);
          let supplierId: string;
          if (existingSupplier.length > 0) {
            supplierId = existingSupplier[0].id;
            linked++;
          } else {
            const [newSupplier] = await db.insert(suppliers).values({ companyId, name: myobName }).returning();
            supplierId = newSupplier.id;
            created++;
          }
          const existingMapping = await db.select().from(myobSupplierMappings)
            .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
            .limit(1);
          if (existingMapping.length > 0) {
            await db.update(myobSupplierMappings)
              .set({ myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null, updatedAt: new Date() })
              .where(eq(myobSupplierMappings.id, existingMapping[0].id));
          } else {
            await db.insert(myobSupplierMappings).values({
              companyId, supplierId, myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null,
            });
          }
        } catch (itemErr) {
          logger.warn({ err: itemErr, myobName, myobUid }, "[MYOB Import] Failed to import supplier, skipping");
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-suppliers");
  }
});

router.post("/api/myob/import-jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobNumber, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        await db.update(jobs)
          .set({ myobJobUid: myobUid, updatedAt: new Date() })
          .where(and(eq(jobs.id, existingBpId), eq(jobs.companyId, companyId)));
        linked++;
      } else if (action === "create") {
        const jobNumber = myobNumber || `MYOB-${myobName.substring(0, 20)}`;
        const existingJob = await db.select().from(jobs)
          .where(and(eq(jobs.jobNumber, jobNumber), eq(jobs.companyId, companyId)))
          .limit(1);
        if (existingJob.length > 0) {
          await db.update(jobs)
            .set({ myobJobUid: myobUid, updatedAt: new Date() })
            .where(eq(jobs.id, existingJob[0].id));
          linked++;
        } else {
          await db.insert(jobs).values({
            companyId, jobNumber, name: myobName, myobJobUid: myobUid, status: "ACTIVE",
          });
          created++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-jobs");
  }
});

router.post("/api/myob/import-accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobDisplayId, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        const bpCostCode = await db.select().from(costCodes)
          .where(and(eq(costCodes.id, existingBpId), eq(costCodes.companyId, companyId)))
          .limit(1);
        if (bpCostCode.length === 0) { skipped++; continue; }
        const existing = await db.select().from(myobAccountMappings)
          .where(and(eq(myobAccountMappings.companyId, companyId), eq(myobAccountMappings.costCodeId, existingBpId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(myobAccountMappings)
            .set({ myobAccountUid: myobUid, myobAccountName: myobName, myobAccountDisplayId: myobDisplayId || null, updatedAt: new Date() })
            .where(eq(myobAccountMappings.id, existing[0].id));
        } else {
          await db.insert(myobAccountMappings).values({
            companyId, costCodeId: existingBpId, myobAccountUid: myobUid, myobAccountName: myobName, myobAccountDisplayId: myobDisplayId || null,
          });
        }
        linked++;
      } else if (action === "create") {
        const code = myobDisplayId || myobName.substring(0, 20);
        const existingCode = await db.select().from(costCodes)
          .where(and(eq(costCodes.code, code), eq(costCodes.companyId, companyId)))
          .limit(1);
        let costCodeId: string;
        if (existingCode.length > 0) {
          costCodeId = existingCode[0].id;
        } else {
          const [newCostCode] = await db.insert(costCodes).values({ companyId, code, name: myobName }).returning();
          costCodeId = newCostCode.id;
        }
        const existingMapping = await db.select().from(myobAccountMappings)
          .where(and(eq(myobAccountMappings.companyId, companyId), eq(myobAccountMappings.costCodeId, costCodeId)))
          .limit(1);
        if (existingMapping.length === 0) {
          await db.insert(myobAccountMappings).values({
            companyId, costCodeId, myobAccountUid: myobUid, myobAccountName: myobName, myobAccountDisplayId: myobDisplayId || null,
          });
        }
        created++;
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-accounts");
  }
});

router.post("/api/myob/auto-map", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    const [myobAccounts, myobTaxCodes, myobSuppliers] = await Promise.all([
      myob.getAccounts().catch(() => ({ Items: [] })),
      myob.getTaxCodes().catch(() => ({ Items: [] })),
      myob.getSuppliers().catch(() => ({ Items: [] })),
    ]);

    const accountItems: any[] = (myobAccounts as any)?.Items || [];
    const taxItems: any[] = (myobTaxCodes as any)?.Items || [];
    const supplierItems: any[] = (myobSuppliers as any)?.Items || [];

    const companyCostCodes = await db.select().from(costCodes)
      .where(and(eq(costCodes.companyId, companyId), eq(costCodes.isActive, true)))
      .orderBy(asc(costCodes.code))
      .limit(500);

    const companySuppliers = await db.select().from(suppliers)
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true)))
      .orderBy(asc(suppliers.name))
      .limit(500);

    const existingAcctMaps = await db.select().from(myobAccountMappings)
      .where(eq(myobAccountMappings.companyId, companyId)).limit(500);
    const existingSupMaps = await db.select().from(myobSupplierMappings)
      .where(eq(myobSupplierMappings.companyId, companyId)).limit(500);

    const mappedCostCodeIds = new Set(existingAcctMaps.map((m) => m.costCodeId));
    const mappedSupplierIds = new Set(existingSupMaps.map((m) => m.supplierId));

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    let accountMapped = 0;
    let supplierMapped = 0;

    for (const cc of companyCostCodes) {
      if (mappedCostCodeIds.has(cc.id)) continue;
      const ccNorm = normalize(cc.name);
      const ccCodeNorm = normalize(cc.code);
      const match = accountItems.find((a) => {
        const aNorm = normalize(a.Name || "");
        const aIdNorm = normalize(a.DisplayID || "");
        return aNorm === ccNorm || aIdNorm === ccCodeNorm || aNorm.includes(ccNorm) || ccNorm.includes(aNorm);
      });
      if (match) {
        await db.insert(myobAccountMappings).values({
          companyId,
          costCodeId: cc.id,
          myobAccountUid: match.UID,
          myobAccountName: match.Name,
          myobAccountDisplayId: match.DisplayID,
          notes: "Auto-mapped",
        }).onConflictDoNothing();
        accountMapped++;
      }
    }

    for (const sup of companySuppliers) {
      if (mappedSupplierIds.has(sup.id)) continue;
      const supNorm = normalize(sup.name);
      const match = supplierItems.find((s) => {
        const sNorm = normalize(s.CompanyName || s.Name || "");
        return sNorm === supNorm || sNorm.includes(supNorm) || supNorm.includes(sNorm);
      });
      if (match) {
        await db.insert(myobSupplierMappings).values({
          companyId,
          supplierId: sup.id,
          myobSupplierUid: match.UID,
          myobSupplierName: match.CompanyName || match.Name || "",
          myobSupplierDisplayId: match.DisplayID || "",
          notes: "Auto-mapped",
        }).onConflictDoNothing();
        supplierMapped++;
      }
    }

    res.json({
      accountsMapped: accountMapped,
      suppliersMapped: supplierMapped,
      totalCostCodes: companyCostCodes.length,
      totalSuppliers: companySuppliers.length,
      myobAccountsAvailable: accountItems.length,
      myobSuppliersAvailable: supplierItems.length,
      myobTaxCodesAvailable: taxItems.length,
    });
  } catch (err) {
    handleMyobError(err, res, "auto-map");
  }
});

router.get("/api/myob/purchase-bills", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { createMyobClient, getConnectionStatus } = await import("../myob");
    const connectionStatus = await getConnectionStatus(companyId);
    if (!connectionStatus.connected) return res.status(400).json({ error: "MYOB not connected" });

    const myob = createMyobClient(companyId);
    const supplierInvoiceNumber = req.query.supplierInvoiceNumber as string;
    let query = "$top=50&$orderby=Date desc";
    if (supplierInvoiceNumber) {
      query += `&$filter=SupplierInvoiceNumber eq '${supplierInvoiceNumber}'`;
    }
    const result = await myob.getPurchaseBills(query);
    res.json(result);
  } catch (err) {
    handleMyobError(err, res, "purchase-bills");
  }
});

router.post("/api/myob/bulk-import-and-relink-suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    let allSuppliers: any[] = [];
    let result: any = await myob.getSuppliers();
    if (result && result.Items) {
      allSuppliers = allSuppliers.concat(result.Items);
      while (result.NextPageLink) {
        result = await myob.getSuppliers(`$top=400&$skip=${allSuppliers.length}`);
        if (result && result.Items) {
          allSuppliers = allSuppliers.concat(result.Items);
        } else {
          break;
        }
      }
    }
    const myobSuppliers = allSuppliers;

    if (myobSuppliers.length === 0) {
      return res.status(400).json({ error: "No suppliers returned from MYOB" });
    }

    logger.info({ count: myobSuppliers.length }, "[MYOB Bulk Import] Fetched suppliers from MYOB");

    let created = 0, linked = 0, skipped = 0;
    const nameToSupplierMap = new Map<string, string>();

    for (const contact of myobSuppliers) {
      const myobUid = contact.UID;
      const myobName = contact.Name || contact.CompanyName || "";
      const myobDisplayId = contact.DisplayID || null;

      if (!myobUid || !myobName) { skipped++; continue; }

      try {
        const normalizedName = myobName.trim().toUpperCase();
        if (nameToSupplierMap.has(normalizedName)) {
          skipped++;
          continue;
        }

        const existingSupplier = await db.select().from(suppliers)
          .where(and(eq(suppliers.companyId, companyId), sql`UPPER(TRIM(${suppliers.name})) = ${normalizedName}`))
          .limit(1);

        let supplierId: string;
        if (existingSupplier.length > 0) {
          supplierId = existingSupplier[0].id;
          linked++;
        } else {
          const [newSupplier] = await db.insert(suppliers).values({ companyId, name: myobName.trim() }).returning();
          supplierId = newSupplier.id;
          created++;
        }

        nameToSupplierMap.set(normalizedName, supplierId);

        const existingMapping = await db.select().from(myobSupplierMappings)
          .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
          .limit(1);

        if (existingMapping.length > 0) {
          await db.update(myobSupplierMappings)
            .set({ myobSupplierUid: myobUid, myobSupplierName: myobName.trim(), myobSupplierDisplayId: myobDisplayId, updatedAt: new Date() })
            .where(eq(myobSupplierMappings.id, existingMapping[0].id));
        } else {
          await db.insert(myobSupplierMappings).values({
            companyId, supplierId, myobSupplierUid: myobUid, myobSupplierName: myobName.trim(), myobSupplierDisplayId: myobDisplayId,
          });
        }
      } catch (itemErr) {
        logger.warn({ err: itemErr, myobName, myobUid }, "[MYOB Bulk Import] Failed to import supplier, skipping");
        skipped++;
      }
    }

    logger.info({ created, linked, skipped }, "[MYOB Bulk Import] Supplier import complete");

    const recordMap = await db.execute(sql`SELECT record_id, old_supplier_name, table_name FROM _temp_record_supplier_map ORDER BY old_supplier_name`);
    const relinkResults: Array<{ supplierName: string; recordId: string; table: string; matched: boolean; newSupplierId?: string }> = [];
    let apUpdated = 0, assetUpdated = 0, hireUpdated = 0, capexUpdated = 0;

    const supplierNameCache = new Map<string, string>();

    for (const row of recordMap.rows as any[]) {
      const { record_id, old_supplier_name, table_name } = row;
      if (!old_supplier_name) continue;

      const normalizedName = old_supplier_name.trim().toUpperCase();
      let newSupplierId = supplierNameCache.get(normalizedName);

      if (!newSupplierId) {
        newSupplierId = nameToSupplierMap.get(normalizedName);
      }

      if (!newSupplierId) {
        const matchedSupplier = await db.select().from(suppliers)
          .where(and(eq(suppliers.companyId, companyId), sql`UPPER(TRIM(${suppliers.name})) = ${normalizedName}`))
          .limit(1);
        if (matchedSupplier.length > 0) {
          newSupplierId = matchedSupplier[0].id;
        }
      }

      if (!newSupplierId) {
        const [newSupplier] = await db.insert(suppliers).values({ companyId, name: old_supplier_name.trim() }).returning();
        newSupplierId = newSupplier.id;
        logger.info({ supplierName: old_supplier_name }, "[MYOB Bulk Import] Created non-MYOB supplier for re-linking");
      }

      supplierNameCache.set(normalizedName, newSupplierId);

      if (table_name === "ap_invoices") {
        await db.execute(sql`UPDATE ap_invoices SET supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
        apUpdated++;
      } else if (table_name === "assets") {
        await db.execute(sql`UPDATE assets SET supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
        assetUpdated++;
      } else if (table_name === "hire_bookings") {
        await db.execute(sql`UPDATE hire_bookings SET supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
        hireUpdated++;
      } else if (table_name === "capex_requests") {
        await db.execute(sql`UPDATE capex_requests SET preferred_supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
        capexUpdated++;
      }

      relinkResults.push({ supplierName: old_supplier_name, recordId: record_id, table: table_name, matched: true, newSupplierId });
    }

    const assetSupplierNames = await db.execute(sql`SELECT DISTINCT old_supplier_id, supplier_name FROM _temp_supplier_names WHERE supplier_name IS NOT NULL AND supplier_name != '' AND table_name = 'assets' ORDER BY supplier_name`);
    for (const row of assetSupplierNames.rows as any[]) {
      const { supplier_name } = row;
      if (!supplier_name) continue;
      const normalizedName = supplier_name.trim().toUpperCase();
      if (!supplierNameCache.has(normalizedName) && !nameToSupplierMap.has(normalizedName)) {
        const matchedSupplier = await db.select().from(suppliers)
          .where(and(eq(suppliers.companyId, companyId), sql`UPPER(TRIM(${suppliers.name})) = ${normalizedName}`))
          .limit(1);
        if (matchedSupplier.length === 0) {
          const [newSupplier] = await db.insert(suppliers).values({ companyId, name: supplier_name.trim() }).returning();
          supplierNameCache.set(normalizedName, newSupplier.id);
        }
      }
    }

    res.json({
      import: { created, linked, skipped, totalMyob: myobSuppliers.length },
      relink: relinkResults,
    });
  } catch (err) {
    handleMyobError(err, res, "bulk-import-and-relink-suppliers");
  }
});

export { router as myobRouter };
