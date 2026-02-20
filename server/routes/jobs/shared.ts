import { Request } from "express";
import { storage } from "../../storage";
import { intToPhase, phaseToInt } from "@shared/job-phases";
import type { JobPhase } from "@shared/job-phases";

export async function resolveUserName(req: Request): Promise<string | null> {
  if (req.session?.name) return req.session.name;
  if (req.session?.userId) {
    const user = await storage.getUser(req.session.userId);
    if (user?.name) {
      req.session.name = user.name;
      return user.name;
    }
  }
  return null;
}

export function serializeJobPhase(job: Record<string, unknown>): Record<string, unknown> {
  if (!job) return job;
  return { ...job, jobPhase: intToPhase(job.jobPhase ?? 0) };
}

export function serializeJobsPhase(jobsList: Record<string, unknown>[]): Record<string, unknown>[] {
  return jobsList.map(serializeJobPhase);
}

export function deserializePhase(phaseStr: string): number {
  return phaseToInt(phaseStr as JobPhase);
}

export const OPPORTUNITY_PHASES = [0, 1, 4] as const;
