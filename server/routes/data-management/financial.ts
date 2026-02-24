import { Router } from "express";
import {
  db, requireRoleOrSuperAdmin, eq, count, and, desc, asc, inArray,
  costCodes, childCostCodes, costCodeDefaults, jobCostCodes,
  tenders, tenderPackages, tenderSubmissions,
  tenderLineItems, tenderLineActivities, tenderLineFiles, tenderLineRisks,
  jobBudgets, budgetLines, budgetLineFiles,
  boqGroups, boqItems, purchaseOrders,
  apInvoices, apInboundEmails, myobExportLogs,
  jobs, suppliers,
} from "./shared";

const router = Router();

router.get("/api/admin/data-management/cost-codes", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: costCodes.id,
        code: costCodes.code,
        name: costCodes.name,
        description: costCodes.description,
        isActive: costCodes.isActive,
        createdAt: costCodes.createdAt,
      })
      .from(costCodes)
      .where(eq(costCodes.companyId, companyId))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/cost-codes/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;
    const [existing] = await db.select({ id: costCodes.id }).from(costCodes).where(and(eq(costCodes.id, id), eq(costCodes.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Cost code not found" });
    await db.delete(childCostCodes).where(eq(childCostCodes.parentCostCodeId, id));
    await db.delete(costCodeDefaults).where(eq(costCodeDefaults.costCodeId, id));
    await db.delete(jobCostCodes).where(eq(jobCostCodes.costCodeId, id));
    await db.delete(costCodes).where(and(eq(costCodes.id, id), eq(costCodes.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/child-cost-codes", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: childCostCodes.id,
        code: childCostCodes.code,
        name: childCostCodes.name,
        description: childCostCodes.description,
        isActive: childCostCodes.isActive,
        parentCode: costCodes.code,
        parentName: costCodes.name,
        createdAt: childCostCodes.createdAt,
      })
      .from(childCostCodes)
      .leftJoin(costCodes, eq(childCostCodes.parentCostCodeId, costCodes.id))
      .where(eq(childCostCodes.companyId, companyId))
      .orderBy(asc(costCodes.code), asc(childCostCodes.sortOrder), asc(childCostCodes.code))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/child-cost-codes/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;
    const [existing] = await db.select({ id: childCostCodes.id }).from(childCostCodes).where(and(eq(childCostCodes.id, id), eq(childCostCodes.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Child cost code not found" });

    const [tenderRef] = await db.select({ count: count() }).from(tenderLineItems).where(eq(tenderLineItems.childCostCodeId, id));
    if (tenderRef.count > 0) {
      return res.status(400).json({ error: `Cannot delete: this sub-code is referenced by ${tenderRef.count} tender line item(s). Remove those references first.` });
    }

    const [budgetRef] = await db.select({ count: count() }).from(budgetLines).where(eq(budgetLines.childCostCodeId, id));
    if (budgetRef.count > 0) {
      return res.status(400).json({ error: `Cannot delete: this sub-code is referenced by ${budgetRef.count} budget line(s). Remove those references first.` });
    }

    const [boqGroupRef] = await db.select({ count: count() }).from(boqGroups).where(eq(boqGroups.childCostCodeId, id));
    if (boqGroupRef.count > 0) {
      return res.status(400).json({ error: `Cannot delete: this sub-code is referenced by ${boqGroupRef.count} BOQ group(s). Remove those references first.` });
    }

    const [boqItemRef] = await db.select({ count: count() }).from(boqItems).where(eq(boqItems.childCostCodeId, id));
    if (boqItemRef.count > 0) {
      return res.status(400).json({ error: `Cannot delete: this sub-code is referenced by ${boqItemRef.count} BOQ item(s). Remove those references first.` });
    }

    const [poRef] = await db.select({ count: count() }).from(purchaseOrders).where(eq(purchaseOrders.childCostCodeId, id));
    if (poRef.count > 0) {
      return res.status(400).json({ error: `Cannot delete: this sub-code is referenced by ${poRef.count} purchase order(s). Remove those references first.` });
    }

    await db.delete(childCostCodes).where(and(eq(childCostCodes.id, id), eq(childCostCodes.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/tenders", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: tenders.id,
        tenderNumber: tenders.tenderNumber,
        title: tenders.title,
        status: tenders.status,
        jobId: tenders.jobId,
        jobName: jobs.name,
        createdAt: tenders.createdAt,
      })
      .from(tenders)
      .leftJoin(jobs, eq(tenders.jobId, jobs.id))
      .where(eq(tenders.companyId, companyId))
      .orderBy(desc(tenders.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/tenders/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;
    const [existing] = await db.select({ id: tenders.id }).from(tenders).where(and(eq(tenders.id, id), eq(tenders.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Tender not found" });
    const subs = await db.select({ id: tenderSubmissions.id }).from(tenderSubmissions).where(eq(tenderSubmissions.tenderId, id));
    const subIds = subs.map(s => s.id);
    if (subIds.length > 0) {
      const lineItems = await db.select({ id: tenderLineItems.id }).from(tenderLineItems).where(inArray(tenderLineItems.tenderSubmissionId, subIds));
      const lineItemIds = lineItems.map(li => li.id);
      if (lineItemIds.length > 0) {
        await db.delete(tenderLineRisks).where(inArray(tenderLineRisks.lineItemId, lineItemIds));
        await db.delete(tenderLineFiles).where(inArray(tenderLineFiles.lineItemId, lineItemIds));
        await db.delete(tenderLineActivities).where(inArray(tenderLineActivities.lineItemId, lineItemIds));
        await db.delete(tenderLineItems).where(inArray(tenderLineItems.tenderSubmissionId, subIds));
      }
      await db.delete(tenderSubmissions).where(eq(tenderSubmissions.tenderId, id));
    }
    await db.delete(tenderPackages).where(eq(tenderPackages.tenderId, id));
    await db.delete(tenders).where(and(eq(tenders.id, id), eq(tenders.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/budgets", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: jobBudgets.id,
        jobId: jobBudgets.jobId,
        jobName: jobs.name,
        estimatedTotalBudget: jobBudgets.estimatedTotalBudget,
        customerPrice: jobBudgets.customerPrice,
        createdAt: jobBudgets.createdAt,
      })
      .from(jobBudgets)
      .leftJoin(jobs, eq(jobBudgets.jobId, jobs.id))
      .where(eq(jobBudgets.companyId, companyId))
      .orderBy(desc(jobBudgets.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/budgets/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;
    const [existing] = await db.select({ id: jobBudgets.id }).from(jobBudgets).where(and(eq(jobBudgets.id, id), eq(jobBudgets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Budget not found" });
    const lines = await db.select({ id: budgetLines.id }).from(budgetLines).where(eq(budgetLines.budgetId, id));
    const lineIds = lines.map(l => l.id);
    if (lineIds.length > 0) {
      await db.delete(budgetLineFiles).where(inArray(budgetLineFiles.budgetLineId, lineIds));
    }
    await db.delete(budgetLines).where(eq(budgetLines.budgetId, id));
    await db.delete(jobBudgets).where(and(eq(jobBudgets.id, id), eq(jobBudgets.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/boq-groups", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: boqGroups.id,
        name: boqGroups.name,
        description: boqGroups.description,
        jobId: boqGroups.jobId,
        jobName: jobs.name,
        costCodeName: costCodes.name,
        createdAt: boqGroups.createdAt,
      })
      .from(boqGroups)
      .leftJoin(jobs, eq(boqGroups.jobId, jobs.id))
      .leftJoin(costCodes, eq(boqGroups.costCodeId, costCodes.id))
      .where(eq(boqGroups.companyId, companyId))
      .orderBy(desc(boqGroups.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/boq-groups/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;
    const [existing] = await db.select({ id: boqGroups.id }).from(boqGroups).where(and(eq(boqGroups.id, id), eq(boqGroups.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "BOQ group not found" });
    await db.delete(boqItems).where(eq(boqItems.groupId, id));
    await db.delete(boqGroups).where(and(eq(boqGroups.id, id), eq(boqGroups.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/data-management/ap-invoices", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: apInvoices.id,
        invoiceNumber: apInvoices.invoiceNumber,
        description: apInvoices.description,
        supplierName: suppliers.name,
        totalInc: apInvoices.totalInc,
        status: apInvoices.status,
        sourceEmail: apInvoices.sourceEmail,
        createdAt: apInvoices.createdAt,
      })
      .from(apInvoices)
      .leftJoin(suppliers, eq(apInvoices.supplierId, suppliers.id))
      .where(eq(apInvoices.companyId, companyId))
      .orderBy(desc(apInvoices.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/data-management/ap-invoices/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;
    const [existing] = await db.select({ id: apInvoices.id }).from(apInvoices).where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "AP invoice not found" });
    await db.delete(apInboundEmails).where(eq(apInboundEmails.invoiceId, id));
    await db.delete(myobExportLogs).where(eq(myobExportLogs.invoiceId, id));
    await db.delete(apInvoices).where(and(eq(apInvoices.id, id), eq(apInvoices.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
