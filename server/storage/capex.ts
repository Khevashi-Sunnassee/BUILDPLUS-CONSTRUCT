import { eq, and, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import {
  capexRequests, capexAuditEvents, users, jobs, departments, suppliers, factories, assets, purchaseOrders,
  type CapexRequest, type InsertCapexRequest,
  type CapexAuditEvent, type InsertCapexAuditEvent,
  type User, type Job, type Supplier, type Asset,
} from "@shared/schema";

export interface CapexRequestWithDetails extends CapexRequest {
  requestedBy: User;
  approvingManager?: User | null;
  proposedAssetManager?: User | null;
  approvedBy?: User | null;
  rejectedBy?: User | null;
  job?: Job | null;
  department?: { id: string; name: string; code: string } | null;
  preferredSupplier?: Supplier | null;
  factory?: { id: string; name: string; code: string } | null;
  replacementAsset?: Asset | null;
  purchaseOrder?: { id: string; poNumber: string; status: string; total: string | null } | null;
}

async function getCapexWithDetails(capexId: string): Promise<CapexRequestWithDetails | undefined> {
  const [row] = await db.select().from(capexRequests).where(eq(capexRequests.id, capexId));
  if (!row) return undefined;

  const [requestedBy] = await db.select().from(users).where(eq(users.id, row.requestedById));
  if (!requestedBy) return undefined;

  let approvingManager: User | null = null;
  if (row.approvingManagerId) {
    const [u] = await db.select().from(users).where(eq(users.id, row.approvingManagerId));
    approvingManager = u || null;
  }

  let proposedAssetManager: User | null = null;
  if (row.proposedAssetManagerId) {
    const [u] = await db.select().from(users).where(eq(users.id, row.proposedAssetManagerId));
    proposedAssetManager = u || null;
  }

  let approvedBy: User | null = null;
  if (row.approvedById) {
    const [u] = await db.select().from(users).where(eq(users.id, row.approvedById));
    approvedBy = u || null;
  }

  let rejectedBy: User | null = null;
  if (row.rejectedById) {
    const [u] = await db.select().from(users).where(eq(users.id, row.rejectedById));
    rejectedBy = u || null;
  }

  let job: Job | null = null;
  if (row.jobId) {
    const [j] = await db.select().from(jobs).where(eq(jobs.id, row.jobId));
    job = j || null;
  }

  let department: { id: string; name: string; code: string } | null = null;
  if (row.departmentId) {
    const [d] = await db.select().from(departments).where(eq(departments.id, row.departmentId));
    department = d ? { id: d.id, name: d.name, code: d.code } : null;
  }

  let preferredSupplier: Supplier | null = null;
  if (row.preferredSupplierId) {
    const [s] = await db.select().from(suppliers).where(eq(suppliers.id, row.preferredSupplierId));
    preferredSupplier = s || null;
  }

  let factory: { id: string; name: string; code: string } | null = null;
  if (row.factoryId) {
    const [f] = await db.select().from(factories).where(eq(factories.id, row.factoryId));
    factory = f ? { id: f.id, name: f.name, code: f.code } : null;
  }

  let replacementAsset: Asset | null = null;
  if (row.replacementAssetId) {
    const [a] = await db.select().from(assets).where(eq(assets.id, row.replacementAssetId));
    replacementAsset = a || null;
  }

  let purchaseOrder: { id: string; poNumber: string; status: string; total: string | null } | null = null;
  if (row.purchaseOrderId) {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, row.purchaseOrderId));
    purchaseOrder = po ? { id: po.id, poNumber: po.poNumber, status: po.status, total: po.total } : null;
  }

  return {
    ...row,
    requestedBy,
    approvingManager,
    proposedAssetManager,
    approvedBy,
    rejectedBy,
    job,
    department,
    preferredSupplier,
    factory,
    replacementAsset,
    purchaseOrder,
  };
}

export const capexMethods = {
  async getAllCapexRequests(companyId: string): Promise<CapexRequestWithDetails[]> {
    const rows = await db.select().from(capexRequests)
      .where(eq(capexRequests.companyId, companyId))
      .orderBy(desc(capexRequests.createdAt))
      .limit(1000);

    const results: CapexRequestWithDetails[] = [];
    for (const row of rows) {
      const detail = await getCapexWithDetails(row.id);
      if (detail) results.push(detail);
    }
    return results;
  },

  async getCapexRequestsByStatus(status: string, companyId: string): Promise<CapexRequestWithDetails[]> {
    const rows = await db.select().from(capexRequests)
      .where(and(eq(capexRequests.companyId, companyId), eq(capexRequests.status, status as any)))
      .orderBy(desc(capexRequests.createdAt))
      .limit(1000);

    const results: CapexRequestWithDetails[] = [];
    for (const row of rows) {
      const detail = await getCapexWithDetails(row.id);
      if (detail) results.push(detail);
    }
    return results;
  },

  async getCapexRequest(id: string): Promise<CapexRequestWithDetails | undefined> {
    return getCapexWithDetails(id);
  },

  async getCapexRequestByPurchaseOrder(poId: string): Promise<CapexRequestWithDetails | undefined> {
    const [row] = await db.select().from(capexRequests).where(eq(capexRequests.purchaseOrderId, poId));
    if (!row) return undefined;
    return getCapexWithDetails(row.id);
  },

  async getPendingCapexApprovals(userId: string, companyId: string): Promise<CapexRequestWithDetails[]> {
    const rows = await db.select().from(capexRequests)
      .where(and(
        eq(capexRequests.companyId, companyId),
        eq(capexRequests.status, "SUBMITTED"),
        eq(capexRequests.approvingManagerId, userId),
      ))
      .orderBy(desc(capexRequests.createdAt))
      .limit(1000);

    const results: CapexRequestWithDetails[] = [];
    for (const row of rows) {
      const detail = await getCapexWithDetails(row.id);
      if (detail) results.push(detail);
    }
    return results;
  },

  async createCapexRequest(data: InsertCapexRequest): Promise<CapexRequest> {
    const [request] = await db.insert(capexRequests).values(data).returning();
    return request;
  },

  async updateCapexRequest(id: string, data: Partial<InsertCapexRequest>): Promise<CapexRequest | undefined> {
    const [request] = await db.update(capexRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(capexRequests.id, id))
      .returning();
    return request;
  },

  async submitCapexRequest(id: string): Promise<CapexRequest | undefined> {
    const [existing] = await db.select().from(capexRequests).where(eq(capexRequests.id, id));
    if (!existing) return undefined;

    const totalCost = parseFloat(existing.totalEquipmentCost || "0");
    const requiredCount = this.getRequiredApprovalCount(totalCost);

    const [request] = await db.update(capexRequests)
      .set({ status: "SUBMITTED", submittedAt: new Date(), approvals: [], approvalsRequired: requiredCount, updatedAt: new Date() })
      .where(eq(capexRequests.id, id))
      .returning();
    return request;
  },

  getRequiredApprovalCount(totalCost: number): number {
    if (totalCost > 50000) return 3;
    if (totalCost >= 5000) return 2;
    return 1;
  },

  async addCapexApproval(id: string, userId: string, userName: string, comments?: string): Promise<{ request: CapexRequest; fullyApproved: boolean }> {
    const [existing] = await db.select().from(capexRequests).where(eq(capexRequests.id, id));
    if (!existing) throw new Error("CAPEX request not found");

    if (existing.status !== "SUBMITTED") {
      throw new Error("Only submitted requests can receive approvals");
    }

    const currentApprovals: Array<{ userId: string; userName: string; level: number; timestamp: string; comments?: string }> = (existing.approvals as Array<{ userId: string; userName: string; level: number; timestamp: string; comments?: string }>) || [];

    if (currentApprovals.some(a => a.userId === userId)) {
      throw new Error("You have already approved this request");
    }

    const requiredCount = existing.approvalsRequired || this.getRequiredApprovalCount(parseFloat(existing.totalEquipmentCost || "0"));
    const newLevel = currentApprovals.length + 1;

    const newApproval = {
      userId,
      userName,
      level: newLevel,
      timestamp: new Date().toISOString(),
      ...(comments ? { comments } : {}),
    };

    const updatedApprovals = [...currentApprovals, newApproval];
    const fullyApproved = updatedApprovals.length >= requiredCount;

    const updateData: Record<string, unknown> = {
      approvals: updatedApprovals,
      approvalsRequired: requiredCount,
      updatedAt: new Date(),
    };

    if (fullyApproved) {
      updateData.status = "APPROVED";
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }

    const [request] = await db.update(capexRequests)
      .set(updateData)
      .where(eq(capexRequests.id, id))
      .returning();

    return { request, fullyApproved };
  },

  async approveCapexRequest(id: string, approvedById: string): Promise<CapexRequest | undefined> {
    const [request] = await db.update(capexRequests)
      .set({ status: "APPROVED", approvedById, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(capexRequests.id, id))
      .returning();
    return request;
  },

  async rejectCapexRequest(id: string, rejectedById: string, reason: string): Promise<CapexRequest | undefined> {
    const [request] = await db.update(capexRequests)
      .set({ status: "REJECTED", rejectedById, rejectedAt: new Date(), rejectionReason: reason, updatedAt: new Date() })
      .where(eq(capexRequests.id, id))
      .returning();
    return request;
  },

  async withdrawCapexRequest(id: string): Promise<CapexRequest | undefined> {
    const [request] = await db.update(capexRequests)
      .set({ status: "DRAFT", submittedAt: null, approvals: [], approvalsRequired: 1, updatedAt: new Date() })
      .where(eq(capexRequests.id, id))
      .returning();
    return request;
  },

  async deleteCapexRequest(id: string): Promise<void> {
    await db.delete(capexRequests).where(eq(capexRequests.id, id));
  },

  async getNextCapexNumber(companyId: string): Promise<string> {
    const { getNextSequenceNumber } = await import("../lib/sequence-generator");
    return getNextSequenceNumber("capex", companyId, "CAPEX-", 4);
  },

  async createCapexAuditEvent(data: InsertCapexAuditEvent): Promise<CapexAuditEvent> {
    const [event] = await db.insert(capexAuditEvents).values(data).returning();
    return event;
  },

  async getCapexAuditHistory(capexRequestId: string): Promise<CapexAuditEvent[]> {
    return db.select().from(capexAuditEvents)
      .where(eq(capexAuditEvents.capexRequestId, capexRequestId))
      .orderBy(desc(capexAuditEvents.createdAt))
      .limit(1000);
  },

  async getCapexApprovers(companyId: string): Promise<User[]> {
    return db.select().from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.isActive, true),
        eq(users.capexApprover, true),
      ))
      .orderBy(asc(users.name))
      .limit(1000);
  },
};
