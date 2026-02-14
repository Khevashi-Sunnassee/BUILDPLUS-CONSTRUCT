# BuildPlus Ai Management System

## Overview
The BuildPlus AI Management System optimizes panel production and delivery for construction and manufacturing. It manages the entire panel lifecycle, from CAD/Revit time management to delivery tracking, aiming to enhance operational control, efficiency, and decision-making. Key features include daily log management, approval workflows, reporting, analytics, KPI dashboards, and logistics for load lists and delivery. The system is designed for enterprise-grade scale, supporting 300+ simultaneous users with multi-company deployment and data isolation.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is a React application built with Vite, `shadcn/ui`, and Tailwind CSS for a modern UI/UX, including a KPI Dashboard with data visualization and interactive maps. The backend is an Express.js application using PostgreSQL and Drizzle ORM. Authentication is email/password-based with bcrypt and `express-session`, incorporating Role-Based Access Control (RBAC).

**Technical Implementations & Features:**
- **Core Management:** Time management, approval workflows, reporting, analytics, and administration for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** CRUD operations for customer and job management, panel registration, production approvals, estimate import, and detailed panel field management with 14-stage panel and 5-phase job lifecycles, both with audit logging.
- **AI Integration:** OpenAI is used for PDF analysis (panel specifications) and AI-powered visual comparisons.
- **Financial & Logistics:** Configurable rates, cost analysis, production tracking, load list creation, and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, supporting multi-factory operations.
- **Communication:** Teams-style chat with DMs, groups, channels, @mentions, notifications, file attachments, and message topics.
- **Sales & Document Management:** Mobile-first pre-sales opportunity management with a sales pipeline; document management with version control, bundles, entity linking, bulk upload, and AI metadata extraction.
- **Photo Gallery:** Visual gallery with search, filtering, grouping, full-screen viewing, multi-select, and download.
- **Mobile Functionality:** QR scanner for panels and document bundles, mobile panel checklists with conditional fields, and mobile PM Call Logs.
- **Advanced Features:** Panel consolidation, contract retention tracking, and visual document comparison.
- **Asset Register:** Asset lifecycle management including depreciation, insurance, maintenance, transfer history, AI analysis, and integrated repair requests.
- **Hire Booking Engine:** Equipment hire management with approval workflows for internal and external assets.
- **Job Programme:** Enhanced scheduling for job production levels with pour labels, sequence ordering, estimated/manual dates, drag-and-drop, inline editing, split-level functionality, and automatic recalculation.
- **Project Activities / Workflow System:** Template-driven activity workflow system for job types, with nested tasks, statuses, date editing, comments, file attachments, and MS Project-style dependencies.
- **User Invitation System:** Admin-initiated email invitations with secure tokens, public registration, and tracking.
- **CAPEX Module:** Capital expenditure request management with approval workflows, multi-section forms, approval limits, audit trails, and bidirectional PO integration.
- **Scope of Works Builder:** AI-powered scope generation for tender management across trades, featuring AI-generated and custom scope items, bulk status updates, duplication, export, and bidirectional linking with tenders.
- **Budget System:** Four-phase cost management: two-tier cost codes, a tender center for supplier submissions, job tender sheets for entry against budget line items, and per-job budget management with estimated totals, profit targets, variations, and forecast costs, including Bill of Quantities (BOQ).

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