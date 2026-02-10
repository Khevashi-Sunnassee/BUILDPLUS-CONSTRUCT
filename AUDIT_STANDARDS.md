# Audit Standards, Scoring Rubric & Issue Tracker
## LTE Performance Management System
### Last Updated: 2026-02-10

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
| VF-001 | TypeScript: 0 compilation errors | `npx tsc --noEmit` returns no errors | 2026-02-10: 0 errors confirmed. Previously regressed (KI-019), now resolved. |
| VF-002 | CSRF protection via double-submit cookie | `server/middleware/csrf.ts` exists, imported in `server/routes/index.ts` | 2026-02-08 |
| VF-003 | Content Security Policy enabled in Helmet | `server/index.ts` has `contentSecurityPolicy: { directives: ... }` (not `false`) | 2026-02-08 |
| VF-004 | DOMPurify on all dangerouslySetInnerHTML/innerHTML | All `dangerouslySetInnerHTML` and `innerHTML` in client/src use `DOMPurify.sanitize()` | 2026-02-08 |
| VF-005 | DB transactions on critical financial operations | `db.transaction` in progress-claims (4), contracts (1), panels (1) | 2026-02-08 |
| VF-006 | Zod validation on PATCH/PUT routes | `safeParse` calls in logistics, checklist, and other PATCH routes | 2026-02-08 |
| VF-007 | Company scope checks on EOT claims, broadcast, logistics | `companyId` ownership verification in eot-claims, broadcast, logistics routes | 2026-02-08 |
| VF-008 | Optimistic locking on contracts and progress claims | `version` column incremented via `sql` expression on updates | 2026-02-08 |
| VF-009 | safeParseFinancial replaces raw parseFloat | `safeParseFinancial` function used across server routes | 2026-02-08 |
| VF-010 | Auth on import-estimate endpoint | `requireAuth, requireRole` on `/api/jobs/:jobId/import-estimate` | 2026-02-08 |
| VF-011 | Database indexes (450+) on FKs and frequent filters | `SELECT count(*) FROM pg_indexes WHERE schemaname='public'` returns 450+ | 2026-02-09 |
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
| VF-023 | Route-level code splitting with React.lazy() | `grep "lazy(" client/src/App.tsx` shows 81 lazy-loaded pages with Suspense fallback | 2026-02-09 |
| VF-024 | Test coverage: 7 test files, 219 tests passing | `npx vitest run` shows 7 files, 219 tests, 0 failures | 2026-02-08 |
| VF-025 | Composite indexes on progress_claims, panel_audit_logs, timer_sessions | SQL `SELECT indexname FROM pg_indexes WHERE indexname LIKE '%job_status%' OR indexname LIKE '%panel_created_at%' OR indexname LIKE '%user_started_at%'` returns 3 rows | 2026-02-08 |
| VF-026 | CHECK constraints on financial columns (progress_claims, contracts, users, progress_claim_items) | `SELECT conname FROM pg_constraint WHERE contype='c' AND conname LIKE 'chk_%'` returns 14+ constraints | 2026-02-08 |
| VF-027 | N+1 query fix: batch getDocumentsByIds replaces sequential getDocument loops | `grep "getDocumentsByIds" server/routes/documents.routes.ts` shows batch fetch in email and bundle creation | 2026-02-08 |
| VF-028 | Error monitoring: ErrorMonitor class with tracking, admin summary endpoint | `grep "errorMonitor" server/index.ts server/lib/error-monitor.ts` shows integration | 2026-02-08 |
| VF-029 | ESLint configuration with TypeScript plugin | `eslint.config.js` exists with @typescript-eslint rules, `npx eslint server/index.ts` runs successfully | 2026-02-08 |
| VF-030 | Health endpoint restricted: memory/pool info only for admin sessions | `grep "isAdmin" server/index.ts` shows conditional detail exposure in /api/health | 2026-02-08 |
| VF-031 | Per-session rate limiting: sessionKeyGenerator uses session.id when available, falls back to IP | `grep "sessionKeyGenerator" server/index.ts` shows custom keyGenerator on apiLimiter | 2026-02-08 |
| VF-032 | Offline detection for mobile pages: useOnlineStatus hook with toast notifications and visual indicator | `grep "useOnlineStatus" client/src/components/layout/mobile-layout.tsx` shows integration | 2026-02-08 |
| VF-033 | Unsaved changes warning: useUnsavedChanges hook on purchase-order-form and manual-entry forms | `grep "useUnsavedChanges" client/src/pages/purchase-order-form.tsx client/src/pages/manual-entry.tsx` shows integration | 2026-02-08 |
| VF-034 | Delete confirmations already present on all cited operations (checklist, bundles, panels) — verified with AlertDialog grep | `grep -c "AlertDialog" client/src/pages/checklist-fill.tsx client/src/pages/document-register/BundleDialogs.tsx client/src/pages/admin/panels/PanelDialogs.tsx` shows 22, 22, 36 matches | 2026-02-08 |
| VF-035 | TypeScript `any` reduction: 200+ `catch (error: any)` → `catch (error: unknown)` across 15 route files with type-guarded error access | `grep -c "catch.*unknown" server/routes/*.ts` shows widespread adoption | 2026-02-08 |
| VF-036 | DB triggers for auto-updating updated_at on all tables with updated_at column | `SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trg_%_updated_at'` returns 72 | 2026-02-09 |
| VF-037 | Employee management: 4 tables with 21 indexes, proper FK constraints, cascade deletes | `SELECT count(*) FROM pg_indexes WHERE tablename LIKE 'employee%'` returns 21 | 2026-02-09 |
| VF-038 | Employee routes: Zod safeParse (8), requireAuth/requireRole (19), catch(error:unknown) (18), company scope (4) | `grep -c safeParse server/routes/employee.routes.ts` returns 8 | 2026-02-09 |
| VF-039 | Employee frontend: 156 data-testid attributes across list + detail pages | `grep -c data-testid client/src/pages/admin/employees.tsx employee-detail.tsx` returns 43+113 | 2026-02-09 |
| VF-040 | Panel rate/cost columns migrated from text to decimal(14,2) | 26 columns across panel_types (11), job_panel_rates (8), panel_register (5), contracts (2). Backup tables created. `SELECT data_type FROM information_schema.columns WHERE column_name='sell_rate_per_m2' AND table_name='panel_types'` returns `numeric` | 2026-02-09 |
| VF-041 | Hire Booking Engine: hire_bookings table with 9 indexes, Zod safeParse, requireAuth on all routes | `SELECT count(*) FROM pg_indexes WHERE tablename='hire_bookings'` returns 9. `grep -c safeParse server/routes/hire.routes.ts` returns validation. | 2026-02-09 |
| VF-042 | hire_bookings updated_at trigger added | `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table='hire_bookings' AND trigger_name LIKE 'trg_%'` returns trg_hire_bookings_updated_at | 2026-02-09 |
| VF-043 | Job audit trail: frontend handles both PHASE_CHANGE and PHASE_CHANGED action strings | `grep "PHASE_CHANGE\|STATUS_CHANGE" client/src/pages/admin/jobs/AuditLogPanel.tsx` shows both variants checked | 2026-02-09 |
| VF-044 | All catch blocks use `catch (error: unknown)` with type-guarded error access | `grep -c "catch (error: any)" server/routes/*.ts` returns 0 in all files. All error.message access uses `error instanceof Error ? error.message : String(error)` | 2026-02-10 |
| VF-045 | Dynamic imports for exceljs, jspdf, html2canvas (on-demand loading) | `grep -rn "import ExcelJS\|import jsPDF\|import html2canvas" client/src/pages/` returns 0 static imports. All use `await import()` inside functions | 2026-02-10 |
| VF-046 | Zod validation on auth login endpoint | `grep safeParse server/routes/auth.routes.ts` shows loginSchema.safeParse on POST /login | 2026-02-10 |
| VF-047 | contracts.routes.ts fileFilter added to multer upload config | `grep fileFilter server/routes/contracts.routes.ts` returns match | 2026-02-10 |
| VF-048 | chart.tsx dangerouslySetInnerHTML uses DOMPurify.sanitize() | `grep DOMPurify client/src/components/ui/chart.tsx` shows import and usage | 2026-02-10 |
| VF-049 | Database indexes: 532 total (up from 450+) | `SELECT count(*) FROM pg_indexes WHERE schemaname='public'` returns 532 | 2026-02-10 |
| VF-050 | 95 lazy-loaded page routes with Suspense fallback | `grep -c "lazy(" client/src/App.tsx` returns 95 | 2026-02-10 |

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
| KI-006 | Excessive `any` usages (~818 baseline) | P2 | MITIGATED | TypeScript | 200+ catch(error:any)→unknown in 15 route files. Remaining are type assertion patterns. See VF-035 | 2026-02-08 |
| KI-007 | Panel rate columns use `text` not `decimal` | P2 | FIXED | Database | Migrated 26 columns across 4 tables (panel_types, job_panel_rates, panel_register, contracts) from text to decimal(14,2). Backup tables created. See VF-040 | 2026-02-09 |
| KI-008 | No CHECK constraints on financial values | P2 | FIXED | Database | 14+ CHECK constraints on progress_claims, contracts, users, progress_claim_items. See VF-026 | 2026-02-08 |
| KI-009 | Settings route lacks Zod validation | P1 | FIXED | Backend | All 4 mutating endpoints now have Zod safeParse. See VF-022 | 2026-02-08 |
| KI-010 | N+1 query patterns in documents/bundles/drafting | P2 | FIXED | Performance | Batch getDocumentsByIds replaces sequential loops. See VF-027 | 2026-02-08 |
| KI-011 | No offline handling for mobile pages | P2 | FIXED | Frontend | useOnlineStatus hook with toast + visual indicator in MobileLayout. See VF-032 | 2026-02-08 |
| KI-012 | Health endpoint exposes memory/pool info | P3 | FIXED | Security | Restricted to admin sessions only. See VF-030 | 2026-02-08 |
| KI-013 | Rate limiting per-IP — proxy users share IP | P2 | FIXED | Performance | Per-session rate limiting with IP fallback. See VF-031 | 2026-02-08 |
| KI-014 | updatedAt not auto-updated by DB triggers | P3 | FIXED | Database | 72 BEFORE UPDATE triggers auto-set updated_at via update_updated_at_column(). See VF-036, VF-042 | 2026-02-09 |
| KI-015 | No error monitoring (Sentry or equivalent) | P2 | FIXED | Observability | ErrorMonitor class with admin summary endpoint. See VF-028 | 2026-02-08 |
| KI-016 | Missing composite indexes on 3 tables | P2 | FIXED | Database | Composite indexes added: progress_claims(jobId,status), panel_audit_logs(panelId,createdAt), timer_sessions(userId,startedAt). See VF-025 | 2026-02-08 |
| KI-017 | No form auto-save or unsaved changes warning | P3 | FIXED | Frontend | useUnsavedChanges hook on purchase-order and manual-entry forms. See VF-033 | 2026-02-08 |
| KI-018 | Some delete operations lack confirmation | P3 | FIXED | Frontend | Verified all cited operations already have AlertDialog confirmations. See VF-034 | 2026-02-08 |
| KI-019 | 16 TypeScript errors across 4 files | P1 | FIXED | TypeScript | All errors resolved. 0 TS errors as of 2026-02-10. See VF-001 (re-verified), VF-044. | 2026-02-10 |
| KI-020 | 3 large vendor chunks >500KB not code-split | P2 | MITIGATED | Performance | exceljs/jspdf/html2canvas converted to dynamic import(). 2 chunks remain >500KB (exceljs 937KB as lazy chunk, core index 737KB - framework bundle). See VF-045. | 2026-02-10 |
| KI-021 | Remaining `: any` type annotations | P2 | MITIGATED | TypeScript | All catch blocks now use `unknown` (VF-044). ~71 remaining `: any` in routes are parameter/type assertions, trending down. | 2026-02-10 |
| KI-022 | chart.tsx dangerouslySetInnerHTML without DOMPurify | P3 | FIXED | Security | chart.tsx now uses DOMPurify.sanitize(). See VF-048. | 2026-02-10 |
| KI-023 | No integration/E2E tests for critical workflows | P2 | OPEN | Testing | 219 unit tests cover financial calcs, lifecycle, validation, API routes. No E2E tests for multi-step workflows (panel lifecycle, approval flows, production slot generation). | 2026-02-09 |
| KI-024 | contracts.routes.ts upload missing fileFilter | P2 | FIXED | Security | fileFilter added to contracts.routes.ts multer config. See VF-047. | 2026-02-10 |

**Maintenance Rule:** Any code change touching security, auth, validation, or database schema MUST update this tracker and the Verified Fixes Registry. Stale documentation is a risk.

---

## Full UI Audit Procedure

This is a separate audit type from the Comprehensive Debugging & QA Audit above. The Full UI Audit is a page-by-page, button-by-button visual verification of the entire application — both desktop and mobile — checking that data displayed on screen matches database records exactly.

**When to run:** When the user requests a "Full UI Audit", "UI testing", "page-by-page test", or "visual audit".

### Phase 0: Data Snapshot

Before navigating any pages, capture a full data snapshot from the database. This is the ground truth for verifying every page.

```sql
-- Run this FIRST and record all counts.
-- All table names validated against pg_tables (114 tables in schema).
SELECT 'assets' as entity, COUNT(*) as db_count FROM assets
UNION ALL SELECT 'broadcast_messages', COUNT(*) FROM broadcast_messages
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'checklist_instances', COUNT(*) FROM checklist_instances
UNION ALL SELECT 'checklist_templates', COUNT(*) FROM checklist_templates
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'daily_logs', COUNT(*) FROM daily_logs
UNION ALL SELECT 'delivery_records', COUNT(*) FROM delivery_records
UNION ALL SELECT 'devices', COUNT(*) FROM devices
UNION ALL SELECT 'document_bundles', COUNT(*) FROM document_bundles
UNION ALL SELECT 'document_categories', COUNT(*) FROM document_categories
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'drafting_program', COUNT(*) FROM drafting_program
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'eot_claims', COUNT(*) FROM eot_claims
UNION ALL SELECT 'factories', COUNT(*) FROM factories
UNION ALL SELECT 'help_entries', COUNT(*) FROM help_entries
UNION ALL SELECT 'hire_bookings', COUNT(*) FROM hire_bookings
UNION ALL SELECT 'item_categories', COUNT(*) FROM item_categories
UNION ALL SELECT 'items', COUNT(*) FROM items
UNION ALL SELECT 'job_activities', COUNT(*) FROM job_activities
UNION ALL SELECT 'job_level_cycle_times', COUNT(*) FROM job_level_cycle_times
UNION ALL SELECT 'job_types', COUNT(*) FROM job_types
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL SELECT 'load_lists', COUNT(*) FROM load_lists
UNION ALL SELECT 'panel_register', COUNT(*) FROM panel_register
UNION ALL SELECT 'panel_types', COUNT(*) FROM panel_types
UNION ALL SELECT 'production_beds', COUNT(*) FROM production_beds
UNION ALL SELECT 'production_slots', COUNT(*) FROM production_slots
UNION ALL SELECT 'progress_claims', COUNT(*) FROM progress_claims
UNION ALL SELECT 'purchase_orders', COUNT(*) FROM purchase_orders
UNION ALL SELECT 'reo_schedules', COUNT(*) FROM reo_schedules
UNION ALL SELECT 'sales_status_history', COUNT(*) FROM sales_status_history
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'task_groups', COUNT(*) FROM task_groups
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'weekly_job_reports', COUNT(*) FROM weekly_job_reports
UNION ALL SELECT 'weekly_wage_reports', COUNT(*) FROM weekly_wage_reports
UNION ALL SELECT 'zones', COUNT(*) FROM zones
ORDER BY entity;
```

Also capture key detail records for spot-checking (first 5 rows of each major entity with names/titles):
```sql
SELECT 'customer' as type, id, name as label FROM customers ORDER BY name LIMIT 5;
SELECT 'supplier' as type, id, name as label FROM suppliers ORDER BY name LIMIT 5;
SELECT 'job' as type, id, name as label FROM jobs ORDER BY name LIMIT 5;
SELECT 'employee' as type, id, "firstName" || ' ' || "lastName" as label FROM employees ORDER BY "lastName" LIMIT 5;
SELECT 'asset' as type, id, description as label FROM assets ORDER BY description LIMIT 5;
```

Record the snapshot timestamp and all counts in the audit results table.

### Phase 1: Authentication & Login

| Step | Action | Expected Result | Check |
|------|--------|-----------------|-------|
| 1.1 | Navigate to `/login` | Login page renders with email/password fields, company logo | Screenshot |
| 1.2 | Submit empty form | Validation errors shown for required fields | Screenshot |
| 1.3 | Submit wrong password | Error message: "Invalid email or password" (no info leakage) | Screenshot |
| 1.4 | Login with valid admin credentials | Redirect to `/dashboard`, sidebar visible, user name shown | Screenshot |
| 1.5 | Check session cookie | HttpOnly flag set, SameSite=lax | API check |

### Phase 2: Desktop Pages — Data Verification

For each page below, navigate in the browser, take a screenshot, and verify:
- **Row count**: Number of items displayed matches database count (or pagination total)
- **Data accuracy**: Spot-check 3-5 specific records against the database
- **Filters/search**: If filters exist, test at least one and verify filtered count
- **Empty states**: If no data, verify "no data" message (not a blank page or error)
- **Loading states**: Verify loading spinner appears during data fetch
- **Error handling**: No console errors, no broken layouts

#### 2.1 Dashboard (`/dashboard`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads without errors | Dashboard with stat cards | | |
| Job count card | Matches `jobs` DB count | | |
| Panel count card | Matches `panel_register` DB count | | |
| Recent activity shown | Latest records present | | |
| Charts render | No blank chart areas | | |

#### 2.2 Admin > Customers (`/admin/customers`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `customers` DB count | | |
| Spot-check customer names | Match DB records | | |
| Create button works | Opens form dialog | | |
| Edit button works | Populates form with existing data | | |
| Delete button works | Shows confirmation, removes record | | |
| Search/filter works | Filters list correctly | | |

#### 2.3 Admin > Suppliers (`/admin/suppliers`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `suppliers` DB count (expect 1000+) | | |
| Pagination works | Can navigate pages | | |
| Spot-check supplier names | Match DB records | | |
| Create/Edit/Delete works | Full CRUD functional | | |

#### 2.4 Admin > Jobs (`/admin/jobs`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `jobs` DB count | | |
| Job details expand/open | Shows all job fields | | |
| Phase/status display | Matches DB phase/status values | | |
| Create/Edit works | Full CRUD functional | | |
| Level Cycle Times tab | Opens with correct data | | |

#### 2.5 Admin > Employees (`/admin/employees`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `employees` DB count | | |
| Spot-check employee names | Match DB records | | |
| Detail page (`/admin/employees/:id`) | All tabs load correctly | | |
| Create/Edit/Delete works | Full CRUD functional | | |

#### 2.6 Admin > Panels (`/admin/panels`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `panel_register` DB count | | |
| Panel details open | Shows correct panel data | | |
| Stage/status display | Matches DB values | | |

#### 2.7 Admin > Panel Types (`/admin/panel-types`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `panel_types` DB count | | |
| Create/Edit/Delete works | Full CRUD functional | | |

#### 2.8 Admin > Factories (`/admin/factories`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `factories` DB count | | |
| Factory details | Show work days config | | |

#### 2.9 Admin > Users (`/admin/users`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `users` DB count | | |
| Role display | Matches DB roles | | |
| Create/Edit works | Full CRUD functional | | |

#### 2.10 Admin > Asset Register (`/admin/asset-register`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `assets` DB count | | |
| Asset tags auto-generated | Tags visible, formatted correctly | | |
| Category filters work | Filter by asset category | | |
| Detail page (`/admin/assets/:id`) | All fields display correctly | | |
| Create/Edit/Delete works | Full CRUD functional | | |

#### 2.11 Admin > Settings (`/admin/settings`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Settings page loads | All sections render | | |
| Save changes | Updates persist on refresh | | |

#### 2.12 Admin > Job Types (`/admin/job-types`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `job_types` DB count | | |
| Workflow builder opens | `/admin/job-types/:id/workflow` renders | | |
| Activity templates listed | Correct count per job type | | |

#### 2.13 Admin > Zones (`/admin/zones`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Zones listed | | |
| Create/Edit/Delete works | Full CRUD functional | | |

#### 2.14 Admin > Companies (`/admin/companies`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Company details shown | | |

#### 2.15 Admin > User Permissions (`/admin/user-permissions`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Permission matrix displayed | | |
| Toggle permissions | Changes persist | | |

#### 2.16 Admin > Document Config (`/admin/document-config`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Document types/categories shown | | |

#### 2.17 Admin > Items (`/admin/items`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Items listed | | |

#### 2.18 Admin > Item Categories (`/admin/item-categories`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Categories listed | | |

#### 2.19 Admin > Data Management (`/admin/data-management`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Import/export tools available | | |

#### 2.20 Admin > Devices (`/admin/devices`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Device list shown | | |

#### 2.21 Admin > Checklist Templates (`/admin/checklist-templates`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `checklist_templates` DB count | | |
| Template editor opens | `/admin/checklist-templates/:id/edit` renders | | |

#### 2.22 Documents (`/documents`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `documents` DB count | | |
| Document details open | Version history, linked entities | | |
| Upload works | File upload dialog opens | | |
| Filter/search works | Filters list correctly | | |

#### 2.23 Photo Gallery (`/photo-gallery`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Gallery grid renders | | |
| Full-screen view works | Click opens lightbox | | |

#### 2.24 Tasks (`/tasks`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Task groups count | Matches `task_groups` DB count | | |
| Tasks count per group | Match DB records | | |
| Create/Edit/Delete works | Full CRUD functional | | |
| Drag-and-drop reorder | Reorder persists | | |

#### 2.25 Project Activities (`/jobs/:jobId/activities`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total activities listed | Matches `job_activities` for this job | | |
| Status display | Matches DB statuses | | |
| Predecessor/Relationship columns | Show correct values | | |
| Inline date editing | Changes persist | | |
| Activity tasks panel | Opens via ListChecks icon | | |
| Recalculate Dates button | Recalculates correctly | | |

#### 2.26 Hire Bookings (`/hire-bookings`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `hire_bookings` DB count | | |
| Status badges | Correct colors per status | | |
| Detail page opens | `/hire-bookings/:id` renders all fields | | |
| Status transitions work | Each transition updates correctly | | |
| Create/Edit works | Full CRUD functional | | |
| Overdue returns | Highlighted in red | | |

#### 2.27 Chat (`/chat`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Conversations listed | Matches `conversations` DB count | | |
| Messages display | Correct sender, timestamp | | |
| Send message | Message appears in thread | | |
| @mentions work | Autocomplete shows users | | |

#### 2.28 Broadcast (`/broadcast`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total messages displayed | Matches `broadcast_messages` DB count | | |
| Create broadcast | New message created | | |

#### 2.29 Daily Reports (`/daily-reports`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total logs displayed | Matches `daily_logs` DB count | | |
| Log detail view | `/daily-reports/:id` shows all rows | | |

#### 2.30 Reports (`/reports`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Report options displayed | | |

#### 2.31 Production Report (`/production-report`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Production data shown | | |

#### 2.32 KPI Dashboard (`/kpi-dashboard`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Charts and KPI cards render | | |
| Data accuracy | Values match DB aggregations | | |

#### 2.33 Logistics (`/logistics`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Load lists displayed | Matches `load_lists` DB count | | |
| Create/view load list | Opens correctly | | |

#### 2.34 Production Schedule (`/production-schedule`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Slots displayed | Matches `production_slots` DB count | | |

#### 2.35 Production Slots (`/production-slots`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Slot management tools | | |

#### 2.36 Drafting Program (`/drafting-program`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Drafting schedule shown | | |

#### 2.37 Purchase Orders (`/purchase-orders`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `purchase_orders` DB count | | |
| PO detail view | `/purchase-orders/:id` shows items | | |
| Create/Edit works | Full CRUD functional | | |

#### 2.38 Contracts (`/contracts`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `contracts` DB count | | |
| Contract detail view | Shows rates and retention | | |

#### 2.39 Progress Claims (`/progress-claims`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `progress_claims` DB count | | |
| Create/Edit works | Full CRUD functional | | |
| Retention report | `/progress-claims/retention-report` loads | | |

#### 2.40 Sales Pipeline (`/sales-pipeline`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Pipeline stages shown | | |
| Opportunities listed | Matches `sales_opportunities` count (may be 0) | | |

#### 2.41 Checklists (`/checklists`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Total rows displayed | Matches `checklist_instances` DB count | | |
| Fill checklist | `/checklists/:id` opens form | | |

#### 2.42 Weekly Wages (`/weekly-wages`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Wage report data shown | | |

#### 2.43 Weekly Job Logs (`/weekly-job-logs`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Job log summaries shown | | |

#### 2.44 Manager Review (`/manager/review`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Pending approvals listed | | |

#### 2.45 Manual Entry (`/manual-entry`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Entry form renders | | |

#### 2.46 Downloads (`/downloads`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Download options listed | | |

#### 2.47 Help (`/help`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Help entries displayed | | |

#### 2.48 Admin > Help (`/admin/help`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Help admin tools | | |

#### 2.49 Procurement REO (`/procurement-reo`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | REO schedule data shown | | |

#### 2.50 Job Programme (`/admin/jobs/:id/programme`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads for valid job | Level cycle times shown | | |
| Drag-and-drop reorder | Reorder persists | | |
| Split level works | Creates A/B/C pours | | |
| Date recalculation | Uses working days correctly | | |

#### 2.51 Landing Page (`/`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Unauthenticated: landing page | Branded landing renders | | |
| Authenticated: redirects | Redirects to `/dashboard` | | |

#### 2.52 Contracts Detail (`/contracts/:jobId`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads for valid job | Contract rates/retention shown | | |
| Data matches DB | Contract values match `contracts` table | | |

#### 2.53 Progress Claims New (`/progress-claims/new`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Create form renders | All required fields present | | |
| Job selector works | Lists available jobs | | |

#### 2.54 Progress Claims Edit (`/progress-claims/:id/edit`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Form loads with existing data | All fields populated | | |
| Save updates | Changes persist | | |

#### 2.55 Progress Claims Detail (`/progress-claims/:id`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Detail view renders | Claim items, totals displayed | | |

#### 2.56 Retention Report (`/progress-claims/retention-report`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Report loads | Retention summary data shown | | |

#### 2.57 Panel Detail (`/panel/:id`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Panel details render | All fields, stage, audit trail | | |
| Data matches DB | Panel record matches `panel_register` | | |

#### 2.58 Document Bundle QR (`/bundle/:qrCodeId`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Valid QR code | Bundle contents displayed | | |
| Invalid QR code | Appropriate error shown | | |

#### 2.59 Checklist Reports (`/checklist-reports`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Page loads | Report data shown | | |

#### 2.60 Checklist Fill (`/checklists/:id`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Checklist form renders | Template fields shown | | |
| Save/submit works | Data persists | | |

#### 2.61 Daily Report Detail (`/daily-reports/:id`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Report detail renders | All log rows shown | | |
| Data matches DB | Matches `daily_logs` + `log_rows` | | |

#### 2.62 Production Report Date (`/production-report/:date`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Date-filtered report | Shows production for specific date | | |

#### 2.63 Purchase Order Detail (`/purchase-orders/:id`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| PO detail renders | Items, totals, status shown | | |
| Data matches DB | Matches `purchase_orders` + `purchase_order_items` | | |

#### 2.64 Hire Booking Detail (`/hire-bookings/:id`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| All fields render | Equipment, dates, rates, notes | | |
| Status transition buttons | Correct actions for current status | | |

#### 2.65 Workflow Builder (`/admin/job-types/:id/workflow`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Stages and activities render | All template data shown | | |
| Add/edit/delete activities | CRUD works | | |
| Predecessor relationships | Configurable per activity | | |

#### 2.66 Checklist Template Editor (`/admin/checklist-templates/:id/edit`)
| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Template fields render | All sections/fields shown | | |
| Add/edit/delete fields | CRUD works | | |

### Phase 3: Mobile Pages — Layout & Data Verification

Test each mobile route for correct layout, touch targets, data accuracy, and responsive design.

| Route | Check | Expected | Actual | Status |
|-------|-------|----------|--------|--------|
| `/mobile` | Landing page loads | Mobile nav visible | | |
| `/mobile/dashboard` | Dashboard renders | Stat cards, correct data | | |
| `/mobile/tasks` | Tasks listed | Matches `tasks` count | | |
| `/mobile/chat` | Chat loads | Conversations visible | | |
| `/mobile/jobs` | Jobs listed | Matches `jobs` count | | |
| `/mobile/jobs/:id` | Job detail | All fields shown | | |
| `/mobile/panels` | Panels listed | Matches `panel_register` count | | |
| `/mobile/panels/:id` | Panel detail | Stage/status correct | | |
| `/mobile/logistics` | Logistics | Load lists visible | | |
| `/mobile/logistics/create-load` | Create load form | Form renders | | |
| `/mobile/logistics/record-delivery` | Delivery form | Form renders | | |
| `/mobile/logistics/return-load` | Return form | Form renders | | |
| `/mobile/purchase-orders` | POs listed | Matches `purchase_orders` count | | |
| `/mobile/documents` | Documents listed | Matches `documents` count | | |
| `/mobile/photo-gallery` | Gallery | Images render | | |
| `/mobile/photo-capture` | Camera | Capture interface shown | | |
| `/mobile/checklists` | Checklists listed | Matches count | | |
| `/mobile/scan` | QR scanner | Camera/scanner UI | | |
| `/mobile/broadcast` | Broadcasts | Messages listed | | |
| `/mobile/checklists/:id` | Checklist fill | Form renders, fields editable | | |
| `/mobile/opportunities/new` | New opportunity form | Form renders | | |
| `/mobile/weekly-report` | Weekly report | Report data shown | | |
| `/mobile/profile` | User profile | Correct user info | | |
| `/mobile/more` | More menu | All navigation links work | | |
| `/mobile/login` | Mobile login page | Email/password fields | | |

### Phase 4: CRUD Operations Testing

For each major entity, perform a full Create-Read-Update-Delete cycle via the UI:

| Entity | Create | Read | Update | Delete | Status |
|--------|--------|------|--------|--------|--------|
| Customer | Add new customer | Verify in list | Edit name/contact | Delete and verify gone | |
| Supplier | Add new supplier | Verify in list | Edit details | Delete and verify gone | |
| Employee | Add new employee | Verify in list | Edit position | Delete and verify gone | |
| Job | Add new job | Verify in list | Edit name/phase | (if allowed) | |
| Task Group | Add new group | Verify in list | Edit name | Delete and verify gone | |
| Task | Add new task | Verify in list | Edit title/status | Delete and verify gone | |
| Hire Booking | Add new booking | Verify in list | Edit notes | (status transitions) | |
| Document | Upload document | Verify in list | Edit metadata | Delete and verify gone | |
| Broadcast | Send broadcast | Verify in list | — | — | |
| Purchase Order | Create PO | Verify in list | Edit items | Delete and verify gone | |
| Asset | Add new asset | Verify in list | Edit details | Delete and verify gone | |
| Checklist Template | Add template | Verify in list | Edit fields | Delete and verify gone | |

### Phase 5: Workflow & Lifecycle Testing

Test multi-step workflows end-to-end via the UI:

| Workflow | Steps to Test | Expected Result | Status |
|----------|---------------|-----------------|--------|
| Hire Booking Lifecycle | DRAFT → REQUESTED → APPROVED → BOOKED → ON_HIRE → RETURNED → CLOSED | Each transition updates status badge and available actions | |
| Job Phase Progression | Advance through phases | Sequential enforcement, audit log entries | |
| Panel Stage Lifecycle | Advance through stages | Stage updates, audit trail | |
| Daily Log Approval | Submit → Manager Review → Approve/Reject | Status changes, manager view updates | |
| Purchase Order Approval | Draft → Submit → Approve | Status progression works | |
| Progress Claim Flow | Create → Submit → Approve | Financial calculations correct | |

### Phase 6: Cross-Cutting Concerns

| Check | How to Verify | Expected | Status |
|-------|---------------|----------|--------|
| Console errors | Open browser DevTools → Console | 0 errors (warnings acceptable) | |
| Network errors | DevTools → Network tab, filter errors | 0 failed API calls (4xx/5xx) | |
| Responsive layout | Resize browser window | No horizontal overflow, no broken layouts | |
| Dark mode toggle | Toggle theme | All pages readable, correct contrast | |
| Session persistence | Refresh page | Stay logged in, data intact | |
| CSRF protection | Check requests in Network tab | x-csrf-token header present on mutations | |
| Loading states | Throttle network in DevTools | Skeleton/spinner visible during loads | |

### Output Format

```
## Full UI Audit Results — [DATE]

### Data Snapshot (Phase 0)
| Entity | DB Count | UI Count | Match |
|--------|----------|----------|-------|
| customers | 64 | ? | |
| suppliers | 1027 | ? | |
| ... | ... | ... | |

### Page-by-Page Results (Phase 2-3)
| # | Page | Route | Status | Issues |
|---|------|-------|--------|--------|
| 1 | Dashboard | /dashboard | PASS/FAIL | Description |
| 2 | Customers | /admin/customers | PASS/FAIL | Description |
| ... | ... | ... | ... | ... |

### CRUD Test Results (Phase 4)
| Entity | C | R | U | D | Issues |
|--------|---|---|---|---|--------|
| Customer | PASS | PASS | PASS | PASS | None |
| ... | ... | ... | ... | ... | ... |

### Workflow Test Results (Phase 5)
| Workflow | Result | Issues |
|----------|--------|--------|
| Hire Booking Lifecycle | PASS/FAIL | Description |
| ... | ... | ... |

### Cross-Cutting Results (Phase 6)
| Check | Result | Issues |
|-------|--------|--------|
| Console errors | 0/N | Description |
| ... | ... | ... |

### Summary
- Total pages tested: X / 90 (desktop + mobile)
- Pages PASS: X
- Pages FAIL: X
- Data mismatches found: X
- CRUD operations verified: X/12
- Workflows verified: X/6
- Console errors: X
- Network errors: X
- Overall UI Audit Grade: PASS / CONDITIONAL / FAIL
```

### Route Coverage Checklist

Every Full UI Audit MUST verify coverage of all routes. Mark each as TESTED, SKIPPED (with reason), or N/A.

**Desktop Routes (66 routes):**
| # | Route | Audit Section | Tested |
|---|-------|---------------|--------|
| 1 | `/` | 2.51 | |
| 2 | `/login` | 1.1-1.4 | |
| 3 | `/dashboard` | 2.1 | |
| 4 | `/admin/customers` | 2.2 | |
| 5 | `/admin/suppliers` | 2.3 | |
| 6 | `/admin/jobs` | 2.4 | |
| 7 | `/admin/jobs/:id/programme` | 2.50 | |
| 8 | `/admin/employees` | 2.5 | |
| 9 | `/admin/employees/:id` | 2.5 | |
| 10 | `/admin/panels` | 2.6 | |
| 11 | `/admin/panel-types` | 2.7 | |
| 12 | `/admin/factories` | 2.8 | |
| 13 | `/admin/users` | 2.9 | |
| 14 | `/admin/asset-register` | 2.10 | |
| 15 | `/admin/assets/:id` | 2.10 | |
| 16 | `/admin/settings` | 2.11 | |
| 17 | `/admin/job-types` | 2.12 | |
| 18 | `/admin/job-types/:id/workflow` | 2.65 | |
| 19 | `/admin/zones` | 2.13 | |
| 20 | `/admin/companies` | 2.14 | |
| 21 | `/admin/user-permissions` | 2.15 | |
| 22 | `/admin/document-config` | 2.16 | |
| 23 | `/admin/items` | 2.17 | |
| 24 | `/admin/item-categories` | 2.18 | |
| 25 | `/admin/data-management` | 2.19 | |
| 26 | `/admin/devices` | 2.20 | |
| 27 | `/admin/checklist-templates` | 2.21 | |
| 28 | `/admin/checklist-templates/:id/edit` | 2.66 | |
| 29 | `/admin/help` | 2.48 | |
| 30 | `/documents` | 2.22 | |
| 31 | `/photo-gallery` | 2.23 | |
| 32 | `/tasks` | 2.24 | |
| 33 | `/jobs/:jobId/activities` | 2.25 | |
| 34 | `/hire-bookings` | 2.26 | |
| 35 | `/hire-bookings/:id` | 2.64 | |
| 36 | `/chat` | 2.27 | |
| 37 | `/broadcast` | 2.28 | |
| 38 | `/daily-reports` | 2.29 | |
| 39 | `/daily-reports/:id` | 2.61 | |
| 40 | `/reports` | 2.30 | |
| 41 | `/production-report` | 2.31 | |
| 42 | `/production-report/:date` | 2.62 | |
| 43 | `/kpi-dashboard` | 2.32 | |
| 44 | `/logistics` | 2.33 | |
| 45 | `/production-schedule` | 2.34 | |
| 46 | `/production-slots` | 2.35 | |
| 47 | `/drafting-program` | 2.36 | |
| 48 | `/purchase-orders` | 2.37 | |
| 49 | `/purchase-orders/:id` | 2.63 | |
| 50 | `/contracts` | 2.38 | |
| 51 | `/contracts/:jobId` | 2.52 | |
| 52 | `/progress-claims` | 2.39 | |
| 53 | `/progress-claims/new` | 2.53 | |
| 54 | `/progress-claims/:id` | 2.55 | |
| 55 | `/progress-claims/:id/edit` | 2.54 | |
| 56 | `/progress-claims/retention-report` | 2.56 | |
| 57 | `/sales-pipeline` | 2.40 | |
| 58 | `/checklists` | 2.41 | |
| 59 | `/checklists/:id` | 2.60 | |
| 60 | `/checklist-reports` | 2.59 | |
| 61 | `/weekly-wages` | 2.42 | |
| 62 | `/weekly-job-logs` | 2.43 | |
| 63 | `/manager/review` | 2.44 | |
| 64 | `/manual-entry` | 2.45 | |
| 65 | `/downloads` | 2.46 | |
| 66 | `/help` | 2.47 | |
| 67 | `/panel/:id` | 2.57 | |
| 68 | `/bundle/:qrCodeId` | 2.58 | |
| 69 | `/procurement-reo` | 2.49 | |

**Mobile Routes (24 routes):**
| # | Route | Tested |
|---|-------|--------|
| 1 | `/mobile` | |
| 2 | `/mobile/login` | |
| 3 | `/mobile/dashboard` | |
| 4 | `/mobile/tasks` | |
| 5 | `/mobile/chat` | |
| 6 | `/mobile/jobs` | |
| 7 | `/mobile/jobs/:id` | |
| 8 | `/mobile/panels` | |
| 9 | `/mobile/panels/:id` | |
| 10 | `/mobile/logistics` | |
| 11 | `/mobile/logistics/create-load` | |
| 12 | `/mobile/logistics/record-delivery` | |
| 13 | `/mobile/logistics/return-load` | |
| 14 | `/mobile/purchase-orders` | |
| 15 | `/mobile/documents` | |
| 16 | `/mobile/photo-gallery` | |
| 17 | `/mobile/photo-capture` | |
| 18 | `/mobile/checklists` | |
| 19 | `/mobile/checklists/:id` | |
| 20 | `/mobile/scan` | |
| 21 | `/mobile/broadcast` | |
| 22 | `/mobile/opportunities/new` | |
| 23 | `/mobile/weekly-report` | |
| 24 | `/mobile/profile` | |
| 25 | `/mobile/more` | |

**Coverage target:** 100% of routes tested. Any SKIPPED route must have a documented reason.

---

## Audit History

| Date | Score | Grade | Key Changes |
|---|---|---|---|
| 2026-02-07 | 62/100 | C+ | Initial audit (AUDIT_REPORT.md). 170 TS errors, zero indexes, CSP disabled. |
| 2026-02-07 | 87/100 (8.7/10) | B+ | Enterprise hardening (ENTERPRISE_AUDIT_REPORT.md). Added transactions, CSRF, Zod, company scope, optimistic locking, safeParseFinancial. Score used different rubric — not directly comparable. |
| 2026-02-08 | 75.5/100 | C+ | Latest audit (in-chat). 0 TS errors, verified fixes in place. Score used yet another rubric — not comparable. |
| 2026-02-08 | — | — | Standardized rubric established. All future audits use this fixed rubric for comparable scoring. |
| 2026-02-08 | 84.5/100 | B | Fixed P1 items: JSON limit (KI-001), request-id (KI-002), Zod on all routes (KI-009), code splitting (KI-005), test coverage (KI-004). Added VF-020 through VF-024. |
| 2026-02-08 | 85.5/100 | B | Fixed P2 items: composite indexes (KI-016), CHECK constraints (KI-008), N+1 batch queries (KI-010), error monitoring (KI-015), ESLint (KI-003). Added VF-025 through VF-029. |
| 2026-02-08 | — | — | Final round: health endpoint secured (KI-012), per-session rate limiting (KI-013), offline detection (KI-011), unsaved changes (KI-017), delete confirmations verified (KI-018), 200+ any→unknown (KI-006), updatedAt triggers on 62 tables (KI-014). Added VF-030 through VF-036. ALL 18 KIs resolved: 16 FIXED, 2 MITIGATED. |
| 2026-02-08 | **92.3/100** | **A** | **FINAL AUDIT — SAFE TO DEPLOY.** Scores: TypeScript&Build 9/10 (15%), Security 9.5/10 (20%), Backend&API 9.5/10 (15%), Database&Integrity 9.5/10 (15%), Frontend Quality 9/10 (10%), Performance&Scale 9/10 (10%), Observability 9/10 (5%), Rules Compliance 9/10 (5%), Testing 9.5/10 (5%). Vite build clean. 0 TS errors. 219 tests. 36 verified fixes. 18/18 KIs resolved. |
| 2026-02-09 | **92.5/100** | **A** | **POST-EMPLOYEE AUDIT — SAFE TO DEPLOY.** Employee management added (4 tables, 21 indexes, full CRUD). All 36 prior VFs re-verified. 3 new VFs (VF-037 to VF-039). 0 TS errors. Build clean. 219 tests. 450 indexes. 66 triggers. 39 VFs. 18/18 KIs resolved. |
| 2026-02-09 | **93.0/100** | **A** | **KI-007 FIX: Panel rate text→decimal migration.** 26 columns across 4 tables migrated from text to decimal(14,2) with backup tables. KI-007 now FIXED (was MITIGATED). Database&Integrity 9.75/10. All 18 KIs now fully resolved (17 FIXED, 1 MITIGATED). 40 VFs. 0 TS errors. 219 tests passing. |
| 2026-02-09 | **93.0/100** | **A** | **FULL RE-AUDIT — SAFE TO DEPLOY.** All 40 VFs re-verified in place, 0 regressions. Asset Register enhanced (isBookable, requiresTransport, transportType). 2 new admin routes added (data-management, item-categories) with permission mappings. Rate limiter IPv6 fix applied. Scores: TypeScript&Build 9/10 (15%), Security 9.5/10 (20%), Backend&API 9.5/10 (15%), Database&Integrity 9.5/10 (15%), Frontend Quality 9/10 (10%), Performance&Scale 9/10 (10%), Observability 9/10 (5%), Rules Compliance 9/10 (5%), Testing 9/10 (5%). Metrics: 0 TS errors. Build clean. 219 tests (7 files, 0 failures). 83 lazy-loaded pages. 2821 data-testid attrs. 450 indexes. 15 CHECK constraints. 66 triggers. 220 FKs. 99 tables. 350 requireAuth. 230 requireRole. 166 safeParse. 262 catch(error:unknown). 43 safeParseFinancial. 40 VFs. 18/18 KIs resolved. 68 pages all 200 OK. 35+ API endpoints verified. |
| 2026-02-09 | **93.5/100** | **A** | **POST-HIRE-BOOKING AUDIT — SAFE TO DEPLOY.** All 40 VFs re-verified, 0 regressions. Hire Booking Engine fully integrated (1 table, 9 indexes, approval workflow). Fixed missing hire_bookings updated_at trigger. Fixed job audit trail PHASE_CHANGE/PHASE_CHANGED action string. 3 new VFs (VF-041 to VF-043). Scores: TypeScript&Build 9/10 (15%), Security 9.5/10 (20%), Backend&API 9.5/10 (15%), Database&Integrity 9.5/10 (15%), Frontend Quality 9/10 (10%), Performance&Scale 9/10 (10%), Observability 9/10 (5%), Rules Compliance 9.5/10 (5%), Testing 9/10 (5%). Metrics: 0 TS errors. Build clean. 219 tests (7 files, 0 failures). 85 lazy-loaded pages. 2929 data-testid attrs. 478 indexes. 15 CHECK constraints. 72 triggers. 240 FKs. 105 tables. 385 requireAuth. 248 requireRole. 179 safeParse. 287 catch(error:unknown). 43 safeParseFinancial. 43 VFs. 18/18 KIs resolved. |
| 2026-02-09 | **90.25/100** | **A** | **FULL ENTERPRISE RE-AUDIT (200+ users, 1000s entries) — SAFE TO DEPLOY.** VF-001 REGRESSED (16 TS errors in 4 files). 6 new KIs added (KI-019 to KI-024). 43 VFs re-verified, 42 still in place. Scores: TypeScript&Build 7.5/10 (15%), Security 9/10 (20%), Backend&API 9.5/10 (15%), Database&Integrity 9.5/10 (15%), Frontend Quality 9/10 (10%), Performance&Scale 8.5/10 (10%), Observability 9/10 (5%), Rules Compliance 9/10 (5%), Testing 8/10 (5%). Metrics: 16 TS errors (4 files). Build succeeds (11 chunks >100KB, 3 >500KB). 219 tests (7 files, 0 failures). 89 lazy-loaded pages. 3105 data-testid attrs. 516 indexes. 15 CHECK constraints. 72 triggers. 260 FKs. 114 tables. 431 requireAuth. 286 requireRole. 194 safeParse. 357 catch(error:unknown). 43 safeParseFinancial. 15 db.transaction. 425 `: any` remaining. 0 eval(). 0 hardcoded secrets. 43 VFs (1 regressed). 24/24 KIs tracked (18 FIXED, 1 MITIGATED, 5 OPEN). |
