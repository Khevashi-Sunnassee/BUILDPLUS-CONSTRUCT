import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, Briefcase, User, Receipt, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import type { Customer, Job } from "@shared/schema";
import { PROCUREMENT_ROUTES, MYOB_ROUTES } from "@shared/api-routes";
import { apiRequest } from "@/lib/queryClient";

interface MyobInvoice {
  uid: string;
  number: string;
  date: string;
  customerPO: string;
  status: string;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  comment: string;
  journalMemo: string;
}

interface CustomerInvoicesResponse {
  linked: boolean;
  myobCustomer: { uid: string; name: string; displayId: string } | null;
  invoices: MyobInvoice[];
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

function formatCurrency(val: string | number | null | undefined) {
  if (val === null || val === undefined) return "-";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

function getJobStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
    case "IN_PROGRESS":
    case "STARTED":
      return <Badge className="bg-green-600 text-xs">{status.replace(/_/g, " ")}</Badge>;
    case "COMPLETED":
      return <Badge className="bg-blue-600 text-xs">Completed</Badge>;
    case "ON_HOLD":
      return <Badge className="bg-amber-500 text-xs">On Hold</Badge>;
    case "PENDING_START":
      return <Badge className="bg-yellow-500 text-xs">Pending Start</Badge>;
    case "OPPORTUNITY":
    case "QUOTING":
      return <Badge variant="outline" className="text-xs">{status.replace(/_/g, " ")}</Badge>;
    case "WON":
    case "CONTRACTED":
      return <Badge className="bg-emerald-600 text-xs">{status.replace(/_/g, " ")}</Badge>;
    case "LOST":
    case "CANCELLED":
      return <Badge variant="destructive" className="text-xs">{status.replace(/_/g, " ")}</Badge>;
    case "ARCHIVED":
      return <Badge variant="secondary" className="text-xs">Archived</Badge>;
    case "DEFECT_LIABILITY_PERIOD":
      return <Badge className="bg-purple-600 text-xs">DLP</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function getMyobStatusBadge(status: string) {
  switch (status) {
    case "Open":
      return <Badge className="bg-blue-600 text-xs">Open</Badge>;
    case "Closed":
      return <Badge className="bg-green-600 text-xs">Closed</Badge>;
    case "Credit":
      return <Badge className="bg-amber-500 text-xs">Credit</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
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

function CustomerMyobInvoicesTab({ customerId }: { customerId: string }) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError } = useQuery<CustomerInvoicesResponse>({
    queryKey: [MYOB_ROUTES.CUSTOMER_INVOICES(customerId)],
    queryFn: async () => {
      const res = await apiRequest("GET", MYOB_ROUTES.CUSTOMER_INVOICES(customerId));
      return res.json();
    },
    enabled: !!customerId,
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
          <p className="font-medium" data-testid="text-customer-not-linked">Customer not linked to MYOB</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            This customer needs to be linked to a MYOB customer record first. Go to MYOB Integration &gt; Code Mapping &gt; Customers to link them.
          </p>
        </CardContent>
      </Card>
    );
  }

  const invoices = data.invoices || [];
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (inv.number || "").toLowerCase().includes(term) ||
      (inv.customerPO || "").toLowerCase().includes(term) ||
      (inv.comment || "").toLowerCase().includes(term) ||
      (inv.journalMemo || "").toLowerCase().includes(term)
    );
  });

  const totalValue = invoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
  const totalOutstanding = invoices.reduce((s, inv) => s + (inv.balanceDue || 0), 0);
  const openCount = invoices.filter((inv) => inv.status === "Open").length;
  const closedCount = invoices.filter((inv) => inv.status === "Closed").length;

  const monthlyMap = new Map<string, { month: string; total: number; count: number }>();
  invoices.forEach((inv) => {
    if (!inv.date) return;
    const key = inv.date.slice(0, 7);
    const existing = monthlyMap.get(key) || { month: key, total: 0, count: 0 };
    existing.total += inv.totalAmount || 0;
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
          Linked: {data.myobCustomer?.name} ({data.myobCustomer?.displayId})
        </Badge>
        <Badge variant="secondary" className="text-xs">{data.totalCount} invoices in MYOB</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-kpi-total-revenue">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Invoiced</p>
            <p className="text-lg font-bold font-mono mt-1" data-testid="text-total-invoiced">{formatCurrency(totalValue)}</p>
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
            <p className="text-xs text-muted-foreground">Open Invoices</p>
            <p className="text-lg font-bold font-mono mt-1 text-blue-600 dark:text-blue-400" data-testid="text-open-count">{openCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-closed">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Closed Invoices</p>
            <p className="text-lg font-bold font-mono mt-1 text-green-600 dark:text-green-400" data-testid="text-closed-count">{closedCount}</p>
          </CardContent>
        </Card>
      </div>

      {monthlyData.length > 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card data-testid="chart-monthly-revenue">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Sales History</CardTitle>
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
                    <Bar dataKey="Amount" fill="hsl(142, 60%, 45%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-cumulative-revenue">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cumulative Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradCumulativeRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0} />
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
                    <Area type="monotone" dataKey="Cumulative" stroke="hsl(210, 70%, 50%)" fill="url(#gradCumulativeRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Monthly" stroke="hsl(142, 60%, 45%)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-testid="card-invoices-table">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm font-medium">All Sales Invoices</CardTitle>
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs h-8 text-sm"
              data-testid="input-search-invoices"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInvoices.length > 0 ? (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Customer PO</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Subtotal</TableHead>
                    <TableHead className="text-xs text-right">Tax</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.uid} data-testid={`row-invoice-${inv.uid}`}>
                      <TableCell className="font-mono text-xs" data-testid={`text-invoice-number-${inv.uid}`}>{inv.number}</TableCell>
                      <TableCell className="text-xs">{inv.customerPO || "-"}</TableCell>
                      <TableCell className="text-xs">{formatDate(inv.date)}</TableCell>
                      <TableCell>{getMyobStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(inv.subtotal)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(inv.totalTax)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={inv.balanceDue > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                          {formatCurrency(inv.balanceDue)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {searchTerm ? "No invoices matching search" : "No sales invoices found in MYOB"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/customers/:id");
  const id = params?.id || "";

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [PROCUREMENT_ROUTES.CUSTOMER_BY_ID(id)],
    enabled: !!id,
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    enabled: !!id,
  });

  const jobs = allJobs.filter((j: any) => j.customerId === id);
  const jobCount = jobs.length;

  if (customerLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Customer Detail">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6" role="main" aria-label="Customer Detail">
        <Button variant="ghost" onClick={() => setLocation("/admin/customers")} data-testid="button-back-customers">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Customer not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Customer Detail">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/customers")} data-testid="button-back-customers">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-customer-detail-name">
              {customer.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={customer.isActive ? "default" : "secondary"} data-testid="badge-customer-status">
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => setLocation("/admin/customers")} data-testid="button-edit-customer">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Customer
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList data-testid="tabs-customer-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Briefcase className="h-4 w-4 mr-2" />
            Jobs
            <Badge variant={jobCount > 0 ? "default" : "secondary"} className="ml-1.5 h-5 min-w-[20px] px-1.5 text-xs" data-testid="badge-job-count">
              {jobCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="myob-invoices" data-testid="tab-myob-invoices">
            <Receipt className="h-4 w-4 mr-2" />
            MYOB Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-company-info">
              <CardHeader>
                <CardTitle className="text-lg">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Name" value={customer.name} />
                <InfoRow label="Key Contact" value={customer.keyContact} />
                <InfoRow label="ABN" value={customer.abn} />
                <InfoRow label="ACN" value={customer.acn} />
              </CardContent>
            </Card>
            <Card data-testid="card-contact-details">
              <CardHeader>
                <CardTitle className="text-lg">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Email" value={customer.email} />
                <InfoRow label="Phone" value={customer.phone} />
                <InfoRow label="Payment Terms" value={customer.paymentTerms} />
              </CardContent>
            </Card>
            <Card data-testid="card-address">
              <CardHeader>
                <CardTitle className="text-lg">Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Address Line 1" value={customer.addressLine1} />
                <InfoRow label="Address Line 2" value={customer.addressLine2} />
                <InfoRow label="City / Suburb" value={customer.city} />
                <InfoRow label="State" value={customer.state} />
                <InfoRow label="Postcode" value={customer.postcode} />
                <InfoRow label="Country" value={customer.country} />
              </CardContent>
            </Card>
            <Card data-testid="card-status-notes">
              <CardHeader>
                <CardTitle className="text-lg">Status & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={customer.isActive ? "default" : "secondary"} data-testid="badge-overview-status">
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {customer.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="font-medium whitespace-pre-wrap" data-testid="text-customer-notes">{customer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {jobs.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Est. Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`/admin/jobs/${job.id}/programme`)}
                        data-testid={`row-customer-job-${job.id}`}
                      >
                        <TableCell className="font-mono text-sm" data-testid={`text-job-number-${job.id}`}>{job.jobNumber}</TableCell>
                        <TableCell className="font-medium" data-testid={`text-job-name-${job.id}`}>{job.name}</TableCell>
                        <TableCell data-testid={`badge-job-status-${job.id}`}>
                          {getJobStatusBadge(job.status)}
                        </TableCell>
                        <TableCell className="text-right text-sm" data-testid={`text-job-value-${job.id}`}>
                          {formatCurrency(job.estimatedValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm" data-testid="text-no-jobs">No jobs linked to this customer</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="myob-invoices" className="space-y-4">
          <CustomerMyobInvoicesTab customerId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
