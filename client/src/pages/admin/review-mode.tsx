import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft, Loader2, Monitor, Smartphone, Star, BarChart3,
  Search, CheckCircle2, XCircle, Clock, AlertTriangle, FileText,
  Download, ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Trash2, User
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
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

interface ReviewAudit {
  id: string;
  targetId: string;
  overallScore: number;
  scoreBreakdown: any;
  findingsMd: string | null;
  fixesAppliedMd: string | null;
  issuesFound: number;
  issuesFixed: number;
  status: string;
  reviewedAt: string;
}

interface DiscoveredPage {
  targetType: string;
  routePath: string;
  pageTitle: string;
  module: string;
  frontendEntryFile: string;
  componentName: string;
}

interface QueueData {
  unreviewed: ReviewTarget[];
  needsWork: ReviewTarget[];
  reviewed: ReviewTarget[];
  stats: {
    total: number;
    unreviewedCount: number;
    needsWorkCount: number;
    reviewedCount: number;
    avgScore: number | null;
  };
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    SUCCESS: { variant: "default", icon: CheckCircle2 },
    GENERATED: { variant: "default", icon: CheckCircle2 },
    PENDING: { variant: "secondary", icon: Clock },
    DRAFT: { variant: "outline", icon: FileText },
    FAILED: { variant: "destructive", icon: XCircle },
    REVIEWED: { variant: "default", icon: CheckCircle2 },
    FIXES_APPLIED: { variant: "secondary", icon: CheckCircle2 },
    RE_REVIEW_NEEDED: { variant: "destructive", icon: AlertTriangle },
  };
  const config = variants[status] || { variant: "outline" as const, icon: Clock };
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3 mr-1" />
      {status.replace(/_/g, " ")}
    </Badge>
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
          <div key={key} className="flex flex-col items-center p-2 border rounded-md">
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

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 4) return "text-green-600";
  if (score >= 3) return "text-yellow-600";
  return "text-red-600";
}

function TargetRow({ target, onClick }: { target: ReviewTarget; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`target-row-${target.id}`}
    >
      {target.targetType === "MOBILE_PAGE" ? (
        <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      ) : (
        <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{target.pageTitle}</div>
        <div className="text-xs text-muted-foreground truncate">{target.routePath}</div>
      </div>
      <Badge variant="outline" className="flex-shrink-0 text-xs">{target.module}</Badge>
      <div className="flex-shrink-0">
        <StarRating score={target.latestScore} size="sm" />
      </div>
      <div className="text-xs text-muted-foreground flex-shrink-0 w-24 text-right">
        {target.lastReviewedAt
          ? new Date(target.lastReviewedAt).toLocaleDateString()
          : "Never"}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

function TargetList({ targets, search, onSelect }: { targets: ReviewTarget[]; search: string; onSelect: (t: ReviewTarget) => void }) {
  const filtered = useMemo(() => {
    if (!search) return targets;
    const q = search.toLowerCase();
    return targets.filter(
      (t) =>
        t.pageTitle.toLowerCase().includes(q) ||
        t.routePath.toLowerCase().includes(q) ||
        t.module.toLowerCase().includes(q)
    );
  }, [targets, search]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-target-list">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{search ? "No pages match your search." : "No pages in this category yet."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="target-list">
      {filtered.map((t) => (
        <TargetRow key={t.id} target={t} onClick={() => onSelect(t)} />
      ))}
    </div>
  );
}

function DashboardView({ onSelectTarget, onDiscover }: { onSelectTarget: (t: ReviewTarget) => void; onDiscover: () => void }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const { data: queueData, isLoading } = useQuery<QueueData>({
    queryKey: [`${API_BASE}/queue`],
  });

  const allTargets = useMemo(() => {
    if (!queueData) return [];
    const all = [
      ...queueData.unreviewed,
      ...queueData.needsWork,
      ...queueData.reviewed,
    ];
    return all.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
  }, [queueData]);

  const needsWorkTargets = useMemo(() => {
    if (!queueData) return [];
    return [...queueData.needsWork].sort((a, b) => (a.latestScore ?? 0) - (b.latestScore ?? 0));
  }, [queueData]);

  const unreviewedTargets = useMemo(() => {
    if (!queueData) return [];
    return queueData.unreviewed;
  }, [queueData]);

  const stats = queueData?.stats;

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="dashboard-loading">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="dashboard-view">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Review Scoreboard</h1>
          <p className="text-sm text-muted-foreground">Track agent-driven page audit progress</p>
        </div>
        <Button onClick={onDiscover} data-testid="button-discover-pages">
          <Download className="h-4 w-4 mr-2" />
          Discover Pages
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="stats-bar">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Pages</p>
            <p className="text-2xl font-bold" data-testid="stat-total">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Reviewed</p>
            <p className="text-2xl font-bold text-green-600" data-testid="stat-reviewed">{stats?.reviewedCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Needs Work</p>
            <p className="text-2xl font-bold text-yellow-600" data-testid="stat-needs-work">{stats?.needsWorkCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Unreviewed</p>
            <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-unreviewed">{stats?.unreviewedCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Avg Score</p>
            <p className={`text-2xl font-bold ${scoreColor(stats?.avgScore ?? null)}`} data-testid="stat-avg-score">
              {stats?.avgScore !== null && stats?.avgScore !== undefined ? stats.avgScore.toFixed(1) : "--"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, route, or module..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
          data-testid="input-search-targets"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} data-testid="tabs-target-categories">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-pages">
            All Pages ({allTargets.length})
          </TabsTrigger>
          <TabsTrigger value="needsWork" data-testid="tab-needs-work">
            Needs Work ({needsWorkTargets.length})
          </TabsTrigger>
          <TabsTrigger value="unreviewed" data-testid="tab-unreviewed">
            Unreviewed ({unreviewedTargets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <TargetList targets={allTargets} search={search} onSelect={onSelectTarget} />
        </TabsContent>
        <TabsContent value="needsWork">
          <TargetList targets={needsWorkTargets} search={search} onSelect={onSelectTarget} />
        </TabsContent>
        <TabsContent value="unreviewed">
          <TargetList targets={unreviewedTargets} search={search} onSelect={onSelectTarget} />
        </TabsContent>
      </Tabs>

      {stats?.total === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="font-semibold mb-1">No pages imported yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use the Discover Pages button to scan your codebase and import pages for review tracking.
            </p>
            <Button onClick={onDiscover} data-testid="button-discover-empty">
              <Download className="h-4 w-4 mr-2" />
              Discover Pages
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ManualAssessment {
  id: string;
  targetId: string;
  percentComplete: number;
  starRating: number;
  comments: string | null;
  assessedByUserId: string | null;
  assessedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

function InteractiveStarRating({ value, onChange, size = "md" }: { value: number; onChange: (v: number) => void; size?: "sm" | "md" | "lg" }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const sizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  return (
    <div className="flex items-center gap-1" data-testid="interactive-star-rating">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sizeClass} cursor-pointer transition-colors ${
            s <= (hovered ?? value)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30 hover:text-yellow-300"
          }`}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(null)}
          data-testid={`star-select-${s}`}
        />
      ))}
      <span className="ml-2 font-semibold text-sm">{hovered ?? value}/5</span>
    </div>
  );
}

function ManualAssessmentSection({ targetId }: { targetId: string }) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<ManualAssessment | null>(null);
  const [starRating, setStarRating] = useState(3);
  const [percentComplete, setPercentComplete] = useState(50);
  const [comments, setComments] = useState("");

  const { data: assessments = [], isLoading } = useQuery<ManualAssessment[]>({
    queryKey: [`${API_BASE}/assessments`, { targetId }],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { targetId: string; percentComplete: number; starRating: number; comments: string | null }) => {
      const res = await apiRequest("POST", `${API_BASE}/assessments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/assessments`] });
      toast({ title: "Assessment added successfully" });
      resetForm();
      setShowAddDialog(false);
    },
    onError: () => toast({ title: "Failed to add assessment", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { percentComplete?: number; starRating?: number; comments?: string | null } }) => {
      const res = await apiRequest("PATCH", `${API_BASE}/assessments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/assessments`] });
      toast({ title: "Assessment updated successfully" });
      setEditingAssessment(null);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update assessment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${API_BASE}/assessments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/assessments`] });
      toast({ title: "Assessment deleted" });
    },
    onError: () => toast({ title: "Failed to delete assessment", variant: "destructive" }),
  });

  const resetForm = () => {
    setStarRating(3);
    setPercentComplete(50);
    setComments("");
  };

  const openAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEdit = (a: ManualAssessment) => {
    setEditingAssessment(a);
    setStarRating(a.starRating);
    setPercentComplete(a.percentComplete);
    setComments(a.comments || "");
  };

  const handleSubmit = () => {
    if (editingAssessment) {
      updateMutation.mutate({
        id: editingAssessment.id,
        data: { starRating, percentComplete, comments: comments || null },
      });
    } else {
      createMutation.mutate({
        targetId,
        starRating,
        percentComplete,
        comments: comments || null,
      });
    }
  };

  const latestAssessment = assessments.length > 0 ? assessments[0] : null;

  return (
    <Card data-testid="manual-assessment-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">My Assessment - % Complete</CardTitle>
            <CardDescription>Your own star rating and progress assessment with comments</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} data-testid="button-add-assessment">
            <Plus className="h-4 w-4 mr-1" />
            Add Assessment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {latestAssessment && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/30" data-testid="latest-assessment-summary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Assessment</span>
              <Badge variant="outline" className="text-xs">
                {new Date(latestAssessment.updatedAt).toLocaleDateString()} {new Date(latestAssessment.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <StarRating score={latestAssessment.starRating} size="md" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      latestAssessment.percentComplete >= 80 ? "bg-green-500" :
                      latestAssessment.percentComplete >= 50 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${latestAssessment.percentComplete}%` }}
                  />
                </div>
                <span className="text-sm font-bold" data-testid="text-percent-complete">{latestAssessment.percentComplete}%</span>
              </div>
            </div>
            {latestAssessment.comments && (
              <p className="text-sm text-muted-foreground mt-2 italic" data-testid="text-latest-comment">"{latestAssessment.comments}"</p>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-assessments">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No assessments recorded yet. Add your first assessment above.</p>
          </div>
        ) : (
          <div>
            <h4 className="text-sm font-medium mb-2">Assessment History ({assessments.length})</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="assessment-history-list">
              {assessments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 border rounded-md" data-testid={`assessment-row-${a.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <StarRating score={a.starRating} size="sm" />
                      <div className="flex items-center gap-1">
                        <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              a.percentComplete >= 80 ? "bg-green-500" :
                              a.percentComplete >= 50 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${a.percentComplete}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{a.percentComplete}%</span>
                      </div>
                    </div>
                    {a.comments && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`text-comment-${a.id}`}>{a.comments}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {a.assessedByName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {a.assessedByName}
                        </span>
                      )}
                      <span>
                        {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {a.updatedAt !== a.createdAt && (
                        <span className="italic">(updated {new Date(a.updatedAt).toLocaleDateString()} {new Date(a.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} data-testid={`button-edit-assessment-${a.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-assessment-${a.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={showAddDialog || !!editingAssessment} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingAssessment(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="assessment-dialog">
          <DialogHeader>
            <DialogTitle>{editingAssessment ? "Update Assessment" : "Add Assessment"}</DialogTitle>
            <DialogDescription>
              Rate the page completion with stars and set percent complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Star Rating</label>
              <InteractiveStarRating value={starRating} onChange={setStarRating} size="lg" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Percent Complete: <span className="font-bold">{percentComplete}%</span></label>
              <Slider
                value={[percentComplete]}
                onValueChange={(v) => setPercentComplete(v[0])}
                max={100}
                min={0}
                step={5}
                className="mt-2"
                data-testid="slider-percent-complete"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Comments</label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your assessment notes..."
                rows={3}
                data-testid="input-assessment-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingAssessment(null); resetForm(); }} data-testid="button-cancel-assessment">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-assessment"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAssessment ? "Update" : "Save"} Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TargetDetailView({ target, onBack }: { target: ReviewTarget; onBack: () => void }) {
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const { data: audits = [], isLoading } = useQuery<ReviewAudit[]>({
    queryKey: [`${API_BASE}/audits`, { targetId: target.id }],
  });

  return (
    <div className="space-y-4" data-testid="target-detail-view">
      <Button variant="ghost" onClick={onBack} data-testid="button-back-dashboard">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Scoreboard
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            {target.targetType === "MOBILE_PAGE" ? (
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Monitor className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle data-testid="text-target-title">{target.pageTitle}</CardTitle>
              <CardDescription>{target.routePath}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Module</span>
              <p className="font-medium" data-testid="text-target-module">{target.module}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Entry File</span>
              <p className="font-medium truncate" data-testid="text-target-entry">{target.frontendEntryFile}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Type</span>
              <p className="font-medium" data-testid="text-target-type">{target.targetType.replace(/_/g, " ")}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Last Reviewed</span>
              <p className="font-medium" data-testid="text-target-last-reviewed">
                {target.lastReviewedAt ? new Date(target.lastReviewedAt).toLocaleDateString() : "Never"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Latest Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StarRating score={target.latestScore} size="lg" />
          <ScoreBreakdownCard breakdown={target.latestScoreBreakdown} />
          {target.latestScore === null && (
            <p className="text-sm text-muted-foreground">This page has not been audited yet.</p>
          )}
        </CardContent>
      </Card>

      <ManualAssessmentSection targetId={target.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit History</CardTitle>
          <CardDescription>{audits.length} audit{audits.length !== 1 ? "s" : ""} recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : audits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-audit-list">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No audits recorded yet for this page.</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="audit-list">
              {audits.map((audit) => {
                const isExpanded = expandedAuditId === audit.id;
                return (
                  <div key={audit.id} className="border rounded-md" data-testid={`audit-row-${audit.id}`}>
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover-elevate"
                      onClick={() => setExpandedAuditId(isExpanded ? null : audit.id)}
                      data-testid={`button-expand-audit-${audit.id}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {new Date(audit.reviewedAt).toLocaleDateString()} {new Date(audit.reviewedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <StatusBadge status={audit.status} />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <StarRating score={audit.overallScore} size="sm" />
                        <div className="text-xs text-muted-foreground space-x-2">
                          <span data-testid={`text-issues-found-${audit.id}`}>{audit.issuesFound} found</span>
                          <span data-testid={`text-issues-fixed-${audit.id}`}>{audit.issuesFixed} fixed</span>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t p-4 space-y-4" data-testid={`audit-detail-${audit.id}`}>
                        {audit.scoreBreakdown && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Score Breakdown</h4>
                            <ScoreBreakdownCard breakdown={audit.scoreBreakdown} />
                          </div>
                        )}
                        {audit.findingsMd && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Findings</h4>
                            <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-md max-h-96 overflow-y-auto" data-testid={`text-findings-${audit.id}`}>
                              {audit.findingsMd}
                            </pre>
                          </div>
                        )}
                        {audit.fixesAppliedMd && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Fixes Applied</h4>
                            <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-md max-h-96 overflow-y-auto" data-testid={`text-fixes-${audit.id}`}>
                              {audit.fixesAppliedMd}
                            </pre>
                          </div>
                        )}
                        {!audit.findingsMd && !audit.fixesAppliedMd && (
                          <p className="text-sm text-muted-foreground">No detailed findings or fixes recorded for this audit.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiscoverView({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();

  const { data: discoveredPages = [], isLoading: isDiscovering } = useQuery<DiscoveredPage[]>({
    queryKey: [`${API_BASE}/discover`],
  });

  const { data: existingTargets = [] } = useQuery<ReviewTarget[]>({
    queryKey: [`${API_BASE}/targets`],
  });

  const existingKeys = useMemo(
    () => new Set(existingTargets.map((t) => `${t.targetType}::${t.routePath}`)),
    [existingTargets]
  );

  const newPages = useMemo(
    () => discoveredPages.filter((p) => !existingKeys.has(`${p.targetType}::${p.routePath}`)),
    [discoveredPages, existingKeys]
  );

  const alreadyImported = discoveredPages.length - newPages.length;

  const bulkImportMutation = useMutation({
    mutationFn: async (pages: Array<{ targetType: string; routePath: string; pageTitle: string; module: string; frontendEntryFile: string }>) => {
      const res = await apiRequest("POST", `${API_BASE}/targets/bulk`, pages);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/targets`] });
      queryClient.invalidateQueries({ queryKey: [`${API_BASE}/queue`] });
      const created = data.created?.length || 0;
      const skipped = data.skipped || 0;
      toast({ title: `${created} pages imported${skipped > 0 ? `, ${skipped} already existed` : ""}` });
      onBack();
    },
    onError: () => {
      toast({ title: "Failed to import pages", variant: "destructive" });
    },
  });

  const handleImportAll = () => {
    const pages = newPages.map(({ componentName, ...rest }) => rest);
    bulkImportMutation.mutate(pages);
  };

  return (
    <div className="space-y-4" data-testid="discover-view">
      <Button variant="ghost" onClick={onBack} data-testid="button-back-from-discover">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Scoreboard
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Discover Pages</h1>
          <p className="text-sm text-muted-foreground">Auto-discovered pages from your application routes</p>
        </div>
        {newPages.length > 0 && (
          <Button
            onClick={handleImportAll}
            disabled={bulkImportMutation.isPending}
            data-testid="button-import-all"
          >
            {bulkImportMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Import All ({newPages.length})
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Discovered</p>
            <p className="text-2xl font-bold" data-testid="stat-discovered-total">{discoveredPages.length}</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">New</p>
            <p className="text-2xl font-bold text-green-600" data-testid="stat-discovered-new">{newPages.length}</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Already Imported</p>
            <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-discovered-existing">{alreadyImported}</p>
          </CardContent>
        </Card>
      </div>

      {isDiscovering ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Scanning codebase...</span>
        </div>
      ) : newPages.length === 0 && discoveredPages.length > 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-600 opacity-60" />
            <p className="text-sm text-muted-foreground">All discovered pages are already imported.</p>
          </CardContent>
        </Card>
      ) : newPages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No pages discovered from your application routes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" data-testid="discovered-pages-list">
          {newPages.map((p) => (
            <div
              key={`${p.targetType}::${p.routePath}`}
              className="flex items-center gap-3 p-3 border rounded-md"
              data-testid={`discover-page-${p.routePath}`}
            >
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
              <span className="text-xs text-muted-foreground flex-shrink-0">{p.componentName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewModePage() {
  const [view, setView] = useState<"dashboard" | "target-detail" | "discover">("dashboard");
  const [selectedTarget, setSelectedTarget] = useState<ReviewTarget | null>(null);

  const handleSelectTarget = (target: ReviewTarget) => {
    setSelectedTarget(target);
    setView("target-detail");
  };

  const handleBackToDashboard = () => {
    setSelectedTarget(null);
    setView("dashboard");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="review-mode-page">
      {view === "dashboard" && (
        <DashboardView
          onSelectTarget={handleSelectTarget}
          onDiscover={() => setView("discover")}
        />
      )}
      {view === "target-detail" && selectedTarget && (
        <TargetDetailView
          target={selectedTarget}
          onBack={handleBackToDashboard}
        />
      )}
      {view === "discover" && (
        <DiscoverView onBack={handleBackToDashboard} />
      )}
    </div>
  );
}
