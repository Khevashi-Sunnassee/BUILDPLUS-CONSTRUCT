import { eq, and, lt } from "drizzle-orm";
import { db } from "../db";
import crypto from "crypto";
import {
  userInvitations,
  type UserInvitation,
} from "@shared/schema";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const invitationMethods = {
  async createInvitation(data: {
    companyId: string;
    email: string;
    role: "USER" | "MANAGER" | "ADMIN";
    userType: "EMPLOYEE" | "EXTERNAL";
    departmentId?: string | null;
    invitedBy: string;
    expiresInDays?: number;
  }): Promise<{ invitation: UserInvitation; token: string }> {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

    const [invitation] = await db.insert(userInvitations).values({
      companyId: data.companyId,
      email: data.email.toLowerCase(),
      role: data.role,
      userType: data.userType,
      departmentId: data.departmentId || null,
      tokenHash,
      invitedBy: data.invitedBy,
      expiresAt,
    }).returning();

    return { invitation, token };
  },

  async getInvitationByToken(token: string): Promise<UserInvitation | undefined> {
    const tokenHash = hashToken(token);
    const [invitation] = await db.select().from(userInvitations)
      .where(eq(userInvitations.tokenHash, tokenHash));
    return invitation;
  },

  async getInvitationById(id: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations)
      .where(eq(userInvitations.id, id));
    return invitation;
  },

  async getInvitationsByCompany(companyId: string): Promise<UserInvitation[]> {
    return db.select().from(userInvitations)
      .where(eq(userInvitations.companyId, companyId))
      .orderBy(userInvitations.createdAt);
  },

  async markInvitationAccepted(id: string): Promise<void> {
    await db.update(userInvitations)
      .set({ status: "ACCEPTED", acceptedAt: new Date() })
      .where(eq(userInvitations.id, id));
  },

  async cancelInvitation(id: string): Promise<void> {
    await db.update(userInvitations)
      .set({ status: "CANCELLED" })
      .where(eq(userInvitations.id, id));
  },

  async expireOldInvitations(): Promise<number> {
    const result = await db.update(userInvitations)
      .set({ status: "EXPIRED" })
      .where(and(
        eq(userInvitations.status, "PENDING"),
        lt(userInvitations.expiresAt, new Date()),
      ))
      .returning();
    return result.length;
  },
};
