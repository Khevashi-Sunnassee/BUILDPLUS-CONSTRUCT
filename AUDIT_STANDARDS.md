# Audit Standards, Scoring Rubric & Issue Tracker
## LTE Performance Management System
### Last Updated: 2026-02-08

---

## Comprehensive Debugging & QA Audit Procedure

When the user requests a "comprehensive debugging", "full audit", "QA pass", or "code quality check", act as a senior full-stack engineer, performance engineer, and security auditor. Run a comprehensive debugging + quality-assurance pass across the ENTIRE application.

**CRITICAL: Before writing any findings, you MUST first review the Known Issues Tracker and the Verified Fixes Registry below. Do NOT re-flag items that are already marked FIXED or MITIGATED. Verify their current status instead.**

### Pre-Audit: Review Prior State
1. Read the Known Issues Tracker below — note which items are OPEN vs FIXED vs MITIGATED.
2. For each item in the Verified Fixes Registry, run the specified verification to confirm it is still in place.
3. Only flag an item as a new finding if it is NOT already tracked, or if a previously verified fix has regressed.
4. If a verified fix has regressed, move it back to the Known Issues Tracker with status REGRESSED.

### 0. Baseline & Inventory
- Enumerate key directories (client/src/, server/, shared/, public/) and entry points.
- List all API routes/endpoints and all page routes.
- Identify coding rules/conventions (eslint, prettier, tsconfig, folder conventions).
- If config files are missing, flag as a risk.

### 1. Frontend (Deep)
- Validate React/TypeScript correctness end-to-end.
- Hooks rules audit, state management audit, routing & UI flow audit.
- Form & data handling: validation gaps, unsafe parsing, missing loading/error states.
- Client security: XSS risks from dangerouslySetInnerHTML, unsafe HTML rendering.
- Bundle/performance: large bundles, code splitting, unnecessary rerenders.
- Ensure no secrets in client bundle.

### 2. Backend (Deep)
- Validate ALL API endpoints exist, are reachable, consistently implemented.
- Confirm input validation (Zod safeParse), auth middleware, error handling.
- Database: N+1 patterns, missing indexes, transaction usage, pool config.
- Data integrity: constraints, race conditions, concurrent write safety.
- File uploads: type checking, size limits, path traversal protections.

### 3. Security (Comprehensive)
- CSRF: Verify middleware at `server/middleware/csrf.ts`, applied in `server/routes/index.ts`.
- Cookies & sessions: HttpOnly, Secure, SameSite flags.
- XSS: Verify DOMPurify on all dangerouslySetInnerHTML and innerHTML.
- Secrets: no hardcoded keys, no eval().
- Security headers: CSP in Helmet (`server/index.ts`), HSTS, X-Frame-Options.
- Rate limiting on auth + write-heavy endpoints.

### 4. TypeScript, Build, and Codebase Integrity
- Run `npx tsc --noEmit` — target: 0 errors.
- Count `any` usages — target: trending downward.
- Check for ESLint/Prettier config files.
- Run `npx vite build` — confirm clean build, report chunk sizes.

### 5. Performance & Scalability (200+ Users)
- DB pool sizing, caching strategy, N+1 patterns, code splitting status.
- Blocking Node operations, background job needs.

### 6. Rules Compliance
- Verify against Coding Rules in `replit.md`.

### 7. Observability & Operations
- Structured logging, request-id tracing, health checks, error monitoring.

### 8. Output Requirements (Non-negotiable)
- Use the FIXED scoring rubric below. Do NOT invent new categories or weights.
- Assign a letter grade using the thresholds below.
- State deploy status: SAFE TO DEPLOY or BLOCKED.
- Provide Top 10 Fix List referencing Known Issues Tracker IDs.
- UPDATE the Known Issues Tracker and Verified Fixes Registry in this file.

**Audit Principles:** Be strict. Assume production risk. NEVER contradict a prior finding without verifying current state with a specific command.

---

## Fixed Scoring Rubric (Mandatory for All Audits)

Every audit MUST use these exact categories and weights. Do NOT change them. Score each category independently — do not penalize the same issue in multiple categories.

| # | Category | Weight | How to Verify | What Scores 10/10 |
|---|---|---|---|---|
| 1 | **TypeScript & Build** | 15% | `npx tsc --noEmit`; `npx vite build` | 0 TS errors, clean build, `any` count trending down |
| 2 | **Security** | 20% | Verify CSRF, CSP, DOMPurify, rate limiting, cookie flags | All security layers active, no bypasses, all HTML sanitized |
| 3 | **Backend & API** | 15% | Count safeParse, db.transaction, auth middleware | Zod on all mutating routes, transactions on multi-step writes, auth on all protected |
| 4 | **Database & Integrity** | 15% | Index count, FK constraints, pool config | Indexes on FKs, constraints in place, proper pool sizing |
| 5 | **Frontend Quality** | 10% | Loading/error states, form validation, component patterns | Loading states, error boundaries, react-hook-form+zod, consistent shadcn/ui |
| 6 | **Performance & Scale** | 10% | Build chunk sizes, N+1 patterns, code splitting | Code splitting implemented, no N+1, caching where needed |
| 7 | **Observability** | 5% | Logging, request IDs, health checks | Structured logging, request-id, health endpoint, error monitoring |
| 8 | **Rules Compliance** | 5% | Compare against Coding Rules in replit.md | Consistent patterns, no deviations |
| 9 | **Testing** | 5% | Count test files (excl node_modules) | Tests on critical business logic, key API flows |

**Scoring guidance (0-10 per category):**
- **10**: Meets all criteria, no issues
- **8-9**: Minor issues only, no security or data integrity risks
- **6-7**: Some gaps, no critical risks, mitigations in place
- **4-5**: Significant gaps with production risk
- **2-3**: Critical issues that will cause failures
- **0-1**: Fundamentally broken or missing

### Grade Thresholds

| Weighted Score | Grade | Deploy Status |
|---|---|---|
| 90-100 | A | SAFE TO DEPLOY |
| 80-89 | B | SAFE with minor caveats |
| 70-79 | C+ | CONDITIONAL — fix high-priority items first |
| 60-69 | C | CONDITIONAL — fix critical items first |
| 50-59 | D | BLOCKED — significant issues |
| Below 50 | F | BLOCKED — fundamental problems |

---

## Verified Fixes Registry

Items that have been implemented and verified. Every audit MUST confirm these are still in place. If any has regressed, move it to Known Issues Tracker with status REGRESSED.

| ID | Fix Description | Verification Method | Date Verified |
|---|---|---|---|
| VF-001 | TypeScript: 0 compilation errors | `npx tsc --noEmit` returns no errors | 2026-02-08 |
| VF-002 | CSRF protection via double-submit cookie | `server/middleware/csrf.ts` exists, imported in `server/routes/index.ts` | 2026-02-08 |
| VF-003 | Content Security Policy enabled in Helmet | `server/index.ts` has `contentSecurityPolicy: { directives: ... }` (not `false`) | 2026-02-08 |
| VF-004 | DOMPurify on all dangerouslySetInnerHTML/innerHTML | All `dangerouslySetInnerHTML` and `innerHTML` in client/src use `DOMPurify.sanitize()` | 2026-02-08 |
| VF-005 | DB transactions on critical financial operations | `db.transaction` in progress-claims (4), contracts (1), panels (1) | 2026-02-08 |
| VF-006 | Zod validation on PATCH/PUT routes | `safeParse` calls in logistics, checklist, and other PATCH routes | 2026-02-08 |
| VF-007 | Company scope checks on EOT claims, broadcast, logistics | `companyId` ownership verification in eot-claims, broadcast, logistics routes | 2026-02-08 |
| VF-008 | Optimistic locking on contracts and progress claims | `version` column incremented via `sql` expression on updates | 2026-02-08 |
| VF-009 | safeParseFinancial replaces raw parseFloat | `safeParseFinancial` function used across server routes | 2026-02-08 |
| VF-010 | Auth on import-estimate endpoint | `requireAuth, requireRole` on `/api/jobs/:jobId/import-estimate` | 2026-02-08 |
| VF-011 | Database indexes (400+) on FKs and frequent filters | `SELECT count(*) FROM pg_indexes WHERE schemaname='public'` returns 400+ | 2026-02-08 |
| VF-012 | Session cookies: HttpOnly, Secure (prod), SameSite=lax | Cookie config in `server/routes/index.ts` | 2026-02-08 |
| VF-013 | Rate limiting: API, Auth, Upload tiers | Three `rateLimit` instances in `server/index.ts` | 2026-02-08 |
| VF-014 | Password hashing with bcrypt | bcrypt used in auth routes and seed | 2026-02-08 |
| VF-015 | No hardcoded secrets, no eval() | Grep returns 0 results in server/client | 2026-02-08 |
| VF-016 | SQL injection prevention via Drizzle parameterized queries | All SQL uses Drizzle ORM or `sql` tagged template literals | 2026-02-08 |
| VF-017 | Connection pool: max 50 with statement timeout | Pool config in `server/db.ts` | 2026-02-08 |
| VF-018 | Express v5 params: String(req.params.id) pattern | Confirmed by 0 TypeScript errors | 2026-02-08 |
| VF-019 | Pino structured logging | Pino configured in `server/index.ts` | 2026-02-08 |
| VF-020 | JSON body limit reduced to 5MB (50MB only for upload routes) | `grep "limit" server/index.ts` shows 5mb default, 50mb on upload routes only | 2026-02-08 |
| VF-021 | Request-ID middleware for tracing | `grep "requestId\|X-Request-Id" server/index.ts` shows UUID generation per request | 2026-02-08 |
| VF-022 | Zod validation on ALL route files (39/39 with safeParse) | `grep -c safeParse server/routes/*.ts` shows all route files have validation | 2026-02-08 |
| VF-023 | Route-level code splitting with React.lazy() | `grep "lazy(" client/src/App.tsx` shows ~80 lazy-loaded pages with Suspense fallback | 2026-02-08 |
| VF-024 | Test coverage: 7 test files, 219 tests passing | `npx vitest run` shows 7 files, 219 tests, 0 failures | 2026-02-08 |
| VF-025 | Composite indexes on progress_claims, panel_audit_logs, timer_sessions | SQL `SELECT indexname FROM pg_indexes WHERE indexname LIKE '%job_status%' OR indexname LIKE '%panel_created_at%' OR indexname LIKE '%user_started_at%'` returns 3 rows | 2026-02-08 |
| VF-026 | CHECK constraints on financial columns (progress_claims, contracts, users, progress_claim_items) | `SELECT conname FROM pg_constraint WHERE contype='c' AND conname LIKE 'chk_%'` returns 14+ constraints | 2026-02-08 |
| VF-027 | N+1 query fix: batch getDocumentsByIds replaces sequential getDocument loops | `grep "getDocumentsByIds" server/routes/documents.routes.ts` shows batch fetch in email and bundle creation | 2026-02-08 |
| VF-028 | Error monitoring: ErrorMonitor class with tracking, admin summary endpoint | `grep "errorMonitor" server/index.ts server/lib/error-monitor.ts` shows integration | 2026-02-08 |
| VF-029 | ESLint configuration with TypeScript plugin | `eslint.config.js` exists with @typescript-eslint rules, `npx eslint server/index.ts` runs successfully | 2026-02-08 |

---

## Known Issues Tracker

**Status:** OPEN | MITIGATED | REGRESSED | WONTFIX
**Priority:** P0 = before production | P1 = within 1 sprint | P2 = within 1 month | P3 = nice-to-have

| ID | Issue | Priority | Status | Category | Notes | Date |
|---|---|---|---|---|---|---|
| KI-001 | 50MB JSON body limit in `server/index.ts` | P1 | FIXED | Security | Reduced to 5MB default; 50MB only on upload routes. See VF-020 | 2026-02-08 |
| KI-002 | No request-id / correlation-id tracing | P2 | FIXED | Observability | Request-ID middleware added with X-Request-Id header. See VF-021 | 2026-02-08 |
| KI-003 | No ESLint or Prettier configuration | P2 | FIXED | Build/Quality | ESLint configured with @typescript-eslint. See VF-029 | 2026-02-08 |
| KI-004 | Insufficient test coverage | P1 | FIXED | Testing | 7 test files, 219 tests (financial calcs, lifecycle, validation, API). See VF-024 | 2026-02-08 |
| KI-005 | 5.3MB main JS bundle — no code splitting | P1 | FIXED | Performance | React.lazy() with Suspense on ~80 page routes. See VF-023 | 2026-02-08 |
| KI-006 | Excessive `any` usages (~818 baseline) | P2 | OPEN | TypeScript | Target: trending down. Focus on server routes first | 2026-02-07 |
| KI-007 | Panel rate columns use `text` not `decimal` | P2 | MITIGATED | Database | safeParseFinancial guards at app layer. DO NOT change types without migration plan + backup + approval | 2026-02-07 |
| KI-008 | No CHECK constraints on financial values | P2 | FIXED | Database | 14+ CHECK constraints on progress_claims, contracts, users, progress_claim_items. See VF-026 | 2026-02-08 |
| KI-009 | Settings route lacks Zod validation | P1 | FIXED | Backend | All 4 mutating endpoints now have Zod safeParse. See VF-022 | 2026-02-08 |
| KI-010 | N+1 query patterns in documents/bundles/drafting | P2 | FIXED | Performance | Batch getDocumentsByIds replaces sequential loops. See VF-027 | 2026-02-08 |
| KI-011 | No offline handling for mobile pages | P2 | OPEN | Frontend | Retry logic and offline detection | 2026-02-07 |
| KI-012 | Health endpoint exposes memory/pool info | P3 | OPEN | Security | Restrict to authenticated admins | 2026-02-07 |
| KI-013 | Rate limiting per-IP — proxy users share IP | P2 | OPEN | Performance | Consider per-session limiting | 2026-02-07 |
| KI-014 | updatedAt not auto-updated by DB triggers | P3 | OPEN | Database | App code handles inconsistently | 2026-02-07 |
| KI-015 | No error monitoring (Sentry or equivalent) | P2 | FIXED | Observability | ErrorMonitor class with admin summary endpoint. See VF-028 | 2026-02-08 |
| KI-016 | Missing composite indexes on 3 tables | P2 | FIXED | Database | Composite indexes added: progress_claims(jobId,status), panel_audit_logs(panelId,createdAt), timer_sessions(userId,startedAt). See VF-025 | 2026-02-08 |
| KI-017 | No form auto-save or unsaved changes warning | P3 | OPEN | Frontend | Contract, progress claim, opportunity forms | 2026-02-07 |
| KI-018 | Some delete operations lack confirmation | P3 | OPEN | Frontend | Checklist instances, document bundles, panel removal | 2026-02-07 |

**Maintenance Rule:** Any code change touching security, auth, validation, or database schema MUST update this tracker and the Verified Fixes Registry. Stale documentation is a risk.

---

## Audit History

| Date | Score | Grade | Key Changes |
|---|---|---|---|
| 2026-02-07 | 62/100 | C+ | Initial audit (AUDIT_REPORT.md). 170 TS errors, zero indexes, CSP disabled. |
| 2026-02-07 | 87/100 (8.7/10) | B+ | Enterprise hardening (ENTERPRISE_AUDIT_REPORT.md). Added transactions, CSRF, Zod, company scope, optimistic locking, safeParseFinancial. Score used different rubric — not directly comparable. |
| 2026-02-08 | 75.5/100 | C+ | Latest audit (in-chat). 0 TS errors, verified fixes in place. Score used yet another rubric — not comparable. |
| 2026-02-08 | — | — | Standardized rubric established. All future audits use this fixed rubric for comparable scoring. |
| 2026-02-08 | 84.5/100 | B | Fixed P1 items: JSON limit (KI-001), request-id (KI-002), Zod on all routes (KI-009), code splitting (KI-005), test coverage (KI-004). Added VF-020 through VF-024. |
| 2026-02-08 | — | — | Fixed P2 items: composite indexes (KI-016), CHECK constraints (KI-008), N+1 batch queries (KI-010), error monitoring (KI-015), ESLint (KI-003). Added VF-025 through VF-029. 10 of 18 KIs now FIXED, 1 MITIGATED. |
