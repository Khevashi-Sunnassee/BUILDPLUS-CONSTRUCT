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
- **Admin Provisioning**: Centralized management for users, jobs, devices, global settings, panel types, and work types.
- **Jobs & Panel Management**: Creation and tracking of jobs, panel registration, production approval workflows, estimate import with Excel parsing, and detailed panel field management (reinforcement, concrete, lifters, dowels, plates, inserts).
- **AI Integration**: OpenAI-powered PDF analysis for extracting panel specifications from shop drawings.
- **Configurable Rates & Cost Analysis**: Job and panel-level configurable rates (supply, install, sell) and cost tracking by component (labor, concrete, steel).
- **Production Tracking**: Production reports grouped by date, including financial and production metrics.
- **Logistics System**: Load list creation, trailer assignment, and delivery recording.
- **Drafting & Procurement Scheduling**: Panel-level drafting scheduling linked to production slots and configurable procurement timing with validation.
- **Factory Management**: Multi-factory support with location tracking, CFMEU calendar assignment, configurable work days, production beds, and user-specific factory preferences. Date calculations are based on working days, excluding public holidays.
- **Chat System**: Teams-style messaging with DM, GROUP, CHANNEL types, @mentions, notifications, file attachments, job/panel linking, and read receipts.
- **Document Management System**: Comprehensive document register with file upload/download via Replit Object Storage, version control, document bundles with QR code access, entity linking (jobs, panels, suppliers, purchase orders, tasks), and configurable document types/disciplines/categories.
- **Advanced Templates System**: Dynamic, reusable checklist templates with JSONB storage for flexible sections and fields. Features include an admin builder with drag-and-drop field palette (20+ field types), a checklist form renderer with validation, and reports with multi-dimensional filtering and CSV export.

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