import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LOGISTICS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { dateInputProps } from "@/lib/validation";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  RotateCcw,
  Package,
  Clock,
  CheckCircle,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import type { Job, TrailerType } from "@shared/schema";

interface LoadListWithDetails {
  id: string;
  jobId: string;
  trailerTypeId?: string | null;
  docketNumber?: string | null;
  scheduledDate?: string | null;
  loadDate?: string | null;
  notes?: string | null;
  status: string;
  factory: string;
  job: Job;
  trailerType?: TrailerType | null;
  panels: { id: string; panelId: string; sequence: number; panel: { id: string; panelMark: string; panelMass: string | null; panelType: string | null } }[];
  deliveryRecord?: any;
  loadReturn?: any;
}

interface CollapsibleSectionProps {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 active:scale-[0.99]"
        data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="h-4 w-4 text-orange-400" />
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="text-xs text-white/60 mb-1.5 block truncate">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20";

export default function MobileReturnLoadPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedLoadListId = params.get("loadListId");

  const [selectedLoadListId, setSelectedLoadListId] = useState(preselectedLoadListId || "");
  const [returnType, setReturnType] = useState<"FULL" | "PARTIAL">("FULL");
  const [returnReason, setReturnReason] = useState("");
  const [returnDate, setReturnDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leftFactoryTime, setLeftFactoryTime] = useState("");
  const [arrivedFactoryTime, setArrivedFactoryTime] = useState("");
  const [unloadedAtFactoryTime, setUnloadedAtFactoryTime] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [selectedPanelIds, setSelectedPanelIds] = useState<Set<string>>(new Set());

  const { data: loadLists = [], isLoading } = useQuery<LoadListWithDetails[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const completedLoadLists = loadLists.filter(l => (l.status === "COMPLETE" || l.status === "DELIVERED") && !l.loadReturn);
  const selectedLoadList = loadLists.find(l => l.id === selectedLoadListId);

  useEffect(() => {
    if (returnType === "FULL") {
      setSelectedPanelIds(new Set());
    }
  }, [returnType]);

  const createReturnMutation = useMutation({
    mutationFn: async ({ loadListId, data }: { loadListId: string; data: any }) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LIST_RETURN(loadListId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      setLocation("/mobile/logistics");
    },
    onError: (error: any) => {
      toast({ title: "Failed to record return", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedLoadListId) {
      toast({ title: "Select a load list", variant: "destructive" });
      return;
    }
    if (!returnReason.trim()) {
      toast({ title: "Return reason is required", variant: "destructive" });
      return;
    }
    if (returnType === "PARTIAL" && selectedPanelIds.size === 0) {
      toast({ title: "Select at least one panel for partial return", variant: "destructive" });
      return;
    }

    createReturnMutation.mutate({
      loadListId: selectedLoadListId,
      data: {
        returnType,
        returnReason: returnReason.trim(),
        returnDate: returnDate || undefined,
        leftFactoryTime: leftFactoryTime || undefined,
        arrivedFactoryTime: arrivedFactoryTime || undefined,
        unloadedAtFactoryTime: unloadedAtFactoryTime || undefined,
        notes: returnNotes || undefined,
        panelIds: returnType === "PARTIAL" ? Array.from(selectedPanelIds) : [],
      },
    });
  };

  const togglePanel = (panelId: string) => {
    setSelectedPanelIds(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) { next.delete(panelId); } else { next.add(panelId); }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Return Load">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/logistics">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-xl font-bold" data-testid="text-return-load-title">Return Load</div>
            <div className="text-sm text-white/60">
              {selectedLoadList ? `${selectedLoadList.job.jobNumber} - ${selectedLoadList.panels.length} panels` : "Select a completed load"}
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={createReturnMutation.isPending || !selectedLoadListId}
            className="bg-orange-600 text-white"
            data-testid="button-save-return"
          >
            {createReturnMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs text-white/60 mb-1.5 block">Select Completed Load</label>
          {isLoading ? (
            <Skeleton className="h-10 rounded-xl bg-white/10" />
          ) : (
            <select
              value={selectedLoadListId}
              onChange={(e) => setSelectedLoadListId(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              aria-required="true"
              data-testid="select-load-list"
            >
              <option value="" className="bg-[#0D1117]">Select a completed load list...</option>
              {completedLoadLists.map((ll) => (
                <option key={ll.id} value={ll.id} className="bg-[#0D1117]">
                  {ll.job.jobNumber} - {ll.docketNumber || `Load #${ll.id.slice(-6)}`} ({ll.panels.length} panels)
                </option>
              ))}
            </select>
          )}

          {selectedLoadList && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{selectedLoadList.job.jobNumber} - {selectedLoadList.job.name}</span>
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  Delivered
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                <span>{selectedLoadList.panels.length} panels</span>
                <span>{selectedLoadList.factory}</span>
                {selectedLoadList.trailerType && <span>{selectedLoadList.trailerType.name}</span>}
              </div>
            </div>
          )}
        </div>

        {selectedLoadListId && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <label className="text-xs text-white/60 block">Return Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setReturnType("FULL")}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors active:scale-[0.99] ${
                    returnType === "FULL"
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                  data-testid="button-return-full"
                >
                  <Package className="h-5 w-5 mx-auto mb-1" />
                  Full Load
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType("PARTIAL")}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors active:scale-[0.99] ${
                    returnType === "PARTIAL"
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                  data-testid="button-return-partial"
                >
                  <Package className="h-5 w-5 mx-auto mb-1" />
                  Partial
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <FormRow label="Reason for Return *">
                <textarea
                  placeholder="Enter reason for return..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  aria-required="true"
                  data-testid="input-return-reason"
                />
              </FormRow>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <FormRow label="Return Date">
                <Input
                  type="date"
                  {...dateInputProps}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={`${inputClass} [color-scheme:dark] min-w-0 max-w-[70%]`}
                  data-testid="input-return-date"
                />
              </FormRow>
            </div>

            <CollapsibleSection title="Return Timestamps" icon={Clock} defaultOpen>
              <div className="space-y-3">
                <FormRow label="Left Factory">
                  <Input
                    type="time"
                    value={leftFactoryTime}
                    onChange={(e) => setLeftFactoryTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-left-factory"
                  />
                </FormRow>
                <FormRow label="Arrived at Factory">
                  <Input
                    type="time"
                    value={arrivedFactoryTime}
                    onChange={(e) => setArrivedFactoryTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-arrived-factory"
                  />
                </FormRow>
                <FormRow label="Unloaded at Factory">
                  <Input
                    type="time"
                    value={unloadedAtFactoryTime}
                    onChange={(e) => setUnloadedAtFactoryTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-unloaded-factory"
                  />
                </FormRow>
              </div>
            </CollapsibleSection>

            {returnType === "PARTIAL" && selectedLoadList && (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-400">
                    Select Panels to Return
                  </span>
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                    {selectedPanelIds.size} / {selectedLoadList.panels.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {selectedLoadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => {
                    const isSelected = selectedPanelIds.has(lp.panel.id);
                    return (
                      <button
                        key={lp.id}
                        type="button"
                        onClick={() => togglePanel(lp.panel.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left active:scale-[0.99] transition-colors ${
                          isSelected
                            ? "bg-orange-500/20 border-orange-500/50"
                            : "bg-white/5 border-white/10"
                        }`}
                        data-testid={`return-panel-${lp.panel.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            isSelected ? "border-orange-400 bg-orange-500" : "border-white/30"
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                          <span className={`font-medium text-sm ${isSelected ? "text-orange-300" : "text-white"}`}>
                            {lp.panel.panelMark}
                          </span>
                        </div>
                        <div className="text-xs text-white/40">
                          {lp.panel.panelType && <span>{lp.panel.panelType}</span>}
                          {lp.panel.panelMass && <span className="ml-2">{parseFloat(lp.panel.panelMass).toLocaleString()} kg</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <FormRow label="Notes">
                <textarea
                  placeholder="Any additional notes..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  data-testid="input-return-notes"
                />
              </FormRow>
            </div>

            <div className="pt-2 pb-4">
              <Button
                onClick={handleSubmit}
                disabled={createReturnMutation.isPending || !selectedLoadListId}
                className="w-full bg-orange-600 text-white py-6 rounded-2xl text-base font-semibold"
                data-testid="button-submit-return"
              >
                {createReturnMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="h-5 w-5 mr-2" />
                )}
                Record Return
              </Button>
            </div>
          </>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
