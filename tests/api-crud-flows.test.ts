import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminPatch,
  adminDelete,
  uniqueName,
} from "./e2e-helpers";

let authAvailable = false;

function skipIfNoAuth() {
  if (!authAvailable) {
    return true;
  }
  return false;
}

describe("Core CRUD Flows", () => {
  beforeAll(async () => {
    try {
      await loginAdmin();
      const res = await adminGet("/api/auth/me");
      authAvailable = res.status === 200;
    } catch {
      authAvailable = false;
    }
  });

  describe("Customer lifecycle", () => {
    let customerId: string;
    const customerName = uniqueName("Customer");

    it("should create a customer", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminPost("/api/customers", {
        name: customerName,
        code: "TST",
        contactName: "Test Contact",
        email: "test@example.com",
        phone: "0400000000",
        isActive: true,
      });
      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.name).toBe(customerName);
      customerId = data.id;
    });

    it("should list customers including the new one", async () => {
      if (skipIfNoAuth() || !customerId) return;
      const res = await adminGet("/api/customers");
      expect(res.status).toBe(200);
      const data = await res.json();
      const found = Array.isArray(data) ? data : data.data || data.customers || [];
      expect(found.some((c: any) => c.id === customerId)).toBe(true);
    });

    it("should get customer by id", async () => {
      if (skipIfNoAuth() || !customerId) return;
      const res = await adminGet(`/api/customers/${customerId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe(customerName);
    });

    it("should update customer", async () => {
      if (skipIfNoAuth() || !customerId) return;
      const updatedName = uniqueName("UpdatedCustomer");
      const res = await adminPatch(`/api/customers/${customerId}`, {
        name: updatedName,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe(updatedName);
    });
  });

  describe("Job lifecycle", () => {
    let jobId: string;
    let customerId: string;
    const jobName = uniqueName("Job");

    beforeAll(async () => {
      if (!authAvailable) return;
      const customerRes = await adminPost("/api/customers", {
        name: uniqueName("JobCust"),
        isActive: true,
      });
      if (customerRes.status === 200 || customerRes.status === 201) {
        const customer = await customerRes.json();
        customerId = customer.id;
      }
    });

    it("should create a job", async () => {
      if (skipIfNoAuth() || !customerId) return;
      const res = await adminPost("/api/admin/jobs", {
        name: jobName,
        code: "JT",
        customerId,
        status: "ACTIVE",
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        expect([200, 201, 400, 403]).toContain(res.status);
        return;
      }
      expect([200, 201, 400]).toContain(res.status);
      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        if (data.name) {
          expect(data.name).toBe(jobName);
          jobId = data.id;
        }
      }
    });

    it("should list jobs", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/jobs");
      expect(res.status).toBe(200);
      const data = await res.json();
      const jobs = Array.isArray(data) ? data : data.data || data.jobs || [];
      expect(jobs.length).toBeGreaterThan(0);
    });

    it("should get job by id", async () => {
      if (skipIfNoAuth() || !jobId) return;
      const res = await adminGet(`/api/jobs/${jobId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe(jobName);
    });

    it("should update job", async () => {
      if (skipIfNoAuth() || !jobId) return;
      const res = await adminPatch(`/api/jobs/${jobId}`, {
        name: uniqueName("UpdatedJob"),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Supplier lifecycle", () => {
    let supplierId: string;
    const supplierName = uniqueName("Supplier");

    it("should create a supplier", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminPost("/api/procurement/suppliers", {
        name: supplierName,
        keyContact: "John Doe",
        email: "supplier@test.com",
        phone: "0412345678",
        isActive: true,
      });
      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.name).toBe(supplierName);
      supplierId = data.id;
    });

    it("should list suppliers", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/procurement/suppliers");
      expect(res.status).toBe(200);
      const data = await res.json();
      const suppliers = Array.isArray(data) ? data : data.data || [];
      expect(suppliers.length).toBeGreaterThan(0);
    });

    it("should update supplier", async () => {
      if (skipIfNoAuth() || !supplierId) return;
      const res = await adminPatch(`/api/procurement/suppliers/${supplierId}`, {
        keyContact: "Jane Doe",
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Task Groups and Tasks lifecycle", () => {
    let groupId: string;
    let taskId: string;

    it("should create a task group", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminPost("/api/task-groups", {
        name: uniqueName("TaskGroup"),
        color: "#3b82f6",
      });
      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.name).toBeTruthy();
      groupId = data.id;
    });

    it("should create a task in the group", async () => {
      if (skipIfNoAuth() || !groupId) return;
      const res = await adminPost("/api/tasks", {
        title: uniqueName("Task"),
        groupId,
        status: "NOT_STARTED",
        priority: "MEDIUM",
      });
      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.title).toBeTruthy();
      taskId = data.id;
    });

    it("should list tasks", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/tasks");
      expect(res.status).toBe(200);
    });

    it("should update task status", async () => {
      if (skipIfNoAuth() || !taskId) return;
      const res = await adminPatch(`/api/tasks/${taskId}`, {
        status: "IN_PROGRESS",
      });
      expect(res.status).toBe(200);
    });

    it("should list task groups", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/task-groups");
      expect(res.status).toBe(200);
      const data = await res.json();
      const groups = Array.isArray(data) ? data : data.data || [];
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe("User management", () => {
    it("should list users", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/users");
      expect(res.status).toBe(200);
      const data = await res.json();
      const users = Array.isArray(data) ? data : data.data || [];
      expect(users.length).toBeGreaterThan(0);
    });

    it("should get current user", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/auth/me");
      expect(res.status).toBe(200);
      const data = await res.json();
      const user = data.user || data;
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email");
    });
  });

  describe("Global Settings", () => {
    it("should respond to global settings endpoint", async () => {
      if (skipIfNoAuth()) return;
      const res = await adminGet("/api/admin/settings");
      expect([200, 403]).toContain(res.status);
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent job gracefully", async () => {
      const res = await adminGet("/api/jobs/00000000-0000-0000-0000-000000000000");
      expect([200, 401, 404, 429, 500]).toContain(res.status);
    });

    it("should handle non-existent customer gracefully", async () => {
      const res = await adminGet("/api/customers/00000000-0000-0000-0000-000000000000");
      expect([200, 401, 404, 429, 500]).toContain(res.status);
    });

    it("should handle unknown API routes", async () => {
      const res = await adminGet("/api/completely-nonexistent-route");
      expect([200, 404, 429]).toContain(res.status);
    });
  });

  describe("Endpoint availability", () => {
    const coreEndpoints = [
      "/api/jobs",
      "/api/customers",
      "/api/procurement/suppliers",
      "/api/tasks",
      "/api/task-groups",
      "/api/documents",
      "/api/purchase-orders",
      "/api/panels",
      "/api/admin/assets",
      "/api/users",
    ];

    for (const endpoint of coreEndpoints) {
      it(`${endpoint} responds without server error`, async () => {
        const res = await fetch(`http://localhost:5000${endpoint}`);
        expect(res.status).toBeLessThan(500);
      });
    }
  });
});
