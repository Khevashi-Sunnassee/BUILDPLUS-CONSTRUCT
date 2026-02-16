import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  opportunityUpdates, opportunityFiles, users,
  type OpportunityUpdate, type InsertOpportunityUpdate,
  type OpportunityFile, type InsertOpportunityFile,
  type User,
} from "@shared/schema";

export const opportunityMethods = {
  async getOpportunityUpdates(jobId: string): Promise<(OpportunityUpdate & { user: User; files?: OpportunityFile[] })[]> {
    const result = await db.select()
      .from(opportunityUpdates)
      .innerJoin(users, eq(opportunityUpdates.userId, users.id))
      .where(eq(opportunityUpdates.jobId, jobId))
      .orderBy(desc(opportunityUpdates.createdAt));

    const updates = result.map(r => ({
      ...r.opportunity_updates,
      user: r.users,
    }));

    const updateIds = updates.map(u => u.id);
    if (updateIds.length > 0) {
      const linkedFiles = await db.select()
        .from(opportunityFiles)
        .where(inArray(opportunityFiles.updateId, updateIds));

      const filesByUpdateId = new Map<string, OpportunityFile[]>();
      for (const file of linkedFiles) {
        if (file.updateId) {
          if (!filesByUpdateId.has(file.updateId)) {
            filesByUpdateId.set(file.updateId, []);
          }
          filesByUpdateId.get(file.updateId)!.push(file);
        }
      }

      return updates.map(u => ({
        ...u,
        files: filesByUpdateId.get(u.id) || [],
      }));
    }

    return updates.map(u => ({ ...u, files: [] }));
  },

  async getOpportunityUpdate(id: string): Promise<OpportunityUpdate | undefined> {
    const [update] = await db.select().from(opportunityUpdates).where(eq(opportunityUpdates.id, id)).limit(1);
    return update;
  },

  async createOpportunityUpdate(data: InsertOpportunityUpdate): Promise<OpportunityUpdate> {
    const [update] = await db.insert(opportunityUpdates).values(data).returning();
    return update;
  },

  async deleteOpportunityUpdate(id: string): Promise<void> {
    await db.delete(opportunityUpdates).where(eq(opportunityUpdates.id, id));
  },

  async getOpportunityFiles(jobId: string): Promise<(OpportunityFile & { uploadedBy?: User | null })[]> {
    const files = await db.select().from(opportunityFiles).where(eq(opportunityFiles.jobId, jobId)).orderBy(desc(opportunityFiles.createdAt));

    if (files.length === 0) return [];

    const uploaderIds = [...new Set(files.map(f => f.uploadedById).filter((id): id is string => !!id))];
    const uploaderMap = new Map<string, User>();

    if (uploaderIds.length > 0) {
      const uploaders = await db.select().from(users).where(inArray(users.id, uploaderIds));
      for (const user of uploaders) {
        uploaderMap.set(user.id, user);
      }
    }

    return files.map(file => ({
      ...file,
      uploadedBy: file.uploadedById ? uploaderMap.get(file.uploadedById) || null : null,
    }));
  },

  async getOpportunityFile(id: string): Promise<OpportunityFile | undefined> {
    const [file] = await db.select().from(opportunityFiles).where(eq(opportunityFiles.id, id)).limit(1);
    return file;
  },

  async createOpportunityFile(data: InsertOpportunityFile): Promise<OpportunityFile> {
    const [file] = await db.insert(opportunityFiles).values(data).returning();
    return file;
  },

  async deleteOpportunityFile(id: string): Promise<void> {
    await db.delete(opportunityFiles).where(eq(opportunityFiles.id, id));
  },
};
