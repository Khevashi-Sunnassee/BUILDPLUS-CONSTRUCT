import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { InsertItem } from "@shared/schema";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get("/api/procurement/suppliers", requireAuth, async (req, res) => {
  try {
    const suppliersData = await storage.getAllSuppliers();
    res.json(suppliersData);
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/active", requireAuth, async (req, res) => {
  try {
    const suppliersData = await storage.getActiveSuppliers();
    res.json(suppliersData);
  } catch (error: any) {
    console.error("Error fetching active suppliers:", error);
    res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
  }
});

router.get("/api/procurement/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const supplier = await storage.getSupplier(String(req.params.id));
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (error: any) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ error: error.message || "Failed to fetch supplier" });
  }
});

router.post("/api/procurement/suppliers", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const supplier = await storage.createSupplier(req.body);
    res.json(supplier);
  } catch (error: any) {
    console.error("Error creating supplier:", error);
    res.status(500).json({ error: error.message || "Failed to create supplier" });
  }
});

router.patch("/api/procurement/suppliers/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const supplier = await storage.updateSupplier(String(req.params.id), req.body);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (error: any) {
    console.error("Error updating supplier:", error);
    res.status(500).json({ error: error.message || "Failed to update supplier" });
  }
});

router.delete("/api/procurement/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteSupplier(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ error: error.message || "Failed to delete supplier" });
  }
});

router.get("/api/procurement/item-categories", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getAllItemCategories();
    res.json(categories);
  } catch (error: any) {
    console.error("Error fetching item categories:", error);
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/active", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getActiveItemCategories();
    res.json(categories);
  } catch (error: any) {
    console.error("Error fetching active item categories:", error);
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

router.get("/api/procurement/item-categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await storage.getItemCategory(String(req.params.id));
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error: any) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: error.message || "Failed to fetch category" });
  }
});

router.post("/api/procurement/item-categories", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const category = await storage.createItemCategory(req.body);
    res.json(category);
  } catch (error: any) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: error.message || "Failed to create category" });
  }
});

router.patch("/api/procurement/item-categories/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const category = await storage.updateItemCategory(String(req.params.id), req.body);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error: any) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: error.message || "Failed to update category" });
  }
});

router.delete("/api/procurement/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteItemCategory(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: error.message || "Failed to delete category" });
  }
});

router.get("/api/procurement/items", requireAuth, async (req, res) => {
  try {
    const itemsData = await storage.getAllItems();
    res.json(itemsData);
  } catch (error: any) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/active", requireAuth, async (req, res) => {
  try {
    const itemsData = await storage.getActiveItems();
    res.json(itemsData);
  } catch (error: any) {
    console.error("Error fetching active items:", error);
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

router.get("/api/procurement/items/:id", requireAuth, async (req, res) => {
  try {
    const item = await storage.getItem(String(req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: any) {
    console.error("Error fetching item:", error);
    res.status(500).json({ error: error.message || "Failed to fetch item" });
  }
});

router.post("/api/procurement/items", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await storage.createItem(req.body);
    res.json(item);
  } catch (error: any) {
    console.error("Error creating item:", error);
    res.status(500).json({ error: error.message || "Failed to create item" });
  }
});

router.patch("/api/procurement/items/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await storage.updateItem(String(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error: any) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: error.message || "Failed to update item" });
  }
});

router.delete("/api/procurement/items/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.deleteItem(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: error.message || "Failed to delete item" });
  }
});

router.post("/api/procurement/items/import", requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
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

    const categories = await storage.getAllItemCategories();
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
        const newCat = await storage.createItemCategory({ name: catName, isActive: true });
        categoryMap.set(catName.toLowerCase(), newCat.id);
      } catch (error) {
        console.error(`Error creating category ${catName}:`, error);
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
    console.error("Error importing items:", error);
    res.status(500).json({ error: error.message || "Failed to import items" });
  }
});

export const procurementRouter = router;
