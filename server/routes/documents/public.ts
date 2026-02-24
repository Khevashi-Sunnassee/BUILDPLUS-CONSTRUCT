import { Router, Request, Response } from "express";
import archiver from "archiver";
import { storage } from "../../storage";
import { ObjectNotFoundError } from "../../replit_integrations/object_storage";
import logger from "../../lib/logger";
import {
  objectStorageService,
  verifyDocumentDownloadToken,
  verifyBulkDownloadToken,
  buildContentDisposition,
  getClientIp,
} from "./shared";

const router = Router();

// ==================== PUBLIC DOCUMENT DOWNLOAD (Token-based, No Auth) ====================

router.get("/api/public/documents/:token/download", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token);
    const verified = verifyDocumentDownloadToken(token);

    if (!verified) {
      return res.status(403).json({ error: "Invalid or expired download link. Please request a new link." });
    }

    const document = await storage.getDocument(verified.documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const [metadata] = await objectFile.getMetadata();

    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition("attachment", document.originalName),
    });

    const stream = objectFile.createReadStream();
    stream.pipe(res);
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error downloading public document via token");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/public/documents/bulk/:token/download", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token);
    const verified = verifyBulkDownloadToken(token);

    if (!verified) {
      return res.status(403).json({ error: "Invalid or expired download link. Please request a new link." });
    }

    const docs = await storage.getDocumentsByIds(verified.documentIds);
    if (docs.length === 0) {
      return res.status(404).json({ error: "No documents found" });
    }

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": buildContentDisposition("attachment", "Documents.zip"),
    });

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err: Error) => {
      logger.error({ err }, "Error creating zip archive for bulk download");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create zip archive" });
      }
    });

    archive.pipe(res);

    for (const doc of docs) {
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(doc.storageKey);
        const stream = objectFile.createReadStream();
        archive.append(stream, { name: doc.originalName });
      } catch (err) {
        logger.warn({ docId: doc.id, err }, "Failed to add document to bulk zip, skipping");
      }
    }

    await archive.finalize();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error processing bulk document download");
    if (!res.headersSent) {
      res.status(500).json({ error: "An internal error occurred" });
    }
  }
});

// ==================== PUBLIC BUNDLE ACCESS (No Auth) ====================

async function validateBundleAccess(
  bundle: { id: string; allowGuestAccess: boolean | null; expiresAt: string | Date | null } | null | undefined, 
  req: Request, 
  res: Response, 
  accessType: string
): Promise<boolean> {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || undefined;
  
  if (!bundle) {
    res.status(404).json({ error: "Bundle not found" });
    return false;
  }

  if (!bundle.allowGuestAccess) {
    await storage.logBundleAccess(bundle.id, `DENIED_${accessType}`, undefined, ipAddress, userAgent);
    res.status(403).json({ error: "Guest access is not allowed for this bundle" });
    return false;
  }

  if (bundle.expiresAt && new Date(bundle.expiresAt) < new Date()) {
    await storage.logBundleAccess(bundle.id, `DENIED_EXPIRED_${accessType}`, undefined, ipAddress, userAgent);
    res.status(410).json({ error: "This bundle has expired" });
    return false;
  }

  return true;
}

router.get("/api/public/bundles/:qrCodeId", async (req, res) => {
  try {
    const qrCodeId = String(req.params.qrCodeId);
    const bundle = await storage.getDocumentBundleByQr(qrCodeId);
    
    if (!await validateBundleAccess(bundle, req, res, "VIEW_BUNDLE")) return;

    await storage.logBundleAccess(
      bundle!.id,
      "VIEW_BUNDLE",
      undefined,
      getClientIp(req),
      req.headers["user-agent"] || undefined
    );

    res.json({
      bundleName: bundle!.bundleName,
      description: bundle!.description,
      items: bundle!.items.map(item => ({
        id: item.document.id,
        title: item.document.title,
        fileName: item.document.originalName,
        mimeType: item.document.mimeType,
        fileSize: item.document.fileSize,
        version: item.document.version,
        revision: item.document.revision,
        documentNumber: item.document.documentNumber,
        isLatestVersion: item.document.isLatestVersion,
        isStale: item.document.isLatestVersion === false,
      })),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching public bundle");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/public/bundles/:qrCodeId/documents/:documentId/view", async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    const documentId = String(req.params.documentId);
    
    if (!await validateBundleAccess(bundle, req, res, "VIEW_DOCUMENT")) return;

    const bundleItem = bundle!.items.find(item => item.documentId === documentId);
    
    if (!bundleItem) {
      await storage.logBundleAccess(bundle!.id, "DENIED_VIEW_DOCUMENT_NOT_IN_BUNDLE", documentId, getClientIp(req), req.headers["user-agent"] || undefined);
      return res.status(404).json({ error: "Document not found in this bundle" });
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    await storage.logBundleAccess(
      bundle!.id,
      "VIEW_DOCUMENT",
      documentId,
      getClientIp(req),
      req.headers["user-agent"] || undefined
    );

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const [metadata] = await objectFile.getMetadata();
    
    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition("inline", document.originalName),
    });

    const stream = objectFile.createReadStream();
    stream.pipe(res);
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error viewing public bundle document");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/public/bundles/:qrCodeId/documents/:documentId/download", async (req, res) => {
  try {
    const bundle = await storage.getDocumentBundleByQr(String(req.params.qrCodeId));
    const documentId = String(req.params.documentId);
    
    if (!await validateBundleAccess(bundle, req, res, "DOWNLOAD_DOCUMENT")) return;

    const bundleItem = bundle!.items.find(item => item.documentId === documentId);
    
    if (!bundleItem) {
      await storage.logBundleAccess(bundle!.id, "DENIED_DOWNLOAD_DOCUMENT_NOT_IN_BUNDLE", documentId, getClientIp(req), req.headers["user-agent"] || undefined);
      return res.status(404).json({ error: "Document not found in this bundle" });
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    await storage.logBundleAccess(
      bundle!.id,
      "DOWNLOAD_DOCUMENT",
      documentId,
      getClientIp(req),
      req.headers["user-agent"] || undefined
    );

    const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
    const [metadata] = await objectFile.getMetadata();
    
    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition("attachment", document.originalName),
    });

    const stream = objectFile.createReadStream();
    stream.pipe(res);
  } catch (error: unknown) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found in storage" });
    }
    logger.error({ err: error }, "Error downloading public bundle document");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
