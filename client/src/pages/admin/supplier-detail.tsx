import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, Building2, ShoppingCart, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Supplier } from "@shared/schema";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  total?: string;
  subtotal?: string;
  taxAmount?: string;
  supplierId?: string;
  createdAt: string;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

function formatCurrency(amount?: string | null) {
  if (!amount || amount === "0") return "-";
  const num = parseFloat(amount);
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary">Draft</Badge>;
    case "SUBMITTED":
      return <Badge className="bg-blue-600">Submitted</Badge>;
    case "APPROVED":
      return <Badge className="bg-orange-500">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    case "RECEIVED":
      return <Badge className="bg-green-600">Received</Badge>;
    case "RECEIVED_IN_PART":
      return <Badge className="bg-green-700">Received in Part</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function SupplierDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/suppliers/:id");
  const id = params?.id || "";

  const { data: supplier, isLoading: supplierLoading } = useQuery<Supplier>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIER_BY_ID(id)],
    enabled: !!id,
  });

  const { data: allPOs = [] } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
    enabled: !!id,
  });

  const purchaseOrders = allPOs.filter((po: any) => po.supplierId === id);

  if (supplierLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Supplier Detail">
        <Skeleton className="h-10 w-48" data-testid="skeleton-supplier-header" />
        <Skeleton className="h-[400px]" data-testid="skeleton-supplier-content" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-6" role="main" aria-label="Supplier Detail">
        <Button variant="ghost" onClick={() => setLocation("/admin/suppliers")} data-testid="button-back-suppliers">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Suppliers
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-supplier-not-found">
            Supplier not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Supplier Detail">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/suppliers")} data-testid="button-back-suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-supplier-name">
              {supplier.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={supplier.isActive ? "default" : "secondary"} data-testid="badge-supplier-status">
                {supplier.isActive ? "Active" : "Inactive"}
              </Badge>
              {supplier.availableForTender && (
                <Badge variant="outline" data-testid="badge-supplier-tender">Tender</Badge>
              )}
              {supplier.isEquipmentHire && (
                <Badge variant="outline" data-testid="badge-supplier-equipment-hire">Equipment Hire</Badge>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setLocation("/admin/suppliers")} data-testid="button-edit-supplier">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Supplier
        </Button>
      </div>

      <Tabs defaultValue="overview" data-testid="tabs-supplier-detail">
        <TabsList data-testid="tabs-list-supplier">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" data-testid="tab-purchase-orders">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Purchase Orders
            <Badge variant={purchaseOrders.length > 0 ? "default" : "secondary"} className="ml-1.5 h-5 min-w-[20px] px-1.5 text-xs" data-testid="badge-po-count">
              {purchaseOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tenders" data-testid="tab-tenders">
            <FileText className="h-4 w-4 mr-2" />
            Tenders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-company-info">
              <CardHeader>
                <CardTitle className="text-lg">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Name" value={supplier.name} />
                <InfoRow label="Key Contact" value={supplier.keyContact} />
                <InfoRow label="ABN" value={supplier.abn} />
                <InfoRow label="ACN" value={supplier.acn} />
              </CardContent>
            </Card>

            <Card data-testid="card-contact-details">
              <CardHeader>
                <CardTitle className="text-lg">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Email" value={supplier.email} />
                <InfoRow label="Phone" value={supplier.phone} />
                <InfoRow label="Payment Terms" value={supplier.paymentTerms} />
              </CardContent>
            </Card>

            <Card data-testid="card-address">
              <CardHeader>
                <CardTitle className="text-lg">Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Address Line 1" value={supplier.addressLine1} />
                <InfoRow label="Address Line 2" value={supplier.addressLine2} />
                <InfoRow label="City/Suburb" value={supplier.city} />
                <InfoRow label="State" value={supplier.state} />
                <InfoRow label="Postcode" value={supplier.postcode} />
                <InfoRow label="Country" value={supplier.country} />
              </CardContent>
            </Card>

            <Card data-testid="card-supplier-settings">
              <CardHeader>
                <CardTitle className="text-lg">Supplier Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Default Cost Code" value={supplier.defaultCostCodeId || "-"} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={supplier.isActive ? "default" : "secondary"} data-testid="badge-settings-status">
                    {supplier.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available for Tender</span>
                  <span className="font-medium" data-testid="text-available-tender">{supplier.availableForTender ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Equipment Hire</span>
                  <span className="font-medium" data-testid="text-equipment-hire">{supplier.isEquipmentHire ? "Yes" : "No"}</span>
                </div>
              </CardContent>
            </Card>

            {supplier.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-supplier-notes">{supplier.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-4">
          {purchaseOrders.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="header-po-number">PO Number</TableHead>
                      <TableHead data-testid="header-po-status">Status</TableHead>
                      <TableHead data-testid="header-po-total">Total</TableHead>
                      <TableHead data-testid="header-po-date">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po) => (
                      <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/purchase-orders/${po.id}`)} data-testid={`row-po-${po.id}`}>
                        <TableCell data-testid={`text-po-number-${po.id}`}>{po.poNumber}</TableCell>
                        <TableCell data-testid={`badge-po-status-${po.id}`}>
                          {getStatusBadge(po.status)}
                        </TableCell>
                        <TableCell data-testid={`text-po-total-${po.id}`}>{formatCurrency(po.total)}</TableCell>
                        <TableCell data-testid={`text-po-date-${po.id}`}>{formatDate(po.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-purchase-orders">No purchase orders from this supplier</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tenders" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-tenders">No tender participations for this supplier</p>
              <p className="text-xs text-muted-foreground mt-2">Tender memberships can be managed from the Tenders page</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
