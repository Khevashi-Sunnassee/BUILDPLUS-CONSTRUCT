import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { costCodes, childCostCodes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ExcelJS, upload, getCellText, parseHeaders } from "./shared";

const router = Router();

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
      .where(eq(costCodes.companyId, companyId))
      .limit(5000);

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
          .where(eq(childCostCodes.companyId, companyId))
          .limit(5000);
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

export default router;
