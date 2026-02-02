# LTE Performance Management System

## Overview
The LTE Performance Management System is a comprehensive platform designed for CAD and Revit time management. It provides tools for daily log management, manager approval workflows, reporting, and analytics. The system tracks work against specific jobs and panels, offers a KPI dashboard for performance monitoring, and includes a logistics system for managing load lists and delivery tracking. Its core purpose is to streamline operational efficiency, provide insights into production and financial performance, and manage the lifecycle of panel production and delivery.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system employs a client-server architecture with a React-based frontend and an Express.js backend. Data persistence is managed by PostgreSQL through Drizzle ORM. Authentication is standalone using email/password with bcrypt hashing and `express-session`, implementing Role-Based Access Control (RBAC) with USER, MANAGER, and ADMIN roles.

**UI/UX Decisions:**
The frontend utilizes React + Vite, TanStack Query, Wouter for routing, `shadcn/ui` for UI components, and Tailwind CSS for styling. It features a KPI Dashboard with selectable date periods, visual charts, and PDF export capabilities.

**Technical Implementations & Features:**
- **Authentication**: Standalone email/password authentication with bcrypt and `express-session`.
- **Authorization**: RBAC roles (USER, MANAGER, ADMIN) for granular access control.
- **Data Ingestion**: Idempotent API endpoint (`POST /api/agent/ingest`) for Windows Agent data ingestion, secured by device key authentication.
- **Time Management**: Daily log management with viewing, editing, and submission for approval. Includes manual time entry with on-the-fly panel registration and automatic start time defaulting.
- **Approval Workflow**: Managers can review, approve, or reject submitted logs with comments.
- **Reporting & Analytics**: Comprehensive reports on time by user, job, and application.
- **Admin Provisioning**: Centralized management for users, jobs, devices, global settings, panel types, and work types.
- **Jobs & Panel Management**: Creation and tracking of jobs (with Excel import/export), panel registration with dynamic types, estimated/actual hours, and a production approval workflow.
- **AI Integration**: AI-powered PDF analysis using OpenAI for extracting panel specifications from shop drawings during the production approval process.
- **Configurable Rates**: Panel types are configurable with rates (supply cost, install cost, sell rate) and expected weight. Job-specific rate overrides are supported.
- **Production Tracking**: Production reports grouped by date, showing summaries of panels, volume, area, financial metrics (cost, revenue, profit, margin), with edit/delete functionality.
- **Cost Analysis**: Tracks expected costs by component (labor, concrete, steel) as percentages of revenue, with job-level overrides and detailed daily breakdowns.
- **Work Type Categorization**: Allows categorization of drafting work (General Drafting, Client Changes, Errors/Redrafting) for both manual and automated entries.
- **Logistics System**: Manages load list creation, assignment of trailer types, and comprehensive delivery recording including driver times and truck information. Load lists automatically complete upon delivery recording.
- **Logistics Reporting**: Provides reports on panels shipped, total deliveries, and average delivery phase timings.
- **Weekly Wage Reports**: Tracks weekly payroll costs across various categories and compares actual wages against estimated wages based on production revenue.
- **Timezone Management**: All times are stored and displayed in the Australia/Melbourne timezone.

## External Dependencies
- **PostgreSQL**: Primary database for data storage.
- **OpenAI**: Utilized for AI-powered PDF analysis to extract panel specifications.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching and caching library.
- **Wouter**: React routing library.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Express.js**: Backend web application framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **bcrypt**: Library for hashing passwords.
- **express-session**: Middleware for managing user sessions.