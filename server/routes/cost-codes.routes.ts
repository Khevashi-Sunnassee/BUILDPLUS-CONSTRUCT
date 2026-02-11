import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import ExcelJS from "exceljs";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { costCodes, costCodeDefaults, jobCostCodes, jobTypes, jobs } from "@shared/schema";
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
  } catch (error: any) {
    logger.error("Error fetching cost codes:", error);
    res.status(500).json({ message: "Failed to fetch cost codes" });
  }
});

router.get("/api/cost-codes/template/download", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LTE Performance";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Cost Codes", {
      properties: { defaultColWidth: 20 },
    });

    sheet.columns = [
      { header: "Code", key: "code", width: 15 },
      { header: "Name", key: "name", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Parent Code", key: "parentCode", width: 15 },
      { header: "Sort Order", key: "sortOrder", width: 12 },
      { header: "Active (Y/N)", key: "isActive", width: 12 },
    ];

    const hRow = sheet.getRow(1);
    hRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    hRow.alignment = { horizontal: "center", vertical: "middle" };
    hRow.height = 24;

    const examples = [
      { code: "1000", name: "Preliminaries", description: "Site setup and preliminary costs", parentCode: "", sortOrder: 1, isActive: "Y" },
      { code: "1010", name: "Site Establishment", description: "Site fencing, amenities, signage", parentCode: "1000", sortOrder: 2, isActive: "Y" },
      { code: "2000", name: "Concrete Works", description: "All concrete related works", parentCode: "", sortOrder: 3, isActive: "Y" },
      { code: "2010", name: "Foundations", description: "Foundation concrete pours", parentCode: "2000", sortOrder: 4, isActive: "Y" },
      { code: "3000", name: "Structural Steel", description: "Steel fabrication and erection", parentCode: "", sortOrder: 5, isActive: "Y" },
    ];
    examples.forEach((ex) => {
      const row = sheet.addRow(ex);
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
      { field: "Code", required: "Yes", description: "Unique cost code identifier (e.g. 1000, 1010, A100). Must be unique within your company." },
      { field: "Name", required: "Yes", description: "Cost code name/title (e.g. Preliminaries, Concrete Works)" },
      { field: "Description", required: "No", description: "Optional description of what this cost code covers" },
      { field: "Parent Code", required: "No", description: "Code of the parent cost code for hierarchical grouping. Must match an existing code in the import or system." },
      { field: "Sort Order", required: "No", description: "Numeric sort order (default: 0). Lower numbers appear first." },
      { field: "Active (Y/N)", required: "No", description: "Whether the cost code is active. Y = Yes (default), N = No" },
    ].forEach((i) => instrSheet.addRow(i));

    instrSheet.addRow({});
    instrSheet.addRow({ field: "NOTES:", description: "Delete the example rows before importing. Only rows in the 'Cost Codes' sheet will be imported." });
    instrSheet.addRow({ field: "", description: "Duplicate codes will be skipped (not overwritten). Existing cost codes will not be modified." });
    instrSheet.addRow({ field: "", description: "Parent codes can reference codes within the same import file or existing codes in the system." });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=cost_codes_template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    logger.error("Error generating cost code template:", error);
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

    const sheet = workbook.getWorksheet("Cost Codes") || workbook.getWorksheet(1);
    if (!sheet) {
      return res.status(400).json({ message: "No worksheet found in the uploaded file" });
    }

    const firstRow = sheet.getRow(1);
    const headerMap: Record<number, string> = {};
    firstRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      headerMap[colNum] = String(cell.value || "").trim().toLowerCase();
    });

    let codeCol = -1, nameCol = -1, descCol = -1, parentCol = -1, sortCol = -1, activeCol = -1;
    for (const [colStr, h] of Object.entries(headerMap)) {
      const col = Number(colStr);
      if (h === "code") codeCol = col;
      else if (h === "name") nameCol = col;
      else if (h === "description") descCol = col;
      else if (h.includes("parent")) parentCol = col;
      else if (h.includes("sort")) sortCol = col;
      else if (h.includes("active")) activeCol = col;
    }

    if (codeCol === -1 || nameCol === -1) {
      return res.status(400).json({ message: "Required columns 'Code' and 'Name' not found in the spreadsheet header row" });
    }

    const existingCodes = await db
      .select({ id: costCodes.id, code: costCodes.code })
      .from(costCodes)
      .where(eq(costCodes.companyId, companyId));

    const existingCodeMap = new Map(existingCodes.map((c) => [c.code.toLowerCase(), c.id]));

    interface ImportRow {
      code: string;
      name: string;
      description: string | null;
      parentCode: string | null;
      sortOrder: number;
      isActive: boolean;
      rowNum: number;
    }

    const rows: ImportRow[] = [];
    const errors: { row: number; message: string }[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;

      const code = String(row.getCell(codeCol).value || "").trim();
      const name = String(row.getCell(nameCol).value || "").trim();

      if (!code && !name) return;

      if (!code) {
        errors.push({ row: rowNum, message: "Code is required" });
        return;
      }
      if (!name) {
        errors.push({ row: rowNum, message: `Name is required for code "${code}"` });
        return;
      }

      const description = descCol !== -1 ? String(row.getCell(descCol).value || "").trim() || null : null;
      const parentCode = parentCol !== -1 ? String(row.getCell(parentCol).value || "").trim() || null : null;

      let sortOrder = 0;
      if (sortCol !== -1) {
        const sv = row.getCell(sortCol).value;
        sortOrder = typeof sv === "number" ? sv : parseInt(String(sv || "0")) || 0;
      }

      let isActive = true;
      if (activeCol !== -1) {
        const av = String(row.getCell(activeCol).value || "").trim().toUpperCase();
        if (av === "N" || av === "NO" || av === "FALSE" || av === "0") {
          isActive = false;
        }
      }

      rows.push({ code, name, description, parentCode, sortOrder, isActive, rowNum });
    });

    if (rows.length === 0) {
      return res.status(400).json({ message: "No data rows found in the file", errors });
    }

    const importCodeMap = new Map<string, string>();
    const imported: { code: string; name: string }[] = [];
    const skipped: { code: string; reason: string }[] = [];

    for (const row of rows) {
      if (existingCodeMap.has(row.code.toLowerCase())) {
        skipped.push({ code: row.code, reason: "Already exists" });
        importCodeMap.set(row.code.toLowerCase(), existingCodeMap.get(row.code.toLowerCase())!);
        continue;
      }

      if (importCodeMap.has(row.code.toLowerCase())) {
        skipped.push({ code: row.code, reason: "Duplicate in import file" });
        continue;
      }

      let parentId: string | null = null;
      if (row.parentCode) {
        const parentKey = row.parentCode.toLowerCase();
        if (importCodeMap.has(parentKey)) {
          parentId = importCodeMap.get(parentKey)!;
        } else if (existingCodeMap.has(parentKey)) {
          parentId = existingCodeMap.get(parentKey)!;
        } else {
          errors.push({ row: row.rowNum, message: `Parent code "${row.parentCode}" not found for code "${row.code}"` });
        }
      }

      try {
        const [inserted] = await db
          .insert(costCodes)
          .values({
            companyId,
            code: row.code,
            name: row.name,
            description: row.description,
            parentId,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
          })
          .returning();

        importCodeMap.set(row.code.toLowerCase(), inserted.id);
        imported.push({ code: row.code, name: row.name });
      } catch (err: any) {
        if (err.code === "23505") {
          skipped.push({ code: row.code, reason: "Already exists (duplicate key)" });
        } else {
          errors.push({ row: row.rowNum, message: `Failed to insert "${row.code}": ${err.message}` });
        }
      }
    }

    res.json({
      success: true,
      summary: {
        totalRows: rows.length,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported,
      skipped,
      errors,
    });
  } catch (error: any) {
    logger.error("Error importing cost codes:", { message: error.message, stack: error.stack });
    res.status(500).json({ message: error.message || "Failed to import cost codes" });
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
  } catch (error: any) {
    logger.error("Error fetching cost code:", error);
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating cost code:", error);
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating cost code:", error);
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
  } catch (error: any) {
    logger.error("Error deleting cost code:", error);
    res.status(500).json({ message: "Failed to delete cost code" });
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
  } catch (error: any) {
    logger.error("Error fetching cost code defaults:", error);
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error saving cost code defaults:", error);
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
  } catch (error: any) {
    logger.error("Error fetching job cost codes:", error);
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
  } catch (error: any) {
    logger.error("Error inheriting cost codes:", error);
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error adding job cost code:", error);
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating job cost code:", error);
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
  } catch (error: any) {
    logger.error("Error removing job cost code:", error);
    res.status(500).json({ message: "Failed to remove job cost code" });
  }
});

export const costCodesRouter = router;
