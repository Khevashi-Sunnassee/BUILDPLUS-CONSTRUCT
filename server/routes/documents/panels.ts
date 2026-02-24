import { Router, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { objectStorageService, upload } from "./shared";

const router = Router();

// ============================================================================
// PANEL DOCUMENTS (Mini Document Register)
// ============================================================================

router.get("/api/panels/:panelId/documents", requireAuth, async (req, res) => {
  try {
    const panelId = String(req.params.panelId);
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const panel = await storage.getPanelById(panelId);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    const result = await storage.getDocuments({
      companyId: companyId,
      page: 1,
      limit: 100,
      panelId: panelId,
      showLatestOnly: true,
    });

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching panel documents");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/panels/:panelId/documents/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const panelId = String(req.params.panelId);
    const companyId = req.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const panel = await storage.getPanelById(panelId);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { title, description, status, typeId, supersededDocumentId } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!status || !["PRELIM", "IFA", "IFC"].includes(status)) {
      return res.status(400).json({ error: "Status must be PRELIM, IFA, or IFC" });
    }

    if (status === "IFC") {
      const existingDocs = await storage.getDocuments({
        companyId: companyId,
        page: 1,
        limit: 100,
        panelId: panelId,
        showLatestOnly: true,
      });
      
      const existingIfcDocs = existingDocs.documents.filter(
        d => d.status === "IFC" && d.isLatestVersion
      );

      if (existingIfcDocs.length > 0 && !supersededDocumentId) {
        return res.status(400).json({ 
          error: "IFC document already exists. You must supersede the existing IFC document.",
          existingIfcDocuments: existingIfcDocs.map(d => ({ id: d.id, title: d.title, documentNumber: d.documentNumber }))
        });
      }

      if (supersededDocumentId) {
        const docToSupersede = existingIfcDocs.find(d => d.id === supersededDocumentId);
        if (!docToSupersede) {
          return res.status(400).json({ error: "Superseded document not found or is not an IFC document" });
        }
      }
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      body: req.file.buffer,
      headers: {
        "Content-Type": req.file.mimetype,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to storage");
    }

    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: req.session.userId!,
      visibility: "private",
    });

    const fileSha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    
    let documentNumber: string | undefined;
    if (typeId) {
      documentNumber = await storage.getNextDocumentNumber(typeId);
    }

    let parentDocumentId: string | undefined;
    let version = "1.0";
    let revision = "A";

    if (supersededDocumentId) {
      const parentDoc = await storage.getDocument(supersededDocumentId);
      if (parentDoc) {
        await storage.updateDocument(supersededDocumentId, {
          isLatestVersion: false,
          status: "SUPERSEDED",
        });
        
        parentDocumentId = supersededDocumentId;
        const currentVersion = parseFloat(parentDoc.version || "1.0");
        version = String((currentVersion + 1).toFixed(1));
      }
    }

    const document = await storage.createDocument({
      companyId,
      title,
      description: description || null,
      fileName: `${Date.now()}-${req.file.originalname}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey: objectPath,
      fileSha256,
      documentNumber,
      typeId: typeId || null,
      disciplineId: null,
      categoryId: null,
      jobId: panel.jobId || null,
      panelId,
      supplierId: null,
      purchaseOrderId: null,
      taskId: null,
      tags: null,
      isConfidential: false,
      uploadedBy: req.session.userId!,
      status,
      version,
      revision,
      isLatestVersion: true,
      parentDocumentId,
    });

    logger.info({ documentId: document.id, panelId, status }, "Panel document uploaded");
    res.json(document);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading panel document");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/panels/:panelId/documents/:documentId/status", requireAuth, async (req, res) => {
  try {
    const panelId = String(req.params.panelId);
    const documentId = String(req.params.documentId);
    const { status } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ error: "Company context required" });
    }

    const panel = await storage.getPanelById(panelId);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const job = await storage.getJob(panel.jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Panel not found" });
    }

    const document = await storage.getDocument(documentId);
    if (!document || document.panelId !== panelId) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!["PRELIM", "IFA", "IFC", "SUPERSEDED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === "IFC") {
      const existingDocs = await storage.getDocuments({
        companyId: req.companyId,
        page: 1,
        limit: 100,
        panelId: panelId,
        showLatestOnly: true,
      });
      
      const existingIfcDocs = existingDocs.documents.filter(
        d => d.status === "IFC" && d.isLatestVersion && d.id !== documentId
      );

      if (existingIfcDocs.length > 0) {
        return res.status(400).json({ 
          error: "Cannot change status to IFC - another IFC document already exists for this panel"
        });
      }
    }

    const updated = await storage.updateDocument(documentId, { status });
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating panel document status");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
