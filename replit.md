# LTE Performance Management System

## Overview
The LTE Performance Management System optimizes panel production and delivery in construction and manufacturing. It enhances CAD and Revit time management, provides insights into production and financial performance, and manages the complete lifecycle of panel production and delivery. The system includes daily log management, manager approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load lists and delivery tracking, supporting robust decision-making and operational control.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture. The frontend is built with React + Vite, utilizing TanStack Query for data fetching, Wouter for routing, `shadcn/ui` components, and Tailwind CSS for styling. The backend uses Express.js with PostgreSQL as the primary database, managed by Drizzle ORM. User authentication is handled via email/password with bcrypt and `express-session`, featuring Role-Based Access Control (RBAC) with granular permissions.

**UI/UX Decisions:**
The frontend features a KPI Dashboard with data visualization and PDF export, and interactive maps for factory management. Mobile pages adhere to strict design tokens and layout patterns, ensuring a consistent user experience with specific navigation and interaction guidelines.

**Technical Implementations & Features:**
- **Core Management:** Time and approval management, comprehensive reporting and analytics, and centralized admin provisioning for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** Full CRUD operations for customer and job management, panel registration, production approval workflows, estimate import, and detailed panel field management. Panels are tracked through a 14-stage lifecycle with audit logging. Jobs follow a 5-phase lifecycle (OPPORTUNITY → QUOTING → WON_AWAITING_CONTRACT → CONTRACTED, or LOST) with 6 statuses. Phase progression is sequential, restricting available actions and capabilities.
- **AI Integration:** OpenAI is used for PDF analysis to extract panel specifications and AI-powered visual comparison summaries for documents.
- **Financial & Logistics:** Configurable rates and cost analysis, production tracking, and a logistics system for load list creation and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, with support for multi-factory operations and CFMEU calendars.
- **Communication:** A Teams-style chat system including direct messages, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** A mobile-first pre-sales opportunity management system with a detailed sales pipeline, and a comprehensive document management system with version control, bundles, and entity linking.
- **Photo Gallery:** A visual gallery for image files from the document register, offering search, filtering, grouping, full-screen viewing, multi-select with email, and download functionalities on both web and mobile.
- **Mobile Functionality:** Dedicated QR scanner for panels and document bundles, and mobile panel checklists (e.g., Quality Inspections) with conditional fields and system-locked templates.
- **Advanced Features:** Panel consolidation, contract retention tracking with automated deductions, and visual document comparison with pixel-level overlay and AI summarization.
- **Landing Page:** BuildPlusAI branded landing page at `/` for unauthenticated users (www.buildplusai.com), with hero section, feature showcase, stats, and login CTA. Authenticated users are routed directly to the dashboard.
- **Asset Register:** Comprehensive asset lifecycle management with 50+ fields across 8 tabs, supporting 40+ asset categories, auto-generated asset tags, depreciation tracking, lease/finance management, insurance tracking, maintenance scheduling, transfer history, and AI-powered asset analysis via OpenAI.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **OpenAI**: AI services for PDF analysis and visual comparison summaries.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching and state management for React.
- **Wouter**: Lightweight routing library for React.
- **shadcn/ui**: Reusable UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Express.js**: Backend web application framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **bcrypt**: Library for hashing passwords.
- **express-session**: Middleware for session management.
- **connect-pg-simple**: PostgreSQL-backed session store for `express-session`.
- **Vitest**: Testing framework for unit and integration tests.
- **ExcelJS**: Excel file generation library.

## Comprehensive Debugging & QA Audit Procedure
When the user requests a "comprehensive debugging", "full audit", "QA pass", or "code quality check", act as a senior full-stack engineer, performance engineer, and security auditor. Run a comprehensive debugging + quality-assurance pass across the ENTIRE application (frontend, backend, database, auth, build pipeline, and deployment configuration).

### 0. Baseline & Inventory (Do This First)
- Identify the tech stack: framework (React/Vite), backend runtime (Node/Express), DB (PostgreSQL), ORM (Drizzle), auth method (cookie session with bcrypt), hosting/runtime assumptions (Replit).
- Enumerate key directories (client/src/, server/, shared/, public/) and identify entry points.
- List all API routes/endpoints and all page routes.
- Identify coding rules/conventions in the repo (eslint, prettier, tsconfig, folder conventions, naming conventions).
- If config files are missing, flag as a risk.

### 1. Frontend (Deep)
- Validate React/TypeScript correctness end-to-end.
- Check for invalid React element types, broken imports/exports, incorrect default/named imports, circular component imports.
- Hooks rules audit: invalid hook usage, dependency arrays, stale closures, excessive rerenders, missing memoization where needed.
- State management audit (local state vs global state): state leaks, orphan listeners, unmounted setState calls, event handler leaks.
- Routing & UI flow audit: broken routes, missing loaders, incorrect redirects, auth gating, and error boundaries.
- Form & data handling: validation gaps, unsafe parsing, missing empty/loading/error states, optimistic update mistakes.
- Accessibility & UX risks: missing aria labels, focus traps, keyboard navigation, modal scroll-lock issues.
- Client security: XSS risks from dangerouslySetInnerHTML, unsafe rendering of API content, unsafe HTML/markdown rendering.
- Bundle/performance: identify large bundles, duplicated deps, blocking renders, excessive hydration, large images, unnecessary rerenders.
- Ensure no secrets or server-only env vars are referenced in the client bundle.

### 2. Backend (Deep)
- Validate ALL API endpoints exist, are reachable, and consistently implemented.
- For each endpoint:
  - Confirm method + path + request schema + response schema
  - Confirm consistent error format and status codes
  - Confirm idempotency for safe retries where relevant
  - Confirm input validation + output validation (schema guard) exists
- Authentication + Authorization:
  - Ensure every protected endpoint enforces auth AND permissions/role checks
  - Verify public endpoints are explicitly marked public
  - Confirm no endpoints accidentally bypass auth checks
- Error handling:
  - Ensure centralized error handler exists and prevents stack trace leakage in prod
  - Confirm logging includes request-id and relevant context
- Database & transactions:
  - Detect N+1 query patterns, missing indexes on frequent filters/joins
  - Ensure writes use transactions where needed; detect unsafe partial writes
  - Confirm connection pooling settings and timeout handling
  - Confirm migrations exist and schema drift is controlled
- Data integrity:
  - Verify critical tables have constraints (unique keys, foreign keys if applicable)
  - Detect race conditions for concurrent writes (double insert, oversell, etc.)
- File upload / import pipelines (if present):
  - Validate file type checking, size limits, virus-risk controls, storage safety, and path traversal protections.

### 3. Security (Comprehensive)
- CSRF:
  - Verify CSRF protection for all cookie-based write operations (POST/PUT/PATCH/DELETE).
  - Confirm SameSite policy aligns with CSRF approach.
- Cookies & sessions:
  - Ensure cookies are HttpOnly, Secure, SameSite configured correctly.
  - Confirm session fixation protections and rotation on login.
- Injection risks:
  - SQL injection risk review (raw queries, string concatenation)
  - NoSQL injection patterns if applicable
  - Command injection risks in server utilities
- XSS:
  - Validate output encoding, safe HTML/markdown rendering, sanitization for user-generated content.
- SSRF / Open redirect:
  - Detect any user-controlled URL fetching; ensure allowlists and DNS/IP protections.
- Secrets:
  - Ensure secrets are not hard-coded; verify only environment variables are used.
  - Detect leaked secrets or keys in repo history if possible.
- Dependencies:
  - Scan dependencies for known vulnerabilities and provide patch guidance.
- Security headers:
  - Validate CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- Rate limiting & abuse:
  - Confirm rate limiting on auth + write-heavy endpoints.
  - Confirm request body limits and upload limits.
- Auth hardening:
  - Verify password policy (if applicable), hashing algorithm, login throttling, lockout protections, and MFA readiness.

### 4. TypeScript, Build, and Codebase Integrity (Deep)
- Run full TypeScript typecheck with `--noEmit` and strict settings; surface unsafe `any` usage.
- Run ESLint and report all violations; ensure React hooks lint is enabled.
- Ensure Prettier/format rules are consistent (flag if missing).
- Detect circular dependencies, unreachable modules, dead code, duplicated utilities.
- Confirm the app builds cleanly in production mode with no warnings.
- Validate environment config: required env vars, safe defaults, and missing config failures.
- Verify CI/CD scripts (if present) are correct and enforce the same checks.

### 5. Performance, Latency & Scalability (200+ Users + High Transactions)
- Identify slow paths in API (p95 and p99) and sources of latency (DB, I/O, external calls).
- Confirm caching strategy where appropriate (server caching, CDN caching, query caching).
- Confirm server is stateless or uses shared storage (Redis/db) for sessions to scale horizontally.
- Confirm DB pool sizing, timeouts, and backpressure for bursts.
- Identify bottlenecks: heavy endpoints, inefficient queries, chat/message polling, large payloads.
- Detect blocking Node operations (sync fs, heavy CPU) and recommend background jobs/queues.
- Simulate/estimate load under 200 concurrent users:
  - API p95, error rate, DB saturation risk, and memory usage risks.
- Flag any design that will fail under concurrency (race conditions, per-request expensive work).

### 6. Rules Compliance (Strict)
- Verify the codebase follows its own architectural and coding rules:
  - folder conventions, route conventions, naming conventions, patterns for auth + validation.
- Flag deviations and provide a "fix pattern" with example edits.

### 7. Observability & Operations (Production Readiness)
- Confirm structured logging exists and is consistent (no leaking secrets).
- Confirm request tracing / correlation IDs for API calls.
- Confirm health checks (readiness/liveness) exist.
- Confirm error monitoring hooks exist (or flag missing: Sentry-like).
- Confirm backups/migration safety practices (or flag as risk).

### 8. Output Requirements (Non-negotiable)
- Produce a single structured report summarizing:
  - Critical issues (must-fix)
  - High risks (security/perf)
  - Warnings
  - Recommended fixes with exact file paths and line references
- Assign an overall Application Health Score (0–100) with a clear scoring breakdown per category:
  - Frontend, Backend, Security, Build/TS, Performance/Scale, Rules Compliance, Observability
- Assign a letter grade (A–F)
- Clearly state whether the application is SAFE TO DEPLOY or BLOCKED
- Provide a prioritized "Top 10 Fix List" with expected impact (security/perf/stability).

**Audit Principles:** Be strict. Assume production risk. Do not ignore issues. If something is unclear, surface it as an explicit risk instead of guessing.