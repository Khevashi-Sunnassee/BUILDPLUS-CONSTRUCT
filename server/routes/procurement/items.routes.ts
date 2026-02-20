import { Router } from "express";
import ExcelJS from "exceljs";
import { storage } from "../../storage";
import { db } from "../../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { InsertItem, constructionStages } from "@shared/schema";
import logger from "../../lib/logger";
import { itemCategorySchema, itemSchema, upload } from "./shared";

const router = Router();

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
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 1000, 1000);
    const itemsData = await storage.getAllItems(companyId);
    res.json(itemsData.slice(0, safeLimit));
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

export default router;
