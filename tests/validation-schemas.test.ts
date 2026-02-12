import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  insertCompanySchema,
  insertJobSchema,
  insertUserSchema,
  insertPanelRegisterSchema,
} from "@shared/schema";

const taskGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  color: z.string().optional(),
});

const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  groupId: z.string().min(1, "Group ID is required"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]).optional(),
  dueDate: z.string().nullable().optional(),
  reminderDate: z.string().nullable().optional(),
  consultant: z.string().max(255).optional(),
  projectStage: z.string().max(255).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  jobId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  keyContact: z.string().max(255).optional().nullable().or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable().or(z.literal("")),
  abn: z.string().max(50).optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const itemSchema = z.object({
  code: z.string().min(1, "Code is required").max(100),
  description: z.string().min(1, "Description is required").max(1000),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  unitOfMeasure: z.string().max(50).optional(),
  unitPrice: z.string().optional(),
  isActive: z.boolean().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  abn: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

describe("Task Group Schema", () => {
  it("should accept valid task group data", () => {
    const result = taskGroupSchema.safeParse({ name: "Sprint 1" });
    expect(result.success).toBe(true);
  });

  it("should accept task group with optional color", () => {
    const result = taskGroupSchema.safeParse({ name: "Sprint 1", color: "#FF5500" });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = taskGroupSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing name", () => {
    const result = taskGroupSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject name exceeding max length", () => {
    const result = taskGroupSchema.safeParse({ name: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("should accept name at max length", () => {
    const result = taskGroupSchema.safeParse({ name: "a".repeat(255) });
    expect(result.success).toBe(true);
  });
});

describe("Task Create Schema", () => {
  it("should accept valid task with required fields only", () => {
    const result = taskCreateSchema.safeParse({
      title: "Fix login bug",
      groupId: "group-123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept task with all optional fields", () => {
    const result = taskCreateSchema.safeParse({
      title: "Fix login bug",
      groupId: "group-123",
      status: "IN_PROGRESS",
      dueDate: "2026-03-01",
      consultant: "John Smith",
      priority: "HIGH",
      jobId: "job-456",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty title", () => {
    const result = taskCreateSchema.safeParse({
      title: "",
      groupId: "group-123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty groupId", () => {
    const result = taskCreateSchema.safeParse({
      title: "Task",
      groupId: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid status", () => {
    const result = taskCreateSchema.safeParse({
      title: "Task",
      groupId: "group-123",
      status: "INVALID_STATUS",
    });
    expect(result.success).toBe(false);
  });

  it("should accept all valid status values", () => {
    const validStatuses = ["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"];
    for (const status of validStatuses) {
      const result = taskCreateSchema.safeParse({
        title: "Task",
        groupId: "group-123",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept all valid priority values", () => {
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    for (const priority of validPriorities) {
      const result = taskCreateSchema.safeParse({
        title: "Task",
        groupId: "group-123",
        priority,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept null for nullable optional fields", () => {
    const result = taskCreateSchema.safeParse({
      title: "Task",
      groupId: "group-123",
      dueDate: null,
      priority: null,
      jobId: null,
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject title exceeding max length", () => {
    const result = taskCreateSchema.safeParse({
      title: "a".repeat(501),
      groupId: "group-123",
    });
    expect(result.success).toBe(false);
  });
});

describe("Supplier Schema", () => {
  it("should accept valid supplier with name only", () => {
    const result = supplierSchema.safeParse({ name: "Acme Corp" });
    expect(result.success).toBe(true);
  });

  it("should accept supplier with all fields", () => {
    const result = supplierSchema.safeParse({
      name: "Acme Corp",
      keyContact: "John Doe",
      email: "john@acme.com",
      phone: "0412345678",
      abn: "12345678901",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = supplierSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email format", () => {
    const result = supplierSchema.safeParse({
      name: "Acme Corp",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("should accept empty string for email (or pattern)", () => {
    const result = supplierSchema.safeParse({
      name: "Acme Corp",
      email: "",
    });
    expect(result.success).toBe(true);
  });

  it("should accept null for nullable fields", () => {
    const result = supplierSchema.safeParse({
      name: "Acme Corp",
      keyContact: null,
      email: null,
      phone: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject name exceeding max length", () => {
    const result = supplierSchema.safeParse({ name: "a".repeat(256) });
    expect(result.success).toBe(false);
  });
});

describe("Item Schema", () => {
  it("should accept valid item with required fields", () => {
    const result = itemSchema.safeParse({
      code: "ITM-001",
      description: "Steel reinforcement bar",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing code", () => {
    const result = itemSchema.safeParse({
      description: "Steel reinforcement bar",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty code", () => {
    const result = itemSchema.safeParse({
      code: "",
      description: "Steel reinforcement bar",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing description", () => {
    const result = itemSchema.safeParse({
      code: "ITM-001",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty description", () => {
    const result = itemSchema.safeParse({
      code: "ITM-001",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional fields", () => {
    const result = itemSchema.safeParse({
      code: "ITM-001",
      description: "Steel bar",
      categoryId: "cat-1",
      supplierId: "sup-1",
      unitOfMeasure: "kg",
      unitPrice: "25.50",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject code exceeding max length", () => {
    const result = itemSchema.safeParse({
      code: "a".repeat(101),
      description: "Steel bar",
    });
    expect(result.success).toBe(false);
  });

  it("should reject description exceeding max length", () => {
    const result = itemSchema.safeParse({
      code: "ITM-001",
      description: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("Customer Schema", () => {
  it("should accept valid customer with name only", () => {
    const result = customerSchema.safeParse({ name: "Builder Co" });
    expect(result.success).toBe(true);
  });

  it("should accept customer with all optional fields", () => {
    const result = customerSchema.safeParse({
      name: "Builder Co",
      code: "BC001",
      contactName: "Jane Smith",
      email: "jane@builder.com",
      phone: "0398765432",
      address: "123 Main St",
      city: "Melbourne",
      state: "VIC",
      postcode: "3000",
      abn: "98765432101",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = customerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject empty name", () => {
    const result = customerSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = customerSchema.safeParse({
      name: "Builder Co",
      email: "bad-email",
    });
    expect(result.success).toBe(false);
  });

  it("should accept empty string for email", () => {
    const result = customerSchema.safeParse({
      name: "Builder Co",
      email: "",
    });
    expect(result.success).toBe(true);
  });

  it("should accept null for nullable optional fields", () => {
    const result = customerSchema.safeParse({
      name: "Builder Co",
      contactName: null,
      email: null,
      phone: null,
      address: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("Insert Company Schema (from shared/schema.ts)", () => {
  it("should accept valid company data", () => {
    const result = insertCompanySchema.safeParse({
      name: "BuildPlus Ai",
      code: "BPA",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = insertCompanySchema.safeParse({
      code: "BPA",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing code", () => {
    const result = insertCompanySchema.safeParse({
      name: "BuildPlus Ai",
    });
    expect(result.success).toBe(false);
  });

  it("should accept company with optional fields", () => {
    const result = insertCompanySchema.safeParse({
      name: "BuildPlus Ai",
      code: "BPA",
      address: "123 Factory Rd",
      phone: "0312345678",
      email: "info@buildplus.ai",
      abn: "12345678901",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("Insert Job Schema (from shared/schema.ts)", () => {
  it("should accept valid job data with required fields", () => {
    const result = insertJobSchema.safeParse({
      companyId: "company-123",
      jobNumber: "J001",
      name: "Test Job",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing companyId", () => {
    const result = insertJobSchema.safeParse({
      jobNumber: "J001",
      name: "Test Job",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing jobNumber", () => {
    const result = insertJobSchema.safeParse({
      companyId: "company-123",
      name: "Test Job",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing name", () => {
    const result = insertJobSchema.safeParse({
      companyId: "company-123",
      jobNumber: "J001",
    });
    expect(result.success).toBe(false);
  });

  it("should accept job with optional fields", () => {
    const result = insertJobSchema.safeParse({
      companyId: "company-123",
      jobNumber: "J001",
      name: "Test Job",
      client: "Builder Corp",
      address: "123 Test St",
      description: "A test job",
      estimatedValue: "500000.00",
      probability: 75,
    });
    expect(result.success).toBe(true);
  });
});

describe("Insert Panel Register Schema (from shared/schema.ts)", () => {
  it("should accept valid panel data", () => {
    const result = insertPanelRegisterSchema.safeParse({
      jobId: "job-123",
      panelMark: "W01",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing jobId", () => {
    const result = insertPanelRegisterSchema.safeParse({
      panelMark: "W01",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing panelMark", () => {
    const result = insertPanelRegisterSchema.safeParse({
      jobId: "job-123",
    });
    expect(result.success).toBe(false);
  });

  it("should accept panel with optional detail fields", () => {
    const result = insertPanelRegisterSchema.safeParse({
      jobId: "job-123",
      panelMark: "W01",
      panelType: "WALL",
      description: "External wall panel",
      building: "A",
      zone: "North",
      level: "L01",
      qty: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("Schema Edge Cases", () => {
  it("taskGroupSchema should handle whitespace-only name as valid (min 1 char)", () => {
    const result = taskGroupSchema.safeParse({ name: " " });
    expect(result.success).toBe(true);
  });

  it("taskCreateSchema should handle numeric-like strings for IDs", () => {
    const result = taskCreateSchema.safeParse({
      title: "Task",
      groupId: "12345",
    });
    expect(result.success).toBe(true);
  });

  it("supplierSchema should handle boolean coercion for isActive", () => {
    const result = supplierSchema.safeParse({
      name: "Supplier",
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it("itemSchema should accept null for nullable optional fields", () => {
    const result = itemSchema.safeParse({
      code: "ITM-001",
      description: "Item",
      categoryId: null,
      supplierId: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-string types for string fields", () => {
    const result = taskGroupSchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });

  it("should reject non-boolean types for boolean fields", () => {
    const result = supplierSchema.safeParse({
      name: "Supplier",
      isActive: "yes",
    });
    expect(result.success).toBe(false);
  });
});
