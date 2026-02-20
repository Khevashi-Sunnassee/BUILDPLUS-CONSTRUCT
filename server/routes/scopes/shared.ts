import { z } from "zod";
import multer from "multer";
import { db } from "../../db";
import { scopes, scopeTrades, scopeItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidId(id: string): boolean { return uuidRegex.test(id); }

export const tradeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const scopeSchema = z.object({
  tradeId: z.string().min(1, "Trade is required"),
  jobTypeId: z.string().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  source: z.enum(["TEMPLATE", "AI_GENERATED", "CUSTOM", "IMPORTED"]).optional(),
  isTemplate: z.boolean().optional(),
});

export const scopeItemSchema = z.object({
  category: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  details: z.string().nullable().optional(),
  status: z.enum(["INCLUDED", "EXCLUDED", "NA"]).optional(),
  isCustom: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const DEFAULT_TRADES = [
  "Painting", "Plastering", "Waterproofing", "Tiling", "Concrete Structure",
  "Steelwork", "Electrical", "Plumbing", "HVAC", "Carpentry",
  "Demolition", "Earthworks", "Landscaping", "Glazing", "Roofing",
  "Fire Protection", "Insulation", "Flooring", "Cladding", "Scaffolding",
];

export const SCOPE_IMPORT_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const scopeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (SCOPE_IMPORT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Only Excel (.xlsx) and CSV files are accepted.`));
    }
  },
});

export async function verifyScopeOwnership(companyId: string, scopeId: string) {
  const [s] = await db.select({ id: scopes.id }).from(scopes).where(and(eq(scopes.id, scopeId), eq(scopes.companyId, companyId))).limit(1);
  return !!s;
}

export async function verifyTradeOwnership(companyId: string, tradeId: string) {
  const [t] = await db.select({ id: scopeTrades.id }).from(scopeTrades).where(and(eq(scopeTrades.id, tradeId), eq(scopeTrades.companyId, companyId))).limit(1);
  return !!t;
}
