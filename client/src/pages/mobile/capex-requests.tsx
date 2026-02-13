import { useState, useMemo } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, formatDistanceToNow } from "date-fns";
import { DollarSign, ChevronLeft, ChevronRight, Check, X, Send, Undo2, Clock, Loader2, FileText, Package, Wrench, Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import type { CapexRequest, User, Job, Supplier, Asset } from "@shared/schema";

interface CapexRequestWithDetails extends CapexRequest {
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

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  SUBMITTED: { label: "Under Review", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  APPROVED: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  REJECTED: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  WITHDRAWN: { label: "Withdrawn", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

function formatCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function MobileCapexRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/mobile/capex-requests/:id");
  const [selectedCapex, setSelectedCapex] = useState<CapexRequestWithDetails | null>(null);

  const { data: requests = [], isLoading } = useQuery<CapexRequestWithDetails[]>({
    queryKey: ["/api/capex-requests"],
  });

  const openCapexId = params?.id;
  const directCapexFromList = openCapexId ? requests.find(r => r.id === openCapexId) : null;

  const { data: fetchedCapex } = useQuery<CapexRequestWithDetails>({
    queryKey: ["/api/capex-requests", openCapexId],
    queryFn: async () => {
      const res = await fetch(`/api/capex-requests/${openCapexId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!openCapexId && !directCapexFromList,
  });

  const directCapex = directCapexFromList || fetchedCapex || null;
  const activeCapex = selectedCapex || directCapex;

  const pendingRequests = useMemo(() => requests.filter(r => r.status === "SUBMITTED"), [requests]);
  const draftRequests = useMemo(() => requests.filter(r => r.status === "DRAFT" || r.status === "WITHDRAWN"), [requests]);
  const approvedRequests = useMemo(() => requests.filter(r => r.status === "APPROVED"), [requests]);
  const rejectedRequests = useMemo(() => requests.filter(r => r.status === "REJECTED"), [requests]);

  const handleClose = () => {
    setSelectedCapex(null);
    if (openCapexId) navigate("/mobile/capex-requests");
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile CAPEX Requests">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back-capex">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-capex-title">CAPEX Requests</div>
            <div className="text-sm text-white/60">
              {pendingRequests.length > 0 ? `${pendingRequests.length} pending review` : `${requests.length} total`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No CAPEX requests</p>
            <p className="text-sm text-white/40">Create requests from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.length > 0 && (
              <CapexSection
                title={`Pending Review (${pendingRequests.length})`}
                items={pendingRequests}
                onSelect={setSelectedCapex}
              />
            )}
            {draftRequests.length > 0 && (
              <CapexSection
                title="Drafts"
                items={draftRequests}
                onSelect={setSelectedCapex}
              />
            )}
            {approvedRequests.length > 0 && (
              <CapexSection
                title="Approved"
                items={approvedRequests}
                onSelect={setSelectedCapex}
                muted
              />
            )}
            {rejectedRequests.length > 0 && (
              <CapexSection
                title="Rejected"
                items={rejectedRequests}
                onSelect={setSelectedCapex}
                muted
              />
            )}
          </div>
        )}
      </div>

      <Sheet open={!!activeCapex} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl bg-[#0D1117] border-white/10 p-0">
          {activeCapex && (
            <CapexDetailSheet
              capex={activeCapex}
              onClose={handleClose}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function CapexSection({ title, items, onSelect, muted = false }: { title: string; items: CapexRequestWithDetails[]; onSelect: (c: CapexRequestWithDetails) => void; muted?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">{title}</h2>
      <div className="space-y-3">
        {items.map((req) => (
          <CapexCard key={req.id} capex={req} onSelect={() => onSelect(req)} muted={muted} />
        ))}
      </div>
    </div>
  );
}

function CapexCard({ capex, onSelect, muted = false }: { capex: CapexRequestWithDetails; onSelect: () => void; muted?: boolean }) {
  const status = statusConfig[capex.status] || statusConfig.DRAFT;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`capex-card-${capex.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-sm truncate text-white">{capex.capexNumber}</h3>
          </div>
          <p className="text-xs text-white/70 truncate">{capex.equipmentTitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{capex.job ? `${capex.job.jobNumber}` : capex.department?.name || "-"}</span>
        <span className="font-medium text-white">{formatCurrency(capex.totalEquipmentCost)}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-white/40 mt-1">
        <span>{capex.requestedBy?.name || capex.requestedBy?.email || ""}</span>
        <span>
          {capex.submittedAt
            ? formatDistanceToNow(new Date(String(capex.submittedAt)), { addSuffix: true })
            : formatDistanceToNow(new Date(String(capex.createdAt)), { addSuffix: true })
          }
        </span>
      </div>
    </button>
  );
}

function CapexDetailSheet({ capex, onClose }: { capex: CapexRequestWithDetails; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const { data: freshCapex } = useQuery<CapexRequestWithDetails>({
    queryKey: ["/api/capex-requests", capex.id],
    queryFn: async () => {
      const res = await fetch(`/api/capex-requests/${capex.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const activeCapex = freshCapex || capex;
  const status = statusConfig[activeCapex.status] || statusConfig.DRAFT;

  const actionMutation = useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: any }) => {
      const methodMap: Record<string, string> = {
        submit: "PUT",
        approve: "POST",
        reject: "POST",
        withdraw: "POST",
      };
      const urlMap: Record<string, string> = {
        submit: `/api/capex-requests/${activeCapex.id}/submit`,
        approve: `/api/capex-requests/${activeCapex.id}/approve`,
        reject: `/api/capex-requests/${activeCapex.id}/reject`,
        withdraw: `/api/capex-requests/${activeCapex.id}/withdraw`,
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
      };
      toast({ title: labels[action] || "Action completed" });
      setConfirmAction(null);
      setRejectDialogOpen(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const isSubmitted = activeCapex.status === "SUBMITTED";
  const isDraft = activeCapex.status === "DRAFT";

  return (
    <div className="flex flex-col h-full text-white">
      <div className="px-6 pt-6 pb-4 border-b border-white/10">
        <SheetHeader className="p-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-left text-white text-lg">{activeCapex.capexNumber}</SheetTitle>
            <Badge variant="outline" className={cn("text-xs border", status.color)}>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-white/70 text-left mt-1">{activeCapex.equipmentTitle}</p>
        </SheetHeader>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-5">
        <MobileApprovalTimeline status={activeCapex.status} />

        {activeCapex.status === "REJECTED" && activeCapex.rejectionReason && (
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-xs font-medium text-red-400 mb-1">Rejection Reason</p>
            <p className="text-sm text-white/80" data-testid="text-rejection-reason">{activeCapex.rejectionReason}</p>
          </div>
        )}

        <DetailBlock title="General Information" icon={FileText}>
          <DetailRow label="Equipment" value={activeCapex.equipmentTitle} />
          <DetailRow label="Category" value={activeCapex.equipmentCategory} />
          <DetailRow label="Job" value={activeCapex.job ? `${activeCapex.job.jobNumber} - ${activeCapex.job.name}` : null} />
          <DetailRow label="Department" value={activeCapex.department?.name} />
          <DetailRow label="Requested By" value={activeCapex.requestedBy?.name || activeCapex.requestedBy?.email} />
          <DetailRow label="Approving Manager" value={activeCapex.approvingManager?.name || activeCapex.approvingManager?.email} />
          <DetailRow label="Asset Manager" value={activeCapex.proposedAssetManager?.name || activeCapex.proposedAssetManager?.email} />
          {activeCapex.equipmentDescription && (
            <div className="pt-1">
              <p className="text-xs text-white/50 mb-1">Description</p>
              <p className="text-sm text-white/80">{activeCapex.equipmentDescription}</p>
            </div>
          )}
        </DetailBlock>

        {(activeCapex.purchaseReasons as string[] || []).length > 0 && (
          <DetailBlock title="Reasons for Purchase" icon={Package}>
            <div className="flex flex-wrap gap-1.5">
              {(activeCapex.purchaseReasons as string[]).map((r) => (
                <Badge key={r} variant="outline" className="text-xs border-white/20 text-white/70">{r}</Badge>
              ))}
            </div>
          </DetailBlock>
        )}

        {activeCapex.isReplacement && (
          <DetailBlock title="Replacement" icon={Wrench}>
            <DetailRow label="Replacing" value={activeCapex.replacementAsset ? `${activeCapex.replacementAsset.assetTag} - ${activeCapex.replacementAsset.name}` : null} />
            <DetailRow label="Reason" value={activeCapex.replacementReason} />
          </DetailBlock>
        )}

        <DetailBlock title="Cost Analysis" icon={DollarSign}>
          <DetailRow label="Equipment Cost" value={formatCurrency(activeCapex.totalEquipmentCost)} highlight />
          <DetailRow label="Transportation" value={formatCurrency(activeCapex.transportationCost)} />
          <DetailRow label="Insurance" value={formatCurrency(activeCapex.insuranceCost)} />
          <DetailRow label="Monthly Maintenance" value={formatCurrency(activeCapex.monthlyMaintenanceCost)} />
          <DetailRow label="Monthly Resource" value={formatCurrency(activeCapex.monthlyResourceCost)} />
          <DetailRow label="Additional Costs" value={formatCurrency(activeCapex.additionalCosts)} />
        </DetailBlock>

        <DetailBlock title="Business Case" icon={ShieldCheck}>
          <DetailRow label="Payback Period" value={activeCapex.expectedPaybackPeriod} />
          <DetailRow label="Resource Savings" value={activeCapex.expectedResourceSavings} />
          <DetailRow label="Risk Analysis" value={activeCapex.riskAnalysis} />
          <DetailRow label="Useful Life" value={activeCapex.expectedUsefulLife} />
        </DetailBlock>

        <DetailBlock title="Supplier" icon={Building2}>
          <DetailRow label="Preferred" value={activeCapex.preferredSupplier?.name} />
          <DetailRow label="Alternatives" value={activeCapex.alternativeSuppliers} />
        </DetailBlock>

        {activeCapex.purchaseOrder && (
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-xs font-medium text-blue-400 mb-1">Linked Purchase Order</p>
            <p className="text-sm text-white">{activeCapex.purchaseOrder.poNumber} - {activeCapex.purchaseOrder.status}</p>
            {activeCapex.purchaseOrder.total && (
              <p className="text-xs text-white/60 mt-0.5">{formatCurrency(activeCapex.purchaseOrder.total)}</p>
            )}
          </div>
        )}

        {(activeCapex.equipmentLocation || activeCapex.factory) && (
          <DetailBlock title="Installation" icon={Building2}>
            <DetailRow label="Location" value={activeCapex.equipmentLocation} />
            <DetailRow label="Factory" value={activeCapex.factory?.name} />
            <DetailRow label="Zone" value={activeCapex.factoryZone} />
            <DetailRow label="Site Readiness" value={activeCapex.siteReadiness} />
            {activeCapex.safetyConsiderations && (
              <div className="pt-1">
                <p className="text-xs text-white/50 mb-1">Safety Considerations</p>
                <p className="text-sm text-white/80">{activeCapex.safetyConsiderations}</p>
              </div>
            )}
          </DetailBlock>
        )}
      </div>

      <div className="px-6 py-4 border-t border-white/10 space-y-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}>
        {isSubmitted && (
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600"
              onClick={() => setConfirmAction("approve")}
              disabled={actionMutation.isPending}
              data-testid="button-approve-capex"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setRejectDialogOpen(true)}
              disabled={actionMutation.isPending}
              data-testid="button-reject-capex"
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
        {isSubmitted && (
          <Button
            variant="outline"
            className="w-full border-white/20 text-white"
            onClick={() => setConfirmAction("withdraw")}
            disabled={actionMutation.isPending}
            data-testid="button-withdraw-capex"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Withdraw
          </Button>
        )}
        {isDraft && (
          <Button
            className="w-full bg-blue-600"
            onClick={() => setConfirmAction("submit")}
            disabled={actionMutation.isPending}
            data-testid="button-submit-capex"
          >
            <Send className="h-4 w-4 mr-2" />
            Submit for Approval
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full border-white/20 text-white"
          onClick={onClose}
          data-testid="button-close-capex"
        >
          Close
        </Button>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="bg-[#1C2333] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {confirmAction === "submit" && "Submit for Approval"}
              {confirmAction === "approve" && "Approve Request"}
              {confirmAction === "withdraw" && "Withdraw Request"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {confirmAction === "submit" && "This will send the request for approval. Are you sure?"}
              {confirmAction === "approve" && `Approve CAPEX ${activeCapex.capexNumber} for ${formatCurrency(activeCapex.totalEquipmentCost)}?`}
              {confirmAction === "withdraw" && "This will withdraw the request back to draft."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white" data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && actionMutation.mutate({ action: confirmAction })}
              disabled={actionMutation.isPending}
              className={confirmAction === "approve" ? "bg-green-600" : ""}
              data-testid="button-confirm-action"
            >
              {actionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {actionMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent className="bg-[#1C2333] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Reject CAPEX Request</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Provide a reason for rejecting {activeCapex.capexNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            data-testid="input-reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white" data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionMutation.mutate({ action: "reject", data: { reason: rejectReason } })}
              disabled={actionMutation.isPending || !rejectReason.trim()}
              className="bg-red-600"
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

function MobileApprovalTimeline({ status }: { status: string }) {
  const steps = [
    { label: "Draft", done: true },
    { label: "Submitted", done: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) },
    { label: status === "REJECTED" ? "Rejected" : "Approved", done: ["APPROVED", "REJECTED"].includes(status), isRejected: status === "REJECTED" },
  ];

  return (
    <div className="flex items-center gap-1.5" data-testid="approval-timeline">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1.5">
          <div className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium",
            step.isRejected ? "bg-red-500/20 text-red-400" :
            step.done ? "bg-green-500/20 text-green-400" :
            "bg-white/5 text-white/40"
          )}>
            {step.done ? (step.isRejected ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />) : <Clock className="h-3 w-3" />}
            {step.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
        </div>
      ))}
    </div>
  );
}

function DetailBlock({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-white/70">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="pl-6 space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, highlight = false }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value || value === "$0.00") return null;
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-white/50 shrink-0">{label}</span>
      <span className={cn("text-right", highlight ? "font-semibold text-white" : "text-white/80")} data-testid={`text-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</span>
    </div>
  );
}
