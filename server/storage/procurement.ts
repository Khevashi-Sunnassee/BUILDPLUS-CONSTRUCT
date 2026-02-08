import { eq, and, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import {
  customers, suppliers, itemCategories, items,
  purchaseOrders, purchaseOrderItems, purchaseOrderAttachments,
  users,
  type Customer, type InsertCustomer,
  type Supplier, type InsertSupplier,
  type ItemCategory, type InsertItemCategory,
  type Item, type InsertItem,
  type PurchaseOrder, type InsertPurchaseOrder,
  type PurchaseOrderItem, type InsertPurchaseOrderItem,
  type PurchaseOrderAttachment, type InsertPurchaseOrderAttachment,
  type User,
} from "@shared/schema";
import type { ItemWithDetails, PurchaseOrderWithDetails } from "./types";

async function getPurchaseOrderWithDetails(poId: string): Promise<PurchaseOrderWithDetails | undefined> {
  const [poRow] = await db.select().from(purchaseOrders)
    .leftJoin(users, eq(purchaseOrders.requestedById, users.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, poId));
  if (!poRow) return undefined;

  const lineItems = await db.select().from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId))
    .orderBy(asc(purchaseOrderItems.sortOrder));

  let approvedBy: User | null = null;
  let rejectedBy: User | null = null;
  if (poRow.purchase_orders.approvedById) {
    const [u] = await db.select().from(users).where(eq(users.id, poRow.purchase_orders.approvedById));
    approvedBy = u || null;
  }
  if (poRow.purchase_orders.rejectedById) {
    const [u] = await db.select().from(users).where(eq(users.id, poRow.purchase_orders.rejectedById));
    rejectedBy = u || null;
  }

  const attachmentCountResult = await db.select({ count: sql<number>`count(*)` })
    .from(purchaseOrderAttachments)
    .where(eq(purchaseOrderAttachments.purchaseOrderId, poId));
  const attachmentCount = Number(attachmentCountResult[0]?.count || 0);

  return {
    ...poRow.purchase_orders,
    requestedBy: poRow.users!,
    approvedBy,
    rejectedBy,
    supplier: poRow.suppliers,
    items: lineItems,
    attachmentCount,
  };
}

export const procurementMethods = {
  async getAllCustomers(companyId?: string): Promise<Customer[]> {
    if (companyId) {
      return db.select().from(customers).where(eq(customers.companyId, companyId)).orderBy(asc(customers.name));
    }
    return db.select().from(customers).orderBy(asc(customers.name));
  },

  async getActiveCustomers(companyId?: string): Promise<Customer[]> {
    if (companyId) {
      return db.select().from(customers).where(and(eq(customers.companyId, companyId), eq(customers.isActive, true))).orderBy(asc(customers.name));
    }
    return db.select().from(customers).where(eq(customers.isActive, true)).orderBy(asc(customers.name));
  },

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  },

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  },

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set({ ...data, updatedAt: new Date() }).where(eq(customers.id, id)).returning();
    return customer;
  },

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  },

  async getAllSuppliers(companyId?: string): Promise<Supplier[]> {
    if (companyId) {
      return db.select().from(suppliers).where(eq(suppliers.companyId, companyId)).orderBy(asc(suppliers.name));
    }
    return db.select().from(suppliers).orderBy(asc(suppliers.name));
  },

  async getActiveSuppliers(companyId?: string): Promise<Supplier[]> {
    if (companyId) {
      return db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true))).orderBy(asc(suppliers.name));
    }
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
  },

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  },

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  },

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [supplier] = await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
    return supplier;
  },

  async deleteSupplier(id: string): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  },

  async getAllItemCategories(companyId?: string): Promise<ItemCategory[]> {
    if (companyId) {
      return db.select().from(itemCategories).where(eq(itemCategories.companyId, companyId)).orderBy(asc(itemCategories.name));
    }
    return db.select().from(itemCategories).orderBy(asc(itemCategories.name));
  },

  async getActiveItemCategories(companyId?: string): Promise<ItemCategory[]> {
    if (companyId) {
      return db.select().from(itemCategories).where(and(eq(itemCategories.companyId, companyId), eq(itemCategories.isActive, true))).orderBy(asc(itemCategories.name));
    }
    return db.select().from(itemCategories).where(eq(itemCategories.isActive, true)).orderBy(asc(itemCategories.name));
  },

  async getItemCategory(id: string): Promise<ItemCategory | undefined> {
    const [category] = await db.select().from(itemCategories).where(eq(itemCategories.id, id));
    return category;
  },

  async createItemCategory(data: InsertItemCategory): Promise<ItemCategory> {
    const [category] = await db.insert(itemCategories).values(data).returning();
    return category;
  },

  async updateItemCategory(id: string, data: Partial<InsertItemCategory>): Promise<ItemCategory | undefined> {
    const [category] = await db.update(itemCategories).set({ ...data, updatedAt: new Date() }).where(eq(itemCategories.id, id)).returning();
    return category;
  },

  async deleteItemCategory(id: string): Promise<void> {
    await db.delete(itemCategories).where(eq(itemCategories.id, id));
  },

  async getAllItems(companyId?: string): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(companyId ? eq(items.companyId, companyId) : undefined)
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  },

  async getActiveItems(companyId?: string): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(companyId ? and(eq(items.companyId, companyId), eq(items.isActive, true)) : eq(items.isActive, true))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  },

  async getItem(id: string): Promise<ItemWithDetails | undefined> {
    const [row] = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.id, id));
    if (!row) return undefined;
    return { ...row.items, category: row.item_categories, supplier: row.suppliers };
  },

  async getItemsByCategory(categoryId: string): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.categoryId, categoryId))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  },

  async getItemsBySupplier(supplierId: string): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.supplierId, supplierId))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  },

  async createItem(data: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(data).returning();
    return item;
  },

  async updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(items).set({ ...data, updatedAt: new Date() }).where(eq(items.id, id)).returning();
    return item;
  },

  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  },

  async bulkImportItems(itemsData: InsertItem[]): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const itemData of itemsData) {
      try {
        if (itemData.code) {
          const existing = await db.select().from(items).where(eq(items.code, itemData.code)).limit(1);
          if (existing.length > 0) {
            await db.update(items).set({ ...itemData, updatedAt: new Date() }).where(eq(items.id, existing[0].id));
            updated++;
            continue;
          }
        }
        
        await db.insert(items).values(itemData);
        created++;
      } catch (error: any) {
        errors.push(`Error importing item ${itemData.code || itemData.name}: ${error.message}`);
      }
    }

    return { created, updated, errors };
  },

  async getAllPurchaseOrders(companyId?: string): Promise<PurchaseOrderWithDetails[]> {
    const poRows = await db.select().from(purchaseOrders)
      .where(companyId ? eq(purchaseOrders.companyId, companyId) : undefined)
      .orderBy(desc(purchaseOrders.createdAt));
    const results: PurchaseOrderWithDetails[] = [];
    for (const po of poRows) {
      const details = await getPurchaseOrderWithDetails(po.id);
      if (details) results.push(details);
    }
    return results;
  },

  async getPurchaseOrdersByStatus(status: string, companyId?: string): Promise<PurchaseOrderWithDetails[]> {
    const poRows = await db.select().from(purchaseOrders)
      .where(companyId ? and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.status, status as typeof purchaseOrders.status.enumValues[number])) : eq(purchaseOrders.status, status as typeof purchaseOrders.status.enumValues[number]))
      .orderBy(desc(purchaseOrders.createdAt));
    const results: PurchaseOrderWithDetails[] = [];
    for (const po of poRows) {
      const details = await getPurchaseOrderWithDetails(po.id);
      if (details) results.push(details);
    }
    return results;
  },

  async getPurchaseOrdersByUser(userId: string): Promise<PurchaseOrderWithDetails[]> {
    const poRows = await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.requestedById, userId))
      .orderBy(desc(purchaseOrders.createdAt));
    const results: PurchaseOrderWithDetails[] = [];
    for (const po of poRows) {
      const details = await getPurchaseOrderWithDetails(po.id);
      if (details) results.push(details);
    }
    return results;
  },

  async getPurchaseOrder(id: string): Promise<PurchaseOrderWithDetails | undefined> {
    return getPurchaseOrderWithDetails(id);
  },

  async createPurchaseOrder(data: InsertPurchaseOrder, lineItems: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails> {
    let subtotal = 0;
    const processedItems = lineItems.map((item, idx) => {
      const qty = parseFloat(String(item.quantity || 0));
      const price = parseFloat(String(item.unitPrice || 0));
      const lineTotal = qty * price;
      subtotal += lineTotal;
      return {
        ...item,
        sortOrder: item.sortOrder ?? idx,
        lineTotal: lineTotal.toFixed(2),
      };
    });
    
    const taxRate = parseFloat(String(data.taxRate || 10));
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    
    const [po] = await db.insert(purchaseOrders).values({
      ...data,
      subtotal: subtotal.toFixed(2),
      taxRate: taxRate.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    }).returning();
    
    if (processedItems.length > 0) {
      await db.insert(purchaseOrderItems).values(
        processedItems.map(item => ({
          ...item,
          purchaseOrderId: po.id,
        }))
      );
    }
    
    return (await getPurchaseOrderWithDetails(po.id))!;
  },

  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>, lineItems?: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails | undefined> {
    let updateData: any = { ...data, updatedAt: new Date() };
    
    if (lineItems !== undefined) {
      let subtotal = 0;
      const processedItems = lineItems.map((item, idx) => {
        const qty = parseFloat(String(item.quantity || 0));
        const price = parseFloat(String(item.unitPrice || 0));
        const lineTotal = qty * price;
        subtotal += lineTotal;
        return {
          ...item,
          purchaseOrderId: id,
          sortOrder: item.sortOrder ?? idx,
          lineTotal: lineTotal.toFixed(2),
        };
      });
      
      const taxRate = parseFloat(String(data.taxRate || 10));
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      
      updateData = {
        ...updateData,
        subtotal: subtotal.toFixed(2),
        taxRate: taxRate.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      };
      
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
      if (processedItems.length > 0) {
        await db.insert(purchaseOrderItems).values(processedItems);
      }
    }
    
    const [po] = await db.update(purchaseOrders).set(updateData).where(eq(purchaseOrders.id, id)).returning();
    if (!po) return undefined;
    
    return getPurchaseOrderWithDetails(id);
  },

  async submitPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.update(purchaseOrders).set({
      status: "SUBMITTED",
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, id)).returning();
    return po;
  },

  async approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.update(purchaseOrders).set({
      status: "APPROVED",
      approvedById,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, id)).returning();
    return po;
  },

  async rejectPurchaseOrder(id: string, rejectedById: string, reason: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.update(purchaseOrders).set({
      status: "REJECTED",
      rejectedById,
      rejectedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, id)).returning();
    return po;
  },

  async deletePurchaseOrder(id: string): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  },

  async getNextPONumber(companyId?: string): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders)
      .where(companyId ? eq(purchaseOrders.companyId, companyId) : undefined);
    const count = Number(result?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `PO-${year}-${String(count).padStart(4, "0")}`;
  },

  async getPurchaseOrderAttachments(poId: string): Promise<(PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[]> {
    const attachments = await db.select().from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.purchaseOrderId, poId))
      .orderBy(desc(purchaseOrderAttachments.createdAt));
    
    const result: (PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[] = [];
    for (const attachment of attachments) {
      let uploadedBy: Pick<User, 'id' | 'name' | 'email'> | null = null;
      if (attachment.uploadedById) {
        const [user] = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
        }).from(users).where(eq(users.id, attachment.uploadedById));
        uploadedBy = user || null;
      }
      result.push({ ...attachment, uploadedBy });
    }
    return result;
  },

  async getPurchaseOrderAttachment(id: string): Promise<PurchaseOrderAttachment | undefined> {
    const [attachment] = await db.select().from(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, id));
    return attachment;
  },

  async createPurchaseOrderAttachment(data: InsertPurchaseOrderAttachment): Promise<PurchaseOrderAttachment> {
    const [attachment] = await db.insert(purchaseOrderAttachments).values(data).returning();
    return attachment;
  },

  async deletePurchaseOrderAttachment(id: string): Promise<void> {
    await db.delete(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, id));
  },
};
