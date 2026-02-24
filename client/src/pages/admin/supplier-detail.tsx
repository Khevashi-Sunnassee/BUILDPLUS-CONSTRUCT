import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, Building2, ShoppingCart, FileText, Receipt, Loader2, Link2, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import type { Supplier } from "@shared/schema";
import { PROCUREMENT_ROUTES, MYOB_ROUTES } from "@shared/api-routes";
import { apiRequest } from "@/lib/queryClient";

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

interface MyobBill {
  uid: string;
  number: string;
  date: string;
  supplierInvoiceNumber: string;
  status: string;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  comment: string;
  journalMemo: string;
}

interface SupplierBillsResponse {
  linked: boolean;
  myobSupplier: { uid: string; name: string; displayId: string } | null;
  bills: MyobBill[];
  totalCount: number;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

function formatCurrency(amount?: string | number | null) {
  if (amount === null || amount === undefined || amount === "0" || amount === 0) return "-";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
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

function getMyobStatusBadge(status: string) {
  switch (status) {
    case "Open":
      return <Badge className="bg-blue-600 text-xs">Open</Badge>;
    case "Closed":
      return <Badge className="bg-green-600 text-xs">Closed</Badge>;
    case "Debit":
      return <Badge className="bg-amber-500 text-xs">Debit</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
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

function formatMonthLabel(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", { year: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

function SupplierMyobInvoicesTab({ supplierId }: { supplierId: string }) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError } = useQuery<SupplierBillsResponse>({
    queryKey: [MYOB_ROUTES.SUPPLIER_BILLS(supplierId)],
    queryFn: async () => {
      const res = await apiRequest("GET", MYOB_ROUTES.SUPPLIER_BILLS(supplierId));
      return res.json();
    },
    enabled: !!supplierId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-destructive">
          Failed to load MYOB invoice data. Please check MYOB connection.
        </CardContent>
      </Card>
    );
  }

  if (!data?.linked) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="py-12 text-center space-y-3">
          <Link2 className="h-12 w-12 mx-auto text-amber-500" />
          <p className="font-medium" data-testid="text-supplier-not-linked">Supplier not linked to MYOB</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            This supplier needs to be linked to a MYOB supplier record first. Go to MYOB Integration &gt; Code Mapping &gt; Suppliers to link them.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bills = data.bills || [];
  const filteredBills = bills.filter((b) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (b.number || "").toLowerCase().includes(term) ||
      (b.supplierInvoiceNumber || "").toLowerCase().includes(term) ||
      (b.comment || "").toLowerCase().includes(term) ||
      (b.journalMemo || "").toLowerCase().includes(term)
    );
  });

  const totalValue = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalOutstanding = bills.reduce((s, b) => s + (b.balanceDue || 0), 0);
  const openCount = bills.filter((b) => b.status === "Open").length;
  const closedCount = bills.filter((b) => b.status === "Closed").length;

  const monthlyMap = new Map<string, { month: string; total: number; count: number }>();
  bills.forEach((b) => {
    if (!b.date) return;
    const key = b.date.slice(0, 7);
    const existing = monthlyMap.get(key) || { month: key, total: 0, count: 0 };
    existing.total += b.totalAmount || 0;
    existing.count += 1;
    monthlyMap.set(key, existing);
  });
  const monthlyData = Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      name: formatMonthLabel(m.month + "-01"),
      Amount: Math.round(m.total),
      Invoices: m.count,
    }));

  const cumulativeData = monthlyData.reduce<{ name: string; Cumulative: number; Monthly: number }[]>((acc, m) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].Cumulative : 0;
    acc.push({ name: m.name, Monthly: m.Amount, Cumulative: prev + m.Amount });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="gap-1.5 text-xs" data-testid="badge-myob-linked">
          <Link2 className="h-3 w-3" />
          Linked: {data.myobSupplier?.name} ({data.myobSupplier?.displayId})
        </Badge>
        <Badge variant="secondary" className="text-xs">{data.totalCount} bills in MYOB</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-kpi-total-value">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold font-mono mt-1" data-testid="text-total-value">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-outstanding">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold font-mono mt-1 text-amber-600 dark:text-amber-400" data-testid="text-outstanding">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-open">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Open Bills</p>
            <p className="text-lg font-bold font-mono mt-1 text-blue-600 dark:text-blue-400" data-testid="text-open-count">{openCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-closed">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Closed Bills</p>
            <p className="text-lg font-bold font-mono mt-1 text-green-600 dark:text-green-400" data-testid="text-closed-count">{closedCount}</p>
          </CardContent>
        </Card>
      </div>

      {monthlyData.length > 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card data-testid="chart-monthly-purchases">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Purchase History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => name === "Amount" ? formatCurrency(value) : value}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                    />
                    <Bar dataKey="Amount" fill="hsl(210, 70%, 50%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-cumulative-spend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cumulative Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradCumulative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="Cumulative" stroke="hsl(142, 60%, 45%)" fill="url(#gradCumulative)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Monthly" stroke="hsl(210, 70%, 50%)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-testid="card-bills-table">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm font-medium">All Purchase Bills</CardTitle>
            <Input
              placeholder="Search bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs h-8 text-sm"
              data-testid="input-search-bills"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBills.length > 0 ? (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Bill #</TableHead>
                    <TableHead className="text-xs">Supplier Inv #</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Subtotal</TableHead>
                    <TableHead className="text-xs text-right">Tax</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((b) => (
                    <TableRow key={b.uid} data-testid={`row-bill-${b.uid}`}>
                      <TableCell className="font-mono text-xs" data-testid={`text-bill-number-${b.uid}`}>{b.number}</TableCell>
                      <TableCell className="text-xs" data-testid={`text-supplier-inv-${b.uid}`}>{b.supplierInvoiceNumber || "-"}</TableCell>
                      <TableCell className="text-xs">{formatDate(b.date)}</TableCell>
                      <TableCell>{getMyobStatusBadge(b.status)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(b.subtotal)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(b.totalTax)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(b.totalAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={b.balanceDue > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                          {formatCurrency(b.balanceDue)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {searchTerm ? "No bills matching search" : "No purchase bills found in MYOB"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
          <TabsTrigger value="myob-invoices" data-testid="tab-myob-invoices">
            <Receipt className="h-4 w-4 mr-2" />
            MYOB Invoices
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

        <TabsContent value="myob-invoices" className="space-y-4">
          <SupplierMyobInvoicesTab supplierId={id} />
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
