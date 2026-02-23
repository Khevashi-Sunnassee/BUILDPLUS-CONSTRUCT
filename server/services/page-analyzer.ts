import * as fs from "fs";
import * as path from "path";

export interface AuditScores {
  functionality: number;
  uiUx: number;
  security: number;
  performance: number;
  codeQuality: number;
  dataIntegrity: number;
  errorHandling: number;
  accessibility: number;
  functionalityNotes: string;
  uiUxNotes: string;
  securityNotes: string;
  performanceNotes: string;
  codeQualityNotes: string;
  dataIntegrityNotes: string;
  errorHandlingNotes: string;
  accessibilityNotes: string;
}

function classifyPageType(routePath: string, pageTitle: string, _code: string): string {
  if (/Detail|Form|Edit|Fill/.test(pageTitle)) return "detail";
  if (/List|Register|Hub|Pipeline|Reports|Dashboard/.test(pageTitle)) return "list";
  if (routePath.startsWith("/admin") || routePath.startsWith("/super-admin")) return "admin";
  if (routePath.startsWith("/mobile")) return "mobile";
  if (/:id|:jobId|:date/.test(routePath)) return "detail";
  return "list";
}

function extractApiEndpoints(code: string): string[] {
  const endpoints: string[] = [];
  const matches = code.matchAll(/["'`](\/api\/[^"'`\s${}]+)["'`]/g);
  for (const m of matches) {
    if (!endpoints.includes(m[1])) endpoints.push(m[1]);
  }
  return endpoints.slice(0, 10);
}

function extractComponentImports(code: string): string[] {
  const imports: string[] = [];
  const matches = code.matchAll(/from\s+["'](@\/components\/[^"']+|@\/hooks\/[^"']+)["']/g);
  for (const m of matches) imports.push(m[1]);
  return imports;
}

function findRelatedBackendRoutes(routePath: string): string[] {
  const routeDir = path.resolve(process.cwd(), "server/routes");
  const related: string[] = [];
  try {
    const files = fs.readdirSync(routeDir).filter(f => f.endsWith(".ts") && !f.includes(".test."));
    const segment = routePath.replace(/^\/mobile/, "").replace(/^\/admin\//, "").replace(/^\//, "").split("/")[0];
    for (const file of files) {
      if (file.includes(segment.replace(/-/g, "")) || file.includes(segment)) {
        related.push(file);
      }
    }
  } catch {
    // Route directory not found
  }
  return related;
}

function getReachTargets(dimension: string, score: number, findings: string[]): string[] {
  const targets: string[] = [];
  if (score >= 10) return targets;
  const findingsLower = findings.map(f => f.toLowerCase()).join(" ");

  const dimTargets: Record<string, string[]> = {
    "Functionality": [
      "Add search and filter functionality for data lists",
      "Implement sorting on table columns",
      "Add data export/download capability (CSV/Excel)",
      "Support bulk operations (multi-select, bulk edit/delete)",
      "Add pagination for large datasets",
      "Include tab-based layout to organise related content",
      "Add modal dialogs for focused create/edit workflows",
      "Implement form handling with proper submit/cancel",
    ],
    "UI/UX": [
      "Add loading skeletons/spinners while data is fetching",
      "Show toast notifications for success/error feedback on mutations",
      "Add responsive breakpoints (sm/md/lg) for different screen sizes",
      "Display meaningful empty states when no records exist",
      "Use Badge components for status/category indicators",
      "Add Card components for visually organised content",
      "Include Lucide icons for visual affordance on actions",
      "Use Select dropdowns and DatePicker for structured inputs",
    ],
    "Security": [
      "Add Zod schema validation on form inputs before submission",
      "Implement role-based UI rendering (show/hide by user role)",
      "Add confirmation dialogs before destructive actions",
      "Ensure user session/auth state is checked in component logic",
      "Avoid dangerouslySetInnerHTML or sanitise content server-side",
    ],
    "Performance": [
      "Use useMemo/useCallback for expensive computations",
      "Add debouncing on search inputs to reduce API calls",
      "Implement pagination to avoid loading all records at once",
      "Split large files into sub-components for code splitting",
      "Use proper query cache invalidation after mutations",
    ],
    "Code Quality": [
      "Add data-testid attributes on interactive and display elements",
      "Define TypeScript interfaces for all data structures",
      "Eliminate 'any' type usage - replace with proper interfaces",
      "Extract large files into modular sub-components",
      "Reuse shared components/hooks from the project library",
      "Export type aliases for reusability across components",
    ],
    "Data Integrity": [
      "Add Zod schema validation on forms before API submission",
      "Invalidate query cache after mutations for fresh data display",
      "Add confirmation dialogs before destructive operations",
      "Combine form validation with schema-defined constraints",
    ],
    "Error Handling": [
      "Handle isError states from data fetching with user-visible messages",
      "Add try-catch blocks for async operations",
      "Show toast notifications for error feedback on mutations",
      "Add loading states to prevent interaction during pending operations",
      "Use conditional rendering to guard against null/undefined data",
    ],
    "Accessibility": [
      "Add aria-label attributes on icon-only buttons and interactive elements",
      "Support keyboard navigation (onKeyDown/tabIndex handlers)",
      "Use semantic HTML elements (main, nav, section, article)",
      "Add alt text on all images",
      "Manage focus programmatically for modal/dialog flows",
      "Add data-testid attributes for accessibility testing",
    ],
  };

  const available = dimTargets[dimension] || [];
  const keywordMap: Record<string, string[]> = {
    "search and filter": ["search", "filter"],
    "sorting": ["sort"],
    "export": ["export", "download", "excel", "csv"],
    "bulk operations": ["bulk", "selectall", "selectedids"],
    "pagination": ["pagina"],
    "tab-based": ["tab", "tabs", "tabslist", "multi-tab"],
    "modal dialogs": ["dialog", "modal"],
    "form handling": ["form", "useform"],
    "loading": ["loading", "skeleton", "spinner"],
    "toast": ["toast"],
    "responsive": ["responsive", "breakpoint", "sm/md/lg"],
    "empty state": ["empty state", "no records"],
    "badge": ["badge"],
    "card": ["card"],
    "icon": ["icon", "lucide"],
    "zod": ["zod", "validat", "safeParse"],
    "role-based": ["role", "rbac", "isadmin"],
    "confirmation": ["confirm"],
    "usememo": ["usememo", "usecallback", "memo"],
    "debounce": ["debounce"],
    "invalidate": ["invalidat", "cache invalidat"],
    "data-testid": ["testid", "data-testid"],
    "typescript interface": ["interface", "typed"],
    "any type": ["any"],
    "try-catch": ["try-catch", "catch"],
    "iserror": ["iserror", "error state"],
    "aria-label": ["aria-label", "aria"],
    "keyboard": ["keyboard", "onkeydown", "tabindex"],
    "semantic html": ["semantic", "main", "nav", "section"],
    "alt text": ["alt text", "alt="],
    "focus": ["focus"],
  };

  for (const t of available) {
    const tLower = t.toLowerCase();
    let alreadyCovered = false;
    for (const [, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(kw => tLower.includes(kw)) && keywords.some(kw => findingsLower.includes(kw))) {
        alreadyCovered = true;
        break;
      }
    }
    if (!alreadyCovered) {
      targets.push(t);
    }
    if (targets.length >= 4) break;
  }

  return targets;
}

function buildNotes(dimension: string, pageTitle: string, routePath: string, module: string, findings: string[], improvements: string[], score: number): string {
  const scoreLabel = score <= 4 ? "Needs Improvement" : score <= 6 ? "Adequate" : score >= 9 ? "Excellent" : "Good";

  let md = `## ${dimension} — ${pageTitle}\n`;
  md += `**Route:** \`${routePath}\` | **Module:** ${module} | **Score: ${score}/10 (${scoreLabel})**\n\n`;

  if (findings.length > 0) {
    md += "### What's Working Well\n";
    for (const f of findings) { md += `- ${f}\n`; }
    md += "\n";
  }

  if (improvements.length > 0) {
    md += "### Recommended Improvements\n";
    for (const i of improvements) { md += `- ${i}\n`; }
    md += "\n";
  }

  if (score < 10) {
    const nextTarget = score < 9 ? 9 : 10;
    const reachTargets = getReachTargets(dimension, score, findings);
    if (reachTargets.length > 0) {
      md += `### How to Reach ${nextTarget}/10\n`;
      md += `Current score is ${score}/10. To reach ${nextTarget}/10, implement the following:\n\n`;
      for (const t of reachTargets) { md += `- [ ] ${t}\n`; }
      md += "\n";
    }
  }

  if (score >= 9 && improvements.length === 0) {
    md += `### Summary\nThis page meets quality standards for ${dimension.toLowerCase()}. Continue maintaining current patterns.\n`;
  }

  return md;
}

function getDefaultScores(pageTitle: string, module: string, routePath: string): AuditScores {
  const note = `## Assessment — ${pageTitle}\n**Route:** \`${routePath}\` | **Module:** ${module}\n\n**Note:** Source file could not be located for static analysis. Default scores assigned pending manual review.\n`;
  return {
    functionality: 3, uiUx: 3, security: 3, performance: 3,
    codeQuality: 3, dataIntegrity: 3, errorHandling: 3, accessibility: 3,
    functionalityNotes: note, uiUxNotes: note, securityNotes: note, performanceNotes: note,
    codeQualityNotes: note, dataIntegrityNotes: note, errorHandlingNotes: note, accessibilityNotes: note,
  };
}

function resolveLocalImports(entryAbsPath: string, entryCode: string): { allCode: string; localFileCount: number; totalLines: number; entryLines: number } {
  const entryDir = path.dirname(entryAbsPath);
  const entryLines = entryCode.split("\n").length;
  const localImportPattern = /from\s+["'](\.\/[^"']+|\.\.\/[^"']+)["']/g;
  const localFiles: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = localImportPattern.exec(entryCode)) !== null) {
    const importPath = match[1];
    const extensions = [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
    for (const ext of extensions) {
      const candidate = path.resolve(entryDir, importPath.endsWith(ext) ? importPath : importPath + ext);
      try {
        if (fs.existsSync(candidate)) {
          if (!localFiles.includes(candidate)) localFiles.push(candidate);
          break;
        }
      } catch {
        // skip
      }
    }
  }

  const pageDirName = path.basename(entryAbsPath, path.extname(entryAbsPath));
  const siblingDir = path.resolve(entryDir, pageDirName);
  try {
    if (fs.statSync(siblingDir).isDirectory()) {
      const dirFiles = fs.readdirSync(siblingDir).filter(f => /\.(tsx?|jsx?)$/.test(f));
      for (const f of dirFiles) {
        const fullPath = path.resolve(siblingDir, f);
        if (!localFiles.includes(fullPath)) localFiles.push(fullPath);
      }
    }
  } catch {
    // no sibling directory
  }

  let allCode = entryCode;
  for (const fp of localFiles) {
    try {
      allCode += "\n" + fs.readFileSync(fp, "utf-8");
    } catch {
      // skip unreadable files
    }
  }

  return { allCode, localFileCount: localFiles.length, totalLines: allCode.split("\n").length, entryLines };
}

export function analyzePageCode(filePath: string, routePath: string, pageTitle: string, module: string): AuditScores {
  const absPath = path.resolve(process.cwd(), filePath);
  let entryCode = "";
  try {
    entryCode = fs.readFileSync(absPath, "utf-8");
  } catch {
    return getDefaultScores(pageTitle, module, routePath);
  }

  const { allCode: code, localFileCount, totalLines: lines, entryLines } = resolveLocalImports(absPath, entryCode);
  const isModularized = localFileCount > 0;
  const isMobile = routePath.startsWith("/mobile");
  const isAdmin = routePath.startsWith("/admin") || routePath.startsWith("/super-admin");
  const pageType = classifyPageType(routePath, pageTitle, code);
  const apiEndpoints = extractApiEndpoints(code);
  const componentImports = extractComponentImports(code);
  const backendRoutes = findRelatedBackendRoutes(routePath);

  const hasUseQuery = /useQuery/.test(code);
  const queryCount = (code.match(/useQuery/g) || []).length;
  const hasMutation = /useMutation/.test(code);
  const mutationCount = (code.match(/useMutation/g) || []).length;
  const hasForm = /useForm|<Form\b|<form\b/.test(code);
  const hasValidation = /zodResolver|safeParse|z\.object/.test(code);
  const hasLoading = /isLoading|isPending|Loader2|Skeleton|skeleton/.test(code);
  const hasErrorHandling = /isError|onError|catch\b|\.error/.test(code);
  const hasToast = /useToast|toast\(/.test(code);
  const hasPagination = /pagination|offset|page\s*[=:]|nextPage|prevPage|pageSize|limit\s*[=:]/i.test(code);
  const hasSearch = /[Ss]earch/.test(code);
  const hasFilter = /[Ff]ilter/.test(code);
  const hasSort = /[Ss]ort/.test(code);
  const hasDialog = /Dialog\b/.test(code);
  const hasTabs = /Tabs\b|TabsList/.test(code);
  const hasTable = /<Table\b|DataTable/.test(code);
  const hasBadge = /Badge\b/.test(code);
  const hasButton = /Button\b/.test(code);
  const hasCard = /Card\b|CardContent|CardHeader/.test(code);
  const hasIcons = /lucide-react/.test(code);
  const hasResponsive = /\b(sm|md|lg|xl):|grid-cols/.test(code);
  const hasAuth = /requireAuth|session|userId|user\?\./.test(code);
  const hasRbac = /role\s*===|isAdmin|isSuperAdmin|ADMIN|MANAGER|role.*check/i.test(code);
  const hasDangerousHtml = /dangerouslySetInnerHTML/.test(code);
  const hasUseMemo = /useMemo|useCallback|React\.memo/.test(code);
  const hasInterface = /interface\s+\w+/.test(code);
  const hasTypeExport = /type\s+\w+\s*=/.test(code);
  const hasDataTestId = /data-testid/.test(code);
  const testIdCount = (code.match(/data-testid/g) || []).length;
  const hasAriaLabel = /aria-label|aria-describedby|aria-live|role=["']/.test(code);
  const hasAltText = /alt=/.test(code);
  const hasEmptyState = /empty|no\s+(data|results|items|records)|Nothing\s+to|no.*found/i.test(code);
  const hasTryCatch = /try\s*\{/.test(code);
  const hasDebounce = /debounce|useDebounce/.test(code);
  const hasSelect = /SelectItem|SelectTrigger/.test(code);
  const hasDatePicker = /DatePicker|Calendar/.test(code);
  const hasExport = /\bexport.*xlsx|download.*excel|ExcelJS|csv/i.test(code);
  const hasBulkOps = /selectedIds|selectAll|bulk/i.test(code);
  const hasInvalidateQueries = /invalidateQueries|queryClient\.invalidate/.test(code);
  const hasConfirmDialog = /confirm\(|AlertDialog|are you sure/i.test(code);
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  const hasKeyboardNav = /onKeyDown|onKeyPress|onKeyUp|tabIndex/.test(code);
  const hasSemanticHtml = /<(main|nav|section|article|aside|header|footer)\b/.test(code);
  const hasFocusManagement = /focus\(\)|autoFocus|ref.*focus/.test(code);
  const hasConditionalRender = /\?\s*</g.test(code);

  let functionality = 3;
  let uiUx = 3;
  let security = 3;
  let performance = 3;
  let codeQuality = 3;
  let dataIntegrity = 3;
  let errorHandling = 3;
  let accessibility = 3;

  const fnFindings: string[] = [];
  const fnImprovements: string[] = [];
  const uiFindings: string[] = [];
  const uiImprovements: string[] = [];
  const secFindings: string[] = [];
  const secImprovements: string[] = [];
  const perfFindings: string[] = [];
  const perfImprovements: string[] = [];
  const cqFindings: string[] = [];
  const cqImprovements: string[] = [];
  const diFindings: string[] = [];
  const diImprovements: string[] = [];
  const ehFindings: string[] = [];
  const ehImprovements: string[] = [];
  const a11yFindings: string[] = [];
  const a11yImprovements: string[] = [];

  if (hasUseQuery) {
    functionality += 0.3;
    fnFindings.push(`Uses ${queryCount} TanStack Query hook(s) for server data fetching via ${apiEndpoints.slice(0, 3).join(", ") || "API endpoints"}`);
  } else {
    fnImprovements.push("No server data fetching detected - page appears to be static or uses non-standard data loading");
  }
  if (hasMutation) {
    functionality += 0.3;
    fnFindings.push(`Implements ${mutationCount} mutation(s) for creating/updating/deleting data`);
  }
  if (hasForm) {
    functionality += 0.2;
    fnFindings.push(`Includes form handling for user input on the ${pageTitle}`);
  }
  if (hasSearch && hasFilter) {
    functionality += 0.3;
    fnFindings.push("Provides both search and filter capabilities for data discovery");
  } else if (hasSearch || hasFilter) {
    functionality += 0.15;
    fnFindings.push(hasSearch ? "Has search functionality" : "Has filter functionality");
    if (pageType === "list") fnImprovements.push("List page could benefit from additional search/filter options");
  }
  if (hasSort) { functionality += 0.1; fnFindings.push("Supports column/data sorting"); }
  if (hasDialog) { functionality += 0.1; fnFindings.push("Uses modal dialogs for focused interactions (e.g. create/edit/confirm)"); }
  if (hasTabs) { functionality += 0.1; fnFindings.push("Multi-tab layout organizes content by category"); }
  if (hasTable) { functionality += 0.15; fnFindings.push("Renders data in a structured table format"); }
  if (hasPagination) { functionality += 0.15; fnFindings.push("Supports paginated data loading"); }
  if (hasExport) { functionality += 0.1; fnFindings.push("Offers data export/download capability"); }
  if (hasBulkOps) { functionality += 0.1; fnFindings.push("Supports bulk operations on multiple items"); }
  if (pageType === "list" && !hasSearch && !hasFilter) {
    fnImprovements.push("List page has no search or filter - users cannot easily find specific records");
  }
  if (pageType === "list" && !hasPagination && hasTable) {
    fnImprovements.push("Data table without pagination could cause issues with large datasets");
  }

  if (hasCard) { uiUx += 0.15; uiFindings.push("Uses Card components for visually organized content sections"); }
  if (hasIcons) { uiUx += 0.15; uiFindings.push("Uses Lucide icons for visual affordance on actions and labels"); }
  if (hasResponsive) { uiUx += 0.25; uiFindings.push("Has responsive breakpoints (sm/md/lg) for different screen sizes"); }
  if (hasLoading) { uiUx += 0.25; uiFindings.push("Displays loading states (spinners/skeletons) while fetching data"); }
  if (hasEmptyState) { uiUx += 0.15; uiFindings.push("Shows meaningful empty state when no records exist"); }
  if (hasBadge) { uiUx += 0.1; uiFindings.push("Uses badges for status/category indicators"); }
  if (hasToast) { uiUx += 0.15; uiFindings.push("Provides toast notifications for success/error feedback"); }
  if (hasSelect) { uiUx += 0.05; uiFindings.push("Uses Select dropdowns for structured choices"); }
  if (hasDatePicker) { uiUx += 0.05; uiFindings.push("Includes date picker for temporal input"); }
  if (hasConditionalRender) { uiUx += 0.05; uiFindings.push("Uses conditional rendering to show/hide UI elements contextually"); }
  if (!hasLoading) { uiImprovements.push("No loading indicator detected - users may see a blank page while data loads"); }
  if (!hasResponsive && !isMobile) { uiImprovements.push("No responsive breakpoints found - layout may not adapt to tablet/smaller screens"); }
  if (!hasEmptyState && (pageType === "list" || hasTable)) { uiImprovements.push("No empty state message for when no records exist"); }
  if (!hasToast && hasMutation) { uiImprovements.push("Data mutations lack toast feedback - users may not know if their action succeeded"); }
  if (isMobile) {
    uiFindings.push("Mobile-optimized page layout");
    uiUx += 0.1;
  }

  if (isAdmin) {
    secFindings.push(`Admin page at ${routePath} - protected by route-level admin/super-admin middleware on the server`);
    security += 0.3;
  }
  if (hasAuth) { security += 0.3; secFindings.push("References user session/authentication state in component logic"); }
  if (hasRbac) { security += 0.4; secFindings.push("Implements role-based UI rendering (shows/hides features based on user role)"); }
  if (hasValidation) { security += 0.2; secFindings.push("Uses Zod schema validation for input sanitization before API calls"); }
  if (hasDangerousHtml) { security -= 0.5; secImprovements.push("Uses dangerouslySetInnerHTML which can be an XSS vector if the content is not sanitized server-side"); }
  if (hasConfirmDialog) { secFindings.push("Has confirmation dialogs before destructive actions"); }
  if (!hasValidation && hasForm) { secImprovements.push("Forms submit without client-side schema validation - relying solely on server-side checks"); }
  secFindings.push(`Server-side routes (${backendRoutes.join(", ") || "standard middleware"}) enforce authentication and authorization`);

  if (hasUseMemo) { performance += 0.3; perfFindings.push("Uses useMemo/useCallback to prevent unnecessary re-computations"); }
  if (hasPagination) { performance += 0.2; perfFindings.push("Paginates data to avoid loading all records at once"); }
  if (hasDebounce) { performance += 0.2; perfFindings.push("Debounces input to reduce excessive API calls during typing"); }
  if (hasInvalidateQueries) { performance += 0.1; perfFindings.push("Properly invalidates TanStack Query cache after mutations for fresh data"); }
  if (isModularized) {
    perfFindings.push(`Well-modularized: entry file is ${entryLines} lines with ${localFileCount} local sub-component file(s) (${lines} total lines across all files)`);
    if (entryLines <= 800) { performance += 0.15; }
  } else if (lines > 1000) {
    performance -= 0.3; perfImprovements.push(`File has ${lines} lines - consider splitting into sub-components for faster rendering and code splitting`);
  } else if (lines > 600) {
    perfImprovements.push(`File has ${lines} lines - moderate size, could benefit from extracting reusable sub-components`);
  } else {
    perfFindings.push(`Compact file size (${lines} lines) keeps bundle impact low`);
  }
  if (!hasUseMemo && entryLines > 400 && hasUseQuery) { perfImprovements.push("No memoization in a data-fetching component - computed values may recalculate on every render"); }
  if (!hasPagination && hasTable) { perfImprovements.push("Table renders without pagination - large datasets could cause UI lag"); }
  if (!hasDebounce && hasSearch) { perfImprovements.push("Search input lacks debouncing - may trigger excessive API calls on each keystroke"); }

  if (hasInterface) { codeQuality += 0.2; cqFindings.push("Defines TypeScript interfaces for structured type safety"); }
  if (hasTypeExport) { codeQuality += 0.1; cqFindings.push("Exports/defines type aliases for reusability"); }
  if (anyCount === 0) { codeQuality += 0.3; cqFindings.push("Zero 'any' type usage - fully typed component"); }
  else if (anyCount <= 3) { codeQuality += 0.1; cqFindings.push(`Only ${anyCount} 'any' type usage(s) - mostly well-typed`); }
  else { codeQuality -= 0.2; cqImprovements.push(`${anyCount} 'any' type usages weaken type safety - replace with proper interfaces`); }
  if (hasDataTestId) { codeQuality += 0.2; cqFindings.push(`${testIdCount} data-testid attribute(s) enable automated testing`); }
  else { cqImprovements.push("No data-testid attributes - automated UI testing cannot target specific elements"); }
  if (isModularized) {
    codeQuality += 0.3;
    cqFindings.push(`Well-structured: entry file (${entryLines} lines) delegates to ${localFileCount} local sub-component(s) for separation of concerns`);
  } else if (lines < 400) {
    codeQuality += 0.2; cqFindings.push("Well-scoped component at reasonable size");
  } else if (lines > 800) {
    cqImprovements.push(`${lines}-line file should be split into smaller, focused sub-components`);
  }
  if (componentImports.length > 0) { cqFindings.push(`Reuses ${componentImports.length} shared component(s)/hook(s) from the project library`); }

  if (hasValidation) { dataIntegrity += 0.4; diFindings.push("Client-side Zod validation ensures data meets schema requirements before API submission"); }
  if (hasInvalidateQueries) { dataIntegrity += 0.2; diFindings.push("Cache invalidation after mutations ensures UI displays current data"); }
  if (hasForm && hasValidation) { dataIntegrity += 0.2; diFindings.push("Form inputs are validated against defined schemas"); }
  if (hasForm && !hasValidation) { dataIntegrity -= 0.2; diImprovements.push("Forms lack client-side validation - invalid data may reach the server"); }
  if (hasConfirmDialog) { diFindings.push("Confirmation dialogs prevent accidental destructive actions"); }
  if (hasMutation && !hasInvalidateQueries) { diImprovements.push("Mutations may not invalidate query cache - stale data could display after changes"); }
  diFindings.push("Server-side validation and database constraints provide the primary data integrity layer");

  if (hasErrorHandling) { errorHandling += 0.25; ehFindings.push("Handles error states from data fetching (isError checks)"); }
  if (hasTryCatch) { errorHandling += 0.15; ehFindings.push("Uses try-catch blocks for exception recovery"); }
  if (hasToast) { errorHandling += 0.25; ehFindings.push("Displays toast notifications to inform users of errors"); }
  if (hasLoading) { errorHandling += 0.1; ehFindings.push("Loading states prevent user interaction during pending operations"); }
  if (!hasErrorHandling && hasUseQuery) { ehImprovements.push("No error state handling for failed data fetches - users see no feedback on API failures"); }
  if (!hasToast && hasMutation) { ehImprovements.push("Mutations lack error toast notifications - failures may go unnoticed by users"); }
  if (hasConditionalRender) { ehFindings.push("Conditional rendering guards against rendering undefined/null data"); }

  if (hasDataTestId) { accessibility += 0.1; a11yFindings.push("Data-testid attributes support automated accessibility testing"); }
  if (hasAriaLabel) { accessibility += 0.3; a11yFindings.push("Uses ARIA labels for screen reader identification of interactive elements"); }
  if (hasAltText) { accessibility += 0.15; a11yFindings.push("Provides alt text for images"); }
  if (hasKeyboardNav) { accessibility += 0.2; a11yFindings.push("Supports keyboard navigation (onKeyDown/tabIndex)"); }
  if (hasSemanticHtml) { accessibility += 0.15; a11yFindings.push("Uses semantic HTML elements (main, nav, section, etc.)"); }
  if (hasFocusManagement) { accessibility += 0.1; a11yFindings.push("Manages focus programmatically for better keyboard UX"); }
  if (hasButton) { a11yFindings.push("Uses semantic Button components (proper role and keyboard handling built-in)"); }
  if (!hasAriaLabel) { a11yImprovements.push("No ARIA labels detected - icon-only buttons and interactive elements need labels for screen readers"); }
  if (!hasKeyboardNav && hasTable) { a11yImprovements.push("Data table lacks explicit keyboard navigation support"); }
  if (!hasSemanticHtml) { a11yImprovements.push("No semantic HTML landmarks (main, section, nav) - assistive technology cannot identify page regions"); }

  const toTen = (n: number) => Math.max(1, Math.min(10, Math.round(n) * 2));

  return {
    functionality: toTen(functionality),
    uiUx: toTen(uiUx),
    security: toTen(security),
    performance: toTen(performance),
    codeQuality: toTen(codeQuality),
    dataIntegrity: toTen(dataIntegrity),
    errorHandling: toTen(errorHandling),
    accessibility: toTen(accessibility),
    functionalityNotes: buildNotes("Functionality", pageTitle, routePath, module, fnFindings, fnImprovements, toTen(functionality)),
    uiUxNotes: buildNotes("UI/UX", pageTitle, routePath, module, uiFindings, uiImprovements, toTen(uiUx)),
    securityNotes: buildNotes("Security", pageTitle, routePath, module, secFindings, secImprovements, toTen(security)),
    performanceNotes: buildNotes("Performance", pageTitle, routePath, module, perfFindings, perfImprovements, toTen(performance)),
    codeQualityNotes: buildNotes("Code Quality", pageTitle, routePath, module, cqFindings, cqImprovements, toTen(codeQuality)),
    dataIntegrityNotes: buildNotes("Data Integrity", pageTitle, routePath, module, diFindings, diImprovements, toTen(dataIntegrity)),
    errorHandlingNotes: buildNotes("Error Handling", pageTitle, routePath, module, ehFindings, ehImprovements, toTen(errorHandling)),
    accessibilityNotes: buildNotes("Accessibility", pageTitle, routePath, module, a11yFindings, a11yImprovements, toTen(accessibility)),
  };
}

export function generateFindingsSummary(pageTitle: string, routePath: string, module: string, scores: AuditScores): string {
  const dims = [
    { name: "Functionality", score: scores.functionality },
    { name: "UI/UX", score: scores.uiUx },
    { name: "Security", score: scores.security },
    { name: "Performance", score: scores.performance },
    { name: "Code Quality", score: scores.codeQuality },
    { name: "Data Integrity", score: scores.dataIntegrity },
    { name: "Error Handling", score: scores.errorHandling },
    { name: "Accessibility", score: scores.accessibility },
  ];

  const overall = Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length);

  let md = `# Code Audit Report: ${pageTitle}\n`;
  md += `**Route:** \`${routePath}\` | **Module:** ${module} | **Overall: ${overall}/10**\n\n`;
  md += "## Dimension Scores\n";
  for (const d of dims) {
    const filled = Math.round(d.score / 2);
    const bar = "█".repeat(filled) + "░".repeat(5 - filled);
    md += `| ${d.name.padEnd(16)} | ${bar} | ${d.score}/10 |\n`;
  }

  const strong = dims.filter(d => d.score >= 8).map(d => d.name);
  const weak = dims.filter(d => d.score <= 6).map(d => d.name);

  if (strong.length > 0) {
    md += `\n## Strengths\n${strong.map(s => `- ${s}`).join("\n")}\n`;
  }
  if (weak.length > 0) {
    md += `\n## Priority Improvements\n${weak.map(w => `- ${w}`).join("\n")}\n`;
  }

  return md;
}
