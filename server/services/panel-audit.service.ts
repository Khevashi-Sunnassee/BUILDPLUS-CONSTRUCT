import { db } from "../db";
import { panelAuditLogs, panelRegister, type InsertPanelAuditLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import logger from "../lib/logger";

export function logPanelAudit(entry: InsertPanelAuditLog): void {
  db.insert(panelAuditLogs).values(entry).catch((err) => {
    logger.error({ err, panelId: entry.panelId }, "Failed to log panel audit entry");
  });
}

export function logPanelChange(
  panelId: string,
  action: string,
  changedById?: string,
  opts?: {
    changedFields?: Record<string, any>;
    previousLifecycleStatus?: number;
    newLifecycleStatus?: number;
  }
): void {
  logPanelAudit({
    panelId,
    action,
    changedById: changedById || null,
    changedFields: opts?.changedFields || null,
    previousLifecycleStatus: opts?.previousLifecycleStatus ?? null,
    newLifecycleStatus: opts?.newLifecycleStatus ?? null,
  });
}

export async function updatePanelLifecycleStatus(
  panelId: string,
  newStatus: number,
  action: string,
  changedById?: string,
  extraFields?: Record<string, any>
): Promise<void> {
  try {
    const [panel] = await db.select({ lifecycleStatus: panelRegister.lifecycleStatus })
      .from(panelRegister)
      .where(eq(panelRegister.id, panelId));

    if (!panel) return;

    const prevStatus = panel.lifecycleStatus;

    await db.update(panelRegister)
      .set({ lifecycleStatus: newStatus, updatedAt: new Date() })
      .where(eq(panelRegister.id, panelId));

    logPanelChange(panelId, action, changedById, {
      changedFields: extraFields,
      previousLifecycleStatus: prevStatus,
      newLifecycleStatus: newStatus,
    });
  } catch (err: any) {
    logger.error({ err, panelId }, "Failed to update panel lifecycle status");
  }
}

export async function advancePanelLifecycleIfLower(
  panelId: string,
  targetStatus: number,
  action: string,
  changedById?: string,
  extraFields?: Record<string, any>
): Promise<void> {
  try {
    const [panel] = await db.select({ lifecycleStatus: panelRegister.lifecycleStatus })
      .from(panelRegister)
      .where(eq(panelRegister.id, panelId));

    if (!panel) return;
    if (panel.lifecycleStatus >= targetStatus) {
      logPanelChange(panelId, action, changedById, { changedFields: extraFields });
      return;
    }

    await db.update(panelRegister)
      .set({ lifecycleStatus: targetStatus, updatedAt: new Date() })
      .where(eq(panelRegister.id, panelId));

    logPanelChange(panelId, action, changedById, {
      changedFields: extraFields,
      previousLifecycleStatus: panel.lifecycleStatus,
      newLifecycleStatus: targetStatus,
    });
  } catch (err: any) {
    logger.error({ err, panelId }, "Failed to advance panel lifecycle status");
  }
}
