import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  userPermissions, users, FUNCTION_KEYS,
  type UserPermission, type FunctionKey, type PermissionLevel, type User,
} from "@shared/schema";

export const permissionMethods = {
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return await db.select().from(userPermissions).where(eq(userPermissions.userId, userId));
  },

  async getUserPermission(userId: string, functionKey: FunctionKey): Promise<UserPermission | undefined> {
    const [permission] = await db.select().from(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.functionKey, functionKey)
      ));
    return permission;
  },

  async setUserPermission(userId: string, functionKey: FunctionKey, permissionLevel: PermissionLevel): Promise<UserPermission> {
    const existing = await permissionMethods.getUserPermission(userId, functionKey);
    if (existing) {
      const [updated] = await db.update(userPermissions)
        .set({ permissionLevel, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userPermissions).values({
        userId,
        functionKey,
        permissionLevel,
      }).returning();
      return created;
    }
  },

  async deleteUserPermission(userId: string, functionKey: FunctionKey): Promise<void> {
    await db.delete(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.functionKey, functionKey)
      ));
  },

  async initializeUserPermissions(userId: string): Promise<UserPermission[]> {
    const existingPerms = await permissionMethods.getUserPermissions(userId);
    const existingKeys = new Set(existingPerms.map(p => p.functionKey));
    const missingKeys = FUNCTION_KEYS.filter(key => !existingKeys.has(key));
    
    if (missingKeys.length === 0) return existingPerms;

    const newPerms = await db.insert(userPermissions)
      .values(missingKeys.map(functionKey => ({
        userId,
        functionKey,
        permissionLevel: "VIEW_AND_UPDATE" as PermissionLevel,
      })))
      .returning();
    
    return [...existingPerms, ...newPerms];
  },

  async getAllUserPermissionsForAdmin(companyId?: string): Promise<{ user: User; permissions: UserPermission[] }[]> {
    const conditions = [eq(users.isActive, true)];
    if (companyId) {
      conditions.push(eq(users.companyId, companyId));
    }
    const allUsers = await db.select().from(users).where(and(...conditions));
    const userIds = allUsers.map(u => u.id);
    
    const allPerms = userIds.length > 0 
      ? await db.select().from(userPermissions).where(inArray(userPermissions.userId, userIds))
      : [];
    
    const permsByUser = new Map<string, UserPermission[]>();
    for (const perm of allPerms) {
      const existing = permsByUser.get(perm.userId) || [];
      existing.push(perm);
      permsByUser.set(perm.userId, existing);
    }
    
    return allUsers.map(user => ({
      user,
      permissions: permsByUser.get(user.id) || [],
    }));
  },
};
