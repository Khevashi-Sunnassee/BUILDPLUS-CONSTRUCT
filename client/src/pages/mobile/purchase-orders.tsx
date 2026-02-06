import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { ShoppingCart, Calendar, ChevronRight, ChevronLeft, Check, X } from "lucide-react";
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
  supplier?: {
    id: string;
    name: string;
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
  APPROVED: { label: "Approved", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ORDERED: { label: "Ordered", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  RECEIVED: { label: "Received", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  REJECTED: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobilePurchaseOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
  });

  const { data: poDetails, isLoading: detailsLoading } = useQuery<PurchaseOrder>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(selectedPO?.id || "")],
    enabled: !!selectedPO?.id,
  });

  const approveMutation = useMutation({
    mutationFn: async (poId: string) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_APPROVE(poId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(selectedPO?.id || "")] });
      toast({ title: "Purchase order approved" });
      setSelectedPO(null);
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (poId: string) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_REJECT(poId), { reason: "Rejected via mobile" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      toast({ title: "Purchase order rejected" });
      setSelectedPO(null);
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const pendingPOs = purchaseOrders.filter(po => po.status === "PENDING");
  const activePOs = purchaseOrders.filter(po => ["DRAFT", "APPROVED", "ORDERED"].includes(po.status));
  const completedPOs = purchaseOrders.filter(po => po.status === "RECEIVED").slice(0, 5);

  const formatCurrency = (amount: string | number | null) => {
    if (amount === null) return "-";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(numAmount);
  };

  const canApprove = user?.role === "ADMIN" || user?.role === "MANAGER";

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-po-title">Purchase Orders</div>
            <div className="text-sm text-white/60">
              {pendingPOs.length > 0 ? `${pendingPOs.length} pending approval` : `${activePOs.length} active`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No purchase orders yet</p>
            <p className="text-sm text-white/40">Create POs from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingPOs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Pending Approval ({pendingPOs.length})
                </h2>
                <div className="space-y-3">
                  {pendingPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setSelectedPO(po)} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}

            {activePOs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Active Orders
                </h2>
                <div className="space-y-3">
                  {activePOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setSelectedPO(po)} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}

            {completedPOs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Recent Received
                </h2>
                <div className="space-y-3">
                  {completedPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setSelectedPO(po)} muted formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedPO && (
            <PODetailSheet 
              po={poDetails || selectedPO}
              isLoading={detailsLoading}
              canApprove={canApprove && selectedPO.status === "PENDING"}
              onApprove={() => approveMutation.mutate(selectedPO.id)}
              onReject={() => rejectMutation.mutate(selectedPO.id)}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              onClose={() => setSelectedPO(null)}
              formatCurrency={formatCurrency}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function POCard({ po, onSelect, muted = false, formatCurrency }: { po: PurchaseOrder; onSelect: () => void; muted?: boolean; formatCurrency: (amount: string | number | null) => string }) {
  const status = statusConfig[po.status] || statusConfig.DRAFT;
  const total = po.total ? parseFloat(po.total) : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`po-${po.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">{po.poNumber}</h3>
          {po.supplier && (
            <p className="text-xs text-white/50 truncate">{po.supplier.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(po.createdAt), "dd MMM")}
        </span>
        <span className="font-medium text-white">
          {formatCurrency(total)}
        </span>
      </div>
    </button>
  );
}

function PODetailSheet({ 
  po, 
  isLoading,
  canApprove,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  onClose,
  formatCurrency,
}: { 
  po: PurchaseOrder;
  isLoading: boolean;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  onClose: () => void;
  formatCurrency: (amount: string | number | null) => string;
}) {
  const status = statusConfig[po.status] || statusConfig.DRAFT;

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1 text-white">{po.poNumber}</SheetTitle>
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
        </div>
        {po.supplier && (
          <p className="text-sm text-white/60 text-left">{po.supplier.name}</p>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-lg bg-white/10" />
            <Skeleton className="h-32 rounded-lg bg-white/10" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white/60 mb-1 block">Created</label>
                <p className="text-sm text-white">{format(new Date(po.createdAt), "dd MMM yyyy")}</p>
              </div>
              {po.requiredByDate && (
                <div>
                  <label className="text-sm font-medium text-white/60 mb-1 block">Required By</label>
                  <p className="text-sm text-white">{format(new Date(po.requiredByDate), "dd MMM yyyy")}</p>
                </div>
              )}
              {po.requestedBy && (
                <div>
                  <label className="text-sm font-medium text-white/60 mb-1 block">Requested By</label>
                  <p className="text-sm text-white">{po.requestedBy.name || po.requestedBy.email}</p>
                </div>
              )}
            </div>

            {po.deliveryAddress && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-1 block">Delivery Address</label>
                <p className="text-sm text-white">{po.deliveryAddress}</p>
              </div>
            )}

            {po.items && po.items.length > 0 && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">
                  Items ({po.items.length})
                </label>
                <div className="space-y-2">
                  {po.items.map((item) => (
                    <div key={item.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-white">{item.description}</p>
                          <p className="text-xs text-white/50">
                            {item.quantity} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <span className="text-sm font-medium flex-shrink-0 text-white">
                          {formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Subtotal</span>
                <span className="text-white">{formatCurrency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Tax</span>
                <span className="text-white">{formatCurrency(po.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t border-white/10 pt-2">
                <span className="text-white">Total</span>
                <span className="text-white">{formatCurrency(po.total)}</span>
              </div>
            </div>

            {po.notes && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-1 block">Notes</label>
                <p className="text-sm text-white">{po.notes}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4 space-y-2">
        {canApprove && (
          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onApprove}
              disabled={isApproving || isRejecting}
            >
              <Check className="h-4 w-4 mr-2" />
              {isApproving ? "Approving..." : "Approve"}
            </Button>
            <Button 
              variant="destructive"
              className="flex-1"
              onClick={onReject}
              disabled={isApproving || isRejecting}
            >
              <X className="h-4 w-4 mr-2" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        )}
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
