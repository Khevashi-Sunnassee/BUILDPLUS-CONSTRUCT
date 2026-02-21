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
import { Search, Link2, Unlink, Building2, Users, Truck, FileText, Package, DollarSign, RefreshCw, Loader2, ExternalLink, CheckCircle2, XCircle, AlertTriangle, ClipboardList, TrendingUp, TrendingDown, BarChart3, Calendar } from "lucide-react";
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
    window.open(
      MYOB_ROUTES.AUTH,
      "myob-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
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
      const qStart = Math.floor(m / 3) * 3;
      const start = new Date(y, qStart, 1);
      const end = new Date(y, qStart + 3, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
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
  const fyDates = getFinancialYearDates();
  const [startDate, setStartDate] = useState(fyDates.start);
  const [endDate, setEndDate] = useState(fyDates.end);
  const [reportingBasis, setReportingBasis] = useState("Accrual");
  const [yearEndAdjust, setYearEndAdjust] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const pnlUrl = `${MYOB_ROUTES.PROFIT_AND_LOSS}?startDate=${startDate}&endDate=${endDate}&reportingBasis=${reportingBasis}&yearEndAdjust=${yearEndAdjust}`;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<PnlData>({
    queryKey: [MYOB_ROUTES.PROFIT_AND_LOSS, startDate, endDate, reportingBasis, yearEndAdjust],
    queryFn: async () => {
      const res = await apiRequest("GET", pnlUrl);
      return res.json();
    },
  });

  const accounts = data?.AccountsBreakdown || [];

  const incomeAccounts = accounts.filter((a) => a.Account.DisplayID.startsWith("4-"));
  const cosAccounts = accounts.filter((a) => a.Account.DisplayID.startsWith("5-"));
  const expenseAccounts = accounts.filter((a) =>
    a.Account.DisplayID.startsWith("6-") || a.Account.DisplayID.startsWith("7-") || a.Account.DisplayID.startsWith("8-") || a.Account.DisplayID.startsWith("9-")
  );
  const otherAccounts = accounts.filter((a) => {
    const d = a.Account.DisplayID;
    return !d.startsWith("4-") && !d.startsWith("5-") && !d.startsWith("6-") && !d.startsWith("7-") && !d.startsWith("8-") && !d.startsWith("9-");
  });

  const filterAccounts = (list: PnlAccount[]) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (a) =>
        a.Account.Name.toLowerCase().includes(term) ||
        a.Account.DisplayID.toLowerCase().includes(term)
    );
  };

  const totalIncome = incomeAccounts.reduce((sum, a) => sum + a.AccountTotal, 0);
  const totalCos = cosAccounts.reduce((sum, a) => sum + a.AccountTotal, 0);
  const grossProfit = totalIncome - Math.abs(totalCos);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.abs(a.AccountTotal), 0);
  const netProfit = grossProfit - totalExpenses;

  const handlePreset = (preset: string) => {
    const dates = getPresetDates(preset);
    setStartDate(dates.start);
    setEndDate(dates.end);
  };

  const renderAccountSection = (title: string, sectionAccounts: PnlAccount[], total: number, icon: React.ReactNode, variant: "income" | "expense" | "neutral") => {
    const filtered = filterAccounts(sectionAccounts);
    if (sectionAccounts.length === 0 && !searchTerm) return null;

    return (
      <div className="space-y-2" data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <div className="flex items-center justify-between gap-2 py-2 border-b flex-wrap">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {icon}
            {title}
          </h3>
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
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Profit & Loss Report
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-48"
                  data-testid="input-search-pnl"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-pnl"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quick Period</Label>
              <div className="flex gap-1 flex-wrap">
                {[
                  { label: "This Month", value: "this-month" },
                  { label: "Last Month", value: "last-month" },
                  { label: "This Quarter", value: "this-quarter" },
                  { label: "This FY", value: "this-fy" },
                  { label: "Last FY", value: "last-fy" },
                ].map((p) => (
                  <Button key={p.value} variant="outline" size="sm" onClick={() => handlePreset(p.value)} data-testid={`button-preset-${p.value}`}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pnl-start" className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                id="pnl-start"
                type="date"
                {...dateInputProps}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                data-testid="input-pnl-start-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pnl-end" className="text-xs text-muted-foreground">End Date</Label>
              <Input
                id="pnl-end"
                type="date"
                {...dateInputProps}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                data-testid="input-pnl-end-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Basis</Label>
              <Select value={reportingBasis} onValueChange={setReportingBasis}>
                <SelectTrigger className="w-32" data-testid="select-reporting-basis">
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
        <Card>
          <CardContent className="py-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message || "Failed to load Profit & Loss from MYOB"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-pnl">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-income">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground font-medium">Total Income</p>
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xl font-bold font-mono mt-1 text-green-600 dark:text-green-400">{formatCurrency(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-cost-of-sales">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground font-medium">Cost of Sales</p>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold font-mono mt-1">{formatCurrency(Math.abs(totalCos))}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-gross-profit">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground font-medium">Gross Profit</p>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className={`text-xl font-bold font-mono mt-1 ${grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(grossProfit)}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-net-profit">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground font-medium">Net Profit</p>
                  {netProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <p className={`text-xl font-bold font-mono mt-1 ${netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {new Date(startDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  {" - "}
                  {new Date(endDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <Badge variant="secondary" className="text-xs">{reportingBasis}</Badge>
                {yearEndAdjust && <Badge variant="secondary" className="text-xs">Incl. Year-End Adj.</Badge>}
                <Badge variant="secondary" className="text-xs">{accounts.length} accounts</Badge>
              </div>

              {renderAccountSection("Income", incomeAccounts, totalIncome, <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />, "income")}

              {renderAccountSection("Cost of Sales", cosAccounts, Math.abs(totalCos), <DollarSign className="h-4 w-4 text-muted-foreground" />, "neutral")}

              <div className="flex items-center justify-between gap-2 py-2 border-y bg-muted/30 px-2 rounded-md flex-wrap">
                <span className="font-semibold text-sm">Gross Profit</span>
                <span className={`font-mono font-bold text-sm ${grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(grossProfit)}
                </span>
              </div>

              {renderAccountSection("Operating Expenses", expenseAccounts, totalExpenses, <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />, "expense")}

              {otherAccounts.length > 0 && renderAccountSection("Other", otherAccounts, otherAccounts.reduce((s, a) => s + a.AccountTotal, 0), <FileText className="h-4 w-4 text-muted-foreground" />, "neutral")}

              <div className="flex items-center justify-between gap-2 py-3 border-t-2 border-foreground/20 flex-wrap">
                <span className="font-bold text-base">Net Profit / (Loss)</span>
                <span className={`font-mono font-bold text-base ${netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </CardContent>
          </Card>
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
