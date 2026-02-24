import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { createMyobClient } from "../../myob";
import logger from "../../lib/logger";
import { db } from "../../db";
import { myobSupplierMappings, suppliers } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { handleMyobError } from "./helpers";

const router = Router();

router.post("/api/myob/bulk-import-and-relink-suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    let allSuppliers: any[] = [];
    let result: any = await myob.getSuppliers();
    if (result && result.Items) {
      allSuppliers = allSuppliers.concat(result.Items);
      while (result.NextPageLink) {
        result = await myob.getSuppliers(`$top=400&$skip=${allSuppliers.length}`);
        if (result && result.Items) {
          allSuppliers = allSuppliers.concat(result.Items);
        } else {
          break;
        }
      }
    }
    const myobSuppliers = allSuppliers;

    if (myobSuppliers.length === 0) {
      return res.status(400).json({ error: "No suppliers returned from MYOB" });
    }

    logger.info({ count: myobSuppliers.length }, "[MYOB Bulk Import] Fetched suppliers from MYOB");

    let created = 0, linked = 0, skipped = 0;
    const nameToSupplierMap = new Map<string, string>();

    for (const contact of myobSuppliers) {
      const myobUid = contact.UID;
      const myobName = contact.Name || contact.CompanyName || "";
      const myobDisplayId = contact.DisplayID || null;

      if (!myobUid || !myobName) { skipped++; continue; }

      try {
        const normalizedName = myobName.trim().toUpperCase();
        if (nameToSupplierMap.has(normalizedName)) {
          skipped++;
          continue;
        }

        const existingSupplier = await db.select().from(suppliers)
          .where(and(eq(suppliers.companyId, companyId), sql`UPPER(TRIM(${suppliers.name})) = ${normalizedName}`))
          .limit(1);

        let supplierId: string;
        if (existingSupplier.length > 0) {
          supplierId = existingSupplier[0].id;
          linked++;
        } else {
          const [newSupplier] = await db.insert(suppliers).values({ companyId, name: myobName.trim() }).returning();
          supplierId = newSupplier.id;
          created++;
        }

        nameToSupplierMap.set(normalizedName, supplierId);

        const existingMapping = await db.select().from(myobSupplierMappings)
          .where(and(eq(myobSupplierMappings.companyId, companyId), eq(myobSupplierMappings.supplierId, supplierId)))
          .limit(1);

        if (existingMapping.length > 0) {
          await db.update(myobSupplierMappings)
            .set({ myobSupplierUid: myobUid, myobSupplierName: myobName.trim(), myobSupplierDisplayId: myobDisplayId, updatedAt: new Date() })
            .where(eq(myobSupplierMappings.id, existingMapping[0].id));
        } else {
          await db.insert(myobSupplierMappings).values({
            companyId, supplierId, myobSupplierUid: myobUid, myobSupplierName: myobName.trim(), myobSupplierDisplayId: myobDisplayId,
          });
        }
      } catch (itemErr) {
        logger.warn({ err: itemErr, myobName, myobUid }, "[MYOB Bulk Import] Failed to import supplier, skipping");
        skipped++;
      }
    }

    logger.info({ created, linked, skipped }, "[MYOB Bulk Import] Supplier import complete");

    const relinkResults: Array<{ supplierName: string; recordId: string; table: string; matched: boolean; newSupplierId?: string }> = [];
    let apUpdated = 0, assetUpdated = 0, hireUpdated = 0, capexUpdated = 0;

    const supplierNameCache = new Map<string, string>();

    await db.transaction(async (tx) => {
      const tempTableExists = await tx.execute(sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_temp_record_supplier_map') AS exists`);
      const hasTempRecordMap = (tempTableExists.rows[0] as any)?.exists === true;

      if (hasTempRecordMap) {
        const recordMap = await tx.execute(sql`SELECT record_id, old_supplier_name, table_name FROM _temp_record_supplier_map ORDER BY old_supplier_name`);

        for (const row of recordMap.rows as any[]) {
          const { record_id, old_supplier_name, table_name } = row;
          if (!old_supplier_name) continue;

          const normalizedName = old_supplier_name.trim().toUpperCase();
          let newSupplierId = supplierNameCache.get(normalizedName);

          if (!newSupplierId) {
            newSupplierId = nameToSupplierMap.get(normalizedName);
          }

          if (!newSupplierId) {
            const matchedSupplier = await tx.select().from(suppliers)
              .where(and(eq(suppliers.companyId, companyId), sql`UPPER(TRIM(${suppliers.name})) = ${normalizedName}`))
              .limit(1);
            if (matchedSupplier.length > 0) {
              newSupplierId = matchedSupplier[0].id;
            }
          }

          if (!newSupplierId) {
            const [newSupplier] = await tx.insert(suppliers).values({ companyId, name: old_supplier_name.trim() }).returning();
            newSupplierId = newSupplier.id;
            logger.info({ supplierName: old_supplier_name }, "[MYOB Bulk Import] Created non-MYOB supplier for re-linking");
          }

          supplierNameCache.set(normalizedName, newSupplierId);

          if (table_name === "ap_invoices") {
            await tx.execute(sql`UPDATE ap_invoices SET supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
            apUpdated++;
          } else if (table_name === "assets") {
            await tx.execute(sql`UPDATE assets SET supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
            assetUpdated++;
          } else if (table_name === "hire_bookings") {
            await tx.execute(sql`UPDATE hire_bookings SET supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
            hireUpdated++;
          } else if (table_name === "capex_requests") {
            await tx.execute(sql`UPDATE capex_requests SET preferred_supplier_id = ${newSupplierId} WHERE id = ${record_id}`);
            capexUpdated++;
          }

          relinkResults.push({ supplierName: old_supplier_name, recordId: record_id, table: table_name, matched: true, newSupplierId });
        }
      } else {
        logger.info("[MYOB Bulk Import] _temp_record_supplier_map table not found, skipping re-link phase");
      }

      const tempNamesExists = await tx.execute(sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_temp_supplier_names') AS exists`);
      const hasTempNames = (tempNamesExists.rows[0] as any)?.exists === true;

      if (hasTempNames) {
        const assetSupplierNames = await tx.execute(sql`SELECT DISTINCT old_supplier_id, supplier_name FROM _temp_supplier_names WHERE supplier_name IS NOT NULL AND supplier_name != '' AND table_name = 'assets' ORDER BY supplier_name`);
        for (const row of assetSupplierNames.rows as any[]) {
          const { supplier_name } = row;
          if (!supplier_name) continue;
          const normalizedName = supplier_name.trim().toUpperCase();
          if (!supplierNameCache.has(normalizedName) && !nameToSupplierMap.has(normalizedName)) {
            const matchedSupplier = await tx.select().from(suppliers)
              .where(and(eq(suppliers.companyId, companyId), sql`UPPER(TRIM(${suppliers.name})) = ${normalizedName}`))
              .limit(1);
            if (matchedSupplier.length === 0) {
              const [newSupplier] = await tx.insert(suppliers).values({ companyId, name: supplier_name.trim() }).returning();
              supplierNameCache.set(normalizedName, newSupplier.id);
            }
          }
        }
      } else {
        logger.info("[MYOB Bulk Import] _temp_supplier_names table not found, skipping asset supplier name phase");
      }
    });

    res.json({
      import: { created, linked, skipped, totalMyob: myobSuppliers.length },
      relink: relinkResults,
    });
  } catch (err) {
    handleMyobError(err, res, "bulk-import-and-relink-suppliers");
  }
});

export { router as bulkImportRouter };
