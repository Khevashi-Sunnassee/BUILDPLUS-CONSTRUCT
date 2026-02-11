import { db } from "../db";
import { jobMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import type { Request } from "express";

export async function getAllowedJobIds(req: Request): Promise<Set<string> | null> {
  const user = await storage.getUser(req.session.userId!);
  if (!user) return new Set();

  if (user.role === "ADMIN" || user.role === "MANAGER") {
    return null;
  }

  const memberships = await db.select({ jobId: jobMembers.jobId })
    .from(jobMembers)
    .where(eq(jobMembers.userId, user.id));
  return new Set(memberships.map(m => m.jobId));
}

export async function isJobMember(req: Request, jobId: string): Promise<boolean> {
  const allowedIds = await getAllowedJobIds(req);
  if (allowedIds === null) return true;
  return allowedIds.has(jobId);
}
