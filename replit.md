# LTE Performance Management System

## Overview
The LTE Performance Management System is a comprehensive platform for CAD and Revit time management, aiming to streamline operational efficiency. It provides insights into production and financial performance, and manages the lifecycle of panel production and delivery. Key capabilities include daily log management, manager approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load lists and delivery tracking, all tied to specific jobs and panels. The project's ambition is to optimize panel production and delivery processes, offering a robust tool for decision-making and operational control in the construction and manufacturing sectors.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is built with React, while the backend is powered by Express.js. PostgreSQL serves as the primary database, managed through Drizzle ORM. Authentication is handled via email/password with bcrypt hashing and `express-session`, incorporating Role-Based Access Control (RBAC) with USER, MANAGER, and ADMIN roles, further refined by a granular per-user permission system.

**UI/UX Decisions:**
The frontend uses React + Vite, TanStack Query for data fetching, Wouter for routing, `shadcn/ui` for components, and Tailwind CSS for styling. It features a KPI Dashboard with selectable date ranges, visual charts, and PDF export. Interactive maps are used for factory location management.

**Technical Implementations & Features:**
- **Authentication & Authorization**: Standalone email/password auth, RBAC (USER, MANAGER, ADMIN roles), and configurable per-user permissions (HIDDEN, VIEW, VIEW_AND_UPDATE).
- **Data Ingestion**: Idempotent API for Windows Agent data, secured by device key.
- **Time & Approval Management**: Daily log entries, submission for approval, manual entry, and manager review.
- **Reporting & Analytics**: Comprehensive reports covering time, production, logistics, wages, and cost analysis.
- **Admin Provisioning**: Centralized management for users, jobs, devices, global settings, panel types, and work types.
- **Jobs & Panel Management**: Creation and tracking of jobs, panel registration, production approval workflow, and an estimate import system supporting drag & drop Excel uploads with dynamic parsing.
- **AI Integration**: OpenAI-powered PDF analysis for extracting panel specifications from shop drawings during production approval.
- **Configurable Rates & Cost Analysis**: Panel types and jobs support configurable rates (supply, install, sell) and track expected costs by component (labor, concrete, steel) with job-level overrides.
- **Production Tracking**: Production reports grouped by date, including financial and production metrics.
- **Logistics System**: Manages load list creation, trailer assignment, and delivery recording.
- **Drafting & Procurement Scheduling**: Panel-level drafting scheduling linked to production slots with status tracking. Configurable procurement timing with critical validation.
- **Factory Management**: Multi-factory support with location tracking, CFMEU calendar assignment, configurable work days, production beds, and user-specific factory preferences.
- **Working Days Calculation**: All date-related calculations use working days based on factory schedules and CFMEU calendars, excluding public holidays.
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

## Coding Standards

### API Route Constants (CRITICAL)
All API endpoints MUST use centralized route constants from `shared/api-routes.ts`. This prevents frontend/backend endpoint mismatches.

**Frontend Usage:**
```typescript
import { ADMIN_ROUTES, PANELS_ROUTES, CHAT_ROUTES } from "@shared/api-routes";

// Using route constants
queryKey: [ADMIN_ROUTES.PANELS]
apiRequest("POST", CHAT_ROUTES.MESSAGES(conversationId), data)
```

**Route Naming Patterns:**
| Pattern | Use Case | Example |
|---------|----------|---------|
| `/api/{resource}` | Public/authenticated access | `/api/panels` |
| `/api/{resource}/admin` | Admin CRUD on resources | `/api/panels/admin` |
| `/api/admin/{resource}` | Admin-only resources | `/api/admin/users` |
| `/api/{resource}/{id}/{action}` | Resource actions | `/api/panels/:id/approve-production` |

**Key Route Groups:**
- `ADMIN_ROUTES.PANELS` = `/api/panels/admin` (admin panel management)
- `PANELS_ROUTES.LIST` = `/api/panels` (general panel access)
- `CHAT_ROUTES.MESSAGES(id)` = `/api/chat/conversations/:id/messages`
- `CHAT_ROUTES.PANEL_CONVERSATION(panelId)` = `/api/chat/panels/:panelId/conversation`

### Frontend Conventions
- Use TanStack Query with proper `queryKey` arrays for cache management
- Use `apiRequest` from `@/lib/queryClient` for mutations
- Always invalidate related queries after mutations
- Use route constants, never hardcode API paths

### Backend Conventions
- Use `requireAuth` middleware for authenticated routes
- Use `requireRole("ADMIN", "MANAGER")` for role-based access
- Use `requirePermission("feature_key", "VIEW_AND_UPDATE")` for permission-based access
- Use the `logger` from `server/lib/logger` instead of `console.log`

### Project Structure
```
client/src/
├── components/      # Reusable UI components
├── pages/           # Route components
│   └── admin/       # Admin-only pages
├── lib/             # Utilities and hooks
└── hooks/           # Custom React hooks

server/
├── routes/          # API route handlers
├── chat/            # Chat-specific routes and utilities
├── storage.ts       # Database operations interface
└── lib/             # Utilities including logger

shared/
├── api-routes.ts    # Centralized route constants (CRITICAL)
└── schema.ts        # Drizzle schema and types
```