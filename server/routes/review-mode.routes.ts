import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { requireSuperAdmin } from "./middleware/auth.middleware";
import { reviewModeMethods } from "../storage/review-mode";
import { generatePacket, packetToMarkdown, runReview, mergeTaskpacks, sanitizeContent } from "../services/review-engine";
import { db } from "../db";
import { reviewContextVersions, reviewManualAssessments } from "@shared/schema";
import { desc, sql } from "drizzle-orm";
import logger from "../lib/logger";

interface DiscoveredPage {
  targetType: "DESKTOP_PAGE" | "MOBILE_PAGE";
  routePath: string;
  pageTitle: string;
  module: string;
  frontendEntryFile: string;
  componentName: string;
}

function discoverPagesFromAppTsx(): DiscoveredPage[] {
  const appTsxPath = path.resolve(process.cwd(), "client/src/App.tsx");
  if (!fs.existsSync(appTsxPath)) return [];
  const content = fs.readFileSync(appTsxPath, "utf-8");

  const componentFileMap = new Map<string, string>();

  const lazyRegex = /const\s+(\w+)\s*=\s*lazyWithRetry\(\s*\(\)\s*=>\s*import\(\s*["']@\/pages\/([^"']+)["']\s*\)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = lazyRegex.exec(content)) !== null) {
    componentFileMap.set(match[1], `client/src/pages/${match[2]}.tsx`);
  }

  const directImportRegex = /import\s+(\w+)\s+from\s+["']@\/pages\/([^"']+)["']/g;
  while ((match = directImportRegex.exec(content)) !== null) {
    componentFileMap.set(match[1], `client/src/pages/${match[2]}.tsx`);
  }

  const pages: DiscoveredPage[] = [];
  const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
  const skipPaths = new Set(["/login", "/mobile/login", "/register/:token", "/bundle/:qrCodeId"]);

  while ((match = routeRegex.exec(content)) !== null) {
    const routePath = match[1];
    if (skipPaths.has(routePath)) continue;

    const afterRoute = content.substring(match.index, match.index + 600);

    if (/<Redirect\s/.test(afterRoute.split("</Route>")[0] || afterRoute.slice(0, 300))) continue;

    const closingIdx = afterRoute.indexOf("</Route>");
    const routeBlock = closingIdx > 0 ? afterRoute.substring(0, closingIdx) : afterRoute.slice(0, 400);

    const allTags = [...routeBlock.matchAll(/<([A-Z][A-Za-z0-9]+)[\s/>]/g)];
    let componentName: string | null = null;
    for (const tagMatch of allTags) {
      const tag = tagMatch[1];
      if (componentFileMap.has(tag)) {
        componentName = tag;
        break;
      }
    }
    if (!componentName) continue;

    let entryFile = componentFileMap.get(componentName)!;
    if (!fs.existsSync(path.resolve(process.cwd(), entryFile))) {
      const tsxAlt = entryFile.replace(/\.tsx$/, "/index.tsx");
      if (fs.existsSync(path.resolve(process.cwd(), tsxAlt))) {
        entryFile = tsxAlt;
      }
    }

    const isMobile = routePath.startsWith("/mobile");
    const targetType = isMobile ? "MOBILE_PAGE" : "DESKTOP_PAGE";

    const title = componentName
      .replace(/^Mobile/, "")
      .replace(/Page$/, "")
      .replace(/([A-Z])/g, " $1")
      .trim();

    const module = deriveModule(routePath);

    pages.push({
      targetType,
      routePath,
      pageTitle: title,
      module,
      frontendEntryFile: entryFile,
      componentName,
    });
  }

  const seen = new Set<string>();
  return pages.filter(p => {
    const key = `${p.targetType}::${p.routePath}::${p.componentName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deriveModule(routePath: string): string {
  const cleanPath = routePath.replace(/^\/mobile/, "").replace(/^\//, "");
  const segment = cleanPath.split("/")[0] || "dashboard";

  const moduleMap: Record<string, string> = {
    "dashboard": "Dashboard",
    "daily-reports": "Daily Reports",
    "manual-entry": "Time Management",
    "reports": "Reports",
    "downloads": "Reports",
    "production-report": "Production",
    "kpi-dashboard": "Analytics",
    "logistics": "Logistics",
    "weekly-wages": "Finance",
    "weekly-job-logs": "Reports",
    "production-slots": "Production",
    "production-schedule": "Production",
    "drafting-program": "Drafting",
    "purchase-orders": "Procurement",
    "capex-requests": "Finance",
    "ap-invoices": "Finance",
    "hire-bookings": "Hire Management",
    "tenders": "Tenders",
    "scopes": "Scope of Works",
    "jobs": "Jobs",
    "tasks": "Tasks",
    "chat": "Communication",
    "documents": "Documents",
    "document-register": "Documents",
    "photo-gallery": "Documents",
    "panel": "Panels",
    "panels": "Panels",
    "manager": "Management",
    "admin": "Admin",
    "super-admin": "Super Admin",
    "contracts": "Contracts",
    "progress-claims": "Finance",
    "sales-pipeline": "Sales",
    "help": "Help",
    "knowledge-base": "Knowledge Base",
    "broadcast": "Communication",
    "checklists": "Checklists",
    "checklist-reports": "Checklists",
    "mail-register": "Email",
    "tender-emails": "Email",
    "drafting-emails": "Email",
    "myob-integration": "Integration",
    "pm-call-logs": "PM Call Logs",
    "procurement-reo": "Procurement",
    "procurement": "Procurement",
    "scan": "Mobile Tools",
    "more": "Navigation",
    "profile": "User",
    "weekly-report": "Reports",
    "email-processing": "Email",
    "ap-approvals": "Finance",
    "opportunities": "Sales",
    "photo-capture": "Documents",
  };

  return moduleMap[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

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
    await reviewModeMethods.activateContextVersion(req.params.id as string);
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

router.get("/api/super-admin/review-mode/discover", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const discovered = discoverPagesFromAppTsx();
    res.json(discovered);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to discover pages");
    res.status(500).json({ error: "Failed to discover pages" });
  }
});

router.post("/api/super-admin/review-mode/targets/bulk", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = z.array(createTargetSchema).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const existingTargets = await reviewModeMethods.getTargets();
    const existingKeys = new Set(existingTargets.map(t => `${t.targetType}::${t.routePath}`));

    const created = [];
    let skipped = 0;
    for (const target of parsed.data) {
      const key = `${target.targetType}::${target.routePath}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      existingKeys.add(key);
      const t = await reviewModeMethods.createTarget(target);
      created.push(t);
    }
    res.json({ created, skipped });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to bulk create targets");
    res.status(500).json({ error: "Failed to bulk create targets" });
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
    const packet = await reviewModeMethods.getPacket(req.params.id as string);
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
    const run = await reviewModeMethods.getRun(req.params.id as string);
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

router.post("/api/super-admin/review-mode/packets/:id/score", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const packetId = req.params.id as string;
    const packet = await reviewModeMethods.getPacket(packetId);
    if (!packet) return res.status(404).json({ error: "Packet not found" });

    const runs = await reviewModeMethods.getRunsForPacket(packetId);
    const successRuns = runs.filter(r => r.status === "SUCCESS");

    if (successRuns.length === 0) return res.status(400).json({ error: "No successful reviews to score from" });

    const scores: any[] = [];
    for (const run of successRuns) {
      const json = run.responseJson as any;
      if (json?.score) scores.push(json.score);
    }

    if (scores.length === 0) return res.status(400).json({ error: "No scores found in review results" });

    const avgBreakdown: Record<string, number> = {};
    const breakdownKeys = ["functionality", "uiUx", "security", "performance", "codeQuality", "dataIntegrity", "errorHandling", "accessibility"];

    for (const key of breakdownKeys) {
      const vals = scores.map(s => s.breakdown?.[key]).filter((v: any) => typeof v === "number");
      avgBreakdown[key] = vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 3;
    }

    const overallScore = Math.round(
      Object.values(avgBreakdown).reduce((a, b) => a + b, 0) / breakdownKeys.length
    );

    const scoreBreakdown = { ...avgBreakdown, reviewerScores: scores };

    await reviewModeMethods.updatePacket(packetId, {
      score: overallScore,
      scoreBreakdown,
    });

    await reviewModeMethods.updateTarget(packet.targetId, {
      latestScore: overallScore,
      latestScoreBreakdown: scoreBreakdown,
      lastReviewedAt: new Date(),
    });

    res.json({ score: overallScore, breakdown: scoreBreakdown });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to calculate score");
    res.status(500).json({ error: "Failed to calculate score" });
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

const createAuditSchema = z.object({
  targetId: z.string().min(1),
  overallScore: z.number().min(1).max(5),
  scoreBreakdown: z.object({
    functionality: z.number().min(1).max(5),
    uiUx: z.number().min(1).max(5),
    security: z.number().min(1).max(5),
    performance: z.number().min(1).max(5),
    codeQuality: z.number().min(1).max(5),
    dataIntegrity: z.number().min(1).max(5),
    errorHandling: z.number().min(1).max(5),
    accessibility: z.number().min(1).max(5),
  }),
  findingsMd: z.string().optional(),
  fixesAppliedMd: z.string().optional(),
  issuesFound: z.number().min(0).optional().default(0),
  issuesFixed: z.number().min(0).optional().default(0),
  status: z.enum(["REVIEWED", "FIXES_APPLIED", "RE_REVIEW_NEEDED"]).optional().default("REVIEWED"),
});

router.post("/api/super-admin/review-mode/audits", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createAuditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const target = await reviewModeMethods.getTarget(parsed.data.targetId);
    if (!target) return res.status(404).json({ error: "Target not found" });

    const audit = await reviewModeMethods.createAudit({
      targetId: parsed.data.targetId,
      overallScore: parsed.data.overallScore,
      scoreBreakdown: parsed.data.scoreBreakdown,
      findingsMd: parsed.data.findingsMd || null,
      fixesAppliedMd: parsed.data.fixesAppliedMd || null,
      issuesFound: parsed.data.issuesFound,
      issuesFixed: parsed.data.issuesFixed,
      status: parsed.data.status,
    });

    await reviewModeMethods.updateTarget(parsed.data.targetId, {
      latestScore: parsed.data.overallScore,
      latestScoreBreakdown: parsed.data.scoreBreakdown,
      lastReviewedAt: new Date(),
    });

    res.json(audit);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to create audit");
    res.status(500).json({ error: "Failed to create audit" });
  }
});

router.get("/api/super-admin/review-mode/audits", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const targetId = req.query.targetId as string | undefined;
    if (targetId) {
      const audits = await reviewModeMethods.getAuditsForTarget(targetId);
      res.json(audits);
    } else {
      const audits = await reviewModeMethods.getAllAudits();
      res.json(audits);
    }
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to fetch audits");
    res.status(500).json({ error: "Failed to fetch audits" });
  }
});

router.patch("/api/super-admin/review-mode/audits/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const updateSchema = z.object({
      fixesAppliedMd: z.string().optional(),
      issuesFixed: z.number().min(0).optional(),
      status: z.enum(["REVIEWED", "FIXES_APPLIED", "RE_REVIEW_NEEDED"]).optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const audit = await reviewModeMethods.updateAudit(req.params.id as string, parsed.data as any);
    res.json(audit);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to update audit");
    res.status(500).json({ error: "Failed to update audit" });
  }
});

router.get("/api/super-admin/review-mode/queue", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const targets = await reviewModeMethods.getTargets();
    const unreviewed = targets.filter(t => !t.lastReviewedAt);
    const needsWork = targets.filter(t => t.latestScore !== null && t.latestScore < 4).sort((a, b) => (a.latestScore || 0) - (b.latestScore || 0));
    const reviewed = targets.filter(t => t.latestScore !== null && t.latestScore >= 4).sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));

    res.json({
      unreviewed,
      needsWork,
      reviewed,
      stats: {
        total: targets.length,
        unreviewedCount: unreviewed.length,
        needsWorkCount: needsWork.length,
        reviewedCount: reviewed.length,
        avgScore: targets.filter(t => t.latestScore).length > 0
          ? Math.round(targets.filter(t => t.latestScore).reduce((sum, t) => sum + (t.latestScore || 0), 0) / targets.filter(t => t.latestScore).length * 10) / 10
          : null,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to fetch review queue");
    res.status(500).json({ error: "Failed to fetch review queue" });
  }
});

const manualAssessmentSchema = z.object({
  targetId: z.string().min(1),
  percentComplete: z.number().min(0).max(100),
  starRating: z.number().min(1).max(5),
  comments: z.string().optional().nullable(),
});

router.get("/api/super-admin/review-mode/assessments", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const targetId = req.query.targetId as string | undefined;
    const assessments = targetId
      ? await db.select().from(reviewManualAssessments).where(sql`${reviewManualAssessments.targetId} = ${targetId}`).orderBy(desc(reviewManualAssessments.createdAt))
      : await db.select().from(reviewManualAssessments).orderBy(desc(reviewManualAssessments.createdAt));
    res.json(assessments);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to fetch manual assessments");
    res.status(500).json({ error: "Failed to fetch manual assessments" });
  }
});

router.post("/api/super-admin/review-mode/assessments", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = manualAssessmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const target = await reviewModeMethods.getTarget(parsed.data.targetId);
    if (!target) return res.status(404).json({ error: "Target not found" });

    const user = (req as any).user;
    const [assessment] = await db.insert(reviewManualAssessments).values({
      targetId: parsed.data.targetId,
      percentComplete: parsed.data.percentComplete,
      starRating: parsed.data.starRating,
      comments: parsed.data.comments || null,
      assessedByUserId: user?.id || null,
      assessedByName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
    }).returning();

    res.json(assessment);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to create manual assessment");
    res.status(500).json({ error: "Failed to create manual assessment" });
  }
});

router.patch("/api/super-admin/review-mode/assessments/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const updateSchema = z.object({
      percentComplete: z.number().min(0).max(100).optional(),
      starRating: z.number().min(1).max(5).optional(),
      comments: z.string().optional().nullable(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const [existing] = await db.select().from(reviewManualAssessments).where(sql`${reviewManualAssessments.id} = ${req.params.id}`);
    if (!existing) return res.status(404).json({ error: "Assessment not found" });

    const [updated] = await db.update(reviewManualAssessments)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(sql`${reviewManualAssessments.id} = ${req.params.id}`)
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to update manual assessment");
    res.status(500).json({ error: "Failed to update manual assessment" });
  }
});

router.delete("/api/super-admin/review-mode/assessments/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(reviewManualAssessments).where(sql`${reviewManualAssessments.id} = ${req.params.id}`);
    if (!existing) return res.status(404).json({ error: "Assessment not found" });

    await db.delete(reviewManualAssessments).where(sql`${reviewManualAssessments.id} = ${req.params.id}`);
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to delete manual assessment");
    res.status(500).json({ error: "Failed to delete manual assessment" });
  }
});

export const reviewModeRouter = router;
