import { Router, Request, Response } from "express";
import crypto from "crypto";
import { storage, db } from "../../storage";
import { eq } from "drizzle-orm";
import { jobMembers } from "@shared/schema";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { objectStorageService, bulkUpload } from "./shared";

const router = Router();

// ==================== BULK DOCUMENT UPLOAD ====================

router.post("/api/documents/bulk-upload", requireAuth, bulkUpload.array("files", 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
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
      supersedeDocumentId?: string;
    }> = [];

    try {
      fileMetadata = JSON.parse(metadataStr || "[]");
    } catch {
      return res.status(400).json({ error: "Invalid metadata format" });
    }

    const { typeId, disciplineId, categoryId, documentTypeStatusId, jobId, panelId, supplierId, purchaseOrderId, taskId, tags, isConfidential } = req.body;

    if (jobId) {
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

    const uploaded: Record<string, unknown>[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const file of files) {
      try {
        const meta = fileMetadata.find(m => m.fileName === file.originalname) || {
          fileName: file.originalname,
          title: file.originalname.replace(/\.[^/.]+$/, ""),
          documentNumber: "",
          revision: "A",
          version: "1.0",
        };

        if (!meta.title || meta.title.trim().length === 0) {
          meta.title = file.originalname.replace(/\.[^/.]+$/, "");
        }

        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file.buffer,
          headers: { "Content-Type": file.mimetype },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: req.session.userId!,
          visibility: "private",
        });

        const fileSha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

        let documentNumber = meta.documentNumber || undefined;
        if (!documentNumber && typeId) {
          documentNumber = await storage.getNextDocumentNumber(typeId);
        }

        let document;

        if (meta.supersedeDocumentId) {
          const parentDoc = await storage.getDocument(meta.supersedeDocumentId);
          if (!parentDoc || parentDoc.companyId !== companyId) {
            throw new Error("Document to supersede not found or access denied");
          }
          const currentVersion = parseFloat(parentDoc.version || "1.0");
          const newVersion = String((currentVersion + 1).toFixed(1));

          document = await storage.createNewVersion(meta.supersedeDocumentId, {
            companyId,
            title: meta.title || parentDoc.title,
            description: parentDoc.description,
            fileName: `${Date.now()}-${file.originalname}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storageKey: objectPath,
            fileSha256,
            documentNumber: parentDoc.documentNumber,
            typeId: typeId || parentDoc.typeId,
            disciplineId: disciplineId || parentDoc.disciplineId,
            categoryId: categoryId || parentDoc.categoryId,
            documentTypeStatusId: documentTypeStatusId || parentDoc.documentTypeStatusId,
            jobId: jobId || parentDoc.jobId,
            panelId: panelId || parentDoc.panelId,
            supplierId: supplierId || parentDoc.supplierId,
            purchaseOrderId: purchaseOrderId || parentDoc.purchaseOrderId,
            taskId: taskId || parentDoc.taskId,
            tags: tags || parentDoc.tags,
            isConfidential: isConfidential === "true",
            uploadedBy: req.session.userId!,
            status: "DRAFT",
            version: newVersion,
            revision: meta.revision || "A",
            isLatestVersion: true,
          });
        } else {
          document = await storage.createDocument({
            companyId,
            title: meta.title,
            description: null,
            fileName: `${Date.now()}-${file.originalname}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
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
        }

        uploaded.push(document);
      } catch (fileError: unknown) {
        logger.error({ err: fileError, fileName: file.originalname }, "Error uploading file in bulk");
        errors.push({
          fileName: file.originalname,
          error: fileError instanceof Error ? fileError.message : "Upload failed",
        });
      }
    }

    logger.info({ uploadedCount: uploaded.length, errorCount: errors.length }, "Bulk upload completed");
    res.json({ uploaded, errors, total: files.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error in bulk document upload");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process bulk upload" });
  }
});

export default router;
