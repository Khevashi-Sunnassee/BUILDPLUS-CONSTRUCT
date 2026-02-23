import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { departments, employeeLicences } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
  departmentId: z.string().max(36).optional().nullable(),
  reportingManagerId: z.string().max(36).optional().nullable(),
  workLocation: z.string().max(255).optional().nullable(),
  workState: z.string().max(10).optional().nullable(),
  startDate: z.string().min(1, "Start date is required"),
  expectedStartDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  probationEndDate: z.string().optional().nullable(),
  classificationLevel: z.string().max(100).optional().nullable(),
  instrumentId: z.string().max(36).optional().nullable(),
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

const EMPLOYEE_TEMPLATE_COLUMNS = [
  { header: "Employee Number", key: "employeeNumber", width: 18 },
  { header: "First Name", key: "firstName", width: 20 },
  { header: "Last Name", key: "lastName", width: 20 },
  { header: "Preferred Name", key: "preferredName", width: 20 },
  { header: "Date of Birth", key: "dateOfBirth", width: 18 },
  { header: "Email", key: "email", width: 30 },
  { header: "Phone", key: "phone", width: 20 },
  { header: "Address Line 1", key: "addressLine1", width: 30 },
  { header: "Address Line 2", key: "addressLine2", width: 30 },
  { header: "Suburb", key: "suburb", width: 20 },
  { header: "State", key: "state", width: 10 },
  { header: "Postcode", key: "postcode", width: 10 },
  { header: "Notes", key: "notes", width: 40 },
];

const EMPLOYEE_HEADER_MAP: Record<string, string> = {
  "name": "fullName",
  "employee name": "fullName",
  "employee number": "employeeNumber",
  "card id": "employeeNumber",
  "first name": "firstName",
  "last name": "lastName",
  "preferred name": "preferredName",
  "middle name": "middleName",
  "date of birth": "dateOfBirth",
  "date of birth (dd/mm/yyyy)": "dateOfBirth",
  "email": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "phone no. 1": "phone",
  "phone no. 2": "phone2",
  "address line 1": "addressLine1",
  "address street line 1": "addressLine1",
  "address": "addressLine1",
  "street": "addressLine1",
  "address line 2": "addressLine2",
  "address street line 2": "addressLine2",
  "address street line 3": "addressLine2Extra",
  "city": "suburb",
  "suburb": "suburb",
  "state": "state",
  "postcode": "postcode",
  "zip": "postcode",
  "country": "country",
  "notes": "notes",
  "status": "status",
  "type (employee)": "type",
};

const ALLOWED_IMPORT_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMPORT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only Excel and CSV files are accepted.`));
    }
  },
});

function parseEmployeeName(fullName: string): { firstName: string; lastName: string; middleName?: string } {
  const trimmed = fullName.trim();
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map(s => s.trim());
    const lastName = parts[0];
    const firstParts = (parts[1] || "").split(/\s+/);
    const firstName = firstParts[0] || "";
    const middleName = firstParts.slice(1).join(" ") || undefined;
    return { firstName, lastName, middleName };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return { firstName: parts[0], lastName: parts[parts.length - 1], middleName: parts.slice(1, -1).join(" ") };
}

function parseDateOfBirth(val: string): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const yyyymmdd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmdd) {
    const [, yyyy, mm, dd] = yyyymmdd;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return trimmed;
}

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

router.get("/api/employees/template", requireAuth, async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");
    sheet.columns = EMPLOYEE_TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Employee_Import_Template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to generate employee template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/api/employees/export", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allEmployees = await storage.getAllEmployees(companyId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");
    sheet.columns = EMPLOYEE_TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    for (const e of allEmployees) {
      sheet.addRow({
        employeeNumber: e.employeeNumber || "",
        firstName: e.firstName || "",
        lastName: e.lastName || "",
        preferredName: e.preferredName || "",
        dateOfBirth: e.dateOfBirth || "",
        email: e.email || "",
        phone: e.phone || "",
        addressLine1: e.addressLine1 || "",
        addressLine2: e.addressLine2 || "",
        suburb: e.suburb || "",
        state: e.state || "",
        postcode: e.postcode || "",
        notes: e.notes || "",
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Employees_Export.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to export employees");
    res.status(500).json({ error: "Failed to export employees" });
  }
});

router.post("/api/employees/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    let headerRowIndex = 0;
    const columnMap: Record<number, string> = {};
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let matchCount = 0;
      for (let c = 1; c <= sheet.columnCount; c++) {
        const cell = row.getCell(c);
        let val = cell.value;
        if (val && typeof val === "object" && "richText" in val) {
          val = (val as {richText: {text: string}[]}).richText.map((t) => t.text).join("");
        }
        if (!val) continue;
        const headerStr = String(val).toLowerCase().trim();
        const mappedKey = EMPLOYEE_HEADER_MAP[headerStr];
        if (mappedKey) {
          matchCount++;
          columnMap[c] = mappedKey;
        }
      }
      if (matchCount >= 2) {
        headerRowIndex = r;
        break;
      }
    }

    if (!headerRowIndex) {
      return res.status(400).json({ error: "Could not find header row. Please ensure the spreadsheet has recognizable column headers (e.g. Name, Email, Phone)." });
    }

    const existingEmployees = await storage.getAllEmployees(companyId);
    const employeeByName: Record<string, typeof existingEmployees[0]> = {};
    for (const e of existingEmployees) {
      const key = `${e.lastName.toLowerCase().trim()},${e.firstName.toLowerCase().trim()}`;
      employeeByName[key] = e;
    }

    let autoNum = existingEmployees.length;

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rowData: Record<string, string> = {};
      let hasData = false;

      for (const [colStr, key] of Object.entries(columnMap)) {
        const col = parseInt(colStr);
        const cell = row.getCell(col);
        let val = cell.value;
        if (val && typeof val === "object" && "richText" in val) {
          val = (val as {richText: {text: string}[]}).richText.map((t) => t.text).join("");
        }
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          rowData[key] = String(val).trim();
          hasData = true;
        }
      }

      if (!hasData) continue;

      let firstName = rowData.firstName || "";
      let lastName = rowData.lastName || "";
      let middleName = rowData.middleName || undefined;

      if (!firstName && !lastName && rowData.fullName) {
        const parsed = parseEmployeeName(rowData.fullName);
        firstName = parsed.firstName;
        lastName = parsed.lastName;
        middleName = parsed.middleName || middleName;
      }

      if (!firstName && !lastName) continue;

      const displayName = `${lastName}, ${firstName}`.trim();

      try {
        const updateData: Record<string, unknown> = {};
        if (middleName) updateData.middleName = middleName;
        if (rowData.preferredName) updateData.preferredName = rowData.preferredName;
        if (rowData.dateOfBirth) updateData.dateOfBirth = parseDateOfBirth(rowData.dateOfBirth);
        if (rowData.email) updateData.email = rowData.email;
        if (rowData.phone) updateData.phone = rowData.phone;
        if (rowData.addressLine1) updateData.addressLine1 = rowData.addressLine1;
        let addr2 = rowData.addressLine2 || "";
        if (rowData.addressLine2Extra) {
          addr2 = addr2 ? `${addr2}, ${rowData.addressLine2Extra}` : rowData.addressLine2Extra;
        }
        if (addr2) updateData.addressLine2 = addr2;
        if (rowData.suburb) updateData.suburb = rowData.suburb;
        if (rowData.state) updateData.state = rowData.state;
        if (rowData.postcode) updateData.postcode = String(rowData.postcode);
        if (rowData.notes) updateData.notes = rowData.notes;
        if (rowData.status) {
          updateData.isActive = String(rowData.status).toLowerCase().trim() !== "inactive";
        }

        const nameKey = `${lastName.toLowerCase().trim()},${firstName.toLowerCase().trim()}`;
        const existing = employeeByName[nameKey];

        if (existing) {
          const fieldsToUpdate: Record<string, unknown> = {};
          let hasChanges = false;
          for (const [field, value] of Object.entries(updateData)) {
            const currentVal = (existing as Record<string, unknown>)[field];
            if (!currentVal && value) {
              fieldsToUpdate[field] = value;
              hasChanges = true;
            }
          }

          if (hasChanges) {
            await storage.updateEmployee(existing.id, fieldsToUpdate);
            updated.push(displayName);
          } else {
            skipped.push(displayName);
          }
        } else {
          let employeeNumber = rowData.employeeNumber;
          if (!employeeNumber || employeeNumber === "*None") {
            autoNum++;
            employeeNumber = `EMP${String(autoNum).padStart(4, "0")}`;
          }

          const newEmployee = await storage.createEmployee({
            companyId,
            employeeNumber,
            firstName,
            lastName,
            ...updateData,
            isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : true,
          });
          employeeByName[nameKey] = newEmployee;
          created.push(displayName);
        }
      } catch (rowError: unknown) {
        errors.push(`Row ${r} (${displayName}): ${rowError instanceof Error ? rowError.message : String(rowError)}`);
      }
    }

    res.json({
      success: true,
      created: created.length,
      updated: updated.length,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        created: created.slice(0, 50),
        updated: updated.slice(0, 50),
        skipped: skipped.slice(0, 20),
        errors: errors.slice(0, 50),
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error importing employees");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import employees" });
  }
});

// ============== All Licences for Company (Employee Register) ==============

router.get("/api/employees/licences/all", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allLicences = await db.select().from(employeeLicences)
      .where(eq(employeeLicences.companyId, companyId))
      .limit(500);
    res.json(allLicences);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch all licences";
    logger.error({ err: error }, "Error fetching all company licences");
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
    if (parsed.data.startDate && parsed.data.endDate && new Date(parsed.data.endDate) < new Date(parsed.data.startDate)) {
      return res.status(400).json({ error: "End date must be on or after the start date" });
    }
    const createData = { ...parsed.data } as Record<string, unknown>;
    if (createData.departmentId) {
      const [dept] = await db.select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(and(eq(departments.id, createData.departmentId as string), eq(departments.companyId, companyId)))
        .limit(1);
      if (!dept) return res.status(400).json({ error: "Selected department not found" });
      createData.department = dept.name;
    } else {
      createData.departmentId = null;
    }
    const employment = await storage.createEmployeeEmployment(createData as any);
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
    const startDate = parsed.data.startDate ?? existing.startDate;
    const endDate = parsed.data.endDate ?? existing.endDate;
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: "End date must be on or after the start date" });
    }
    const updateData = { ...parsed.data } as Record<string, unknown>;
    if (updateData.departmentId !== undefined) {
      if (updateData.departmentId) {
        const [dept] = await db.select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(and(eq(departments.id, updateData.departmentId as string), eq(departments.companyId, companyId!)))
          .limit(1);
        if (!dept) return res.status(400).json({ error: "Selected department not found" });
        updateData.department = dept.name;
      } else {
        updateData.departmentId = null;
        if (updateData.department === undefined) {
          updateData.department = null;
        }
      }
    }
    const employment = await storage.updateEmployeeEmployment(String(req.params.id), updateData as any);
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
