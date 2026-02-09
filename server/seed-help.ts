import { db } from "./db";
import { helpEntries } from "@shared/schema";
import { eq } from "drizzle-orm";

interface HelpSeed {
  key: string;
  scope: "PAGE" | "FIELD" | "ACTION" | "COLUMN" | "ERROR" | "GENERAL";
  title: string;
  shortText: string;
  bodyMd: string;
  keywords: string[];
  category: string;
  pageRoute?: string;
}

const pageHelp: HelpSeed[] = [
  {
    key: "page.dashboard",
    scope: "PAGE",
    title: "Dashboard",
    shortText: "Your personal overview of time tracking, tasks, and recent activity.",
    bodyMd: `## Dashboard Overview

The Dashboard gives you a quick snapshot of your day and outstanding items as soon as you log in.

### What You Will See

| Card | Description |
|------|-------------|
| **Today's Hours** | Total time you have logged today across all jobs |
| **Pending Days** | Days where you have unsubmitted timesheets |
| **Submitted Awaiting Approval** | Timesheets you have submitted that are waiting for your manager to review |
| **Recent Logs** | Your most recent daily log entries |
| **Active Tasks** | Tasks currently assigned to you |
| **Unread Messages** | New chat messages you haven't read yet |

### Buttons & Actions

- **View Messages** - Opens the Chat page so you can read and reply to unread messages
- **Mark All Read** - Marks all your unread messages as read without opening them
- **View Tasks** - Opens the Tasks page to see all tasks assigned to you
- **View Daily Reports** - Opens your Drafting Register to log or review time entries
- **View Analytics** - Opens the KPI Dashboard for performance metrics and charts
- **Review Submissions** - (Managers only) Opens the Manager Review page to approve or reject submitted timesheets

### Tips
- Click any summary card to jump directly to the relevant page
- Time tracking totals update automatically as you log hours throughout the day
- The dashboard refreshes each time you visit it, so you always see the latest information`,
    keywords: ["home", "overview", "stats", "time tracking", "dashboard"],
    category: "Dashboard",
    pageRoute: "/dashboard",
  },
  {
    key: "page.tasks",
    scope: "PAGE",
    title: "Tasks",
    shortText: "View and manage your tasks, create new ones, and track progress.",
    bodyMd: `## Tasks

The Tasks page is your central hub for managing work items. You can create tasks, assign them to team members, and track their progress from start to finish.

### Buttons & Actions

- **New Task** - Opens a form to create a new task. Fill in the title, description, priority, due date, and assign it to a team member
- **Filter Tabs** (All / My Tasks / Created by Me) - Switch between viewing all tasks, only tasks assigned to you, or tasks you created
- **Search** - Type keywords to find specific tasks by title or description
- **Task Card** - Click any task to open a detail panel on the right where you can view comments, update status, or edit the task
- **Status Toggle** - Change a task's status directly from the list (Open, In Progress, Completed, Closed)
- **Comment** - Add comments to tasks in the detail panel for team collaboration
- **Attach Files** - Upload files to a task from the detail panel

### Task Statuses

| Status | Meaning |
|--------|---------|
| **Open** | New or unstarted task |
| **In Progress** | Currently being worked on |
| **Completed** | Finished successfully |
| **Closed** | Archived and no longer active |

### Task Priorities
- **Low** - Can be addressed when time permits
- **Medium** - Should be done in a reasonable timeframe
- **High** - Needs attention soon
- **Urgent** - Requires immediate action`,
    keywords: ["tasks", "todo", "work", "assign", "priority"],
    category: "Tasks",
    pageRoute: "/tasks",
  },
  {
    key: "page.chat",
    scope: "PAGE",
    title: "Chat",
    shortText: "Team messaging with direct messages, groups, and channels.",
    bodyMd: `## Chat

Real-time messaging system for team communication. Stay connected with your team through direct messages, group chats, and topic-based channels.

### Buttons & Actions

- **New Conversation** (+ icon) - Opens a dialog to start a new conversation. Choose between Direct Message, Group Chat, or Channel
- **Create Conversation** - Confirms creation of a new chat after selecting members and naming it
- **Add Members** - Add additional team members to an existing group conversation
- **Conversation Options** (gear icon) - Access settings for the current conversation
- **Delete Conversation** - Permanently remove a conversation (only available to the creator or admins)
- **Attach File** (paperclip icon) - Upload and share files within a conversation. Supports images, PDFs, and other document types
- **Send Message** (arrow icon) - Send your typed message. You can also press Enter on your keyboard

### Conversation Types

| Type | Description |
|------|-------------|
| **Direct Message** | Private 1-on-1 conversation between two people |
| **Group Chat** | Multi-person private conversation |
| **Channel** | Topic-based discussion visible to selected members |

### Features
- **@Mentions** - Type @ followed by a name to tag someone and notify them
- **File Attachments** - Share documents and images directly in conversations
- **Unread Indicators** - Bold text and counts show which conversations have new messages
- **Message History** - Scroll up to view older messages in any conversation`,
    keywords: ["chat", "messaging", "communication", "team", "direct message"],
    category: "Chat",
    pageRoute: "/chat",
  },
  {
    key: "page.jobs",
    scope: "PAGE",
    title: "Jobs Management",
    shortText: "Manage all jobs from opportunity through to completion.",
    bodyMd: `## Jobs Management

Central hub for managing all construction jobs and projects. Track every job from initial opportunity through to completion with full lifecycle management.

### Buttons & Actions

- **Create Job** - Opens a form to create a new job with details like job number, name, client, address, and production settings
- **Download Template** - Downloads an Excel template for bulk importing jobs
- **Import** - Upload a completed Excel file to import multiple jobs at once
- **Search** - Filter jobs by typing a job number, name, client, or address
- **Phase Filter** - Filter jobs by their current phase (Opportunity, Quoting, Won Awaiting Contract, Contracted)
- **Status Filter** - Filter jobs by status (Active, On Hold, Pending Start, etc.)
- **State Filter** - Filter jobs by Australian state (QLD, NSW, VIC, etc.)
- **Group by State** - Toggle grouping of jobs by their state location
- **Clear Filters** - Remove all active filters to show all jobs
- **Sort Columns** (Job Number, Client, Status) - Click column headers to sort ascending or descending
- **Edit Job** (pencil icon) - Open an existing job to modify its details, production settings, or level cycle times
- **Delete Job** (trash icon) - Remove a job (only if it has no associated panels or production records)
- **Cost Overrides** (dollar icon) - Set job-specific cost rates that override global rates

### Job Lifecycle Phases

| Phase | Description |
|-------|-------------|
| **Opportunity** | Initial lead or prospect |
| **Quoting** | Preparing and submitting quotes |
| **Won Awaiting Contract** | Quote accepted, contract pending |
| **Contracted** | Active contract in place |

### Job Statuses
- **Active** - Currently in progress
- **On Hold** - Temporarily paused
- **Pending Start** - Awaiting commencement
- **Started** - Work has begun
- **Completed** - Job finished
- **Archived** - Filed away for records

### Job Edit Dialog Tabs
- **Details** - Basic job information (name, number, client, address)
- **Production** - Manufacturing settings (cycle times, levels, production windows)
- **Scheduling** - Timeline and delivery scheduling settings
- **Audit** - View history of all changes made to this job`,
    keywords: ["jobs", "projects", "contracts", "phases", "status"],
    category: "Jobs",
    pageRoute: "/admin/jobs",
  },
  {
    key: "page.panels",
    scope: "PAGE",
    title: "Panel Register",
    shortText: "View and manage all panels across jobs with lifecycle tracking.",
    bodyMd: `## Panel Register

The Panel Register provides a comprehensive view of all panels in the system. Track panels through their entire lifecycle from registration to delivery.

### Buttons & Actions

- **Create Panel** - Opens a form to register a new panel with mark, type, dimensions, and job assignment
- **Import** - Upload an Excel file to bulk import panels for a job
- **Download Template** - Get an Excel template for panel import
- **Print Panel List** - Generate a formatted printable panel list (opens in new window for printing)
- **Consolidate Panels** - Select multiple panels to combine into a single consolidated panel
- **Back** (arrow icon) - Return to the Jobs page when viewing panels for a specific job
- **Search** - Find panels by their panel mark
- **Job Filter** - Show only panels for a specific job
- **Factory Filter** - Show only panels assigned to a specific factory
- **Status Filter** - Filter by panel production status
- **Panel Type Filter** - Filter by panel type (Wall, Column, Cube Base, etc.)
- **Level Filter** - Filter by building level
- **List View / Summary View** - Toggle between a detailed list and a summary overview
- **Group by Panel Type** - Organise panels by their type
- **Group by Level** - Organise panels by building level
- **Collapse/Expand** - Click group headers to show or hide panels within that group
- **QR Code** (QR icon) - Generate a QR code for a specific panel
- **Panel Chat** (message icon) - Open the chat thread for a specific panel
- **Panel Documents** (document icon) - View documents linked to a specific panel
- **Page Navigation** - Navigate between pages when there are many panels (First, Previous, Next, Last)

### Panel Lifecycle Stages
Panels progress through 14 stages from registration to delivery, including: Registered, Drafted, Checked, Approved for Production, Scheduled, Reo Scheduled, Reo Delivered, Cast, Stripped, Cured, Ready for Loading, Loaded, Delivered, and Erected.

### View Modes

| Mode | Description |
|------|-------------|
| **List View** | Shows all panel details in a table format |
| **Summary View** | Shows counts and statistics grouped by status, type, or level |`,
    keywords: ["panels", "precast", "concrete", "production", "lifecycle", "register"],
    category: "Panels",
    pageRoute: "/admin/panels",
  },
  {
    key: "page.panel-details",
    scope: "PAGE",
    title: "Panel Details",
    shortText: "View detailed information, chat, documents, and production history for a specific panel.",
    bodyMd: `## Panel Details

View all information about a single panel including its specifications, production status, linked documents, and communication history.

### What You Will See
- **Panel Specifications** - Dimensions (width, height, thickness), area, volume, mass, and concrete strength
- **Production Status** - Current lifecycle stage and status history
- **Job Information** - Which job and building level the panel belongs to
- **Chat Thread** - Conversation history specific to this panel
- **Documents** - All documents linked to this panel
- **QR Code** - Unique QR code for scanning and identification
- **Audit Trail** - History of all status changes and updates

### Tips
- Use the QR code feature for quick panel identification on site
- The chat thread lets your team discuss issues specific to this panel
- Document links show all drawings, inspection reports, and photos related to this panel`,
    keywords: ["panel", "details", "specifications", "production", "history"],
    category: "Panels",
    pageRoute: "/panel/:id",
  },
  {
    key: "page.documents",
    scope: "PAGE",
    title: "Document Register",
    shortText: "Manage project documents with version control and bundles.",
    bodyMd: `## Document Register

Centralised document management system with version tracking, bundles, and full search capability.

### Buttons & Actions

- **Upload Document** - Opens a dialog to upload a new document. Select the file, assign it to a job, and set its category, discipline, and status
- **Create Bundle** - Group related documents together into a bundle for easy sharing
- **Toggle Filters** - Show or hide the filter panel for advanced searching
- **Search** - Find documents by title, number, or description
- **Clear Filters** - Remove all active filters
- **View Bundles** - Switch to the document bundles view
- **Visual Overlay** - Open the visual comparison tool to overlay two document versions
- **Email Documents** - Select multiple documents and send them via email
- **Previous/Next Page** - Navigate between pages of results when you have many documents

### Filter Options
- **Job** - Filter by specific job
- **Category** - Filter by document category
- **Discipline** - Filter by discipline (Architectural, Structural, etc.)
- **Type** - Filter by document type
- **Status** - Filter by revision status (Draft, IFA, IFC, Approved)

### Document Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | Initial version, not yet reviewed |
| **IFA** | Issued for Approval |
| **IFC** | Issued for Construction |
| **Approved** | Formally approved and finalised |

### Features
- **Version Control** - Track document revisions automatically
- **Document Bundles** - Group related documents for sharing via QR codes
- **Entity Linking** - Link documents to specific jobs, panels, or other records
- **Preview** - Click any document to view or download it`,
    keywords: ["documents", "files", "version control", "bundles", "upload"],
    category: "Documents",
    pageRoute: "/documents",
  },
  {
    key: "page.photo-gallery",
    scope: "PAGE",
    title: "Photo Gallery",
    shortText: "Browse and manage project photos with filtering and grouping.",
    bodyMd: `## Photo Gallery

Visual gallery for all image files stored in the document register. Browse, search, filter, and share project photos.

### Buttons & Actions

- **Toggle Filters** - Show or hide the filter panel
- **Search** - Find photos by title or description
- **Select All** - Select all visible photos for bulk actions
- **Deselect All** - Clear all photo selections
- **Email Photos** - Send selected photos via email to specified recipients
- **Group By** dropdown - Group photos by Job, Discipline, Type, or Status
- **Include Chat Photos** toggle - Include or exclude photos uploaded via chat
- **Clear Filters** - Remove all active filters
- **Previous/Next Page** - Navigate between pages of photos

### Photo Viewer (Full-Screen)
When you click a photo, it opens in full-screen mode with these controls:
- **Previous** (left arrow) - View the previous photo
- **Next** (right arrow) - View the next photo
- **Download** - Download the current photo to your device
- **Delete** - Remove the photo from the system (requires confirmation)
- **Close** - Exit full-screen view

### Multi-Select Features
Click the checkbox on photos to select multiple, then use bulk actions:
- Email selected photos to colleagues or clients
- Download selected photos as individual files`,
    keywords: ["photos", "images", "gallery", "thumbnails", "pictures"],
    category: "Documents",
    pageRoute: "/photo-gallery",
  },
  {
    key: "page.checklists",
    scope: "PAGE",
    title: "Checklists",
    shortText: "Complete quality and safety checklists for jobs and panels.",
    bodyMd: `## Checklists

Digital checklist system for quality inspections and safety checks. Complete pre-pour and post-pour inspections directly on your device.

### Buttons & Actions

- **New Checklist** - Opens a dialog to start a new checklist. Select the template, assign to a job and panel, then begin filling it in
- **Create First Checklist** - Appears when no checklists exist yet, same as New Checklist
- **Search** - Find checklists by job, panel, or template name
- **Filter by Status** - Show only Open, Completed, or all checklists
- **Filter by Template** - Show only checklists of a specific template type
- **Delete** (trash icon) - Remove an incomplete checklist (requires confirmation)

### Checklist Statuses

| Status | Meaning |
|--------|---------|
| **Open** | Checklist has been started but not yet completed |
| **Completed** | All required fields filled in and checklist submitted |

### Features
- **Pre-Pour Inspections** - Quality checks before concrete is poured
- **Post-Pour Inspections** - Quality checks after concrete has cured
- **Conditional Fields** - Some fields only appear based on your answers to previous questions
- **Photo Evidence** - Capture or upload photos as part of the inspection
- **Linked to Panels** - Each checklist is associated with a specific panel for traceability`,
    keywords: ["checklists", "quality", "inspection", "safety", "pre-pour"],
    category: "Checklists",
    pageRoute: "/checklists",
  },
  {
    key: "page.checklist-fill",
    scope: "PAGE",
    title: "Fill Checklist",
    shortText: "Complete checklist fields, capture photos, and submit inspections.",
    bodyMd: `## Fill Checklist

This page is where you fill in the actual checklist fields for an inspection. Work through each section, answer questions, and capture photo evidence as required.

### Buttons & Actions

- **Back** (arrow icon) - Return to the checklists list without saving
- **Save** - Save your progress without completing the checklist. You can return later to finish it
- **Complete** - Submit the checklist as finished. This will lock the checklist and prevent further edits. A confirmation dialog will appear to make sure you're ready
- **Cancel** (in confirmation dialog) - Go back to continue editing
- **Confirm Complete** - Finalise and lock the checklist

### How to Fill a Checklist
1. Work through each section from top to bottom
2. Answer each question using the provided input (dropdown, text, number, checkbox, etc.)
3. Some questions are conditional - they only appear based on your previous answers
4. Take or upload photos where photo evidence is required
5. Click **Save** at any time to save your progress
6. When all required fields are complete, click **Complete** to submit

### Tips
- Required fields are marked and must be filled before completing
- You can save partially completed checklists and come back later
- Once completed, checklists cannot be edited`,
    keywords: ["checklist", "fill", "inspection", "complete", "submit"],
    category: "Checklists",
    pageRoute: "/checklist/:id",
  },
  {
    key: "page.logistics",
    scope: "PAGE",
    title: "Logistics",
    shortText: "Manage load lists, deliveries, and transport scheduling.",
    bodyMd: `## Logistics

Plan and track panel deliveries from factory to site. Create load lists, record delivery details, and manage returned loads.

### Buttons & Actions

- **Create Load List** - Opens a form to create a new load list. Select a job, choose panels, and set the factory and scheduled date
- **Create from Ready Panels** - Select panels from the "Ready for Loading" section and automatically create a load list for them
- **Export PDF** - Generate a PDF report of all load lists for printing or sharing
- **Factory Filter** - Show only load lists and panels for a specific factory location
- **Expand/Collapse** - Click on a load list to show or hide its panel details
- **Record Delivery** - Open a form to log delivery details (truck rego, times, docket numbers)
- **Record Return** - Open a form to record a load that was returned to the factory
- **Delete Load List** (trash icon) - Remove a load list (requires confirmation)
- **Confirm Delete** - Permanently delete the selected load list

### Ready for Loading Section
This section shows all panels that have reached "Ready for Loading" status:
- **Select panels** using checkboxes to choose which panels to include in a new load list
- **Select All** - Select all ready panels at once
- **Create Load List from Selected** - Automatically creates a load list from your selected panels

### Delivery Recording Fields

| Field | Description |
|-------|-------------|
| **Docket Number** | Transport docket reference |
| **Truck Rego** | Truck registration number |
| **Trailer Rego** | Trailer registration number |
| **Delivery Date** | Date of delivery |
| **Times** | Leave depot, arrive site, first lift, last lift, return times |

### Load Return Types
- **Full Return** - Entire load returned to factory
- **Partial Return** - Some panels returned, others delivered successfully`,
    keywords: ["logistics", "delivery", "transport", "load lists", "trucks"],
    category: "Logistics",
    pageRoute: "/logistics",
  },
  {
    key: "page.production-slots",
    scope: "PAGE",
    title: "Production Slots",
    shortText: "Schedule and manage factory production slots for panel casting.",
    bodyMd: `## Production Slots

Schedule panel production across factory beds. Plan when each panel will be cast and track production capacity.

### Buttons & Actions

- **Generate Slots** - Automatically generate production slots based on job scheduling settings. Opens a dialog where you select the job and date range
- **Confirm Generate** - Create the generated slots after reviewing the preview
- **View Grid** - Switch to a grid/table view of production slots
- **View Calendar** - Switch to a calendar view showing slots on a timeline
- **Export PDF** - Download a PDF of the current view for printing or sharing
- **Today** - Jump the calendar view to today's date
- **Previous/Next** (arrow buttons) - Navigate forward or backward in time
- **Week/Month** toggle - Switch the calendar between weekly and monthly views
- **Adjust Slot** - Modify the date or bed assignment of an existing slot

### Grid View Features
- See all slots in a table format with job, panel, date, bed, and status columns
- Sort and filter by any column
- Colour-coded by job for easy identification

### Calendar View Features
- Visual timeline showing when each panel is scheduled
- Drag-and-drop to reschedule (where supported)
- Colour-coded by job with production slot colours

### Slot Statuses

| Status | Meaning |
|--------|---------|
| **Scheduled** | Slot created and assigned |
| **Booked** | Confirmed for production |
| **Completed** | Panel has been cast |`,
    keywords: ["production", "slots", "scheduling", "factory", "casting", "calendar"],
    category: "Production",
    pageRoute: "/production-slots",
  },
  {
    key: "page.production-schedule",
    scope: "PAGE",
    title: "Production Schedule",
    shortText: "Overview of production timeline and panel manufacturing progress.",
    bodyMd: `## Production Schedule

Visualise and manage the overall production timeline across all factories.

### Buttons & Actions

- **Toggle Ready for Production** - Show or hide panels that are ready to be scheduled for production
- **Add to Schedule** - Select panels and assign them to production slots. Opens a dialog to choose the date and factory bed
- **Cancel** - Close the scheduling dialog without making changes
- **Confirm Add** - Assign the selected panels to the chosen production slot
- **Toggle Production Register** - Show or hide the full production register view
- **Factory Filter** - View production for a specific factory only
- **Job Filter** - View production for a specific job only

### Views
- **Timeline View** - See production activities laid out on a calendar timeline
- **Register View** - See all panels and their production status in a table

### Tips
- Use the factory filter to focus on one location at a time
- Panels must be at the correct lifecycle stage before they can be added to the production schedule
- Multi-factory support allows you to schedule across different locations`,
    keywords: ["production", "schedule", "timeline", "manufacturing"],
    category: "Production",
    pageRoute: "/production-schedule",
  },
  {
    key: "page.drafting-program",
    scope: "PAGE",
    title: "Drafting Program",
    shortText: "Track drafting progress and time allocation across jobs.",
    bodyMd: `## Drafting Program

Monitor and manage the drafting workflow for panel designs. Track who is working on which jobs, time spent, and overall progress.

### Buttons & Actions

- **Generate Program** - Automatically create a drafting program based on job requirements and available resources
- **Assign Drafter** - Assign a team member to work on drafting for a specific job
- **Confirm Assign** - Save the drafter assignment
- **Update Status** - Change the drafting status for a job (e.g., Not Started, In Progress, Complete)
- **Confirm Status** - Save the status update
- **Job Filter** - Focus on a specific job's drafting progress
- **Date Range** - Filter by time period

### Drafting Statuses

| Status | Meaning |
|--------|---------|
| **Not Started** | Drafting work has not begun |
| **In Progress** | Currently being drafted |
| **Under Review** | Drawings submitted for checking |
| **Complete** | All drawings finished |

### Features
- View drafting status by job with progress indicators
- Track time spent on CAD and Revit work
- Monitor drafting milestones and deadlines
- Allocate resources across multiple projects`,
    keywords: ["drafting", "CAD", "Revit", "design", "drawings"],
    category: "Production",
    pageRoute: "/drafting-program",
  },
  {
    key: "page.procurement-reo-scheduling",
    scope: "PAGE",
    title: "Reo Scheduling",
    shortText: "Manage reinforcement steel procurement and scheduling.",
    bodyMd: `## Reo Scheduling

Schedule and track reinforcement steel orders for panel production. Coordinate procurement with the production timeline.

### Features
- Link reinforcement orders to production slots
- Track order status and expected delivery dates
- Manage supplier relationships for steel procurement
- Coordinate with the production timeline to ensure materials arrive on time

### How It Works
1. Production slots determine when panels need to be cast
2. Reo scheduling ensures steel is ordered and delivered before casting
3. Track delivery status to avoid production delays

### Tips
- Keep delivery dates aligned with production slot dates
- Use the supplier management page to maintain up-to-date supplier contact information
- Coordinate with your logistics team for delivery scheduling`,
    keywords: ["reo", "reinforcement", "steel", "procurement", "scheduling"],
    category: "Production",
    pageRoute: "/procurement-reo",
  },
  {
    key: "page.daily-reports",
    scope: "PAGE",
    title: "Drafting Register",
    shortText: "Submit and review daily time logs for drafting activities.",
    bodyMd: `## Drafting Register

Daily time logging system for tracking drafting hours. Log your time against specific jobs and tasks, then submit for approval.

### Buttons & Actions

- **Start New Day** - Create a new daily log for a specific date. Opens a date picker to select which day
- **Create New Day** - Confirm creation of the daily log after selecting the date
- **Cancel** - Close the new day dialog
- **Export PDF** - Download a PDF of your daily logs for the selected period
- **Date Selector** - Choose the date range to display logs for
- **Toggle Allocated** - Show or hide time that has been allocated to specific jobs
- **Click a Day Card** - Open the detailed view for that day to see or edit individual time entries

### Daily Log Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | You are still editing this day's entries |
| **Submitted** | You have submitted for manager approval |
| **Approved** | Your manager has approved the timesheet |
| **Rejected** | Your manager has sent it back for corrections |

### Workflow
1. Create a new day or click an existing one
2. Add time entries with job, work type, and duration
3. Review your totals for the day
4. Submit for manager approval when complete`,
    keywords: ["daily", "time", "log", "timesheet", "hours", "drafting"],
    category: "Time Management",
    pageRoute: "/daily-reports",
  },
  {
    key: "page.daily-report-detail",
    scope: "PAGE",
    title: "Daily Report Detail",
    shortText: "View and edit time entries for a specific day, submit for approval, or export.",
    bodyMd: `## Daily Report Detail

Detailed view of a single day's time entries. Add, edit, and manage individual time rows, then submit for approval.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Drafting Register list
- **Export PDF** - Generate a PDF report of this day's time entries for printing or records
- **Add Entry** - Open the manual time entry page to add a new time row for this day
- **Merge** - Combine duplicate or split entries for the same job into a single entry
- **Submit Day** - Submit all entries for this day for manager approval. Opens a confirmation dialog
- **Delete Day** - Remove this entire day's log and all its entries (requires confirmation)
- **Edit Row** (pencil icon) - Edit an existing time entry inline
- **Save Row** - Save changes to an edited time entry
- **Cancel Edit** - Discard changes to an edited row
- **Delete Row** (trash icon) - Remove a single time entry (requires confirmation)

### Time Entry Fields

| Field | Description |
|-------|-------------|
| **Job** | Which job the time was spent on |
| **Work Type** | Category of work (General, Client Change, Error/Rework) |
| **Panel** | Specific panel worked on (optional) |
| **Start/End Time** | When the work period started and ended |
| **Duration** | Total hours for this entry |
| **Notes** | Description of what was done |

### Tips
- You can edit entries until the day is submitted
- Once submitted, entries are locked until approved or rejected
- If rejected, you can make corrections and resubmit`,
    keywords: ["daily", "report", "detail", "time", "entries", "submit"],
    category: "Time Management",
    pageRoute: "/daily-report/:id",
  },
  {
    key: "page.manual-entry",
    scope: "PAGE",
    title: "Manual Time Entry",
    shortText: "Manually enter time for past days or make corrections.",
    bodyMd: `## Manual Time Entry

Add or correct time entries for any date. Use this when you need to log time after the fact or fix existing entries.

### When to Use
- Forgot to log time on a specific day
- Need to make corrections to existing entries
- Adding time for activities not captured by the timer
- Splitting time across multiple jobs for a single work period

### Features
- Select any past date to log time against
- Choose the job, work type, and panel
- Enter start and end times or just a duration
- Add notes describing the work performed

### Tips
- Check your daily report after adding manual entries to verify totals
- Entries on already-submitted days may need to be handled differently - talk to your manager`,
    keywords: ["manual", "time", "entry", "correction"],
    category: "Time Management",
    pageRoute: "/manual-entry",
  },
  {
    key: "page.weekly-job-logs",
    scope: "PAGE",
    title: "Weekly Job Logs",
    shortText: "Weekly summary reports for job progress and activity.",
    bodyMd: `## Weekly Job Logs

Generate and review weekly summaries of job activity. See total hours, progress, and key achievements for each job during the week.

### Features
- Aggregate time data by job and week
- Include EOT (Extension of Time) claims
- Track weekly milestones and achievements
- Export reports for sharing with stakeholders

### How to Use
1. Select the week you want to review
2. Choose a specific job or view all jobs
3. Review the summary of hours and activities
4. Export or share the report as needed`,
    keywords: ["weekly", "report", "summary", "job logs"],
    category: "Reports",
    pageRoute: "/weekly-job-logs",
  },
  {
    key: "page.purchase-orders",
    scope: "PAGE",
    title: "Purchase Orders",
    shortText: "Create and manage purchase orders with approval workflows.",
    bodyMd: `## Purchase Orders

Full purchase order management with line items, approval workflows, and PDF generation.

### Buttons & Actions

- **Create Purchase Order** - Opens a new PO form to start building a purchase order
- **Search** - Find purchase orders by PO number, supplier, or job
- **Filter by Status** - Show only Draft, Submitted, Approved, or Rejected POs
- **Filter by Job** - Show POs for a specific job
- **Click a PO** - Open the full purchase order form to view or edit it
- **Export** - Download purchase orders as a report

### Purchase Order Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | PO is being created, not yet submitted |
| **Submitted** | PO has been sent for approval |
| **Approved** | PO has been approved for purchasing |
| **Rejected** | PO has been sent back with feedback |
| **Received** | Goods have been received against this PO |

### Features
- Create POs linked to jobs and suppliers
- Add multiple line items with quantities, unit prices, and descriptions
- Customisable terms and conditions with rich text editing
- Track PO status through the approval workflow
- Receive goods against POs
- Print or download POs as PDFs`,
    keywords: ["purchase orders", "PO", "procurement", "buying"],
    category: "Finance",
    pageRoute: "/purchase-orders",
  },
  {
    key: "page.purchase-order-form",
    scope: "PAGE",
    title: "Purchase Order Form",
    shortText: "Create, edit, and manage individual purchase orders with line items and attachments.",
    bodyMd: `## Purchase Order Form

The detailed form for creating or editing a purchase order. Add line items, set terms, attach files, and manage the approval workflow.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Purchase Orders list
- **Add Line** - Add a new line item to the purchase order (item, quantity, unit price, description)
- **Remove Line** (trash icon) - Remove a line item from the PO
- **Browse Files** - Upload file attachments (quotes, specifications, drawings) to the PO
- **Remove Attachment** (X icon) - Remove an uploaded file
- **Save Draft** - Save the current state without submitting. You can come back and edit later
- **Submit** - Send the PO for approval. The PO becomes read-only until reviewed
- **Approve** - (Managers/Admins) Approve the submitted PO for purchasing
- **Reject** - (Managers/Admins) Send the PO back with feedback for corrections
- **Confirm Reject** - Submit the rejection with a reason
- **Print** - Generate a formatted PDF of the purchase order for printing or emailing
- **Delete** - Permanently remove the purchase order (requires confirmation)
- **Receive Items** - Record receipt of goods against approved PO line items
- **Cancel Receiving** - Close the goods receiving mode

### Line Item Fields

| Field | Description |
|-------|-------------|
| **Item** | Select from the item catalogue or type a custom description |
| **Description** | Detailed description of the item |
| **Quantity** | Number of items ordered |
| **Unit** | Unit of measure (each, metre, kg, etc.) |
| **Unit Price** | Cost per unit |
| **Total** | Automatically calculated (Qty x Unit Price) |
| **Required Date** | When the items are needed by |

### Tips
- Save as draft frequently to avoid losing work
- Attach relevant quotes or specifications for the approver to review
- The PO total updates automatically as you add or modify line items`,
    keywords: ["purchase order", "form", "line items", "approval", "PDF"],
    category: "Finance",
    pageRoute: "/purchase-orders/:id",
  },
  {
    key: "page.sales-pipeline",
    scope: "PAGE",
    title: "Sales Pipeline",
    shortText: "Track sales opportunities from lead to won or lost.",
    bodyMd: `## Sales Pipeline

Visual pipeline for managing pre-sales opportunities. Track leads from initial contact through to won or lost.

### Buttons & Actions

- **Create Opportunity** - Add a new sales opportunity with details like company name, contact, estimated value, and probability
- **Search** - Find opportunities by name, company, or contact
- **Filter by Status** - Show opportunities at specific pipeline stages
- **Filter by Date Range** - Show opportunities within a time period
- **Click Opportunity Card** - Open the full details to edit or update the opportunity
- **Convert to Job** - When an opportunity is won, convert it directly into a job record

### Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Lead** | Initial contact or enquiry |
| **Qualification** | Assessing fit and requirements |
| **Proposal** | Quote or proposal submitted |
| **Negotiation** | Terms being discussed |
| **Won** | Deal closed successfully |
| **Lost** | Opportunity did not proceed |

### Features
- Kanban-style pipeline view with drag-and-drop
- Track opportunity value and probability
- Log sales activities and follow-up dates
- View pipeline value totals by stage
- Convert won opportunities to jobs automatically`,
    keywords: ["sales", "pipeline", "opportunities", "leads", "CRM"],
    category: "Sales",
    pageRoute: "/sales-pipeline",
  },
  {
    key: "page.contracts",
    scope: "PAGE",
    title: "Contract Hub",
    shortText: "Manage job contracts, retention tracking, and contract details.",
    bodyMd: `## Contract Hub

Centralised contract management for all jobs. View contract values, retention amounts, and access detailed contract information.

### Buttons & Actions

- **Search** - Find contracts by job name or number
- **Click Contract Card** - Open the detailed contract view for a specific job
- **Filter by Status** - Show only active, completed, or all contracts

### What You Will See
- List of all jobs with contract information
- Contract value and retention summary for each job
- Quick access to detailed contract editing

### Features
- View and edit contract details for each job
- Track contract retention amounts and release schedules
- Monitor contract milestones and progress
- Link to progress claims for each contract`,
    keywords: ["contracts", "retention", "agreement", "terms"],
    category: "Finance",
    pageRoute: "/contracts",
  },
  {
    key: "page.contract-detail",
    scope: "PAGE",
    title: "Contract Detail",
    shortText: "View and edit contract information, upload documents, and use AI contract analysis.",
    bodyMd: `## Contract Detail

Detailed view of a single contract. Edit contract values, upload project documents, and use AI to analyse contract documents.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Contract Hub
- **Save** - Save any changes you have made to the contract details
- **Add Project Documents** - Upload documents related to this contract (specifications, drawings, etc.)
- **Add Contract Documents (AI)** - Upload a contract PDF for AI-powered analysis. The system will extract key terms, values, and conditions automatically
- **Browse Files** - Select a file from your device to upload
- **Select AI File** - Choose a contract document for AI analysis
- **Apply AI Fields** - Accept the AI-extracted contract details and apply them to the form
- **View Document** (eye icon) - Open a linked document in a new tab
- **Download Document** (download icon) - Download a linked document to your device
- **Upload Docs** (in Documents tab) - Add more documents from the Documents tab

### Contract Fields

| Field | Description |
|-------|-------------|
| **Contract Value** | Total value of the contract |
| **Retention %** | Percentage held as retention |
| **Retention Release** | Schedule for retention release |
| **Defects Liability Period** | Timeframe for defect obligations |
| **Contract Type** | Type of contract (Lump Sum, Cost Plus, etc.) |

### AI Contract Analysis
Upload a contract PDF and the AI will automatically extract:
- Contract value and payment terms
- Retention percentages and release conditions
- Key dates and milestones
- Special conditions and clauses

You can review the AI suggestions and choose to apply them or make manual adjustments.`,
    keywords: ["contract", "detail", "AI", "analysis", "documents", "retention"],
    category: "Finance",
    pageRoute: "/contracts/:id",
  },
  {
    key: "page.progress-claims",
    scope: "PAGE",
    title: "Progress Claims",
    shortText: "Submit and track progress payment claims for jobs.",
    bodyMd: `## Progress Claims

Manage progress payment claims throughout the job lifecycle. Create claims, track approvals, and monitor retention.

### Buttons & Actions

- **Create Claim** - Start a new progress claim for a job
- **Search** - Find claims by job name or claim number
- **Filter by Status** - Show only Draft, Submitted, Approved, or Rejected claims
- **Filter by Job** - Show claims for a specific job
- **Click Claim** - Open the full progress claim form to view or edit

### Claim Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | Claim is being prepared |
| **Submitted** | Sent for client/manager approval |
| **Approved** | Claim approved for payment |
| **Rejected** | Claim returned for revision |

### Features
- Create and submit progress claims linked to contracts
- Automatic retention calculations based on contract terms
- Track claim history and running totals
- View cumulative claimed amounts vs contract value`,
    keywords: ["progress claims", "payments", "billing", "retention"],
    category: "Finance",
    pageRoute: "/progress-claims",
  },
  {
    key: "page.progress-claim-form",
    scope: "PAGE",
    title: "Progress Claim Form",
    shortText: "Create or edit a progress payment claim with line items and approval workflow.",
    bodyMd: `## Progress Claim Form

The detailed form for creating or editing a progress claim. Add claim items, set amounts, and manage the approval process.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Progress Claims list
- **Save** - Save the current claim as a draft without submitting
- **Submit** - Send the claim for approval. The claim becomes read-only until reviewed
- **Approve** - (Managers/Admins) Approve the submitted claim
- **Reject** - (Managers/Admins) Send the claim back for corrections
- **Cancel Reject** - Close the rejection dialog without rejecting
- **Confirm Reject** - Submit the rejection with a reason explaining what needs to be changed

### Claim Fields

| Field | Description |
|-------|-------------|
| **Job** | The job this claim is for |
| **Claim Period** | The date range this claim covers |
| **Description** | Summary of work completed |
| **Claimed Amount** | Total amount being claimed |
| **Retention** | Automatically calculated retention deduction |
| **Net Claim** | Amount after retention deduction |

### Workflow
1. Select the job and claim period
2. Enter the claim details and amounts
3. Save as draft to review
4. Submit for approval when ready
5. Manager reviews and approves or rejects
6. If rejected, make corrections and resubmit`,
    keywords: ["progress claim", "form", "approval", "submit", "payment"],
    category: "Finance",
    pageRoute: "/progress-claims/:id",
  },
  {
    key: "page.retention-report",
    scope: "PAGE",
    title: "Retention Report",
    shortText: "View retention amounts held across all contracts and track release schedules.",
    bodyMd: `## Retention Report

Overview of all retention amounts held across your contracts. Track when retention is due for release and monitor outstanding balances.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Progress Claims page

### What You Will See
- **Job Name** - Which job the retention relates to
- **Contract Value** - Total contract value
- **Retention %** - Percentage being held
- **Retention Amount** - Dollar value of retention held
- **Release Schedule** - When retention is due for release
- **Status** - Whether retention has been released or is still held

### Tips
- Use this report to track upcoming retention releases
- Compare retention amounts across all active contracts
- Monitor total retention exposure for cash flow planning`,
    keywords: ["retention", "report", "contracts", "release", "held"],
    category: "Finance",
    pageRoute: "/retention-report",
  },
  {
    key: "page.broadcast",
    scope: "PAGE",
    title: "Broadcast Messages",
    shortText: "Send broadcast messages to teams via SMS, WhatsApp, or email.",
    bodyMd: `## Broadcast Messages

Send important announcements to your team through multiple communication channels simultaneously.

### Buttons & Actions

- **Send Broadcast** - Compose and send a new broadcast message
- **Channel Selection** (SMS, WhatsApp, Email) - Choose which channels to send through
- **Select Recipients** - Choose which team members or groups will receive the message
- **Select All** - Select all available recipients
- **Deselect All** - Clear all recipient selections
- **Send** - Dispatch the message through selected channels
- **View History** - See previously sent broadcast messages

### Channels

| Channel | Description |
|---------|-------------|
| **SMS** | Text message sent to mobile phones |
| **WhatsApp** | Message sent via WhatsApp |
| **Email** | Email sent to work email addresses |

### Tips
- You can send through multiple channels at once
- Messages are logged for reference and record-keeping
- Ensure team members have updated contact details for reliable delivery`,
    keywords: ["broadcast", "messaging", "SMS", "WhatsApp", "announcements"],
    category: "Communication",
    pageRoute: "/broadcast",
  },
  {
    key: "page.kpi-dashboard",
    scope: "PAGE",
    title: "KPI Dashboard",
    shortText: "Key performance indicators and analytics for management oversight.",
    bodyMd: `## KPI Dashboard

Comprehensive analytics dashboard for monitoring production, financial, and team performance with interactive charts.

### Buttons & Actions

- **Period Selector** - Choose the time period for data: This Week, Last Week, This Month, Last Month, or Custom
- **Custom Date Range** - Set specific start and end dates when using Custom period
- **Tab Selector** (Production, Cubes, Financial, Drafting, Cost Analysis, Labour) - Switch between different analytics views
- **Export PDF** - Generate a professional PDF report of the current dashboard view with company branding
- **Component Filter** (Cost Analysis tab) - Filter cost analysis data by specific cost component

### Dashboard Tabs

| Tab | What It Shows |
|-----|--------------|
| **Production** | Daily panel output, volume, and counts by panel type |
| **Cubes** | Cube-specific production (Base, Ring, Landing) with volume tracking |
| **Financial** | Revenue, costs, and profit over time |
| **Drafting** | Active hours, idle hours, and time utilisation |
| **Cost Analysis** | Breakdown of costs by component with revenue comparison |
| **Labour** | Estimated vs actual labour costs with variance tracking |

### Charts
Each tab displays interactive charts showing trends over the selected period. Hover over data points to see exact values.

### PDF Export
The export creates a professional report with:
- Company logo and branding
- Selected date range clearly displayed
- All charts and metrics from the current view
- Generation date and time stamp`,
    keywords: ["KPI", "analytics", "performance", "metrics", "dashboard", "charts"],
    category: "Reports",
    pageRoute: "/kpi-dashboard",
  },
  {
    key: "page.manager-review",
    scope: "PAGE",
    title: "Manager Review",
    shortText: "Review and approve submitted timesheets and daily logs.",
    bodyMd: `## Manager Review

Approve or reject team member timesheets and daily logs. This page shows all submissions waiting for your review.

### Buttons & Actions

- **Approve** - Approve a submitted timesheet, confirming the hours and activities are correct
- **Reject** - Send the timesheet back to the team member for corrections with feedback
- **View Details** - Open the full daily report to review individual time entries
- **Filter by User** - Show submissions from a specific team member
- **Filter by Date** - Show submissions for a specific date range
- **Filter by Status** - Show Pending, Approved, or Rejected submissions

### Review Workflow
1. Team members submit their daily logs
2. Submissions appear in your review queue
3. Click to review hours, activities, and notes
4. Approve if correct, or reject with feedback explaining what needs to change
5. Rejected submissions return to the team member for correction

### Tips
- Review submissions regularly to avoid backlogs
- Provide clear feedback when rejecting so team members know what to fix
- Approved timesheets flow into weekly wage calculations`,
    keywords: ["review", "approval", "manager", "timesheet"],
    category: "Time Management",
    pageRoute: "/manager/review",
  },
  {
    key: "page.production-report",
    scope: "PAGE",
    title: "Production Report",
    shortText: "Detailed production performance reports and analysis.",
    bodyMd: `## Production Report

Analyse production output and efficiency. View daily summaries, track panel completion rates, and compare performance across time periods.

### Buttons & Actions

- **Date Range Selector** - Choose the period to analyse
- **Factory Filter** - View production for a specific factory
- **Job Filter** - View production for a specific job
- **Export** - Download the production report as a PDF or Excel file
- **Click a Day** - Open the detailed production report for that specific day

### What You Will See
- Daily panel counts and volumes
- Production by panel type
- Factory utilisation metrics
- Trend charts showing output over time
- Comparison against targets

### Tips
- Use the factory filter to compare performance between locations
- Click individual days to drill down into detailed production data
- Export reports for management presentations`,
    keywords: ["production", "report", "analysis", "output"],
    category: "Reports",
    pageRoute: "/production-report",
  },
  {
    key: "page.production-report-detail",
    scope: "PAGE",
    title: "Production Report Detail",
    shortText: "View and manage detailed production entries for a specific day.",
    bodyMd: `## Production Report Detail

Detailed view of production for a single day. Add, edit, and manage individual production entries.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Production Report list
- **Export PDF** - Generate a PDF report of this day's production for printing or records
- **Add Entry** - Create a new production entry for this day, specifying the panel, job, and production details
- **Delete Day** - Remove the entire day's production record (requires confirmation)
- **Mark All Completed** - Set all entries for this day to completed status
- **Edit Entry** (pencil icon) - Modify an existing production entry
- **Delete Entry** (trash icon) - Remove a single production entry
- **Save Entry** - Save changes to a new or edited entry
- **Confirm Delete** - Permanently delete an entry or the entire day
- **Confirm Delete Day** - Permanently remove all production records for this day

### Production Entry Fields

| Field | Description |
|-------|-------------|
| **Job** | Which job the panel belongs to |
| **Panel** | The specific panel that was produced |
| **Status** | Production status (Cast, Stripped, Cured, etc.) |
| **Notes** | Any notes about the production process |

### Tips
- Add entries as panels are produced throughout the day
- Use "Mark All Completed" at the end of the day to finalise
- Export PDFs for daily production records`,
    keywords: ["production", "report", "detail", "entries", "daily"],
    category: "Reports",
    pageRoute: "/production-report/:id",
  },
  {
    key: "page.checklist-reports",
    scope: "PAGE",
    title: "Checklist Reports",
    shortText: "View completion statistics and trends for quality checklists.",
    bodyMd: `## Checklist Reports

Track checklist completion rates and quality trends across all jobs and templates.

### Features
- Completion rate statistics by job and template
- Filter by job, template, and date range
- Identify outstanding inspections that need attention
- Track quality trends over time with charts
- Export reports for quality management reviews

### Tips
- Use filters to focus on specific jobs or inspection types
- Identify jobs with low completion rates that may need attention
- Track trends to spot quality improvements or concerns`,
    keywords: ["checklist", "reports", "quality", "statistics"],
    category: "Reports",
    pageRoute: "/checklist-reports",
  },
  {
    key: "page.reports",
    scope: "PAGE",
    title: "Reports",
    shortText: "General reporting tools and data exports.",
    bodyMd: `## Reports

Access various system reports and data exports for analysis and record-keeping.

### Available Reports
- **Time Tracking Summaries** - Total hours by user, job, or work type
- **Job Performance Reports** - Productivity metrics by job
- **Production Reports** - Panel output and manufacturing data
- **Financial Reports** - Revenue, costs, and profit analysis

### Export Options
- Export data to CSV for spreadsheet analysis
- Generate PDF reports for presentations and records
- Download formatted Excel files for payroll processing`,
    keywords: ["reports", "export", "data", "analysis"],
    category: "Reports",
    pageRoute: "/reports",
  },
  {
    key: "page.weekly-wages",
    scope: "PAGE",
    title: "Weekly Wages",
    shortText: "Weekly wage calculation and reporting for team members.",
    bodyMd: `## Weekly Wages

Calculate and review weekly wages based on approved time logs. Generate payroll-ready reports for your team.

### Features
- Automatic wage calculations based on approved timesheets
- Overtime tracking and penalty rate calculations
- Export for payroll processing in standard formats
- View breakdown by employee, job, or work type
- Filter by week, factory, or department

### Workflow
1. Team members submit daily logs
2. Managers approve timesheets
3. Approved hours automatically calculate wages
4. Review and export for payroll processing`,
    keywords: ["wages", "payroll", "salary", "weekly"],
    category: "Finance",
    pageRoute: "/weekly-wages",
  },
  {
    key: "page.downloads",
    scope: "PAGE",
    title: "Downloads",
    shortText: "Download software tools, plugins, and exported files.",
    bodyMd: `## Downloads

Access downloadable tools and plugins for integrating with the system.

### Available Downloads

| Download | Description |
|----------|-------------|
| **Revit Plugin** | Plugin for Autodesk Revit to integrate panel data |
| **AutoCAD Plugin** | Plugin for AutoCAD integration |
| **Desktop Agent** | Desktop application for time tracking and synchronisation |
| **Setup Guide** | Instructions for installing and configuring the tools |

### Buttons & Actions

- **Setup Guide** - View installation and configuration instructions
- **Download Revit** - Download the Revit plugin installer
- **Download AutoCAD** - Download the AutoCAD plugin installer
- **Download Agent** - Download the desktop time tracking agent`,
    keywords: ["downloads", "export", "files", "plugins", "tools"],
    category: "General",
    pageRoute: "/downloads",
  },
  {
    key: "page.admin.settings",
    scope: "PAGE",
    title: "Admin Settings",
    shortText: "Configure system-wide settings and preferences.",
    bodyMd: `## Admin Settings

Manage global system configuration including company branding, rates, scheduling defaults, and operational preferences.

### Buttons & Actions

#### Company Branding
- **Save Company Name** - Update the company name displayed throughout the system and on reports
- **Upload Logo** - Upload your company logo (used on PDF reports, print layouts, and system headers)
- **Remove Logo** - Delete the current company logo

#### Department Management
- **Add Department** - Create a new department for organising employees and work
- **Edit Department** (pencil icon) - Modify a department name
- **Delete Department** (trash icon) - Remove a department (requires confirmation)
- **Save** (in department dialog) - Save the new or edited department
- **Cancel** (in department dialog) - Close without saving changes

#### Scheduling Defaults
- **Save Week Start Day** - Set which day the work week begins on
- **Save Production Window Days** - Set the default number of days for production windows
- **Save IFC Days** - Set the default number of days to achieve IFC (Issued for Construction)
- **Save Days to Achieve IFC** - Set the standard lead time for IFC achievement
- **Save Production Days in Advance** - Set how far in advance production should be scheduled
- **Save Procurement Days in Advance** - Set how far in advance procurement should be initiated
- **Save Procurement Time Days** - Set the standard procurement lead time

#### Data Management
- **Delete by Category** - Select categories of data to delete in bulk (use with caution)
- **Validate** - Check what data would be affected before deleting
- **Confirm Delete** - Proceed with the bulk deletion after validation

### Tips
- Changes to settings take effect immediately for all users
- The company logo should be a clear image, ideally PNG format
- Scheduling defaults are used as starting values when creating new jobs - individual jobs can override these`,
    keywords: ["settings", "configuration", "admin", "preferences", "branding"],
    category: "Admin",
    pageRoute: "/admin/settings",
  },
  {
    key: "page.admin.users",
    scope: "PAGE",
    title: "User Management",
    shortText: "Add, edit, and manage user accounts and roles.",
    bodyMd: `## User Management

Manage system users, their roles, work hours, and access levels.

### Buttons & Actions

- **Add User** - Create a new user account. Fill in name, email, password, and assign a role
- **Edit User** (pencil icon) - Modify a user's profile, role, or settings
- **Save User** - Save changes to a new or edited user account
- **Deactivate/Activate** toggle - Enable or disable a user account without deleting it
- **Set Work Hours** - Configure standard work hours for wage calculations
- **Save Work Hours** - Save the work hour configuration

### User Roles

| Role | Access Level |
|------|-------------|
| **User** | Standard access to assigned features |
| **Manager** | Can approve timesheets and manage team members |
| **Admin** | Full system access including all settings and configuration |

### User Fields

| Field | Description |
|-------|-------------|
| **Name** | User's full name |
| **Email** | Login email address |
| **Role** | Permission level (User, Manager, Admin) |
| **Factory** | Default factory assignment |
| **Department** | Department the user belongs to |
| **Active** | Whether the account is enabled |

### Tips
- Deactivated users cannot log in but their data is preserved
- Use the User Permissions page for more granular access control
- Email addresses must be unique across all users`,
    keywords: ["users", "accounts", "roles", "access"],
    category: "Admin",
    pageRoute: "/admin/users",
  },
  {
    key: "page.admin.companies",
    scope: "PAGE",
    title: "Company Management",
    shortText: "Manage company profiles and multi-tenancy settings.",
    bodyMd: `## Company Management

Configure company profiles for multi-tenant operation. Each company operates as a separate workspace with its own data.

### Buttons & Actions

- **Create Company** - Add a new company profile to the system
- **Edit Company** (pencil icon) - Modify company details
- **Delete Company** (trash icon) - Remove a company (requires confirmation)
- **Submit** - Save a new or edited company
- **Cancel Delete** - Close the delete confirmation without deleting
- **Confirm Delete** - Permanently remove the company

### Company Fields
- **Name** - Company display name
- **Code** - Short code for the company
- **ABN** - Australian Business Number
- **Address** - Company address details

### Tips
- Each company has its own isolated data (jobs, panels, users, etc.)
- Users are assigned to companies and can only see data for their company
- Admin users may have access across multiple companies`,
    keywords: ["companies", "organization", "tenant"],
    category: "Admin",
    pageRoute: "/admin/companies",
  },
  {
    key: "page.admin.factories",
    scope: "PAGE",
    title: "Factory Management",
    shortText: "Configure factories, beds, and production capacity.",
    bodyMd: `## Factory Management

Set up and manage production facilities. Configure factory locations, production beds, and capacity settings.

### Buttons & Actions

- **Add Factory** - Create a new factory with name, code, state, and location details
- **Edit Factory** (pencil icon) - Modify factory details, location, or settings
- **Delete Factory** (trash icon) - Remove a factory (requires confirmation, factory must have no active production)
- **Save Factory** - Save changes to a new or edited factory
- **View Factory** - Click a factory card to see its details and production beds
- **Add Bed** - Add a new production bed to a factory with name, size, and capacity
- **Edit Bed** (pencil icon) - Modify bed details
- **Delete Bed** (trash icon) - Remove a production bed
- **Save Bed** - Save changes to a new or edited bed
- **Edit Viewing Factory** - Quick edit button when viewing factory details

### Factory Fields

| Field | Description |
|-------|-------------|
| **Name** | Factory display name |
| **Code** | Short identifier code |
| **State** | Australian state location |
| **Address** | Full street address |
| **Map Location** | GPS coordinates for map display |
| **Beds** | Production beds with their dimensions and capacity |

### Tips
- Each factory can have multiple production beds
- Beds are used in production scheduling to plan casting
- Factory locations are shown on the interactive map
- CFMEU calendars can be linked to factories for holiday tracking`,
    keywords: ["factories", "production", "beds", "capacity"],
    category: "Admin",
    pageRoute: "/admin/factories",
  },
  {
    key: "page.admin.customers",
    scope: "PAGE",
    title: "Customer Management",
    shortText: "Manage customer records, contact details, and business information.",
    bodyMd: `## Customer Management

Maintain your customer database. Add, edit, import, and export customer records.

### Buttons & Actions

- **Create Customer** - Opens a form to add a new customer with company name, contacts, and business details
- **Export** - Download all customer records as an Excel file
- **Import** - Upload an Excel file to bulk import or update customer records
- **Download Template** - Get a blank Excel template formatted for customer import
- **Search** - Find customers by name, contact, email, or phone number
- **Edit Customer** (pencil icon) - Open an existing customer record to modify their details
- **Delete Customer** (trash icon) - Remove a customer (requires confirmation)
- **Save** - Save a new or edited customer record
- **Cancel** - Close the form without saving
- **Select File** (in import dialog) - Choose an Excel file to import
- **Close** (in import dialog) - Close the import dialog

### Customer Fields

| Field | Description |
|-------|-------------|
| **Company Name** | Customer's business name |
| **Key Contact** | Primary contact person |
| **Email** | Contact email address |
| **Phone** | Contact phone number |
| **Payment Terms** | Standard payment terms (e.g., Net 30) |
| **ABN** | Australian Business Number |
| **ACN** | Australian Company Number |
| **Address** | Full address (street, suburb, state, postcode) |
| **Notes** | Additional notes about the customer |

### Import Feature
The import system uses intelligent matching:
- **Existing customers** are matched by company name
- **Matched customers** have their missing details filled in (existing data is not overwritten)
- **New customers** are created automatically
- **Import results** show exactly what was created, updated, and skipped`,
    keywords: ["customers", "clients", "contacts", "import", "export"],
    category: "Admin",
    pageRoute: "/admin/customers",
  },
  {
    key: "page.admin.suppliers",
    scope: "PAGE",
    title: "Supplier Management",
    shortText: "Manage supplier records, payment details, and contact information.",
    bodyMd: `## Supplier Management

Maintain your supplier database for procurement. Track supplier contacts, payment details, and business information.

### Buttons & Actions

- **Create Supplier** - Opens a form to add a new supplier with company name, contacts, and payment details
- **Export** - Download all supplier records as an Excel file
- **Import** - Upload an Excel file to bulk import or update supplier records
- **Download Template** - Get a blank Excel template formatted for supplier import
- **Search** - Find suppliers by name, contact, email, or phone
- **Edit Supplier** (pencil icon) - Open an existing supplier to modify their details
- **Delete Supplier** (trash icon) - Remove a supplier (requires confirmation)
- **Save** - Save a new or edited supplier record
- **Cancel** - Close the form without saving

### Supplier Fields

| Field | Description |
|-------|-------------|
| **Company Name** | Supplier's business name |
| **Key Contact** | Primary contact person |
| **Email** | Contact email address |
| **Phone** | Contact phone number |
| **Payment Terms** | Standard payment terms |
| **ABN** | Australian Business Number |
| **ACN** | Australian Company Number |
| **BSB** | Bank BSB number |
| **Account Number** | Bank account number |
| **Address** | Full address details |
| **Notes** | Additional notes about the supplier |

### Import Feature
- Upload an Excel file matching the template format
- Existing suppliers are matched by company name
- Missing details are filled in without overwriting existing data
- New suppliers are created automatically
- Import results show created, updated, and skipped records`,
    keywords: ["suppliers", "vendors", "procurement", "import", "export"],
    category: "Admin",
    pageRoute: "/admin/suppliers",
  },
  {
    key: "page.admin.employees",
    scope: "PAGE",
    title: "Employee Management",
    shortText: "Manage employee master records, personal details, and employment information.",
    bodyMd: `## Employee Management

Comprehensive employee record management. Maintain master records with personal details, emergency contacts, and employment information.

### Buttons & Actions

- **Create Employee** - Opens a form to add a new employee with personal details, contact information, and employment data
- **Export** - Download all employee records as an Excel file for backup or external processing
- **Import** - Upload an Excel file to bulk import or update employee records
- **Download Template** - Get a blank Excel template formatted for employee import (MYOB-compatible format)
- **Search** - Find employees by name, employee number, email, or phone
- **Status Filter** - Filter by Active or Inactive employees
- **Edit Employee** (pencil icon) - Open an existing employee record to modify their details
- **Delete Employee** (trash icon) - Remove an employee record (requires confirmation)
- **Save** - Save a new or edited employee record
- **Cancel** - Close the form without saving
- **Select File** (in import dialog) - Choose an Excel file to import
- **Close** (in import dialog) - Close the import dialog after viewing results

### Employee Fields

| Section | Fields |
|---------|--------|
| **Identity** | Employee Number, First Name, Middle Name, Last Name, Preferred Name, Date of Birth |
| **Contact** | Email, Phone, Address (Street, Suburb, State, Postcode) |
| **Emergency Contact** | Contact Name, Phone, Relationship |
| **Employment** | Start Date, Position, Department, Employment Type (Full-time, Part-time, Casual, Contract) |
| **Status** | Active or Inactive |
| **Notes** | Free-text notes about the employee |

### Import Feature
The import system uses MYOB-style Excel templates:
- **Existing employees** are matched by Last Name + First Name combination
- **Matched employees** have their missing details filled in (existing data is never overwritten)
- **New employees** are created automatically with all provided details
- **Import results** show exactly how many were created, updated, skipped, and any errors
- The results panel shows names of created and updated employees for easy verification`,
    keywords: ["employees", "staff", "HR", "personnel", "import", "export"],
    category: "Admin",
    pageRoute: "/admin/employees",
  },
  {
    key: "page.admin.items",
    scope: "PAGE",
    title: "Item Catalogue",
    shortText: "Manage the catalogue of items available for purchase orders.",
    bodyMd: `## Item Catalogue

Maintain the master list of items used in purchase orders. Organise items by category with descriptions and units of measure.

### Buttons & Actions

- **Create Item** - Add a new item to the catalogue with name, description, category, and unit of measure
- **Import** - Upload an Excel file to bulk import items
- **Search** - Find items by name or description
- **Filter by Category** - Show only items in a specific category
- **Edit Item** (pencil icon) - Modify an existing item's details
- **Delete Item** (trash icon) - Remove an item from the catalogue (requires confirmation)
- **Save** - Save a new or edited item

### Item Fields

| Field | Description |
|-------|-------------|
| **Name** | Item display name |
| **Description** | Detailed description |
| **Category** | Classification category |
| **Unit of Measure** | How the item is measured (each, metre, kg, m2, m3, etc.) |
| **Default Price** | Standard unit price (optional) |

### Tips
- Organise items into categories for easier browsing
- Set default prices to speed up purchase order creation
- Use the Item Categories page to manage category classifications`,
    keywords: ["items", "catalog", "products", "inventory"],
    category: "Admin",
    pageRoute: "/admin/items",
  },
  {
    key: "page.admin.item-categories",
    scope: "PAGE",
    title: "Item Categories",
    shortText: "Manage categories for organising items in the catalogue.",
    bodyMd: `## Item Categories

Create and manage categories for organising items in your catalogue. Categories help group related items for easier browsing and filtering.

### Buttons & Actions

- **Create Category** - Add a new item category with a name and optional description
- **Edit Category** (pencil icon) - Modify an existing category name or description
- **Delete Category** (trash icon) - Remove a category (requires confirmation, category must be empty)
- **Save** - Save a new or edited category
- **Cancel** - Close the form without saving
- **Cancel Delete** - Close the delete confirmation without deleting
- **Confirm Delete** - Permanently remove the category

### Tips
- Create categories that reflect your purchasing patterns (e.g., Steel, Concrete, Hardware, Safety Equipment)
- Items must be reassigned or removed before a category can be deleted
- Categories appear as filter options in the Item Catalogue and Purchase Order forms`,
    keywords: ["item categories", "classification", "catalogue", "organise"],
    category: "Admin",
    pageRoute: "/admin/item-categories",
  },
  {
    key: "page.admin.devices",
    scope: "PAGE",
    title: "Device Management",
    shortText: "Register and manage mobile devices for the system.",
    bodyMd: `## Device Management

Track and manage registered mobile devices that connect to the system.

### What You Will See
- List of all registered devices
- Device name, type, and last active date
- Authentication status for each device

### Features
- View all registered mobile devices
- Monitor device activity and last connection times
- Manage device authentication and access`,
    keywords: ["devices", "mobile", "registration"],
    category: "Admin",
    pageRoute: "/admin/devices",
  },
  {
    key: "page.admin.panel-types",
    scope: "PAGE",
    title: "Panel Types",
    shortText: "Configure panel type classifications, colours, and cost components.",
    bodyMd: `## Panel Types

Define and manage panel type categories used across the system. Set up cost breakdowns and visual identifiers for each type.

### Buttons & Actions

- **Create Panel Type** - Add a new panel type with code, name, colour, and description
- **Edit Panel Type** (pencil icon) - Modify an existing panel type
- **Delete Panel Type** (trash icon) - Remove a panel type (only if no panels use it)
- **Save Panel Type** - Save changes to a new or edited panel type
- **Add Component** - Add a cost component to a panel type's cost breakdown
- **Save Cost Breakup** - Save the cost component configuration

### Panel Type Fields

| Field | Description |
|-------|-------------|
| **Code** | Short identifier (e.g., WALL, COL, CB) |
| **Name** | Display name (e.g., Wall Panel, Column) |
| **Colour** | Visual colour used in charts and schedules |
| **Description** | Optional description of the panel type |

### Cost Components
Each panel type can have multiple cost components that make up its total cost:
- Labour costs
- Material costs
- Equipment costs
- Overhead costs

### Tips
- Panel type colours are used in the KPI Dashboard charts and production schedules
- Cost components are used for financial analysis and reporting
- Codes should be short and descriptive for easy identification`,
    keywords: ["panel types", "classification", "categories", "cost"],
    category: "Admin",
    pageRoute: "/admin/panel-types",
  },
  {
    key: "page.admin.document-config",
    scope: "PAGE",
    title: "Document Configuration",
    shortText: "Configure document types, disciplines, categories, and status workflows.",
    bodyMd: `## Document Configuration

Set up the structure for your document management system. Define types, disciplines, categories, and status workflows.

### Buttons & Actions

#### Document Types
- **Add Type** - Create a new document type (e.g., Drawing, Specification, Report)
- **Edit Type** (pencil icon) - Modify an existing type
- **Delete Type** (trash icon) - Remove a type (requires confirmation)
- **Save Type** - Save changes

#### Disciplines
- **Add Discipline** - Create a new discipline (e.g., Architectural, Structural, Mechanical)
- **Edit Discipline** (pencil icon) - Modify an existing discipline
- **Delete Discipline** (trash icon) - Remove a discipline
- **Save Discipline** - Save changes

#### Categories
- **Add Category** - Create a new document category
- **Edit Category** (pencil icon) - Modify an existing category
- **Delete Category** (trash icon) - Remove a category
- **Save Category** - Save changes

#### Status Workflow
- **Add Status** - Add a new status to the document workflow
- **Edit Status** (pencil icon) - Modify a status name or order
- **Save Status** - Save status changes
- **Cancel Status Edit** - Discard changes

### Tips
- Document types, disciplines, and categories appear as filter and selection options when uploading documents
- The status workflow defines the progression of document revisions (e.g., Draft > IFA > IFC > Approved)
- Removing a type/discipline/category will affect existing documents that use it`,
    keywords: ["documents", "configuration", "categories", "types", "disciplines"],
    category: "Admin",
    pageRoute: "/admin/document-config",
  },
  {
    key: "page.admin.checklist-templates",
    scope: "PAGE",
    title: "Checklist Templates",
    shortText: "Create and manage checklist templates with sections, fields, and conditional logic.",
    bodyMd: `## Checklist Templates

Design checklist templates for quality inspections. Define entity types, subtypes, and detailed templates with sections and fields.

### Buttons & Actions

#### Entity Types
- **Add Entity Type** - Create a new type of entity that checklists apply to (e.g., Panel, Job, Equipment)
- **Edit Entity Type** (pencil icon) - Modify an existing entity type
- **Delete Entity Type** (trash icon) - Remove an entity type
- **Save Entity Type** - Save changes

#### Subtypes
- **Add Subtype** - Create a subtype within an entity type (e.g., Pre-Pour, Post-Pour under Panel)
- **Edit Subtype** (pencil icon) - Modify a subtype
- **Delete Subtype** (trash icon) - Remove a subtype
- **Save Subtype** - Save changes

#### Templates
- **Add Template** - Create a new checklist template
- **Search** - Find templates by name
- **Filter** (All, Unassigned) - Show all templates or only those not linked to a subtype
- **Edit Template** - Open the Template Editor to modify sections and fields
- **Delete Template** (trash icon) - Remove a template
- **Save Template** - Save template changes
- **Clear Search** - Remove the search filter

### Features
- Customisable templates with multiple sections
- Field types: Text, Number, Dropdown, Checkbox, Date, Photo, Signature
- Conditional field logic (show/hide fields based on other answers)
- System-locked templates for standard inspections that cannot be modified
- Define which fields are required vs optional`,
    keywords: ["checklist", "templates", "quality", "inspection"],
    category: "Admin",
    pageRoute: "/admin/checklist-templates",
  },
  {
    key: "page.admin.template-editor",
    scope: "PAGE",
    title: "Template Editor",
    shortText: "Design checklist template sections, fields, and conditional logic.",
    bodyMd: `## Template Editor

The detailed editor for building checklist templates. Add sections, define fields, set conditional logic, and configure validation rules.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Checklist Templates list
- **Save Template** - Save all changes to the template
- **Add Section** - Create a new section in the template (sections group related fields together)
- **Move Section Up/Down** (arrow icons) - Reorder sections within the template
- **Edit Section** (pencil icon) - Rename or modify a section
- **Delete Section** (trash icon) - Remove a section and all its fields
- **Add Field** - Add a new field to a section
- **Move Field Up/Down** (arrow icons) - Reorder fields within a section
- **Edit Field** (pencil icon) - Modify field settings (type, label, required, conditions)
- **Duplicate Field** - Create a copy of an existing field
- **Delete Field** (trash icon) - Remove a field from the section
- **Add Option** - Add a dropdown option (for dropdown/select field types)
- **Remove Option** (X icon) - Remove a dropdown option
- **Save Section** - Save section name changes
- **Save Field** - Save field configuration changes

### Field Types

| Type | Description |
|------|-------------|
| **Text** | Free-text input |
| **Number** | Numeric input |
| **Dropdown** | Select from predefined options |
| **Checkbox** | Yes/No toggle |
| **Date** | Date picker |
| **Photo** | Photo capture or upload |
| **Signature** | Digital signature capture |

### Conditional Logic
Fields can be shown or hidden based on the value of another field. For example:
- Show "Describe defect" field only when "Defect found?" is checked
- Show "Other reason" field only when "Reason" dropdown is set to "Other"

### Tips
- Plan your template structure before building (sections and field order)
- Use conditional fields to keep checklists concise - only show fields that are relevant
- Required fields must be completed before the checklist can be submitted
- Test your template by creating a sample checklist to ensure the flow is correct`,
    keywords: ["template", "editor", "sections", "fields", "conditional"],
    category: "Admin",
    pageRoute: "/admin/checklist-templates/:id",
  },
  {
    key: "page.admin.user-permissions",
    scope: "PAGE",
    title: "User Permissions",
    shortText: "Configure granular per-user access permissions for system features.",
    bodyMd: `## User Permissions

Set up fine-grained access control for each user. Control which features each person can see and use.

### Buttons & Actions

- **Refresh** - Reload the permissions data to see the latest changes
- **Select User** - Choose which user's permissions to view and edit
- **Permission Toggle** - Click to cycle through permission levels for each feature

### Permission Levels

| Level | Meaning |
|-------|---------|
| **Hidden** | Feature is completely invisible to the user |
| **View** | User can see the feature but cannot make changes |
| **View and Update** | User has full access to view and modify |

### How It Works
- Each row represents a system feature or page
- Each column shows the current permission level for the selected user
- Click a permission cell to change the access level
- Changes save automatically

### Tips
- Start with the user's role (User, Manager, Admin) which sets default permissions
- Use this page to fine-tune access beyond what the role provides
- Hidden features do not appear in the user's navigation menu
- Be careful when restricting manager permissions as this may affect their ability to approve timesheets`,
    keywords: ["permissions", "access", "roles", "security"],
    category: "Admin",
    pageRoute: "/admin/user-permissions",
  },
  {
    key: "page.admin.zones",
    scope: "PAGE",
    title: "Zone Management",
    shortText: "Configure zones for organising work areas.",
    bodyMd: `## Zone Management

Define and manage work zones for organising factory and site areas.

### Buttons & Actions

- **Create Zone** - Add a new zone with a name and description
- **Edit Zone** (pencil icon) - Modify an existing zone
- **Delete Zone** (trash icon) - Remove a zone (requires confirmation)
- **Save Zone** - Save changes to a new or edited zone
- **Cancel Delete** - Close the delete confirmation
- **Confirm Delete** - Permanently remove the zone

### Tips
- Zones can be used to organise work areas within factories
- Assign zones to production activities for better tracking`,
    keywords: ["zones", "areas", "organization"],
    category: "Admin",
    pageRoute: "/admin/zones",
  },
  {
    key: "page.admin.asset-register",
    scope: "PAGE",
    title: "Asset Register",
    shortText: "Comprehensive asset management with lifecycle tracking, depreciation, and maintenance.",
    bodyMd: `## Asset Register

Manage company assets from acquisition to disposal. Track over 50 fields across 40+ asset categories with full lifecycle management.

### Buttons & Actions

- **Add Asset** - Opens a form to register a new asset. Select a category, fill in details, and the system auto-generates an asset tag
- **Download Template** - Get an Excel template for bulk importing assets
- **Import Assets** - Upload an Excel file to bulk import asset records
- **Search** - Find assets by name, tag, serial number, or description
- **Filter by Category** - Show only assets of a specific type
- **Filter by Status** - Show only Active, Under Maintenance, or Disposed assets
- **View Graph** - Toggle a visual chart showing asset distribution or depreciation
- **Clear Chart Filter** - Remove chart date filters
- **Click Asset Row** - Open the detailed asset view
- **Edit** (pencil icon) - Edit an asset's details
- **Delete** (trash icon) - Remove an asset (requires confirmation)
- **Close Import** - Close the import dialog

### Asset Tag Format
Assets are automatically assigned tags in the format: **AST-YYMM-NNNN**
- AST = Asset prefix
- YYMM = Year and month of registration
- NNNN = Sequential number

### Asset Categories
Over 40 categories including: Vehicles, Plant & Equipment, Tools, IT Equipment, Office Furniture, Safety Equipment, and more.

### Features
- **Depreciation Tracking** - Automatic depreciation calculations
- **Maintenance Scheduling** - Schedule and track maintenance activities
- **Transfer History** - Record asset transfers between locations or departments
- **Insurance Tracking** - Monitor insurance policies and expiry dates
- **Lease/Finance Management** - Track lease and finance arrangements
- **AI Analysis** - Use AI to analyse asset data and generate insights`,
    keywords: ["assets", "equipment", "inventory", "depreciation", "maintenance"],
    category: "Admin",
    pageRoute: "/admin/asset-register",
  },
  {
    key: "page.admin.asset-detail",
    scope: "PAGE",
    title: "Asset Detail",
    shortText: "View and manage all details for a specific asset including maintenance, transfers, and AI analysis.",
    bodyMd: `## Asset Detail

Comprehensive view of a single asset with all its details, maintenance records, transfer history, and AI-powered analysis.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Asset Register list
- **Edit Asset** - Open the edit form for this asset's basic details
- **Delete Asset** - Remove this asset from the register (requires confirmation)
- **Generate AI Analysis** - Use AI to analyse the asset and generate insights, recommendations, and valuations

#### Detail Tabs
- **Edit Basic** - Modify basic asset information (name, category, location, status)
- **Edit Financial** - Update financial details (purchase price, depreciation, value)
- **Edit Technical** - Update technical specifications
- **Edit Insurance** - Update insurance and warranty information
- **Add Maintenance** - Record a new maintenance activity
- **Delete Maintenance** (trash icon) - Remove a maintenance record
- **Add Transfer** - Record an asset transfer to a new location or department
- **Generate AI** (in AI tab) - Run AI analysis from the analysis tab
- **Save** - Save changes for any edit section
- **Cancel** - Close an edit section without saving
- **Cancel Delete** - Close the delete confirmation
- **Confirm Delete** - Permanently remove the asset

### Asset Sections

| Section | Information |
|---------|-------------|
| **Basic** | Name, tag, category, status, location, department |
| **Financial** | Purchase price, date, supplier, depreciation method and values |
| **Technical** | Serial number, model, manufacturer, specifications |
| **Insurance** | Policy details, coverage, expiry dates |
| **Maintenance** | Scheduled and completed maintenance records |
| **Transfers** | History of location and department changes |
| **AI Analysis** | AI-generated insights and recommendations |`,
    keywords: ["asset", "detail", "maintenance", "transfer", "AI", "depreciation"],
    category: "Admin",
    pageRoute: "/admin/asset-register/:id",
  },
  {
    key: "data_management",
    scope: "PAGE",
    title: "Data Management",
    shortText: "Bulk data operations including selective deletion by category.",
    bodyMd: `## Data Management

Administrative tools for managing system data in bulk. Selectively delete data by category with safety checks.

### Buttons & Actions

- **Select Categories** - Choose which categories of data to include in the operation (e.g., Panels, Time Logs, Documents)
- **Clear Search** - Clear the category search filter
- **Validate** - Check what data would be affected before proceeding. This shows counts of records that would be deleted
- **Confirm Delete** - After validation, proceed with the deletion (requires confirmation)
- **Cancel Delete** - Stop the deletion process

### Data Categories
Select from various data categories including:
- Panel records
- Time logs and daily reports
- Documents and attachments
- Chat messages
- Production records
- And more

### Safety Features
- **Two-step process** - You must validate before you can delete
- **Count preview** - See exactly how many records will be affected
- **Confirmation required** - A final confirmation dialog prevents accidental deletion
- **Category selection** - Only delete specific types of data, not everything

### Warning
Data deletion is permanent and cannot be undone. Always ensure you have backups before performing bulk deletions. This feature should only be used by administrators who understand the impact.`,
    keywords: ["data", "management", "delete", "bulk", "admin"],
    category: "Admin",
    pageRoute: "/admin/data-management",
  },
  {
    key: "page.admin.help",
    scope: "PAGE",
    title: "Help Management",
    shortText: "Create and manage help articles for the in-app help system.",
    bodyMd: `## Help Management

Admin interface for managing in-app help content. Create, edit, and organise help articles that appear throughout the system.

### Buttons & Actions

- **Create Help Entry** - Add a new help article with title, content, category, and keywords
- **Edit** (pencil icon) - Modify an existing help article
- **Search** - Find help entries by title, content, or keywords
- **Filter by Category** - Show only entries in a specific category
- **Filter by Scope** - Show only entries of a specific type (Page, Field, Action, etc.)
- **Save** - Save a new or edited help entry

### Help Entry Types

| Type | Description |
|------|-------------|
| **PAGE** | Full page help articles shown via the help button |
| **FIELD** | Field-level tooltip help |
| **ACTION** | Button or action explanations |
| **COLUMN** | Table column descriptions |
| **GENERAL** | General help articles for the Help Centre |

### Content Format
Help entries use Markdown formatting:
- Use ## for section headings
- Use **bold** for emphasis
- Use bullet points for lists
- Use tables for structured information

### Tips
- Keep articles concise and focused on what users need to do
- Include explanations for every button and action on a page
- Use keywords to help users find articles via search
- Categories organise articles in the Help Centre`,
    keywords: ["help", "documentation", "admin", "articles"],
    category: "Admin",
    pageRoute: "/admin/help",
  },
  {
    key: "page.help-center",
    scope: "PAGE",
    title: "Help Centre",
    shortText: "Search and browse help articles to learn about the system.",
    bodyMd: `## Help Centre

Your central resource for learning about the system. Search for answers, browse by category, and find detailed guides for every feature.

### How to Use

- **Search Bar** - Type keywords to find relevant help articles instantly
- **Browse Categories** - Click a category to see all articles in that topic area
- **Recently Updated** - See the latest documentation that has been added or changed
- **Article Detail** - Click any article to read the full content with step-by-step instructions

### Categories
Help articles are organised into categories including:
- **Dashboard** - Home page and overview
- **Tasks** - Task management
- **Chat** - Team messaging
- **Jobs** - Job management
- **Panels** - Panel register and lifecycle
- **Documents** - Document management
- **Production** - Manufacturing and scheduling
- **Finance** - Purchase orders, claims, and wages
- **Reports** - Analytics and reporting
- **Admin** - System configuration and settings

### Tips
- Use the search bar for the fastest way to find answers
- Each page in the system has a help button (i icon) that opens relevant help
- If you can't find an answer, contact your system administrator`,
    keywords: ["help", "documentation", "search", "support", "centre"],
    category: "General",
    pageRoute: "/help",
  },
  {
    key: "page.hire-bookings",
    scope: "PAGE",
    title: "Hire Bookings",
    shortText: "Manage equipment hire requests, approvals, and booking lifecycle.",
    bodyMd: `## Hire Bookings

Manage all equipment hire bookings from initial request through to return and closure. Track internal assets and external hire from suppliers.

### Buttons & Actions

- **New Hire Booking** - Opens a form to create a new hire booking for internal or external equipment
- **Search** - Find bookings by booking number, equipment description, or job
- **Status Filter** - Filter bookings by status (Draft, Requested, Approved, Booked, On Hire, Returned, Closed, Cancelled)
- **Source Filter** - Filter by hire source (Internal or External)
- **Clear Filters** - Remove all active filters
- **View** (eye icon) - Open a booking to view its full details
- **Edit** (pencil icon) - Modify a booking (only available for Draft or Requested bookings)
- **Submit** - Submit a Draft booking for approval
- **Approve** - Approve a submitted booking (Managers and Admins only)
- **Reject** - Reject a submitted booking with feedback (Managers and Admins only)
- **Book** - Confirm the booking after approval
- **Pickup** - Record that equipment has been picked up
- **On Hire** - Mark equipment as currently on hire
- **Return** - Record that equipment has been returned
- **Close** - Close a completed booking (Managers and Admins only)
- **Cancel** - Cancel an active booking
- **Delete** (trash icon) - Delete a Draft booking (Admins only)

### Booking Workflow

| Status | Description |
|--------|-------------|
| **Draft** | Initial booking created, not yet submitted |
| **Requested** | Submitted for approval |
| **Approved** | Approved by a manager |
| **Booked** | Booking confirmed with supplier or asset reserved |
| **On Hire** | Equipment is currently in use |
| **Returned** | Equipment has been returned |
| **Closed** | Booking finalised and archived |
| **Cancelled** | Booking was cancelled |

### Hire Sources

| Source | Description |
|--------|-------------|
| **Internal** | Using company-owned assets from the Asset Register |
| **External** | Hiring from an external supplier |

### Tips
- Internal bookings link to specific assets from the Asset Register
- External bookings link to a supplier and may include a supplier reference number
- Overdue return dates are highlighted in red
- Each booking is assigned a unique booking number automatically
- Bookings are linked to jobs for cost tracking`,
    keywords: ["hire", "bookings", "equipment", "rental", "approval"],
    category: "Finance",
    pageRoute: "/hire-bookings",
  },
  {
    key: "page.hire-booking-form",
    scope: "PAGE",
    title: "Hire Booking Form",
    shortText: "Create or edit an equipment hire booking with full details.",
    bodyMd: `## Hire Booking Form

Create a new hire booking or edit an existing one. Specify the equipment, source, dates, rates, and delivery requirements.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Hire Bookings list
- **Save as Draft** - Save the booking without submitting for approval
- **Submit for Approval** - Save and submit the booking for manager approval
- **Save Changes** - Save modifications to an existing booking
- **Cancel** - Discard changes and return to the list

### Form Sections

#### Equipment Details
- **Hire Source** - Choose Internal (company asset) or External (from supplier)
- **Asset Category** - Select the type of equipment from 40+ categories
- **Asset** - (Internal only) Select a specific asset from the Asset Register
- **Supplier** - (External only) Select the hire supplier
- **Equipment Description** - Free-text description of the equipment being hired
- **Quantity** - Number of items being hired

#### Job & Assignment
- **Job** - Which job the hire is for (required for cost tracking)
- **Cost Code** - Optional cost code for financial tracking
- **Requested By** - The employee who requested the hire
- **Responsible Person** - The person responsible for the equipment
- **Site Contact** - The on-site contact for deliveries

#### Dates
- **Hire Start Date** - When the hire period begins
- **Hire End Date** - When the hire period ends
- **Expected Return Date** - When the equipment is expected to be returned

#### Rates & Costs
- **Rate Type** - Daily, Weekly, or Monthly hire rate
- **Rate Amount** - The cost per rate period
- **Charge Rule** - How charges are calculated

#### Delivery
- **Delivery Required** - Whether delivery to site is needed
- **Delivery Address** - Where to deliver the equipment
- **Delivery Cost** - Cost of delivery
- **Pickup Required** - Whether pickup from site is needed
- **Pickup Cost** - Cost of pickup

#### Additional
- **Supplier Reference** - External supplier's reference number
- **Notes** - Additional notes or special requirements

### Tips
- For internal hire, select the specific asset to automatically fill category details
- For external hire, select the supplier first to link the booking
- The booking number is auto-generated when saved
- Draft bookings can be edited freely; once submitted, editing is restricted`,
    keywords: ["hire", "booking", "form", "create", "edit", "equipment"],
    category: "Finance",
    pageRoute: "/hire-bookings/new",
  },
  {
    key: "page.admin.employee-detail",
    scope: "PAGE",
    title: "Employee Detail",
    shortText: "View and manage complete employee record with all personal, employment, and emergency details.",
    bodyMd: `## Employee Detail

Comprehensive view of an individual employee's record. View and edit all personal details, employment information, emergency contacts, and qualifications.

### Buttons & Actions

- **Back** (arrow icon) - Return to the Employee Management list
- **Edit Employee** - Open the edit form to modify employee details
- **Delete Employee** - Remove this employee record (requires confirmation)

### Information Sections

| Section | Details |
|---------|---------|
| **Personal** | Name, date of birth, preferred name, employee number |
| **Contact** | Email, phone, full address |
| **Emergency Contact** | Emergency contact name, phone, and relationship |
| **Employment** | Start date, position, department, employment type (Full-time, Part-time, Casual, Contract) |
| **Status** | Active or inactive status |
| **Financial** | Tax file number, superannuation details, bank information |
| **Notes** | Free-text notes and additional information |

### Related Information

| Tab | What It Shows |
|-----|--------------|
| **Qualifications** | Licenses, certifications, and training records with expiry tracking |
| **Equipment** | Company equipment assigned to this employee |
| **Hire Bookings** | Equipment hire bookings requested by this employee |
| **Time Logs** | Summary of recent time entries and attendance |

### Tips
- Employee numbers are unique and cannot be changed after creation
- Use qualifications to track license expiry dates for compliance
- The employment type affects wage calculation rules
- Inactive employees are retained for historical records but cannot log time`,
    keywords: ["employee", "detail", "profile", "HR", "personnel"],
    category: "Admin",
    pageRoute: "/admin/employees/:id",
  },
];

export async function seedHelpEntries() {
  console.log("[Help] Checking for existing help entries...");

  for (const entry of pageHelp) {
    const [existing] = await db
      .select()
      .from(helpEntries)
      .where(eq(helpEntries.key, entry.key));

    if (existing) {
      await db
        .update(helpEntries)
        .set({
          title: entry.title,
          shortText: entry.shortText,
          bodyMd: entry.bodyMd,
          keywords: entry.keywords,
          category: entry.category,
          pageRoute: entry.pageRoute || null,
        })
        .where(eq(helpEntries.key, entry.key));
    } else {
      await db.insert(helpEntries).values({
        key: entry.key,
        scope: entry.scope,
        title: entry.title,
        shortText: entry.shortText,
        bodyMd: entry.bodyMd,
        keywords: entry.keywords,
        category: entry.category,
        pageRoute: entry.pageRoute || null,
        status: "PUBLISHED",
      });
    }
  }

  const [count] = await db.select({ count: helpEntries.id }).from(helpEntries);
  console.log(`[Help] Help entries seeded. Total entries in database: checked.`);
}
