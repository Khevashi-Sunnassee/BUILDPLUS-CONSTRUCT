# BuildPlus Ai Management System

## Overview
The BuildPlus AI Management System optimizes panel production and delivery for construction and manufacturing. It manages the entire panel lifecycle from CAD/Revit time management to delivery tracking, aiming to enhance operational control, efficiency, and decision-making. Key features include daily log management, approval workflows, reporting, analytics, KPI dashboards, and logistics for load lists and delivery. The system is designed for enterprise-grade scale, supporting 300+ simultaneous users with multi-company deployment and data isolation, providing a comprehensive solution for managing complex construction and manufacturing workflows with a business vision to transform construction and manufacturing operations.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is a React application built with Vite, `shadcn/ui`, and Tailwind CSS for a modern UI/UX, including a KPI Dashboard with data visualization and interactive maps. The backend is an Express.js application using PostgreSQL and Drizzle ORM. Authentication is email/password-based with bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**UI/UX Decisions:**
- Modern, responsive design using `shadcn/ui` and Tailwind CSS.
- KPI Dashboard with data visualization and interactive maps for operational insights.

**Technical Implementations & Features:**
- **Core Management:** Time management, approval workflows, reporting, analytics, and administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** CRUD operations for customer and job management, panel registration, production approvals, estimate import, and detailed panel field management with 14-stage panel and 5-phase job lifecycles, both with audit logging.
- **AI Integration:** OpenAI is used for PDF analysis (panel specifications) and AI-powered visual comparisons.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, load list creation, and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations; enhanced job program scheduling with pour labels, sequence ordering, and drag-and-drop.
- **Communication:** Teams-style chat with DMs, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management; document management with version control, bundles, entity linking, bulk upload, and AI metadata extraction.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Address Autocomplete:** Australian suburb/postcode/state lookup across all address forms.
- **Advanced Features:** Panel consolidation, contract retention tracking, visual document comparison, and a comprehensive Asset Register with lifecycle management.
- **Employee Licences & Tickets:** Comprehensive licence/ticket management per employee with pre-populated construction ticket types and automated expiry email notifications.
- **Hire Booking Engine:** Equipment hire management with approval workflows for internal and external assets.
- **Project Activities / Workflow System:** Template-driven activity workflow system for job types, with nested tasks, statuses, comments, and MS Project-style dependencies.
- **User Invitation System:** Admin-initiated email invitations with secure tokens and public registration.
- **CAPEX Module:** Capital expenditure request management with approval workflows, audit trails, and bidirectional PO integration.
- **Scope of Works Builder:** AI-powered scope generation for tender management across trades.
- **Budget System:** Four-phase cost management including two-tier cost codes, a tender center, job tender sheets, and per-job budget management with Bill of Quantities (BOQ).
- **MYOB Integration:** OAuth 2.0 connection to MYOB Business API with database-backed token storage (per-company), auto-refresh, and multi-tenant isolation.
- **AP Email Inbox Monitoring:** Automatic invoice processing via Resend inbound email webhooks.
- **AP Invoice Status Workflow:** Multi-stage approval workflow for invoices: IMPORTED → PROCESSED → CONFIRMED → PARTIALLY_APPROVED → APPROVED.
- **Opportunity Submission Date & Reminders:** Opportunities have a submission date (datetime) field for tender deadlines; automated 7-day reminder emails are sent to customer contacts when submission dates approach, with deduplication tracking via `opportunity_submission_reminders` table.

**System Design Choices:**
- **Multi-Tenancy:** Designed for multi-company deployment with strict data isolation.
- **Scalability:** Supports 300+ simultaneous users.
- **Robustness:** Extensive input validation, comprehensive error handling, and consistent API response structures.
- **Security:** Role-Based Access Control (RBAC), authentication, and UUID validation.
- **Data Integrity:** Enforced through CHECK constraints, unique constraints, and foreign keys, with performance indexes.
- **Query Safety:** All list endpoints and multi-row queries have `.limit()` safeguards to prevent unbounded result sets.
- **Accessibility:** All interactive elements and pages adhere to accessibility standards.
- **Testing:** Frontend tested with React Testing Library + Vitest; backend tested with API integration tests covering company isolation, data integrity, pagination, rate limiting, and input sanitization.
- **Background Job System:** Interval-based scheduler for tasks like AP email polling and invoice extraction.
- **Job Queue System:** In-memory priority queue with concurrency control and retry mechanisms.
- **Circuit Breakers:** Implemented for external services like OpenAI, Twilio, Mailgun, and Resend.
- **Caching:** LRU cache with TTL for various data types.
- **Rate Limiting:** Applied to API, Auth, and Upload endpoints.
- **Request Monitoring:** Metrics collection, event loop lag measurement, request timing, and error monitoring.
- **Graceful Shutdown:** Handlers for SIGTERM/SIGINT to ensure clean application termination.
- **Broadcast System:** Template-based mass notifications via email/SMS/WhatsApp with delivery tracking.

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
- **Resend**: Email service for outbound and inbound email processing.
- **MYOB Business API**: Accounting software integration.
- **Twilio**: SMS and voice communication services.
- **Mailgun**: Email automation service.