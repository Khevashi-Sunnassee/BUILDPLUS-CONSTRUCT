import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { InsertItem } from "@shared/schema";
import logger from "../lib/logger";

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional(),
  contactName: z.string().max(255).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const itemCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const itemSchema = z.object({
  code: z.string().min(1, "Code is required").max(100),
  description: z.string().min(1, "Description is required").max(1000),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  unitOfMeasure: z.string().max(50).optional(),
  unitPrice: z.string().optional(),
  preferredSupplierId: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().optional(),
});

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
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching suppliers");
    res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const suppliersData = await storage.getActiveSuppliers(companyId);
    res.json(suppliersData);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active suppliers");
    res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const supplier = await storage.getSupplier(String(req.params.id));
    if (!supplier || supplier.companyId !== companyId) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching supplier");
    res.status(500).json({ error: error.message || "Failed to fetch supplier" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error creating supplier");
    res.status(500).json({ error: error.message || "Failed to create supplier" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error updating supplier");
    res.status(500).json({ error: error.message || "Failed to update supplier" });
  }
});

router.delete("/api/procurement/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getSupplier(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Supplier not found" });
    await storage.deleteSupplier(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting supplier");
    res.status(500).json({ error: error.message || "Failed to delete supplier" });
  }
});

router.get("/api/procurement/item-categories", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const categories = await storage.getAllItemCategories(companyId);
    res.json(categories);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching item categories");
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const categories = await storage.getActiveItemCategories(companyId);
    res.json(categories);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active item categories");
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const category = await storage.getItemCategory(String(req.params.id));
    if (!category || category.companyId !== companyId) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching category");
    res.status(500).json({ error: error.message || "Failed to fetch category" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error creating category");
    res.status(500).json({ error: error.message || "Failed to create category" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error updating category");
    res.status(500).json({ error: error.message || "Failed to update category" });
  }
});

router.delete("/api/procurement/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getItemCategory(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Category not found" });
    await storage.deleteItemCategory(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting category");
    res.status(500).json({ error: error.message || "Failed to delete category" });
  }
});

router.get("/api/procurement/items", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const itemsData = await storage.getAllItems(companyId);
    res.json(itemsData);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching items");
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const itemsData = await storage.getActiveItems(companyId);
    res.json(itemsData);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active items");
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const item = await storage.getItem(String(req.params.id));
    if (!item || item.companyId !== companyId) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching item");
    res.status(500).json({ error: error.message || "Failed to fetch item" });
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
    const item = await storage.createItem({ ...parsed.data, companyId });
    res.json(item);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating item");
    res.status(500).json({ error: error.message || "Failed to create item" });
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
  } catch (error: any) {
    logger.error({ err: error }, "Error updating item");
    res.status(500).json({ error: error.message || "Failed to update item" });
  }
});

router.delete("/api/procurement/items/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getItem(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Item not found" });
    await storage.deleteItem(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting item");
    res.status(500).json({ error: error.message || "Failed to delete item" });
  }
});

router.post("/api/procurement/items/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    if (rows.length === 0) {
      return res.status(400).json({ error: "No data found in Excel file" });
    }

    const categories = await storage.getAllItemCategories(companyId);
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    const itemsToImport: InsertItem[] = [];
    const categoriesToCreate: string[] = [];

    for (const row of rows) {
      const categoryName = row["Category"] || row["category"] || "";
      
      if (categoryName && !categoryMap.has(categoryName.toLowerCase())) {
        if (!categoriesToCreate.includes(categoryName)) {
          categoriesToCreate.push(categoryName);
        }
      }
    }

    for (const catName of categoriesToCreate) {
      try {
        const newCat = await storage.createItemCategory({ name: catName, companyId, isActive: true });
        categoryMap.set(catName.toLowerCase(), newCat.id);
      } catch (error) {
        logger.error({ err: error }, `Error creating category ${catName}`);
      }
    }

    for (const row of rows) {
      const productId = row["Product Id"] || row["product_id"] || row["ProductId"] || "";
      const description = row["Product Description"] || row["Description"] || row["description"] || row["Name"] || row["name"] || "";
      const categoryName = row["Category"] || row["category"] || "";
      const unitPrice = parseFloat(row["Avg Unit Price Aud"] || row["Unit Price"] || row["unit_price"] || "0") || null;
      const hsCode = row["Hs Code Guess"] || row["HS Code"] || row["hs_code"] || "";
      const adRisk = row["Ad Risk"] || row["AD Risk"] || row["ad_risk"] || "";
      const adReferenceUrl = row["Ad Reference Url"] || row["ad_reference_url"] || "";
      const complianceNotes = row["Compliance Notes"] || row["compliance_notes"] || "";
      const supplierShortlist = row["Supplier Shortlist"] || row["supplier_shortlist"] || "";
      const sources = row["Sources"] || row["sources"] || "";

      if (!description) continue;

      const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;

      itemsToImport.push({
        code: productId,
        name: description,
        description: description,
        categoryId,
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
  } catch (error: any) {
    logger.error({ err: error }, "Error importing items");
    res.status(500).json({ error: error.message || "Failed to import items" });
  }
});

export const procurementRouter = router;
