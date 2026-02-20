import { db } from "../../db";
import {
  progressClaims,
  progressClaimItems,
  contracts,
} from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import logger from "../../lib/logger";

export { db };
export { requireAuth } from "../middleware/auth.middleware";
export {
  progressClaims,
  progressClaimItems,
  panelRegister,
  jobs,
  contracts,
  panelTypes,
  jobPanelRates,
  users,
  PANEL_LIFECYCLE_STATUS,
} from "@shared/schema";
export { eq, and, sql, desc, count, inArray } from "drizzle-orm";
export { logger };
export type { Request, Response } from "express";
export { Router } from "express";

export function safeParseFinancial(value: string | null | undefined, fallback: number = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = parseFloat(value);
  if (isNaN(parsed) || !isFinite(parsed)) return fallback;
  return parsed;
}

export async function calculateRetention(
  companyId: string,
  jobId: string,
  subtotal: number,
  excludeClaimId?: string
): Promise<{ retentionRate: number; retentionAmount: number; retentionHeldToDate: number }> {
  if (isNaN(subtotal) || !isFinite(subtotal)) {
    logger.warn({ companyId, jobId, subtotal }, "Invalid subtotal passed to calculateRetention");
    return { retentionRate: 0, retentionAmount: 0, retentionHeldToDate: 0 };
  }

  const [contract] = await db
    .select({
      retentionPercentage: contracts.retentionPercentage,
      retentionCap: contracts.retentionCap,
      originalContractValue: contracts.originalContractValue,
      revisedContractValue: contracts.revisedContractValue,
    })
    .from(contracts)
    .where(and(eq(contracts.jobId, jobId), eq(contracts.companyId, companyId)));

  const retentionRate = safeParseFinancial(contract?.retentionPercentage, 10);
  const retentionCapPct = safeParseFinancial(contract?.retentionCap, 5);
  const contractValue = safeParseFinancial(contract?.revisedContractValue || contract?.originalContractValue, 0);

  if (retentionRate < 0 || retentionRate > 100) {
    logger.warn({ retentionRate, jobId }, "Retention rate out of valid range (0-100)");
    return { retentionRate: 0, retentionAmount: 0, retentionHeldToDate: 0 };
  }

  const retentionCapAmount = contractValue > 0 ? contractValue * retentionCapPct / 100 : Infinity;

  let conditions = [
    eq(progressClaims.companyId, companyId),
    eq(progressClaims.jobId, jobId),
    inArray(progressClaims.status, ["APPROVED", "SUBMITTED", "DRAFT"]),
  ];
  if (excludeClaimId) {
    conditions.push(sql`${progressClaims.id} != ${excludeClaimId}`);
  }

  const existingRetention = await db
    .select({
      totalRetention: sql<string>`COALESCE(SUM(CAST(${progressClaims.retentionAmount} AS DECIMAL)), 0)`,
    })
    .from(progressClaims)
    .where(and(...conditions));

  const previousRetention = safeParseFinancial(existingRetention[0]?.totalRetention, 0);

  let thisClaimRetention = subtotal * retentionRate / 100;

  if (previousRetention + thisClaimRetention > retentionCapAmount) {
    thisClaimRetention = Math.max(0, retentionCapAmount - previousRetention);
  }

  return {
    retentionRate,
    retentionAmount: safeParseFinancial(thisClaimRetention.toFixed(2), 0),
    retentionHeldToDate: safeParseFinancial((previousRetention + thisClaimRetention).toFixed(2), 0),
  };
}

export async function getPreviouslyClaimedPercents(
  companyId: string,
  jobId: string,
  excludeClaimId?: string
): Promise<Map<string, number>> {
  let conditions = [
    eq(progressClaims.jobId, jobId),
    eq(progressClaims.companyId, companyId),
    inArray(progressClaims.status, ["APPROVED"]),
  ];
  if (excludeClaimId) {
    conditions.push(sql`${progressClaims.id} != ${excludeClaimId}`);
  }

  const items = await db
    .select({
      panelId: progressClaimItems.panelId,
      percentComplete: progressClaimItems.percentComplete,
    })
    .from(progressClaimItems)
    .innerJoin(progressClaims, eq(progressClaimItems.progressClaimId, progressClaims.id))
    .where(and(...conditions))
    .limit(5000);

  const map = new Map<string, number>();
  for (const item of items) {
    const prev = map.get(item.panelId) || 0;
    map.set(item.panelId, prev + safeParseFinancial(item.percentComplete, 0));
  }
  return map;
}

export function validateClaimItemsPercent(
  claimItems: Array<Record<string, unknown>>,
  previousPercents: Map<string, number>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const item of claimItems) {
    const panelId = item.panelId as string;
    const pct = safeParseFinancial(item.percentComplete as string | null | undefined, 0);
    if (pct <= 0) continue;
    const prevPct = previousPercents.get(panelId) || 0;
    const totalPct = prevPct + pct;
    if (totalPct > 100.005) {
      errors.push(
        `Panel ${item.panelMark}: claiming ${pct}% but ${prevPct}% already claimed (total ${totalPct.toFixed(1)}% exceeds 100%)`
      );
    }
  }
  return { valid: errors.length === 0, errors };
}
