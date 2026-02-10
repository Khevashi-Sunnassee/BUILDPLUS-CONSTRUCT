# LTE Performance Management System

## Overview
The LTE Performance Management System is designed to optimize panel production and delivery for the construction and manufacturing industries. It provides comprehensive tools for managing the entire lifecycle of panel production, from initial CAD/Revit time management to final delivery tracking. Key capabilities include daily log management, approval workflows, reporting, analytics, KPI dashboards, and a logistics system for efficient load list creation and delivery management. The system aims to enhance operational control, improve production efficiency, and support robust decision-making.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is built with React + Vite, employing TanStack Query for data management, Wouter for routing, `shadcn/ui` for components, and Tailwind CSS for styling. The backend is developed using Express.js, with PostgreSQL as the database, managed by Drizzle ORM. Authentication is handled via email/password using bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**UI/UX Decisions:**
The frontend features a KPI Dashboard with data visualization, PDF export, and interactive maps for factory management. Mobile pages adhere to specific design tokens and layout patterns to ensure a consistent user experience with defined navigation and interaction guidelines.

**Technical Implementations & Features:**
- **Core Management:** Time and approval management, comprehensive reporting and analytics, and centralized administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** Full CRUD operations for customer and job management, panel registration, production approval workflows, estimate import, and detailed panel field management. Panels are tracked through a 14-stage lifecycle with audit logging, while jobs follow a 5-phase lifecycle with 6 statuses, imposing sequential progression and restricted actions.
- **AI Integration:** OpenAI is used for PDF analysis to extract panel specifications and AI-powered visual comparisons for documents.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, and a logistics system for load list creation and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations and CFMEU calendars.
- **Communication:** A Teams-style chat system with direct messages, groups, channels, @mentions, notifications, file attachments, and message topics (collapsible folder-like grouping for conversations via `chat_topics` table with sortOrder, CRUD management dialog, and topic assignment per conversation).
- **Sales & Document Management:** A mobile-first pre-sales opportunity management system with a detailed sales pipeline, and a comprehensive document management system with version control, bundles, and entity linking.
- **Photo Gallery:** A visual gallery for images from the document register, offering search, filtering, grouping, full-screen viewing, multi-select with email, and download functionalities on both web and mobile.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields and system-locked templates, and mobile PM Call Logs (list, 5-step wizard form, detail view) at `/mobile/pm-call-logs`.
- **Advanced Features:** Panel consolidation, contract retention tracking with automated deductions, and visual document comparison with pixel-level overlay and AI summarization.
- **Landing Page:** A branded landing page for unauthenticated users, routing authenticated users directly to the dashboard.
- **Asset Register:** Comprehensive asset lifecycle management with over 50 fields, supporting more than 40 asset categories, auto-generated asset tags, depreciation tracking, lease/finance management, insurance tracking, maintenance scheduling, transfer history, and AI-powered asset analysis.
- **Hire Booking Engine:** Equipment hire management with approval workflow (Draft → Requested → Approved → Booked → On Hire → Returned → Closed), supporting internal assets (own equipment with chargeout rates) and external hire companies (suppliers). Asset categories stored as integer index into ASSET_CATEGORIES array. Overdue return dates highlighted in red. Linked to jobs, employees, and suppliers.
- **Job Programme:** Enhanced scheduling for job production levels. Extends `job_level_cycle_times` table with pour labels (level splitting into A/B/C pours), sequence ordering, estimated/manual start and end dates, and notes. Features drag-and-drop reorder via @dnd-kit, inline editing of cycle days and dates, split-level functionality, automatic date recalculation using working days (factory work days + CFMEU holidays), and manual date overrides. Accessible from the Job Form Dialog's "Level Cycle Times" tab via "Open Job Programme" button. Route: `/admin/jobs/:id/programme`.
- **Project Activities / Workflow System:** Template-driven activity workflow system. Admin defines job types with workflow templates (activity_templates grouped by stages, linked to consultants). Activities are instantiated per job from templates. Database tables: job_types, activity_stages, activity_consultants, activity_templates, activity_template_subtasks, job_activities, job_activity_assignees, job_activity_updates, job_activity_files. Activities support 6 statuses (NOT_STARTED, IN_PROGRESS, STUCK, DONE, ON_HOLD, SKIPPED), inline date editing, comments/chat, file attachments. MS Project-style predecessor/dependency relationships: each activity template and job activity has `predecessorSortOrder` (integer referencing another activity's sortOrder) and `relationship` (FS/SS/FF/SF). Predecessors are copied from templates during instantiation. Job activities page has editable predecessor/relationship dropdowns in the sidebar, Pred/Rel columns in the table, and a "Recalculate Dates" button that recomputes all activity start/end dates based on predecessor chains and working days. Backend validation enforces predecessorSortOrder < sortOrder and clears relationship when predecessor is null. Working-day helpers (addWorkingDaysHelper, nextWorkingDayHelper, ensureWorkingDayHelper, subtractWorkingDaysHelper, resolveActivityStart) are module-level functions in `server/routes/project-activities.routes.ts`. Nested task management: each activity can have tasks (linked via `tasks.jobActivityId`), auto-created task groups (stored in `jobActivities.taskGroupId`), drag-and-drop reordering, assignee management, date constraints (enforced within activity start/end range), show/hide completed toggle. Activity tasks panel accessible via ListChecks icon on each activity row. API endpoints: `ACTIVITY_TASKS`, `ACTIVITY_TASKS_REORDER`, and `JOB_ACTIVITIES_RECALCULATE` in `PROJECT_ACTIVITIES_ROUTES`. Frontend component: `client/src/pages/tasks/ActivityTasksPanel.tsx`. Routes: `/admin/job-types` (admin management), `/admin/job-types/:id/workflow` (workflow builder), `/jobs/:jobId/activities` (job-specific activities view). Seed data available for Australian Property Development workflow with 10 stages, 37 consultants, 47 activities. API routes centralized in `shared/api-routes.ts` under `PROJECT_ACTIVITIES_ROUTES`.

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

## Audit & Quality Standards
All audit procedures, the fixed scoring rubric, the Verified Fixes Registry, and the Known Issues Tracker are maintained in **`AUDIT_STANDARDS.md`**. When performing any audit, always read that file first.

There are **two separate audit types** in `AUDIT_STANDARDS.md`:
1. **Comprehensive Debugging & QA Audit** — Code-level audit covering TypeScript, security, backend, database, frontend quality, performance, observability, rules compliance, and testing. Uses the Fixed Scoring Rubric (9 categories, weighted 5-20% each, letter grade A-F).
2. **Full UI Audit** — Page-by-page, button-by-button visual verification of the entire application (desktop + mobile). Starts with a database data snapshot, then checks every page's displayed data against the database, tests all CRUD operations, verifies multi-step workflows, and checks cross-cutting concerns (console errors, responsive layout, dark mode, session persistence). Uses its own output format with pass/fail per page.

## Coding Rules & Conventions

### Schema & Database Rules
- **NEVER change primary key ID column types.** If it's `serial`, keep `serial`. If it's `varchar` with UUID, keep `varchar`.
- **NEVER change column types (e.g., text to decimal) without:** (1) a written migration plan, (2) a data backup, (3) explicit user approval. Use application-layer guards (like `safeParseFinancial`) as the safer alternative.
- Use `npm run db:push --force` to sync schema changes. Avoid manual SQL migrations unless a specific data migration requires it (with approval).
- All new tables MUST have indexes on foreign key columns and frequently filtered columns.
- Financial columns in new tables MUST use `decimal(14,2)` type, not `text`.

### Backend Rules
- All mutating routes (POST/PATCH/PUT/DELETE) MUST have Zod schema validation via `safeParse()`.
- All protected routes MUST have `requireAuth` middleware. Admin routes MUST also have `requireRole("ADMIN")` or `requireRole("ADMIN", "MANAGER")`.
- All multi-step database writes MUST use `db.transaction()`.
- Use `safeParseFinancial()` (not raw `parseFloat()`) for any financial value parsing.
- Use `String(req.params.id)` pattern for Express v5 route parameters.
- Use Pino logger with `logger.error({ obj }, "msg")` syntax (object first, message second).
- Company scope (tenant isolation) MUST be verified before update/delete operations on shared resources.

### Frontend Rules
- Use TanStack Query v5 object-form API: `useQuery({ queryKey: ['key'] })`.
- Use `apiRequest` from `@lib/queryClient` for mutations. Always invalidate cache by queryKey after mutation.
- Use shadcn/ui components. Do not create custom replacements for existing components.
- All interactive and meaningful display elements MUST have `data-testid` attributes.
- Use `import.meta.env.VITE_*` for frontend environment variables, never `process.env`.
- Show loading states (`isLoading`) on queries and disable buttons during mutations (`isPending`).

### Security Rules
- Never expose or log secrets. All sensitive values via `process.env` only.
- All `dangerouslySetInnerHTML` and `innerHTML` MUST use `DOMPurify.sanitize()`.
- CSRF middleware is applied globally to `/api` routes — do not bypass without explicit justification.
- File uploads MUST have type filtering and size limits via multer configuration.

### Testing
- **Framework:** Vitest (v4.x), configured in `vitest.config.ts` with sequential file execution (`fileParallelism: false`, `maxWorkers: 1`).
- **E2E Tests:** 6 test files (`tests/e2e-*.test.ts`) with 83 tests covering hire booking workflow, task management, document register, panel lifecycle, RBAC/auth security, and progress claims.
- **E2E Helpers:** Shared test utilities in `tests/e2e-helpers.ts` with login caching, authenticated fetch wrappers (adminGet/adminPost/adminPatch/adminPut/adminDelete), CSRF handling, and unique name generators.
- **Run E2E tests:** `npx vitest run tests/e2e-*.test.ts`
- **Run all tests:** `npx vitest run`
- **Test approach:** E2E tests hit the live server at localhost:5000 with actual database writes. Sequential execution prevents login rate limiting.

### Database Migrations & Deployment
- **Migration system:** Drizzle ORM migrations in `migrations/` directory, auto-applied on app startup via `server/migrate.ts`.
- **Migration runner:** Executes pending migrations before the app starts serving requests. Uses a dedicated connection pool with 2-minute statement timeout.
- **Pre-deployment workflow:**
  1. Make schema changes in `shared/schema.ts`
  2. Run `bash scripts/generate-migration.sh` (or `npx drizzle-kit generate`) to create a new migration file
  3. Review the generated SQL in `migrations/`
  4. Commit the migration file
  5. Deploy — the app will auto-apply pending migrations on startup
- **Migration files:** `migrations/0000_nappy_killraven.sql` (initial baseline, 113 tables), `migrations/0001_cool_exiles.sql` (added `website` column to customers)
- **Safety:** Never use `db:push` in production. Always use the migration workflow above. Migrations are tracked in `drizzle.__drizzle_migrations` table.
- **Rollback:** Drizzle migrations are forward-only. To revert, create a new migration that undoes the change (e.g., `ALTER TABLE ... DROP COLUMN ...`).

### Documentation Maintenance Rule
Any code change touching security, auth, validation, or database schema MUST update `AUDIT_STANDARDS.md` (Known Issues Tracker and Verified Fixes Registry). Stale documentation is a risk.