import { Router } from "express";
import ExcelJS from "exceljs";
import { storage } from "../../storage";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { purchaseOrders } from "@shared/schema";
import { eq, and, notInArray } from "drizzle-orm";
import {
  supplierSchema,
  SUPPLIER_TEMPLATE_COLUMNS,
  SUPPLIER_HEADER_MAP,
  upload,
} from "./shared";

const router = Router();

router.get("/api/procurement/suppliers", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 1000, 1000);
    const suppliersData = await storage.getAllSuppliers(companyId);
    res.json(suppliersData.slice(0, safeLimit));
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
    const id = String(req.params.id);
    const existing = await storage.getSupplier(id);
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Supplier not found" });

    const activePOs = await db.select({
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
    })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.supplierId, id),
          eq(purchaseOrders.companyId, companyId!),
          notInArray(purchaseOrders.status, ["RECEIVED"])
        )
      )
      .limit(50);

    if (activePOs.length > 0) {
      return res.status(409).json({
        error: `Cannot delete supplier with ${activePOs.length} active purchase order${activePOs.length !== 1 ? "s" : ""}. Complete or reassign these POs first.`,
        activePOs: activePOs.map(po => ({ poNumber: po.poNumber, status: po.status })),
      });
    }

    await storage.deleteSupplier(id);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting supplier");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete supplier" });
  }
});

export default router;
