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
  SWITCH_COMPANY: '/api/auth/switch-company',
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
// INVITATIONS
// ============================================================================
export const INVITATION_ROUTES = {
  ADMIN_CREATE: '/api/admin/invitations',
  ADMIN_LIST: '/api/admin/invitations',
  ADMIN_CANCEL: (id: string) => `/api/admin/invitations/${id}/cancel`,
  VALIDATE: (token: string) => `/api/invitations/${token}`,
  REGISTER: (token: string) => `/api/invitations/${token}/register`,
} as const;

// ============================================================================
// SETTINGS
// ============================================================================
export const SETTINGS_ROUTES = {
  LOGO: '/api/settings/logo',
  PO_TERMS: '/api/settings/po-terms',
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
// EOT CLAIMS
// ============================================================================
export const EOT_CLAIMS_ROUTES = {
  LIST: '/api/eot-claims',
  BY_ID: (id: string | number) => `/api/eot-claims/${id}`,
  BY_JOB: (jobId: string | number) => `/api/eot-claims/by-job/${jobId}`,
  SUBMIT: (id: string | number) => `/api/eot-claims/${id}/submit`,
  APPROVE: (id: string | number) => `/api/eot-claims/${id}/approve`,
  REJECT: (id: string | number) => `/api/eot-claims/${id}/reject`,
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
  ITEMS_TEMPLATE: '/api/procurement/items/template',
  
  // Item Categories
  ITEM_CATEGORIES: '/api/procurement/item-categories',
  ITEM_CATEGORIES_ACTIVE: '/api/procurement/item-categories/active',
  ITEM_CATEGORY_BY_ID: (id: string | number) => `/api/procurement/item-categories/${id}`,

  // Construction Stages
  CONSTRUCTION_STAGES: '/api/procurement/construction-stages',
  
  // Customers
  CUSTOMERS: '/api/customers',
  CUSTOMERS_ACTIVE: '/api/customers/active',
  CUSTOMERS_QUICK: '/api/customers/quick',
  CUSTOMERS_TEMPLATE: '/api/customers/template',
  CUSTOMERS_IMPORT: '/api/customers/import',
  CUSTOMERS_EXPORT: '/api/customers/export',
  CUSTOMER_BY_ID: (id: string | number) => `/api/customers/${id}`,

  // Suppliers
  SUPPLIERS: '/api/procurement/suppliers',
  SUPPLIERS_ACTIVE: '/api/procurement/suppliers/active',
  SUPPLIERS_EQUIPMENT_HIRE: '/api/procurement/suppliers/equipment-hire',
  SUPPLIERS_TEMPLATE: '/api/procurement/suppliers/template',
  SUPPLIERS_IMPORT: '/api/procurement/suppliers/import',
  SUPPLIERS_EXPORT: '/api/procurement/suppliers/export',
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
  PURCHASE_ORDER_RECEIVE: (id: string | number) => `/api/purchase-orders/${id}/receive`,
  PURCHASE_ORDER_SEND_EMAIL: (id: string | number) => `/api/purchase-orders/${id}/send-email`,
  PURCHASE_ORDER_PDF: (id: string | number) => `/api/purchase-orders/${id}/pdf`,
  PURCHASE_ORDER_SEND_WITH_PDF: (id: string | number) => `/api/purchase-orders/${id}/send-with-pdf`,
  
  // PO Attachments (direct access)
  PO_ATTACHMENT_DOWNLOAD: (id: string | number) => `/api/po-attachments/${id}/download`,
} as const;

// ============================================================================
// HIRE BOOKINGS
// ============================================================================
export const HIRE_ROUTES = {
  LIST: '/api/hire-bookings',
  NEXT_NUMBER: '/api/hire-bookings/next-number',
  BY_ID: (id: string | number) => `/api/hire-bookings/${id}`,
  SUBMIT: (id: string | number) => `/api/hire-bookings/${id}/submit`,
  APPROVE: (id: string | number) => `/api/hire-bookings/${id}/approve`,
  REJECT: (id: string | number) => `/api/hire-bookings/${id}/reject`,
  BOOK: (id: string | number) => `/api/hire-bookings/${id}/book`,
  PICKUP: (id: string | number) => `/api/hire-bookings/${id}/pickup`,
  ON_HIRE: (id: string | number) => `/api/hire-bookings/${id}/on-hire`,
  RETURN: (id: string | number) => `/api/hire-bookings/${id}/return`,
  CANCEL: (id: string | number) => `/api/hire-bookings/${id}/cancel`,
  CLOSE: (id: string | number) => `/api/hire-bookings/${id}/close`,
  SEND_EMAIL: (id: string | number) => `/api/hire-bookings/${id}/send-email`,
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
  MY_MEMBERSHIPS: '/api/jobs/my-memberships',
  OPPORTUNITIES: '/api/jobs/opportunities',
  OPPORTUNITY_BY_ID: (id: string | number) => `/api/jobs/opportunities/${id}`,
  OPPORTUNITY_HISTORY: (id: string | number) => `/api/jobs/opportunities/${id}/history`,
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
  READY_FOR_LOADING: '/api/panels/ready-for-loading',
  DOCUMENT_STATUS: (id: string | number) => `/api/panels/${id}/document-status`,
  AUDIT_LOGS: (id: string | number) => `/api/panels/${id}/audit-logs`,
  LIFECYCLE: (id: string | number) => `/api/panels/${id}/lifecycle`,
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
  LOAD_LIST_RETURN: (id: string | number) => `/api/load-lists/${id}/return`,
  LOAD_RETURN_BY_ID: (id: string | number) => `/api/load-returns/${id}`,
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
  SEND_EMAIL: '/api/tasks/send-email',
  ASSIGNEE_BY_ID: (id: string | number) => `/api/task-assignees/${id}`,
  GROUP_MEMBERS: (id: string | number) => `/api/task-groups/${id}/members`,
  EMAIL_DROP: (id: string | number) => `/api/tasks/${id}/email-drop`,
} as const;

// ============================================================================
// OPPORTUNITY UPDATES & FILES
// ============================================================================
export const OPPORTUNITY_ROUTES = {
  UPDATES: (id: string | number) => `/api/opportunities/${id}/updates`,
  UPDATE_BY_ID: (id: string | number) => `/api/opportunity-updates/${id}`,
  FILES: (id: string | number) => `/api/opportunities/${id}/files`,
  FILE_BY_ID: (id: string | number) => `/api/opportunity-files/${id}`,
  EMAIL_DROP: (id: string | number) => `/api/opportunities/${id}/email-drop`,
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
  TOTAL_UNREAD: '/api/chat/total-unread',
  MARK_READ: '/api/chat/mark-read',
  MARK_READ_CONVERSATION: (conversationId: string | number) => `/api/chat/conversations/${conversationId}/read`,
  PANELS: '/api/chat/panels',
  PANELS_COUNTS: '/api/chat/panels/counts',
  PANEL_CONVERSATION: (panelId: string | number) => `/api/chat/panels/${panelId}/conversation`,
  TOPICS: '/api/chat/topics',
  TOPIC_BY_ID: (id: string | number) => `/api/chat/topics/${id}`,
  TOPIC_REORDER: '/api/chat/topics/reorder',
  CONVERSATION_TOPIC: (conversationId: string | number) => `/api/chat/conversations/${conversationId}/topic`,
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
  USER_PERMISSION_APPLY_TYPE: (userId: string | number) => `/api/admin/user-permissions/${userId}/apply-type`,

  PERMISSION_TYPES: '/api/admin/permission-types',
  PERMISSION_TYPE_BY_ID: (id: string | number) => `/api/admin/permission-types/${id}`,

  // Jobs
  JOBS: '/api/admin/jobs',
  JOB_BY_ID: (id: string | number) => `/api/admin/jobs/${id}`,
  JOBS_IMPORT: '/api/admin/jobs/import',
  JOB_BUILD_LEVELS: (id: string | number) => `/api/admin/jobs/${id}/build-levels`,
  JOB_GENERATE_LEVELS: (id: string | number) => `/api/admin/jobs/${id}/generate-levels`,
  JOB_LEVEL_CYCLE_TIMES: (id: string | number) => `/api/admin/jobs/${id}/level-cycle-times`,
  JOB_PROGRAMME: (id: string | number) => `/api/admin/jobs/${id}/programme`,
  JOB_PROGRAMME_ENTRY: (jobId: string | number, entryId: string | number) => `/api/admin/jobs/${jobId}/programme/${entryId}`,
  JOB_PROGRAMME_SPLIT: (id: string | number) => `/api/admin/jobs/${id}/programme/split`,
  JOB_PROGRAMME_REORDER: (id: string | number) => `/api/admin/jobs/${id}/programme/reorder`,
  JOB_PROGRAMME_RECALC: (id: string | number) => `/api/admin/jobs/${id}/programme/recalculate`,
  JOB_PRODUCTION_SLOT_STATUS: (id: string | number) => `/api/admin/jobs/${id}/production-slot-status`,
  JOB_UPDATE_PRODUCTION_SLOTS: (id: string | number) => `/api/admin/jobs/${id}/update-production-slots`,
  JOB_PHASE_STATUS: (id: string | number) => `/api/admin/jobs/${id}/phase-status`,
  JOB_AUDIT_LOG: (id: string | number) => `/api/admin/jobs/${id}/audit-log`,
  JOB_MEMBERS: (id: string | number) => `/api/admin/jobs/${id}/members`,
  JOB_MEMBER_DELETE: (jobId: string | number, userId: string | number) => `/api/admin/jobs/${jobId}/members/${userId}`,
  
  // Panels (admin management routes - uses /api/panels/admin pattern)
  PANELS: '/api/panels/admin',
  PANELS_BULK_STATUS: '/api/panels/bulk-status',
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
  
  // Departments
  DEPARTMENTS: '/api/admin/departments',
  DEPARTMENT_BY_ID: (id: string | number) => `/api/admin/departments/${id}`,
  
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

  // Data Management (individual record deletion)
  DATA_MGMT_ITEMS: '/api/admin/data-management/items',
  DATA_MGMT_ITEM_DELETE: (id: string) => `/api/admin/data-management/items/${id}`,
  DATA_MGMT_ITEM_CATEGORIES: '/api/admin/data-management/item-categories',
  DATA_MGMT_ITEM_CATEGORY_DELETE: (id: string) => `/api/admin/data-management/item-categories/${id}`,
  DATA_MGMT_ASSETS: '/api/admin/data-management/assets',
  DATA_MGMT_ASSET_DELETE: (id: string) => `/api/admin/data-management/assets/${id}`,
  DATA_MGMT_PROGRESS_CLAIMS: '/api/admin/data-management/progress-claims',
  DATA_MGMT_PROGRESS_CLAIM_DELETE: (id: string) => `/api/admin/data-management/progress-claims/${id}`,
  DATA_MGMT_BROADCASTS: '/api/admin/data-management/broadcasts',
  DATA_MGMT_BROADCAST_DELETE: (id: string) => `/api/admin/data-management/broadcasts/${id}`,
  DATA_MGMT_BROADCAST_TEMPLATES: '/api/admin/data-management/broadcast-templates',
  DATA_MGMT_BROADCAST_TEMPLATE_DELETE: (id: string) => `/api/admin/data-management/broadcast-templates/${id}`,
  DATA_MGMT_DOCUMENTS: '/api/admin/data-management/documents',
  DATA_MGMT_DOCUMENT_DELETE: (id: string) => `/api/admin/data-management/documents/${id}`,
  DATA_MGMT_CONTRACTS: '/api/admin/data-management/contracts',
  DATA_MGMT_CONTRACT_DELETE: (id: string) => `/api/admin/data-management/contracts/${id}`,
  DATA_MGMT_DELIVERIES: '/api/admin/data-management/deliveries',
  DATA_MGMT_DELIVERY_DELETE: (id: string) => `/api/admin/data-management/deliveries/${id}`,
  DATA_MGMT_LOAD_LISTS: '/api/admin/data-management/load-lists',
  DATA_MGMT_LOAD_LIST_DELETE: (id: string) => `/api/admin/data-management/load-lists/${id}`,
  DATA_MGMT_SUPPLIERS: '/api/admin/data-management/suppliers',
  DATA_MGMT_SUPPLIER_DELETE: (id: string) => `/api/admin/data-management/suppliers/${id}`,
  DATA_MGMT_CUSTOMERS: '/api/admin/data-management/customers',
  DATA_MGMT_CUSTOMER_DELETE: (id: string) => `/api/admin/data-management/customers/${id}`,
  DATA_MGMT_EMPLOYEES: '/api/admin/data-management/employees',
  DATA_MGMT_EMPLOYEE_DELETE: (id: string) => `/api/admin/data-management/employees/${id}`,
  DATA_MGMT_ACTIVITY_TEMPLATES: '/api/admin/data-management/activity-templates',
  DATA_MGMT_ACTIVITY_TEMPLATE_DELETE: (id: string) => `/api/admin/data-management/activity-templates/${id}`,
  DATA_MGMT_JOB_ACTIVITIES: '/api/admin/data-management/job-activities',
  DATA_MGMT_JOB_ACTIVITY_DELETE: (id: string) => `/api/admin/data-management/job-activities/${id}`,
  DATA_MGMT_ACTIVITY_STAGES: '/api/admin/data-management/activity-stages',
  DATA_MGMT_ACTIVITY_STAGE_DELETE: (id: string) => `/api/admin/data-management/activity-stages/${id}`,
  DATA_MGMT_ACTIVITY_CONSULTANTS: '/api/admin/data-management/activity-consultants',
  DATA_MGMT_ACTIVITY_CONSULTANT_DELETE: (id: string) => `/api/admin/data-management/activity-consultants/${id}`,
  DATA_MGMT_COST_CODES: '/api/admin/data-management/cost-codes',
  DATA_MGMT_COST_CODE_DELETE: (id: string) => `/api/admin/data-management/cost-codes/${id}`,
  DATA_MGMT_CHILD_COST_CODES: '/api/admin/data-management/child-cost-codes',
  DATA_MGMT_CHILD_COST_CODE_DELETE: (id: string) => `/api/admin/data-management/child-cost-codes/${id}`,
  DATA_MGMT_TENDERS: '/api/admin/data-management/tenders',
  DATA_MGMT_TENDER_DELETE: (id: string) => `/api/admin/data-management/tenders/${id}`,
  DATA_MGMT_BUDGETS: '/api/admin/data-management/budgets',
  DATA_MGMT_BUDGET_DELETE: (id: string) => `/api/admin/data-management/budgets/${id}`,
  DATA_MGMT_BOQ_GROUPS: '/api/admin/data-management/boq-groups',
  DATA_MGMT_BOQ_GROUP_DELETE: (id: string) => `/api/admin/data-management/boq-groups/${id}`,
  DATA_MGMT_AP_INVOICES: '/api/admin/data-management/ap-invoices',
  DATA_MGMT_AP_INVOICE_DELETE: (id: string) => `/api/admin/data-management/ap-invoices/${id}`,
  DATA_MGMT_BULK_DELETE: (entityType: string) => `/api/admin/data-management/${entityType}/bulk-delete`,
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
  MY_DUE_TASKS: '/api/dashboard/my-due-tasks',
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
  CANCEL_STALE: '/api/timer-sessions/cancel-stale',
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
  THUMBNAIL: (id: string | number) => `/api/documents/${id}/thumbnail`,
  DOWNLOAD: (id: string | number) => `/api/documents/${id}/download`,
  NEW_VERSION: (id: string | number) => `/api/documents/${id}/new-version`,
  VERSIONS: (id: string | number) => `/api/documents/${id}/versions`,
  STATUS: (id: string | number) => `/api/documents/${id}/status`,
  NEXT_NUMBER: '/api/documents/next-number',
  ANALYZE_VERSION: '/api/documents/analyze-version',
  ANALYZE_EXISTING_VERSIONS: (id: string | number) => `/api/documents/${id}/analyze-changes`,
  EXTRACT_METADATA: '/api/documents/extract-metadata',
  BULK_UPLOAD: '/api/documents/bulk-upload',
  CHECK_DUPLICATES: '/api/documents/check-duplicates',
  
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
  
  // Visual diff / overlay comparison
  VISUAL_DIFF: '/api/documents/visual-diff',

  // Send documents via email
  SEND_DOCUMENTS_EMAIL: '/api/documents/send-email',

  // Public document download (token-based, no auth)
  PUBLIC_DOCUMENT_DOWNLOAD: (token: string) => `/api/public/documents/${token}/download`,

  // Drawing Package Processing
  DRAWING_PACKAGE_ANALYZE: '/api/documents/drawing-package/analyze',
  DRAWING_PACKAGE_REGISTER: '/api/documents/drawing-package/register',

  // ZIP Bulk Upload
  ZIP_UPLOAD_EXTRACT: '/api/documents/zip-upload/extract',
  ZIP_UPLOAD_REGISTER: '/api/documents/zip-upload/register',

  // Knowledge Base integration
  ADD_TO_KB: (id: string | number) => `/api/documents/${id}/add-to-kb`,
  REMOVE_FROM_KB: (id: string | number) => `/api/documents/${id}/remove-from-kb`,

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
  TEMPLATE_VERSIONS: (id: string) => `/api/checklist/templates/${id}/versions`,
  TEMPLATE_NEW_VERSION: (id: string) => `/api/checklist/templates/${id}/new-version`,
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
  
  // Work Orders
  WORK_ORDERS: '/api/checklist/work-orders',
  WORK_ORDER_BY_ID: (id: string) => `/api/checklist/work-orders/${id}`,
  WORK_ORDERS_BY_INSTANCE: (instanceId: string) => `/api/checklist/instances/${instanceId}/work-orders`,
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
  RESEND_DELIVERY: (deliveryId: string) => `/api/broadcasts/deliveries/${deliveryId}/resend`,
  CHANNELS_STATUS: '/api/broadcasts/channels-status',
  RECIPIENTS: '/api/broadcasts/recipients',
} as const;

// ============================================================================
// CONTRACT HUB
// ============================================================================
export const PROGRESS_CLAIMS_ROUTES = {
  LIST: '/api/progress-claims',
  NEXT_NUMBER: '/api/progress-claims/next-number',
  BY_ID: (id: string | number) => `/api/progress-claims/${id}`,
  ITEMS: (id: string | number) => `/api/progress-claims/${id}/items`,
  SUBMIT: (id: string | number) => `/api/progress-claims/${id}/submit`,
  APPROVE: (id: string | number) => `/api/progress-claims/${id}/approve`,
  REJECT: (id: string | number) => `/api/progress-claims/${id}/reject`,
  CLAIMABLE_PANELS: (jobId: string | number) => `/api/progress-claims/job/${jobId}/claimable-panels`,
  JOB_SUMMARY: (jobId: string | number) => `/api/progress-claims/job/${jobId}/summary`,
  RETENTION_SUMMARY: (jobId: string | number) => `/api/progress-claims/job/${jobId}/retention-summary`,
  RETENTION_REPORT: '/api/progress-claims/retention-report',
} as const;

export const CONTRACT_ROUTES = {
  LIST: '/api/contracts',
  BY_ID: (id: string | number) => `/api/contracts/${id}`,
  BY_JOB: (jobId: string | number) => `/api/contracts/job/${jobId}`,
  HUB: '/api/contracts/hub',
  AI_ANALYZE: '/api/contracts/ai-analyze',
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
export type ProgressClaimsRoutes = typeof PROGRESS_CLAIMS_ROUTES;
export type ContractRoutes = typeof CONTRACT_ROUTES;

// ============================================================================
// HELP SYSTEM
// ============================================================================
export const HELP_ROUTES = {
  SEARCH: '/api/help/search',
  RECENT: '/api/help/recent',
  CATEGORIES: '/api/help/categories',
  BY_KEY: (key: string) => `/api/help?key=${encodeURIComponent(key)}`,
  FEEDBACK: '/api/help/feedback',
  ADMIN_LIST: '/api/help/admin',
  ADMIN_BY_ID: (id: string | number) => `/api/help/admin/${id}`,
  ADMIN_VERSIONS: (id: string | number) => `/api/help/admin/${id}/versions`,
} as const;

// ============================================================================
// UPLOADS (Object Storage)
// ============================================================================
export const UPLOAD_ROUTES = {
  REQUEST_URL: '/api/uploads/request-url',
} as const;

export const ASSET_ROUTES = {
  LIST: '/api/admin/assets',
  LIST_SIMPLE: '/api/assets/simple',
  BY_ID: (id: string) => `/api/admin/assets/${id}`,
  CREATE: '/api/admin/assets',
  UPDATE: (id: string) => `/api/admin/assets/${id}`,
  DELETE: (id: string) => `/api/admin/assets/${id}`,
  IMPORT: '/api/admin/assets/import',
  TEMPLATE: '/api/admin/assets/template',
  AI_SUMMARY: (id: string) => `/api/admin/assets/${id}/ai-summary`,
  MAINTENANCE: (id: string) => `/api/admin/assets/${id}/maintenance`,
  MAINTENANCE_BY_ID: (assetId: string, id: string) => `/api/admin/assets/${assetId}/maintenance/${id}`,
  TRANSFERS: (id: string) => `/api/admin/assets/${id}/transfers`,
  TRANSFER_BY_ID: (assetId: string, id: string) => `/api/admin/assets/${assetId}/transfers/${id}`,
  REPAIR_REQUESTS: '/api/asset-repair-requests',
  REPAIR_REQUEST_BY_ID: (id: string) => `/api/asset-repair-requests/${id}`,
  REPAIR_REQUESTS_BY_ASSET: (assetId: string) => `/api/admin/assets/${assetId}/repair-requests`,
  NEXT_REPAIR_NUMBER: '/api/asset-repair-requests/next-number',
} as const;
export type AssetRoutes = typeof ASSET_ROUTES;
export type HelpRoutes = typeof HELP_ROUTES;
export type UploadRoutes = typeof UPLOAD_ROUTES;

// ============================================================================
// EMPLOYEE MANAGEMENT
// ============================================================================
export const EMPLOYEE_ROUTES = {
  LIST: '/api/employees',
  ACTIVE: '/api/employees/active',
  TEMPLATE: '/api/employees/template',
  IMPORT: '/api/employees/import',
  EXPORT: '/api/employees/export',
  BY_ID: (id: string | number) => `/api/employees/${id}`,
  EMPLOYMENTS: (employeeId: string | number) => `/api/employees/${employeeId}/employments`,
  EMPLOYMENT_BY_ID: (employeeId: string | number, id: string | number) => `/api/employees/${employeeId}/employments/${id}`,
  DOCUMENTS: (employeeId: string | number) => `/api/employees/${employeeId}/documents`,
  DOCUMENT_BY_ID: (employeeId: string | number, id: string | number) => `/api/employees/${employeeId}/documents/${id}`,
  ALL_LICENCES: '/api/employees/licences/all',
  LICENCES: (employeeId: string | number) => `/api/employees/${employeeId}/licences`,
  LICENCE_BY_ID: (employeeId: string | number, id: string | number) => `/api/employees/${employeeId}/licences/${id}`,
  ONBOARDINGS: (employeeId: string | number) => `/api/employees/${employeeId}/onboardings`,
  ONBOARDING_BY_ID: (employeeId: string | number, id: string | number) => `/api/employees/${employeeId}/onboardings/${id}`,
  ONBOARDING_TASKS: (employeeId: string | number, onboardingId: string | number) => `/api/employees/${employeeId}/onboardings/${onboardingId}/tasks`,
  ONBOARDING_TASK_BY_ID: (employeeId: string | number, onboardingId: string | number, taskId: string | number) => `/api/employees/${employeeId}/onboardings/${onboardingId}/tasks/${taskId}`,
} as const;
export type EmployeeRoutes = typeof EMPLOYEE_ROUTES;

// ============================================================================
// PROJECT ACTIVITIES / WORKFLOW
// ============================================================================
export const PROJECT_ACTIVITIES_ROUTES = {
  JOB_TYPES: '/api/job-types',
  JOB_TYPE_BY_ID: (id: string | number) => `/api/job-types/${id}`,
  STAGES: '/api/activity-stages',
  STAGE_BY_ID: (id: string | number) => `/api/activity-stages/${id}`,
  CONSULTANTS: '/api/activity-consultants',
  CONSULTANT_BY_ID: (id: string | number) => `/api/activity-consultants/${id}`,
  TEMPLATES: (jobTypeId: string | number) => `/api/job-types/${jobTypeId}/templates`,
  TEMPLATE_BY_ID: (id: string | number) => `/api/activity-templates/${id}`,
  TEMPLATE_SUBTASKS: (templateId: string | number) => `/api/activity-templates/${templateId}/subtasks`,
  TEMPLATE_SUBTASK_BY_ID: (id: string | number) => `/api/activity-template-subtasks/${id}`,
  TEMPLATE_CHECKLISTS: (templateId: string | number) => `/api/activity-templates/${templateId}/checklists`,
  TEMPLATE_CHECKLIST_BY_ID: (id: string | number) => `/api/activity-template-checklists/${id}`,
  TEMPLATES_REORDER: (jobTypeId: string | number) => `/api/job-types/${jobTypeId}/templates/reorder`,
  TEMPLATES_DOWNLOAD: (jobTypeId: string | number) => `/api/job-types/${jobTypeId}/templates/download-template`,
  TEMPLATES_IMPORT: (jobTypeId: string | number) => `/api/job-types/${jobTypeId}/templates/import`,
  JOB_ACTIVITIES: (jobId: string | number) => `/api/jobs/${jobId}/activities`,
  JOB_ACTIVITIES_INSTANTIATE: (jobId: string | number) => `/api/jobs/${jobId}/activities/instantiate`,
  ACTIVITY_BY_ID: (id: string | number) => `/api/job-activities/${id}`,
  ACTIVITY_ASSIGNEES: (id: string | number) => `/api/job-activities/${id}/assignees`,
  ACTIVITY_UPDATES: (id: string | number) => `/api/job-activities/${id}/updates`,
  ACTIVITY_UPDATE_BY_ID: (id: string | number) => `/api/job-activity-updates/${id}`,
  ACTIVITY_FILES: (id: string | number) => `/api/job-activities/${id}/files`,
  ACTIVITY_FILE_BY_ID: (id: string | number) => `/api/job-activity-files/${id}`,
  ACTIVITIES_REORDER: (jobId: string | number) => `/api/jobs/${jobId}/activities/reorder`,
  ACTIVITY_MOVE: (id: string | number) => `/api/job-activities/${id}/move`,
  ACTIVITY_CHECKLISTS: (activityId: string | number) => `/api/job-activities/${activityId}/checklists`,
  ACTIVITY_CHECKLIST_TOGGLE: (checklistId: string | number) => `/api/job-activity-checklists/${checklistId}/toggle`,
  ACTIVITY_CHECKLIST_SAVE: (checklistId: string | number) => `/api/job-activity-checklists/${checklistId}/save`,
  ACTIVITY_TASKS: (activityId: string | number) => `/api/job-activities/${activityId}/tasks`,
  ACTIVITY_TASKS_REORDER: (activityId: string | number) => `/api/job-activities/${activityId}/tasks/reorder`,
  JOB_ACTIVITIES_RECALCULATE: (jobId: string | number) => `/api/jobs/${jobId}/activities/recalculate`,
  JOB_ACTIVITIES_SYNC_PREDECESSORS: (jobId: string | number) => `/api/jobs/${jobId}/activities/sync-predecessors`,
  SEED: '/api/activity-seed',
} as const;
export type ProjectActivitiesRoutes = typeof PROJECT_ACTIVITIES_ROUTES;

export const ONBOARDING_ROUTES = {
  INSTRUMENTS: '/api/onboarding/instruments',
  INSTRUMENT_BY_ID: (id: string | number) => `/api/onboarding/instruments/${id}`,
  TEMPLATES: '/api/onboarding/templates',
  TEMPLATE_BY_ID: (id: string | number) => `/api/onboarding/templates/${id}`,
  TEMPLATE_TASKS: (templateId: string | number) => `/api/onboarding/templates/${templateId}/tasks`,
  TEMPLATE_TASK_BY_ID: (templateId: string | number, taskId: string | number) => `/api/onboarding/templates/${templateId}/tasks/${taskId}`,
} as const;
export type OnboardingRoutes = typeof ONBOARDING_ROUTES;
export type HireRoutes = typeof HIRE_ROUTES;

// ============================================================================
// PM CALL LOGS
// ============================================================================
export const PM_CALL_LOGS_ROUTES = {
  LIST: '/api/pm-call-logs',
  BY_ID: (id: string | number) => `/api/pm-call-logs/${id}`,
  LEVELS: (id: string | number) => `/api/pm-call-logs/${id}/levels`,
  JOB_UPCOMING_LEVELS: (jobId: string | number) => `/api/pm-call-logs/job/${jobId}/upcoming-levels`,
} as const;
export type PmCallLogsRoutes = typeof PM_CALL_LOGS_ROUTES;

// ============================================================================
// TENDER MEMBER TRACKING (Updates, Files, Activity per invitation)
// ============================================================================
export const TENDER_MEMBER_ROUTES = {
  UPDATES: (id: string | number) => `/api/tender-members/${id}/updates`,
  UPDATE_BY_ID: (id: string | number) => `/api/tender-member-updates/${id}`,
  FILES: (id: string | number) => `/api/tender-members/${id}/files`,
  FILE_BY_ID: (id: string | number) => `/api/tender-member-files/${id}`,
  EMAIL_DROP: (id: string | number) => `/api/tender-members/${id}/email-drop`,
} as const;
export type TenderMemberRoutes = typeof TENDER_MEMBER_ROUTES;

export const BUDGET_LINE_ROUTES = {
  UPDATES: (id: string | number) => `/api/budget-lines/${id}/updates`,
  UPDATE_BY_ID: (id: string | number) => `/api/budget-line-updates/${id}`,
  FILES: (id: string | number) => `/api/budget-lines/${id}/files`,
  FILE_BY_ID: (id: string | number) => `/api/budget-line-files/${id}`,
  EMAIL_DROP: (id: string | number) => `/api/budget-lines/${id}/email-drop`,
} as const;
export type BudgetLineRoutes = typeof BUDGET_LINE_ROUTES;

// ============================================================================
// MYOB INTEGRATION
// ============================================================================
export const MYOB_ROUTES = {
  AUTH: '/api/myob/auth',
  CALLBACK: '/api/myob/callback',
  STATUS: '/api/myob/status',
  DISCONNECT: '/api/myob/disconnect',
  COMPANY: '/api/myob/company',
  CUSTOMERS: '/api/myob/customers',
  SUPPLIERS: '/api/myob/suppliers',
  ACCOUNTS: '/api/myob/accounts',
  INVOICES: '/api/myob/invoices',
  ITEMS: '/api/myob/items',
  EXPORT_LOGS: '/api/myob/export-logs',
  PROFIT_AND_LOSS: '/api/myob/profit-and-loss',
} as const;
export type MyobRoutes = typeof MYOB_ROUTES;

// ============================================================================
// AP INVOICE PROCESSING
// ============================================================================
export const AP_INVOICE_ROUTES = {
  LIST: '/api/ap-invoices',
  COUNTS: '/api/ap-invoices/counts',
  BY_ID: (id: string | number) => `/api/ap-invoices/${id}`,
  UPLOAD: '/api/ap-invoices/upload',
  CONFIRM: (id: string | number) => `/api/ap-invoices/${id}/confirm`,
  SUBMIT: (id: string | number) => `/api/ap-invoices/${id}/submit`,
  ASSIGN: (id: string | number) => `/api/ap-invoices/${id}/assign`,
  APPROVE: (id: string | number) => `/api/ap-invoices/${id}/approve`,
  REJECT: (id: string | number) => `/api/ap-invoices/${id}/reject`,
  ON_HOLD: (id: string | number) => `/api/ap-invoices/${id}/on-hold`,
  URGENT: (id: string | number) => `/api/ap-invoices/${id}/urgent`,
  SPLITS: (id: string | number) => `/api/ap-invoices/${id}/splits`,
  EXPORT_MYOB: (id: string | number) => `/api/ap-invoices/${id}/export/myob`,
  EXTRACTED_FIELDS: (id: string | number) => `/api/ap-invoices/${id}/extracted-fields`,
  FIELD_MAP: (id: string | number) => `/api/ap-invoices/${id}/field-map`,
  EXTRACT: (id: string | number) => `/api/ap-invoices/${id}/extract`,
  DOCUMENT: (id: string | number) => `/api/ap-invoices/${id}/document-view`,
  COMMENTS: (id: string | number) => `/api/ap-invoices/${id}/comments`,
  ACTIVITY: (id: string | number) => `/api/ap-invoices/${id}/activity`,
  APPROVAL_PATH: (id: string | number) => `/api/ap-invoices/${id}/approval-path`,
  BULK_APPROVE: '/api/ap-invoices/bulk-approve',
  BULK_DELETE: '/api/ap-invoices/bulk-delete',
  PAGE_THUMBNAILS: (id: string | number) => `/api/ap-invoices/${id}/page-thumbnails`,
  MY_APPROVALS: '/api/ap-invoices/my-approvals',
} as const;
export type ApInvoiceRoutes = typeof AP_INVOICE_ROUTES;

export const AP_APPROVAL_RULES_ROUTES = {
  LIST: '/api/ap-approval-rules',
  BY_ID: (id: string | number) => `/api/ap-approval-rules/${id}`,
} as const;
export type ApApprovalRulesRoutes = typeof AP_APPROVAL_RULES_ROUTES;

export const AP_INBOX_ROUTES = {
  SETTINGS: '/api/ap-inbox/settings',
  EMAILS: '/api/ap-inbox/emails',
  CHECK_EMAILS: '/api/ap-inbox/check-emails',
  BACKGROUND_STATUS: '/api/ap-inbox/background-status',
  WEBHOOK: '/api/webhooks/resend-inbound',
  COUNTS: '/api/ap-inbox/counts',
} as const;
export type ApInboxRoutes = typeof AP_INBOX_ROUTES;

export const TENDER_INBOX_ROUTES = {
  SETTINGS: '/api/tender-inbox/settings',
  LIST: '/api/tender-inbox/emails',
  BY_ID: (id: string | number) => `/api/tender-inbox/emails/${id}`,
  CHECK_EMAILS: '/api/tender-inbox/check-emails',
  BACKGROUND_STATUS: '/api/tender-inbox/background-status',
  UPLOAD: '/api/tender-inbox/upload',
  DOCUMENT_VIEW: (id: string | number) => `/api/tender-inbox/emails/${id}/document-view`,
  EXTRACTED_FIELDS: (id: string | number) => `/api/tender-inbox/emails/${id}/extracted-fields`,
  EXTRACT: (id: string | number) => `/api/tender-inbox/emails/${id}/extract`,
  MATCH_TENDER: (id: string | number) => `/api/tender-inbox/emails/${id}/match`,
  ACTIVITY: (id: string | number) => `/api/tender-inbox/emails/${id}/activity`,
  PAGE_THUMBNAILS: (id: string | number) => `/api/tender-inbox/emails/${id}/page-thumbnails`,
  COUNTS: '/api/tender-inbox/counts',
} as const;
export type TenderInboxRoutes = typeof TENDER_INBOX_ROUTES;

export const DRAFTING_INBOX_ROUTES = {
  SETTINGS: '/api/drafting-inbox/settings',
  LIST: '/api/drafting-inbox/emails',
  BY_ID: (id: string | number) => `/api/drafting-inbox/emails/${id}`,
  CHECK_EMAILS: '/api/drafting-inbox/check-emails',
  BACKGROUND_STATUS: '/api/drafting-inbox/background-status',
  UPLOAD: '/api/drafting-inbox/upload',
  DOCUMENT_VIEW: (id: string | number) => `/api/drafting-inbox/emails/${id}/document-view`,
  EXTRACTED_FIELDS: (id: string | number) => `/api/drafting-inbox/emails/${id}/extracted-fields`,
  EXTRACT: (id: string | number) => `/api/drafting-inbox/emails/${id}/extract`,
  MATCH_JOB: (id: string | number) => `/api/drafting-inbox/emails/${id}/match`,
  ACTIVITY: (id: string | number) => `/api/drafting-inbox/emails/${id}/activity`,
  PAGE_THUMBNAILS: (id: string | number) => `/api/drafting-inbox/emails/${id}/page-thumbnails`,
  EMAIL_BODY: (id: string | number) => `/api/drafting-inbox/emails/${id}/body`,
  COUNTS: '/api/drafting-inbox/counts',
  TRENDS: '/api/drafting-inbox/trends',
  EMAIL_TASKS: (id: string | number) => `/api/drafting-inbox/emails/${id}/tasks`,
  CREATE_TASK: (id: string | number) => `/api/drafting-inbox/emails/${id}/tasks`,
  SUGGEST_DUE_DATE: (id: string | number) => `/api/drafting-inbox/emails/${id}/suggest-due-date`,
} as const;
export type DraftingInboxRoutes = typeof DRAFTING_INBOX_ROUTES;

export const MAIL_REGISTER_ROUTES = {
  TYPES: '/api/mail-register/types',
  LIST: '/api/mail-register',
  CREATE: '/api/mail-register',
  BY_ID: (id: string | number) => `/api/mail-register/${id}`,
  NEXT_NUMBER: '/api/mail-register/next-number',
} as const;
export type MailRegisterRoutes = typeof MAIL_REGISTER_ROUTES;

export const EXTERNAL_API_ROUTES = {
  KEYS: '/api/external-api-keys',
  KEY_BY_ID: (id: string | number) => `/api/external-api-keys/${id}`,
  KEY_LOGS: (id: string | number) => `/api/external-api-keys/${id}/logs`,
} as const;
export type ExternalApiRoutes = typeof EXTERNAL_API_ROUTES;
