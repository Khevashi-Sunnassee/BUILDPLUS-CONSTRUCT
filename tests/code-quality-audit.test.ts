import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROUTES_DIR = path.join(__dirname, "..", "server", "routes");

function getRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "middleware") {
      files.push(...getRouteFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.startsWith("index")) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

describe("Code Quality Audit", () => {
  const routeFiles = getRouteFiles(ROUTES_DIR);

  describe("Route file size limits", () => {
    it("no single route file should exceed 1000 lines", () => {
      const oversized: string[] = [];
      for (const file of routeFiles) {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n").length;
        if (lines > 1000) {
          oversized.push(`${path.relative(ROUTES_DIR, file)} (${lines} lines)`);
        }
      }
      expect(oversized, `Oversized route files: ${oversized.join(", ")}`).toHaveLength(0);
    });
  });

  describe("List endpoint .limit() safeguards", () => {
    const EXEMPT_FILES = [
      "middleware",
      "shared.ts",
      "index.ts",
    ];

    const EXEMPT_PATTERNS = [
      /\.limit\(1\)/,
      /\.limit\(\d+\)/,
      /count\(/,
      /\.length/,
    ];

    it("route files with db.select() should have .limit() calls", () => {
      const violations: string[] = [];

      for (const file of routeFiles) {
        const relativePath = path.relative(ROUTES_DIR, file);
        if (EXEMPT_FILES.some(exempt => relativePath.includes(exempt))) continue;

        const content = fs.readFileSync(file, "utf-8");
        const hasDirectSelect = content.includes("db.select()");
        const hasLimit = content.includes(".limit(");

        if (hasDirectSelect && !hasLimit) {
          const selectCount = (content.match(/db\.select\(\)/g) || []).length;
          const singleLookups = (content.match(/const \[[\w]+\] = await db\.select/g) || []).length;
          if (selectCount > singleLookups) {
            violations.push(`${relativePath} has ${selectCount} db.select() calls but no .limit()`);
          }
        }
      }

      expect(violations, `Missing .limit() safeguards:\n${violations.join("\n")}`).toHaveLength(0);
    });
  });

  describe("Authentication coverage", () => {
    const PUBLIC_ROUTES = [
      "/login",
      "/logout",
      "/api/webhooks/",
      "/api/public/",
      "/api/invitations/",
      "/api/myob/callback",
      "/api/settings/logo",
      "/ingest",
    ];

    it("route handlers should use requireAuth or requireRole (except known public routes)", () => {
      const unprotected: string[] = [];

      for (const file of routeFiles) {
        const relativePath = path.relative(ROUTES_DIR, file);
        if (relativePath.includes("shared.ts") || relativePath.includes("index.ts")) continue;

        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const routeMatch = line.match(/router\.(get|post|put|patch|delete)\(["']([^"']+)["']/);
          if (!routeMatch) continue;

          const routePath = routeMatch[2];
          const isPublic = PUBLIC_ROUTES.some(pub => routePath.includes(pub));
          if (isPublic) continue;

          const contextLines = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
          const hasAuth = contextLines.includes("requireAuth") || contextLines.includes("requireRole");
          const hasApiKeyAuth = contextLines.includes("x-device-key") || contextLines.includes("apiKey");

          if (!hasAuth && !hasApiKeyAuth) {
            unprotected.push(`${relativePath}:${i + 1} ${routeMatch[1].toUpperCase()} ${routePath}`);
          }
        }
      }

      expect(unprotected, `Unprotected routes:\n${unprotected.join("\n")}`).toHaveLength(0);
    });
  });
});
