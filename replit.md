# BuildPlus AI Management System

## Overview
The BuildPlus AI Management System optimizes panel production and delivery for the construction and manufacturing industries. It manages the entire panel lifecycle from CAD/Revit time management to delivery tracking, enhancing operational control, efficiency, and decision-making. Key capabilities include daily log management, approval workflows, comprehensive reporting, analytics, KPI dashboards, and logistics management. Designed for enterprise-grade scalability, it supports over 300 simultaneous users with multi-company deployment and strict data isolation, aiming to revolutionize construction and manufacturing operations.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture. The frontend is a React application built with Vite, `shadcn/ui`, and Tailwind CSS, featuring a KPI Dashboard for data visualization. The backend is an Express.js application utilizing PostgreSQL with Drizzle ORM. Authentication uses email/password with bcrypt and `express-session`, implementing Role-Based Access Control (RBAC) with a Super Admin tier for platform-wide management.

**UI/UX Decisions:**
- Modern, responsive design leveraging `shadcn/ui` and Tailwind CSS.
- Interactive KPI Dashboards including maps for operational insights.

**Technical Implementations & Features:**
- **Core Management:** Time management, configurable approval workflows, reporting, analytics, and administrative functions.
- **Job & Panel Lifecycle:** Comprehensive CRUD operations, panel registration, production approvals, detailed panel field management, and audit logging for 14-stage panel and 5-phase job lifecycles.
- **AI Integration:** OpenAI for PDF analysis, AI-powered visual comparisons, and a Knowledge Base utilizing RAG (pgvector semantic search, OpenAI embeddings) with usage quotas. KB supports ChatGPT Projects-style collaboration with shared projects, multiple threads per project, member invitations (OWNER/EDITOR/VIEWER roles), cross-thread context sharing, and project-wide AI instructions.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, load list generation, and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots for multi-factory operations; enhanced job program scheduling with pour labels and drag-and-drop functionality.
- **Communication:** Teams-style chat supporting DMs, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management; document management with version control, bundles, entity linking, bulk upload, and AI metadata extraction.
- **Mobile Functionality:** QR scanner, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Advanced Features:** Panel consolidation, contract retention tracking, visual document comparison, Asset Register, Employee Licences & Tickets management, Hire Booking Engine, Capital Expenditure (CAPEX) module, AI-powered Scope of Works Builder, and a four-phase Budget System with Bill of Quantities (BOQ).
- **Project Activities / Workflow System:** Template-driven activity workflow system with nested tasks, statuses, comments, and MS Project-style dependencies.
- **External API Integration:** REST API with two-layer authentication (API key + JWT user tokens) for external app connectivity. API key provides company-level access; user tokens enforce per-user job membership filtering matching BuildPlus web app access rules. Supports bidirectional data sharing including jobs, documents, cost codes, markups, and estimates. Includes file download (`GET /api/v1/external/documents/:id/download`) and markup version upload (`POST /api/v1/external/documents/:id/markup-version`) endpoints.
- **BuildPlus Markup Integration:** Cross-app integration with BuildPlus Markup (separate Replit app) for document markup workflows. Per-user credential linking (`markup_credentials` table), handoff token system (`POST /api/markup/handoff`) generating deep links with base64url-encoded payloads, and automatic markup version creation as new document versions. Credential management via Document Register toolbar (`MarkupSetupDialog`). The Markup app uses the same External API (API key set in Super Admin) for document download and markup upload.
- **Email Systems:** Centralized email inbox configurations, AP Email Inbox Monitoring for automatic invoice processing, Drafting Email Inbox for AI-powered change request identification, and a rich text Email Template System with audit logging.
- **Review Mode (Super Admin):** Agent-driven page quality scoreboard with auto-discovery of 121+ pages, 8-dimension scoring (functionality, UI/UX, security, performance, code quality, data integrity, error handling, accessibility), audit history tracking, review queue management (unreviewed/needs-work/reviewed), and persistent score storage. The agent performs full-codebase reviews directly rather than through API-limited AI calls, recording scores via the review_audits table.

**System Design Choices:**
- **Multi-Tenancy:** Designed for multi-company deployment with strict data isolation.
- **Scalability:** Supports 1,000+ simultaneous users with robust error handling, atomic sequence generation, batch query optimization, and consistent API responses.
- **Security:** Multi-layered security with RBAC (USER/MANAGER/ADMIN roles + Super Admin flag), CSRF protection, CSP headers, input sanitization, and comprehensive validation. Super Admin (`isSuperAdmin` boolean on users) controls platform-wide settings (Companies, Help Management) via `/super-admin` page and `requireSuperAdmin` middleware, distinct from company-level ADMIN role.
- **Data Integrity:** Enforced through CHECK constraints, unique constraints, foreign keys, and performance indexes; list endpoints use `.limit()` safeguards.
- **Testing:** Comprehensive five-tier testing system including Frontend Component Tests, Backend API Tests, API Smoke Tests, CRUD Flow E2E Tests, and Load Testing.
- **Background Processes:** Interval-based scheduler and an in-memory priority job queue with concurrency control.
- **Email Dispatch:** Enterprise async queue-based email dispatch with token bucket rate limiting, per-company daily quotas, exponential backoff retry.
- **Circuit Breakers:** Implemented for external services.
- **Caching:** LRU cache with TTL.
- **Rate Limiting:** Applied to API, Auth, Upload endpoints, and email dispatch.
- **Monitoring:** Metrics collection, event loop lag measurement, request timing, and error monitoring.
- **Graceful Shutdown:** Handlers for SIGTERM/SIGINT.
- **Session Management:** PostgreSQL-backed session store.
- **Broadcast System:** Template-based mass notifications via email/SMS/WhatsApp.

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
- **MYOB Business API**: Accounting software integration with OAuth authentication, Financial Dashboard (monthly P&L trends, KPI cards, charts), AP invoice export to MYOB Purchase Bills, and code mapping system (cost codes → MYOB accounts, suppliers → MYOB suppliers, tax codes → MYOB tax codes) with auto-map by name and manual mapping UI.
- **Twilio**: SMS and voice communication services.
- **Mailgun**: Email automation service.
- **TipTap**: Rich text editor framework.