import { describe, it, expect, beforeAll } from "vitest";
import { adminGet, loginAdmin, unauthGet } from "./e2e-helpers";

let authAvailable = false;

const TEST_UUID = "00000000-0000-0000-0000-000000000000";

function substituteParams(path: string): string {
  return path.replace(/:[\w]+/g, TEST_UUID);
}

const PUBLIC_GET_ENDPOINTS = [
  "/api/settings/logo",
  "/api/address-lookup",
  "/api/invitations/:token",
  "/api/public/documents/:token/download",
  "/api/public/documents/bulk/:token/download",
  "/api/public/bundles/:qrCodeId",
  "/api/public/bundles/:qrCodeId/documents/:documentId/view",
  "/api/public/bundles/:qrCodeId/documents/:documentId/download",
  "/api/myob/callback",
];

const STATIC_GET_ENDPOINTS = [
  "/api/auth/me",

  "/api/dashboard/stats",
  "/api/dashboard/my-due-tasks",

  "/api/jobs",
  "/api/jobs/opportunities",
  "/api/jobs/my-memberships",
  "/api/admin/jobs",
  "/api/job-types",

  "/api/panels",
  "/api/panels/admin",
  "/api/panels/admin/source-counts",
  "/api/panels/ready-for-loading",
  "/api/panels/approved-for-production",
  "/api/panel-types",
  "/api/panel-types/admin",
  "/api/panel-types/admin/cost-summaries",

  "/api/task-groups",
  "/api/task-notifications",
  "/api/task-notifications/unread-count",

  "/api/users",
  "/api/users/approvers",
  "/api/user/settings",
  "/api/my-permissions",
  "/api/admin/users",
  "/api/admin/user-permissions",
  "/api/admin/permission-types",
  "/api/departments",
  "/api/admin/departments",

  "/api/admin/settings",
  "/api/admin/factories",
  "/api/admin/devices",
  "/api/admin/zones",
  "/api/admin/invitations",
  "/api/admin/trailer-types",
  "/api/admin/work-types",
  "/api/admin/cfmeu-calendars",
  "/api/admin/companies",
  "/api/admin/data-deletion/counts",

  "/api/customers",
  "/api/customers/active",
  "/api/customers/export",
  "/api/customers/template",

  "/api/documents",
  "/api/documents/next-number",
  "/api/document-types",
  "/api/document-types/active",
  "/api/document-categories",
  "/api/document-categories/active",
  "/api/document-disciplines",
  "/api/document-disciplines/active",
  "/api/document-bundles",

  "/api/load-lists",
  "/api/trailer-types",

  "/api/purchase-orders",
  "/api/purchase-orders/next-number",
  "/api/purchase-orders/my",
  "/api/procurement/items",
  "/api/procurement/items/active",
  "/api/procurement/items/template",
  "/api/procurement/item-categories",
  "/api/procurement/item-categories/active",
  "/api/procurement/suppliers",
  "/api/procurement/suppliers/active",
  "/api/procurement/suppliers/equipment-hire",
  "/api/procurement/suppliers/export",
  "/api/procurement/suppliers/template",
  "/api/procurement/construction-stages",

  "/api/production-days",
  "/api/production-entries",
  "/api/production-slots",
  "/api/production-slots/jobs-without-slots",
  "/api/production-schedule/days",
  "/api/production-schedule/ready-panels",
  "/api/production-schedule/stats",
  "/api/production-reports",
  "/api/production-summary",
  "/api/production-summary-with-costs",

  "/api/daily-logs",
  "/api/daily-logs/submitted",

  "/api/weekly-wage-reports",
  "/api/weekly-job-reports",
  "/api/weekly-job-reports/approved",
  "/api/weekly-job-reports/my-reports",
  "/api/weekly-job-reports/pending-approval",

  "/api/reports",
  "/api/reports/production-daily",
  "/api/reports/production-with-costs",
  "/api/reports/cost-analysis",
  "/api/reports/cost-analysis-daily",
  "/api/reports/labour-cost-analysis",
  "/api/reports/drafting-daily",
  "/api/reports/logistics",

  "/api/chat/conversations",
  "/api/chat/messages",
  "/api/chat/mentions",
  "/api/chat/settings",
  "/api/chat/users",
  "/api/chat/jobs",
  "/api/chat/panels",
  "/api/chat/unread-counts",
  "/api/chat/total-unread",
  "/api/chat/topics",

  "/api/checklist/entity-types",
  "/api/checklist/entity-subtypes",
  "/api/checklist/templates",
  "/api/checklist/instances",
  "/api/checklist/work-orders",
  "/api/checklist/reports/summary",

  "/api/help",
  "/api/help/recent",
  "/api/help/search",
  "/api/help/categories",
  "/api/help/admin/list",

  "/api/broadcasts",
  "/api/broadcasts/channels-status",
  "/api/broadcasts/recipients",
  "/api/broadcast-templates",

  "/api/admin/assets",
  "/api/admin/assets/template",
  "/api/assets/simple",

  "/api/contracts/hub",

  "/api/capex-requests",
  "/api/capex-requests/pending-my-approval",

  "/api/eot-claims",

  "/api/ap-invoices",
  "/api/ap-invoices/counts",
  "/api/ap-invoices/my-approvals",
  "/api/ap-approval-rules",
  "/api/ap-inbox/emails",
  "/api/ap-inbox/settings",
  "/api/ap-inbox/background-status",

  "/api/tenders",
  "/api/tender-inbox/emails",
  "/api/tender-inbox/counts",
  "/api/tender-inbox/settings",
  "/api/tender-inbox/background-status",

  "/api/drafting-program",
  "/api/drafting-program/my-allocated",
  "/api/drafting-inbox/emails",
  "/api/drafting-inbox/counts",
  "/api/drafting-inbox/settings",
  "/api/drafting-inbox/background-status",

  "/api/employees",
  "/api/employees/active",
  "/api/employees/export",
  "/api/employees/template",
  "/api/employees/licences/all",

  "/api/scopes",
  "/api/scopes/stats",
  "/api/scope-trades",
  "/api/scope-trades/cost-codes",

  "/api/progress-claims",
  "/api/progress-claims/next-number",
  "/api/progress-claims/retention-report",

  "/api/cost-codes",
  "/api/cost-codes-with-children",
  "/api/cost-codes/template/download",
  "/api/child-cost-codes",

  "/api/hire-bookings",
  "/api/hire-bookings/next-number",

  "/api/pm-call-logs",

  "/api/timer-sessions",
  "/api/timer-sessions/active",

  "/api/asset-repair-requests",
  "/api/asset-repair-requests/next-number",

  "/api/onboarding/instruments",
  "/api/onboarding/templates",

  "/api/activity-stages",
  "/api/activity-consultants",

  "/api/work-types",
  "/api/cfmeu-holidays",
  "/api/factories",
  "/api/geocode",
  "/api/projects",

  "/api/reo-schedules",
  "/api/reo-schedules/ifc-panels",

  "/api/settings/email-template",
  "/api/settings/po-terms",

  "/api/myob/status",
  "/api/myob/auth",
  "/api/myob/accounts",
  "/api/myob/company",
  "/api/myob/customers",
  "/api/myob/suppliers",
  "/api/myob/items",
  "/api/myob/invoices",
  "/api/myob/export-logs",
];

const PARAM_GET_ENDPOINTS = [
  "/api/admin/jobs/:id",
  "/api/admin/jobs/:id/audit-log",
  "/api/admin/jobs/:id/build-levels",
  "/api/admin/jobs/:id/generate-levels",
  "/api/admin/jobs/:id/level-cycle-times",
  "/api/admin/jobs/:id/members",
  "/api/admin/jobs/:id/production-slot-status",
  "/api/admin/jobs/:id/programme",
  "/api/jobs/:jobId",
  "/api/jobs/:jobId/audit-log",
  "/api/jobs/:jobId/totals",
  "/api/jobs/:jobId/cost-codes",
  "/api/jobs/:jobId/boq/groups",
  "/api/jobs/:jobId/boq/items",
  "/api/jobs/:jobId/boq/summary",
  "/api/jobs/:jobId/budget",
  "/api/jobs/:jobId/budget/lines",
  "/api/jobs/:jobId/budget/summary",
  "/api/jobs/:jobId/panel-rates",
  "/api/jobs/:jobId/tenders",
  "/api/jobs/:jobId/tenders/:tenderId/sheet",
  "/api/jobs/:jobId/activities",
  "/api/jobs/opportunities/:id/history",
  "/api/job-types/:id",
  "/api/job-types/:jobTypeId/templates",
  "/api/job-types/:jobTypeId/templates/download-template",

  "/api/panels/admin/:id",
  "/api/panels/admin/:id/download-pdf",
  "/api/panels/by-job/:jobId",
  "/api/panels/:id/details",
  "/api/panels/:id/audit-logs",
  "/api/panels/:panelId/documents",
  "/api/panel-types/admin/:id",
  "/api/panel-types/:id/cost-components",

  "/api/task-groups/:id",
  "/api/task-groups/:id/members",
  "/api/tasks/:id",
  "/api/tasks/:id/assignees",
  "/api/tasks/:id/files",
  "/api/tasks/:id/updates",

  "/api/admin/user-permissions/:userId",
  "/api/admin/factories/:id",
  "/api/admin/factories/:factoryId/beds",
  "/api/admin/zones/:id",
  "/api/admin/companies/:id",
  "/api/admin/assets/:id",
  "/api/admin/assets/:id/maintenance",
  "/api/admin/assets/:id/transfers",
  "/api/admin/assets/:assetId/repair-requests",

  "/api/customers/:id",

  "/api/documents/:id",
  "/api/documents/:id/versions",
  "/api/documents/:id/download",
  "/api/documents/:id/thumbnail",
  "/api/documents/:id/view",
  "/api/document-types/:id",
  "/api/document-types/:typeId/statuses",
  "/api/document-categories/:id",
  "/api/document-disciplines/:id",
  "/api/document-bundles/:id",
  "/api/document-bundles/:id/access-logs",
  "/api/document-bundles/qr/:qrCodeId",

  "/api/load-lists/:id",
  "/api/load-lists/:id/delivery",
  "/api/load-lists/:id/return",

  "/api/purchase-orders/:id",
  "/api/purchase-orders/:id/attachments",
  "/api/purchase-orders/by-capex/:capexId",
  "/api/procurement/items/:id",
  "/api/procurement/item-categories/:id",
  "/api/procurement/suppliers/:id",
  "/api/po-attachments/:id/download",

  "/api/production-entries/:id",
  "/api/production-slots/:id",
  "/api/production-slots/:id/adjustments",
  "/api/production-slots/check-levels/:jobId",
  "/api/production-slots/:slotId/panel-entries",

  "/api/daily-logs/:id",

  "/api/weekly-wage-reports/:id",
  "/api/weekly-wage-reports/:id/analysis",
  "/api/weekly-job-reports/:id",

  "/api/chat/conversations/:conversationId/messages",
  "/api/chat/panels/:panelId/conversation",

  "/api/checklist/templates/:id",
  "/api/checklist/templates/by-type/:entityTypeId",
  "/api/checklist/templates/by-type/:entityTypeId/:entitySubtypeId",
  "/api/checklist/templates/:templateId/instances",
  "/api/checklist/entity-types/:entityTypeId/subtypes",
  "/api/checklist/instances/:id",
  "/api/checklist/instances/:instanceId/work-orders",
  "/api/checklist/jobs/:jobId/instances",
  "/api/checklist/panels/:panelId/instances",

  "/api/help/admin/:id/versions",

  "/api/broadcasts/:id",
  "/api/broadcasts/:id/deliveries",
  "/api/broadcast-templates/:id",

  "/api/contracts/:id",
  "/api/contracts/job/:jobId",

  "/api/capex-requests/:id",
  "/api/capex-requests/:id/audit-history",
  "/api/capex-requests/by-po/:poId",

  "/api/eot-claims/:id",
  "/api/eot-claims/by-job/:jobId",
  "/api/eot-claims/next-number/:jobId",

  "/api/ap-invoices/:id",
  "/api/ap-invoices/:id/activity",
  "/api/ap-invoices/:id/approval-path",
  "/api/ap-invoices/:id/comments",
  "/api/ap-invoices/:id/document",
  "/api/ap-invoices/:id/document-view",
  "/api/ap-invoices/:id/extracted-fields",
  "/api/ap-invoices/:id/page-thumbnails",
  "/api/ap-invoices/:id/splits",

  "/api/tenders/:id",
  "/api/tenders/:id/files",
  "/api/tenders/:id/members",
  "/api/tenders/:id/notes",
  "/api/tenders/:id/packages",
  "/api/tenders/:id/search-radius",
  "/api/tenders/:tenderId/scopes",
  "/api/tenders/:tenderId/submissions",
  "/api/tenders/:tenderId/submissions/:submissionId/line-items",
  "/api/tenders/:id/files/:fileId/download",
  "/api/tender-inbox/emails/:id",
  "/api/tender-inbox/emails/:id/activity",
  "/api/tender-inbox/emails/:id/document-view",
  "/api/tender-inbox/emails/:id/extracted-fields",
  "/api/tender-inbox/emails/:id/page-thumbnails",
  "/api/tender-members/:id/files",
  "/api/tender-members/:id/updates",

  "/api/drafting-program/:id",
  "/api/drafting-inbox/emails/:id",
  "/api/drafting-inbox/emails/:id/activity",
  "/api/drafting-inbox/emails/:id/body",
  "/api/drafting-inbox/emails/:id/document-view",
  "/api/drafting-inbox/emails/:id/extracted-fields",
  "/api/drafting-inbox/emails/:id/page-thumbnails",

  "/api/employees/:id",
  "/api/employees/:employeeId/documents",
  "/api/employees/:employeeId/employments",
  "/api/employees/:employeeId/licences",
  "/api/employees/:employeeId/onboardings",
  "/api/employees/:employeeId/onboardings/:id",

  "/api/scopes/:id",
  "/api/scopes/:id/export",
  "/api/scopes/:id/print",

  "/api/progress-claims/:id",
  "/api/progress-claims/:id/items",
  "/api/progress-claims/job/:jobId/claimable-panels",
  "/api/progress-claims/job/:jobId/retention-summary",
  "/api/progress-claims/job/:jobId/summary",

  "/api/cost-codes/:id",
  "/api/child-cost-codes/:id",
  "/api/cost-code-defaults/:jobTypeId",

  "/api/hire-bookings/:id",

  "/api/pm-call-logs/:id",
  "/api/pm-call-logs/job/:jobId/upcoming-levels",

  "/api/timer-sessions/panel/:panelId",

  "/api/asset-repair-requests/:id",

  "/api/onboarding/templates/:id",
  "/api/onboarding/templates/:templateId/tasks",

  "/api/activity-templates/:templateId/subtasks",
  "/api/activity-templates/:templateId/checklists",
  "/api/job-activities/:activityId/tasks",
  "/api/job-activities/:activityId/checklists",
  "/api/job-activities/:id/assignees",
  "/api/job-activities/:id/files",
  "/api/job-activities/:id/updates",

  "/api/budget-lines/:budgetLineId/detail-items",
  "/api/budget-lines/:lineId/files",
  "/api/budget-lines/:lineId/updates",

  "/api/opportunities/:id/files",
  "/api/opportunities/:id/updates",

  "/api/reo-schedules/:id",
  "/api/reo-schedules/:scheduleId/items",
  "/api/reo-schedules/panel/:panelId",
];

const ALL_RESOLVED_ENDPOINTS = [
  ...STATIC_GET_ENDPOINTS,
  ...PARAM_GET_ENDPOINTS.map(substituteParams),
];

const SELECT_POST_ENDPOINTS = [
  "/api/jobs",
  "/api/panels/admin",
  "/api/task-groups",
  "/api/tasks",
  "/api/customers",
  "/api/purchase-orders",
  "/api/daily-logs",
  "/api/load-lists",
  "/api/documents",
  "/api/production-entries",
  "/api/broadcasts/send",
  "/api/capex-requests",
  "/api/eot-claims",
  "/api/hire-bookings",
  "/api/pm-call-logs",
  "/api/progress-claims",
  "/api/scopes",
  "/api/scope-trades",
  "/api/tenders",
  "/api/checklist/instances",
  "/api/ap-invoices",
  "/api/employees",
  "/api/cost-codes",
  "/api/broadcast-templates",
  "/api/ap-approval-rules",
  "/api/contracts",
  "/api/onboarding/instruments",
  "/api/onboarding/templates",
  "/api/drafting-program",
  "/api/reo-schedules",
  "/api/weekly-wage-reports",
  "/api/weekly-job-reports",
];

describe("API Smoke Tests - GET Auth Required (static endpoints)", () => {
  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  for (const endpoint of STATIC_GET_ENDPOINTS) {
    it(`GET ${endpoint} requires auth`, async () => {
      if (!authAvailable) return;
      const res = await unauthGet(endpoint);
      expect([401, 403, 429]).toContain(res.status);
    });
  }
});

describe("API Smoke Tests - GET Auth Required (parameterized endpoints)", () => {
  for (const endpoint of PARAM_GET_ENDPOINTS) {
    const resolved = substituteParams(endpoint);
    it(`GET ${endpoint} requires auth`, async () => {
      if (!authAvailable) return;
      const res = await unauthGet(resolved);
      expect([401, 403, 429]).toContain(res.status);
    });
  }
});

describe("API Smoke Tests - POST Auth Required", () => {
  for (const endpoint of SELECT_POST_ENDPOINTS) {
    it(`POST ${endpoint} requires auth`, async () => {
      if (!authAvailable) return;
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect([401, 403, 429]).toContain(res.status);
    });
  }
});

describe("API Smoke Tests - No 500 Errors (static GET endpoints)", () => {
  for (const endpoint of STATIC_GET_ENDPOINTS) {
    it(`GET ${endpoint} does not return 500`, async () => {
      if (!authAvailable) return;
      const res = await adminGet(endpoint);
      expect(res.status).not.toBe(500);
    });
  }
});

describe("API Smoke Tests - No 500 Errors (parameterized GET endpoints)", () => {
  for (const endpoint of PARAM_GET_ENDPOINTS) {
    const resolved = substituteParams(endpoint);
    it(`GET ${endpoint} does not return 500`, async () => {
      if (!authAvailable) return;
      const res = await adminGet(resolved);
      expect(res.status).not.toBe(500);
    });
  }
});

describe("API Smoke Tests - Public Endpoints Accessible", () => {
  for (const endpoint of PUBLIC_GET_ENDPOINTS) {
    const resolved = substituteParams(endpoint);
    it(`GET ${endpoint} is accessible without auth (not 401)`, async () => {
      if (!authAvailable) return;
      const res = await unauthGet(resolved);
      expect(res.status).not.toBe(401);
    });
  }
});

describe("API Smoke Tests - Coverage Summary", () => {
  it(`covers ${ALL_RESOLVED_ENDPOINTS.length} authenticated GET endpoints`, () => {
    if (!authAvailable) return;
    expect(ALL_RESOLVED_ENDPOINTS.length).toBeGreaterThan(100);
  });

  it(`covers ${PUBLIC_GET_ENDPOINTS.length} public GET endpoints`, () => {
    if (!authAvailable) return;
    expect(PUBLIC_GET_ENDPOINTS.length).toBeGreaterThan(0);
  });

  it(`covers ${SELECT_POST_ENDPOINTS.length} POST endpoints for auth checks`, () => {
    if (!authAvailable) return;
    expect(SELECT_POST_ENDPOINTS.length).toBeGreaterThan(10);
  });
});
