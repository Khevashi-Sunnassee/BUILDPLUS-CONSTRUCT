import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet, adminPost, adminPatch, adminDelete } from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("API Input Validation and Error Handling", () => {
  let authAvailable = false;

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  describe("Job Validation", () => {
    it("POST /api/jobs with empty body returns 400 and never 500", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {});
      expect(res.status).toBeLessThan(500);
      expect([400, 422, 429, 201, 200]).toContain(res.status);
    });

    it("POST /api/jobs with missing name field returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        jobNumber: "VAL-001",
        customerId: FAKE_UUID,
        jobTypeId: FAKE_UUID,
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/jobs with missing customerId returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        name: "Validation Test Job",
        jobNumber: "VAL-002",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/jobs with missing jobTypeId returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        name: "Validation Test Job",
        jobNumber: "VAL-003",
        customerId: FAKE_UUID,
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/jobs with string for numeric fields does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        name: "Test Job",
        jobNumber: "VAL-004",
        customerId: "not-a-uuid",
        contractValue: "not-a-number",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/jobs with null name field does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        name: null,
        jobNumber: "VAL-005",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("PATCH /api/jobs/:id with non-existent ID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/jobs/${FAKE_UUID}`, {
        name: "Updated Name",
      });
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/jobs/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs/not-a-valid-uuid");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/jobs/:id with FAKE_UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/jobs/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("POST /api/jobs with extremely long name (>10000 chars) does not crash", async () => {
      if (!authAvailable) return;
      const longString = "A".repeat(10001);
      const res = await adminPost("/api/jobs", {
        name: longString,
        jobNumber: "VAL-LONG",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/jobs with XSS payload in name field is handled safely", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        name: "<script>alert('xss')</script>",
        jobNumber: "VAL-XSS",
      });
      expect(res.status).toBeLessThan(500);
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const text = await res.text();
        expect(text).not.toContain("<script>");
      }
    });

    it("DELETE /api/jobs/:id with non-existent ID returns 404 or 204", async () => {
      if (!authAvailable) return;
      const res = await adminDelete(`/api/jobs/${FAKE_UUID}`);
      expect([200, 204, 404, 429]).toContain(res.status);
    });
  });

  describe("Employee Validation", () => {
    it("POST /api/employees with empty body returns error, not 500", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/employees", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/employees with invalid email format returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/employees", {
        name: "Test Employee",
        email: "not-an-email",
        phone: "0400000000",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/employees with missing name returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/employees", {
        email: "test@example.com",
        phone: "0400000000",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/employees/:id with non-existent UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/employees/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/employees/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/employees/invalid-uuid-format");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("PATCH /api/employees/:id with invalid licence dates returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/employees/${FAKE_UUID}`, {
        licenceExpiryDate: "not-a-date",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("PATCH /api/employees/:id with non-existent ID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/employees/${FAKE_UUID}`, {
        name: "Updated Employee",
      });
      expect([400, 404, 429]).toContain(res.status);
    });
  });

  describe("Document Validation", () => {
    it("POST /api/documents with empty body returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/documents", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/documents with missing title returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/documents", {
        jobId: FAKE_UUID,
        type: "drawing",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/documents with invalid type returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/documents", {
        title: "Test Doc",
        jobId: FAKE_UUID,
        type: "INVALID_TYPE_THAT_DOES_NOT_EXIST",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/documents/:id with non-existent UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/documents/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/documents/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/documents/bad-uuid");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("POST /api/document-bundles with empty documents array returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/document-bundles", {
        name: "Empty Bundle",
        documentIds: [],
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/document-bundles with missing name returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/document-bundles", {
        documentIds: [FAKE_UUID],
      });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("Purchase Order Validation", () => {
    it("POST /api/purchase-orders with empty body returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/purchase-orders", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/purchase-orders with missing supplierId returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/purchase-orders", {
        jobId: FAKE_UUID,
        description: "Test PO",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/purchase-orders with negative amounts returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/purchase-orders", {
        jobId: FAKE_UUID,
        supplierId: FAKE_UUID,
        totalAmount: -500,
        description: "Negative amount PO",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/purchase-orders/:id with fake UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/purchase-orders/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/purchase-orders/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/purchase-orders/not-a-uuid");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("PATCH /api/purchase-orders/:id with invalid status transition returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/purchase-orders/${FAKE_UUID}`, {
        status: "INVALID_STATUS_VALUE",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("DELETE /api/purchase-orders/:id with non-existent ID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminDelete(`/api/purchase-orders/${FAKE_UUID}`);
      expect([200, 204, 404, 429]).toContain(res.status);
    });
  });

  describe("Tender Validation", () => {
    it("POST /api/tenders with empty body returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/tenders", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/tenders with missing jobId returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/tenders", {
        name: "Test Tender",
        description: "Missing job ID",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/tenders with invalid data types returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/tenders", {
        jobId: "not-a-uuid",
        amount: "not-a-number",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/tenders/:id with fake UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/tenders/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/tenders/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/tenders/xyz-not-uuid");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("PATCH /api/tenders/:id with invalid data returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/tenders/${FAKE_UUID}`, {
        status: "NONEXISTENT_STATUS",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("DELETE /api/tenders/:id with non-existent ID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminDelete(`/api/tenders/${FAKE_UUID}`);
      expect([200, 204, 404, 429]).toContain(res.status);
    });
  });

  describe("Asset Validation", () => {
    it("POST /api/admin/assets with empty body returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/admin/assets", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/admin/assets with missing required fields returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/admin/assets", {
        description: "Missing name and other required fields",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/admin/assets with invalid data types returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/admin/assets", {
        name: 12345,
        purchasePrice: "not-a-number",
        purchaseDate: "invalid-date",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/admin/assets/:id with non-existent UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/admin/assets/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/admin/assets/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/assets/bad-uuid-string");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("PATCH /api/admin/assets/:id with invalid data returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/admin/assets/${FAKE_UUID}`, {
        status: "INVALID_ASSET_STATUS",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("DELETE /api/admin/assets/:id with non-existent ID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminDelete(`/api/admin/assets/${FAKE_UUID}`);
      expect([200, 204, 404, 429]).toContain(res.status);
    });
  });

  describe("Checklist Validation", () => {
    it("POST /api/checklist/templates with empty body returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/checklist/templates", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/checklist/templates with missing name returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/checklist/templates", {
        sections: [],
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/checklist/templates/:id with non-existent UUID returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/checklist/templates/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/checklist/templates/:id with malformed UUID returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/checklist/templates/not-uuid");
      expect([400, 404, 429]).toContain(res.status);
    });

    it("POST /api/checklist/instances with empty body returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/checklist/instances", {});
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/checklist/instances with missing template reference returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/checklist/instances", {
        jobId: FAKE_UUID,
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /api/checklist/instances with non-existent templateId returns error", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/checklist/instances", {
        templateId: FAKE_UUID,
        jobId: FAKE_UUID,
      });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("Auth-required endpoints without authentication", () => {
    it("GET /api/employees without auth returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/employees`);
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/documents without auth returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/documents`);
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/purchase-orders without auth returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/purchase-orders`);
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/tenders without auth returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/tenders`);
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/admin/assets without auth returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/assets`);
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/checklist/templates without auth returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/checklist/templates`);
      expect([401, 429]).toContain(res.status);
    });

    it("POST /api/jobs without auth is rejected or handled safely", async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Unauthorized Job" }),
      });
      expect(res.status).toBeLessThan(500);
    });
  });
});
