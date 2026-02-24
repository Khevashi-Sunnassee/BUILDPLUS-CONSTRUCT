import { Router, Request } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { requireSuperAdmin } from "./middleware/auth.middleware";
import {
  documentTypesConfig, documentTypeStatuses, documentDisciplines, documentCategories,
  checklistTemplates,
  jobTypes, activityStages, activityTemplates, activityTemplateSubtasks, activityTemplateChecklists,
  emailTemplates,
  itemCategories, items,
  scopeTrades, scopes, scopeItems,
  costCodes, childCostCodes,
} from "@shared/schema";
import logger from "../lib/logger";

const router = Router();

const SYSTEM_DEFAULT_TABLES: Record<string, {
  table: any;
  nameField: string;
  label: string;
}> = {
  documentTypesConfig: { table: documentTypesConfig, nameField: "typeName", label: "Document Types" },
  documentDisciplines: { table: documentDisciplines, nameField: "disciplineName", label: "Document Disciplines" },
  documentCategories: { table: documentCategories, nameField: "categoryName", label: "Document Categories" },
  checklistTemplates: { table: checklistTemplates, nameField: "name", label: "Checklist Templates" },
  jobTypes: { table: jobTypes, nameField: "name", label: "Job Types" },
  activityStages: { table: activityStages, nameField: "name", label: "Activity Stages" },
  emailTemplates: { table: emailTemplates, nameField: "name", label: "Email Templates" },
  itemCategories: { table: itemCategories, nameField: "name", label: "Item Categories" },
  items: { table: items, nameField: "name", label: "Items" },
  scopeTrades: { table: scopeTrades, nameField: "name", label: "Scope Trades" },
  scopes: { table: scopes, nameField: "name", label: "Scopes of Works" },
  costCodes: { table: costCodes, nameField: "name", label: "Cost Codes (Parent)" },
  childCostCodes: { table: childCostCodes, nameField: "name", label: "Cost Codes (Child)" },
};

router.get("/api/super-admin/system-defaults/tables", requireSuperAdmin, async (_req, res) => {
  const tableList = Object.entries(SYSTEM_DEFAULT_TABLES).map(([key, config]) => ({
    key,
    label: config.label,
  }));
  res.json(tableList);
});

router.get("/api/super-admin/system-defaults/summary", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId required" });

    const summary: Record<string, { total: number; defaults: number }> = {};

    for (const [key, config] of Object.entries(SYSTEM_DEFAULT_TABLES)) {
      const [totalResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(config.table)
        .where(eq(config.table.companyId, companyId));
      const [defaultResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(config.table)
        .where(and(eq(config.table.companyId, companyId), eq(config.table.isSystemDefault, true)));

      summary[key] = {
        total: totalResult?.count || 0,
        defaults: defaultResult?.count || 0,
      };
    }

    res.json(summary);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching system defaults summary");
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

router.get("/api/super-admin/system-defaults/:tableKey", requireSuperAdmin, async (req, res) => {
  try {
    const { tableKey } = req.params;
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId required" });

    const config = SYSTEM_DEFAULT_TABLES[tableKey as string];
    if (!config) return res.status(404).json({ error: "Table not found" });

    const records = await db.select().from(config.table).where(eq(config.table.companyId, companyId)).limit(500);
    res.json(records);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching system defaults records");
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

router.patch("/api/super-admin/system-defaults/:tableKey/:id/toggle", requireSuperAdmin, async (req, res) => {
  try {
    const { tableKey, id } = req.params;
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId required" });

    const config = SYSTEM_DEFAULT_TABLES[tableKey as string];
    if (!config) return res.status(404).json({ error: "Table not found" });

    const [existing] = await db.select().from(config.table)
      .where(and(eq(config.table.id, id), eq(config.table.companyId, companyId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Record not found" });

    const newValue = !existing.isSystemDefault;
    const updateData: Record<string, unknown> = { isSystemDefault: newValue };
    const [updated] = await db.update(config.table)
      .set(updateData)
      .where(and(eq(config.table.id, id), eq(config.table.companyId, companyId)))
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error toggling system default");
    res.status(500).json({ error: "Failed to toggle default" });
  }
});

router.post("/api/super-admin/system-defaults/bulk-toggle", requireSuperAdmin, async (req, res) => {
  try {
    const { tableKey, ids, isSystemDefault, companyId } = req.body;
    if (!tableKey || !ids || !Array.isArray(ids) || !companyId) {
      return res.status(400).json({ error: "tableKey, ids array, and companyId required" });
    }

    const config = SYSTEM_DEFAULT_TABLES[tableKey as string];
    if (!config) return res.status(404).json({ error: "Table not found" });

    const bulkUpdateData: Record<string, unknown> = { isSystemDefault: !!isSystemDefault };
    for (const id of ids) {
      await db.update(config.table)
        .set(bulkUpdateData)
        .where(and(eq(config.table.id, id), eq(config.table.companyId, companyId)));
    }

    res.json({ ok: true, count: ids.length });
  } catch (error: any) {
    logger.error({ err: error }, "Error bulk toggling system defaults");
    res.status(500).json({ error: "Failed to bulk toggle defaults" });
  }
});

export async function cloneSystemDefaultsToCompany(sourceCompanyId: string, targetCompanyId: string, createdById?: string): Promise<{ clonedCounts: Record<string, number>; skippedCounts: Record<string, number> }> {
  const clonedCounts: Record<string, number> = {};
  const skippedCounts: Record<string, number> = {};
  const idMapping: Record<string, string> = {};

  return await db.transaction(async (tx) => {
    const itemCatDefaults = await tx.select().from(itemCategories)
      .where(and(eq(itemCategories.companyId, sourceCompanyId), eq(itemCategories.isSystemDefault, true)));
    clonedCounts.itemCategories = 0;
    skippedCounts.itemCategories = 0;
    for (const cat of itemCatDefaults) {
      const { id: oldId, companyId: _, createdAt: _c, updatedAt: _u, ...data } = cat;
      const [existing] = await tx.select().from(itemCategories)
        .where(and(eq(itemCategories.companyId, targetCompanyId), eq(itemCategories.name, cat.name)))
        .limit(1);
      if (existing) {
        idMapping[`itemCategory:${oldId}`] = existing.id;
        skippedCounts.itemCategories++;
      } else {
        const [newCat] = await tx.insert(itemCategories).values({
          ...data, companyId: targetCompanyId, defaultCostCodeId: null,
        }).returning();
        idMapping[`itemCategory:${oldId}`] = newCat.id;
        clonedCounts.itemCategories++;
      }
    }

    const itemDefaults = await tx.select().from(items)
      .where(and(eq(items.companyId, sourceCompanyId), eq(items.isSystemDefault, true)));
    clonedCounts.items = 0;
    skippedCounts.items = 0;
    for (const item of itemDefaults) {
      const { id: _oldId, companyId: _, createdAt: _c, updatedAt: _u, ...data } = item;
      const mappedCategoryId = item.categoryId ? (idMapping[`itemCategory:${item.categoryId}`] || null) : null;
      const result = await tx.insert(items).values({
        ...data, companyId: targetCompanyId, categoryId: mappedCategoryId, supplierId: null, constructionStageId: null,
      }).onConflictDoNothing().returning();
      if (result.length > 0) {
        clonedCounts.items++;
      } else {
        skippedCounts.items++;
      }
    }

    const docTypeDefaults = await tx.select().from(documentTypesConfig)
      .where(and(eq(documentTypesConfig.companyId, sourceCompanyId), eq(documentTypesConfig.isSystemDefault, true)));
    clonedCounts.documentTypesConfig = 0;
    skippedCounts.documentTypesConfig = 0;
    for (const dt of docTypeDefaults) {
      const { id: oldId, companyId: _, createdAt: _c, updatedAt: _u, ...data } = dt;
      const [existing] = await tx.select().from(documentTypesConfig)
        .where(and(eq(documentTypesConfig.companyId, targetCompanyId), eq(documentTypesConfig.prefix, dt.prefix)))
        .limit(1);
      if (existing) {
        idMapping[`docType:${oldId}`] = existing.id;
        skippedCounts.documentTypesConfig++;
      } else {
        const [newDt] = await tx.insert(documentTypesConfig).values({
          ...data, companyId: targetCompanyId,
        }).returning();
        idMapping[`docType:${oldId}`] = newDt.id;
        clonedCounts.documentTypesConfig++;

        const statuses = await tx.select().from(documentTypeStatuses)
          .where(eq(documentTypeStatuses.typeId, oldId));
        for (const status of statuses) {
          const { id: _sid, companyId: _sc, typeId: _tid, createdAt: _sca, updatedAt: _su, ...sData } = status;
          await tx.insert(documentTypeStatuses).values({
            ...sData, companyId: targetCompanyId, typeId: newDt.id,
          }).onConflictDoNothing();
        }
      }
    }

    const discDefaults = await tx.select().from(documentDisciplines)
      .where(and(eq(documentDisciplines.companyId, sourceCompanyId), eq(documentDisciplines.isSystemDefault, true)));
    clonedCounts.documentDisciplines = 0;
    skippedCounts.documentDisciplines = 0;
    for (const disc of discDefaults) {
      const { id: _, companyId: _c, createdAt: _ca, updatedAt: _u, ...data } = disc;
      const result = await tx.insert(documentDisciplines).values({ ...data, companyId: targetCompanyId }).onConflictDoNothing().returning();
      if (result.length > 0) { clonedCounts.documentDisciplines++; } else { skippedCounts.documentDisciplines++; }
    }

    const catDefaults = await tx.select().from(documentCategories)
      .where(and(eq(documentCategories.companyId, sourceCompanyId), eq(documentCategories.isSystemDefault, true)));
    clonedCounts.documentCategories = 0;
    skippedCounts.documentCategories = 0;
    for (const cat of catDefaults) {
      const { id: _, companyId: _c, createdAt: _ca, updatedAt: _u, ...data } = cat;
      const result = await tx.insert(documentCategories).values({ ...data, companyId: targetCompanyId }).onConflictDoNothing().returning();
      if (result.length > 0) { clonedCounts.documentCategories++; } else { skippedCounts.documentCategories++; }
    }

    const checklistDefaults = await tx.select().from(checklistTemplates)
      .where(and(eq(checklistTemplates.companyId, sourceCompanyId), eq(checklistTemplates.isSystemDefault, true)));
    clonedCounts.checklistTemplates = 0;
    skippedCounts.checklistTemplates = 0;
    for (const tpl of checklistDefaults) {
      const { id: _, companyId: _c, createdAt: _ca, updatedAt: _u, createdBy: _cb, ...data } = tpl;
      const result = await tx.insert(checklistTemplates).values({
        ...data, companyId: targetCompanyId, createdBy: createdById || null,
        entityTypeId: null, entitySubtypeId: null,
      }).onConflictDoNothing().returning();
      if (result.length > 0) { clonedCounts.checklistTemplates++; } else { skippedCounts.checklistTemplates++; }
    }

    const stageDefaults = await tx.select().from(activityStages)
      .where(and(eq(activityStages.companyId, sourceCompanyId), eq(activityStages.isSystemDefault, true)));
    clonedCounts.activityStages = 0;
    skippedCounts.activityStages = 0;
    for (const stage of stageDefaults) {
      const { id: oldId, companyId: _, createdAt: _ca, ...data } = stage;
      const [existing] = await tx.select().from(activityStages)
        .where(and(eq(activityStages.companyId, targetCompanyId), eq(activityStages.name, stage.name)))
        .limit(1);
      if (existing) {
        idMapping[`stage:${oldId}`] = existing.id;
        skippedCounts.activityStages++;
      } else {
        const [newStage] = await tx.insert(activityStages).values({ ...data, companyId: targetCompanyId }).returning();
        idMapping[`stage:${oldId}`] = newStage.id;
        clonedCounts.activityStages++;
      }
    }

    const jobTypeDefaults = await tx.select().from(jobTypes)
      .where(and(eq(jobTypes.companyId, sourceCompanyId), eq(jobTypes.isSystemDefault, true)));
    clonedCounts.jobTypes = 0;
    skippedCounts.jobTypes = 0;
    for (const jt of jobTypeDefaults) {
      const { id: oldId, companyId: _, createdAt: _ca, updatedAt: _u, ...data } = jt;
      const [existing] = await tx.select().from(jobTypes)
        .where(and(eq(jobTypes.companyId, targetCompanyId), eq(jobTypes.name, jt.name)))
        .limit(1);
      if (existing) {
        idMapping[`jobType:${oldId}`] = existing.id;
        skippedCounts.jobTypes++;
      } else {
        const [newJt] = await tx.insert(jobTypes).values({ ...data, companyId: targetCompanyId }).returning();
        idMapping[`jobType:${oldId}`] = newJt.id;
        clonedCounts.jobTypes++;

        const atList = await tx.select().from(activityTemplates)
          .where(eq(activityTemplates.jobTypeId, oldId));
        for (const at of atList) {
          const { id: atOldId, jobTypeId: _jtid, companyId: _ac, createdAt: _aca, updatedAt: _au, ...atData } = at;
          const mappedStageId = at.stageId ? (idMapping[`stage:${at.stageId}`] || at.stageId) : null;
          const [newAt] = await tx.insert(activityTemplates).values({
            ...atData, jobTypeId: newJt.id, companyId: targetCompanyId,
            stageId: mappedStageId!, consultantId: null,
          }).returning();

          const subtasks = await tx.select().from(activityTemplateSubtasks)
            .where(eq(activityTemplateSubtasks.templateId, atOldId));
          for (const st of subtasks) {
            const { id: _stid, templateId: _tid, createdAt: _stca, ...stData } = st;
            await tx.insert(activityTemplateSubtasks).values({ ...stData, templateId: newAt.id }).onConflictDoNothing();
          }

          const checklists = await tx.select().from(activityTemplateChecklists)
            .where(eq(activityTemplateChecklists.templateId, atOldId));
          for (const cl of checklists) {
            const { id: _clid, templateId: _tid, createdAt: _clca, ...clData } = cl;
            await tx.insert(activityTemplateChecklists).values({
              ...clData, templateId: newAt.id, checklistTemplateRefId: null,
            }).onConflictDoNothing();
          }
        }
      }
    }

    const emailDefaults = await tx.select().from(emailTemplates)
      .where(and(eq(emailTemplates.companyId, sourceCompanyId), eq(emailTemplates.isSystemDefault, true)));
    clonedCounts.emailTemplates = 0;
    skippedCounts.emailTemplates = 0;
    for (const et of emailDefaults) {
      const { id: _, companyId: _c, createdAt: _ca, updatedAt: _u, createdById: _cb, ...data } = et;
      const result = await tx.insert(emailTemplates).values({
        ...data, companyId: targetCompanyId, createdById: createdById || null,
      }).onConflictDoNothing().returning();
      if (result.length > 0) { clonedCounts.emailTemplates++; } else { skippedCounts.emailTemplates++; }
    }

    const tradeDefaults = await tx.select().from(scopeTrades)
      .where(and(eq(scopeTrades.companyId, sourceCompanyId), eq(scopeTrades.isSystemDefault, true)));
    clonedCounts.scopeTrades = 0;
    skippedCounts.scopeTrades = 0;
    for (const trade of tradeDefaults) {
      const { id: oldId, companyId: _, createdAt: _ca, updatedAt: _u, ...data } = trade;
      const [existing] = await tx.select().from(scopeTrades)
        .where(and(eq(scopeTrades.companyId, targetCompanyId), eq(scopeTrades.name, trade.name)))
        .limit(1);
      if (existing) {
        idMapping[`trade:${oldId}`] = existing.id;
        skippedCounts.scopeTrades++;
      } else {
        const [newTrade] = await tx.insert(scopeTrades).values({
          ...data, companyId: targetCompanyId, costCodeId: null,
        }).returning();
        idMapping[`trade:${oldId}`] = newTrade.id;
        clonedCounts.scopeTrades++;
      }
    }

    const scopeDefaults = await tx.select().from(scopes)
      .where(and(eq(scopes.companyId, sourceCompanyId), eq(scopes.isSystemDefault, true)));
    clonedCounts.scopes = 0;
    skippedCounts.scopes = 0;
    for (const scope of scopeDefaults) {
      const { id: oldId, companyId: _, createdAt: _ca, updatedAt: _u, createdById: _cb, updatedById: _ub, ...data } = scope;
      const mappedTradeId = idMapping[`trade:${scope.tradeId}`] || scope.tradeId;
      const mappedJobTypeId = scope.jobTypeId ? (idMapping[`jobType:${scope.jobTypeId}`] || null) : null;
      const result = await tx.insert(scopes).values({
        ...data, companyId: targetCompanyId, tradeId: mappedTradeId,
        jobTypeId: mappedJobTypeId, createdById: createdById || scope.createdById,
        updatedById: null,
      }).onConflictDoNothing().returning();
      if (result.length > 0) {
        const newScope = result[0];
        clonedCounts.scopes++;

        const sItems = await tx.select().from(scopeItems)
          .where(eq(scopeItems.scopeId, oldId));
        for (const si of sItems) {
          const { id: _siid, scopeId: _sid, companyId: _sic, createdAt: _sica, updatedAt: _siu, ...siData } = si;
          await tx.insert(scopeItems).values({
            ...siData, scopeId: newScope.id, companyId: targetCompanyId,
          }).onConflictDoNothing();
        }
      } else {
        skippedCounts.scopes++;
      }
    }

    const costCodeDefaults = await tx.select().from(costCodes)
      .where(and(eq(costCodes.companyId, sourceCompanyId), eq(costCodes.isSystemDefault, true)));
    clonedCounts.costCodes = 0;
    skippedCounts.costCodes = 0;
    for (const cc of costCodeDefaults) {
      const { id: oldId, companyId: _, createdAt: _ca, updatedAt: _u, ...data } = cc;
      const [existing] = await tx.select().from(costCodes)
        .where(and(eq(costCodes.companyId, targetCompanyId), eq(costCodes.code, cc.code)))
        .limit(1);
      if (existing) {
        idMapping[`costCode:${oldId}`] = existing.id;
        skippedCounts.costCodes++;
      } else {
        const [newCc] = await tx.insert(costCodes).values({
          ...data, companyId: targetCompanyId, parentId: null,
        }).returning();
        idMapping[`costCode:${oldId}`] = newCc.id;
        clonedCounts.costCodes++;
      }
    }
    for (const cc of costCodeDefaults) {
      if (cc.parentId && idMapping[`costCode:${cc.parentId}`]) {
        const newId = idMapping[`costCode:${cc.id}`];
        const mappedParentId = idMapping[`costCode:${cc.parentId}`];
        if (newId && mappedParentId) {
          await tx.update(costCodes).set({ parentId: mappedParentId })
            .where(eq(costCodes.id, newId));
        }
      }
    }

    clonedCounts.childCostCodes = 0;
    skippedCounts.childCostCodes = 0;
    for (const cc of costCodeDefaults) {
      const oldId = cc.id;
      const mappedParentId = idMapping[`costCode:${oldId}`];
      if (!mappedParentId) continue;

      const children = await tx.select().from(childCostCodes)
        .where(and(eq(childCostCodes.parentCostCodeId, oldId), eq(childCostCodes.isSystemDefault, true)));
      for (const child of children) {
        const { id: _cid, companyId: _cc, parentCostCodeId: _pcid, createdAt: _cca, updatedAt: _cu, ...cData } = child;
        const [existingChild] = await tx.select().from(childCostCodes)
          .where(and(eq(childCostCodes.companyId, targetCompanyId), eq(childCostCodes.code, child.code)))
          .limit(1);
        if (existingChild) {
          skippedCounts.childCostCodes++;
        } else {
          await tx.insert(childCostCodes).values({
            ...cData, companyId: targetCompanyId, parentCostCodeId: mappedParentId,
          });
          clonedCounts.childCostCodes++;
        }
      }
    }

    logger.info({ sourceCompanyId, targetCompanyId, clonedCounts, skippedCounts }, "System defaults cloned");
    return { clonedCounts, skippedCounts };
  });
}

router.post("/api/super-admin/system-defaults/clone-to-company", requireSuperAdmin, async (req: Request, res) => {
  try {
    const { sourceCompanyId, targetCompanyId } = req.body;
    if (!sourceCompanyId || !targetCompanyId) {
      return res.status(400).json({ error: "sourceCompanyId and targetCompanyId required" });
    }
    if (sourceCompanyId === targetCompanyId) {
      return res.status(400).json({ error: "Source and target company must be different" });
    }

    const userId = (req as any).session?.userId;
    const result = await cloneSystemDefaultsToCompany(sourceCompanyId, targetCompanyId, userId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    logger.error({ err: error }, "Error in clone-to-company");
    res.status(500).json({ error: "Failed to clone system defaults" });
  }
});

export { router as systemDefaultsRouter };
