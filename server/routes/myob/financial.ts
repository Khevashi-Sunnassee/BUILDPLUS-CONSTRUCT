import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { createMyobClient } from "../../myob";
import logger from "../../lib/logger";
import { db } from "../../db";
import { myobExportLogs, users, myobSupplierMappings, myobCustomerMappings, jobs, progressClaims, assets } from "@shared/schema";
import { eq, desc, and, asc, sql, gte, lte, not } from "drizzle-orm";
import { apInvoices } from "@shared/schema";
import { handleMyobError } from "./helpers";

const router = Router();

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

router.get("/api/myob/job-invoices/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { jobId } = req.params;

    const [job] = await db.select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (!job.myobJobUid) {
      return res.json({ linked: false, bills: [], invoices: [], job: { id: job.id, name: job.projectName, jobNumber: job.jobNumber } });
    }

    const client = createMyobClient(companyId);
    const myobJobUid = job.myobJobUid;

    const billQuery = `$filter=Lines/any(L: L/Job/UID eq guid'${myobJobUid}')&$orderby=Date desc&$top=1000`;
    const invoiceQuery = `$filter=Lines/any(L: L/Job/UID eq guid'${myobJobUid}')&$orderby=Date desc&$top=1000`;

    const [billResult, invoiceResult] = await Promise.all([
      client.getPurchaseBills(billQuery).catch((e: any) => {
        logger.warn("Failed to fetch job purchase bills", { jobId, error: e.message });
        return { Items: [] };
      }),
      client.getInvoices(invoiceQuery).catch((e: any) => {
        logger.warn("Failed to fetch job sale invoices", { jobId, error: e.message });
        return { Items: [] };
      }),
    ]);

    const bills = (billResult?.Items || []).map((b: any) => ({
      uid: b.UID,
      number: b.Number,
      date: b.Date,
      supplierInvoiceNumber: b.SupplierInvoiceNumber,
      supplierName: b.Supplier?.Name || "",
      status: b.Status,
      subtotal: b.Subtotal,
      totalTax: b.TotalTax,
      totalAmount: b.TotalAmount,
      amountPaid: b.AmountPaid,
      balanceDue: b.BalanceDueAmount,
      comment: b.Comment,
      journalMemo: b.JournalMemo,
    }));

    const invoices = (invoiceResult?.Items || []).map((inv: any) => ({
      uid: inv.UID,
      number: inv.Number,
      date: inv.Date,
      customerPO: inv.CustomerPurchaseOrderNumber,
      customerName: inv.Customer?.Name || "",
      status: inv.Status,
      subtotal: inv.Subtotal,
      totalTax: inv.TotalTax,
      totalAmount: inv.TotalAmount,
      amountPaid: inv.AmountPaid,
      balanceDue: inv.BalanceDueAmount,
      comment: inv.Comment,
      journalMemo: inv.JournalMemo,
    }));

    res.json({
      linked: true,
      myobJobUid,
      job: { id: job.id, name: job.projectName, jobNumber: job.jobNumber },
      bills,
      invoices,
      billCount: bills.length,
      invoiceCount: invoices.length,
    });
  } catch (err) {
    handleMyobError(err, res, "job-invoices");
  }
});

router.get("/api/myob/purchase-bills", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { createMyobClient, getConnectionStatus } = await import("../../myob");
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

export { router as financialRouter };
