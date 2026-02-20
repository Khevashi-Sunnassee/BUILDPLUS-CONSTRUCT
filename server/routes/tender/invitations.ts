import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenders, tenderPackages, tenderMembers, tenderScopes, scopes, scopeItems, scopeTrades, suppliers, costCodes, documentBundles } from "@shared/schema";
import { eq, and, asc, sql, inArray, isNotNull } from "drizzle-orm";
import QRCode from "qrcode";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { isValidId, verifyTenderOwnership } from "./shared";

const router = Router();

router.post("/api/tenders/:id/send-invitations", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      memberIds: z.array(z.string()).min(1, "At least one member is required"),
      subject: z.string().min(1, "Subject is required"),
      message: z.string().min(1, "Message is required"),
    });

    const data = schema.parse(req.body);

    const members = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(
        inArray(tenderMembers.id, data.memberIds),
        eq(tenderMembers.tenderId, tenderId),
        eq(tenderMembers.companyId, companyId),
      ))
      .limit(1000);

    const packages = await db
      .select({
        pkg: tenderPackages,
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          qrCodeId: documentBundles.qrCodeId,
          description: documentBundles.description,
        },
      })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder))
      .limit(1000);

    const seenBundleIds = new Set<string>();
    const bundlesWithQr = packages
      .filter(p => {
        if (!p.bundle?.id || !p.bundle?.qrCodeId) return false;
        if (seenBundleIds.has(p.bundle.id)) return false;
        seenBundleIds.add(p.bundle.id);
        return true;
      })
      .map(p => ({
        bundleName: p.bundle!.bundleName,
        qrCodeId: p.bundle!.qrCodeId,
        description: p.bundle!.description,
      }));

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const qrDataUrls: Record<string, string> = {};
    for (const bundle of bundlesWithQr) {
      try {
        const bundleUrl = `${baseUrl}/bundle/${bundle.qrCodeId}`;
        const qrDataUrl = await QRCode.toDataURL(bundleUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        qrDataUrls[bundle.qrCodeId] = qrDataUrl;
      } catch (qrErr) {
        logger.warn({ err: qrErr, qrCodeId: bundle.qrCodeId }, "Failed to generate QR code for bundle");
      }
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ memberId: string; supplierName: string | null; status: string; error?: string }> = [];

    for (const row of members) {
      const email = row.supplier?.email;
      if (!email) {
        failed++;
        results.push({ memberId: row.member.id, supplierName: row.supplier?.name || null, status: "failed", error: "No email address" });
        continue;
      }

      try {
        let bundleSection = "";
        if (bundlesWithQr.length > 0) {
          const bundleItems = bundlesWithQr.map(bundle => {
            const bundleUrl = `${baseUrl}/bundle/${bundle.qrCodeId}`;
            const qrImg = qrDataUrls[bundle.qrCodeId]
              ? `<div style="margin: 12px 0; text-align: center;"><img src="${qrDataUrls[bundle.qrCodeId]}" alt="QR Code for ${bundle.bundleName}" width="180" height="180" style="border: 1px solid #e0e0e0; border-radius: 8px;" /></div>`
              : "";
            return `
              <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <h3 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 16px;">${bundle.bundleName}</h3>
                ${bundle.description ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${bundle.description}</p>` : ""}
                ${qrImg}
                <div style="text-align: center; margin-top: 12px;">
                  <a href="${bundleUrl}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Tender Documents</a>
                </div>
                <p style="margin: 12px 0 0 0; text-align: center; font-size: 12px; color: #888;">
                  Or copy this link: <a href="${bundleUrl}" style="color: #2563eb; word-break: break-all;">${bundleUrl}</a>
                </p>
              </div>`;
          }).join("");

          bundleSection = `
            <div style="margin-top: 24px; border-top: 2px solid #2563eb; padding-top: 20px;">
              <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 18px;">Tender Document${bundlesWithQr.length > 1 ? "s" : ""}</h2>
              <p style="margin: 0 0 16px 0; color: #555; font-size: 14px;">Please review the following document${bundlesWithQr.length > 1 ? " bundles" : " bundle"} for this tender. You can scan the QR code or click the link below to access the documents.</p>
              ${bundleItems}
            </div>`;
        }

        const htmlBody = await buildBrandedEmail({
          title: "Tender Invitation",
          recipientName: row.supplier?.name || undefined,
          body: `<div style="margin-bottom: 24px;">
              ${data.message.replace(/\n/g, "<br>")}
            </div>
            ${bundleSection}`,
          companyId,
        });

        await emailService.sendEmailWithAttachment({ to: email, subject: data.subject, body: htmlBody });

        await db.update(tenderMembers)
          .set({ status: "SENT", sentAt: new Date() })
          .where(eq(tenderMembers.id, row.member.id));

        sent++;
        results.push({ memberId: row.member.id, supplierName: row.supplier?.name || null, status: "sent" });
      } catch (emailError: unknown) {
        failed++;
        results.push({ memberId: row.member.id, supplierName: row.supplier?.name || null, status: "failed", error: emailError instanceof Error ? emailError.message : "Send failed" });
      }
    }

    res.json({ sent, failed, results, bundlesIncluded: bundlesWithQr.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending tender invitations:", error);
    res.status(500).json({ message: "Failed to send invitations", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/notify-doc-updates", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      changedDocuments: z.array(z.object({
        documentTitle: z.string(),
        documentNumber: z.string().optional(),
        oldVersion: z.string().optional(),
        newVersion: z.string().optional(),
      })).min(1),
      newDocumentId: z.string().optional(),
      supersededDocumentId: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [tender] = await db.select().from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    const memberRows = await db
      .select({ member: tenderMembers, supplier: { id: suppliers.id, name: suppliers.name, email: suppliers.email } })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(eq(tenderMembers.tenderId, tenderId), eq(tenderMembers.companyId, companyId)))
      .limit(1000);

    let sent = 0;
    let failed = 0;
    const results: Array<{ supplierName: string | null; status: string; error?: string }> = [];

    const docListHtml = data.changedDocuments.map(d =>
      `<li><strong>${d.documentTitle}</strong>${d.documentNumber ? ` (${d.documentNumber})` : ""}${d.oldVersion && d.newVersion ? ` — updated from v${d.oldVersion} to v${d.newVersion}` : ""}</li>`
    ).join("");

    for (const row of memberRows) {
      const email = row.supplier?.email;
      if (!email) { failed++; results.push({ supplierName: row.supplier?.name || null, status: "failed", error: "No email" }); continue; }

      try {
        const htmlBody = await buildBrandedEmail({
          title: "Document Update Notice",
          recipientName: row.supplier?.name || "Supplier",
          body: `<p>Please be advised that the following documents have been updated for tender <strong>${tender.tenderNumber} - ${tender.title}</strong>:</p>
          <ul>${docListHtml}</ul>
          <p>Please ensure you are referencing the latest versions when preparing your submission.</p>`,
          companyId,
        });

        await emailService.sendEmailWithAttachment({ to: email, subject: `Document Update - Tender ${tender.tenderNumber}: ${tender.title}`, body: htmlBody });
        sent++;
        results.push({ supplierName: row.supplier?.name || null, status: "sent" });
      } catch (emailError: unknown) {
        failed++;
        results.push({ supplierName: row.supplier?.name || null, status: "failed", error: emailError instanceof Error ? emailError.message : "Send failed" });
      }
    }

    res.json({ sent, failed, results });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending document update notifications:", error);
    res.status(500).json({ message: "Failed to send notifications", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/members/:memberId/send-invite", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id: tenderId, memberId } = req.params;
    if (!isValidId(tenderId) || !isValidId(memberId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      subject: z.string().min(1, "Subject is required"),
      message: z.string().min(1, "Message is required"),
    });
    const data = schema.parse(req.body);

    const [row] = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(eq(tenderMembers.id, memberId), eq(tenderMembers.tenderId, tenderId), eq(tenderMembers.companyId, companyId)));

    if (!row) return res.status(404).json({ message: "Member not found", code: "NOT_FOUND" });

    const email = row.supplier?.email;
    if (!email) return res.status(400).json({ message: "Supplier has no email address", code: "VALIDATION_ERROR" });

    const [tender] = await db
      .select({ tenderNumber: tenders.tenderNumber, title: tenders.title })
      .from(tenders)
      .where(eq(tenders.id, tenderId));

    const pkgRows = await db
      .select({
        pkg: tenderPackages,
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          qrCodeId: documentBundles.qrCodeId,
          description: documentBundles.description,
        },
      })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), isNotNull(tenderPackages.bundleId)))
      .limit(1000);

    let bundleSection = "";
    const bundlesWithQr = pkgRows.filter(p => p.bundle?.qrCodeId);
    if (bundlesWithQr.length > 0) {
      const bundleItems = (await Promise.all(bundlesWithQr.map(async (p) => {
        const bundleUrl = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : ""}/bundles/${p.bundle!.qrCodeId}`;
        let qrImg = "";
        try {
          const qrDataUrl = await QRCode.toDataURL(bundleUrl, { width: 150, margin: 1 });
          qrImg = `<div style="text-align: center; margin: 12px 0;"><img src="${qrDataUrl}" alt="QR Code" style="width: 150px; height: 150px;" /></div>`;
        } catch { /* skip QR */ }
        return `<div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <h3 style="margin: 0 0 4px 0; font-size: 16px;">${p.bundle!.bundleName}</h3>
          ${qrImg}
          <div style="text-align: center; margin-top: 12px;">
            <a href="${bundleUrl}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px;">View Tender Documents</a>
          </div>
        </div>`;
      }))).join("");

      bundleSection = `<div style="margin-top: 24px; border-top: 2px solid #2563eb; padding-top: 20px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px;">Tender Documents</h2>
        ${bundleItems}
      </div>`;
    }

    let scopeSection = "";
    try {
      const supplierCostCode = row.supplier?.id
        ? await db.select({ id: costCodes.id, name: costCodes.name })
            .from(suppliers)
            .innerJoin(costCodes, eq(suppliers.defaultCostCodeId, costCodes.id))
            .where(eq(suppliers.id, row.supplier.id))
            .then(rows => rows[0] || null)
        : null;

      if (supplierCostCode) {
        const linkedScopeRows = await db
          .select({
            scopeId: tenderScopes.scopeId,
            scopeName: scopes.name,
            tradeName: scopeTrades.name,
          })
          .from(tenderScopes)
          .innerJoin(scopes, eq(tenderScopes.scopeId, scopes.id))
          .innerJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
          .where(and(
            eq(tenderScopes.tenderId, tenderId),
            eq(tenderScopes.companyId, companyId),
            sql`(${scopeTrades.costCodeId} = ${supplierCostCode.id} OR (${scopeTrades.costCodeId} IS NULL AND LOWER(${scopeTrades.name}) = LOWER(${supplierCostCode.name})))`
          ))
          .limit(1000);

        if (linkedScopeRows.length > 0) {
          const scopeIds = linkedScopeRows.map(s => s.scopeId);
          const allItems = await db
            .select({
              scopeId: scopeItems.scopeId,
              category: scopeItems.category,
              description: scopeItems.description,
              status: scopeItems.status,
              sortOrder: scopeItems.sortOrder,
            })
            .from(scopeItems)
            .where(and(
              inArray(scopeItems.scopeId, scopeIds),
              eq(scopeItems.status, "INCLUDED")
            ))
            .orderBy(asc(scopeItems.sortOrder))
            .limit(5000);

          const scopeBlocks = linkedScopeRows.map(scope => {
            const items = allItems.filter(i => i.scopeId === scope.scopeId);
            const grouped = new Map<string, typeof items>();
            for (const item of items) {
              const cat = item.category || "General";
              if (!grouped.has(cat)) grouped.set(cat, []);
              grouped.get(cat)!.push(item);
            }

            let itemsHtml = "";
            for (const [category, catItems] of grouped) {
              itemsHtml += `<tr style="background-color: #e2e8f0;">
                <td colspan="2" style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">${category}</td>
              </tr>`;
              for (const item of catItems) {
                itemsHtml += `<tr>
                  <td style="padding: 6px 8px; font-size: 13px; color: #334155;">${item.description}</td>
                  <td style="padding: 6px 8px; font-size: 12px; text-align: center;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background-color: #dcfce7; color: #166534;">Included</span>
                  </td>
                </tr>`;
              }
            }

            return `<div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <h3 style="margin: 0 0 4px 0; font-size: 16px;">${scope.scopeName}</h3>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">Trade: ${scope.tradeName}</p>
              ${items.length > 0 ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 4px;">
                <tr style="background-color: #cbd5e1;">
                  <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #334155; text-transform: uppercase;">Description</td>
                  <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #334155; text-transform: uppercase; text-align: center; width: 80px;">Status</td>
                </tr>
                ${itemsHtml}
              </table>` : `<p style="font-size: 13px; color: #94a3b8;">No included items</p>`}
            </div>`;
          }).join("");

          scopeSection = `<div style="margin-top: 24px; border-top: 2px solid #16a34a; padding-top: 20px;">
            <h2 style="margin: 0 0 16px 0; font-size: 18px;">Scope of Works</h2>
            ${scopeBlocks}
          </div>`;
        }
      }
    } catch (scopeErr) {
      logger.warn({ err: scopeErr }, "Failed to load scopes for tender invitation, skipping scope section");
    }

    const htmlBody = await buildBrandedEmail({
      title: "Tender Invitation",
      recipientName: row.supplier?.name || undefined,
      body: `<div style="margin-bottom: 24px;">${data.message.replace(/\n/g, "<br>")}</div>${bundleSection}${scopeSection}`,
      companyId,
    });

    await emailService.sendEmailWithAttachment({ to: email, subject: data.subject, body: htmlBody });

    await db.update(tenderMembers)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(tenderMembers.id, memberId));

    res.json({ success: true, supplierName: row.supplier?.name });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending single tender invite:", error);
    res.status(500).json({ message: "Failed to send invitation", code: "INTERNAL_ERROR" });
  }
});

export default router;
