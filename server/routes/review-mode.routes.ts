import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "./middleware/auth.middleware";
import { reviewModeMethods } from "../storage/review-mode";
import { generatePacket, packetToMarkdown, runReview, mergeTaskpacks, sanitizeContent } from "../services/review-engine";
import { db } from "../db";
import { reviewContextVersions } from "@shared/schema";
import logger from "../lib/logger";

const router = Router();

router.get("/api/super-admin/review-mode/contexts", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const contexts = await reviewModeMethods.getContextVersions();
    res.json(contexts);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to fetch context versions");
    res.status(500).json({ error: "Failed to fetch context versions" });
  }
});

const createContextSchema = z.object({
  name: z.string().min(1).max(200),
  contentMd: z.string().min(10),
});

router.post("/api/super-admin/review-mode/contexts", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createContextSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const ctx = await reviewModeMethods.createContextVersion({
      name: parsed.data.name,
      contentMd: parsed.data.contentMd,
      createdByUserId: req.session.userId || null,
      isActive: false,
    });
    res.json(ctx);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to create context version");
    res.status(500).json({ error: "Failed to create context version" });
  }
});

router.post("/api/super-admin/review-mode/contexts/:id/activate", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await reviewModeMethods.activateContextVersion(req.params.id);
    res.json({ ok: true });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to activate context version");
    res.status(500).json({ error: "Failed to activate context version" });
  }
});

router.get("/api/super-admin/review-mode/targets", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const targets = await reviewModeMethods.getTargets();
    res.json(targets);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to fetch targets");
    res.status(500).json({ error: "Failed to fetch targets" });
  }
});

const createTargetSchema = z.object({
  targetType: z.enum(["DESKTOP_PAGE", "MOBILE_PAGE"]),
  routePath: z.string().min(1),
  pageTitle: z.string().min(1).max(200),
  module: z.string().min(1).max(100),
  frontendEntryFile: z.string().min(1),
});

router.post("/api/super-admin/review-mode/targets", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createTargetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const target = await reviewModeMethods.createTarget(parsed.data);
    res.json(target);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to create target");
    res.status(500).json({ error: "Failed to create target" });
  }
});

const generatePacketSchema = z.object({
  targetId: z.string().min(1),
  contextVersionId: z.string().optional(),
  purpose: z.string().optional().default(""),
  roles: z.array(z.string()).optional().default([]),
  keyUserFlows: z.array(z.string()).optional().default([]),
  knownIssues: z.array(z.string()).optional().default([]),
  riskFocus: z.array(z.string()).optional().default([]),
  additionalFiles: z.array(z.string()).optional().default([]),
  additionalEndpoints: z.array(z.string()).optional().default([]),
});

router.post("/api/super-admin/review-mode/packets/generate", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = generatePacketSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const target = await reviewModeMethods.getTarget(parsed.data.targetId);
    if (!target) return res.status(404).json({ error: "Target not found" });

    let contextVersionId = parsed.data.contextVersionId;
    if (!contextVersionId) {
      const activeCtx = await reviewModeMethods.getActiveContextVersion();
      if (!activeCtx) return res.status(400).json({ error: "No active context version. Create and activate one first." });
      contextVersionId = activeCtx.id;
    }

    const packetData = generatePacket(
      {
        routePath: target.routePath,
        targetType: target.targetType,
        pageTitle: target.pageTitle,
        module: target.module,
        frontendEntryFile: target.frontendEntryFile,
      },
      {
        purpose: parsed.data.purpose,
        roles: parsed.data.roles,
        keyUserFlows: parsed.data.keyUserFlows,
        knownIssues: parsed.data.knownIssues,
        riskFocus: parsed.data.riskFocus,
      },
      {
        additionalFiles: parsed.data.additionalFiles,
        additionalEndpoints: parsed.data.additionalEndpoints,
      }
    );

    const packetMd = packetToMarkdown(packetData);

    const packet = await reviewModeMethods.createPacket({
      targetId: target.id,
      contextVersionId,
      packetJson: packetData,
      packetMd,
      createdByUserId: req.session.userId || null,
      status: "GENERATED",
      purpose: parsed.data.purpose,
      roles: parsed.data.roles,
      keyUserFlows: parsed.data.keyUserFlows,
      knownIssues: parsed.data.knownIssues,
      riskFocus: parsed.data.riskFocus,
    });

    res.json(packet);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to generate packet");
    res.status(500).json({ error: "Failed to generate packet" });
  }
});

router.get("/api/super-admin/review-mode/packets", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const packets = await reviewModeMethods.getPackets();
    res.json(packets);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch packets" });
  }
});

router.get("/api/super-admin/review-mode/packets/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const packet = await reviewModeMethods.getPacket(req.params.id);
    if (!packet) return res.status(404).json({ error: "Packet not found" });

    const runs = await reviewModeMethods.getRunsForPacket(packet.id);
    const taskpacks = await reviewModeMethods.getTaskpacksForPacket(packet.id);
    const target = await reviewModeMethods.getTarget(packet.targetId);

    res.json({ ...packet, runs, taskpacks, target });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch packet" });
  }
});

const runReviewSchema = z.object({
  packetId: z.string().min(1),
  reviewer: z.enum(["REPLIT_CLAUDE", "OPENAI"]),
});

router.post("/api/super-admin/review-mode/runs", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = runReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const packet = await reviewModeMethods.getPacket(parsed.data.packetId);
    if (!packet) return res.status(404).json({ error: "Packet not found" });

    const [contextVersion] = await db
      .select()
      .from(reviewContextVersions)
      .where(eq(reviewContextVersions.id, packet.contextVersionId))
      .limit(1);

    if (!contextVersion) return res.status(400).json({ error: "Context version not found" });

    const run = await reviewModeMethods.createRun({
      packetId: packet.id,
      reviewer: parsed.data.reviewer,
      status: "PENDING",
    });

    res.json({ runId: run.id, status: "PENDING", message: "Review started" });

    (async () => {
      try {
        const result = await runReview(
          sanitizeContent(contextVersion.contentMd),
          packet.packetJson as any,
          parsed.data.reviewer
        );

        await reviewModeMethods.updateRun(run.id, {
          promptMd: result.promptMd,
          responseMd: result.responseMd,
          responseJson: result.responseJson,
          modelName: result.modelName,
          durationMs: result.durationMs,
          status: "SUCCESS",
        });
        logger.info({ runId: run.id, reviewer: parsed.data.reviewer }, "Review run completed");
      } catch (error: any) {
        await reviewModeMethods.updateRun(run.id, {
          status: "FAILED",
          responseMd: `Error: ${error.message}`,
        });
        logger.error({ runId: run.id, error: error.message }, "Review run failed");
      }
    })();

  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to start review run");
    res.status(500).json({ error: "Failed to start review run" });
  }
});

router.get("/api/super-admin/review-mode/runs/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const run = await reviewModeMethods.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch run" });
  }
});

const mergeTaskpackSchema = z.object({
  packetId: z.string().min(1),
});

router.post("/api/super-admin/review-mode/taskpacks/merge", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = mergeTaskpackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const runs = await reviewModeMethods.getRunsForPacket(parsed.data.packetId);
    const successRuns = runs.filter(r => r.status === "SUCCESS");
    if (successRuns.length === 0) return res.status(400).json({ error: "No successful runs to merge" });

    const runA = successRuns.find(r => r.reviewer === "REPLIT_CLAUDE") || null;
    const runB = successRuns.find(r => r.reviewer === "OPENAI") || null;

    const merged = mergeTaskpacks(
      runA ? { responseJson: runA.responseJson, reviewer: runA.reviewer } : null,
      runB ? { responseJson: runB.responseJson, reviewer: runB.reviewer } : null
    );

    const taskpack = await reviewModeMethods.createTaskpack({
      packetId: parsed.data.packetId,
      mergedTasksMd: merged.mergedTasksMd,
      mergedTasksJson: merged.mergedTasksJson,
      createdByUserId: req.session.userId || null,
    });

    res.json(taskpack);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to merge taskpacks");
    res.status(500).json({ error: "Failed to merge taskpacks" });
  }
});

router.get("/api/super-admin/review-mode/taskpacks", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const packetId = req.query.packetId as string;
    if (!packetId) return res.status(400).json({ error: "packetId required" });
    const taskpacks = await reviewModeMethods.getTaskpacksForPacket(packetId);
    res.json(taskpacks);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch taskpacks" });
  }
});

export const reviewModeRouter = router;
