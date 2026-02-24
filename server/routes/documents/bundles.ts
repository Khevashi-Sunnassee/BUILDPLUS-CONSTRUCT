import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage, db } from "../../storage";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { documents, documentBundles, documentBundleItems, insertDocumentBundleSchema } from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import logger from "../../lib/logger";
import { openai } from "./shared";

const router = Router();

// ==================== DOCUMENT BUNDLES ====================

router.get("/api/document-bundles", requireAuth, async (req, res) => {
  try {
    const jobId = req.query.jobId as string | undefined;
    if (jobId) {
      const companyId = req.session.companyId!;
      const bundles = await db
        .select()
        .from(documentBundles)
        .where(and(
          or(eq(documentBundles.jobId, jobId), isNull(documentBundles.jobId)),
          eq(documentBundles.companyId, companyId),
        ))
        .orderBy(desc(documentBundles.createdAt))
        .limit(1000);
      return res.json(bundles);
    }
    const bundles = await storage.getAllDocumentBundles(req.companyId);
    res.json(bundles);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document bundles");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/document-bundles/:id", requireAuth, async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundle(String(req.params.id));
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/document-bundles/qr/:qrCodeId", requireAuth, async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching document bundle by QR");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/document-bundles", requireAuth, async (req, res) => {
  try {
    const { bundleName, description, jobId, supplierId, allowGuestAccess, expiresAt, documentIds } = req.body;

    if (!bundleName) {
      return res.status(400).json({ error: "Bundle name is required" });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    let finalDescription = description || null;

    if (!finalDescription && documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      try {
        const bundleDocs = await storage.getDocumentsByIds(documentIds);
        const docDetails: string[] = [];
        for (const doc of bundleDocs) {
          const parts = [doc.title];
          if (doc.type?.typeName) parts.push(`(${doc.type.typeName})`);
          if (doc.discipline?.disciplineName) parts.push(`[${doc.discipline.disciplineName}]`);
          docDetails.push(parts.join(" "));
        }

        if (docDetails.length > 0) {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a document management assistant for a construction/precast company. Generate a brief 1-2 sentence description of what a document bundle contains based on the document names provided. Be concise and professional. Do not use quotes around the description."
              },
              {
                role: "user",
                content: `Bundle name: "${bundleName}"\nDocuments included:\n${docDetails.map((d, i) => `${i + 1}. ${d}`).join("\n")}`
              }
            ],
            max_completion_tokens: 100,
          });
          finalDescription = completion.choices[0]?.message?.content?.trim() || null;
        }
      } catch (aiError) {
        logger.warn({ err: aiError }, "Failed to generate AI bundle description, continuing without it");
      }
    }

    const qrCodeId = `bundle-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

    const bundle = await storage.createDocumentBundle({
      companyId,
      bundleName,
      description: finalDescription,
      qrCodeId,
      jobId: jobId || null,
      supplierId: supplierId || null,
      isPublic: false,
      allowGuestAccess: allowGuestAccess || false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.session.userId!,
    });

    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      await storage.addDocumentsToBundle(bundle.id, documentIds, req.session.userId!);
    }

    const fullBundle = await storage.getDocumentBundle(bundle.id);
    res.json(fullBundle);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating document bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/document-bundles/:id", requireAuth, async (req, res) => {
  try {
    const parsed = insertDocumentBundleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const bundle = await storage.updateDocumentBundle(String(req.params.id), {
      ...parsed.data,
      updatedBy: req.session.userId,
    });
    if (!bundle) return res.status(404).json({ error: "Document bundle not found" });
    res.json(bundle);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating document bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/document-bundles/:id/documents", requireAuth, async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({ error: "documentIds array is required" });
    }

    const items = await storage.addDocumentsToBundle(String(req.params.id), documentIds, req.session.userId!);
    res.json(items);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error adding documents to bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/document-bundles/:bundleId/documents/:documentId", requireAuth, async (req, res) => {
  try {
    await storage.removeDocumentFromBundle(String(req.params.bundleId), String(req.params.documentId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error removing document from bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/document-bundles/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundle(String(req.params.id));
    if (!bundle || bundle.companyId !== req.companyId) {
      return res.status(404).json({ error: "Bundle not found" });
    }
    await storage.deleteDocumentBundle(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting document bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/document-bundles/:bundleId/items/:itemId/request-latest", requireAuth, async (req, res) => {
  try {
    const bundleId = req.params.bundleId as string;
    const itemId = req.params.itemId as string;
    const companyId = req.companyId;

    const bundle = await storage.getDocumentBundle(bundleId);
    if (!bundle || bundle.companyId !== companyId) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    const bundleItem = bundle.items.find(item => item.id === itemId);
    if (!bundleItem) {
      return res.status(404).json({ error: "Bundle item not found" });
    }

    const currentDoc = bundleItem.document;
    if (!currentDoc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (currentDoc.isLatestVersion) {
      return res.status(400).json({ error: "Document is already the latest version" });
    }

    let latestDoc = null;
    if (currentDoc.documentNumber) {
      const [latest] = await db.select().from(documents)
        .where(and(
          eq(documents.documentNumber, currentDoc.documentNumber),
          eq(documents.companyId, companyId),
          eq(documents.isLatestVersion, true)
        ))
        .limit(1);
      latestDoc = latest;
    }

    if (!latestDoc) {
      const allVersions = await db.select().from(documents)
        .where(and(
          eq(documents.companyId, companyId),
          eq(documents.isLatestVersion, true),
          eq(documents.parentDocumentId, currentDoc.parentDocumentId || currentDoc.id)
        ))
        .limit(200);
      if (allVersions.length > 0) {
        latestDoc = allVersions[0];
      }
    }

    if (!latestDoc) {
      return res.status(404).json({ error: "Latest version not found" });
    }

    await db.update(documentBundleItems)
      .set({ documentId: latestDoc.id })
      .where(eq(documentBundleItems.id, itemId));

    const updatedBundle = await storage.getDocumentBundle(bundleId);
    res.json({ success: true, bundle: updatedBundle });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating bundle item to latest version");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/document-bundles/:bundleId/notify-updates", requireAuth, async (req, res) => {
  try {
    const bundleId = req.params.bundleId as string;
    const companyId = req.companyId;

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      recipientEmail: z.string().email(),
      recipientName: z.string().optional(),
      updatedDocuments: z.array(z.object({
        documentTitle: z.string(),
        documentNumber: z.string().optional(),
        oldVersion: z.string().optional(),
        newVersion: z.string().optional(),
      })).min(1),
    });
    const data = schema.parse(req.body);

    const bundle = await storage.getDocumentBundle(bundleId);
    if (!bundle || bundle.companyId !== companyId) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    const docListHtml = data.updatedDocuments.map(d =>
      `<li><strong>${d.documentTitle}</strong>${d.documentNumber ? ` (${d.documentNumber})` : ""}${d.oldVersion && d.newVersion ? ` — updated from v${d.oldVersion} to v${d.newVersion}` : ""}</li>`
    ).join("");

    const htmlBody = await buildBrandedEmail({
      title: `Document Bundle Update Notice`,
      recipientName: data.recipientName || "Recipient",
      body: `<p>Please be advised that the following documents in bundle <strong>${bundle.bundleName}</strong> have been updated:</p>
      <ul>${docListHtml}</ul>
      <p>Please ensure you are referencing the latest versions of these documents.</p>`,
      companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to: data.recipientEmail,
      subject: `Document Bundle Update - ${bundle.bundleName}`,
      body: htmlBody,
    });

    if (result.success) {
      res.json({ sent: true, messageId: result.messageId, recipientEmail: data.recipientEmail });
    } else {
      res.status(500).json({ sent: false, error: result.error });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error({ err: error }, "Error sending bundle update notification");
    res.status(500).json({ error: "Failed to send notification" });
  }
});

router.get("/api/document-bundles/:id/access-logs", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const logs = await storage.getBundleAccessLogs(String(req.params.id));
    res.json(logs);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching bundle access logs");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
