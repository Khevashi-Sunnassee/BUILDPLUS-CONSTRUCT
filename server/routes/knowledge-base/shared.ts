import { db } from "../../db";
import { kbProjects, kbProjectMembers, kbConversations, kbConversationMembers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function getProjectAccess(userId: string, projectId: string, companyId?: string): Promise<{ hasAccess: boolean; role: string | null; isCreator: boolean }> {
  const conditions = [eq(kbProjects.id, projectId)];
  if (companyId) conditions.push(eq(kbProjects.companyId, companyId));
  const [project] = await db.select({ createdById: kbProjects.createdById, companyId: kbProjects.companyId })
    .from(kbProjects).where(and(...conditions)).limit(1);
  if (!project) return { hasAccess: false, role: null, isCreator: false };
  const isCreator = project.createdById === userId;
  if (isCreator) return { hasAccess: true, role: "OWNER", isCreator: true };
  const [membership] = await db.select({ role: kbProjectMembers.role, status: kbProjectMembers.status })
    .from(kbProjectMembers)
    .where(and(eq(kbProjectMembers.projectId, projectId), eq(kbProjectMembers.userId, userId)))
    .limit(1);
  if (membership && membership.status === "ACCEPTED") return { hasAccess: true, role: membership.role, isCreator: false };
  return { hasAccess: false, role: null, isCreator: false };
}

export async function getConversationAccess(userId: string, conversationId: string, companyId?: string): Promise<{ hasAccess: boolean; role: string | null; isCreator: boolean }> {
  const [convo] = await db.select({ createdById: kbConversations.createdById, projectId: kbConversations.projectId, companyId: kbConversations.companyId })
    .from(kbConversations).where(and(eq(kbConversations.id, conversationId), companyId ? eq(kbConversations.companyId, companyId) : undefined)).limit(1);
  if (!convo) return { hasAccess: false, role: null, isCreator: false };
  const isCreator = convo.createdById === userId;
  if (isCreator) return { hasAccess: true, role: "OWNER", isCreator: true };
  const [membership] = await db.select({ role: kbConversationMembers.role, status: kbConversationMembers.status })
    .from(kbConversationMembers)
    .where(and(eq(kbConversationMembers.conversationId, conversationId), eq(kbConversationMembers.userId, userId)))
    .limit(1);
  if (membership && membership.status === "ACCEPTED") return { hasAccess: true, role: membership.role, isCreator: false };
  if (convo.projectId) {
    const projectAccess = await getProjectAccess(userId, convo.projectId, companyId);
    if (projectAccess.hasAccess) return { hasAccess: true, role: projectAccess.role, isCreator: false };
  }
  return { hasAccess: false, role: null, isCreator: false };
}
