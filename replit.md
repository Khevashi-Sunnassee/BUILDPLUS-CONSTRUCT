# LTE Time Tracking Portal

## Overview
A comprehensive time tracking portal for CAD + Revit time management with standalone authentication (email/password), RBAC roles (USER, MANAGER, ADMIN), Windows Agent API ingestion, daily log management, manager approval workflow, reporting/analytics, and complete admin provisioning system.

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
        projects.tsx      - Project management
        devices.tsx       - Device provisioning
        users.tsx         - User management
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
- **logRows**: Individual time blocks with CAD/Revit metadata
- **approvalEvents**: Approval history trail
- **globalSettings**: System-wide config (timezone, capture interval)

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
- CRUD /api/admin/devices - Device provisioning
- CRUD /api/admin/users - User management

### Agent API
- POST /api/agent/ingest - Windows Agent time block ingestion
  - Header: X-Device-Key
  - Idempotent via sourceEventId

## Melbourne Timezone
All times stored and displayed in Australia/Melbourne timezone.
Daily log dates (logDay) are YYYY-MM-DD strings in Melbourne time.
