import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RouteEntry {
  method: string;
  path: string;
  file: string;
  hasAuth: boolean;
}

const ROUTES_DIR = path.resolve(__dirname, "../server/routes");
const CHAT_ROUTES_FILE = path.resolve(__dirname, "../server/chat/chat.routes.ts");

function extractRoutes(filePath: string, fileLabel: string): RouteEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const routes: RouteEntry[] = [];

  const routerPattern = /(?:router|chatRouter)\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = routerPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const linesBefore = content.substring(0, match.index);
    const hasAuth =
      linesBefore.includes("requireAuth") ||
      linesBefore.includes("requireRole") ||
      linesBefore.includes("requirePermission") ||
      content
        .substring(match.index, match.index + 300)
        .match(/requireAuth|requireRole|requirePermission|requireChatPermission|requireJobCapability/) !== null;

    routes.push({
      method,
      path: routePath,
      file: fileLabel,
      hasAuth,
    });
  }

  const constRefPattern = /(?:router|chatRouter)\.(get|post|patch|put|delete)\(\s*([A-Z_]+(?:\.[A-Z_]+)+)/g;
  while ((match = constRefPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const constRef = match[2];
    const surroundingCode = content.substring(match.index, match.index + 300);
    const hasAuth =
      surroundingCode.match(/requireAuth|requireRole|requirePermission|requireChatPermission|requireJobCapability/) !== null;

    routes.push({
      method,
      path: `[REF:${constRef}]`,
      file: fileLabel,
      hasAuth,
    });
  }

  return routes;
}

function main() {
  const allRoutes: RouteEntry[] = [];

  const routeFiles = fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".routes.ts") && !f.includes(".test."));

  for (const file of routeFiles) {
    const filePath = path.join(ROUTES_DIR, file);
    const routes = extractRoutes(filePath, file);
    allRoutes.push(...routes);
  }

  if (fs.existsSync(CHAT_ROUTES_FILE)) {
    const chatRoutes = extractRoutes(CHAT_ROUTES_FILE, "chat.routes.ts");
    for (const route of chatRoutes) {
      if (!route.path.startsWith("/api/")) {
        route.path = `/api/chat${route.path}`;
      }
    }
    allRoutes.push(...chatRoutes);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRoutes: allRoutes.length,
    byMethod: {
      GET: allRoutes.filter((r) => r.method === "GET").length,
      POST: allRoutes.filter((r) => r.method === "POST").length,
      PATCH: allRoutes.filter((r) => r.method === "PATCH").length,
      PUT: allRoutes.filter((r) => r.method === "PUT").length,
      DELETE: allRoutes.filter((r) => r.method === "DELETE").length,
    },
    routes: allRoutes,
  };

  const outputPath = path.resolve(__dirname, "route-manifest.json");
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`Route manifest generated: ${outputPath}`);
  console.log(`Total routes: ${manifest.totalRoutes}`);
  console.log(`By method:`, manifest.byMethod);
  console.log(`\nGET endpoints:`);
  allRoutes
    .filter((r) => r.method === "GET")
    .forEach((r) => console.log(`  ${r.path} (auth: ${r.hasAuth}) [${r.file}]`));
}

main();
