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
- **Communication:** A Teams-style chat system with direct messages, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** A mobile-first pre-sales opportunity management system with a detailed sales pipeline, and a comprehensive document management system with version control, bundles, and entity linking.
- **Photo Gallery:** A visual gallery for images from the document register, offering search, filtering, grouping, full-screen viewing, multi-select with email, and download functionalities on both web and mobile.
- **Mobile Functionality:** QR scanner for panels and document bundles, and mobile panel checklists with conditional fields and system-locked templates.
- **Advanced Features:** Panel consolidation, contract retention tracking with automated deductions, and visual document comparison with pixel-level overlay and AI summarization.
- **Landing Page:** A branded landing page for unauthenticated users, routing authenticated users directly to the dashboard.
- **Asset Register:** Comprehensive asset lifecycle management with over 50 fields, supporting more than 40 asset categories, auto-generated asset tags, depreciation tracking, lease/finance management, insurance tracking, maintenance scheduling, transfer history, and AI-powered asset analysis.

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

### Documentation Maintenance Rule
Any code change touching security, auth, validation, or database schema MUST update `AUDIT_STANDARDS.md` (Known Issues Tracker and Verified Fixes Registry). Stale documentation is a risk.