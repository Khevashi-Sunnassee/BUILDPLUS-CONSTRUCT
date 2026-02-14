# BuildPlus Ai Management System

## Overview
The BuildPlus AI Management System is designed to optimize panel production and delivery processes for the construction and manufacturing industries. It provides comprehensive management across the entire panel production lifecycle, from initial CAD/Revit time management through to final delivery tracking. The system aims to enhance operational control, improve production efficiency, and support robust decision-making through features like daily log management, approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load list creation and delivery management. The business vision is to revolutionize project management and manufacturing efficiency, tapping into a market hungry for integrated, intelligent solutions.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture. The frontend is developed using React with Vite, leveraging `shadcn/ui` and Tailwind CSS for a consistent and modern UI/UX. The backend is built with Express.js, utilizing PostgreSQL as the primary database and Drizzle ORM for data interaction. Authentication is handled via email/password using bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**UI/UX Decisions:**
The frontend features a KPI Dashboard with data visualization, PDF export capabilities, and interactive maps. Mobile pages are designed with specific design tokens and layout patterns to ensure a consistent and user-friendly experience across devices.

**Technical Implementations & Features:**
- **Core Management:** Time management, approval workflows, reporting, analytics, and administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** Comprehensive CRUD operations for customer and job management, panel registration, production approval workflows, estimate import, and detailed panel field management. Panels have a 14-stage lifecycle with audit logging; jobs have a 5-phase lifecycle with 6 statuses.
- **AI Integration:** Utilizes OpenAI for PDF analysis to extract panel specifications and for AI-powered visual comparisons.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, and a logistics system for load list creation and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations.
- **Communication:** A Teams-style chat system with direct messages, groups, channels, @mentions, notifications, file attachments, and message topics.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management with a sales pipeline, and a document management system with version control, bundles, entity linking, and bulk upload with AI metadata extraction.
- **Photo Gallery:** A visual gallery for images with search, filtering, grouping, full-screen viewing, multi-select, and download functionalities.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Advanced Features:** Panel consolidation, contract retention tracking with automated deductions, and visual document comparison.
- **Asset Register:** Comprehensive asset lifecycle management with depreciation, insurance, maintenance scheduling, transfer history, AI analysis, and integrated repair request workflows.
- **Hire Booking Engine:** Equipment hire management with an approval workflow for both internal and external assets.
- **Job Programme:** Enhanced scheduling for job production levels, including pour labels, sequence ordering, estimated/manual dates, drag-and-drop reordering, inline editing, split-level functionality, and automatic date recalculation.
- **Project Activities / Workflow System:** Template-driven activity workflow system allowing admins to define job types with workflow templates. Activities include nested tasks, statuses, date editing, comments, file attachments, and MS Project-style predecessor/dependency relationships.
- **User Invitation System:** Admin-initiated email invitations with secure tokens, a public registration page, and invitation tracking.
- **CAPEX Module:** Capital expenditure request management with an approval workflow, a multi-section form, approval limits per user, a full audit trail, and bidirectional integration with Purchase Orders.
- **Scope of Works Builder:** AI-powered scope generation for tender management across trades (painting, plastering, waterproofing, tiling, concrete, etc.). Features include: scope creation per trade and job type, AI-generated scope items via OpenAI (40-80 items per trade with categories), custom item management with INCLUDED/EXCLUDED/NA statuses, bulk status updates, scope duplication, email/print export, and bidirectional linking between scopes and tenders. Scopes are company-dependent and job-type-dependent with full multi-tenant isolation. Schema: scope_trades, scopes, scope_items, tender_scopes tables.
- **Budget System:** A comprehensive four-phase cost management system including:
    - **Cost Codes:** A two-tier parent/child cost code structure with admin management, Excel import/export, and per-job type defaults.
    - **Tender Center:** Full tender lifecycle management with status workflows, supplier submissions linked to cost codes, and auto-generated tender numbers.
    - **Job Tender Sheets:** Entry of per-supplier tender amounts against budget line items, integrated with the budget page.
    - **Job Budget:** Per-job budget management with estimated totals, profit targets, customer prices, budget lines linked to cost codes, variation tracking, and forecast costs. Includes detailed Bill of Quantities (BOQ) with item-level costing.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **OpenAI**: AI services for PDF analysis and visual comparisons.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching and state management.
- **Wouter**: Lightweight routing library.
- **shadcn/ui**: Reusable UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Express.js**: Backend web application framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **bcrypt**: Password hashing library.
- **express-session**: Session management middleware.
- **connect-pg-simple**: PostgreSQL-backed session store.
- **Vitest**: Testing framework.
- **ExcelJS**: Excel file generation library.

## Coding Standards

### Accessibility
- All pages have `role="main"` with a descriptive `aria-label` (100% coverage across all page-level components).
- All interactive elements (buttons, inputs, links) must have `aria-label` or visible label text.
- Forms use `aria-required` on required fields across 13+ form pages (login, register, hire-booking, purchase-order, progress-claim, PM call log, asset repair, mobile forms).
- Loading states use `aria-busy="true"` and live regions (`aria-live="polite"`) for status updates.
- Error alerts use `role="alert"` and `aria-live="assertive"` for validation errors and critical notifications.
- Decorative icons have `aria-hidden="true"`; informational icons need `aria-label`.
- Navigation landmarks use `<nav>` with `aria-label` differentiating multiple navs.
- ESLint enforces 11 a11y rules via `eslint-plugin-jsx-a11y` in `eslint.config.js`.

### Frontend Testing
- All new components must have a co-located `.test.tsx` file using React Testing Library + Vitest.
- Config: `vitest.config.frontend.ts` with jsdom environment; shared test utilities in `client/src/test/test-utils.tsx`.
- Tests must cover: rendering, user interactions, error states, and accessibility (ARIA attributes).
- Every interactive element must have a `data-testid` attribute for test targeting.
- Run frontend tests: `npx vitest --config vitest.config.frontend.ts --run`.
- Current coverage: 135 test files, 562+ tests covering all pages (admin, core workflow, mobile, forms/details), shared components, and 15 UI components (Button, Card, Badge, Input, Dialog, Table, Tabs, Select, Tooltip, Textarea, Skeleton, Avatar, DropdownMenu, AlertDialog, Sheet).
- Test pattern: mock wouter, @/lib/auth, @/hooks/use-mobile, @/hooks/use-document-title; use renderWithProviders; verify role/aria-label/aria-busy/data-testid.

### Database Integrity
- All monetary/quantity columns have CHECK constraints (e.g., `CHECK (amount >= 0)`).
- Rate fields (tax, retention, depreciation, interest) are bounded: `CHECK (rate >= 0 AND rate <= 100)`.
- Business-unique fields have UNIQUE constraints (e.g., customer name + company).
- New tables must define constraints in both Drizzle schema and as raw SQL migration.
- Current counts: 103 check constraints across 33 tables, 13 unique constraints, 203 unique indexes, 380 foreign keys.

### Developer Experience
- Environment variables documented in `.env.example` with descriptions.
- ESLint config in `eslint.config.js` with TypeScript, security, and 11 accessibility rules.
- Quality check script: `bash scripts/quality-check.sh` (4-step: ESLint zero-tolerance + frontend tests + TypeScript check + accessibility audit).
- Pre-commit enforcement: `husky` + `lint-staged` configured (`.lintstagedrc.json`) to run ESLint on staged `.ts`/`.tsx` files.
- Stale chunk handling: All lazy imports use `lazyWithRetry` to auto-reload after deployments.
- Commit messages should reference the feature area (e.g., `[budget] Add cost code import`).