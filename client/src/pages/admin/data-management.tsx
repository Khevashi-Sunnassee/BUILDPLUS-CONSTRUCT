import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Search, X, Loader2, Database, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

interface DeleteTarget {
  id: string;
  name: string;
  entityType: string;
  apiPath: string;
  queryKey: string;
}

interface BulkDeleteResult {
  totalCount: number;
  deletedCount: number;
  protectedCount: number;
  protectedReason: string;
}

interface EntityTabConfig {
  key: string;
  label: string;
  entityType: string;
  queryKey: string;
  columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[];
  getRowName: (row: any) => string;
}

const ENTITY_TABS: EntityTabConfig[] = [
  {
    key: "suppliers",
    label: "Suppliers",
    entityType: "suppliers",
    queryKey: ADMIN_ROUTES.DATA_MGMT_SUPPLIERS,
    columns: [
      { key: "name", label: "Name" },
      { key: "keyContact", label: "Key Contact", render: (r: any) => r.keyContact || "-" },
      { key: "email", label: "Email", render: (r: any) => r.email || "-" },
      { key: "phone", label: "Phone", render: (r: any) => r.phone || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    ],
    getRowName: (r: any) => r.name,
  },
  {
    key: "customers",
    label: "Customers",
    entityType: "customers",
    queryKey: ADMIN_ROUTES.DATA_MGMT_CUSTOMERS,
    columns: [
      { key: "name", label: "Name" },
      { key: "keyContact", label: "Key Contact", render: (r: any) => r.keyContact || "-" },
      { key: "email", label: "Email", render: (r: any) => r.email || "-" },
      { key: "phone", label: "Phone", render: (r: any) => r.phone || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    ],
    getRowName: (r: any) => r.name,
  },
  {
    key: "employees",
    label: "Employees",
    entityType: "employees",
    queryKey: ADMIN_ROUTES.DATA_MGMT_EMPLOYEES,
    columns: [
      { key: "employeeNumber", label: "Emp #", render: (r: any) => r.employeeNumber || "-" },
      { key: "name", label: "Name", render: (r: any) => `${r.firstName} ${r.lastName}` },
      { key: "email", label: "Email", render: (r: any) => r.email || "-" },
      { key: "phone", label: "Phone", render: (r: any) => r.phone || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    ],
    getRowName: (r: any) => `${r.firstName} ${r.lastName}`,
  },
  {
    key: "items",
    label: "Items",
    entityType: "items",
    queryKey: ADMIN_ROUTES.DATA_MGMT_ITEMS,
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code", render: (r: any) => r.code || "-" },
      { key: "unitOfMeasure", label: "UOM", render: (r: any) => r.unitOfMeasure || "-" },
      { key: "unitPrice", label: "Unit Price", render: (r: any) => r.unitPrice ? `$${Number(r.unitPrice).toFixed(2)}` : "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    ],
    getRowName: (r: any) => r.name,
  },
  {
    key: "item-categories",
    label: "Item Categories",
    entityType: "item-categories",
    queryKey: ADMIN_ROUTES.DATA_MGMT_ITEM_CATEGORIES,
    columns: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description", render: (r: any) => r.description || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
      { key: "itemCount", label: "Items", render: (r: any) => r.itemCount ?? 0 },
    ],
    getRowName: (r: any) => r.name,
  },
  {
    key: "assets",
    label: "Assets",
    entityType: "assets",
    queryKey: ADMIN_ROUTES.DATA_MGMT_ASSETS,
    columns: [
      { key: "assetTag", label: "Asset Tag", render: (r: any) => r.assetTag || "-" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category", render: (r: any) => r.category || "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status || "Unknown"}</Badge> },
      { key: "location", label: "Location", render: (r: any) => r.location || "-" },
    ],
    getRowName: (r: any) => r.name,
  },
  {
    key: "progress-claims",
    label: "Progress Claims",
    entityType: "progress-claims",
    queryKey: ADMIN_ROUTES.DATA_MGMT_PROGRESS_CLAIMS,
    columns: [
      { key: "claimNumber", label: "Claim #", render: (r: any) => r.claimNumber || "-" },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName ? `${r.jobName}${r.jobNumber ? ` (${r.jobNumber})` : ""}` : "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status || "Unknown"}</Badge> },
      { key: "total", label: "Total", render: (r: any) => r.total ? `$${Number(r.total).toFixed(2)}` : "-" },
      { key: "claimDate", label: "Claim Date", render: (r: any) => r.claimDate ? new Date(r.claimDate).toLocaleDateString() : "-" },
    ],
    getRowName: (r: any) => r.claimNumber || `Claim ${r.id}`,
  },
  {
    key: "broadcast-templates",
    label: "Broadcast Templates",
    entityType: "broadcast-templates",
    queryKey: ADMIN_ROUTES.DATA_MGMT_BROADCAST_TEMPLATES,
    columns: [
      { key: "name", label: "Name" },
      { key: "subject", label: "Subject", render: (r: any) => r.subject || "-" },
      { key: "category", label: "Category", render: (r: any) => r.category || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
      { key: "messageCount", label: "Messages", render: (r: any) => r.messageCount ?? 0 },
    ],
    getRowName: (r: any) => r.name,
  },
  {
    key: "documents",
    label: "Documents",
    entityType: "documents",
    queryKey: ADMIN_ROUTES.DATA_MGMT_DOCUMENTS,
    columns: [
      { key: "title", label: "Title", render: (r: any) => r.title || "-" },
      { key: "documentNumber", label: "Doc #", render: (r: any) => r.documentNumber || "-" },
      { key: "originalName", label: "File Name", render: (r: any) => r.originalName || "-" },
      { key: "revision", label: "Revision", render: (r: any) => r.revision || "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status || "Unknown"}</Badge> },
    ],
    getRowName: (r: any) => r.title || r.documentNumber || `Document ${r.id}`,
  },
  {
    key: "contracts",
    label: "Contracts",
    entityType: "contracts",
    queryKey: ADMIN_ROUTES.DATA_MGMT_CONTRACTS,
    columns: [
      { key: "contractNumber", label: "Contract #", render: (r: any) => r.contractNumber || "-" },
      { key: "projectName", label: "Project", render: (r: any) => r.projectName || "-" },
      { key: "generalContractor", label: "General Contractor", render: (r: any) => r.generalContractor || "-" },
      { key: "contractStatus", label: "Status", render: (r: any) => <Badge variant="secondary">{r.contractStatus || "Unknown"}</Badge> },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName || "-" },
    ],
    getRowName: (r: any) => r.contractNumber || r.projectName || `Contract ${r.id}`,
  },
  {
    key: "deliveries",
    label: "Deliveries",
    entityType: "deliveries",
    queryKey: ADMIN_ROUTES.DATA_MGMT_DELIVERIES,
    columns: [
      { key: "docketNumber", label: "Docket #", render: (r: any) => r.docketNumber || "-" },
      { key: "loadDocumentNumber", label: "Load Doc #", render: (r: any) => r.loadDocumentNumber || "-" },
      { key: "truckRego", label: "Truck Rego", render: (r: any) => r.truckRego || "-" },
      { key: "deliveryDate", label: "Delivery Date", render: (r: any) => r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString() : "-" },
      { key: "numberPanels", label: "Panels", render: (r: any) => r.numberPanels ?? "-" },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName || "-" },
    ],
    getRowName: (r: any) => r.docketNumber || `Delivery ${r.id}`,
  },
  {
    key: "load-lists",
    label: "Load Lists",
    entityType: "load-lists",
    queryKey: ADMIN_ROUTES.DATA_MGMT_LOAD_LISTS,
    columns: [
      { key: "loadNumber", label: "Load #", render: (r: any) => r.loadNumber || "-" },
      { key: "loadDate", label: "Load Date", render: (r: any) => r.loadDate ? new Date(r.loadDate).toLocaleDateString() : "-" },
      { key: "loadTime", label: "Load Time", render: (r: any) => r.loadTime || "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status || "Unknown"}</Badge> },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName ? `${r.jobName}${r.jobNumber ? ` (${r.jobNumber})` : ""}` : "-" },
    ],
    getRowName: (r: any) => r.loadNumber || `Load List ${r.id}`,
  },
  {
    key: "activity-templates",
    label: "Activity Templates",
    entityType: "activity-templates",
    queryKey: ADMIN_ROUTES.DATA_MGMT_ACTIVITY_TEMPLATES,
    columns: [
      { key: "name", label: "Name" },
      { key: "jobTypeName", label: "Job Type", render: (r: any) => r.jobTypeName || "-" },
      { key: "stageName", label: "Stage", render: (r: any) => r.stageName || "-" },
      { key: "category", label: "Category", render: (r: any) => r.category || "-" },
      { key: "consultantName", label: "Consultant", render: (r: any) => r.consultantName || "-" },
      { key: "estimatedDays", label: "Est. Days", render: (r: any) => r.estimatedDays ?? "-" },
    ],
    getRowName: (r: any) => r.name || `Template ${r.id}`,
  },
  {
    key: "job-activities",
    label: "Job Activities",
    entityType: "job-activities",
    queryKey: ADMIN_ROUTES.DATA_MGMT_JOB_ACTIVITIES,
    columns: [
      { key: "name", label: "Name" },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName ? `${r.jobName}${r.jobNumber ? ` (${r.jobNumber})` : ""}` : "-" },
      { key: "stageName", label: "Stage", render: (r: any) => r.stageName || "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status || "Unknown"}</Badge> },
      { key: "consultantName", label: "Consultant", render: (r: any) => r.consultantName || "-" },
      { key: "jobPhase", label: "Phase", render: (r: any) => r.jobPhase || "-" },
    ],
    getRowName: (r: any) => r.name || `Activity ${r.id}`,
  },
  {
    key: "activity-stages",
    label: "Activity Stages",
    entityType: "activity-stages",
    queryKey: ADMIN_ROUTES.DATA_MGMT_ACTIVITY_STAGES,
    columns: [
      { key: "stageNumber", label: "Stage #", render: (r: any) => r.stageNumber ?? "-" },
      { key: "name", label: "Name" },
      { key: "sortOrder", label: "Sort Order", render: (r: any) => r.sortOrder ?? "-" },
    ],
    getRowName: (r: any) => r.name || `Stage ${r.id}`,
  },
  {
    key: "activity-consultants",
    label: "Activity Consultants",
    entityType: "activity-consultants",
    queryKey: ADMIN_ROUTES.DATA_MGMT_ACTIVITY_CONSULTANTS,
    columns: [
      { key: "name", label: "Name" },
      { key: "sortOrder", label: "Sort Order", render: (r: any) => r.sortOrder ?? "-" },
    ],
    getRowName: (r: any) => r.name || `Consultant ${r.id}`,
  },
  {
    key: "cost-codes",
    label: "Cost Codes",
    entityType: "cost-codes",
    queryKey: ADMIN_ROUTES.DATA_MGMT_COST_CODES,
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description", render: (r: any) => r.description || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    ],
    getRowName: (r: any) => `${r.code} - ${r.name}`,
  },
  {
    key: "child-cost-codes",
    label: "Child Cost Codes",
    entityType: "child-cost-codes",
    queryKey: ADMIN_ROUTES.DATA_MGMT_CHILD_COST_CODES,
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "parentCode", label: "Parent Code", render: (r: any) => r.parentCode ? `${r.parentCode} - ${r.parentName}` : "-" },
      { key: "description", label: "Description", render: (r: any) => r.description || "-" },
      { key: "isActive", label: "Status", render: (r: any) => <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    ],
    getRowName: (r: any) => `${r.code} - ${r.name}`,
  },
  {
    key: "tenders",
    label: "Tenders",
    entityType: "tenders",
    queryKey: ADMIN_ROUTES.DATA_MGMT_TENDERS,
    columns: [
      { key: "tenderNumber", label: "Tender #" },
      { key: "title", label: "Title" },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName || "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status}</Badge> },
    ],
    getRowName: (r: any) => r.tenderNumber || r.title || `Tender ${r.id}`,
  },
  {
    key: "budgets",
    label: "Budgets",
    entityType: "budgets",
    queryKey: ADMIN_ROUTES.DATA_MGMT_BUDGETS,
    columns: [
      { key: "jobName", label: "Job", render: (r: any) => r.jobName || "-" },
      { key: "estimatedTotalBudget", label: "Estimated Total", render: (r: any) => r.estimatedTotalBudget ? `$${Number(r.estimatedTotalBudget).toLocaleString()}` : "-" },
      { key: "customerPrice", label: "Customer Price", render: (r: any) => r.customerPrice ? `$${Number(r.customerPrice).toLocaleString()}` : "-" },
    ],
    getRowName: (r: any) => r.jobName ? `Budget for ${r.jobName}` : `Budget ${r.id}`,
  },
  {
    key: "boq-groups",
    label: "BOQ Groups",
    entityType: "boq-groups",
    queryKey: ADMIN_ROUTES.DATA_MGMT_BOQ_GROUPS,
    columns: [
      { key: "name", label: "Name" },
      { key: "jobName", label: "Job", render: (r: any) => r.jobName || "-" },
      { key: "costCodeName", label: "Cost Code", render: (r: any) => r.costCodeName || "-" },
      { key: "description", label: "Description", render: (r: any) => r.description || "-" },
    ],
    getRowName: (r: any) => r.name || `BOQ Group ${r.id}`,
  },
  {
    key: "ap-invoices",
    label: "AP Invoices",
    entityType: "ap-invoices",
    queryKey: ADMIN_ROUTES.DATA_MGMT_AP_INVOICES,
    columns: [
      { key: "invoiceNumber", label: "Invoice #", render: (r: any) => r.invoiceNumber || "-" },
      { key: "supplierName", label: "Supplier", render: (r: any) => r.supplierName || "-" },
      { key: "description", label: "Description", render: (r: any) => r.description || "-" },
      { key: "totalInc", label: "Total Inc", render: (r: any) => r.totalInc ? `$${Number(r.totalInc).toFixed(2)}` : "-" },
      { key: "status", label: "Status", render: (r: any) => <Badge variant="secondary">{r.status || "Unknown"}</Badge> },
      { key: "sourceEmail", label: "Source", render: (r: any) => r.sourceEmail ? "Email" : "Upload" },
      { key: "createdAt", label: "Created", render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-" },
    ],
    getRowName: (r: any) => r.invoiceNumber || r.description || `AP Invoice ${r.id?.slice(0, 8)}`,
  },
];

function EntityTable({
  config,
  searchQuery,
  onDeleteClick,
}: {
  config: EntityTabConfig;
  searchQuery: string;
  onDeleteClick: (target: DeleteTarget) => void;
}) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: [config.queryKey],
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some(
        (val) => typeof val === "string" && val.toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Database className="h-10 w-10 mb-3" />
        <p className="text-sm">No {config.label.toLowerCase()} found</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="h-10 w-10 mb-3" />
        <p className="text-sm">No matching records</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {config.columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            <TableHead className="text-right w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.id} data-testid={`row-${config.entityType}-${row.id}`}>
              {config.columns.map((col) => (
                <TableCell key={col.key} data-testid={`cell-${config.entityType}-${col.key}-${row.id}`}>
                  {col.render ? col.render(row) : (row[col.key] ?? "-")}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onDeleteClick({
                      id: row.id,
                      name: config.getRowName(row),
                      entityType: config.entityType,
                      apiPath: `/api/admin/data-management/${config.entityType}/${row.id}`,
                      queryKey: config.queryKey,
                    })
                  }
                  data-testid={`button-delete-${config.entityType}-${row.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DataManagementPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("suppliers");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<BulkDeleteResult | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async ({ apiPath }: { apiPath: string }) => {
      await apiRequest("DELETE", apiPath);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Record deleted successfully." });
      if (deleteTarget) {
        queryClient.invalidateQueries({ queryKey: [deleteTarget.queryKey] });
      }
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Delete",
        description: error.message || "Failed to delete record.",
        variant: "destructive",
      });
      setDeleteTarget(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ entityType }: { entityType: string }) => {
      const res = await apiRequest("DELETE", `/api/admin/data-management/${entityType}/bulk-delete`);
      return await res.json() as BulkDeleteResult;
    },
    onSuccess: (data: BulkDeleteResult) => {
      setBulkDeleteConfirm(null);
      setBulkDeleteResult(data);
      const activeConfig = ENTITY_TABS.find((t) => t.key === activeTab);
      if (activeConfig) {
        queryClient.invalidateQueries({ queryKey: [activeConfig.queryKey] });
      }
    },
    onError: (error: any) => {
      setBulkDeleteConfirm(null);
      toast({
        title: "Bulk Delete Failed",
        description: error.message || "Failed to perform bulk delete.",
        variant: "destructive",
      });
    },
  });

  const activeConfig = ENTITY_TABS.find((t) => t.key === activeTab);

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Data Management">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Data Management</h1>
            <PageHelpButton pageHelpKey="data_management" />
          </div>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
            Delete individual records or bulk-delete all records. Records with dependencies will be skipped during bulk delete.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Records
            </CardTitle>
            <CardDescription>Select an entity type and manage records</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteConfirm(activeTab)}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All {activeConfig?.label}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSearchQuery(""); }}>
            <div className="overflow-x-auto">
              <TabsList className="mb-4" data-testid="tabs-entity-types">
                {ENTITY_TABS.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key} data-testid={`tab-${tab.key}`}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {ENTITY_TABS.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                <EntityTable
                  config={tab}
                  searchQuery={searchQuery}
                  onDeleteClick={setDeleteTarget}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone. If this record has dependencies, the deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete" disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ apiPath: deleteTarget.apiPath });
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!bulkDeleteConfirm} onOpenChange={(open) => { if (!open) setBulkDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Bulk Delete All {activeConfig?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to delete <span className="font-semibold">all {activeConfig?.label.toLowerCase()}</span> in your company.
              Records that are linked to other data (e.g. jobs, purchase orders) will be automatically skipped to protect data integrity.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete" disabled={bulkDeleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bulkDeleteConfirm) {
                  bulkDeleteMutation.mutate({ entityType: bulkDeleteConfirm });
                }
              }}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete All"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!bulkDeleteResult} onOpenChange={(open) => { if (!open) setBulkDeleteResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Bulk Delete Complete
            </DialogTitle>
            <DialogDescription>
              The bulk delete operation has finished. Here are the results:
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteResult && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total records found</span>
                <span className="font-semibold" data-testid="text-bulk-total">{bulkDeleteResult.totalCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-600 dark:text-green-400">Successfully deleted</span>
                <span className="font-semibold text-green-600 dark:text-green-400" data-testid="text-bulk-deleted">{bulkDeleteResult.deletedCount}</span>
              </div>
              {bulkDeleteResult.protectedCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4" />
                      Skipped (protected)
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400" data-testid="text-bulk-protected">{bulkDeleteResult.protectedCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted rounded-md p-2">
                    {bulkDeleteResult.protectedCount} record(s) were skipped because they are {bulkDeleteResult.protectedReason}.
                    Remove those dependencies first to delete these records.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setBulkDeleteResult(null)} data-testid="button-close-bulk-result">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
