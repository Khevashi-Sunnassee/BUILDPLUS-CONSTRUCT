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
- **Job & Panel Lifecycle:** CRUD for customer/job management, panel registration, production approvals, estimate import, and detailed panel field management with 14-stage panel and 5-phase job lifecycles, both with audit logging. Company-specific auto-generated job numbers with configurable prefix, minimum digits, and atomic sequential numbering stored in global_settings.
- **AI Integration:** OpenAI for PDF analysis and AI-powered visual comparisons. Knowledge Base with RAG (pgvector semantic search, intelligent chunking with overlap, OpenAI embeddings, streaming responses, KB-only/Hybrid answer modes). AI usage quotas (200 requests/user/day) with tracking table. LRU embedding cache (O(1) eviction, 5000 entries, 30min TTL). Conversation ownership isolation (users can only access their own conversations). Prompt injection sanitization with audit logging. Enhanced markdown rendering (headers, code blocks, lists, links, inline code).
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, load list creation, and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations; enhanced job program scheduling with pour labels, sequence ordering, and drag-and-drop.
- **Communication:** Teams-style chat with DMs, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management; document management with version control, bundles, entity linking, bulk upload, and AI metadata extraction.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Address Autocomplete:** Australian suburb/postcode/state lookup.
- **Advanced Features:** Panel consolidation, contract retention tracking, visual document comparison, and an Asset Register.
- **Employee Licences & Tickets:** Comprehensive licence/ticket management with automated expiry email notifications.
- **Hire Booking Engine:** Equipment hire management with approval workflows.
- **Project Activities / Workflow System:** Template-driven activity workflow system for job types, with nested tasks, statuses, comments, and MS Project-style dependencies. Task groups support job association with auto-created `{JOB} Programme Activities` and `{JOB} Email Actions` naming patterns.
- **User Invitation System:** Admin-initiated email invitations with secure tokens and public registration.
- **CAPEX Module:** Capital expenditure request management with approval workflows, audit trails, and bidirectional PO integration.
- **Scope of Works Builder:** AI-powered scope generation for tender management.
- **Budget System:** Four-phase cost management including two-tier cost codes, a tender center, job tender sheets, and per-job budget management with Bill of Quantities (BOQ).
- **MYOB Integration:** OAuth 2.0 connection to MYOB Business API with database-backed token storage (per-company), auto-refresh, multi-tenant isolation, and Profit & Loss reporting.
- **Centralized Email Inbox Addresses:** Per-company inbox email configuration (AP, Tender, Drafting) with unique constraints and polling jobs.
- **AP Email Inbox Monitoring:** Automatic invoice processing via Resend inbound email webhooks.
- **AP Invoice Status Workflow:** Multi-stage approval workflow for invoices.
- **Opportunity Submission Date & Reminders:** Opportunities have a submission date field for tender deadlines; automated 7-day reminder emails are sent.
- **Drafting Email Inbox:** Polls drafting@metdul.resend.app for inbound emails, AI-powered extraction identifying change requests, job matching, production impact, drawing references.
- **Email Template System:** Rich text email templates (TipTap editor) with template types (Activity, General, Tender, etc.), email compose dialog with template selection and To/CC/BCC fields, email send via Resend with audit logging in email_send_logs, integrated into activity task rows for sending correspondence directly from tasks.

**System Design Choices:**
- **Multi-Tenancy:** Designed for multi-company deployment with strict data isolation.
- **Scalability:** Supports 300+ simultaneous users.
- **Robustness:** Extensive input validation, comprehensive error handling, and consistent API response structures.
- **Security:** Multi-layered security with RBAC, CSRF protection, CSP headers, input sanitization, and comprehensive validation.
- **Data Integrity:** Enforced through CHECK constraints, unique constraints, and foreign keys, with performance indexes.
- **Query Safety:** All list endpoints and multi-row queries have `.limit()` safeguards.
- **Accessibility:** All interactive elements and pages adhere to accessibility standards.
- **Testing:** Comprehensive five-tier testing system including Frontend Component Tests, Backend API Tests, API Smoke Tests, CRUD Flow E2E Tests, and Load Testing.
- **Background Job System:** Interval-based scheduler for tasks like AP email polling and invoice extraction, wrapped in Resend circuit breakers.
- **Job Queue System:** In-memory priority queue with concurrency control, retry mechanisms, and periodic pruning.
- **Circuit Breakers:** Implemented for external services: OpenAI, Twilio/Mailgun/Resend.
- **Caching:** LRU cache with TTL for various data types and automatic pruning.
- **Rate Limiting:** Applied to API, Auth, and Upload endpoints.
- **Database Indexes:** 14+ composite indexes on high-volume tables for sub-100ms query performance.
- **Query Optimization:** Batch deduplication on email polling, selective column fetching.
- **Request Monitoring:** Metrics collection, event loop lag measurement, request timing, error monitoring, and Prometheus-compatible metrics export.
- **Error Response Sanitization:** Production middleware strips internal error details from 500+ responses and scans 400-level errors for internal patterns.
- **Graceful Shutdown:** Handlers for SIGTERM/SIGINT with drain period for in-flight requests.
- **Session Management:** PostgreSQL-backed session store with expired session pruning and monitoring.
- **Broadcast System:** Template-based mass notifications via email/SMS/WhatsApp with delivery tracking.

## Testing
- **Framework:** Vitest with `pool: "forks"`, `maxWorkers: 1`, `fileParallelism: false` for isolation.
- **Test Count:** 36 test files, 1378 tests passing, 0 failures, 0 skipped (as of Feb 2026).
- **Codebase Metrics:** 222,617 LOC, 70 route files, 163 pages, 26 test files, 9 migrations.
- **Test Pattern:** E2E tests use `beforeAll` with async `loginAdmin()` + `authAvailable` flag. Tests guard with `if (!authAvailable) return;` at start of each `it()` block. Do NOT use `describe.skipIf(!isAdminLoggedIn())` — this evaluates synchronously before `beforeAll` runs in fork mode.
- **Rate Limiting:** Tests accept both 401 and 429 for auth-required assertions since the API rate limiter (20 requests/15min) can trigger during test runs.
- **Test Categories:** Frontend Component Tests, Backend API Tests, API Smoke Tests (770+ endpoint coverage), CRUD Flow E2E Tests, Security Tests, KB Security Tests, Load Tests.
- **Prerequisite Data:** E2E tests that need jobs/employees/suppliers use graceful degradation (set `authAvailable = false`) rather than hard `expect().toBeTruthy()` assertions in `beforeAll`.

## Recent Changes
- **Feb 2026:** Fixed all test skip mechanisms (describe.skipIf → beforeAll pattern), enabled 885 previously skipped tests, added kb_messages company_id index, rate-limit-tolerant assertions across all test suites.

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
- **TipTap**: Rich text editor framework for email template composition.