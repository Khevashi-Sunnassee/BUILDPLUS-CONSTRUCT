import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PROCUREMENT_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import {
  ShoppingCart,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Send,
  Loader2,
  FileText,
  Mail,
  ArrowLeft,
  Building2,
  User,
  MapPin,
  StickyNote,
  DollarSign,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface POItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  unitOfMeasure: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  total: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  createdAt: string;
  notes: string | null;
  deliveryAddress: string | null;
  requiredByDate: string | null;
  supplierEmail?: string | null;
  capexRequestId?: string | null;
  projectName?: string | null;
  supplier?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  requestedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items?: POItem[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  PENDING: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  SUBMITTED: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  APPROVED: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  ORDERED: { label: "Ordered", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  RECEIVED: { label: "Received", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  REJECTED: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function formatCurrency(amount: string | number | null) {
  if (amount === null || amount === undefined) return "-";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(numAmount);
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="text-white/40 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/50">{label}</div>
        <div className="text-sm text-white">{value || "—"}</div>
      </div>
    </div>
  );
}

function POCard({ po, onSelect }: { po: PurchaseOrder; onSelect: () => void }) {
  const status = statusConfig[po.status] || statusConfig.DRAFT;

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 text-left active:scale-[0.99]"
      data-testid={`po-${po.id}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 flex-shrink-0 mt-0.5">
        <ShoppingCart className="h-5 w-5 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">{po.poNumber}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", status.color)}>
            {status.label}
          </Badge>
          {po.capexRequestId && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/10 px-1.5 py-0">
              CAPEX
            </Badge>
          )}
        </div>
        <div className="text-xs text-white/60 truncate">
          {po.supplier?.name || "No supplier"}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-white">
            {formatCurrency(po.total)}
          </span>
          <span className="text-xs text-white/40">
            {format(new Date(po.createdAt), "dd MMM yyyy")}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0 mt-2" />
    </button>
  );
}

function PODetailView({
  poId,
  onBack,
  onSend,
}: {
  poId: string;
  onBack: () => void;
  onSend: (po: PurchaseOrder) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: po, isLoading } = useQuery<PurchaseOrder>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(poId)],
    enabled: !!poId,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_APPROVE(poId), {
        note: approveNote || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Purchase order approved" });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(poId)] });
      setShowApproveDialog(false);
      setApproveNote("");
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_REJECT(poId), {
        reason: rejectReason,
      });
    },
    onSuccess: () => {
      toast({ title: "Purchase order rejected" });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      setShowRejectDialog(false);
      setRejectReason("");
      onBack();
    },
    onError: (err: Error) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const canApprove = (user?.role === "ADMIN" || user?.role === "MANAGER") &&
    po && (po.status === "PENDING" || po.status === "SUBMITTED");
  const canSend = po && po.status === "APPROVED";

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Button variant="ghost" size="icon" className="text-white -ml-2" onClick={onBack} data-testid="button-back-detail">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Skeleton className="h-5 w-32 bg-white/10" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 rounded-xl bg-white/10" />
          <Skeleton className="h-32 rounded-xl bg-white/10" />
          <Skeleton className="h-20 rounded-xl bg-white/10" />
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Button variant="ghost" size="icon" className="text-white -ml-2" onClick={onBack} data-testid="button-back-detail">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="font-medium">Not Found</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-white/40">
          <ShoppingCart className="h-12 w-12 opacity-30 mb-2" />
          <p className="text-sm">Purchase order not found</p>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const status = statusConfig[po.status] || statusConfig.DRAFT;

  return (
    <>
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" className="text-white -ml-2" onClick={onBack} data-testid="button-back-detail">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold truncate" data-testid="text-po-detail-title">{po.poNumber}</div>
              <div className="text-xs text-white/60">{po.supplier?.name || "No supplier"}</div>
            </div>
            <Badge variant="outline" className={cn("text-xs border flex-shrink-0", status.color)} data-testid="badge-po-status">
              {status.label}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-48">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-xs text-white/50 mb-1">Total (inc. GST)</div>
            <div className="text-3xl font-bold text-white" data-testid="text-po-total">
              {formatCurrency(po.total)}
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-white/50">
              <span>Ex: {formatCurrency(po.subtotal)}</span>
              <span>Tax: {formatCurrency(po.taxAmount)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <InfoRow
              icon={<Building2 className="h-4 w-4" />}
              label="Supplier"
              value={po.supplier?.name}
            />
            <InfoRow
              icon={<Package className="h-4 w-4" />}
              label="Job / Project"
              value={po.projectName}
            />
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label={po.requiredByDate ? "Required By" : "Created"}
              value={
                po.requiredByDate
                  ? format(new Date(po.requiredByDate), "dd MMM yyyy")
                  : format(new Date(po.createdAt), "dd MMM yyyy")
              }
            />
            {po.requestedBy && (
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Requested By"
                value={po.requestedBy.name || po.requestedBy.email}
              />
            )}
            {po.deliveryAddress && (
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="Delivery Address"
                value={po.deliveryAddress}
              />
            )}
          </div>

          {po.capexRequestId && (
            <button
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left active:scale-[0.99]"
              data-testid="button-view-capex"
              onClick={() => navigate(`/mobile/capex-requests/${po.capexRequestId}`)}
            >
              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10">
                CAPEX
              </Badge>
              <span className="text-sm text-amber-300/80 flex-1">View linked CAPEX request</span>
              <ChevronRight className="h-4 w-4 text-amber-400/60" />
            </button>
          )}

          {po.items && po.items.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Items ({po.items.length})
              </div>
              <div className="space-y-2">
                {po.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-1"
                    data-testid={`po-item-${idx}`}
                  >
                    <div className="text-sm text-white">{item.description}</div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-white/50">
                        {item.quantity} {item.unitOfMeasure ? `${item.unitOfMeasure}` : ""} × {formatCurrency(item.unitPrice)}
                      </span>
                      <span className="font-semibold text-white">{formatCurrency(item.lineTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {po.notes && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <InfoRow
                icon={<StickyNote className="h-4 w-4" />}
                label="Notes"
                value={po.notes}
              />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-white/10 bg-[#0D1117] px-4 py-3 space-y-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}>
          {canSend && (
            <Button
              className="w-full bg-blue-600 text-white"
              onClick={() => onSend(po)}
              data-testid="button-send-po"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Purchase Order
            </Button>
          )}
          {canApprove && (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 text-white border-green-700"
                onClick={() => setShowApproveDialog(true)}
                disabled={isBusy}
                data-testid="button-approve-po"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Approve
              </Button>
              <Button
                className="flex-1 bg-red-600 text-white border-red-700"
                onClick={() => setShowRejectDialog(true)}
                disabled={isBusy}
                data-testid="button-reject-po"
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                Reject
              </Button>
            </div>
          )}
          {!canApprove && !canSend && po.status !== "APPROVED" && (
            <div className="text-center text-xs text-white/40 py-1">
              {po.status === "REJECTED" ? "This purchase order has been rejected" :
               po.status === "ORDERED" ? "This purchase order has been sent" :
               po.status === "RECEIVED" ? "This purchase order has been received" :
               po.status === "DRAFT" ? "This purchase order is still in draft" :
               "No actions available"}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="bg-[#0D1117] border-white/10 text-white max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Purchase Order</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Approve {po.poNumber} for {formatCurrency(po.total)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Optional note..."
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
            data-testid="input-approve-note"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white" data-testid="button-cancel-approve">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="bg-[#0D1117] border-white/10 text-white max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Purchase Order</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Reject {po.poNumber}? A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection (required)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
            data-testid="input-reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white" data-testid="button-cancel-reject">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SendPOView({
  po,
  onBack,
}: {
  po: PurchaseOrder;
  onBack: () => void;
}) {
  const { toast } = useToast();

  const { data: settings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  const { data: poDetail } = useQuery<PurchaseOrder>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(po.id)],
    enabled: !!po.id,
  });

  const activePO = poDetail || po;
  const supplierEmail = activePO.supplierEmail || activePO.supplier?.email || "";
  const companyName = settings?.companyName || "BuildPlus Ai";

  const [toEmail, setToEmail] = useState(supplierEmail);
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState(`Purchase Order ${activePO.poNumber} from ${companyName}`);
  const [message, setMessage] = useState(
    `Hi,\n\nPlease find attached Purchase Order ${activePO.poNumber} for ${formatCurrency(activePO.total)}.\n\nIf you have any questions regarding this order, please contact us.\n\nKind regards,\n${companyName}`
  );

  useEffect(() => {
    const email = poDetail?.supplierEmail || poDetail?.supplier?.email || supplierEmail;
    if (email && !toEmail) {
      setToEmail(email);
    }
    const name = settings?.companyName || "BuildPlus Ai";
    setSubject(`Purchase Order ${activePO.poNumber} from ${name}`);
    setMessage(
      `Hi,\n\nPlease find attached Purchase Order ${activePO.poNumber} for ${formatCurrency(activePO.total)}.\n\nIf you have any questions regarding this order, please contact us.\n\nKind regards,\n${name}`
    );
  }, [poDetail, settings]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_SEND_WITH_PDF(po.id), {
        to: toEmail,
        cc: ccEmail || undefined,
        subject,
        message,
        sendCopy: false,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Purchase order sent successfully" });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message || "Could not send email", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!toEmail.trim()) {
      toast({ title: "Email required", description: "Enter a recipient email address", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" className="text-white -ml-2" onClick={onBack} data-testid="button-back-from-send">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-400" />
              Send {po.poNumber}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{po.poNumber}.pdf</p>
            <p className="text-xs text-white/50">PDF will be generated and attached</p>
          </div>
          <span className="text-sm font-semibold text-blue-400">{formatCurrency(activePO.total)}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-white/60 mb-1.5 block">To</label>
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-w-0"
              data-testid="input-send-to"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/60 mb-1.5 block">Cc (optional)</label>
            <Input
              type="email"
              placeholder="cc@example.com"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-w-0"
              data-testid="input-send-cc"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/60 mb-1.5 block">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-w-0"
              data-testid="input-send-subject"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/60 mb-1.5 block">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none text-sm min-w-0"
              data-testid="input-send-message"
            />
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-white/10 bg-[#0D1117] px-4 py-3 space-y-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}>
        <Button
          className="w-full bg-blue-600 text-white"
          onClick={handleSend}
          disabled={sendMutation.isPending}
          data-testid="button-send-email"
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {sendMutation.isPending ? "Sending..." : "Send Email with PDF"}
        </Button>
      </div>
    </div>
  );
}

type ViewState = { type: "list" } | { type: "detail"; poId: string } | { type: "send"; po: PurchaseOrder };

export default function MobilePurchaseOrdersPage() {
  const [view, setView] = useState<ViewState>({ type: "list" });

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const pendingPOs = useMemo(() =>
    purchaseOrders.filter(po => po.status === "PENDING" || po.status === "SUBMITTED"),
    [purchaseOrders]
  );
  const approvedPOs = useMemo(() =>
    purchaseOrders.filter(po => po.status === "APPROVED"),
    [purchaseOrders]
  );
  const activePOs = useMemo(() =>
    purchaseOrders.filter(po => ["DRAFT", "ORDERED"].includes(po.status)),
    [purchaseOrders]
  );
  const completedPOs = useMemo(() =>
    purchaseOrders.filter(po => po.status === "RECEIVED").slice(0, 5),
    [purchaseOrders]
  );

  if (view.type === "detail") {
    return (
      <PODetailView
        poId={view.poId}
        onBack={() => setView({ type: "list" })}
        onSend={(po) => setView({ type: "send", po })}
      />
    );
  }

  if (view.type === "send") {
    return (
      <SendPOView
        po={view.po}
        onBack={() => setView({ type: "detail", poId: view.po.id })}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Purchase Orders">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back-po-list">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-po-title">Purchase Orders</div>
            <div className="text-sm text-white/60">
              {pendingPOs.length > 0
                ? `${pendingPOs.length} pending approval`
                : `${purchaseOrders.length} total`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl bg-white/10" />
            ))}
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-4">
              <ShoppingCart className="h-8 w-8 text-blue-400/60" />
            </div>
            <div className="text-lg font-semibold text-white/80">No purchase orders</div>
            <div className="text-sm text-white/50 mt-1">Create POs from the desktop app</div>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingPOs.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">
                  Pending Approval ({pendingPOs.length})
                </h2>
                <div className="space-y-2">
                  {pendingPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setView({ type: "detail", poId: po.id })} />
                  ))}
                </div>
              </div>
            )}

            {approvedPOs.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">
                  Approved — Ready to Send ({approvedPOs.length})
                </h2>
                <div className="space-y-2">
                  {approvedPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setView({ type: "detail", poId: po.id })} />
                  ))}
                </div>
              </div>
            )}

            {activePOs.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">
                  Other Active ({activePOs.length})
                </h2>
                <div className="space-y-2">
                  {activePOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setView({ type: "detail", poId: po.id })} />
                  ))}
                </div>
              </div>
            )}

            {completedPOs.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">
                  Recently Received
                </h2>
                <div className="space-y-2">
                  {completedPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setView({ type: "detail", poId: po.id })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
