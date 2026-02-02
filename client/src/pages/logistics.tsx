import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import lteLogo from "@/assets/lte-logo.png";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Job, PanelRegister, TrailerType } from "@shared/schema";

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
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedLoadList, setSelectedLoadList] = useState<LoadListWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedLoadLists, setExpandedLoadLists] = useState<Set<string>>(new Set());
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: loadLists, isLoading: loadListsLoading } = useQuery<LoadListWithDetails[]>({
    queryKey: ["/api/load-lists"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const { data: trailerTypes } = useQuery<TrailerType[]>({
    queryKey: ["/api/trailer-types"],
  });

  const { data: approvedPanels } = useQuery<(PanelRegister & { job: Job })[]>({
    queryKey: ["/api/panels/approved-for-production", selectedJobId],
    queryFn: async () => {
      const url = selectedJobId 
        ? `/api/panels/approved-for-production?jobId=${selectedJobId}`
        : "/api/panels/approved-for-production";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch panels");
      return res.json();
    },
    enabled: createDialogOpen,
  });

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
      return apiRequest("POST", "/api/load-lists", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-lists"] });
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
      return apiRequest("DELETE", `/api/load-lists/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-lists"] });
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
      return apiRequest("POST", `/api/load-lists/${loadListId}/delivery`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-lists"] });
      toast({ title: "Delivery record created successfully" });
      setDeliveryDialogOpen(false);
      deliveryForm.reset();
      setSelectedLoadList(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create delivery record", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateLoadList = (data: LoadListFormData) => {
    createLoadListMutation.mutate(data);
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

  const watchedJobId = loadListForm.watch("jobId");

  const filteredPanels = approvedPanels?.filter(p => 
    !watchedJobId || watchedJobId === "" || p.jobId === watchedJobId
  ) || [];

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
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
      
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pdfWidth, 28, "F");
      
      const logoSize = 18;
      try {
        pdf.addImage(lteLogo, "PNG", margin, 5, logoSize, logoSize);
      } catch (e) {}
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("LTE Logistics Report", margin + logoSize + 8, 14);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${pendingLoadLists.length} pending, ${completedLoadLists.length} completed`, margin + logoSize + 8, 21);
      
      pdf.setFontSize(9);
      pdf.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pdfWidth - margin, 14, { align: "right" });
      
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
      pdf.text("LTE Precast Concrete - Confidential", margin, pdfHeight - 5);
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Truck className="h-6 w-6" />
            Logistics
          </h1>
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
                          {jobs?.filter(j => j.status === "ACTIVE").map((job) => (
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
                          {trailerTypes?.map((tt) => (
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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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
              <ScrollArea className="flex-1 h-[50vh] pr-4">
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
