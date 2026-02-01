# LTE Performance Management System

## Overview
A comprehensive performance management system (formerly time tracking portal) for CAD + Revit time management with standalone authentication (email/password), RBAC roles (USER, MANAGER, ADMIN), Windows Agent API ingestion, daily log management, manager approval workflow, reporting/analytics, complete admin provisioning system, Jobs/Panel Register management for tracking work against specific panels, Production Report tracking with unified panel IDs, and a KPI Dashboard with selectable date periods, visual charts, and PDF export for daily performance reporting.

## Demo Accounts
- **Admin**: admin@lte.com.au / admin123
- **Manager**: manager@lte.com.au / manager123  
- **User**: drafter@lte.com.au / user123

## Key Features
- **Standalone Authentication**: Email/password auth with bcrypt hashing and express-session
- **RBAC Roles**: USER (drafters), MANAGER (can approve), ADMIN (full access)
- **Windows Agent API**: Idempotent ingestion via `POST /api/agent/ingest` with device key auth
- **Daily Log Management**: View, edit, submit for approval
- **Manager Approval**: Review submitted logs, approve/reject with comments
- **Reports & Analytics**: Time by user, project, app with charts
- **Admin Provisioning**: Manage users, projects, devices, global settings
- **Manual Time Entry**: Log time manually when the Autodesk add-ins are not available, with option to add new panels to the register on-the-fly
- **KPI Dashboard**: Comprehensive performance dashboard with selectable date periods, production/financial/drafting/cost-breakup charts, work type analytics (rework metrics, distribution pie chart, panel time breakdown), and PDF export
- **Cost Breakup**: Track expected costs by component (labour, concrete, steel, etc.) as percentages of revenue per panel type, with job-level overrides, component filter dropdown for detailed daily breakdown, and interactive summary tables with click-to-filter functionality
- **Jobs Management**: Create jobs, import from Excel, track status (ACTIVE/ON_HOLD/COMPLETED/ARCHIVED), with cost overrides dialog for customized job-specific cost ratios
- **Panel Register**: Track panels with dynamic panel types from database, estimated hours, actual hours logged, Excel import/export
- **Configurable Panel Types**: Admin-managed panel types with configurable rates (labour cost, supply cost, sell rate per m²/m³)
- **Project Rate Overrides**: Override default panel type rates at project level for custom pricing
- **Production Report**: Track production work with volume (m³) and area (m²), daily cost/revenue/profit calculations using panel type rates
- **Work Types**: Categorize drafting work by type (General Drafting, Client Changes, Errors/Redrafting) for both manual entries and CAD/Revit addin data

## Tech Stack
- **Frontend**: React + Vite, TanStack Query, Wouter, shadcn/ui, Tailwind CSS
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Auth**: bcrypt + express-session (standalone, no Replit Auth)

## Project Structure
```
client/
  src/
    pages/
      login.tsx           - Login page
      dashboard.tsx       - User dashboard
      daily-reports.tsx   - Daily log list
      daily-report-detail.tsx - Log editor
      manager-review.tsx  - Manager approval queue
      reports.tsx         - Analytics & charts
      admin/
        settings.tsx      - Global settings
        projects.tsx      - Project management (with panel rates dialog)
        jobs.tsx          - Jobs management
        panels.tsx        - Panel register
        panel-types.tsx   - Panel type configuration with rates
        devices.tsx       - Device provisioning
        users.tsx         - User management
      manual-entry.tsx    - Manual time entry form
      production-report.tsx - Production tracking with volume/area and cost calculations
      kpi-dashboard.tsx   - KPI Dashboard with charts and PDF export
    components/
      layout/sidebar.tsx  - App sidebar
      theme-toggle.tsx    - Dark mode toggle
    lib/
      auth.tsx            - Auth context
      theme.tsx           - Theme context
server/
  index.ts              - Express server entry
  routes.ts             - All API routes
  storage.ts            - Database operations
  db.ts                 - Drizzle + PostgreSQL connection
  seed.ts               - Demo data seeding
shared/
  schema.ts             - Drizzle schema + Zod validators
```

## Database Schema
- **users**: Email/password auth, roles (USER/MANAGER/ADMIN)
- **devices**: Windows Agent devices with hashed API keys
- **projects**: Project metadata (name, code, client, address)
- **mappingRules**: File path to project auto-mapping
- **dailyLogs**: Per-user per-day log containers
- **logRows**: Individual time blocks with CAD/Revit metadata, linked to jobs/panels
- **approvalEvents**: Approval history trail
- **globalSettings**: System-wide config (timezone, capture interval)
- **jobs**: Job metadata (jobNumber, name, client, address, status)
- **panelRegister**: Panel tracking (jobId, panelMark, panelType, estimatedHours, actualHours, status)
- **productionEntries**: Production work entries (panelId, jobId, userId, productionDate, volumeM3, areaM2)
- **panelTypes**: Configurable panel types with rates (code, name, labourCostPerM2/M3, supplyCostPerM2/M3, sellRatePerM2/M3)
- **projectPanelRates**: Project-level rate overrides for specific panel types
- **panelTypeCostComponents**: Cost component percentages per panel type (name, percentageOfRevenue)
- **jobCostOverrides**: Job-level cost component overrides (defaultPercentage, revisedPercentage, notes)
- **workTypes**: Work type categorization (code, name, description, sortOrder) - GENERAL, CLIENT_CHANGE, ERROR_REWORK

## API Endpoints
### Auth
- POST /api/auth/login - Login with email/password
- POST /api/auth/logout - Logout
- GET /api/auth/me - Current user

### User Routes
- GET /api/dashboard/stats - Dashboard statistics
- GET /api/daily-logs - List user's logs
- GET /api/daily-logs/:id - Log detail
- POST /api/daily-logs/:id/submit - Submit for approval
- PATCH /api/log-rows/:id - Edit log row
- GET /api/reports - Analytics data

### Manager Routes
- GET /api/daily-logs/submitted - Pending approvals
- POST /api/daily-logs/:id/approve - Approve/reject

### Admin Routes
- GET/PUT /api/admin/settings - Global settings
- CRUD /api/admin/projects - Project management
- CRUD /api/admin/jobs - Jobs management (with Excel import)
- CRUD /api/admin/panels - Panel register management (with Excel import)
- CRUD /api/admin/devices - Device provisioning
- CRUD /api/admin/users - User management

### Production Routes
- GET /api/production-entries - List production entries (optional ?date=YYYY-MM-DD filter)
- GET /api/production-entries/:id - Get production entry details
- POST /api/production-entries - Create production entry
- PUT /api/production-entries/:id - Update production entry
- DELETE /api/production-entries/:id - Delete production entry
- GET /api/production-summary - Get summary by panel type for a date
- GET /api/production-summary-with-costs - Get entries with calculated costs/revenue/profit

### Panel Types Routes
- GET /api/panel-types - List active panel types (for dropdowns)
- GET /api/admin/panel-types - List all panel types (admin)
- POST /api/admin/panel-types - Create panel type
- PUT /api/admin/panel-types/:id - Update panel type
- DELETE /api/admin/panel-types/:id - Delete panel type
- GET /api/projects/:projectId/panel-rates - Get effective rates for project
- PUT /api/projects/:projectId/panel-rates/:panelTypeId - Set project rate override

### KPI Dashboard Routes
- GET /api/reports/production-daily - Daily production data with panel counts and volumes
  - Query params: startDate, endDate (YYYY-MM-DD format)
  - Returns: dailyData array, totals, panelTypes used, period
- GET /api/reports/drafting-daily - Daily drafting time breakdown
  - Query params: startDate, endDate
  - Uses batch query optimization (2 DB queries for all data)
  - Returns: dailyData with byUser/byApp/byProject breakdowns
- GET /api/reports/production-with-costs - Production data with cost/revenue/profit calculations
  - Query params: startDate, endDate
  - Returns: dailyData with financial metrics, totals, panelTypes

### Cost Breakup Routes
- GET /api/panel-types/:panelTypeId/cost-components - Get cost components for a panel type
- POST /api/panel-types/:panelTypeId/cost-components - Add cost component (validates sum <= 100%)
- PUT /api/cost-components/:id - Update cost component
- DELETE /api/cost-components/:id - Delete cost component
- GET /api/jobs/:jobId/cost-overrides - Get job cost overrides
- POST /api/jobs/:jobId/cost-overrides/initialize - Initialize overrides from panel type defaults
- PUT /api/cost-overrides/:id - Update job cost override
- GET /api/reports/cost-analysis - Calculate expected costs by component
  - Query params: startDate, endDate, jobId (optional)
  - Returns: totalRevenue, totalExpectedCost, expectedProfit, profitMargin, componentBreakdown
- GET /api/reports/cost-analysis-daily - Daily cost breakdown by component
  - Query params: startDate, endDate
  - Returns: dailyData array with date, revenue, totalCost, profit, entryCount, and per-component costs; componentNames array; totals with byComponent breakdown

### Work Types Routes
- GET /api/work-types - List active work types (for dropdowns)
- GET /api/admin/work-types - List all work types (admin)
- POST /api/admin/work-types - Create work type
- PUT /api/admin/work-types/:id - Update work type
- DELETE /api/admin/work-types/:id - Delete work type

### Agent API
- POST /api/agent/ingest - Windows Agent time block ingestion
  - Header: X-Device-Key
  - Idempotent via sourceEventId

## Melbourne Timezone
All times stored and displayed in Australia/Melbourne timezone.
Daily log dates (logDay) are YYYY-MM-DD strings in Melbourne time.
