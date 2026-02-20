import { Router } from "express";
import archiver from "archiver";
import { PassThrough } from "stream";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import logger from "../../lib/logger";
import {
  objectStorageService,
  generateDocumentDownloadToken,
  generateBulkDownloadToken,
  formatFileSizeServer,
} from "./shared";

const router = Router();

const sendDocumentsEmailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  documentIds: z.array(z.string()).min(1, "At least one document is required"),
  sendCopy: z.boolean().default(false),
  combinePdf: z.boolean().default(false),
  sendAsLinks: z.boolean().default(false),
});

router.post("/api/documents/send-email", requireAuth, async (req, res) => {
  try {
    const parsed = sendDocumentsEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { to, cc, subject, message, documentIds, sendCopy, combinePdf, sendAsLinks } = parsed.data;
    const companyId = req.companyId;

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured. Please configure the Resend email integration." });
    }

    const docs = await storage.getDocumentsByIds(documentIds);
    const docsMap = new Map(docs.map(d => [d.id, d]));

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

    if (sendAsLinks) {
      const appDomain = process.env.APP_URL
        || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "")
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "")
        || `${req.protocol}://${req.get("host")}`;

      if (!appDomain) {
        return res.status(500).json({ error: "Cannot generate download links: application URL is not configured" });
      }

      const linkItems: Array<{ title: string; originalName: string; revision: string; fileSize: number; downloadUrl: string }> = [];
      const failedDocs: string[] = [];

      for (const docId of documentIds) {
        const doc = docsMap.get(docId);
        if (!doc) {
          failedDocs.push(`Unknown document (${docId})`);
          continue;
        }
        const token = generateDocumentDownloadToken(docId);
        const downloadUrl = `${appDomain}/api/public/documents/${token}/download`;
        linkItems.push({
          title: doc.title,
          originalName: doc.originalName,
          revision: doc.revision || "-",
          fileSize: doc.fileSize || 0,
          downloadUrl,
        });
      }

      if (linkItems.length === 0) {
        return res.status(400).json({ error: `Could not generate links: ${failedDocs.join(", ")}` });
      }

      const bulkToken = generateBulkDownloadToken(documentIds.filter(id => docsMap.has(id)));
      const bulkDownloadUrl = `${appDomain}/api/public/documents/bulk/${bulkToken}/download`;

      const linksHtml = linkItems.map(item => `<tr>
        <td style="padding: 8px; font-size: 13px; color: #334155;">${item.title}</td>
        <td style="padding: 8px; font-size: 13px; color: #64748b;">${item.originalName}</td>
        <td style="padding: 8px; font-size: 13px; color: #64748b;">${item.revision}</td>
        <td style="padding: 8px; font-size: 13px; color: #64748b;">${formatFileSizeServer(item.fileSize)}</td>
        <td style="padding: 8px;">
          <a href="${item.downloadUrl}" style="display: inline-block; padding: 6px 16px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600;">Download</a>
        </td>
      </tr>`).join("");

      const totalSize = linkItems.reduce((sum, item) => sum + item.fileSize, 0);

      const attachmentSummary = `
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #334155;">${linkItems.length} Document${linkItems.length !== 1 ? "s" : ""} Available for Download:</p>
        <p style="margin: 0 0 12px 0; font-size: 11px; color: #94a3b8;">Links expire after 7 days</p>
        <div style="margin: 0 0 16px 0; text-align: center;">
          <a href="${bulkDownloadUrl}" style="display: inline-block; padding: 10px 28px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 700;">Download All as ZIP (${formatFileSizeServer(totalSize)})</a>
        </div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          <tr style="background-color: #e2e8f0;">
            <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Title</td>
            <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">File</td>
            <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Rev</td>
            <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Size</td>
            <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;"></td>
          </tr>
          ${linksHtml}
        </table>`;

      const htmlBody = await buildBrandedEmail({
        title: "Documents Shared With You",
        subtitle: `Sent by ${senderName}`,
        body: message.replace(/\n/g, "<br>"),
        attachmentSummary,
        footerNote: "Click the download buttons above to save documents. Links are valid for 7 days. If you have any questions, reply directly to this email.",
        companyId,
      });

      const result = await emailService.sendEmailWithAttachment({
        to,
        cc: cc || undefined,
        bcc,
        subject,
        body: htmlBody,
      });

      if (result.success) {
        logger.info({ documentCount: linkItems.length, to, mode: "links" }, "Documents email sent with download links");
        res.json({ success: true, messageId: result.messageId, attachedCount: linkItems.length, sentAsLinks: true });
      } else {
        logger.error({ error: result.error }, "Failed to send documents email (links mode)");
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
      return;
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    const failedDocs: string[] = [];

    for (const docId of documentIds) {
      try {
        const doc = docsMap.get(docId);
        if (!doc) {
          failedDocs.push(`Unknown document (${docId})`);
          logger.warn({ docId }, "Document not found for email attachment, skipping");
          continue;
        }

        const objectFile = await objectStorageService.getObjectEntityFile(doc.storageKey);
        const [metadata] = await objectFile.getMetadata();

        const chunks: Buffer[] = [];
        const stream = objectFile.createReadStream();
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve());
          stream.on("error", (err: Error) => reject(err));
        });

        attachments.push({
          filename: doc.originalName,
          content: Buffer.concat(chunks),
          contentType: (metadata as Record<string, string>).contentType || "application/octet-stream",
        });
      } catch (err) {
        const doc = docsMap.get(docId);
        failedDocs.push(doc ? `${doc.title} (${doc.originalName})` : docId);
        logger.warn({ docId, err }, "Failed to load document for email attachment, skipping");
      }
    }

    if (attachments.length === 0) {
      const failedList = failedDocs.join(", ");
      return res.status(400).json({ error: `Could not load document files for attachment: ${failedList}. The files may have been deleted from storage.` });
    }

    const docListHtml = docs
      .filter(d => d !== undefined)
      .map(d => `<tr>
        <td style="padding: 4px 8px; font-size: 13px; color: #334155;">${d.title}</td>
        <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">${d.originalName}</td>
        <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">${d.revision || "-"}</td>
      </tr>`)
      .join("");

    const attachmentSummary = `
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #334155;">${attachments.length} Document${attachments.length !== 1 ? "s" : ""} Attached:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr style="background-color: #e2e8f0;">
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Title</td>
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">File</td>
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Rev</td>
        </tr>
        ${docListHtml}
      </table>`;

    const htmlBody = await buildBrandedEmail({
      title: "Documents Shared With You",
      subtitle: `Sent by ${senderName}`,
      body: message.replace(/\n/g, "<br>"),
      attachmentSummary,
      footerNote: "Please download the attached documents. If you have any questions, reply directly to this email.",
      companyId,
    });

    let finalAttachments = attachments;
    let wasZipped = false;
    let wasCombined = false;

    if (combinePdf && attachments.length > 1) {
      const pdfAttachments = attachments.filter(a => a.contentType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf"));
      const nonPdfAttachments = attachments.filter(a => a.contentType !== "application/pdf" && !a.filename.toLowerCase().endsWith(".pdf"));

      if (pdfAttachments.length >= 2) {
        const fs = await import("fs");
        const pathMod = await import("path");
        const os = await import("os");
        const { spawn } = await import("child_process");

        const tempDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), "combine-pdf-"));
        const inputFiles: string[] = [];
        try {
          for (let i = 0; i < pdfAttachments.length; i++) {
            const filePath = pathMod.join(tempDir, `input_${i}.pdf`);
            fs.writeFileSync(filePath, pdfAttachments[i].content);
            inputFiles.push(filePath);
          }
          const outputPath = pathMod.join(tempDir, "combined.pdf");

          const combineScript = `
import fitz
import sys
import json

input_files = json.loads(sys.argv[1])
output_path = sys.argv[2]
combined = fitz.open()

for f in input_files:
    try:
        doc = fitz.open(f)
        combined.insert_pdf(doc)
        doc.close()
    except Exception as e:
        print(f"Warning: Could not add {f}: {e}", file=sys.stderr)

page_count = len(combined)
combined.save(output_path)
combined.close()
print(json.dumps({"pages": page_count}))
`;

          await new Promise<void>((resolve, reject) => {
            let errorOutput = "";
            const proc = spawn("python3", ["-c", combineScript, JSON.stringify(inputFiles), outputPath], { timeout: 60000 });
            proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
            proc.on("close", (code: number | null) => {
              if (code === 0) resolve();
              else reject(new Error(`PDF combine failed: ${errorOutput}`));
            });
            proc.on("error", (err: Error) => reject(err));
          });

          const combinedBuffer = fs.readFileSync(outputPath);
          finalAttachments = [
            { filename: "Combined Documents.pdf", content: combinedBuffer, contentType: "application/pdf" },
            ...nonPdfAttachments,
          ];
          wasCombined = true;

          logger.info({ inputCount: pdfAttachments.length, combinedSize: combinedBuffer.length }, "Documents combined into single PDF for email");
        } catch (combineErr) {
          logger.warn({ err: combineErr }, "Failed to combine PDFs, sending individually instead");
        } finally {
          try {
            for (const f of inputFiles) { try { fs.unlinkSync(f); } catch {} }
            const outputPath = pathMod.join(tempDir, "combined.pdf");
            try { fs.unlinkSync(outputPath); } catch {}
            fs.rmdirSync(tempDir);
          } catch {}
        }
      }
    }

    const ZIP_THRESHOLD = 5 * 1024 * 1024; // 5MB
    const totalSize = finalAttachments.reduce((sum, att) => sum + att.content.length, 0);

    if (!wasCombined && totalSize > ZIP_THRESHOLD) {
      try {
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const passthrough = new PassThrough();
          const archive = archiver("zip", { zlib: { level: 6 } });

          archive.on("error", (err: Error) => reject(err));
          passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
          passthrough.on("end", () => resolve(Buffer.concat(chunks)));
          passthrough.on("error", (err: Error) => reject(err));

          archive.pipe(passthrough);

          for (const att of attachments) {
            archive.append(att.content, { name: att.filename });
          }
          archive.finalize();
        });

        finalAttachments = [{
          filename: "documents.zip",
          content: zipBuffer,
          contentType: "application/zip",
        }];
        wasZipped = true;
        logger.info(
          { originalSize: totalSize, zippedSize: zipBuffer.length, fileCount: attachments.length },
          "Documents zipped for email (total exceeded 5MB)"
        );
      } catch (zipErr) {
        logger.warn({ err: zipErr }, "Failed to zip documents, sending individually instead");
      }
    }

    const result = await emailService.sendEmailWithAttachment({
      to,
      cc: cc || undefined,
      bcc,
      subject,
      body: htmlBody,
      attachments: finalAttachments,
    });

    if (result.success) {
      logger.info({ documentCount: attachments.length, to, zipped: wasZipped, combined: wasCombined }, "Documents email sent successfully");
      res.json({ success: true, messageId: result.messageId, attachedCount: finalAttachments.length, zipped: wasZipped, combined: wasCombined });
    } else {
      logger.error({ error: result.error }, "Failed to send documents email");
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending documents email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send email" });
  }
});

export default router;
