import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  broadcastTemplates, broadcastMessages, broadcastDeliveries, users,
  type BroadcastTemplate, type InsertBroadcastTemplate,
  type BroadcastMessage, type InsertBroadcastMessage, type BroadcastMessageWithDetails,
  type BroadcastDelivery,
} from "@shared/schema";

export const broadcastMethods = {
  async getBroadcastTemplates(companyId: string): Promise<BroadcastTemplate[]> {
    return db.select().from(broadcastTemplates)
      .where(eq(broadcastTemplates.companyId, companyId))
      .orderBy(desc(broadcastTemplates.createdAt));
  },

  async getBroadcastTemplate(id: string): Promise<BroadcastTemplate | undefined> {
    const [result] = await db.select().from(broadcastTemplates)
      .where(eq(broadcastTemplates.id, id));
    return result;
  },

  async createBroadcastTemplate(data: InsertBroadcastTemplate): Promise<BroadcastTemplate> {
    const [result] = await db.insert(broadcastTemplates).values(data).returning();
    return result;
  },

  async updateBroadcastTemplate(id: string, data: Partial<InsertBroadcastTemplate>): Promise<BroadcastTemplate | undefined> {
    const [result] = await db.update(broadcastTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(broadcastTemplates.id, id))
      .returning();
    return result;
  },

  async deleteBroadcastTemplate(id: string): Promise<void> {
    await db.delete(broadcastTemplates).where(eq(broadcastTemplates.id, id));
  },

  async createBroadcastMessage(data: InsertBroadcastMessage): Promise<BroadcastMessage> {
    const [result] = await db.insert(broadcastMessages).values(data).returning();
    return result;
  },

  async getBroadcastMessages(companyId: string): Promise<BroadcastMessageWithDetails[]> {
    const messages = await db.select().from(broadcastMessages)
      .where(eq(broadcastMessages.companyId, companyId))
      .orderBy(desc(broadcastMessages.createdAt));
    
    const results: BroadcastMessageWithDetails[] = [];
    for (const msg of messages) {
      const [template] = msg.templateId 
        ? await db.select().from(broadcastTemplates).where(eq(broadcastTemplates.id, msg.templateId))
        : [null];
      const [sentByUser] = await db.select().from(users).where(eq(users.id, msg.sentBy));
      const safeUser = sentByUser ? { ...sentByUser, password: undefined } : null;
      results.push({ ...msg, template, sentByUser: safeUser as any });
    }
    return results;
  },

  async getBroadcastMessage(id: string): Promise<BroadcastMessageWithDetails | undefined> {
    const [msg] = await db.select().from(broadcastMessages)
      .where(eq(broadcastMessages.id, id));
    if (!msg) return undefined;

    const [template] = msg.templateId
      ? await db.select().from(broadcastTemplates).where(eq(broadcastTemplates.id, msg.templateId))
      : [null];
    const [sentByUser] = await db.select().from(users).where(eq(users.id, msg.sentBy));
    const deliveriesList = await db.select().from(broadcastDeliveries)
      .where(eq(broadcastDeliveries.broadcastMessageId, id));
    const safeUser = sentByUser ? { ...sentByUser, password: undefined } : null;
    return { ...msg, template, sentByUser: safeUser as any, deliveries: deliveriesList };
  },

  async getBroadcastDeliveries(broadcastMessageId: string): Promise<BroadcastDelivery[]> {
    return db.select().from(broadcastDeliveries)
      .where(eq(broadcastDeliveries.broadcastMessageId, broadcastMessageId))
      .orderBy(desc(broadcastDeliveries.createdAt));
  },
};
