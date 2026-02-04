import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, Edit, Paperclip } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { PurchaseOrder, User, Supplier } from "@shared/schema";

interface PurchaseOrderWithDetails extends PurchaseOrder {
  requestedBy: User;
  supplier?: Supplier | null;
  attachmentCount?: number;
}

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: ["/api/purchase-orders", { status: statusFilter !== "ALL" ? statusFilter : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      const response = await fetch(`/api/purchase-orders?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch purchase orders");
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary" data-testid={`badge-status-draft`}>Draft</Badge>;
      case "SUBMITTED":
        return <Badge className="bg-blue-600" data-testid={`badge-status-submitted`}>Submitted</Badge>;
      case "APPROVED":
        return <Badge className="bg-green-600" data-testid={`badge-status-approved`}>Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" data-testid={`badge-status-rejected`}>Rejected</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-unknown`}>{status}</Badge>;
    }
  };

  const formatCurrency = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "$0.00";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "-";
    try {
      const date = typeof dateString === "string" ? parseISO(dateString) : dateString;
      return format(date, "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  const getSupplierDisplay = (po: PurchaseOrderWithDetails): string => {
    if (po.supplier?.name) return po.supplier.name;
    if (po.supplierName) return po.supplierName;
    return "-";
  };

  const filteredOrders = statusFilter === "ALL" 
    ? purchaseOrders 
    : purchaseOrders.filter(po => po.status === statusFilter);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle data-testid="text-page-title">Purchase Orders</CardTitle>
            <CardDescription>Manage and track purchase orders</CardDescription>
          </div>
          <Link href="/purchase-orders/new">
            <Button data-testid="button-create-po">
              <Plus className="mr-2 h-4 w-4" />
              Create New PO
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)} className="mb-6">
            <TabsList data-testid="tabs-status-filter">
              <TabsTrigger value="ALL" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="DRAFT" data-testid="tab-draft">Draft</TabsTrigger>
              <TabsTrigger value="SUBMITTED" data-testid="tab-submitted">Submitted</TabsTrigger>
              <TabsTrigger value="APPROVED" data-testid="tab-approved">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED" data-testid="tab-rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
              No purchase orders found
            </div>
          ) : (
            <Table data-testid="table-purchase-orders">
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="th-po-number">PO Number</TableHead>
                  <TableHead data-testid="th-supplier">Supplier</TableHead>
                  <TableHead data-testid="th-requested-by">Requested By</TableHead>
                  <TableHead data-testid="th-total">Total</TableHead>
                  <TableHead data-testid="th-status">Status</TableHead>
                  <TableHead data-testid="th-created-date">Created Date</TableHead>
                  <TableHead data-testid="th-actions">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((po) => (
                  <TableRow key={po.id} data-testid={`row-po-${po.id}`}>
                    <TableCell data-testid={`cell-po-number-${po.id}`}>
                      <span className="font-medium">{po.poNumber}</span>
                    </TableCell>
                    <TableCell data-testid={`cell-supplier-${po.id}`}>
                      {getSupplierDisplay(po)}
                    </TableCell>
                    <TableCell data-testid={`cell-requested-by-${po.id}`}>
                      {po.requestedBy?.name || po.requestedBy?.email || "-"}
                    </TableCell>
                    <TableCell data-testid={`cell-total-${po.id}`}>
                      {formatCurrency(po.total)}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${po.id}`}>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(po.status)}
                        {(po.attachmentCount ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid={`badge-attachments-${po.id}`}>
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="text-xs">{po.attachmentCount}</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-created-date-${po.id}`}>
                      {formatDate(po.createdAt)}
                    </TableCell>
                    <TableCell data-testid={`cell-actions-${po.id}`}>
                      <div className="flex items-center gap-2">
                        <Link href={`/purchase-orders/${po.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${po.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {po.status === "DRAFT" && (
                          <Link href={`/purchase-orders/${po.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-edit-${po.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
