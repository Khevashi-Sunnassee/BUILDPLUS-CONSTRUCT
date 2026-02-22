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

    const dimensionNotes: Record<string, string> = {};
    const notesKeys = breakdownKeys.map(k => `${k}Notes`);
    for (const key of breakdownKeys) {
      const notesKey = `${key}Notes`;
      const allNotes = scores
        .map(s => s.breakdown?.[notesKey] || s.notes?.[key])
        .filter((v: any) => typeof v === "string" && v.length > 0);
      if (allNotes.length > 0) {
        dimensionNotes[notesKey] = allNotes.join("\n\n");
      }
    }

    const scoreBreakdown = { ...avgBreakdown, ...dimensionNotes, reviewerScores: scores };

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
    functionalityNotes: z.string().optional(),
    uiUxNotes: z.string().optional(),
    securityNotes: z.string().optional(),
    performanceNotes: z.string().optional(),
    codeQualityNotes: z.string().optional(),
    dataIntegrityNotes: z.string().optional(),
    errorHandlingNotes: z.string().optional(),
    accessibilityNotes: z.string().optional(),
  }).passthrough(),
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
      scoreBreakdown: z.record(z.any()).optional(),
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

router.post("/api/super-admin/review-mode/audits/:id/generate-notes", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const auditId = req.params.id as string;
    const audits = await reviewModeMethods.getAllAudits();
    const audit = audits.find((a: any) => a.id === auditId);
    if (!audit) return res.status(404).json({ error: "Audit not found" });

    const breakdown = audit.scoreBreakdown as any;
    if (!breakdown) return res.status(400).json({ error: "No score breakdown found" });

    const dimensionKeys = ["functionality", "uiUx", "security", "performance", "codeQuality", "dataIntegrity", "errorHandling", "accessibility"];
    const updatedBreakdown = { ...breakdown };

    for (const key of dimensionKeys) {
      const notesKey = `${key}Notes`;
      if (!updatedBreakdown[notesKey]) {
        const score = updatedBreakdown[key] ?? 0;
        updatedBreakdown[notesKey] = generateDefaultNotes(key, score, audit.findingsMd);
      }
    }

    await reviewModeMethods.updateAudit(auditId, { scoreBreakdown: updatedBreakdown } as any);

    const target = await reviewModeMethods.getTarget(audit.targetId);
    if (target) {
      const latestAudits = await reviewModeMethods.getAuditsForTarget(audit.targetId);
      if (latestAudits.length > 0 && latestAudits[0].id === auditId) {
        await reviewModeMethods.updateTarget(audit.targetId, {
          latestScoreBreakdown: updatedBreakdown,
        });
      }
    }

    res.json({ scoreBreakdown: updatedBreakdown });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to generate notes");
    res.status(500).json({ error: "Failed to generate notes" });
  }
});

router.post("/api/super-admin/review-mode/generate-all-notes", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const audits = await reviewModeMethods.getAllAudits();
    let updated = 0;

    for (const audit of audits) {
      const breakdown = audit.scoreBreakdown as any;
      if (!breakdown) continue;

      const dimensionKeys = ["functionality", "uiUx", "security", "performance", "codeQuality", "dataIntegrity", "errorHandling", "accessibility"];
      let hasNew = false;
      const updatedBreakdown = { ...breakdown };

      for (const key of dimensionKeys) {
        const notesKey = `${key}Notes`;
        if (!updatedBreakdown[notesKey]) {
          const score = updatedBreakdown[key] ?? 0;
          updatedBreakdown[notesKey] = generateDefaultNotes(key, score, audit.findingsMd);
          hasNew = true;
        }
      }

      if (hasNew) {
        await reviewModeMethods.updateAudit(audit.id, { scoreBreakdown: updatedBreakdown } as any);
        updated++;
      }
    }

    const targets = await reviewModeMethods.getTargets();
    for (const target of targets) {
      const latestAudits = await reviewModeMethods.getAuditsForTarget(target.id);
      if (latestAudits.length > 0) {
        const latestBreakdown = latestAudits[0].scoreBreakdown as any;
        await reviewModeMethods.updateTarget(target.id, {
          latestScoreBreakdown: latestBreakdown,
        });
      }
    }

    res.json({ updated, total: audits.length });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to generate all notes");
    res.status(500).json({ error: "Failed to generate notes" });
  }
});

function generateDefaultNotes(dimension: string, score: number, findingsMd: string | null): string {
  const findings = findingsMd || "";

  const dimensionGuidance: Record<string, { low: string; medium: string; high: string }> = {
    functionality: {
      low: "## Issues\nMultiple features are broken or incomplete. Core CRUD operations may fail or produce incorrect results.\n\n## Improvements Needed\n- Verify all form submissions save correctly\n- Test edge cases (empty inputs, special characters)\n- Ensure all buttons and links work as expected\n- Add missing features that users would expect",
      medium: "## Current State\nCore features work but some edge cases or secondary features need attention.\n\n## Improvements Needed\n- Test all user workflows end-to-end\n- Handle edge cases (empty states, max limits, concurrent edits)\n- Verify data validation covers all scenarios\n- Add any missing filter/sort/search functionality",
      high: "## Current State\nAll major features work correctly with good edge case handling.\n\n## To Reach 5/5\n- Ensure every feature works flawlessly under all conditions\n- Add advanced features (bulk operations, keyboard shortcuts)\n- Verify cross-browser compatibility",
    },
    uiUx: {
      low: "## Issues\nLayout issues, inconsistent styling, or poor user experience patterns throughout.\n\n## Improvements Needed\n- Fix alignment and spacing issues\n- Add consistent hover states and visual feedback\n- Improve form layouts and validation messages\n- Add loading states and skeleton screens",
      medium: "## Current State\nGood visual design with minor inconsistencies in some areas.\n\n## Improvements Needed\n- Ensure consistent spacing and alignment across all elements\n- Add smooth transitions and micro-interactions\n- Improve mobile responsiveness\n- Add proper empty states with helpful guidance",
      high: "## Current State\nClean, professional design with good user experience patterns.\n\n## To Reach 5/5\n- Polish all transitions and animations\n- Ensure pixel-perfect alignment\n- Add delightful micro-interactions\n- Optimise for all screen sizes",
    },
    security: {
      low: "## Issues\nMissing authentication checks, unsanitized inputs, or exposed sensitive data.\n\n## Improvements Needed\n- Add authentication middleware to all protected routes\n- Sanitize all user inputs to prevent XSS/injection\n- Implement RBAC checks for role-specific actions\n- Remove any hardcoded secrets or sensitive data",
      medium: "## Current State\nBasic security measures in place but some gaps remain.\n\n## Improvements Needed\n- Add rate limiting to prevent abuse\n- Implement CSRF protection on forms\n- Verify all API endpoints check authorization properly\n- Add input validation on both client and server side",
      high: "## Current State\nStrong security posture with proper authentication and authorization.\n\n## To Reach 5/5\n- Implement Content Security Policy headers\n- Add audit logging for sensitive actions\n- Review for any data leakage in API responses\n- Ensure all file uploads are validated",
    },
    performance: {
      low: "## Issues\nSlow page loads, excessive re-renders, or unoptimized database queries.\n\n## Improvements Needed\n- Add pagination to list endpoints (avoid loading all records)\n- Implement React.memo and useMemo for expensive computations\n- Optimize database queries with proper indexes\n- Add lazy loading for heavy components",
      medium: "## Current State\nReasonable performance but room for optimization.\n\n## Improvements Needed\n- Add query result caching where appropriate\n- Implement virtual scrolling for long lists\n- Optimize bundle size with code splitting\n- Use React.memo to prevent unnecessary re-renders\n- Add debouncing to search/filter inputs",
      high: "## Current State\nGood performance with most optimizations in place.\n\n## To Reach 5/5\n- Profile and eliminate any remaining render bottlenecks\n- Implement prefetching for predictable navigation\n- Optimize image loading with lazy loading\n- Consider server-side caching for expensive queries",
    },
    codeQuality: {
      low: "## Issues\nInconsistent code style, missing types, or poor code organization.\n\n## Improvements Needed\n- Add TypeScript types to all function parameters and returns\n- Extract duplicated code into reusable utilities\n- Follow consistent naming conventions\n- Break large components into smaller, focused ones\n- Remove dead code and unused imports",
      medium: "## Current State\nDecent code organization but some areas need cleanup.\n\n## Improvements Needed\n- Add proper TypeScript interfaces for all data structures\n- Extract business logic from UI components into hooks\n- Reduce component file sizes (aim for under 300 lines)\n- Add JSDoc comments to complex functions\n- Replace any magic numbers with named constants",
      high: "## Current State\nWell-organized code with good TypeScript usage.\n\n## To Reach 5/5\n- Ensure 100% type safety (no 'any' types)\n- Add comprehensive documentation\n- Refactor any remaining large files\n- Ensure consistent error handling patterns",
    },
    dataIntegrity: {
      low: "## Issues\nMissing validation, potential data corruption, or inconsistent data handling.\n\n## Improvements Needed\n- Add Zod validation schemas for all API inputs\n- Implement database constraints (NOT NULL, UNIQUE, CHECK)\n- Add foreign key constraints for related data\n- Validate data on both client and server side",
      medium: "## Current State\nBasic validation in place but some gaps in data integrity.\n\n## Improvements Needed\n- Add database-level constraints for critical fields\n- Implement optimistic locking for concurrent edits\n- Validate enum values and ranges server-side\n- Add cascade rules for related data deletion\n- Ensure all required fields are properly validated",
      high: "## Current State\nGood data validation and integrity checks.\n\n## To Reach 5/5\n- Add transaction wrapping for multi-table operations\n- Implement soft-delete where appropriate\n- Add data migration strategies\n- Verify referential integrity across all relations",
    },
    errorHandling: {
      low: "## Issues\nCrashes on errors, missing error boundaries, or silent failures.\n\n## Improvements Needed\n- Add try-catch blocks to all API route handlers\n- Implement React error boundaries for component trees\n- Show user-friendly error messages (not raw errors)\n- Add proper error logging on the server\n- Handle network timeout and connection errors",
      medium: "## Current State\nBasic error handling exists but coverage is incomplete.\n\n## Improvements Needed\n- Add error boundaries around major page sections\n- Show specific error messages for different failure types\n- Implement retry logic for transient failures\n- Add proper 404/500 error pages\n- Log errors with sufficient context for debugging",
      high: "## Current State\nGood error handling with proper user feedback.\n\n## To Reach 5/5\n- Add automatic error reporting/monitoring\n- Implement graceful degradation for non-critical features\n- Add circuit breakers for external service calls\n- Ensure all async operations have timeout handling",
    },
    accessibility: {
      low: "## Issues\nMissing alt text, poor keyboard navigation, or no ARIA labels.\n\n## Improvements Needed\n- Add alt text to all images\n- Ensure all interactive elements are keyboard accessible\n- Add ARIA labels to icon-only buttons\n- Use semantic HTML elements (main, nav, section)\n- Ensure sufficient color contrast ratios",
      medium: "## Current State\nBasic accessibility features present but not comprehensive.\n\n## Improvements Needed\n- Add skip-to-content links\n- Ensure focus management in modals and dialogs\n- Add ARIA live regions for dynamic content updates\n- Test with screen reader to identify gaps\n- Ensure form fields have associated labels",
      high: "## Current State\nGood accessibility with proper semantic structure.\n\n## To Reach 5/5\n- Add comprehensive ARIA landmarks\n- Implement focus trapping in all modal dialogs\n- Add screen reader announcements for state changes\n- Ensure complete keyboard-only navigation\n- Test with multiple assistive technologies",
    },
  };

  const guidance = dimensionGuidance[dimension];
  if (!guidance) return "";

  let notes = "";
  if (score <= 2) {
    notes = guidance.low;
  } else if (score <= 3) {
    notes = guidance.medium;
  } else {
    notes = guidance.high;
  }

  if (findings) {
    const relevantFindings = extractRelevantFindings(findings, dimension);
    if (relevantFindings) {
      notes += `\n\n## Specific Findings\n${relevantFindings}`;
    }
  }

  return notes;
}

function extractRelevantFindings(findingsMd: string, dimension: string): string {
  const keywordMap: Record<string, string[]> = {
    functionality: ["feature", "crud", "form", "submit", "button", "filter", "search", "navigation", "workflow", "missing"],
    uiUx: ["layout", "spacing", "alignment", "responsive", "mobile", "design", "style", "ui", "ux", "visual", "hover"],
    security: ["auth", "security", "role", "permission", "rbac", "xss", "injection", "csrf", "sanitize", "access"],
    performance: ["performance", "slow", "render", "memo", "usememo", "cache", "pagination", "lazy", "optimize", "bundle"],
    codeQuality: ["code", "type", "typescript", "refactor", "duplicate", "naming", "convention", "import", "dead code"],
    dataIntegrity: ["validation", "constraint", "schema", "data", "integrity", "null", "unique", "foreign key", "zod"],
    errorHandling: ["error", "catch", "boundary", "exception", "handling", "try", "fallback", "toast", "message"],
    accessibility: ["aria", "accessibility", "a11y", "keyboard", "screen reader", "alt", "label", "focus", "semantic"],
  };

  const keywords = keywordMap[dimension] || [];
  const sentences = findingsMd.split(/[.!?\n]/).filter(s => s.trim().length > 10);
  const relevant = sentences.filter(s => {
    const lower = s.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  });

  return relevant.length > 0 ? relevant.slice(0, 5).map(s => `- ${s.trim()}`).join("\n") : "";
}

router.get("/api/super-admin/review-mode/queue", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const targets = await reviewModeMethods.getTargets();
    const unreviewed = targets.filter(t => !t.lastReviewedAt);

    const dimensionKeys = ["functionality", "uiUx", "security", "performance", "codeQuality", "dataIntegrity", "errorHandling", "accessibility"];
    const hasAnyDimensionBelow4 = (t: typeof targets[0]): boolean => {
      if (!t.latestScoreBreakdown || typeof t.latestScoreBreakdown !== "object") return false;
      const breakdown = t.latestScoreBreakdown as Record<string, unknown>;
      return dimensionKeys.some(key => {
        const val = breakdown[key];
        const numVal = typeof val === "number" ? val : typeof val === "string" ? Number(val) : NaN;
        return !isNaN(numVal) && numVal < 4;
      });
    };

    const needsWork = targets.filter(t => t.latestScore !== null && (t.latestScore < 4 || hasAnyDimensionBelow4(t))).sort((a, b) => (a.latestScore || 0) - (b.latestScore || 0));
    const reviewed = targets.filter(t => t.latestScore !== null && t.latestScore >= 4 && !hasAnyDimensionBelow4(t)).sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: msg }, "Failed to fetch review queue");
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
