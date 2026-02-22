import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  markupCredentials,
  type MarkupCredential,
} from "@shared/schema";

export const markupCredentialMethods = {
  async getMarkupCredential(userId: string, companyId: string): Promise<MarkupCredential | undefined> {
    const [result] = await db
      .select()
      .from(markupCredentials)
      .where(and(eq(markupCredentials.userId, userId), eq(markupCredentials.companyId, companyId)))
      .limit(1);
    return result;
  },

  async upsertMarkupCredential(data: {
    userId: string;
    companyId: string;
    markupAppUrl: string;
    markupEmail: string;
    markupApiKey?: string;
  }): Promise<MarkupCredential> {
    const existing = await markupCredentialMethods.getMarkupCredential(data.userId, data.companyId);
    if (existing) {
      const [updated] = await db
        .update(markupCredentials)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(markupCredentials.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(markupCredentials).values(data).returning();
    return created;
  },

  async updateMarkupCredentialLastUsed(id: string): Promise<void> {
    await db.update(markupCredentials).set({ lastUsedAt: new Date() }).where(eq(markupCredentials.id, id));
  },

  async deleteMarkupCredential(userId: string, companyId: string): Promise<void> {
    await db
      .delete(markupCredentials)
      .where(and(eq(markupCredentials.userId, userId), eq(markupCredentials.companyId, companyId)));
  },
};
