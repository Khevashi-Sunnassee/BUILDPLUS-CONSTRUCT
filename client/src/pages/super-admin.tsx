import { useState, useCallback, useMemo, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, BookOpen, Shield, Database, Monitor, Settings2, Star, StarOff, Loader2, FileSearch, Key, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Clock, Activity, AlertTriangle, ChevronDown, ChevronRight, Layers, Upload, Save, Image } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AdminCompaniesPage from "./admin/companies";
import AdminHelpPage from "./admin/help";
import DataManagementPage from "./admin/data-management";
import AdminDevicesPage from "./admin/devices";
import ReviewModePage from "./admin/review-mode";

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
  costCodes: "name",
  childCostCodes: "name",
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

  const { data: entityTypes = [] } = useQuery<{ id: string; name: string; code: string; color: string | null }[]>({
    queryKey: ["/api/checklist/entity-types"],
    enabled: selectedTable === "checklistTemplates",
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const groupedRecords = useMemo(() => {
    if (selectedTable !== "checklistTemplates" || records.length === 0) return null;

    const groups: { typeId: string | null; typeName: string; records: SystemDefaultRecord[] }[] = [];
    const byType: Record<string, SystemDefaultRecord[]> = {};
    const unassigned: SystemDefaultRecord[] = [];

    for (const r of records) {
      if (r.entityTypeId) {
        if (!byType[r.entityTypeId]) byType[r.entityTypeId] = [];
        byType[r.entityTypeId].push(r);
      } else {
        unassigned.push(r);
      }
    }

    for (const et of entityTypes) {
      if (byType[et.id]) {
        groups.push({ typeId: et.id, typeName: et.name, records: byType[et.id] });
      }
    }

    for (const [typeId, recs] of Object.entries(byType)) {
      if (!entityTypes.find(e => e.id === typeId)) {
        groups.push({ typeId, typeName: "Unknown Type", records: recs });
      }
    }

    if (unassigned.length > 0) {
      groups.push({ typeId: null, typeName: "Unassigned", records: unassigned });
    }

    return groups;
  }, [selectedTable, records, entityTypes]);

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
            ) : groupedRecords ? (
              <div className="space-y-4">
                {groupedRecords.map((group) => {
                  const groupKey = group.typeId || "__unassigned__";
                  const isCollapsed = collapsedGroups.has(groupKey);
                  const groupDefaults = group.records.filter(r => r.isSystemDefault).length;
                  return (
                    <div key={groupKey} className="rounded-md border" data-testid={`group-${groupKey}`}>
                      <button
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-muted/50 cursor-pointer"
                        onClick={() => {
                          const next = new Set(collapsedGroups);
                          if (next.has(groupKey)) next.delete(groupKey);
                          else next.add(groupKey);
                          setCollapsedGroups(next);
                        }}
                        data-testid={`button-toggle-group-${groupKey}`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{group.typeName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {group.records.length} template{group.records.length !== 1 ? "s" : ""}
                          </Badge>
                          {groupDefaults > 0 && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                              {groupDefaults} default{groupDefaults !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {!isCollapsed && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={group.records.every(r => selectedIds.has(r.id))}
                                  onCheckedChange={() => {
                                    const allSelected = group.records.every(r => selectedIds.has(r.id));
                                    const next = new Set(selectedIds);
                                    group.records.forEach(r => { if (allSelected) next.delete(r.id); else next.add(r.id); });
                                    setSelectedIds(next);
                                  }}
                                />
                              </TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="w-32 text-center">System Default</TableHead>
                              <TableHead className="w-24 text-center">Status</TableHead>
                              <TableHead className="w-24"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.records.map((record) => (
                              <TableRow key={record.id} data-testid={`row-default-${record.id}`}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(record.id)}
                                    onCheckedChange={() => toggleSelectOne(record.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">{record[nameField] || record.name || "—"}</span>
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
                      )}
                    </div>
                  );
                })}
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

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdById: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiLog = {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

const AVAILABLE_PERMISSIONS = [
  { key: "*", label: "Full Access" },
  { key: "read:jobs", label: "Read Jobs" },
  { key: "read:cost-codes", label: "Read Cost Codes" },
  { key: "read:documents", label: "Read Documents" },
  { key: "read:job-types", label: "Read Job Types" },
  { key: "read:company", label: "Read Company Info" },
  { key: "write:markups", label: "Write Markups" },
  { key: "write:estimates", label: "Write Estimates" },
];

function ApiKeysManager({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["*"]);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);

  const apiBase = `/api/super-admin/external-api-keys`;

  const { data: apiKeys = [], isLoading } = useQuery<ApiKeyRecord[]>({
    queryKey: [apiBase, { companyId }],
    queryFn: async () => {
      const res = await fetch(`${apiBase}?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch API keys");
      return res.json();
    },
  });

  const { data: logs = [] } = useQuery<ApiLog[]>({
    queryKey: [apiBase, expandedKeyId, "logs", { companyId }],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/${expandedKeyId}/logs?companyId=${companyId}&limit=20`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!expandedKeyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${apiBase}?companyId=${companyId}`, {
        name: newKeyName,
        permissions: newKeyPermissions,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [apiBase, { companyId }] });
      setNewlyCreatedKey(data.rawKey);
      setNewKeyName("");
      setNewKeyPermissions(["*"]);
      toast({ title: "API key created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create API key", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `${apiBase}/${id}?companyId=${companyId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, { companyId }] });
      toast({ title: "API key updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update API key", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiBase}/${id}?companyId=${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, { companyId }] });
      toast({ title: "API key deleted" });
      setDeleteDialogOpen(false);
      setDeletingKeyId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete API key", description: err.message, variant: "destructive" });
    },
  });

  const handleCopyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const togglePermission = (perm: string) => {
    if (perm === "*") {
      setNewKeyPermissions(["*"]);
      return;
    }
    const filtered = newKeyPermissions.filter(p => p !== "*");
    if (filtered.includes(perm)) {
      setNewKeyPermissions(filtered.filter(p => p !== perm));
    } else {
      setNewKeyPermissions([...filtered, perm]);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Never";
    return new Date(d).toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            External API Keys
          </h3>
          <p className="text-sm text-muted-foreground">Manage API keys for external system integration</p>
        </div>
        <Button onClick={() => { setCreateDialogOpen(true); setNewlyCreatedKey(null); }} data-testid="button-sa-create-api-key">
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Key className="h-10 w-10 mb-3" />
            <p className="text-sm">No API keys configured for this company</p>
            <p className="text-xs mt-1">Create an API key to allow external systems to access this company's data</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <Fragment key={key.id}>
                    <TableRow data-testid={`row-api-key-${key.id}`}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{key.keyPrefix}...</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.includes("*") ? (
                            <Badge variant="default" className="text-xs">Full Access</Badge>
                          ) : (
                            key.permissions.slice(0, 3).map(p => (
                              <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                            ))
                          )}
                          {!key.permissions.includes("*") && key.permissions.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{key.permissions.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.isActive ? "default" : "secondary"} className={key.isActive ? "bg-green-600" : ""}>
                          {key.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(key.lastUsedAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setExpandedKeyId(expandedKeyId === key.id ? null : key.id)}
                            data-testid={`button-logs-${key.id}`}
                          >
                            <Activity className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleMutation.mutate({ id: key.id, isActive: !key.isActive })}
                            data-testid={`button-toggle-${key.id}`}
                          >
                            {key.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setDeletingKeyId(key.id); setDeleteDialogOpen(true); }}
                            data-testid={`button-delete-key-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedKeyId === key.id && (
                      <TableRow key={`logs-${key.id}`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="p-3">
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Recent Activity
                            </h4>
                            {logs.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No API calls recorded yet</p>
                            ) : (
                              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {logs.map((log) => (
                                  <div key={log.id} className="flex items-center gap-3 text-xs">
                                    <Badge variant={log.statusCode < 400 ? "outline" : "destructive"} className="text-[10px] px-1.5">
                                      {log.statusCode}
                                    </Badge>
                                    <span className="font-mono">{log.method}</span>
                                    <span className="text-muted-foreground truncate max-w-[200px]">{log.path}</span>
                                    <span className="text-muted-foreground">{log.responseTimeMs}ms</span>
                                    <span className="text-muted-foreground ml-auto">{formatDate(log.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) setNewlyCreatedKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create an API key for this company to allow external systems to access its data securely.
            </DialogDescription>
          </DialogHeader>

          {newlyCreatedKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Save this key now — it will only be shown once</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background p-2 rounded border flex-1 break-all" data-testid="text-new-api-key">
                    {newlyCreatedKey}
                  </code>
                  <Button variant="outline" size="icon" onClick={() => handleCopyKey(newlyCreatedKey)} data-testid="button-copy-key">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && <p className="text-xs text-green-600 mt-1">Copied to clipboard</p>}
              </div>
              <DialogFooter>
                <Button onClick={() => { setCreateDialogOpen(false); setNewlyCreatedKey(null); }} data-testid="button-done-key">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input
                  placeholder="e.g. Measure App - Salvo"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  data-testid="input-key-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={newKeyPermissions.includes("*") ? perm.key === "*" : newKeyPermissions.includes(perm.key)}
                        onCheckedChange={() => togglePermission(perm.key)}
                        data-testid={`checkbox-perm-${perm.key}`}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newKeyName.trim() || createMutation.isPending}
                  data-testid="button-confirm-create-key"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Key
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this API key. Any external systems using it will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingKeyId && deleteMutation.mutate(deletingKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-key"
            >
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SystemBrandingManager() {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  const { data: logoData } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: ["/api/settings/logo"],
  });

  const currentLogo = logoPreview || logoData?.logoBase64 || null;
  const currentCompanyName = logoData?.companyName || "BuildPlus Ai";

  useEffect(() => {
    if (logoData?.companyName) {
      setCompanyName(logoData.companyName);
    }
  }, [logoData?.companyName]);

  const uploadLogoMutation = useMutation({
    mutationFn: async (base64: string) => {
      await apiRequest("POST", "/api/admin/settings/logo", { logoBase64: base64 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/logo"] });
      setLogoPreview(null);
      toast({ title: "System logo updated" });
    },
    onError: () => {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/settings/logo", { logoBase64: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/logo"] });
      setLogoPreview(null);
      toast({ title: "System logo removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove logo", variant: "destructive" });
    },
  });

  const saveCompanyNameMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/admin/settings/company-name", { companyName: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/logo"] });
      toast({ title: "Company name updated" });
    },
    onError: () => {
      toast({ title: "Failed to save company name", variant: "destructive" });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      uploadLogoMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" aria-hidden="true" />
          System Branding
        </CardTitle>
        <CardDescription>
          Configure the system logo and company name used in sidebar, login page, and system notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="systemCompanyName">Company Name</Label>
          <Input
            id="systemCompanyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name"
            data-testid="input-system-company-name"
          />
          <p className="text-sm text-muted-foreground">
            Displayed in sidebar, login page, and system-wide branding
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => saveCompanyNameMutation.mutate(companyName)}
            disabled={saveCompanyNameMutation.isPending || !companyName || companyName === currentCompanyName}
            data-testid="button-save-system-company-name"
          >
            {saveCompanyNameMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Company Name
          </Button>
        </div>

        <div className="space-y-2">
          <Label>System Logo</Label>
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-lg border bg-background flex items-center justify-center overflow-hidden">
                {currentLogo ? (
                  <img
                    src={currentLogo}
                    alt="System Logo"
                    className="max-w-full max-h-full object-contain"
                    data-testid="img-system-logo-preview"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1" data-testid="img-system-logo-preview">
                    <Building2 className="h-8 w-8 text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground">BuildPlus Ai</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  data-testid="input-system-logo-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadLogoMutation.isPending}
                  data-testid="button-upload-system-logo"
                >
                  {uploadLogoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Logo
                </Button>
                {logoData?.logoBase64 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeLogoMutation.mutate()}
                    disabled={removeLogoMutation.isPending}
                    data-testid="button-remove-system-logo"
                  >
                    {removeLogoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    )}
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                PNG, JPG or SVG. Max 2MB. Used in sidebar, login page, and system notifications.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
          <TabsTrigger value="api-keys" data-testid="tab-super-api-keys">
            <Key className="h-4 w-4 mr-1.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="branding" data-testid="tab-super-branding">
            <Image className="h-4 w-4 mr-1.5" />
            System Branding
          </TabsTrigger>
          <TabsTrigger value="review-mode" data-testid="tab-super-review-mode">
            <FileSearch className="h-4 w-4 mr-1.5" />
            Review Mode
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

        <TabsContent value="api-keys" className="space-y-6">
          <CompanySelector
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            companies={companies}
          />
          {selectedCompanyId ? (
            <ApiKeysManager
              companyId={selectedCompanyId}
              key={`api-keys-${selectedCompanyId}`}
            />
          ) : (
            <CompanyRequiredPlaceholder icon={Key} message="Select a company to manage its API keys for external integrations" />
          )}
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <SystemBrandingManager />
        </TabsContent>

        <TabsContent value="review-mode" className="space-y-6">
          <ReviewModePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
