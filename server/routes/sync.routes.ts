import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { db } from "../db";
import { processedSyncActions } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";

const router = Router();

const syncActionSchema = z.object({
  actionId: z.string().min(1),
  actionType: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  tempId: z.string().optional(),
  payload: z.record(z.unknown()),
  timestamp: z.string(),
});

const batchSyncSchema = z.object({
  deviceId: z.string().optional(),
  actions: z.array(syncActionSchema).max(50),
});

router.post("/api/sync/check-processed", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const { actionIds } = z.object({
      actionIds: z.array(z.string().min(1)).max(100),
    }).parse(req.body);

    const processed: string[] = [];
    for (const actionId of actionIds) {
      const [existing] = await db
        .select({ actionId: processedSyncActions.actionId })
        .from(processedSyncActions)
        .where(
          and(
            eq(processedSyncActions.actionId, actionId),
            eq(processedSyncActions.companyId, companyId)
          )
        )
        .limit(1);
      if (existing) {
        processed.push(actionId);
      }
    }

    res.json({ processedActionIds: processed });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/sync/mark-processed", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const userId = req.session?.userId as string;
    const { actionId, result } = z.object({
      actionId: z.string().min(1),
      result: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const [existing] = await db
      .select({ id: processedSyncActions.id })
      .from(processedSyncActions)
      .where(eq(processedSyncActions.actionId, actionId))
      .limit(1);

    if (existing) {
      return res.json({ alreadyProcessed: true });
    }

    await db.insert(processedSyncActions).values({
      actionId,
      companyId,
      userId,
      result: result || {},
    });

    res.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/sync/cleanup", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(processedSyncActions)
      .where(
        and(
          eq(processedSyncActions.companyId, companyId),
          lt(processedSyncActions.processedAt, cutoff)
        )
      )
      .returning({ id: processedSyncActions.id });

    res.json({ deletedCount: deleted.length });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
