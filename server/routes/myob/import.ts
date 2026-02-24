import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { createMyobClient } from "../../myob";
import logger from "../../lib/logger";
import { db } from "../../db";
import { myobAccountMappings, myobSupplierMappings, myobCustomerMappings, costCodes, suppliers, jobs, customers } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { handleMyobError } from "./helpers";

const router = Router();

router.post("/api/myob/import-customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobDisplayId, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        const bpCustomer = await db.select().from(customers)
          .where(and(eq(customers.id, existingBpId), eq(customers.companyId, companyId)))
          .limit(1);
        if (bpCustomer.length === 0) { skipped++; continue; }
        const existing = await db.select().from(myobCustomerMappings)
          .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, existingBpId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(myobCustomerMappings)
            .set({ myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null, updatedAt: new Date() })
            .where(eq(myobCustomerMappings.id, existing[0].id));
        } else {
          await db.insert(myobCustomerMappings).values({
            companyId, customerId: existingBpId, myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null,
          });
        }
        linked++;
      } else if (action === "create") {
        try {
          const existingCustomer = await db.select().from(customers)
            .where(and(eq(customers.name, myobName), eq(customers.companyId, companyId)))
            .limit(1);
          let customerId: string;
          if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
            linked++;
          } else {
            const [newCustomer] = await db.insert(customers).values({ companyId, name: myobName }).returning();
            customerId = newCustomer.id;
            created++;
          }
          const existingMapping = await db.select().from(myobCustomerMappings)
            .where(and(eq(myobCustomerMappings.companyId, companyId), eq(myobCustomerMappings.customerId, customerId)))
            .limit(1);
          if (existingMapping.length > 0) {
            await db.update(myobCustomerMappings)
              .set({ myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null, updatedAt: new Date() })
              .where(eq(myobCustomerMappings.id, existingMapping[0].id));
          } else {
            await db.insert(myobCustomerMappings).values({
              companyId, customerId, myobCustomerUid: myobUid, myobCustomerName: myobName, myobCustomerDisplayId: myobDisplayId || null,
            });
          }
        } catch (itemErr) {
          logger.warn({ err: itemErr, myobName, myobUid }, "[MYOB Import] Failed to import customer, skipping");
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-customers");
  }
});

router.post("/api/myob/import-suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobDisplayId, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        const bpSupplier = await db.select().from(suppliers)
          .where(and(eq(suppliers.id, existingBpId), eq(suppliers.companyId, companyId)))
          .limit(1);
        if (bpSupplier.length === 0) { skipped++; continue; }
        const existing = await db.select().from(myobSupplierMappings)
          .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, existingBpId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(myobSupplierMappings)
            .set({ myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null, updatedAt: new Date() })
            .where(eq(myobSupplierMappings.id, existing[0].id));
        } else {
          await db.insert(myobSupplierMappings).values({
            companyId, supplierId: existingBpId, myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null,
          });
        }
        linked++;
      } else if (action === "create") {
        try {
          const existingSupplier = await db.select().from(suppliers)
            .where(and(eq(suppliers.name, myobName), eq(suppliers.companyId, companyId)))
            .limit(1);
          let supplierId: string;
          if (existingSupplier.length > 0) {
            supplierId = existingSupplier[0].id;
            linked++;
          } else {
            const [newSupplier] = await db.insert(suppliers).values({ companyId, name: myobName }).returning();
            supplierId = newSupplier.id;
            created++;
          }
          const existingMapping = await db.select().from(myobSupplierMappings)
            .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
            .limit(1);
          if (existingMapping.length > 0) {
            await db.update(myobSupplierMappings)
              .set({ myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null, updatedAt: new Date() })
              .where(eq(myobSupplierMappings.id, existingMapping[0].id));
          } else {
            await db.insert(myobSupplierMappings).values({
              companyId, supplierId, myobSupplierUid: myobUid, myobSupplierName: myobName, myobSupplierDisplayId: myobDisplayId || null,
            });
          }
        } catch (itemErr) {
          logger.warn({ err: itemErr, myobName, myobUid }, "[MYOB Import] Failed to import supplier, skipping");
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-suppliers");
  }
});

router.post("/api/myob/import-jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobNumber, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        await db.update(jobs)
          .set({ myobJobUid: myobUid, updatedAt: new Date() })
          .where(and(eq(jobs.id, existingBpId), eq(jobs.companyId, companyId)));
        linked++;
      } else if (action === "create") {
        const jobNumber = myobNumber || `MYOB-${myobName.substring(0, 20)}`;
        const existingJob = await db.select().from(jobs)
          .where(and(eq(jobs.jobNumber, jobNumber), eq(jobs.companyId, companyId)))
          .limit(1);
        if (existingJob.length > 0) {
          await db.update(jobs)
            .set({ myobJobUid: myobUid, updatedAt: new Date() })
            .where(eq(jobs.id, existingJob[0].id));
          linked++;
        } else {
          await db.insert(jobs).values({
            companyId, jobNumber, name: myobName, myobJobUid: myobUid, status: "ACTIVE",
          });
          created++;
        }
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-jobs");
  }
});

router.post("/api/myob/import-accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });

    let created = 0, linked = 0, skipped = 0;

    for (const item of items) {
      const { myobUid, myobName, myobDisplayId, action, existingBpId } = item;
      if (!myobUid || !myobName) { skipped++; continue; }

      if (action === "skip") { skipped++; continue; }

      if (action === "link" && existingBpId) {
        const bpCostCode = await db.select().from(costCodes)
          .where(and(eq(costCodes.id, existingBpId), eq(costCodes.companyId, companyId)))
          .limit(1);
        if (bpCostCode.length === 0) { skipped++; continue; }
        const existing = await db.select().from(myobAccountMappings)
          .where(and(eq(myobAccountMappings.companyId, companyId), eq(myobAccountMappings.costCodeId, existingBpId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(myobAccountMappings)
            .set({ myobAccountUid: myobUid, myobAccountName: myobName, myobAccountDisplayId: myobDisplayId || null, updatedAt: new Date() })
            .where(eq(myobAccountMappings.id, existing[0].id));
        } else {
          await db.insert(myobAccountMappings).values({
            companyId, costCodeId: existingBpId, myobAccountUid: myobUid, myobAccountName: myobName, myobAccountDisplayId: myobDisplayId || null,
          });
        }
        linked++;
      } else if (action === "create") {
        const code = myobDisplayId || myobName.substring(0, 20);
        const existingCode = await db.select().from(costCodes)
          .where(and(eq(costCodes.code, code), eq(costCodes.companyId, companyId)))
          .limit(1);
        let costCodeId: string;
        if (existingCode.length > 0) {
          costCodeId = existingCode[0].id;
        } else {
          const [newCostCode] = await db.insert(costCodes).values({ companyId, code, name: myobName }).returning();
          costCodeId = newCostCode.id;
        }
        const existingMapping = await db.select().from(myobAccountMappings)
          .where(and(eq(myobAccountMappings.companyId, companyId), eq(myobAccountMappings.costCodeId, costCodeId)))
          .limit(1);
        if (existingMapping.length === 0) {
          await db.insert(myobAccountMappings).values({
            companyId, costCodeId, myobAccountUid: myobUid, myobAccountName: myobName, myobAccountDisplayId: myobDisplayId || null,
          });
        }
        created++;
      } else {
        skipped++;
      }
    }

    res.json({ created, linked, skipped });
  } catch (err) {
    handleMyobError(err, res, "import-accounts");
  }
});

router.post("/api/myob/auto-map", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    const [myobAccounts, myobTaxCodes, myobSuppliers] = await Promise.all([
      myob.getAccounts().catch(() => ({ Items: [] })),
      myob.getTaxCodes().catch(() => ({ Items: [] })),
      myob.getSuppliers().catch(() => ({ Items: [] })),
    ]);

    const accountItems: any[] = (myobAccounts as any)?.Items || [];
    const taxItems: any[] = (myobTaxCodes as any)?.Items || [];
    const supplierItems: any[] = (myobSuppliers as any)?.Items || [];

    const companyCostCodes = await db.select().from(costCodes)
      .where(and(eq(costCodes.companyId, companyId), eq(costCodes.isActive, true)))
      .orderBy(asc(costCodes.code))
      .limit(500);

    const companySuppliers = await db.select().from(suppliers)
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true)))
      .orderBy(asc(suppliers.name))
      .limit(500);

    const existingAcctMaps = await db.select().from(myobAccountMappings)
      .where(eq(myobAccountMappings.companyId, companyId)).limit(500);
    const existingSupMaps = await db.select().from(myobSupplierMappings)
      .where(eq(myobSupplierMappings.companyId, companyId)).limit(500);

    const mappedCostCodeIds = new Set(existingAcctMaps.map((m) => m.costCodeId));
    const mappedSupplierIds = new Set(existingSupMaps.map((m) => m.supplierId));

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    let accountMapped = 0;
    let supplierMapped = 0;

    for (const cc of companyCostCodes) {
      if (mappedCostCodeIds.has(cc.id)) continue;
      const ccNorm = normalize(cc.name);
      const ccCodeNorm = normalize(cc.code);
      const match = accountItems.find((a) => {
        const aNorm = normalize(a.Name || "");
        const aIdNorm = normalize(a.DisplayID || "");
        return aNorm === ccNorm || aIdNorm === ccCodeNorm || aNorm.includes(ccNorm) || ccNorm.includes(aNorm);
      });
      if (match) {
        await db.insert(myobAccountMappings).values({
          companyId,
          costCodeId: cc.id,
          myobAccountUid: match.UID,
          myobAccountName: match.Name,
          myobAccountDisplayId: match.DisplayID,
          notes: "Auto-mapped",
        }).onConflictDoNothing();
        accountMapped++;
      }
    }

    for (const sup of companySuppliers) {
      if (mappedSupplierIds.has(sup.id)) continue;
      const supNorm = normalize(sup.name);
      const match = supplierItems.find((s) => {
        const sNorm = normalize(s.CompanyName || s.Name || "");
        return sNorm === supNorm || sNorm.includes(supNorm) || supNorm.includes(sNorm);
      });
      if (match) {
        await db.insert(myobSupplierMappings).values({
          companyId,
          supplierId: sup.id,
          myobSupplierUid: match.UID,
          myobSupplierName: match.CompanyName || match.Name || "",
          myobSupplierDisplayId: match.DisplayID || "",
          notes: "Auto-mapped",
        }).onConflictDoNothing();
        supplierMapped++;
      }
    }

    res.json({
      accountsMapped: accountMapped,
      suppliersMapped: supplierMapped,
      totalCostCodes: companyCostCodes.length,
      totalSuppliers: companySuppliers.length,
      myobAccountsAvailable: accountItems.length,
      myobSuppliersAvailable: supplierItems.length,
      myobTaxCodesAvailable: taxItems.length,
    });
  } catch (err) {
    handleMyobError(err, res, "auto-map");
  }
});

export { router as importRouter };
