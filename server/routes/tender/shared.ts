import { z } from "zod";
import multer from "multer";
import { db } from "../../db";
import { tenders, tenderSubmissions } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ObjectStorageService } from "../../replit_integrations/object_storage";

export const tenderUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const tenderObjectStorage = new ObjectStorageService();

export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidId(id: string): boolean { return uuidRegex.test(id); }

export const EDITABLE_STATUSES = ["DRAFT", "OPEN", "UNDER_REVIEW"];

export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["UNDER_REVIEW", "CLOSED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "OPEN", "CLOSED", "CANCELLED"],
  APPROVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: ["DRAFT"],
};

export async function verifyTenderOwnership(companyId: string, tenderId: string, dbInstance?: typeof db): Promise<boolean> {
  const q = dbInstance || db;
  const [t] = await q.select({ id: tenders.id }).from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
  return !!t;
}

export async function verifySubmissionOwnership(companyId: string, tenderId: string, submissionId: string, dbInstance?: typeof db): Promise<boolean> {
  const q = dbInstance || db;
  const [s] = await q.select({ id: tenderSubmissions.id }).from(tenderSubmissions).where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.tenderId, tenderId), eq(tenderSubmissions.companyId, companyId)));
  return !!s;
}

export async function verifyTenderEditable(companyId: string, tenderId: string, dbInstance?: typeof db): Promise<{ editable: boolean; tender: Record<string, unknown> | null }> {
  const q = dbInstance || db;
  const [t] = await q.select({ id: tenders.id, status: tenders.status }).from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
  if (!t) return { editable: false, tender: null };
  return { editable: EDITABLE_STATUSES.includes(t.status), tender: t };
}

export const tenderSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "OPEN", "UNDER_REVIEW", "APPROVED", "CLOSED", "CANCELLED"]).optional(),
  dueDate: z.string().nullable().optional(),
  openDate: z.string().nullable().optional(),
  closedDate: z.string().nullable().optional(),
  bundleId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const submissionSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  coverNote: z.string().nullable().optional(),
  status: z.enum(["SUBMITTED", "REVISED", "APPROVED", "REJECTED"]).optional(),
  subtotal: z.string().nullable().optional(),
  taxAmount: z.string().nullable().optional(),
  totalPrice: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const lineItemSchema = z.object({
  costCodeId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.string().nullable().optional(),
  lineTotal: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function getNextTenderNumber(companyId: string, tx?: typeof db): Promise<string> {
  const queryDb = tx || db;
  const result = await queryDb
    .select({ tenderNumber: tenders.tenderNumber })
    .from(tenders)
    .where(eq(tenders.companyId, companyId))
    .orderBy(desc(tenders.tenderNumber))
    .limit(1);

  if (result.length === 0) {
    return "TDR-000001";
  }

  const lastNumber = result[0].tenderNumber;
  const match = lastNumber.match(/TDR-(\d+)/);
  if (match) {
    const next = parseInt(match[1], 10) + 1;
    return `TDR-${String(next).padStart(6, "0")}`;
  }
  return "TDR-000001";
}

export const VALID_STATUSES = ["DRAFT", "OPEN", "UNDER_REVIEW", "APPROVED", "CLOSED", "CANCELLED"];

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export function calculateSearchRadius(jobTypeName: string, estimatedValue: number): { searchRadiusKm: number; projectScale: string } {
  const jobTypeNameLower = jobTypeName.toLowerCase();
  let searchRadiusKm = 40;
  let projectScale = "Medium";

  const isSmallResidential = jobTypeNameLower.includes("residential") ||
    jobTypeNameLower.includes("house") ||
    jobTypeNameLower.includes("renovation") ||
    jobTypeNameLower.includes("extension") ||
    jobTypeNameLower.includes("duplex");

  const isLargeProject = jobTypeNameLower.includes("high-rise") ||
    jobTypeNameLower.includes("highrise") ||
    jobTypeNameLower.includes("high rise") ||
    jobTypeNameLower.includes("precast") ||
    jobTypeNameLower.includes("infrastructure") ||
    jobTypeNameLower.includes("civil") ||
    jobTypeNameLower.includes("industrial") ||
    jobTypeNameLower.includes("hospital") ||
    jobTypeNameLower.includes("government");

  if (isSmallResidential || estimatedValue < 200000) {
    searchRadiusKm = 25;
    projectScale = "Small Residential (1-5 days typical)";
  } else if (isLargeProject || estimatedValue > 2000000) {
    searchRadiusKm = 80;
    projectScale = "Large / Long Duration";
  } else {
    searchRadiusKm = 45;
    projectScale = "Medium Commercial / Multi-Week";
  }

  if (estimatedValue > 5000000) {
    searchRadiusKm = 100;
    projectScale = "Major Project (state-wide search)";
  }

  return { searchRadiusKm, projectScale };
}

export const tenderEmailUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export async function verifyTenderMemberOwnership(companyId: string, memberId: string): Promise<any | null> {
  const { tenderMembers } = await import("@shared/schema");
  const [row] = await db.select({
    id: tenderMembers.id,
    tenderId: tenderMembers.tenderId,
    supplierId: tenderMembers.supplierId,
    companyId: tenderMembers.companyId,
  }).from(tenderMembers)
    .where(and(eq(tenderMembers.id, memberId), eq(tenderMembers.companyId, companyId)))
    .limit(1);
  return row || null;
}

export const tenderMemberUpdateSchema = z.object({ content: z.string().min(1) });
