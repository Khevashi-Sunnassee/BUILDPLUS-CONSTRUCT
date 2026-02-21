import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, BookOpen, Shield, Database, Monitor, Settings2, Star, StarOff, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdminCompaniesPage from "./admin/companies";
import AdminHelpPage from "./admin/help";
import DataManagementPage from "./admin/data-management";
import AdminDevicesPage from "./admin/devices";

interface Company {
  id: string;
  name: string;
}

interface SystemDefaultTable {
  key: string;
  label: string;
}

interface SystemDefaultRecord {
  id: string;
  isSystemDefault: boolean;
  isActive?: boolean;
  [key: string]: any;
}

interface DefaultsSummary {
  [key: string]: { total: number; defaults: number };
}

function CompanySelector({ selectedCompanyId, onCompanyChange, companies }: {
  selectedCompanyId: string;
  onCompanyChange: (id: string) => void;
  companies: Company[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Select Company
        </CardTitle>
        <CardDescription>
          Choose a company to view and manage its resources
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={selectedCompanyId} onValueChange={onCompanyChange}>
          <SelectTrigger className="w-full max-w-md" data-testid="select-company">
            <SelectValue placeholder="Select a company..." />
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id} data-testid={`option-company-${company.id}`}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function CompanyRequiredPlaceholder({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Icon className="h-10 w-10 mb-3" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}

const TABLE_NAME_FIELDS: Record<string, string> = {
  documentTypesConfig: "typeName",
  documentDisciplines: "disciplineName",
  documentCategories: "categoryName",
  checklistTemplates: "name",
  jobTypes: "name",
  activityStages: "name",
  emailTemplates: "name",
  itemCategories: "name",
  items: "name",
  scopeTrades: "name",
  scopes: "name",
};

function SystemDefaultsManager({ companyId, companies }: { companyId: string; companies: Company[] }) {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: tables = [] } = useQuery<SystemDefaultTable[]>({
    queryKey: ["/api/super-admin/system-defaults/tables"],
  });

  const { data: summary } = useQuery<DefaultsSummary>({
    queryKey: ["/api/super-admin/system-defaults/summary", { companyId }],
    enabled: !!companyId,
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<SystemDefaultRecord[]>({
    queryKey: [`/api/super-admin/system-defaults/${selectedTable}`, { companyId }],
    enabled: !!selectedTable && !!companyId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ tableKey, id }: { tableKey: string; id: string }) => {
      return apiRequest("PATCH", `/api/super-admin/system-defaults/${tableKey}/${id}/toggle?companyId=${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/system-defaults/${selectedTable}`, { companyId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/system-defaults/summary", { companyId }] });
    },
    onError: () => {
      toast({ title: "Failed to toggle default status", variant: "destructive" });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async ({ isSystemDefault }: { isSystemDefault: boolean }) => {
      return apiRequest("POST", "/api/super-admin/system-defaults/bulk-toggle", {
        tableKey: selectedTable,
        ids: Array.from(selectedIds),
        isSystemDefault,
        companyId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/system-defaults/${selectedTable}`, { companyId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/system-defaults/summary", { companyId }] });
      setSelectedIds(new Set());
      toast({ title: "Defaults updated" });
    },
    onError: () => {
      toast({ title: "Failed to update defaults", variant: "destructive" });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async ({ targetCompanyId }: { targetCompanyId: string }) => {
      const res = await apiRequest("POST", "/api/super-admin/system-defaults/clone-to-company", {
        sourceCompanyId: companyId,
        targetCompanyId,
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      const counts = data.clonedCounts || {};
      const skipped = data.skippedCounts || {};
      const totalCloned = Object.values(counts).reduce((s: number, v: any) => s + (v || 0), 0);
      const totalSkipped = Object.values(skipped).reduce((s: number, v: any) => s + (v || 0), 0);
      const msg = totalSkipped > 0
        ? `Cloned ${totalCloned} records, skipped ${totalSkipped} already existing`
        : `Cloned ${totalCloned} default records to target company`;
      toast({ title: msg });
    },
    onError: () => {
      toast({ title: "Failed to clone defaults", variant: "destructive" });
    },
  });

  const [cloneTargetId, setCloneTargetId] = useState<string>("");

  const nameField = TABLE_NAME_FIELDS[selectedTable] || "name";

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Configuration Table</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setSelectedIds(new Set()); }}>
              <SelectTrigger data-testid="select-defaults-table">
                <SelectValue placeholder="Choose a table..." />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.key} value={t.key} data-testid={`option-table-${t.key}`}>
                    <span className="flex items-center gap-2">
                      {t.label}
                      {summary?.[t.key] && (
                        <Badge variant="secondary" className="text-xs">
                          {summary[t.key].defaults}/{summary[t.key].total}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Clone Defaults to Company</CardTitle>
            <CardDescription className="text-xs">Copy all system default records from this company to another</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Select value={cloneTargetId} onValueChange={setCloneTargetId}>
                <SelectTrigger className="flex-1" data-testid="select-clone-target">
                  <SelectValue placeholder="Target company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.filter(c => c.id !== companyId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => cloneTargetId && cloneMutation.mutate({ targetCompanyId: cloneTargetId })}
                disabled={!cloneTargetId || cloneMutation.isPending}
                data-testid="button-clone-defaults"
              >
                {cloneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clone"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {summary && !selectedTable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Defaults Summary</CardTitle>
            <CardDescription>Overview of system default records for this company</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tables.map((t) => {
                const s = summary[t.key];
                return (
                  <button
                    key={t.key}
                    onClick={() => { setSelectedTable(t.key); setSelectedIds(new Set()); }}
                    className="flex flex-col items-start p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    data-testid={`card-summary-${t.key}`}
                  >
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {s ? `${s.defaults} of ${s.total} defaults` : "Loading..."}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTable && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                {tables.find(t => t.key === selectedTable)?.label || selectedTable}
              </CardTitle>
              <CardDescription>
                Toggle records to mark them as system defaults for new companies
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleMutation.mutate({ isSystemDefault: true })}
                  disabled={bulkToggleMutation.isPending}
                  data-testid="button-bulk-set-default"
                >
                  <Star className="h-3.5 w-3.5 mr-1" />
                  Set Default ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkToggleMutation.mutate({ isSystemDefault: false })}
                  disabled={bulkToggleMutation.isPending}
                  data-testid="button-bulk-remove-default"
                >
                  <StarOff className="h-3.5 w-3.5 mr-1" />
                  Remove Default ({selectedIds.size})
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No records found for this table in the selected company</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === records.length && records.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-32 text-center">System Default</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} data-testid={`row-default-${record.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={() => toggleSelectOne(record.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{record[nameField] || record.name || record.typeName || record.disciplineName || record.categoryName || "—"}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {record.isSystemDefault ? (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {record.isActive !== undefined && (
                            <Badge variant={record.isActive ? "outline" : "secondary"}>
                              {record.isActive ? "Active" : "Inactive"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ tableKey: selectedTable, id: record.id })}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-toggle-default-${record.id}`}
                          >
                            {record.isSystemDefault ? (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Star className="h-4 w-4 text-amber-500" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SuperAdminPage() {
  useDocumentTitle("Super Admin");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

  return (
    <div className="space-y-6" role="main" aria-label="Super Admin">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-super-admin-title">
            Super Admin
          </h1>
        </div>
        <p className="text-muted-foreground">
          Platform-wide configuration and management
        </p>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tabs-super-admin">
          <TabsTrigger value="companies" data-testid="tab-super-companies">
            <Building2 className="h-4 w-4 mr-1.5" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="help" data-testid="tab-super-help">
            <BookOpen className="h-4 w-4 mr-1.5" />
            Help Management
          </TabsTrigger>
          <TabsTrigger value="system-defaults" data-testid="tab-super-system-defaults">
            <Settings2 className="h-4 w-4 mr-1.5" />
            System Defaults
          </TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-super-devices">
            <Monitor className="h-4 w-4 mr-1.5" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="data-management" data-testid="tab-super-data-management">
            <Database className="h-4 w-4 mr-1.5" />
            Data Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-6">
          <AdminCompaniesPage embedded={true} />
        </TabsContent>

        <TabsContent value="help" className="space-y-6">
          <AdminHelpPage embedded={true} />
        </TabsContent>

        <TabsContent value="system-defaults" className="space-y-6">
          <CompanySelector
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            companies={companies}
          />
          {selectedCompanyId ? (
            <SystemDefaultsManager
              companyId={selectedCompanyId}
              companies={companies}
              key={`defaults-${selectedCompanyId}`}
            />
          ) : (
            <CompanyRequiredPlaceholder icon={Settings2} message="Select a company to manage its system defaults" />
          )}
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          <CompanySelector
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            companies={companies}
          />
          {selectedCompanyId ? (
            <AdminDevicesPage embedded={true} companyId={selectedCompanyId} key={`devices-${selectedCompanyId}`} />
          ) : (
            <CompanyRequiredPlaceholder icon={Monitor} message="Select a company above to manage its devices" />
          )}
        </TabsContent>

        <TabsContent value="data-management" className="space-y-6">
          <CompanySelector
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            companies={companies}
          />
          {selectedCompanyId ? (
            <DataManagementPage embedded={true} companyId={selectedCompanyId} key={`data-${selectedCompanyId}`} />
          ) : (
            <CompanyRequiredPlaceholder icon={Database} message="Select a company above to manage its data" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
