import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO, addDays } from "date-fns";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, apiUpload } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, CalendarIcon, Printer, Send, Check, X, Save, AlertTriangle, Search, Building2, Upload, FileText, Download, Paperclip, PackageCheck, Loader2 } from "lucide-react";
import type { Supplier, Item, PurchaseOrder, PurchaseOrderItem, User, Job, PurchaseOrderAttachment } from "@shared/schema";
import { PROCUREMENT_ROUTES, JOBS_ROUTES, SETTINGS_ROUTES, PO_ATTACHMENTS_ROUTES } from "@shared/api-routes";
import { ItemPickerDialog } from "@/components/ItemPickerDialog";

function compressLogoForPdf(logoBase64: string, maxWidth = 200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(logoBase64); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(logoBase64);
    img.src = logoBase64;
  });
}

interface AttachmentWithUser extends PurchaseOrderAttachment {
  uploadedBy?: User | null;
}

interface LineItem {
  id: string;
  itemId: string | null;
  itemCode: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
  lineTotal: string;
  jobId: string | null;
  jobNumber?: string;
}

interface PurchaseOrderWithDetails extends PurchaseOrder {
  requestedBy: User;
  approvedBy?: User | null;
  rejectedBy?: User | null;
  items: PurchaseOrderItem[];
}

const MANUAL_ENTRY_ID = "MANUAL_ENTRY";

const formSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  supplierContact: z.string().optional(),
  supplierEmail: z.string().email().optional().or(z.literal("")),
  supplierPhone: z.string().optional(),
  supplierAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  requiredByDate: z.date().optional().nullable(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PurchaseOrderFormPage() {
  const [, params] = useRoute("/purchase-orders/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isNew = params?.id === "new";
  const poId = isNew ? null : params?.id;

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState("");
  const [selectedLineIdForJob, setSelectedLineIdForJob] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [receivingMode, setReceivingMode] = useState(false);
  const [receivedItemIds, setReceivedItemIds] = useState<Set<string>>(new Set());
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerLineId, setItemPickerLineId] = useState<string | null>(null);

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<Item[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEMS_ACTIVE],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const filteredJobs = useMemo(() => {
    if (!jobSearchTerm.trim()) return jobs;
    const term = jobSearchTerm.toLowerCase();
    return jobs.filter(job => 
      job.jobNumber.toLowerCase().includes(term) ||
      job.name.toLowerCase().includes(term) ||
      job.client?.toLowerCase().includes(term)
    );
  }, [jobs, jobSearchTerm]);

  const { data: settings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  const { data: poTermsSettings } = useQuery<{ poTermsHtml: string; includePOTerms: boolean }>({
    queryKey: [SETTINGS_ROUTES.PO_TERMS],
  });

  const { data: existingPO, isLoading: loadingPO } = useQuery<PurchaseOrderWithDetails>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId],
    enabled: !!poId,
  });

  const { data: attachments = [], isLoading: loadingAttachments } = useQuery<AttachmentWithUser[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId, "attachments"],
    enabled: !!poId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: "",
      supplierName: "",
      supplierContact: "",
      supplierEmail: "",
      supplierPhone: "",
      supplierAddress: "",
      deliveryAddress: "",
      requiredByDate: isNew ? addDays(new Date(), 7) : null,
      notes: "",
    },
  });

  useEffect(() => {
    if (existingPO) {
      form.reset({
        supplierId: existingPO.supplierId || "",
        supplierName: existingPO.supplierName || "",
        supplierContact: existingPO.supplierContact || "",
        supplierEmail: existingPO.supplierEmail || "",
        supplierPhone: existingPO.supplierPhone || "",
        supplierAddress: existingPO.supplierAddress || "",
        deliveryAddress: existingPO.deliveryAddress || "",
        requiredByDate: existingPO.requiredByDate ? new Date(existingPO.requiredByDate) : null,
        notes: existingPO.notes || "",
      });
      
      const mappedItems: LineItem[] = existingPO.items.map((item, index) => ({
        id: item.id || `existing-${index}`,
        itemId: item.itemId || null,
        itemCode: item.itemCode || "",
        description: item.description || "",
        quantity: item.quantity?.toString() || "1",
        unitOfMeasure: item.unitOfMeasure || "EA",
        unitPrice: item.unitPrice?.toString() || "0",
        lineTotal: item.lineTotal?.toString() || "0",
        jobId: (item as any).jobId || null,
        jobNumber: (item as any).jobNumber || "",
      }));
      setLineItems(mappedItems);
    }
  }, [existingPO, form]);

  const createMutation = useMutation({
    mutationFn: async (data: { po: FormValues; items: LineItem[] }) => {
      const response = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDERS, {
        ...data.po,
        requiredByDate: data.po.requiredByDate?.toISOString(),
        items: data.items.map((item, index) => ({
          itemId: item.itemId === MANUAL_ENTRY_ID ? null : item.itemId,
          itemCode: item.itemCode,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unitOfMeasure: item.unitOfMeasure,
          unitPrice: parseFloat(item.unitPrice) || 0,
          lineTotal: parseFloat(item.lineTotal) || 0,
          sortOrder: index,
        })),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      toast({ title: "Purchase order created successfully" });
      navigate(`/purchase-orders/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { po: FormValues; items: LineItem[] }) => {
      const response = await apiRequest("PATCH", PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(poId!), {
        ...data.po,
        requiredByDate: data.po.requiredByDate?.toISOString(),
        items: data.items.map((item, index) => ({
          itemId: item.itemId === MANUAL_ENTRY_ID ? null : item.itemId,
          itemCode: item.itemCode,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unitOfMeasure: item.unitOfMeasure,
          unitPrice: parseFloat(item.unitPrice) || 0,
          lineTotal: parseFloat(item.lineTotal) || 0,
          sortOrder: index,
        })),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId] });
      toast({ title: "Purchase order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (overrideId?: string) => {
      const targetId = overrideId || poId;
      if (!targetId) throw new Error("Purchase order ID is required");
      const response = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_SUBMIT(targetId));
      return response.json();
    },
    onSuccess: (_data, overrideId) => {
      const targetId = overrideId || poId;
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, targetId] });
      toast({ title: "Purchase order submitted for approval" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_APPROVE(poId!));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId] });
      toast({ title: "Purchase order approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_REJECT(poId!), { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId] });
      setShowRejectDialog(false);
      toast({ title: "Purchase order rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(poId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      toast({ title: "Purchase order deleted" });
      navigate("/purchase-orders");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_RECEIVE(poId!), { receivedItemIds: itemIds });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId] });
      setReceivingMode(false);
      toast({ title: "Items received successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (existingPO?.items) {
      const alreadyReceived = new Set(
        existingPO.items.filter((item: any) => item.received).map((item: any) => item.id)
      );
      setReceivedItemIds(alreadyReceived);
    }
  }, [existingPO?.items]);

  const toggleReceiveItem = useCallback((itemId: string) => {
    setReceivedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleReceiveItems = useCallback(() => {
    if (!receivingMode) {
      setReceivingMode(true);
      return;
    }
    receiveMutation.mutate(Array.from(receivedItemIds));
  }, [receivingMode, receivedItemIds, receiveMutation]);

  const cancelReceiving = useCallback(() => {
    setReceivingMode(false);
    if (existingPO?.items) {
      const alreadyReceived = new Set(
        existingPO.items.filter((item: any) => item.received).map((item: any) => item.id)
      );
      setReceivedItemIds(alreadyReceived);
    }
  }, [existingPO?.items]);

  const canReceive = existingPO?.status === "APPROVED" || existingPO?.status === "RECEIVED_IN_PART";

  const uploadAttachmentsMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      const response = await apiUpload(PROCUREMENT_ROUTES.PURCHASE_ORDER_ATTACHMENTS(poId!), formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId, "attachments"] });
      toast({ title: "Files uploaded successfully" });
      setUploadingFiles(false);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploadingFiles(false);
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", PO_ATTACHMENTS_ROUTES.BY_ID(attachmentId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId, "attachments"] });
      toast({ title: "Attachment deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && poId) {
      setUploadingFiles(true);
      uploadAttachmentsMutation.mutate(files);
    }
  }, [poId, uploadAttachmentsMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && poId) {
      setUploadingFiles(true);
      uploadAttachmentsMutation.mutate(files);
    }
    e.target.value = "";
  }, [poId, uploadAttachmentsMutation]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSupplierChange = useCallback((supplierId: string) => {
    form.setValue("supplierId", supplierId, { shouldDirty: true });
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      form.setValue("supplierName", supplier.name || "", { shouldDirty: true });
      form.setValue("supplierContact", supplier.keyContact || "", { shouldDirty: true });
      form.setValue("supplierEmail", supplier.email || "", { shouldDirty: true });
      form.setValue("supplierPhone", supplier.phone || "", { shouldDirty: true });
      const addressParts = [
        supplier.addressLine1,
        supplier.addressLine2,
        supplier.city,
        supplier.state,
        supplier.postcode,
        supplier.country,
      ].filter(Boolean);
      form.setValue("supplierAddress", addressParts.join(", "), { shouldDirty: true });
    }
  }, [suppliers, form]);

  const addLineItem = useCallback(() => {
    const newItem: LineItem = {
      id: `new-${Date.now()}`,
      itemId: null,
      itemCode: "",
      description: "",
      quantity: "1",
      unitOfMeasure: "EA",
      unitPrice: "0.00",
      lineTotal: "0.00",
      jobId: null,
      jobNumber: "",
    };
    setLineItems(prev => [...prev, newItem]);
  }, []);

  const openJobSelector = useCallback((lineId: string) => {
    setSelectedLineIdForJob(lineId);
    setJobSearchTerm("");
    setShowJobDialog(true);
  }, []);

  const handleJobSelect = useCallback((job: Job) => {
    if (selectedLineIdForJob) {
      setLineItems(prev => prev.map(line => {
        if (line.id !== selectedLineIdForJob) return line;
        return { ...line, jobId: job.id, jobNumber: job.jobNumber };
      }));
    }
    setShowJobDialog(false);
    setSelectedLineIdForJob(null);
  }, [selectedLineIdForJob]);

  const clearJobFromLine = useCallback((lineId: string) => {
    setLineItems(prev => prev.map(line => {
      if (line.id !== lineId) return line;
      return { ...line, jobId: null, jobNumber: "" };
    }));
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === "quantity" || field === "unitPrice") {
        const qty = parseFloat(updated.quantity) || 0;
        const price = parseFloat(updated.unitPrice) || 0;
        updated.lineTotal = (qty * price).toFixed(2);
      }
      
      return updated;
    }));
  }, []);

  const handleItemSelect = useCallback((lineId: string, itemId: string) => {
    if (itemId === MANUAL_ENTRY_ID) {
      setLineItems(prev => prev.map(line => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          itemId: MANUAL_ENTRY_ID,
          itemCode: "",
          description: "",
          unitOfMeasure: "EA",
          unitPrice: "0.00",
          lineTotal: (parseFloat(line.quantity) * 0).toFixed(2),
        };
      }));
      return;
    }

    const selectedItem = items.find(i => i.id === itemId);
    if (!selectedItem) return;

    setLineItems(prev => prev.map(line => {
      if (line.id !== lineId) return line;
      const qty = parseFloat(line.quantity) || 1;
      const price = parseFloat(selectedItem.unitPrice?.toString() || "0");
      return {
        ...line,
        itemId: selectedItem.id,
        itemCode: selectedItem.code || "",
        description: selectedItem.name || "",
        unitOfMeasure: selectedItem.unitOfMeasure || "EA",
        unitPrice: price.toFixed(2),
        lineTotal: (qty * price).toFixed(2),
      };
    }));
  }, [items]);

  const openItemPicker = useCallback((lineId: string) => {
    setItemPickerLineId(lineId);
    setItemPickerOpen(true);
  }, []);

  const handleItemPickerSelect = useCallback((itemId: string) => {
    if (itemPickerLineId) {
      handleItemSelect(itemPickerLineId, itemId);
    }
    setItemPickerLineId(null);
  }, [itemPickerLineId, handleItemSelect]);

  const { subtotal, tax, total } = useMemo(() => {
    const sub = lineItems.reduce((sum, item) => sum + (parseFloat(item.lineTotal) || 0), 0);
    const taxAmount = sub * 0.10;
    return {
      subtotal: sub,
      tax: taxAmount,
      total: sub + taxAmount,
    };
  }, [lineItems]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleSave = () => {
    const formData = form.getValues();
    if (isNew) {
      createMutation.mutate({ po: formData, items: lineItems });
    } else {
      updateMutation.mutate({ po: formData, items: lineItems });
    }
  };

  const handleSubmit = async () => {
    const formData = form.getValues();
    if (isNew) {
      createMutation.mutate({ po: formData, items: lineItems }, {
        onSuccess: (data) => {
          submitMutation.mutate(data.id);
        },
      });
    } else {
      await updateMutation.mutateAsync({ po: formData, items: lineItems });
      submitMutation.mutate();
    }
  };

  const handlePrint = useCallback(async () => {
    if (!existingPO) return;
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let currentY = margin;
    
    const checkPageBreak = (requiredHeight: number) => {
      if (currentY + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
        return true;
      }
      return false;
    };
    
    let headerTextX = margin;
    const logoHeight = 20;
    
    if (settings?.logoBase64) {
      try {
        const compressedLogo = await compressLogoForPdf(settings.logoBase64);
        const fmt = compressedLogo.includes("image/jpeg") ? "JPEG" : "PNG";
        pdf.addImage(compressedLogo, fmt, margin, 5, 25, logoHeight);
        headerTextX = margin + 30;
      } catch (e) {
        // skip logo
      }
    }
    
    // Company name
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(settings?.companyName || "LTE Precast Concrete Structures", headerTextX, 12);
    
    // Purchase Order title
    pdf.setFontSize(20);
    pdf.setTextColor(107, 114, 128);
    pdf.text("PURCHASE ORDER", headerTextX, 22);
    
    // PO Number box on right side
    pdf.setFillColor(249, 250, 251);
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(pageWidth - margin - 55, 5, 55, 22, 2, 2, "FD");
    pdf.setTextColor(107, 114, 128);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("PO Number", pageWidth - margin - 50, 12);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(existingPO.poNumber || "", pageWidth - margin - 50, 21);
    
    // Add a subtle line separator below header
    pdf.setDrawColor(229, 231, 235);
    pdf.line(margin, 32, pageWidth - margin, 32);
    
    currentY = 40;
    
    // Status badge
    const statusColors: Record<string, { bg: number[]; text: number[] }> = {
      DRAFT: { bg: [156, 163, 175], text: [255, 255, 255] },
      SUBMITTED: { bg: [59, 130, 246], text: [255, 255, 255] },
      APPROVED: { bg: [34, 197, 94], text: [255, 255, 255] },
      REJECTED: { bg: [239, 68, 68], text: [255, 255, 255] },
      RECEIVED: { bg: [4, 120, 87], text: [255, 255, 255] },
      RECEIVED_IN_PART: { bg: [217, 119, 6], text: [255, 255, 255] },
    };
    const statusStyle = statusColors[existingPO.status] || statusColors.DRAFT;
    pdf.setFillColor(statusStyle.bg[0], statusStyle.bg[1], statusStyle.bg[2]);
    const statusLabels: Record<string, string> = {
      SUBMITTED: "Submitted - Pending Approval",
      RECEIVED_IN_PART: "Received in Part",
    };
    const statusText = statusLabels[existingPO.status] || existingPO.status.charAt(0) + existingPO.status.slice(1).toLowerCase();
    const statusWidth = pdf.getTextWidth(statusText) + 8;
    pdf.roundedRect(margin, currentY, statusWidth, 7, 1.5, 1.5, "F");
    pdf.setTextColor(statusStyle.text[0], statusStyle.text[1], statusStyle.text[2]);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(statusText, margin + 4, currentY + 5);
    
    // Date on right
    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date: ${format(new Date(existingPO.createdAt), "dd MMMM yyyy")}`, pageWidth - margin - 40, currentY + 5);
    
    currentY += 15;
    
    // Two column layout for supplier and delivery info
    const colWidth = (contentWidth - 10) / 2;
    
    // Supplier details box
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(margin, currentY, colWidth, 45, 2, 2, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(margin, currentY, colWidth, 45, 2, 2, "S");
    
    pdf.setTextColor(75, 85, 99);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("SUPPLIER", margin + 5, currentY + 8);
    
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(11);
    pdf.text(existingPO.supplierName || "-", margin + 5, currentY + 16);
    
    pdf.setTextColor(107, 114, 128);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    let supplierY = currentY + 23;
    if (existingPO.supplierContact) {
      pdf.text(existingPO.supplierContact, margin + 5, supplierY);
      supplierY += 5;
    }
    if (existingPO.supplierPhone) {
      pdf.text(existingPO.supplierPhone, margin + 5, supplierY);
      supplierY += 5;
    }
    if (existingPO.supplierEmail) {
      pdf.text(existingPO.supplierEmail, margin + 5, supplierY);
      supplierY += 5;
    }
    
    // Delivery details box
    const rightColX = margin + colWidth + 10;
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(rightColX, currentY, colWidth, 45, 2, 2, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(rightColX, currentY, colWidth, 45, 2, 2, "S");
    
    pdf.setTextColor(75, 85, 99);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("DELIVER TO", rightColX + 5, currentY + 8);
    
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const deliveryAddress = existingPO.deliveryAddress || "-";
    const deliveryLines = pdf.splitTextToSize(deliveryAddress, colWidth - 10);
    pdf.text(deliveryLines, rightColX + 5, currentY + 16);
    
    if (existingPO.requiredByDate) {
      pdf.setTextColor(239, 68, 68);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Required by: ${format(new Date(existingPO.requiredByDate), "dd/MM/yyyy")}`, rightColX + 5, currentY + 38);
    }
    
    currentY += 55;
    
    // Line items table
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("ORDER ITEMS", margin, currentY);
    currentY += 8;
    
    // Table header
    const tableColWidths = [15, 25, 70, 18, 18, 22, 22]; // #, Code, Description, Qty, UoM, Unit Price, Total
    const tableHeaders = ["#", "Code", "Description", "Qty", "UoM", "Unit $", "Total $"];
    
    // Helper function to draw table headers
    const drawTableHeaders = () => {
      pdf.setFillColor(75, 85, 99);
      pdf.rect(margin, currentY, contentWidth, 8, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      
      let headerX = margin;
      tableHeaders.forEach((header, i) => {
        const align = i >= 3 ? "right" : "left";
        if (align === "right") {
          pdf.text(header, headerX + tableColWidths[i] - 2, currentY + 5.5, { align: "right" });
        } else {
          pdf.text(header, headerX + 2, currentY + 5.5);
        }
        headerX += tableColWidths[i];
      });
      
      currentY += 8;
    };
    
    // Draw initial table headers
    drawTableHeaders();
    
    // Table rows
    const rowHeight = 7;
    let rowsOnCurrentPage = 0;
    
    lineItems.forEach((item, index) => {
      // Check for page break and re-draw headers if needed
      if (currentY + rowHeight > pageHeight - margin - 15) {
        pdf.addPage();
        currentY = margin + 10;
        
        // Draw continuation header
        pdf.setTextColor(107, 114, 128);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "italic");
        pdf.text(`${existingPO.poNumber} - Order Items (continued)`, margin, currentY);
        currentY += 8;
        
        // Re-draw table headers
        drawTableHeaders();
        rowsOnCurrentPage = 0;
      }
      
      // Alternate row colors (reset for each page)
      if (rowsOnCurrentPage % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY, contentWidth, rowHeight, "F");
      }
      
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      
      let rowX = margin;
      const rowData = [
        String(index + 1),
        item.itemCode || "-",
        item.description.length > 40 ? item.description.substring(0, 38) + "..." : item.description,
        item.quantity,
        item.unitOfMeasure || "-",
        parseFloat(item.unitPrice || "0").toFixed(2),
        parseFloat(item.lineTotal || "0").toFixed(2),
      ];
      
      rowData.forEach((data, i) => {
        const align = i >= 3 ? "right" : "left";
        if (align === "right") {
          pdf.text(data, rowX + tableColWidths[i] - 2, currentY + 5, { align: "right" });
        } else {
          pdf.text(data, rowX + 2, currentY + 5);
        }
        rowX += tableColWidths[i];
      });
      
      // Draw bottom border
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);
      
      currentY += rowHeight;
      rowsOnCurrentPage++;
    });
    
    currentY += 5;
    
    // Totals section
    const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.lineTotal) || 0), 0);
    const gst = subtotal * 0.1;
    const total = subtotal + gst;
    
    // Totals box on right
    const totalsWidth = 70;
    const totalsX = pageWidth - margin - totalsWidth;
    
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(totalsX, currentY, totalsWidth, 28, 2, 2, "F");
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text("Subtotal:", totalsX + 5, currentY + 7);
    pdf.text("GST (10%):", totalsX + 5, currentY + 14);
    
    pdf.setTextColor(31, 41, 55);
    pdf.text(`$${subtotal.toFixed(2)}`, totalsX + totalsWidth - 5, currentY + 7, { align: "right" });
    pdf.text(`$${gst.toFixed(2)}`, totalsX + totalsWidth - 5, currentY + 14, { align: "right" });
    
    // Total line
    pdf.setDrawColor(75, 85, 99);
    pdf.setLineWidth(0.5);
    pdf.line(totalsX + 5, currentY + 17, totalsX + totalsWidth - 5, currentY + 17);
    
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text("TOTAL:", totalsX + 5, currentY + 24);
    pdf.text(`$${total.toFixed(2)}`, totalsX + totalsWidth - 5, currentY + 24, { align: "right" });
    
    currentY += 35;
    
    // Notes section if present
    if (existingPO.notes) {
      checkPageBreak(25);
      
      pdf.setFillColor(254, 249, 195); // Light yellow
      pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "F");
      pdf.setDrawColor(250, 204, 21);
      pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "S");
      
      pdf.setTextColor(133, 77, 14);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("NOTES:", margin + 5, currentY + 6);
      
      pdf.setFont("helvetica", "normal");
      const notesLines = pdf.splitTextToSize(existingPO.notes, contentWidth - 10);
      pdf.text(notesLines.slice(0, 2), margin + 5, currentY + 12);
      
      currentY += 25;
    }
    
    // Approval information
    if (existingPO.status === "APPROVED" && existingPO.approvedBy) {
      checkPageBreak(20);
      
      pdf.setFillColor(220, 252, 231);
      pdf.roundedRect(margin, currentY, contentWidth, 15, 2, 2, "F");
      
      pdf.setTextColor(22, 101, 52);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("APPROVED", margin + 5, currentY + 6);
      
      pdf.setFont("helvetica", "normal");
      const approvedByName = existingPO.approvedBy.name || existingPO.approvedBy.email;
      const approvedDate = existingPO.approvedAt ? format(new Date(existingPO.approvedAt), "dd/MM/yyyy HH:mm") : "";
      pdf.text(`By: ${approvedByName}  |  Date: ${approvedDate}`, margin + 5, currentY + 11);
    }
    
    if (existingPO.status === "REJECTED") {
      checkPageBreak(25);
      
      pdf.setFillColor(254, 226, 226);
      pdf.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "F");
      
      pdf.setTextColor(153, 27, 27);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("REJECTED", margin + 5, currentY + 6);
      
      pdf.setFont("helvetica", "normal");
      if (existingPO.rejectionReason) {
        const reasonLines = pdf.splitTextToSize(`Reason: ${existingPO.rejectionReason}`, contentWidth - 10);
        pdf.text(reasonLines.slice(0, 2), margin + 5, currentY + 12);
      }
    }
    
    // Terms and Conditions section
    if (poTermsSettings?.includePOTerms && poTermsSettings?.poTermsHtml) {
      checkPageBreak(20);
      
      currentY += 5;
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;
      
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("TERMS AND CONDITIONS", margin, currentY);
      currentY += 7;
      
      const termsText = poTermsSettings.poTermsHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li>/gi, "  - ")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      
      pdf.setTextColor(75, 85, 99);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      
      const termsLines = pdf.splitTextToSize(termsText, contentWidth);
      const lineHeight = 3.5;
      
      for (let i = 0; i < termsLines.length; i++) {
        if (currentY + lineHeight > pageHeight - margin - 15) {
          pdf.addPage();
          currentY = margin + 10;
          
          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "italic");
          pdf.text(`${existingPO.poNumber} - Terms and Conditions (continued)`, margin, currentY);
          currentY += 8;
          
          pdf.setTextColor(75, 85, 99);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
        }
        pdf.text(termsLines[i], margin, currentY);
        currentY += lineHeight;
      }
    }
    
    // Add footers to all pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setTextColor(156, 163, 175);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 8);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
    
    pdf.save(`${existingPO.poNumber || "PurchaseOrder"}.pdf`);
  }, [existingPO, lineItems, settings, poTermsSettings]);

  const canEdit = isNew || existingPO?.status === "DRAFT" || existingPO?.status === "REJECTED";
  const canApprove = existingPO?.status === "SUBMITTED" && (user?.poApprover || user?.role === "ADMIN");
  const isSubmitted = existingPO?.status === "SUBMITTED";
  const isApproved = existingPO?.status === "APPROVED";
  const isRejected = existingPO?.status === "REJECTED";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary" data-testid="badge-status">Draft</Badge>;
      case "SUBMITTED":
        return <Badge className="bg-blue-600" data-testid="badge-status">Submitted</Badge>;
      case "APPROVED":
        return <Badge className="bg-orange-500" data-testid="badge-status">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" data-testid="badge-status">Rejected</Badge>;
      case "RECEIVED":
        return <Badge className="bg-green-600" data-testid="badge-status">Received</Badge>;
      case "RECEIVED_IN_PART":
        return <Badge className="bg-green-700" data-testid="badge-status">Received in Part</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status">{status}</Badge>;
    }
  };

  if (!isNew && loadingPO) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print:max-w-none">
      <div className="flex items-center gap-4 print:hidden">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/purchase-orders")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              {isNew ? "New Purchase Order" : `Purchase Order: ${existingPO?.poNumber}`}
            </h1>
            <PageHelpButton pageHelpKey="page.purchase-order-form" />
          </div>
          {existingPO && (
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(existingPO.status)}
              <span className="text-sm text-muted-foreground">
                Created by {existingPO.requestedBy?.name || existingPO.requestedBy?.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {isRejected && existingPO?.rejectionReason && (
        <Card className="border-destructive print:hidden">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Rejection Reason:</p>
                <p className="text-sm text-muted-foreground">{existingPO.rejectionReason}</p>
                {existingPO.rejectedBy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Rejected by {existingPO.rejectedBy.name || existingPO.rejectedBy.email} on{" "}
                    {existingPO.rejectedAt ? format(new Date(existingPO.rejectedAt), "dd/MM/yyyy HH:mm") : ""}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canReceive && (
        <Card className="border-emerald-300 dark:border-emerald-700 print:hidden">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-600" />
                <span className="font-medium">
                  {receivingMode ? "Select received items in the table below, then confirm" : "Mark items as received"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReceiveItems}
                  disabled={receiveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-receive-items"
                >
                  {receiveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PackageCheck className="h-4 w-4 mr-2" />
                  )}
                  {receiveMutation.isPending 
                    ? "Saving..." 
                    : receivingMode 
                      ? "Confirm Received Items" 
                      : "Receive Items"}
                </Button>
                {receivingMode && (
                  <Button
                    variant="outline"
                    onClick={cancelReceiving}
                    data-testid="button-cancel-receiving"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="print:pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {settings?.logoBase64 && (
                <img 
                  src={settings.logoBase64} 
                  alt="Company Logo" 
                  className="h-16 w-auto"
                  data-testid="img-company-logo"
                />
              )}
              <div>
                <CardTitle className="text-xl" data-testid="text-company-name">
                  {settings?.companyName || "LTE Precast Concrete Structures"}
                </CardTitle>
                <CardDescription>Purchase Order</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold" data-testid="text-po-number">
                {isNew ? "New PO" : existingPO?.poNumber}
              </p>
              <p className="text-sm text-muted-foreground">
                Date: {format(new Date(), "dd/MM/yyyy")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Supplier</Label>
                  {canEdit ? (
                    <Select
                      value={form.watch("supplierId") || ""}
                      onValueChange={handleSupplierChange}
                      disabled={loadingSuppliers}
                    >
                      <SelectTrigger data-testid="select-supplier">
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1" data-testid="text-supplier-name">
                      {existingPO?.supplierName || "-"}
                    </p>
                  )}
                </div>

                <div className="pl-4 border-l-2 border-muted space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Contact</Label>
                    {canEdit ? (
                      <Input
                        value={form.watch("supplierContact") || ""}
                        onChange={(e) => form.setValue("supplierContact", e.target.value)}
                        placeholder="Contact name"
                        data-testid="input-supplier-contact"
                      />
                    ) : (
                      <p className="text-sm">{existingPO?.supplierContact || "-"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    {canEdit ? (
                      <Input
                        type="email"
                        value={form.watch("supplierEmail") || ""}
                        onChange={(e) => form.setValue("supplierEmail", e.target.value)}
                        placeholder="Email address"
                        data-testid="input-supplier-email"
                      />
                    ) : (
                      <p className="text-sm">{existingPO?.supplierEmail || "-"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    {canEdit ? (
                      <Input
                        value={form.watch("supplierPhone") || ""}
                        onChange={(e) => form.setValue("supplierPhone", e.target.value)}
                        placeholder="Phone number"
                        data-testid="input-supplier-phone"
                      />
                    ) : (
                      <p className="text-sm">{existingPO?.supplierPhone || "-"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    {canEdit ? (
                      <Textarea
                        value={form.watch("supplierAddress") || ""}
                        onChange={(e) => form.setValue("supplierAddress", e.target.value)}
                        placeholder="Supplier address"
                        className="min-h-[60px]"
                        data-testid="textarea-supplier-address"
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-line">{existingPO?.supplierAddress || "-"}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Required By Date</Label>
                  {canEdit ? (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-required-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.watch("requiredByDate") 
                              ? format(form.watch("requiredByDate")!, "dd/MM/yyyy")
                              : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.watch("requiredByDate") || undefined}
                            onSelect={(date) => form.setValue("requiredByDate", date || null)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[7, 14, 30, 45].map((days) => {
                          const targetDate = addDays(new Date(), days);
                          const currentDate = form.watch("requiredByDate");
                          const isSelected = currentDate && 
                            format(currentDate, "yyyy-MM-dd") === format(targetDate, "yyyy-MM-dd");
                          return (
                            <Button
                              key={days}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => form.setValue("requiredByDate", targetDate)}
                              data-testid={`button-quick-date-${days}`}
                            >
                              {days} days
                            </Button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1">
                      {existingPO?.requiredByDate 
                        ? format(new Date(existingPO.requiredByDate), "dd/MM/yyyy")
                        : "-"}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">Delivery Address</Label>
                  {canEdit ? (
                    <Textarea
                      value={form.watch("deliveryAddress") || ""}
                      onChange={(e) => form.setValue("deliveryAddress", e.target.value)}
                      placeholder="Enter delivery address"
                      className="min-h-[80px]"
                      data-testid="textarea-delivery-address"
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-line">{existingPO?.deliveryAddress || "-"}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  {canEdit ? (
                    <Textarea
                      value={form.watch("notes") || ""}
                      onChange={(e) => form.setValue("notes", e.target.value)}
                      placeholder="Additional notes"
                      className="min-h-[60px]"
                      data-testid="textarea-notes"
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-line">{existingPO?.notes || "-"}</p>
                  )}
                </div>
              </div>
            </div>
          </Form>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Line Items</h3>
              {canEdit && (
                <Button onClick={addLineItem} size="sm" data-testid="button-add-line">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table data-testid="table-line-items">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {receivingMode && <TableHead className="w-[50px]">Received</TableHead>}
                    <TableHead className="w-[200px]">Item</TableHead>
                    <TableHead className="w-[120px]">Job</TableHead>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                    <TableHead className="w-[80px] text-right">Qty</TableHead>
                    <TableHead className="w-[80px]">Unit</TableHead>
                    <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                    <TableHead className="w-[120px] text-right">Line Total</TableHead>
                    {canEdit && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={(canEdit ? 8 : 7) + (receivingMode ? 1 : 0)} 
                        className="text-center py-8 text-muted-foreground"
                        data-testid="text-no-items"
                      >
                        No line items. {canEdit && "Click \"Add Line\" to add items."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((line, index) => (
                      <TableRow key={line.id} data-testid={`row-line-item-${index}`}>
                        {receivingMode && (
                          <TableCell className="p-1 text-center">
                            <Checkbox
                              checked={receivedItemIds.has(line.id)}
                              onCheckedChange={() => toggleReceiveItem(line.id)}
                              data-testid={`checkbox-receive-${index}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="p-1">
                          {canEdit ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 w-full justify-start text-left font-normal"
                              onClick={() => openItemPicker(line.id)}
                              data-testid={`select-item-${index}`}
                            >
                              {line.itemId && line.itemId !== MANUAL_ENTRY_ID ? (
                                <span className="truncate">
                                  {line.itemCode ? `${line.itemCode} - ` : ""}
                                  {items.find(i => i.id === line.itemId)?.name || line.description || "Selected"}
                                </span>
                              ) : line.itemId === MANUAL_ENTRY_ID ? (
                                <span className="truncate text-muted-foreground">Manual Entry</span>
                              ) : (
                                <span className="text-muted-foreground">Select item...</span>
                              )}
                            </Button>
                          ) : (
                            <span className="text-sm">{line.itemCode || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {canEdit ? (
                            <div className="flex items-center gap-1">
                              {line.jobId ? (
                                <>
                                  <Badge 
                                    variant="secondary" 
                                    className="font-mono cursor-pointer"
                                    onClick={() => openJobSelector(line.id)}
                                  >
                                    {line.jobNumber}
                                  </Badge>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => clearJobFromLine(line.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => openJobSelector(line.id)}
                                  data-testid={`button-select-job-${index}`}
                                >
                                  <Building2 className="h-3 w-3 mr-1" />
                                  Select
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm font-mono">{line.jobNumber || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {canEdit ? (
                            <Input
                              value={line.description}
                              onChange={(e) => updateLineItem(line.id, "description", e.target.value)}
                              placeholder="Description"
                              className="h-9"
                              data-testid={`input-description-${index}`}
                            />
                          ) : (
                            <span className="text-sm">{line.description}</span>
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLineItem(line.id, "quantity", e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="h-9 text-right"
                              min="0"
                              step="any"
                              data-testid={`input-qty-${index}`}
                            />
                          ) : (
                            <span className="text-sm text-right block">{line.quantity}</span>
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {canEdit ? (
                            <Input
                              value={line.unitOfMeasure}
                              onChange={(e) => updateLineItem(line.id, "unitOfMeasure", e.target.value)}
                              className="h-9"
                              data-testid={`input-unit-${index}`}
                            />
                          ) : (
                            <span className="text-sm">{line.unitOfMeasure}</span>
                          )}
                        </TableCell>
                        <TableCell className="p-1">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={line.unitPrice}
                              onChange={(e) => updateLineItem(line.id, "unitPrice", e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="h-9 text-right"
                              min="0"
                              step="0.01"
                              data-testid={`input-price-${index}`}
                            />
                          ) : (
                            <span className="text-sm text-right block">
                              {formatCurrency(parseFloat(line.unitPrice) || 0)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="p-1 text-right font-medium" data-testid={`text-line-total-${index}`}>
                          {formatCurrency(parseFloat(line.lineTotal) || 0)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(line.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              data-testid={`button-delete-line-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <div className="w-[300px] space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST (10%):</span>
                  <span data-testid="text-tax">{formatCurrency(tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span data-testid="text-total">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />
          <div className="print:hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                <h3 className="text-lg font-medium">Attachments</h3>
                {!isNew && attachments.length > 0 && (
                  <Badge variant="secondary">{attachments.length}</Badge>
                )}
              </div>
            </div>

            {isNew ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center border-muted-foreground/25">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Save the purchase order first to upload attachments
                </p>
              </div>
            ) : (
              <>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  data-testid="dropzone-attachments"
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                    data-testid="input-file-upload"
                  />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {uploadingFiles ? "Uploading files..." : "Drag and drop files here, or"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={uploadingFiles}
                    data-testid="button-browse-files"
                  >
                    Browse Files
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF, Word, Excel, Images (max 50MB each)
                  </p>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`attachment-${attachment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{attachment.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.fileSize)} 
                              {attachment.uploadedBy && ` • Uploaded by ${attachment.uploadedBy.name || attachment.uploadedBy.email}`}
                              {attachment.createdAt && ` • ${format(new Date(attachment.createdAt), "dd/MM/yyyy HH:mm")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            data-testid={`button-download-${attachment.id}`}
                          >
                            <a href={`${PO_ATTACHMENTS_ROUTES.BY_ID(attachment.id)}/download`} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                            disabled={deleteAttachmentMutation.isPending}
                            data-testid={`button-delete-attachment-${attachment.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {(isApproved || existingPO?.status === "RECEIVED" || existingPO?.status === "RECEIVED_IN_PART") && existingPO?.approvedBy && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">
                  Approved by {existingPO.approvedBy.name || existingPO.approvedBy.email}
                </span>
              </div>
              {existingPO.approvedAt && (
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  {format(new Date(existingPO.approvedAt), "dd/MM/yyyy HH:mm")}
                </p>
              )}
            </div>
          )}

          <Separator className="print:hidden" />

          <div className="flex flex-wrap gap-3 print:hidden">
            {canEdit && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-draft"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    createMutation.isPending || 
                    updateMutation.isPending || 
                    submitMutation.isPending ||
                    lineItems.length === 0
                  }
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-submit"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              </>
            )}

            {canApprove && (
              <>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-approve"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  variant="destructive"
                  data-testid="button-reject"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}

            {(isApproved || existingPO?.status === "RECEIVED" || existingPO?.status === "RECEIVED_IN_PART") && (
              <Button onClick={handlePrint} variant="outline" data-testid="button-print">
                <Printer className="h-4 w-4 mr-2" />
                Print / PDF
              </Button>
            )}

            {(canEdit && !isNew) && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this purchase order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="min-h-[100px]"
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Job</DialogTitle>
            <DialogDescription>
              Search and select a job to assign to this line item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job number, name, or client..."
                value={jobSearchTerm}
                onChange={(e) => setJobSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-job-search"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
              {filteredJobs.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No jobs found
                </div>
              ) : (
                <div className="divide-y">
                  {filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleJobSelect(job)}
                      data-testid={`job-option-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-medium">{job.jobNumber}</span>
                          <span className="text-muted-foreground mx-2">-</span>
                          <span>{job.name}</span>
                        </div>
                        {job.productionSlotColor && (
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: job.productionSlotColor }}
                          />
                        )}
                      </div>
                      {job.client && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {job.client}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItemPickerDialog
        open={itemPickerOpen}
        onOpenChange={setItemPickerOpen}
        onSelect={handleItemPickerSelect}
        items={items}
        selectedItemId={itemPickerLineId ? lineItems.find(l => l.id === itemPickerLineId)?.itemId : null}
        manualEntryId={MANUAL_ENTRY_ID}
      />
    </div>
  );
}
