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
  costCodeId?: string | null;
}

interface CostCodeOption {
  id: string;
  code: string;
  name: string;
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

function getStatusSelectColor(status: string): string {
  switch (status) {
    case "INCLUDED":
      return "border-green-600 text-green-500 [&>svg]:text-green-500";
    case "EXCLUDED":
      return "border-red-600 text-red-500 [&>svg]:text-red-500";
    case "NA":
      return "border-orange-500 text-orange-400 [&>svg]:text-orange-400";
    default:
      return "";
  }
}

function ItemStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "INCLUDED":
      return <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-item-${status}`}>Included</Badge>;
    case "EXCLUDED":
      return <Badge variant="destructive" data-testid={`badge-item-${status}`}>Excluded</Badge>;
    case "NA":
      return <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20" data-testid={`badge-item-${status}`}>N/A</Badge>;
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

  const [manageTradesOpen, setManageTradesOpen] = useState(false);

  const [createModeDialogOpen, setCreateModeDialogOpen] = useState(false);
  const [aiCreateOpen, setAiCreateOpen] = useState(false);
  const [aiCreateStep, setAiCreateStep] = useState<"form" | "generating" | "review">("form");
  const [aiCreateName, setAiCreateName] = useState("");
  const [aiCreateTradeId, setAiCreateTradeId] = useState("");
  const [aiCreateJobTypeId, setAiCreateJobTypeId] = useState("");
  const [aiCreateDescription, setAiCreateDescription] = useState("");
  const [aiCreateGeneratedItems, setAiCreateGeneratedItems] = useState<AIGeneratedItem[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "configure" | "ai-ask" | "processing" | "review">("upload");
  const [importFileName, setImportFileName] = useState("");
  const [importParsedItems, setImportParsedItems] = useState<{ category: string; description: string; details: string }[]>([]);
  const [importName, setImportName] = useState("");
  const [importTradeId, setImportTradeId] = useState("");
  const [importJobTypeId, setImportJobTypeId] = useState("");
  const [importDescription, setImportDescription] = useState("");
  const [importAiFormat, setImportAiFormat] = useState(false);
  const [importFinalItems, setImportFinalItems] = useState<AIGeneratedItem[]>([]);
  const [importUploading, setImportUploading] = useState(false);

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

  const { data: rawTrades = [] } = useQuery<ScopeTrade[]>({
    queryKey: ["/api/scope-trades"],
  });

  const trades = useMemo(() => [...rawTrades].sort((a, b) => a.name.localeCompare(b.name)), [rawTrades]);

  const { data: costCodes = [] } = useQuery<CostCodeOption[]>({
    queryKey: ["/api/scope-trades/cost-codes"],
    enabled: manageTradesOpen,
  });

  const updateTradeMutation = useMutation({
    mutationFn: async ({ id, costCodeId }: { id: string; costCodeId: string | null }) => {
      return apiRequest("PUT", `/api/scope-trades/${id}`, { costCodeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scope-trades"] });
      toast({ title: "Trade updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: rawJobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const jobTypes = useMemo(() => [...rawJobTypes].sort((a, b) => a.name.localeCompare(b.name)), [rawJobTypes]);

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

  const aiCreateScopeMutation = useMutation({
    mutationFn: async (data: { name: string; tradeId?: string; jobTypeId?: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/scopes/ai-create", data);
      return res.json();
    },
    onSuccess: (data: { scope: Scope; items: AIGeneratedItem[]; count: number }) => {
      setAiCreateGeneratedItems(data.items || []);
      setAiCreateStep("review");
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      toast({ title: `Scope created with ${data.count || 0} items` });
    },
    onError: (error: Error) => {
      toast({ title: "AI Creation Failed", description: error.message, variant: "destructive" });
      setAiCreateStep("form");
    },
  });

  function openCreateModeDialog() {
    setCreateModeDialogOpen(true);
  }

  function handleChooseManual() {
    setCreateModeDialogOpen(false);
    openCreateScope();
  }

  function handleChooseAI() {
    setCreateModeDialogOpen(false);
    setAiCreateOpen(true);
    setAiCreateStep("form");
    setAiCreateName("");
    setAiCreateTradeId("");
    setAiCreateJobTypeId("");
    setAiCreateDescription("");
    setAiCreateGeneratedItems([]);
  }

  function closeAiCreate() {
    setAiCreateOpen(false);
    setAiCreateStep("form");
    setAiCreateName("");
    setAiCreateTradeId("");
    setAiCreateJobTypeId("");
    setAiCreateDescription("");
    setAiCreateGeneratedItems([]);
  }

  function handleAiCreateSubmit() {
    if (!aiCreateName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!aiCreateTradeId || aiCreateTradeId === "none") {
      toast({ title: "Please select a trade for AI generation", variant: "destructive" });
      return;
    }
    setAiCreateStep("generating");
    aiCreateScopeMutation.mutate({
      name: aiCreateName.trim(),
      tradeId: aiCreateTradeId,
      jobTypeId: aiCreateJobTypeId && aiCreateJobTypeId !== "none" ? aiCreateJobTypeId : undefined,
      description: aiCreateDescription.trim() || undefined,
    });
  }

  function handleChooseImport() {
    setCreateModeDialogOpen(false);
    setImportOpen(true);
    setImportStep("upload");
    setImportFileName("");
    setImportParsedItems([]);
    setImportName("");
    setImportTradeId("");
    setImportJobTypeId("");
    setImportDescription("");
    setImportAiFormat(false);
    setImportFinalItems([]);
    setImportUploading(false);
  }

  function closeImport() {
    setImportOpen(false);
    setImportStep("upload");
    setImportFileName("");
    setImportParsedItems([]);
    setImportName("");
    setImportTradeId("");
    setImportJobTypeId("");
    setImportDescription("");
    setImportAiFormat(false);
    setImportFinalItems([]);
    setImportUploading(false);
  }

  async function handleImportFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/scopes/import-parse", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Upload Failed", description: err.message || "Failed to parse file", variant: "destructive" });
        setImportUploading(false);
        return;
      }
      const data = await res.json();
      setImportParsedItems(data.items);
      setImportFileName(data.fileName || file.name);
      setImportStep("configure");
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setImportUploading(false);
    }
  }

  function handleImportConfigure() {
    if (!importName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!importTradeId || importTradeId === "none") {
      toast({ title: "Please select a trade", variant: "destructive" });
      return;
    }
    setImportStep("ai-ask");
  }

  const importCreateMutation = useMutation({
    mutationFn: async (data: { name: string; tradeId: string; jobTypeId?: string; description?: string; aiFormat: boolean; items: any[] }) => {
      const res = await apiRequest("POST", "/api/scopes/import-create", data);
      return res.json();
    },
    onSuccess: (data: { scope: Scope; items: any[]; count: number; aiFormatted: boolean }) => {
      setImportFinalItems(data.items || []);
      setImportStep("review");
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scopes/stats"] });
      toast({ title: `Scope imported with ${data.count || 0} items${data.aiFormatted ? " (AI formatted)" : ""}` });
    },
    onError: (error: Error) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
      setImportStep("ai-ask");
    },
  });

  function handleImportWithAi(useAi: boolean) {
    setImportAiFormat(useAi);
    setImportStep("processing");
    importCreateMutation.mutate({
      name: importName.trim(),
      tradeId: importTradeId,
      jobTypeId: importJobTypeId && importJobTypeId !== "none" ? importJobTypeId : undefined,
      description: importDescription.trim() || undefined,
      aiFormat: useAi,
      items: importParsedItems,
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
          {trades.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setManageTradesOpen(true)}
              data-testid="button-manage-trades"
            >
              <Layers className="h-4 w-4 mr-2" />
              Manage Trades
            </Button>
          )}
          {selectedScopeIds.length > 0 && (
            <Button variant="outline" onClick={() => setEmailDialogOpen(true)} data-testid="button-email-scopes">
              <Mail className="h-4 w-4 mr-2" />
              Email ({selectedScopeIds.length})
            </Button>
          )}
          <Button onClick={openCreateModeDialog} data-testid="button-add-scope">
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
                                        className={`w-[110px] ${getStatusSelectColor(item.status)}`}
                                        data-testid={`select-item-status-${item.id}`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="INCLUDED" className="text-green-500">Included</SelectItem>
                                        <SelectItem value="EXCLUDED" className="text-red-500">Excluded</SelectItem>
                                        <SelectItem value="NA" className="text-orange-400">N/A</SelectItem>
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
                <SelectTrigger className={getStatusSelectColor(itemStatus)} data-testid="select-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCLUDED" className="text-green-500">Included</SelectItem>
                  <SelectItem value="EXCLUDED" className="text-red-500">Excluded</SelectItem>
                  <SelectItem value="NA" className="text-orange-400">N/A</SelectItem>
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

      <Dialog open={createModeDialogOpen} onOpenChange={setCreateModeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-create-mode-title">Create Scope</DialogTitle>
            <DialogDescription>Choose how you want to create your scope of works</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <button
              onClick={handleChooseManual}
              className="flex flex-col items-center gap-3 p-6 border rounded-md hover-elevate cursor-pointer text-center"
              data-testid="button-create-manual"
            >
              <Pencil className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Create Manual</p>
                <p className="text-xs text-muted-foreground mt-1">Build your scope from scratch</p>
              </div>
            </button>
            <button
              onClick={handleChooseAI}
              className="flex flex-col items-center gap-3 p-6 border rounded-md hover-elevate cursor-pointer text-center border-primary/30 bg-primary/5"
              data-testid="button-create-ai"
            >
              <Sparkles className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Create with AI</p>
                <p className="text-xs text-muted-foreground mt-1">AI generates 40-80 items</p>
              </div>
            </button>
            <button
              onClick={handleChooseImport}
              className="flex flex-col items-center gap-3 p-6 border rounded-md hover-elevate cursor-pointer text-center"
              data-testid="button-create-import"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Import File</p>
                <p className="text-xs text-muted-foreground mt-1">Upload Excel or CSV file</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiCreateOpen} onOpenChange={(open) => { if (!open) closeAiCreate(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-ai-create-title">
              <Sparkles className="h-5 w-5" />
              {aiCreateStep === "form" && "Create Scope with AI"}
              {aiCreateStep === "generating" && "Generating Comprehensive Scope..."}
              {aiCreateStep === "review" && "AI-Generated Scope"}
            </DialogTitle>
            <DialogDescription>
              {aiCreateStep === "form" && "Provide details and AI will generate an extremely comprehensive scope of works with 40-80 detailed items."}
              {aiCreateStep === "generating" && "AI is creating your scope and generating detailed items. This may take 30-60 seconds."}
              {aiCreateStep === "review" && `Generated ${aiCreateGeneratedItems.length} items. Your scope has been created and all items added.`}
            </DialogDescription>
          </DialogHeader>

          {aiCreateStep === "form" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-scope-name">Scope Name *</Label>
                <Input
                  id="ai-scope-name"
                  value={aiCreateName}
                  onChange={(e) => setAiCreateName(e.target.value)}
                  placeholder="e.g. Bricklaying Scope of Works"
                  data-testid="input-ai-scope-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-scope-trade">Trade *</Label>
                <Select value={aiCreateTradeId} onValueChange={setAiCreateTradeId}>
                  <SelectTrigger data-testid="select-ai-scope-trade">
                    <SelectValue placeholder="Select trade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trades.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-scope-jobtype">Job Type (optional)</Label>
                <Select value={aiCreateJobTypeId} onValueChange={setAiCreateJobTypeId}>
                  <SelectTrigger data-testid="select-ai-scope-jobtype">
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
                <Label htmlFor="ai-scope-desc">Project Description (optional)</Label>
                <Textarea
                  id="ai-scope-desc"
                  value={aiCreateDescription}
                  onChange={(e) => setAiCreateDescription(e.target.value)}
                  placeholder="Describe the project for more targeted scope items..."
                  rows={3}
                  data-testid="textarea-ai-scope-description"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeAiCreate} data-testid="button-cancel-ai-create">
                  Cancel
                </Button>
                <Button
                  onClick={handleAiCreateSubmit}
                  disabled={!aiCreateName.trim() || !aiCreateTradeId || aiCreateTradeId === "none"}
                  data-testid="button-submit-ai-create"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Scope
                </Button>
              </DialogFooter>
            </div>
          )}

          {aiCreateStep === "generating" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">AI is generating a comprehensive scope of works...</p>
              <p className="text-xs text-muted-foreground">This includes general requirements, materials, methodology, QA, safety, warranties, and more</p>
            </div>
          )}

          {aiCreateStep === "review" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <span className="font-medium">{aiCreateGeneratedItems.length}</span> items generated across{" "}
                <span className="font-medium">
                  {new Set(aiCreateGeneratedItems.map(i => i.category)).size}
                </span>{" "}
                categories. All items have been added to your scope.
              </div>

              <div className="border rounded-md overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiCreateGeneratedItems.map((item, idx) => (
                      <TableRow key={idx} data-testid={`row-ai-create-item-${idx}`}>
                        <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                        <TableCell className="font-medium text-sm">{item.description}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{item.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button onClick={closeAiCreate} data-testid="button-close-ai-create">
                  <Check className="h-4 w-4 mr-2" />
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) closeImport(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-import-title">
              <Upload className="h-5 w-5" />
              {importStep === "upload" && "Import Scope from File"}
              {importStep === "configure" && "Configure Imported Scope"}
              {importStep === "ai-ask" && "AI Check & Format"}
              {importStep === "processing" && (importAiFormat ? "AI is Formatting Items..." : "Creating Scope...")}
              {importStep === "review" && "Import Complete"}
            </DialogTitle>
            <DialogDescription>
              {importStep === "upload" && "Upload an Excel (.xlsx) or CSV file containing scope items."}
              {importStep === "configure" && `Parsed ${importParsedItems.length} items from ${importFileName}. Configure your scope details.`}
              {importStep === "ai-ask" && "Would you like AI to check and reformat the imported items into proper scope format?"}
              {importStep === "processing" && (importAiFormat ? "AI is reviewing, standardizing, and reformatting your imported items. This may take 30-60 seconds." : "Creating your scope with the imported items...")}
              {importStep === "review" && `Scope created with ${importFinalItems.length} items${importAiFormat ? " (AI formatted)" : ""}.`}
            </DialogDescription>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed rounded-md p-8 text-center">
                {importUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Parsing file...</p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-3 cursor-pointer">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) or CSV files supported</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleImportFileUpload}
                      data-testid="input-import-file"
                    />
                  </label>
                )}
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">File format tips:</p>
                <p>Your file should have column headers in the first row. The system will auto-detect columns named:</p>
                <p>Description/Item/Scope/Text (required), Category/Section/Group, Details/Notes/Specs</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeImport} data-testid="button-cancel-import">
                  Cancel
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === "configure" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <span className="font-medium">{importParsedItems.length}</span> items parsed from <span className="font-medium">{importFileName}</span>
              </div>
              <div className="border rounded-md overflow-auto max-h-40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-36">Category</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importParsedItems.slice(0, 10).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                        <TableCell className="text-sm">{item.description}</TableCell>
                      </TableRow>
                    ))}
                    {importParsedItems.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground text-xs">
                          ... and {importParsedItems.length - 10} more items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="import-scope-name">Scope Name *</Label>
                <Input
                  id="import-scope-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="e.g. Imported Bricklaying Scope"
                  data-testid="input-import-scope-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-scope-trade">Trade *</Label>
                <Select value={importTradeId} onValueChange={setImportTradeId}>
                  <SelectTrigger data-testid="select-import-scope-trade">
                    <SelectValue placeholder="Select trade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trades.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-scope-jobtype">Job Type (optional)</Label>
                <Select value={importJobTypeId} onValueChange={setImportJobTypeId}>
                  <SelectTrigger data-testid="select-import-scope-jobtype">
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
                <Label htmlFor="import-scope-desc">Project Description (optional)</Label>
                <Textarea
                  id="import-scope-desc"
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  placeholder="Describe the project context for better AI formatting..."
                  rows={2}
                  data-testid="textarea-import-scope-description"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep("upload")} data-testid="button-import-back">
                  Back
                </Button>
                <Button
                  onClick={handleImportConfigure}
                  disabled={!importName.trim() || !importTradeId || importTradeId === "none"}
                  data-testid="button-import-next"
                >
                  Next
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === "ai-ask" && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-3">
                <Sparkles className="h-12 w-12 mx-auto text-primary" />
                <p className="text-lg font-medium">Would you like AI to check and update your imported items?</p>
                <p className="text-sm text-muted-foreground">
                  AI will review your {importParsedItems.length} imported items and:
                </p>
              </div>
              <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Standardize descriptions with professional construction language</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Fix and organize categories into proper scope sections</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Add technical details, Australian Standards references, and specifications</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Remove duplicates and add any obviously missing items</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleImportWithAi(false)}
                  className="h-auto py-4 flex flex-col gap-1"
                  data-testid="button-import-no-ai"
                >
                  <span className="font-medium">Import As-Is</span>
                  <span className="text-xs text-muted-foreground">Keep original formatting</span>
                </Button>
                <Button
                  onClick={() => handleImportWithAi(true)}
                  className="h-auto py-4 flex flex-col gap-1"
                  data-testid="button-import-with-ai"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">AI Check & Update</span>
                  <span className="text-xs text-muted-foreground">Takes 30-60 seconds</span>
                </Button>
              </div>
            </div>
          )}

          {importStep === "processing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              {importAiFormat ? (
                <>
                  <p className="text-muted-foreground">AI is reviewing and reformatting your scope items...</p>
                  <p className="text-xs text-muted-foreground">Standardizing descriptions, organizing categories, adding details</p>
                </>
              ) : (
                <p className="text-muted-foreground">Creating your scope...</p>
              )}
            </div>
          )}

          {importStep === "review" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <span className="font-medium">{importFinalItems.length}</span> items imported
                {importAiFormat && " and formatted by AI"} across{" "}
                <span className="font-medium">
                  {new Set(importFinalItems.map(i => i.category)).size}
                </span>{" "}
                categories.
              </div>

              <div className="border rounded-md overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importFinalItems.map((item, idx) => (
                      <TableRow key={idx} data-testid={`row-import-item-${idx}`}>
                        <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                        <TableCell className="font-medium text-sm">{item.description}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{item.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button onClick={closeImport} data-testid="button-close-import">
                  <Check className="h-4 w-4 mr-2" />
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manageTradesOpen} onOpenChange={setManageTradesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-manage-trades-title">Manage Trades</DialogTitle>
            <DialogDescription>
              Link scope trades to cost codes for accurate supplier matching in tenders.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trade</TableHead>
                <TableHead>Linked Cost Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => {
                return (
                  <TableRow key={trade.id} data-testid={`row-trade-${trade.id}`}>
                    <TableCell className="font-medium">{trade.name}</TableCell>
                    <TableCell>
                      <Select
                        value={trade.costCodeId || "none"}
                        onValueChange={(val) => {
                          updateTradeMutation.mutate({
                            id: trade.id,
                            costCodeId: val === "none" ? null : val,
                          });
                        }}
                      >
                        <SelectTrigger data-testid={`select-trade-cost-code-${trade.id}`}>
                          <SelectValue placeholder="Select cost code..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No cost code linked</SelectItem>
                          {costCodes.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.code} - {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTradesOpen(false)} data-testid="button-close-manage-trades">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
