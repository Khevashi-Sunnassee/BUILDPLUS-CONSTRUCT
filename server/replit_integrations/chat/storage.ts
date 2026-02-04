import { db } from "../../db";
import { conversations, chatMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

export interface IChatStorage {
  getConversation(id: string): Promise<typeof conversations.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(title: string): Promise<typeof conversations.$inferSelect>;
  deleteConversation(id: string): Promise<void>;
  getMessagesByConversation(conversationId: string): Promise<(typeof chatMessages.$inferSelect)[]>;
  createMessage(conversationId: string, role: string, content: string): Promise<typeof chatMessages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: string) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },

  async getAllConversations() {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string) {
    const [conversation] = await db.insert(conversations).values({ 
      id: generateId(),
      type: "DM",
      name: title 
    }).returning();
    return conversation;
  },

  async deleteConversation(id: string) {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: string) {
    return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
  },

  async createMessage(conversationId: string, role: string, content: string) {
    const [message] = await db.insert(chatMessages).values({ 
      id: generateId(),
      conversationId, 
      senderId: role === "user" ? "user" : "system",
      body: content 
    }).returning();
    return message;
  },
};
