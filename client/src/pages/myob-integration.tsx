import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Link2, Unlink, Building2, Users, Truck, FileText, Package, DollarSign, RefreshCw, Loader2, ExternalLink, CheckCircle2, XCircle, AlertTriangle, ClipboardList, TrendingUp, TrendingDown, BarChart3, Calendar, Briefcase, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line, Legend, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MYOB_ROUTES } from "@shared/api-routes";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { dateInputProps } from "@/lib/validation";
import { formatCurrencyAccounting as formatCurrency } from "@/lib/format";

interface MyobStatus {
  connected: boolean;
  businessId?: string;
  connectedBy?: string;
  expiresAt?: string;
  connectedAt?: string;
  lastRefreshed?: string;
}

export default function MyobIntegrationPage() {
  useDocumentTitle("MYOB Integration");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const { data: status, isLoading: statusLoading } = useQuery<MyobStatus>({
    queryKey: [MYOB_ROUTES.STATUS],
    refetchInterval: 30000,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", MYOB_ROUTES.DISCONNECT),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.STATUS] });
      toast({ title: "Disconnected", description: "MYOB account has been unlinked." });
      setShowDisconnectDialog(false);
      setActiveTab("overview");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleConnect = useCallback(() => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      MYOB_ROUTES.AUTH,
      "myob-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (popup) {
      const pollInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollInterval);
          queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.STATUS] });
        }
      }, 500);
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "MYOB_OAUTH_SUCCESS") {
        queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.STATUS] });
        toast({ title: "Connected", description: "MYOB account linked successfully." });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [toast]);

  if (statusLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">MYOB Integration</h1>
          <p className="text-muted-foreground">Connect your MYOB Business account to sync financial data</p>
        </div>
        {status?.connected ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="gap-1" data-testid="badge-connection-status">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisconnectDialog(true)}
              data-testid="button-disconnect-myob"
            >
              <Unlink className="h-4 w-4 mr-1" />
              Disconnect
            </Button>
          </div>
        ) : (
          <Badge variant="secondary" className="gap-1" data-testid="badge-connection-status">
            <XCircle className="h-3 w-3" />
            Not Connected
          </Badge>
        )}
      </div>

      {!status?.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connect to MYOB
            </CardTitle>
            <CardDescription>
              Link your MYOB Business account to access customers, suppliers, accounts, invoices, and inventory data directly within BuildPlus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <Users className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">Contacts</p>
                  <p className="text-xs text-muted-foreground">View customers and suppliers from MYOB</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <DollarSign className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">Financials</p>
                  <p className="text-xs text-muted-foreground">Browse accounts and invoices</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <Package className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">Inventory</p>
                  <p className="text-xs text-muted-foreground">Access inventory items and pricing</p>
                </div>
              </div>
            </div>
            <Button onClick={handleConnect} className="w-full sm:w-auto" data-testid="button-connect-myob">
              <Link2 className="h-4 w-4 mr-2" />
              Connect MYOB Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap" data-testid="tabs-myob-data">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
              <TabsTrigger value="suppliers" data-testid="tab-suppliers">Suppliers</TabsTrigger>
              <TabsTrigger value="accounts" data-testid="tab-accounts">Accounts</TabsTrigger>
              <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
              <TabsTrigger value="items" data-testid="tab-items">Items</TabsTrigger>
              <TabsTrigger value="code-mapping" data-testid="tab-code-mapping">Code Mapping</TabsTrigger>
              <TabsTrigger value="profit-loss" data-testid="tab-profit-loss">Profit & Loss</TabsTrigger>
              <TabsTrigger value="export-log" data-testid="tab-export-log">Export Log</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ConnectionOverview status={status} />
            </TabsContent>

            <TabsContent value="customers">
              <MyobDataTable
                endpoint={MYOB_ROUTES.CUSTOMERS}
                title="Customers"
                icon={<Users className="h-5 w-5" />}
                columns={["Name", "CompanyName", "IsActive"]}
                renderRow={(item: any) => (
                  <TableRow key={item.UID}>
                    <TableCell data-testid={`text-customer-name-${item.UID}`}>{item.Name || `${item.FirstName || ""} ${item.LastName || ""}`.trim()}</TableCell>
                    <TableCell>{item.CompanyName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.IsActive ? "default" : "secondary"}>
                        {item.IsActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
                searchTerm={searchTerms.customers || ""}
                onSearchChange={(v) => setSearchTerms(prev => ({ ...prev, customers: v }))}
              />
            </TabsContent>

            <TabsContent value="suppliers">
              <MyobDataTable
                endpoint={MYOB_ROUTES.SUPPLIERS}
                title="Suppliers"
                icon={<Truck className="h-5 w-5" />}
                columns={["Name", "CompanyName", "IsActive"]}
                renderRow={(item: any) => (
                  <TableRow key={item.UID}>
                    <TableCell data-testid={`text-supplier-name-${item.UID}`}>{item.Name || `${item.FirstName || ""} ${item.LastName || ""}`.trim()}</TableCell>
                    <TableCell>{item.CompanyName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.IsActive ? "default" : "secondary"}>
                        {item.IsActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
                searchTerm={searchTerms.suppliers || ""}
                onSearchChange={(v) => setSearchTerms(prev => ({ ...prev, suppliers: v }))}
              />
            </TabsContent>

            <TabsContent value="accounts">
              <MyobDataTable
                endpoint={MYOB_ROUTES.ACCOUNTS}
                title="Chart of Accounts"
                icon={<FileText className="h-5 w-5" />}
                columns={["Number", "Name", "Type", "IsActive"]}
                renderRow={(item: any) => (
                  <TableRow key={item.UID}>
                    <TableCell className="font-mono text-sm" data-testid={`text-account-number-${item.UID}`}>{item.Number}</TableCell>
                    <TableCell>{item.Name}</TableCell>
                    <TableCell>{item.Type || item.Classification || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.IsActive ? "default" : "secondary"}>
                        {item.IsActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
                searchTerm={searchTerms.accounts || ""}
                onSearchChange={(v) => setSearchTerms(prev => ({ ...prev, accounts: v }))}
              />
            </TabsContent>

            <TabsContent value="invoices">
              <MyobDataTable
                endpoint={MYOB_ROUTES.INVOICES}
                title="Invoices"
                icon={<DollarSign className="h-5 w-5" />}
                columns={["Number", "Customer", "Date", "Total", "Status"]}
                renderRow={(item: any) => (
                  <TableRow key={item.UID}>
                    <TableCell className="font-mono text-sm" data-testid={`text-invoice-number-${item.UID}`}>{item.Number || "-"}</TableCell>
                    <TableCell>{item.Customer?.Name || item.Contact?.Name || "-"}</TableCell>
                    <TableCell>{item.Date ? new Date(item.Date).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{item.TotalAmount != null ? `$${Number(item.TotalAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.Status === "Open" ? "default" : "secondary"}>
                        {item.Status || "-"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
                searchTerm={searchTerms.invoices || ""}
                onSearchChange={(v) => setSearchTerms(prev => ({ ...prev, invoices: v }))}
              />
            </TabsContent>

            <TabsContent value="items">
              <MyobDataTable
                endpoint={MYOB_ROUTES.ITEMS}
                title="Inventory Items"
                icon={<Package className="h-5 w-5" />}
                columns={["Number", "Name", "Selling Price", "IsActive"]}
                renderRow={(item: any) => (
                  <TableRow key={item.UID}>
                    <TableCell className="font-mono text-sm" data-testid={`text-item-number-${item.UID}`}>{item.Number || "-"}</TableCell>
                    <TableCell>{item.Name || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.SellingDetails?.BaseSellingPrice != null
                        ? `$${Number(item.SellingDetails.BaseSellingPrice).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.IsActive ? "default" : "secondary"}>
                        {item.IsActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
                searchTerm={searchTerms.items || ""}
                onSearchChange={(v) => setSearchTerms(prev => ({ ...prev, items: v }))}
              />
            </TabsContent>

            <TabsContent value="code-mapping">
              <CodeMappingTab />
            </TabsContent>

            <TabsContent value="profit-loss">
              <ProfitAndLossTab />
            </TabsContent>

            <TabsContent value="export-log">
              <ExportLogTable />
            </TabsContent>
          </Tabs>
        </>
      )}

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect MYOB?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to your MYOB Business account. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConnectionOverview({ status }: { status: MyobStatus }) {
  const { data: companyData, isLoading } = useQuery({
    queryKey: [MYOB_ROUTES.COMPANY],
    enabled: status.connected,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Connection Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Status">
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          </InfoRow>
          <InfoRow label="Business ID">
            <span className="font-mono text-sm" data-testid="text-business-id">{status.businessId || "-"}</span>
          </InfoRow>
          {status.connectedAt && (
            <InfoRow label="Connected Since">
              <span className="text-sm">{new Date(status.connectedAt).toLocaleDateString()}</span>
            </InfoRow>
          )}
          {status.expiresAt && (
            <InfoRow label="Token Expires">
              <span className="text-sm">{new Date(status.expiresAt).toLocaleString()}</span>
            </InfoRow>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            MYOB Company File
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : companyData ? (
            <div className="space-y-3">
              {Array.isArray(companyData) ? (
                companyData.map((cf: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <InfoRow label="Company Name">
                      <span className="text-sm font-medium" data-testid={`text-company-name-${i}`}>{cf.Name || cf.CompanyName || "-"}</span>
                    </InfoRow>
                    {cf.SerialNumber && (
                      <InfoRow label="Serial Number">
                        <span className="text-sm font-mono">{cf.SerialNumber}</span>
                      </InfoRow>
                    )}
                  </div>
                ))
              ) : (
                <div className="space-y-1">
                  <InfoRow label="Company Name">
                    <span className="text-sm font-medium" data-testid="text-company-name">{(companyData as any).Name || (companyData as any).CompanyName || "Company data loaded"}</span>
                  </InfoRow>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Unable to load company file data. The connection may need to be re-established.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function MyobDataTable({
  endpoint,
  title,
  icon,
  columns,
  renderRow,
  searchTerm,
  onSearchChange,
}: {
  endpoint: string;
  title: string;
  icon: React.ReactNode;
  columns: string[];
  renderRow: (item: any) => React.ReactNode;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<any>({
    queryKey: [endpoint],
  });

  const items = Array.isArray(data) ? data : data?.Items || data?.items || [];

  const filtered = items.filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(term);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1" data-testid={`badge-count-${title.toLowerCase()}`}>
                {items.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 w-48"
                data-testid={`input-search-${title.toLowerCase()}`}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid={`button-refresh-${title.toLowerCase()}`}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8 space-y-2">
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message || "Failed to load data from MYOB"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry">
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "No matching records found" : `No ${title.toLowerCase()} found in MYOB`}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(renderRow)}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


interface PnlAccount {
  AccountTotal: number;
  Account: {
    UID: string;
    Name: string;
    DisplayID: string;
    URI?: string;
  };
}

interface PnlData {
  StartDate: string;
  EndDate: string;
  ReportingBasis: string;
  YearEndAdjust: boolean;
  AccountsBreakdown: PnlAccount[];
}

interface MonthlyPnlEntry {
  start: string;
  end: string;
  label: string;
  data: PnlData | null;
  error: string | null;
}

interface MonthlyPnlResponse {
  months: MonthlyPnlEntry[];
  reportingBasis: string;
  yearEndAdjust: boolean;
}

function extractMonthlyTotals(entry: MonthlyPnlEntry) {
  if (!entry.data) return { income: 0, cos: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
  const accounts = entry.data.AccountsBreakdown || [];
  const income = accounts.filter((a) => a.Account.DisplayID.startsWith("4-")).reduce((s, a) => s + a.AccountTotal, 0);
  const cos = accounts.filter((a) => a.Account.DisplayID.startsWith("5-")).reduce((s, a) => s + Math.abs(a.AccountTotal), 0);
  const grossProfit = income - cos;
  const expenses = accounts.filter((a) => {
    const d = a.Account.DisplayID;
    return d.startsWith("6-") || d.startsWith("7-") || d.startsWith("8-") || d.startsWith("9-");
  }).reduce((s, a) => s + Math.abs(a.AccountTotal), 0);
  const netProfit = grossProfit - expenses;
  return { income, cos, grossProfit, expenses, netProfit };
}

function getFinancialYearDates() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: `${year}-07-01`,
    end: `${year + 1}-06-30`,
  };
}

function getPresetDates(preset: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "this-month": {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }
    case "last-month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }
    case "this-quarter": {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      const qEnd = new Date(y, Math.floor(m / 3) * 3 + 3, 0);
      return { start: qStart.toISOString().split("T")[0], end: qEnd.toISOString().split("T")[0] };
    }
    case "this-fy": {
      const fy = getFinancialYearDates();
      return { start: fy.start, end: fy.end };
    }
    case "last-fy": {
      const fyYear = (m >= 6 ? y : y - 1) - 1;
      return { start: `${fyYear}-07-01`, end: `${fyYear + 1}-06-30` };
    }
    default:
      return getPresetDates("this-fy");
  }
}

function ProfitAndLossTab() {
  const [reportingBasis, setReportingBasis] = useState("Accrual");
  const [yearEndAdjust, setYearEndAdjust] = useState(false);
  const [monthCount, setMonthCount] = useState("12");
  const [dashboardView, setDashboardView] = useState<"dashboard" | "detailed">("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const monthlyUrl = `${MYOB_ROUTES.MONTHLY_PNL}?months=${monthCount}&reportingBasis=${reportingBasis}&yearEndAdjust=${yearEndAdjust}`;

  const { data: monthlyData, isLoading, isError, error, refetch, isFetching } = useQuery<MonthlyPnlResponse>({
    queryKey: [MYOB_ROUTES.MONTHLY_PNL, monthCount, reportingBasis, yearEndAdjust],
    queryFn: async () => {
      const res = await apiRequest("GET", monthlyUrl);
      return res.json();
    },
  });

  const months = monthlyData?.months || [];
  const monthlyTotals = months.map((m) => ({ ...extractMonthlyTotals(m), label: m.label }));

  useEffect(() => {
    if (selectedMonth !== null && selectedMonth >= months.length) {
      setSelectedMonth(null);
    }
  }, [months.length, selectedMonth]);

  const totalsAgg = monthlyTotals.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      cos: acc.cos + m.cos,
      grossProfit: acc.grossProfit + m.grossProfit,
      expenses: acc.expenses + m.expenses,
      netProfit: acc.netProfit + m.netProfit,
    }),
    { income: 0, cos: 0, grossProfit: 0, expenses: 0, netProfit: 0 }
  );

  const grossMarginPct = totalsAgg.income > 0 ? (totalsAgg.grossProfit / totalsAgg.income) * 100 : 0;
  const netMarginPct = totalsAgg.income > 0 ? (totalsAgg.netProfit / totalsAgg.income) * 100 : 0;

  const chartData = monthlyTotals.map((m) => ({
    name: m.label,
    Income: Math.round(m.income),
    Expenses: Math.round(m.cos + m.expenses),
    "Net Profit": Math.round(m.netProfit),
    "Gross Profit": Math.round(m.grossProfit),
  }));

  const marginChartData = monthlyTotals.map((m) => ({
    name: m.label,
    "Gross Margin %": m.income > 0 ? parseFloat(((m.grossProfit / m.income) * 100).toFixed(1)) : 0,
    "Net Margin %": m.income > 0 ? parseFloat(((m.netProfit / m.income) * 100).toFixed(1)) : 0,
  }));

  const expenseBreakdownData = (() => {
    const categoryMap = new Map<string, number>();
    months.forEach((m) => {
      if (!m.data) return;
      m.data.AccountsBreakdown.forEach((a) => {
        const d = a.Account.DisplayID;
        if (d.startsWith("5-") || d.startsWith("6-") || d.startsWith("7-") || d.startsWith("8-") || d.startsWith("9-")) {
          const existing = categoryMap.get(a.Account.Name) || 0;
          categoryMap.set(a.Account.Name, existing + Math.abs(a.AccountTotal));
        }
      });
    });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  })();

  const incomeBreakdownData = (() => {
    const categoryMap = new Map<string, number>();
    months.forEach((m) => {
      if (!m.data) return;
      m.data.AccountsBreakdown.forEach((a) => {
        if (a.Account.DisplayID.startsWith("4-")) {
          const existing = categoryMap.get(a.Account.Name) || 0;
          categoryMap.set(a.Account.Name, existing + a.AccountTotal);
        }
      });
    });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  })();

  const prevMonthIdx = monthlyTotals.length >= 2 ? monthlyTotals.length - 2 : null;
  const currMonthIdx = monthlyTotals.length >= 1 ? monthlyTotals.length - 1 : null;
  const momChange = prevMonthIdx !== null && currMonthIdx !== null && monthlyTotals[prevMonthIdx].income > 0
    ? ((monthlyTotals[currMonthIdx].netProfit - monthlyTotals[prevMonthIdx].netProfit) / Math.abs(monthlyTotals[prevMonthIdx].netProfit || 1)) * 100
    : null;

  const selectedMonthData = selectedMonth !== null && months[selectedMonth]?.data ? months[selectedMonth].data : null;

  const detailAccounts = selectedMonthData?.AccountsBreakdown || [];
  const detailIncome = detailAccounts.filter((a) => a.Account.DisplayID.startsWith("4-"));
  const detailCos = detailAccounts.filter((a) => a.Account.DisplayID.startsWith("5-"));
  const detailExpenses = detailAccounts.filter((a) => {
    const d = a.Account.DisplayID;
    return d.startsWith("6-") || d.startsWith("7-") || d.startsWith("8-") || d.startsWith("9-");
  });

  const filterAccounts = (list: PnlAccount[]) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (a) => a.Account.Name.toLowerCase().includes(term) || a.Account.DisplayID.toLowerCase().includes(term)
    );
  };

  const COLORS = [
    "hsl(210, 70%, 50%)", "hsl(160, 60%, 45%)", "hsl(30, 80%, 55%)", "hsl(340, 65%, 50%)",
    "hsl(270, 55%, 55%)", "hsl(190, 65%, 45%)", "hsl(50, 75%, 50%)", "hsl(0, 65%, 50%)",
    "hsl(120, 40%, 45%)", "hsl(240, 50%, 55%)",
  ];

  const renderAccountTable = (title: string, sectionAccounts: PnlAccount[], total: number, variant: "income" | "expense" | "neutral") => {
    const filtered = filterAccounts(sectionAccounts);
    if (sectionAccounts.length === 0 && !searchTerm) return null;
    return (
      <div className="space-y-2" data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <div className="flex items-center justify-between gap-2 py-2 border-b flex-wrap">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className={`font-mono font-semibold text-sm ${variant === "income" ? "text-green-600 dark:text-green-400" : variant === "expense" ? "text-red-600 dark:text-red-400" : ""}`}>
            {formatCurrency(total)}
          </span>
        </div>
        {filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Account #</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right w-36">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.Account.UID} data-testid={`row-pnl-${a.Account.DisplayID}`}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{a.Account.DisplayID}</TableCell>
                  <TableCell className="text-sm">{a.Account.Name}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${a.AccountTotal < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {formatCurrency(a.AccountTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : searchTerm ? (
          <p className="text-sm text-muted-foreground py-2">No matching accounts</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Financial Dashboard
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 border rounded-md p-0.5">
                <Button
                  variant={dashboardView === "dashboard" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDashboardView("dashboard")}
                  data-testid="button-view-dashboard"
                >
                  Dashboard
                </Button>
                <Button
                  variant={dashboardView === "detailed" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDashboardView("detailed")}
                  data-testid="button-view-detailed"
                >
                  Detailed P&L
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-pnl"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <Select value={monthCount} onValueChange={setMonthCount}>
                <SelectTrigger className="w-36" data-testid="select-month-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Last 3 months</SelectItem>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                  <SelectItem value="18">Last 18 months</SelectItem>
                  <SelectItem value="24">Last 24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Basis</Label>
              <Select value={reportingBasis} onValueChange={setReportingBasis}>
                <SelectTrigger className="w-28" data-testid="select-reporting-basis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Accrual">Accrual</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <input
                type="checkbox"
                id="year-end-adjust"
                checked={yearEndAdjust}
                onChange={(e) => setYearEndAdjust(e.target.checked)}
                className="rounded border-input"
                data-testid="checkbox-year-end-adjust"
              />
              <Label htmlFor="year-end-adjust" className="text-sm cursor-pointer">Year-end adjustments</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-4 pb-3"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card><CardContent className="py-6"><Skeleton className="h-72 w-full" /></CardContent></Card>
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message || "Failed to load financial data from MYOB"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-pnl">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : dashboardView === "dashboard" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Card data-testid="card-total-income">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-lg font-bold font-mono mt-1 text-green-600 dark:text-green-400">{formatCurrency(totalsAgg.income)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Avg {formatCurrency(monthlyTotals.length > 0 ? totalsAgg.income / monthlyTotals.length : 0)}/mo
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-total-expenses">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Total Costs & Expenses</p>
                <p className="text-lg font-bold font-mono mt-1 text-red-600 dark:text-red-400">{formatCurrency(totalsAgg.cos + totalsAgg.expenses)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Avg {formatCurrency(monthlyTotals.length > 0 ? (totalsAgg.cos + totalsAgg.expenses) / monthlyTotals.length : 0)}/mo
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-gross-profit">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Gross Profit</p>
                <p className={`text-lg font-bold font-mono mt-1 ${totalsAgg.grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(totalsAgg.grossProfit)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Margin: {grossMarginPct.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-net-profit">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Net Profit</p>
                <p className={`text-lg font-bold font-mono mt-1 ${totalsAgg.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(totalsAgg.netProfit)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Margin: {netMarginPct.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-mom-change">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">MoM Change</p>
                {momChange !== null ? (
                  <>
                    <div className="flex items-center gap-1 mt-1">
                      {momChange >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <p className={`text-lg font-bold font-mono ${momChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {momChange >= 0 ? "+" : ""}{momChange.toFixed(1)}%
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Net profit vs prior month</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Insufficient data</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card data-testid="chart-revenue-expenses">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="Income" fill="hsl(142, 60%, 45%)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Expenses" fill="hsl(0, 65%, 50%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-net-profit-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(210, 70%, 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Area type="monotone" dataKey="Net Profit" stroke="hsl(210, 70%, 50%)" fill="url(#gradProfit)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Gross Profit" stroke="hsl(142, 60%, 45%)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card data-testid="chart-margin-analysis">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Margin Analysis (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={marginChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Line type="monotone" dataKey="Gross Margin %" stroke="hsl(142, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Net Margin %" stroke="hsl(210, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-expense-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseBreakdownData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={120} />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {expenseBreakdownData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card data-testid="card-income-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Income Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeBreakdownData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={120} />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {incomeBreakdownData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-monthly-summary-table">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sticky top-0 bg-card">Month</TableHead>
                        <TableHead className="text-xs text-right sticky top-0 bg-card">Revenue</TableHead>
                        <TableHead className="text-xs text-right sticky top-0 bg-card">Expenses</TableHead>
                        <TableHead className="text-xs text-right sticky top-0 bg-card">Net Profit</TableHead>
                        <TableHead className="text-xs text-right sticky top-0 bg-card">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyTotals.map((m, idx) => (
                        <TableRow
                          key={idx}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => { setSelectedMonth(idx); setDashboardView("detailed"); }}
                          data-testid={`row-month-${idx}`}
                        >
                          <TableCell className="text-xs font-medium">{m.label}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-green-600 dark:text-green-400">{formatCurrency(m.income)}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(m.cos + m.expenses)}</TableCell>
                          <TableCell className={`text-xs text-right font-mono ${m.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatCurrency(m.netProfit)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {m.income > 0 ? `${((m.netProfit / m.income) * 100).toFixed(1)}%` : "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 font-semibold bg-muted/30">
                        <TableCell className="text-xs font-bold">Total</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-green-600 dark:text-green-400">{formatCurrency(totalsAgg.income)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-red-600 dark:text-red-400">{formatCurrency(totalsAgg.cos + totalsAgg.expenses)}</TableCell>
                        <TableCell className={`text-xs text-right font-mono font-bold ${totalsAgg.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(totalsAgg.netProfit)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold">{netMarginPct.toFixed(1)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Select Month</Label>
              <Select
                value={selectedMonth !== null ? String(selectedMonth) : ""}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-48" data-testid="select-detail-month">
                  <SelectValue placeholder="Choose a month..." />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-pnl"
              />
            </div>
          </div>

          {selectedMonthData ? (
            <>
              {(() => {
                const t = extractMonthlyTotals(months[selectedMonth!]);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground">Income</p>
                        <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400">{formatCurrency(t.income)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground">Cost of Sales</p>
                        <p className="text-lg font-bold font-mono">{formatCurrency(t.cos)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground">Gross Profit</p>
                        <p className={`text-lg font-bold font-mono ${t.grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(t.grossProfit)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground">Net Profit</p>
                        <p className={`text-lg font-bold font-mono ${t.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(t.netProfit)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              <Card>
                <CardContent className="pt-4 space-y-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{months[selectedMonth!].label}</span>
                    <Badge variant="secondary" className="text-xs">{reportingBasis}</Badge>
                    <Badge variant="secondary" className="text-xs">{detailAccounts.length} accounts</Badge>
                  </div>

                  {renderAccountTable("Income", detailIncome, detailIncome.reduce((s, a) => s + a.AccountTotal, 0), "income")}
                  {renderAccountTable("Cost of Sales", detailCos, detailCos.reduce((s, a) => s + Math.abs(a.AccountTotal), 0), "neutral")}

                  <div className="flex items-center justify-between gap-2 py-2 border-y bg-muted/30 px-2 rounded-md flex-wrap">
                    <span className="font-semibold text-sm">Gross Profit</span>
                    <span className={`font-mono font-bold text-sm ${extractMonthlyTotals(months[selectedMonth!]).grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(extractMonthlyTotals(months[selectedMonth!]).grossProfit)}
                    </span>
                  </div>

                  {renderAccountTable("Operating Expenses", detailExpenses, detailExpenses.reduce((s, a) => s + Math.abs(a.AccountTotal), 0), "expense")}

                  <div className="flex items-center justify-between gap-2 py-3 border-t-2 border-foreground/20 flex-wrap">
                    <span className="font-bold text-base">Net Profit / (Loss)</span>
                    <span className={`font-mono font-bold text-base ${extractMonthlyTotals(months[selectedMonth!]).netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(extractMonthlyTotals(months[selectedMonth!]).netProfit)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Select a month from the dropdown above to view its detailed P&L breakdown</p>
                <p className="text-xs text-muted-foreground mt-1">Or click on a row in the Monthly Summary table from the Dashboard view</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

interface ExportLogEntry {
  id: number;
  invoiceId: string;
  status: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  totalAmount: string | null;
  errorMessage: string | null;
  exportedAt: string;
  userName: string | null;
}

function CodeMappingTab() {
  const { toast } = useToast();
  const [mappingSubTab, setMappingSubTab] = useState<"accounts" | "suppliers" | "tax" | "jobs">("accounts");
  const [searchFilter, setSearchFilter] = useState("");

  const { data: myobAccounts } = useQuery<any>({
    queryKey: [MYOB_ROUTES.ACCOUNTS],
  });

  const { data: myobTaxCodes } = useQuery<any>({
    queryKey: [MYOB_ROUTES.TAX_CODES],
  });

  const { data: myobSuppliers } = useQuery<any>({
    queryKey: [MYOB_ROUTES.SUPPLIERS],
  });

  const { data: accountMappings, isLoading: acctLoading } = useQuery<any[]>({
    queryKey: [MYOB_ROUTES.ACCOUNT_MAPPINGS],
  });

  const { data: supplierMappings, isLoading: supLoading } = useQuery<any[]>({
    queryKey: [MYOB_ROUTES.SUPPLIER_MAPPINGS],
  });

  const { data: taxCodeMappings, isLoading: taxLoading } = useQuery<any[]>({
    queryKey: [MYOB_ROUTES.TAX_CODE_MAPPINGS],
  });

  const { data: bpCostCodes } = useQuery<any[]>({
    queryKey: ["/api/cost-codes"],
  });

  const { data: bpSuppliers } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: myobJobs } = useQuery<any>({
    queryKey: [MYOB_ROUTES.JOBS],
  });

  const { data: bpJobMappings, isLoading: jobMappingsLoading } = useQuery<any[]>({
    queryKey: [MYOB_ROUTES.JOB_MAPPINGS],
  });

  const autoMapMutation = useMutation({
    mutationFn: () => apiRequest("POST", MYOB_ROUTES.AUTO_MAP),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.ACCOUNT_MAPPINGS] });
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.SUPPLIER_MAPPINGS] });
      toast({
        title: "Auto-mapping complete",
        description: `Mapped ${data.accountsMapped} accounts, ${data.suppliersMapped} suppliers by name matching.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Auto-mapping failed", description: err.message, variant: "destructive" });
    },
  });

  const saveAccountMappingMutation = useMutation({
    mutationFn: (data: { costCodeId: string; myobAccountUid: string; myobAccountName: string; myobAccountDisplayId: string }) =>
      apiRequest("POST", MYOB_ROUTES.ACCOUNT_MAPPINGS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.ACCOUNT_MAPPINGS] });
      toast({ title: "Account mapping saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save mapping", description: err.message, variant: "destructive" });
    },
  });

  const deleteAccountMappingMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${MYOB_ROUTES.ACCOUNT_MAPPINGS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.ACCOUNT_MAPPINGS] });
      toast({ title: "Account mapping removed" });
    },
  });

  const saveSupplierMappingMutation = useMutation({
    mutationFn: (data: { supplierId: string; myobSupplierUid: string; myobSupplierName: string; myobSupplierDisplayId: string }) =>
      apiRequest("POST", MYOB_ROUTES.SUPPLIER_MAPPINGS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.SUPPLIER_MAPPINGS] });
      toast({ title: "Supplier mapping saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save mapping", description: err.message, variant: "destructive" });
    },
  });

  const deleteSupplierMappingMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${MYOB_ROUTES.SUPPLIER_MAPPINGS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.SUPPLIER_MAPPINGS] });
      toast({ title: "Supplier mapping removed" });
    },
  });

  const saveTaxMappingMutation = useMutation({
    mutationFn: (data: { bpTaxCode: string; myobTaxCodeUid: string; myobTaxCodeName: string; myobTaxCodeCode: string }) =>
      apiRequest("POST", MYOB_ROUTES.TAX_CODE_MAPPINGS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.TAX_CODE_MAPPINGS] });
      toast({ title: "Tax code mapping saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save mapping", description: err.message, variant: "destructive" });
    },
  });

  const deleteTaxMappingMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${MYOB_ROUTES.TAX_CODE_MAPPINGS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.TAX_CODE_MAPPINGS] });
      toast({ title: "Tax code mapping removed" });
    },
  });

  const saveJobMappingMutation = useMutation({
    mutationFn: (data: { jobId: string; myobJobUid: string }) =>
      apiRequest("POST", MYOB_ROUTES.JOB_MAPPINGS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.JOB_MAPPINGS] });
      toast({ title: "Job linked to MYOB" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to link job", description: err.message, variant: "destructive" });
    },
  });

  const deleteJobMappingMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest("DELETE", `${MYOB_ROUTES.JOB_MAPPINGS}/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MYOB_ROUTES.JOB_MAPPINGS] });
      toast({ title: "Job MYOB link removed" });
    },
  });

  const myobAccountItems: any[] = myobAccounts?.Items || [];
  const myobSupplierItems: any[] = myobSuppliers?.Items || [];
  const myobTaxCodeItems: any[] = myobTaxCodes?.Items || [];
  const myobJobItems: any[] = myobJobs?.Items || [];

  const acctMappingList: any[] = accountMappings || [];
  const supMappingList: any[] = supplierMappings || [];
  const taxMappingList: any[] = taxCodeMappings || [];
  const jobMappingList: any[] = bpJobMappings || [];

  const mappedAccountCount = acctMappingList.length;
  const mappedSupplierCount = supMappingList.length;
  const mappedTaxCount = taxMappingList.length;
  const mappedJobCount = jobMappingList.filter((j: any) => j.myobJobUid).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Code Mapping
            </CardTitle>
            <CardDescription>
              Map BuildPlus cost codes, suppliers, and tax codes to their MYOB equivalents for invoice export.
              Multiple BuildPlus codes can map to the same MYOB account.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => autoMapMutation.mutate()}
            disabled={autoMapMutation.isPending}
            data-testid="button-auto-map"
          >
            {autoMapMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Auto-Map by Name
          </Button>
        </div>
        <div className="flex gap-4 mt-4">
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" /> Accounts: {mappedAccountCount} mapped
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Truck className="h-3 w-3" /> Suppliers: {mappedSupplierCount} mapped
          </Badge>
          <Badge variant="outline" className="gap-1">
            <DollarSign className="h-3 w-3" /> Tax Codes: {mappedTaxCount} mapped
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Briefcase className="h-3 w-3" /> Jobs: {mappedJobCount} linked
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={mappingSubTab === "accounts" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMappingSubTab("accounts"); setSearchFilter(""); }}
            data-testid="button-mapping-accounts"
          >
            Account Mapping ({mappedAccountCount})
          </Button>
          <Button
            variant={mappingSubTab === "suppliers" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMappingSubTab("suppliers"); setSearchFilter(""); }}
            data-testid="button-mapping-suppliers"
          >
            Supplier Mapping ({mappedSupplierCount})
          </Button>
          <Button
            variant={mappingSubTab === "tax" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMappingSubTab("tax"); setSearchFilter(""); }}
            data-testid="button-mapping-tax"
          >
            Tax Code Mapping ({mappedTaxCount})
          </Button>
          <Button
            variant={mappingSubTab === "jobs" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMappingSubTab("jobs"); setSearchFilter(""); }}
            data-testid="button-mapping-jobs"
          >
            Job Mapping ({mappedJobCount})
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search mappings..."
            className="pl-9"
            data-testid="input-mapping-search"
          />
        </div>

        {mappingSubTab === "accounts" && (
          <AccountMappingTable
            mappings={acctMappingList}
            myobAccounts={myobAccountItems}
            bpCostCodes={bpCostCodes || []}
            isLoading={acctLoading}
            searchFilter={searchFilter}
            onSave={(data) => saveAccountMappingMutation.mutate(data)}
            onDelete={(id) => deleteAccountMappingMutation.mutate(id)}
            isSaving={saveAccountMappingMutation.isPending}
          />
        )}

        {mappingSubTab === "suppliers" && (
          <SupplierMappingTable
            mappings={supMappingList}
            myobSuppliers={myobSupplierItems}
            bpSuppliers={bpSuppliers || []}
            isLoading={supLoading}
            searchFilter={searchFilter}
            onSave={(data) => saveSupplierMappingMutation.mutate(data)}
            onDelete={(id) => deleteSupplierMappingMutation.mutate(id)}
            isSaving={saveSupplierMappingMutation.isPending}
          />
        )}

        {mappingSubTab === "tax" && (
          <TaxCodeMappingTable
            mappings={taxMappingList}
            myobTaxCodes={myobTaxCodeItems}
            isLoading={taxLoading}
            searchFilter={searchFilter}
            onSave={(data) => saveTaxMappingMutation.mutate(data)}
            onDelete={(id) => deleteTaxMappingMutation.mutate(id)}
            isSaving={saveTaxMappingMutation.isPending}
          />
        )}

        {mappingSubTab === "jobs" && (
          <JobMappingTable
            bpJobs={jobMappingList}
            myobJobs={myobJobItems}
            isLoading={jobMappingsLoading}
            searchFilter={searchFilter}
            onLink={(data) => saveJobMappingMutation.mutate(data)}
            onUnlink={(jobId) => deleteJobMappingMutation.mutate(jobId)}
            isSaving={saveJobMappingMutation.isPending}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AccountMappingTable({ mappings, myobAccounts, bpCostCodes, isLoading, searchFilter, onSave, onDelete, isSaving }: {
  mappings: any[];
  myobAccounts: any[];
  bpCostCodes: any[];
  isLoading: boolean;
  searchFilter: string;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [selectedMyobAccount, setSelectedMyobAccount] = useState<string>("");
  const [newCostCodeId, setNewCostCodeId] = useState("");
  const [newMyobAccountUid, setNewMyobAccountUid] = useState("");

  const mappedCostCodeIds = new Set(mappings.map((m) => m.mapping?.costCodeId));
  const unmappedCostCodes = bpCostCodes.filter((cc: any) => cc.isActive !== false && !mappedCostCodeIds.has(cc.id));

  const filtered = mappings.filter((m) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    const code = m.costCode?.code?.toLowerCase() || "";
    const name = m.costCode?.name?.toLowerCase() || "";
    const myobName = m.mapping?.myobAccountName?.toLowerCase() || "";
    const myobId = m.mapping?.myobAccountDisplayId?.toLowerCase() || "";
    return code.includes(term) || name.includes(term) || myobName.includes(term) || myobId.includes(term);
  });

  if (isLoading) return <div className="flex items-center gap-2 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading mappings...</div>;

  return (
    <div className="space-y-4">
      {unmappedCostCodes.length > 0 && myobAccounts.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border">
          <p className="text-sm font-medium mb-2">Add Account Mapping</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label className="text-xs">BuildPlus Cost Code</Label>
              <Select value={newCostCodeId} onValueChange={setNewCostCodeId}>
                <SelectTrigger className="w-[250px]" data-testid="select-new-cost-code">
                  <SelectValue placeholder="Select cost code" />
                </SelectTrigger>
                <SelectContent>
                  {unmappedCostCodes.map((cc: any) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">MYOB Account</Label>
              <Select value={newMyobAccountUid} onValueChange={setNewMyobAccountUid}>
                <SelectTrigger className="w-[250px]" data-testid="select-new-myob-account">
                  <SelectValue placeholder="Select MYOB account" />
                </SelectTrigger>
                <SelectContent>
                  {myobAccounts.filter((a: any) => a.IsActive !== false).map((a: any) => (
                    <SelectItem key={a.UID} value={a.UID}>
                      {a.DisplayID} - {a.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!newCostCodeId || !newMyobAccountUid || isSaving}
              onClick={() => {
                const acct = myobAccounts.find((a: any) => a.UID === newMyobAccountUid);
                if (acct) {
                  onSave({
                    costCodeId: newCostCodeId,
                    myobAccountUid: acct.UID,
                    myobAccountName: acct.Name,
                    myobAccountDisplayId: acct.DisplayID,
                  });
                  setNewCostCodeId("");
                  setNewMyobAccountUid("");
                }
              }}
              data-testid="button-add-acct-mapping"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{unmappedCostCodes.length} unmapped cost codes remaining</p>
        </div>
      )}

      <div className="rounded-md border overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BuildPlus Code</TableHead>
              <TableHead>BuildPlus Name</TableHead>
              <TableHead>MYOB Account</TableHead>
              <TableHead>MYOB Name</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {mappings.length === 0
                    ? "No account mappings yet. Click 'Auto-Map by Name' to get started, then adjust as needed."
                    : "No mappings match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.mapping.id} data-testid={`row-acct-mapping-${m.mapping.id}`}>
                  <TableCell className="font-mono text-sm">{m.costCode?.code || "-"}</TableCell>
                  <TableCell>{m.costCode?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {editingRow === m.mapping.id ? (
                      <Select
                        value={selectedMyobAccount}
                        onValueChange={setSelectedMyobAccount}
                      >
                        <SelectTrigger className="w-[250px]" data-testid={`select-myob-account-${m.mapping.id}`}>
                          <SelectValue placeholder="Select MYOB account" />
                        </SelectTrigger>
                        <SelectContent>
                          {myobAccounts.filter((a: any) => a.IsActive !== false).map((a: any) => (
                            <SelectItem key={a.UID} value={a.UID}>
                              {a.DisplayID} - {a.Name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      m.mapping.myobAccountDisplayId || "-"
                    )}
                  </TableCell>
                  <TableCell>{editingRow === m.mapping.id ? "" : (m.mapping.myobAccountName || "-")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.mapping.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingRow === m.mapping.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!selectedMyobAccount || isSaving}
                            onClick={() => {
                              const acct = myobAccounts.find((a: any) => a.UID === selectedMyobAccount);
                              if (acct) {
                                onSave({
                                  costCodeId: m.mapping.costCodeId,
                                  myobAccountUid: acct.UID,
                                  myobAccountName: acct.Name,
                                  myobAccountDisplayId: acct.DisplayID,
                                });
                                setEditingRow(null);
                              }
                            }}
                            data-testid={`button-save-acct-${m.mapping.id}`}
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRow(null)} data-testid={`button-cancel-acct-${m.mapping.id}`}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingRow(m.mapping.id);
                              setSelectedMyobAccount(m.mapping.myobAccountUid || "");
                            }}
                            data-testid={`button-edit-acct-${m.mapping.id}`}
                          >
                            <ClipboardList className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => onDelete(m.mapping.id)}
                            data-testid={`button-delete-acct-${m.mapping.id}`}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {myobAccounts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {myobAccounts.filter((a: any) => a.IsActive !== false).length} MYOB accounts available for mapping
        </p>
      )}
    </div>
  );
}

function SupplierMappingTable({ mappings, myobSuppliers, bpSuppliers, isLoading, searchFilter, onSave, onDelete, isSaving }: {
  mappings: any[];
  myobSuppliers: any[];
  bpSuppliers: any[];
  isLoading: boolean;
  searchFilter: string;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [selectedMyobSupplier, setSelectedMyobSupplier] = useState<string>("");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newMyobSupplierUid, setNewMyobSupplierUid] = useState("");

  const mappedSupplierIds = new Set(mappings.map((m) => m.mapping?.supplierId));
  const unmappedSuppliers = bpSuppliers.filter((s: any) => s.isActive !== false && !mappedSupplierIds.has(s.id));

  const filtered = mappings.filter((m) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    const name = m.supplier?.name?.toLowerCase() || "";
    const myobName = m.mapping?.myobSupplierName?.toLowerCase() || "";
    return name.includes(term) || myobName.includes(term);
  });

  if (isLoading) return <div className="flex items-center gap-2 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading mappings...</div>;

  return (
    <div className="space-y-4">
      {unmappedSuppliers.length > 0 && myobSuppliers.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border">
          <p className="text-sm font-medium mb-2">Add Supplier Mapping</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label className="text-xs">BuildPlus Supplier</Label>
              <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                <SelectTrigger className="w-[250px]" data-testid="select-new-bp-supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {unmappedSuppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">MYOB Supplier</Label>
              <Select value={newMyobSupplierUid} onValueChange={setNewMyobSupplierUid}>
                <SelectTrigger className="w-[250px]" data-testid="select-new-myob-supplier">
                  <SelectValue placeholder="Select MYOB supplier" />
                </SelectTrigger>
                <SelectContent>
                  {myobSuppliers.filter((s: any) => s.IsActive !== false).map((s: any) => (
                    <SelectItem key={s.UID} value={s.UID}>
                      {s.CompanyName || s.Name || `${s.FirstName || ""} ${s.LastName || ""}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!newSupplierId || !newMyobSupplierUid || isSaving}
              onClick={() => {
                const sup = myobSuppliers.find((s: any) => s.UID === newMyobSupplierUid);
                if (sup) {
                  onSave({
                    supplierId: newSupplierId,
                    myobSupplierUid: sup.UID,
                    myobSupplierName: sup.CompanyName || sup.Name || "",
                    myobSupplierDisplayId: sup.DisplayID || "",
                  });
                  setNewSupplierId("");
                  setNewMyobSupplierUid("");
                }
              }}
              data-testid="button-add-sup-mapping"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{unmappedSuppliers.length} unmapped suppliers remaining</p>
        </div>
      )}

      <div className="rounded-md border overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BuildPlus Supplier</TableHead>
              <TableHead>MYOB Supplier</TableHead>
              <TableHead>MYOB Display ID</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {mappings.length === 0
                    ? "No supplier mappings yet. Click 'Auto-Map by Name' to get started."
                    : "No mappings match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.mapping.id} data-testid={`row-sup-mapping-${m.mapping.id}`}>
                  <TableCell>{m.supplier?.name || "-"}</TableCell>
                  <TableCell>
                    {editingRow === m.mapping.id ? (
                      <Select
                        value={selectedMyobSupplier}
                        onValueChange={setSelectedMyobSupplier}
                      >
                        <SelectTrigger className="w-[250px]" data-testid={`select-myob-supplier-${m.mapping.id}`}>
                          <SelectValue placeholder="Select MYOB supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {myobSuppliers.filter((s: any) => s.IsActive !== false).map((s: any) => (
                            <SelectItem key={s.UID} value={s.UID}>
                              {s.CompanyName || s.Name || `${s.FirstName || ""} ${s.LastName || ""}`.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      m.mapping.myobSupplierName || "-"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{editingRow === m.mapping.id ? "" : (m.mapping.myobSupplierDisplayId || "-")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.mapping.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingRow === m.mapping.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!selectedMyobSupplier || isSaving}
                            onClick={() => {
                              const sup = myobSuppliers.find((s: any) => s.UID === selectedMyobSupplier);
                              if (sup) {
                                onSave({
                                  supplierId: m.mapping.supplierId,
                                  myobSupplierUid: sup.UID,
                                  myobSupplierName: sup.CompanyName || sup.Name || "",
                                  myobSupplierDisplayId: sup.DisplayID || "",
                                });
                                setEditingRow(null);
                              }
                            }}
                            data-testid={`button-save-sup-${m.mapping.id}`}
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRow(null)}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingRow(m.mapping.id);
                              setSelectedMyobSupplier(m.mapping.myobSupplierUid || "");
                            }}
                            data-testid={`button-edit-sup-${m.mapping.id}`}
                          >
                            <ClipboardList className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => onDelete(m.mapping.id)}
                            data-testid={`button-delete-sup-${m.mapping.id}`}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TaxCodeMappingTable({ mappings, myobTaxCodes, isLoading, searchFilter, onSave, onDelete, isSaving }: {
  mappings: any[];
  myobTaxCodes: any[];
  isLoading: boolean;
  searchFilter: string;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [selectedMyobTax, setSelectedMyobTax] = useState<string>("");
  const [newBpTaxCode, setNewBpTaxCode] = useState("");
  const [newMyobTaxUid, setNewMyobTaxUid] = useState("");

  const filtered = mappings.filter((m) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return (m.bpTaxCode?.toLowerCase() || "").includes(term) ||
      (m.myobTaxCodeName?.toLowerCase() || "").includes(term) ||
      (m.myobTaxCodeCode?.toLowerCase() || "").includes(term);
  });

  if (isLoading) return <div className="flex items-center gap-2 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading mappings...</div>;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg border">
        <p className="text-sm font-medium mb-2">Add Tax Code Mapping</p>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">BuildPlus Tax Code</Label>
            <Input
              value={newBpTaxCode}
              onChange={(e) => setNewBpTaxCode(e.target.value)}
              placeholder="e.g. GST, FRE, N-T"
              className="w-[160px]"
              data-testid="input-new-bp-tax"
            />
          </div>
          <div>
            <Label className="text-xs">MYOB Tax Code</Label>
            <Select value={newMyobTaxUid} onValueChange={setNewMyobTaxUid}>
              <SelectTrigger className="w-[250px]" data-testid="select-new-myob-tax">
                <SelectValue placeholder="Select MYOB tax code" />
              </SelectTrigger>
              <SelectContent>
                {myobTaxCodes.map((t: any) => (
                  <SelectItem key={t.UID} value={t.UID}>
                    {t.Code} - {t.Description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!newBpTaxCode || !newMyobTaxUid || isSaving}
            onClick={() => {
              const taxCode = myobTaxCodes.find((t: any) => t.UID === newMyobTaxUid);
              if (taxCode) {
                onSave({
                  bpTaxCode: newBpTaxCode.trim(),
                  myobTaxCodeUid: taxCode.UID,
                  myobTaxCodeName: taxCode.Description || taxCode.Name || "",
                  myobTaxCodeCode: taxCode.Code || "",
                });
                setNewBpTaxCode("");
                setNewMyobTaxUid("");
              }
            }}
            data-testid="button-add-tax-mapping"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BuildPlus Tax Code</TableHead>
              <TableHead>MYOB Code</TableHead>
              <TableHead>MYOB Description</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No tax code mappings yet. Add one above.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id} data-testid={`row-tax-mapping-${m.id}`}>
                  <TableCell className="font-mono">{m.bpTaxCode}</TableCell>
                  <TableCell className="font-mono">
                    {editingRow === m.id ? (
                      <Select value={selectedMyobTax} onValueChange={setSelectedMyobTax}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select MYOB tax code" />
                        </SelectTrigger>
                        <SelectContent>
                          {myobTaxCodes.map((t: any) => (
                            <SelectItem key={t.UID} value={t.UID}>
                              {t.Code} - {t.Description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      m.myobTaxCodeCode || "-"
                    )}
                  </TableCell>
                  <TableCell>{editingRow === m.id ? "" : (m.myobTaxCodeName || "-")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingRow === m.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!selectedMyobTax || isSaving}
                            onClick={() => {
                              const tc = myobTaxCodes.find((t: any) => t.UID === selectedMyobTax);
                              if (tc) {
                                onSave({
                                  bpTaxCode: m.bpTaxCode,
                                  myobTaxCodeUid: tc.UID,
                                  myobTaxCodeName: tc.Description || tc.Name || "",
                                  myobTaxCodeCode: tc.Code || "",
                                });
                                setEditingRow(null);
                              }
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRow(null)}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingRow(m.id);
                              setSelectedMyobTax(m.myobTaxCodeUid || "");
                            }}
                          >
                            <ClipboardList className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => onDelete(m.id)}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ExportLogTable() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ExportLogEntry[]>({
    queryKey: [MYOB_ROUTES.EXPORT_LOGS],
  });

  const logs = data || [];
  const filtered = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.invoiceNumber || "").toLowerCase().includes(term) ||
      (log.supplierName || "").toLowerCase().includes(term) ||
      (log.userName || "").toLowerCase().includes(term) ||
      log.status.toLowerCase().includes(term)
    );
  });

  const successCount = logs.filter((l) => l.status === "SUCCESS").length;
  const failedCount = logs.filter((l) => l.status === "FAILED").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Export Log
            {logs.length > 0 && (
              <Badge variant="secondary" className="ml-1" data-testid="badge-count-export-log">
                {logs.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <div className="flex items-center gap-1.5 mr-2">
                <Badge variant="default" className="gap-1" data-testid="badge-success-count">
                  <CheckCircle2 className="h-3 w-3" />
                  {successCount}
                </Badge>
                {failedCount > 0 && (
                  <Badge variant="destructive" className="gap-1" data-testid="badge-failed-count">
                    <XCircle className="h-3 w-3" />
                    {failedCount}
                  </Badge>
                )}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-48"
                data-testid="input-search-export-log"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-export-log"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8 space-y-2">
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message || "Failed to load export logs"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-export-log">
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "No matching export records found" : "No invoices have been exported to MYOB yet"}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Exported By</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id} data-testid={`row-export-log-${log.id}`}>
                    <TableCell>
                      <Badge
                        variant={log.status === "SUCCESS" ? "default" : "destructive"}
                        className="gap-1"
                        data-testid={`badge-export-status-${log.id}`}
                      >
                        {log.status === "SUCCESS" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm" data-testid={`text-export-invoice-${log.id}`}>
                      {log.invoiceNumber || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-export-supplier-${log.id}`}>
                      {log.supplierName || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {log.totalAmount != null
                        ? `$${Number(log.totalAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                        : "-"}
                    </TableCell>
                    <TableCell>{log.userName || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.exportedAt).toLocaleString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-destructive" title={log.errorMessage || undefined}>
                      {log.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobMappingTable({ bpJobs, myobJobs, isLoading, searchFilter, onLink, onUnlink, isSaving }: {
  bpJobs: any[];
  myobJobs: any[];
  isLoading: boolean;
  searchFilter: string;
  onLink: (data: { jobId: string; myobJobUid: string }) => void;
  onUnlink: (jobId: string) => void;
  isSaving: boolean;
}) {
  const [selectedMyobJob, setSelectedMyobJob] = useState<string>("");
  const [linkingJobId, setLinkingJobId] = useState<string | null>(null);

  const filtered = bpJobs.filter((j) => {
    const term = searchFilter.toLowerCase();
    if (!term) return true;
    return (
      (j.jobNumber || "").toLowerCase().includes(term) ||
      (j.name || "").toLowerCase().includes(term) ||
      (j.myobJobUid || "").toLowerCase().includes(term)
    );
  });

  const linkedJobs = filtered.filter((j) => j.myobJobUid);
  const unlinkedJobs = filtered.filter((j) => !j.myobJobUid);

  const usedMyobUids = new Set(bpJobs.filter((j) => j.myobJobUid).map((j) => j.myobJobUid));
  const availableMyobJobs = myobJobs.filter((mj: any) => !usedMyobUids.has(mj.UID));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-2">Linked Jobs ({linkedJobs.length})</p>
        {linkedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No BuildPlus jobs are linked to MYOB jobs yet. Use the table below to link them.</p>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>MYOB Job</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedJobs.map((j) => {
                  const myobJob = myobJobs.find((mj: any) => mj.UID === j.myobJobUid);
                  return (
                    <TableRow key={j.id} data-testid={`row-job-linked-${j.id}`}>
                      <TableCell className="font-mono text-sm">{j.jobNumber}</TableCell>
                      <TableCell>{j.name}</TableCell>
                      <TableCell className="text-sm">
                        {myobJob ? `${myobJob.Number || ""} - ${myobJob.Name || ""}` : j.myobJobUid}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onUnlink(j.id)}
                          data-testid={`button-unlink-job-${j.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Unlinked BuildPlus Jobs ({unlinkedJobs.length})</p>
        {unlinkedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">All jobs are linked to MYOB.</p>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Link to MYOB Job</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedJobs.map((j) => (
                  <TableRow key={j.id} data-testid={`row-job-unlinked-${j.id}`}>
                    <TableCell className="font-mono text-sm">{j.jobNumber}</TableCell>
                    <TableCell>{j.name}</TableCell>
                    <TableCell>
                      {linkingJobId === j.id ? (
                        <Select value={selectedMyobJob} onValueChange={setSelectedMyobJob}>
                          <SelectTrigger className="w-[280px]" data-testid={`select-myob-job-${j.id}`}>
                            <SelectValue placeholder="Select MYOB job..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMyobJobs.map((mj: any) => (
                              <SelectItem key={mj.UID} value={mj.UID}>
                                {mj.Number ? `${mj.Number} - ` : ""}{mj.Name || mj.UID}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setLinkingJobId(j.id); setSelectedMyobJob(""); }}
                          data-testid={`button-start-link-${j.id}`}
                        >
                          <Link2 className="h-4 w-4 mr-1" /> Link
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {linkingJobId === j.id && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="default"
                            disabled={!selectedMyobJob || isSaving}
                            onClick={() => {
                              onLink({ jobId: j.id, myobJobUid: selectedMyobJob });
                              setLinkingJobId(null);
                              setSelectedMyobJob("");
                            }}
                            data-testid={`button-confirm-link-${j.id}`}
                          >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setLinkingJobId(null); setSelectedMyobJob(""); }}
                            data-testid={`button-cancel-link-${j.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {myobJobs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No MYOB jobs found. Make sure your MYOB connection is active and you have jobs in MYOB.
        </p>
      )}
    </div>
  );
}
