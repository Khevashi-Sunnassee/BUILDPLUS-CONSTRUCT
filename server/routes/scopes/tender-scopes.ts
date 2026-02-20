import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopes, scopeTrades, tenderScopes, tenders } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { isValidId, verifyScopeOwnership } from "./shared";

const router = Router();

router.get("/api/tenders/:tenderId/scopes", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.tenderId as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format" });

    const results = await db
      .select({
        tenderScope: tenderScopes,
        scope: scopes,
        trade: {
          id: scopeTrades.id,
          name: scopeTrades.name,
          costCodeId: scopeTrades.costCodeId,
        },
      })
      .from(tenderScopes)
      .innerJoin(scopes, eq(tenderScopes.scopeId, scopes.id))
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .where(and(eq(tenderScopes.tenderId, tenderId), eq(tenderScopes.companyId, companyId)))
      .orderBy(asc(tenderScopes.sortOrder))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.tenderScope,
      scope: { ...row.scope, trade: row.trade },
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender scopes");
    res.status(500).json({ message: "Failed to fetch tender scopes" });
  }
});

router.post("/api/tenders/:tenderId/scopes", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.tenderId as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format" });

    const linkSchema = z.object({
      scopeId: z.string().min(1, "Scope ID is required"),
      sortOrder: z.number().int().optional(),
    });
    const data = linkSchema.parse(req.body);

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)))
      .limit(1);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    if (!(await verifyScopeOwnership(companyId, data.scopeId))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const [result] = await db
      .insert(tenderScopes)
      .values({
        companyId,
        tenderId,
        scopeId: data.scopeId,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    if ((error as any)?.code === "23505") {
      return res.status(409).json({ message: "Scope is already linked to this tender" });
    }
    logger.error({ err: error }, "Error linking scope to tender");
    res.status(500).json({ message: "Failed to link scope to tender" });
  }
});

router.delete("/api/tenders/:tenderId/scopes/:scopeId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.tenderId as string;
    const scopeId = req.params.scopeId as string;
    if (!isValidId(tenderId) || !isValidId(scopeId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const [deleted] = await db
      .delete(tenderScopes)
      .where(and(
        eq(tenderScopes.tenderId, tenderId),
        eq(tenderScopes.scopeId, scopeId),
        eq(tenderScopes.companyId, companyId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Tender-scope link not found" });
    res.json({ message: "Scope unlinked from tender", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error unlinking scope from tender");
    res.status(500).json({ message: "Failed to unlink scope from tender" });
  }
});

export default router;
