import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db";
import { sha256Hex, randomKey } from "./utils";
import {
  users, devices, departments, mappingRules,
  type User, type InsertUser, type Device, type InsertDevice,
  type MappingRule, type InsertMappingRule,
} from "@shared/schema";
import bcrypt from "bcrypt";

export const userMethods = {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  },

  async createUser(data: InsertUser & { password?: string; defaultFactoryId?: string | null }): Promise<User> {
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const [user] = await db.insert(users).values({
      companyId: data.companyId,
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
      role: data.role || "USER",
      isActive: data.isActive ?? true,
      defaultFactoryId: data.defaultFactoryId || null,
    }).returning();
    return user;
  },

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
  },

  async deleteUser(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.userId, id));
    await db.delete(users).where(eq(users.id, id));
  },

  async getAllUsers(companyId?: string): Promise<User[]> {
    if (companyId) {
      return db.select().from(users).where(eq(users.companyId, companyId)).orderBy(desc(users.createdAt));
    }
    return db.select().from(users).orderBy(desc(users.createdAt));
  },

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  },

  async updateUserSettings(userId: string, settings: { selectedFactoryIds?: string[] | null; defaultFactoryId?: string | null }): Promise<void> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (settings.selectedFactoryIds !== undefined) {
      updateData.selectedFactoryIds = settings.selectedFactoryIds;
    }
    if (settings.defaultFactoryId !== undefined) {
      updateData.defaultFactoryId = settings.defaultFactoryId;
    }
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));
  },

  async getDepartment(id: string): Promise<any | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0];
  },

  async getDepartmentsByCompany(companyId: string): Promise<any[]> {
    return db.select().from(departments).where(eq(departments.companyId, companyId)).orderBy(departments.name);
  },

  async createDepartment(data: any): Promise<any> {
    const [department] = await db.insert(departments).values(data).returning();
    return department;
  },

  async updateDepartment(id: string, data: any): Promise<any | undefined> {
    const [department] = await db.update(departments).set({ ...data, updatedAt: new Date() }).where(eq(departments.id, id)).returning();
    return department;
  },

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  },

  async getDevice(id: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).where(eq(devices.id, id));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  },

  async getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id))
      .where(and(eq(devices.apiKeyHash, apiKeyHash), eq(devices.isActive, true)));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  },

  async createDevice(data: { userId: string; deviceName: string; os: string; companyId: string }): Promise<{ device: Device; deviceKey: string }> {
    const deviceKey = randomKey();
    const apiKeyHash = sha256Hex(deviceKey);
    const [device] = await db.insert(devices).values({
      companyId: data.companyId,
      userId: data.userId,
      deviceName: data.deviceName,
      os: data.os || "Windows",
      apiKeyHash,
      isActive: true,
    }).returning();
    return { device, deviceKey };
  },

  async updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set({ ...data, updatedAt: new Date() }).where(eq(devices.id, id)).returning();
    return device;
  },

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  },

  async getAllDevices(companyId?: string): Promise<(Device & { user: User })[]> {
    const query = db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).orderBy(desc(devices.createdAt));
    if (companyId) {
      const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).where(eq(devices.companyId, companyId)).orderBy(desc(devices.createdAt));
      return result.map(r => ({ ...r.devices, user: r.users }));
    }
    const result = await query;
    return result.map(r => ({ ...r.devices, user: r.users }));
  },

  async createMappingRule(data: InsertMappingRule): Promise<MappingRule> {
    const [rule] = await db.insert(mappingRules).values(data).returning();
    return rule;
  },

  async deleteMappingRule(id: string): Promise<void> {
    await db.delete(mappingRules).where(eq(mappingRules.id, id));
  },

  async getMappingRule(id: string): Promise<MappingRule | undefined> {
    const [rule] = await db.select().from(mappingRules).where(eq(mappingRules.id, id));
    return rule;
  },

  async getMappingRules(companyId?: string): Promise<MappingRule[]> {
    if (companyId) {
      return db.select().from(mappingRules).where(eq(mappingRules.companyId, companyId)).orderBy(asc(mappingRules.priority));
    }
    return db.select().from(mappingRules).orderBy(asc(mappingRules.priority));
  },
};
