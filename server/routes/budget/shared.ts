import { z } from "zod";
import multer from "multer";
import { db } from "../../db";
import { budgetLines, budgetLineDetailItems } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const budgetEmailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const budgetSchema = z.object({
  estimatedTotalBudget: z.string().nullable().optional(),
  profitTargetPercent: z.string().nullable().optional(),
  customerPrice: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const budgetLineSchema = z.object({
  costCodeId: z.string().min(1, "Cost code is required"),
  childCostCodeId: z.string().nullable().optional(),
  estimatedBudget: z.string().nullable().optional(),
  selectedTenderSubmissionId: z.string().nullable().optional(),
  selectedContractorId: z.string().nullable().optional(),
  variationsAmount: z.string().nullable().optional(),
  forecastCost: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const detailItemSchema = z.object({
  item: z.string().min(1, "Item description is required"),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export async function recalcLockedBudget(budgetLineId: string, companyId: string) {
  const [line] = await db.select().from(budgetLines).where(and(
    eq(budgetLines.id, budgetLineId),
    eq(budgetLines.companyId, companyId),
  ));
  if (!line || !line.estimateLocked) return;

  const [sumResult] = await db
    .select({ total: sql<string>`coalesce(sum(${budgetLineDetailItems.lineTotal}), '0')` })
    .from(budgetLineDetailItems)
    .where(eq(budgetLineDetailItems.budgetLineId, budgetLineId));

  await db.update(budgetLines)
    .set({ estimatedBudget: sumResult.total, updatedAt: new Date() })
    .where(eq(budgetLines.id, budgetLineId));
}
