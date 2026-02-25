import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { sendPoEmailWithPdfSchema, sendPoEmailSchema } from "./shared";

const router = Router();

router.get("/purchase-orders/:id/pdf", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id as string;
    const po = await storage.getPurchaseOrder(id);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const settings = await storage.getGlobalSettings(companyId);
    const { generatePurchaseOrderPdf } = await import("../../services/po-pdf.service");
    const termsData = settings ? { poTermsHtml: settings.poTermsHtml, includePOTerms: settings.includePOTerms } : null;
    const pdfBuffer = generatePurchaseOrderPdf(po, po.items || [], settings ? { logoBase64: settings.logoBase64, userLogoBase64: settings.userLogoBase64, companyName: settings.companyName } : null, termsData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${po.poNumber || "PurchaseOrder"}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating PO PDF");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/purchase-orders/:id/send-with-pdf", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id as string;
    const parsed = sendPoEmailWithPdfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, sendCopy } = parsed.data;

    const po = await storage.getPurchaseOrder(id);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure the Resend email integration." });
    }

    const settings = await storage.getGlobalSettings(companyId);
    const { generatePurchaseOrderPdf } = await import("../../services/po-pdf.service");
    const termsData = settings ? { poTermsHtml: settings.poTermsHtml, includePOTerms: settings.includePOTerms } : null;
    const pdfBuffer = generatePurchaseOrderPdf(po, po.items || [], settings ? { logoBase64: settings.logoBase64, userLogoBase64: settings.userLogoBase64, companyName: settings.companyName } : null, termsData);

    const attachments = [{
      filename: `${po.poNumber || "PurchaseOrder"}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }];

    let bcc: string | undefined;
    let senderName = "A team member";
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (sendCopy && currentUser?.email) {
        bcc = currentUser.email;
      }
      if (currentUser) {
        senderName = currentUser.name || currentUser.email;
      }
    }

    const htmlBody = await buildBrandedEmail({
      title: `Purchase Order: ${po.poNumber || "PO"}`,
      subtitle: `Sent by ${senderName}`,
      body: message.replace(/\n/g, "<br>"),
      footerNote: "Please review the attached purchase order. If you have any questions, reply directly to this email.",
      companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments,
    });

    if (result.success) {
      logger.info({ poId: id, poNumber: po.poNumber, to }, "PO email with server-generated PDF sent successfully");
      res.json({ success: true, messageId: result.messageId });
    } else {
      logger.error({ poId: id, error: result.error }, "Failed to send PO email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending PO email with PDF");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/purchase-orders/:id/send-email", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = req.params.id as string;
    const parsed = sendPoEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, attachPdf, sendCopy, pdfBase64 } = parsed.data;

    const po = await storage.getPurchaseOrder(id);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure the Resend email integration." });
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (attachPdf && pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      attachments.push({
        filename: `${po.poNumber || "PurchaseOrder"}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }

    let bcc: string | undefined;
    let senderName = "A team member";
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (sendCopy && currentUser?.email) {
        bcc = currentUser.email;
      }
      if (currentUser) {
        senderName = currentUser.name || currentUser.email;
      }
    }

    const htmlBody = await buildBrandedEmail({
      title: `Purchase Order: ${po.poNumber || "PO"}`,
      subtitle: `Sent by ${senderName}`,
      body: message.replace(/\n/g, "<br>"),
      footerNote: "Please review the attached purchase order. If you have any questions, reply directly to this email.",
      companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (result.success) {
      logger.info({ poId: id, poNumber: po.poNumber, to }, "PO email sent successfully");
      res.json({ success: true, messageId: result.messageId });
    } else {
      logger.error({ poId: id, error: result.error }, "Failed to send PO email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending PO email");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
