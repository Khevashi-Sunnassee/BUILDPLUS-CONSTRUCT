import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import ExcelJS from "exceljs";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { costCodes, childCostCodes, costCodeDefaults, jobCostCodes, jobTypes, jobs } from "@shared/schema";
import { eq, and, desc, asc, sql, ilike, or, inArray } from "drizzle-orm";

const router = Router();

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

const costCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const childCostCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  parentCostCodeId: z.string().min(1, "Parent cost code ID is required"),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function getCellText(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val).trim();
  if (typeof val === "object") {
    if ("richText" in val && Array.isArray((val as unknown as Record<string, unknown>).richText)) {
      return ((val as unknown as {richText: {text: string}[]}).richText).map((rt) => rt.text || "").join("").trim();
    }
    if ("text" in val) return String((val as unknown as Record<string, unknown>).text || "").trim();
    if ("result" in val) return String((val as unknown as Record<string, unknown>).result || "").trim();
    if ("hyperlink" in val && "text" in val) return String((val as unknown as Record<string, unknown>).text || "").trim();
  }
  return String(val).trim();
}

function parseHeaders(sheet: ExcelJS.Worksheet): Record<number, string> {
  const headerMap: Record<number, string> = {};
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
    headerMap[colNum] = getCellText(cell).toLowerCase();
  });
  return headerMap;
}

router.get("/api/cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { search, active } = req.query;

    let conditions = [eq(costCodes.companyId, companyId)];

    if (active === "true") {
      conditions.push(eq(costCodes.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(costCodes.isActive, false));
    }

    let results = await db
      .select()
      .from(costCodes)
      .where(and(...conditions))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();
      results = results.filter(
        (cc) =>
          cc.code.toLowerCase().includes(s) ||
          cc.name.toLowerCase().includes(s) ||
          (cc.description && cc.description.toLowerCase().includes(s))
      );
    }

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost codes");
    res.status(500).json({ message: "Failed to fetch cost codes" });
  }
});

router.get("/api/child-cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { parentCostCodeId, search, active } = req.query;

    let conditions = [eq(childCostCodes.companyId, companyId)];

    if (parentCostCodeId && typeof parentCostCodeId === "string") {
      conditions.push(eq(childCostCodes.parentCostCodeId, parentCostCodeId));
    }

    if (active === "true") {
      conditions.push(eq(childCostCodes.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(childCostCodes.isActive, false));
    }

    let results = await db
      .select({
        id: childCostCodes.id,
        companyId: childCostCodes.companyId,
        parentCostCodeId: childCostCodes.parentCostCodeId,
        code: childCostCodes.code,
        name: childCostCodes.name,
        description: childCostCodes.description,
        isActive: childCostCodes.isActive,
        sortOrder: childCostCodes.sortOrder,
        createdAt: childCostCodes.createdAt,
        updatedAt: childCostCodes.updatedAt,
        parentCode: costCodes.code,
        parentName: costCodes.name,
      })
      .from(childCostCodes)
      .innerJoin(costCodes, eq(childCostCodes.parentCostCodeId, costCodes.id))
      .where(and(...conditions))
      .orderBy(asc(childCostCodes.sortOrder), asc(childCostCodes.code));

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();
      results = results.filter(
        (cc) =>
          cc.code.toLowerCase().includes(s) ||
          cc.name.toLowerCase().includes(s) ||
          (cc.description && cc.description.toLowerCase().includes(s)) ||
          cc.parentName.toLowerCase().includes(s)
      );
    }

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching child cost codes");
    res.status(500).json({ message: "Failed to fetch child cost codes" });
  }
});

router.get("/api/cost-codes-with-children", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const parents = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.companyId, companyId), eq(costCodes.isActive, true)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    const children = await db
      .select()
      .from(childCostCodes)
      .where(and(eq(childCostCodes.companyId, companyId), eq(childCostCodes.isActive, true)))
      .orderBy(asc(childCostCodes.sortOrder), asc(childCostCodes.code));

    const childMap = new Map<string, typeof children>();
    for (const child of children) {
      const existing = childMap.get(child.parentCostCodeId) || [];
      existing.push(child);
      childMap.set(child.parentCostCodeId, existing);
    }

    const result = parents.map((parent) => ({
      ...parent,
      children: childMap.get(parent.id) || [],
    }));

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost codes with children");
    res.status(500).json({ message: "Failed to fetch cost codes with children" });
  }
});

router.get("/api/cost-codes/template/download", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BuildPlus Ai";
    workbook.created = new Date();

    const parentSheet = workbook.addWorksheet("PARENT CODES", {
      properties: { defaultColWidth: 20 },
    });

    parentSheet.columns = [
      { header: "CODE", key: "code", width: 15 },
      { header: "IS PARENT", key: "isParent", width: 12 },
      { header: "PARENT", key: "parent", width: 35 },
      { header: "CHILD", key: "child", width: 40 },
    ];

    const phRow = parentSheet.getRow(1);
    phRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    phRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    phRow.alignment = { horizontal: "center", vertical: "middle" };
    phRow.height = 24;

    const parentExamples = [
      { code: "1", isParent: 1, parent: "Appliances / Sanitary Items", child: "APPLIANCES AND SANITARY ITEMS" },
      { code: "4", isParent: 1, parent: "Blinds", child: "Window and Door Furnishings" },
      { code: "12", isParent: 1, parent: "Civil Works", child: "CIVIL WORKS" },
    ];
    parentExamples.forEach((ex) => {
      const row = parentSheet.addRow(ex);
      row.font = { italic: true, color: { argb: "FF999999" } };
    });

    const childSheet = workbook.addWorksheet("CHILD CODES", {
      properties: { defaultColWidth: 20 },
    });

    childSheet.columns = [
      { header: "CODE", key: "code", width: 15 },
      { header: "PARENT", key: "parent", width: 35 },
      { header: "CHILD", key: "child", width: 40 },
    ];

    const chRow = childSheet.getRow(1);
    chRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    chRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    chRow.alignment = { horizontal: "center", vertical: "middle" };
    chRow.height = 24;

    const childExamples = [
      { code: "1", parent: "Appliances / Sanitary Items", child: "APPLIANCES AND SANITARY ITEMS" },
      { code: "1.5", parent: "Appliances / Sanitary Items", child: "Apartment Appliances" },
      { code: "2", parent: "Appliances / Sanitary Items", child: "Common Area Appliances" },
      { code: "4", parent: "Blinds", child: "Window and Door Furnishings" },
      { code: "4.5", parent: "Blinds", child: "Blinds" },
    ];
    childExamples.forEach((ex) => {
      const row = childSheet.addRow(ex);
      row.font = { italic: true, color: { argb: "FF999999" } };
    });

    const instrSheet = workbook.addWorksheet("Instructions");
    instrSheet.columns = [
      { header: "Field", key: "field", width: 20 },
      { header: "Required", key: "required", width: 12 },
      { header: "Description", key: "description", width: 60 },
    ];
    const instrHRow = instrSheet.getRow(1);
    instrHRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    instrHRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };

    [
      { field: "PARENT CODES Tab", required: "", description: "" },
      { field: "CODE", required: "Yes", description: "Unique code identifier for the parent category" },
      { field: "IS PARENT", required: "No", description: "Set to 1 to mark as parent (always 1 for this tab)" },
      { field: "PARENT", required: "Yes", description: "Parent category name (e.g. 'Concrete Works')" },
      { field: "CHILD", required: "No", description: "Display name / description" },
      { field: "", required: "", description: "" },
      { field: "CHILD CODES Tab", required: "", description: "" },
      { field: "CODE", required: "Yes", description: "Unique code identifier for the child item" },
      { field: "PARENT", required: "Yes", description: "Must match a PARENT name from the Parent Codes tab" },
      { field: "CHILD", required: "Yes", description: "Child code name / description" },
    ].forEach((i) => instrSheet.addRow(i));

    instrSheet.addRow({});
    instrSheet.addRow({ field: "NOTES:", description: "Both tabs will be imported. Parent codes are imported first, then child codes are linked by parent name." });
    instrSheet.addRow({ field: "", description: "Duplicate codes will be skipped. The PARENT column in CHILD CODES must match the PARENT column name from PARENT CODES." });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=cost_codes_template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating cost code template");
    res.status(500).json({ message: "Failed to generate template" });
  }
});

router.post("/api/cost-codes/import", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), upload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);

    const parentSheet = workbook.getWorksheet("PARENT CODES") || workbook.getWorksheet("Parent Codes");
    const childSheet = workbook.getWorksheet("CHILD CODES") || workbook.getWorksheet("Child Codes");

    if (!parentSheet && !childSheet) {
      const firstSheet = workbook.getWorksheet(1);
      if (!firstSheet) {
        return res.status(400).json({ message: "No worksheets found in the uploaded file. Expected 'PARENT CODES' and 'CHILD CODES' tabs." });
      }
      return res.status(400).json({ message: "Expected tabs named 'PARENT CODES' and 'CHILD CODES'. Found: " + workbook.worksheets.map(s => s.name).join(", ") });
    }

    const errors: { sheet: string; row: number; message: string }[] = [];
    const importedParents: { code: string; name: string }[] = [];
    const skippedParents: { code: string; reason: string }[] = [];
    const importedChildren: { code: string; name: string; parent: string }[] = [];
    const skippedChildren: { code: string; reason: string }[] = [];

    const existingParents = await db
      .select({ id: costCodes.id, code: costCodes.code, name: costCodes.name })
      .from(costCodes)
      .where(eq(costCodes.companyId, companyId));

    const existingParentCodeMap = new Map(existingParents.map((c) => [c.code.toLowerCase(), c.id]));
    const parentNameToIdMap = new Map(existingParents.map((c) => [c.name.toLowerCase(), c.id]));

    if (parentSheet) {
      const headers = parseHeaders(parentSheet);
      let codeCol = -1, parentCol = -1, childCol = -1;
      for (const [colStr, h] of Object.entries(headers)) {
        const col = Number(colStr);
        if (h === "code") codeCol = col;
        else if (h === "parent") parentCol = col;
        else if (h === "child") childCol = col;
      }

      if (codeCol === -1) {
        errors.push({ sheet: "PARENT CODES", row: 1, message: "Missing required 'CODE' column" });
      } else {
        let sortIdx = 0;
        parentSheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
          if (rowNum === 1) return;

          const code = getCellText(row.getCell(codeCol));
          const parentName = parentCol !== -1 ? getCellText(row.getCell(parentCol)) : "";
          const childName = childCol !== -1 ? getCellText(row.getCell(childCol)) : "";

          if (!code && !parentName) return;

          const name = parentName || childName || code;

          if (!code) {
            errors.push({ sheet: "PARENT CODES", row: rowNum, message: "Code is required" });
            return;
          }

          if (existingParentCodeMap.has(code.toLowerCase())) {
            skippedParents.push({ code, reason: "Already exists" });
            parentNameToIdMap.set(name.toLowerCase(), existingParentCodeMap.get(code.toLowerCase())!);
            return;
          }

          sortIdx++;
        });

        const parentRows: { code: string; name: string; description: string | null; sortOrder: number; rowNum: number }[] = [];
        parentSheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
          if (rowNum === 1) return;
          const code = getCellText(row.getCell(codeCol));
          const parentName = parentCol !== -1 ? getCellText(row.getCell(parentCol)) : "";
          const childName = childCol !== -1 ? getCellText(row.getCell(childCol)) : "";
          if (!code) return;
          const name = parentName || childName || code;
          parentRows.push({ code, name, description: childName || null, sortOrder: parentRows.length, rowNum });
        });

        for (const pRow of parentRows) {
          if (existingParentCodeMap.has(pRow.code.toLowerCase())) {
            skippedParents.push({ code: pRow.code, reason: "Already exists" });
            parentNameToIdMap.set(pRow.name.toLowerCase(), existingParentCodeMap.get(pRow.code.toLowerCase())!);
            continue;
          }

          try {
            const [inserted] = await db
              .insert(costCodes)
              .values({
                companyId,
                code: pRow.code,
                name: pRow.name,
                description: pRow.description,
                isActive: true,
                sortOrder: pRow.sortOrder,
              })
              .returning();

            existingParentCodeMap.set(pRow.code.toLowerCase(), inserted.id);
            parentNameToIdMap.set(pRow.name.toLowerCase(), inserted.id);
            importedParents.push({ code: pRow.code, name: pRow.name });
          } catch (err: unknown) {
            if (err instanceof Error && (err as unknown as Record<string, unknown>).code === "23505") {
              skippedParents.push({ code: pRow.code, reason: "Already exists (duplicate key)" });
            } else {
              errors.push({ sheet: "PARENT CODES", row: pRow.rowNum, message: `Failed to insert "${pRow.code}": ${err instanceof Error ? err.message : String(err)}` });
            }
          }
        }
      }
    }

    if (childSheet) {
      const headers = parseHeaders(childSheet);
      let codeCol = -1, parentCol = -1, childCol = -1;
      for (const [colStr, h] of Object.entries(headers)) {
        const col = Number(colStr);
        if (h === "code") codeCol = col;
        else if (h === "parent") parentCol = col;
        else if (h === "child") childCol = col;
      }

      if (codeCol === -1 || childCol === -1) {
        errors.push({ sheet: "CHILD CODES", row: 1, message: "Missing required 'CODE' and/or 'CHILD' columns" });
      } else {
        const existingChildren = await db
          .select({ id: childCostCodes.id, code: childCostCodes.code })
          .from(childCostCodes)
          .where(eq(childCostCodes.companyId, companyId));
        const existingChildCodeMap = new Map(existingChildren.map((c) => [c.code.toLowerCase(), c.id]));

        interface ChildRow {
          code: string;
          name: string;
          parentName: string;
          sortOrder: number;
          rowNum: number;
        }

        const childRows: ChildRow[] = [];
        childSheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
          if (rowNum === 1) return;
          const code = getCellText(row.getCell(codeCol));
          const parentName = parentCol !== -1 ? getCellText(row.getCell(parentCol)) : "";
          const childName = getCellText(row.getCell(childCol));
          if (!code && !childName) return;
          if (!code) {
            errors.push({ sheet: "CHILD CODES", row: rowNum, message: "Code is required" });
            return;
          }
          if (!childName) {
            errors.push({ sheet: "CHILD CODES", row: rowNum, message: `Child name is required for code "${code}"` });
            return;
          }
          childRows.push({ code, name: childName, parentName, sortOrder: childRows.length, rowNum });
        });

        for (const cRow of childRows) {
          if (existingChildCodeMap.has(cRow.code.toLowerCase())) {
            skippedChildren.push({ code: cRow.code, reason: "Already exists" });
            continue;
          }

          const parentCostCodeId = parentNameToIdMap.get(cRow.parentName.toLowerCase());
          if (!parentCostCodeId) {
            errors.push({ sheet: "CHILD CODES", row: cRow.rowNum, message: `Parent "${cRow.parentName}" not found for child code "${cRow.code}". Make sure it matches a parent name from the PARENT CODES tab.` });
            continue;
          }

          try {
            const [inserted] = await db
              .insert(childCostCodes)
              .values({
                companyId,
                parentCostCodeId,
                code: cRow.code,
                name: cRow.name,
                isActive: true,
                sortOrder: cRow.sortOrder,
              })
              .returning();

            existingChildCodeMap.set(cRow.code.toLowerCase(), inserted.id);
            importedChildren.push({ code: cRow.code, name: cRow.name, parent: cRow.parentName });
          } catch (err: unknown) {
            if (err instanceof Error && (err as unknown as Record<string, unknown>).code === "23505") {
              skippedChildren.push({ code: cRow.code, reason: "Already exists (duplicate key)" });
            } else {
              errors.push({ sheet: "CHILD CODES", row: cRow.rowNum, message: `Failed to insert "${cRow.code}": ${err instanceof Error ? err.message : String(err)}` });
            }
          }
        }
      }
    }

    res.json({
      success: true,
      summary: {
        parentCodes: { imported: importedParents.length, skipped: skippedParents.length },
        childCodes: { imported: importedChildren.length, skipped: skippedChildren.length },
        errors: errors.length,
      },
      importedParents,
      skippedParents,
      importedChildren,
      skippedChildren,
      errors,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error importing cost codes");
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to import cost codes" });
  }
});

router.get("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [result] = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)));

    if (!result) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost code");
    res.status(500).json({ message: "Failed to fetch cost code" });
  }
});

router.post("/api/cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = costCodeSchema.parse(req.body);

    const existing = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.code, data.code), eq(costCodes.companyId, companyId)));

    if (existing.length > 0) {
      return res.status(409).json({ message: `Cost code "${data.code}" already exists` });
    }

    const [result] = await db
      .insert(costCodes)
      .values({
        companyId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        parentId: data.parentId || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating cost code");
    res.status(500).json({ message: "Failed to create cost code" });
  }
});

router.patch("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = costCodeSchema.partial().parse(req.body);

    if (data.code) {
      const existing = await db
        .select()
        .from(costCodes)
        .where(and(eq(costCodes.code, data.code), eq(costCodes.companyId, companyId)));

      if (existing.length > 0 && existing[0].id !== req.params.id) {
        return res.status(409).json({ message: `Cost code "${data.code}" already exists` });
      }
    }

    const [result] = await db
      .update(costCodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating cost code");
    res.status(500).json({ message: "Failed to update cost code" });
  }
});

router.delete("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const usedInDefaults = await db
      .select({ id: costCodeDefaults.id })
      .from(costCodeDefaults)
      .where(eq(costCodeDefaults.costCodeId, req.params.id))
      .limit(1);

    const usedInJobs = await db
      .select({ id: jobCostCodes.id })
      .from(jobCostCodes)
      .where(eq(jobCostCodes.costCodeId, req.params.id))
      .limit(1);

    if (usedInDefaults.length > 0 || usedInJobs.length > 0) {
      const [result] = await db
        .update(costCodes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)))
        .returning();

      return res.json({ ...result, deactivated: true, message: "Cost code is in use and has been deactivated instead of deleted" });
    }

    const [deleted] = await db
      .delete(costCodes)
      .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json({ message: "Cost code deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting cost code");
    res.status(500).json({ message: "Failed to delete cost code" });
  }
});

router.get("/api/child-cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [result] = await db
      .select({
        id: childCostCodes.id,
        companyId: childCostCodes.companyId,
        parentCostCodeId: childCostCodes.parentCostCodeId,
        code: childCostCodes.code,
        name: childCostCodes.name,
        description: childCostCodes.description,
        isActive: childCostCodes.isActive,
        sortOrder: childCostCodes.sortOrder,
        createdAt: childCostCodes.createdAt,
        updatedAt: childCostCodes.updatedAt,
        parentCode: costCodes.code,
        parentName: costCodes.name,
      })
      .from(childCostCodes)
      .innerJoin(costCodes, eq(childCostCodes.parentCostCodeId, costCodes.id))
      .where(and(eq(childCostCodes.id, req.params.id), eq(childCostCodes.companyId, companyId)));

    if (!result) {
      return res.status(404).json({ message: "Child cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching child cost code");
    res.status(500).json({ message: "Failed to fetch child cost code" });
  }
});

router.post("/api/child-cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = childCostCodeSchema.parse(req.body);

    const existing = await db
      .select()
      .from(childCostCodes)
      .where(and(eq(childCostCodes.code, data.code), eq(childCostCodes.companyId, companyId)));

    if (existing.length > 0) {
      return res.status(409).json({ message: `Child cost code "${data.code}" already exists` });
    }

    const [result] = await db
      .insert(childCostCodes)
      .values({
        companyId,
        parentCostCodeId: data.parentCostCodeId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating child cost code");
    res.status(500).json({ message: "Failed to create child cost code" });
  }
});

router.patch("/api/child-cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = childCostCodeSchema.partial().parse(req.body);

    if (data.code) {
      const existing = await db
        .select()
        .from(childCostCodes)
        .where(and(eq(childCostCodes.code, data.code), eq(childCostCodes.companyId, companyId)));

      if (existing.length > 0 && existing[0].id !== req.params.id) {
        return res.status(409).json({ message: `Child cost code "${data.code}" already exists` });
      }
    }

    const [result] = await db
      .update(childCostCodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(childCostCodes.id, req.params.id), eq(childCostCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Child cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating child cost code");
    res.status(500).json({ message: "Failed to update child cost code" });
  }
});

router.delete("/api/child-cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const [deleted] = await db
      .delete(childCostCodes)
      .where(and(eq(childCostCodes.id, req.params.id), eq(childCostCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Child cost code not found" });
    }
    res.json({ message: "Child cost code deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting child cost code");
    res.status(500).json({ message: "Failed to delete child cost code" });
  }
});

router.get("/api/cost-code-defaults/:jobTypeId", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const results = await db
      .select({
        id: costCodeDefaults.id,
        jobTypeId: costCodeDefaults.jobTypeId,
        costCodeId: costCodeDefaults.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
      })
      .from(costCodeDefaults)
      .innerJoin(costCodes, eq(costCodeDefaults.costCodeId, costCodes.id))
      .where(and(eq(costCodeDefaults.jobTypeId, req.params.jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching cost code defaults");
    res.status(500).json({ message: "Failed to fetch cost code defaults" });
  }
});

router.post("/api/cost-code-defaults", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { jobTypeId, costCodeIds } = z.object({
      jobTypeId: z.string().min(1),
      costCodeIds: z.array(z.string().min(1)),
    }).parse(req.body);

    await db.delete(costCodeDefaults).where(
      and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId))
    );

    if (costCodeIds.length > 0) {
      await db.insert(costCodeDefaults).values(
        costCodeIds.map((costCodeId) => ({
          companyId,
          jobTypeId,
          costCodeId,
        }))
      );
    }

    const results = await db
      .select({
        id: costCodeDefaults.id,
        jobTypeId: costCodeDefaults.jobTypeId,
        costCodeId: costCodeDefaults.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
      })
      .from(costCodeDefaults)
      .innerJoin(costCodes, eq(costCodeDefaults.costCodeId, costCodes.id))
      .where(and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    res.json(results);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error saving cost code defaults");
    res.status(500).json({ message: "Failed to save cost code defaults" });
  }
});

router.get("/api/jobs/:jobId/cost-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const results = await db
      .select({
        id: jobCostCodes.id,
        jobId: jobCostCodes.jobId,
        costCodeId: jobCostCodes.costCodeId,
        isDisabled: jobCostCodes.isDisabled,
        customName: jobCostCodes.customName,
        sortOrder: jobCostCodes.sortOrder,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
        isActive: costCodes.isActive,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, req.params.jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code));

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job cost codes");
    res.status(500).json({ message: "Failed to fetch job cost codes" });
  }
});

router.post("/api/jobs/:jobId/cost-codes/inherit", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [job] = await db
      .select({ id: jobs.id, jobTypeId: jobs.jobTypeId })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)));

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.jobTypeId) {
      return res.status(400).json({ message: "Job has no job type set - cannot inherit cost codes" });
    }

    const defaults = await db
      .select({ costCodeId: costCodeDefaults.costCodeId })
      .from(costCodeDefaults)
      .where(and(eq(costCodeDefaults.jobTypeId, job.jobTypeId), eq(costCodeDefaults.companyId, companyId)));

    if (defaults.length === 0) {
      return res.status(400).json({ message: "No default cost codes defined for this job type" });
    }

    const existing = await db
      .select({ costCodeId: jobCostCodes.costCodeId })
      .from(jobCostCodes)
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)));

    const existingSet = new Set(existing.map((e) => e.costCodeId));
    const newCodes = defaults.filter((d) => !existingSet.has(d.costCodeId));

    if (newCodes.length > 0) {
      await db.insert(jobCostCodes).values(
        newCodes.map((d, idx) => ({
          companyId,
          jobId,
          costCodeId: d.costCodeId,
          sortOrder: existing.length + idx,
        }))
      );
    }

    const results = await db
      .select({
        id: jobCostCodes.id,
        jobId: jobCostCodes.jobId,
        costCodeId: jobCostCodes.costCodeId,
        isDisabled: jobCostCodes.isDisabled,
        customName: jobCostCodes.customName,
        sortOrder: jobCostCodes.sortOrder,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
        isActive: costCodes.isActive,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code));

    res.json({ inherited: newCodes.length, total: results.length, costCodes: results });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error inheriting cost codes");
    res.status(500).json({ message: "Failed to inherit cost codes" });
  }
});

router.post("/api/jobs/:jobId/cost-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const { costCodeId, customName, sortOrder } = z.object({
      costCodeId: z.string().min(1),
      customName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body);

    const existing = await db
      .select()
      .from(jobCostCodes)
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.costCodeId, costCodeId)));

    if (existing.length > 0) {
      return res.status(409).json({ message: "Cost code already assigned to this job" });
    }

    const [result] = await db
      .insert(jobCostCodes)
      .values({
        companyId,
        jobId,
        costCodeId,
        customName: customName || null,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error adding job cost code");
    res.status(500).json({ message: "Failed to add job cost code" });
  }
});

router.patch("/api/jobs/:jobId/cost-codes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = z.object({
      isDisabled: z.boolean().optional(),
      customName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body);

    const [result] = await db
      .update(jobCostCodes)
      .set(data)
      .where(and(eq(jobCostCodes.id, req.params.id), eq(jobCostCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Job cost code not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating job cost code");
    res.status(500).json({ message: "Failed to update job cost code" });
  }
});

router.delete("/api/jobs/:jobId/cost-codes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const [deleted] = await db
      .delete(jobCostCodes)
      .where(and(eq(jobCostCodes.id, req.params.id), eq(jobCostCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Job cost code not found" });
    }
    res.json({ message: "Job cost code removed", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error removing job cost code");
    res.status(500).json({ message: "Failed to remove job cost code" });
  }
});

export const costCodesRouter = router;
