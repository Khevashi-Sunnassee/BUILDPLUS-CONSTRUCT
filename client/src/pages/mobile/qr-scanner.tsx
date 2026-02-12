import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { PANELS_ROUTES, DOCUMENT_ROUTES } from "@shared/api-routes";
import { PANEL_LIFECYCLE_LABELS, PANEL_LIFECYCLE_STATUS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScanLine,
  Camera,
  X,
  ChevronLeft,
  FileText,
  ClipboardCheck,
  Truck,
  PackageOpen,
  Package,
  AlertCircle,
  CheckCircle,
  Loader2,
  Layers,
  Building2,
  Weight,
  Ruler,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface PanelDetail {
  id: string;
  panelMark: string;
  panelType: string | null;
  description: string | null;
  status: string;
  building: string | null;
  level: string | null;
  panelThickness: string | null;
  panelArea: string | null;
  panelMass: string | null;
  lifecycleStatus: number;
  jobId: string;
  job?: {
    id: string;
    jobNumber: string;
    name: string;
  };
}

interface BundleDetail {
  id: string;
  bundleName: string;
  description: string | null;
  qrCodeId: string;
  allowGuestAccess: boolean;
  items?: BundleDocument[];
}

interface BundleDocument {
  id: string;
  documentId: string;
  document?: {
    id: string;
    title: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  };
}

type ScanResult =
  | { type: "panel"; data: PanelDetail }
  | { type: "bundle"; data: BundleDetail }
  | { type: "error"; message: string };

const LIFECYCLE_MOBILE_COLORS: Record<number, string> = {
  0: "bg-slate-500/20 text-slate-300",
  1: "bg-sky-500/20 text-sky-300",
  2: "bg-blue-500/20 text-blue-300",
  3: "bg-violet-500/20 text-violet-300",
  4: "bg-purple-500/20 text-purple-300",
  5: "bg-amber-500/20 text-amber-300",
  6: "bg-orange-500/20 text-orange-300",
  7: "bg-yellow-500/20 text-yellow-300",
  8: "bg-lime-500/20 text-lime-300",
  9: "bg-green-500/20 text-green-300",
  10: "bg-teal-500/20 text-teal-300",
  11: "bg-cyan-500/20 text-cyan-300",
  12: "bg-rose-500/20 text-rose-300",
  13: "bg-emerald-500/20 text-emerald-300",
  14: "bg-red-500/20 text-red-300",
};

export default function MobileQrScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const scannerRef = useRef<any>(null);
  const scannerContainerId = "mobile-qr-scanner";
  const processingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) { console.error("QR processing error:", e); }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError(null);
    setScanResult(null);
    setScanning(true);
    processingRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      await new Promise((r) => setTimeout(r, 100));

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
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText: string) => {
          handleQrScan(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      setScannerError(
        err?.message || "Failed to start camera. Please check camera permissions."
      );
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
        } catch (e) { console.error("QR processing error:", e); }
        scannerRef.current = null;
      }
    };
  }, []);

  const handleQrScan = async (decodedText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    await stopScanner();
    setLoading(true);

    try {
      const panelIdMatch = decodedText.match(/\/panel\/([a-f0-9-]+)/i);
      if (panelIdMatch) {
        const panelId = panelIdMatch[1];
        const res = await fetch(PANELS_ROUTES.DETAILS(panelId), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Panel not found");
        const panelData = await res.json();
        setScanResult({ type: "panel", data: panelData });
        setLoading(false);
        return;
      }

      const bundleMatch = decodedText.match(/bundle-[0-9]+-[a-f0-9]+/i);
      if (bundleMatch) {
        const qrCodeId = bundleMatch[0];
        const res = await fetch(DOCUMENT_ROUTES.BUNDLE_BY_QR(qrCodeId), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Bundle not found");
        const bundleData = await res.json();
        setScanResult({ type: "bundle", data: bundleData });
        setLoading(false);
        return;
      }

      if (decodedText.includes("/bundles/") || decodedText.includes("bundle")) {
        const urlParts = decodedText.split("/");
        const qrId = urlParts[urlParts.length - 1];
        if (qrId) {
          const res = await fetch(DOCUMENT_ROUTES.BUNDLE_BY_QR(qrId), {
            credentials: "include",
          });
          if (res.ok) {
            const bundleData = await res.json();
            setScanResult({ type: "bundle", data: bundleData });
            setLoading(false);
            return;
          }
        }
      }

      setScanResult({
        type: "error",
        message: "Unrecognized QR code. Expected a panel or document bundle QR code.",
      });
    } catch (err: any) {
      setScanResult({
        type: "error",
        message: err.message || "Could not process QR code",
      });
    }

    setLoading(false);
  };

  const resetScan = () => {
    setScanResult(null);
    processingRef.current = false;
  };

  const lifecycleMutation = useMutation({
    mutationFn: async ({
      panelId,
      targetStatus,
    }: {
      panelId: string;
      targetStatus: number;
    }) => {
      return apiRequest("POST", PANELS_ROUTES.LIFECYCLE(panelId), {
        targetStatus,
      });
    },
    onSuccess: async (_, variables) => {
      const res = await fetch(PANELS_ROUTES.DETAILS(variables.panelId), {
        credentials: "include",
      });
      if (res.ok) {
        const updatedPanel = await res.json();
        setScanResult({ type: "panel", data: updatedPanel });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
    },
    onError: (error: any) => {
      let message = "Failed to update panel";
      if (error?.message) {
        const jsonMatch = error.message.match(/\{.*"error"\s*:\s*"(.+?)"/);
        if (jsonMatch) {
          message = jsonMatch[1];
        } else {
          message = error.message.replace(/^\d+:\s*/, "");
        }
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const handleQaPanel = (panelId: string) => {
    lifecycleMutation.mutate({
      panelId,
      targetStatus: PANEL_LIFECYCLE_STATUS.QA_PASSED,
    });
  };

  const handleUnloadPanel = (panelId: string) => {
    lifecycleMutation.mutate({
      panelId,
      targetStatus: PANEL_LIFECYCLE_STATUS.RETURNED,
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation("/mobile/more")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.95]"
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" data-testid="text-page-title">
              QR Scanner
            </h1>
          </div>
          {scanResult && (
            <button
              onClick={() => {
                resetScan();
                startScanner();
              }}
              className="flex h-9 items-center gap-2 rounded-xl bg-blue-500/20 px-3 active:scale-[0.97]"
              data-testid="button-scan-again"
            >
              <RotateCcw className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Scan Again</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 pt-4">
        {!scanResult && !loading && (
          <div className="px-4 space-y-4">
            <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-black">
              <div
                id={scannerContainerId}
                className={`w-full ${scanning ? "min-h-[300px]" : "hidden"}`}
                data-testid="scanner-viewport"
              />

              {!scanning && (
                <div className="flex flex-col items-center justify-center py-16 px-4 space-y-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/20">
                    <Camera className="h-10 w-10 text-blue-400" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-semibold text-white">
                      Ready to Scan
                    </p>
                    <p className="text-sm text-white/50">
                      Scan panel or document bundle QR codes
                    </p>
                  </div>
                </div>
              )}
            </div>

            {scannerError && (
              <div
                className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3"
                data-testid="scanner-error"
              >
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Camera Error</p>
                  <p className="text-xs text-red-400/70 mt-1">{scannerError}</p>
                </div>
              </div>
            )}

            {!scanning ? (
              <button
                onClick={startScanner}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-[0.98]"
                data-testid="button-start-scanner"
              >
                <ScanLine className="h-5 w-5" />
                Start Scanning
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl border border-white/20 bg-white/5 text-white font-semibold text-base active:scale-[0.98]"
                data-testid="button-stop-scanner"
              >
                <X className="h-5 w-5" />
                Stop Scanning
              </button>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-white/80">Supported QR Codes</p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
                  <Layers className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Panel QR Codes</p>
                  <p className="text-xs text-white/40">View details, QA, load or unload panels</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20">
                  <Package className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Document Bundles</p>
                  <p className="text-xs text-white/40">View all documents in a bundle</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 px-4">
            <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
            <p className="text-white/60 text-sm">Processing QR code...</p>
          </div>
        )}

        {scanResult?.type === "panel" && (
          <PanelScanResult
            panel={scanResult.data}
            onViewDocuments={() =>
              setLocation(`/mobile/documents?panelId=${scanResult.data.id}`)
            }
            onQaPanel={() => handleQaPanel(scanResult.data.id)}
            onLoadPanel={() =>
              setLocation(`/mobile/create-load-list?panelId=${scanResult.data.id}`)
            }
            onUnloadPanel={() => handleUnloadPanel(scanResult.data.id)}
            isUpdating={lifecycleMutation.isPending}
          />
        )}

        {scanResult?.type === "bundle" && (
          <BundleScanResult
            bundle={scanResult.data}
            onViewDocuments={() =>
              setLocation(`/mobile/documents?bundleId=${scanResult.data.id}`)
            }
          />
        )}

        {scanResult?.type === "error" && (
          <div className="px-4 space-y-4">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-red-400">QR Not Recognized</p>
                <p className="text-sm text-white/50">{scanResult.message}</p>
              </div>
            </div>
            <button
              onClick={() => {
                resetScan();
                startScanner();
              }}
              className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-[0.98]"
              data-testid="button-retry-scan"
            >
              <RotateCcw className="h-5 w-5" />
              Try Again
            </button>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}

function PanelScanResult({
  panel,
  onViewDocuments,
  onQaPanel,
  onLoadPanel,
  onUnloadPanel,
  isUpdating,
}: {
  panel: PanelDetail;
  onViewDocuments: () => void;
  onQaPanel: () => void;
  onLoadPanel: () => void;
  onUnloadPanel: () => void;
  isUpdating: boolean;
}) {
  const lifecycleLabel =
    PANEL_LIFECYCLE_LABELS[panel.lifecycleStatus] || "Unknown";
  const lifecycleColor =
    LIFECYCLE_MOBILE_COLORS[panel.lifecycleStatus] || "bg-white/10 text-white/60";

  const canQa = panel.lifecycleStatus >= PANEL_LIFECYCLE_STATUS.PRODUCED &&
    panel.lifecycleStatus < PANEL_LIFECYCLE_STATUS.QA_PASSED;
  const canLoad = panel.lifecycleStatus >= PANEL_LIFECYCLE_STATUS.QA_PASSED &&
    panel.lifecycleStatus < PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST;
  const canUnload = panel.lifecycleStatus === PANEL_LIFECYCLE_STATUS.SHIPPED;

  return (
    <div className="px-4 space-y-4" data-testid="panel-scan-result">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/20">
          <CheckCircle className="h-6 w-6 text-green-400" />
        </div>
        <div>
          <p className="text-sm text-green-400 font-medium">Panel Found</p>
          <p className="text-xs text-white/40">Scanned successfully</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-white" data-testid="text-panel-mark">
              {panel.panelMark}
            </p>
            {panel.job && (
              <p className="text-sm text-white/50 mt-1" data-testid="text-panel-job">
                {panel.job.jobNumber} - {panel.job.name}
              </p>
            )}
          </div>
          <Badge
            className={`${lifecycleColor} border-0 text-xs font-medium shrink-0`}
            data-testid="badge-lifecycle"
          >
            {lifecycleLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {panel.panelType && (
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-white/30" />
              <div>
                <p className="text-[10px] text-white/40 uppercase">Type</p>
                <p className="text-sm text-white" data-testid="text-panel-type">
                  {panel.panelType}
                </p>
              </div>
            </div>
          )}
          {panel.building && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-white/30" />
              <div>
                <p className="text-[10px] text-white/40 uppercase">Building</p>
                <p className="text-sm text-white" data-testid="text-panel-building">
                  {panel.building}
                </p>
              </div>
            </div>
          )}
          {panel.level && (
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-white/30" />
              <div>
                <p className="text-[10px] text-white/40 uppercase">Level</p>
                <p className="text-sm text-white" data-testid="text-panel-level">
                  {panel.level}
                </p>
              </div>
            </div>
          )}
          {panel.panelMass && (
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-white/30" />
              <div>
                <p className="text-[10px] text-white/40 uppercase">Mass</p>
                <p className="text-sm text-white" data-testid="text-panel-mass">
                  {panel.panelMass} kg
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-white/80 px-1">Actions</p>

        <button
          onClick={onViewDocuments}
          className="w-full flex items-center gap-4 h-[60px] rounded-2xl border border-white/10 bg-white/5 px-4 active:scale-[0.99]"
          data-testid="button-view-documents"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20">
            <FileText className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">View Documents</p>
            <p className="text-xs text-white/40">Drawings and attachments</p>
          </div>
        </button>

        <button
          onClick={onQaPanel}
          disabled={!canQa || isUpdating}
          className={`w-full flex items-center gap-4 h-[60px] rounded-2xl border px-4 active:scale-[0.99] ${
            canQa
              ? "border-green-500/30 bg-green-500/10"
              : "border-white/5 bg-white/[0.02] opacity-40"
          }`}
          data-testid="button-qa-panel"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${canQa ? "bg-green-500/20" : "bg-white/10"}`}>
            {isUpdating ? (
              <Loader2 className="h-5 w-5 text-green-400 animate-spin" />
            ) : (
              <ClipboardCheck className={`h-5 w-5 ${canQa ? "text-green-400" : "text-white/30"}`} />
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${canQa ? "text-green-400" : "text-white/30"}`}>
              QA Panel
            </p>
            <p className="text-xs text-white/40">
              {canQa ? "Mark as QA passed" : panel.lifecycleStatus >= PANEL_LIFECYCLE_STATUS.QA_PASSED ? "Already QA passed" : "Panel must be produced first"}
            </p>
          </div>
        </button>

        <button
          onClick={onLoadPanel}
          disabled={!canLoad}
          className={`w-full flex items-center gap-4 h-[60px] rounded-2xl border px-4 active:scale-[0.99] ${
            canLoad
              ? "border-teal-500/30 bg-teal-500/10"
              : "border-white/5 bg-white/[0.02] opacity-40"
          }`}
          data-testid="button-load-panel"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${canLoad ? "bg-teal-500/20" : "bg-white/10"}`}>
            <Truck className={`h-5 w-5 ${canLoad ? "text-teal-400" : "text-white/30"}`} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${canLoad ? "text-teal-400" : "text-white/30"}`}>
              Load Panel
            </p>
            <p className="text-xs text-white/40">
              {canLoad ? "Add to a load list" : "Panel must pass QA first"}
            </p>
          </div>
        </button>

        <button
          onClick={onUnloadPanel}
          disabled={!canUnload || isUpdating}
          className={`w-full flex items-center gap-4 h-[60px] rounded-2xl border px-4 active:scale-[0.99] ${
            canUnload
              ? "border-rose-500/30 bg-rose-500/10"
              : "border-white/5 bg-white/[0.02] opacity-40"
          }`}
          data-testid="button-unload-panel"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${canUnload ? "bg-rose-500/20" : "bg-white/10"}`}>
            {isUpdating ? (
              <Loader2 className="h-5 w-5 text-rose-400 animate-spin" />
            ) : (
              <PackageOpen className={`h-5 w-5 ${canUnload ? "text-rose-400" : "text-white/30"}`} />
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${canUnload ? "text-rose-400" : "text-white/30"}`}>
              Unload Panel
            </p>
            <p className="text-xs text-white/40">
              {canUnload ? "Return from delivery" : "Panel must be shipped first"}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function BundleScanResult({
  bundle,
  onViewDocuments,
}: {
  bundle: BundleDetail;
  onViewDocuments: () => void;
}) {
  const docCount = bundle.items?.length || 0;

  return (
    <div className="px-4 space-y-4" data-testid="bundle-scan-result">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/20">
          <CheckCircle className="h-6 w-6 text-green-400" />
        </div>
        <div>
          <p className="text-sm text-green-400 font-medium">Bundle Found</p>
          <p className="text-xs text-white/40">Scanned successfully</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xl font-bold text-white" data-testid="text-bundle-name">
              {bundle.bundleName}
            </p>
            {bundle.description && (
              <p className="text-sm text-white/50 mt-1" data-testid="text-bundle-description">
                {bundle.description}
              </p>
            )}
          </div>
          <Badge className="bg-indigo-500/20 text-indigo-300 border-0 text-xs font-medium shrink-0">
            {docCount} {docCount === 1 ? "document" : "documents"}
          </Badge>
        </div>

        {bundle.items && bundle.items.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            {bundle.items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2"
                data-testid={`bundle-doc-${item.documentId}`}
              >
                <FileText className="h-4 w-4 text-white/30 flex-shrink-0" />
                <p className="text-sm text-white truncate">
                  {item.document?.title || item.document?.originalName || "Document"}
                </p>
              </div>
            ))}
            {bundle.items.length > 5 && (
              <p className="text-xs text-white/40 text-center pt-1">
                +{bundle.items.length - 5} more documents
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onViewDocuments}
        className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-blue-500 text-white font-semibold text-base active:scale-[0.98]"
        data-testid="button-view-bundle-documents"
      >
        <FileText className="h-5 w-5" />
        View All Documents
      </button>
    </div>
  );
}
