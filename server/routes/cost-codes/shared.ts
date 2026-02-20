import { z } from "zod";
import multer from "multer";
import ExcelJS from "exceljs";

export { z, multer, ExcelJS };

export const ALLOWED_IMPORT_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const upload = multer({
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

export const costCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const childCostCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  parentCostCodeId: z.string().min(1, "Parent cost code ID is required"),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export function getCellText(cell: ExcelJS.Cell): string {
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

export function parseHeaders(sheet: ExcelJS.Worksheet): Record<number, string> {
  const headerMap: Record<number, string> = {};
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
    headerMap[colNum] = getCellText(cell).toLowerCase();
  });
  return headerMap;
}
