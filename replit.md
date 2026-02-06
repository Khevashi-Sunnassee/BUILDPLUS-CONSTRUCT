# LTE Performance Management System

## Overview
The LTE Performance Management System is a comprehensive platform designed to streamline operational efficiency in CAD and Revit time management. It provides insights into production and financial performance, and manages the lifecycle of panel production and delivery. The system includes daily log management, manager approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load lists and delivery tracking. Its primary purpose is to optimize panel production and delivery processes, offering a robust tool for decision-making and operational control in the construction and manufacturing sectors.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture. The frontend is developed using React + Vite, while the backend is built with Express.js. PostgreSQL is used as the primary database, managed by Drizzle ORM. User authentication utilizes email/password with bcrypt hashing and `express-session`, featuring Role-Based Access Control (RBAC) with USER, MANAGER, and ADMIN roles, augmented by a granular per-user permission system (HIDDEN, VIEW, VIEW_AND_UPDATE).

**UI/UX Decisions:**
The frontend leverages TanStack Query for data fetching, Wouter for routing, `shadcn/ui` for components, and Tailwind CSS for styling. It includes a KPI Dashboard with selectable date ranges, visual charts, and PDF export. Interactive maps are integrated for factory location management.

**Technical Implementations & Features:**
- **Time & Approval Management**: Daily log entries, approval workflows, and real-time drafting time tracking.
- **Reporting & Analytics**: Comprehensive reports covering time, production, logistics, wages, and cost analysis.
- **Admin Provisioning**: Centralized management for users, jobs, customers, devices, global settings, panel types, and work types.
- **Customer Management**: Full CRUD for customer companies with contact details, ABN/ACN, address, payment terms. Customers are linked to jobs via customerId foreign key, with a quick-add dialog in the job form for inline customer creation.
- **Jobs & Panel Management**: Creation and tracking of jobs with customer linking, panel registration, production approval workflows, estimate import with Excel parsing, and detailed panel field management (reinforcement, concrete, lifters, dowels, plates, inserts).
- **AI Integration**: OpenAI-powered PDF analysis for extracting panel specifications from shop drawings.
- **Configurable Rates & Cost Analysis**: Job and panel-level configurable rates (supply, install, sell) and cost tracking by component (labor, concrete, steel).
- **Production Tracking**: Production reports grouped by date, including financial and production metrics.
- **Logistics System**: Load list creation, trailer assignment, and delivery recording.
- **Drafting & Procurement Scheduling**: Panel-level drafting scheduling linked to production slots and configurable procurement timing with validation.
- **Factory Management**: Multi-factory support with location tracking, CFMEU calendar assignment, configurable work days, production beds, and user-specific factory preferences. Date calculations are based on working days, excluding public holidays.
- **Chat System**: Teams-style messaging with DM, GROUP, CHANNEL types, @mentions, notifications, file attachments, job/panel linking, and read receipts.
- **Document Management System**: Comprehensive document register with file upload/download via Replit Object Storage, version control, document bundles with QR code access, entity linking (jobs, panels, suppliers, purchase orders, tasks), and configurable document types/disciplines/categories.
- **Advanced Templates System**: Dynamic, reusable checklist templates with JSONB storage for flexible sections and fields. Features include an admin builder with drag-and-drop field palette (20+ field types), a checklist form renderer with validation, and reports with multi-dimensional filtering and CSV export.

## Mobile UI Standards
All mobile pages live under `client/src/pages/mobile/` and follow these strict conventions:

**Design Tokens:**
- Main background: `bg-[#070B12]`
- Sheet/bottom nav background: `bg-[#0D1117]`
- Card background: `bg-white/5`
- Border color: `border-white/10`
- Primary text: `text-white`
- Secondary text: `text-white/60`
- Muted text: `text-white/40`
- Active accent: `text-blue-400`

**Layout Pattern (every mobile page):**
```
<div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
  {/* Sticky header with safe-area-inset */}
  <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
       style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
    <div className="px-4 py-4">...</div>
  </div>
  {/* Scrollable content with bottom padding for nav */}
  <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">...</div>
  <MobileBottomNav />
</div>
```

**Coding Rules:**
- Target: iPhone 14+ (390px min width)
- Bottom nav height: 64px (`h-16`), content needs `pb-24` clearance
- All interactive items use `active:scale-[0.99]` for press feedback
- Cards: `rounded-2xl border border-white/10 bg-white/5 px-4`
- Menu items: 66px height (`h-[66px]`) with 44px icon containers
- Toast policy: NO success/confirmation toasts on mobile. Only error (destructive) toasts are shown.
- Use `data-testid` attributes on all interactive and display elements
- Import `MobileBottomNav` from `@/components/mobile/MobileBottomNav`
- Mobile pages are standalone (no sidebar, no AuthenticatedLayout)
- Mobile routes must not interfere with desktop routes
- All data fetching uses existing API routes from `@shared/api-routes`

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