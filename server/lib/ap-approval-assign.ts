import logger from "./logger";
import { db } from "../db";
import { eq, and, asc, inArray, notInArray } from "drizzle-orm";
import {
  apInvoices, apInvoiceSplits, apInvoiceApprovals,
  apApprovalRules, apInvoiceActivity
} from "@shared/schema";
import type { ApApprovalCondition } from "@shared/schema";

async function logActivity(invoiceId: string, activityType: string, message: string, actorUserId?: string, metaJson?: any) {
  await db.insert(apInvoiceActivity).values({
    invoiceId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

export async function assignApprovalPathToInvoice(
  invoiceId: string,
  companyId: string,
  actorUserId?: string
): Promise<{ matched: boolean; ruleName: string | null; approverCount: number }> {
  const [invoice] = await db.select().from(apInvoices)
    .where(and(eq(apInvoices.id, invoiceId), eq(apInvoices.companyId, companyId)))
    .limit(1);

  if (!invoice) {
    logger.warn({ invoiceId }, "[ApprovalAssign] Invoice not found");
    return { matched: false, ruleName: null, approverCount: 0 };
  }

  await db.delete(apInvoiceApprovals).where(eq(apInvoiceApprovals.invoiceId, invoiceId));

  const rules = await db.select().from(apApprovalRules)
    .where(and(eq(apApprovalRules.companyId, companyId), eq(apApprovalRules.isActive, true)))
    .orderBy(asc(apApprovalRules.priority));

  if (rules.length === 0) {
    logger.info({ invoiceId, companyId }, "[ApprovalAssign] No active approval rules found");
    return { matched: false, ruleName: null, approverCount: 0 };
  }

  const invoiceTotal = parseFloat(invoice.totalInc || invoice.totalEx || "0");

  const splits = await db.select().from(apInvoiceSplits)
    .where(eq(apInvoiceSplits.invoiceId, invoiceId));

  const splitJobIds = splits.map(s => s.jobId).filter(Boolean) as string[];
  const splitCostCodeIds = splits.map(s => s.costCodeId).filter(Boolean) as string[];

  function evaluateCondition(cond: ApApprovalCondition): boolean {
    const { field, operator, values } = cond;
    if (!values || values.length === 0) return true;

    if (field === "COMPANY") {
      const invoiceVal = invoice.companyId;
      if (operator === "EQUALS") return values.some(v => v === invoiceVal);
      if (operator === "NOT_EQUALS") return values.every(v => v !== invoiceVal);
      return false;
    }

    if (field === "AMOUNT") {
      const condVal = parseFloat(values[0]);
      if (isNaN(condVal)) return false;
      switch (operator) {
        case "EQUALS": return invoiceTotal === condVal;
        case "NOT_EQUALS": return invoiceTotal !== condVal;
        case "GREATER_THAN": return invoiceTotal > condVal;
        case "LESS_THAN": return invoiceTotal < condVal;
        case "GREATER_THAN_OR_EQUALS": return invoiceTotal >= condVal;
        case "LESS_THAN_OR_EQUALS": return invoiceTotal <= condVal;
        default: return false;
      }
    }

    if (field === "JOB") {
      if (operator === "EQUALS") return splitJobIds.some(jId => values.includes(jId));
      return false;
    }

    if (field === "SUPPLIER") {
      const invoiceVal = invoice.supplierId || "";
      if (operator === "EQUALS") return values.some(v => v === invoiceVal);
      if (operator === "NOT_EQUALS") return values.every(v => v !== invoiceVal);
      return false;
    }

    if (field === "GL_CODE") {
      if (operator === "EQUALS") return splitCostCodeIds.some(ccId => values.includes(ccId));
      return false;
    }

    return false;
  }

  function ruleMatchesInvoice(rule: typeof rules[number]): boolean {
    const ruleType = (rule as any).ruleType || "USER";
    if (ruleType === "USER_CATCH_ALL") return true;

    const conditionsData = rule.conditions as any;
    if (!conditionsData) return true;

    if (Array.isArray(conditionsData)) {
      if (conditionsData.length === 0) return true;
      return conditionsData.every((cond: ApApprovalCondition) => evaluateCondition(cond));
    }

    if (typeof conditionsData === "object" && conditionsData !== null) {
      if (conditionsData.minAmount && invoiceTotal < parseFloat(conditionsData.minAmount)) return false;
      if (conditionsData.maxAmount && invoiceTotal > parseFloat(conditionsData.maxAmount)) return false;
      if (conditionsData.supplierId && conditionsData.supplierId !== invoice.supplierId) return false;
      return true;
    }

    return true;
  }

  let matchedRule: typeof rules[number] | null = null;
  for (const rule of rules) {
    if (ruleMatchesInvoice(rule)) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    logger.info({ invoiceId, companyId, rulesCount: rules.length }, "[ApprovalAssign] No rule matched invoice");
    return { matched: false, ruleName: null, approverCount: 0 };
  }

  const ruleType = (matchedRule as any).ruleType || "USER";
  logger.info({ invoiceId, ruleId: matchedRule.id, ruleName: matchedRule.name, ruleType, approverCount: matchedRule.approverUserIds.length }, "[ApprovalAssign] Matched rule");

  if (ruleType === "AUTO_APPROVE" || matchedRule.autoApprove) {
    await logActivity(invoiceId, "approval_path_assigned", `Auto-approve rule matched: ${matchedRule.name}`, actorUserId, { ruleId: matchedRule.id, autoApprove: true });
    return { matched: true, ruleName: matchedRule.name, approverCount: 0 };
  }

  for (let i = 0; i < matchedRule.approverUserIds.length; i++) {
    await db.insert(apInvoiceApprovals).values({
      invoiceId,
      stepIndex: i,
      approverUserId: matchedRule.approverUserIds[i],
      status: "PENDING",
      ruleId: matchedRule.id,
    });
  }

  await logActivity(invoiceId, "approval_path_assigned", `Approval path assigned: ${matchedRule.name} (${matchedRule.approverUserIds.length} approver(s))`, actorUserId, {
    ruleId: matchedRule.id,
    approverCount: matchedRule.approverUserIds.length,
  });

  logger.info({ invoiceId, ruleName: matchedRule.name, approverCount: matchedRule.approverUserIds.length }, "[ApprovalAssign] Approval path assigned");

  return { matched: true, ruleName: matchedRule.name, approverCount: matchedRule.approverUserIds.length };
}

export async function reassignApprovalPathsForCompany(companyId: string): Promise<number> {
  const eligibleStatuses = ["PROCESSED", "CONFIRMED", "IMPORTED"];

  const invoices = await db.select({ id: apInvoices.id }).from(apInvoices)
    .where(and(
      eq(apInvoices.companyId, companyId),
      inArray(apInvoices.status, eligibleStatuses as any)
    ));

  logger.info({ companyId, invoiceCount: invoices.length }, "[ApprovalAssign] Reassigning approval paths for company");

  let assignedCount = 0;
  for (const inv of invoices) {
    const result = await assignApprovalPathToInvoice(inv.id, companyId);
    if (result.matched) assignedCount++;
  }

  logger.info({ companyId, assignedCount, totalChecked: invoices.length }, "[ApprovalAssign] Reassignment complete");
  return assignedCount;
}
