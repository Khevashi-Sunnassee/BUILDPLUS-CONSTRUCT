# LTE Performance Management System

## Overview
A comprehensive performance management system (formerly time tracking portal) for CAD + Revit time management with standalone authentication (email/password), RBAC roles (USER, MANAGER, ADMIN), Windows Agent API ingestion, daily log management, manager approval workflow, reporting/analytics, complete admin provisioning system, Jobs/Panel Register management for tracking work against specific panels, Production Report tracking with unified panel IDs, KPI Dashboard with selectable date periods, visual charts, and PDF export for daily performance reporting, and a complete Logistics system for load list creation, panel selection, and delivery tracking with driver times and truck information.

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
- **Reports & Analytics**: Time by user, job, app with charts
- **Admin Provisioning**: Manage users, jobs, devices, global settings
- **Manual Time Entry**: Log time manually when the Autodesk add-ins are not available, with option to add new panels to the register on-the-fly. Automatically defaults start time to the latest end time from existing entries for the selected date, enabling seamless continuation of work tracking. Manual Entry is accessed via the "Add Entry" button on Daily Report detail pages (not in sidebar).
- **KPI Dashboard**: Comprehensive performance dashboard with selectable date periods, production/financial/drafting/cost-breakup charts, work type analytics (rework metrics, distribution pie chart, panel time breakdown), and PDF export
- **Cost Breakup**: Track expected costs by component (labour, concrete, steel, etc.) as percentages of revenue per panel type, with job-level overrides, component filter dropdown for detailed daily breakdown, and interactive summary tables with click-to-filter functionality
- **Jobs Management**: Create jobs, import from Excel, track status (ACTIVE/ON_HOLD/COMPLETED/ARCHIVED), with cost overrides dialog for customized job-specific cost ratios
- **Panel Register**: Track panels with dynamic panel types from database, estimated hours, actual hours logged, Excel import/export, and panel production approval workflow
- **Panel Production Approval**: "Build" dialog for entering panel specifications (load dimensions, volume, mass, area, concrete strength), AI-powered PDF analysis using OpenAI to extract specs from shop drawings, and approval workflow - only approved panels can have production entries
- **Configurable Panel Types**: Admin-managed panel types with configurable rates (supply cost, install cost, sell rate per m²/m³) and expected weight per m³ (default 2500kg) for load list calculations
- **Job Rate Overrides**: Override default panel type rates at job level for custom pricing
- **Production Report**: List view showing production reports grouped by date with status indicators, click into date to view/add entries. Detail view shows summary cards (panels, volume, area, panel types), financial cards (cost, revenue, profit, margin), and entry table with edit/delete actions. Supports date range filtering (week/month/quarter/all).
- **Work Types**: Categorize drafting work by type (General Drafting, Client Changes, Errors/Redrafting) for both manual entries and CAD/Revit addin data
- **Logistics System**: Create load lists by selecting approved panels, assign trailer types (Layover, A-Frame), comprehensive delivery recording with: load document #, truck/trailer rego, date, preload info, load number, panel count, full time tracking (depot to LTE, pickup location times, holding times, unloading first/last lift, return depot), and comments. Load lists auto-complete when delivery is recorded.
- **Logistics Reporting**: Reports page includes Logistics tab showing panels shipped per day, total deliveries, and average delivery phase timings (Depot to LTE, Pickup Time, Holding Time, Unload Time).

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
        jobs.tsx          - Jobs management
        panels.tsx        - Panel register
        panel-types.tsx   - Panel type configuration with rates
        devices.tsx       - Device provisioning
        users.tsx         - User management
      manual-entry.tsx    - Manual time entry form (accessed from Daily Report detail page)
      production-report.tsx - Production reports list view grouped by date
      production-report-detail.tsx - Production report detail view for specific date
      kpi-dashboard.tsx   - KPI Dashboard with charts and PDF export
      logistics.tsx       - Load list management and delivery tracking
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
- **jobs**: Job metadata (jobNumber, name, code, client, address, status, siteContact, siteContactPhone) - consolidated from former projects table
- **mappingRules**: File path to job auto-mapping
- **dailyLogs**: Per-user per-day log containers
- **logRows**: Individual time blocks with CAD/Revit metadata, linked to jobs/panels
- **approvalEvents**: Approval history trail
- **globalSettings**: System-wide config (timezone, capture interval)
- **panelRegister**: Panel tracking (jobId, panelMark, panelType, estimatedHours, actualHours, status, loadWidth, loadHeight, panelThickness, panelVolume, panelMass, panelArea, day28Fc, liftFcm, rotationalLifters, primaryLifters, productionPdfUrl, approvedForProduction, approvedAt, approvedById)
- **trailerTypes**: Trailer type configuration (code, name, description, sortOrder, isActive) - LAYOVER, A_FRAME
- **loadLists**: Load list containers (jobId, trailerTypeId, docketNumber, scheduledDate, notes, status, createdById)
- **loadListPanels**: Junction table linking panels to load lists with sequence ordering
- **deliveryRecords**: Delivery tracking (loadListId, truckRego, driverName, departedFactoryAt, arrivedSiteAt, departedSiteAt, notes, enteredById)
- **productionEntries**: Production work entries (panelId, jobId, userId, productionDate, volumeM3, areaM2)
- **panelTypes**: Configurable panel types with rates (code, name, labourCostPerM2/M3, supplyCostPerM2/M3, sellRatePerM2/M3)
- **jobPanelRates**: Job-level rate overrides for specific panel types
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
- CRUD /api/admin/jobs - Jobs management (with Excel import)
- CRUD /api/admin/panels - Panel register management (with Excel import)
- POST /api/admin/panels/:id/analyze-pdf - AI-powered PDF analysis for panel specs
- POST /api/admin/panels/:id/approve-production - Approve panel for production
- POST /api/admin/panels/:id/revoke-production - Revoke production approval
- GET /api/panels/approved-for-production - Get approved panels (optional ?jobId filter)
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
- GET /api/jobs/:jobId/panel-rates - Get effective rates for job
- PUT /api/jobs/:jobId/panel-rates/:panelTypeId - Set job rate override

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

### Logistics Routes
- GET /api/trailer-types - List active trailer types (for dropdowns)
- GET /api/admin/trailer-types - List all trailer types (admin)
- POST /api/admin/trailer-types - Create trailer type
- PUT /api/admin/trailer-types/:id - Update trailer type
- DELETE /api/admin/trailer-types/:id - Delete trailer type
- GET /api/load-lists - List all load lists with full details
- GET /api/load-lists/:id - Get load list with panels and delivery record
- POST /api/load-lists - Create load list with panel assignments
- PUT /api/load-lists/:id - Update load list
- DELETE /api/load-lists/:id - Delete load list (ADMIN/MANAGER only)
- POST /api/load-lists/:id/panels - Add panel to load list
- DELETE /api/load-lists/:id/panels/:panelId - Remove panel from load list
- GET /api/load-lists/:id/delivery - Get delivery record for load list
- POST /api/load-lists/:id/delivery - Create delivery record (auto-completes load list)
- PUT /api/delivery-records/:id - Update delivery record
- GET /api/reports/logistics - Logistics reporting with panels shipped per day and phase timings
  - Query params: startDate, endDate (YYYY-MM-DD format)
  - Returns: dailyData (date, panelCount, loadListCount), totals (totalPanels, totalLoadLists, avgPanelsPerDay), phaseAverages (depotToLte, pickupTime, holdingTime, unloadTime)

### Agent API
- POST /api/agent/ingest - Windows Agent time block ingestion
  - Header: X-Device-Key
  - Idempotent via sourceEventId

## Melbourne Timezone
All times stored and displayed in Australia/Melbourne timezone.
Daily log dates (logDay) are YYYY-MM-DD strings in Melbourne time.
