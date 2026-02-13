import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DOMPurify from "dompurify";
import { CONTRACT_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Shield,
  Scale,
  Building2,
  Filter,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Save,
  Loader2,
  Type,
} from "lucide-react";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface ContractHubItem {
  jobId: string;
  jobNumber: string;
  jobName: string;
  jobStatus: string;
  client: string | null;
  contractId: string | null;
  contractStatus: string;
  contractNumber: string | null;
  originalContractValue: string | null;
  revisedContractValue: string | null;
  contractType: string | null;
  riskRating: number | null;
  contractUpdatedAt: string | null;
  panelCount: number;
  maxLifecycleStatus: number;
  workStatus: string;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Clock }> = {
  AWAITING_CONTRACT: { label: "Awaiting Contract", variant: "outline", icon: Clock },
  CONTRACT_REVIEW: { label: "Contract Review", variant: "secondary", icon: FileText },
  CONTRACT_EXECUTED: { label: "Contract Executed", variant: "default", icon: CheckCircle },
};

function formatCurrency(value: string | null): string {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function getRiskBadgeVariant(rating: number | null): "default" | "secondary" | "outline" | "destructive" {
  if (!rating) return "outline";
  if (rating <= 3) return "default";
  if (rating <= 6) return "secondary";
  return "destructive";
}

const FONT_OPTIONS = [
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
  { value: "Courier New", label: "Courier New" },
];

const FONT_SIZE_OPTIONS = [
  { value: "1", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "4", label: "Medium" },
  { value: "5", label: "Large" },
  { value: "6", label: "X-Large" },
];

interface POTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function POTermsDialog({ open, onOpenChange }: POTermsDialogProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [currentFont, setCurrentFont] = useState("Arial");
  const [currentFontSize, setCurrentFontSize] = useState("3");
  const [editorReady, setEditorReady] = useState(false);

  const { data: termsData, isLoading } = useQuery<{ poTermsHtml: string; includePOTerms: boolean }>({
    queryKey: [SETTINGS_ROUTES.PO_TERMS],
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (open) {
      setEditorReady(false);
      const timer = setTimeout(() => setEditorReady(true), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (open && editorReady && editorRef.current && termsData) {
      editorRef.current.innerHTML = DOMPurify.sanitize(termsData.poTermsHtml || "");
    }
  }, [open, editorReady, termsData]);

  const saveMutation = useMutation({
    mutationFn: async (html: string) => {
      return apiRequest("PUT", SETTINGS_ROUTES.PO_TERMS, { poTermsHtml: html });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.PO_TERMS] });
      toast({ title: "PO Terms & Conditions saved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save PO Terms", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = useCallback(() => {
    if (!editorRef.current) return;
    saveMutation.mutate(editorRef.current.innerHTML);
  }, [saveMutation]);

  const execCommand = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  const handleFontChange = useCallback((font: string) => {
    setCurrentFont(font);
    execCommand("fontName", font);
  }, [execCommand]);

  const handleFontSizeChange = useCallback((size: string) => {
    setCurrentFontSize(size);
    execCommand("fontSize", size);
  }, [execCommand]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[85vh] p-0 gap-0 overflow-hidden" data-testid="dialog-po-terms">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2" data-testid="text-po-terms-title">
            <FileText className="h-5 w-5" />
            PO Terms & Conditions
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col" style={{ height: "calc(85vh - 80px)", maxHeight: "600px" }}>
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
            <Select value={currentFont} onValueChange={handleFontChange}>
              <SelectTrigger className="w-[150px]" data-testid="select-font-family">
                <Type className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={currentFontSize} onValueChange={handleFontSizeChange}>
              <SelectTrigger className="w-[110px]" data-testid="select-font-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6" />

            <Button
              size="icon"
              variant="ghost"
              onClick={() => execCommand("bold")}
              data-testid="button-bold"
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => execCommand("italic")}
              data-testid="button-italic"
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => execCommand("underline")}
              data-testid="button-underline"
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button
              size="icon"
              variant="ghost"
              onClick={() => execCommand("insertUnorderedList")}
              data-testid="button-bullet-list"
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => execCommand("insertOrderedList")}
              data-testid="button-numbered-list"
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden p-4" style={{ minHeight: 0 }}>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <div
                ref={editorRef}
                contentEditable
                className="h-full p-4 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm leading-relaxed overflow-y-auto"
                style={{ fontFamily: "Arial" }}
                data-testid="editor-po-terms"
                suppressContentEditableWarning
              />
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30 shrink-0">
            <p className="text-xs text-muted-foreground">
              These terms will be attached to printed Purchase Orders when enabled in Settings
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-terms">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-terms">
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Terms
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractHubPage() {
  useDocumentTitle("Contracts");
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workStatusFilter, setWorkStatusFilter] = useState<string>("all");
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  const { data: hubItems = [], isLoading } = useQuery<ContractHubItem[]>({
    queryKey: [CONTRACT_ROUTES.HUB],
  });

  const filteredItems = hubItems.filter(item => {
    const matchesSearch = !searchQuery || 
      item.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.client?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || item.contractStatus === statusFilter;
    const matchesWorkStatus = workStatusFilter === "all" || item.workStatus === workStatusFilter;

    return matchesSearch && matchesStatus && matchesWorkStatus;
  });

  const stats = {
    total: hubItems.length,
    awaiting: hubItems.filter(i => i.contractStatus === "AWAITING_CONTRACT").length,
    review: hubItems.filter(i => i.contractStatus === "CONTRACT_REVIEW").length,
    executed: hubItems.filter(i => i.contractStatus === "CONTRACT_EXECUTED").length,
    atRisk: hubItems.filter(i => i.riskRating && i.riskRating >= 7).length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="contract-hub-page" role="main" aria-label="Contract Hub">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Contract Hub</h1>
            <PageHelpButton pageHelpKey="page.contracts" />
          </div>
          <p className="text-muted-foreground">Manage contracts and legal documentation for all projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTermsDialogOpen(true)}
            data-testid="button-view-po-terms"
          >
            <FileText className="h-4 w-4 mr-2" />
            View PO Terms & Conditions
          </Button>
          <Scale className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Legal Adviser</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="stat-total-jobs">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-awaiting">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10">
                <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.awaiting}</p>
                <p className="text-xs text-muted-foreground">Awaiting Contract</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-review">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.review}</p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-executed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.executed}</p>
                <p className="text-xs text-muted-foreground">Executed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-at-risk">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.atRisk}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search contracts"
            data-testid="input-search-contracts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-contract-status-filter" aria-label="Filter by contract status">
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
            <SelectValue placeholder="Contract Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="AWAITING_CONTRACT">Awaiting Contract</SelectItem>
            <SelectItem value="CONTRACT_REVIEW">Contract Review</SelectItem>
            <SelectItem value="CONTRACT_EXECUTED">Contract Executed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={workStatusFilter} onValueChange={setWorkStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-work-status-filter" aria-label="Filter by work status">
            <SelectValue placeholder="Work Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Work Status</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-lg font-medium">No jobs found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map(item => {
            const statusConfig = CONTRACT_STATUS_CONFIG[item.contractStatus] || CONTRACT_STATUS_CONFIG.AWAITING_CONTRACT;
            const StatusIcon = statusConfig.icon;

            return (
              <Card
                key={item.jobId}
                className="hover-elevate cursor-pointer transition-colors"
                onClick={() => navigate(`/contracts/${item.jobId}`)}
                data-testid={`card-contract-job-${item.jobId}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold" data-testid={`text-job-number-${item.jobId}`}>{item.jobNumber}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="font-medium truncate" data-testid={`text-job-name-${item.jobId}`}>{item.jobName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                          {item.client && <span>{item.client}</span>}
                          {item.contractNumber && (
                            <>
                              <span className="hidden sm:inline">|</span>
                              <span>Contract: {item.contractNumber}</span>
                            </>
                          )}
                          <span className="hidden sm:inline">|</span>
                          <span>{item.panelCount} panels</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
                      {item.originalContractValue && (
                        <div className="text-right hidden lg:block">
                          <p className="text-sm font-medium">{formatCurrency(item.revisedContractValue || item.originalContractValue)}</p>
                          <p className="text-xs text-muted-foreground">Contract Value</p>
                        </div>
                      )}

                      {item.riskRating && (
                        <Badge variant={getRiskBadgeVariant(item.riskRating)} data-testid={`badge-risk-${item.jobId}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Risk: {item.riskRating}/10
                        </Badge>
                      )}

                      <Badge
                        variant={item.workStatus === "In Progress" ? "default" : "outline"}
                        data-testid={`badge-work-status-${item.jobId}`}
                      >
                        {item.workStatus}
                      </Badge>

                      <Badge variant={statusConfig.variant} data-testid={`badge-contract-status-${item.jobId}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>

                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <POTermsDialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen} />
    </div>
  );
}
