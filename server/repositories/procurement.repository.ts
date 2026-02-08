import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  suppliers, itemCategories, items, purchaseOrders, purchaseOrderItems, purchaseOrderAttachments,
  users,
  type InsertSupplier, type Supplier,
  type InsertItemCategory, type ItemCategory,
  type InsertItem, type Item,
  type InsertPurchaseOrder, type PurchaseOrder,
  type InsertPurchaseOrderItem, type PurchaseOrderItem,
  type InsertPurchaseOrderAttachment, type PurchaseOrderAttachment,
  type User
} from "@shared/schema";

export interface ItemWithDetails extends Item {
  supplier?: Supplier;
  category?: ItemCategory;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplier?: Supplier;
  requestedBy?: User;
  approvedBy?: User;
  items?: PurchaseOrderItem[];
}

export class ProcurementRepository {
  async getAllSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(asc(suppliers.name));
  }

  async getActiveSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [supplier] = await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
    return supplier;
  }

  async deleteSupplier(id: string): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  async getAllItemCategories(): Promise<ItemCategory[]> {
    return db.select().from(itemCategories).orderBy(asc(itemCategories.name));
  }

  async getActiveItemCategories(): Promise<ItemCategory[]> {
    return db.select().from(itemCategories).where(eq(itemCategories.isActive, true)).orderBy(asc(itemCategories.name));
  }

  async getItemCategory(id: string): Promise<ItemCategory | undefined> {
    const [category] = await db.select().from(itemCategories).where(eq(itemCategories.id, id));
    return category;
  }

  async createItemCategory(data: InsertItemCategory): Promise<ItemCategory> {
    const [category] = await db.insert(itemCategories).values(data).returning();
    return category;
  }

  async updateItemCategory(id: string, data: Partial<InsertItemCategory>): Promise<ItemCategory | undefined> {
    const [category] = await db.update(itemCategories).set({ ...data, updatedAt: new Date() }).where(eq(itemCategories.id, id)).returning();
    return category;
  }

  async deleteItemCategory(id: string): Promise<void> {
    await db.delete(itemCategories).where(eq(itemCategories.id, id));
  }

  async getAllItems(): Promise<ItemWithDetails[]> {
    const allItems = await db.select().from(items).orderBy(asc(items.name));
    return this.enrichItems(allItems);
  }

  async getActiveItems(): Promise<ItemWithDetails[]> {
    const activeItems = await db.select().from(items).where(eq(items.isActive, true)).orderBy(asc(items.name));
    return this.enrichItems(activeItems);
  }

  private async enrichItems(itemsList: Item[]): Promise<ItemWithDetails[]> {
    const result: ItemWithDetails[] = [];
    for (const item of itemsList) {
      const [supplier] = item.supplierId ? await db.select().from(suppliers).where(eq(suppliers.id, item.supplierId)) : [];
      const [category] = item.categoryId ? await db.select().from(itemCategories).where(eq(itemCategories.id, item.categoryId)) : [];
      result.push({ ...item, supplier: supplier || undefined, category: category || undefined });
    }
    return result;
  }

  async getItem(id: string): Promise<ItemWithDetails | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    if (!item) return undefined;
    const enriched = await this.enrichItems([item]);
    return enriched[0];
  }

  async getItemsByCategory(categoryId: string): Promise<ItemWithDetails[]> {
    const categoryItems = await db.select().from(items).where(eq(items.categoryId, categoryId)).orderBy(asc(items.name));
    return this.enrichItems(categoryItems);
  }

  async getItemsBySupplier(supplierId: string): Promise<ItemWithDetails[]> {
    const supplierItems = await db.select().from(items).where(eq(items.supplierId, supplierId)).orderBy(asc(items.name));
    return this.enrichItems(supplierItems);
  }

  async createItem(data: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(data).returning();
    return item;
  }

  async updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(items).set({ ...data, updatedAt: new Date() }).where(eq(items.id, id)).returning();
    return item;
  }

  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  async getAllPurchaseOrders(): Promise<PurchaseOrderWithDetails[]> {
    const orders = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
    return this.enrichPurchaseOrders(orders);
  }

  async getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrderWithDetails[]> {
    const orders = await db.select().from(purchaseOrders).where(eq(purchaseOrders.status, status as typeof purchaseOrders.status.enumValues[number])).orderBy(desc(purchaseOrders.createdAt));
    return this.enrichPurchaseOrders(orders);
  }

  async getPurchaseOrdersByUser(userId: string): Promise<PurchaseOrderWithDetails[]> {
    const orders = await db.select().from(purchaseOrders).where(eq(purchaseOrders.requestedById, userId)).orderBy(desc(purchaseOrders.createdAt));
    return this.enrichPurchaseOrders(orders);
  }

  private async enrichPurchaseOrders(orders: PurchaseOrder[]): Promise<PurchaseOrderWithDetails[]> {
    const result: PurchaseOrderWithDetails[] = [];
    for (const order of orders) {
      const [supplier] = order.supplierId ? await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId)) : [];
      const [requestedBy] = order.requestedById ? await db.select().from(users).where(eq(users.id, order.requestedById)) : [];
      const [approvedBy] = order.approvedById ? await db.select().from(users).where(eq(users.id, order.approvedById)) : [];
      const lineItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, order.id));
      result.push({
        ...order,
        supplier: supplier || undefined,
        requestedBy: requestedBy || undefined,
        approvedBy: approvedBy || undefined,
        items: lineItems
      });
    }
    return result;
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrderWithDetails | undefined> {
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) return undefined;
    const enriched = await this.enrichPurchaseOrders([order]);
    return enriched[0];
  }

  async createPurchaseOrder(data: InsertPurchaseOrder, lineItems: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails> {
    const [order] = await db.insert(purchaseOrders).values(data).returning();
    
    if (lineItems.length > 0) {
      await db.insert(purchaseOrderItems).values(lineItems.map(item => ({ ...item, purchaseOrderId: order.id })));
    }
    
    return this.getPurchaseOrder(order.id) as Promise<PurchaseOrderWithDetails>;
  }

  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>, lineItems?: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails | undefined> {
    const [order] = await db.update(purchaseOrders).set({ ...data, updatedAt: new Date() }).where(eq(purchaseOrders.id, id)).returning();
    if (!order) return undefined;
    
    if (lineItems !== undefined) {
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
      if (lineItems.length > 0) {
        await db.insert(purchaseOrderItems).values(lineItems.map(item => ({ ...item, purchaseOrderId: id })));
      }
    }
    
    return this.getPurchaseOrder(id);
  }

  async submitPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [order] = await db.update(purchaseOrders)
      .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return order;
  }

  async approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder | undefined> {
    const [order] = await db.update(purchaseOrders)
      .set({ status: "APPROVED", approvedById, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return order;
  }

  async rejectPurchaseOrder(id: string, rejectedById: string, reason: string): Promise<PurchaseOrder | undefined> {
    const [order] = await db.update(purchaseOrders)
      .set({ status: "REJECTED", rejectedById, rejectedAt: new Date(), rejectionReason: reason, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return order;
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await db.delete(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.purchaseOrderId, id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  async getNextPONumber(): Promise<string> {
    const result = await db.select({ poNumber: purchaseOrders.poNumber }).from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)).limit(1);
    if (result.length === 0) return "PO-0001";
    const lastNum = parseInt(result[0].poNumber.replace("PO-", "")) || 0;
    return `PO-${String(lastNum + 1).padStart(4, "0")}`;
  }

  async getPurchaseOrderAttachments(poId: string): Promise<(PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[]> {
    const attachments = await db.select().from(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.purchaseOrderId, poId));
    const result: (PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[] = [];
    for (const att of attachments) {
      const [user] = att.uploadedById ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, att.uploadedById)) : [];
      result.push({ ...att, uploadedBy: user || null });
    }
    return result;
  }

  async getPurchaseOrderAttachment(id: string): Promise<PurchaseOrderAttachment | undefined> {
    const [att] = await db.select().from(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, id));
    return att;
  }

  async createPurchaseOrderAttachment(data: InsertPurchaseOrderAttachment): Promise<PurchaseOrderAttachment> {
    const [att] = await db.insert(purchaseOrderAttachments).values(data).returning();
    return att;
  }

  async deletePurchaseOrderAttachment(id: string): Promise<void> {
    await db.delete(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, id));
  }
}

export const procurementRepository = new ProcurementRepository();
