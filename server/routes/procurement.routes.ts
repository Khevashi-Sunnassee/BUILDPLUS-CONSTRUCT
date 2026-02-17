import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { InsertItem, constructionStages } from "@shared/schema";
import logger from "../lib/logger";
import { emailService } from "../services/email.service";
import { buildBrandedEmail } from "../lib/email-template";

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  keyContact: z.string().max(255).optional().nullable().or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable().or(z.literal("")),
  abn: z.string().max(50).optional().nullable().or(z.literal("")),
  acn: z.string().max(50).optional().nullable().or(z.literal("")),
  addressLine1: z.string().max(255).optional().nullable().or(z.literal("")),
  addressLine2: z.string().max(255).optional().nullable().or(z.literal("")),
  city: z.string().max(100).optional().nullable().or(z.literal("")),
  state: z.string().max(50).optional().nullable().or(z.literal("")),
  postcode: z.string().max(20).optional().nullable().or(z.literal("")),
  country: z.string().max(100).optional().nullable().or(z.literal("")),
  paymentTerms: z.string().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().max(5000).optional().nullable().or(z.literal("")),
  defaultCostCodeId: z.string().max(36).optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
  isEquipmentHire: z.boolean().optional(),
  availableForTender: z.boolean().optional(),
});

const itemCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional(),
  description: z.string().max(1000).optional().nullable(),
  defaultCostCodeId: z.string().max(36).optional().nullable(),
  categoryType: z.enum(["supply", "trade"]).optional().default("supply"),
  isActive: z.boolean().optional(),
});

const itemSchema = z.object({
  code: z.string().min(1, "Code is required").max(100),
  description: z.string().min(1, "Description is required").max(1000),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  constructionStageId: z.string().optional().nullable(),
  unitOfMeasure: z.string().max(50).optional(),
  unitPrice: z.string().optional(),
  preferredSupplierId: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  itemType: z.enum(["local", "imported"]).optional(),
  isActive: z.boolean().optional(),
});

const SUPPLIER_TEMPLATE_COLUMNS = [
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

const SUPPLIER_HEADER_MAP: Record<string, string> = {
  "name": "name",
  "supplier name": "name",
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
  "type (supplier)": "type",
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

router.get("/api/procurement/suppliers", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const suppliersData = await storage.getAllSuppliers(companyId);
    res.json(suppliersData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching suppliers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const suppliersData = await storage.getActiveSuppliers(companyId);
    res.json(suppliersData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active suppliers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/equipment-hire", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const suppliersData = await storage.getEquipmentHireSuppliers(companyId);
    res.json(suppliersData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching equipment hire suppliers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/template", requireAuth, async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Suppliers");
    sheet.columns = SUPPLIER_TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Supplier_Import_Template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to generate supplier template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/api/procurement/suppliers/export", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allSuppliers = await storage.getAllSuppliers(companyId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Suppliers");
    sheet.columns = SUPPLIER_TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

    for (const s of allSuppliers) {
      sheet.addRow({
        name: s.name,
        keyContact: s.keyContact || "",
        email: s.email || "",
        phone: s.phone || "",
        abn: s.abn || "",
        acn: s.acn || "",
        addressLine1: s.addressLine1 || "",
        addressLine2: s.addressLine2 || "",
        city: s.city || "",
        state: s.state || "",
        postcode: s.postcode || "",
        country: s.country || "Australia",
        paymentTerms: s.paymentTerms || "",
        notes: s.notes || "",
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Suppliers_Export.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to export suppliers");
    res.status(500).json({ error: "Failed to export suppliers" });
  }
});

router.post("/api/procurement/suppliers/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
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
        const mappedKey = SUPPLIER_HEADER_MAP[headerStr];
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
      return res.status(400).json({ error: "Could not find header row. Please ensure the spreadsheet has recognizable column headers (e.g. Supplier Name, Email, Phone, ABN)." });
    }

    const existingSuppliers = await storage.getAllSuppliers(companyId);
    const supplierByName: Record<string, typeof existingSuppliers[0]> = {};
    for (const s of existingSuppliers) {
      supplierByName[s.name.toLowerCase().trim()] = s;
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

      const name = rowData.name;
      const key = name.toLowerCase().trim();

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

        const existing = supplierByName[key];
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
            await storage.updateSupplier(existing.id, fieldsToUpdate);
            updated.push(name);
          } else {
            skipped.push(name);
          }
        } else {
          const newSupplier = await storage.createSupplier({
            companyId,
            name,
            ...updateData,
            isActive: true,
          });
          supplierByName[key] = newSupplier;
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
    logger.error({ err: error }, "Error importing suppliers");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import suppliers" });
  }
});

router.get("/api/procurement/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const supplier = await storage.getSupplier(String(req.params.id));
    if (!supplier || supplier.companyId !== companyId) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching supplier");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch supplier" });
  }
});

router.post("/api/procurement/suppliers", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const supplier = await storage.createSupplier({ ...parsed.data, companyId });
    res.json(supplier);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating supplier");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create supplier" });
  }
});

router.patch("/api/procurement/suppliers/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getSupplier(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Supplier not found" });
    const parsed = supplierSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const supplier = await storage.updateSupplier(String(req.params.id), parsed.data);
    res.json(supplier);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating supplier");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update supplier" });
  }
});

router.delete("/api/procurement/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getSupplier(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Supplier not found" });
    await storage.deleteSupplier(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting supplier");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete supplier" });
  }
});

router.get("/api/procurement/item-categories", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const categories = await storage.getAllItemCategories(companyId);
    res.json(categories);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching item categories");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const categories = await storage.getActiveItemCategories(companyId);
    res.json(categories);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active item categories");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const category = await storage.getItemCategory(String(req.params.id));
    if (!category || category.companyId !== companyId) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch category" });
  }
});

router.post("/api/procurement/item-categories", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = itemCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const category = await storage.createItemCategory({ ...parsed.data, companyId });
    res.json(category);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create category" });
  }
});

router.patch("/api/procurement/item-categories/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getItemCategory(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Category not found" });
    const parsed = itemCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const category = await storage.updateItemCategory(String(req.params.id), parsed.data);
    res.json(category);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update category" });
  }
});

router.delete("/api/procurement/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getItemCategory(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Category not found" });
    await storage.deleteItemCategory(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting category");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete category" });
  }
});

router.get("/api/procurement/construction-stages", requireAuth, async (req, res) => {
  try {
    const stages = await db.select().from(constructionStages).orderBy(constructionStages.sortOrder).limit(100);
    res.json(stages);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching construction stages");
    res.status(500).json({ error: "Failed to fetch construction stages" });
  }
});

router.get("/api/procurement/items", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const itemsData = await storage.getAllItems(companyId);
    res.json(itemsData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching items");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const itemsData = await storage.getActiveItems(companyId);
    res.json(itemsData);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active items");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/template", requireAuth, async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Items");

    const columns = [
      { header: "Product Id", key: "productId", width: 18 },
      { header: "Product Description", key: "description", width: 40 },
      { header: "Category", key: "category", width: 20 },
      { header: "Category Type", key: "categoryType", width: 16 },
      { header: "Construction Stage", key: "constructionStage", width: 20 },
      { header: "Unit Price", key: "unitPrice", width: 15 },
      { header: "HS Code", key: "hsCode", width: 15 },
      { header: "AD Risk", key: "adRisk", width: 12 },
      { header: "Ad Reference Url", key: "adReferenceUrl", width: 30 },
      { header: "Compliance Notes", key: "complianceNotes", width: 30 },
      { header: "Supplier Shortlist", key: "supplierShortlist", width: 25 },
      { header: "Sources", key: "sources", width: 25 },
    ];

    sheet.columns = columns;

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    headerRow.alignment = { vertical: "middle", wrapText: true };

    sheet.getCell("D1").note = "Enter 'Supply' or 'Trade'. Defaults to Supply if left blank.";
    sheet.getCell("E1").note = "Required for Trade items. Valid stages: Prelims, Structure, Framing, Lock-up, Fitout, Final Fit Off, External Works, Other";

    sheet.addRow({
      productId: "ITEM-001",
      description: "Steel Reinforcement Bar 12mm",
      category: "Steel",
      categoryType: "Supply",
      constructionStage: "",
      unitPrice: 45.50,
      hsCode: "7214.20",
      adRisk: "Low",
      adReferenceUrl: "",
      complianceNotes: "AS/NZS 4671 compliant",
      supplierShortlist: "BHP, OneSteel",
      sources: "Domestic",
    });
    sheet.addRow({
      productId: "ITEM-002",
      description: "Concrete 40MPa Ready Mix",
      category: "Concrete",
      categoryType: "Trade",
      constructionStage: "Structure",
      unitPrice: 280.00,
      hsCode: "",
      adRisk: "",
      adReferenceUrl: "",
      complianceNotes: "",
      supplierShortlist: "Boral, Hanson",
      sources: "Local",
    });

    const exampleRows = [sheet.getRow(2), sheet.getRow(3)];
    exampleRows.forEach(row => {
      row.font = { color: { argb: "FF808080" }, italic: true, size: 10 };
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Items_Import_Template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to generate items template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.get("/api/procurement/items/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const item = await storage.getItem(String(req.params.id));
    if (!item || item.companyId !== companyId) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching item");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch item" });
  }
});

router.post("/api/procurement/items", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const item = await storage.createItem({ ...parsed.data, companyId, name: parsed.data.description });
    res.json(item);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating item");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create item" });
  }
});

router.patch("/api/procurement/items/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getItem(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Item not found" });
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const item = await storage.updateItem(String(req.params.id), parsed.data);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating item");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update item" });
  }
});

router.delete("/api/procurement/items/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getItem(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Item not found" });
    await storage.deleteItem(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting item");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete item" });
  }
});

router.post("/api/procurement/items/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    const rows: Record<string, unknown>[] = [];
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || "");
    });
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowObj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (headers[colNumber]) {
          rowObj[headers[colNumber]] = cell.value;
        }
      });
      if (Object.keys(rowObj).length > 0) rows.push(rowObj);
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: "No data found in Excel file" });
    }

    const categories = await storage.getAllItemCategories(companyId);
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    const stages = await db.select().from(constructionStages).orderBy(constructionStages.sortOrder).limit(100);
    const stageMap = new Map(stages.map(s => [s.name.toLowerCase(), s.id]));

    const itemsToImport: InsertItem[] = [];
    const categoriesToCreate: { name: string; categoryType: string }[] = [];

    const categoryTypeMap = new Map<string, string>();

    for (const row of rows) {
      const categoryName = String(row["Category"] || row["category"] || "");
      const categoryType = String(row["Category Type"] || row["category_type"] || row["CategoryType"] || "").toLowerCase().trim();
      
      if (categoryName) {
        const resolvedType = categoryType === "trade" ? "trade" : "supply";
        if (!categoryTypeMap.has(categoryName.toLowerCase())) {
          categoryTypeMap.set(categoryName.toLowerCase(), resolvedType);
        }
        
        if (!categoryMap.has(categoryName.toLowerCase())) {
          if (!categoriesToCreate.find(c => c.name.toLowerCase() === categoryName.toLowerCase())) {
            categoriesToCreate.push({
              name: categoryName,
              categoryType: resolvedType,
            });
          }
        } else {
          const existingCatId = categoryMap.get(categoryName.toLowerCase())!;
          const existingCat = categories.find(c => c.id === existingCatId);
          if (existingCat && categoryType && (existingCat as { categoryType?: string }).categoryType !== resolvedType) {
            try {
              await storage.updateItemCategory(existingCatId, { categoryType: resolvedType });
            } catch (error: unknown) {
              logger.error({ err: error }, `Error updating category type for ${categoryName}`);
            }
          }
        }
      }
    }

    for (const catInfo of categoriesToCreate) {
      try {
        const newCat = await storage.createItemCategory({
          name: catInfo.name,
          companyId,
          isActive: true,
          categoryType: catInfo.categoryType,
        });
        categoryMap.set(catInfo.name.toLowerCase(), newCat.id);
      } catch (error: unknown) {
        logger.error({ err: error }, `Error creating category ${catInfo.name}`);
      }
    }

    for (const row of rows) {
      const productId = String(row["Product Id"] || row["product_id"] || row["ProductId"] || "");
      const description = String(row["Product Description"] || row["Description"] || row["description"] || row["Name"] || row["name"] || "");
      const categoryName = String(row["Category"] || row["category"] || "");
      const categoryType = String(row["Category Type"] || row["category_type"] || row["CategoryType"] || "").toLowerCase().trim();
      const constructionStageName = String(row["Construction Stage"] || row["construction_stage"] || row["ConstructionStage"] || "").trim();
      const unitPrice = parseFloat(String(row["Avg Unit Price Aud"] || row["Unit Price"] || row["unit_price"] || "0")) || null;
      const hsCode = String(row["Hs Code Guess"] || row["HS Code"] || row["hs_code"] || "");
      const adRisk = String(row["Ad Risk"] || row["AD Risk"] || row["ad_risk"] || "");
      const adReferenceUrl = String(row["Ad Reference Url"] || row["ad_reference_url"] || "");
      const complianceNotes = String(row["Compliance Notes"] || row["compliance_notes"] || "");
      const supplierShortlist = String(row["Supplier Shortlist"] || row["supplier_shortlist"] || "");
      const sources = String(row["Sources"] || row["sources"] || "");

      if (!description) continue;

      const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;

      let constructionStageId: string | null = null;
      if (constructionStageName) {
        constructionStageId = stageMap.get(constructionStageName.toLowerCase()) || null;
      }

      itemsToImport.push({
        code: productId,
        name: description,
        description: description,
        categoryId,
        constructionStageId,
        unitPrice: unitPrice?.toString() || null,
        hsCode,
        adRisk,
        adReferenceUrl,
        complianceNotes,
        supplierShortlist,
        sources,
        isActive: true,
        companyId,
      });
    }

    const result = await storage.bulkImportItems(itemsToImport);

    res.json({
      success: true,
      message: `Import completed: ${result.created} items created, ${result.updated} items updated`,
      created: result.created,
      updated: result.updated,
      categoriesCreated: categoriesToCreate.length,
      errors: result.errors,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error importing items");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import items" });
  }
});

router.get("/purchase-orders/:id/pdf", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const po = await storage.getPurchaseOrder(id);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const settings = await storage.getGlobalSettings(req.companyId);
    const { generatePurchaseOrderPdf } = await import("../services/po-pdf.service");
    const termsData = settings ? { poTermsHtml: settings.poTermsHtml, includePOTerms: settings.includePOTerms } : null;
    const pdfBuffer = generatePurchaseOrderPdf(po, po.items || [], settings ? { logoBase64: settings.logoBase64, companyName: settings.companyName } : null, termsData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${po.poNumber || "PurchaseOrder"}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating PO PDF");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate PDF" });
  }
});

router.post("/purchase-orders/:id/send-with-pdf", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const parsed = sendPoEmailWithPdfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, sendCopy } = parsed.data;

    const po = await storage.getPurchaseOrder(id);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure the Resend email integration." });
    }

    const settings = await storage.getGlobalSettings(req.companyId);
    const { generatePurchaseOrderPdf } = await import("../services/po-pdf.service");
    const termsData = settings ? { poTermsHtml: settings.poTermsHtml, includePOTerms: settings.includePOTerms } : null;
    const pdfBuffer = generatePurchaseOrderPdf(po, po.items || [], settings ? { logoBase64: settings.logoBase64, companyName: settings.companyName } : null, termsData);

    const attachments = [{
      filename: `${po.poNumber || "PurchaseOrder"}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }];

    let bcc: string | undefined;
    let senderName = "A team member";
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (sendCopy && currentUser?.email) {
        bcc = currentUser.email;
      }
      if (currentUser) {
        senderName = currentUser.name || currentUser.email;
      }
    }

    const htmlBody = await buildBrandedEmail({
      title: `Purchase Order: ${po.poNumber || "PO"}`,
      subtitle: `Sent by ${senderName}`,
      body: message.replace(/\n/g, "<br>"),
      footerNote: "Please review the attached purchase order. If you have any questions, reply directly to this email.",
      companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments,
    });

    if (result.success) {
      logger.info({ poId: id, poNumber: po.poNumber, to }, "PO email with server-generated PDF sent successfully");
      res.json({ success: true, messageId: result.messageId });
    } else {
      logger.error({ poId: id, error: result.error }, "Failed to send PO email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending PO email with PDF");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send email" });
  }
});

const sendPoEmailWithPdfSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  sendCopy: z.boolean().default(false),
});

const sendPoEmailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  attachPdf: z.boolean().default(true),
  sendCopy: z.boolean().default(false),
  pdfBase64: z.string().optional(),
});

router.post("/api/purchase-orders/:id/send-email", requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const parsed = sendPoEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, attachPdf, sendCopy, pdfBase64 } = parsed.data;

    const po = await storage.getPurchaseOrder(id);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure the Resend email integration." });
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (attachPdf && pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      attachments.push({
        filename: `${po.poNumber || "PurchaseOrder"}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }

    let bcc: string | undefined;
    let senderName = "A team member";
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (sendCopy && currentUser?.email) {
        bcc = currentUser.email;
      }
      if (currentUser) {
        senderName = currentUser.name || currentUser.email;
      }
    }

    const htmlBody = await buildBrandedEmail({
      title: `Purchase Order: ${po.poNumber || "PO"}`,
      subtitle: `Sent by ${senderName}`,
      body: message.replace(/\n/g, "<br>"),
      footerNote: "Please review the attached purchase order. If you have any questions, reply directly to this email.",
      companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (result.success) {
      logger.info({ poId: id, poNumber: po.poNumber, to }, "PO email sent successfully");
      res.json({ success: true, messageId: result.messageId });
    } else {
      logger.error({ poId: id, error: result.error }, "Failed to send PO email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending PO email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send email" });
  }
});

export const procurementRouter = router;
