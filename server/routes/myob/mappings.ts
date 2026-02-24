import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { db } from "../../db";
import { myobAccountMappings, myobTaxCodeMappings, myobSupplierMappings, myobCustomerMappings, costCodes, suppliers, jobs, customers } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { handleMyobError } from "./helpers";

const router = Router();

router.get("/api/myob/job-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const bpJobs = await db.select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      name: jobs.name,
      myobJobUid: jobs.myobJobUid,
    })
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .orderBy(asc(jobs.jobNumber))
      .limit(500);

    res.json(bpJobs);
  } catch (err) {
    handleMyobError(err, res, "job-mappings-list");
  }
});

router.post("/api/myob/job-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { jobId, myobJobUid } = req.body;
    if (!jobId || !myobJobUid) return res.status(400).json({ error: "jobId and myobJobUid are required" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const [updated] = await db.update(jobs)
      .set({ myobJobUid, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();

    res.json(updated);
  } catch (err) {
    handleMyobError(err, res, "job-mappings-link");
  }
});

router.delete("/api/myob/job-mappings/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, req.params.jobId), eq(jobs.companyId, companyId))).limit(1);
    if (!job) return res.status(404).json({ error: "Job not found" });

    await db.update(jobs)
      .set({ myobJobUid: null, updatedAt: new Date() })
      .where(eq(jobs.id, req.params.jobId));

    res.json({ ok: true });
  } catch (err) {
    handleMyobError(err, res, "job-mappings-unlink");
  }
});

router.get("/api/myob/account-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select({
      mapping: myobAccountMappings,
      costCode: { code: costCodes.code, name: costCodes.name },
    })
    .from(myobAccountMappings)
    .leftJoin(costCodes, eq(myobAccountMappings.costCodeId, costCodes.id))
    .where(eq(myobAccountMappings.companyId, companyId))
    .orderBy(asc(costCodes.code))
    .limit(500);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "account-mappings-list");
  }
});

router.post("/api/myob/account-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { costCodeId, myobAccountUid, myobAccountName, myobAccountDisplayId, notes } = req.body;
    if (!costCodeId || !myobAccountUid) return res.status(400).json({ error: "costCodeId and myobAccountUid are required" });

    const existing = await db.select().from(myobAccountMappings)
      .where(and(eq(myobAccountMappings.companyId, companyId), eq(myobAccountMappings.costCodeId, costCodeId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobAccountMappings)
        .set({ myobAccountUid, myobAccountName, myobAccountDisplayId, notes, updatedAt: new Date() })
        .where(eq(myobAccountMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobAccountMappings).values({
      companyId, costCodeId, myobAccountUid, myobAccountName, myobAccountDisplayId, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "account-mappings-create");
  }
});

router.delete("/api/myob/account-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappingId = req.params.id;
    await db.delete(myobAccountMappings)
      .where(and(eq(myobAccountMappings.id, mappingId), eq(myobAccountMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "account-mappings-delete");
  }
});

router.get("/api/myob/tax-code-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select().from(myobTaxCodeMappings)
      .where(eq(myobTaxCodeMappings.companyId, companyId))
      .orderBy(asc(myobTaxCodeMappings.bpTaxCode))
      .limit(200);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "tax-code-mappings-list");
  }
});

router.post("/api/myob/tax-code-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { bpTaxCode, myobTaxCodeUid, myobTaxCodeName, myobTaxCodeCode, notes } = req.body;
    if (!bpTaxCode || !myobTaxCodeUid) return res.status(400).json({ error: "bpTaxCode and myobTaxCodeUid are required" });

    const existing = await db.select().from(myobTaxCodeMappings)
      .where(and(eq(myobTaxCodeMappings.companyId, companyId), eq(myobTaxCodeMappings.bpTaxCode, bpTaxCode)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobTaxCodeMappings)
        .set({ myobTaxCodeUid, myobTaxCodeName, myobTaxCodeCode, notes, updatedAt: new Date() })
        .where(eq(myobTaxCodeMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobTaxCodeMappings).values({
      companyId, bpTaxCode, myobTaxCodeUid, myobTaxCodeName, myobTaxCodeCode, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "tax-code-mappings-create");
  }
});

router.delete("/api/myob/tax-code-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(myobTaxCodeMappings)
      .where(and(eq(myobTaxCodeMappings.id, req.params.id), eq(myobTaxCodeMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "tax-code-mappings-delete");
  }
});

router.get("/api/myob/supplier-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select({
      mapping: myobSupplierMappings,
      supplier: { name: suppliers.name },
    })
    .from(myobSupplierMappings)
    .leftJoin(suppliers, eq(myobSupplierMappings.supplierId, suppliers.id))
    .where(eq(myobSupplierMappings.companyId, companyId))
    .orderBy(asc(suppliers.name))
    .limit(500);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "supplier-mappings-list");
  }
});

router.post("/api/myob/supplier-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { supplierId, myobSupplierUid, myobSupplierName, myobSupplierDisplayId, notes } = req.body;
    if (!supplierId || !myobSupplierUid) return res.status(400).json({ error: "supplierId and myobSupplierUid are required" });

    const existing = await db.select().from(myobSupplierMappings)
      .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobSupplierMappings)
        .set({ myobSupplierUid, myobSupplierName, myobSupplierDisplayId, notes, updatedAt: new Date() })
        .where(eq(myobSupplierMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobSupplierMappings).values({
      companyId, supplierId, myobSupplierUid, myobSupplierName, myobSupplierDisplayId, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "supplier-mappings-create");
  }
});

router.delete("/api/myob/supplier-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(myobSupplierMappings)
      .where(and(eq(myobSupplierMappings.id, req.params.id), eq(myobSupplierMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "supplier-mappings-delete");
  }
});

router.get("/api/myob/customer-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const mappings = await db.select({
      mapping: myobCustomerMappings,
      customer: { name: customers.name },
    })
    .from(myobCustomerMappings)
    .leftJoin(customers, eq(myobCustomerMappings.customerId, customers.id))
    .where(eq(myobCustomerMappings.companyId, companyId))
    .orderBy(asc(customers.name))
    .limit(500);
    res.json(mappings);
  } catch (err) {
    handleMyobError(err, res, "customer-mappings-list");
  }
});

router.post("/api/myob/customer-mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const { customerId, myobCustomerUid, myobCustomerName, myobCustomerDisplayId, notes } = req.body;
    if (!customerId || !myobCustomerUid) return res.status(400).json({ error: "customerId and myobCustomerUid are required" });

    const existing = await db.select().from(myobCustomerMappings)
      .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, customerId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(myobCustomerMappings)
        .set({ myobCustomerUid, myobCustomerName, myobCustomerDisplayId, notes, updatedAt: new Date() })
        .where(eq(myobCustomerMappings.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(myobCustomerMappings).values({
      companyId, customerId, myobCustomerUid, myobCustomerName, myobCustomerDisplayId, notes,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    handleMyobError(err, res, "customer-mappings-create");
  }
});

router.delete("/api/myob/customer-mappings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(myobCustomerMappings)
      .where(and(eq(myobCustomerMappings.id, req.params.id), eq(myobCustomerMappings.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    handleMyobError(err, res, "customer-mappings-delete");
  }
});

export { router as mappingsRouter };
