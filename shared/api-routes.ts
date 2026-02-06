/**
 * CENTRALIZED API ROUTES DEFINITION
 * ================================
 * 
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for all API endpoints.
 * 
 * RULES:
 * 1. ALL API paths MUST be defined here
 * 2. Frontend components MUST import from this file
 * 3. Backend routes MUST match these paths exactly
 * 4. NEVER hardcode API paths in components
 * 5. When adding new endpoints, add them here FIRST
 * 
 * This prevents the API path mismatch issues that cause data not to display.
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================
export const AUTH_ROUTES = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',
  CHANGE_PASSWORD: '/api/auth/change-password',
} as const;

// ============================================================================
// USER & PERMISSIONS
// ============================================================================
export const USER_ROUTES = {
  LIST: '/api/users',
  BY_ID: (id: string | number) => `/api/users/${id}`,
  SETTINGS: '/api/user/settings',
  MY_PERMISSIONS: '/api/my-permissions',
} as const;

// ============================================================================
// SETTINGS
// ============================================================================
export const SETTINGS_ROUTES = {
  LOGO: '/api/settings/logo',
  WORK_TYPES: '/api/work-types',
  WORK_TYPE_BY_ID: (id: string | number) => `/api/work-types/${id}`,
} as const;

// ============================================================================
// WEEKLY REPORTS
// ============================================================================
export const WEEKLY_REPORTS_ROUTES = {
  // Wage Reports
  WAGE_REPORTS: '/api/weekly-wage-reports',
  WAGE_REPORT_BY_ID: (id: string | number) => `/api/weekly-wage-reports/${id}`,
  WAGE_REPORT_ANALYSIS: (id: string | number) => `/api/weekly-wage-reports/${id}/analysis`,
  
  // Job Reports
  JOB_REPORTS: '/api/weekly-job-reports',
  JOB_REPORT_BY_ID: (id: string | number) => `/api/weekly-job-reports/${id}`,
  JOB_REPORTS_MY: '/api/weekly-job-reports/my-reports',
  JOB_REPORTS_PENDING: '/api/weekly-job-reports/pending-approval',
  JOB_REPORTS_APPROVED: '/api/weekly-job-reports/approved',
  JOB_REPORT_SUBMIT: (id: string | number) => `/api/weekly-job-reports/${id}/submit`,
  JOB_REPORT_APPROVE: (id: string | number) => `/api/weekly-job-reports/${id}/approve`,
  JOB_REPORT_REJECT: (id: string | number) => `/api/weekly-job-reports/${id}/reject`,
} as const;

// ============================================================================
// MANUAL ENTRY & LOG ROWS
// ============================================================================
export const MANUAL_ENTRY_ROUTES = {
  ENTRY: '/api/manual-entry',
  LOG_ROWS: '/api/log-rows',
  LOG_ROW_BY_ID: (id: string | number) => `/api/log-rows/${id}`,
} as const;

// ============================================================================
// CFMEU HOLIDAYS (for non-admin access)
// ============================================================================
export const CFMEU_ROUTES = {
  HOLIDAYS: '/api/cfmeu-holidays',
} as const;

// ============================================================================
// PURCHASE ORDER ATTACHMENTS
// ============================================================================
export const PO_ATTACHMENTS_ROUTES = {
  BY_ID: (id: string | number) => `/api/po-attachments/${id}`,
} as const;

// ============================================================================
// PROCUREMENT - Items, Suppliers, Categories, Purchase Orders
// ============================================================================
export const PROCUREMENT_ROUTES = {
  // Items
  ITEMS: '/api/procurement/items',
  ITEMS_ACTIVE: '/api/procurement/items/active',
  ITEM_BY_ID: (id: string | number) => `/api/procurement/items/${id}`,
  ITEMS_IMPORT: '/api/procurement/items/import',
  
  // Item Categories
  ITEM_CATEGORIES: '/api/procurement/item-categories',
  ITEM_CATEGORIES_ACTIVE: '/api/procurement/item-categories/active',
  ITEM_CATEGORY_BY_ID: (id: string | number) => `/api/procurement/item-categories/${id}`,
  
  // Customers
  CUSTOMERS: '/api/customers',
  CUSTOMERS_ACTIVE: '/api/customers/active',
  CUSTOMER_BY_ID: (id: string | number) => `/api/customers/${id}`,

  // Suppliers
  SUPPLIERS: '/api/procurement/suppliers',
  SUPPLIERS_ACTIVE: '/api/procurement/suppliers/active',
  SUPPLIER_BY_ID: (id: string | number) => `/api/procurement/suppliers/${id}`,
  
  // Purchase Orders
  PURCHASE_ORDERS: '/api/purchase-orders',
  PURCHASE_ORDERS_MY: '/api/purchase-orders/my',
  PURCHASE_ORDERS_NEXT_NUMBER: '/api/purchase-orders/next-number',
  PURCHASE_ORDER_BY_ID: (id: string | number) => `/api/purchase-orders/${id}`,
  PURCHASE_ORDER_ITEMS: (id: string | number) => `/api/purchase-orders/${id}/items`,
  PURCHASE_ORDER_ATTACHMENTS: (id: string | number) => `/api/purchase-orders/${id}/attachments`,
  PURCHASE_ORDER_SUBMIT: (id: string | number) => `/api/purchase-orders/${id}/submit`,
  PURCHASE_ORDER_APPROVE: (id: string | number) => `/api/purchase-orders/${id}/approve`,
  PURCHASE_ORDER_REJECT: (id: string | number) => `/api/purchase-orders/${id}/reject`,
  
  // PO Attachments (direct access)
  PO_ATTACHMENT_DOWNLOAD: (id: string | number) => `/api/po-attachments/${id}/download`,
} as const;

// ============================================================================
// JOBS & PANELS
// ============================================================================
export const JOBS_ROUTES = {
  LIST: '/api/jobs',
  PROJECTS: '/api/projects',
  BY_ID: (id: string | number) => `/api/jobs/${id}`,
  SETTINGS: (id: string | number) => `/api/jobs/${id}/settings`,
  COST_BREAKDOWN: (id: string | number) => `/api/jobs/${id}/cost-breakdown`,
  COST_OVERRIDES: (id: string | number) => `/api/jobs/${id}/cost-overrides`,
  COST_OVERRIDE_BY_ID: (jobId: string | number, overrideId: string | number) => `/api/jobs/${jobId}/cost-overrides/${overrideId}`,
  COST_OVERRIDES_INITIALIZE: (id: string | number) => `/api/jobs/${id}/cost-overrides/initialize`,
  PANELS: (id: string | number) => `/api/jobs/${id}/panels`,
  PANELS_IMPORT_ESTIMATE: (id: string | number) => `/api/jobs/${id}/panels/import-estimate`,
  IMPORT_ESTIMATE: (id: string | number) => `/api/jobs/${id}/import-estimate`,
  PANEL_RATES: (id: string | number) => `/api/jobs/${id}/panel-rates`,
  PANEL_RATE_BY_TYPE: (jobId: string | number, panelTypeId: string | number) => `/api/jobs/${jobId}/panel-rates/${panelTypeId}`,
  TOTALS: (id: string | number) => `/api/jobs/${id}/totals`,
} as const;

export const PANELS_ROUTES = {
  LIST: '/api/panels',
  BY_ID: (id: string | number) => `/api/panels/${id}`,
  DETAILS: (id: string | number) => `/api/panels/${id}/details`,
  BY_JOB: (jobId: string | number) => `/api/jobs/${jobId}/panels`,
  IMPORT: '/api/panels/import',
  APPROVAL: (id: string | number) => `/api/panels/${id}/approval`,
  BULK_APPROVAL: '/api/panels/bulk-approval',
  APPROVED_FOR_PRODUCTION: '/api/panels/approved-for-production',
  DOCUMENT_STATUS: (id: string | number) => `/api/panels/${id}/document-status`,
} as const;

export const PANEL_TYPES_ROUTES = {
  LIST: '/api/panel-types',
  BY_ID: (id: string | number) => `/api/panel-types/${id}`,
  COST_COMPONENTS: (id: string | number) => `/api/panel-types/${id}/cost-components`,
} as const;

// ============================================================================
// PRODUCTION
// ============================================================================
export const PRODUCTION_ROUTES = {
  // Slots
  SLOTS: '/api/production-slots',
  SLOT_BY_ID: (id: string | number) => `/api/production-slots/${id}`,
  SLOTS_GENERATE: '/api/production-slots/generate',
  SLOTS_GENERATE_FOR_JOB: (jobId: string | number) => `/api/production-slots/generate/${jobId}`,
  SLOTS_JOBS_WITHOUT: '/api/production-slots/jobs-without-slots',
  SLOT_ADJUST: (id: string | number) => `/api/production-slots/${id}/adjust`,
  SLOT_ADJUSTMENTS: (id: string | number) => `/api/production-slots/${id}/adjustments`,
  SLOT_BOOK: (id: string | number) => `/api/production-slots/${id}/book`,
  SLOT_COMPLETE: (id: string | number) => `/api/production-slots/${id}/complete`,
  SLOT_ASSIGN_PANELS: (id: string | number) => `/api/production-slots/${id}/assign-panels`,
  SLOT_PANEL_ENTRIES: (id: string | number) => `/api/production-slots/${id}/panel-entries`,
  SLOTS_CHECK_LEVELS: (jobId: string | number) => `/api/production-slots/check-levels/${jobId}`,
  
  // Entries
  ENTRIES: '/api/production-entries',
  ENTRY_BY_ID: (id: string | number) => `/api/production-entries/${id}`,
  ENTRIES_BATCH_STATUS: '/api/production-entries/batch-status',
  
  // Summary & Reports
  SUMMARY: '/api/production-summary',
  SUMMARY_WITH_COSTS: '/api/production-summary-with-costs',
  DAYS: '/api/production-days',
  DAY_BY_ID: (id: string | number) => `/api/production-days/${id}`,
  REPORTS: '/api/production-reports',
  
  // Schedule (new production schedule page)
  SCHEDULE_STATS: '/api/production-schedule/stats',
  SCHEDULE_READY_PANELS: '/api/production-schedule/ready-panels',
  SCHEDULE_DAYS: '/api/production-schedule/days',
  SCHEDULE_ADD_PANELS: '/api/production-schedule/add-panels',
} as const;

// ============================================================================
// DRAFTING
// ============================================================================
export const DRAFTING_ROUTES = {
  PROGRAM: '/api/drafting-program',
  GENERATE: '/api/drafting-program/generate',
  MY_ALLOCATED: '/api/drafting-program/my-allocated',
  BY_PANEL: (panelId: string | number) => `/api/drafting-program/${panelId}`,
  ASSIGN: (panelId: string | number) => `/api/drafting-program/${panelId}/assign`,
  BY_JOB: (jobId: string | number) => `/api/drafting-program/job/${jobId}`,
  SCHEDULE: '/api/drafting/schedule',
} as const;

// ============================================================================
// LOGISTICS
// ============================================================================
export const LOGISTICS_ROUTES = {
  LOAD_LISTS: '/api/load-lists',
  LOAD_LIST_BY_ID: (id: string | number) => `/api/load-lists/${id}`,
  LOAD_LIST_PANELS: (id: string | number) => `/api/load-lists/${id}/panels`,
  LOAD_LIST_PANEL_REMOVE: (loadListId: string | number, panelId: string | number) => `/api/load-lists/${loadListId}/panels/${panelId}`,
  LOAD_LIST_DELIVERY: (id: string | number) => `/api/load-lists/${id}/delivery`,
  DELIVERY_RECORD_BY_ID: (id: string | number) => `/api/delivery-records/${id}`,
  TRAILER_TYPES: '/api/trailer-types',
  TRAILER_TYPE_BY_ID: (id: string | number) => `/api/trailer-types/${id}`,
} as const;

// ============================================================================
// FACTORIES
// ============================================================================
export const FACTORIES_ROUTES = {
  LIST: '/api/factories',
  BY_ID: (id: string | number) => `/api/factories/${id}`,
  BEDS: (factoryId: string | number) => `/api/factories/${factoryId}/beds`,
  BED_BY_ID: (factoryId: string | number, bedId: string | number) => `/api/factories/${factoryId}/beds/${bedId}`,
} as const;

// ============================================================================
// TASKS
// ============================================================================
export const TASKS_ROUTES = {
  GROUPS: '/api/task-groups',
  GROUP_BY_ID: (id: string | number) => `/api/task-groups/${id}`,
  LIST: '/api/tasks',
  BY_ID: (id: string | number) => `/api/tasks/${id}`,
  ASSIGNEES: (id: string | number) => `/api/tasks/${id}/assignees`,
  UPDATES: (id: string | number) => `/api/tasks/${id}/updates`,
  UPDATE_BY_ID: (id: string | number) => `/api/task-updates/${id}`,
  FILES: (id: string | number) => `/api/tasks/${id}/files`,
  FILE_BY_ID: (id: string | number) => `/api/task-files/${id}`,
  NOTIFICATIONS: '/api/task-notifications',
  NOTIFICATIONS_UNREAD_COUNT: '/api/task-notifications/unread-count',
  NOTIFICATION_READ: (id: string | number) => `/api/task-notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/api/task-notifications/read-all',
  GROUPS_REORDER: '/api/task-groups/reorder',
  TASKS_REORDER: '/api/tasks/reorder',
  MOVE_TASK: (id: string | number) => `/api/tasks/${id}/move`,
} as const;

// ============================================================================
// CHAT
// ============================================================================
export const CHAT_ROUTES = {
  CONVERSATIONS: '/api/chat/conversations',
  CONVERSATION_BY_ID: (id: string | number) => `/api/chat/conversations/${id}`,
  MESSAGES: (conversationId: string | number) => `/api/chat/conversations/${conversationId}/messages`,
  MESSAGE_BY_ID: (conversationId: string | number, messageId: string | number) => `/api/chat/conversations/${conversationId}/messages/${messageId}`,
  MEMBERS: (conversationId: string | number) => `/api/chat/conversations/${conversationId}/members`,
  USERS: '/api/chat/users',
  UNREAD_COUNT: '/api/chat/unread-count',
  MARK_READ: '/api/chat/mark-read',
  MARK_READ_CONVERSATION: (conversationId: string | number) => `/api/chat/conversations/${conversationId}/read`,
  PANELS: '/api/chat/panels',
  PANELS_COUNTS: '/api/chat/panels/counts',
  PANEL_CONVERSATION: (panelId: string | number) => `/api/chat/panels/${panelId}/conversation`,
} as const;

// ============================================================================
// ADMIN
// ============================================================================
export const ADMIN_ROUTES = {
  // Users
  USERS: '/api/admin/users',
  USER_BY_ID: (id: string | number) => `/api/admin/users/${id}`,
  USER_WORK_HOURS: (id: string | number) => `/api/admin/users/${id}/work-hours`,
  USER_PERMISSIONS: '/api/admin/user-permissions',
  USER_PERMISSION_BY_ID: (id: string | number) => `/api/admin/user-permissions/${id}`,
  USER_PERMISSION_INITIALIZE: (id: string | number) => `/api/admin/user-permissions/${id}/initialize`,
  USER_PERMISSION_UPDATE: (userId: string | number, functionKey: string) => `/api/admin/user-permissions/${userId}/${functionKey}`,
  
  // Jobs
  JOBS: '/api/admin/jobs',
  JOB_BY_ID: (id: string | number) => `/api/admin/jobs/${id}`,
  JOBS_IMPORT: '/api/admin/jobs/import',
  JOB_BUILD_LEVELS: (id: string | number) => `/api/admin/jobs/${id}/build-levels`,
  JOB_GENERATE_LEVELS: (id: string | number) => `/api/admin/jobs/${id}/generate-levels`,
  JOB_LEVEL_CYCLE_TIMES: (id: string | number) => `/api/admin/jobs/${id}/level-cycle-times`,
  JOB_PRODUCTION_SLOT_STATUS: (id: string | number) => `/api/admin/jobs/${id}/production-slot-status`,
  JOB_UPDATE_PRODUCTION_SLOTS: (id: string | number) => `/api/admin/jobs/${id}/update-production-slots`,
  
  // Panels (admin management routes - uses /api/panels/admin pattern)
  PANELS: '/api/panels/admin',
  PANEL_BY_ID: (id: string | number) => `/api/panels/admin/${id}`,
  PANELS_IMPORT: '/api/panels/admin/import',
  PANELS_SOURCE_COUNTS: '/api/panels/admin/source-counts',
  PANELS_BY_SOURCE: (sourceId: string | number) => `/api/panels/admin/by-source/${sourceId}`,
  PANEL_VALIDATE: (id: string | number) => `/api/panels/admin/${id}/validate`,
  PANEL_UPLOAD_PDF: (id: string | number) => `/api/panels/admin/${id}/upload-pdf`,
  PANEL_DOWNLOAD_PDF: (id: string | number) => `/api/panels/admin/${id}/download-pdf`,
  PANEL_ANALYZE_PDF: (id: string | number) => `/api/panels/admin/${id}/analyze-pdf`,
  PANEL_APPROVE_PRODUCTION: (id: string | number) => `/api/panels/admin/${id}/approve-production`,
  PANEL_REVOKE_PRODUCTION: (id: string | number) => `/api/panels/admin/${id}/revoke-production`,
  
  // Panel Types (admin management routes)
  PANEL_TYPES: '/api/panel-types/admin',
  PANEL_TYPE_BY_ID: (id: string | number) => `/api/panel-types/admin/${id}`,
  PANEL_TYPES_COST_SUMMARIES: '/api/panel-types/admin/cost-summaries',
  
  // Factories
  FACTORIES: '/api/admin/factories',
  FACTORY_BY_ID: (id: string | number) => `/api/admin/factories/${id}`,
  FACTORY_BEDS: (id: string | number) => `/api/admin/factories/${id}/beds`,
  FACTORY_BED_BY_ID: (factoryId: string | number, bedId: string | number) => `/api/admin/factories/${factoryId}/beds/${bedId}`,
  
  // Devices
  DEVICES: '/api/admin/devices',
  DEVICE_BY_ID: (id: string | number) => `/api/admin/devices/${id}`,
  
  // Companies
  COMPANIES: '/api/admin/companies',
  COMPANY_BY_ID: (id: string | number) => `/api/admin/companies/${id}`,
  
  // Settings
  SETTINGS: '/api/admin/settings',
  SETTINGS_COMPANY_NAME: '/api/admin/settings/company-name',
  SETTINGS_LOGO: '/api/admin/settings/logo',
  
  // Work Types
  WORK_TYPES: '/api/admin/work-types',
  WORK_TYPE_BY_ID: (id: string | number) => `/api/admin/work-types/${id}`,
  
  // Zones
  ZONES: '/api/admin/zones',
  ZONE_BY_ID: (id: string | number) => `/api/admin/zones/${id}`,
  
  // Trailer Types
  TRAILER_TYPES: '/api/admin/trailer-types',
  TRAILER_TYPE_BY_ID: (id: string | number) => `/api/admin/trailer-types/${id}`,
  
  // CFMEU Calendars
  CFMEU_CALENDARS: '/api/admin/cfmeu-calendars',
  CFMEU_CALENDAR_BY_ID: (id: string | number) => `/api/admin/cfmeu-calendars/${id}`,
  CFMEU_HOLIDAYS: (calendarId: string | number) => `/api/admin/cfmeu-calendars/${calendarId}/holidays`,
  CFMEU_SYNC: '/api/admin/cfmeu-calendars/sync',
  CFMEU_SYNC_ALL: '/api/admin/cfmeu-calendars/sync-all',
  
  // Data Deletion
  DATA_DELETION_COUNTS: '/api/admin/data-deletion/counts',
  DATA_DELETION_VALIDATE: '/api/admin/data-deletion/validate',
  DATA_DELETION_DELETE: '/api/admin/data-deletion/delete',
  DATA_DELETION_JOBS: '/api/admin/data-deletion/jobs',
  DATA_DELETION_USERS: '/api/admin/data-deletion/users',
  DATA_DELETION_DAILY_LOGS: '/api/admin/data-deletion/daily-logs',
} as const;

// ============================================================================
// REPORTS
// ============================================================================
export const REPORTS_ROUTES = {
  LIST: '/api/reports',
  PRODUCTION_DAILY: '/api/reports/production-daily',
  PRODUCTION_WITH_COSTS: '/api/reports/production-with-costs',
  DRAFTING_DAILY: '/api/reports/drafting-daily',
  LOGISTICS: '/api/reports/logistics',
  COST_ANALYSIS: '/api/reports/cost-analysis',
  COST_ANALYSIS_DAILY: '/api/reports/cost-analysis-daily',
  LABOUR_COST_ANALYSIS: '/api/reports/labour-cost-analysis',
  WEEKLY_WAGES: '/api/reports/weekly-wages',
  TIME_SUMMARY: '/api/reports/time-summary',
} as const;

// ============================================================================
// DASHBOARD
// ============================================================================
export const DASHBOARD_ROUTES = {
  STATS: '/api/dashboard/stats',
  KPI: '/api/dashboard/kpi',
} as const;

// ============================================================================
// DAILY LOGS
// ============================================================================
export const DAILY_LOGS_ROUTES = {
  LIST: '/api/daily-logs',
  SUBMITTED: '/api/daily-logs/submitted',
  BY_ID: (id: string | number) => `/api/daily-logs/${id}`,
  ENTRIES: (logId: string | number) => `/api/daily-logs/${logId}/entries`,
  SUBMIT: (id: string | number) => `/api/daily-logs/${id}/submit`,
  APPROVE: (id: string | number) => `/api/daily-logs/${id}/approve`,
  REJECT: (id: string | number) => `/api/daily-logs/${id}/reject`,
  MERGE: (id: string | number) => `/api/daily-logs/${id}/merge`,
} as const;

// ============================================================================
// TIMER SESSIONS
// ============================================================================
export const TIMER_ROUTES = {
  LIST: '/api/timer-sessions',
  ACTIVE: '/api/timer-sessions/active',
  BY_ID: (id: string | number) => `/api/timer-sessions/${id}`,
  START: '/api/timer-sessions/start',
  PAUSE: (id: string | number) => `/api/timer-sessions/${id}/pause`,
  RESUME: (id: string | number) => `/api/timer-sessions/${id}/resume`,
  STOP: (id: string | number) => `/api/timer-sessions/${id}/stop`,
  CANCEL: (id: string | number) => `/api/timer-sessions/${id}/cancel`,
  PANEL_HISTORY: (panelId: string) => `/api/timer-sessions/panel/${panelId}`,
} as const;

// ============================================================================
// AGENT (Windows Agent Data Ingestion)
// ============================================================================
export const AGENT_ROUTES = {
  INGEST: '/api/agent/ingest',
  STATUS: '/api/agent/status',
} as const;

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================
export const DOCUMENT_ROUTES = {
  // Documents
  LIST: '/api/documents',
  BY_ID: (id: string | number) => `/api/documents/${id}`,
  UPLOAD: '/api/documents/upload',
  VIEW: (id: string | number) => `/api/documents/${id}/view`,
  DOWNLOAD: (id: string | number) => `/api/documents/${id}/download`,
  NEW_VERSION: (id: string | number) => `/api/documents/${id}/new-version`,
  VERSIONS: (id: string | number) => `/api/documents/${id}/versions`,
  STATUS: (id: string | number) => `/api/documents/${id}/status`,
  NEXT_NUMBER: '/api/documents/next-number',
  ANALYZE_VERSION: '/api/documents/analyze-version',
  
  // Panel Documents (mini register)
  PANEL_DOCUMENTS: (panelId: string) => `/api/panels/${panelId}/documents`,
  PANEL_DOCUMENT_UPLOAD: (panelId: string) => `/api/panels/${panelId}/documents/upload`,
  
  // Document Types
  TYPES: '/api/document-types',
  TYPES_ACTIVE: '/api/document-types/active',
  TYPE_BY_ID: (id: string | number) => `/api/document-types/${id}`,
  
  // Document Type Statuses
  TYPE_STATUSES: (typeId: string | number) => `/api/document-types/${typeId}/statuses`,
  TYPE_STATUS_BY_ID: (typeId: string | number, statusId: string | number) => `/api/document-types/${typeId}/statuses/${statusId}`,
  
  // Document Disciplines
  DISCIPLINES: '/api/document-disciplines',
  DISCIPLINES_ACTIVE: '/api/document-disciplines/active',
  DISCIPLINE_BY_ID: (id: string | number) => `/api/document-disciplines/${id}`,
  
  // Document Categories
  CATEGORIES: '/api/document-categories',
  CATEGORIES_ACTIVE: '/api/document-categories/active',
  CATEGORY_BY_ID: (id: string | number) => `/api/document-categories/${id}`,
  
  // Document Bundles
  BUNDLES: '/api/document-bundles',
  BUNDLE_BY_ID: (id: string | number) => `/api/document-bundles/${id}`,
  BUNDLE_BY_QR: (qrCodeId: string) => `/api/document-bundles/qr/${qrCodeId}`,
  BUNDLE_ADD_DOCUMENTS: (id: string | number) => `/api/document-bundles/${id}/documents`,
  BUNDLE_REMOVE_DOCUMENT: (bundleId: string | number, documentId: string | number) => `/api/document-bundles/${bundleId}/documents/${documentId}`,
  
  // Public bundle access (no auth required)
  PUBLIC_BUNDLE: (qrCodeId: string) => `/api/public/bundles/${qrCodeId}`,
} as const;

// ============================================================================
// REO SCHEDULING (Procurement Manager)
// ============================================================================
export const REO_SCHEDULE_ROUTES = {
  // IFC Panels list for procurement manager
  IFC_PANELS: '/api/reo-schedules/ifc-panels',
  
  // Reo Schedules
  LIST: '/api/reo-schedules',
  BY_ID: (id: string | number) => `/api/reo-schedules/${id}`,
  BY_PANEL: (panelId: string | number) => `/api/reo-schedules/panel/${panelId}`,
  
  // Schedule Items
  ITEMS: (scheduleId: string | number) => `/api/reo-schedules/${scheduleId}/items`,
  ITEM_BY_ID: (scheduleId: string | number, itemId: string | number) => `/api/reo-schedules/${scheduleId}/items/${itemId}`,
  ITEMS_BULK_STATUS: (scheduleId: string | number) => `/api/reo-schedules/${scheduleId}/items/bulk-status`,
  
  // AI Processing
  PROCESS: (scheduleId: string | number) => `/api/reo-schedules/${scheduleId}/process`,
  
  // PO Creation
  CREATE_PO: (scheduleId: string | number) => `/api/reo-schedules/${scheduleId}/create-po`,
} as const;

// ============================================================================
// ADVANCED TEMPLATES / CHECKLISTS
// ============================================================================
export const CHECKLIST_ROUTES = {
  // Entity Types (Checklist Types)
  ENTITY_TYPES: '/api/checklist/entity-types',
  ENTITY_TYPE_BY_ID: (id: string) => `/api/checklist/entity-types/${id}`,
  
  // Entity Subtypes
  ENTITY_SUBTYPES: '/api/checklist/entity-subtypes',
  ENTITY_SUBTYPES_BY_TYPE: (entityTypeId: string) => `/api/checklist/entity-types/${entityTypeId}/subtypes`,
  ENTITY_SUBTYPE_BY_ID: (id: string) => `/api/checklist/entity-subtypes/${id}`,
  
  // Templates
  TEMPLATES: '/api/checklist/templates',
  TEMPLATE_BY_ID: (id: string) => `/api/checklist/templates/${id}`,
  TEMPLATE_DUPLICATE: (id: string) => `/api/checklist/templates/${id}/duplicate`,
  TEMPLATES_BY_TYPE: (entityTypeId: string, entitySubtypeId?: string) => 
    entitySubtypeId 
      ? `/api/checklist/templates/by-type/${entityTypeId}/${entitySubtypeId}`
      : `/api/checklist/templates/by-type/${entityTypeId}`,
  
  // Instances
  INSTANCES: '/api/checklist/instances',
  INSTANCE_BY_ID: (id: string) => `/api/checklist/instances/${id}`,
  INSTANCE_COMPLETE: (id: string) => `/api/checklist/instances/${id}/complete`,
  INSTANCE_SIGN_OFF: (id: string) => `/api/checklist/instances/${id}/sign-off`,
  INSTANCES_BY_TEMPLATE: (templateId: string) => `/api/checklist/templates/${templateId}/instances`,
  INSTANCES_BY_JOB: (jobId: string) => `/api/checklist/jobs/${jobId}/instances`,
  INSTANCES_BY_PANEL: (panelId: string) => `/api/checklist/panels/${panelId}/instances`,
  
  // Reporting
  REPORTS: '/api/checklist/reports',
  REPORT_SUMMARY: '/api/checklist/reports/summary',
} as const;

// ============================================================================
// BROADCAST MESSAGING
// ============================================================================
export const BROADCAST_ROUTES = {
  TEMPLATES: '/api/broadcast-templates',
  TEMPLATE_BY_ID: (id: string) => `/api/broadcast-templates/${id}`,
  MESSAGES: '/api/broadcasts',
  SEND: '/api/broadcasts/send',
  MESSAGE_BY_ID: (id: string) => `/api/broadcasts/${id}`,
  DELIVERIES: (id: string) => `/api/broadcasts/${id}/deliveries`,
  CHANNELS_STATUS: '/api/broadcasts/channels-status',
} as const;

// ============================================================================
// TYPE EXPORTS for frontend usage
// ============================================================================
export type AuthRoutes = typeof AUTH_ROUTES;
export type UserRoutes = typeof USER_ROUTES;
export type SettingsRoutes = typeof SETTINGS_ROUTES;
export type WeeklyReportsRoutes = typeof WEEKLY_REPORTS_ROUTES;
export type ManualEntryRoutes = typeof MANUAL_ENTRY_ROUTES;
export type CfmeuRoutes = typeof CFMEU_ROUTES;
export type PoAttachmentsRoutes = typeof PO_ATTACHMENTS_ROUTES;
export type ProcurementRoutes = typeof PROCUREMENT_ROUTES;
export type JobsRoutes = typeof JOBS_ROUTES;
export type PanelsRoutes = typeof PANELS_ROUTES;
export type PanelTypesRoutes = typeof PANEL_TYPES_ROUTES;
export type ProductionRoutes = typeof PRODUCTION_ROUTES;
export type DraftingRoutes = typeof DRAFTING_ROUTES;
export type LogisticsRoutes = typeof LOGISTICS_ROUTES;
export type FactoriesRoutes = typeof FACTORIES_ROUTES;
export type TasksRoutes = typeof TASKS_ROUTES;
export type ChatRoutes = typeof CHAT_ROUTES;
export type AdminRoutes = typeof ADMIN_ROUTES;
export type ReportsRoutes = typeof REPORTS_ROUTES;
export type DashboardRoutes = typeof DASHBOARD_ROUTES;
export type DailyLogsRoutes = typeof DAILY_LOGS_ROUTES;
export type TimerRoutes = typeof TIMER_ROUTES;
export type AgentRoutes = typeof AGENT_ROUTES;
export type DocumentRoutes = typeof DOCUMENT_ROUTES;
export type ReoScheduleRoutes = typeof REO_SCHEDULE_ROUTES;
export type ChecklistRoutes = typeof CHECKLIST_ROUTES;
export type BroadcastRoutes = typeof BROADCAST_ROUTES;
