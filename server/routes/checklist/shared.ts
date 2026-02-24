import { eq, and, desc, sql as dsql } from "drizzle-orm";
import { db } from "../../db";
import {
  checklistTemplates,
  checklistWorkOrders,
} from "@shared/schema";
import type { ChecklistSection, ChecklistField } from "@shared/schema";
import logger from "../../lib/logger";

export { Router } from "express";
export type { Request, Response } from "express";
export { eq, and, desc, sql as dsql } from "drizzle-orm";
export { db } from "../../db";
export {
  entityTypes,
  entitySubtypes,
  checklistTemplates,
  checklistInstances,
  checklistWorkOrders,
  users,
  insertEntityTypeSchema,
  insertEntitySubtypeSchema,
  insertChecklistTemplateSchema,
  insertChecklistInstanceSchema,
} from "@shared/schema";
export type { ChecklistSection, ChecklistField } from "@shared/schema";
export { requireAuth, requireRole } from "../middleware/auth.middleware";
export { default as logger } from "../../lib/logger";

const AUTO_TRIGGER_FAILURE_VALUES: Record<string, string[]> = {
  pass_fail_flag: ["fail"],
  yes_no_na: ["no"],
  condition_option: ["poor"],
};

function isAutoTriggerFailure(fieldType: string, responseValue: unknown): boolean {
  const failureValues = AUTO_TRIGGER_FAILURE_VALUES[fieldType];
  if (!failureValues) return false;
  const valueStr = responseValue !== undefined && responseValue !== null && responseValue !== ""
    ? String(responseValue).toLowerCase() : "";
  return failureValues.includes(valueStr);
}

export async function processWorkOrderTriggers(
  companyId: string,
  instanceId: string,
  responses: Record<string, unknown>,
  templateId: string
) {
  try {
    const [template] = await db.select().from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.id, templateId),
        eq(checklistTemplates.companyId, companyId)
      ));
    if (!template?.sections) return;

    const sections = (Array.isArray(template.sections) ? template.sections : []) as ChecklistSection[];

    for (const section of sections) {
      for (const field of (section.items || []) as ChecklistField[]) {
        const responseValue = responses[field.id];
        const valueStr = responseValue !== undefined && responseValue !== null && responseValue !== ""
          ? String(responseValue).toLowerCase() : "";

        let triggerMatches = false;

        if (field.workOrderEnabled) {
          const triggerVal = (field.workOrderTriggerValue || "").toLowerCase();
          triggerMatches = valueStr !== "" && (!triggerVal || valueStr === triggerVal);
        } else {
          triggerMatches = isAutoTriggerFailure(field.type, responseValue);
        }

        const isAutoTriggerType = field.type in AUTO_TRIGGER_FAILURE_VALUES;
        if (!triggerMatches && !field.workOrderEnabled && !isAutoTriggerType) continue;

        const existing = await db.select().from(checklistWorkOrders)
          .where(and(
            eq(checklistWorkOrders.checklistInstanceId, instanceId),
            eq(checklistWorkOrders.fieldId, field.id),
            eq(checklistWorkOrders.companyId, companyId)
          ))
          .limit(100);

        if (triggerMatches) {
          if (existing.length > 0) {
            await db.update(checklistWorkOrders)
              .set({ result: String(responseValue), updatedAt: new Date() })
              .where(eq(checklistWorkOrders.id, existing[0].id));
          } else {
            const isAutoTriggered = !field.workOrderEnabled;
            const inferredType = field.defaultWorkOrderTypeId
              || (field.type === "pass_fail_flag" ? "defect"
                : field.type === "condition_option" ? "defect"
                : field.type === "yes_no_na" ? "safety"
                : "general");
            await db.insert(checklistWorkOrders).values({
              companyId,
              checklistInstanceId: instanceId,
              fieldId: field.id,
              fieldName: field.name,
              sectionName: section.name,
              triggerValue: field.workOrderTriggerValue || (isAutoTriggered ? String(responseValue) : null),
              result: String(responseValue),
              details: isAutoTriggered
                ? `${field.name} auto-detected failure: "${responseValue}" during inspection`
                : `${field.name} reported "${responseValue}" during inspection`,
              workOrderType: inferredType as any,
            });
          }
        } else if (existing.length > 0 && existing[0].status === "open") {
          await db.update(checklistWorkOrders)
            .set({
              status: "cancelled",
              resolutionNotes: "Auto-cancelled: response changed to non-trigger value",
              updatedAt: new Date(),
            })
            .where(eq(checklistWorkOrders.id, existing[0].id));
        }
      }
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to process work order triggers");
  }
}
