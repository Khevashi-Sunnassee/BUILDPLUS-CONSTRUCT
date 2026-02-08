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