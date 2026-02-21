import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import {
  reviewContextVersions,
  reviewTargets,
  reviewPackets,
  reviewRuns,
  reviewTaskpacks,
  type InsertReviewContextVersion,
  type InsertReviewTarget,
  type InsertReviewPacket,
  type InsertReviewRun,
  type InsertReviewTaskpack,
} from "@shared/schema";

export const reviewModeMethods = {
  async getContextVersions() {
    return db.select().from(reviewContextVersions).orderBy(desc(reviewContextVersions.createdAt)).limit(100);
  },

  async getActiveContextVersion() {
    const [ctx] = await db.select().from(reviewContextVersions).where(eq(reviewContextVersions.isActive, true)).limit(1);
    return ctx ?? null;
  },

  async createContextVersion(data: InsertReviewContextVersion) {
    const [result] = await db.insert(reviewContextVersions).values(data).returning();
    return result;
  },

  async activateContextVersion(id: string) {
    await db.transaction(async (tx) => {
      await tx.update(reviewContextVersions).set({ isActive: false }).where(eq(reviewContextVersions.isActive, true));
      await tx.update(reviewContextVersions).set({ isActive: true }).where(eq(reviewContextVersions.id, id));
    });
  },

  async getTargets() {
    return db.select().from(reviewTargets).orderBy(desc(reviewTargets.createdAt)).limit(200);
  },

  async getTarget(id: string) {
    const [target] = await db.select().from(reviewTargets).where(eq(reviewTargets.id, id)).limit(1);
    return target ?? null;
  },

  async createTarget(data: InsertReviewTarget) {
    const [result] = await db.insert(reviewTargets).values(data).returning();
    return result;
  },

  async updateTarget(id: string, data: Partial<InsertReviewTarget>) {
    const [result] = await db.update(reviewTargets).set(data).where(eq(reviewTargets.id, id)).returning();
    return result;
  },

  async getPackets() {
    return db.select().from(reviewPackets).orderBy(desc(reviewPackets.createdAt)).limit(200);
  },

  async getPacket(id: string) {
    const [packet] = await db.select().from(reviewPackets).where(eq(reviewPackets.id, id)).limit(1);
    return packet ?? null;
  },

  async createPacket(data: InsertReviewPacket) {
    const [result] = await db.insert(reviewPackets).values(data).returning();
    return result;
  },

  async updatePacket(id: string, data: Partial<InsertReviewPacket>) {
    const [result] = await db.update(reviewPackets).set(data).where(eq(reviewPackets.id, id)).returning();
    return result;
  },

  async getRunsForPacket(packetId: string) {
    return db.select().from(reviewRuns).where(eq(reviewRuns.packetId, packetId)).orderBy(desc(reviewRuns.createdAt)).limit(50);
  },

  async getRun(id: string) {
    const [run] = await db.select().from(reviewRuns).where(eq(reviewRuns.id, id)).limit(1);
    return run ?? null;
  },

  async createRun(data: InsertReviewRun) {
    const [result] = await db.insert(reviewRuns).values(data).returning();
    return result;
  },

  async updateRun(id: string, data: Partial<InsertReviewRun>) {
    const [result] = await db.update(reviewRuns).set(data).where(eq(reviewRuns.id, id)).returning();
    return result;
  },

  async getTaskpacksForPacket(packetId: string) {
    return db.select().from(reviewTaskpacks).where(eq(reviewTaskpacks.packetId, packetId)).orderBy(desc(reviewTaskpacks.createdAt)).limit(20);
  },

  async createTaskpack(data: InsertReviewTaskpack) {
    const [result] = await db.insert(reviewTaskpacks).values(data).returning();
    return result;
  },
};
