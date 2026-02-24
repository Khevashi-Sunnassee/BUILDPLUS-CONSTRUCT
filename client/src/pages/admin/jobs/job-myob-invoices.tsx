import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Link2, Receipt, FileText, Search, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { MYOB_ROUTES } from "@shared/api-routes";
import { apiRequest } from "@/lib/queryClient";

interface MyobBill {
  uid: string;
  number: string;
  date: string;
  supplierInvoiceNumber: string;
  supplierName: string;
  status: string;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  comment: string;
  journalMemo: string;
}

interface MyobInvoice {
  uid: string;
  number: string;
  date: string;
  customerPO: string;
  customerName: string;
  status: string;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  comment: string;
  journalMemo: string;
}

interface JobInvoicesResponse {
  linked: boolean;
  myobJobUid?: string;
  job: { id: string; name: string; jobNumber: string };
  bills: MyobBill[];
  invoices: MyobInvoice[];
  billCount: number;
  invoiceCount: number;
}

function formatCurrency(amount?: number | null) {
  if (amount === null || amount === undefined || amount === 0) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
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

function getMyobStatusBadge(status: string) {
  switch (status) {
    case "Open":
      return <Badge className="bg-blue-600 dark:bg-blue-700 text-white text-xs">Open</Badge>;
    case "Closed":
      return <Badge className="bg-green-600 dark:bg-green-700 text-white text-xs">Closed</Badge>;
    case "Debit":
      return <Badge className="bg-amber-500 dark:bg-amber-600 text-white text-xs">Debit</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function buildMonthlyData(items: { date: string; totalAmount: number }[]) {
  const monthlyMap = new Map<string, { month: string; total: number; count: number }>();
  items.forEach((item) => {
    if (!item.date) return;
    const key = item.date.slice(0, 7);
    const existing = monthlyMap.get(key) || { month: key, total: 0, count: 0 };
    existing.total += item.totalAmount || 0;
    existing.count += 1;
    monthlyMap.set(key, existing);
  });
  return Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      name: formatMonthLabel(m.month + "-01"),
      Amount: Math.round(m.total),
      Invoices: m.count,
    }));
}

function buildCumulativeData(monthlyData: { name: string; Amount: number }[]) {
  return monthlyData.reduce<{ name: string; Cumulative: number; Monthly: number }[]>((acc, m) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].Cumulative : 0;
    acc.push({ name: m.name, Monthly: m.Amount, Cumulative: prev + m.Amount });
    return acc;
  }, []);
}

export default function JobMyobInvoicesPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/jobs/:id/myob-invoices");
  const jobId = params?.id || "";
  const [billSearch, setBillSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [activeTab, setActiveTab] = useState("purchase-bills");

  const { data, isLoading, isError } = useQuery<JobInvoicesResponse>({
    queryKey: [MYOB_ROUTES.JOB_INVOICES(jobId)],
    queryFn: async () => {
      const res = await apiRequest("GET", MYOB_ROUTES.JOB_INVOICES(jobId));
      return res.json();
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 w-full" data-testid="page-job-myob-invoices">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 space-y-4 w-full" data-testid="page-job-myob-invoices">
        <Button variant="ghost" onClick={() => setLocation("/admin/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Jobs
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Failed to load MYOB invoice data. Please check MYOB connection.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.linked) {
    return (
      <div className="p-6 space-y-4 w-full" data-testid="page-job-myob-invoices">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/jobs")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">MYOB Invoices</h1>
            {data?.job && (
              <p className="text-sm text-muted-foreground">{data.job.jobNumber} - {data.job.name}</p>
            )}
          </div>
        </div>
        <Card className="border-amber-500/30">
          <CardContent className="py-12 text-center space-y-3">
            <Link2 className="h-12 w-12 mx-auto text-amber-500" />
            <p className="font-medium" data-testid="text-job-not-linked">Job not linked to MYOB</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This job needs to be linked to a MYOB job record first. Go to MYOB Integration &gt; Code Mapping &gt; Jobs to set up the link.
            </p>
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin/myob")} data-testid="button-go-to-myob">
              Go to MYOB Integration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bills = data.bills || [];
  const invoices = data.invoices || [];
  const allItems = [...bills, ...invoices];

  const totalBillValue = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalInvoiceValue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalOutstanding = allItems.reduce((s, i) => s + (i.balanceDue || 0), 0);
  const openCount = allItems.filter((i) => i.status === "Open").length;

  const filteredBills = bills.filter((b) => {
    if (!billSearch) return true;
    const term = billSearch.toLowerCase();
    return (
      (b.number || "").toLowerCase().includes(term) ||
      (b.supplierInvoiceNumber || "").toLowerCase().includes(term) ||
      (b.supplierName || "").toLowerCase().includes(term) ||
      (b.comment || "").toLowerCase().includes(term) ||
      (b.journalMemo || "").toLowerCase().includes(term)
    );
  });

  const filteredInvoices = invoices.filter((inv) => {
    if (!invoiceSearch) return true;
    const term = invoiceSearch.toLowerCase();
    return (
      (inv.number || "").toLowerCase().includes(term) ||
      (inv.customerPO || "").toLowerCase().includes(term) ||
      (inv.customerName || "").toLowerCase().includes(term) ||
      (inv.comment || "").toLowerCase().includes(term) ||
      (inv.journalMemo || "").toLowerCase().includes(term)
    );
  });

  const billMonthly = buildMonthlyData(bills);
  const invoiceMonthly = buildMonthlyData(invoices);
  const billCumulative = buildCumulativeData(billMonthly);
  const invoiceCumulative = buildCumulativeData(invoiceMonthly);

  return (
    <div className="p-6 space-y-4 w-full" data-testid="page-job-myob-invoices">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Briefcase className="h-5 w-5" />
            MYOB Invoices
          </h1>
          <p className="text-sm text-muted-foreground">{data.job.jobNumber} - {data.job.name}</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs" data-testid="badge-myob-linked">
          <Link2 className="h-3 w-3" />
          Linked to MYOB
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card data-testid="card-kpi-purchases">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Purchase Bills</p>
            <p className="text-lg font-bold font-mono mt-1" data-testid="text-total-purchases">{formatCurrency(totalBillValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{data.billCount} bills</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-sales">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Sale Invoices</p>
            <p className="text-lg font-bold font-mono mt-1 text-green-600 dark:text-green-400" data-testid="text-total-sales">{formatCurrency(totalInvoiceValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{data.invoiceCount} invoices</p>
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
            <p className="text-xs text-muted-foreground">Open Items</p>
            <p className="text-lg font-bold font-mono mt-1 text-blue-600 dark:text-blue-400" data-testid="text-open-count">{openCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-job-invoices">
        <TabsList>
          <TabsTrigger value="purchase-bills" data-testid="tab-purchase-bills">
            <FileText className="h-4 w-4 mr-2" />
            Purchase Bills ({data.billCount})
          </TabsTrigger>
          <TabsTrigger value="sale-invoices" data-testid="tab-sale-invoices">
            <Receipt className="h-4 w-4 mr-2" />
            Sale Invoices ({data.invoiceCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchase-bills" className="space-y-4">
          {billMonthly.length > 1 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card data-testid="chart-bill-monthly">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Purchase History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={billMonthly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              <Card data-testid="chart-bill-cumulative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cumulative Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={billCumulative} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradBillCum" x1="0" y1="0" x2="0" y2="1">
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
                        <Area type="monotone" dataKey="Cumulative" stroke="hsl(210, 70%, 50%)" fill="url(#gradBillCum)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Monthly" stroke="hsl(30, 80%, 55%)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
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
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  className="max-w-xs text-sm"
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
                        <TableHead className="text-xs">Supplier</TableHead>
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
                          <TableCell className="text-xs">{b.supplierInvoiceNumber || "-"}</TableCell>
                          <TableCell className="text-xs">{b.supplierName || "-"}</TableCell>
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
                <div className="py-8 text-center text-muted-foreground text-sm" data-testid="text-bills-empty">
                  {billSearch ? "No bills matching search" : "No purchase bills found in MYOB for this job"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sale-invoices" className="space-y-4">
          {invoiceMonthly.length > 1 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card data-testid="chart-invoice-monthly">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Sales History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={invoiceMonthly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              <Card data-testid="chart-invoice-cumulative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cumulative Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={invoiceCumulative} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradInvCum" x1="0" y1="0" x2="0" y2="1">
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
                        <Area type="monotone" dataKey="Cumulative" stroke="hsl(142, 60%, 45%)" fill="url(#gradInvCum)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Monthly" stroke="hsl(30, 80%, 55%)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
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
                <CardTitle className="text-sm font-medium">All Sale Invoices</CardTitle>
                <Input
                  placeholder="Search invoices..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="max-w-xs text-sm"
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
                        <TableHead className="text-xs">Customer</TableHead>
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
                          <TableCell className="text-xs">{inv.customerName || "-"}</TableCell>
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
                <div className="py-8 text-center text-muted-foreground text-sm" data-testid="text-invoices-empty">
                  {invoiceSearch ? "No invoices matching search" : "No sale invoices found in MYOB for this job"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
