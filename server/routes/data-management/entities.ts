import { Router } from "express";
import {
  db, requireRoleOrSuperAdmin, eq, count, and, sql, desc, asc,
  items, itemCategories, assets, progressClaims, progressClaimItems,
  broadcastTemplates, broadcastMessages, documents, documentBundleItems,
  contracts, purchaseOrderItems, jobs,
  hireBookings, assetMaintenanceRecords, assetTransfers,
} from "./shared";

const router = Router();

router.get("/api/admin/data-management/items", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(asc(items.name))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch items" });
  }
});

router.delete("/api/admin/data-management/items/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [item] = await db.select({ id: items.id }).from(items).where(and(eq(items.id, id), eq(items.companyId, companyId)));
    if (!item) return res.status(404).json({ error: "Item not found or does not belong to your company" });

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete item" });
  }
});

router.get("/api/admin/data-management/item-categories", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(asc(itemCategories.name))
      .limit(1000);

    const catIds = cats.map(c => c.id);
    const countRows = catIds.length > 0
      ? await db
          .select({ categoryId: items.categoryId, count: count() })
          .from(items)
          .where(and(sql`${items.categoryId} IN ${catIds}`, eq(items.companyId, companyId)))
          .groupBy(items.categoryId)
      : [];
    const countMap = new Map(countRows.map(r => [r.categoryId, r.count]));
    const catsWithCounts = cats.map(cat => ({ ...cat, itemCount: countMap.get(cat.id) ?? 0 }));

    res.json(catsWithCounts);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch item categories" });
  }
});

router.delete("/api/admin/data-management/item-categories/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [cat] = await db.select({ id: itemCategories.id }).from(itemCategories).where(and(eq(itemCategories.id, id), eq(itemCategories.companyId, companyId)));
    if (!cat) return res.status(404).json({ error: "Item category not found or does not belong to your company" });

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete item category" });
  }
});

router.get("/api/admin/data-management/assets", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(asc(assets.name))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch assets" });
  }
});

router.delete("/api/admin/data-management/assets/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [asset] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found or does not belong to your company" });

    const [hireCount] = await db.select({ count: count() }).from(hireBookings).where(and(eq(hireBookings.assetId, id), eq(hireBookings.companyId, companyId)));
    if (hireCount.count > 0) {
      return res.status(409).json({
        error: `Cannot delete: this asset is referenced by ${hireCount.count} hire booking(s). Remove those bookings first.`,
      });
    }

    await db.delete(assetMaintenanceRecords).where(and(eq(assetMaintenanceRecords.assetId, id), eq(assetMaintenanceRecords.companyId, companyId)));
    await db.delete(assetTransfers).where(and(eq(assetTransfers.assetId, id), eq(assetTransfers.companyId, companyId)));
    await db.delete(assets).where(and(eq(assets.id, id), eq(assets.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete asset" });
  }
});

router.get("/api/admin/data-management/progress-claims", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(desc(progressClaims.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch progress claims" });
  }
});

router.delete("/api/admin/data-management/progress-claims/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [claim] = await db.select({ id: progressClaims.id }).from(progressClaims).where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found or does not belong to your company" });

    await db.delete(progressClaimItems).where(eq(progressClaimItems.progressClaimId, id));
    await db.delete(progressClaims).where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete progress claim" });
  }
});

router.get("/api/admin/data-management/broadcast-templates", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(asc(broadcastTemplates.name))
      .limit(1000);

    const templateIds = result.map(t => t.id);
    const msgCountRows = templateIds.length > 0
      ? await db
          .select({ templateId: broadcastMessages.templateId, count: count() })
          .from(broadcastMessages)
          .where(sql`${broadcastMessages.templateId} IN ${templateIds}`)
          .groupBy(broadcastMessages.templateId)
      : [];
    const msgCountMap = new Map(msgCountRows.map(r => [r.templateId, r.count]));
    const templatesWithCounts = result.map(t => ({ ...t, messageCount: msgCountMap.get(t.id) ?? 0 }));

    res.json(templatesWithCounts);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch broadcast templates" });
  }
});

router.delete("/api/admin/data-management/broadcast-templates/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [template] = await db.select({ id: broadcastTemplates.id }).from(broadcastTemplates).where(and(eq(broadcastTemplates.id, id), eq(broadcastTemplates.companyId, companyId)));
    if (!template) return res.status(404).json({ error: "Broadcast template not found or does not belong to your company" });

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete broadcast template" });
  }
});

router.get("/api/admin/data-management/documents", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(desc(documents.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch documents" });
  }
});

router.delete("/api/admin/data-management/documents/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [doc] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, id), eq(documents.companyId, companyId)));
    if (!doc) return res.status(404).json({ error: "Document not found or does not belong to your company" });

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document" });
  }
});

router.get("/api/admin/data-management/contracts", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
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
      .orderBy(desc(contracts.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch contracts" });
  }
});

router.delete("/api/admin/data-management/contracts/:id", requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [contract] = await db.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.id, id), eq(contracts.companyId, companyId)));
    if (!contract) return res.status(404).json({ error: "Contract not found or does not belong to your company" });

    await db.delete(contracts).where(and(eq(contracts.id, id), eq(contracts.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete contract" });
  }
});

export default router;
