import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { JOBS_ROUTES } from "@shared/api-routes";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  Target,
  Search,
  MapPin,
  ChevronRight,
  Percent,
  UserCircle,
  History,
  Loader2,
} from "lucide-react";
import {
  SALES_STAGES,
  STAGE_STATUSES,
  STAGE_LABELS,
  STAGE_COLORS,
  OPPORTUNITY_TYPES,
  getDefaultStatus,
  getStatusLabel,
  type SalesStage,
} from "@shared/sales-pipeline";
import { PageHelpButton } from "@/components/help/page-help-button";

interface Opportunity {
  id: string;
  jobNumber: string;
  name: string;
  client: string | null;
  customerId: string | null;
  customerName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  referrer: string | null;
  engineerOnJob: string | null;
  estimatedValue: string | null;
  numberOfBuildings: number | null;
  numberOfLevels: number | null;
  opportunityStatus: string | null;
  salesStage: string | null;
  salesStatus: string | null;
  opportunityType: string | null;
  primaryContact: string | null;
  probability: number | null;
  estimatedStartDate: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StatusHistoryEntry {
  id: number;
  jobId: string;
  salesStage: string;
  salesStatus: string;
  note: string | null;
  changedByName: string | null;
  createdAt: string;
}

function formatCurrency(value: string | null) {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getOppTypeLabel(type: string | null) {
  if (!type) return "-";
  const found = OPPORTUNITY_TYPES.find((t) => t.value === type);
  return found?.label ?? formatStatusLabel(type);
}

export default function SalesPipelinePage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [detailTab, setDetailTab] = useState<"details" | "history">("details");

  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: [JOBS_ROUTES.OPPORTUNITIES],
  });

  const { data: statusHistory = [], isLoading: historyLoading } = useQuery<StatusHistoryEntry[]>({
    queryKey: [JOBS_ROUTES.OPPORTUNITIES, selectedOpp?.id, "history"],
    queryFn: async () => {
      if (!selectedOpp) return [];
      const res = await fetch(JOBS_ROUTES.OPPORTUNITY_HISTORY(selectedOpp.id), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: !!selectedOpp && detailTab === "history",
  });

  const updateOpportunity = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", JOBS_ROUTES.OPPORTUNITY_BY_ID(id), data);
      return res.json();
    },
    onSuccess: (updatedJob) => {
      queryClient.invalidateQueries({ queryKey: [JOBS_ROUTES.OPPORTUNITIES] });
      queryClient.invalidateQueries({ queryKey: [JOBS_ROUTES.OPPORTUNITIES, selectedOpp?.id, "history"] });
      if (selectedOpp) {
        setSelectedOpp({ ...selectedOpp, ...updatedJob });
      }
      setStatusNote("");
      toast({ title: "Opportunity updated" });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const filtered = opportunities.filter((opp) => {
    const matchSearch =
      !searchTerm ||
      opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.jobNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStage = stageFilter === "ALL" || opp.salesStage === stageFilter;
    return matchSearch && matchStage;
  });

  const totalValue = opportunities.reduce(
    (sum, o) => sum + (o.estimatedValue ? parseFloat(o.estimatedValue) : 0),
    0
  );
  const weightedValue = opportunities.reduce(
    (sum, o) =>
      sum +
      (o.estimatedValue ? parseFloat(o.estimatedValue) : 0) *
        ((o.probability || 0) / 100),
    0
  );
  const activeCount = opportunities.filter(
    (o) => o.salesStage !== "LOST" && !["LOST", "CANCELLED"].includes(o.status)
  ).length;
  const avgProbability =
    opportunities.length > 0
      ? Math.round(
          opportunities.reduce((sum, o) => sum + (o.probability || 0), 0) /
            opportunities.length
        )
      : 0;

  const stageCounts: Record<string, number> = {};
  SALES_STAGES.forEach((s) => {
    stageCounts[s] = opportunities.filter((o) => o.salesStage === s).length;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="page-sales-pipeline">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Sales Pipeline</h1>
          <PageHelpButton pageHelpKey="page.sales-pipeline" />
        </div>
        <p className="text-muted-foreground mt-1">Manage pre-sales opportunities and track conversions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-total-pipeline">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-pipeline">
              {formatCurrency(totalValue.toString())}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{opportunities.length} opportunities</p>
          </CardContent>
        </Card>
        <Card data-testid="card-weighted-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weighted Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-weighted-value">
              {formatCurrency(weightedValue.toString())}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Adjusted by probability</p>
          </CardContent>
        </Card>
        <Card data-testid="card-active-opps">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-count">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Excluding lost & cancelled</p>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-probability">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Probability</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-probability">{avgProbability}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across all opportunities</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Pipeline Chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            stageFilter === "ALL"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
          }`}
          onClick={() => setStageFilter("ALL")}
          data-testid="filter-stage-all"
        >
          All ({opportunities.length})
        </button>
        {SALES_STAGES.map((stage) => {
          const colors = STAGE_COLORS[stage];
          const isActive = stageFilter === stage;
          return (
            <button
              key={stage}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                isActive ? colors : "bg-muted text-muted-foreground border-transparent"
              }`}
              onClick={() => setStageFilter(stage === stageFilter ? "ALL" : stage)}
              data-testid={`filter-stage-${stage.toLowerCase()}`}
            >
              {STAGE_LABELS[stage]} ({stageCounts[stage] || 0})
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, customer, city, job number..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-pipeline"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-pulse text-muted-foreground">Loading opportunities...</div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="font-semibold text-lg">No opportunities found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {searchTerm || stageFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Opportunities created from mobile will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Sales Stage</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Est. Value</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Prob.</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((opp) => {
                  const stage = (opp.salesStage || "OPPORTUNITY") as SalesStage;
                  return (
                    <tr
                      key={opp.id}
                      className="border-b last:border-b-0 hover-elevate cursor-pointer"
                      onClick={() => {
                        setSelectedOpp(opp);
                        setDetailTab("details");
                        setStatusNote("");
                      }}
                      data-testid={`row-opportunity-${opp.id}`}
                    >
                      <td className="p-3">
                        <div className="font-medium">{opp.name}</div>
                        <div className="text-xs text-muted-foreground">{opp.jobNumber}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">{opp.customerName || opp.client || "-"}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {opp.city || "-"}{opp.state ? `, ${opp.state}` : ""}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${STAGE_COLORS[stage]}`}>
                          {STAGE_LABELS[stage]}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">
                          {opp.salesStatus
                            ? getStatusLabel(stage, opp.salesStatus)
                            : "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">
                          {getOppTypeLabel(opp.opportunityType)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-medium text-sm">{formatCurrency(opp.estimatedValue)}</span>
                      </td>
                      <td className="p-3 text-center">
                        {opp.probability != null ? (
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${opp.probability}%`,
                                  background:
                                    opp.probability >= 70
                                      ? "#22c55e"
                                      : opp.probability >= 40
                                      ? "#eab308"
                                      : "#ef4444",
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{opp.probability}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDate(opp.createdAt)}</td>
                      <td className="p-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedOpp} onOpenChange={(open) => !open && setSelectedOpp(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {selectedOpp?.name}
              <span className="text-xs text-muted-foreground font-normal">{selectedOpp?.jobNumber}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedOpp && (
            <div className="space-y-4">
              {/* Stage badge row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={STAGE_COLORS[(selectedOpp.salesStage || "OPPORTUNITY") as SalesStage]}>
                  {STAGE_LABELS[(selectedOpp.salesStage || "OPPORTUNITY") as SalesStage]}
                </Badge>
                {selectedOpp.salesStatus && (
                  <span className="text-sm text-muted-foreground">
                    {getStatusLabel((selectedOpp.salesStage || "OPPORTUNITY") as SalesStage, selectedOpp.salesStatus)}
                  </span>
                )}
                {selectedOpp.opportunityType && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {getOppTypeLabel(selectedOpp.opportunityType)}
                  </Badge>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b">
                <button
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === "details"
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground"
                  }`}
                  onClick={() => setDetailTab("details")}
                  data-testid="tab-details"
                >
                  Details
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    detailTab === "history"
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground"
                  }`}
                  onClick={() => setDetailTab("history")}
                  data-testid="tab-history"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              </div>

              {detailTab === "details" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Customer</div>
                      <div className="text-sm font-medium">{selectedOpp.customerName || selectedOpp.client || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Location</div>
                      <div className="text-sm font-medium">
                        {selectedOpp.city || "-"}{selectedOpp.state ? `, ${selectedOpp.state}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Address</div>
                      <div className="text-sm">{selectedOpp.address || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Estimated Value</div>
                      <div className="text-sm font-medium">{formatCurrency(selectedOpp.estimatedValue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Probability</div>
                      <div className="text-sm font-medium">{selectedOpp.probability != null ? `${selectedOpp.probability}%` : "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Est. Start Date</div>
                      <div className="text-sm">{formatDate(selectedOpp.estimatedStartDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Referrer</div>
                      <div className="text-sm">{selectedOpp.referrer || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Engineer</div>
                      <div className="text-sm">{selectedOpp.engineerOnJob || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Primary Contact</div>
                      <div className="text-sm">{selectedOpp.primaryContact || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Opportunity Type</div>
                      <div className="text-sm">{getOppTypeLabel(selectedOpp.opportunityType)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Buildings</div>
                      <div className="text-sm">{selectedOpp.numberOfBuildings ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Levels</div>
                      <div className="text-sm">{selectedOpp.numberOfLevels ?? "-"}</div>
                    </div>
                  </div>

                  {selectedOpp.comments && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Comments</div>
                      <div className="text-sm bg-muted/50 rounded-md p-3">{selectedOpp.comments}</div>
                    </div>
                  )}

                  {/* Sales Stage/Status Update */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Update Sales Stage</div>
                    <div className="flex flex-wrap gap-2">
                      {SALES_STAGES.map((stage) => (
                        <Button
                          key={stage}
                          variant={selectedOpp.salesStage === stage ? "default" : "outline"}
                          size="sm"
                          className={selectedOpp.salesStage === stage ? "" : STAGE_COLORS[stage]}
                          onClick={() => {
                            const newStatus = getDefaultStatus(stage);
                            updateOpportunity.mutate({
                              id: selectedOpp.id,
                              data: { salesStage: stage, salesStatus: newStatus, statusNote: statusNote || undefined },
                            });
                          }}
                          disabled={updateOpportunity.isPending}
                          data-testid={`button-stage-${stage.toLowerCase()}`}
                        >
                          {STAGE_LABELS[stage]}
                        </Button>
                      ))}
                    </div>

                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-3">Update Status</div>
                    <Select
                      value={selectedOpp.salesStatus || ""}
                      onValueChange={(val) => {
                        updateOpportunity.mutate({
                          id: selectedOpp.id,
                          data: { salesStatus: val, statusNote: statusNote || undefined },
                        });
                      }}
                    >
                      <SelectTrigger className="w-full" data-testid="select-detail-status">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_STATUSES[(selectedOpp.salesStage || "OPPORTUNITY") as SalesStage]?.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Note (optional)</div>
                      <Textarea
                        placeholder="Add a note about this status change..."
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        className="resize-none text-sm"
                        rows={2}
                        data-testid="input-status-note"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* History Tab */
                <div className="space-y-3">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : statusHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No status history recorded yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {statusHistory.map((entry) => {
                        const stage = entry.salesStage as SalesStage;
                        return (
                          <div
                            key={entry.id}
                            className="flex gap-3 items-start"
                            data-testid={`history-entry-${entry.id}`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[stage]?.split(" ")[0] || "bg-muted"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-xs ${STAGE_COLORS[stage] || ""}`}>
                                  {STAGE_LABELS[stage] || stage}
                                </Badge>
                                <span className="text-sm">
                                  {getStatusLabel(stage, entry.salesStatus)}
                                </span>
                              </div>
                              {entry.note && (
                                <p className="text-sm text-muted-foreground mt-1">{entry.note}</p>
                              )}
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                <span>{formatDateTime(entry.createdAt)}</span>
                                {entry.changedByName && (
                                  <>
                                    <span className="text-muted-foreground/40">by</span>
                                    <span className="flex items-center gap-1">
                                      <UserCircle className="h-3 w-3" />
                                      {entry.changedByName}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
