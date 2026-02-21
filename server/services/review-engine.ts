import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import logger from "../lib/logger";

const WORKSPACE_ROOT = process.cwd();

const SECRET_PATTERNS = [
  /[A-Za-z0-9+/=]{20,}(?:sk-|key-|token-|secret-|api-)/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(sess_[a-zA-Z0-9]+)\b/g,
  /\b(whsec_[a-zA-Z0-9]+)\b/g,
  /\b(re_[a-zA-Z0-9]+)\b/g,
  /process\.env\.[A-Z_]+/g,
];

export function sanitizeContent(text: string): string {
  let sanitized = text;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  sanitized = sanitized.replace(/['"][A-Za-z0-9+/=]{32,}['"]/g, '"[REDACTED_TOKEN]"');
  return sanitized;
}

const ALLOWED_PATHS = ["client/src/", "server/", "shared/"];
const BLOCKED_PATHS = ["node_modules/", ".git/", "dist/", "build/", ".env", "test/", "__test__/"];
const MAX_TOTAL_CONTENT_BYTES = 200000;
let totalContentRead = 0;

function resetContentCounter() {
  totalContentRead = 0;
}

function safeReadFile(filePath: string): string | null {
  try {
    const fullPath = path.resolve(WORKSPACE_ROOT, filePath);
    if (!fullPath.startsWith(WORKSPACE_ROOT)) return null;
    if (BLOCKED_PATHS.some(bp => filePath.includes(bp))) return null;
    if (!ALLOWED_PATHS.some(ap => filePath.startsWith(ap))) return null;
    if (!fs.existsSync(fullPath)) return null;
    const size = fs.statSync(fullPath).size;
    if (size > 500000) return null;
    if (totalContentRead + size > MAX_TOTAL_CONTENT_BYTES) return null;
    const content = fs.readFileSync(fullPath, "utf-8");
    totalContentRead += content.length;
    return content;
  } catch {
    return null;
  }
}

function countLines(content: string): number {
  return content.split("\n").length;
}

function extractImports(content: string, depth: number, visited: Set<string>, basePath: string): string[] {
  if (depth <= 0) return [];
  const importRegex = /(?:import|from)\s+["']([^"']+)["']/g;
  const related: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith(".") || importPath.startsWith("@/")) {
      let resolvedPath = importPath;
      if (importPath.startsWith("@/")) {
        resolvedPath = "client/src/" + importPath.slice(2);
      } else {
        resolvedPath = path.resolve(path.dirname(basePath), importPath);
        resolvedPath = path.relative(WORKSPACE_ROOT, resolvedPath);
      }
      const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
      for (const ext of extensions) {
        const candidate = resolvedPath + ext;
        if (!visited.has(candidate) && fs.existsSync(path.resolve(WORKSPACE_ROOT, candidate))) {
          visited.add(candidate);
          related.push(candidate);
          const childContent = safeReadFile(candidate);
          if (childContent) {
            related.push(...extractImports(childContent, depth - 1, visited, candidate));
          }
          break;
        }
      }
    }
  }
  return related;
}

function extractQueryKeys(content: string): Array<{ key: string; file: string }> {
  const results: Array<{ key: string; file: string }> = [];
  const queryRegex = /useQuery\s*\(\s*\{[^}]*queryKey\s*:\s*\[([^\]]+)\]/g;
  let match;
  while ((match = queryRegex.exec(content)) !== null) {
    results.push({ key: match[1].trim(), file: "" });
  }
  return results;
}

function extractMutationKeys(content: string): Array<{ key: string; file: string }> {
  const results: Array<{ key: string; file: string }> = [];
  const mutRegex = /useMutation\s*\(\s*\{[^}]*mutationFn[^}]*apiRequest\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = mutRegex.exec(content)) !== null) {
    results.push({ key: match[1].trim(), file: "" });
  }
  return results;
}

function extractApiEndpoints(content: string): string[] {
  const endpoints: string[] = [];
  const apiRegex = /(?:apiRequest|fetch|queryKey)\s*[:(]\s*["'`]([/][^"'`\s]+)["'`]/g;
  let match;
  while ((match = apiRegex.exec(content)) !== null) {
    if (match[1].startsWith("/api/")) {
      endpoints.push(match[1]);
    }
  }
  const keyRegex = /queryKey\s*:\s*\[\s*["'`]([^"'`]+)["'`]/g;
  while ((match = keyRegex.exec(content)) !== null) {
    if (match[1].startsWith("/api/")) {
      endpoints.push(match[1]);
    }
  }
  return [...new Set(endpoints)];
}

function findRouteFileForEndpoint(endpoint: string): { routeFile: string; methods: string[] } | null {
  try {
    const routeFiles = fs.readdirSync(path.resolve(WORKSPACE_ROOT, "server/routes"))
      .filter(f => f.endsWith(".ts") && f !== "index.ts");

    for (const file of routeFiles) {
      const routeContent = safeReadFile(`server/routes/${file}`);
      if (routeContent && routeContent.includes(endpoint)) {
        const methods: string[] = [];
        const methodRegex = /router\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;
        let m;
        while ((m = methodRegex.exec(routeContent)) !== null) {
          if (endpoint.includes(m[2]) || m[2].includes(endpoint.replace(/\/api/, ""))) {
            methods.push(m[1].toUpperCase());
          }
        }
        return { routeFile: `server/routes/${file}`, methods };
      }
    }
    const subDirs = ["tender", "documents", "scopes", "ap-invoices", "super-admin"];
    for (const dir of subDirs) {
      const dirPath = path.resolve(WORKSPACE_ROOT, `server/routes/${dir}`);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const subFiles = fs.readdirSync(dirPath).filter(f => f.endsWith(".ts"));
        for (const file of subFiles) {
          const routeContent = safeReadFile(`server/routes/${dir}/${file}`);
          if (routeContent && routeContent.includes(endpoint)) {
            return { routeFile: `server/routes/${dir}/${file}`, methods: [] };
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export interface ReviewPacketData {
  target: {
    routePath: string;
    targetType: string;
    pageTitle: string;
    module: string;
    frontendEntryFile: string;
    relatedFiles: string[];
  };
  ui: {
    purpose: string;
    roles: string[];
    keyUserFlows: string[];
    knownIssues: string[];
    riskFocus: string[];
  };
  frontend: {
    files: Array<{ path: string; loc: number }>;
    reactQuery: {
      queries: Array<{ key: string; file: string }>;
      mutations: Array<{ key: string; file: string }>;
    };
    forms: Array<{ schemaName: string; file: string }>;
    permissionGuards: Array<{ guard: string; file: string }>;
  };
  backend: {
    endpointsUsed: Array<{ method: string; path: string; routeFile: string; authMiddleware: string; zodSchema: string }>;
    tablesTouched: string[];
    externalServicesTouched: string[];
  };
  notes: {
    sanitization: string;
    generatedAt: string;
  };
}

export function generatePacket(
  target: { routePath: string; targetType: string; pageTitle: string; module: string; frontendEntryFile: string },
  ui: { purpose: string; roles: string[]; keyUserFlows: string[]; knownIssues: string[]; riskFocus: string[] },
  manualOverrides?: { additionalFiles?: string[]; additionalEndpoints?: string[] }
): ReviewPacketData {
  resetContentCounter();
  const visited = new Set<string>();
  const entryFile = target.frontendEntryFile;
  visited.add(entryFile);

  const entryContent = safeReadFile(entryFile) || "";
  const relatedFiles = extractImports(entryContent, 2, visited, entryFile);

  if (manualOverrides?.additionalFiles) {
    for (const f of manualOverrides.additionalFiles) {
      if (!relatedFiles.includes(f)) relatedFiles.push(f);
    }
  }

  const allFiles = [entryFile, ...relatedFiles];
  const fileEntries: Array<{ path: string; loc: number }> = [];
  const allQueries: Array<{ key: string; file: string }> = [];
  const allMutations: Array<{ key: string; file: string }> = [];
  const allForms: Array<{ schemaName: string; file: string }> = [];
  const allGuards: Array<{ guard: string; file: string }> = [];
  const allEndpoints: string[] = [];

  for (const filePath of allFiles) {
    const content = safeReadFile(filePath);
    if (!content) continue;

    fileEntries.push({ path: filePath, loc: countLines(content) });

    const queries = extractQueryKeys(content).map(q => ({ ...q, file: filePath }));
    allQueries.push(...queries);

    const mutations = extractMutationKeys(content).map(m => ({ ...m, file: filePath }));
    allMutations.push(...mutations);

    const formRegex = /useForm\s*(?:<[^>]+>)?\s*\(\s*\{[^}]*resolver\s*:\s*zodResolver\s*\(\s*(\w+)/g;
    let formMatch;
    while ((formMatch = formRegex.exec(content)) !== null) {
      allForms.push({ schemaName: formMatch[1], file: filePath });
    }

    const guardRegex = /(?:requireRole|requireAuth|requireSuperAdmin|requireManager|requireAdmin)/g;
    let guardMatch;
    while ((guardMatch = guardRegex.exec(content)) !== null) {
      allGuards.push({ guard: guardMatch[0], file: filePath });
    }

    const endpoints = extractApiEndpoints(content);
    allEndpoints.push(...endpoints);
  }

  if (manualOverrides?.additionalEndpoints) {
    allEndpoints.push(...manualOverrides.additionalEndpoints);
  }

  const uniqueEndpoints = [...new Set(allEndpoints)];
  const endpointsUsed = uniqueEndpoints.map(ep => {
    const routeInfo = findRouteFileForEndpoint(ep);
    return {
      method: routeInfo?.methods?.[0] || "GET",
      path: ep,
      routeFile: routeInfo?.routeFile || "unknown",
      authMiddleware: "requireAuth",
      zodSchema: "unknown",
    };
  });

  const tablesTouched: string[] = [];
  for (const ep of endpointsUsed) {
    if (ep.routeFile !== "unknown") {
      const routeContent = safeReadFile(ep.routeFile);
      if (routeContent) {
        const tableRegex = /from\s*\(\s*(\w+)\s*\)/g;
        let tm;
        while ((tm = tableRegex.exec(routeContent)) !== null) {
          const tableName = tm[1];
          if (!tablesTouched.includes(tableName) && !["req", "res", "err", "data", "result"].includes(tableName)) {
            tablesTouched.push(tableName);
          }
        }
      }
    }
  }

  const externalServicesTouched: string[] = [];
  const allContent = allFiles.map(f => safeReadFile(f) || "").join("\n");
  if (allContent.includes("openai") || allContent.includes("OpenAI")) externalServicesTouched.push("OpenAI");
  if (allContent.includes("resend") || allContent.includes("Resend")) externalServicesTouched.push("Resend");
  if (allContent.includes("twilio") || allContent.includes("Twilio")) externalServicesTouched.push("Twilio");
  if (allContent.includes("mailgun") || allContent.includes("Mailgun")) externalServicesTouched.push("Mailgun");
  if (allContent.includes("myob") || allContent.includes("MYOB")) externalServicesTouched.push("MYOB");

  return {
    target: {
      ...target,
      relatedFiles,
    },
    ui,
    frontend: {
      files: fileEntries,
      reactQuery: { queries: allQueries, mutations: allMutations },
      forms: allForms,
      permissionGuards: allGuards,
    },
    backend: {
      endpointsUsed,
      tablesTouched,
      externalServicesTouched,
    },
    notes: {
      sanitization: "PII redacted, tokens removed, environment variables excluded",
      generatedAt: new Date().toISOString(),
    },
  };
}

export function packetToMarkdown(packet: ReviewPacketData): string {
  const lines: string[] = [];
  lines.push(`# Review Packet: ${packet.target.pageTitle}`);
  lines.push(`**Route:** ${packet.target.routePath}`);
  lines.push(`**Type:** ${packet.target.targetType}`);
  lines.push(`**Module:** ${packet.target.module}`);
  lines.push(`**Entry File:** ${packet.target.frontendEntryFile}`);
  lines.push("");
  lines.push("## Purpose");
  lines.push(packet.ui.purpose || "Not specified");
  lines.push("");
  lines.push("## Roles");
  lines.push(packet.ui.roles.map(r => `- ${r}`).join("\n") || "- All");
  lines.push("");
  lines.push("## Key User Flows");
  lines.push(packet.ui.keyUserFlows.map(f => `- ${f}`).join("\n") || "- None specified");
  lines.push("");
  lines.push("## Risk Focus");
  lines.push(packet.ui.riskFocus.map(r => `- ${r}`).join("\n") || "- General review");
  lines.push("");
  lines.push("## Frontend Files");
  for (const f of packet.frontend.files) {
    lines.push(`- \`${f.path}\` (${f.loc} LOC)`);
  }
  lines.push("");
  lines.push("## React Query Usage");
  lines.push("### Queries");
  for (const q of packet.frontend.reactQuery.queries) {
    lines.push(`- Key: ${q.key} (${q.file})`);
  }
  lines.push("### Mutations");
  for (const m of packet.frontend.reactQuery.mutations) {
    lines.push(`- ${m.key} (${m.file})`);
  }
  lines.push("");
  lines.push("## Backend Endpoints");
  for (const ep of packet.backend.endpointsUsed) {
    lines.push(`- ${ep.method} ${ep.path} → ${ep.routeFile}`);
  }
  lines.push("");
  lines.push("## Tables Touched");
  lines.push(packet.backend.tablesTouched.map(t => `- ${t}`).join("\n") || "- None detected");
  lines.push("");
  lines.push("## External Services");
  lines.push(packet.backend.externalServicesTouched.map(s => `- ${s}`).join("\n") || "- None");
  return lines.join("\n");
}

const REVIEW_OUTPUT_SCHEMA = `{
  "summary": { "overallHealth": "GOOD|MIXED|RISKY", "topRisks": ["..."], "quickWins": ["..."] },
  "findings": [
    {
      "severity": "P0|P1|P2|P3",
      "category": "SECURITY|MULTI_TENANCY|RBAC|API_CONTRACTS|PERFORMANCE|MAINTAINABILITY|UX|TESTING|OBSERVABILITY",
      "title": "...",
      "detail_md": "...",
      "impactedFiles": ["..."],
      "impactedEndpoints": ["..."],
      "suggestedFix_md": "...",
      "acceptanceCriteria_md": "..."
    }
  ],
  "missingEvidence": [],
  "followUpQuestions": []
}`;

function buildPrompt(contextMd: string, packetMd: string, riskFocus: string[], reviewer: string): string {
  const reviewerInstruction = reviewer === "REPLIT_CLAUDE"
    ? "You are Reviewer A (Replit/Claude perspective). Focus on architecture patterns, code organization, and enterprise scalability. Be thorough and critical."
    : "You are Reviewer B (OpenAI perspective). Focus on security vulnerabilities, data integrity, and production readiness. Be thorough and practical.";

  return `${reviewerInstruction}

## Architecture Context
${contextMd}

## Review Packet
${packetMd}

## Risk Focus Areas
${riskFocus.length > 0 ? riskFocus.map(r => `- ${r}`).join("\n") : "- General comprehensive review"}

## Instructions
Review the above page/module across ALL of these categories:
- SECURITY: Auth bypasses, injection, XSS, CSRF, secret exposure
- MULTI_TENANCY: Company isolation, cross-tenant data leaks
- RBAC: Role enforcement on frontend and backend
- API_CONTRACTS: Input validation, response consistency, error handling
- PERFORMANCE: N+1 queries, missing indexes, unbounded queries, caching
- MAINTAINABILITY: Code organization, duplication, complexity
- UX: Loading states, error states, empty states, accessibility
- TESTING: Test coverage gaps, regression risks
- OBSERVABILITY: Logging, monitoring, audit trails

For each finding provide:
- severity (P0 = critical/blocking, P1 = important, P2 = moderate, P3 = nice-to-have)
- category
- title (concise)
- detail_md (detailed explanation)
- impactedFiles (file paths)
- impactedEndpoints (API endpoints)
- suggestedFix_md (concrete fix with code snippets where helpful)
- acceptanceCriteria_md (how to verify the fix)

If recommending a major refactor, propose an incremental plan and flag it.

Return ONLY valid JSON matching this schema:
${REVIEW_OUTPUT_SCHEMA}`;
}

export async function runReview(
  contextMd: string,
  packetData: ReviewPacketData,
  reviewer: "REPLIT_CLAUDE" | "OPENAI"
): Promise<{ promptMd: string; responseMd: string; responseJson: any; modelName: string; durationMs: number }> {
  const sanitizedPacketMd = sanitizeContent(packetToMarkdown(packetData));
  const riskFocus = packetData.ui.riskFocus || [];
  const promptMd = buildPrompt(contextMd, sanitizedPacketMd, riskFocus, reviewer);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const modelName = reviewer === "REPLIT_CLAUDE" ? "gpt-4o" : "gpt-4o-mini";
  const temperature = reviewer === "REPLIT_CLAUDE" ? 0.3 : 0.5;
  const systemPrompt = reviewer === "REPLIT_CLAUDE"
    ? "You are a senior full-stack architect performing a thorough code review. Focus on architecture, patterns, and enterprise scalability. Return valid JSON only."
    : "You are a security-focused code auditor performing a thorough review. Focus on vulnerabilities, data integrity, and production readiness. Return valid JSON only.";

  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      temperature,
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptMd },
      ],
      response_format: { type: "json_object" },
    });

    const durationMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || "{}";

    let responseJson: any;
    try {
      responseJson = JSON.parse(content);
    } catch {
      const retryResponse = await openai.chat.completions.create({
        model: modelName,
        temperature: 0.1,
        max_tokens: 8000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptMd },
          { role: "assistant", content: content },
          { role: "user", content: "Return valid JSON only, include all required categories." },
        ],
        response_format: { type: "json_object" },
      });
      const retryContent = retryResponse.choices[0]?.message?.content || "{}";
      responseJson = JSON.parse(retryContent);
    }

    return {
      promptMd: sanitizeContent(promptMd),
      responseMd: content,
      responseJson,
      modelName,
      durationMs,
    };
  } catch (error: any) {
    logger.error({ error: error.message }, "Review run failed");
    throw error;
  }
}

export function mergeTaskpacks(
  runA: { responseJson: any; reviewer: string } | null,
  runB: { responseJson: any; reviewer: string } | null
): { mergedTasksMd: string; mergedTasksJson: any } {
  const allFindings: any[] = [];

  if (runA?.responseJson?.findings) {
    for (const f of runA.responseJson.findings) {
      allFindings.push({ ...f, source: runA.reviewer });
    }
  }
  if (runB?.responseJson?.findings) {
    for (const f of runB.responseJson.findings) {
      allFindings.push({ ...f, source: runB.reviewer });
    }
  }

  const severityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  allFindings.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  const grouped: Record<string, any[]> = {};
  for (const f of allFindings) {
    const cat = f.category || "OTHER";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  const mdLines: string[] = ["# Merged Task Pack\n"];
  let taskNum = 0;

  const categories = Object.keys(grouped).sort();
  for (const cat of categories) {
    mdLines.push(`## ${cat}\n`);
    for (const f of grouped[cat]) {
      taskNum++;
      mdLines.push(`### ${taskNum}. [${f.severity}] ${f.title}`);
      mdLines.push(`**Source:** ${f.source}`);
      mdLines.push(`**Files:** ${(f.impactedFiles || []).join(", ") || "N/A"}`);
      mdLines.push(`**Endpoints:** ${(f.impactedEndpoints || []).join(", ") || "N/A"}`);
      mdLines.push("");
      mdLines.push(f.detail_md || "");
      mdLines.push("");
      mdLines.push("**Suggested Fix:**");
      mdLines.push(f.suggestedFix_md || "N/A");
      mdLines.push("");
      mdLines.push("**Acceptance Criteria:**");
      mdLines.push(f.acceptanceCriteria_md || "N/A");
      mdLines.push("");
      mdLines.push("- [ ] Task completed");
      mdLines.push("");
    }
  }

  return {
    mergedTasksMd: mdLines.join("\n"),
    mergedTasksJson: {
      totalFindings: allFindings.length,
      byCategory: grouped,
      bySeverity: {
        P0: allFindings.filter(f => f.severity === "P0").length,
        P1: allFindings.filter(f => f.severity === "P1").length,
        P2: allFindings.filter(f => f.severity === "P2").length,
        P3: allFindings.filter(f => f.severity === "P3").length,
      },
      findings: allFindings,
    },
  };
}
