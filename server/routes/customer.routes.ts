import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { jobs, customers, myobCustomerMappings } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  keyContact: z.string().max(255).optional().nullable(),
  email: z.string().email("Invalid email").max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  abn: z.string().max(20).optional().nullable(),
  acn: z.string().max(20).optional().nullable(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(10).optional().nullable(),
  postcode: z.string().max(10).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  paymentTerms: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const CUSTOMER_TEMPLATE_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Key Contact", key: "keyContact", width: 25 },
  { header: "Email", key: "email", width: 30 },
  { header: "Phone", key: "phone", width: 20 },
  { header: "ABN", key: "abn", width: 20 },
  { header: "ACN", key: "acn", width: 20 },
  { header: "Address Line 1", key: "addressLine1", width: 30 },
  { header: "Address Line 2", key: "addressLine2", width: 30 },
  { header: "City", key: "city", width: 20 },
  { header: "State", key: "state", width: 15 },
  { header: "Postcode", key: "postcode", width: 15 },
  { header: "Country", key: "country", width: 20 },
  { header: "Payment Terms", key: "paymentTerms", width: 25 },
  { header: "Notes", key: "notes", width: 40 },
];

const CUSTOMER_HEADER_MAP: Record<string, string> = {
  "name": "name",
  "customer name": "name",
  "company": "name",
  "key contact": "keyContact",
  "contact": "keyContact",
  "contact name": "keyContact",
  "email": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "phone no. 1": "phone",
  "phone no. 2": "phone2",
  "abn": "abn",
  "a.b.n.": "abn",
  "acn": "acn",
  "a.c.n.": "acn",
  "address line 1": "addressLine1",
  "address street line 1": "addressLine1",
  "address": "addressLine1",
  "street": "addressLine1",
  "address line 2": "addressLine2",
  "address street line 2": "addressLine2",
  "address street line 3": "addressLine2Extra",
  "city": "city",
  "suburb": "city",
  "state": "state",
  "postcode": "postcode",
  "zip": "postcode",
  "country": "country",
  "payment terms": "paymentTerms",
  "terms": "paymentTerms",
  "notes": "notes",
  "status": "status",
  "type (customer)": "type",
  "card id": "cardId",
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

router.get("/api/customers", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const rows = await db.select({
      customer: customers,
      myobUid: myobCustomerMappings.myobCustomerUid,
    })
    .from(customers)
    .leftJoin(myobCustomerMappings, and(
      eq(myobCustomerMappings.customerId, customers.id),
      eq(myobCustomerMappings.companyId, customers.companyId),
    ))
    .where(eq(customers.companyId, companyId))
    .orderBy(asc(customers.name))
    .limit(1000);
    const customersData = rows.map(r => ({ ...r.customer, myobUid: r.myobUid || null }));
    res.json(customersData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching customers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch customers" });
  }
});

router.get("/api/customers/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const customersData = await storage.getActiveCustomers(companyId);
    res.json(customersData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active customers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch customers" });
  }
});

router.get("/api/customers/with-jobs", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db.selectDistinct({ customerId: jobs.customerId })
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .then(rows => rows.filter(r => r.customerId != null).map(r => r.customerId));
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching customers with jobs");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch customers with jobs" });
  }
});

router.get("/api/customers/template", requireAuth, async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customers");
    sheet.columns = CUSTOMER_TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Customer_Import_Template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to generate customer template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/api/customers/export", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allCustomers = await storage.getAllCustomers(companyId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customers");
    sheet.columns = CUSTOMER_TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    for (const c of allCustomers) {
      sheet.addRow({
        name: c.name,
        keyContact: c.keyContact || "",
        email: c.email || "",
        phone: c.phone || "",
        abn: c.abn || "",
        acn: c.acn || "",
        addressLine1: c.addressLine1 || "",
        addressLine2: c.addressLine2 || "",
        city: c.city || "",
        state: c.state || "",
        postcode: c.postcode || "",
        country: c.country || "Australia",
        paymentTerms: c.paymentTerms || "",
        notes: c.notes || "",
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Customers_Export.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to export customers");
    res.status(500).json({ error: "Failed to export customers" });
  }
});

router.post("/api/customers/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
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
        const mappedKey = CUSTOMER_HEADER_MAP[headerStr];
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
      return res.status(400).json({ error: "Could not find header row. Please ensure the spreadsheet has recognizable column headers (e.g. Name, Email, Phone, ABN)." });
    }

    const existingCustomers = await storage.getAllCustomers(companyId);
    const customerByName: Record<string, typeof existingCustomers[0]> = {};
    for (const c of existingCustomers) {
      customerByName[c.name.toLowerCase().trim()] = c;
    }

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

      if (!hasData || !rowData.name) continue;

      const name = String(rowData.name);
      const nameKey = name.toLowerCase().trim();

      try {
        const updateData: Record<string, unknown> = {};
        if (rowData.keyContact) updateData.keyContact = rowData.keyContact;
        if (rowData.email) updateData.email = rowData.email;
        if (rowData.phone) updateData.phone = rowData.phone;
        if (rowData.abn) updateData.abn = rowData.abn;
        if (rowData.acn) updateData.acn = rowData.acn;
        if (rowData.addressLine1) updateData.addressLine1 = rowData.addressLine1;
        let addr2 = rowData.addressLine2 || "";
        if (rowData.addressLine2Extra) {
          addr2 = addr2 ? `${addr2}, ${rowData.addressLine2Extra}` : rowData.addressLine2Extra;
        }
        if (addr2) updateData.addressLine2 = addr2;
        if (rowData.city) updateData.city = rowData.city;
        if (rowData.state) updateData.state = rowData.state;
        if (rowData.postcode) updateData.postcode = String(rowData.postcode);
        if (rowData.country) updateData.country = rowData.country;
        if (rowData.paymentTerms) updateData.paymentTerms = rowData.paymentTerms;
        if (rowData.notes) updateData.notes = rowData.notes;
        if (rowData.status) {
          updateData.isActive = String(rowData.status).toLowerCase().trim() !== "inactive";
        }

        const existing = customerByName[nameKey];
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
            await storage.updateCustomer(existing.id, fieldsToUpdate);
            updated.push(name);
          } else {
            skipped.push(name);
          }
        } else {
          const newCustomer = await storage.createCustomer({
            companyId,
            name,
            ...updateData,
            isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : true,
          });
          customerByName[nameKey] = newCustomer;
          created.push(name);
        }
      } catch (rowError: unknown) {
        errors.push(`Row ${r} (${name}): ${rowError instanceof Error ? rowError.message : String(rowError)}`);
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
    logger.error({ err: error }, "Error importing customers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import customers" });
  }
});

router.get("/api/customers/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const customer = await storage.getCustomer(String(req.params.id));
    if (!customer || customer.companyId !== companyId) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching customer");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch customer" });
  }
});

router.post("/api/customers", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const customer = await storage.createCustomer({ ...parsed.data, companyId });
    res.json(customer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating customer");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create customer" });
  }
});

router.patch("/api/customers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getCustomer(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Customer not found" });
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const customer = await storage.updateCustomer(String(req.params.id), parsed.data);
    res.json(customer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating customer");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update customer" });
  }
});

router.delete("/api/customers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const id = req.params.id as string;
    const existing = await storage.getCustomer(id);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Customer not found" });
    await storage.deleteCustomer(id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting customer");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete customer" });
  }
});

export { router as customerRouter };
