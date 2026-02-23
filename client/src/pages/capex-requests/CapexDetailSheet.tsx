import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send, Check, X, Undo2, Trash2, Clock, FileText, History, ShoppingCart, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { CapexForm } from "./CapexForm";
import { ApprovalTimeline } from "./ApprovalTimeline";
import { STATUS_BADGE } from "./types";
import type { CapexRequestWithDetails, AuditEvent } from "./types";

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGE[status] || STATUS_BADGE.DRAFT;
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${status}`}>
      {status === "SUBMITTED" ? "Under Review" : status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-[160px] shrink-0">{label}:</span>
      <span data-testid={`text-detail-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value || "-"}</span>
    </div>
  );
}

export function CapexDetailSheet({ capex, onClose }: { capex: CapexRequestWithDetails; onClose: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("form");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const { data: auditHistory = [] } = useQuery<AuditEvent[]>({
    queryKey: ["/api/capex-requests", capex.id, "audit-history"],
    queryFn: async () => {
      const res = await fetch(`/api/capex-requests/${capex.id}/audit-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit history");
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: Record<string, string> }) => {
      const methodMap: Record<string, string> = {
        submit: "PUT",
        approve: "POST",
        reject: "POST",
        withdraw: "POST",
        discard: "DELETE",
      };
      const urlMap: Record<string, string> = {
        submit: `/api/capex-requests/${capex.id}/submit`,
        approve: `/api/capex-requests/${capex.id}/approve`,
        reject: `/api/capex-requests/${capex.id}/reject`,
        withdraw: `/api/capex-requests/${capex.id}/withdraw`,
        discard: `/api/capex-requests/${capex.id}/draft`,
      };
      await apiRequest(methodMap[action], urlMap[action], data);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capex-requests"] });
      const labels: Record<string, string> = {
        submit: "Request submitted for approval",
        approve: "Request approved",
        reject: "Request rejected",
        withdraw: "Request withdrawn",
        discard: "Draft discarded",
      };
      toast({ title: labels[action] || "Action completed" });
      setConfirmAction(null);
      setRejectDialogOpen(false);
      if (action === "discard") onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const canEdit = capex.status === "DRAFT";
  const isSubmitted = capex.status === "SUBMITTED";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-capex-number">{capex.capexNumber}</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-capex-title">{capex.equipmentTitle}</p>
        </div>
        <StatusBadge status={capex.status} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {capex.status === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => setConfirmAction("submit")} data-testid="button-submit-capex">
              <Send className="h-4 w-4 mr-1" /> Submit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmAction("discard")} data-testid="button-discard-capex">
              <Trash2 className="h-4 w-4 mr-1" /> Discard
            </Button>
          </>
        )}
        {isSubmitted && (
          <>
            <Button size="sm" onClick={() => setConfirmAction("approve")} className="bg-green-600 text-white" data-testid="button-approve-capex">
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)} data-testid="button-reject-capex">
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmAction("withdraw")} data-testid="button-withdraw-capex">
              <Undo2 className="h-4 w-4 mr-1" /> Withdraw
            </Button>
          </>
        )}
        {capex.status === "APPROVED" && !capex.purchaseOrderId && (
          <Button
            size="sm"
            onClick={() => navigate(`/purchase-orders/new?capexId=${capex.id}`)}
            data-testid="button-create-po-from-capex"
          >
            <ShoppingCart className="h-4 w-4 mr-1" /> Create Purchase Order
          </Button>
        )}
        {capex.purchaseOrder && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/purchase-orders/${capex.purchaseOrder!.id}`)}
            data-testid="button-view-linked-po"
          >
            <ExternalLink className="h-4 w-4 mr-1" /> View PO {capex.purchaseOrder.poNumber}
          </Button>
        )}
      </div>

      <ApprovalTimeline
        status={capex.status}
        submittedAt={capex.submittedAt ? String(capex.submittedAt) : null}
        approvedAt={capex.approvedAt ? String(capex.approvedAt) : null}
        rejectedAt={capex.rejectedAt ? String(capex.rejectedAt) : null}
        approvals={capex.approvals}
        approvalsRequired={capex.approvalsRequired}
        totalEquipmentCost={capex.totalEquipmentCost}
      />

      {capex.status === "REJECTED" && capex.rejectionReason && (
        <Card className="border-destructive">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
            <p className="text-sm" data-testid="text-rejection-reason">{capex.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="form" data-testid="tab-form">CAPEX Form</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          {canEdit ? (
            <CapexForm capex={capex} onSave={onClose} onClose={onClose} />
          ) : (
            <div className="space-y-4">
              <DetailSection title="General Information">
                <DetailRow label="CAPEX Number" value={capex.capexNumber} />
                <DetailRow label="Cost Code" value={capex.costCode ? `${capex.costCode.code} — ${capex.costCode.name}` : "-"} />
                {capex.costCode?.description && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[160px] shrink-0">Cost Code Description:</span>
                    <span className="text-muted-foreground italic" data-testid="text-detail-cost-code-description">{capex.costCode.description}</span>
                  </div>
                )}
                <DetailRow label="Job" value={capex.job ? `${capex.job.jobNumber} - ${capex.job.name}` : "-"} />
                <DetailRow label="Department" value={capex.department?.name} />
                <DetailRow label="Proposed Asset Manager" value={capex.proposedAssetManager?.name || capex.proposedAssetManager?.email} />
                <DetailRow label="Approving Manager" value={capex.approvingManager?.name || capex.approvingManager?.email} />
                <DetailRow label="Equipment Title" value={capex.equipmentTitle} />
                <DetailRow label="Equipment Category" value={capex.equipmentCategory} />
                <DetailRow label="Equipment Description" value={capex.equipmentDescription} />
              </DetailSection>
              <DetailSection title="Reasons for Purchase">
                <div className="flex flex-wrap gap-1">
                  {(capex.purchaseReasons as string[] || []).map((r) => (
                    <Badge key={r} variant="secondary">{r}</Badge>
                  ))}
                  {(!capex.purchaseReasons || (capex.purchaseReasons as string[]).length === 0) && <span className="text-sm text-muted-foreground">None specified</span>}
                </div>
              </DetailSection>
              {capex.isReplacement && (
                <DetailSection title="Replacement Information">
                  <DetailRow label="Replacement Asset" value={capex.replacementAsset ? `${capex.replacementAsset.assetTag} - ${capex.replacementAsset.name}` : "-"} />
                  <DetailRow label="Replacement Reason" value={capex.replacementReason} />
                </DetailSection>
              )}
              <DetailSection title="Cost Analysis">
                <DetailRow label="Total Equipment Cost" value={formatCurrency(capex.totalEquipmentCost)} />
                <DetailRow label="Transportation Cost" value={formatCurrency(capex.transportationCost)} />
                <DetailRow label="Insurance Cost" value={formatCurrency(capex.insuranceCost)} />
                <DetailRow label="Monthly Maintenance" value={formatCurrency(capex.monthlyMaintenanceCost)} />
                <DetailRow label="Monthly Resource" value={formatCurrency(capex.monthlyResourceCost)} />
                <DetailRow label="Additional Costs" value={formatCurrency(capex.additionalCosts)} />
              </DetailSection>
              {capex.purchaseOrder && (
                <DetailSection title="Linked Purchase Order">
                  <DetailRow label="PO Number" value={capex.purchaseOrder.poNumber} />
                  <DetailRow label="PO Status" value={capex.purchaseOrder.status} />
                  {capex.purchaseOrder.total && (
                    <DetailRow label="PO Total" value={formatCurrency(capex.purchaseOrder.total)} />
                  )}
                </DetailSection>
              )}
              <DetailSection title="Business Case">
                <DetailRow label="Expected Payback Period" value={capex.expectedPaybackPeriod} />
                <DetailRow label="Expected Resource Savings" value={capex.expectedResourceSavings} />
                <DetailRow label="Risk Analysis" value={capex.riskAnalysis} />
                <DetailRow label="Expected Useful Life" value={capex.expectedUsefulLife} />
              </DetailSection>
              <DetailSection title="Supplier Information">
                <DetailRow label="Preferred Supplier" value={capex.preferredSupplier?.name} />
                <DetailRow label="Alternative Suppliers" value={capex.alternativeSuppliers} />
              </DetailSection>
              <DetailSection title="Installation & Setup">
                <DetailRow label="Equipment Location" value={capex.equipmentLocation} />
                <DetailRow label="Factory" value={capex.factory?.name} />
                <DetailRow label="Factory Zone" value={capex.factoryZone} />
                <DetailRow label="Proximity to Input Materials" value={capex.proximityToInputMaterials} />
                <DetailRow label="Site Readiness" value={capex.siteReadiness} />
                <DetailRow label="New Workflow" value={capex.newWorkflowDescription} />
                <DetailRow label="Safety Considerations" value={capex.safetyConsiderations} />
              </DetailSection>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground" data-testid="text-documents-placeholder">
                Documents for this CAPEX request can be managed through the Document Register.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {auditHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-history">No audit history available</p>
            ) : (
              auditHistory.map((event) => (
                <Card key={event.id} data-testid={`audit-event-${event.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <History className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium capitalize">{event.eventType.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">by {event.actorName || "Unknown"}</p>
                      {event.metadata?.reason && (
                        <p className="text-xs mt-1">Reason: {event.metadata.reason}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "submit" && "Submit for Approval"}
              {confirmAction === "approve" && "Approve Request"}
              {confirmAction === "withdraw" && "Withdraw Request"}
              {confirmAction === "discard" && "Discard Draft"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "submit" && "This will send the request for approval. Are you sure?"}
              {confirmAction === "approve" && "This will approve the CAPEX request. Are you sure?"}
              {confirmAction === "withdraw" && "This will withdraw the request back to draft. Are you sure?"}
              {confirmAction === "discard" && "This will permanently delete this draft. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && actionMutation.mutate({ action: confirmAction })}
              disabled={actionMutation.isPending}
              data-testid="button-confirm-action"
            >
              {actionMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject CAPEX Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
            data-testid="input-reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionMutation.mutate({ action: "reject", data: { reason: rejectReason } })}
              disabled={actionMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {actionMutation.isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
