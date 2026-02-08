import { db } from "../db";
import { jobAuditLogs, type InsertJobAuditLog } from "@shared/schema";
import logger from "../lib/logger";

export function logJobAudit(entry: InsertJobAuditLog): void {
  db.insert(jobAuditLogs).values(entry).catch((err) => {
    logger.error({ err, jobId: entry.jobId }, "Failed to log job audit entry");
  });
}

export function logJobChange(
  jobId: string,
  action: string,
  changedById: string | null,
  changedByName: string | null,
  opts?: {
    changedFields?: Record<string, any>;
    previousPhase?: string;
    newPhase?: string;
    previousStatus?: string;
    newStatus?: string;
  }
): void {
  logJobAudit({
    jobId,
    action,
    changedById: changedById || null,
    changedByName: changedByName || null,
    changedFields: opts?.changedFields || null,
    previousPhase: opts?.previousPhase || null,
    newPhase: opts?.newPhase || null,
    previousStatus: opts?.previousStatus || null,
    newStatus: opts?.newStatus || null,
  });
}

export function logJobPhaseChange(
  jobId: string,
  previousPhase: string,
  newPhase: string,
  previousStatus: string,
  newStatus: string | null,
  changedById: string | null,
  changedByName: string | null
): void {
  logJobChange(jobId, "PHASE_CHANGE", changedById, changedByName, {
    previousPhase,
    newPhase,
    previousStatus,
    newStatus: newStatus || undefined,
  });
}

export function logJobStatusChange(
  jobId: string,
  phase: string,
  previousStatus: string,
  newStatus: string,
  changedById: string | null,
  changedByName: string | null
): void {
  logJobChange(jobId, "STATUS_CHANGE", changedById, changedByName, {
    previousPhase: phase,
    newPhase: phase,
    previousStatus,
    newStatus,
  });
}
