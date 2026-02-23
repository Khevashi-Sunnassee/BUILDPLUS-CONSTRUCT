import { Router, Request, Response } from "express";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { storage, db } from "../../storage";
import { eq, and } from "drizzle-orm";
import { jobMembers, jobs } from "@shared/schema";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { objectStorageService, ALLOWED_DOCUMENT_TYPES } from "./shared";
import multer from "multer";

const router = Router();

const MAX_ZIP_ENTRIES = 200;
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;
const MAX_SINGLE_FILE_SIZE = 50 * 1024 * 1024;

const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are accepted"));
    }
  },
});

function inferMetadataFromFilename(filename: string): { title: string; revision: string; documentNumber: string } {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  let revision = "";
  const revMatch = nameWithoutExt.match(/[-_\s](?:rev|revision)[-_.\s]*([A-Z0-9]{1,4})$/i);
  if (revMatch) {
    revision = revMatch[1].toUpperCase();
  } else {
    const trailingRevMatch = nameWithoutExt.match(/[-_\s]([A-Z])$/);
    if (trailingRevMatch) {
      revision = trailingRevMatch[1];
    }
  }

  let documentNumber = "";
  const docNumMatch = nameWithoutExt.match(/^([A-Z]{1,6}[-_]\d{2,6}[-_][A-Z0-9]+|[A-Z]{2,6}[-_]\d{3,}|\d{2,6}[-_][A-Z]{1,6}[-_]\d{2,})/i);
  if (docNumMatch) {
    documentNumber = docNumMatch[1];
  }

  let title = nameWithoutExt
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, revision, documentNumber };
}

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    txt: "text/plain",
    csv: "text/csv",
    html: "text/html",
    xml: "text/xml",
    json: "application/json",
    dwg: "image/vnd.dwg",
    dxf: "application/dxf",
    rtf: "application/rtf",
  };
  return mimeMap[ext] || "application/octet-stream";
}

router.post("/api/documents/zip-upload/extract", requireAuth, zipUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No ZIP file provided" });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    logger.info({ filename: file.originalname, fileSize: file.size }, "Extracting ZIP file for bulk document upload");

    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();

    const fileEntries = entries.filter(e => !e.isDirectory);
    if (fileEntries.length > MAX_ZIP_ENTRIES) {
      return res.status(400).json({ error: `ZIP contains too many files (${fileEntries.length}). Maximum is ${MAX_ZIP_ENTRIES}.` });
    }

    let totalUncompressedSize = 0;
    for (const entry of fileEntries) {
      totalUncompressedSize += entry.header.size;
    }
    if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
      return res.status(400).json({ error: `Total uncompressed size (${Math.round(totalUncompressedSize / 1024 / 1024)}MB) exceeds the ${Math.round(MAX_UNCOMPRESSED_SIZE / 1024 / 1024)}MB limit.` });
    }

    const extractedFiles: Array<{
      fileName: string;
      fileSize: number;
      mimeType: string;
      title: string;
      documentNumber: string;
      revision: string;
      version: string;
      extension: string;
    }> = [];

    for (const entry of fileEntries) {
      const entryName = entry.entryName;
      const fileName = entryName.split("/").pop() || entryName;

      if (fileName.startsWith(".") || fileName.startsWith("__MACOSX") || entryName.includes("__MACOSX/")) continue;
      if (entry.header.size > MAX_SINGLE_FILE_SIZE) continue;

      const mimeType = getMimeType(fileName);
      if (!ALLOWED_DOCUMENT_TYPES.includes(mimeType)) continue;

      const metadata = inferMetadataFromFilename(fileName);
      const extension = fileName.split(".").pop()?.toLowerCase() || "";

      extractedFiles.push({
        fileName,
        fileSize: entry.header.size,
        mimeType,
        title: metadata.title,
        documentNumber: metadata.documentNumber,
        revision: metadata.revision,
        version: "1.0",
        extension,
      });
    }

    extractedFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));

    logger.info({ totalEntries: entries.length, extractedFiles: extractedFiles.length }, "ZIP extraction complete");

    res.json({
      zipFileName: file.originalname,
      totalEntries: entries.length,
      files: extractedFiles,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error extracting ZIP file");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to extract ZIP file" });
  }
});

router.post("/api/documents/zip-upload/register", requireAuth, zipUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No ZIP file provided" });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const metadataStr = req.body.metadata;
    let fileMetadata: Array<{
      fileName: string;
      title: string;
      documentNumber: string;
      revision: string;
      version: string;
    }> = [];

    try {
      fileMetadata = JSON.parse(metadataStr || "[]");
    } catch {
      return res.status(400).json({ error: "Invalid metadata format" });
    }

    if (fileMetadata.length === 0) {
      return res.status(400).json({ error: "No files selected for upload" });
    }

    const { typeId, disciplineId, categoryId, documentTypeStatusId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential } = req.body;

    if (jobId) {
      const [jobRecord] = await db.select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
        .limit(1);
      if (!jobRecord) {
        return res.status(403).json({ error: "Job not found or does not belong to your company" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (user && user.role !== "ADMIN" && user.role !== "MANAGER") {
        const memberships = await db.select({ jobId: jobMembers.jobId })
          .from(jobMembers)
          .where(eq(jobMembers.userId, req.session.userId!))
          .limit(1000);
        const allowedJobIds = memberships.map(m => m.jobId);
        if (!allowedJobIds.includes(jobId)) {
          return res.status(403).json({ error: "You do not have access to the selected job" });
        }
      }
    }

    if (fileMetadata.length > MAX_ZIP_ENTRIES) {
      return res.status(400).json({ error: `Too many files selected (${fileMetadata.length}). Maximum is ${MAX_ZIP_ENTRIES}.` });
    }

    logger.info({ metadataCount: fileMetadata.length, zipFile: file.originalname }, "Starting ZIP bulk register");

    const zip = new AdmZip(file.buffer);

    const allEntries = zip.getEntries().filter(e => !e.isDirectory);
    let totalSize = 0;
    for (const e of allEntries) totalSize += e.header.size;
    if (totalSize > MAX_UNCOMPRESSED_SIZE) {
      return res.status(400).json({ error: `Total uncompressed size exceeds ${Math.round(MAX_UNCOMPRESSED_SIZE / 1024 / 1024)}MB limit.` });
    }

    const uploaded: Record<string, unknown>[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const meta of fileMetadata) {
      try {
        const entry = zip.getEntries().find(e => {
          const entryFileName = e.entryName.split("/").pop() || e.entryName;
          return entryFileName === meta.fileName;
        });

        if (!entry) {
          errors.push({ fileName: meta.fileName, error: "File not found in ZIP archive" });
          continue;
        }

        const mimeType = getMimeType(meta.fileName);
        if (!ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
          errors.push({ fileName: meta.fileName, error: `File type ${mimeType} is not allowed` });
          continue;
        }

        if (entry.header.size > MAX_SINGLE_FILE_SIZE) {
          errors.push({ fileName: meta.fileName, error: `File exceeds the ${Math.round(MAX_SINGLE_FILE_SIZE / 1024 / 1024)}MB size limit` });
          continue;
        }

        const fileBuffer = entry.getData();

        if (!meta.title || meta.title.trim().length === 0) {
          meta.title = meta.fileName.replace(/\.[^/.]+$/, "");
        }

        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: fileBuffer,
          headers: { "Content-Type": mimeType },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: req.session.userId!,
          visibility: "private",
        });

        const fileSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        let documentNumber = meta.documentNumber || undefined;
        if (!documentNumber && typeId) {
          documentNumber = await storage.getNextDocumentNumber(typeId);
        }

        const document = await storage.createDocument({
          companyId,
          title: meta.title,
          description: null,
          fileName: `${Date.now()}-${meta.fileName}`,
          originalName: meta.fileName,
          mimeType,
          fileSize: fileBuffer.length,
          storageKey: objectPath,
          fileSha256,
          documentNumber,
          revision: meta.revision || "A",
          version: meta.version || "1.0",
          typeId: typeId || null,
          disciplineId: disciplineId || null,
          categoryId: categoryId || null,
          documentTypeStatusId: documentTypeStatusId || null,
          jobId: jobId || null,
          panelId: panelId || null,
          supplierId: supplierId || null,
          purchaseOrderId: purchaseOrderId || null,
          taskId: taskId || null,
          tags: tags || null,
          isConfidential: isConfidential === "true",
          uploadedBy: req.session.userId!,
          status: "DRAFT",
          isLatestVersion: true,
        });

        uploaded.push(document);
        logger.info({ fileName: meta.fileName, documentId: (document as any).id }, "ZIP file registered successfully");
      } catch (fileError: unknown) {
        logger.error({ err: fileError, fileName: meta.fileName }, "Error uploading file from ZIP");
        errors.push({
          fileName: meta.fileName,
          error: fileError instanceof Error ? fileError.message : "Upload failed",
        });
      }
    }

    logger.info({ uploadedCount: uploaded.length, errorCount: errors.length }, "ZIP bulk register completed");
    res.json({ uploaded, errors, total: fileMetadata.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error in ZIP bulk register");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process ZIP upload" });
  }
});

export default router;
