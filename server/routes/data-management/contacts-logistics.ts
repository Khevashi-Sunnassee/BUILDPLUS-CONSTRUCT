import { Router } from "express";
import {
  db, requireRole, eq, count, and, desc, asc,
  deliveryRecords, loadLists, loadListPanels, jobs,
  suppliers, customers, employees,
  purchaseOrders, items, documents, documentBundles, assets,
  checklistInstances, hireBookings,
} from "./shared";

const router = Router();

router.get("/api/admin/data-management/deliveries", requireRole("ADMIN"), async (req, res) => {
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
      .orderBy(desc(deliveryRecords.createdAt))
      .limit(1000);

    res.json(allDeliveries);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch deliveries" });
  }
});

router.delete("/api/admin/data-management/deliveries/:id", requireRole("ADMIN"), async (req, res) => {
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

router.get("/api/admin/data-management/load-lists", requireRole("ADMIN"), async (req, res) => {
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
      .orderBy(desc(loadLists.createdAt))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch load lists" });
  }
});

router.delete("/api/admin/data-management/load-lists/:id", requireRole("ADMIN"), async (req, res) => {
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

router.get("/api/admin/data-management/suppliers", requireRole("ADMIN"), async (req, res) => {
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
      .orderBy(asc(suppliers.name))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch suppliers" });
  }
});

router.delete("/api/admin/data-management/suppliers/:id", requireRole("ADMIN"), async (req, res) => {
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

    const [docCount] = await db.select({ count: count() }).from(documents).where(and(eq(documents.supplierId, id), eq(documents.companyId, companyId)));
    if (docCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier is linked to ${docCount.count} document(s).` });
    }

    const [bundleCount] = await db.select({ count: count() }).from(documentBundles).where(and(eq(documentBundles.supplierId, id), eq(documentBundles.companyId, companyId)));
    if (bundleCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier is linked to ${bundleCount.count} document bundle(s).` });
    }

    const [assetCount] = await db.select({ count: count() }).from(assets).where(and(eq(assets.supplierId, id), eq(assets.companyId, companyId)));
    if (assetCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier is linked to ${assetCount.count} asset(s).` });
    }

    const [checklistCount] = await db.select({ count: count() }).from(checklistInstances).where(and(eq(checklistInstances.supplierId, id), eq(checklistInstances.companyId, companyId)));
    if (checklistCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier is linked to ${checklistCount.count} checklist(s).` });
    }

    const [hireCount] = await db.select({ count: count() }).from(hireBookings).where(and(eq(hireBookings.supplierId, id), eq(hireBookings.companyId, companyId)));
    if (hireCount.count > 0) {
      return res.status(409).json({ error: `Cannot delete: this supplier is linked to ${hireCount.count} hire booking(s).` });
    }

    await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete supplier" });
  }
});

router.get("/api/admin/data-management/customers", requireRole("ADMIN"), async (req, res) => {
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
      .orderBy(asc(customers.name))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch customers" });
  }
});

router.delete("/api/admin/data-management/customers/:id", requireRole("ADMIN"), async (req, res) => {
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

router.get("/api/admin/data-management/employees", requireRole("ADMIN"), async (req, res) => {
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
      .orderBy(asc(employees.lastName), asc(employees.firstName))
      .limit(1000);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch employees" });
  }
});

router.delete("/api/admin/data-management/employees/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
    if (!employee) return res.status(404).json({ error: "Employee not found or does not belong to your company" });

    const [hireRequestedBy] = await db.select({ count: count() }).from(hireBookings).where(and(eq(hireBookings.requestedByUserId, id), eq(hireBookings.companyId, companyId)));
    const [hireResponsible] = await db.select({ count: count() }).from(hireBookings).where(and(eq(hireBookings.responsiblePersonUserId, id), eq(hireBookings.companyId, companyId)));
    const [hireSiteContact] = await db.select({ count: count() }).from(hireBookings).where(and(eq(hireBookings.siteContactUserId, id), eq(hireBookings.companyId, companyId)));
    const totalHireRefs = hireRequestedBy.count + hireResponsible.count + hireSiteContact.count;
    if (totalHireRefs > 0) {
      return res.status(409).json({
        error: `Cannot delete: this employee is referenced by ${totalHireRefs} hire booking(s). Remove those references first.`,
      });
    }

    await db.delete(employees).where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete employee" });
  }
});

export default router;
