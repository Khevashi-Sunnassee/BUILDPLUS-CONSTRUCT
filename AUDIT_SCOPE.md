# BuildPlus AI - Comprehensive Application Audit Scope

**Scope:** Page-by-page, function-by-function assessment of code quality, security, validation, performance, and scalability
**Target:** Enterprise-grade readiness for 1,000+ concurrent users
**System Scale:** 209 page components | 723 unique API paths | 953 route handlers | 46,000+ lines of route code | 13 services

---

## PART 1: PAGE-BY-PAGE FUNCTIONAL AUDIT

Every page is assessed for: **CRUD correctness, input validation, error handling, loading states, empty states, role-based visibility, responsive design, accessibility, data-testid coverage, and performance.**

---

### 1. DASHBOARD (`dashboard.tsx`)
- [ ] KPI cards load with correct data per company
- [ ] Charts render with real data (no mock/placeholder)
- [ ] Date range filtering works correctly
- [ ] Role-based visibility (ADMIN sees all, USER sees limited)
- [ ] Performance: lazy-load charts, no blocking renders
- [ ] Error/empty states for each widget
- [ ] Data refreshes on interval without memory leaks

### 2. KPI DASHBOARD (`kpi-dashboard.tsx`)
- [ ] All KPI metrics calculate correctly from database
- [ ] Map integration renders correctly (if Google Maps used)
- [ ] Drill-down from KPI to detail view works
- [ ] Data isolation: only company-specific data shown
- [ ] Performance with large datasets (1000+ records)
- [ ] Responsive layout on mobile/tablet

### 3. JOBS MODULE

#### 3a. Jobs List (`admin/jobs/index.tsx`, `admin/jobs.tsx`)
- [ ] List pagination works correctly
- [ ] Search/filter by job name, number, status, phase
- [ ] Sorting by all columns
- [ ] Role-based: only users with job access see jobs
- [ ] Job member filtering (users only see assigned jobs based on permissions)
- [ ] "Next number" generation is atomic (no duplicates under concurrent access)
- [ ] Bulk operations (if any) validate permissions per item

#### 3b. Job Form/Detail (`admin/jobs/JobFormDialog.tsx`)
- [ ] All required fields validated before submit
- [ ] Job number uniqueness enforced
- [ ] Phase status transitions follow lifecycle rules (5 phases)
- [ ] Date validations (start < end, logical sequences)
- [ ] File attachments upload and associate correctly
- [ ] Audit log records all changes with user/timestamp
- [ ] Cost overrides (`CostOverridesDialog.tsx`) calculate correctly
- [ ] Estimate import (`EstimateImportDialog.tsx`) parses CSV/Excel correctly
- [ ] Job import (`JobImportDialog.tsx`) validates data before bulk insert

#### 3c. Job Members (`admin/jobs/JobMembersPanel.tsx`)
- [ ] Add/remove members works
- [ ] Role assignment per member
- [ ] Cannot remove yourself if you're the only admin
- [ ] Member changes reflected in job access immediately

#### 3d. Job Audit Log (`admin/jobs/AuditLogPanel.tsx`)
- [ ] All field changes captured with before/after values
- [ ] User attribution correct
- [ ] Timestamps in correct timezone
- [ ] Pagination for large audit histories

#### 3e. Job Programme (`job-programme.tsx`)
- [ ] Pour labels render correctly
- [ ] Drag-and-drop reordering persists
- [ ] Programme entries link to production slots
- [ ] Recalculate function updates dates correctly
- [ ] Split functionality divides entries properly

#### 3f. Job Activities (`job-activities.tsx`)
- [ ] Template-driven activity creation
- [ ] Nested task hierarchy (parent/child)
- [ ] Status transitions follow workflow rules
- [ ] MS Project-style dependencies enforce correct ordering
- [ ] Comments attach to correct activity
- [ ] Gantt/timeline view renders correctly

#### 3g. Job Budget (`job-budget.tsx`)
- [ ] Four-phase budget system works (Draft → Approved → Active → Closed)
- [ ] Budget lines CRUD
- [ ] Line locking prevents concurrent edits
- [ ] File attachments per budget line
- [ ] Update history tracked
- [ ] Email drop functionality works
- [ ] Totals recalculate when lines change
- [ ] Currency formatting consistent

#### 3h. Job BOQ (`job-boq.tsx`)
- [ ] Bill of Quantities groups CRUD
- [ ] BOQ items link to correct groups
- [ ] Quantity × rate calculations correct
- [ ] Import/export maintains data integrity
- [ ] Totals cascade correctly

### 4. PANELS MODULE

#### 4a. Panel List (`admin/panels/index.tsx`, `admin/panels.tsx`)
- [ ] Panel list with filtering by job, status, type
- [ ] 14-stage lifecycle status display correct
- [ ] Panel count badges accurate
- [ ] Search by panel mark, job, type
- [ ] Pagination with large datasets (10,000+ panels)

#### 4b. Panel Detail/Edit (`admin/panels/PanelEditDialog.tsx`)
- [ ] All panel fields editable with correct field types
- [ ] Panel mark uniqueness within job enforced
- [ ] Status transitions follow 14-stage lifecycle rules
- [ ] Cannot skip stages without proper approval
- [ ] Conditional fields show/hide based on panel type
- [ ] Weight/dimension calculations correct
- [ ] Validation: numeric fields reject non-numeric input

#### 4c. Panel Lifecycle & Approval (`panel-approval.routes.ts`)
- [ ] Each of 14 stages has correct transition rules
- [ ] Approval requires correct role/permission
- [ ] Bulk approval works correctly
- [ ] Rejection returns to correct previous stage
- [ ] Approval history audit trail complete
- [ ] Concurrent approval attempts handled (no race conditions)

#### 4d. Panel Build (`admin/panels/PanelBuildDialog.tsx`)
- [ ] Build dialog captures all required fields
- [ ] Factory/bed assignment validates availability
- [ ] Pour date scheduling respects constraints

#### 4e. Panel Documents (`admin/panels/PanelDocumentsTab.tsx`)
- [ ] Documents link to correct panel
- [ ] Upload, view, delete work
- [ ] Version tracking maintained

#### 4f. Panel Chat (`admin/panels/PanelChatTab.tsx`)
- [ ] Messages send and display correctly
- [ ] Real-time or near-real-time updates
- [ ] Message attribution to correct user

#### 4g. Panel Audit Log (`admin/panels/PanelAuditLogTab.tsx`)
- [ ] All panel field changes logged
- [ ] Stage transitions logged with approver
- [ ] Before/after values captured

#### 4h. Panel Import (`panel-import.routes.ts`)
- [ ] CSV/Excel parsing handles all field types
- [ ] Validation errors reported per row
- [ ] Duplicate panel marks detected
- [ ] Large imports (1000+ rows) handled without timeout
- [ ] Transaction rollback on partial failure

#### 4i. Panel Consolidation
- [ ] Panels merged correctly
- [ ] History preserved from both panels
- [ ] No orphaned records after consolidation

### 5. DOCUMENTS MODULE

#### 5a. Document Register (`document-register/index.tsx`)
- [ ] Document list with pagination
- [ ] Filter by entity type, status, date, document type
- [ ] Search across title, reference, content
- [ ] Entity linking (jobs, panels, contracts)
- [ ] Role-based: users only see documents for their accessible entities
- [ ] Sorting by all columns

#### 5b. Document Upload & CRUD (`documents/crud.ts`)
- [ ] Single file upload with progress indicator
- [ ] Supported file types validated (PDF, DOC, XLS, images)
- [ ] File size limits enforced
- [ ] Metadata extraction (AI-powered) works
- [ ] Title, description, tags editable
- [ ] Delete removes file from storage AND database record

#### 5c. Bulk Upload (`document-register/BulkUploadDialog.tsx`, `documents/bulk-upload.ts`)
- [ ] Multiple files selected and uploaded
- [ ] Progress per file shown
- [ ] Failed uploads don't block successful ones
- [ ] Entity linking applied to all uploaded documents
- [ ] Duplicate filename detection

#### 5d. Version History (`document-register/VersionHistorySheet.tsx`, `document-register/NewVersionDialog.tsx`)
- [ ] Version numbering auto-increments
- [ ] Previous versions accessible
- [ ] Download any version
- [ ] Current version clearly indicated
- [ ] Version notes captured

#### 5e. Visual Comparison (`document-register/VisualComparisonDialog.tsx`, `visual-diff.service.ts`)
- [ ] Two versions/documents selectable for comparison
- [ ] AI-powered visual diff renders correctly
- [ ] Side-by-side or overlay mode works
- [ ] Performance with large PDFs
- [ ] Error handling when comparison fails

#### 5f. Bundles (`document-register/BundleDialogs.tsx`, `document-register/BundleGridView.tsx`, `documents/bundles.ts`)
- [ ] Create bundle with multiple documents
- [ ] Bundle grid view renders document previews
- [ ] Add/remove documents from bundle
- [ ] Public bundle link generation works
- [ ] Public bundle access control (no auth required but link unpredictable)
- [ ] Bundle download as ZIP

#### 5g. Drawing Package (`document-register/DrawingPackageDialog.tsx`, `documents/drawing-package.ts`)
- [ ] Drawing package creation from selected documents
- [ ] Package numbering/versioning
- [ ] PDF merge or compilation works

#### 5h. Document Email (`document-register/SendDocumentsEmailDialog.tsx`, `documents/email.ts`)
- [ ] Send documents via email with attachments
- [ ] Recipient validation
- [ ] Email template applied correctly
- [ ] Attachment size limits enforced

#### 5i. Add to Knowledge Base (`document-register/AddToKnowledgeBaseDialog.tsx`)
- [ ] Document selected and sent to KB for processing
- [ ] Processing status tracked
- [ ] Already-added documents flagged

#### 5j. Document Configuration (`admin/document-config.tsx`, `documents/config.ts`)
- [ ] Document types configurable
- [ ] Metadata fields configurable per type
- [ ] Numbering schemes work

### 6. PURCHASE ORDERS MODULE

#### 6a. PO List (`purchase-orders.tsx`)
- [ ] List with pagination, search, filter by status/supplier/job
- [ ] Status badges display correct states
- [ ] Total amounts calculate correctly
- [ ] Export to Excel/PDF

#### 6b. PO Form (`purchase-order-form/index.tsx`)
- [ ] Supplier selection with search
- [ ] Delivery details (date, address, instructions)
- [ ] Line items table with add/remove/edit rows
- [ ] Quantity × unit price × GST calculations correct
- [ ] Running total updates in real-time
- [ ] Notes and attachments section
- [ ] Draft/Submit/Approve workflow
- [ ] Validation: all required fields, positive quantities, valid dates

#### 6c. PO Line Items (`purchase-order-form/LineItemsTable.tsx`)
- [ ] Add new line item
- [ ] Edit existing line item inline
- [ ] Delete line item with confirmation
- [ ] Item search/autocomplete from items register
- [ ] Unit of measure options
- [ ] Tax calculation per line
- [ ] Subtotal per line correct

#### 6d. PO Actions (`purchase-order-form/ActionButtons.tsx`)
- [ ] Save as Draft
- [ ] Submit for Approval (permission check)
- [ ] Approve (requires correct role)
- [ ] Reject with reason
- [ ] Print/PDF generation (`po-pdf.service.ts`)
- [ ] Email PO to supplier
- [ ] Duplicate PO

#### 6e. PO Dialogs (`purchase-order-form/PODialogs.tsx`)
- [ ] Approval confirmation dialog
- [ ] Rejection reason dialog
- [ ] Cancel PO dialog
- [ ] All dialogs have proper validation

### 7. LOGISTICS MODULE

#### 7a. Logistics Overview (`logistics/index.tsx`, `logistics.tsx`)
- [ ] Three-tab layout: Pending, Ready, Completed
- [ ] Tab counts accurate
- [ ] Filtering by job, date, factory
- [ ] Role-based access

#### 7b. Pending Tab (`logistics/PendingTab.tsx`)
- [ ] Lists panels ready for logistics planning
- [ ] Drag-to-assign to load lists
- [ ] Panel details visible on hover/click

#### 7c. Ready Tab (`logistics/ReadyTab.tsx`)
- [ ] Load lists with assigned panels
- [ ] Weight/dimension totals per load
- [ ] Trailer type assignment
- [ ] Delivery scheduling

#### 7d. Completed Tab (`logistics/CompletedTab.tsx`)
- [ ] Delivery history with timestamps
- [ ] Delivery receipts/photos
- [ ] Sign-off records

#### 7e. Logistics Dialogs (`logistics/LogisticsDialogs.tsx`)
- [ ] Create load list
- [ ] Assign panels to loads
- [ ] Delivery recording dialog
- [ ] All validations enforced

#### 7f. Mobile Delivery Recording (`mobile/record-delivery.tsx`)
- [ ] Photo capture on mobile
- [ ] GPS location capture
- [ ] Sign-off capture (signature pad)
- [ ] Offline capability (queue and sync)
- [ ] Panel QR scan to identify delivery items

#### 7g. Mobile Load List Creation (`mobile/create-load-list.tsx`)
- [ ] Create load from mobile
- [ ] Panel selection with barcode scan
- [ ] Weight limits validation

#### 7h. Return Loads (`mobile/return-load.tsx`)
- [ ] Record return loads
- [ ] Reason for return captured
- [ ] Panels returned to correct status

### 8. PRODUCTION MODULE

#### 8a. Production Report (`production-report.tsx`, `production-report-detail.tsx`)
- [ ] Daily production report generation
- [ ] Panel counts by status/factory/job
- [ ] Charts and summary statistics
- [ ] Export to Excel
- [ ] Detail drill-down per factory/job

#### 8b. Production Schedule (`production-schedule.tsx`)
- [ ] Calendar/timeline view of production
- [ ] Factory-based scheduling
- [ ] Slot assignment and management
- [ ] Conflict detection (double-booked slots)

#### 8c. Production Slots (`production-slots/index.tsx`)
- [ ] Slot CRUD operations
- [ ] Calendar view (`CalendarView.tsx`) renders correctly
- [ ] Slot filters (`SlotFilters.tsx`) work
- [ ] Slot table (`SlotTable.tsx`) with pagination
- [ ] Slot dialogs (`ProductionSlotDialogs.tsx`) validate inputs
- [ ] Multi-factory slot management
- [ ] Pour label assignment

#### 8d. Production Entries (`production-entries.routes.ts`)
- [ ] Daily production entry recording
- [ ] Panel selection for entry
- [ ] Worker/crew assignment
- [ ] Time tracking per entry
- [ ] Validation: no future dates, valid panel states

#### 8e. Production Analytics (`production-analytics.routes.ts`)
- [ ] Analytics calculations correct
- [ ] Performance metrics accurate
- [ ] Trend analysis over time periods
- [ ] Factory comparison charts

### 9. FINANCE MODULE

#### 9a. Progress Claims (`progress-claims.tsx`, `progress-claim-form.tsx`)
- [ ] Claim list with status filtering
- [ ] Claim form with line items
- [ ] Previous claim amounts carried forward correctly
- [ ] Percentage complete calculations
- [ ] Retention calculations correct
- [ ] GST calculations correct
- [ ] Approval workflow (submit → approve → certify)
- [ ] PDF generation for claims
- [ ] Export to Excel

#### 9b. AP Invoices (`ap-invoices.tsx`, `ap-invoice-detail.tsx`)
- [ ] Invoice list with status tabs
- [ ] Invoice upload (PDF)
- [ ] AI extraction of invoice fields
- [ ] Field mapping verification
- [ ] Split invoice across cost codes/jobs
- [ ] Approval workflow (multi-level)
- [ ] Approval rules (`ap-approval-rules.tsx`) configuration
- [ ] Bulk approve functionality
- [ ] My approvals view (pending items for current user)
- [ ] Invoice on-hold and urgent flags
- [ ] Document viewer with page thumbnails
- [ ] MYOB export integration
- [ ] Concurrent approval handling (no double-approval)

#### 9c. AP Email Inbox (`ap-inbox.routes.ts`)
- [ ] Email polling works on schedule
- [ ] Invoice extraction from email attachments
- [ ] Auto-create invoice from email
- [ ] Background processing status visible
- [ ] Settings configuration (inbox credentials, polling interval)

#### 9d. Cost Analytics (`cost-analytics.routes.ts`)
- [ ] Cost breakdown by job/cost code
- [ ] Budget vs actual comparison
- [ ] Variance analysis
- [ ] Trend reporting

#### 9e. Weekly Wage Reports (`weekly-wage-reports.tsx`, `weekly-reports.routes.ts`)
- [ ] Weekly report generation
- [ ] Worker hours aggregation correct
- [ ] Overtime calculations (CFMEU rules)
- [ ] Export to payroll format

#### 9f. Contract Hub (`contract-hub.tsx`, `contract-detail.tsx`)
- [ ] Contract list and detail view
- [ ] Contract values, variations tracked
- [ ] Retention tracking and release scheduling
- [ ] Contract document linking

#### 9g. Retention Report (`retention-report.tsx`)
- [ ] Retention amounts calculated correctly per contract
- [ ] Release dates tracked
- [ ] Ageing analysis

#### 9h. EOT Claims (`eot-claims.routes.ts`)
- [ ] Extension of Time claims CRUD
- [ ] Approval workflow
- [ ] Impact on programme dates

#### 9i. CAPEX Module (`capex-requests.tsx`, `capex.routes.ts`)
- [ ] Capital expenditure request creation
- [ ] Multi-level approval workflow (submit → approve → reject → draft → withdraw)
- [ ] Budget allocation tracking
- [ ] Audit history per request
- [ ] Link to purchase orders
- [ ] Pending my approval view

### 10. DRAFTING MODULE

#### 10a. Drafting Program (`drafting-program.tsx`, `drafting.routes.ts`)
- [ ] Drafting schedule management
- [ ] Assignment to drafters
- [ ] Status tracking (not started → in progress → review → complete)
- [ ] Linked to production slots

#### 10b. Drafting Email Inbox (`drafting-email-detail.tsx`, `drafting-inbox.routes.ts`)
- [ ] Email polling on schedule
- [ ] AI-powered change request identification
- [ ] Email list with status filtering
- [ ] Email detail view with attachments
- [ ] Process/archive/flag actions
- [ ] Mobile view (`mobile/drafting-email-detail.tsx`) works

#### 10c. Drafting Logistics (`drafting-logistics.routes.ts`)
- [ ] Logistics scheduling linked to drafting program
- [ ] Delivery coordination

### 11. PROCUREMENT MODULE

#### 11a. Procurement Overview (`procurement.routes.ts`)
- [ ] Item catalogue management
- [ ] Supplier management
- [ ] Order tracking

#### 11b. Procurement Items (`procurement/items.routes.ts`)
- [ ] Item CRUD
- [ ] Category assignment
- [ ] Unit pricing
- [ ] Supplier pricing per item

#### 11c. Procurement Suppliers (`procurement/suppliers.routes.ts`)
- [ ] Supplier CRUD
- [ ] Contact details
- [ ] Category specialisation

#### 11d. Procurement Orders (`procurement-orders.routes.ts`)
- [ ] Order creation from requisition
- [ ] Multi-supplier ordering
- [ ] Order tracking and receipting

#### 11e. REO Schedule (`reo-schedule.routes.ts`, `procurement-reo-scheduling.tsx`)
- [ ] Reinforcement schedule management
- [ ] Extraction from documents (`reo-extraction.service.ts`)
- [ ] Weight calculations

### 12. COMMUNICATION MODULE

#### 12a. Chat (`chat.tsx`)
- [ ] Direct messages between users
- [ ] Group chat creation
- [ ] Channel creation (public/private)
- [ ] @mentions with notifications
- [ ] File attachments in messages
- [ ] Message search
- [ ] Unread count badges
- [ ] Real-time message delivery
- [ ] Message editing/deletion
- [ ] Emoji reactions (if implemented)
- [ ] Thread/reply functionality

#### 12b. Mail Register (`mail-register/index.tsx`)
- [ ] Incoming/outgoing mail tracking
- [ ] Mail categorisation
- [ ] Entity linking (to jobs, contracts)
- [ ] Search and filter
- [ ] Status tracking

#### 12c. Email Compose (`mail-register/EmailComposeDialog.tsx`)
- [ ] Recipient selection (to/cc/bcc)
- [ ] Rich text email body
- [ ] Template selection and application
- [ ] Attachment upload
- [ ] Send with delivery tracking
- [ ] Draft save

#### 12d. Email Templates (`admin/email-templates.tsx`, `email-templates.routes.ts`)
- [ ] Template CRUD
- [ ] Rich text editor (TipTap)
- [ ] Template variables/merge fields
- [ ] Preview functionality
- [ ] Audit logging for template changes

#### 12e. Broadcast System (`broadcast.tsx`, `broadcast.routes.ts`)
- [ ] Template-based mass notifications
- [ ] Channel selection (email/SMS/WhatsApp)
- [ ] Recipient selection
- [ ] Delivery tracking per recipient
- [ ] Resend failed deliveries
- [ ] Channel status monitoring

#### 12f. Company Email Inboxes (`company-email-inboxes.routes.ts`)
- [ ] Inbox configuration CRUD
- [ ] Connection testing
- [ ] Polling configuration

### 13. KNOWLEDGE BASE MODULE

#### 13a. Projects (`knowledge-base/KbProjects.tsx`)
- [ ] Project CRUD
- [ ] Instructions editor (project-wide AI guidelines)
- [ ] Documents tab: upload, status tracking, reprocess
- [ ] Members tab: invite, remove, role change (OWNER/EDITOR/VIEWER)
- [ ] Settings tab: instructions management
- [ ] Role-based access (VIEWER can't edit/upload)

#### 13b. Chat (`knowledge-base/KbChat.tsx`)
- [ ] Message sending with streaming response
- [ ] KB Only vs AI+KB mode toggle
- [ ] Source citations displayed
- [ ] Conversation auto-naming after first message
- [ ] Share conversation with team members
- [ ] VIEWER cannot send messages (backend enforced)
- [ ] Cross-thread context working (project threads reference each other)
- [ ] Message rendering (markdown, code blocks, lists)

#### 13c. Sidebar (`knowledge-base/KbSidebar.tsx`)
- [ ] Project filter dropdown
- [ ] Conversation list with delete
- [ ] Pending invitations display
- [ ] Accept/decline invitation flow
- [ ] New chat button

#### 13d. Document Upload (`knowledge-base/KbUploadDialog.tsx`)
- [ ] File upload (PDF, text)
- [ ] URL import
- [ ] Text paste
- [ ] Processing status tracking
- [ ] Chunk count displayed after processing

#### 13e. RAG Pipeline (`kb-retrieval.service.ts`, `kb-embedding.service.ts`, `kb-chunking.service.ts`)
- [ ] Document chunking produces correct segments
- [ ] Embeddings generated and stored (pgvector)
- [ ] Semantic search returns relevant results
- [ ] Similarity threshold tuned correctly
- [ ] Cross-thread context limits respected (5 threads, 4 messages each)
- [ ] Project instructions injected into system prompt

### 14. SALES & TENDERS MODULE

#### 14a. Sales Pipeline (`sales-pipeline.tsx`)
- [ ] Opportunity CRUD
- [ ] Pipeline stages (kanban or list view)
- [ ] Stage transitions
- [ ] Value tracking
- [ ] Mobile new opportunity (`mobile/new-opportunity.tsx`)

#### 14b. Tender Center (`tender-center.tsx`, `tender-detail.tsx`)
- [ ] Tender CRUD
- [ ] Tender packages and members
- [ ] Supplier invitation to tenders
- [ ] Submission tracking
- [ ] Scoring/evaluation
- [ ] Member role tracking
- [ ] Job-tender linking
- [ ] Notes and files per tender

#### 14c. Tender Email Inbox (`tender-emails.tsx`, `tender-email-detail.tsx`, `tender-inbox.routes.ts`)
- [ ] Email polling
- [ ] Tender-related email identification
- [ ] Processing and archiving

### 15. ADMIN MODULE

#### 15a. Users (`admin/users.tsx`, `users.routes.ts`)
- [ ] User list with search/filter
- [ ] User CRUD (create, update, deactivate)
- [ ] Password management
- [ ] Role assignment (USER/MANAGER/ADMIN)
- [ ] Company assignment
- [ ] Active/inactive toggle
- [ ] Cannot deactivate yourself
- [ ] Cannot demote yourself from ADMIN if last admin

#### 15b. User Permissions (`admin/user-permissions.tsx`)
- [ ] Per-user function permission matrix
- [ ] Permission type CRUD
- [ ] Apply permission type to user
- [ ] Initialize default permissions
- [ ] Changes take effect immediately (no session cache stale)

#### 15c. Employees (`admin/employees.tsx`, `employee.routes.ts`)
- [ ] Employee list with search/filter
- [ ] Employee CRUD
- [ ] Employment history tracking

#### 15d. Employee Detail (`admin/employee-detail/index.tsx`)
- [ ] Overview tab: personal details, contact info
- [ ] Employments tab: employment history
- [ ] Licences tab: licence/ticket tracking with expiry
- [ ] Documents tab: employee documents
- [ ] Onboarding tab: onboarding checklist
- [ ] Employee dialogs: all edit forms validate correctly

#### 15e. Suppliers (`admin/suppliers.tsx`)
- [ ] Supplier list with search/filter
- [ ] Supplier CRUD
- [ ] Contact details management
- [ ] Category assignment
- [ ] Active/inactive status

#### 15f. Customers (`admin/customers.tsx`, `customer.routes.ts`)
- [ ] Customer list with search/filter
- [ ] Customer CRUD
- [ ] Contact details management
- [ ] ABN/ACN validation (if applicable)

#### 15g. Factories (`admin/factories.tsx`, `factories.routes.ts`)
- [ ] Factory CRUD
- [ ] Bed management per factory (create/edit/delete beds)
- [ ] Factory-specific settings

#### 15h. Items & Categories (`admin/items.tsx`, `admin/item-categories.tsx`)
- [ ] Item register CRUD
- [ ] Category hierarchy
- [ ] Unit of measure assignment
- [ ] Default pricing
- [ ] Search and filter

#### 15i. Cost Codes (`admin/cost-codes.tsx`, `cost-codes.routes.ts`)
- [ ] Cost code hierarchy (parent/child)
- [ ] CRUD for parent and child codes
- [ ] Default assignments to jobs
- [ ] Import/export functionality
- [ ] Validation: no duplicate codes

#### 15j. Panel Types (`admin/panel-types.tsx`, `panel-types.routes.ts`)
- [ ] Panel type CRUD
- [ ] Default properties per type
- [ ] Usage tracking (which panels use this type)

#### 15k. Job Types (`admin/job-types.tsx`)
- [ ] Job type CRUD
- [ ] Default settings per type
- [ ] Activity template linkage

#### 15l. Zones (`admin/zones.tsx`)
- [ ] Zone/area CRUD
- [ ] Geographic assignment

#### 15m. Settings (`admin/settings.tsx`)
- [ ] Company tab: company details, logo upload
- [ ] Email tab: email configuration
- [ ] Scheduling tab: scheduling defaults
- [ ] Time tracking tab: time tracking configuration
- [ ] Factories tab: factory management
- [ ] Data tab: data management settings

#### 15n. Devices (`admin/devices.tsx`)
- [ ] Device registration CRUD
- [ ] Device key management
- [ ] Active/inactive tracking

#### 15o. Help Management (`admin/help.tsx`, `help.routes.ts`)
- [ ] Help entry CRUD
- [ ] Category organisation
- [ ] Search functionality
- [ ] Rich text content

#### 15p. Data Management (`admin/data-management.tsx`)
- [ ] Entity-level data viewing across all entity types
- [ ] Bulk delete with validation and counts
- [ ] Delete dependency checking (prevent orphaned records)
- [ ] Confirmation dialogs with impact summary

#### 15q. Checklist Templates (`admin/checklist-templates.tsx`)
- [ ] Template CRUD
- [ ] Question/field configuration
- [ ] Conditional fields (show/hide rules)
- [ ] Entity type assignment
- [ ] Template versioning

#### 15r. Workflow Builder (`admin/workflow-builder.tsx`)
- [ ] Workflow CRUD
- [ ] Step configuration
- [ ] Transition rules
- [ ] Role assignment per step

#### 15s. Document Configuration (`admin/document-config.tsx`)
- [ ] Document type CRUD
- [ ] Metadata field configuration
- [ ] Numbering scheme setup

#### 15t. Template Editor (`admin/template-editor.tsx`)
- [ ] Template CRUD with rich text (TipTap)
- [ ] Variable/merge field insertion
- [ ] Preview mode

#### 15u. Asset Register (`admin/asset-register/index.tsx`, `admin/asset-detail.tsx`)
- [ ] Asset CRUD with form validation
- [ ] Asset categories and types
- [ ] Location tracking
- [ ] Value/depreciation tracking
- [ ] Maintenance scheduling
- [ ] Transfer history
- [ ] AI-powered asset summary
- [ ] Import from template
- [ ] Charts and statistics
- [ ] Filters and search
- [ ] Service calls tab
- [ ] Asset repair requests (`admin/asset-repair-form.tsx`)

#### 15v. Companies - Super Admin (`admin/companies.tsx`, `companies.routes.ts`)
- [ ] Company CRUD (Super Admin only)
- [ ] Company isolation verified
- [ ] Settings per company
- [ ] User count per company

### 16. SUPER ADMIN (`super-admin.tsx`)
- [ ] Only accessible by isSuperAdmin users
- [ ] Company management
- [ ] Help content management
- [ ] Platform-wide settings
- [ ] System health monitoring
- [ ] User impersonation (if implemented)

### 17. TIME TRACKING MODULE

#### 17a. Timer (`timer.routes.ts`)
- [ ] Start/stop timer per user
- [ ] Timer persists across page navigation
- [ ] Daily time entry tracking
- [ ] Job/task assignment to time entries
- [ ] Work type classification

#### 17b. Daily Reports (`daily-reports.tsx`, `daily-report-detail.tsx`, `daily-logs.routes.ts`)
- [ ] Daily report CRUD
- [ ] Weather, crew, equipment recording
- [ ] Photo attachments
- [ ] Approval workflow
- [ ] Export to PDF

#### 17c. Weekly Job Logs (`weekly-job-logs.tsx`)
- [ ] Weekly log aggregation
- [ ] Job-based time summary
- [ ] Export functionality

### 18. MOBILE MODULE

#### 18a. Checklist Fill (`mobile/checklist-fill.tsx`, `checklist-fill.tsx`)
- [ ] Dynamic form rendering from template
- [ ] Conditional fields show/hide correctly
- [ ] Photo capture per field
- [ ] GPS location capture
- [ ] Offline support (queue submissions)
- [ ] Sign-off with signature pad
- [ ] Complete/submit workflow

#### 18b. PM Call Logs (`mobile/pm-call-log-form.tsx`, `pm-call-log-form.tsx`)
- [ ] Call log creation
- [ ] Contact selection
- [ ] Notes and follow-up actions
- [ ] Date/time recording
- [ ] View call log history (`pm-call-logs.tsx`, `pm-call-log-detail.tsx`)

#### 18c. Hire Booking (`mobile/hire-booking-form.tsx`, `hire-booking-form.tsx`)
- [ ] Booking creation from mobile
- [ ] Equipment/resource selection
- [ ] Date range selection with availability check
- [ ] Cost estimation
- [ ] Approval workflow

#### 18d. Mobile Tasks (`mobile/tasks.tsx`)
- [ ] Task list for current user
- [ ] Status updates from mobile
- [ ] Quick action buttons

### 19. CHECKLISTS MODULE (`checklists.tsx`, `checklist-reports.tsx`)
- [ ] Checklist instance list
- [ ] Checklist creation from templates
- [ ] Entity assignment (assets, panels, jobs)
- [ ] Completion tracking
- [ ] Work order generation from checklist findings
- [ ] Reports and analytics

### 20. SCOPE OF WORKS (`scope-of-works.tsx`, `scopes.routes.ts`)
- [ ] Scope CRUD
- [ ] AI-powered scope generation
- [ ] Trade/discipline sections
- [ ] Item management within scopes
- [ ] Import/export
- [ ] Email/print functionality
- [ ] Tender scope linking

### 21. HIRE BOOKINGS (`hire-bookings.tsx`, `hire.routes.ts`)
- [ ] Booking list with filtering
- [ ] Booking CRUD
- [ ] Equipment/resource catalogue
- [ ] Availability calendar
- [ ] Cost tracking
- [ ] Approval workflow

### 22. REPORTS (`reports.tsx`, `reports.routes.ts`)
- [ ] Report generation per type
- [ ] Date range selection
- [ ] Job/entity filtering
- [ ] Export to Excel/PDF
- [ ] Performance with large datasets

### 23. MYOB INTEGRATION (`myob-integration.tsx`, `myob.routes.ts`)
- [ ] OAuth connection flow
- [ ] Token refresh/rotation
- [ ] Data sync (invoices, contacts, etc.)
- [ ] Mapping rules configuration
- [ ] Sync status monitoring
- [ ] Error handling for API failures
- [ ] Rate limiting compliance

### 24. PHOTO GALLERY (`photo-gallery.tsx`)
- [ ] Photo grid view
- [ ] Lightbox/fullscreen view
- [ ] Entity-linked photos
- [ ] Upload from gallery
- [ ] Delete with confirmation

### 25. PANEL DETAILS (`panel-details.tsx`)
- [ ] Panel QR code display/print
- [ ] Panel status timeline
- [ ] Linked documents
- [ ] Production history

### 26. MANUAL ENTRY (`manual-entry.tsx`)
- [ ] Manual data entry forms
- [ ] Validation per field type
- [ ] Save and submit flows

### 27. ONBOARDING (`onboarding.routes.ts`)
- [ ] New user onboarding flow
- [ ] Company setup wizard
- [ ] Initial data population

### 28. REGISTRATION (`register.tsx`)
- [ ] User self-registration (if enabled)
- [ ] Invitation-based registration
- [ ] Form validation (email format, password strength)
- [ ] Duplicate email prevention

### 29. PUBLIC BUNDLE VIEW (`public-bundle.tsx`)
- [ ] Public access without authentication
- [ ] Document viewing
- [ ] Download functionality
- [ ] Link expiry (if implemented)

---

## PART 2: CROSS-CUTTING CONCERNS (EVERY PAGE)

### A. INPUT VALIDATION
- [ ] All text inputs sanitised (XSS prevention)
- [ ] SQL injection prevented (parameterised queries via Drizzle ORM)
- [ ] File upload type/size validation (server-side, not just client)
- [ ] Number fields reject non-numeric input
- [ ] Date fields validate logical ranges
- [ ] Required fields enforced both client AND server side
- [ ] Maximum length enforced on all text fields
- [ ] Email format validated
- [ ] Phone number format validated
- [ ] URL format validated where applicable
- [ ] No raw user input rendered as HTML (React handles this, but verify dangerouslySetInnerHTML usage)

### B. AUTHENTICATION & AUTHORISATION
- [ ] Every API endpoint (except public ones) requires authentication
- [ ] Session-based auth with secure cookie flags (httpOnly, secure, sameSite)
- [ ] Session timeout and renewal
- [ ] CSRF token validated on all POST/PATCH/DELETE
- [ ] Role checks on every protected operation (not just route-level)
- [ ] Permission checks use database values, not cached/stale data
- [ ] Super Admin flag checked for platform-wide operations
- [ ] Company isolation: users cannot access data from other companies
- [ ] Job-level access control: users only see jobs they're assigned to (where applicable)
- [ ] Password hashing uses bcrypt with adequate cost factor
- [ ] Account lockout after failed attempts (if implemented)
- [ ] Session invalidation on password change

### C. ERROR HANDLING
- [ ] Every API endpoint has try/catch with consistent error response format
- [ ] 400 for validation errors (with field-level details)
- [ ] 401 for unauthenticated requests
- [ ] 403 for unauthorised requests
- [ ] 404 for missing resources
- [ ] 409 for conflicts (duplicate entries)
- [ ] 429 for rate-limited requests
- [ ] 500 for unexpected errors (with logging, without exposing internals)
- [ ] Frontend shows user-friendly error messages (no raw JSON or stack traces)
- [ ] Network error recovery (retry logic where appropriate)
- [ ] Graceful degradation when external services are down

### D. LOADING & EMPTY STATES
- [ ] Every data-fetching page shows loading spinner/skeleton
- [ ] Every list page shows empty state message when no data
- [ ] Mutation buttons show pending state during API calls
- [ ] Forms disable submit button during pending mutations
- [ ] Optimistic updates revert on error

### E. DATA-TESTID COVERAGE
- [ ] Every interactive element has data-testid
- [ ] Every dynamic content element has data-testid with unique identifier
- [ ] Naming convention followed: `{action}-{target}` or `{type}-{content}-{id}`

---

## PART 3: BACKEND DEEP AUDIT

### A. DATABASE SCHEMA INTEGRITY
- [ ] All foreign keys have ON DELETE behaviour defined (CASCADE, SET NULL, RESTRICT)
- [ ] Unique constraints on business-critical fields (email, job numbers, panel marks per job)
- [ ] CHECK constraints on enum-like fields
- [ ] Indexes on frequently queried columns (companyId, status, createdAt, foreignKeys)
- [ ] No missing indexes on JOIN columns
- [ ] Composite indexes for multi-column queries
- [ ] All timestamp columns have defaults
- [ ] UUID generation consistent (gen_random_uuid)

### B. QUERY PERFORMANCE
- [ ] No N+1 query patterns (loading lists then querying details per item)
- [ ] All list endpoints use `.limit()` with sensible defaults
- [ ] Pagination implemented with offset+limit or cursor-based
- [ ] Heavy aggregation queries use materialized views or caching
- [ ] No `SELECT *` on large tables (select only needed columns)
- [ ] Joins use indexed columns
- [ ] Subqueries optimised or converted to JOINs where beneficial
- [ ] Connection pooling configured correctly for 1000+ users
- [ ] Pool size adequate (min 5, max 50+ depending on load)
- [ ] Idle connection timeout configured
- [ ] Long-running queries identified and optimised

### C. API DESIGN CONSISTENCY
- [ ] Consistent URL patterns across all modules
- [ ] Consistent response format: `{ data, pagination }` for lists, direct object for singles
- [ ] Consistent error format: `{ error: string }` or `{ error: string, details: [] }`
- [ ] HTTP methods used correctly (GET for reads, POST for creates, PATCH for updates, DELETE for deletes)
- [ ] No business logic in route handlers (delegated to services/storage)
- [ ] Request body validation with Zod schemas on all POST/PATCH endpoints
- [ ] Response schemas documented

### D. CONCURRENCY & RACE CONDITIONS
- [ ] Concurrent user edits on same record handled (optimistic locking or last-write-wins)
- [ ] Approval workflows handle concurrent approvals (no double-approve)
- [ ] Sequence number generation is atomic (no duplicate job/PO numbers)
- [ ] File uploads handle concurrent uploads to same entity
- [ ] Timer start/stop handles concurrent requests from same user
- [ ] Session store handles concurrent requests from same session

### E. RATE LIMITING & ABUSE PREVENTION
- [ ] API rate limiting per user/IP
- [ ] Auth endpoint rate limiting (prevent brute force)
- [ ] Upload endpoint rate limiting
- [ ] AI endpoint rate limiting (daily quotas)
- [ ] Email sending rate limiting (token bucket)
- [ ] Webhook endpoints validate signatures
- [ ] No open redirects

---

## PART 4: SECURITY DEEP AUDIT

### A. INJECTION PREVENTION
- [ ] SQL injection: all queries use parameterised queries (Drizzle ORM)
- [ ] NoSQL injection: N/A (PostgreSQL only)
- [ ] Command injection: no exec/spawn with user input
- [ ] Path traversal: file paths validated, no `../` exploitation
- [ ] LDAP injection: N/A
- [ ] Template injection: no user input in template strings executed as code

### B. AUTHENTICATION SECURITY
- [ ] Password policy enforced (minimum length, complexity)
- [ ] Bcrypt cost factor >= 10
- [ ] Timing-safe comparison for authentication
- [ ] No password or session data in logs
- [ ] Session regeneration on privilege change
- [ ] Secure session cookie configuration

### C. DATA EXPOSURE
- [ ] No sensitive data in API responses that shouldn't be there (password hashes, internal IDs)
- [ ] No sensitive data in console.log in production
- [ ] No API keys or secrets in frontend code
- [ ] No debug endpoints accessible in production
- [ ] Error messages don't expose internal structure
- [ ] Stack traces not returned in API responses

### D. HEADERS & TRANSPORT
- [ ] Content-Security-Policy header configured
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY or SAMEORIGIN
- [ ] Strict-Transport-Security (HSTS)
- [ ] Referrer-Policy configured
- [ ] CORS configured correctly (not wildcard *)

### E. FILE UPLOAD SECURITY
- [ ] File type validation (server-side, not just extension)
- [ ] File size limits enforced
- [ ] Uploaded files stored outside web root
- [ ] Filenames sanitised (no path traversal)
- [ ] Antivirus scanning (if feasible)
- [ ] Image processing doesn't execute embedded code

### F. MULTI-TENANT ISOLATION
- [ ] Every database query filters by companyId
- [ ] No endpoint can return data from another company
- [ ] File storage isolated per company
- [ ] Session data includes companyId and validates on every request
- [ ] Admin operations scoped to company (except Super Admin)
- [ ] Shared resources (help, system defaults) properly scoped

---

## PART 5: PERFORMANCE & SCALABILITY AUDIT (1000+ USERS)

### A. DATABASE SCALING
- [ ] Connection pool size adequate for 1000+ concurrent connections
- [ ] Read replicas for heavy read operations (if needed)
- [ ] Query execution plans reviewed for all list endpoints
- [ ] Indexes cover all WHERE/JOIN/ORDER BY columns in hot paths
- [ ] Vacuum and analyze scheduled
- [ ] Table partitioning for high-growth tables (audit logs, messages, time entries)
- [ ] Archive strategy for old data

### B. APPLICATION SCALING
- [ ] Stateless server design (session in DB, not memory)
- [ ] No in-memory state that would break with multiple instances
- [ ] Background job queue handles concurrent job processing
- [ ] Circuit breakers on all external service calls (OpenAI, MYOB, Twilio, Mailgun, Resend)
- [ ] Graceful shutdown drains connections and queues
- [ ] Health check endpoints for load balancer
- [ ] Memory leak detection (event listeners, intervals, closures)

### C. CACHING
- [ ] LRU cache with TTL for frequently accessed data
- [ ] Cache invalidation on data changes
- [ ] No stale cache served for critical data (permissions, roles)
- [ ] Cache hit rate monitoring

### D. FRONTEND PERFORMANCE
- [ ] Code splitting per route (React.lazy)
- [ ] Bundle size analysis (no unnecessarily large dependencies)
- [ ] Image optimisation (lazy loading, proper sizing)
- [ ] Virtual scrolling for large lists (10,000+ items)
- [ ] Debounced search inputs
- [ ] Memoised expensive computations
- [ ] No unnecessary re-renders (React DevTools profiling)
- [ ] TanStack Query cache settings optimised (staleTime, gcTime)

### E. API RESPONSE TIMES
- [ ] All list endpoints respond under 200ms (p95)
- [ ] All detail endpoints respond under 100ms (p95)
- [ ] All write endpoints respond under 500ms (p95)
- [ ] AI endpoints have appropriate timeouts
- [ ] File upload endpoints handle large files without blocking
- [ ] Streaming endpoints (KB chat) work correctly
- [ ] No blocking I/O in request handlers

---

## PART 6: CODE QUALITY & MAINTAINABILITY

### A. DUPLICATION
- [ ] No duplicate route handlers across files
- [ ] No duplicate business logic (consolidate into services)
- [ ] No duplicate React components (shared component library)
- [ ] No duplicate utility functions
- [ ] No duplicate validation schemas

### B. ARCHITECTURE
- [ ] Routes → Services → Storage separation maintained
- [ ] No database queries directly in route handlers (use storage/services)
- [ ] Shared types used consistently (schema.ts)
- [ ] Error handling patterns consistent
- [ ] Logging patterns consistent (structured logging with pino)

### C. CODE SMELLS
- [ ] No functions exceeding 100 lines
- [ ] No files exceeding 1000 lines (route files)
- [ ] No deeply nested callbacks (> 3 levels)
- [ ] No magic numbers (use named constants)
- [ ] No commented-out code
- [ ] No TODO/FIXME/HACK without ticket reference
- [ ] No `any` types in TypeScript (use proper typing)
- [ ] No unused imports or variables

### D. TESTING COVERAGE
- [ ] Frontend component tests for critical components
- [ ] Backend API tests for all endpoints
- [ ] E2E tests for critical flows (auth, CRUD, workflows)
- [ ] Load tests for concurrency scenarios
- [ ] Security tests (injection, auth bypass)
- [ ] Integration tests for external services

---

## PART 7: EXTERNAL SERVICE RESILIENCE

### A. OpenAI
- [ ] Circuit breaker configured
- [ ] Timeout on API calls
- [ ] Rate limiting respected
- [ ] Fallback when service unavailable
- [ ] Token usage tracking and quota management
- [ ] Prompt injection prevention

### B. MYOB
- [ ] OAuth token refresh automated
- [ ] API rate limits respected
- [ ] Sync failures don't corrupt local data
- [ ] Retry with exponential backoff

### C. Twilio (SMS/WhatsApp)
- [ ] Delivery status tracking
- [ ] Failed message retry
- [ ] Cost monitoring
- [ ] Phone number format validation

### D. Email Services (Resend/Mailgun)
- [ ] Queue-based sending with retry
- [ ] Bounce/complaint handling
- [ ] Rate limiting compliance
- [ ] Webhook signature validation
- [ ] Template rendering errors handled

### E. Object Storage
- [ ] Upload retry on failure
- [ ] Download with signed URLs
- [ ] Cleanup of orphaned files
- [ ] Storage quota monitoring

---

## SCORING

Each section is scored:
- **PASS** = Functions correctly, secure, performant
- **WARN** = Works but has issues that should be addressed
- **FAIL** = Broken, insecure, or critically suboptimal
- **N/A** = Not applicable

**Overall Grade:**
- A (90-100): Production-ready, enterprise-grade
- B (75-89): Production-ready with minor improvements needed
- C (60-74): Functional but needs significant improvements before scaling
- D (40-59): Major issues requiring immediate attention
- F (0-39): Not safe to deploy

**Verdict:** SAFE TO DEPLOY / DEPLOY WITH CONDITIONS / BLOCKED
