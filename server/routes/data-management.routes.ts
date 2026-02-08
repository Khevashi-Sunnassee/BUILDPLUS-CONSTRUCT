import { Router } from "express";
import { db } from "../storage";
import { requireRole } from "./middleware/auth.middleware";
import { eq, count, and, sql, desc, asc } from "drizzle-orm";
import {
  items,
  itemCategories,
  assets,
  progressClaims,
  progressClaimItems,
  broadcastTemplates,
  broadcastMessages,
  documents,
  documentBundleItems,
  contracts,
  deliveryRecords,
  loadLists,
  loadListPanels,
  assetMaintenanceRecords,
  assetTransfers,
  purchaseOrderItems,
  jobs,
} from "@shared/schema";

export const dataManagementRouter = Router();

dataManagementRouter.get("/api/admin/data-management/items", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: items.id,
        code: items.code,
        name: items.name,
        description: items.description,
        categoryId: items.categoryId,
        unitOfMeasure: items.unitOfMeasure,
        unitPrice: items.unitPrice,
        isActive: items.isActive,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(eq(items.companyId, companyId))
      .orderBy(asc(items.name));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch items" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/items/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    const [poItemCount] = await db
      .select({ count: count() })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.itemId, id));

    if (poItemCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: this item is referenced by ${poItemCount.count} purchase order line(s). Remove those references first.`,
      });
    }

    await db.delete(items).where(and(eq(items.id, id), eq(items.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete item" });
  }
});

dataManagementRouter.get("/api/admin/data-management/item-categories", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const cats = await db
      .select({
        id: itemCategories.id,
        name: itemCategories.name,
        description: itemCategories.description,
        isActive: itemCategories.isActive,
        createdAt: itemCategories.createdAt,
      })
      .from(itemCategories)
      .where(eq(itemCategories.companyId, companyId))
      .orderBy(asc(itemCategories.name));

    const catsWithCounts = await Promise.all(
      cats.map(async (cat) => {
        const [itemCount] = await db
          .select({ count: count() })
          .from(items)
          .where(and(eq(items.categoryId, cat.id), eq(items.companyId, companyId)));
        return { ...cat, itemCount: itemCount.count };
      })
    );

    res.json(catsWithCounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch item categories" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    const [itemCount] = await db
      .select({ count: count() })
      .from(items)
      .where(and(eq(items.categoryId, id), eq(items.companyId, companyId)));

    if (itemCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${itemCount.count} item(s) belong to this category. Reassign or delete them first.`,
      });
    }

    await db.delete(itemCategories).where(and(eq(itemCategories.id, id), eq(itemCategories.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete item category" });
  }
});

dataManagementRouter.get("/api/admin/data-management/assets", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: assets.id,
        assetTag: assets.assetTag,
        name: assets.name,
        category: assets.category,
        status: assets.status,
        location: assets.location,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(eq(assets.companyId, companyId))
      .orderBy(asc(assets.name));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch assets" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/assets/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    await db.delete(assetMaintenanceRecords).where(eq(assetMaintenanceRecords.assetId, id));
    await db.delete(assetTransfers).where(eq(assetTransfers.assetId, id));
    await db.delete(assets).where(and(eq(assets.id, id), eq(assets.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete asset" });
  }
});

dataManagementRouter.get("/api/admin/data-management/progress-claims", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: progressClaims.id,
        claimNumber: progressClaims.claimNumber,
        status: progressClaims.status,
        claimDate: progressClaims.claimDate,
        total: progressClaims.total,
        jobId: progressClaims.jobId,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
        createdAt: progressClaims.createdAt,
      })
      .from(progressClaims)
      .leftJoin(jobs, eq(progressClaims.jobId, jobs.id))
      .where(eq(progressClaims.companyId, companyId))
      .orderBy(desc(progressClaims.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch progress claims" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/progress-claims/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    await db.delete(progressClaimItems).where(eq(progressClaimItems.progressClaimId, id));
    await db.delete(progressClaims).where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete progress claim" });
  }
});

dataManagementRouter.get("/api/admin/data-management/broadcast-templates", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: broadcastTemplates.id,
        name: broadcastTemplates.name,
        subject: broadcastTemplates.subject,
        category: broadcastTemplates.category,
        isActive: broadcastTemplates.isActive,
        createdAt: broadcastTemplates.createdAt,
      })
      .from(broadcastTemplates)
      .where(eq(broadcastTemplates.companyId, companyId))
      .orderBy(asc(broadcastTemplates.name));

    const templatesWithCounts = await Promise.all(
      result.map(async (t) => {
        const [msgCount] = await db
          .select({ count: count() })
          .from(broadcastMessages)
          .where(eq(broadcastMessages.templateId, t.id));
        return { ...t, messageCount: msgCount.count };
      })
    );

    res.json(templatesWithCounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch broadcast templates" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/broadcast-templates/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    const [msgCount] = await db
      .select({ count: count() })
      .from(broadcastMessages)
      .where(eq(broadcastMessages.templateId, id));

    if (msgCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${msgCount.count} broadcast message(s) use this template. Delete those messages first.`,
      });
    }

    await db.delete(broadcastTemplates).where(and(eq(broadcastTemplates.id, id), eq(broadcastTemplates.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete broadcast template" });
  }
});

dataManagementRouter.get("/api/admin/data-management/documents", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: documents.id,
        documentNumber: documents.documentNumber,
        title: documents.title,
        fileName: documents.fileName,
        originalName: documents.originalName,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        revision: documents.revision,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.companyId, companyId))
      .orderBy(desc(documents.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch documents" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/documents/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    const [childDocCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(eq(documents.parentDocumentId, id));

    if (childDocCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${childDocCount.count} child document(s) reference this document as a parent. Delete those first.`,
      });
    }

    const [contractRefCount] = await db
      .select({ count: count() })
      .from(contracts)
      .where(eq(contracts.aiSourceDocumentId, id));

    if (contractRefCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${contractRefCount.count} contract(s) reference this document. Unlink the contract first.`,
      });
    }

    await db.delete(documentBundleItems).where(eq(documentBundleItems.documentId, id));
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete document" });
  }
});

dataManagementRouter.get("/api/admin/data-management/contracts", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        projectName: contracts.projectName,
        generalContractor: contracts.generalContractor,
        contractStatus: contracts.contractStatus,
        jobId: contracts.jobId,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
        createdAt: contracts.createdAt,
      })
      .from(contracts)
      .leftJoin(jobs, eq(contracts.jobId, jobs.id))
      .where(eq(contracts.companyId, companyId))
      .orderBy(desc(contracts.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch contracts" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/contracts/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    await db.delete(contracts).where(and(eq(contracts.id, id), eq(contracts.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete contract" });
  }
});

dataManagementRouter.get("/api/admin/data-management/deliveries", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const allDeliveries = await db
      .select({
        id: deliveryRecords.id,
        docketNumber: deliveryRecords.docketNumber,
        loadDocumentNumber: deliveryRecords.loadDocumentNumber,
        truckRego: deliveryRecords.truckRego,
        deliveryDate: deliveryRecords.deliveryDate,
        numberPanels: deliveryRecords.numberPanels,
        loadListId: deliveryRecords.loadListId,
        loadNumber: loadLists.loadNumber,
        jobName: jobs.name,
        createdAt: deliveryRecords.createdAt,
      })
      .from(deliveryRecords)
      .innerJoin(loadLists, eq(deliveryRecords.loadListId, loadLists.id))
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(eq(jobs.companyId, companyId))
      .orderBy(desc(deliveryRecords.createdAt));

    res.json(allDeliveries);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch deliveries" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/deliveries/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    const [delivery] = await db
      .select({ loadListId: deliveryRecords.loadListId })
      .from(deliveryRecords)
      .where(eq(deliveryRecords.id, id));

    if (!delivery) {
      return res.status(404).json({ error: "Delivery record not found" });
    }

    const [ll] = await db
      .select({ jobId: loadLists.jobId })
      .from(loadLists)
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(and(eq(loadLists.id, delivery.loadListId), eq(jobs.companyId, companyId)));

    if (!ll) {
      return res.status(403).json({ error: "Delivery does not belong to your company" });
    }

    await db.delete(deliveryRecords).where(eq(deliveryRecords.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete delivery record" });
  }
});

dataManagementRouter.get("/api/admin/data-management/load-lists", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: loadLists.id,
        loadNumber: loadLists.loadNumber,
        loadDate: loadLists.loadDate,
        loadTime: loadLists.loadTime,
        status: loadLists.status,
        jobId: loadLists.jobId,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
        createdAt: loadLists.createdAt,
      })
      .from(loadLists)
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(eq(jobs.companyId, companyId))
      .orderBy(desc(loadLists.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch load lists" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/load-lists/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { id } = req.params;

    const [ll] = await db
      .select({ id: loadLists.id })
      .from(loadLists)
      .innerJoin(jobs, eq(loadLists.jobId, jobs.id))
      .where(and(eq(loadLists.id, id), eq(jobs.companyId, companyId)));

    if (!ll) {
      return res.status(404).json({ error: "Load list not found or does not belong to your company" });
    }

    const [deliveryCount] = await db
      .select({ count: count() })
      .from(deliveryRecords)
      .where(eq(deliveryRecords.loadListId, id));

    if (deliveryCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: this load list has ${deliveryCount.count} delivery record(s). Delete those first.`,
      });
    }

    await db.delete(loadListPanels).where(eq(loadListPanels.loadListId, id));
    await db.delete(loadLists).where(eq(loadLists.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete load list" });
  }
});
