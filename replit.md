# LTE Performance Management System

## Overview
The LTE Performance Management System optimizes panel production and delivery in construction and manufacturing. It enhances CAD and Revit time management, provides insights into production and financial performance, and manages the complete lifecycle of panel production and delivery. The system includes daily log management, manager approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load lists and delivery tracking, supporting robust decision-making and operational control.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture. The frontend is built with React + Vite, utilizing TanStack Query for data fetching, Wouter for routing, `shadcn/ui` components, and Tailwind CSS for styling. The backend uses Express.js with PostgreSQL as the primary database, managed by Drizzle ORM. User authentication is handled via email/password with bcrypt and `express-session`, featuring Role-Based Access Control (RBAC) with granular permissions.

**UI/UX Decisions:**
The frontend features a KPI Dashboard with data visualization and PDF export, and interactive maps for factory management. Mobile pages adhere to strict design tokens and layout patterns, ensuring a consistent user experience with specific navigation and interaction guidelines.

**Technical Implementations & Features:**
- **Core Management:** Time and approval management, comprehensive reporting and analytics, and centralized admin provisioning for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** Full CRUD operations for customer and job management, panel registration, production approval workflows, estimate import, and detailed panel field management. Panels are tracked through a 14-stage lifecycle with audit logging. Jobs follow a 5-phase lifecycle (OPPORTUNITY → QUOTING → WON_AWAITING_CONTRACT → CONTRACTED, or LOST) with 6 statuses. Phase progression is sequential, restricting available actions and capabilities.
- **AI Integration:** OpenAI is used for PDF analysis to extract panel specifications and AI-powered visual comparison summaries for documents.
- **Financial & Logistics:** Configurable rates and cost analysis, production tracking, and a logistics system for load list creation and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, with support for multi-factory operations and CFMEU calendars.
- **Communication:** A Teams-style chat system including direct messages, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** A mobile-first pre-sales opportunity management system with a detailed sales pipeline, and a comprehensive document management system with version control, bundles, and entity linking.
- **Photo Gallery:** A visual gallery for image files from the document register, offering search, filtering, grouping, full-screen viewing, multi-select with email, and download functionalities on both web and mobile.
- **Mobile Functionality:** Dedicated QR scanner for panels and document bundles, and mobile panel checklists (e.g., Quality Inspections) with conditional fields and system-locked templates.
- **Advanced Features:** Panel consolidation, contract retention tracking with automated deductions, and visual document comparison with pixel-level overlay and AI summarization.
- **Asset Register:** Comprehensive asset lifecycle management with 50+ fields across 8 tabs, supporting 40+ asset categories, auto-generated asset tags, depreciation tracking, lease/finance management, insurance tracking, maintenance scheduling, transfer history, and AI-powered asset analysis via OpenAI.

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

## Comprehensive Debugging & QA Audit Procedure
When the user requests a "comprehensive debugging", "full audit", "QA pass", or "code quality check", follow this structured procedure:

### 1. Frontend
- Validate React/TypeScript correctness
- Check for invalid React element types, broken imports, hooks misuse, state leaks
- Enforce strict TypeScript rules (no implicit any, unsafe casts, unused exports)
- Run ESLint and flag all violations
- Detect performance issues (unnecessary re-renders, large bundles, blocking renders)

### 2. Backend
- Validate all API endpoints exist, are reachable, and return consistent schemas
- Ensure every protected endpoint enforces authentication and permissions
- Validate request/response schema validation on all endpoints
- Detect missing or inconsistent error handling
- Check database access patterns for N+1 queries, missing indexes, unsafe transactions

### 3. Security
- Verify CSRF protection for all cookie-based write operations
- Validate secure cookie flags, SameSite policy, and session handling
- Check for XSS, injection risks, unsafe eval or dynamic execution
- Scan dependencies for known vulnerabilities
- Ensure secrets are not hard-coded and only loaded from environment variables
- Validate security headers (CSP, HSTS, X-Frame-Options, etc.)

### 4. TypeScript & Build Integrity
- Run a full TypeScript typecheck with noEmit
- Ensure the application builds cleanly with no warnings
- Detect circular dependencies and invalid imports

### 5. Performance & Scalability
- Simulate load assumptions of 200+ concurrent users
- Identify latency bottlenecks (API p95, slow pages, blocking I/O)
- Check database connection pooling and resource limits
- Identify operations that should be queued or backgrounded

### 6. Rules Compliance
- Verify the codebase follows its own architectural and coding rules
- Flag any deviation from established patterns or conventions

### 7. Output
- Produce a single structured report summarizing:
  - Critical issues
  - Warnings
  - Recommended fixes (with file references)
- Assign an overall Application Health Score (0–100)
- Assign a letter grade (A–F)
- Clearly state whether the application is SAFE TO DEPLOY or BLOCKED

**Audit Principles:** Be strict, assume production risk, do not ignore issues. If something is unclear, surface it as a risk instead of guessing.