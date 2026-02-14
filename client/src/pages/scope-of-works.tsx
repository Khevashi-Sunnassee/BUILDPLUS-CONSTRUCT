import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Eye, Pencil, Trash2, Loader2, Search, FileText, Copy, Mail,
  Printer, Sparkles, Check, X, Minus, Upload, Download, Filter, BarChart3, Layers,
} from "lucide-react";

type ScopeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type ItemStatus = "INCLUDED" | "EXCLUDED" | "NA";

interface ScopeTrade {
  id: string;
  name: string;
  description?: string | null;
}

interface JobType {
  id: string;
  name: string;
}

interface ScopeItem {
  id: string;
  scopeId: string;
  category: string | null;
  description: string;
  details: string | null;
  status: ItemStatus;
  sortOrder: number;
}

interface Scope {
  id: string;
  name: string;
  tradeId: string | null;
  jobTypeId: string | null;
  status: ScopeStatus;
  description: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  trade?: { id: string; name: string } | null;
  jobType?: { id: string; name: string } | null;
  items?: ScopeItem[];
  itemCount?: number;
}

interface ScopeStats {
  total: number;
  active: number;
  draft: number;
  trades: number;
}

interface AIGeneratedItem {
  category: string;
  description: string;
  details: string;
  status: ItemStatus;
}

const STATUS_LABELS: Record<ScopeStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

function ScopeStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{STATUS_LABELS.DRAFT}</Badge>;
    case "ACTIVE":
      return <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-status-${status}`}>{STATUS_LABELS.ACTIVE}</Badge>;
    case "ARCHIVED":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{STATUS_LABELS.ARCHIVED}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function ItemStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "INCLUDED":
      return <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-item-${status}`}>Included</Badge>;
    case "EXCLUDED":
      return <Badge variant="destructive" data-testid={`badge-item-${status}`}>Excluded</Badge>;
    case "NA":
      return <Badge variant="secondary" data-testid={`badge-item-${status}`}>N/A</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ScopeOfWorksPage() {
  useDocumentTitle("Scope of Works");
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("ALL");
  const [jobTypeFilter, setJobTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [scopeFormOpen, setScopeFormOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<Scope | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Scope | null>(null);
  const [detailScope, setDetailScope] = useState<Scope | null>(null);

  const [formName, setFormName] = useState("");
  const [formTradeId, setFormTradeId] = useState("");
  const [formJobTypeId, setFormJobTypeId] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiProjectDescription, setAiProjectDescription] = useState("");
  const [aiGeneratedItems, setAiGeneratedItems] = useState<AIGeneratedItem[]>([]);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);

  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [itemCategory, setItemCategory] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemDetails, setItemDetails] = useState("");
  const [itemStatus, setItemStatus] = useState<ItemStatus>("INCLUDED");

  const [deleteItemConfirm, setDeleteItemConfirm] = useState<ScopeItem | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (tradeFilter !== "ALL") params.set("tradeId", tradeFilter);
    if (jobTypeFilter !== "ALL") params.set("jobTypeId", jobTypeFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    return params.toString();
  }, [tradeFilter, jobTypeFilter, statusFilter, searchQuery]);

  const scopesUrl = `/api/scopes${queryParams ? `?${queryParams}` : ""}`;

  const { data: scopes = [], isLoading: loadingScopes } = useQuery<Scope[]>({
    queryKey: ["/api/scopes", tradeFilter, jobTypeFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const res = await fetch(scopesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scopes");
      return res.json();
    },
  });

  const { data: stats } = useQuery<ScopeStats>({
    queryKey: ["/api/scopes/stats"],
  });

  const { data: trades = [] } = useQuery<ScopeTrade[]>({
    queryKey: ["/api/scope-trades"],
  });

  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const { data: scopeDetail, isLoading: loadingDetail } = useQuery<Scope>({
    queryKey: ["/api/scopes", detailScope?.id],
    queryFn: async () => {
      const res = await fetch(`/api/scopes/${detailScope!.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scope details");
      return res.json();
    },
    enabled: !!detailScope,
  });

  const seedTradesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/scope-trades/seed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scope-trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      toast({ title: "Default trades seeded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createScopeMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", "/api/scopes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      toast({ title: "Scope created successfully" });
      closeScopeForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateScopeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiRequest("PUT", `/api/scopes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      if (detailScope) {
        queryClient.invalidateQueries({ queryKey: ["/api/scopes", detailScope.id] });
      }
      toast({ title: "Scope updated successfully" });
      closeScopeForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteScopeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/scopes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      toast({ title: "Scope deleted" });
      setDeleteConfirm(null);
      if (detailScope) setDetailScope(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const duplicateScopeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/scopes/${id}/duplicate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      toast({ title: "Scope duplicated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ scopeId, ...data }: { scopeId: string; category?: string; description: string; details?: string; status: string }) => {
      return apiRequest("POST", `/api/scopes/${scopeId}/items`, data);
    },
    onSuccess: () => {
      if (detailScope) {
        queryClient.invalidateQueries({ queryKey: ["/api/scopes", detailScope.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      toast({ title: "Item added" });
      closeAddItemDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ scopeId, itemId, ...data }: { scopeId: string; itemId: string; status?: string }) => {
      return apiRequest("PUT", `/api/scopes/${scopeId}/items/${itemId}`, data);
    },
    onSuccess: () => {
      if (detailScope) {
        queryClient.invalidateQueries({ queryKey: ["/api/scopes", detailScope.id] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ scopeId, itemId }: { scopeId: string; itemId: string }) => {
      return apiRequest("DELETE", `/api/scopes/${scopeId}/items/${itemId}`);
    },
    onSuccess: () => {
      if (detailScope) {
        queryClient.invalidateQueries({ queryKey: ["/api/scopes", detailScope.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      toast({ title: "Item deleted" });
      setDeleteItemConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ scopeId, status }: { scopeId: string; status: string }) => {
      return apiRequest("PUT", `/api/scopes/${scopeId}/items/bulk-status`, { status });
    },
    onSuccess: () => {
      if (detailScope) {
        queryClient.invalidateQueries({ queryKey: ["/api/scopes", detailScope.id] });
      }
      toast({ title: "All items updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (data: { tradeId?: string; jobTypeId?: string; tradeName?: string; jobTypeName?: string; projectDescription?: string }) => {
      const res = await apiRequest("POST", "/api/scopes/ai-generate", data);
      return res.json();
    },
    onSuccess: (data: { items: AIGeneratedItem[] }) => {
      setAiGeneratedItems(data.items || []);
      toast({ title: `Generated ${data.items?.length || 0} items` });
    },
    onError: (error: Error) => {
      toast({ title: "AI Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (data: { scopeIds: string[]; recipientEmail: string }) => {
      return apiRequest("POST", "/api/scopes/email", data);
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setEmailDialogOpen(false);
      setEmailRecipient("");
      setSelectedScopeIds([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function openCreateScope() {
    setEditingScope(null);
    setFormName("");
    setFormTradeId("");
    setFormJobTypeId("");
    setFormDescription("");
    setScopeFormOpen(true);
  }

  function openEditScope(scope: Scope) {
    setEditingScope(scope);
    setFormName(scope.name);
    setFormTradeId(scope.tradeId || "");
    setFormJobTypeId(scope.jobTypeId || "");
    setFormDescription(scope.description || "");
    setScopeFormOpen(true);
  }

  function closeScopeForm() {
    setScopeFormOpen(false);
    setEditingScope(null);
  }

  function handleScopeSubmit() {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const data: Record<string, any> = {
      name: formName.trim(),
      tradeId: formTradeId || undefined,
      jobTypeId: formJobTypeId || undefined,
      description: formDescription.trim() || undefined,
    };
    if (editingScope) {
      updateScopeMutation.mutate({ id: editingScope.id, ...data });
    } else {
      createScopeMutation.mutate(data);
    }
  }

  function closeAddItemDialog() {
    setAddItemDialogOpen(false);
    setItemCategory("");
    setItemDescription("");
    setItemDetails("");
    setItemStatus("INCLUDED");
  }

  function handleAddItem() {
    if (!itemDescription.trim() || !detailScope) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    addItemMutation.mutate({
      scopeId: detailScope.id,
      category: itemCategory.trim() || undefined,
      description: itemDescription.trim(),
      details: itemDetails.trim() || undefined,
      status: itemStatus,
    });
  }

  function openAiDialog() {
    setAiProjectDescription("");
    setAiGeneratedItems([]);
    setAiDialogOpen(true);
  }

  function handleAiGenerate() {
    if (!detailScope) return;
    aiGenerateMutation.mutate({
      tradeId: detailScope.tradeId || undefined,
      jobTypeId: detailScope.jobTypeId || undefined,
      tradeName: scopeDetail?.trade?.name,
      jobTypeName: scopeDetail?.jobType?.name,
      projectDescription: aiProjectDescription.trim() || undefined,
    });
  }

  function handleAddAllAiItems() {
    if (!detailScope || aiGeneratedItems.length === 0) return;
    const promises = aiGeneratedItems.map((item) =>
      apiRequest("POST", `/api/scopes/${detailScope.id}/items`, {
        category: item.category,
        description: item.description,
        details: item.details,
        status: item.status,
      })
    );
    Promise.all(promises)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/scopes", detailScope.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
        toast({ title: `Added ${aiGeneratedItems.length} items` });
        setAiDialogOpen(false);
        setAiGeneratedItems([]);
      })
      .catch((err) => {
        toast({ title: "Error adding items", description: err.message, variant: "destructive" });
      });
  }

  function handleEmailSend() {
    if (!emailRecipient.trim()) {
      toast({ title: "Recipient email is required", variant: "destructive" });
      return;
    }
    if (selectedScopeIds.length === 0) {
      toast({ title: "No scopes selected", variant: "destructive" });
      return;
    }
    emailMutation.mutate({ scopeIds: selectedScopeIds, recipientEmail: emailRecipient.trim() });
  }

  function handlePrint(scopeId: string) {
    window.open(`/api/scopes/${scopeId}/print`, "_blank");
  }

  function toggleScopeSelection(scopeId: string) {
    setSelectedScopeIds((prev) =>
      prev.includes(scopeId) ? prev.filter((id) => id !== scopeId) : [...prev, scopeId]
    );
  }

  const isScopeFormPending = createScopeMutation.isPending || updateScopeMutation.isPending;

  const groupedItems = useMemo(() => {
    if (!scopeDetail?.items) return {};
    const groups: Record<string, ScopeItem[]> = {};
    for (const item of scopeDetail.items) {
      const cat = item.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [scopeDetail?.items]);

  if (loadingScopes) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Scope of Works">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-scope-of-works-title">Scope of Works</h1>
          <p className="text-sm text-muted-foreground">Manage scope templates, items and trades</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {trades.length === 0 && (
            <Button
              variant="outline"
              onClick={() => seedTradesMutation.mutate()}
              disabled={seedTradesMutation.isPending}
              data-testid="button-seed-trades"
            >
              {seedTradesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Layers className="h-4 w-4 mr-2" />
              Seed Default Trades
            </Button>
          )}
          {selectedScopeIds.length > 0 && (
            <Button variant="outline" onClick={() => setEmailDialogOpen(true)} data-testid="button-email-scopes">
              <Mail className="h-4 w-4 mr-2" />
              Email ({selectedScopeIds.length})
            </Button>
          )}
          <Button onClick={openCreateScope} data-testid="button-add-scope">
            <Plus className="h-4 w-4 mr-2" />
            Add Scope
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scopes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-scopes">{stats?.total ?? scopes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Scopes</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-scopes">{stats?.active ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Scopes</CardTitle>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-draft-scopes">{stats?.draft ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-trades">{stats?.trades ?? trades.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search scopes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-scopes"
          />
        </div>
        <Select value={tradeFilter} onValueChange={setTradeFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-trade-filter">
            <SelectValue placeholder="All Trades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Trades</SelectItem>
            {trades.map((trade) => (
              <SelectItem key={trade.id} value={trade.id} data-testid={`option-trade-${trade.id}`}>
                {trade.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-jobtype-filter">
            <SelectValue placeholder="All Job Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Job Types</SelectItem>
            {jobTypes.map((jt) => (
              <SelectItem key={jt.id} value={jt.id} data-testid={`option-jobtype-${jt.id}`}>
                {jt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT" data-testid="option-status-DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE" data-testid="option-status-ACTIVE">Active</SelectItem>
            <SelectItem value="ARCHIVED" data-testid="option-status-ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Scopes ({scopes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scopes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-scopes">
              No scopes found. Create your first scope to get started.
            </div>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedScopeIds.length === scopes.length && scopes.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedScopeIds(scopes.map((s) => s.id));
                          } else {
                            setSelectedScopeIds([]);
                          }
                        }}
                        data-testid="checkbox-select-all"
                        aria-label="Select all scopes"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Job Type</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-20">Items</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-28">Created</TableHead>
                    <TableHead className="w-48 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopes.map((scope) => (
                    <TableRow key={scope.id} data-testid={`row-scope-${scope.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedScopeIds.includes(scope.id)}
                          onCheckedChange={() => toggleScopeSelection(scope.id)}
                          data-testid={`checkbox-scope-${scope.id}`}
                          aria-label={`Select ${scope.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-scope-name-${scope.id}`}>
                        {scope.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-scope-trade-${scope.id}`}>
                        {scope.trade?.name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-scope-jobtype-${scope.id}`}>
                        {scope.jobType?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <ScopeStatusBadge status={scope.status} />
                      </TableCell>
                      <TableCell data-testid={`text-scope-items-${scope.id}`}>
                        {scope.itemCount ?? 0}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-scope-source-${scope.id}`}>
                        {scope.source || "Manual"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-scope-created-${scope.id}`}>
                        {scope.createdAt ? format(new Date(scope.createdAt), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDetailScope(scope)}
                            data-testid={`button-view-scope-${scope.id}`}
                            aria-label="View scope"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditScope(scope)}
                            data-testid={`button-edit-scope-${scope.id}`}
                            aria-label="Edit scope"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicateScopeMutation.mutate(scope.id)}
                            data-testid={`button-duplicate-scope-${scope.id}`}
                            aria-label="Duplicate scope"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(scope)}
                            data-testid={`button-delete-scope-${scope.id}`}
                            aria-label="Delete scope"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedScopeIds([scope.id]);
                              setEmailDialogOpen(true);
                            }}
                            data-testid={`button-email-scope-${scope.id}`}
                            aria-label="Email scope"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handlePrint(scope.id)}
                            data-testid={`button-print-scope-${scope.id}`}
                            aria-label="Print scope"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={scopeFormOpen} onOpenChange={setScopeFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-scope-form-title">
              {editingScope ? "Edit Scope" : "Create Scope"}
            </DialogTitle>
            <DialogDescription>
              {editingScope ? "Update scope details" : "Add a new scope of works template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scope-name">Name</Label>
              <Input
                id="scope-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Scope name..."
                data-testid="input-scope-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope-trade">Trade</Label>
              <Select value={formTradeId} onValueChange={setFormTradeId}>
                <SelectTrigger data-testid="select-scope-trade">
                  <SelectValue placeholder="Select trade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Trade</SelectItem>
                  {trades.map((trade) => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope-jobtype">Job Type</Label>
              <Select value={formJobTypeId} onValueChange={setFormJobTypeId}>
                <SelectTrigger data-testid="select-scope-jobtype">
                  <SelectValue placeholder="Select job type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Job Type</SelectItem>
                  {jobTypes.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>
                      {jt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope-description">Description</Label>
              <Textarea
                id="scope-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Scope description..."
                rows={3}
                data-testid="textarea-scope-description"
              />
            </div>
            {editingScope?.source && (
              <div className="space-y-2">
                <Label>Source</Label>
                <p className="text-sm text-muted-foreground" data-testid="text-scope-source">{editingScope.source}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeScopeForm} data-testid="button-cancel-scope">
              Cancel
            </Button>
            <Button onClick={handleScopeSubmit} disabled={isScopeFormPending} data-testid="button-save-scope">
              {isScopeFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingScope ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scope</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteScopeMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
            >
              {deleteScopeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detailScope} onOpenChange={(open) => !open && setDetailScope(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-scope-detail-title">
              <FileText className="h-5 w-5" />
              {scopeDetail?.name || detailScope?.name || "Scope Detail"}
            </DialogTitle>
            <DialogDescription>
              View and manage scope items
            </DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : scopeDetail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Trade</p>
                  <p className="text-sm font-medium" data-testid="text-detail-trade">{scopeDetail.trade?.name || "-"}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Job Type</p>
                  <p className="text-sm font-medium" data-testid="text-detail-jobtype">{scopeDetail.jobType?.name || "-"}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <ScopeStatusBadge status={scopeDetail.status} />
                </div>
                {scopeDetail.description && (
                  <>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-sm" data-testid="text-detail-description">{scopeDetail.description}</p>
                    </div>
                  </>
                )}
              </div>

              <Separator />

              <Tabs defaultValue="items">
                <TabsList>
                  <TabsTrigger value="items" data-testid="tab-scope-items">
                    Scope Items ({scopeDetail.items?.length || 0})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="items" className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => setAddItemDialogOpen(true)} data-testid="button-add-item">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                      <Button variant="outline" size="sm" onClick={openAiDialog} data-testid="button-ai-generate">
                        <Sparkles className="h-4 w-4 mr-1" />
                        Generate with AI
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => bulkStatusMutation.mutate({ scopeId: scopeDetail.id, status: "INCLUDED" })}
                        data-testid="button-bulk-included"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        All Included
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => bulkStatusMutation.mutate({ scopeId: scopeDetail.id, status: "EXCLUDED" })}
                        data-testid="button-bulk-excluded"
                      >
                        <X className="h-4 w-4 mr-1" />
                        All Excluded
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => bulkStatusMutation.mutate({ scopeId: scopeDetail.id, status: "NA" })}
                        data-testid="button-bulk-na"
                      >
                        <Minus className="h-4 w-4 mr-1" />
                        All N/A
                      </Button>
                    </div>
                  </div>

                  {Object.keys(groupedItems).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="text-no-items">
                      No items yet. Add items manually or generate with AI.
                    </div>
                  ) : (
                    Object.entries(groupedItems).map(([category, items]) => (
                      <div key={category} className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground" data-testid={`text-category-${category}`}>
                          {category} ({items.length})
                        </h3>
                        <div className="border rounded-md overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="w-28">Status</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                                  <TableCell className="font-medium" data-testid={`text-item-desc-${item.id}`}>
                                    {item.description}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm" data-testid={`text-item-details-${item.id}`}>
                                    {item.details || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={item.status}
                                      onValueChange={(val) =>
                                        updateItemMutation.mutate({
                                          scopeId: scopeDetail.id,
                                          itemId: item.id,
                                          status: val,
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        className="w-[110px]"
                                        data-testid={`select-item-status-${item.id}`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="INCLUDED">Included</SelectItem>
                                        <SelectItem value="EXCLUDED">Excluded</SelectItem>
                                        <SelectItem value="NA">N/A</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setDeleteItemConfirm(item)}
                                      data-testid={`button-delete-item-${item.id}`}
                                      aria-label="Delete item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-add-item-title">Add Custom Item</DialogTitle>
            <DialogDescription>Add a new item to this scope</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Input
                id="item-category"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                placeholder="e.g. Structural, Finishes..."
                data-testid="input-item-category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-description">Description *</Label>
              <Input
                id="item-description"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Item description..."
                data-testid="input-item-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-details">Details</Label>
              <Textarea
                id="item-details"
                value={itemDetails}
                onChange={(e) => setItemDetails(e.target.value)}
                placeholder="Additional details..."
                rows={3}
                data-testid="textarea-item-details"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-status">Status</Label>
              <Select value={itemStatus} onValueChange={(val) => setItemStatus(val as ItemStatus)}>
                <SelectTrigger data-testid="select-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCLUDED">Included</SelectItem>
                  <SelectItem value="EXCLUDED">Excluded</SelectItem>
                  <SelectItem value="NA">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAddItemDialog} data-testid="button-cancel-item">
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={addItemMutation.isPending} data-testid="button-save-item">
              {addItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItemConfirm} onOpenChange={(open) => !open && setDeleteItemConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-item">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteItemConfirm && detailScope) {
                  deleteItemMutation.mutate({ scopeId: detailScope.id, itemId: deleteItemConfirm.id });
                }
              }}
              data-testid="button-confirm-delete-item"
            >
              {deleteItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-ai-dialog-title">
              <Sparkles className="h-5 w-5" />
              Generate Scope Items with AI
            </DialogTitle>
            <DialogDescription>
              AI will generate scope items based on the trade and job type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Trade</p>
                <p className="text-sm font-medium" data-testid="text-ai-trade">{scopeDetail?.trade?.name || "Not set"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Job Type</p>
                <p className="text-sm font-medium" data-testid="text-ai-jobtype">{scopeDetail?.jobType?.name || "Not set"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-description">Project Description (optional)</Label>
              <Textarea
                id="ai-description"
                value={aiProjectDescription}
                onChange={(e) => setAiProjectDescription(e.target.value)}
                placeholder="Provide context about the project for better results..."
                rows={3}
                data-testid="textarea-ai-description"
              />
            </div>
            <Button
              onClick={handleAiGenerate}
              disabled={aiGenerateMutation.isPending}
              data-testid="button-generate-ai"
            >
              {aiGenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>

            {aiGeneratedItems.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Generated Items ({aiGeneratedItems.length})</h3>
                  <Button onClick={handleAddAllAiItems} data-testid="button-add-all-ai-items">
                    <Plus className="h-4 w-4 mr-2" />
                    Add All Items
                  </Button>
                </div>
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiGeneratedItems.map((item, idx) => (
                        <TableRow key={idx} data-testid={`row-ai-item-${idx}`}>
                          <TableCell className="text-muted-foreground">{item.category}</TableCell>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.details}</TableCell>
                          <TableCell>
                            <ItemStatusBadge status={item.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-email-dialog-title">
              <Mail className="h-5 w-5" />
              Email Scopes
            </DialogTitle>
            <DialogDescription>
              Send {selectedScopeIds.length} scope(s) via email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-recipient">Recipient Email</Label>
              <Input
                id="email-recipient"
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="recipient@example.com"
                data-testid="input-email-recipient"
              />
            </div>
            <div className="space-y-2">
              <Label>Selected Scopes</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                {selectedScopeIds.map((id) => {
                  const scope = scopes.find((s) => s.id === id);
                  return scope ? (
                    <div key={id} data-testid={`text-email-scope-${id}`}>
                      {scope.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} data-testid="button-cancel-email">
              Cancel
            </Button>
            <Button onClick={handleEmailSend} disabled={emailMutation.isPending} data-testid="button-send-email">
              {emailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
