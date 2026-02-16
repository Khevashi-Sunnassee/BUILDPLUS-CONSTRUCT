import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LOGISTICS_ROUTES, PANELS_ROUTES, ADMIN_ROUTES, FACTORIES_ROUTES } from "@shared/api-routes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  ChevronLeft,
  Camera,
  X,
  Package,
  Loader2,
  ScanLine,
  Trash2,
  AlertCircle,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import type { Job, TrailerType } from "@shared/schema";

interface Factory {
  id: string;
  name: string;
  address: string | null;
  state: string | null;
}

interface ScannedPanel {
  id: string;
  panelMark: string;
  panelType: string | null;
  panelMass: string | null;
  jobId: string;
  jobNumber?: string;
  jobName?: string;
}

export default function MobileCreateLoadListPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [scannedPanels, setScannedPanels] = useState<ScannedPanel[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedTrailerTypeId, setSelectedTrailerTypeId] = useState("");
  const [selectedFactory, setSelectedFactory] = useState("QLD");
  const [docketNumber, setDocketNumber] = useState("");
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";
  const preloadedRef = useRef(false);

  const queryPanelId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("panelId");
  }, [searchString]);

  useEffect(() => {
    if (queryPanelId && !preloadedRef.current) {
      preloadedRef.current = true;
      fetch(PANELS_ROUTES.DETAILS(queryPanelId), { credentials: "include" })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(panelData => {
          const newPanel: ScannedPanel = {
            id: panelData.id,
            panelMark: panelData.panelMark || "Unknown",
            panelType: panelData.panelType || null,
            panelMass: panelData.panelMass || null,
            jobId: panelData.jobId,
            jobNumber: panelData.job?.jobNumber,
            jobName: panelData.job?.name,
          };
          setScannedPanels(prev => {
            if (prev.some(p => p.id === panelData.id)) return prev;
            return [...prev, newPanel];
          });
          if (!selectedJobId && panelData.jobId) {
            setSelectedJobId(panelData.jobId);
          }
        })
        .catch(() => {});
    }
  }, [queryPanelId]);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const { data: trailerTypes = [] } = useQuery<TrailerType[]>({
    queryKey: [LOGISTICS_ROUTES.TRAILER_TYPES],
  });

  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: [FACTORIES_ROUTES.LIST],
  });

  const activeJobs = jobs.filter(j => j.status === "ACTIVE");

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError(null);
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      
      await new Promise(resolve => setTimeout(resolve, 300));

      const container = document.getElementById(scannerContainerId);
      if (!container) {
        setScannerError("Scanner container not found");
        setScanning(false);
        return;
      }

      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleQrScan(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      console.error("Scanner error:", err);
      setScannerError(err?.message || "Failed to start camera. Please check camera permissions.");
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) {
            scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) { console.error("Scanner processing error:", e); }
        scannerRef.current = null;
      }
    };
  }, []);

  const handleQrScan = async (decodedText: string) => {
    const panelIdMatch = decodedText.match(/\/panel\/([a-f0-9-]+)/i);
    if (!panelIdMatch) {
      toast({ title: "Invalid QR code", description: "This QR code is not a panel code", variant: "destructive" });
      return;
    }

    const panelId = panelIdMatch[1];

    if (scannedPanels.some(p => p.id === panelId)) {
      toast({ title: "Already scanned", description: "This panel is already in the list", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch(PANELS_ROUTES.DETAILS(panelId), { credentials: "include" });
      if (!res.ok) throw new Error("Panel not found");
      const panelData = await res.json();

      const newPanel: ScannedPanel = {
        id: panelData.id,
        panelMark: panelData.panelMark || "Unknown",
        panelType: panelData.panelType || null,
        panelMass: panelData.panelMass || null,
        jobId: panelData.jobId,
        jobNumber: panelData.job?.jobNumber,
        jobName: panelData.job?.name,
      };

      setScannedPanels(prev => [...prev, newPanel]);

      if (!selectedJobId && panelData.jobId) {
        setSelectedJobId(panelData.jobId);
      }

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (err) {
      toast({ title: "Panel not found", description: "Could not find panel details", variant: "destructive" });
    }
  };

  const removePanel = (panelId: string) => {
    setScannedPanels(prev => prev.filter(p => p.id !== panelId));
  };

  const totalMass = scannedPanels.reduce((sum, p) => sum + (parseFloat(p.panelMass || "0") || 0), 0);

  const createLoadListMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LISTS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      setLocation("/mobile/logistics");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create load list", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedJobId) {
      toast({ title: "Select a job", description: "Please scan panels or select a job", variant: "destructive" });
      return;
    }

    if (scannedPanels.length === 0) {
      toast({ title: "No panels", description: "Please scan at least one panel", variant: "destructive" });
      return;
    }

    const data: any = {
      jobId: selectedJobId,
      factory: selectedFactory,
      panelIds: scannedPanels.map(p => p.id),
      scheduledDate: scheduledDate || undefined,
      docketNumber: docketNumber || undefined,
      notes: notes || undefined,
    };

    if (selectedTrailerTypeId) {
      data.trailerTypeId = selectedTrailerTypeId;
    }

    createLoadListMutation.mutate(data);
  };

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Create Load List">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/logistics">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-xl font-bold" data-testid="text-create-load-title">Create Load List</div>
            <div className="text-sm text-white/60">
              {scannedPanels.length} panels scanned
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={createLoadListMutation.isPending || scannedPanels.length === 0 || !selectedJobId}
            className="bg-blue-500 text-white"
            data-testid="button-save-load-list"
          >
            {createLoadListMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-blue-400" />
                QR Scanner
              </h3>
              {scanning ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stopScanner}
                  className="text-red-400"
                  data-testid="button-stop-scanner"
                >
                  <X className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startScanner}
                  className="text-blue-400"
                  data-testid="button-start-scanner"
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Scan
                </Button>
              )}
            </div>

            <div
              id={scannerContainerId}
              className={`w-full rounded-xl overflow-hidden ${scanning ? "min-h-[260px]" : "hidden"}`}
              style={{ background: "#111" }}
            />

            {scannerError && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-400">{scannerError}</p>
              </div>
            )}

            {!scanning && !scannerError && scannedPanels.length === 0 && (
              <div className="text-center py-6">
                <Camera className="h-10 w-10 mx-auto text-white/20 mb-2" />
                <p className="text-sm text-white/40">Tap "Scan" to start scanning panel QR codes</p>
              </div>
            )}
          </div>
        </div>

        {scannedPanels.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-400" />
                Scanned Panels ({scannedPanels.length})
              </h3>
              <span className="text-xs text-white/40">
                {totalMass > 0 ? `${totalMass.toLocaleString()} kg total` : ""}
              </span>
            </div>
            <div className="space-y-2">
              {scannedPanels.map((panel, idx) => (
                <div
                  key={panel.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                  data-testid={`scanned-panel-${panel.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30 w-5">{idx + 1}.</span>
                      <span className="font-medium text-sm text-white">{panel.panelMark}</span>
                      {panel.panelType && (
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">
                          {panel.panelType}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 ml-7">
                      {panel.jobNumber && (
                        <span className="text-xs text-white/40">{panel.jobNumber}</span>
                      )}
                      {panel.panelMass && (
                        <span className="text-xs text-white/30">{parseFloat(panel.panelMass).toLocaleString()} kg</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePanel(panel.id)}
                    className="text-red-400/60 h-8 w-8"
                    data-testid={`button-remove-panel-${panel.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">Load Details</h3>

          <div>
            <label className="text-xs text-white/60 mb-1.5 block">Job</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              aria-required="true"
              data-testid="select-job"
            >
              <option value="" className="bg-[#0D1117]">Select job...</option>
              {activeJobs.map((job) => (
                <option key={job.id} value={job.id} className="bg-[#0D1117]">
                  {job.jobNumber} - {job.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Factory</label>
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                data-testid="select-factory"
              >
                {factories.length > 0 ? (
                  factories.map((f) => (
                    <option key={f.id} value={f.name} className="bg-[#0D1117]">
                      {f.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="QLD" className="bg-[#0D1117]">QLD</option>
                    <option value="VIC" className="bg-[#0D1117]">Victoria</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Trailer Type</label>
              <select
                value={selectedTrailerTypeId}
                onChange={(e) => setSelectedTrailerTypeId(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                data-testid="select-trailer-type"
              >
                <option value="" className="bg-[#0D1117]">None</option>
                {trailerTypes.map((tt) => (
                  <option key={tt.id} value={tt.id} className="bg-[#0D1117]">
                    {tt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Scheduled Date</label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-xl bg-white/5 border-white/10 text-white"
                aria-required="true"
                data-testid="input-scheduled-date"
              />
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Docket Number</label>
              <Input
                placeholder="DOC-001"
                value={docketNumber}
                onChange={(e) => setDocketNumber(e.target.value)}
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20"
                data-testid="input-docket-number"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60 mb-1.5 block">Notes</label>
            <Input
              placeholder="Special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20"
              data-testid="input-notes"
            />
          </div>
        </div>

        <div className="pt-2 pb-4">
          <Button
            onClick={handleSubmit}
            disabled={createLoadListMutation.isPending || scannedPanels.length === 0 || !selectedJobId}
            className="w-full bg-blue-500 text-white py-6 rounded-2xl text-base font-semibold"
            data-testid="button-submit-load-list"
          >
            {createLoadListMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Package className="h-5 w-5 mr-2" />
            )}
            Create Load List ({scannedPanels.length} panels)
          </Button>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
