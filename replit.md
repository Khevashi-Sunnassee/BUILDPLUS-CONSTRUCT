# LTE Performance Management System

## Overview
The LTE Performance Management System is a comprehensive platform designed for CAD and Revit time management. It provides tools for daily log management, manager approval workflows, reporting, and analytics. The system tracks work against specific jobs and panels, offers a KPI dashboard for performance monitoring, and includes a logistics system for managing load lists and delivery tracking. Its core purpose is to streamline operational efficiency, provide insights into production and financial performance, and manage the lifecycle of panel production and delivery.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture with a React-based frontend and an Express.js backend. Data persistence is managed by PostgreSQL through Drizzle ORM. Authentication is standalone using email/password with bcrypt hashing and `express-session`, implementing Role-Based Access Control (RBAC) with USER, MANAGER, and ADMIN roles.

**UI/UX Decisions:**
The frontend utilizes React + Vite, TanStack Query, Wouter for routing, `shadcn/ui` for UI components, and Tailwind CSS for styling. It features a KPI Dashboard with selectable date periods, visual charts, and PDF export capabilities.

**Technical Implementations & Features:**
- **Authentication**: Standalone email/password authentication with bcrypt and `express-session`.
- **Authorization**: RBAC roles (USER, MANAGER, ADMIN) combined with granular per-user permission system.
- **User Permissions System**: Admin-configurable permission levels (HIDDEN, VIEW, VIEW_AND_UPDATE) for each function per user. Functions include drafting_register (daily_reports), production_schedule (production_report), logistics, weekly_wages, kpi_dashboard, jobs, panel_register, and various admin sections. Sidebar navigation respects permissions, and API routes enforce access levels.
- **Data Ingestion**: Idempotent API endpoint (`POST /api/agent/ingest`) for Windows Agent data ingestion, secured by device key authentication.
- **Time Management**: Daily log management with viewing, editing, and submission for approval. Includes manual time entry with on-the-fly panel registration and automatic start time defaulting.
- **Approval Workflow**: Managers can review, approve, or reject submitted logs with comments.
- **Reporting & Analytics**: Comprehensive reports on time by user, job, and application.
- **Admin Provisioning**: Centralized management for users, jobs, devices, global settings, panel types, and work types.
- **Jobs & Panel Management**: Creation and tracking of jobs (with Excel import/export), panel registration with dynamic types, estimated/actual hours, and a production approval workflow.
- **Estimate Import System**: Drag & drop Excel file upload for importing panels from estimate TakeOff sheets. Features include dynamic sheet detection, header row parsing, column mapping, idempotent import using panelSourceId hash, and PENDING status for validation workflow. Imported panels can be validated before use in drafting.
- **AI Integration**: AI-powered PDF analysis using OpenAI for extracting panel specifications from shop drawings during the production approval process.
- **Configurable Rates**: Panel types are configurable with rates (supply cost, install cost, sell rate) and expected weight. Job-specific rate overrides are supported.
- **Production Tracking**: Production reports grouped by date, showing summaries of panels, volume, area, financial metrics (cost, revenue, profit, margin), with edit/delete functionality.
- **Cost Analysis**: Tracks expected costs by component (labor, concrete, steel) as percentages of revenue, with job-level overrides and detailed daily breakdowns.
- **Work Type Categorization**: Allows categorization of drafting work (General Drafting, Client Changes, Errors/Redrafting) for both manual and automated entries.
- **Logistics System**: Manages load list creation, assignment of trailer types, and comprehensive delivery recording including driver times and truck information. Load lists automatically complete upon delivery recording.
- **Logistics Reporting**: Provides reports on panels shipped, total deliveries, and average delivery phase timings.
- **Weekly Wage Reports**: Tracks weekly payroll costs across various categories and compares actual wages against estimated wages based on production revenue.
- **Timezone Management**: All times are stored and displayed in the Australia/Melbourne timezone.
- **Drafting Program**: Panel-level drafting scheduling system that links to production slots. Calculates Drawing Due Date (Production Date - IFC Days in Advance) and Drafting Window Start (Drawing Due Date - Days to Achieve IFC). Features resource assignment with proposed start dates, status tracking (NOT_SCHEDULED, SCHEDULED, IN_PROGRESS, COMPLETED, ON_HOLD), and grouping by job/level/week/assignee. Settings configurable: IFC Days in Advance (default 14), Days to Achieve IFC (default 21).
- **Procurement Scheduling**: Configurable procurement timing with two settings: Procurement Days in Advance (default 7) and Procurement Time Days (default 14). Available at both global (Admin Settings) and job-specific levels. Critical validation: Procurement Days in Advance must be less than IFC Days in Advance, ensuring procurement orders are issued after IFC date is achieved. Both UI and server-side validation enforce this constraint.
- **Level-Specific Cycle Times**: Per-level production cycle time configuration allowing different cycle days for each building/level combination. Accessible via clock icon in job register. Automatically builds levels from registered panels and uses level-specific times when generating production slots (falls back to job default if not configured).
- **Chat System**: Teams-style messaging with conversations (DM, GROUP, CHANNEL types). Features include @mentions with notification system, file attachments (up to 10 files per message stored at /uploads/chat), optional job/panel linking for context, read receipts, and per-user notification settings. Uses session-based authentication and respects "chat" permission from userPermissions table.
- **Factory Management**: Multi-factory support with location tracking. Factories include: name, unique code, address, Australian state (VIC/NSW/QLD/etc), GPS coordinates (lat/long), CFMEU calendar assignment (VIC_ONSITE, VIC_OFFSITE, QLD), configurable work days (boolean array for Sun-Sat), color coding, and active status. Each factory can have multiple production beds with dimensions (length/width in mm). Admin UI includes an interactive map (Leaflet/OpenStreetMap) showing factory locations with click-to-set coordinates. Tables (dailyLogs, productionEntries, productionDays, loadLists, weeklyWageReports) now have factoryId foreign key columns referencing factories.id for proper factory linking (legacy factory text fields retained for backward compatibility).
- **User Factory Preferences**: Users can select which factories to view via settings in the header. The selectedFactoryIds field on the user record filters production slots, drafting program, and other factory-dependent views. Empty selection shows all factories. Factory badges display with their configured colors across the UI.
- **Working Days Calculation**: All day values (cycle times, days in advance, production windows) are calculated as WORKING DAYS, not calendar days. Production slots use the assigned factory's work schedule (Mon-Fri by default) combined with the factory's CFMEU calendar (if configured) to exclude public holidays and RDOs. If no CFMEU calendar is selected at the factory level, only the factory's work days are used (weekends excluded). Drafting program uses global drafting work days from settings (no CFMEU calendar integration). Jobs can now be assigned to a factory for production scheduling purposes.

## External Dependencies
- **PostgreSQL**: Primary database for data storage.
- **OpenAI**: Utilized for AI-powered PDF analysis to extract panel specifications.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching and caching library.
- **Wouter**: React routing library.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Express.js**: Backend web application framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **bcrypt**: Library for hashing passwords.
- **express-session**: Middleware for managing user sessions.

## Coding Standards (MANDATORY - ALL SESSIONS MUST FOLLOW)

### File Size Limits
- **HARD LIMIT**: No file should exceed 500 lines of code
- **SOFT LIMIT**: Start considering splitting at 400 lines
- If adding code would push a file over 500 lines, refactor FIRST before adding new code

### Backend Architecture Rules
Routes must be split by domain:
```
server/routes/
├── index.ts              (router aggregator - imports and mounts all domain routes)
├── auth.routes.ts        (login, logout, session, password)
├── users.routes.ts       (user CRUD, permissions)
├── jobs.routes.ts        (jobs CRUD, job settings, import/export)
├── panels.routes.ts      (panel register, approval workflow)
├── production.routes.ts  (slots, entries, days, scheduling)
├── drafting.routes.ts    (drafting program)
├── logistics.routes.ts   (load lists, deliveries, trailers)
├── reports.routes.ts     (KPI, weekly wages, analytics)
├── procurement.routes.ts (purchase orders, items, suppliers)
├── tasks.routes.ts       (task management)
├── factories.routes.ts   (factories, beds, CFMEU holidays)
├── settings.routes.ts    (global settings)
├── agent.routes.ts       (Windows agent data ingest)
└── middleware/
    ├── auth.middleware.ts      (requireAuth, requireRole)
    └── permissions.middleware.ts (requirePermission)
```

Storage/Repositories must be split by domain:
```
server/repositories/
├── index.ts
├── user.repository.ts
├── job.repository.ts
├── panel.repository.ts
├── production.repository.ts
├── logistics.repository.ts
├── procurement.repository.ts
├── task.repository.ts
└── factory.repository.ts
```

### Frontend Architecture Rules
- Page components exceeding 500 lines must be split into sub-components
- Extract reusable logic into custom hooks in a `hooks/` folder
- Extract complex UI sections into separate component files
- Structure for large features:
```
client/src/pages/feature-name/
├── index.tsx           (main page - orchestrator only)
├── FeatureTable.tsx    (data display)
├── FeatureForm.tsx     (create/edit forms)
├── FeatureFilters.tsx  (filter controls)
├── FeatureDialogs.tsx  (modals/dialogs)
└── hooks/
    └── useFeatureData.ts
```

### Code Quality Rules
1. **No console.log in production code** - Use proper logger (Winston/Pino)
2. **All API endpoints must have input validation** - Use Zod schemas
3. **Consistent error response format**:
   ```typescript
   { error: string, code?: string, details?: object }
   ```
4. **All new API endpoints require tests** - At minimum, happy path test
5. **TypeScript strict mode** - No `any` types without justification

### Database Rules
1. **All tables must have**: `id`, `createdAt`, `updatedAt` fields
2. **Use UUID for all IDs** - varchar(36) with gen_random_uuid()
3. **Use enums for status fields** - Never plain text for statuses
4. **Foreign keys must specify onDelete behavior**
5. **Never change ID column types** - Breaks migrations

### Before Adding New Features Checklist
1. [ ] Will this push any file over 500 lines? If yes, refactor first
2. [ ] Does the database schema follow all rules?
3. [ ] Is input validation in place?
4. [ ] Are error responses consistent?
5. [ ] Is there a test for the happy path?

### Security Requirements
1. All endpoints behind authentication (except /api/auth/*)
2. Rate limiting on auth endpoints
3. Input sanitization for user-provided content
4. File upload size limits (max 10MB)
5. File type validation for uploads

### Naming Conventions
- **Routes**: kebab-case URLs (`/api/panel-types`)
- **Files**: kebab-case (`panel-types.routes.ts`)
- **Functions**: camelCase (`getPanelTypes`)
- **Types/Interfaces**: PascalCase (`PanelType`)
- **Database tables**: camelCase (`panelTypes`)
- **Database columns**: camelCase (`createdAt`)