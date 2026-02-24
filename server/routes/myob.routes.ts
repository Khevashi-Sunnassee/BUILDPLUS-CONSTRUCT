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
import { myobTokens, myobExportLogs, users, myobAccountMappings, myobTaxCodeMappings, myobSupplierMappings, costCodes, suppliers } from "@shared/schema";
import { eq, desc, and, asc } from "drizzle-orm";

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

    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const monthRanges: { start: string; end: string; label: string }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
      monthRanges.push({ start, end, label });
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

export { router as myobRouter };
