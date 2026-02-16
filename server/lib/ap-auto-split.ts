import { db } from "../db";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { apInvoices, apInvoiceSplits, suppliers, costCodes } from "@shared/schema";
import logger from "./logger";

interface AutoSplitResult {
  costCodeId: string | null;
  costCodeName: string | null;
  costCodeCode: string | null;
  source: "supplier_default" | "supplier_history" | null;
}

export async function resolveSupplierCostCode(
  supplierId: string | null,
  companyId: string
): Promise<AutoSplitResult> {
  if (!supplierId) {
    return { costCodeId: null, costCodeName: null, costCodeCode: null, source: null };
  }

  const [supplier] = await db
    .select({
      defaultCostCodeId: suppliers.defaultCostCodeId,
    })
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, companyId)))
    .limit(1);

  if (supplier?.defaultCostCodeId) {
    const [cc] = await db
      .select({ id: costCodes.id, code: costCodes.code, name: costCodes.name })
      .from(costCodes)
      .where(eq(costCodes.id, supplier.defaultCostCodeId))
      .limit(1);
    if (cc) {
      return {
        costCodeId: cc.id,
        costCodeName: cc.name,
        costCodeCode: cc.code,
        source: "supplier_default",
      };
    }
  }

  const historicCostCodes = await db
    .select({
      costCodeId: apInvoiceSplits.costCodeId,
      usageCount: sql<number>`COUNT(*)::int`,
    })
    .from(apInvoiceSplits)
    .innerJoin(apInvoices, eq(apInvoiceSplits.invoiceId, apInvoices.id))
    .where(
      and(
        eq(apInvoices.supplierId, supplierId),
        eq(apInvoices.companyId, companyId),
        isNotNull(apInvoiceSplits.costCodeId)
      )
    )
    .groupBy(apInvoiceSplits.costCodeId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(1);

  if (historicCostCodes.length > 0 && historicCostCodes[0].costCodeId) {
    const [cc] = await db
      .select({ id: costCodes.id, code: costCodes.code, name: costCodes.name })
      .from(costCodes)
      .where(eq(costCodes.id, historicCostCodes[0].costCodeId))
      .limit(1);
    if (cc) {
      return {
        costCodeId: cc.id,
        costCodeName: cc.name,
        costCodeCode: cc.code,
        source: "supplier_history",
      };
    }
  }

  return { costCodeId: null, costCodeName: null, costCodeCode: null, source: null };
}

export async function resolveSupplierHistoricJob(
  supplierId: string | null,
  companyId: string
): Promise<string | null> {
  if (!supplierId) return null;

  const historicJobs = await db
    .select({
      jobId: apInvoiceSplits.jobId,
      usageCount: sql<number>`COUNT(*)::int`,
    })
    .from(apInvoiceSplits)
    .innerJoin(apInvoices, eq(apInvoiceSplits.invoiceId, apInvoices.id))
    .where(
      and(
        eq(apInvoices.supplierId, supplierId),
        eq(apInvoices.companyId, companyId),
        isNotNull(apInvoiceSplits.jobId)
      )
    )
    .groupBy(apInvoiceSplits.jobId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(1);

  return historicJobs.length > 0 ? historicJobs[0].jobId : null;
}

export async function createAutoSplit(
  invoiceId: string,
  companyId: string,
  supplierId: string | null,
  totalIncGst: number,
  gstAmount: number,
  subtotalExGst: number,
  description: string | null
): Promise<{ created: boolean; costCodeId: string | null; costCodeSource: string | null; jobId: string | null }> {
  const [existingSplit] = await db
    .select({ id: apInvoiceSplits.id })
    .from(apInvoiceSplits)
    .where(eq(apInvoiceSplits.invoiceId, invoiceId))
    .limit(1);

  if (existingSplit) {
    return { created: false, costCodeId: null, costCodeSource: null, jobId: null };
  }

  const amount = totalIncGst > 0 ? totalIncGst : (subtotalExGst > 0 ? subtotalExGst : 0);
  if (amount <= 0) {
    return { created: false, costCodeId: null, costCodeSource: null, jobId: null };
  }

  const costCodeResult = await resolveSupplierCostCode(supplierId, companyId);
  const historicJobId = await resolveSupplierHistoricJob(supplierId, companyId);
  const taxCodeLabel = gstAmount > 0 ? "GST" : "FRE";

  await db.insert(apInvoiceSplits).values({
    invoiceId,
    description: description || "Invoice total",
    percentage: "100",
    amount: amount.toFixed(2),
    taxCodeId: taxCodeLabel,
    costCodeId: costCodeResult.costCodeId,
    jobId: historicJobId,
    sortOrder: 0,
  });

  logger.info(
    {
      invoiceId,
      costCodeId: costCodeResult.costCodeId,
      costCodeSource: costCodeResult.source,
      costCodeName: costCodeResult.costCodeName,
      jobId: historicJobId,
    },
    "[AP AutoSplit] Created auto-split with cost code and job"
  );

  return {
    created: true,
    costCodeId: costCodeResult.costCodeId,
    costCodeSource: costCodeResult.source,
    jobId: historicJobId,
  };
}

export async function getSupplierCostCodeContext(
  supplierId: string | null,
  companyId: string
): Promise<string> {
  if (!supplierId) return "";

  const [supplier] = await db
    .select({
      name: suppliers.name,
      defaultCostCodeId: suppliers.defaultCostCodeId,
    })
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, companyId)))
    .limit(1);

  if (!supplier) return "";

  const lines: string[] = [];

  if (supplier.defaultCostCodeId) {
    const [cc] = await db
      .select({ code: costCodes.code, name: costCodes.name })
      .from(costCodes)
      .where(eq(costCodes.id, supplier.defaultCostCodeId))
      .limit(1);
    if (cc) {
      lines.push(`Default cost code for supplier "${supplier.name}": ${cc.code} - ${cc.name}`);
    }
  }

  const historicCodes = await db
    .select({
      costCodeId: apInvoiceSplits.costCodeId,
      code: costCodes.code,
      name: costCodes.name,
      usageCount: sql<number>`COUNT(*)::int`,
    })
    .from(apInvoiceSplits)
    .innerJoin(apInvoices, eq(apInvoiceSplits.invoiceId, apInvoices.id))
    .innerJoin(costCodes, eq(apInvoiceSplits.costCodeId, costCodes.id))
    .where(
      and(
        eq(apInvoices.supplierId, supplierId),
        eq(apInvoices.companyId, companyId),
        isNotNull(apInvoiceSplits.costCodeId)
      )
    )
    .groupBy(apInvoiceSplits.costCodeId, costCodes.code, costCodes.name)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);

  if (historicCodes.length > 0) {
    lines.push(`Historic cost codes used for supplier "${supplier.name}":`);
    for (const hc of historicCodes) {
      lines.push(`  - ${hc.code} ${hc.name} (used ${hc.usageCount} time${hc.usageCount > 1 ? "s" : ""})`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "";
}
