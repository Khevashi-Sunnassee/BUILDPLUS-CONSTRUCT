import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { REO_SCHEDULE_ROUTES, JOBS_ROUTES, PROCUREMENT_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCtrlScrollZoom } from "@/hooks/use-ctrl-scroll-zoom";
import { 
  ChevronDown, ChevronRight, Briefcase, Search, FileText, 
  Cpu, CheckCircle2, XCircle, Clock, ShoppingCart, Loader2, Plus,
  X, FileImage, Ruler, Package, Layers, Download, Eye, ZoomIn, ZoomOut, Save, Edit
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Job, PanelRegister, ReoSchedule, ReoScheduleItem, ReoScheduleWithDetails, Supplier } from "@shared/schema";

interface IfcPanelWithSchedule extends PanelRegister {
  job: Job;
  reoSchedule?: ReoSchedule | null;
}

interface ReoScheduleBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: IfcPanelWithSchedule | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  schedule: ReoScheduleWithDetails | null;
  onProcessWithAI: (scheduleId: string) => void;
  isProcessing: boolean;
  onUpdateItemStatus: (scheduleId: string, itemId: string, status: string) => void;
  onBulkUpdateStatus: (scheduleId: string, itemIds: string[], status: string) => void;
  isBulkUpdating: boolean;
  onRefreshSchedule: (scheduleId: string) => void;
  getScheduleStatusBadge: (status: string | undefined) => React.ReactNode;
  suppliers: Supplier[];
  onCreatePo: (scheduleId: string, supplierId: string, itemIds: string[], notes?: string) => void;
  isCreatingPo: boolean;
}

function ReoScheduleBuilderDialog({
  open,
  onOpenChange,
  panel,
  notes,
  onNotesChange,
  onSubmit,
  isSubmitting,
  schedule,
  onProcessWithAI,
  isProcessing,
  onUpdateItemStatus,
  onBulkUpdateStatus,
  isBulkUpdating,
  onRefreshSchedule,
  getScheduleStatusBadge,
  suppliers,
  onCreatePo,
  isCreatingPo,
}: ReoScheduleBuilderDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfZoom, setPdfZoom] = useState(100);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>("details");
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [poNotes, setPoNotes] = useState("");
  const [panelEdits, setPanelEdits] = useState<Record<string, string | null>>({});
  const [hasPanelChanges, setHasPanelChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["basic", "dimensions"]));
  const { toast } = useToast();

  useEffect(() => {
    const panelForPdf = panel || (schedule?.panel ? { ...schedule.panel, job: schedule.job } as IfcPanelWithSchedule : null);
    if (open && panelForPdf?.productionPdfUrl) {
      setPdfLoading(true);
      setPdfError(null);
      fetch(`${ADMIN_ROUTES.PANELS}/${panelForPdf.id}/download-pdf`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load PDF");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
          setPdfLoading(false);
        })
        .catch((err) => {
          setPdfError(err.message);
          setPdfLoading(false);
        });
    } else {
      setPdfUrl(null);
    }

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [open, panel?.id, panel?.productionPdfUrl, schedule?.panel?.id, schedule?.panel?.productionPdfUrl]);

  useEffect(() => {
    if (open) {
      setPanelEdits({});
      setHasPanelChanges(false);
    }
  }, [open]);

  const savePanelMutation = useMutation({
    mutationFn: async (data: { panelId: string; updates: Record<string, string | null> }) => {
      const res = await apiRequest("PUT", ADMIN_ROUTES.PANEL_BY_ID(data.panelId), data.updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Panel specifications saved" });
      setPanelEdits({});
      setHasPanelChanges(false);
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      queryClient.invalidateQueries({ queryKey: ['/api/reo-schedules'] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save panel", description: err.message, variant: "destructive" });
    },
  });

  const hasSchedule = !!panel?.reoSchedule || !!schedule;
  const currentSchedule = schedule || (panel?.reoSchedule ? { ...panel.reoSchedule, items: [] } as ReoScheduleWithDetails : null);
  const effectivePanel = panel || (schedule?.panel ? { ...schedule.panel, job: schedule.job } as IfcPanelWithSchedule : null);
  const effectivePanelRef = effectivePanel as Record<string, unknown> | null;

  const getPanelValue = useCallback((field: string): string => {
    if (field in panelEdits) return panelEdits[field] || "";
    return String(effectivePanelRef?.[field] ?? "");
  }, [panelEdits, effectivePanelRef]);

  const setPanelField = useCallback((field: string, value: string) => {
    setPanelEdits(prev => ({ ...prev, [field]: value || null }));
    setHasPanelChanges(true);
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);
  const hasPdf = !!(effectivePanel?.productionPdfUrl);

  useCtrlScrollZoom({
    containerRef: pdfContainerRef,
    zoom: pdfZoom,
    setZoom: (fn) => setPdfZoom((prev) => fn(prev)),
    minZoom: 50,
    maxZoom: 200,
    step: 25,
    enabled: hasPdf && !pdfLoading,
  });

  const approvedItems = currentSchedule?.items?.filter(i => i.status === "APPROVED") || [];
  const pendingItems = currentSchedule?.items?.filter(i => i.status === "PENDING") || [];

  const handleCreatePo = () => {
    if (!currentSchedule || !selectedSupplierId) return;
    const itemIds = approvedItems.map(i => i.id);
    onCreatePo(currentSchedule.id, selectedSupplierId, itemIds, poNotes || undefined);
    setShowPoDialog(false);
    setSelectedSupplierId("");
    setPoNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col" data-testid="reo-schedule-builder-dialog">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-3">
                <Package className="w-5 h-5" />
                Reo Schedule Builder - {effectivePanel?.panelMark}
                {currentSchedule && getScheduleStatusBadge(currentSchedule.status)}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {effectivePanel?.job?.jobNumber} - {effectivePanel?.job?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 border-r flex flex-col bg-muted/30">
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">IFC Drawing</span>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setPdfZoom(Math.max(50, pdfZoom - 25))}
                  disabled={!hasPdf}
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{pdfZoom}%</span>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setPdfZoom(Math.min(200, pdfZoom + 25))}
                  disabled={!hasPdf}
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div ref={pdfContainerRef} className="flex-1 overflow-auto p-4">
              {!hasPdf ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="space-y-3">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground">No IFC drawing attached</p>
                    <p className="text-sm text-muted-foreground/70">
                      Upload a PDF drawing in the Panel Admin to enable AI extraction
                    </p>
                  </div>
                </div>
              ) : pdfLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : pdfError ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="space-y-2">
                    <XCircle className="w-12 h-12 mx-auto text-destructive/50" />
                    <p className="text-destructive">{pdfError}</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0 bg-background rounded-md"
                  style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left', width: `${10000 / pdfZoom}%`, height: `${10000 / pdfZoom}%` }}
                  title="IFC Drawing PDF"
                  data-testid="pdf-viewer-iframe"
                />
              ) : null}
            </div>
          </div>

          <div className="w-1/2 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 shrink-0">
                <TabsTrigger value="details" data-testid="tab-details">Panel Details</TabsTrigger>
                <TabsTrigger value="items" data-testid="tab-items">
                  Reo Items {currentSchedule?.items?.length ? `(${currentSchedule.items.length})` : ""}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-auto px-4 pb-4 mt-0">
                <div className="space-y-3 py-4">
                  {hasPanelChanges && effectivePanel && (
                    <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2">
                      <span className="text-sm text-blue-700 dark:text-blue-300">You have unsaved panel changes</span>
                      <Button
                        size="sm"
                        onClick={() => savePanelMutation.mutate({ panelId: effectivePanel.id, updates: panelEdits })}
                        disabled={savePanelMutation.isPending}
                        data-testid="button-save-panel-specs"
                      >
                        {savePanelMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                        Save Panel
                      </Button>
                    </div>
                  )}

                  <Collapsible open={expandedSections.has("basic")} onOpenChange={() => toggleSection("basic")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-basic-info">
                      {expandedSections.has("basic") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Ruler className="w-4 h-4" />
                      Basic Information
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Panel Mark</Label>
                          <Input value={getPanelValue("panelMark")} onChange={e => setPanelField("panelMark", e.target.value)} data-testid="input-panel-mark" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Panel Type</Label>
                          <Input value={getPanelValue("panelType")} onChange={e => setPanelField("panelType", e.target.value)} data-testid="input-panel-type" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Level</Label>
                          <Input value={getPanelValue("level")} onChange={e => setPanelField("level", e.target.value)} data-testid="input-panel-level" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Building</Label>
                          <Input value={getPanelValue("building")} onChange={e => setPanelField("building", e.target.value)} data-testid="input-panel-building" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Zone</Label>
                          <Input value={getPanelValue("zone")} onChange={e => setPanelField("zone", e.target.value)} data-testid="input-panel-zone" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Drawing Code</Label>
                          <Input value={getPanelValue("drawingCode")} onChange={e => setPanelField("drawingCode", e.target.value)} data-testid="input-drawing-code" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sheet Number</Label>
                          <Input value={getPanelValue("sheetNumber")} onChange={e => setPanelField("sheetNumber", e.target.value)} data-testid="input-sheet-number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Structural Elevation</Label>
                          <Input value={getPanelValue("structuralElevation")} onChange={e => setPanelField("structuralElevation", e.target.value)} data-testid="input-structural-elevation" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Qty</Label>
                          <Input value={getPanelValue("qty")} onChange={e => setPanelField("qty", e.target.value)} data-testid="input-panel-qty" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Concrete Strength (MPa)</Label>
                          <Input value={getPanelValue("concreteStrengthMpa")} onChange={e => setPanelField("concreteStrengthMpa", e.target.value)} data-testid="input-concrete-strength" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <Textarea value={getPanelValue("description")} onChange={e => setPanelField("description", e.target.value)} rows={2} data-testid="input-panel-description" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <Collapsible open={expandedSections.has("dimensions")} onOpenChange={() => toggleSection("dimensions")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-dimensions">
                      {expandedSections.has("dimensions") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Ruler className="w-4 h-4" />
                      Dimensions & Weight
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Width (mm)</Label>
                          <Input value={getPanelValue("loadWidth")} onChange={e => setPanelField("loadWidth", e.target.value)} data-testid="input-load-width" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Height (mm)</Label>
                          <Input value={getPanelValue("loadHeight")} onChange={e => setPanelField("loadHeight", e.target.value)} data-testid="input-load-height" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Thickness (mm)</Label>
                          <Input value={getPanelValue("panelThickness")} onChange={e => setPanelField("panelThickness", e.target.value)} data-testid="input-panel-thickness" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Volume</Label>
                          <Input value={getPanelValue("panelVolume")} onChange={e => setPanelField("panelVolume", e.target.value)} data-testid="input-panel-volume" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Mass</Label>
                          <Input value={getPanelValue("panelMass")} onChange={e => setPanelField("panelMass", e.target.value)} data-testid="input-panel-mass" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Net Weight</Label>
                          <Input value={getPanelValue("netWeight")} onChange={e => setPanelField("netWeight", e.target.value)} data-testid="input-net-weight" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Gross Area</Label>
                          <Input value={getPanelValue("grossArea")} onChange={e => setPanelField("grossArea", e.target.value)} data-testid="input-gross-area" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Panel Area</Label>
                          <Input value={getPanelValue("panelArea")} onChange={e => setPanelField("panelArea", e.target.value)} data-testid="input-panel-area" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Crane Capacity Weight</Label>
                          <Input value={getPanelValue("craneCapacityWeight")} onChange={e => setPanelField("craneCapacityWeight", e.target.value)} data-testid="input-crane-weight" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Crane Check</Label>
                          <Input value={getPanelValue("craneCheck")} onChange={e => setPanelField("craneCheck", e.target.value)} data-testid="input-crane-check" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <Collapsible open={expandedSections.has("reo")} onOpenChange={() => toggleSection("reo")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-reinforcement">
                      {expandedSections.has("reo") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Layers className="w-4 h-4" />
                      Reinforcement
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        {[
                          { label: "Vertical Reo", qtyField: "verticalReoQty", typeField: "verticalReoType" },
                          { label: "Horizontal Reo", qtyField: "horizontalReoQty", typeField: "horizontalReoType" },
                          { label: "Mesh", qtyField: "meshQty", typeField: "meshType" },
                          { label: "Fitments Reo", qtyField: "fitmentsReoQty", typeField: "fitmentsReoType" },
                          { label: "U Bars", qtyField: "uBarsQty", typeField: "uBarsType" },
                          { label: "Ligs", qtyField: "ligsQty", typeField: "ligsType" },
                          { label: "Blockout Bars", qtyField: "blockoutBarsQty", typeField: "blockoutBarsType" },
                          { label: "Top Fixing", qtyField: "topFixingQty", typeField: "topFixingType" },
                          { label: "Trimmer Bars", qtyField: "trimmerBarsQty", typeField: "trimmerBarsType" },
                          { label: "Ligs Reo", qtyField: "ligsReoQty", typeField: "ligsReoType" },
                        ].map(({ label, qtyField, typeField }) => (
                          <div key={qtyField} className="col-span-2 grid grid-cols-3 gap-2 items-end">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{label} Qty</Label>
                              <Input value={getPanelValue(qtyField)} onChange={e => setPanelField(qtyField, e.target.value)} data-testid={`input-${qtyField}`} />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs text-muted-foreground">{label} Type</Label>
                              <Input value={getPanelValue(typeField)} onChange={e => setPanelField(typeField, e.target.value)} data-testid={`input-${typeField}`} />
                            </div>
                          </div>
                        ))}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tie Reinforcement</Label>
                          <Input value={getPanelValue("tieReinforcement")} onChange={e => setPanelField("tieReinforcement", e.target.value)} data-testid="input-tie-reinforcement" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Reckli Detail</Label>
                          <Input value={getPanelValue("reckliDetail")} onChange={e => setPanelField("reckliDetail", e.target.value)} data-testid="input-reckli-detail" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <Collapsible open={expandedSections.has("additional")} onOpenChange={() => toggleSection("additional")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-additional-reo">
                      {expandedSections.has("additional") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Plus className="w-4 h-4" />
                      Additional Reo & Dowels
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        {[
                          { label: "Additional Reo 1", qtyField: "additionalReoQty1", typeField: "additionalReoType1" },
                          { label: "Additional Reo 2", qtyField: "additionalReoQty2", typeField: "additionalReoType2" },
                          { label: "Additional Reo 3", qtyField: "additionalReoQty3", typeField: "additionalReoType3" },
                          { label: "Additional Reo 4", qtyField: "additionalReoQty4", typeField: "additionalReoType4" },
                          { label: "Typical Dowel Bars", qtyField: "dowelBarsQty", typeField: "dowelBarsType" },
                          { label: "End Dowel Bars", qtyField: "dowelBarsQty2", typeField: "dowelBarsType2" },
                        ].map(({ label, qtyField, typeField }) => (
                          <div key={qtyField} className="col-span-2 grid grid-cols-3 gap-2 items-end">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{label} Qty</Label>
                              <Input value={getPanelValue(qtyField)} onChange={e => setPanelField(qtyField, e.target.value)} data-testid={`input-${qtyField}`} />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs text-muted-foreground">{label} Type</Label>
                              <Input value={getPanelValue(typeField)} onChange={e => setPanelField(typeField, e.target.value)} data-testid={`input-${typeField}`} />
                            </div>
                          </div>
                        ))}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Dowel Bars Length (Typical)</Label>
                          <Input value={getPanelValue("dowelBarsLength")} onChange={e => setPanelField("dowelBarsLength", e.target.value)} data-testid="input-dowel-length" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Dowel Bars Length (End)</Label>
                          <Input value={getPanelValue("dowelBarsLength2")} onChange={e => setPanelField("dowelBarsLength2", e.target.value)} data-testid="input-dowel-length-2" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <Collapsible open={expandedSections.has("fitments")} onOpenChange={() => toggleSection("fitments")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-fitments-plates">
                      {expandedSections.has("fitments") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Package className="w-4 h-4" />
                      Fitments, Plates & Lifters
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        {[
                          { label: "Ferrules", qtyField: "ferrulesQty", typeField: "ferrulesType" },
                          { label: "Fitments 2", qtyField: "fitmentsQty2", typeField: "fitmentsType2" },
                          { label: "Fitments 3", qtyField: "fitmentsQty3", typeField: "fitmentsType3" },
                          { label: "Fitments 4", qtyField: "fitmentsQty4", typeField: "fitmentsType4" },
                          { label: "Plates 1", qtyField: "platesQty", typeField: "platesType" },
                          { label: "Plates 2", qtyField: "platesQty2", typeField: "platesType2" },
                          { label: "Plates 3", qtyField: "platesQty3", typeField: "platesType3" },
                          { label: "Plates 4", qtyField: "platesQty4", typeField: "platesType4" },
                        ].map(({ label, qtyField, typeField }) => (
                          <div key={qtyField} className="col-span-2 grid grid-cols-3 gap-2 items-end">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{label} Qty</Label>
                              <Input value={getPanelValue(qtyField)} onChange={e => setPanelField(qtyField, e.target.value)} data-testid={`input-${qtyField}`} />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs text-muted-foreground">{label} Type</Label>
                              <Input value={getPanelValue(typeField)} onChange={e => setPanelField(typeField, e.target.value)} data-testid={`input-${typeField}`} />
                            </div>
                          </div>
                        ))}
                        <Separator className="col-span-2 my-1" />
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lifter Qty A</Label>
                          <Input value={getPanelValue("lifterQtyA")} onChange={e => setPanelField("lifterQtyA", e.target.value)} data-testid="input-lifter-qty-a" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lifters Type</Label>
                          <Input value={getPanelValue("liftersType")} onChange={e => setPanelField("liftersType", e.target.value)} data-testid="input-lifters-type" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lifter Qty B</Label>
                          <Input value={getPanelValue("lifterQtyB")} onChange={e => setPanelField("lifterQtyB", e.target.value)} data-testid="input-lifter-qty-b" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Safety Lifters Type</Label>
                          <Input value={getPanelValue("safetyLiftersType")} onChange={e => setPanelField("safetyLiftersType", e.target.value)} data-testid="input-safety-lifters" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lifter Qty C</Label>
                          <Input value={getPanelValue("lifterQtyC")} onChange={e => setPanelField("lifterQtyC", e.target.value)} data-testid="input-lifter-qty-c" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Face Lifters Type</Label>
                          <Input value={getPanelValue("faceLiftersType")} onChange={e => setPanelField("faceLiftersType", e.target.value)} data-testid="input-face-lifters" />
                        </div>
                        <Separator className="col-span-2 my-1" />
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout Tubes Bottom Qty</Label>
                          <Input value={getPanelValue("groutTubesBottomQty")} onChange={e => setPanelField("groutTubesBottomQty", e.target.value)} data-testid="input-grout-bottom-qty" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout Tubes Bottom Type</Label>
                          <Input value={getPanelValue("groutTubesBottomType")} onChange={e => setPanelField("groutTubesBottomType", e.target.value)} data-testid="input-grout-bottom-type" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout Tubes Top Qty</Label>
                          <Input value={getPanelValue("groutTubesTopQty")} onChange={e => setPanelField("groutTubesTopQty", e.target.value)} data-testid="input-grout-top-qty" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout Tubes Top Type</Label>
                          <Input value={getPanelValue("groutTubesTopType")} onChange={e => setPanelField("groutTubesTopType", e.target.value)} data-testid="input-grout-top-type" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Other Inserts Qty D</Label>
                          <Input value={getPanelValue("insertsQtyD")} onChange={e => setPanelField("insertsQtyD", e.target.value)} data-testid="input-inserts-qty-d" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Insert Type D</Label>
                          <Input value={getPanelValue("insertTypeD")} onChange={e => setPanelField("insertTypeD", e.target.value)} data-testid="input-insert-type-d" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <Collapsible open={expandedSections.has("concrete")} onOpenChange={() => toggleSection("concrete")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-concrete-grout">
                      {expandedSections.has("concrete") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Package className="w-4 h-4" />
                      Concrete & Grout
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fire Rate</Label>
                          <Input value={getPanelValue("fireRate")} onChange={e => setPanelField("fireRate", e.target.value)} data-testid="input-fire-rate" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Caulking Fire</Label>
                          <Input value={getPanelValue("caulkingFire")} onChange={e => setPanelField("caulkingFire", e.target.value)} data-testid="input-caulking-fire" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Num Rebates</Label>
                          <Input value={getPanelValue("numRebates")} onChange={e => setPanelField("numRebates", e.target.value)} data-testid="input-num-rebates" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Openings</Label>
                          <Input value={getPanelValue("openings")} onChange={e => setPanelField("openings", e.target.value)} data-testid="input-openings" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout Table Manual</Label>
                          <Input value={getPanelValue("groutTableManual")} onChange={e => setPanelField("groutTableManual", e.target.value)} data-testid="input-grout-table" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout to Use</Label>
                          <Input value={getPanelValue("groutToUse")} onChange={e => setPanelField("groutToUse", e.target.value)} data-testid="input-grout-to-use" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Grout Strength</Label>
                          <Input value={getPanelValue("groutStrength")} onChange={e => setPanelField("groutStrength", e.target.value)} data-testid="input-grout-strength" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Day 28 Fc</Label>
                          <Input value={getPanelValue("day28Fc")} onChange={e => setPanelField("day28Fc", e.target.value)} data-testid="input-day28-fc" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lift Fcm</Label>
                          <Input value={getPanelValue("liftFcm")} onChange={e => setPanelField("liftFcm", e.target.value)} data-testid="input-lift-fcm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Rotational Lifters</Label>
                          <Input value={getPanelValue("rotationalLifters")} onChange={e => setPanelField("rotationalLifters", e.target.value)} data-testid="input-rotational-lifters" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Primary Lifters</Label>
                          <Input value={getPanelValue("primaryLifters")} onChange={e => setPanelField("primaryLifters", e.target.value)} data-testid="input-primary-lifters" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <Collapsible open={expandedSections.has("totals")} onOpenChange={() => toggleSection("totals")}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium" data-testid="section-reo-totals">
                      {expandedSections.has("totals") ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Ruler className="w-4 h-4" />
                      Reo Totals
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-3 pb-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Reo Tons</Label>
                          <Input value={getPanelValue("reoTons")} onChange={e => setPanelField("reoTons", e.target.value)} data-testid="input-reo-tons" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Dowels Tons</Label>
                          <Input value={getPanelValue("dowelsTons")} onChange={e => setPanelField("dowelsTons", e.target.value)} data-testid="input-dowels-tons" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Total Reo</Label>
                          <Input value={getPanelValue("totalReo")} onChange={e => setPanelField("totalReo", e.target.value)} data-testid="input-total-reo" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Total kg/m3</Label>
                          <Input value={getPanelValue("totalKgM3")} onChange={e => setPanelField("totalKgM3", e.target.value)} data-testid="input-total-kg-m3" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="schedule-notes">Schedule Notes (optional)</Label>
                    <Textarea
                      id="schedule-notes"
                      placeholder="Any notes for this reo schedule..."
                      value={notes}
                      onChange={(e) => onNotesChange(e.target.value)}
                      rows={3}
                      data-testid="textarea-schedule-notes"
                    />
                  </div>

                  {!hasSchedule && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Cpu className="w-5 h-5 text-primary mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium">Create Reo Schedule</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Create a schedule to extract reinforcement items from the IFC drawing using AI.
                            </p>
                            <Button 
                              className="mt-3"
                              onClick={onSubmit}
                              disabled={isSubmitting}
                              data-testid="button-create-schedule"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Create Schedule
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {hasSchedule && currentSchedule?.status === "PENDING" && (
                    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Cpu className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-blue-900 dark:text-blue-100">Ready for AI Processing</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                              Process the IFC drawing with AI to automatically extract reo items.
                            </p>
                            <Button 
                              className="mt-3"
                              onClick={() => currentSchedule && onProcessWithAI(currentSchedule.id)}
                              disabled={isProcessing || !hasPdf}
                              data-testid="button-process-ai"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Cpu className="w-4 h-4 mr-2" />
                                  Process with AI
                                </>
                              )}
                            </Button>
                            {!hasPdf && (
                              <p className="text-xs text-amber-600 mt-2">
                                No PDF attached - upload an IFC drawing first
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {hasSchedule && currentSchedule?.status === "PROCESSING" && (
                    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-4 text-center">
                        <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-blue-600" />
                        <p className="font-medium text-blue-900 dark:text-blue-100">Processing with AI...</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">This may take a moment</p>
                      </CardContent>
                    </Card>
                  )}

                  {hasSchedule && currentSchedule?.status === "COMPLETED" && currentSchedule.items && (
                    <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-green-900 dark:text-green-100">AI Extraction Complete</h4>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              {currentSchedule.items.length} reo items extracted. Review them in the "Reo Items" tab.
                            </p>
                            <div className="flex gap-2 mt-3">
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                                {approvedItems.length} Approved
                              </Badge>
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="w-3 h-3" />
                                {pendingItems.length} Pending
                              </Badge>
                            </div>
                            {approvedItems.length > 0 && (
                              <Button 
                                className="mt-3"
                                variant="default"
                                onClick={() => setShowPoDialog(true)}
                                data-testid="button-create-po"
                              >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Create Purchase Order
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {hasSchedule && currentSchedule?.status === "FAILED" && (
                    <Card className="bg-destructive/10 border-destructive/30">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-destructive">Processing Failed</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {currentSchedule.notes || "An error occurred during AI processing"}
                            </p>
                            <Button 
                              className="mt-3"
                              variant="outline"
                              onClick={() => currentSchedule && onProcessWithAI(currentSchedule.id)}
                              disabled={isProcessing}
                              data-testid="button-retry-process"
                            >
                              Retry Processing
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="items" className="flex-1 overflow-auto px-4 pb-4 mt-0">
                <div className="space-y-4 py-4">
                  {currentSchedule?.items && currentSchedule.items.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {currentSchedule.items.length} items extracted
                        </p>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              if (pendingItems.length > 0 && currentSchedule) {
                                onBulkUpdateStatus(currentSchedule.id, pendingItems.map(i => i.id), "APPROVED");
                              }
                            }}
                            disabled={isBulkUpdating || pendingItems.length === 0}
                            data-testid="button-approve-all-items"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve All Pending
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Bar Size</TableHead>
                              <TableHead>Shape</TableHead>
                              <TableHead className="text-right">Length</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Weight</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentSchedule.items.map((item) => (
                              <TableRow key={item.id} data-testid={`reo-item-row-${item.id}`}>
                                <TableCell className="font-medium">{item.reoType}</TableCell>
                                <TableCell>{item.barSize || "-"}</TableCell>
                                <TableCell>{item.barShape || "-"}</TableCell>
                                <TableCell className="text-right">{item.length ? `${item.length}mm` : "-"}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{item.weight ? `${item.weight}kg` : "-"}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={item.status === "APPROVED" ? "default" : item.status === "REJECTED" ? "destructive" : "secondary"}
                                    className={item.status === "APPROVED" ? "bg-green-600" : ""}
                                  >
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {item.status === "PENDING" && (
                                      <>
                                        <Button 
                                          size="icon" 
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => currentSchedule && onUpdateItemStatus(currentSchedule.id, item.id, "APPROVED")}
                                          data-testid={`button-approve-item-${item.id}`}
                                        >
                                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => currentSchedule && onUpdateItemStatus(currentSchedule.id, item.id, "REJECTED")}
                                          data-testid={`button-reject-item-${item.id}`}
                                        >
                                          <XCircle className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No reo items extracted yet</p>
                      <p className="text-sm mt-2">Process the schedule with AI to extract items</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hasPanelChanges && effectivePanel && (
              <Button
                onClick={() => savePanelMutation.mutate({ panelId: effectivePanel.id, updates: panelEdits })}
                disabled={savePanelMutation.isPending}
                data-testid="button-save-panel-footer"
              >
                {savePanelMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save Panel Changes
              </Button>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-close-builder"
          >
            Close
          </Button>
        </DialogFooter>

        <Dialog open={showPoDialog} onOpenChange={setShowPoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>
                Create a PO for {approvedItems.length} approved reo items
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger data-testid="select-po-supplier">
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[...suppliers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="PO notes..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  data-testid="textarea-po-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPoDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleCreatePo}
                disabled={!selectedSupplierId || isCreatingPo}
                data-testid="button-submit-po"
              >
                {isCreatingPo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create PO"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export default function ProcurementReoSchedulingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";

  const [jobFilter, setJobFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set());
  
  const [showScheduleBuilderDialog, setShowScheduleBuilderDialog] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<IfcPanelWithSchedule | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  
  const [showScheduleViewDialog, setShowScheduleViewDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ReoScheduleWithDetails | null>(null);
  
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [poNotes, setPoNotes] = useState("");

  const { data: ifcPanels = [], isLoading } = useQuery<IfcPanelWithSchedule[]>({
    queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS, { jobId: jobFilter !== "all" ? jobFilter : undefined }],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name })),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: { panelId: string; notes?: string }) => {
      const response = await apiRequest("POST", REO_SCHEDULE_ROUTES.LIST, data);
      return response as unknown as ReoSchedule;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      setScheduleNotes("");
      toast({ title: "Success", description: "Reo schedule created successfully" });
      const schedule = await apiRequest("GET", REO_SCHEDULE_ROUTES.BY_ID(data.id)) as unknown as ReoScheduleWithDetails;
      setSelectedSchedule(schedule);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create reo schedule", variant: "destructive" });
    },
  });

  const processScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      return apiRequest("POST", REO_SCHEDULE_ROUTES.PROCESS(scheduleId), {});
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      toast({ title: "Success", description: `AI processing completed - ${data.itemsCreated || 0} items extracted` });
      if (data.scheduleId) {
        await openScheduleView(data.scheduleId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to process with AI", variant: "destructive" });
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, itemId, status }: { scheduleId: string; itemId: string; status: string }) => {
      return apiRequest("PATCH", REO_SCHEDULE_ROUTES.ITEM_BY_ID(scheduleId, itemId), { status });
    },
    onSuccess: () => {
      if (selectedSchedule) {
        openScheduleView(selectedSchedule.id);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item status", variant: "destructive" });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, itemIds, status }: { scheduleId: string; itemIds: string[]; status: string }) => {
      return apiRequest("PATCH", REO_SCHEDULE_ROUTES.ITEMS_BULK_STATUS(scheduleId), { itemIds, status });
    },
    onSuccess: () => {
      if (selectedSchedule) {
        openScheduleView(selectedSchedule.id);
      }
      toast({ title: "Success", description: "Item statuses updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item statuses", variant: "destructive" });
    },
  });

  const createPoMutation = useMutation({
    mutationFn: async ({ scheduleId, supplierId, itemIds, notes }: { scheduleId: string; supplierId: string; itemIds: string[]; notes?: string }) => {
      return apiRequest("POST", REO_SCHEDULE_ROUTES.CREATE_PO(scheduleId), { supplierId, itemIds, notes });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      setShowPoDialog(false);
      setSelectedSupplierId("");
      setPoNotes("");
      if (selectedSchedule) {
        openScheduleView(selectedSchedule.id);
      }
      toast({ 
        title: "Purchase Order Created", 
        description: `PO ${data.purchaseOrder?.poNumber || ""} has been created` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create purchase order", variant: "destructive" });
    },
  });

  const openScheduleView = async (scheduleId: string, panel?: IfcPanelWithSchedule) => {
    try {
      const schedule = await apiRequest("GET", REO_SCHEDULE_ROUTES.BY_ID(scheduleId)) as unknown as ReoScheduleWithDetails;
      setSelectedSchedule(schedule);
      if (panel) {
        setSelectedPanel(panel);
      } else if (schedule.panel) {
        setSelectedPanel({ ...schedule.panel, job: schedule.job } as IfcPanelWithSchedule);
      }
      setShowScheduleBuilderDialog(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load schedule", variant: "destructive" });
    }
  };

  const handleViewSchedule = (panel: IfcPanelWithSchedule) => {
    if (panel.reoSchedule) {
      openScheduleView(panel.reoSchedule.id, panel);
    }
  };

  const filteredPanels = ifcPanels.filter(panel => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!panel.panelMark?.toLowerCase().includes(query) && 
          !panel.job?.name?.toLowerCase().includes(query) &&
          !panel.job?.jobNumber?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const groupedPanels = filteredPanels.reduce<Record<string, IfcPanelWithSchedule[]>>((acc, panel) => {
    const jobKey = panel.job?.id || "unknown";
    if (!acc[jobKey]) acc[jobKey] = [];
    acc[jobKey].push(panel);
    return acc;
  }, {});

  const toggleGroupExpansion = (key: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedGroups(newCollapsed);
  };

  const togglePanelSelection = (panelId: string) => {
    const newSelected = new Set(selectedPanels);
    if (newSelected.has(panelId)) {
      newSelected.delete(panelId);
    } else {
      newSelected.add(panelId);
    }
    setSelectedPanels(newSelected);
  };

  const handleCreateSchedule = (panel: IfcPanelWithSchedule) => {
    setSelectedPanel(panel);
    setScheduleNotes("");
    setShowScheduleBuilderDialog(true);
  };

  const handleSubmitSchedule = () => {
    if (!selectedPanel) return;
    createScheduleMutation.mutate({
      panelId: selectedPanel.id,
      notes: scheduleNotes || undefined,
    });
  };

  const getScheduleStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case "PROCESSING":
        return <Badge variant="outline" className="gap-1 text-blue-600"><Loader2 className="w-3 h-3 animate-spin" /> Processing</Badge>;
      case "COMPLETED":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="procurement-reo-loading" role="main" aria-label="Procurement REO Scheduling">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="procurement-reo-scheduling-page" role="main" aria-label="Procurement REO Scheduling">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Procurement Manager - Reo Scheduling
            <PageHelpButton pageHelpKey="page.procurement-reo-scheduling" />
          </CardTitle>
          <CardDescription>
            View IFC-approved panels, extract reinforcement schedules using AI, and create purchase orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search panels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-panels"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Job:</Label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-job-filter">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {[...allJobs].sort((a: any, b: any) => (a.jobNumber || a.name || '').localeCompare(b.jobNumber || b.name || '')).map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredPanels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-panels-message">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No IFC-approved panels found</p>
              <p className="text-sm mt-2">Panels must have production approval (IFC status) to appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedPanels).map(([jobId, panels]) => {
                const job = panels[0]?.job;
                const isExpanded = !collapsedGroups.has(jobId);
                const panelsWithSchedule = panels.filter(p => p.reoSchedule);
                const completedSchedules = panels.filter(p => p.reoSchedule?.status === "COMPLETED");

                return (
                  <Collapsible key={jobId} open={isExpanded} onOpenChange={() => toggleGroupExpansion(jobId)}>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                        data-testid={`job-group-${jobId}`}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Briefcase className="w-4 h-4" />
                          <span className="font-medium">{job?.jobNumber || "Unknown"}</span>
                          <span className="text-muted-foreground">- {job?.name || "Unknown Job"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{panels.length} panels</Badge>
                          <Badge variant="secondary">{panelsWithSchedule.length} scheduled</Badge>
                          <Badge variant="default" className="bg-green-600">{completedSchedules.length} completed</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border rounded-lg mt-2 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">Select</TableHead>
                              <TableHead>Panel Mark</TableHead>
                              <TableHead>Level</TableHead>
                              <TableHead>Dimensions</TableHead>
                              <TableHead>IFC Approved</TableHead>
                              <TableHead>Reo Schedule</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {panels.map(panel => (
                              <TableRow key={panel.id} data-testid={`panel-row-${panel.id}`}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedPanels.has(panel.id)}
                                    onCheckedChange={() => togglePanelSelection(panel.id)}
                                    data-testid={`checkbox-panel-${panel.id}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{panel.panelMark || "-"}</TableCell>
                                <TableCell>{panel.level || "-"}</TableCell>
                                <TableCell>
                                  {panel.loadWidth && panel.loadHeight 
                                    ? `${panel.loadWidth} × ${panel.loadHeight}`
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {panel.approvedAt 
                                    ? format(parseISO(String(panel.approvedAt)), "dd/MM/yyyy")
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {getScheduleStatusBadge(panel.reoSchedule?.status)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {panel.reoSchedule ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleViewSchedule(panel)}
                                        data-testid={`button-view-schedule-${panel.id}`}
                                      >
                                        <FileText className="w-4 h-4 mr-1" />
                                        View
                                      </Button>
                                      {panel.reoSchedule.status === "PENDING" && (
                                        <Button 
                                          size="sm" 
                                          variant="default"
                                          onClick={() => processScheduleMutation.mutate(panel.reoSchedule!.id)}
                                          disabled={processScheduleMutation.isPending}
                                          data-testid={`button-process-${panel.id}`}
                                        >
                                          <Cpu className="w-4 h-4 mr-1" />
                                          Process
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="default"
                                      onClick={() => handleCreateSchedule(panel)}
                                      data-testid={`button-create-schedule-${panel.id}`}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Create Schedule
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ReoScheduleBuilderDialog
        open={showScheduleBuilderDialog}
        onOpenChange={setShowScheduleBuilderDialog}
        panel={selectedPanel}
        notes={scheduleNotes}
        onNotesChange={setScheduleNotes}
        onSubmit={handleSubmitSchedule}
        isSubmitting={createScheduleMutation.isPending}
        schedule={selectedSchedule}
        onProcessWithAI={(id) => {
          processScheduleMutation.mutate(id);
        }}
        isProcessing={processScheduleMutation.isPending}
        onUpdateItemStatus={(scheduleId, itemId, status) => {
          updateItemStatusMutation.mutate({ scheduleId, itemId, status });
        }}
        onBulkUpdateStatus={(scheduleId, itemIds, status) => {
          bulkUpdateStatusMutation.mutate({ scheduleId, itemIds, status });
        }}
        isBulkUpdating={bulkUpdateStatusMutation.isPending}
        onRefreshSchedule={openScheduleView}
        getScheduleStatusBadge={getScheduleStatusBadge}
        suppliers={suppliers}
        onCreatePo={(scheduleId, supplierId, itemIds, notes) => {
          createPoMutation.mutate({ scheduleId, supplierId, itemIds, notes });
        }}
        isCreatingPo={createPoMutation.isPending}
      />

      <Dialog open={showScheduleViewDialog} onOpenChange={setShowScheduleViewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Reo Schedule - {selectedSchedule?.panel?.panelMark}
              {getScheduleStatusBadge(selectedSchedule?.status)}
            </DialogTitle>
            <DialogDescription>
              View and manage reinforcement schedule items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedSchedule?.status === "PENDING" && (
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <p className="text-muted-foreground mb-3">Schedule has not been processed yet</p>
                <Button 
                  onClick={() => {
                    processScheduleMutation.mutate(selectedSchedule.id);
                    setShowScheduleViewDialog(false);
                  }}
                  disabled={processScheduleMutation.isPending}
                  data-testid="button-process-schedule"
                >
                  <Cpu className="w-4 h-4 mr-2" />
                  Process with AI
                </Button>
              </div>
            )}
            {selectedSchedule?.status === "PROCESSING" && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                <p className="text-blue-600">Processing with AI... This may take a moment.</p>
              </div>
            )}
            {selectedSchedule?.status === "FAILED" && (
              <div className="bg-destructive/10 p-4 rounded-lg">
                <p className="text-destructive font-medium">Processing failed</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedSchedule.notes}</p>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => {
                    processScheduleMutation.mutate(selectedSchedule.id);
                    setShowScheduleViewDialog(false);
                  }}
                  data-testid="button-retry-process"
                >
                  Retry Processing
                </Button>
              </div>
            )}
            {selectedSchedule?.status === "COMPLETED" && selectedSchedule.items && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {selectedSchedule.items.length} items extracted
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        {selectedSchedule.items.filter(i => i.status === "APPROVED").length} approved
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {selectedSchedule.items.filter(i => i.status === "PENDING").length} pending
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const pendingItems = selectedSchedule.items?.filter(i => i.status === "PENDING") || [];
                        if (pendingItems.length > 0) {
                          bulkUpdateStatusMutation.mutate({
                            scheduleId: selectedSchedule.id,
                            itemIds: pendingItems.map(i => i.id),
                            status: "APPROVED"
                          });
                        }
                      }}
                      disabled={bulkUpdateStatusMutation.isPending || !selectedSchedule.items?.some(i => i.status === "PENDING")}
                      data-testid="button-approve-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve All Pending
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      disabled={!selectedSchedule.items?.some(i => i.status === "APPROVED")}
                      onClick={() => setShowPoDialog(true)}
                      data-testid="button-create-po"
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      Create PO
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Bar Size</TableHead>
                        <TableHead>Shape</TableHead>
                        <TableHead>Length (mm)</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Weight (kg)</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSchedule.items.map((item: ReoScheduleItem) => (
                        <TableRow key={item.id} data-testid={`item-row-${item.id}`}>
                          <TableCell>
                            {item.status === "APPROVED" ? (
                              <Badge variant="default" className="gap-1 bg-green-600">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </Badge>
                            ) : item.status === "REJECTED" ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </Badge>
                            ) : item.status === "ORDERED" ? (
                              <Badge variant="default" className="gap-1 bg-blue-600">
                                <ShoppingCart className="w-3 h-3" /> Ordered
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.reoType}</TableCell>
                          <TableCell>{item.barSize || "-"}</TableCell>
                          <TableCell>{item.barShape || "-"}</TableCell>
                          <TableCell>{item.length || "-"}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.weight || "-"}</TableCell>
                          <TableCell>{item.zone || "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.status === "PENDING" && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-green-600 hover:text-green-700"
                                  onClick={() => updateItemStatusMutation.mutate({
                                    scheduleId: selectedSchedule.id,
                                    itemId: item.id,
                                    status: "APPROVED"
                                  })}
                                  disabled={updateItemStatusMutation.isPending}
                                  data-testid={`button-approve-${item.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => updateItemStatusMutation.mutate({
                                    scheduleId: selectedSchedule.id,
                                    itemId: item.id,
                                    status: "REJECTED"
                                  })}
                                  disabled={updateItemStatusMutation.isPending}
                                  data-testid={`button-reject-${item.id}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Purchase Order Dialog */}
      <Dialog open={showPoDialog} onOpenChange={setShowPoDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Create a purchase order for approved reo items from {selectedSchedule?.panel?.panelMark || "selected panel"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select 
                value={selectedSupplierId} 
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger data-testid="select-supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {[...suppliers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-notes">Notes (optional)</Label>
              <Textarea
                id="po-notes"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="Add any notes for this purchase order..."
                rows={3}
                data-testid="input-po-notes"
              />
            </div>
            {selectedSchedule && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>{selectedSchedule.items?.filter(i => i.status === "APPROVED").length || 0}</strong> approved items will be added to this PO
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPoDialog(false);
                setSelectedSupplierId("");
                setPoNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedSchedule || !selectedSupplierId) return;
                const approvedItemIds = selectedSchedule.items
                  ?.filter(i => i.status === "APPROVED")
                  .map(i => i.id) || [];
                createPoMutation.mutate({
                  scheduleId: selectedSchedule.id,
                  supplierId: selectedSupplierId,
                  itemIds: approvedItemIds,
                  notes: poNotes || undefined
                });
              }}
              disabled={!selectedSupplierId || createPoMutation.isPending}
              data-testid="button-confirm-create-po"
            >
              {createPoMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Create Purchase Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
