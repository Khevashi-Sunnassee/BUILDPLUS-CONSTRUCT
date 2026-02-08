import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

const employeeSchema = z.object({
  employeeNumber: z.string().min(1, "Employee number is required").max(20),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleName: z.string().max(100).optional().nullable(),
  preferredName: z.string().max(100).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email").max(255).optional().nullable().or(z.literal("")),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  suburb: z.string().max(100).optional().nullable(),
  state: z.string().max(10).optional().nullable(),
  postcode: z.string().max(10).optional().nullable(),
  emergencyContactName: z.string().max(255).optional().nullable(),
  emergencyContactPhone: z.string().max(50).optional().nullable(),
  emergencyContactRelationship: z.string().max(100).optional().nullable(),
  isDraftingResource: z.boolean().optional(),
  isProductionResource: z.boolean().optional(),
  isSiteResource: z.boolean().optional(),
  receiveEscalatedWorkOrders: z.boolean().optional(),
  workRights: z.boolean().optional(),
  userId: z.string().max(36).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const employmentSchema = z.object({
  employeeId: z.string().min(1),
  companyId: z.string().min(1),
  employmentType: z.enum(["full_time", "part_time", "casual", "contract"]).optional(),
  positionTitle: z.string().max(255).optional().nullable(),
  jobTitle: z.string().max(255).optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  reportingManagerId: z.string().max(36).optional().nullable(),
  workLocation: z.string().max(255).optional().nullable(),
  workState: z.string().max(10).optional().nullable(),
  startDate: z.string().min(1, "Start date is required"),
  expectedStartDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  probationEndDate: z.string().optional().nullable(),
  classificationLevel: z.string().max(100).optional().nullable(),
  status: z.enum(["prospect", "offer_sent", "offer_accepted", "pre_start", "active", "on_leave", "inactive", "terminated", "archived"]).optional(),
  baseRate: z.string().optional().nullable(),
  rateBasis: z.enum(["hourly", "salary"]).optional().nullable(),
  payFrequency: z.enum(["weekly", "fortnightly", "monthly"]).optional().nullable(),
  ordinaryRate: z.string().optional().nullable(),
  overtime1_5: z.string().optional().nullable(),
  overtime2: z.string().optional().nullable(),
  saturdayRate: z.string().optional().nullable(),
  sundayRate: z.string().optional().nullable(),
  publicHolidayRate: z.string().optional().nullable(),
  nightShiftRate: z.string().optional().nullable(),
  travelAllowance: z.string().optional().nullable(),
  mealAllowance: z.string().optional().nullable(),
  toolAllowance: z.string().optional().nullable(),
  uniformAllowance: z.string().optional().nullable(),
  phoneAllowance: z.string().optional().nullable(),
  carAllowance: z.string().optional().nullable(),
  shiftAllowance: z.string().optional().nullable(),
  annualLeaveHoursPerWeek: z.string().optional().nullable(),
  sickLeaveHoursPerWeek: z.string().optional().nullable(),
  longServiceLeaveHours: z.string().optional().nullable(),
  rdoCount: z.number().int().optional().nullable(),
  rdoAccrual: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const documentSchema = z.object({
  employeeId: z.string().min(1),
  companyId: z.string().min(1),
  name: z.string().min(1, "Document name is required").max(255),
  category: z.enum(["contract", "variation", "id", "licence", "induction", "policy_acknowledgement", "performance", "termination", "other"]).optional(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().max(500).optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  issuedDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  version: z.number().int().optional(),
});

const licenceSchema = z.object({
  employeeId: z.string().min(1),
  companyId: z.string().min(1),
  licenceType: z.string().min(1, "Licence type is required").max(255),
  licenceNumber: z.string().max(100).optional().nullable(),
  issuingAuthority: z.string().max(255).optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  documentUrl: z.string().optional().nullable(),
  status: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ============== Employee CRUD ==============

router.get("/api/employees", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const employeesList = await storage.getAllEmployees(companyId);
    res.json(employeesList);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch employees";
    logger.error({ err: error }, "Error fetching employees");
    res.status(500).json({ error: msg });
  }
});

router.get("/api/employees/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const employeesList = await storage.getActiveEmployees(companyId);
    res.json(employeesList);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch employees";
    logger.error({ err: error }, "Error fetching active employees");
    res.status(500).json({ error: msg });
  }
});

router.get("/api/employees/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.id));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    res.json(employee);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch employee";
    logger.error({ err: error }, "Error fetching employee");
    res.status(500).json({ error: msg });
  }
});

router.post("/api/employees", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = employeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const employee = await storage.createEmployee({ ...parsed.data, companyId });
    res.json(employee);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create employee";
    logger.error({ err: error }, "Error creating employee");
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/employees/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getEmployee(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const parsed = employeeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const employee = await storage.updateEmployee(String(req.params.id), parsed.data);
    res.json(employee);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update employee";
    logger.error({ err: error }, "Error updating employee");
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/employees/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getEmployee(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    await storage.deleteEmployee(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete employee";
    logger.error({ err: error }, "Error deleting employee");
    res.status(500).json({ error: msg });
  }
});

// ============== Employment Records CRUD ==============

router.get("/api/employees/:employeeId/employments", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const employments = await storage.getEmployeeEmployments(String(req.params.employeeId));
    res.json(employments);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch employments";
    logger.error({ err: error }, "Error fetching employments");
    res.status(500).json({ error: msg });
  }
});

router.post("/api/employees/:employeeId/employments", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const parsed = employmentSchema.safeParse({ ...req.body, employeeId: String(req.params.employeeId), companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const employment = await storage.createEmployeeEmployment(parsed.data);
    res.json(employment);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create employment";
    logger.error({ err: error }, "Error creating employment");
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/employees/:employeeId/employments/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const existing = await storage.getEmployeeEmployment(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Employment record not found" });
    const parsed = employmentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const employment = await storage.updateEmployeeEmployment(String(req.params.id), parsed.data);
    res.json(employment);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update employment";
    logger.error({ err: error }, "Error updating employment");
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/employees/:employeeId/employments/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const existing = await storage.getEmployeeEmployment(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Employment record not found" });
    await storage.deleteEmployeeEmployment(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete employment";
    logger.error({ err: error }, "Error deleting employment");
    res.status(500).json({ error: msg });
  }
});

// ============== Employee Documents CRUD ==============

router.get("/api/employees/:employeeId/documents", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const docs = await storage.getEmployeeDocuments(String(req.params.employeeId));
    res.json(docs);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch documents";
    logger.error({ err: error }, "Error fetching employee documents");
    res.status(500).json({ error: msg });
  }
});

router.post("/api/employees/:employeeId/documents", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const parsed = documentSchema.safeParse({ ...req.body, employeeId: String(req.params.employeeId), companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const doc = await storage.createEmployeeDocument(parsed.data);
    res.json(doc);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create document";
    logger.error({ err: error }, "Error creating employee document");
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/employees/:employeeId/documents/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const existing = await storage.getEmployeeDocument(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Document not found" });
    const parsed = documentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const doc = await storage.updateEmployeeDocument(String(req.params.id), parsed.data);
    res.json(doc);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update document";
    logger.error({ err: error }, "Error updating employee document");
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/employees/:employeeId/documents/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const existing = await storage.getEmployeeDocument(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Document not found" });
    await storage.deleteEmployeeDocument(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete document";
    logger.error({ err: error }, "Error deleting employee document");
    res.status(500).json({ error: msg });
  }
});

// ============== Employee Licences CRUD ==============

router.get("/api/employees/:employeeId/licences", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const licences = await storage.getEmployeeLicences(String(req.params.employeeId));
    res.json(licences);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch licences";
    logger.error({ err: error }, "Error fetching employee licences");
    res.status(500).json({ error: msg });
  }
});

router.post("/api/employees/:employeeId/licences", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const parsed = licenceSchema.safeParse({ ...req.body, employeeId: String(req.params.employeeId), companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const licence = await storage.createEmployeeLicence(parsed.data);
    res.json(licence);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create licence";
    logger.error({ err: error }, "Error creating employee licence");
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/employees/:employeeId/licences/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const existing = await storage.getEmployeeLicence(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Licence not found" });
    const parsed = licenceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const licence = await storage.updateEmployeeLicence(String(req.params.id), parsed.data);
    res.json(licence);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update licence";
    logger.error({ err: error }, "Error updating employee licence");
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/employees/:employeeId/licences/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const employee = await storage.getEmployee(String(req.params.employeeId));
    if (!employee || employee.companyId !== companyId) return res.status(404).json({ error: "Employee not found" });
    const existing = await storage.getEmployeeLicence(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Licence not found" });
    await storage.deleteEmployeeLicence(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete licence";
    logger.error({ err: error }, "Error deleting employee licence");
    res.status(500).json({ error: msg });
  }
});

export { router as employeeRouter };
