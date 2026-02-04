import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import {
  users, devices, userPermissions,
  type InsertUser, type User, type Device,
  type UserPermission, type FunctionKey, type PermissionLevel,
  FUNCTION_KEYS
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

export function sha256Hex(raw: string | Buffer) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function randomKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export class UserRepository {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(data: InsertUser & { password?: string }): Promise<User> {
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
      role: data.role || "USER",
      isActive: data.isActive ?? true,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser & { isActive?: boolean; password?: string }>): Promise<User | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateUserSettings(userId: string, settings: { selectedFactoryIds?: string[] | null }): Promise<void> {
    await db.update(users)
      .set({
        selectedFactoryIds: settings.selectedFactoryIds,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async getDevice(id: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).where(eq(devices.id, id));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  }

  async getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id))
      .where(and(eq(devices.apiKeyHash, apiKeyHash), eq(devices.isActive, true)));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  }

  async createDevice(data: { userId: string; deviceName: string; os: string }): Promise<{ device: Device; deviceKey: string }> {
    const deviceKey = randomKey();
    const apiKeyHash = sha256Hex(deviceKey);
    const [device] = await db.insert(devices).values({
      userId: data.userId,
      deviceName: data.deviceName,
      os: data.os || "Windows",
      apiKeyHash,
      isActive: true,
    }).returning();
    return { device, deviceKey };
  }

  async updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set({ ...data, updatedAt: new Date() }).where(eq(devices.id, id)).returning();
    return device;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getAllDevices(): Promise<(Device & { user: User })[]> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).orderBy(desc(devices.createdAt));
    return result.map(r => ({ ...r.devices, user: r.users }));
  }

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return db.select().from(userPermissions).where(eq(userPermissions.userId, userId));
  }

  async getUserPermission(userId: string, functionKey: FunctionKey): Promise<UserPermission | undefined> {
    const [permission] = await db.select().from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.functionKey, functionKey)));
    return permission;
  }

  async setUserPermission(userId: string, functionKey: FunctionKey, permissionLevel: PermissionLevel): Promise<UserPermission> {
    const existing = await this.getUserPermission(userId, functionKey);
    if (existing) {
      const [updated] = await db.update(userPermissions)
        .set({ permissionLevel, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userPermissions)
      .values({ userId, functionKey, permissionLevel })
      .returning();
    return created;
  }

  async deleteUserPermission(userId: string, functionKey: FunctionKey): Promise<void> {
    await db.delete(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.functionKey, functionKey)));
  }

  async initializeUserPermissions(userId: string): Promise<UserPermission[]> {
    const existing = await this.getUserPermissions(userId);
    const existingKeys = new Set(existing.map(p => p.functionKey));
    const missingKeys = FUNCTION_KEYS.filter(k => !existingKeys.has(k));
    
    if (missingKeys.length === 0) return existing;
    
    const newPermissions = await db.insert(userPermissions)
      .values(missingKeys.map(functionKey => ({
        userId,
        functionKey,
        permissionLevel: "VIEW" as PermissionLevel
      })))
      .returning();
    
    return [...existing, ...newPermissions];
  }

  async getAllUserPermissionsForAdmin(): Promise<{ user: User; permissions: UserPermission[] }[]> {
    const allUsers = await this.getAllUsers();
    const result: { user: User; permissions: UserPermission[] }[] = [];
    
    for (const user of allUsers) {
      const permissions = await this.getUserPermissions(user.id);
      result.push({ user, permissions });
    }
    
    return result;
  }
}

export const userRepository = new UserRepository();
