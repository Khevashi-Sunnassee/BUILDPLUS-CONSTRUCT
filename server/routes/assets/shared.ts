import { z } from "zod";
import OpenAI from "openai";
import logger from "../../lib/logger";
import { db } from "../../db";
import { assets, ASSET_CATEGORIES } from "@shared/schema";
import { and, eq, desc, ilike } from "drizzle-orm";
import multer from "multer";

export { db, logger };
export { assets, ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CONDITIONS, ASSET_FUNDING_METHODS } from "@shared/schema";
export { eq, and, sql, desc, ilike, or } from "drizzle-orm";
export { requireAuth, requireRole } from "../middleware/auth.middleware";
export type { Request, Response } from "express";

export const createAssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
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
  supplierId: z.string().optional().nullable(),
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

export const createMaintenanceSchema = z.object({
  maintenanceType: z.string().min(1, "Maintenance type is required"),
  maintenanceDate: z.string().min(1, "Date is required"),
  cost: z.any().optional().nullable(),
  serviceProvider: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const createTransferSchema = z.object({
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
export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export async function generateAssetTag(companyId: string): Promise<string> {
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

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function parseExcelDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "number" && value > 1 && value < 200000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + value);
    return epoch.toISOString().split("T")[0];
  }
  const str = String(value).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(dateObj.getTime())) return dateObj.toISOString().split("T")[0];
  }
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toISOString().split("T")[0];
  }
  return null;
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[,$\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function mapCategoryFromSpreadsheet(desc: string | null): string {
  if (!desc) return "Other";
  const lower = desc.toLowerCase().trim();
  if (lower === "tools" || lower === "power tools" || lower === "hand tools") return "Hand Tools & Power Tools";
  if (lower === "machinery" || lower === "plant" || lower === "plant & machinery" || lower === "plant and machinery") return "General Machinery";
  if (lower === "computer equipment" || lower === "computers" || lower === "it" || lower === "it equipment") return "IT Equipment";
  if (lower === "buildings" || lower === "building" || lower === "structure" || lower === "structures") return "Infrastructure";
  if (lower === "yard equipment" || lower === "workshop" || lower === "workshop equipment") return "Workshop Equipment";
  if (lower === "vehicle" || lower === "vehicles" || lower === "motor vehicle" || lower === "motor vehicles" || lower === "truck" || lower === "trucks" || lower === "car" || lower === "cars" || lower === "ute" || lower === "utes") return "Vehicles & Fleet";
  if (lower === "furniture" || lower === "office furniture" || lower === "fittings" || lower === "furniture & fittings") return "Furniture";
  if (lower === "crane" || lower === "cranes" || lower === "forklift" || lower === "forklifts" || lower === "excavator" || lower === "loader" || lower === "bulldozer" || lower === "dozer" || lower === "bobcat" || lower === "backhoe") return "Heavy Equipment";
  if (lower === "scaffolding" || lower === "scaffold" || lower === "access equipment" || lower === "ladders" || lower === "ewp" || lower === "boom lift" || lower === "scissor lift") return "Scaffolding & Access";
  if (lower === "safety" || lower === "safety equipment" || lower === "ppe") return "Safety Equipment";
  if (lower === "generator" || lower === "generators" || lower === "power" || lower === "genset") return "Generators & Power Systems";
  if (lower === "trailer" || lower === "trailers") return "Vehicles & Fleet";
  if (lower === "office equipment" || lower === "office") return "IT Equipment";
  if (lower === "survey" || lower === "survey equipment" || lower === "surveying") return "Survey & Measurement";
  if (lower === "welding" || lower === "welder" || lower === "welders" || lower === "welding equipment") return "Welding Equipment";
  if (lower === "concrete" || lower === "concrete equipment") return "Concrete & Pumping";
  if (lower === "electrical" || lower === "electrical equipment") return "Electrical Equipment";
  if (lower === "plumbing" || lower === "plumbing equipment") return "Plumbing Equipment";
  if (lower === "communication" || lower === "communications" || lower === "radio" || lower === "radios") return "Communication Equipment";
  if (lower === "testing" || lower === "testing equipment" || lower === "test equipment") return "Testing & Calibration";
  if (lower.includes("magnet") || lower.includes("formwork") || lower.includes("klipform") || lower.includes("mold") || lower.includes("mould")) return "Molds";
  if (lower.includes("scaffold")) return "Scaffolding & Access";
  if (lower.includes("vehicle") || lower.includes("truck") || lower.includes("ute")) return "Vehicles & Fleet";
  if (lower.includes("crane") || lower.includes("excavat") || lower.includes("dozer") || lower.includes("loader")) return "Heavy Equipment";
  if (lower.includes("generator") || lower.includes("genset")) return "Generators & Power Systems";
  if (lower.includes("computer") || lower.includes("laptop") || lower.includes("printer")) return "IT Equipment";
  if (lower.includes("weld")) return "Welding Equipment";
  const match = ASSET_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (match) return match;
  return "Other";
}

export async function aiCategorizeBatch(items: { index: number; name: string; description?: string }[]): Promise<Record<number, string>> {
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
          if (ASSET_CATEGORIES.includes(cat as typeof ASSET_CATEGORIES[number])) {
            results[idx] = cat;
          }
        }
      } catch {
        logger.warn({ content: cleaned }, "Failed to parse AI categorization response");
      }
    }

    return results;
  } catch (error: unknown) {
    logger.warn({ err: error }, "AI categorization failed, falling back to manual mapping");
    return {};
  }
}

export const TEMPLATE_COLUMNS = [
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

export const HEADER_TO_KEY: Record<string, string> = {};
TEMPLATE_COLUMNS.forEach(c => { HEADER_TO_KEY[c.header.toLowerCase().trim()] = c.key; });

export const SPREADSHEET_ALIASES: Record<string, string> = {
  "item": "_skip",
  "no": "_skip",
  "no.": "_skip",
  "#": "_skip",
  "asset name": "name",
  "asset description": "name",
  "asset no.": "registrationNumber",
  "asset no": "registrationNumber",
  "asset number": "registrationNumber",
  "reg no": "registrationNumber",
  "reg no.": "registrationNumber",
  "registration no": "registrationNumber",
  "registration no.": "registrationNumber",
  "acquisition date": "purchaseDate",
  "date acquired": "purchaseDate",
  "date of acquisition": "purchaseDate",
  "date of purchase": "purchaseDate",
  "date purchased": "purchaseDate",
  "purchase date": "purchaseDate",
  "acquired date": "purchaseDate",
  "acquisition cost": "purchasePrice",
  "cost": "purchasePrice",
  "cost price": "purchasePrice",
  "purchase cost": "purchasePrice",
  "original cost": "purchasePrice",
  "price": "purchasePrice",
  "useful life": "usefulLifeYears",
  "useful life (years)": "usefulLifeYears",
  "useful life (yrs)": "usefulLifeYears",
  "useful life yrs": "usefulLifeYears",
  "expected life": "usefulLifeYears",
  "life (years)": "usefulLifeYears",
  "salvage value": "_skip",
  "acc depreciation": "accumulatedDepreciation",
  "accumulated depreciation": "accumulatedDepreciation",
  "accum depreciation": "accumulatedDepreciation",
  "total depreciation": "accumulatedDepreciation",
  "depreciation this period (initial)": "depreciationThisPeriod",
  "depreciation this period": "depreciationThisPeriod",
  "period depreciation": "depreciationThisPeriod",
  "no of years depreciation": "yearsDepreciated",
  "no. of years depreciation": "yearsDepreciated",
  "years depreciated": "yearsDepreciated",
  "serial no.": "serialNumber",
  "serial no": "serialNumber",
  "serial": "serialNumber",
  "s/n": "serialNumber",
  "type": "category",
  "asset type": "category",
  "asset category": "category",
  "class": "category",
  "asset class": "category",
  "quantity": "quantity",
  "qty": "quantity",
  "book value": "bookValue",
  "net book value": "bookValue",
  "nbv": "bookValue",
  "written down value": "bookValue",
  "wdv": "bookValue",
  "current value": "currentValue",
  "market value": "currentValue",
  "remarks": "remarks",
  "notes": "remarks",
  "comment": "remarks",
  "comments": "remarks",
  "supplier": "supplier",
  "vendor": "supplier",
  "make": "manufacturer",
  "brand": "manufacturer",
  "dept": "department",
  "site": "location",
  "assigned": "assignedTo",
  "user": "assignedTo",
  "operator": "assignedTo",
  "depreciation rate": "depreciationRate",
  "dep rate": "depreciationRate",
  "dep rate (%)": "depreciationRate",
  "depreciation method": "depreciationMethod",
  "dep method": "depreciationMethod",
};
