# BuildPlus Ai Management System

## Overview
The BuildPlus AI Management System optimizes panel production and delivery for construction and manufacturing. It manages the entire panel lifecycle, from CAD/Revit time management to delivery tracking, aiming to enhance operational control, efficiency, and decision-making. Key features include daily log management, approval workflows, reporting, analytics, KPI dashboards, and logistics for load lists and delivery. The system is designed for enterprise-grade scale, supporting 300+ simultaneous users with multi-company deployment and data isolation.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is a React application built with Vite, `shadcn/ui`, and Tailwind CSS for a modern UI/UX, including a KPI Dashboard with data visualization and interactive maps. The backend is an Express.js application using PostgreSQL and Drizzle ORM. Authentication is email/password-based with bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**Technical Implementations & Features:**
- **Core Management:** Time management, approval workflows, reporting, analytics, and administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** CRUD operations for customer and job management, panel registration, production approvals, estimate import, and detailed panel field management with 14-stage panel and 5-phase job lifecycles, both with audit logging.
- **AI Integration:** OpenAI is used for PDF analysis (panel specifications) and AI-powered visual comparisons.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, load list creation, and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations.
- **Communication:** Teams-style chat with DMs, groups, channels, @mentions, notifications, file attachments, and message topics.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management with a sales pipeline; document management with version control, bundles, entity linking, bulk upload, and AI metadata extraction.
- **Photo Gallery:** Visual gallery with search, filtering, grouping, full-screen viewing, multi-select, and download.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Advanced Features:** Panel consolidation, contract retention tracking, and visual document comparison.
- **Asset Register:** Asset lifecycle management including depreciation, insurance, maintenance, transfer history, AI analysis, and integrated repair requests.
- **Hire Booking Engine:** Equipment hire management with approval workflows for internal and external assets.
- **Job Programme:** Enhanced scheduling for job production levels with pour labels, sequence ordering, estimated/manual dates, drag-and-drop, inline editing, split-level functionality, and automatic recalculation.
- **Project Activities / Workflow System:** Template-driven activity workflow system for job types, with nested tasks, statuses, date editing, comments, file attachments, and MS Project-style dependencies.
- **User Invitation System:** Admin-initiated email invitations with secure tokens, public registration, and tracking.
- **CAPEX Module:** Capital expenditure request management with approval workflows, multi-section forms, approval limits, audit trails, and bidirectional PO integration.
- **Scope of Works Builder:** AI-powered scope generation for tender management across trades, featuring AI-generated and custom scope items, bulk status updates, duplication, export, and bidirectional linking with tenders.
- **Budget System:** Four-phase cost management: two-tier cost codes, a tender center for supplier submissions, job tender sheets for entry against budget line items, and per-job budget management with estimated totals, profit targets, variations, and forecast costs, including Bill of Quantities (BOQ).

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **OpenAI**: AI services for PDF analysis and visual comparisons.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching and state management.
- **Wouter**: Lightweight routing library.
- **shadcn/ui**: Reusable UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Express.js**: Backend web application framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **bcrypt**: Password hashing library.
- **express-session**: Session management middleware.
- **connect-pg-simple**: PostgreSQL-backed session store.
- **Vitest**: Testing framework.
- **ExcelJS**: Excel file generation library.

## Coding Standards

### Accessibility
- All pages have `role="main"` with a descriptive `aria-label`.
- All interactive elements have `aria-label` or visible label text.
- Forms use `aria-required` on required fields.
- Loading states use `aria-busy="true"` and `aria-live="polite"`.
- Error alerts use `role="alert"` and `aria-live="assertive"`.
- ESLint enforces 11 a11y rules via `eslint-plugin-jsx-a11y`.

### Frontend Testing
- 135 test files, 562+ tests using React Testing Library + Vitest.
- Config: `vitest.config.frontend.ts` with jsdom environment.
- Every interactive element must have a `data-testid` attribute.
- Run: `npx vitest --config vitest.config.frontend.ts --run`.

### Database Integrity
- 142 CHECK constraints across tables (monetary >= 0, rates >= 0 AND <= 100).
- 61 unique constraints, 390 foreign keys.
- New tables must include companyId with FK to companies.

### Developer Experience
- Quality check: `bash scripts/quality-check.sh`.
- Pre-commit: `husky` + `lint-staged` for ESLint.
- Lazy imports use `lazyWithRetry` for stale chunk handling.

---

## Enterprise Coding Rules (300+ Users)

### R1. Route Parameter Type Safety
Extract `req.params.*` into typed const variables before use:
```typescript
const id = req.params.id as string;
```

### R2. Multi-Tenant Data Isolation
EVERY query on company-owned tables MUST include `companyId` filter. No exceptions.

### R3. Input Validation
EVERY POST/PUT/PATCH endpoint MUST validate body with Zod schemas.

### R4. Error Handling
Try/catch with ZodError handling, 23505 duplicate detection, logger.error, user-friendly 500 messages.

### R5. Authentication & Authorization
Every route uses `requireAuth`. Role/permission checks on write/delete.

### R6. API Response Structure
Consistent: 201 created, 400 validation, 404 not found, 409 conflict, 500 server error.

### R7. AI Endpoint Safety
Validate input before OpenAI. Parse AI responses with try/catch.

### R8. Database Schema Changes
New tables need companyId. CHECK constraints on monetary/rate columns.

### R9. Frontend Component Rules
data-testid on interactive elements. Loading/error states. Cache invalidation after mutations.

### R10. File Organization
Routes: `server/routes/{module}.routes.ts`. Schemas: `shared/schema.ts`. Pages: `client/src/pages/`.

---

## Audit Checklist (Target: 90/100)

### A. Type Safety & Build Health (15 pts)
Zero LSP diagnostics, zero TS errors, typed req.params (R1).

### B. Security & Multi-Tenant Isolation (25 pts)
companyId on all queries (R2), requireAuth on all routes, UUID validation, no SQL injection.

### C. Input Validation & Error Handling (15 pts)
Zod on POST/PUT/PATCH (R3), consistent error responses (R4, R6).

### D. Database Integrity (15 pts)
CHECK constraints (142), UNIQUE constraints (61), foreign keys (390).

### E. Frontend Quality (15 pts)
data-testid (4,316), ARIA attrs (393), loading/error states, cache invalidation (641).

### F. Code Quality (15 pts)
Standard handler pattern, no TODOs/FIXMEs, consistent naming, logger usage (647).

---

## Recent Changes

### 2026-02-14 (Session 2)
- Fixed scope email bug: `emailService.sendEmail()` was called with object syntax instead of positional args - emails now send correctly.
- Fixed req.params type safety across 8 more route files (30+ handlers): broadcast, asset-repair, boq, users, capex, customer, progress-claims, project-activities.
- Added 39 new CHECK constraints (142 total, up from 103) on monetary/cost/hours/area/weight columns.
- Fixed critical companyId isolation gaps in admin.routes.ts (stats queries), assets.routes.ts (update/delete), budget.routes.ts (child record deletes).
- Added Zod validation to 5 route files: hire (reject/return/cancel), broadcast (send), capex (submit/approve/withdraw), reo-schedule (bulk/process/PO), contracts (create).
- Fixed LSP type errors in hire.routes.ts and contracts.routes.ts.
- Updated companyId eq() calls from 502 to 539, Zod validations from ~160 to 208.

### 2026-02-14 (Session 1)
- Fixed 56 LSP type errors in scopes.routes.ts (req.params type safety).
- Added Enterprise Coding Rules (R1-R10) and Audit Checklist to replit.md.
