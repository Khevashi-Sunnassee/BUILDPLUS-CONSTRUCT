import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Eye, Plus, Play, Loader2, FileText, GitCompare, ListChecks,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft, Copy, RefreshCw,
  Search, Monitor, Smartphone, Check, Star, BarChart3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const API_BASE = "/api/super-admin/review-mode";

interface ReviewTarget {
  id: string;
  targetType: string;
  routePath: string;
  pageTitle: string;
  module: string;
  frontendEntryFile: string;
  latestScore: number | null;
  latestScoreBreakdown: any;
  lastReviewedAt: string | null;
  createdAt: string;
}

interface ReviewPacket {
  id: string;
  targetId: string;
  contextVersionId: string;
  packetJson: any;
  packetMd: string;
  status: string;
  purpose: string;
  roles: string[];
  riskFocus: string[];
  score: number | null;
  scoreBreakdown: any;
  createdAt: string;
}

interface ReviewRun {
  id: string;
  packetId: string;
  reviewer: string;
  modelName: string;
  responseMd: string;
  responseJson: any;
  status: string;
  durationMs: number;
  createdAt: string;
}

interface ReviewTaskpack {
  id: string;
  packetId: string;
  mergedTasksMd: string;
  mergedTasksJson: any;
  createdAt: string;
}

interface ContextVersion {
  id: string;
  name: string;
  contentMd: string;
  isActive: boolean;
  createdAt: string;
}

interface PacketDetail extends ReviewPacket {
  runs: ReviewRun[];
  taskpacks: ReviewTaskpack[];
  target: ReviewTarget;
}

interface DiscoveredPage {
  targetType: string;
  routePath: string;
  pageTitle: string;
  module: string;
  frontendEntryFile: string;
  componentName: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    SUCCESS: { variant: "default", icon: CheckCircle2 },
    GENERATED: { variant: "default", icon: CheckCircle2 },
    PENDING: { variant: "secondary", icon: Clock },
    DRAFT: { variant: "outline", icon: FileText },
    FAILED: { variant: "destructive", icon: XCircle },
  };
  const config = variants[status] || { variant: "outline" as const, icon: Clock };
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    P0: "bg-red-500 text-white",
    P1: "bg-orange-500 text-white",
    P2: "bg-yellow-500 text-black",
    P3: "bg-blue-500 text-white",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${colors[severity] || "bg-gray-500 text-white"}`} data-testid={`badge-severity-${severity}`}>
      {severity}
    </span>
  );
}

function StarRating({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground text-xs">Not scored</span>;
  const sizeClass = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5" data-testid={`star-rating-${score}`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sizeClass} ${s <= score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className={`ml-1 font-semibold ${size === "sm" ? "text-xs" : "text-sm"}`}>{score}/5</span>
    </div>
  );
}

function ScoreBreakdownCard({ breakdown }: { breakdown: any }) {
  if (!breakdown) return null;
  const dimensions = [
    { key: "functionality", label: "Functionality" },
    { key: "uiUx", label: "UI/UX" },
    { key: "security", label: "Security" },
    { key: "performance", label: "Performance" },
    { key: "codeQuality", label: "Code Quality" },
    { key: "dataIntegrity", label: "Data Integrity" },
    { key: "errorHandling", label: "Error Handling" },
    { key: "accessibility", label: "Accessibility" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="score-breakdown">
      {dimensions.map(({ key, label }) => {
        const val = breakdown[key] ?? 0;
        const color = val >= 4 ? "text-green-600" : val >= 3 ? "text-yellow-600" : "text-red-600";
        return (
          <div key={key} className="flex flex-col items-center p-2 border rounded-lg">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-3 w-3 ${s <= val ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
              ))}
            </div>
            <span className={`text-sm font-bold ${color}`}>{val}/5</span>
          </div>
        );
      })}
    </div>
  );
}

function PageElementsView({ elements }: { elements: any }) {
  if (!elements) return null;
  const sections = [
    { key: "buttons", label: "Buttons" },
    { key: "forms", label: "Forms" },
    { key: "grids", label: "Grids/Tables" },
    { key: "dataSources", label: "Data Sources" },
    { key: "navigation", label: "Navigation" },
    { key: "modals", label: "Modals/Dialogs" },
  ];

  return (
    <div className="space-y-4" data-testid="page-elements-inventory">
      {sections.map(({ key, label }) => {
        const items = elements[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key}>
            <h4 className="font-medium text-sm mb-2">{label} ({items.length})</h4>
            <div className="space-y-1">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm p-1.5 rounded border">
                  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    item.status === "OK" ? "bg-green-500" : item.status === "ISSUE" ? "bg-red-500" : "bg-yellow-500"
                  }`} />
                  <span className="font-medium min-w-0 truncate">{item.name || item.endpoint || item.element}</span>
                  <Badge variant={item.status === "OK" ? "default" : item.status === "ISSUE" ? "destructive" : "secondary"} className="text-xs flex-shrink-0">
                    {item.status}
                  </Badge>
                  {item.notes && <span className="text-muted-foreground text-xs truncate">{item.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContextManager() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: contexts = [], isLoading } = useQuery<ContextVersion[]>({
    queryKey: [`${API_BASE}/contexts`],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; contentMd: string }) =>
      apiRequest("POST", `${API_BASE}/contexts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/contexts`] });
      toast({ title: "Context version created" });
      setShowCreate(false);
      setNewName("");
      setNewContent("");
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `${API_BASE}/contexts/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/contexts`] });
      toast({ title: "Context version activated" });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Architecture Context Versions</CardTitle>
            <CardDescription>The holistic lens used by both reviewers</CardDescription>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm" data-testid="button-create-context">
            <Plus className="h-4 w-4 mr-1" /> New Version
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <Label>Version Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Architecture Context v2"
                data-testid="input-context-name"
              />
            </div>
            <div>
              <Label>Content (Markdown)</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={10}
                placeholder="# BuildPlus Architecture Context..."
                data-testid="input-context-content"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate({ name: newName, contentMd: newContent })}
              disabled={!newName || !newContent || createMutation.isPending}
              data-testid="button-save-context"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Save Context
            </Button>
          </div>
        )}

        {contexts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No context versions yet. The initial v1 will be seeded automatically.</p>
        ) : (
          <div className="space-y-2">
            {contexts.map((ctx) => (
              <div key={ctx.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`context-version-${ctx.id}`}>
                <div className="flex items-center gap-3">
                  <Badge variant={ctx.isActive ? "default" : "outline"}>
                    {ctx.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="font-medium">{ctx.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ctx.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {!ctx.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => activateMutation.mutate(ctx.id)}
                    disabled={activateMutation.isPending}
                    data-testid={`button-activate-context-${ctx.id}`}
                  >
                    Activate
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewReviewWizard({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [targetId, setTargetId] = useState("");
  const [newTarget, setNewTarget] = useState({
    targetType: "DESKTOP_PAGE" as string,
    routePath: "",
    pageTitle: "",
    module: "",
    frontendEntryFile: "",
  });
  const [createNewTarget, setCreateNewTarget] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverFilter, setDiscoverFilter] = useState("");
  const [discoverTypeFilter, setDiscoverTypeFilter] = useState<string>("ALL");
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<string>>(new Set());
  const [purpose, setPurpose] = useState("");
  const [roles, setRoles] = useState("");
  const [flows, setFlows] = useState("");
  const [issues, setIssues] = useState("");
  const [riskFocus, setRiskFocus] = useState("");
  const [additionalFiles, setAdditionalFiles] = useState("");
  const [additionalEndpoints, setAdditionalEndpoints] = useState("");
  const [generatedPacket, setGeneratedPacket] = useState<ReviewPacket | null>(null);

  const { data: targets = [] } = useQuery<ReviewTarget[]>({
    queryKey: [`${API_BASE}/targets`],
  });

  const { data: discoveredPages = [], isLoading: isDiscovering, refetch: refetchDiscover } = useQuery<DiscoveredPage[]>({
    queryKey: [`${API_BASE}/discover`],
    enabled: showDiscover,
  });

  const existingTargetKeys = new Set(targets.map(t => `${t.targetType}::${t.routePath}`));

  const filteredDiscovered = discoveredPages.filter(p => {
    if (existingTargetKeys.has(`${p.targetType}::${p.routePath}`)) return false;
    if (discoverTypeFilter !== "ALL" && p.targetType !== discoverTypeFilter) return false;
    if (discoverFilter) {
      const q = discoverFilter.toLowerCase();
      return p.pageTitle.toLowerCase().includes(q) ||
        p.routePath.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q);
    }
    return true;
  });

  const createTargetMutation = useMutation({
    mutationFn: (data: typeof newTarget) =>
      apiRequest("POST", `${API_BASE}/targets`, data),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/targets`] });
      setTargetId(data.id);
      setCreateNewTarget(false);
      toast({ title: "Target created" });
      setStep(2);
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (pages: Array<{ targetType: string; routePath: string; pageTitle: string; module: string; frontendEntryFile: string }>) => {
      const res = await apiRequest("POST", `${API_BASE}/targets/bulk`, pages);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/targets`] });
      const created = data.created?.length || 0;
      const skipped = data.skipped || 0;
      toast({ title: `${created} pages imported${skipped > 0 ? `, ${skipped} already existed` : ""}` });
      setSelectedDiscovered(new Set());
      setShowDiscover(false);
    },
    onError: () => {
      toast({ title: "Failed to import pages", variant: "destructive" });
    },
  });

  const pageKey = (p: DiscoveredPage) => `${p.targetType}::${p.routePath}`;

  const handleBulkImport = () => {
    const selectedKeys = selectedDiscovered;
    const pages = discoveredPages
      .filter(p => selectedKeys.has(pageKey(p)))
      .map(({ componentName, ...rest }) => rest);
    bulkImportMutation.mutate(pages);
  };

  const toggleDiscoveredPage = (p: DiscoveredPage) => {
    const key = pageKey(p);
    setSelectedDiscovered(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedDiscovered(prev => {
      const next = new Set(prev);
      filteredDiscovered.forEach(p => next.add(pageKey(p)));
      return next;
    });
  };

  const deselectAll = () => setSelectedDiscovered(new Set());

  const generatePacketMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `${API_BASE}/packets/generate`, data),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setGeneratedPacket(data);
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/packets`] });
      toast({ title: "Packet generated" });
      setStep(4);
    },
    onError: () => {
      toast({ title: "Failed to generate packet", variant: "destructive" });
    },
  });

  const splitToArray = (s: string) => s.split("\n").map(l => l.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Review</CardTitle>
        <CardDescription>Step {step} of 4</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Step 1: Select or Create Target</h3>

            {showDiscover ? (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Discovered Pages ({filteredDiscovered.length} available)
                  </h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => refetchDiscover()} data-testid="button-refresh-discover">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowDiscover(false)} data-testid="button-close-discover">
                      Close
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Filter by name, route, or module..."
                    value={discoverFilter}
                    onChange={(e) => setDiscoverFilter(e.target.value)}
                    className="flex-1"
                    data-testid="input-discover-filter"
                  />
                  <Select value={discoverTypeFilter} onValueChange={setDiscoverTypeFilter}>
                    <SelectTrigger className="w-[160px]" data-testid="select-discover-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="DESKTOP_PAGE">Desktop</SelectItem>
                      <SelectItem value="MOBILE_PAGE">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedDiscovered.size > 0 && (
                  <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                    <span className="text-sm font-medium">{selectedDiscovered.size} pages selected</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={deselectAll} data-testid="button-deselect-all">
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleBulkImport}
                        disabled={bulkImportMutation.isPending}
                        data-testid="button-bulk-import"
                      >
                        {bulkImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                        Import Selected as Targets
                      </Button>
                    </div>
                  </div>
                )}

                {isDiscovering ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-muted-foreground">Scanning codebase...</span>
                  </div>
                ) : filteredDiscovered.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    {discoveredPages.length === 0 ? "No pages discovered." : "All discovered pages are already imported as targets, or no pages match your filter."}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    <div className="flex justify-end mb-1">
                      <Button size="sm" variant="ghost" onClick={selectAllFiltered} data-testid="button-select-all-filtered">
                        Select All ({filteredDiscovered.length})
                      </Button>
                    </div>
                    {filteredDiscovered.map((p) => (
                      <div
                        key={pageKey(p)}
                        className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedDiscovered.has(pageKey(p)) ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleDiscoveredPage(p)}
                        data-testid={`discover-page-${p.routePath}`}
                      >
                        <div className={`flex items-center justify-center h-5 w-5 rounded border ${
                          selectedDiscovered.has(pageKey(p)) ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}>
                          {selectedDiscovered.has(pageKey(p)) && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        {p.targetType === "MOBILE_PAGE" ? (
                          <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{p.pageTitle}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.routePath}</div>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{p.module}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : !createNewTarget ? (
              <div className="space-y-3">
                {targets.length > 0 && (
                  <div>
                    <Label>Existing Targets</Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger data-testid="select-target">
                        <SelectValue placeholder="Select a page/module..." />
                      </SelectTrigger>
                      <SelectContent>
                        {targets.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.pageTitle} ({t.routePath})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!targetId}
                    data-testid="button-next-step1"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowDiscover(true); }}
                    data-testid="button-discover-pages"
                  >
                    <Search className="h-4 w-4 mr-1" /> Discover Pages
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCreateNewTarget(true)}
                    data-testid="button-create-new-target"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Manual Entry
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target Type</Label>
                    <Select value={newTarget.targetType} onValueChange={(v) => setNewTarget({ ...newTarget, targetType: v })}>
                      <SelectTrigger data-testid="select-target-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DESKTOP_PAGE">Desktop Page</SelectItem>
                        <SelectItem value="MOBILE_PAGE">Mobile Page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Module</Label>
                    <Input
                      value={newTarget.module}
                      onChange={(e) => setNewTarget({ ...newTarget, module: e.target.value })}
                      placeholder="Jobs, Panels, Finance..."
                      data-testid="input-target-module"
                    />
                  </div>
                </div>
                <div>
                  <Label>Page Title</Label>
                  <Input
                    value={newTarget.pageTitle}
                    onChange={(e) => setNewTarget({ ...newTarget, pageTitle: e.target.value })}
                    placeholder="Job Management Page"
                    data-testid="input-target-title"
                  />
                </div>
                <div>
                  <Label>Route Path</Label>
                  <Input
                    value={newTarget.routePath}
                    onChange={(e) => setNewTarget({ ...newTarget, routePath: e.target.value })}
                    placeholder="/jobs"
                    data-testid="input-target-route"
                  />
                </div>
                <div>
                  <Label>Frontend Entry File</Label>
                  <Input
                    value={newTarget.frontendEntryFile}
                    onChange={(e) => setNewTarget({ ...newTarget, frontendEntryFile: e.target.value })}
                    placeholder="client/src/pages/jobs.tsx"
                    data-testid="input-target-entry-file"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => createTargetMutation.mutate(newTarget)}
                    disabled={!newTarget.routePath || !newTarget.pageTitle || !newTarget.module || !newTarget.frontendEntryFile || createTargetMutation.isPending}
                    data-testid="button-save-target"
                  >
                    {createTargetMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Create Target
                  </Button>
                  <Button variant="ghost" onClick={() => setCreateNewTarget(false)} data-testid="button-cancel-target">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Step 2: Review Details</h3>
            <div>
              <Label>Purpose / What to Review</Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
                placeholder="Full security and performance review of the Jobs page..."
                data-testid="input-review-purpose"
              />
            </div>
            <div>
              <Label>Roles (one per line)</Label>
              <Textarea
                value={roles}
                onChange={(e) => setRoles(e.target.value)}
                rows={2}
                placeholder="ADMIN&#10;MANAGER&#10;USER"
                data-testid="input-review-roles"
              />
            </div>
            <div>
              <Label>Key User Flows (one per line)</Label>
              <Textarea
                value={flows}
                onChange={(e) => setFlows(e.target.value)}
                rows={3}
                placeholder="Create a new job&#10;Edit job details&#10;Archive a job"
                data-testid="input-review-flows"
              />
            </div>
            <div>
              <Label>Known Issues (one per line)</Label>
              <Textarea
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={2}
                placeholder="Pagination not working on large datasets"
                data-testid="input-review-issues"
              />
            </div>
            <div>
              <Label>Risk Focus Areas (one per line)</Label>
              <Textarea
                value={riskFocus}
                onChange={(e) => setRiskFocus(e.target.value)}
                rows={2}
                placeholder="Multi-tenancy isolation&#10;RBAC enforcement&#10;N+1 queries"
                data-testid="input-review-risk-focus"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} data-testid="button-next-step2">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Step 3: Manual Overrides (Optional)</h3>
            <div>
              <Label>Additional Files to Include (one per line)</Label>
              <Textarea
                value={additionalFiles}
                onChange={(e) => setAdditionalFiles(e.target.value)}
                rows={3}
                placeholder="server/routes/jobs.routes.ts&#10;server/storage/jobs.ts"
                data-testid="input-additional-files"
              />
            </div>
            <div>
              <Label>Additional Endpoints to Check (one per line)</Label>
              <Textarea
                value={additionalEndpoints}
                onChange={(e) => setAdditionalEndpoints(e.target.value)}
                rows={3}
                placeholder="/api/jobs&#10;/api/jobs/:id"
                data-testid="input-additional-endpoints"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button
                onClick={() => generatePacketMutation.mutate({
                  targetId,
                  purpose,
                  roles: splitToArray(roles),
                  keyUserFlows: splitToArray(flows),
                  knownIssues: splitToArray(issues),
                  riskFocus: splitToArray(riskFocus),
                  additionalFiles: splitToArray(additionalFiles),
                  additionalEndpoints: splitToArray(additionalEndpoints),
                })}
                disabled={generatePacketMutation.isPending}
                data-testid="button-generate-packet"
              >
                {generatePacketMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                Generate Packet
              </Button>
            </div>
          </div>
        )}

        {step === 4 && generatedPacket && (
          <div className="space-y-4">
            <h3 className="font-semibold">Step 4: Packet Generated</h3>
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Packet generated successfully. You can now run both reviews from the packet detail page.
              </p>
            </div>
            <Button onClick={onComplete} data-testid="button-view-packet">
              <Eye className="h-4 w-4 mr-1" /> View Packet & Run Reviews
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FindingCard({ finding, index }: { finding: any; index: number }) {
  return (
    <div className="border rounded-lg p-4 space-y-2" data-testid={`finding-${index}`}>
      <div className="flex items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <Badge variant="outline">{finding.category}</Badge>
        {finding.source && <Badge variant="secondary">{finding.source}</Badge>}
        <span className="font-medium">{finding.title}</span>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{finding.detail_md}</p>
      {finding.impactedFiles?.length > 0 && (
        <div className="text-xs">
          <span className="font-medium">Files: </span>
          <span className="text-muted-foreground">{finding.impactedFiles.join(", ")}</span>
        </div>
      )}
      {finding.impactedEndpoints?.length > 0 && (
        <div className="text-xs">
          <span className="font-medium">Endpoints: </span>
          <span className="text-muted-foreground">{finding.impactedEndpoints.join(", ")}</span>
        </div>
      )}
      {finding.suggestedFix_md && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400">Suggested Fix</summary>
          <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap overflow-auto">{finding.suggestedFix_md}</pre>
        </details>
      )}
      {finding.acceptanceCriteria_md && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-green-600 dark:text-green-400">Acceptance Criteria</summary>
          <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap overflow-auto">{finding.acceptanceCriteria_md}</pre>
        </details>
      )}
    </div>
  );
}

function ReviewRunView({ run }: { run: ReviewRun }) {
  const findings = run.responseJson?.findings || [];
  const summary = run.responseJson?.summary;

  if (run.status === "PENDING") {
    return (
      <div className="flex items-center gap-3 p-6 justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Review in progress... This may take 30-60 seconds.</span>
      </div>
    );
  }

  if (run.status === "FAILED") {
    return (
      <div className="text-red-500 p-4">
        <p className="font-medium">Review failed</p>
        <p className="text-sm">{run.responseMd}</p>
      </div>
    );
  }

  const score = run.responseJson?.score;

  return (
    <div className="space-y-4">
      {score && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StarRating score={score.overall} />
                <span className="text-sm text-muted-foreground">
                  {run.modelName} | {((run.durationMs || 0) / 1000).toFixed(1)}s
                </span>
              </div>
              {summary && (
                <Badge variant={summary.overallHealth === "GOOD" ? "default" : summary.overallHealth === "MIXED" ? "secondary" : "destructive"}>
                  {summary.overallHealth}
                </Badge>
              )}
            </div>
            {score.breakdown && <ScoreBreakdownCard breakdown={score.breakdown} />}
            {score.rationale && (
              <p className="text-sm text-muted-foreground italic">{score.rationale}</p>
            )}
          </CardContent>
        </Card>
      )}
      {summary && !score && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Badge variant={summary.overallHealth === "GOOD" ? "default" : summary.overallHealth === "MIXED" ? "secondary" : "destructive"}>
                {summary.overallHealth}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {run.modelName} | {((run.durationMs || 0) / 1000).toFixed(1)}s
              </span>
            </div>
            {summary.topRisks?.length > 0 && (
              <div className="mt-2">
                <span className="text-sm font-medium">Top Risks: </span>
                <span className="text-sm text-muted-foreground">{summary.topRisks.join(", ")}</span>
              </div>
            )}
            {summary.quickWins?.length > 0 && (
              <div className="mt-1">
                <span className="text-sm font-medium">Quick Wins: </span>
                <span className="text-sm text-muted-foreground">{summary.quickWins.join(", ")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {findings.map((f: any, i: number) => (
          <FindingCard key={i} finding={f} index={i} />
        ))}
        {findings.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No findings reported</p>
        )}
      </div>
    </div>
  );
}

function DiffView({ runA, runB }: { runA: ReviewRun | null; runB: ReviewRun | null }) {
  const findingsA = runA?.responseJson?.findings || [];
  const findingsB = runB?.responseJson?.findings || [];

  const allCategories = [...new Set([
    ...findingsA.map((f: any) => f.category),
    ...findingsB.map((f: any) => f.category),
  ])].sort();

  const categoryCountsA: Record<string, number> = {};
  const categoryCountsB: Record<string, number> = {};
  for (const f of findingsA) categoryCountsA[f.category] = (categoryCountsA[f.category] || 0) + 1;
  for (const f of findingsB) categoryCountsB[f.category] = (categoryCountsB[f.category] || 0) + 1;

  const uniqueToA = findingsA.filter((fa: any) =>
    !findingsB.some((fb: any) => fb.title === fa.title || (fb.category === fa.category && fb.severity === fa.severity && fb.detail_md === fa.detail_md))
  );
  const uniqueToB = findingsB.filter((fb: any) =>
    !findingsA.some((fa: any) => fa.title === fb.title || (fa.category === fb.category && fa.severity === fb.severity && fa.detail_md === fb.detail_md))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Category Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 text-sm font-medium border-b pb-2 mb-2">
            <div>Category</div>
            <div>Replit/Claude</div>
            <div>OpenAI</div>
          </div>
          {allCategories.map((cat) => (
            <div key={cat} className="grid grid-cols-3 gap-2 text-sm py-1 border-b border-dashed">
              <div className="font-medium">{cat}</div>
              <div>{categoryCountsA[cat] || 0} findings</div>
              <div>{categoryCountsB[cat] || 0} findings</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {uniqueToA.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unique to Replit/Claude ({uniqueToA.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {uniqueToA.map((f: any, i: number) => (
              <FindingCard key={i} finding={{ ...f, source: "REPLIT_CLAUDE" }} index={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {uniqueToB.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unique to OpenAI ({uniqueToB.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {uniqueToB.map((f: any, i: number) => (
              <FindingCard key={i} finding={{ ...f, source: "OPENAI" }} index={i} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PacketDetail({ packetId, onBack }: { packetId: string; onBack: () => void }) {
  const { toast } = useToast();

  const { data: packet, isLoading, refetch } = useQuery<PacketDetail>({
    queryKey: [`${API_BASE}/packets`, packetId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/packets/${packetId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.runs?.some((r: ReviewRun) => r.status === "PENDING")) return 3000;
      return false;
    },
  });

  const runReviewMutation = useMutation({
    mutationFn: (reviewer: string) =>
      apiRequest("POST", `${API_BASE}/runs`, { packetId, reviewer }),
    onSuccess: () => {
      refetch();
      toast({ title: "Review started" });
    },
    onError: () => {
      toast({ title: "Failed to start review", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `${API_BASE}/taskpacks/merge`, { packetId }),
    onSuccess: () => {
      refetch();
      toast({ title: "Task pack merged" });
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${API_BASE}/packets/${packetId}/score`);
      return res.json();
    },
    onSuccess: (data: any) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/targets`] });
      toast({ title: `Page scored: ${data.score}/5 stars` });
    },
    onError: () => {
      toast({ title: "Failed to calculate score", variant: "destructive" });
    },
  });

  if (isLoading || !packet) return <Skeleton className="h-64 w-full" />;

  const runA = packet.runs?.find((r) => r.reviewer === "REPLIT_CLAUDE" && r.status === "SUCCESS") || packet.runs?.find((r) => r.reviewer === "REPLIT_CLAUDE");
  const runB = packet.runs?.find((r) => r.reviewer === "OPENAI" && r.status === "SUCCESS") || packet.runs?.find((r) => r.reviewer === "OPENAI");
  const hasSuccessRuns = packet.runs?.some((r) => r.status === "SUCCESS");
  const latestTaskpack = packet.taskpacks?.[0];
  const anyPending = packet.runs?.some((r) => r.status === "PENDING");
  const pageElementsA = (runA?.responseJson as any)?.pageElements;
  const pageElementsB = (runB?.responseJson as any)?.pageElements;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold">{packet.target?.pageTitle || "Review Packet"}</h2>
        <StatusBadge status={packet.status} />
        {packet.score !== null && packet.score !== undefined && <StarRating score={packet.score} />}
        {anyPending && (
          <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="button-refresh-status">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        )}
      </div>

      {packet.scoreBreakdown && (
        <ScoreBreakdownCard breakdown={packet.scoreBreakdown} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => runReviewMutation.mutate("REPLIT_CLAUDE")}
          disabled={runReviewMutation.isPending || anyPending}
          size="sm"
          data-testid="button-run-replit-claude"
        >
          <Play className="h-4 w-4 mr-1" /> Run Replit/Claude
        </Button>
        <Button
          onClick={() => runReviewMutation.mutate("OPENAI")}
          disabled={runReviewMutation.isPending || anyPending}
          size="sm"
          data-testid="button-run-openai"
        >
          <Play className="h-4 w-4 mr-1" /> Run OpenAI
        </Button>
        <Button
          onClick={async () => {
            try {
              await apiRequest("POST", `${API_BASE}/runs`, { packetId, reviewer: "REPLIT_CLAUDE" });
              await apiRequest("POST", `${API_BASE}/runs`, { packetId, reviewer: "OPENAI" });
              refetch();
              toast({ title: "Both reviews started" });
            } catch {
              toast({ title: "Failed to start reviews", variant: "destructive" });
            }
          }}
          disabled={runReviewMutation.isPending || anyPending}
          size="sm"
          variant="default"
          data-testid="button-run-both"
        >
          <Play className="h-4 w-4 mr-1" /> Run Both Reviews
        </Button>
        {hasSuccessRuns && (
          <>
            <Button
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
              size="sm"
              variant="outline"
              data-testid="button-merge-taskpack"
            >
              <ListChecks className="h-4 w-4 mr-1" /> Generate Task Pack
            </Button>
            <Button
              onClick={() => scoreMutation.mutate()}
              disabled={scoreMutation.isPending}
              size="sm"
              variant="outline"
              data-testid="button-calculate-score"
            >
              {scoreMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Star className="h-4 w-4 mr-1" />}
              Calculate Score
            </Button>
          </>
        )}
      </div>

      <Tabs defaultValue="score">
        <TabsList data-testid="tabs-packet-detail" className="flex-wrap h-auto">
          <TabsTrigger value="score" data-testid="tab-score">
            <Star className="h-4 w-4 mr-1" /> Score
          </TabsTrigger>
          <TabsTrigger value="elements" data-testid="tab-elements">
            <BarChart3 className="h-4 w-4 mr-1" /> Elements
          </TabsTrigger>
          <TabsTrigger value="replit-claude" data-testid="tab-replit-claude">
            <Eye className="h-4 w-4 mr-1" /> Replit/Claude
          </TabsTrigger>
          <TabsTrigger value="openai" data-testid="tab-openai">
            <Eye className="h-4 w-4 mr-1" /> OpenAI
          </TabsTrigger>
          <TabsTrigger value="diff" data-testid="tab-diff">
            <GitCompare className="h-4 w-4 mr-1" /> Diff
          </TabsTrigger>
          <TabsTrigger value="taskpack" data-testid="tab-taskpack">
            <ListChecks className="h-4 w-4 mr-1" /> Task Pack
          </TabsTrigger>
          <TabsTrigger value="packet" data-testid="tab-packet">
            <FileText className="h-4 w-4 mr-1" /> Packet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="space-y-4">
          {packet.score !== null && packet.score !== undefined ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-yellow-400" />
                  Page Score
                </CardTitle>
                <CardDescription>Averaged from both AI reviewers across 8 dimensions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center py-4">
                  <StarRating score={packet.score} size="lg" />
                </div>
                <ScoreBreakdownCard breakdown={packet.scoreBreakdown} />
              </CardContent>
            </Card>
          ) : hasSuccessRuns ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <p className="text-muted-foreground">Reviews completed. Click "Calculate Score" to generate the page score from both reviewers.</p>
                <Button
                  onClick={() => scoreMutation.mutate()}
                  disabled={scoreMutation.isPending}
                  data-testid="button-calculate-score-tab"
                >
                  {scoreMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Star className="h-4 w-4 mr-1" />}
                  Calculate Score
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">Run at least one review to generate a score.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="elements" className="space-y-4">
          {pageElementsA || pageElementsB ? (
            <div className="grid md:grid-cols-2 gap-4">
              {pageElementsA && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Replit/Claude - Element Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PageElementsView elements={pageElementsA} />
                  </CardContent>
                </Card>
              )}
              {pageElementsB && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">OpenAI - Element Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PageElementsView elements={pageElementsB} />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">Run reviews to see element-by-element analysis of buttons, forms, grids, data sources, and more.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="packet" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded max-h-[600px] overflow-auto" data-testid="text-packet-md">
                {packet.packetMd || "No packet content"}
              </pre>
            </CardContent>
          </Card>
          {packet.packetJson && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Packet JSON</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded max-h-[400px] overflow-auto">
                  {JSON.stringify(packet.packetJson, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="replit-claude">
          {runA ? <ReviewRunView run={runA} /> : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No Replit/Claude review yet. Click "Run Replit/Claude" to start.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="openai">
          {runB ? <ReviewRunView run={runB} /> : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No OpenAI review yet. Click "Run OpenAI" to start.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="diff">
          {runA?.status === "SUCCESS" && runB?.status === "SUCCESS" ? (
            <DiffView runA={runA} runB={runB} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Both reviews must complete successfully before you can view the diff.</p>
              {runA && <p>Replit/Claude: {runA.status}</p>}
              {runB && <p>OpenAI: {runB.status}</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="taskpack">
          {latestTaskpack ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {(latestTaskpack.mergedTasksJson as any)?.totalFindings || 0} Findings
                </Badge>
                <Badge variant="secondary">P0: {(latestTaskpack.mergedTasksJson as any)?.bySeverity?.P0 || 0}</Badge>
                <Badge variant="secondary">P1: {(latestTaskpack.mergedTasksJson as any)?.bySeverity?.P1 || 0}</Badge>
                <Badge variant="secondary">P2: {(latestTaskpack.mergedTasksJson as any)?.bySeverity?.P2 || 0}</Badge>
                <Badge variant="secondary">P3: {(latestTaskpack.mergedTasksJson as any)?.bySeverity?.P3 || 0}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(latestTaskpack.mergedTasksMd || "");
                    toast({ title: "Copied to clipboard" });
                  }}
                  data-testid="button-copy-taskpack"
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded max-h-[600px] overflow-auto" data-testid="text-taskpack-md">
                {latestTaskpack.mergedTasksMd || "No task pack content"}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No task pack yet. Run both reviews then click "Generate Task Pack".</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ReviewModePage() {
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");

  const { data: packets = [], isLoading } = useQuery<ReviewPacket[]>({
    queryKey: [`${API_BASE}/packets`],
  });

  const { data: targets = [] } = useQuery<ReviewTarget[]>({
    queryKey: [`${API_BASE}/targets`],
  });

  const targetMap: Record<string, ReviewTarget> = {};
  for (const t of targets) targetMap[t.id] = t;

  if (view === "new") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setView("list")} data-testid="button-back-from-new">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Reviews
        </Button>
        <NewReviewWizard onComplete={() => {
          setView("list");
          queryClient.invalidateQueries({ queryKey: [`${API_BASE}/packets`] });
        }} />
      </div>
    );
  }

  if (view === "detail" && selectedPacketId) {
    return (
      <PacketDetail
        packetId={selectedPacketId}
        onBack={() => { setView("list"); setSelectedPacketId(""); }}
      />
    );
  }

  const scoredTargets = targets.filter(t => t.latestScore !== null && t.latestScore !== undefined);
  const avgScore = scoredTargets.length > 0
    ? Math.round((scoredTargets.reduce((sum, t) => sum + (t.latestScore || 0), 0) / scoredTargets.length) * 10) / 10
    : null;

  return (
    <div className="space-y-6">
      {scoredTargets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Score Dashboard
            </CardTitle>
            <CardDescription>
              {scoredTargets.length} of {targets.length} pages scored | Average: {avgScore}/5
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {targets
                .sort((a, b) => (a.latestScore || 0) - (b.latestScore || 0))
                .map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 border rounded text-sm" data-testid={`target-score-${t.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {t.targetType === "MOBILE_PAGE" ? (
                        <Smartphone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Monitor className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate">{t.pageTitle}</span>
                    </div>
                    <StarRating score={t.latestScore} size="sm" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ContextManager />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Packets</CardTitle>
              <CardDescription>Page-by-page code reviews with dual AI opinions and scoring</CardDescription>
            </div>
            <Button onClick={() => setView("new")} data-testid="button-new-review">
              <Plus className="h-4 w-4 mr-1" /> New Review
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : packets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No review packets yet. Create your first review to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {packets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => { setSelectedPacketId(p.id); setView("detail"); }}
                  data-testid={`packet-row-${p.id}`}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={p.status} />
                    <div>
                      <div className="font-medium">{targetMap[p.targetId]?.pageTitle || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">
                        {targetMap[p.targetId]?.routePath} | {targetMap[p.targetId]?.module}
                      </div>
                    </div>
                    {p.score !== null && p.score !== undefined && <StarRating score={p.score} size="sm" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <Button size="sm" variant="ghost" data-testid={`button-view-packet-${p.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
