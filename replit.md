# BuildPlus Ai Management System

## Overview
The BuildPlus Ai Management System optimizes panel production and delivery for the construction and manufacturing industries. It manages the entire panel production lifecycle, from CAD/Revit time management to delivery tracking. Key features include daily log management, approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load list creation and delivery management. The system aims to enhance operational control, improve production efficiency, and support robust decision-making.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system uses a client-server architecture. The frontend is built with React + Vite, utilizing TanStack Query, Wouter, `shadcn/ui`, and Tailwind CSS. The backend uses Express.js with PostgreSQL and Drizzle ORM. Authentication is handled via email/password using bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**UI/UX Decisions:**
The frontend features a KPI Dashboard with data visualization, PDF export, and interactive maps. Mobile pages adhere to specific design tokens and layout patterns for consistent user experience.

**Technical Implementations & Features:**
- **Core Management:** Time and approval management, reporting, analytics, and administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** CRUD operations for customer/job management, panel registration, production approval workflows, estimate import, and detailed panel field management. Panels have a 14-stage lifecycle with audit logging; jobs have a 5-phase lifecycle with 6 statuses.
- **AI Integration:** OpenAI is used for PDF analysis to extract panel specifications and AI-powered visual comparisons.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, and a logistics system for load list creation and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations and CFMEU calendars.
- **Communication:** A Teams-style chat system with direct messages, groups, channels, @mentions, notifications, file attachments, and message topics.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management with a sales pipeline, and a comprehensive document management system with version control, bundles, entity linking, and bulk upload with AI metadata extraction (title, document number, revision, version from file content/names).
- **Photo Gallery:** A visual gallery for images with search, filtering, grouping, full-screen viewing, multi-select with email, and download functionalities.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Advanced Features:** Panel consolidation, contract retention tracking with automated deductions, and visual document comparison with pixel-level overlay and AI summarization.
- **Landing Page:** A branded landing page for unauthenticated users, routing authenticated users to the dashboard.
- **Asset Register:** Comprehensive asset lifecycle management with depreciation, insurance, maintenance scheduling, transfer history, AI analysis, and integrated repair request workflow. Asset detail page includes "Replace" button (opens CAPEX form pre-populated for replacement) and "Service/Repair" button (opens repair request form). Repair history tab shows all service/repair requests per asset with priority badges and status tracking.
- **Hire Booking Engine:** Equipment hire management with an approval workflow, supporting internal and external assets.
- **Job Programme:** Enhanced scheduling for job production levels, including pour labels, sequence ordering, estimated/manual dates, and notes. Features drag-and-drop reordering, inline editing, split-level functionality, and automatic date recalculation based on working days.
- **Project Activities / Workflow System:** Template-driven activity workflow system where admins define job types with workflow templates. Activities are instantiated per job, supporting 6 statuses, inline date editing, comments/chat, file attachments, and MS Project-style predecessor/dependency relationships. Includes nested task management within activities.
- **User Invitation System:** Admin-initiated email invitations with SHA-256 hashed tokens, 7-day expiry, single-use enforcement. Public registration page at `/register/:token` with required profile fields (name, phone, address, password). Invitation tracking with PENDING/ACCEPTED/EXPIRED/CANCELLED statuses. CSRF-exempt public endpoints for token validation and registration.
- **CAPEX Module:** Capital expenditure request management with approval workflow (DRAFT → SUBMITTED → APPROVED/REJECTED/WITHDRAWN). Features 7-section form (General, Purchase Reasons, Replacement, Cost Analysis, Business Case, Supplier, Installation), approval limits per user, full audit trail, and bidirectional integration with Purchase Orders. Approved CAPEX requests can generate linked POs with data prefill; CAPEX approval auto-approves linked POs. Schema: `capexRequests`, `capexAuditEvents` tables; users have `capexApprovalLimit` and `capexApprover` fields. Migration: 0004.
- **Budget System:** Comprehensive 4-phase cost management system:
  - *Cost Codes:* Two-tier parent/child cost code structure. Parent codes in `cost_codes` table, child codes in `child_cost_codes` table with `parentCostCodeId` FK. Admin management page at `/admin/cost-codes` with collapsible parent/child hierarchy, expand/collapse all, separate dialogs for parent/child CRUD. Excel import supports two-tab format (PARENT CODES + CHILD CODES tabs) with case-insensitive parent name matching. Template download generates two-tab Excel. API: `/api/cost-codes`, `/api/child-cost-codes`, `/api/cost-codes-with-children`, `/api/cost-codes/import`. Cost code defaults per job type (`cost_code_defaults`) with checkbox-based assignment. Per-job cost codes (`job_cost_codes`) inherited from job type defaults. RBAC key: `admin_cost_codes`.
  - *Tender Center:* Full tender lifecycle management at `/tenders`. Tenders per job with status workflow (DRAFT → OPEN → UNDER_REVIEW → APPROVED → CLOSED → CANCELLED). Tender submissions from suppliers with line items linked to cost codes (parent + optional child). Submission approval workflow. Auto-generated tender numbers (TDR-000001). Schema: `tenders`, `tender_packages`, `tender_submissions`, `tender_line_items` (has `childCostCodeId`), `tender_line_activities`, `tender_line_files`, `tender_line_risks`. RBAC key: `tenders`.
  - *Job Tender Sheets:* Budget-derived tender entry at `/jobs/:id/tenders`. Mirrors budget page layout with cost code grouping. Per-supplier tender amount entry against budget line items. Tender creation, supplier submission management, batch save. Backend: job-scoped tender endpoints with submission ownership validation and SQL-based total recalculation. Navigation: Budget page → Tender Sheets button.
  - *Job Budget:* Per-job budget management at `/jobs/:id/budget`. Top-level budget with estimated total, profit target %, customer price. Budget lines per parent cost code with optional child cost code, linking to selected tender submissions and contractors. Variation tracking and forecast costs. Summary calculations. Budget Line Detail Items: mini BOQ/spreadsheet per budget line with item, qty, unit, price, lineTotal, notes. Lock mechanism (`estimateLocked` on budget_lines) to sync estimated budget to sum of detail items. Schema: `job_budgets`, `budget_lines` (has `childCostCodeId`, `estimateLocked`), `budget_line_files`, `budget_line_detail_items`. RBAC key: `budgets`.
  - *Bill of Quantities (BOQ):* Detailed item-level costing at `/jobs/:id/boq`. BOQ groups (buildings/levels) under parent cost codes with optional child codes. BOQ items with quantities, units (EA/SQM/M3/LM/M2/M/HR/DAY/TONNE/KG/LOT), unit pricing, line totals, optional child cost codes. Links to tender line items. Schema: `boq_groups` (has `childCostCodeId`), `boq_items` (has `childCostCodeId`). RBAC key: `budgets`.

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