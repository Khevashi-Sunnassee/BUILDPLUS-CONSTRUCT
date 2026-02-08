import { eq, and, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import {
  documentTypesConfig, documentTypeStatuses, documentDisciplines, documentCategories,
  documents, documentBundles, documentBundleItems, documentBundleAccessLogs,
  users, jobs, panelRegister, suppliers,
  type DocumentTypeConfig, type InsertDocumentType,
  type DocumentTypeStatus, type InsertDocumentTypeStatus,
  type DocumentDiscipline, type InsertDocumentDiscipline,
  type DocumentCategory, type InsertDocumentCategory,
  type Document, type InsertDocument, type DocumentWithDetails,
  type DocumentBundle, type InsertDocumentBundle, type DocumentBundleWithItems,
  type DocumentBundleItem,
} from "@shared/schema";

export const documentMethods = {
  async getAllDocumentTypes(): Promise<DocumentTypeConfig[]> {
    return db.select().from(documentTypesConfig).orderBy(asc(documentTypesConfig.sortOrder));
  },

  async getActiveDocumentTypes(): Promise<DocumentTypeConfig[]> {
    return db.select().from(documentTypesConfig)
      .where(eq(documentTypesConfig.isActive, true))
      .orderBy(asc(documentTypesConfig.sortOrder));
  },

  async getDocumentType(id: string): Promise<DocumentTypeConfig | undefined> {
    const [result] = await db.select().from(documentTypesConfig).where(eq(documentTypesConfig.id, id));
    return result;
  },

  async createDocumentType(data: InsertDocumentType): Promise<DocumentTypeConfig> {
    const [result] = await db.insert(documentTypesConfig).values(data).returning();
    return result;
  },

  async updateDocumentType(id: string, data: Partial<InsertDocumentType>): Promise<DocumentTypeConfig | undefined> {
    const [result] = await db.update(documentTypesConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentTypesConfig.id, id))
      .returning();
    return result;
  },

  async deleteDocumentType(id: string): Promise<void> {
    await db.delete(documentTypesConfig).where(eq(documentTypesConfig.id, id));
  },

  async getDocumentTypeStatuses(typeId: string): Promise<DocumentTypeStatus[]> {
    return db.select().from(documentTypeStatuses)
      .where(eq(documentTypeStatuses.typeId, typeId))
      .orderBy(asc(documentTypeStatuses.sortOrder));
  },

  async createDocumentTypeStatus(data: InsertDocumentTypeStatus): Promise<DocumentTypeStatus> {
    const [result] = await db.insert(documentTypeStatuses).values(data).returning();
    return result;
  },

  async updateDocumentTypeStatus(id: string, data: Partial<InsertDocumentTypeStatus>): Promise<DocumentTypeStatus | undefined> {
    const [result] = await db.update(documentTypeStatuses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentTypeStatuses.id, id))
      .returning();
    return result;
  },

  async deleteDocumentTypeStatus(id: string): Promise<void> {
    await db.delete(documentTypeStatuses).where(eq(documentTypeStatuses.id, id));
  },

  async getAllDocumentDisciplines(): Promise<DocumentDiscipline[]> {
    return db.select().from(documentDisciplines).orderBy(asc(documentDisciplines.sortOrder));
  },

  async getActiveDocumentDisciplines(): Promise<DocumentDiscipline[]> {
    return db.select().from(documentDisciplines)
      .where(eq(documentDisciplines.isActive, true))
      .orderBy(asc(documentDisciplines.sortOrder));
  },

  async getDocumentDiscipline(id: string): Promise<DocumentDiscipline | undefined> {
    const [result] = await db.select().from(documentDisciplines).where(eq(documentDisciplines.id, id));
    return result;
  },

  async createDocumentDiscipline(data: InsertDocumentDiscipline): Promise<DocumentDiscipline> {
    const [result] = await db.insert(documentDisciplines).values(data).returning();
    return result;
  },

  async updateDocumentDiscipline(id: string, data: Partial<InsertDocumentDiscipline>): Promise<DocumentDiscipline | undefined> {
    const [result] = await db.update(documentDisciplines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentDisciplines.id, id))
      .returning();
    return result;
  },

  async deleteDocumentDiscipline(id: string): Promise<void> {
    await db.delete(documentDisciplines).where(eq(documentDisciplines.id, id));
  },

  async getAllDocumentCategories(): Promise<DocumentCategory[]> {
    return db.select().from(documentCategories).orderBy(asc(documentCategories.sortOrder));
  },

  async getActiveDocumentCategories(): Promise<DocumentCategory[]> {
    return db.select().from(documentCategories)
      .where(eq(documentCategories.isActive, true))
      .orderBy(asc(documentCategories.sortOrder));
  },

  async getDocumentCategory(id: string): Promise<DocumentCategory | undefined> {
    const [result] = await db.select().from(documentCategories).where(eq(documentCategories.id, id));
    return result;
  },

  async createDocumentCategory(data: InsertDocumentCategory): Promise<DocumentCategory> {
    const [result] = await db.insert(documentCategories).values(data).returning();
    return result;
  },

  async updateDocumentCategory(id: string, data: Partial<InsertDocumentCategory>): Promise<DocumentCategory | undefined> {
    const [result] = await db.update(documentCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentCategories.id, id))
      .returning();
    return result;
  },

  async deleteDocumentCategory(id: string): Promise<void> {
    await db.delete(documentCategories).where(eq(documentCategories.id, id));
  },

  async getDocuments(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    typeId?: string;
    disciplineId?: string;
    categoryId?: string;
    jobId?: string;
    panelId?: string;
    supplierId?: string;
    purchaseOrderId?: string;
    taskId?: string;
    conversationId?: string;
    messageId?: string;
    showLatestOnly?: boolean;
  }): Promise<{ documents: DocumentWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    
    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(sql`(LOWER(${documents.title}) LIKE ${searchTerm} OR LOWER(${documents.documentNumber}) LIKE ${searchTerm} OR LOWER(${documents.tags}) LIKE ${searchTerm})`);
    }
    if (filters.status) conditions.push(eq(documents.status, filters.status as any));
    if (filters.typeId) conditions.push(eq(documents.typeId, filters.typeId));
    if (filters.disciplineId) conditions.push(eq(documents.disciplineId, filters.disciplineId));
    if (filters.categoryId) conditions.push(eq(documents.categoryId, filters.categoryId));
    if (filters.jobId) conditions.push(eq(documents.jobId, filters.jobId));
    if (filters.panelId) conditions.push(eq(documents.panelId, filters.panelId));
    if (filters.supplierId) conditions.push(eq(documents.supplierId, filters.supplierId));
    if (filters.purchaseOrderId) conditions.push(eq(documents.purchaseOrderId, filters.purchaseOrderId));
    if (filters.taskId) conditions.push(eq(documents.taskId, filters.taskId));
    if (filters.conversationId) conditions.push(eq(documents.conversationId, filters.conversationId));
    if (filters.messageId) conditions.push(eq(documents.messageId, filters.messageId));
    if (filters.showLatestOnly) conditions.push(eq(documents.isLatestVersion, true));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(whereClause);
    const total = Number(countResult?.count || 0);

    const results = await db.select()
      .from(documents)
      .where(whereClause)
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    const enrichedDocs: DocumentWithDetails[] = await Promise.all(
      results.map(async (doc) => {
        const [type] = doc.typeId ? await db.select().from(documentTypesConfig).where(eq(documentTypesConfig.id, doc.typeId)) : [null];
        const [discipline] = doc.disciplineId ? await db.select().from(documentDisciplines).where(eq(documentDisciplines.id, doc.disciplineId)) : [null];
        const [category] = doc.categoryId ? await db.select().from(documentCategories).where(eq(documentCategories.id, doc.categoryId)) : [null];
        const [docTypeStatus] = doc.documentTypeStatusId ? await db.select().from(documentTypeStatuses).where(eq(documentTypeStatuses.id, doc.documentTypeStatusId)) : [null];
        const [job] = doc.jobId ? await db.select().from(jobs).where(eq(jobs.id, doc.jobId)) : [null];
        const [panel] = doc.panelId ? await db.select().from(panelRegister).where(eq(panelRegister.id, doc.panelId)) : [null];
        const [supplier] = doc.supplierId ? await db.select().from(suppliers).where(eq(suppliers.id, doc.supplierId)) : [null];
        const [uploadedByUserFull] = await db.select().from(users).where(eq(users.id, doc.uploadedBy));
        const uploadedByUser = uploadedByUserFull ? {
          id: uploadedByUserFull.id,
          email: uploadedByUserFull.email,
          name: uploadedByUserFull.name,
          role: uploadedByUserFull.role,
        } : null;
        
        return {
          ...doc,
          type,
          discipline,
          category,
          documentTypeStatus: docTypeStatus,
          job,
          panel,
          supplier,
          uploadedByUser,
        };
      })
    );

    return {
      documents: enrichedDocs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getDocument(id: string): Promise<DocumentWithDetails | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) return undefined;

    const [type] = doc.typeId ? await db.select().from(documentTypesConfig).where(eq(documentTypesConfig.id, doc.typeId)) : [null];
    const [discipline] = doc.disciplineId ? await db.select().from(documentDisciplines).where(eq(documentDisciplines.id, doc.disciplineId)) : [null];
    const [category] = doc.categoryId ? await db.select().from(documentCategories).where(eq(documentCategories.id, doc.categoryId)) : [null];
    const [docTypeStatus] = doc.documentTypeStatusId ? await db.select().from(documentTypeStatuses).where(eq(documentTypeStatuses.id, doc.documentTypeStatusId)) : [null];
    const [job] = doc.jobId ? await db.select().from(jobs).where(eq(jobs.id, doc.jobId)) : [null];
    const [panel] = doc.panelId ? await db.select().from(panelRegister).where(eq(panelRegister.id, doc.panelId)) : [null];
    const [supplier] = doc.supplierId ? await db.select().from(suppliers).where(eq(suppliers.id, doc.supplierId)) : [null];
    const [uploadedByUserFull] = await db.select().from(users).where(eq(users.id, doc.uploadedBy));
    const uploadedByUser = uploadedByUserFull ? {
      id: uploadedByUserFull.id,
      email: uploadedByUserFull.email,
      name: uploadedByUserFull.name,
      role: uploadedByUserFull.role,
    } : null;

    return {
      ...doc,
      type,
      discipline,
      category,
      documentTypeStatus: docTypeStatus,
      job,
      panel,
      supplier,
      uploadedByUser,
    };
  },

  async createDocument(data: InsertDocument): Promise<Document> {
    const [result] = await db.insert(documents).values(data).returning();
    return result;
  },

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [result] = await db.update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return result;
  },

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  },

  async getNextDocumentNumber(typeId: string): Promise<string> {
    const [type] = await db.select().from(documentTypesConfig).where(eq(documentTypesConfig.id, typeId));
    const prefix = type?.prefix || "DOC";
    const year = new Date().getFullYear();
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(sql`${documents.documentNumber} LIKE ${`${prefix}-${year}-%`}`);
    
    const count = Number(countResult?.count || 0) + 1;
    return `${prefix}-${year}-${String(count).padStart(3, '0')}`;
  },

  async getDocumentVersionHistory(documentId: string): Promise<Document[]> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    if (!doc) return [];

    let rootId = documentId;
    let currentDoc = doc;
    while (currentDoc.parentDocumentId) {
      rootId = currentDoc.parentDocumentId;
      const [parent] = await db.select().from(documents).where(eq(documents.id, currentDoc.parentDocumentId));
      if (!parent) break;
      currentDoc = parent;
    }

    const allVersions: Document[] = [currentDoc];
    
    const getChildren = async (parentId: string): Promise<Document[]> => {
      const children = await db.select().from(documents).where(eq(documents.parentDocumentId, parentId));
      const descendants: Document[] = [...children];
      for (const child of children) {
        const grandChildren = await getChildren(child.id);
        descendants.push(...grandChildren);
      }
      return descendants;
    };

    const descendants = await getChildren(rootId);
    allVersions.push(...descendants);
    
    return allVersions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createNewVersion(parentDocumentId: string, data: InsertDocument): Promise<Document> {
    await db.update(documents)
      .set({ isLatestVersion: false, status: "SUPERSEDED", updatedAt: new Date() })
      .where(eq(documents.id, parentDocumentId));

    const [result] = await db.insert(documents).values({
      ...data,
      parentDocumentId,
      isLatestVersion: true,
    }).returning();

    return result;
  },

  async getAllDocumentBundles(): Promise<DocumentBundleWithItems[]> {
    const bundles = await db.select().from(documentBundles).orderBy(desc(documentBundles.createdAt));
    
    return Promise.all(bundles.map(async (bundle) => {
      const items = await db.select()
        .from(documentBundleItems)
        .where(eq(documentBundleItems.bundleId, bundle.id))
        .orderBy(asc(documentBundleItems.sortOrder));
      
      const itemsWithDocs = await Promise.all(items.map(async (item) => {
        const [doc] = await db.select().from(documents).where(eq(documents.id, item.documentId));
        return { ...item, document: doc };
      }));

      const [job] = bundle.jobId ? await db.select().from(jobs).where(eq(jobs.id, bundle.jobId)) : [null];
      const [supplier] = bundle.supplierId ? await db.select().from(suppliers).where(eq(suppliers.id, bundle.supplierId)) : [null];
      const [createdByUserFull] = await db.select().from(users).where(eq(users.id, bundle.createdBy));
      const createdByUser = createdByUserFull ? {
        id: createdByUserFull.id,
        email: createdByUserFull.email,
        name: createdByUserFull.name,
        role: createdByUserFull.role,
      } : null;

      return { ...bundle, items: itemsWithDocs, job, supplier, createdByUser };
    }));
  },

  async getDocumentBundle(id: string): Promise<DocumentBundleWithItems | undefined> {
    const [bundle] = await db.select().from(documentBundles).where(eq(documentBundles.id, id));
    if (!bundle) return undefined;

    const items = await db.select()
      .from(documentBundleItems)
      .where(eq(documentBundleItems.bundleId, bundle.id))
      .orderBy(asc(documentBundleItems.sortOrder));
    
    const itemsWithDocs = await Promise.all(items.map(async (item) => {
      const [doc] = await db.select().from(documents).where(eq(documents.id, item.documentId));
      return { ...item, document: doc };
    }));

    const [job] = bundle.jobId ? await db.select().from(jobs).where(eq(jobs.id, bundle.jobId)) : [null];
    const [supplier] = bundle.supplierId ? await db.select().from(suppliers).where(eq(suppliers.id, bundle.supplierId)) : [null];
    const [createdByUserFull] = await db.select().from(users).where(eq(users.id, bundle.createdBy));
    const createdByUser = createdByUserFull ? {
      id: createdByUserFull.id,
      email: createdByUserFull.email,
      name: createdByUserFull.name,
      role: createdByUserFull.role,
    } : null;

    return { ...bundle, items: itemsWithDocs, job, supplier, createdByUser };
  },

  async getDocumentBundleByQr(qrCodeId: string): Promise<DocumentBundleWithItems | undefined> {
    const [bundle] = await db.select().from(documentBundles).where(eq(documentBundles.qrCodeId, qrCodeId));
    if (!bundle) return undefined;
    return documentMethods.getDocumentBundle(bundle.id);
  },

  async createDocumentBundle(data: InsertDocumentBundle): Promise<DocumentBundle> {
    const [result] = await db.insert(documentBundles).values(data).returning();
    return result;
  },

  async updateDocumentBundle(id: string, data: Partial<InsertDocumentBundle>): Promise<DocumentBundle | undefined> {
    const [result] = await db.update(documentBundles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentBundles.id, id))
      .returning();
    return result;
  },

  async deleteDocumentBundle(id: string): Promise<void> {
    await db.delete(documentBundles).where(eq(documentBundles.id, id));
  },

  async addDocumentsToBundle(bundleId: string, documentIds: string[], addedBy: string): Promise<DocumentBundleItem[]> {
    const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(${documentBundleItems.sortOrder}), -1)` })
      .from(documentBundleItems)
      .where(eq(documentBundleItems.bundleId, bundleId));
    
    let sortOrder = (maxOrder?.max || -1) + 1;
    
    const results: DocumentBundleItem[] = [];
    for (const documentId of documentIds) {
      const [existing] = await db.select().from(documentBundleItems)
        .where(and(
          eq(documentBundleItems.bundleId, bundleId),
          eq(documentBundleItems.documentId, documentId)
        ));
      
      if (!existing) {
        const [result] = await db.insert(documentBundleItems).values({
          bundleId,
          documentId,
          sortOrder,
          addedBy,
        }).returning();
        results.push(result);
        sortOrder++;
      }
    }
    
    return results;
  },

  async removeDocumentFromBundle(bundleId: string, documentId: string): Promise<void> {
    await db.delete(documentBundleItems)
      .where(and(
        eq(documentBundleItems.bundleId, bundleId),
        eq(documentBundleItems.documentId, documentId)
      ));
  },

  async logBundleAccess(bundleId: string, accessType: string, documentId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await db.insert(documentBundleAccessLogs).values({
      bundleId,
      documentId: documentId || null,
      accessType,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });
  },

  async getBundleAccessLogs(bundleId: string): Promise<any[]> {
    return db.select()
      .from(documentBundleAccessLogs)
      .where(eq(documentBundleAccessLogs.bundleId, bundleId))
      .orderBy(desc(documentBundleAccessLogs.accessedAt));
  },
};
