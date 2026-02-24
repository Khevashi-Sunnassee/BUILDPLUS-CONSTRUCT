import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { eq, and, asc } from "drizzle-orm";
import { apApprovalRules } from "@shared/schema";
import { reassignApprovalPathsForCompany } from "../../lib/ap-approval-assign";
import { requireUUID } from "../../lib/api-utils";
import type { SharedDeps } from "./shared";

const approvalRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ruleType: z.enum(["USER_CATCH_ALL", "USER", "AUTO_APPROVE"]).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  conditions: z.any(),
  approverUserIds: z.array(z.string()),
  autoApprove: z.boolean().optional(),
});

export function registerApprovalRulesRoutes(router: Router, deps: SharedDeps): void {
  const { db } = deps;

  router.get("/api/ap-approval-rules", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const rules = await db
        .select()
        .from(apApprovalRules)
        .where(eq(apApprovalRules.companyId, companyId))
        .orderBy(asc(apApprovalRules.priority))
        .limit(1000);

      res.json(rules);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching AP approval rules");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.post("/api/ap-approval-rules", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const parsed = approvalRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const [rule] = await db
        .insert(apApprovalRules)
        .values({
          companyId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          ruleType: parsed.data.ruleType ?? "USER",
          isActive: parsed.data.isActive ?? true,
          priority: parsed.data.priority ?? 0,
          conditions: parsed.data.conditions,
          approverUserIds: parsed.data.approverUserIds,
          autoApprove: parsed.data.autoApprove ?? false,
        })
        .returning();

      reassignApprovalPathsForCompany(companyId).catch(err =>
        logger.error({ err }, "Failed to reassign approval paths after rule creation")
      );

      res.json(rule);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error creating AP approval rule");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.patch("/api/ap-approval-rules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apApprovalRules)
        .where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Approval rule not found" });

      const parsed = approvalRuleSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const updates: any = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;
      if (parsed.data.ruleType !== undefined) updates.ruleType = parsed.data.ruleType;
      if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
      if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
      if (parsed.data.conditions !== undefined) updates.conditions = parsed.data.conditions;
      if (parsed.data.approverUserIds !== undefined) updates.approverUserIds = parsed.data.approverUserIds;
      if (parsed.data.autoApprove !== undefined) updates.autoApprove = parsed.data.autoApprove;

      const [updated] = await db
        .update(apApprovalRules)
        .set(updates)
        .where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)))
        .returning();

      reassignApprovalPathsForCompany(companyId).catch(err =>
        logger.error({ err }, "Failed to reassign approval paths after rule update")
      );

      res.json(updated);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error updating AP approval rule");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.delete("/api/ap-approval-rules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });
      const id = requireUUID(req, res, "id");
      if (!id) return;

      const [existing] = await db
        .select()
        .from(apApprovalRules)
        .where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Approval rule not found" });

      await db.delete(apApprovalRules).where(and(eq(apApprovalRules.id, id), eq(apApprovalRules.companyId, companyId)));

      reassignApprovalPathsForCompany(companyId).catch(err =>
        logger.error({ err }, "Failed to reassign approval paths after rule deletion")
      );

      res.json({ success: true });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error deleting AP approval rule");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });
}
