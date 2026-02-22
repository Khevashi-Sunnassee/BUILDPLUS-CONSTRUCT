import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
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
  async getAllDocumentTypes(companyId?: string): Promise<DocumentTypeConfig[]> {
    if (companyId) {
      return db.select().from(documentTypesConfig).where(eq(documentTypesConfig.companyId, companyId)).orderBy(asc(documentTypesConfig.sortOrder));
    }
    return db.select().from(documentTypesConfig).orderBy(asc(documentTypesConfig.sortOrder));
  },

  async getActiveDocumentTypes(companyId?: string): Promise<DocumentTypeConfig[]> {
    if (companyId) {
      return db.select().from(documentTypesConfig)
        .where(and(eq(documentTypesConfig.isActive, true), eq(documentTypesConfig.companyId, companyId)))
        .orderBy(asc(documentTypesConfig.sortOrder));
    }
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

  async getAllDocumentDisciplines(companyId?: string): Promise<DocumentDiscipline[]> {
    if (companyId) {
      return db.select().from(documentDisciplines).where(eq(documentDisciplines.companyId, companyId)).orderBy(asc(documentDisciplines.sortOrder));
    }
    return db.select().from(documentDisciplines).orderBy(asc(documentDisciplines.sortOrder));
  },

  async getActiveDocumentDisciplines(companyId?: string): Promise<DocumentDiscipline[]> {
    if (companyId) {
      return db.select().from(documentDisciplines)
        .where(and(eq(documentDisciplines.isActive, true), eq(documentDisciplines.companyId, companyId)))
        .orderBy(asc(documentDisciplines.sortOrder));
    }
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

  async getAllDocumentCategories(companyId?: string): Promise<DocumentCategory[]> {
    if (companyId) {
      return db.select().from(documentCategories).where(eq(documentCategories.companyId, companyId)).orderBy(asc(documentCategories.sortOrder));
    }
    return db.select().from(documentCategories).orderBy(asc(documentCategories.sortOrder));
  },

  async getActiveDocumentCategories(companyId?: string): Promise<DocumentCategory[]> {
    if (companyId) {
      return db.select().from(documentCategories)
        .where(and(eq(documentCategories.isActive, true), eq(documentCategories.companyId, companyId)))
        .orderBy(asc(documentCategories.sortOrder));
    }
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
    companyId?: string;
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
    kbFilter?: string;
    showLatestOnly?: boolean;
    mimeTypePrefix?: string;
    excludeChat?: boolean;
    allowedJobIds?: string[];
  }): Promise<{ documents: DocumentWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (filters.companyId) conditions.push(eq(documents.companyId, filters.companyId));
    
    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(sql`(LOWER(${documents.title}) LIKE ${searchTerm} OR LOWER(${documents.documentNumber}) LIKE ${searchTerm} OR LOWER(${documents.tags}) LIKE ${searchTerm})`);
    }
    if (filters.status) conditions.push(eq(documents.status, filters.status as typeof documents.status.enumValues[number]));
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
    if (filters.kbFilter === "linked") {
      conditions.push(sql`${documents.kbDocumentId} IS NOT NULL`);
    } else if (filters.kbFilter === "not_linked") {
      conditions.push(sql`${documents.kbDocumentId} IS NULL`);
    } else if (filters.kbFilter && filters.kbFilter !== "all") {
      conditions.push(sql`${documents.kbDocumentId} IN (SELECT id FROM kb_documents WHERE project_id = ${filters.kbFilter})`);
    }
    if (filters.showLatestOnly) conditions.push(eq(documents.isLatestVersion, true));
    if (filters.mimeTypePrefix) {
      const prefix = `${filters.mimeTypePrefix}%`;
      conditions.push(sql`${documents.mimeType} LIKE ${prefix}`);
    }
    if (filters.excludeChat) {
      conditions.push(sql`${documents.conversationId} IS NULL`);
      conditions.push(sql`${documents.messageId} IS NULL`);
    }
    if (filters.allowedJobIds) {
      if (filters.allowedJobIds.length === 0) {
        conditions.push(sql`${documents.jobId} IS NULL`);
      } else {
        conditions.push(sql`(${documents.jobId} IS NULL OR ${documents.jobId} IN (${sql.join(filters.allowedJobIds.map(id => sql`${id}`), sql`, `)}))`);
      }
    }

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

  async getDocumentsByIds(ids: string[]): Promise<DocumentWithDetails[]> {
    if (ids.length === 0) return [];
    const docs = await db.select().from(documents).where(inArray(documents.id, ids));
    if (docs.length === 0) return [];

    const typeIds = [...new Set(docs.map(d => d.typeId).filter(Boolean))] as string[];
    const disciplineIds = [...new Set(docs.map(d => d.disciplineId).filter(Boolean))] as string[];
    const categoryIds = [...new Set(docs.map(d => d.categoryId).filter(Boolean))] as string[];
    const statusIds = [...new Set(docs.map(d => d.documentTypeStatusId).filter(Boolean))] as string[];
    const jobIds = [...new Set(docs.map(d => d.jobId).filter(Boolean))] as string[];
    const panelIds = [...new Set(docs.map(d => d.panelId).filter(Boolean))] as string[];
    const supplierIds = [...new Set(docs.map(d => d.supplierId).filter(Boolean))] as string[];
    const userIds = [...new Set(docs.map(d => d.uploadedBy).filter(Boolean))] as string[];

    const [typesArr, disciplinesArr, categoriesArr, statusesArr, jobsArr, panelsArr, suppliersArr, usersArr] = await Promise.all([
      typeIds.length > 0 ? db.select().from(documentTypesConfig).where(inArray(documentTypesConfig.id, typeIds)) : [],
      disciplineIds.length > 0 ? db.select().from(documentDisciplines).where(inArray(documentDisciplines.id, disciplineIds)) : [],
      categoryIds.length > 0 ? db.select().from(documentCategories).where(inArray(documentCategories.id, categoryIds)) : [],
      statusIds.length > 0 ? db.select().from(documentTypeStatuses).where(inArray(documentTypeStatuses.id, statusIds)) : [],
      jobIds.length > 0 ? db.select().from(jobs).where(inArray(jobs.id, jobIds)) : [],
      panelIds.length > 0 ? db.select().from(panelRegister).where(inArray(panelRegister.id, panelIds)) : [],
      supplierIds.length > 0 ? db.select().from(suppliers).where(inArray(suppliers.id, supplierIds)) : [],
      userIds.length > 0 ? db.select().from(users).where(inArray(users.id, userIds)) : [],
    ]);

    const typesMap = new Map(typesArr.map(t => [t.id, t]));
    const disciplinesMap = new Map(disciplinesArr.map(d => [d.id, d]));
    const categoriesMap = new Map(categoriesArr.map(c => [c.id, c]));
    const statusesMap = new Map(statusesArr.map(s => [s.id, s]));
    const jobsMap = new Map(jobsArr.map(j => [j.id, j]));
    const panelsMap = new Map(panelsArr.map(p => [p.id, p]));
    const suppliersMap = new Map(suppliersArr.map(s => [s.id, s]));
    const usersMap = new Map(usersArr.map(u => [u.id, { id: u.id, email: u.email, name: u.name, role: u.role }]));

    return docs.map(doc => ({
      ...doc,
      type: doc.typeId ? typesMap.get(doc.typeId) || null : null,
      discipline: doc.disciplineId ? disciplinesMap.get(doc.disciplineId) || null : null,
      category: doc.categoryId ? categoriesMap.get(doc.categoryId) || null : null,
      documentTypeStatus: doc.documentTypeStatusId ? statusesMap.get(doc.documentTypeStatusId) || null : null,
      job: doc.jobId ? jobsMap.get(doc.jobId) || null : null,
      panel: doc.panelId ? panelsMap.get(doc.panelId) || null : null,
      supplier: doc.supplierId ? suppliersMap.get(doc.supplierId) || null : null,
      uploadedByUser: doc.uploadedBy ? usersMap.get(doc.uploadedBy) || null : null,
    }));
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
    const { getNextSequenceNumber } = await import("../lib/sequence-generator");
    return getNextSequenceNumber("document", `${typeId}_${year}`, `${prefix}-${year}-`, 3);
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
    return await db.transaction(async (tx) => {
      await tx.update(documents)
        .set({ isLatestVersion: false, status: "SUPERSEDED", updatedAt: new Date() })
        .where(eq(documents.id, parentDocumentId));

      const [result] = await tx.insert(documents).values({
        ...data,
        parentDocumentId,
        isLatestVersion: true,
      }).returning();

      return result;
    });
  },

  async getAllDocumentBundles(companyId?: string): Promise<DocumentBundleWithItems[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(documentBundles.companyId, companyId));
    const bundles = conditions.length > 0
      ? await db.select().from(documentBundles).where(and(...conditions)).orderBy(desc(documentBundles.createdAt))
      : await db.select().from(documentBundles).orderBy(desc(documentBundles.createdAt));
    
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
