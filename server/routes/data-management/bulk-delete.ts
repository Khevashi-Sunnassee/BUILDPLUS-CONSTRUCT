import { Router } from "express";
import {
  db, requireRoleOrSuperAdmin, eq, count, and, sql, inArray, notInArray,
  items, itemCategories, assets, progressClaims, progressClaimItems,
  broadcastTemplates, broadcastMessages, documents, documentBundleItems,
  contracts, deliveryRecords, loadLists, loadListPanels,
  assetMaintenanceRecords, assetTransfers, purchaseOrderItems, purchaseOrders,
  jobs, suppliers, customers, employees, documentBundles,
  checklistInstances, activityTemplates, activityTemplateSubtasks,
  jobActivities, jobActivityAssignees, jobActivityUpdates, jobActivityFiles,
  activityStages, activityConsultants, hireBookings, tasks,
  childCostCodes, tenderLineItems, budgetLines, boqGroups, boqItems,
  apInvoices, apInboundEmails, myobExportLogs,
} from "./shared";

const router = Router();

async function getProtectedSupplierIds(companyId: string): Promise<string[]> {
  const poSuppliers = await db.selectDistinct({ id: purchaseOrders.supplierId }).from(purchaseOrders).where(and(eq(purchaseOrders.companyId, companyId), sql`${purchaseOrders.supplierId} IS NOT NULL`));
  const itemSuppliers = await db.selectDistinct({ id: items.supplierId }).from(items).where(and(eq(items.companyId, companyId), sql`${items.supplierId} IS NOT NULL`));
  const docSuppliers = await db.selectDistinct({ id: documents.supplierId }).from(documents).where(and(eq(documents.companyId, companyId), sql`${documents.supplierId} IS NOT NULL`));
  const bundleSuppliers = await db.selectDistinct({ id: documentBundles.supplierId }).from(documentBundles).where(and(eq(documentBundles.companyId, companyId), sql`${documentBundles.supplierId} IS NOT NULL`));
  const assetSuppliers = await db.selectDistinct({ id: assets.supplierId }).from(assets).where(and(eq(assets.companyId, companyId), sql`${assets.supplierId} IS NOT NULL`));
  const checklistSuppliers = await db.selectDistinct({ id: checklistInstances.supplierId }).from(checklistInstances).where(and(eq(checklistInstances.companyId, companyId), sql`${checklistInstances.supplierId} IS NOT NULL`));
  const hireSuppliers = await db.selectDistinct({ id: hireBookings.supplierId }).from(hireBookings).where(and(eq(hireBookings.companyId, companyId), sql`${hireBookings.supplierId} IS NOT NULL`));
  const ids = new Set<string>();
  for (const row of [...poSuppliers, ...itemSuppliers, ...docSuppliers, ...bundleSuppliers, ...assetSuppliers, ...checklistSuppliers, ...hireSuppliers]) {
    if (row.id) ids.add(row.id);
  }
  return Array.from(ids);
}

async function getProtectedCustomerIds(companyId: string): Promise<string[]> {
  const jobCustomers = await db.selectDistinct({ id: jobs.customerId }).from(jobs).where(and(eq(jobs.companyId, companyId), sql`${jobs.customerId} IS NOT NULL`));
  return jobCustomers.filter(r => r.id).map(r => r.id!);
}

async function getProtectedItemIds(companyId: string): Promise<string[]> {
  const poItems = await db.selectDistinct({ id: purchaseOrderItems.itemId }).from(purchaseOrderItems).innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id)).where(and(eq(purchaseOrders.companyId, companyId), sql`${purchaseOrderItems.itemId} IS NOT NULL`));
  return poItems.filter(r => r.id).map(r => r.id!);
}

async function getProtectedItemCategoryIds(companyId: string): Promise<string[]> {
  const catItems = await db.selectDistinct({ id: items.categoryId }).from(items).where(and(eq(items.companyId, companyId), sql`${items.categoryId} IS NOT NULL`));
  return catItems.filter(r => r.id).map(r => r.id!);
}

async function getProtectedBroadcastTemplateIds(companyId: string): Promise<string[]> {
  const tmplMessages = await db.selectDistinct({ id: broadcastMessages.templateId }).from(broadcastMessages).innerJoin(broadcastTemplates, eq(broadcastMessages.templateId, broadcastTemplates.id)).where(and(eq(broadcastTemplates.companyId, companyId), sql`${broadcastMessages.templateId} IS NOT NULL`));
  return tmplMessages.filter(r => r.id).map(r => r.id!);
}

async function getProtectedAssetIds(companyId: string): Promise<string[]> {
  const hireAssets = await db.selectDistinct({ id: hireBookings.assetId }).from(hireBookings).where(and(eq(hireBookings.companyId, companyId), sql`${hireBookings.assetId} IS NOT NULL`));
  return hireAssets.filter(r => r.id).map(r => r.id!);
}

async function getProtectedEmployeeIds(companyId: string): Promise<string[]> {
  const hireRequested = await db.selectDistinct({ id: hireBookings.requestedByUserId }).from(hireBookings).where(eq(hireBookings.companyId, companyId));
  const hireResponsible = await db.selectDistinct({ id: hireBookings.responsiblePersonUserId }).from(hireBookings).where(eq(hireBookings.companyId, companyId));
  const hireSiteContact = await db.selectDistinct({ id: hireBookings.siteContactUserId }).from(hireBookings).where(and(eq(hireBookings.companyId, companyId), sql`${hireBookings.siteContactUserId} IS NOT NULL`));
  const ids = new Set<string>();
  for (const row of [...hireRequested, ...hireResponsible, ...hireSiteContact]) {
    if (row.id) ids.add(row.id);
  }
  return Array.from(ids);
}

async function getProtectedDocumentIds(companyId: string): Promise<string[]> {
  const childDocs = await db.selectDistinct({ id: documents.parentDocumentId }).from(documents).where(and(eq(documents.companyId, companyId), sql`${documents.parentDocumentId} IS NOT NULL`));
  const contractDocs = await db.selectDistinct({ id: contracts.aiSourceDocumentId }).from(contracts).where(and(eq(contracts.companyId, companyId), sql`${contracts.aiSourceDocumentId} IS NOT NULL`));
  const ids = new Set<string>();
  for (const row of [...childDocs, ...contractDocs]) {
    if (row.id) ids.add(row.id);
  }
  return Array.from(ids);
}

async function getProtectedLoadListIds(companyId: string): Promise<string[]> {
  const llWithDeliveries = await db.selectDistinct({ id: deliveryRecords.loadListId }).from(deliveryRecords).innerJoin(loadLists, eq(deliveryRecords.loadListId, loadLists.id)).innerJoin(jobs, eq(loadLists.jobId, jobs.id)).where(eq(jobs.companyId, companyId));
  return llWithDeliveries.map(r => r.id);
}

router.delete("/api/admin/data-management/:entityType/bulk-delete", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const entityType = String(req.params.entityType);

    let totalCount = 0;
    let deletedCount = 0;
    let protectedCount = 0;
    let protectedReason = "";

    switch (entityType) {
      case "suppliers": {
        const [total] = await db.select({ count: count() }).from(suppliers).where(eq(suppliers.companyId, companyId));
        totalCount = total.count;
        const protectedIds = await getProtectedSupplierIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "linked to purchase orders, items, documents, or assets";
        if (protectedIds.length > 0 && protectedIds.length < totalCount) {
          await db.delete(suppliers).where(and(eq(suppliers.companyId, companyId), notInArray(suppliers.id, protectedIds)));
        } else if (protectedIds.length === 0) {
          await db.delete(suppliers).where(eq(suppliers.companyId, companyId));
        }
        deletedCount = totalCount - protectedCount;
        break;
      }
      case "customers": {
        const [total] = await db.select({ count: count() }).from(customers).where(eq(customers.companyId, companyId));
        totalCount = total.count;
        const protectedIds = await getProtectedCustomerIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "linked to jobs";
        if (protectedIds.length > 0 && protectedIds.length < totalCount) {
          await db.delete(customers).where(and(eq(customers.companyId, companyId), notInArray(customers.id, protectedIds)));
        } else if (protectedIds.length === 0) {
          await db.delete(customers).where(eq(customers.companyId, companyId));
        }
        deletedCount = totalCount - protectedCount;
        break;
      }
      case "employees": {
        const [total] = await db.select({ count: count() }).from(employees).where(eq(employees.companyId, companyId));
        totalCount = total.count;
        const protectedEmpIds = await getProtectedEmployeeIds(companyId);
        protectedCount = protectedEmpIds.length;
        protectedReason = "linked to hire bookings";
        const allEmps = await db.select({ id: employees.id }).from(employees).where(eq(employees.companyId, companyId));
        const safeEmpIds = allEmps.filter(e => !protectedEmpIds.includes(e.id)).map(e => e.id);
        if (safeEmpIds.length > 0) {
          await db.delete(employees).where(and(eq(employees.companyId, companyId), inArray(employees.id, safeEmpIds)));
        }
        deletedCount = safeEmpIds.length;
        break;
      }
      case "items": {
        const [total] = await db.select({ count: count() }).from(items).where(eq(items.companyId, companyId));
        totalCount = total.count;
        const protectedIds = await getProtectedItemIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "linked to purchase order line items";
        if (protectedIds.length > 0 && protectedIds.length < totalCount) {
          await db.delete(items).where(and(eq(items.companyId, companyId), notInArray(items.id, protectedIds)));
        } else if (protectedIds.length === 0) {
          await db.delete(items).where(eq(items.companyId, companyId));
        }
        deletedCount = totalCount - protectedCount;
        break;
      }
      case "item-categories": {
        const [total] = await db.select({ count: count() }).from(itemCategories).where(eq(itemCategories.companyId, companyId));
        totalCount = total.count;
        const protectedIds = await getProtectedItemCategoryIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "contain items that must be moved or deleted first";
        if (protectedIds.length > 0 && protectedIds.length < totalCount) {
          await db.delete(itemCategories).where(and(eq(itemCategories.companyId, companyId), notInArray(itemCategories.id, protectedIds)));
        } else if (protectedIds.length === 0) {
          await db.delete(itemCategories).where(eq(itemCategories.companyId, companyId));
        }
        deletedCount = totalCount - protectedCount;
        break;
      }
      case "assets": {
        const [total] = await db.select({ count: count() }).from(assets).where(eq(assets.companyId, companyId));
        totalCount = total.count;
        const protectedAssetIds = await getProtectedAssetIds(companyId);
        protectedCount = protectedAssetIds.length;
        protectedReason = "linked to hire bookings";
        const allAssets = await db.select({ id: assets.id }).from(assets).where(eq(assets.companyId, companyId));
        const safeAssetIds = allAssets.filter(a => !protectedAssetIds.includes(a.id)).map(a => a.id);
        if (safeAssetIds.length > 0) {
          await db.delete(assetMaintenanceRecords).where(inArray(assetMaintenanceRecords.assetId, safeAssetIds));
          await db.delete(assetTransfers).where(inArray(assetTransfers.assetId, safeAssetIds));
          await db.delete(assets).where(inArray(assets.id, safeAssetIds));
        }
        deletedCount = safeAssetIds.length;
        break;
      }
      case "progress-claims": {
        const [total] = await db.select({ count: count() }).from(progressClaims).where(eq(progressClaims.companyId, companyId));
        totalCount = total.count;
        protectedCount = 0;
        const allClaims = await db.select({ id: progressClaims.id }).from(progressClaims).where(eq(progressClaims.companyId, companyId));
        for (const claim of allClaims) {
          await db.delete(progressClaimItems).where(eq(progressClaimItems.progressClaimId, claim.id));
        }
        await db.delete(progressClaims).where(eq(progressClaims.companyId, companyId));
        deletedCount = totalCount;
        break;
      }
      case "broadcast-templates": {
        const [total] = await db.select({ count: count() }).from(broadcastTemplates).where(eq(broadcastTemplates.companyId, companyId));
        totalCount = total.count;
        const protectedIds = await getProtectedBroadcastTemplateIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "have broadcast messages that reference them";
        if (protectedIds.length > 0 && protectedIds.length < totalCount) {
          await db.delete(broadcastTemplates).where(and(eq(broadcastTemplates.companyId, companyId), notInArray(broadcastTemplates.id, protectedIds)));
        } else if (protectedIds.length === 0) {
          await db.delete(broadcastTemplates).where(eq(broadcastTemplates.companyId, companyId));
        }
        deletedCount = totalCount - protectedCount;
        break;
      }
      case "documents": {
        const [total] = await db.select({ count: count() }).from(documents).where(eq(documents.companyId, companyId));
        totalCount = total.count;
        const protectedIds = await getProtectedDocumentIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "referenced by child documents or contracts";
        const allDocs = await db.select({ id: documents.id }).from(documents).where(eq(documents.companyId, companyId));
        const safeDocIds = allDocs.filter(d => !protectedIds.includes(d.id)).map(d => d.id);
        if (safeDocIds.length > 0) {
          await db.delete(documentBundleItems).where(inArray(documentBundleItems.documentId, safeDocIds));
          await db.delete(documents).where(inArray(documents.id, safeDocIds));
        }
        deletedCount = safeDocIds.length;
        break;
      }
      case "contracts": {
        const [total] = await db.select({ count: count() }).from(contracts).where(eq(contracts.companyId, companyId));
        totalCount = total.count;
        protectedCount = 0;
        await db.delete(contracts).where(eq(contracts.companyId, companyId));
        deletedCount = totalCount;
        break;
      }
      case "deliveries": {
        const allDeliveries = await db
          .select({ id: deliveryRecords.id })
          .from(deliveryRecords)
          .innerJoin(loadLists, eq(deliveryRecords.loadListId, loadLists.id))
          .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
          .where(eq(jobs.companyId, companyId));
        totalCount = allDeliveries.length;
        protectedCount = 0;
        if (allDeliveries.length > 0) {
          await db.delete(deliveryRecords).where(inArray(deliveryRecords.id, allDeliveries.map(d => d.id)));
        }
        deletedCount = totalCount;
        break;
      }
      case "load-lists": {
        const allLLs = await db
          .select({ id: loadLists.id })
          .from(loadLists)
          .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
          .where(eq(jobs.companyId, companyId));
        totalCount = allLLs.length;
        const protectedIds = await getProtectedLoadListIds(companyId);
        protectedCount = protectedIds.length;
        protectedReason = "have delivery records that must be deleted first";
        const safeLLIds = allLLs.filter(ll => !protectedIds.includes(ll.id)).map(ll => ll.id);
        if (safeLLIds.length > 0) {
          await db.delete(loadListPanels).where(inArray(loadListPanels.loadListId, safeLLIds));
          await db.delete(loadLists).where(inArray(loadLists.id, safeLLIds));
        }
        deletedCount = safeLLIds.length;
        break;
      }
      case "activity-templates": {
        const [total] = await db.select({ count: count() }).from(activityTemplates).where(eq(activityTemplates.companyId, companyId));
        totalCount = total.count;
        protectedCount = 0;
        const allTemplates = await db.select({ id: activityTemplates.id }).from(activityTemplates).where(eq(activityTemplates.companyId, companyId));
        if (allTemplates.length > 0) {
          await db.delete(activityTemplateSubtasks).where(inArray(activityTemplateSubtasks.templateId, allTemplates.map(t => t.id)));
          await db.delete(activityTemplates).where(eq(activityTemplates.companyId, companyId));
        }
        deletedCount = totalCount;
        break;
      }
      case "job-activities": {
        const [total] = await db.select({ count: count() }).from(jobActivities).where(eq(jobActivities.companyId, companyId));
        totalCount = total.count;
        protectedCount = 0;
        const allActivities = await db.select({ id: jobActivities.id }).from(jobActivities).where(eq(jobActivities.companyId, companyId));
        if (allActivities.length > 0) {
          const activityIds = allActivities.map(a => a.id);
          await db.update(tasks).set({ jobActivityId: null }).where(inArray(tasks.jobActivityId, activityIds));
          await db.delete(jobActivityFiles).where(inArray(jobActivityFiles.activityId, activityIds));
          await db.delete(jobActivityUpdates).where(inArray(jobActivityUpdates.activityId, activityIds));
          await db.delete(jobActivityAssignees).where(inArray(jobActivityAssignees.activityId, activityIds));
          await db.delete(jobActivities).where(eq(jobActivities.companyId, companyId));
        }
        deletedCount = totalCount;
        break;
      }
      case "activity-stages": {
        const [total] = await db.select({ count: count() }).from(activityStages).where(eq(activityStages.companyId, companyId));
        totalCount = total.count;
        const protectedStageIds: string[] = [];
        const allStages = await db.select({ id: activityStages.id }).from(activityStages).where(eq(activityStages.companyId, companyId));
        for (const stage of allStages) {
          const [tCount] = await db.select({ count: count() }).from(activityTemplates).where(eq(activityTemplates.stageId, stage.id));
          const [aCount] = await db.select({ count: count() }).from(jobActivities).where(eq(jobActivities.stageId, stage.id));
          if (tCount.count > 0 || aCount.count > 0) {
            protectedStageIds.push(stage.id);
          }
        }
        protectedCount = protectedStageIds.length;
        protectedReason = "used by activity templates or job activities";
        const safeIds = allStages.filter(s => !protectedStageIds.includes(s.id)).map(s => s.id);
        if (safeIds.length > 0) {
          await db.delete(activityStages).where(inArray(activityStages.id, safeIds));
        }
        deletedCount = safeIds.length;
        break;
      }
      case "activity-consultants": {
        const [total] = await db.select({ count: count() }).from(activityConsultants).where(eq(activityConsultants.companyId, companyId));
        totalCount = total.count;
        const protectedConsultantIds: string[] = [];
        const allConsultants = await db.select({ id: activityConsultants.id }).from(activityConsultants).where(eq(activityConsultants.companyId, companyId));
        for (const c of allConsultants) {
          const [tCount] = await db.select({ count: count() }).from(activityTemplates).where(eq(activityTemplates.consultantId, c.id));
          if (tCount.count > 0) {
            protectedConsultantIds.push(c.id);
          }
        }
        protectedCount = protectedConsultantIds.length;
        protectedReason = "assigned to activity templates";
        const safeIds = allConsultants.filter(c => !protectedConsultantIds.includes(c.id)).map(c => c.id);
        if (safeIds.length > 0) {
          await db.delete(activityConsultants).where(inArray(activityConsultants.id, safeIds));
        }
        deletedCount = safeIds.length;
        break;
      }
      case "child-cost-codes": {
        const [total] = await db.select({ count: count() }).from(childCostCodes).where(eq(childCostCodes.companyId, companyId));
        totalCount = total.count;
        const protectedChildIds: string[] = [];
        const allChildCodes = await db.select({ id: childCostCodes.id }).from(childCostCodes).where(eq(childCostCodes.companyId, companyId));
        for (const cc of allChildCodes) {
          const [t] = await db.select({ count: count() }).from(tenderLineItems).where(eq(tenderLineItems.childCostCodeId, cc.id));
          const [b] = await db.select({ count: count() }).from(budgetLines).where(eq(budgetLines.childCostCodeId, cc.id));
          const [bg] = await db.select({ count: count() }).from(boqGroups).where(eq(boqGroups.childCostCodeId, cc.id));
          const [bi] = await db.select({ count: count() }).from(boqItems).where(eq(boqItems.childCostCodeId, cc.id));
          const [po] = await db.select({ count: count() }).from(purchaseOrders).where(eq(purchaseOrders.childCostCodeId, cc.id));
          if (t.count > 0 || b.count > 0 || bg.count > 0 || bi.count > 0 || po.count > 0) {
            protectedChildIds.push(cc.id);
          }
        }
        protectedCount = protectedChildIds.length;
        protectedReason = "referenced by tender line items, budget lines, BOQ groups/items, or purchase orders";
        const safeIds = allChildCodes.filter(c => !protectedChildIds.includes(c.id)).map(c => c.id);
        if (safeIds.length > 0) {
          await db.delete(childCostCodes).where(inArray(childCostCodes.id, safeIds));
        }
        deletedCount = safeIds.length;
        break;
      }
      case "ap-invoices": {
        const [total] = await db.select({ count: count() }).from(apInvoices).where(eq(apInvoices.companyId, companyId));
        totalCount = total.count;
        protectedCount = 0;
        await db.delete(apInboundEmails).where(eq(apInboundEmails.companyId, companyId));
        const invoiceIds = (await db.select({ id: apInvoices.id }).from(apInvoices).where(eq(apInvoices.companyId, companyId))).map(r => r.id);
        if (invoiceIds.length > 0) {
          await db.delete(myobExportLogs).where(inArray(myobExportLogs.invoiceId, invoiceIds));
        }
        await db.delete(apInvoices).where(eq(apInvoices.companyId, companyId));
        deletedCount = totalCount;
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown entity type: ${entityType}` });
    }

    res.json({
      success: true,
      totalCount,
      deletedCount,
      protectedCount,
      protectedReason,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
