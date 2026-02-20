import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import {
  checklistTemplates,
  checklistWorkOrders,
} from "@shared/schema";
import type { ChecklistSection, ChecklistField } from "@shared/schema";
import logger from "../../lib/logger";

export { Router } from "express";
export type { Request, Response } from "express";
export { eq, and, desc } from "drizzle-orm";
export { db } from "../../db";
export {
  entityTypes,
  entitySubtypes,
  checklistTemplates,
  checklistInstances,
  checklistWorkOrders,
  insertEntityTypeSchema,
  insertEntitySubtypeSchema,
  insertChecklistTemplateSchema,
  insertChecklistInstanceSchema,
} from "@shared/schema";
export type { ChecklistSection, ChecklistField } from "@shared/schema";
export { requireAuth, requireRole } from "../middleware/auth.middleware";
export { default as logger } from "../../lib/logger";

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
        if (!field.workOrderEnabled) continue;

        const responseValue = responses[field.id];
        const triggerVal = (field.workOrderTriggerValue || "").toLowerCase();
        const valueStr = responseValue !== undefined && responseValue !== null && responseValue !== ""
          ? String(responseValue).toLowerCase() : "";

        const triggerMatches = valueStr !== "" && (!triggerVal || valueStr === triggerVal);

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
            await db.insert(checklistWorkOrders).values({
              companyId,
              checklistInstanceId: instanceId,
              fieldId: field.id,
              fieldName: field.name,
              sectionName: section.name,
              triggerValue: field.workOrderTriggerValue || null,
              result: String(responseValue),
              details: `${field.name} reported "${responseValue}" during inspection`,
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
