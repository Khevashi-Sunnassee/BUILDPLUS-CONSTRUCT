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
  PERMISSIONS: '/api/permissions/my-permissions',
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
  
  // Suppliers
  SUPPLIERS: '/api/procurement/suppliers',
  SUPPLIERS_ACTIVE: '/api/procurement/suppliers/active',
  SUPPLIER_BY_ID: (id: string | number) => `/api/procurement/suppliers/${id}`,
  
  // Purchase Orders
  PURCHASE_ORDERS: '/api/purchase-orders',
  PURCHASE_ORDER_BY_ID: (id: string | number) => `/api/purchase-orders/${id}`,
  PURCHASE_ORDER_ITEMS: (id: string | number) => `/api/purchase-orders/${id}/items`,
  PURCHASE_ORDER_ATTACHMENTS: (id: string | number) => `/api/purchase-orders/${id}/attachments`,
  PURCHASE_ORDER_SUBMIT: (id: string | number) => `/api/purchase-orders/${id}/submit`,
  PURCHASE_ORDER_APPROVE: (id: string | number) => `/api/purchase-orders/${id}/approve`,
  PURCHASE_ORDER_REJECT: (id: string | number) => `/api/purchase-orders/${id}/reject`,
} as const;

// ============================================================================
// JOBS & PANELS
// ============================================================================
export const JOBS_ROUTES = {
  LIST: '/api/jobs',
  BY_ID: (id: string | number) => `/api/jobs/${id}`,
  SETTINGS: (id: string | number) => `/api/jobs/${id}/settings`,
  COST_BREAKDOWN: (id: string | number) => `/api/jobs/${id}/cost-breakdown`,
  COST_OVERRIDES: (id: string | number) => `/api/jobs/${id}/cost-overrides`,
  COST_OVERRIDE_BY_ID: (jobId: string | number, overrideId: string | number) => `/api/jobs/${jobId}/cost-overrides/${overrideId}`,
  COST_OVERRIDES_INITIALIZE: (id: string | number) => `/api/jobs/${id}/cost-overrides/initialize`,
  PANELS: (id: string | number) => `/api/jobs/${id}/panels`,
  PANELS_IMPORT_ESTIMATE: (id: string | number) => `/api/jobs/${id}/panels/import-estimate`,
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
  SUMMARY: '/api/production/summary',
  SUMMARY_WITH_COSTS: '/api/production-summary-with-costs',
  DAYS: '/api/production-days',
  DAY_BY_ID: (id: string | number) => `/api/production-days/${id}`,
  REPORTS: '/api/production-reports',
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
  LOAD_LIST_DELIVERY: (id: string | number) => `/api/load-lists/${id}/delivery`,
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
  NOTIFICATION_READ: (id: string | number) => `/api/task-notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/api/task-notifications/read-all',
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
  
  // Panels
  PANELS: '/api/admin/panels',
  PANEL_BY_ID: (id: string | number) => `/api/admin/panels/${id}`,
  PANELS_IMPORT: '/api/admin/panels/import',
  PANELS_SOURCE_COUNTS: '/api/admin/panels/source-counts',
  PANELS_BY_SOURCE: (sourceId: string | number) => `/api/admin/panels/by-source/${sourceId}`,
  PANEL_VALIDATE: (id: string | number) => `/api/admin/panels/${id}/validate`,
  PANEL_ANALYZE_PDF: (id: string | number) => `/api/admin/panels/${id}/analyze-pdf`,
  PANEL_APPROVE_PRODUCTION: (id: string | number) => `/api/admin/panels/${id}/approve-production`,
  PANEL_REVOKE_PRODUCTION: (id: string | number) => `/api/admin/panels/${id}/revoke-production`,
  
  // Panel Types
  PANEL_TYPES: '/api/admin/panel-types',
  PANEL_TYPE_BY_ID: (id: string | number) => `/api/admin/panel-types/${id}`,
  PANEL_TYPES_COST_SUMMARIES: '/api/admin/panel-types/cost-summaries',
  
  // Factories
  FACTORIES: '/api/admin/factories',
  FACTORY_BY_ID: (id: string | number) => `/api/admin/factories/${id}`,
  FACTORY_BEDS: (id: string | number) => `/api/admin/factories/${id}/beds`,
  FACTORY_BED_BY_ID: (factoryId: string | number, bedId: string | number) => `/api/admin/factories/${factoryId}/beds/${bedId}`,
  
  // Devices
  DEVICES: '/api/admin/devices',
  DEVICE_BY_ID: (id: string | number) => `/api/admin/devices/${id}`,
  
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
// AGENT (Windows Agent Data Ingestion)
// ============================================================================
export const AGENT_ROUTES = {
  INGEST: '/api/agent/ingest',
  STATUS: '/api/agent/status',
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
export type AgentRoutes = typeof AGENT_ROUTES;
