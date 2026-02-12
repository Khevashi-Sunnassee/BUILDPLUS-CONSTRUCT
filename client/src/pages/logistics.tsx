import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { LOGISTICS_ROUTES, ADMIN_ROUTES, PANELS_ROUTES, PANEL_TYPES_ROUTES, SETTINGS_ROUTES, USER_ROUTES } from "@shared/api-routes";
import {
  Truck,
  Plus,
  Package,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  CheckCircle,
  Loader2,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  FileDown,
  QrCode,
  Layers,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Job, PanelRegister, TrailerType, PanelTypeConfig } from "@shared/schema";
import { isJobVisibleInDropdowns } from "@shared/job-phases";
import { PageHelpButton } from "@/components/help/page-help-button";

interface LoadListWithDetails {
  id: string;
  jobId: string;
  trailerTypeId?: string | null;
  docketNumber?: string | null;
  scheduledDate?: string | null;
  notes?: string | null;
  status: string;
  factory: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  job: Job;
  trailerType?: TrailerType | null;
  panels: { id: string; loadListId: string; panelId: string; sequence: number; panel: PanelRegister }[];
  deliveryRecord?: DeliveryRecord | null;
  loadReturn?: any;
  createdBy?: { id: string; name: string; email: string } | null;
}

interface DeliveryRecord {
  id: string;
  loadListId: string;
  docketNumber?: string | null;
  loadDocumentNumber?: string | null;
  truckRego?: string | null;
  trailerRego?: string | null;
  deliveryDate?: string | null;
  preload?: string | null;
  loadNumber?: string | null;
  numberPanels?: number | null;
  comment?: string | null;
  startTime?: string | null;
  leaveDepotTime?: string | null;
  arriveLteTime?: string | null;
  pickupLocation?: string | null;
  pickupArriveTime?: string | null;
  pickupLeaveTime?: string | null;
  deliveryLocation?: string | null;
  arriveHoldingTime?: string | null;
  leaveHoldingTime?: string | null;
  siteFirstLiftTime?: string | null;
  siteLastLiftTime?: string | null;
  returnDepotArriveTime?: string | null;
  totalHours?: string | null;
  enteredById?: string | null;
  createdAt: string;
  updatedAt: string;
}

const loadListSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  trailerTypeId: z.string().optional(),
  factory: z.string().default("QLD"),
  docketNumber: z.string().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
  panelIds: z.array(z.string()).default([]),
});

const deliverySchema = z.object({
  loadDocumentNumber: z.string().optional(),
  truckRego: z.string().optional(),
  trailerRego: z.string().optional(),
  deliveryDate: z.string().optional(),
  preload: z.string().optional(),
  loadNumber: z.string().optional(),
  numberPanels: z.coerce.number().optional(),
  comment: z.string().optional(),
  leaveDepotTime: z.string().optional(),
  arriveLteTime: z.string().optional(),
  pickupLocation: z.string().optional(),
  pickupArriveTime: z.string().optional(),
  pickupLeaveTime: z.string().optional(),
  deliveryLocation: z.string().optional(),
  arriveHoldingTime: z.string().optional(),
  leaveHoldingTime: z.string().optional(),
  siteFirstLiftTime: z.string().optional(),
  siteLastLiftTime: z.string().optional(),
  returnDepotArriveTime: z.string().optional(),
});

type LoadListFormData = z.infer<typeof loadListSchema>;
type DeliveryFormData = z.infer<typeof deliverySchema>;

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
  const [readyPanelsExpanded, setReadyPanelsExpanded] = useState(true);
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
  const reportRef = useRef<HTMLDivElement>(null);

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

  const { data: loadLists, isLoading: loadListsLoading } = useQuery<LoadListWithDetails[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
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

  const filteredReadyPanels = useMemo(() => readyForLoadingPanels?.filter(p => {
    if (factoryFilter === "all") return true;
    const factoryCode = getFactoryCode(p);
    return factoryCode === factoryFilter;
  }) || [], [readyForLoadingPanels, factoryFilter, getFactoryCode]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.READY_FOR_LOADING] });
      toast({ title: "Load list created successfully" });
      setSelectedReadyPanels(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Failed to create load list", description: error.message, variant: "destructive" });
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

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "LTE Performance";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      toast({ title: "Load list created successfully" });
      setCreateDialogOpen(false);
      loadListForm.reset();
      setSelectedJobId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create load list", description: error.message, variant: "destructive" });
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
    onError: (error: any) => {
      toast({ title: "Failed to create delivery record", description: error.message, variant: "destructive" });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async ({ loadListId, data }: { loadListId: string; data: any }) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LIST_RETURN(loadListId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      toast({ title: "Return load recorded successfully" });
      setReturnDialogOpen(false);
      resetReturnForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to record return", description: error.message, variant: "destructive" });
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
    // Transform empty trailerTypeId to undefined to avoid foreign key constraint error
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
      // Pre-fill number of panels from load list
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

  const filteredPanels = approvedPanels?.filter(p => 
    !watchedJobId || watchedJobId === "" || p.jobId === watchedJobId
  ) || [];

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove("dark");
          clonedDoc.documentElement.style.colorScheme = "light";
          const clonedElement = clonedDoc.body.querySelector("[data-pdf-content]") || clonedDoc.body;
          if (clonedElement instanceof HTMLElement) {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.color = "#000000";
          }
          clonedDoc.querySelectorAll("*").forEach((el) => {
            if (el instanceof HTMLElement) {
              const computed = window.getComputedStyle(el);
              if (computed.backgroundColor.includes("rgb(") && !computed.backgroundColor.includes("255, 255, 255")) {
                const bg = computed.backgroundColor;
                if (bg.includes("rgb(0,") || bg.includes("rgb(10,") || bg.includes("rgb(20,") || bg.includes("rgb(30,") || bg.includes("hsl(")) {
                  el.style.backgroundColor = "#ffffff";
                }
              }
            }
          });
        },
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const headerHeight = 35;
      const margin = 10;
      const footerHeight = 12;
      const usableHeight = pdfHeight - headerHeight - footerHeight - margin;
      const usableWidth = pdfWidth - (margin * 2);
      
      // Clean header with logo - proper aspect ratio
      const logoHeight = 12;
      const logoWidth = 24; // 2:1 aspect ratio for typical logo
      try {
        if (reportLogo) pdf.addImage(reportLogo, "PNG", margin, 6, logoWidth, logoHeight);
      } catch (e) {}
      
      // Report title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Logistics Report", margin + logoWidth + 6, 12);
      
      // Subtitle info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${pendingLoadLists.length} pending, ${completedLoadLists.length} completed`, margin + logoWidth + 6, 19);
      
      // Generated date on the right
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth - margin, 19, { align: "right" });
      
      // Draw a simple line under header
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, 24, pdfWidth - margin, 24);
      
      pdf.setTextColor(0, 0, 0);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const imgRatio = imgWidth / imgHeight;
      let scaledWidth = usableWidth;
      let scaledHeight = scaledWidth / imgRatio;
      
      if (scaledHeight > usableHeight) {
        scaledHeight = usableHeight;
        scaledWidth = scaledHeight * imgRatio;
      }
      
      const imgX = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(imgData, "PNG", imgX, headerHeight, scaledWidth, scaledHeight);
      
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.line(0, pdfHeight - footerHeight, pdfWidth, pdfHeight - footerHeight);
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${companyName} - Confidential`, margin, pdfHeight - 5);
      pdf.text("Page 1 of 1", pdfWidth - margin, pdfHeight - 5, { align: "right" });
      
      pdf.save(`LTE-Logistics-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (loadListsLoading) {
    return (
      <div className="space-y-6">
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

  const filteredLoadLists = loadLists?.filter(ll => {
    if (factoryFilter !== "all" && ll.factory !== factoryFilter) {
      return false;
    }
    return true;
  }) || [];
  const pendingLoadLists = filteredLoadLists.filter(ll => ll.status === "PENDING");
  const completedLoadLists = filteredLoadLists.filter(ll => ll.status === "COMPLETE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Truck className="h-6 w-6" />
            Logistics
          </h1>
            <PageHelpButton pageHelpKey="page.logistics" />
          </div>
          <p className="text-muted-foreground">
            Manage load lists and track deliveries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
            <SelectTrigger className="w-36" data-testid="select-factory-filter">
              <SelectValue placeholder="Factory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Factories</SelectItem>
              <SelectItem value="QLD">QLD</SelectItem>
              <SelectItem value="VIC">Victoria</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            onClick={exportToPDF} 
            disabled={isExporting || loadListsLoading}
            data-testid="button-export-pdf"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-load-list">
            <Plus className="h-4 w-4 mr-2" />
            Create Load List
          </Button>
        </div>
      </div>

      <Card data-testid="card-ready-to-load">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 cursor-pointer" onClick={() => setReadyPanelsExpanded(!readyPanelsExpanded)}>
              {readyPanelsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Layers className="h-5 w-5" />
              Panels Ready to Load ({filteredReadyPanels.length})
            </CardTitle>
            {selectedReadyPanels.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-selected-count">{selectedReadyPanels.size} selected</Badge>
                <Button
                  onClick={handleCreateFromReady}
                  disabled={createLoadListFromReady.isPending}
                  data-testid="button-create-from-ready"
                >
                  {createLoadListFromReady.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Loading List
                </Button>
              </div>
            )}
          </div>
          <CardDescription>Completed panels approved for production that are not yet on a load list</CardDescription>
        </CardHeader>
        {readyPanelsExpanded && (
          <CardContent>
            {readyPanelsError ? (
              <p className="text-destructive text-center py-8" data-testid="text-ready-panels-error">Failed to load panels. Please try refreshing the page.</p>
            ) : readyPanelsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filteredReadyPanels.length === 0 ? (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-ready-panels">No panels ready to load</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredReadyPanels.length > 0 && selectedReadyPanels.size === filteredReadyPanels.length}
                          onCheckedChange={toggleAllReadyPanels}
                          data-testid="checkbox-select-all-ready"
                        />
                      </TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Panel Mark</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-center w-12">Qty</TableHead>
                      <TableHead className="text-right w-24">Width (mm)</TableHead>
                      <TableHead className="text-right w-24">Height (mm)</TableHead>
                      <TableHead className="text-right w-20">Area (m²)</TableHead>
                      <TableHead className="text-right w-20">Vol (m³)</TableHead>
                      <TableHead className="text-right w-24">Weight (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReadyPanels.map(panel => {
                      const typeColor = getPanelTypeColor(panel.panelType);
                      return (
                        <TableRow
                          key={panel.id}
                          data-testid={`row-ready-panel-${panel.id}`}
                          className="cursor-pointer"
                          style={typeColor ? {
                            backgroundColor: `${typeColor}15`,
                          } : undefined}
                          onClick={() => toggleReadyPanel(panel.id)}
                        >
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedReadyPanels.has(panel.id)}
                              onCheckedChange={() => toggleReadyPanel(panel.id)}
                              data-testid={`checkbox-ready-${panel.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-sm font-mono" data-testid={`cell-job-${panel.id}`}>
                            {panel.job.jobNumber}
                          </TableCell>
                          <TableCell data-testid={`cell-mark-${panel.id}`}>
                            <div className="flex items-center gap-2">
                              {typeColor && (
                                <span className="w-2 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: typeColor }} />
                              )}
                              <span className="font-mono font-medium">{panel.panelMark}</span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-type-${panel.id}`}>
                            {typeColor ? (
                              <Badge variant="outline" className="text-xs" style={{ borderColor: typeColor, color: typeColor }}>
                                {panel.panelType}
                              </Badge>
                            ) : (
                              <span className="text-sm">{panel.panelType}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`cell-building-${panel.id}`}>{panel.building || "-"}</TableCell>
                          <TableCell className="text-sm" data-testid={`cell-level-${panel.id}`}>{panel.level || "-"}</TableCell>
                          <TableCell className="text-center" data-testid={`cell-qty-${panel.id}`}>{panel.qty || 1}</TableCell>
                          <TableCell className="text-right font-mono text-xs" data-testid={`cell-width-${panel.id}`}>
                            {panel.loadWidth ? parseFloat(panel.loadWidth).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs" data-testid={`cell-height-${panel.id}`}>
                            {panel.loadHeight ? parseFloat(panel.loadHeight).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs" data-testid={`cell-area-${panel.id}`}>
                            {panel.panelArea ? parseFloat(panel.panelArea).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs" data-testid={`cell-volume-${panel.id}`}>
                            {panel.panelVolume ? parseFloat(panel.panelVolume).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold" data-testid={`cell-weight-${panel.id}`}>
                            {panel.panelMass ? `${parseFloat(panel.panelMass).toLocaleString()}` : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div ref={reportRef} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Load Lists ({pendingLoadLists.length})
            </CardTitle>
            <CardDescription>Load lists awaiting delivery</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingLoadLists.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending load lists</p>
            ) : (
              <div className="space-y-4">
                {pendingLoadLists.map((loadList) => (
                  <Card key={loadList.id} className="border" data-testid={`card-load-list-${loadList.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-0 h-6 w-6"
                              onClick={() => toggleExpanded(loadList.id)}
                              data-testid={`button-expand-${loadList.id}`}
                            >
                              {expandedLoadLists.has(loadList.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <h3 className="font-semibold">{loadList.job.jobNumber} - {loadList.job.name}</h3>
                            <Badge variant="outline">{loadList.panels.length} panels</Badge>
                            {loadList.trailerType && (
                              <Badge variant="secondary">{loadList.trailerType.name}</Badge>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                            {loadList.docketNumber && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                Docket: {loadList.docketNumber}
                              </span>
                            )}
                            {loadList.scheduledDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(loadList.scheduledDate).toLocaleDateString()}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              Mass: {calculateTotalMass(loadList.panels).toLocaleString()} kg
                            </span>
                            {loadList.job.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {loadList.job.address}
                              </span>
                            )}
                          </div>
                          {loadList.job.siteContact && (
                            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {loadList.job.siteContact}
                              </span>
                              {loadList.job.siteContactPhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {loadList.job.siteContactPhone}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printAllQrCodes(loadList)}
                            disabled={loadList.panels.length === 0}
                            title="Print all QR codes for panels on this load"
                            data-testid={`button-print-qr-${loadList.id}`}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Print QR
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openDeliveryDialog(loadList)}
                            data-testid={`button-record-delivery-${loadList.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Record Delivery
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setDeletingId(loadList.id); setDeleteDialogOpen(true); }}
                            data-testid={`button-delete-${loadList.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      
                      {expandedLoadLists.has(loadList.id) && loadList.panels.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="text-sm font-medium mb-2">Panels on this load:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {loadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => (
                              <Badge key={lp.id} variant="outline" className="justify-between">
                                <span>{lp.panel.panelMark}</span>
                                <span className="text-muted-foreground ml-2">
                                  {lp.panel.panelMass ? `${parseFloat(lp.panel.panelMass).toLocaleString()} kg` : ""}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Completed Deliveries ({completedLoadLists.length})
            </CardTitle>
            <CardDescription>Load lists that have been delivered</CardDescription>
          </CardHeader>
          <CardContent>
            {completedLoadLists.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No completed deliveries</p>
            ) : (
              <div className="space-y-4">
                {completedLoadLists.map((loadList) => (
                  <Card key={loadList.id} className="border bg-muted/30" data-testid={`card-load-list-complete-${loadList.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-0 h-6 w-6"
                              onClick={() => toggleExpanded(loadList.id)}
                              data-testid={`button-expand-complete-${loadList.id}`}
                            >
                              {expandedLoadLists.has(loadList.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <h3 className="font-semibold">{loadList.job.jobNumber} - {loadList.job.name}</h3>
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Delivered
                            </Badge>
                            <Badge variant="outline">{loadList.panels.length} panels</Badge>
                          </div>
                          {loadList.deliveryRecord && (
                            <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                              {loadList.deliveryRecord.truckRego && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {loadList.deliveryRecord.truckRego}
                                </span>
                              )}
                              {loadList.deliveryRecord.loadDocumentNumber && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  Doc# {loadList.deliveryRecord.loadDocumentNumber}
                                </span>
                              )}
                              {loadList.deliveryRecord.deliveryDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {loadList.deliveryRecord.deliveryDate}
                                </span>
                              )}
                              {loadList.deliveryRecord.siteFirstLiftTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  First lift: {loadList.deliveryRecord.siteFirstLiftTime}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printAllQrCodes(loadList)}
                            data-testid={`button-print-qr-complete-${loadList.id}`}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Print QR
                          </Button>
                          {!loadList.loadReturn && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReturnDialog(loadList)}
                              data-testid={`button-return-load-${loadList.id}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Return Load
                            </Button>
                          )}
                          {loadList.loadReturn && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                              {loadList.loadReturn.returnType === "FULL" ? "Full Return" : `Partial Return (${loadList.loadReturn.panels.length} panels)`}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {expandedLoadLists.has(loadList.id) && loadList.panels.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="text-sm font-medium mb-2">Panels delivered:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {loadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => (
                              <Badge key={lp.id} variant="outline" className="justify-between">
                                <span>{lp.panel.panelMark}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Load List</DialogTitle>
            <DialogDescription>
              Select a job and choose panels to add to this load
            </DialogDescription>
          </DialogHeader>
          <Form {...loadListForm}>
            <form onSubmit={loadListForm.handleSubmit(handleCreateLoadList)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={loadListForm.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedJobId(value);
                          loadListForm.setValue("panelIds", []);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-job">
                            <SelectValue placeholder="Select job" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...(jobs?.filter(j => j.status === "ACTIVE" && isJobVisibleInDropdowns(String(j.jobPhase ?? "CONTRACTED") as any)) || [])].sort((a, b) => (a.jobNumber || a.name || '').localeCompare(b.jobNumber || b.name || '')).map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.jobNumber} - {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loadListForm.control}
                  name="trailerTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trailer Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-trailer-type">
                            <SelectValue placeholder="Select trailer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...(trailerTypes || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((tt) => (
                            <SelectItem key={tt.id} value={tt.id}>
                              {tt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loadListForm.control}
                  name="factory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Factory</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "QLD"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-factory">
                            <SelectValue placeholder="Select factory" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="QLD">QLD</SelectItem>
                          <SelectItem value="VIC">Victoria</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={loadListForm.control}
                  name="docketNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Docket Number</FormLabel>
                      <FormControl>
                        <Input placeholder="DOC-001" {...field} data-testid="input-docket-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loadListForm.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-scheduled-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={loadListForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Any special instructions..." {...field} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loadListForm.control}
                name="panelIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Panels ({field.value?.length || 0} selected)</FormLabel>
                    <ScrollArea className="h-48 border rounded-md p-2">
                      {filteredPanels.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          {watchedJobId ? "No approved panels for this job" : "Select a job to see available panels"}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredPanels.map((panel) => (
                            <div 
                              key={panel.id} 
                              className="flex items-center space-x-2 p-2 hover-elevate rounded-md"
                              data-testid={`panel-checkbox-${panel.id}`}
                            >
                              <Checkbox
                                id={panel.id}
                                checked={field.value?.includes(panel.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, panel.id]);
                                  } else {
                                    field.onChange(current.filter(id => id !== panel.id));
                                  }
                                }}
                              />
                              <label htmlFor={panel.id} className="flex-1 cursor-pointer flex items-center justify-between">
                                <span className="font-medium">{panel.panelMark}</span>
                                <span className="text-sm text-muted-foreground">
                                  {panel.panelType} · {panel.panelMass ? `${parseFloat(panel.panelMass).toLocaleString()} kg` : ""}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoadListMutation.isPending} data-testid="button-save-load-list">
                  {createLoadListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Load List
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle>Record Delivery</DialogTitle>
            <DialogDescription>
              {selectedLoadList && (
                <>
                  Enter delivery details for {selectedLoadList.job.jobNumber} - {selectedLoadList.job.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...deliveryForm}>
            <form onSubmit={deliveryForm.handleSubmit(handleCreateDelivery)} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 h-[65vh] pr-4">
                <div className="space-y-3 pb-4">
                  {/* Load Information - Always visible */}
                  <div className="space-y-3 p-3 rounded-md border bg-muted/30">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Load Information
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="loadDocumentNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Load Document #</FormLabel>
                            <FormControl>
                              <Input placeholder="LD-001" {...field} data-testid="input-load-document" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="loadNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Load Number</FormLabel>
                            <FormControl>
                              <Input placeholder="1" {...field} data-testid="input-load-number" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="deliveryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-delivery-date" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="numberPanels"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Panels</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0" {...field} value={field.value ?? ""} data-testid="input-number-panels" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="truckRego"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Truck Rego</FormLabel>
                            <FormControl>
                              <Input placeholder="ABC-123" {...field} data-testid="input-truck-rego" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="trailerRego"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Trailer Rego</FormLabel>
                            <FormControl>
                              <Input placeholder="XYZ-456" {...field} data-testid="input-trailer-rego" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="preload"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preload</FormLabel>
                            <FormControl>
                              <Input placeholder="Yes/No" {...field} data-testid="input-preload" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Depot to LTE - Collapsible */}
                  <Collapsible defaultOpen className="border rounded-md">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Depot to LTE
                      </h4>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={deliveryForm.control}
                          name="leaveDepotTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leave Depot (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-leave-depot" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deliveryForm.control}
                          name="arriveLteTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Arrive LTE (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-arrive-lte" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Pickup Location - Collapsible */}
                  <Collapsible defaultOpen className="border rounded-md">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Pickup Location
                      </h4>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0">
                      <div className="grid grid-cols-3 gap-3">
                        <FormField
                          control={deliveryForm.control}
                          name="pickupLocation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                <Input placeholder="Pickup location" {...field} data-testid="input-pickup-location" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deliveryForm.control}
                          name="pickupArriveTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Arrive (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-pickup-arrive" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deliveryForm.control}
                          name="pickupLeaveTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leave (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-pickup-leave" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Delivery Location (Holding) - Collapsible */}
                  <Collapsible defaultOpen className="border rounded-md">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Delivery Location (Holding)
                      </h4>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0">
                      <div className="grid grid-cols-3 gap-3">
                        <FormField
                          control={deliveryForm.control}
                          name="deliveryLocation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                <Input placeholder="Delivery location" {...field} data-testid="input-delivery-location" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deliveryForm.control}
                          name="arriveHoldingTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Arrive Holding (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-arrive-holding" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deliveryForm.control}
                          name="leaveHoldingTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leave Holding (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-leave-holding" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Unloading - Collapsible */}
                  <Collapsible defaultOpen className="border rounded-md">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Unloading
                      </h4>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={deliveryForm.control}
                          name="siteFirstLiftTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site First Lift (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-site-first-lift" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deliveryForm.control}
                          name="siteLastLiftTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site Last Lift / Leave (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-site-last-lift" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Return Depot - Collapsible */}
                  <Collapsible defaultOpen className="border rounded-md">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Return Depot / Reload
                      </h4>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={deliveryForm.control}
                          name="returnDepotArriveTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Arrive (time)</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} data-testid="input-return-depot-arrive" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Comment */}
                  <div className="space-y-2 p-3 rounded-md border">
                    <FormField
                      control={deliveryForm.control}
                      name="comment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comment</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Any delivery comments..." 
                              className="resize-none"
                              rows={2}
                              {...field} 
                              data-testid="input-delivery-comment" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="pt-4 border-t mt-2 flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDeliveryMutation.isPending} data-testid="button-save-delivery">
                  {createDeliveryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Complete Delivery
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDialogOpen} onOpenChange={(open) => { if (!open) resetReturnForm(); setReturnDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Return Load</DialogTitle>
            <DialogDescription>
              {returnLoadList && (
                <>Record a return for {returnLoadList.job.jobNumber} - {returnLoadList.job.name} ({returnLoadList.panels.length} panels)</>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 h-[60vh] pr-4">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Return Type</label>
                <RadioGroup value={returnType} onValueChange={(v) => { setReturnType(v as "FULL" | "PARTIAL"); setReturnPanelIds(new Set()); }} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="FULL" id="return-full" data-testid="radio-return-full" />
                    <Label htmlFor="return-full">Full Load Return</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PARTIAL" id="return-partial" data-testid="radio-return-partial" />
                    <Label htmlFor="return-partial">Partial Return</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Return *</label>
                <Textarea
                  placeholder="Enter reason for return..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-return-reason"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Return Date</label>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} data-testid="input-return-date" />
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Return Timestamps
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Left Factory</label>
                    <Input type="time" value={leftFactoryTime} onChange={(e) => setLeftFactoryTime(e.target.value)} data-testid="input-left-factory" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Arrived Factory</label>
                    <Input type="time" value={arrivedFactoryTime} onChange={(e) => setArrivedFactoryTime(e.target.value)} data-testid="input-arrived-factory" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Unloaded at Factory</label>
                    <Input type="time" value={unloadedAtFactoryTime} onChange={(e) => setUnloadedAtFactoryTime(e.target.value)} data-testid="input-unloaded-factory" />
                  </div>
                </div>
              </div>

              {returnType === "PARTIAL" && returnLoadList && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Panels to Return ({returnPanelIds.size} selected)</label>
                  <ScrollArea className="h-48 border rounded-md p-2">
                    <div className="space-y-2">
                      {returnLoadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => (
                        <div key={lp.id} className="flex items-center space-x-2 p-2 hover-elevate rounded-md" data-testid={`return-panel-${lp.panel.id}`}>
                          <Checkbox
                            id={`return-${lp.panel.id}`}
                            checked={returnPanelIds.has(lp.panel.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(returnPanelIds);
                              if (checked) { newSet.add(lp.panel.id); } else { newSet.delete(lp.panel.id); }
                              setReturnPanelIds(newSet);
                            }}
                          />
                          <label htmlFor={`return-${lp.panel.id}`} className="flex-1 cursor-pointer flex items-center justify-between">
                            <span className="font-medium">{lp.panel.panelMark}</span>
                            <span className="text-sm text-muted-foreground">
                              {lp.panel.panelType} {lp.panel.panelMass ? `· ${parseFloat(lp.panel.panelMass).toLocaleString()} kg` : ""}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Any additional notes..." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} data-testid="input-return-notes" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetReturnForm(); setReturnDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSubmitReturn} disabled={createReturnMutation.isPending} data-testid="button-submit-return">
              {createReturnMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Load List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this load list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteLoadListMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
