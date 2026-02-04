# LTE Performance Management System

## Overview
The LTE Performance Management System is a comprehensive platform designed for CAD and Revit time management. Its core purpose is to streamline operational efficiency, provide insights into production and financial performance, and manage the lifecycle of panel production and delivery. Key capabilities include daily log management, manager approval workflows, reporting, analytics, KPI dashboards, and a logistics system for managing load lists and delivery tracking. The system tracks work against specific jobs and panels.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture with a React-based frontend and an Express.js backend. Data persistence is managed by PostgreSQL through Drizzle ORM. Authentication is standalone using email/password with bcrypt hashing and `express-session`, implementing Role-Based Access Control (RBAC) with USER, MANAGER, and ADMIN roles, augmented by a granular per-user permission system.

**UI/UX Decisions:**
The frontend utilizes React + Vite, TanStack Query, Wouter for routing, `shadcn/ui` for UI components, and Tailwind CSS for styling. It features a KPI Dashboard with selectable date periods, visual charts, and PDF export capabilities. Interactive maps are used for factory location management.

**Technical Implementations & Features:**
- **Authentication & Authorization**: Standalone email/password authentication with bcrypt and `express-session`, RBAC, and admin-configurable per-user permission levels (HIDDEN, VIEW, VIEW_AND_UPDATE) for various functions.
- **Data Ingestion**: Idempotent API endpoint for Windows Agent data ingestion, secured by device key authentication.
- **Time & Approval Management**: Daily log management with submission for approval, manual entry, and manager review/approval workflow.
- **Reporting & Analytics**: Comprehensive reports on time, production, logistics, weekly wages, and cost analysis.
- **Admin Provisioning**: Centralized management for users, jobs, devices, global settings, panel types, and work types.
- **Jobs & Panel Management**: Creation and tracking of jobs, panel registration, production approval workflow, and an estimate import system supporting drag & drop Excel uploads with dynamic parsing and idempotent imports.
- **AI Integration**: AI-powered PDF analysis using OpenAI for extracting panel specifications from shop drawings during production approval.
- **Configurable Rates & Cost Analysis**: Panel types and jobs support configurable rates (supply, install, sell) and track expected costs by component (labor, concrete, steel) with job-level overrides.
- **Production Tracking**: Production reports grouped by date, showing financial metrics and production metrics.
- **Logistics System**: Manages load list creation, trailer assignment, delivery recording, and logistics reporting.
- **Drafting & Procurement Scheduling**: Panel-level drafting scheduling linked to production slots with status tracking and resource assignment. Configurable procurement timing with critical validation to ensure procurement orders are issued after IFC date.
- **Factory Management**: Multi-factory support with location tracking, CFMEU calendar assignment, configurable work days, production beds, and user-specific factory preferences for filtering views.
- **Working Days Calculation**: All date-related calculations (cycle times, production windows) use working days based on factory work schedules and CFMEU calendars, excluding public holidays and RDOs.
- **Chat System**: Teams-style messaging with DM, GROUP, CHANNEL types, @mentions, notifications, file attachments, job/panel linking, and read receipts.

## External Dependencies
- **PostgreSQL**: Primary database.
- **OpenAI**: AI-powered PDF analysis.
- **React**: Frontend framework.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching.
- **Wouter**: Routing library.
- **shadcn/ui**: UI components.
- **Tailwind CSS**: Styling.
- **Express.js**: Backend framework.
- **Drizzle ORM**: PostgreSQL ORM.
- **bcrypt**: Password hashing.
- **express-session**: Session management.

## Coding Standards (MANDATORY - ALL SESSIONS MUST FOLLOW)

### File Size Limits
- **HARD LIMIT**: No file should exceed 500 lines of code
- **SOFT LIMIT**: Start considering splitting at 350 lines
- **WARNING THRESHOLD**: At 400 lines, create new domain-specific file before adding more code
- If adding code would push a file over 400 lines, split FIRST before adding new code

### Backend Architecture Rules

**CRITICAL: Before adding ANY new route or endpoint:**
1. Check the target file's line count with `wc -l filename`
2. If file is over 350 lines, create a new domain-specific file FIRST
3. Never add code to a file that would push it over 400 lines

Routes are split by domain - current structure:
```
server/routes/
├── index.ts                    (router aggregator - imports and mounts all domain routes)
├── auth.routes.ts              (login, logout, session, password)
├── users.routes.ts             (user CRUD, permissions)
├── jobs.routes.ts              (jobs CRUD, job settings, import/export)
│
├── # Panel Management (split from panels.routes.ts)
├── panels.routes.ts            (panel CRUD - base operations only)
├── panel-import.routes.ts      (Excel import, estimate import)
├── panel-approval.routes.ts    (approval workflow, status changes)
├── panel-types.routes.ts       (panel type management)
│
├── # Production Management (split from production.routes.ts)
├── production.routes.ts        (summary, reports, days management)
├── production-entries.routes.ts (production entry CRUD)
├── production-slots.routes.ts  (slot generation, slot management)
│
├── # Reports & Analytics (split from reports.routes.ts)
├── reports.routes.ts           (aggregator - just imports sub-routers)
├── daily-logs.routes.ts        (daily log CRUD, submissions)
├── weekly-reports.routes.ts    (weekly wage reports)
├── production-analytics.routes.ts (KPI, production reports)
├── drafting-logistics.routes.ts   (drafting program, logistics reports)
├── cost-analytics.routes.ts    (cost analysis, job cost breakdowns)
│
├── # Procurement (split from procurement.routes.ts)
├── procurement.routes.ts       (suppliers, categories, items)
├── procurement-orders.routes.ts (purchase orders, attachments)
│
├── drafting.routes.ts          (drafting program scheduling)
├── logistics.routes.ts         (load lists, deliveries, trailers)
├── tasks.routes.ts             (task management)
├── factories.routes.ts         (factories, beds, CFMEU holidays)
├── admin.routes.ts             (admin settings, work types)
├── agent.routes.ts             (Windows agent data ingest)
└── middleware/
    ├── auth.middleware.ts      (requireAuth, requireRole)
    └── permissions.middleware.ts (requirePermission)
```

**When to create a new route file:**
- Adding 5+ new endpoints to a domain
- File would exceed 350 lines
- New subdomain emerges (e.g., panel-import vs panel-approval)

**Route file naming convention:**
- Base domain: `{domain}.routes.ts` (e.g., `panels.routes.ts`)
- Sub-domain: `{domain}-{subdomain}.routes.ts` (e.g., `panel-import.routes.ts`)

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
3. **Consistent error response format**: `{ error: string, code?: string, details?: object }`
4. **All new API endpoints require tests** - At minimum, happy path test
5. **TypeScript strict mode** - No `any` types without justification

### API STABILITY RULES (CRITICAL - PREVENTS DATA DISPLAY ISSUES)

**PROBLEM**: Frontend components using wrong API paths (e.g., `/api/items` instead of `/api/procurement/items`) causes data not to display. This is a critical issue that must be prevented.

**SOLUTION**: Centralized API route constants in `shared/api-routes.ts`

**MANDATORY RULES:**

1. **NEVER hardcode API paths in frontend components**
   ```typescript
   // BAD - Hardcoded path that can mismatch backend
   const { data } = useQuery({ queryKey: ["/api/items"] });
   
   // GOOD - Uses centralized constant
   import { PROCUREMENT_ROUTES } from '@shared/api-routes';
   const { data } = useQuery({ queryKey: [PROCUREMENT_ROUTES.ITEMS] });
   ```

2. **When adding NEW endpoints:**
   - Step 1: Add path to `shared/api-routes.ts` FIRST
   - Step 2: Implement backend route matching that path
   - Step 3: Use the constant in frontend components
   - Step 4: Run `npx tsx scripts/validate-endpoints.ts` to verify

3. **Route prefixes by domain:**
   | Domain | Prefix | Example |
   |--------|--------|---------|
   | Authentication | `/api/auth/` | `/api/auth/login` |
   | Procurement | `/api/procurement/` | `/api/procurement/items` |
   | Admin | `/api/admin/` | `/api/admin/users` |
   | Reports | `/api/reports/` | `/api/reports/production-daily` |
   | Chat | `/api/chat/` | `/api/chat/conversations` |

4. **Before any deployment, run:**
   ```bash
   npx tsx scripts/validate-endpoints.ts
   ```

5. **When moving/renaming routes:**
   - Update `shared/api-routes.ts` FIRST
   - Update backend route file
   - Frontend automatically gets new path via import
   - Run validation script

**REFERENCE FILES:**
- `shared/api-routes.ts` - Single source of truth for all API paths
- `scripts/validate-endpoints.ts` - Validates frontend calls match backend routes

### Database Rules
1. **All tables must have**: `id`, `createdAt`, `updatedAt` fields
2. **Use UUID for all IDs** - varchar(36) with gen_random_uuid()
3. **Use enums for status fields** - Never plain text for statuses
4. **Foreign keys must specify onDelete behavior**
5. **Never change ID column types** - Breaks migrations

### Development Workflow (MUST FOLLOW)

**Before starting any feature:**
```bash
# Check current file sizes in routes
wc -l server/routes/*.ts | sort -n | tail -10

# Check storage.ts size
wc -l server/storage.ts

# Check any page you'll modify
wc -l client/src/pages/target-page/*.tsx
```

**When adding routes to an existing file:**
1. If target file > 350 lines → Create new sub-domain file first
2. If target file > 400 lines → STOP and split before proceeding
3. Add new router to `server/routes/index.ts` with proper import

**File splitting pattern:**
```typescript
// Original: panels.routes.ts (too large)
// Split into:
// - panels.routes.ts (base CRUD)
// - panel-import.routes.ts (import functionality)
// - panel-approval.routes.ts (approval workflow)

// In index.ts:
import { panelsRouter } from "./panels.routes";
import { panelImportRouter } from "./panel-import.routes";
import { panelApprovalRouter } from "./panel-approval.routes";

// Mount all:
app.use(panelsRouter);
app.use(panelImportRouter);
app.use(panelApprovalRouter);
```

### Before Adding New Features Checklist
1. [ ] **Line count check**: Run `wc -l` on files you'll modify - if over 350 lines, split first
2. [ ] Will this push any file over 400 lines? If yes, refactor first
3. [ ] Does the database schema follow all rules?
4. [ ] Is input validation in place?
5. [ ] Are error responses consistent?

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

### Technical Debt Tracking
- [ ] Replace console.log/console.error with Winston/Pino logger
- [ ] Add test coverage for API endpoints
- [ ] Complete repository migration (storage.ts → repositories)