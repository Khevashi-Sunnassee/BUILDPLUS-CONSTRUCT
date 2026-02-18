# BuildPlus Ai Management System

## Overview
The BuildPlus AI Management System optimizes panel production and delivery for construction and manufacturing. It manages the entire panel lifecycle from CAD/Revit time management to delivery tracking, aiming to enhance operational control, efficiency, and decision-making. Key features include daily log management, approval workflows, reporting, analytics, KPI dashboards, and logistics for load lists and delivery. The system is designed for enterprise-grade scale, supporting 300+ simultaneous users with multi-company deployment and data isolation, providing a comprehensive solution for managing complex construction and manufacturing workflows with a business vision to transform construction and manufacturing operations.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is a React application built with Vite, `shadcn/ui`, and Tailwind CSS for a modern UI/UX, including a KPI Dashboard with data visualization and interactive maps. The backend is an Express.js application using PostgreSQL and Drizzle ORM. Authentication is email/password-based with bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**UI/UX Decisions:**
- Modern, responsive design using `shadcn/ui` and Tailwind CSS.
- KPI Dashboard with data visualization and interactive maps for operational insights.

**Technical Implementations & Features:**
- **Core Management:** Time management, approval workflows, reporting, analytics, and administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** CRUD operations for customer and job management, panel registration, production approvals, estimate import, and detailed panel field management with 14-stage panel and 5-phase job lifecycles, both with audit logging.
- **AI Integration:** OpenAI is used for PDF analysis (panel specifications) and AI-powered visual comparisons.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, load list creation, and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations; enhanced job program scheduling with pour labels, sequence ordering, and drag-and-drop.
- **Communication:** Teams-style chat with DMs, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management; document management with version control, bundles, entity linking, bulk upload, and AI metadata extraction.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Address Autocomplete:** Australian suburb/postcode/state lookup across all address forms.
- **Advanced Features:** Panel consolidation, contract retention tracking, visual document comparison, and a comprehensive Asset Register with lifecycle management.
- **Employee Licences & Tickets:** Comprehensive licence/ticket management per employee with pre-populated construction ticket types and automated expiry email notifications.
- **Hire Booking Engine:** Equipment hire management with approval workflows for internal and external assets.
- **Project Activities / Workflow System:** Template-driven activity workflow system for job types, with nested tasks, statuses, comments, and MS Project-style dependencies.
- **User Invitation System:** Admin-initiated email invitations with secure tokens and public registration.
- **CAPEX Module:** Capital expenditure request management with approval workflows, audit trails, and bidirectional PO integration.
- **Scope of Works Builder:** AI-powered scope generation for tender management across trades.
- **Budget System:** Four-phase cost management including two-tier cost codes, a tender center, job tender sheets, and per-job budget management with Bill of Quantities (BOQ).
- **MYOB Integration:** OAuth 2.0 connection to MYOB Business API with database-backed token storage (per-company), auto-refresh, multi-tenant isolation, and Profit & Loss reporting via Report/ProfitAndLossSummary endpoint with date range presets, reporting basis selection, and account breakdown.
- **Centralized Email Inbox Addresses:** Per-company inbox email configuration (AP, Tender, Drafting) stored in companies table with unique constraints; polling jobs resolve addresses from company settings with backward-compatible fallback; individual inbox settings pages show read-only email sourced from company settings.
- **AP Email Inbox Monitoring:** Automatic invoice processing via Resend inbound email webhooks.
- **AP Invoice Status Workflow:** Multi-stage approval workflow for invoices: IMPORTED → PROCESSED → CONFIRMED → PARTIALLY_APPROVED → APPROVED.
- **Opportunity Submission Date & Reminders:** Opportunities have a submission date (datetime) field for tender deadlines; automated 7-day reminder emails are sent to customer contacts when submission dates approach, with deduplication tracking via `opportunity_submission_reminders` table.

**System Design Choices:**
- **Multi-Tenancy:** Designed for multi-company deployment with strict data isolation.
- **Scalability:** Supports 300+ simultaneous users.
- **Robustness:** Extensive input validation, comprehensive error handling, and consistent API response structures.
- **Security:** Multi-layered security with RBAC, CSRF protection, CSP headers, input sanitization, and comprehensive validation (see Security Coding Standards below).
- **Data Integrity:** Enforced through CHECK constraints, unique constraints, and foreign keys, with performance indexes.
- **Query Safety:** All list endpoints and multi-row queries have `.limit()` safeguards to prevent unbounded result sets.
- **Accessibility:** All interactive elements and pages adhere to accessibility standards.
- **Testing:** Comprehensive five-tier testing system:
  - *Frontend Component Tests*: 100% page coverage (66/66 pages) using React Testing Library + Vitest with mocked queries.
  - *Backend API Tests*: Integration tests covering company isolation, CRUD flows, security, RBAC, validation, and input sanitization.
  - *API Smoke Tests*: Automated endpoint discovery testing all ~500 GET endpoints for auth enforcement and 500-error absence.
  - *CRUD Flow E2E Tests*: End-to-end lifecycle tests for AP invoices, tenders, scopes, email inboxes, MYOB, and paginated endpoints.
  - *Load Testing*: Custom Node.js-based load test simulating 50→150→300→350 concurrent users with latency percentiles (p95/p99) and error rate thresholds.
  - *Test Runner*: Single command `bash tests/run-all-tests.sh` runs all tiers with selective skip flags (--skip-frontend, --skip-load, --backend-only, etc.).
- **Background Job System:** Interval-based scheduler for tasks like AP email polling and invoice extraction. All email polling jobs (AP, Tender, Drafting) are wrapped in Resend circuit breakers for resilience.
- **Job Queue System:** In-memory priority queue with concurrency control, retry mechanisms, 5-minute completed job retention, emergency cleanup at 5000 queue depth, and periodic 2-minute pruning.
- **Circuit Breakers:** Implemented for external services: OpenAI (3 failures/60s reset), Twilio/Mailgun/Resend (5 failures/30s reset). Resend breaker is applied to all email polling jobs.
- **Caching:** LRU cache with TTL for various data types (settings 5min/100, users 2min/500, jobs 3min/200, queries 30s/2000) with automatic pruning every 60s.
- **Rate Limiting:** Applied to API (300/min), Auth (20/15min), and Upload (30/min) endpoints.
- **Database Indexes:** 14+ composite indexes on high-volume tables: inbox tables (company+status, createdAt), AP invoices (company+status, dueDate), activity/notification tables for sub-100ms query performance at 300+ user scale.
- **Query Optimization:** Batch deduplication on email polling (AP and Tender use `inArray()` instead of per-email queries), selective column fetching for supplier matching (id, name, email only).
- **Request Monitoring:** Metrics collection, event loop lag measurement, request timing, and error monitoring.
- **Graceful Shutdown:** Handlers for SIGTERM/SIGINT to ensure clean application termination.
- **Session Management:** PostgreSQL-backed session store with 15-minute expired session pruning.
- **Broadcast System:** Template-based mass notifications via email/SMS/WhatsApp with delivery tracking.
- **Drafting Email Inbox:** Polls drafting@metdul.resend.app for inbound emails, AI-powered extraction identifying change requests, job matching, production impact, drawing references. Background poll on 5-min interval. Rich text email viewer with HTML/text toggle.

## Security Coding Standards

All new code MUST follow these security requirements to maintain the application's security posture.

### CSRF Protection (server/middleware/csrf.ts)
- **Double-submit cookie pattern** is enforced globally on all `/api` POST/PUT/PATCH/DELETE routes.
- CSRF tokens are **rotated on login** (via `rotateCsrfToken(res)` in auth routes) and **cleared on logout**.
- **Origin/Referer validation** rejects requests from mismatched origins using `timingSafeEqual` for token comparison.
- Client-side: All mutating requests MUST include the `x-csrf-token` header (handled automatically by `apiRequest()` and `apiUpload()` in `client/src/lib/queryClient.ts`).
- Exempt paths (webhooks, invitations, agent) are explicitly listed; do NOT add exemptions without security review.

### Content Security Policy (server/index.ts via helmet)
- CSP is configured via helmet with restrictive directives: `default-src 'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- Production `connectSrc` is restricted to known external APIs (OpenAI, Resend, Twilio, Mailgun, Replit domains).
- `upgradeInsecureRequests` is enforced in production; HSTS is set to 1 year.
- Additional headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restricts camera/microphone/geolocation/payment.
- When adding new external API integrations, update the `connectSrc` whitelist in `server/index.ts`.

### Input Validation & Sanitization (server/middleware/sanitize.ts)
All these middleware are applied globally via `server/index.ts`:
- **`sanitizeRequestBody`**: Strips `<script>` tags, inline event handlers (`onmouseover=`), and `javascript:` protocol from all request body strings. Applied to all routes.
- **`validateContentType`**: Rejects POST/PUT/PATCH requests with unsupported content types (only JSON, multipart, and urlencoded are allowed).
- **`enforceBodyLimits`**: Enforces string field length limits (10,000 chars for normal fields, 100,000 for long-text fields like `content`, `description`, `body`, `htmlBody`, `notes`, `scope`, `specifications`). Rejects arrays with >1,000 elements and objects with >200 fields.
- **`validateAllParams`**: Validates all route params against `^[a-zA-Z0-9_\-:.@]+$` regex (rejects HTML/SQL injection characters) and enforces 256-char max length.
- **`sanitizeQueryStrings`**: Strips script tags and `javascript:` protocol from all query string values.

### Coding Requirements for New Routes
1. **Never use raw SQL** with user input — always use Drizzle ORM's parameterized queries or `inArray()` instead of raw `ANY()` with template literals.
2. **Validate request bodies** with Zod schemas from `drizzle-zod` before passing to storage/database.
3. **UUID params are validated globally** via `validateAllParams` middleware. For extra strictness on specific routes, use `validateUUIDParams('id', 'jobId')` middleware from `server/middleware/sanitize.ts`.
4. **Never expose stack traces or internal errors** to clients — use generic error messages with structured error codes.
5. **All API responses** must include the company isolation check (`eq(table.companyId, companyId)`) to enforce multi-tenant data isolation.
6. **Session cookies** are configured with `httpOnly: true`, `secure: true` (production), `sameSite: 'lax'`, and PostgreSQL-backed storage.
7. **Rate limiting** is applied to all API routes (300/min), auth routes (20/15min), and upload routes (30/min).

### Security Testing
- Unit tests: `server/__tests__/csrf.test.ts` (16 tests) and `server/__tests__/sanitize.test.ts` (34 tests) cover middleware behavior.
- Integration tests: `tests/security.test.ts` (14 tests) verifies headers, CSRF enforcement, input validation, and rate limiting end-to-end.
- Smoke tests: `tests/api-smoke.test.ts` verifies all endpoints enforce authentication.

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
- **Resend**: Email service for outbound and inbound email processing.
- **MYOB Business API**: Accounting software integration.
- **Twilio**: SMS and voice communication services.
- **Mailgun**: Email automation service.