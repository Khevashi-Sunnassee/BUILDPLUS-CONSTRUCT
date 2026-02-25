import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { LOGISTICS_ROUTES, ADMIN_ROUTES, PANELS_ROUTES, PANEL_TYPES_ROUTES, SETTINGS_ROUTES, USER_ROUTES } from "@shared/api-routes";
import {
  Truck,
  Plus,
  Clock,
  CheckCircle,
  Layers,
} from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job, PanelRegister, TrailerType, PanelTypeConfig } from "@shared/schema";
import { isJobVisibleInDropdowns } from "@shared/job-phases";
import { PageHelpButton } from "@/components/help/page-help-button";
import { loadListSchema, deliverySchema } from "./types";
import type { LoadListWithDetails, LoadListFormData, DeliveryFormData } from "./types";
import { ReadyTab } from "./ReadyTab";
import { PendingTab } from "./PendingTab";
import { CompletedTab } from "./CompletedTab";
import { CreateLoadListDialog, DeliveryDialog, ReturnDialog, DeleteDialog } from "./LogisticsDialogs";

export default function LogisticsPage() {
  useDocumentTitle("Logistics");
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedLoadList, setSelectedLoadList] = useState<LoadListWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedLoadLists, setExpandedLoadLists] = useState<Set<string>>(new Set());
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedReadyPanels, setSelectedReadyPanels] = useState<Set<string>>(new Set());
  const [readyPanelJobFilter, setReadyPanelJobFilter] = useState("all");
  const [pendingJobFilter, setPendingJobFilter] = useState("all");
  const [completedJobFilter, setCompletedJobFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("ready");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnLoadList, setReturnLoadList] = useState<LoadListWithDetails | null>(null);
  const [returnType, setReturnType] = useState<"FULL" | "PARTIAL">("FULL");
  const [returnReason, setReturnReason] = useState("");
  const [returnDate, setReturnDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leftFactoryTime, setLeftFactoryTime] = useState("");
  const [arrivedFactoryTime, setArrivedFactoryTime] = useState("");
  const [unloadedAtFactoryTime, setUnloadedAtFactoryTime] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnPanelIds, setReturnPanelIds] = useState<Set<string>>(new Set());
  const readyTabRef = useRef<HTMLDivElement>(null);
  const pendingTabRef = useRef<HTMLDivElement>(null);
  const completedTabRef = useRef<HTMLDivElement>(null);

  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  const { data: factoriesList } = useQuery<{ id: string; name: string; code: string; state: string }[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings && factoriesList) {
      if (userSettings.defaultFactoryId) {
        const defaultFactory = factoriesList.find(f => f.id === userSettings.defaultFactoryId);
        if (defaultFactory) {
          setFactoryFilter(defaultFactory.state || defaultFactory.code);
        }
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoriesList, factoryFilterInitialized]);

  const { data: loadLists, isLoading: loadListsLoading, isError, error, refetch } = useQuery<LoadListWithDetails[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
    select: (raw: unknown) => Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.data as LoadListWithDetails[] ?? []),
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const { data: trailerTypes } = useQuery<TrailerType[]>({
    queryKey: [LOGISTICS_ROUTES.TRAILER_TYPES],
  });

  const { data: panelTypesData } = useQuery<PanelTypeConfig[]>({
    queryKey: [PANEL_TYPES_ROUTES.LIST],
  });

  const { data: readyForLoadingPanels, isLoading: readyPanelsLoading, isError: readyPanelsError } = useQuery<(PanelRegister & { job: Job })[]>({
    queryKey: [PANELS_ROUTES.READY_FOR_LOADING],
  });

  const getPanelTypeColor = useCallback((panelType: string | null | undefined): string | null => {
    if (!panelType || !panelTypesData) return null;
    const pt = panelTypesData.find(t => t.code === panelType || t.name === panelType || t.code.toUpperCase() === panelType.toUpperCase());
    return pt?.color || null;
  }, [panelTypesData]);

  const getFactoryCode = useCallback((panel: PanelRegister & { job: Job }): string => {
    if (!panel.job.factoryId || !factoriesList) return "QLD";
    const factory = factoriesList.find(f => f.id === panel.job.factoryId);
    return factory?.state || factory?.code || "QLD";
  }, [factoriesList]);

  const readyPanelJobs = useMemo(() => {
    if (!readyForLoadingPanels) return [];
    const jobMap = new Map<string, { id: string; jobNumber: string; name: string }>();
    for (const p of readyForLoadingPanels) {
      if (p.job && !jobMap.has(p.job.id)) {
        jobMap.set(p.job.id, { id: p.job.id, jobNumber: p.job.jobNumber || "", name: p.job.name });
      }
    }
    return Array.from(jobMap.values()).sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
  }, [readyForLoadingPanels]);

  const filteredReadyPanels = useMemo(() => readyForLoadingPanels?.filter(p => {
    if (factoryFilter !== "all") {
      const factoryCode = getFactoryCode(p);
      if (factoryCode !== factoryFilter) return false;
    }
    if (readyPanelJobFilter !== "all") {
      if (p.jobId !== readyPanelJobFilter) return false;
    }
    return true;
  }) || [], [readyForLoadingPanels, factoryFilter, readyPanelJobFilter, getFactoryCode]);

  const toggleReadyPanel = useCallback((panelId: string) => {
    setSelectedReadyPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }, []);

  const toggleAllReadyPanels = useCallback(() => {
    if (selectedReadyPanels.size === filteredReadyPanels.length) {
      setSelectedReadyPanels(new Set());
    } else {
      setSelectedReadyPanels(new Set(filteredReadyPanels.map(p => p.id)));
    }
  }, [selectedReadyPanels.size, filteredReadyPanels]);

  const createLoadListFromReady = useMutation({
    mutationFn: async (panelIds: string[]) => {
      const panels = readyForLoadingPanels?.filter(p => panelIds.includes(p.id)) || [];
      if (panels.length === 0) throw new Error("No panels selected");
      const jobId = panels[0].jobId;
      const factoryCode = getFactoryCode(panels[0]);
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LISTS, {
        jobId,
        factory: factoryCode,
        panelIds,
        notes: `Auto-created from ${panels.length} ready panel${panels.length !== 1 ? "s" : ""}`,
      });
    },
    onSuccess: (_data, panelIds) => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.READY_FOR_LOADING] });
      toast({ title: `Load list created with ${panelIds.length} panel${panelIds.length !== 1 ? "s" : ""}` });
      setSelectedReadyPanels(new Set());
      setPendingJobFilter("all");
      setActiveTab("pending");
    },
    onError: (error: Error) => {
      let description = error.message;
      try {
        const parsed = JSON.parse(error.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: "Failed to create load list", description, variant: "destructive" });
    },
  });

  const handleCreateFromReady = useCallback(() => {
    const panelIds = Array.from(selectedReadyPanels);
    const panels = readyForLoadingPanels?.filter(p => panelIds.includes(p.id)) || [];
    const jobIds = new Set(panels.map(p => p.jobId));
    if (jobIds.size > 1) {
      toast({ title: "Please select panels from the same job", variant: "destructive" });
      return;
    }
    const job = panels[0]?.job;
    if (!job?.factoryId || !factoriesList?.find(f => f.id === job.factoryId)) {
      toast({ title: "Cannot determine factory for selected panels. Ensure the job has a factory assigned.", variant: "destructive" });
      return;
    }
    createLoadListFromReady.mutate(panelIds);
  }, [selectedReadyPanels, readyForLoadingPanels, factoriesList, toast, createLoadListFromReady]);

  const { data: approvedPanels } = useQuery<(PanelRegister & { job: Job })[]>({
    queryKey: [PANELS_ROUTES.APPROVED_FOR_PRODUCTION, selectedJobId],
    queryFn: async () => {
      const url = selectedJobId
        ? `${PANELS_ROUTES.APPROVED_FOR_PRODUCTION}?jobId=${selectedJobId}`
        : PANELS_ROUTES.APPROVED_FOR_PRODUCTION;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch panels");
      return res.json();
    },
    enabled: createDialogOpen,
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; userLogoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.userLogoBase64 || brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "BuildPlus Ai";

  const loadListForm = useForm<LoadListFormData>({
    resolver: zodResolver(loadListSchema),
    defaultValues: {
      jobId: "",
      trailerTypeId: "",
      factory: "QLD",
      docketNumber: "",
      scheduledDate: "",
      notes: "",
      panelIds: [],
    },
  });

  const deliveryForm = useForm<DeliveryFormData>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      loadDocumentNumber: "",
      truckRego: "",
      trailerRego: "",
      deliveryDate: "",
      preload: "",
      loadNumber: "",
      numberPanels: undefined,
      comment: "",
      leaveDepotTime: "",
      arriveLteTime: "",
      pickupLocation: "",
      pickupArriveTime: "",
      pickupLeaveTime: "",
      deliveryLocation: "",
      arriveHoldingTime: "",
      leaveHoldingTime: "",
      siteFirstLiftTime: "",
      siteLastLiftTime: "",
      returnDepotArriveTime: "",
    },
  });

  const createLoadListMutation = useMutation({
    mutationFn: async (data: LoadListFormData) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LISTS, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.READY_FOR_LOADING] });
      const panelCount = variables.panelIds?.length || 0;
      toast({ title: panelCount > 0 ? `Load list created with ${panelCount} panel${panelCount !== 1 ? "s" : ""}` : "Load list created successfully" });
      setCreateDialogOpen(false);
      loadListForm.reset();
      setSelectedJobId("");
      setPendingJobFilter("all");
      setActiveTab("pending");
    },
    onError: (error: Error) => {
      let description = error.message;
      try {
        const parsed = JSON.parse(error.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: "Failed to create load list", description, variant: "destructive" });
    },
  });

  const deleteLoadListMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", LOGISTICS_ROUTES.LOAD_LIST_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      toast({ title: "Load list deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete load list", variant: "destructive" });
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async ({ loadListId, data }: { loadListId: string; data: DeliveryFormData }) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LIST_DELIVERY(loadListId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      toast({ title: "Delivery record created successfully" });
      setDeliveryDialogOpen(false);
      deliveryForm.reset();
      setSelectedLoadList(null);
    },
    onError: (error: Error) => {
      let description = error.message;
      try {
        const parsed = JSON.parse(error.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: "Failed to create delivery record", description, variant: "destructive" });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async ({ loadListId, data }: { loadListId: string; data: Record<string, unknown> }) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LIST_RETURN(loadListId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      toast({ title: "Return load recorded successfully" });
      setReturnDialogOpen(false);
      resetReturnForm();
    },
    onError: (error: Error) => {
      let description = error.message;
      try {
        const parsed = JSON.parse(error.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: "Failed to record return", description, variant: "destructive" });
    },
  });

  const resetReturnForm = () => {
    setReturnType("FULL");
    setReturnReason("");
    setReturnDate(format(new Date(), "yyyy-MM-dd"));
    setLeftFactoryTime("");
    setArrivedFactoryTime("");
    setUnloadedAtFactoryTime("");
    setReturnNotes("");
    setReturnPanelIds(new Set());
    setReturnLoadList(null);
  };

  const openReturnDialog = (loadList: LoadListWithDetails) => {
    setReturnLoadList(loadList);
    setReturnDate(format(new Date(), "yyyy-MM-dd"));
    setReturnDialogOpen(true);
  };

  const handleSubmitReturn = () => {
    if (!returnLoadList) return;
    if (!returnReason.trim()) {
      toast({ title: "Return reason is required", variant: "destructive" });
      return;
    }
    if (returnType === "PARTIAL" && returnPanelIds.size === 0) {
      toast({ title: "Select at least one panel for partial return", variant: "destructive" });
      return;
    }
    createReturnMutation.mutate({
      loadListId: returnLoadList.id,
      data: {
        returnType,
        returnReason: returnReason.trim(),
        returnDate: returnDate || undefined,
        leftFactoryTime: leftFactoryTime || undefined,
        arrivedFactoryTime: arrivedFactoryTime || undefined,
        unloadedAtFactoryTime: unloadedAtFactoryTime || undefined,
        notes: returnNotes || undefined,
        panelIds: returnType === "PARTIAL" ? Array.from(returnPanelIds) : [],
      },
    });
  };

  const handleCreateLoadList = (data: LoadListFormData) => {
    const cleanedData = {
      ...data,
      trailerTypeId: data.trailerTypeId && data.trailerTypeId.length > 0 ? data.trailerTypeId : undefined,
    };
    createLoadListMutation.mutate(cleanedData);
  };

  const handleCreateDelivery = (data: DeliveryFormData) => {
    if (selectedLoadList) {
      createDeliveryMutation.mutate({ loadListId: selectedLoadList.id, data });
    }
  };

  const openDeliveryDialog = (loadList: LoadListWithDetails) => {
    setSelectedLoadList(loadList);
    if (loadList.deliveryRecord) {
      const dr = loadList.deliveryRecord;
      deliveryForm.reset({
        loadDocumentNumber: dr.loadDocumentNumber || "",
        truckRego: dr.truckRego || "",
        trailerRego: dr.trailerRego || "",
        deliveryDate: dr.deliveryDate || "",
        preload: dr.preload || "",
        loadNumber: dr.loadNumber || "",
        numberPanels: dr.numberPanels ?? undefined,
        comment: dr.comment || "",
        leaveDepotTime: dr.leaveDepotTime || "",
        arriveLteTime: dr.arriveLteTime || "",
        pickupLocation: dr.pickupLocation || "",
        pickupArriveTime: dr.pickupArriveTime || "",
        pickupLeaveTime: dr.pickupLeaveTime || "",
        deliveryLocation: dr.deliveryLocation || "",
        arriveHoldingTime: dr.arriveHoldingTime || "",
        leaveHoldingTime: dr.leaveHoldingTime || "",
        siteFirstLiftTime: dr.siteFirstLiftTime || "",
        siteLastLiftTime: dr.siteLastLiftTime || "",
        returnDepotArriveTime: dr.returnDepotArriveTime || "",
      });
    } else {
      deliveryForm.reset({
        numberPanels: loadList.panels?.length || undefined,
      });
    }
    setDeliveryDialogOpen(true);
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedLoadLists);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedLoadLists(newSet);
  };

  const calculateTotalMass = (panels: { panel: PanelRegister }[]) => {
    return panels.reduce((sum, p) => sum + (parseFloat(p.panel.panelMass || "0") || 0), 0);
  };

  const printAllQrCodes = async (loadList: LoadListWithDetails) => {
    if (loadList.panels.length === 0) {
      toast({ variant: "destructive", title: "No panels", description: "This load list has no panels to print QR codes for" });
      return;
    }
    try {
      const QRCode = await import('qrcode');
      const qrItems = loadList.panels
        .sort((a, b) => a.sequence - b.sequence)
        .map((lp) => ({
          panel: lp.panel,
          job: loadList.job,
          url: `${window.location.origin}/panel/${lp.panel.id}`
        }));
      const qrData = await Promise.all(
        qrItems.map(async (item) => {
          const svgString = await QRCode.toString(item.url, { type: 'svg', width: 120, margin: 1 });
          return { ...item, svg: svgString };
        })
      );
      const qrCodesHtml = qrData.map((item) => `
        <div class="qr-item">
          <div class="qr-code">${item.svg}</div>
          <div class="panel-mark">${item.panel.panelMark}</div>
          <div class="job-number">${item.job.jobNumber}</div>
        </div>
      `).join('');
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to print the QR codes" });
        return;
      }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Codes - ${loadList.job.jobNumber} - Load List</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: system-ui, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .header h1 { font-size: 18px; margin-bottom: 5px; }
              .header p { font-size: 12px; color: #666; }
              .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
              .qr-item { display: flex; flex-direction: column; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; page-break-inside: avoid; }
              .qr-code svg { width: 120px; height: 120px; }
              .panel-mark { font-size: 16px; font-weight: bold; font-family: monospace; margin-top: 8px; }
              .job-number { font-size: 11px; color: #666; margin-top: 4px; }
              @media print { body { padding: 10px; } .qr-grid { gap: 15px; } .qr-item { border: 1px solid #ccc; padding: 10px; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Load List QR Codes</h1>
              <p>${loadList.job.jobNumber} - ${loadList.job.name} | ${loadList.panels.length} Panels</p>
            </div>
            <div class="qr-grid">${qrCodesHtml}</div>
            <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('Error generating QR codes:', err);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate QR codes" });
    }
  };

  const watchedJobId = loadListForm.watch("jobId");

  const filteredPanels = useMemo(() => approvedPanels?.filter(p =>
    !watchedJobId || watchedJobId === "" || p.jobId === watchedJobId
  ) || [], [approvedPanels, watchedJobId]);

  const exportTabToPDF = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove("dark");
          clonedDoc.documentElement.style.colorScheme = "light";
          clonedDoc.querySelectorAll("*").forEach((el) => {
            if (el instanceof HTMLElement) {
              const computed = window.getComputedStyle(el);
              if (computed.backgroundColor.includes("rgb(")) {
                const bg = computed.backgroundColor;
                if (bg.includes("rgb(0,") || bg.includes("rgb(10,") || bg.includes("rgb(20,") || bg.includes("rgb(30,")) {
                  el.style.backgroundColor = "#ffffff";
                }
              }
            }
          });
        },
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const headerHeight = 25;
      const usableWidth = pdfWidth - margin * 2;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = usableWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      const usablePageHeight = pdfHeight - headerHeight - margin;
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text(filename.replace(/-/g, " "), margin, 15);
      pdf.setFontSize(9);
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth - margin, 15, { align: "right" });
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, headerHeight - 3, pdfWidth - margin, headerHeight - 3);
      if (scaledHeight <= usablePageHeight) {
        pdf.addImage(imgData, "PNG", margin, headerHeight, usableWidth, scaledHeight);
      } else {
        let srcY = 0;
        let page = 0;
        while (srcY < imgHeight) {
          if (page > 0) pdf.addPage();
          const sliceHeight = Math.min(usablePageHeight / ratio, imgHeight - srcY);
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = imgWidth;
          tempCanvas.height = sliceHeight;
          const ctx = tempCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, srcY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
            pdf.addImage(tempCanvas.toDataURL("image/png"), "PNG", margin, page === 0 ? headerHeight : margin, usableWidth, sliceHeight * ratio);
          }
          srcY += sliceHeight;
          page++;
        }
      }
      pdf.save(`${filename}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Failed to export PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintTab = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = ref.current.innerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>BuildPlus - Logistics</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            button, .hidden-print { display: none !important; }
            @media print { body { margin: 0; padding: 10px; } }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); printWindow.onafterprint = () => printWindow.close(); };
  };

  const handleEmailTab = (tabType: "ready" | "pending" | "completed") => {
    let subject = "BuildPlus Logistics - ";
    let body = "";
    if (tabType === "ready") {
      subject += `Panels Ready to Load (${filteredReadyPanels.length})`;
      const grouped = new Map<string, typeof filteredReadyPanels>();
      filteredReadyPanels.forEach(p => {
        const key = p.job?.jobNumber || "Unknown";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(p);
      });
      body = `Panels Ready to Load - ${filteredReadyPanels.length} panels\n\n`;
      grouped.forEach((panels, jobNumber) => {
        body += `Job: ${jobNumber}\n`;
        panels.forEach(p => {
          body += `  - ${p.panelMark} | ${p.panelType || ""} | ${p.building || ""} ${p.level || ""} | ${p.panelMass ? parseFloat(p.panelMass).toLocaleString() + " kg" : ""}\n`;
        });
        body += "\n";
      });
    } else if (tabType === "pending") {
      subject += `Pending Load Lists (${pendingLoadLists.length})`;
      body = `Pending Load Lists - ${pendingLoadLists.length} lists\n\n`;
      pendingLoadLists.forEach(ll => {
        body += `${ll.loadNumber} - ${ll.job.jobNumber} ${ll.job.name}\n`;
        body += `  Panels: ${ll.panels.length} | Mass: ${calculateTotalMass(ll.panels).toLocaleString()} kg\n`;
        if (ll.scheduledDate) body += `  Scheduled: ${new Date(ll.scheduledDate).toLocaleDateString()}\n`;
        if (ll.docketNumber) body += `  Docket: ${ll.docketNumber}\n`;
        body += "\n";
      });
    } else {
      subject += `Completed Deliveries (${completedLoadLists.length})`;
      body = `Completed Deliveries - ${completedLoadLists.length} deliveries\n\n`;
      completedLoadLists.forEach(ll => {
        body += `${ll.loadNumber} - ${ll.job.jobNumber} ${ll.job.name}\n`;
        body += `  Panels: ${ll.panels.length}\n`;
        if (ll.deliveryRecord?.deliveryDate) body += `  Delivered: ${ll.deliveryRecord.deliveryDate}\n`;
        if (ll.deliveryRecord?.truckRego) body += `  Truck: ${ll.deliveryRecord.truckRego}\n`;
        body += "\n";
      });
    }
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const filteredLoadLists = useMemo(() => loadLists?.filter(ll => {
    if (factoryFilter !== "all" && ll.factory !== factoryFilter) {
      return false;
    }
    return true;
  }) || [], [loadLists, factoryFilter]);
  const pendingLoadListsAll = useMemo(() => filteredLoadLists.filter(ll => ll.status === "PENDING"), [filteredLoadLists]);
  const completedLoadListsAll = useMemo(() => filteredLoadLists.filter(ll => ll.status === "COMPLETE"), [filteredLoadLists]);

  const pendingLoadLists = useMemo(() => pendingJobFilter === "all" ? pendingLoadListsAll : pendingLoadListsAll.filter(ll => ll.job.id === pendingJobFilter), [pendingLoadListsAll, pendingJobFilter]);
  const completedLoadLists = useMemo(() => completedJobFilter === "all" ? completedLoadListsAll : completedLoadListsAll.filter(ll => ll.job.id === completedJobFilter), [completedLoadListsAll, completedJobFilter]);

  const pendingJobOptions = useMemo(() => {
    const jobMap = new Map<string, { id: string; jobNumber: string; name: string }>();
    for (const ll of pendingLoadListsAll) {
      if (!jobMap.has(ll.job.id)) jobMap.set(ll.job.id, { id: ll.job.id, jobNumber: ll.job.jobNumber || "", name: ll.job.name });
    }
    return Array.from(jobMap.values()).sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
  }, [pendingLoadListsAll]);

  const completedJobOptions = useMemo(() => {
    const jobMap = new Map<string, { id: string; jobNumber: string; name: string }>();
    for (const ll of completedLoadListsAll) {
      if (!jobMap.has(ll.job.id)) jobMap.set(ll.job.id, { id: ll.job.id, jobNumber: ll.job.jobNumber || "", name: ll.job.name });
    }
    return Array.from(jobMap.values()).sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
  }, [completedLoadListsAll]);

  if (loadListsLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <QueryErrorState error={error} onRetry={refetch} message="Failed to load logistics data" />
      </div>
    );
  }

  return (
    <div className="space-y-4" role="main" aria-label="Logistics">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
              <Truck className="h-6 w-6" aria-hidden="true" />
              Logistics
            </h1>
            <PageHelpButton pageHelpKey="page.logistics" />
          </div>
          <p className="text-muted-foreground">Manage load lists and track deliveries</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
            <SelectTrigger className="w-36" data-testid="select-factory-filter" aria-label="Filter by factory">
              <SelectValue placeholder="Factory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Factories</SelectItem>
              <SelectItem value="QLD">QLD</SelectItem>
              <SelectItem value="VIC">Victoria</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-load-list">
            <Plus className="h-4 w-4 mr-2" />
            Create Load List
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-logistics">
          <TabsTrigger value="ready" data-testid="tab-ready">
            <Layers className="h-4 w-4 mr-2" />
            Ready to Load ({filteredReadyPanels.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending ({pendingLoadLists.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Delivered ({completedLoadLists.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="mt-4">
          <ReadyTab
            filteredReadyPanels={filteredReadyPanels}
            readyPanelsLoading={readyPanelsLoading}
            readyPanelsError={readyPanelsError}
            selectedReadyPanels={selectedReadyPanels}
            readyPanelJobFilter={readyPanelJobFilter}
            readyPanelJobs={readyPanelJobs}
            isExporting={isExporting}
            createFromReadyPending={createLoadListFromReady.isPending}
            readyTabRef={readyTabRef}
            getPanelTypeColor={getPanelTypeColor}
            toggleReadyPanel={toggleReadyPanel}
            toggleAllReadyPanels={toggleAllReadyPanels}
            handleCreateFromReady={handleCreateFromReady}
            onJobFilterChange={(v) => { setReadyPanelJobFilter(v); setSelectedReadyPanels(new Set()); }}
            onExportPDF={() => exportTabToPDF(readyTabRef, "Panels-Ready-To-Load")}
            onPrint={() => handlePrintTab(readyTabRef)}
            onEmail={() => handleEmailTab("ready")}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <PendingTab
            pendingLoadLists={pendingLoadLists}
            pendingJobOptions={pendingJobOptions}
            pendingJobFilter={pendingJobFilter}
            expandedLoadLists={expandedLoadLists}
            isExporting={isExporting}
            pendingTabRef={pendingTabRef}
            setPendingJobFilter={setPendingJobFilter}
            toggleExpanded={toggleExpanded}
            calculateTotalMass={calculateTotalMass}
            printAllQrCodes={printAllQrCodes}
            openDeliveryDialog={openDeliveryDialog}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onExportPDF={() => exportTabToPDF(pendingTabRef, "Pending-Load-Lists")}
            onPrint={() => handlePrintTab(pendingTabRef)}
            onEmail={() => handleEmailTab("pending")}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <CompletedTab
            completedLoadLists={completedLoadLists}
            completedJobOptions={completedJobOptions}
            completedJobFilter={completedJobFilter}
            expandedLoadLists={expandedLoadLists}
            isExporting={isExporting}
            completedTabRef={completedTabRef}
            setCompletedJobFilter={setCompletedJobFilter}
            toggleExpanded={toggleExpanded}
            printAllQrCodes={printAllQrCodes}
            openReturnDialog={openReturnDialog}
            onExportPDF={() => exportTabToPDF(completedTabRef, "Completed-Deliveries")}
            onPrint={() => handlePrintTab(completedTabRef)}
            onEmail={() => handleEmailTab("completed")}
          />
        </TabsContent>
      </Tabs>

      <CreateLoadListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        loadListForm={loadListForm}
        jobs={jobs}
        trailerTypes={trailerTypes}
        filteredPanels={filteredPanels}
        watchedJobId={watchedJobId}
        isPending={createLoadListMutation.isPending}
        onSubmit={handleCreateLoadList}
        onJobChange={(value) => {
          setSelectedJobId(value);
          loadListForm.setValue("panelIds", []);
        }}
        isJobVisibleInDropdowns={isJobVisibleInDropdowns}
      />

      <DeliveryDialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        deliveryForm={deliveryForm}
        selectedLoadList={selectedLoadList}
        isPending={createDeliveryMutation.isPending}
        onSubmit={handleCreateDelivery}
      />

      <ReturnDialog
        open={returnDialogOpen}
        onOpenChange={(open) => { if (!open) resetReturnForm(); setReturnDialogOpen(open); }}
        returnLoadList={returnLoadList}
        returnType={returnType}
        returnReason={returnReason}
        returnDate={returnDate}
        leftFactoryTime={leftFactoryTime}
        arrivedFactoryTime={arrivedFactoryTime}
        unloadedAtFactoryTime={unloadedAtFactoryTime}
        returnNotes={returnNotes}
        returnPanelIds={returnPanelIds}
        isPending={createReturnMutation.isPending}
        setReturnType={setReturnType}
        setReturnReason={setReturnReason}
        setReturnDate={setReturnDate}
        setLeftFactoryTime={setLeftFactoryTime}
        setArrivedFactoryTime={setArrivedFactoryTime}
        setUnloadedAtFactoryTime={setUnloadedAtFactoryTime}
        setReturnNotes={setReturnNotes}
        setReturnPanelIds={setReturnPanelIds}
        onSubmit={handleSubmitReturn}
        onClose={() => { resetReturnForm(); setReturnDialogOpen(false); }}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deletingId && deleteLoadListMutation.mutate(deletingId)}
      />
    </div>
  );
}
