# BuildPlus Ai Management System

## Overview
The BuildPlus AI Management System optimizes panel production and delivery for construction and manufacturing. It manages the entire panel lifecycle, from CAD/Revit time management to delivery tracking, aiming to enhance operational control, efficiency, and decision-making. Key features include daily log management, approval workflows, reporting, analytics, KPI dashboards, and logistics for load lists and delivery. The system is designed for enterprise-grade scale, supporting 300+ simultaneous users with multi-company deployment and data isolation, providing a comprehensive solution for managing complex construction and manufacturing workflows.

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
- **Address Autocomplete:** Australian suburb/postcode/state lookup across all address forms (customers, suppliers, employees, jobs, factories, mobile opportunities) using a built-in dataset via `SuburbLookup` component and `/api/address-lookup` endpoint.
- **Advanced Features:** Panel consolidation, contract retention tracking, visual document comparison, and a comprehensive Asset Register with lifecycle management.
- **Hire Booking Engine:** Equipment hire management with approval workflows for internal and external assets.
- **Project Activities / Workflow System:** Template-driven activity workflow system for job types, with nested tasks, statuses, comments, and MS Project-style dependencies.
- **User Invitation System:** Admin-initiated email invitations with secure tokens and public registration.
- **CAPEX Module:** Capital expenditure request management with approval workflows, audit trails, and bidirectional PO integration.
- **Scope of Works Builder:** AI-powered scope generation for tender management across trades.
- **Budget System:** Four-phase cost management including two-tier cost codes, a tender center, job tender sheets, and per-job budget management with Bill of Quantities (BOQ).
- **MYOB Integration:** OAuth 2.0 connection to MYOB Business API with database-backed token storage (per-company), auto-refresh, and multi-tenant isolation. Endpoints: company info, customers, suppliers, accounts, invoices, inventory items. Frontend page at `/myob-integration` with tabbed data browsing. Key files: `server/myob.ts` (API client), `server/routes/myob.routes.ts` (routes), `client/src/pages/myob-integration.tsx` (UI).

**System Design Choices:**
- **Multi-Tenancy:** Designed for multi-company deployment with strict data isolation, ensuring every query on company-owned tables includes a `companyId` filter.
- **Scalability:** Supports 300+ simultaneous users.
- **Robustness:** Extensive input validation using Zod, comprehensive error handling, and consistent API response structures.
- **Security:** Role-Based Access Control (RBAC), authentication via `bcrypt` and `express-session`, and UUID validation.
- **Data Integrity:** Enforced through 142 CHECK constraints, 61 unique constraints, and 390 foreign keys. Performance indexes on all user_id and created_at columns.
- **Query Safety:** All list endpoints and multi-row queries have pagination limits to prevent unbounded result sets at scale.
- **Accessibility:** All interactive elements and pages adhere to accessibility standards (`aria-label`, `aria-required`, `role="alert"`).
- **Testing:** Frontend tested with React Testing Library + Vitest (135 files, 562+ tests); backend tested with 43+ API integration tests covering company isolation, data integrity, pagination, rate limiting, and input sanitization.

## Sidebar Pattern (EntitySidebar)

When building sidebar components with Updates/Files/Activity tabs, **always** use the shared `EntitySidebar` component (`client/src/components/EntitySidebar.tsx`) instead of duplicating sidebar logic. Shared utilities live in `client/src/lib/sidebar-utils.tsx`.

**How to add a new sidebar:**
1. Define route constants in `shared/api-routes.ts` (UPDATES, UPDATE_BY_ID, FILES, FILE_BY_ID, EMAIL_DROP)
2. Create a thin wrapper component that passes entity-specific props to `EntitySidebar`
3. Use `testIdPrefix` for consistent data-testid naming (e.g., `"task"`, `"opp"`, `"budget"`, `"invitation"`)
4. Use `extraTabs` + `renderExtraTab` for entity-specific tabs (e.g., BudgetLineSidebar's "items" tab)
5. Use `hideActivityTab` if the entity doesn't need an activity log
6. Use `invalidationKeys` to specify parent query keys to invalidate on mutations

**Existing sidebars using this pattern:**
- `TaskSidebar` → `client/src/pages/tasks/TaskSidebar.tsx` (uses TASKS_ROUTES)
- `OpportunitySidebar` → `client/src/pages/OpportunitySidebar.tsx` (uses OPPORTUNITY_ROUTES)
- `BudgetLineSidebar` → `client/src/components/budget/BudgetLineSidebar.tsx` (uses BUDGET_LINE_ROUTES, has extra "items" tab)
- `InvitationSidebar` → inline in `client/src/pages/tender-detail.tsx` (uses TENDER_MEMBER_ROUTES)

## Lifecycle Testing

The lifecycle testing skill (`.agents/skills/lifecycle-testing/SKILL.md`) documents the complete 15-stage panel lifecycle test workflow. Key points:

- **Test Company:** Salvo Property Group (admin@salvo.com.au / admin123)
- **15 Stages:** Job setup → Panel registration → Production slots → Drafting program → Drafting Register (daily logs) → Job activities → Panel lifecycle advancement → Production entries → Reo schedules → Activity completion → Load lists → Delivery confirmation → Progress claims
- **Date-Sensitive Data:** Daily log dates must be within the current week for the Drafting Register page; production entry dates must be within 30 days for the Production Schedule page.
- **Schema Gotchas:** `production_entries` uses `production_date` (not `pour_date`); `daily_logs` has no `company_id` column (filter by `user_id`); `job_activities` status enum uses `DONE` not `COMPLETED`; `document_status` is an enum requiring `::text` cast in SQL aggregations.

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