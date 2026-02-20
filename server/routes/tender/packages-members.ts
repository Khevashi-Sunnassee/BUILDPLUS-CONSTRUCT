import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenders, tenderPackages, tenderMembers, suppliers, costCodes, documents, documentBundles, documentBundleItems } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { isValidId, verifyTenderOwnership } from "./shared";

const router = Router();

router.get("/api/tenders/:id/members", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, req.params.id))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          keyContact: suppliers.keyContact,
          defaultCostCodeId: suppliers.defaultCostCodeId,
        },
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .leftJoin(costCodes, eq(suppliers.defaultCostCodeId, costCodes.id))
      .where(and(eq(tenderMembers.tenderId, req.params.id), eq(tenderMembers.companyId, companyId)))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.member,
      supplier: row.supplier,
      costCode: row.costCode?.id ? row.costCode : null,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender members:", error);
    res.status(500).json({ message: "Failed to fetch tender members", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:id/packages", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        pkg: tenderPackages,
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          qrCodeId: documentBundles.qrCodeId,
        },
        document: {
          id: documents.id,
          title: documents.title,
          documentNumber: documents.documentNumber,
          version: documents.version,
          revision: documents.revision,
          isLatestVersion: documents.isLatestVersion,
          status: documents.status,
          fileName: documents.fileName,
        },
      })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .leftJoin(documents, eq(tenderPackages.documentId, documents.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder))
      .limit(1000);

    const mapped: any[] = [];

    for (const r of results) {
      if (r.document?.id) {
        mapped.push({
          ...r.pkg,
          bundle: r.bundle?.id ? r.bundle : null,
          document: { ...r.document, isStale: r.document.isLatestVersion === false },
        });
      } else if (r.bundle?.id) {
        const bundleDocs = await db
          .select({
            bundleItem: documentBundleItems,
            document: {
              id: documents.id,
              title: documents.title,
              documentNumber: documents.documentNumber,
              version: documents.version,
              revision: documents.revision,
              isLatestVersion: documents.isLatestVersion,
              status: documents.status,
              fileName: documents.fileName,
            },
          })
          .from(documentBundleItems)
          .innerJoin(documents, eq(documentBundleItems.documentId, documents.id))
          .where(eq(documentBundleItems.bundleId, r.bundle.id))
          .orderBy(asc(documentBundleItems.sortOrder))
          .limit(1000);

        if (bundleDocs.length > 0) {
          for (const bd of bundleDocs) {
            mapped.push({
              ...r.pkg,
              id: `${r.pkg.id}-${bd.document.id}`,
              bundle: r.bundle,
              document: { ...bd.document, isStale: bd.document.isLatestVersion === false },
            });
          }
        } else {
          mapped.push({
            ...r.pkg,
            bundle: r.bundle,
            document: null,
          });
        }
      } else {
        mapped.push({
          ...r.pkg,
          bundle: null,
          document: null,
        });
      }
    }

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender packages:", error);
    res.status(500).json({ message: "Failed to fetch tender packages", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/duplicate-package", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const schema = z.object({
      supersededDocumentId: z.string(),
      newDocumentId: z.string(),
      copyExisting: z.boolean().default(true),
    });
    const data = schema.parse(req.body);

    const packages = await db
      .select({ pkg: tenderPackages, bundle: { id: documentBundles.id, bundleName: documentBundles.bundleName } })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .limit(1000);

    let updatedDirectCount = 0;
    let updatedBundleCount = 0;

    for (const pkg of packages) {
      if (pkg.pkg.documentId === data.supersededDocumentId) {
        await db.update(tenderPackages)
          .set({ documentId: data.newDocumentId })
          .where(eq(tenderPackages.id, pkg.pkg.id));
        updatedDirectCount++;
      }

      if (pkg.pkg.bundleId) {
        const bundleItems = await db
          .select()
          .from(documentBundleItems)
          .where(and(eq(documentBundleItems.bundleId, pkg.pkg.bundleId), eq(documentBundleItems.documentId, data.supersededDocumentId)))
          .limit(1000);

        for (const item of bundleItems) {
          await db.update(documentBundleItems)
            .set({ documentId: data.newDocumentId })
            .where(eq(documentBundleItems.id, item.id));
          updatedBundleCount++;
        }
      }
    }

    const updatedPackages = await db
      .select({ pkg: tenderPackages, document: { id: documents.id, title: documents.title, documentNumber: documents.documentNumber }, bundle: { id: documentBundles.id, bundleName: documentBundles.bundleName } })
      .from(tenderPackages)
      .leftJoin(documents, eq(tenderPackages.documentId, documents.id))
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder))
      .limit(1000);

    const mappedPkgs = updatedPackages.map(p => ({
      ...p.pkg,
      document: p.document?.id ? p.document : null,
      bundle: p.bundle?.id ? p.bundle : null,
    }));

    res.json({ message: "Package updated successfully", updatedDirectCount, updatedBundleCount, packages: mappedPkgs });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error duplicating tender package:", error);
    res.status(500).json({ message: "Failed to update tender package", code: "INTERNAL_ERROR" });
  }
});

export default router;
