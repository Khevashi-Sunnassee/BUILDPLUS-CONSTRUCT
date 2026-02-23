import type { CapexRequest, User, Job, Supplier, Asset } from "@shared/schema";

export interface CapexApprovalEntry {
  userId: string;
  userName: string;
  level: number;
  timestamp: string;
  comments?: string;
}

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
  costCode?: { id: string; code: string; name: string; description: string | null } | null;
}

export interface CapexAuditMetadata {
  reason?: string;
  previousStatus?: string;
  newStatus?: string;
  changes?: Record<string, { from: string; to: string }>;
}

export interface AuditEvent {
  id: string;
  capexRequestId: string;
  eventType: string;
  actorId: string;
  actorName: string | null;
  metadata: CapexAuditMetadata | null;
  createdAt: string;
}

export interface ReplacementPrefill {
  assetId: string;
  assetName: string;
  assetTag: string;
  assetCategory: string;
  assetCurrentValue: string;
  assetLocation: string;
}

export const STATUS_BADGE: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  DRAFT: { variant: "secondary" },
  SUBMITTED: { variant: "default" },
  APPROVED: { variant: "default", className: "bg-green-600 text-white" },
  REJECTED: { variant: "destructive" },
  WITHDRAWN: { variant: "outline" },
};
