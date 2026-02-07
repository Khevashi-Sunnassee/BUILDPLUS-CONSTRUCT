# LTE Performance Management System

## Overview
The LTE Performance Management System is a comprehensive platform designed to optimize panel production and delivery processes in the construction and manufacturing sectors. It streamlines operational efficiency in CAD and Revit time management, provides insights into production and financial performance, and manages the lifecycle of panel production and delivery. Key capabilities include daily log management, manager approval workflows, reporting, analytics, KPI dashboards, and a logistics system for load lists and delivery tracking, offering robust tools for decision-making and operational control.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the folder `node_modules/`.
Do not make changes to the file `package-lock.json`.

## System Architecture
The system utilizes a client-server architecture. The frontend is built with React + Vite, while the backend uses Express.js. PostgreSQL is the primary database, managed by Drizzle ORM. User authentication is handled via email/password with bcrypt and `express-session`, featuring Role-Based Access Control (RBAC) with granular per-user permissions.

**UI/UX Decisions:**
The frontend employs TanStack Query for data fetching, Wouter for routing, `shadcn/ui` for components, and Tailwind CSS for styling. It includes a KPI Dashboard with data visualization and PDF export, and interactive maps for factory management. Mobile pages follow strict design tokens and layout patterns, ensuring a consistent user experience with specific navigation and interaction guidelines.

**Technical Implementations & Features:**
- **Core Management:** Time & approval management, comprehensive reporting & analytics, and centralized admin provisioning for users, jobs, customers, and global settings.
- **Job & Panel Lifecycle:** Full CRUD for customer and job management, panel registration, production approval workflows, estimate import, and detailed panel field management. Panels are tracked through a 14-stage lifecycle with audit logging.
- **AI Integration:** OpenAI is used for PDF analysis to extract panel specifications and AI-powered visual comparison summaries for documents.
- **Financial & Logistics:** Configurable rates and cost analysis, production tracking, and a logistics system for load list creation and delivery recording.
- **Scheduling:** Drafting and procurement scheduling linked to production slots, considering multi-factory support and CFMEU calendars.
- **Communication:** A Teams-style chat system with direct messages, groups, channels, @mentions, notifications, and file attachments.
- **Sales & Document Management:** A mobile-first pre-sales opportunity management system with a detailed sales pipeline, and a comprehensive document management system with version control, bundles, and entity linking.
- **Mobile Functionality:** Dedicated QR scanner for panels and document bundles, and mobile panel checklists (e.g., Pre-Pour, Post-Pour Quality Inspections) with conditional fields and system-locked templates.
- **Advanced Features:** Panel consolidation (merging multiple panels), contract retention tracking with automated deductions and caps, and visual document comparison with pixel-level overlay and AI summarization.

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