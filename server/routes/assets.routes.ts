import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { db } from "../db";
import { assets, assetMaintenanceRecords, assetTransfers, ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CONDITIONS, ASSET_FUNDING_METHODS } from "@shared/schema";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import OpenAI from "openai";
import logger from "../lib/logger";
import multer from "multer";
import ExcelJS from "exceljs";

const router = Router();

const createAssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  fundingMethod: z.string().optional().nullable(),
  purchasePrice: z.any().optional().nullable(),
  currentValue: z.any().optional().nullable(),
  depreciationMethod: z.string().optional().nullable(),
  depreciationRate: z.any().optional().nullable(),
  accumulatedDepreciation: z.any().optional().nullable(),
  depreciationThisPeriod: z.any().optional().nullable(),
  bookValue: z.any().optional().nullable(),
  yearsDepreciated: z.number().optional().nullable(),
  usefulLifeYears: z.number().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  leaseStartDate: z.string().optional().nullable(),
  leaseEndDate: z.string().optional().nullable(),
  leaseMonthlyPayment: z.any().optional().nullable(),
  balloonPayment: z.any().optional().nullable(),
  leaseTerm: z.number().optional().nullable(),
  lessor: z.string().optional().nullable(),
  loanAmount: z.any().optional().nullable(),
  interestRate: z.any().optional().nullable(),
  loanTerm: z.number().optional().nullable(),
  lender: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  engineNumber: z.string().optional().nullable(),
  vinNumber: z.string().optional().nullable(),
  yearOfManufacture: z.string().optional().nullable(),
  countryOfOrigin: z.string().optional().nullable(),
  specifications: z.string().optional().nullable(),
  operatingHours: z.any().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  insurancePremium: z.any().optional().nullable(),
  insuranceExcess: z.any().optional().nullable(),
  insuranceStartDate: z.string().optional().nullable(),
  insuranceExpiryDate: z.string().optional().nullable(),
  insuranceStatus: z.string().optional().nullable(),
  insuranceNotes: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  barcode: z.string().optional().nullable(),
  qrCode: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  capexRequestId: z.string().optional().nullable(),
  capexDescription: z.string().optional().nullable(),
  photos: z.any().optional().nullable(),
}).passthrough();

const createMaintenanceSchema = z.object({
  maintenanceType: z.string().min(1, "Maintenance type is required"),
  maintenanceDate: z.string().min(1, "Date is required"),
  cost: z.any().optional().nullable(),
  serviceProvider: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const createTransferSchema = z.object({
  transferDate: z.string().min(1, "Transfer date is required"),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  fromDepartment: z.string().optional().nullable(),
  toDepartment: z.string().optional().nullable(),
  fromAssignee: z.string().optional().nullable(),
  toAssignee: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

async function generateAssetTag(companyId: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `AST-${yy}${mm}-`;
  const result = await db.select({ tag: assets.assetTag })
    .from(assets)
    .where(and(eq(assets.companyId, companyId), ilike(assets.assetTag, `${prefix}%`)))
    .orderBy(desc(assets.assetTag))
    .limit(1);
  let nextNum = 1;
  if (result.length > 0) {
    const lastTag = result[0].tag;
    const lastNum = parseInt(lastTag.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const TEMPLATE_COLUMNS = [
  { header: "Asset Name", key: "name", width: 30 },
  { header: "Category", key: "category", width: 22 },
  { header: "Description", key: "description", width: 35 },
  { header: "Quantity", key: "quantity", width: 10 },
  { header: "Status", key: "status", width: 12 },
  { header: "Condition", key: "condition", width: 12 },
  { header: "Location", key: "location", width: 20 },
  { header: "Department", key: "department", width: 18 },
  { header: "Assigned To", key: "assignedTo", width: 18 },
  { header: "Funding Method", key: "fundingMethod", width: 16 },
  { header: "Supplier", key: "supplier", width: 25 },
  { header: "Purchase Date", key: "purchaseDate", width: 14 },
  { header: "Purchase Price", key: "purchasePrice", width: 14 },
  { header: "Current Value", key: "currentValue", width: 14 },
  { header: "Useful Life (Years)", key: "usefulLifeYears", width: 18 },
  { header: "Depreciation Method", key: "depreciationMethod", width: 18 },
  { header: "Depreciation Rate", key: "depreciationRate", width: 16 },
  { header: "Acc Depreciation", key: "accumulatedDepreciation", width: 16 },
  { header: "Depreciation This Period", key: "depreciationThisPeriod", width: 20 },
  { header: "Book Value", key: "bookValue", width: 14 },
  { header: "Years Depreciated", key: "yearsDepreciated", width: 16 },
  { header: "Manufacturer", key: "manufacturer", width: 20 },
  { header: "Model", key: "model", width: 20 },
  { header: "Serial Number", key: "serialNumber", width: 20 },
  { header: "Asset No.", key: "registrationNumber", width: 16 },
  { header: "Engine Number", key: "engineNumber", width: 18 },
  { header: "VIN Number", key: "vinNumber", width: 20 },
  { header: "Year of Manufacture", key: "yearOfManufacture", width: 18 },
  { header: "Country of Origin", key: "countryOfOrigin", width: 16 },
  { header: "Specifications", key: "specifications", width: 30 },
  { header: "Operating Hours", key: "operatingHours", width: 14 },
  { header: "Warranty Expiry", key: "warrantyExpiry", width: 14 },
  { header: "Lease Start Date", key: "leaseStartDate", width: 14 },
  { header: "Lease End Date", key: "leaseEndDate", width: 14 },
  { header: "Lease Monthly Payment", key: "leaseMonthlyPayment", width: 18 },
  { header: "Balloon Payment", key: "balloonPayment", width: 14 },
  { header: "Lease Term (Months)", key: "leaseTerm", width: 18 },
  { header: "Lessor", key: "lessor", width: 20 },
  { header: "Loan Amount", key: "loanAmount", width: 14 },
  { header: "Interest Rate", key: "interestRate", width: 12 },
  { header: "Loan Term (Months)", key: "loanTerm", width: 16 },
  { header: "Lender", key: "lender", width: 20 },
  { header: "Insurance Provider", key: "insuranceProvider", width: 20 },
  { header: "Insurance Policy No.", key: "insurancePolicyNumber", width: 20 },
  { header: "Insurance Premium", key: "insurancePremium", width: 16 },
  { header: "Insurance Excess", key: "insuranceExcess", width: 14 },
  { header: "Insurance Start Date", key: "insuranceStartDate", width: 16 },
  { header: "Insurance Expiry Date", key: "insuranceExpiryDate", width: 16 },
  { header: "Insurance Status", key: "insuranceStatus", width: 14 },
  { header: "Insurance Notes", key: "insuranceNotes", width: 25 },
  { header: "Barcode", key: "barcode", width: 18 },
  { header: "Remarks", key: "remarks", width: 30 },
  { header: "CAPEX Request ID", key: "capexRequestId", width: 16 },
  { header: "CAPEX Description", key: "capexDescription", width: 25 },
];

const HEADER_TO_KEY: Record<string, string> = {};
TEMPLATE_COLUMNS.forEach(c => { HEADER_TO_KEY[c.header.toLowerCase().trim()] = c.key; });

const SPREADSHEET_ALIASES: Record<string, string> = {
  "item": "_skip",
  "asset name": "name",
  "asset no.": "registrationNumber",
  "acquisition date": "purchaseDate",
  "acquisition cost": "purchasePrice",
  "useful life (years)": "usefulLifeYears",
  "salvage value": "_skip",
  "acc depreciation": "accumulatedDepreciation",
  "depreciation this period (initial)": "depreciationThisPeriod",
  "no of years depreciation": "yearsDepreciated",
  "serial no.": "serialNumber",
  "description": "category",
  "quantity": "quantity",
  "book value": "bookValue",
  "remarks": "remarks",
};

function mapCategoryFromSpreadsheet(desc: string | null): string {
  if (!desc) return "Other";
  const lower = desc.toLowerCase().trim();
  if (lower === "tools") return "Hand Tools & Power Tools";
  if (lower === "machinery") return "General Machinery";
  if (lower === "computer equipment") return "IT Equipment";
  if (lower === "buildings") return "Infrastructure";
  if (lower === "yard equipment") return "Workshop Equipment";
  if (lower.includes("magnet") || lower.includes("formwork") || lower.includes("klipform")) return "Molds";
  const match = ASSET_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (match) return match;
  return "Other";
}

async function aiCategorizeBatch(items: { index: number; name: string; description?: string }[]): Promise<Record<number, string>> {
  if (items.length === 0) return {};
  try {
    const openai = getOpenAI();
    const categoriesList = ASSET_CATEGORIES.join(", ");

    const batchSize = 80;
    const results: Record<number, string> = {};

    for (let start = 0; start < items.length; start += batchSize) {
      const batch = items.slice(start, start + batchSize);
      const batchList = batch.map(i => `${i.index}: ${i.name}${i.description ? " - " + i.description : ""}`).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are an asset categorization assistant for a construction/manufacturing company. Given asset names and optional descriptions, assign the most appropriate category from this list: ${categoriesList}. Respond ONLY with a JSON object mapping item index to category. Example: {"1":"Heavy Equipment","2":"Hand Tools & Power Tools"}`
          },
          {
            role: "user",
            content: `Categorize these assets:\n${batchList}`
          }
        ],
      });

      const content = response.choices[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        for (const [key, val] of Object.entries(parsed)) {
          const idx = parseInt(key);
          const cat = String(val);
          if (ASSET_CATEGORIES.includes(cat as any)) {
            results[idx] = cat;
          }
        }
      } catch {
        logger.warn("Failed to parse AI categorization response", { content: cleaned });
      }
    }

    return results;
  } catch (error: any) {
    logger.warn("AI categorization failed, falling back to manual mapping", { error: error.message });
    return {};
  }
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  const str = String(value).trim();
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toISOString().split("T")[0];
  }
  return null;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[,$\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

router.get("/api/admin/assets/template", requireAuth, async (_req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Asset Register Template");
    sheet.columns = TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

    const catSheet = workbook.addWorksheet("Validation Data");
    catSheet.getColumn(1).width = 30;
    catSheet.getCell("A1").value = "Valid Categories";
    catSheet.getCell("A1").font = { bold: true };
    ASSET_CATEGORIES.forEach((cat, i) => {
      catSheet.getCell(`A${i + 2}`).value = cat;
    });
    catSheet.getColumn(2).width = 15;
    catSheet.getCell("B1").value = "Valid Statuses";
    catSheet.getCell("B1").font = { bold: true };
    ASSET_STATUSES.forEach((s, i) => {
      catSheet.getCell(`B${i + 2}`).value = s;
    });
    catSheet.getColumn(3).width = 15;
    catSheet.getCell("C1").value = "Valid Conditions";
    catSheet.getCell("C1").font = { bold: true };
    ASSET_CONDITIONS.forEach((c, i) => {
      catSheet.getCell(`C${i + 2}`).value = c;
    });
    catSheet.getColumn(4).width = 15;
    catSheet.getCell("D1").value = "Funding Methods";
    catSheet.getCell("D1").font = { bold: true };
    ASSET_FUNDING_METHODS.forEach((f, i) => {
      catSheet.getCell(`D${i + 2}`).value = f;
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Asset_Register_Template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    logger.error("Failed to generate asset template", { error: error.message });
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.post("/api/admin/assets/import", requireRole("ADMIN"), upload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    let sheet = workbook.worksheets[0];
    for (const ws of workbook.worksheets) {
      const name = ws.name.toLowerCase().trim();
      if (name.includes("all assets") || name.includes("fy 24") || name === "asset register template") {
        sheet = ws;
        break;
      }
    }

    let headerRowIndex = 0;
    const columnMap: Record<number, string> = {};
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let matchCount = 0;
      for (let c = 1; c <= sheet.columnCount; c++) {
        const cell = row.getCell(c);
        let val = cell.value;
        if (val && typeof val === "object" && "richText" in val) {
          val = (val as any).richText.map((t: any) => t.text).join("");
        }
        if (!val) continue;
        const headerStr = String(val).toLowerCase().trim();
        const mappedKey = HEADER_TO_KEY[headerStr] || SPREADSHEET_ALIASES[headerStr];
        if (mappedKey) {
          matchCount++;
          if (mappedKey !== "_skip") {
            columnMap[c] = mappedKey;
          }
        }
      }
      if (matchCount >= 3) {
        headerRowIndex = r;
        break;
      }
    }

    if (!headerRowIndex) {
      return res.status(400).json({ error: "Could not find header row. Please ensure the spreadsheet has recognizable column headers." });
    }

    const imported: any[] = [];
    const errors: string[] = [];
    let rowNum = 0;

    const parsedRows: { rowNum: number; name: string; rowData: Record<string, any>; manualCategory: string | null; rawCategory: string | null }[] = [];

    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rowData: Record<string, any> = {};
      let hasData = false;

      for (const [colStr, key] of Object.entries(columnMap)) {
        const col = parseInt(colStr);
        const cell = row.getCell(col);
        let val = cell.value;
        if (val && typeof val === "object" && "result" in val) val = (val as any).result;
        if (val && typeof val === "object" && "richText" in val) val = (val as any).richText.map((t: any) => t.text).join("");
        if (val !== null && val !== undefined && val !== "") {
          hasData = true;
          rowData[key] = val;
        }
      }

      if (!hasData) continue;
      rowNum++;

      const name = rowData.name ? String(rowData.name).trim() : null;
      if (!name) {
        errors.push(`Row ${rowNum}: Missing asset name, skipped`);
        continue;
      }

      let manualCategory: string | null = null;
      const rawCat = rowData.category ? String(rowData.category).trim() : null;
      if (rawCat && ASSET_CATEGORIES.includes(rawCat as any)) {
        manualCategory = rawCat;
      } else if (rawCat) {
        const mapped = mapCategoryFromSpreadsheet(rawCat);
        if (mapped !== "Other") manualCategory = mapped;
      }

      parsedRows.push({ rowNum, name, rowData, manualCategory, rawCategory: rawCat });
    }

    const needsAI = parsedRows.filter(r => !r.manualCategory);
    let aiResults: Record<number, string> = {};
    if (needsAI.length > 0) {
      const aiItems = needsAI.map(r => ({
        index: r.rowNum,
        name: r.name,
        description: r.rowData.description ? String(r.rowData.description).trim() : undefined,
      }));
      aiResults = await aiCategorizeBatch(aiItems);
      logger.info(`AI categorized ${Object.keys(aiResults).length}/${needsAI.length} assets`);
    }

    for (const parsedRow of parsedRows) {
      const { name, rowData } = parsedRow;
      let category = parsedRow.manualCategory
        || aiResults[parsedRow.rowNum]
        || (parsedRow.rawCategory ? mapCategoryFromSpreadsheet(parsedRow.rawCategory) : null)
        || "Other";

      try {
        const assetTag = await generateAssetTag(companyId);
        const insertData: any = {
          companyId,
          assetTag,
          name,
          category,
          status: "active",
          createdBy: req.session?.userId || null,
        };

        if (rowData.description) insertData.description = String(rowData.description).trim();
        if (rowData.supplier) insertData.supplier = String(rowData.supplier).trim();
        if (rowData.serialNumber) insertData.serialNumber = String(rowData.serialNumber).trim();
        if (rowData.registrationNumber) insertData.registrationNumber = String(rowData.registrationNumber).trim();
        if (rowData.remarks) insertData.remarks = String(rowData.remarks).trim();
        if (rowData.manufacturer) insertData.manufacturer = String(rowData.manufacturer).trim();
        if (rowData.model) insertData.model = String(rowData.model).trim();
        if (rowData.location) insertData.location = String(rowData.location).trim();
        if (rowData.department) insertData.department = String(rowData.department).trim();
        if (rowData.assignedTo) insertData.assignedTo = String(rowData.assignedTo).trim();
        if (rowData.fundingMethod) insertData.fundingMethod = String(rowData.fundingMethod).trim();
        if (rowData.depreciationMethod) insertData.depreciationMethod = String(rowData.depreciationMethod).trim();
        if (rowData.engineNumber) insertData.engineNumber = String(rowData.engineNumber).trim();
        if (rowData.vinNumber) insertData.vinNumber = String(rowData.vinNumber).trim();
        if (rowData.yearOfManufacture) insertData.yearOfManufacture = String(rowData.yearOfManufacture).trim();
        if (rowData.countryOfOrigin) insertData.countryOfOrigin = String(rowData.countryOfOrigin).trim();
        if (rowData.specifications) insertData.specifications = String(rowData.specifications).trim();
        if (rowData.barcode) insertData.barcode = String(rowData.barcode).trim();
        if (rowData.capexRequestId) insertData.capexRequestId = String(rowData.capexRequestId).trim();
        if (rowData.capexDescription) insertData.capexDescription = String(rowData.capexDescription).trim();
        if (rowData.lessor) insertData.lessor = String(rowData.lessor).trim();
        if (rowData.lender) insertData.lender = String(rowData.lender).trim();
        if (rowData.insuranceProvider) insertData.insuranceProvider = String(rowData.insuranceProvider).trim();
        if (rowData.insurancePolicyNumber) insertData.insurancePolicyNumber = String(rowData.insurancePolicyNumber).trim();
        if (rowData.insuranceStatus) insertData.insuranceStatus = String(rowData.insuranceStatus).trim();
        if (rowData.insuranceNotes) insertData.insuranceNotes = String(rowData.insuranceNotes).trim();

        const purchaseDate = parseExcelDate(rowData.purchaseDate);
        if (purchaseDate) insertData.purchaseDate = purchaseDate;
        const warrantyExpiry = parseExcelDate(rowData.warrantyExpiry);
        if (warrantyExpiry) insertData.warrantyExpiry = warrantyExpiry;
        const leaseStartDate = parseExcelDate(rowData.leaseStartDate);
        if (leaseStartDate) insertData.leaseStartDate = leaseStartDate;
        const leaseEndDate = parseExcelDate(rowData.leaseEndDate);
        if (leaseEndDate) insertData.leaseEndDate = leaseEndDate;
        const insuranceStartDate = parseExcelDate(rowData.insuranceStartDate);
        if (insuranceStartDate) insertData.insuranceStartDate = insuranceStartDate;
        const insuranceExpiryDate = parseExcelDate(rowData.insuranceExpiryDate);
        if (insuranceExpiryDate) insertData.insuranceExpiryDate = insuranceExpiryDate;

        const purchasePrice = parseNumber(rowData.purchasePrice);
        if (purchasePrice !== null) insertData.purchasePrice = String(purchasePrice);
        const currentValue = parseNumber(rowData.currentValue);
        if (currentValue !== null) insertData.currentValue = String(currentValue);
        const accDep = parseNumber(rowData.accumulatedDepreciation);
        if (accDep !== null) insertData.accumulatedDepreciation = String(accDep);
        const depThisPeriod = parseNumber(rowData.depreciationThisPeriod);
        if (depThisPeriod !== null) insertData.depreciationThisPeriod = String(depThisPeriod);
        const bookVal = parseNumber(rowData.bookValue);
        if (bookVal !== null) insertData.bookValue = String(bookVal);
        const depRate = parseNumber(rowData.depreciationRate);
        if (depRate !== null) insertData.depreciationRate = String(depRate);
        const opHours = parseNumber(rowData.operatingHours);
        if (opHours !== null) insertData.operatingHours = String(opHours);
        const leasePmt = parseNumber(rowData.leaseMonthlyPayment);
        if (leasePmt !== null) insertData.leaseMonthlyPayment = String(leasePmt);
        const balloon = parseNumber(rowData.balloonPayment);
        if (balloon !== null) insertData.balloonPayment = String(balloon);
        const loanAmt = parseNumber(rowData.loanAmount);
        if (loanAmt !== null) insertData.loanAmount = String(loanAmt);
        const intRate = parseNumber(rowData.interestRate);
        if (intRate !== null) insertData.interestRate = String(intRate);
        const insPrem = parseNumber(rowData.insurancePremium);
        if (insPrem !== null) insertData.insurancePremium = String(insPrem);
        const insExcess = parseNumber(rowData.insuranceExcess);
        if (insExcess !== null) insertData.insuranceExcess = String(insExcess);

        const qty = parseNumber(rowData.quantity);
        if (qty !== null) insertData.quantity = Math.round(qty);
        const usefulLife = parseNumber(rowData.usefulLifeYears);
        if (usefulLife !== null) insertData.usefulLifeYears = Math.round(usefulLife);
        const yearsDep = parseNumber(rowData.yearsDepreciated);
        if (yearsDep !== null) insertData.yearsDepreciated = Math.round(yearsDep);
        const leaseTerm = parseNumber(rowData.leaseTerm);
        if (leaseTerm !== null) insertData.leaseTerm = Math.round(leaseTerm);
        const loanTerm = parseNumber(rowData.loanTerm);
        if (loanTerm !== null) insertData.loanTerm = Math.round(loanTerm);

        const [created] = await db.insert(assets).values(insertData).returning();
        imported.push({ id: created.id, name: created.name, assetTag: created.assetTag });
      } catch (rowError: any) {
        errors.push(`Row ${parsedRow.rowNum} (${name}): ${rowError.message}`);
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 50),
      assets: imported.slice(0, 20),
    });
  } catch (error: any) {
    logger.error("Failed to import assets", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to import assets" });
  }
});

router.get("/api/admin/assets", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const result = await db.select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      category: assets.category,
      status: assets.status,
      condition: assets.condition,
      location: assets.location,
      department: assets.department,
      fundingMethod: assets.fundingMethod,
      purchasePrice: assets.purchasePrice,
      currentValue: assets.currentValue,
      manufacturer: assets.manufacturer,
      model: assets.model,
      serialNumber: assets.serialNumber,
      assignedTo: assets.assignedTo,
      createdAt: assets.createdAt,
    }).from(assets)
      .where(eq(assets.companyId, companyId))
      .orderBy(desc(assets.createdAt))
      .limit(safeLimit);
    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch assets", { error: error.message });
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.get("/api/admin/assets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (error: any) {
    logger.error("Failed to fetch asset", { error: error.message });
    res.status(500).json({ error: "Failed to fetch asset" });
  }
});

router.post("/api/admin/assets", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const assetTag = await generateAssetTag(companyId);
    const data = {
      ...parsed.data,
      companyId,
      assetTag,
      createdBy: req.session?.userId || null,
    };
    const [created] = await db.insert(assets).values(data).returning();
    res.status(201).json(created);
  } catch (error: any) {
    logger.error("Failed to create asset", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to create asset" });
  }
});

router.put("/api/admin/assets/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [existing] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Asset not found" });

    const parsed = createAssetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const { id: _id, companyId: _cid, assetTag: _tag, createdAt: _ca, ...safeData } = parsed.data as Record<string, unknown>;
    const [updated] = await db.update(assets)
      .set({ ...safeData, updatedAt: new Date() })
      .where(eq(assets.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    logger.error("Failed to update asset", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to update asset" });
  }
});

router.delete("/api/admin/assets/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [existing] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Asset not found" });
    await db.delete(assets).where(eq(assets.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Failed to delete asset", { error: error.message });
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

router.post("/api/admin/assets/:id/ai-summary", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    if (!asset.manufacturer && !asset.model) {
      return res.status(400).json({ error: "Manufacturer and model are required for AI analysis" });
    }

    const maintenanceHistory = await db.select().from(assetMaintenanceRecords)
      .where(eq(assetMaintenanceRecords.assetId, asset.id))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate))
      .limit(10);

    const prompt = `Analyze this construction/manufacturing asset and provide a comprehensive summary:

Asset: ${asset.name}
Manufacturer: ${asset.manufacturer || 'Unknown'}
Model: ${asset.model || 'Unknown'}
Category: ${asset.category}
Condition: ${asset.condition || 'Not assessed'}
Year of Manufacture: ${asset.yearOfManufacture || 'Unknown'}
Purchase Price: ${asset.purchasePrice ? `$${asset.purchasePrice}` : 'Unknown'}
Current Value: ${asset.currentValue ? `$${asset.currentValue}` : 'Unknown'}
Operating Hours: ${asset.operatingHours || 'Unknown'}
Serial Number: ${asset.serialNumber || 'N/A'}
Status: ${asset.status || 'active'}
${maintenanceHistory.length > 0 ? `\nRecent Maintenance (${maintenanceHistory.length} records):\n${maintenanceHistory.map(m => `- ${m.maintenanceDate}: ${m.maintenanceType} - ${m.description || 'No details'} ($${m.cost || '0'})`).join('\n')}` : ''}

Please provide:
1. Asset Overview & Market Context
2. Expected Remaining Useful Life
3. Current Market Value Assessment
4. Recommended Maintenance Schedule
5. Risk Assessment & Recommendations
6. Depreciation Analysis

Format as clean HTML with headings and bullet points.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an asset management specialist for construction and manufacturing companies. Provide practical, data-driven analysis." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content || "";
    const [updated] = await db.update(assets)
      .set({ aiSummary: summary, updatedAt: new Date() })
      .where(eq(assets.id, asset.id))
      .returning();
    res.json({ aiSummary: summary });
  } catch (error: any) {
    logger.error("Failed to generate AI summary", { error: error.message });
    res.status(500).json({ error: "Failed to generate AI summary" });
  }
});

router.get("/api/admin/assets/:id/maintenance", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const records = await db.select().from(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.assetId, req.params.id), eq(assetMaintenanceRecords.companyId, companyId)))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate))
      .limit(safeLimit);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch maintenance records" });
  }
});

router.post("/api/admin/assets/:id/maintenance", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const parsed = createMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const [record] = await db.insert(assetMaintenanceRecords).values({
      ...parsed.data,
      assetId: req.params.id,
      companyId,
      createdBy: req.session?.userId || null,
    }).returning();
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create maintenance record" });
  }
});

router.delete("/api/admin/assets/:assetId/maintenance/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.id, req.params.id), eq(assetMaintenanceRecords.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete maintenance record" });
  }
});

router.get("/api/admin/assets/:id/transfers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const records = await db.select().from(assetTransfers)
      .where(and(eq(assetTransfers.assetId, req.params.id), eq(assetTransfers.companyId, companyId)))
      .orderBy(desc(assetTransfers.transferDate))
      .limit(safeLimit);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch transfer records" });
  }
});

router.post("/api/admin/assets/:id/transfers", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const parsed = createTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const [record] = await db.insert(assetTransfers).values({
      ...parsed.data,
      assetId: req.params.id,
      companyId,
      transferredBy: req.session?.userId || null,
    }).returning();

    const updateFields: any = {};
    if (parsed.data.toLocation) updateFields.location = parsed.data.toLocation;
    if (parsed.data.toDepartment) updateFields.department = parsed.data.toDepartment;
    if (parsed.data.toAssignee) updateFields.assignedTo = parsed.data.toAssignee;
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await db.update(assets).set(updateFields).where(eq(assets.id, req.params.id));
    }

    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create transfer record" });
  }
});

router.delete("/api/admin/assets/:assetId/transfers/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(assetTransfers)
      .where(and(eq(assetTransfers.id, req.params.id), eq(assetTransfers.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete transfer record" });
  }
});

export const assetsRouter = router;
