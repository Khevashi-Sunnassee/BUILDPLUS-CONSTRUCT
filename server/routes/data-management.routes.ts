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
  purchaseOrders,
  jobs,
  suppliers,
  customers,
  employees,
  documentBundles,
  checklistInstances,
} from "@shared/schema";
import { inArray, notInArray } from "drizzle-orm";

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch items" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/items/:id", requireRole("ADMIN"), async (req, res) => {
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch item categories" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/item-categories/:id", requireRole("ADMIN"), async (req, res) => {
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch assets" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/assets/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [asset] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found or does not belong to your company" });

    await db.delete(assetMaintenanceRecords).where(and(eq(assetMaintenanceRecords.assetId, id), eq(assetMaintenanceRecords.companyId, companyId)));
    await db.delete(assetTransfers).where(and(eq(assetTransfers.assetId, id), eq(assetTransfers.companyId, companyId)));
    await db.delete(assets).where(and(eq(assets.id, id), eq(assets.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete asset" });
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch progress claims" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/progress-claims/:id", requireRole("ADMIN"), async (req, res) => {
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch broadcast templates" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/broadcast-templates/:id", requireRole("ADMIN"), async (req, res) => {
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch documents" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/documents/:id", requireRole("ADMIN"), async (req, res) => {
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch contracts" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/contracts/:id", requireRole("ADMIN"), async (req, res) => {
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch deliveries" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/deliveries/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete delivery record" });
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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch load lists" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/load-lists/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

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
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete load list" });
  }
});

// ============================================================================
// SUPPLIERS
// ============================================================================

dataManagementRouter.get("/api/admin/data-management/suppliers", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        keyContact: suppliers.keyContact,
        email: suppliers.email,
        phone: suppliers.phone,
        isActive: suppliers.isActive,
        createdAt: suppliers.createdAt,
      })
      .from(suppliers)
      .where(eq(suppliers.companyId, companyId))
      .orderBy(asc(suppliers.name));
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
    if (!supplier) return res.status(404).json({ error: "Supplier not found or does not belong to your company" });

    const [poCount] = await db.select({ count: count() }).from(purchaseOrders).where(and(eq(purchaseOrders.supplierId, id), eq(purchaseOrders.companyId, companyId)));
    if (poCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier has ${poCount.count} purchase order(s).` });
    }

    const [itemCount] = await db.select({ count: count() }).from(items).where(and(eq(items.supplierId, id), eq(items.companyId, companyId)));
    if (itemCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier is linked to ${itemCount.count} item(s).` });
    }

    await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete supplier" });
  }
});

// ============================================================================
// CUSTOMERS
// ============================================================================

dataManagementRouter.get("/api/admin/data-management/customers", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: customers.id,
        name: customers.name,
        keyContact: customers.keyContact,
        email: customers.email,
        phone: customers.phone,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.companyId, companyId))
      .orderBy(asc(customers.name));
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch customers" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/customers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
    if (!customer) return res.status(404).json({ error: "Customer not found or does not belong to your company" });

    const [jobCount] = await db.select({ count: count() }).from(jobs).where(and(eq(jobs.customerId, id), eq(jobs.companyId, companyId)));
    if (jobCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this customer is linked to ${jobCount.count} job(s).` });
    }

    await db.delete(customers).where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete customer" });
  }
});

// ============================================================================
// EMPLOYEES
// ============================================================================

dataManagementRouter.get("/api/admin/data-management/employees", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstName: employees.firstName,
        lastName: employees.lastName,
        preferredName: employees.preferredName,
        email: employees.email,
        phone: employees.phone,
        isActive: employees.isActive,
        createdAt: employees.createdAt,
      })
      .from(employees)
      .where(eq(employees.companyId, companyId))
      .orderBy(asc(employees.lastName), asc(employees.firstName));
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch employees" });
  }
});

dataManagementRouter.delete("/api/admin/data-management/employees/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
    if (!employee) return res.status(404).json({ error: "Employee not found or does not belong to your company" });

    await db.delete(employees).where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete employee" });
  }
});

// ============================================================================
// BULK DELETE - delete all records that are safe to remove (no FK dependencies)
// ============================================================================

async function getProtectedSupplierIds(companyId: string): Promise<string[]> {
  const poSuppliers = await db.selectDistinct({ id: purchaseOrders.supplierId }).from(purchaseOrders).where(and(eq(purchaseOrders.companyId, companyId), sql`${purchaseOrders.supplierId} IS NOT NULL`));
  const itemSuppliers = await db.selectDistinct({ id: items.supplierId }).from(items).where(and(eq(items.companyId, companyId), sql`${items.supplierId} IS NOT NULL`));
  const docSuppliers = await db.selectDistinct({ id: documents.supplierId }).from(documents).where(and(eq(documents.companyId, companyId), sql`${documents.supplierId} IS NOT NULL`));
  const bundleSuppliers = await db.selectDistinct({ id: documentBundles.supplierId }).from(documentBundles).where(and(eq(documentBundles.companyId, companyId), sql`${documentBundles.supplierId} IS NOT NULL`));
  const assetSuppliers = await db.selectDistinct({ id: assets.supplierId }).from(assets).where(and(eq(assets.companyId, companyId), sql`${assets.supplierId} IS NOT NULL`));
  const checklistSuppliers = await db.selectDistinct({ id: checklistInstances.supplierId }).from(checklistInstances).where(and(eq(checklistInstances.companyId, companyId), sql`${checklistInstances.supplierId} IS NOT NULL`));
  const ids = new Set<string>();
  for (const row of [...poSuppliers, ...itemSuppliers, ...docSuppliers, ...bundleSuppliers, ...assetSuppliers, ...checklistSuppliers]) {
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

dataManagementRouter.delete("/api/admin/data-management/:entityType/bulk-delete", requireRole("ADMIN"), async (req, res) => {
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
        protectedCount = 0;
        protectedReason = "";
        const allEmps = await db.select({ id: employees.id }).from(employees).where(eq(employees.companyId, companyId));
        for (const emp of allEmps) {
          await db.delete(employees).where(and(eq(employees.id, emp.id), eq(employees.companyId, companyId)));
        }
        deletedCount = totalCount;
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
        protectedCount = 0;
        const allAssets = await db.select({ id: assets.id }).from(assets).where(eq(assets.companyId, companyId));
        for (const asset of allAssets) {
          await db.delete(assetMaintenanceRecords).where(and(eq(assetMaintenanceRecords.assetId, asset.id), eq(assetMaintenanceRecords.companyId, companyId)));
          await db.delete(assetTransfers).where(and(eq(assetTransfers.assetId, asset.id), eq(assetTransfers.companyId, companyId)));
        }
        await db.delete(assets).where(eq(assets.companyId, companyId));
        deletedCount = totalCount;
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
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to perform bulk delete" });
  }
});
