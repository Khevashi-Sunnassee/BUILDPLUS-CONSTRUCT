import crypto from "crypto";
import { storage } from "../storage";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import logger from "../lib/logger";
import type { InsertDocument } from "@shared/schema";

const objectStorageService = new ObjectStorageService();

const documentTypeCache: Map<string, string> = new Map();

export type DocumentSource = 
  | "CHAT_ATTACHMENT"
  | "PANEL_IFC"
  | "TASK_FILE"
  | "PO_ATTACHMENT"
  | "MANUAL_UPLOAD";

export interface DocumentRegistrationOptions {
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  uploadedBy: string;
  companyId?: string;
  source: DocumentSource;
  title?: string;
  description?: string;
  typeId?: string | null;
  disciplineId?: string | null;
  categoryId?: string | null;
  jobId?: string | null;
  panelId?: string | null;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  taskId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  tags?: string | null;
  isConfidential?: boolean;
  status?: "DRAFT" | "REVIEW" | "APPROVED" | "SUPERSEDED" | "ARCHIVED";
}

export interface RegisteredDocument {
  id: string;
  documentNumber: string | null;
  title: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  fileSha256: string;
  status: string;
  version: string;
  revision: string;
  createdAt: Date;
}

export class DocumentRegisterService {
  private static instance: DocumentRegisterService;

  private constructor() {}

  public static getInstance(): DocumentRegisterService {
    if (!DocumentRegisterService.instance) {
      DocumentRegisterService.instance = new DocumentRegisterService();
    }
    return DocumentRegisterService.instance;
  }

  async registerDocument(options: DocumentRegistrationOptions): Promise<RegisteredDocument> {
    const {
      file,
      uploadedBy,
      companyId,
      source,
      title,
      description,
      typeId,
      disciplineId,
      categoryId,
      jobId,
      panelId,
      supplierId,
      purchaseOrderId,
      taskId,
      conversationId,
      messageId,
      tags,
      isConfidential = false,
      status = "DRAFT",
    } = options;

    logger.info({ source, originalName: file.originalname, uploadedBy }, "Registering document");

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      body: file.buffer,
      headers: {
        "Content-Type": file.mimetype,
      },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      logger.error({ status: uploadResponse.status, error: errorText }, "Failed to upload file to storage");
      throw new Error("Failed to upload file to storage");
    }

    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: uploadedBy,
      visibility: "private",
    });

    const fileSha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const fileName = `${Date.now()}-${file.originalname}`;
    const documentTitle = title || this.generateTitle(file.originalname, source);

    let documentNumber: string | undefined;
    if (typeId) {
      documentNumber = await storage.getNextDocumentNumber(typeId);
    }

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && uploadedBy) {
      const uploaderUser = await storage.getUser(uploadedBy);
      resolvedCompanyId = uploaderUser?.companyId || undefined;
    }

    const documentData: InsertDocument = {
      title: documentTitle,
      description: description || null,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      storageKey: objectPath,
      fileSha256,
      documentNumber,
      companyId: resolvedCompanyId!,
      typeId: typeId || null,
      disciplineId: disciplineId || null,
      categoryId: categoryId || null,
      jobId: jobId || null,
      panelId: panelId || null,
      supplierId: supplierId || null,
      purchaseOrderId: purchaseOrderId || null,
      taskId: taskId || null,
      conversationId: conversationId || null,
      messageId: messageId || null,
      tags: tags || null,
      isConfidential,
      uploadedBy,
      status,
      version: "1.0",
      revision: "A",
      isLatestVersion: true,
    };

    const document = await storage.createDocument(documentData);

    logger.info({ 
      documentId: document.id, 
      documentNumber: document.documentNumber,
      source,
      storageKey: objectPath 
    }, "Document registered successfully");

    return {
      id: document.id,
      documentNumber: document.documentNumber,
      title: document.title,
      fileName: document.fileName,
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      storageKey: document.storageKey,
      fileSha256: document.fileSha256 || "",
      status: document.status,
      version: document.version,
      revision: document.revision,
      createdAt: document.createdAt,
    };
  }

  async registerFromBase64(
    base64Data: string,
    fileName: string,
    mimeType: string,
    options: Omit<DocumentRegistrationOptions, "file">
  ): Promise<RegisteredDocument> {
    const buffer = Buffer.from(base64Data, "base64");
    return this.registerDocument({
      ...options,
      file: {
        buffer,
        originalname: fileName,
        mimetype: mimeType,
        size: buffer.length,
      },
    });
  }

  private generateTitle(originalName: string, source: DocumentSource): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    
    switch (source) {
      case "CHAT_ATTACHMENT":
        return `Chat: ${nameWithoutExt}`;
      case "PANEL_IFC":
        return `IFC: ${nameWithoutExt}`;
      case "TASK_FILE":
        return `Task: ${nameWithoutExt}`;
      case "PO_ATTACHMENT":
        return `PO: ${nameWithoutExt}`;
      case "MANUAL_UPLOAD":
      default:
        return nameWithoutExt;
    }
  }

  async getObjectFile(storageKey: string) {
    return objectStorageService.getObjectEntityFile(storageKey);
  }

  async getDocumentsByConversation(conversationId: string) {
    return storage.getDocuments({ conversationId, showLatestOnly: true });
  }

  async getDocumentsByMessage(messageId: string) {
    return storage.getDocuments({ messageId, showLatestOnly: true });
  }

  async getDocumentsByPanel(panelId: string) {
    return storage.getDocuments({ panelId, showLatestOnly: true });
  }

  async getDocumentTypeIdByPrefix(prefix: string): Promise<string | null> {
    if (documentTypeCache.has(prefix)) {
      return documentTypeCache.get(prefix)!;
    }

    const types = await storage.getAllDocumentTypes();
    for (const t of types) {
      documentTypeCache.set(t.prefix, t.id);
    }

    return documentTypeCache.get(prefix) || null;
  }
}

export const documentRegisterService = DocumentRegisterService.getInstance();
