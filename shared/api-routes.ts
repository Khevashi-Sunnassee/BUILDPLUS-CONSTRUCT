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
  BY_ID: (id: string) => `/api/users/${id}`,
  SETTINGS: '/api/user/settings',
  PERMISSIONS: '/api/permissions/my-permissions',
} as const;

// ============================================================================
// SETTINGS
// ============================================================================
export const SETTINGS_ROUTES = {
  LOGO: '/api/settings/logo',
  WORK_TYPES: '/api/work-types',
  WORK_TYPE_BY_ID: (id: string) => `/api/work-types/${id}`,
} as const;

// ============================================================================
// WEEKLY REPORTS
// ============================================================================
export const WEEKLY_REPORTS_ROUTES = {
  WAGE_REPORTS: '/api/weekly-wage-reports',
  WAGE_REPORT_BY_ID: (id: string) => `/api/weekly-wage-reports/${id}`,
  JOB_REPORTS: '/api/weekly-job-reports',
  JOB_REPORT_BY_ID: (id: string) => `/api/weekly-job-reports/${id}`,
  MY_REPORTS: '/api/weekly-job-reports/my-reports',
} as const;

// ============================================================================
// MANUAL ENTRY & LOG ROWS
// ============================================================================
export const MANUAL_ENTRY_ROUTES = {
  ENTRY: '/api/manual-entry',
  LOG_ROWS: '/api/log-rows',
  LOG_ROW_BY_ID: (id: string) => `/api/log-rows/${id}`,
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
  BY_ID: (id: string) => `/api/po-attachments/${id}`,
} as const;

// ============================================================================
// PROCUREMENT - Items, Suppliers, Categories, Purchase Orders
// ============================================================================
export const PROCUREMENT_ROUTES = {
  // Items
  ITEMS: '/api/procurement/items',
  ITEMS_ACTIVE: '/api/procurement/items/active',
  ITEM_BY_ID: (id: string) => `/api/procurement/items/${id}`,
  ITEMS_IMPORT: '/api/procurement/items/import',
  
  // Item Categories
  ITEM_CATEGORIES: '/api/procurement/item-categories',
  ITEM_CATEGORIES_ACTIVE: '/api/procurement/item-categories/active',
  ITEM_CATEGORY_BY_ID: (id: string) => `/api/procurement/item-categories/${id}`,
  
  // Suppliers
  SUPPLIERS: '/api/procurement/suppliers',
  SUPPLIERS_ACTIVE: '/api/procurement/suppliers/active',
  SUPPLIER_BY_ID: (id: string) => `/api/procurement/suppliers/${id}`,
  
  // Purchase Orders
  PURCHASE_ORDERS: '/api/purchase-orders',
  PURCHASE_ORDER_BY_ID: (id: string) => `/api/purchase-orders/${id}`,
  PURCHASE_ORDER_ITEMS: (id: string) => `/api/purchase-orders/${id}/items`,
  PURCHASE_ORDER_ATTACHMENTS: (id: string) => `/api/purchase-orders/${id}/attachments`,
} as const;

// ============================================================================
// JOBS & PANELS
// ============================================================================
export const JOBS_ROUTES = {
  LIST: '/api/jobs',
  BY_ID: (id: string) => `/api/jobs/${id}`,
  SETTINGS: (id: string) => `/api/jobs/${id}/settings`,
  COST_BREAKDOWN: (id: string) => `/api/jobs/${id}/cost-breakdown`,
  PANELS: (id: string) => `/api/jobs/${id}/panels`,
} as const;

export const PANELS_ROUTES = {
  LIST: '/api/panels',
  BY_ID: (id: string) => `/api/panels/${id}`,
  BY_JOB: (jobId: string) => `/api/jobs/${jobId}/panels`,
  IMPORT: '/api/panels/import',
  APPROVAL: (id: string) => `/api/panels/${id}/approval`,
  BULK_APPROVAL: '/api/panels/bulk-approval',
} as const;

export const PANEL_TYPES_ROUTES = {
  LIST: '/api/panel-types',
  BY_ID: (id: string) => `/api/panel-types/${id}`,
} as const;

// ============================================================================
// PRODUCTION
// ============================================================================
export const PRODUCTION_ROUTES = {
  // Slots
  SLOTS: '/api/production-slots',
  SLOT_BY_ID: (id: string) => `/api/production-slots/${id}`,
  SLOTS_GENERATE: '/api/production-slots/generate',
  
  // Entries
  ENTRIES: '/api/production-entries',
  ENTRY_BY_ID: (id: string) => `/api/production-entries/${id}`,
  
  // Summary & Days
  SUMMARY: '/api/production/summary',
  DAYS: '/api/production/days',
} as const;

// ============================================================================
// DRAFTING
// ============================================================================
export const DRAFTING_ROUTES = {
  PROGRAM: '/api/drafting-program',
  SCHEDULE: '/api/drafting/schedule',
  BY_PANEL: (panelId: string) => `/api/drafting-program/${panelId}`,
} as const;

// ============================================================================
// LOGISTICS
// ============================================================================
export const LOGISTICS_ROUTES = {
  LOAD_LISTS: '/api/load-lists',
  LOAD_LIST_BY_ID: (id: string) => `/api/load-lists/${id}`,
  LOAD_LIST_PANELS: (id: string) => `/api/load-lists/${id}/panels`,
  TRAILER_TYPES: '/api/trailer-types',
  TRAILER_TYPE_BY_ID: (id: string) => `/api/trailer-types/${id}`,
} as const;

// ============================================================================
// FACTORIES
// ============================================================================
export const FACTORIES_ROUTES = {
  LIST: '/api/factories',
  BY_ID: (id: string) => `/api/factories/${id}`,
  BEDS: (factoryId: string) => `/api/factories/${factoryId}/beds`,
  BED_BY_ID: (factoryId: string, bedId: string) => `/api/factories/${factoryId}/beds/${bedId}`,
} as const;

// ============================================================================
// TASKS
// ============================================================================
export const TASKS_ROUTES = {
  GROUPS: '/api/task-groups',
  GROUP_BY_ID: (id: string) => `/api/task-groups/${id}`,
  LIST: '/api/tasks',
  BY_ID: (id: string) => `/api/tasks/${id}`,
} as const;

// ============================================================================
// CHAT
// ============================================================================
export const CHAT_ROUTES = {
  CONVERSATIONS: '/api/chat/conversations',
  CONVERSATION_BY_ID: (id: string) => `/api/chat/conversations/${id}`,
  MESSAGES: (conversationId: string) => `/api/chat/conversations/${conversationId}/messages`,
  USERS: '/api/chat/users',
  UNREAD_COUNT: '/api/chat/unread-count',
  MARK_READ: (conversationId: string) => `/api/chat/conversations/${conversationId}/read`,
} as const;

// ============================================================================
// ADMIN
// ============================================================================
export const ADMIN_ROUTES = {
  // Users
  USERS: '/api/admin/users',
  USER_BY_ID: (id: string) => `/api/admin/users/${id}`,
  USER_PERMISSIONS: (id: string) => `/api/admin/users/${id}/permissions`,
  
  // Jobs
  JOBS: '/api/admin/jobs',
  JOB_BY_ID: (id: string) => `/api/admin/jobs/${id}`,
  
  // Factories
  FACTORIES: '/api/admin/factories',
  FACTORY_BY_ID: (id: string) => `/api/admin/factories/${id}`,
  
  // Devices
  DEVICES: '/api/admin/devices',
  DEVICE_BY_ID: (id: string) => `/api/admin/devices/${id}`,
  
  // Settings
  SETTINGS: '/api/admin/settings',
  
  // Work Types
  WORK_TYPES: '/api/admin/work-types',
  WORK_TYPE_BY_ID: (id: string) => `/api/admin/work-types/${id}`,
  
  // Zones
  ZONES: '/api/admin/zones',
  ZONE_BY_ID: (id: string) => `/api/admin/zones/${id}`,
  
  // Trailer Types
  TRAILER_TYPES: '/api/admin/trailer-types',
  TRAILER_TYPE_BY_ID: (id: string) => `/api/admin/trailer-types/${id}`,
  
  // CFMEU Calendars
  CFMEU_CALENDARS: '/api/admin/cfmeu-calendars',
  CFMEU_CALENDAR_BY_ID: (id: string) => `/api/admin/cfmeu-calendars/${id}`,
  CFMEU_HOLIDAYS: (calendarId: string) => `/api/admin/cfmeu-calendars/${calendarId}/holidays`,
  CFMEU_SYNC: '/api/admin/cfmeu-calendars/sync',
} as const;

// ============================================================================
// REPORTS
// ============================================================================
export const REPORTS_ROUTES = {
  PRODUCTION_DAILY: '/api/reports/production-daily',
  PRODUCTION_WITH_COSTS: '/api/reports/production-with-costs',
  DRAFTING_DAILY: '/api/reports/drafting-daily',
  LOGISTICS: '/api/reports/logistics',
  COST_ANALYSIS: '/api/reports/cost-analysis',
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
  BY_ID: (id: string) => `/api/daily-logs/${id}`,
  ENTRIES: (logId: string) => `/api/daily-logs/${logId}/entries`,
  SUBMIT: (id: string) => `/api/daily-logs/${id}/submit`,
  APPROVE: (id: string) => `/api/daily-logs/${id}/approve`,
  REJECT: (id: string) => `/api/daily-logs/${id}/reject`,
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
export type ProcurementRoutes = typeof PROCUREMENT_ROUTES;
export type JobsRoutes = typeof JOBS_ROUTES;
export type PanelsRoutes = typeof PANELS_ROUTES;
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
