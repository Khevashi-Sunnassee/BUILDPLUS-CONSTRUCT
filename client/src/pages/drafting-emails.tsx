import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DRAFTING_INBOX_ROUTES } from "@shared/api-routes";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Upload, Trash2, MoreHorizontal, FileText, Loader2, Eye, Settings, Mail, Copy, Check, RefreshCw, Inbox, AlertTriangle, CheckCircle2, Clock, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { SortIcon } from "@/components/ui/sort-icon";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DraftingEmail {
  id: string;
  companyId: string;
  resendEmailId: string;
  fromAddress: string;
  toAddress: string | null;
  subject: string | null;
  status: string;
  jobId: string | null;
  requestType: string | null;
  impactArea: string | null;
  attachmentCount: number | null;
  processingError: string | null;
  processedAt: string | null;
  matchedAt: string | null;
  createdAt: string;
  jobName?: string | null;
  jobNumber?: string | null;
}

interface DraftingEmailListResponse {
  emails: DraftingEmail[];
  total: number;
  page: number;
  limit: number;
}

interface StatusCounts {
  received: number;
  processing: number;
  processed: number;
  matched: number;
  allocated: number;
  duplicate: number;
  irrelevant: number;
  archived: number;
  failed: number;
  all: number;
  [key: string]: number;
}

const STATUS_TABS = [
  { key: "all", label: "All", showCount: false },
  { key: "RECEIVED", label: "Received", showCount: true },
  { key: "PROCESSING", label: "Processing", showCount: true },
  { key: "PROCESSED", label: "Processed", showCount: true },
  { key: "MATCHED", label: "Matched", showCount: true },
  { key: "ALLOCATED", label: "Allocated", showCount: true },
  { key: "DUPLICATE", label: "Duplicate", showCount: false },
  { key: "IRRELEVANT", label: "Irrelevant", showCount: false },
  { key: "ARCHIVED", label: "Archived", showCount: false },
  { key: "FAILED", label: "Failed", showCount: true },
] as const;

const STATUS_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  received: { variant: "outline" },
  processing: { variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600" },
  processed: { variant: "default", className: "bg-indigo-500 text-white dark:bg-indigo-600" },
  matched: { variant: "default", className: "bg-green-600 text-white dark:bg-green-700" },
  allocated: { variant: "default", className: "bg-teal-600 text-white dark:bg-teal-700" },
  duplicate: { variant: "secondary" },
  irrelevant: { variant: "secondary" },
  archived: { variant: "secondary" },
  failed: { variant: "destructive" },
  no_attachments: { variant: "outline", className: "text-muted-foreground" },
  no_pdf_attachments: { variant: "outline", className: "text-muted-foreground" },
};

const REQUEST_TYPE_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  change_request: { variant: "destructive" },
  drawing_update: { variant: "default", className: "bg-blue-500 text-white dark:bg-blue-600" },
  rfi: { variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600" },
  approval: { variant: "default", className: "bg-green-600 text-white dark:bg-green-700" },
  shop_drawing: { variant: "default", className: "bg-indigo-500 text-white dark:bg-indigo-600" },
  specification: { variant: "secondary" },
};

const IMPACT_AREA_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  production: { variant: "destructive" },
  drawing: { variant: "default", className: "bg-blue-500 text-white dark:bg-blue-600" },
  design: { variant: "default", className: "bg-purple-500 text-white dark:bg-purple-600" },
  scheduling: { variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600" },
  quality: { variant: "default", className: "bg-green-600 text-white dark:bg-green-700" },
  procurement: { variant: "secondary" },
};

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const config = STATUS_BADGE_CONFIG[normalized] || { variant: "secondary" as const };
  const displayLabel = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

function RequestTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground">{"\u2014"}</span>;
  const normalized = type.toLowerCase().replace(/\s+/g, "_");
  const config = REQUEST_TYPE_BADGE_CONFIG[normalized] || { variant: "secondary" as const };
  const displayLabel = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-request-type-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

function ImpactAreaBadge({ area }: { area: string | null }) {
  if (!area) return <span className="text-muted-foreground">{"\u2014"}</span>;
  const normalized = area.toLowerCase().replace(/\s+/g, "_");
  const config = IMPACT_AREA_BADGE_CONFIG[normalized] || { variant: "secondary" as const };
  const displayLabel = area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-impact-area-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      await apiUpload(DRAFTING_INBOX_ROUTES.UPLOAD, formData);
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
      toast({ title: "Drafting documents uploaded successfully" });
      setFiles([]);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-drafting-upload">
        <DialogHeader>
          <DialogTitle>Upload Drafting Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-drafting-upload"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to select drafting documents</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG accepted</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) setFiles(Array.from(e.target.files));
            }}
            data-testid="input-drafting-file-upload"
          />
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-drafting-upload">
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading} data-testid="button-confirm-drafting-upload">
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {files.length > 0 ? `(${files.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DraftingInboxSettings {
  isEnabled: boolean;
  inboundEmailAddress: string | null;
  autoExtract: boolean;
}

function DraftingInboxSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const { data: settings, isLoading } = useQuery<DraftingInboxSettings>({
    queryKey: [DRAFTING_INBOX_ROUTES.SETTINGS],
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DraftingInboxSettings>) => {
      await apiRequest("PUT", DRAFTING_INBOX_ROUTES.SETTINGS, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.SETTINGS] });
      toast({ title: "Drafting inbox settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update settings", description: err.message, variant: "destructive" });
    },
  });

  const handleCopy = () => {
    if (settings?.inboundEmailAddress) {
      navigator.clipboard.writeText(settings.inboundEmailAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-drafting-inbox-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Drafting Email Inbox
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : settings ? (
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium" data-testid="label-drafting-inbox-enabled">Enable Drafting Email Inbox</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive drafting documents via email automatically
                </p>
              </div>
              <Switch
                checked={settings.isEnabled}
                onCheckedChange={(checked) => updateMutation.mutate({ isEnabled: checked })}
                disabled={updateMutation.isPending}
                data-testid="switch-drafting-inbox-enabled"
              />
            </div>

            {settings.isEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Inbound Email Address</Label>
                  <p className="text-xs text-muted-foreground">
                    Configured in Company Settings &gt; Email tab
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={settings.inboundEmailAddress || "Not configured"}
                      readOnly
                      className="bg-muted"
                      data-testid="input-drafting-inbound-email"
                    />
                    {settings.inboundEmailAddress && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopy}
                        data-testid="button-copy-drafting-email"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm font-medium">Auto-Extract</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically extract data from attachments using AI
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoExtract}
                    onCheckedChange={(checked) => updateMutation.mutate({ autoExtract: checked })}
                    disabled={updateMutation.isPending}
                    data-testid="switch-drafting-auto-extract"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground" data-testid="text-drafting-inbox-no-settings">
            Unable to load inbox settings. Please try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TrendData {
  date: string;
  received: number;
  processing: number;
  processed: number;
  matched: number;
  allocated: number;
  total: number;
}

function StatsCards({ counts }: { counts: StatusCounts | undefined }) {
  if (!counts) return null;

  const needsAction = (counts.received || 0) + (counts.processing || 0) + (counts.processed || 0);
  const processedNotMatched = counts.processed || 0;
  const matchedNotAllocated = counts.matched || 0;
  const allocated = counts.allocated || 0;

  const cards = [
    {
      label: "Needs Action",
      value: needsAction,
      description: "Received + Processing + Processed",
      icon: AlertTriangle,
      color: needsAction > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: needsAction > 0 ? "bg-red-500/10" : "bg-muted/50",
    },
    {
      label: "Processed (Unmatched)",
      value: processedNotMatched,
      description: "Processed but not yet matched to a job",
      icon: Clock,
      color: processedNotMatched > 0 ? "text-amber-500" : "text-muted-foreground",
      bgColor: processedNotMatched > 0 ? "bg-amber-500/10" : "bg-muted/50",
    },
    {
      label: "Matched (Unallocated)",
      value: matchedNotAllocated,
      description: "Matched to job but not yet allocated",
      icon: FileText,
      color: matchedNotAllocated > 0 ? "text-blue-500" : "text-muted-foreground",
      bgColor: matchedNotAllocated > 0 ? "bg-blue-500/10" : "bg-muted/50",
    },
    {
      label: "Allocated",
      value: allocated,
      description: "Fully allocated and actioned",
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Total Received",
      value: counts.all || 0,
      description: "All emails across all statuses",
      icon: Mail,
      color: "text-foreground",
      bgColor: "bg-muted/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="drafting-stats-cards">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.bgColor} border`} data-testid={`stat-card-${card.label.toLowerCase().replace(/\s+/g, "-")}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground font-medium truncate">{card.label}</span>
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const TREND_COLORS: Record<string, string> = {
  received: "#94a3b8",
  processed: "#818cf8",
  matched: "#22c55e",
  allocated: "#14b8a6",
};

function TrendChart({ embedded }: { embedded?: boolean }) {
  const [days, setDays] = useState("30");
  const [expanded, setExpanded] = useState(false);

  const { data: trendData } = useQuery<{ trends: TrendData[]; days: number }>({
    queryKey: [DRAFTING_INBOX_ROUTES.TRENDS, { days }],
    queryFn: async () => {
      const res = await fetch(`${DRAFTING_INBOX_ROUTES.TRENDS}?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
  });

  if (!trendData?.trends?.length) return null;

  const chartData = trendData.trends.map((t) => ({
    ...t,
    date: new Date(t.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
  }));

  return (
    <div data-testid="drafting-trend-chart">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
        onClick={() => setExpanded(!expanded)}
        data-testid="btn-toggle-trend-chart"
      >
        <BarChart3 className="h-4 w-4" />
        Email Trends
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Email Volume by Status</h3>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-trend-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  interval={Math.max(0, Math.floor(chartData.length / 8))}
                />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                <Area type="monotone" dataKey="received" stackId="1" stroke={TREND_COLORS.received} fill={TREND_COLORS.received} fillOpacity={0.3} name="Received" />
                <Area type="monotone" dataKey="processed" stackId="1" stroke={TREND_COLORS.processed} fill={TREND_COLORS.processed} fillOpacity={0.3} name="Processed" />
                <Area type="monotone" dataKey="matched" stackId="1" stroke={TREND_COLORS.matched} fill={TREND_COLORS.matched} fillOpacity={0.3} name="Matched" />
                <Area type="monotone" dataKey="allocated" stackId="1" stroke={TREND_COLORS.allocated} fill={TREND_COLORS.allocated} fillOpacity={0.3} name="Allocated" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function DraftingEmailsPage({ embedded = false }: { embedded?: boolean } = {}) {
  if (!embedded) useDocumentTitle("Drafting Emails");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("PROCESSED");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [inboxSettingsOpen, setInboxSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { page: String(page), limit: "50" };
    if (activeTab !== "all") params.status = activeTab;
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (sortBy) { params.sortBy = sortBy; params.sortOrder = sortOrder; }
    return params;
  }, [activeTab, debouncedSearch, page, sortBy, sortOrder]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams(queryParams);
    return `${DRAFTING_INBOX_ROUTES.LIST}?${p.toString()}`;
  }, [queryParams]);

  const { data: emailData, isLoading } = useQuery<DraftingEmailListResponse>({
    queryKey: [DRAFTING_INBOX_ROUTES.LIST, queryParams],
    queryFn: async () => {
      const res = await fetch(queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load drafting emails");
      return res.json();
    },
  });

  const { data: statusCounts } = useQuery<StatusCounts>({
    queryKey: [DRAFTING_INBOX_ROUTES.COUNTS],
  });

  const emails = emailData?.emails || [];
  const total = emailData?.total || 0;

  const checkEmailsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", DRAFTING_INBOX_ROUTES.CHECK_EMAILS);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Checking for new drafting emails..." });
      const refreshIntervals = [3000, 8000, 15000, 25000];
      for (const delay of refreshIntervals) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
          queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
        }, delay);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Failed to check emails", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", DRAFTING_INBOX_ROUTES.BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
      toast({ title: "Drafting email deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }, [sortBy]);


  const getCount = (key: string): number => {
    if (!statusCounts) return 0;
    return statusCounts[key.toLowerCase()] || statusCounts[key] || 0;
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      <div className={embedded ? "space-y-4 flex-1 overflow-auto" : "p-6 space-y-4 flex-1 overflow-auto"}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!embedded && <h1 className="text-2xl font-semibold" data-testid="text-drafting-emails-title">Drafting Emails</h1>}
          <div className={`flex items-center gap-2 ${embedded ? "ml-auto" : ""}`}>
            <Button
              variant="outline"
              onClick={() => checkEmailsMutation.mutate()}
              disabled={checkEmailsMutation.isPending}
              data-testid="button-check-drafting-emails"
            >
              {checkEmailsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Check Emails
            </Button>
            <Button variant="outline" size="icon" onClick={() => setInboxSettingsOpen(true)} data-testid="button-drafting-inbox-settings">
              <Mail className="h-4 w-4" />
            </Button>
            <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-drafting-docs">
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>
        </div>

        <StatsCards counts={statusCounts} />

        <TrendChart embedded={embedded} />

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drafting emails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-drafting-search"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = getCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                data-testid={`tab-drafting-${tab.key.toLowerCase()}`}
              >
                {tab.label}
                {tab.showCount && count > 0 && (
                  <Badge variant="secondary" className="ml-1.5" data-testid={`count-drafting-${tab.key.toLowerCase()}`}>
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="drafting-emails-empty">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No drafting emails found</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload drafting documents or configure email inbox to get started.</p>
            <div className="flex gap-2">
              <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-drafting-empty">
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </Button>
              <Button variant="outline" onClick={() => setInboxSettingsOpen(true)} data-testid="button-setup-drafting-inbox-empty">
                <Settings className="h-4 w-4 mr-2" />
                Setup Inbox
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("fromAddress")} data-testid="sort-drafting-from">
                        From <SortIcon column="fromAddress" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("subject")} data-testid="sort-drafting-subject">
                        Subject <SortIcon column="subject" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("status")} data-testid="sort-drafting-status">
                        Status <SortIcon column="status" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("requestType")} data-testid="sort-drafting-type">
                        Type <SortIcon column="requestType" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("impactArea")} data-testid="sort-drafting-impact">
                        Impact <SortIcon column="impactArea" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead className="text-center">Attachments</TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("createdAt")} data-testid="sort-drafting-date">
                        Received <SortIcon column="createdAt" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow
                      key={email.id}
                      className="cursor-pointer"
                      data-testid={`row-drafting-email-${email.id}`}
                      onClick={() => navigate(`/drafting-emails/${email.id}`)}
                    >
                      <TableCell>
                        <span className="text-sm line-clamp-1 max-w-[200px]" data-testid={`text-drafting-from-${email.id}`}>
                          {email.fromAddress}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/drafting-emails/${email.id}`}
                          className="text-left text-foreground font-medium hover:underline line-clamp-1 max-w-[250px]"
                          onClick={(e: any) => e.stopPropagation()}
                          data-testid={`link-drafting-email-${email.id}`}
                        >
                          {email.subject || "No Subject"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={email.status} />
                      </TableCell>
                      <TableCell data-testid={`text-drafting-type-${email.id}`}>
                        <RequestTypeBadge type={email.requestType} />
                      </TableCell>
                      <TableCell data-testid={`text-drafting-impact-${email.id}`}>
                        <ImpactAreaBadge area={email.impactArea} />
                      </TableCell>
                      <TableCell data-testid={`text-drafting-job-${email.id}`}>
                        {email.jobName || email.jobNumber || (email.jobId ? <Badge variant="outline">Linked</Badge> : <span className="text-muted-foreground">{"\u2014"}</span>)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm" data-testid={`text-drafting-files-${email.id}`}>
                          {email.attachmentCount || 0}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-drafting-received-${email.id}`}>
                        {formatDateTime(email.createdAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-drafting-actions-${email.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/drafting-emails/${email.id}`)}
                              data-testid={`action-drafting-view-${email.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(email.id)}
                              data-testid={`action-drafting-delete-${email.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {total > 50 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground" data-testid="text-drafting-pagination-info">
                  Showing {(page - 1) * 50 + 1}{"\u2013"}{Math.min(page * 50, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-drafting-prev-page">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} data-testid="button-drafting-next-page">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <DraftingInboxSettingsDialog open={inboxSettingsOpen} onOpenChange={setInboxSettingsOpen} />
    </div>
  );
}
