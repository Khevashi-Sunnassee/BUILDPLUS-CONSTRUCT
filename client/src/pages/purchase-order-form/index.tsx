import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useForm } from "react-hook-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, apiUpload } from "@/lib/queryClient";
import { ArrowLeft, AlertTriangle, PackageCheck, Loader2, Package, Check, X } from "lucide-react";
import type { Supplier, Item, ItemCategory, Job } from "@shared/schema";
import { PROCUREMENT_ROUTES, JOBS_ROUTES, SETTINGS_ROUTES, PO_ATTACHMENTS_ROUTES } from "@shared/api-routes";
import { ItemPickerDialog } from "@/components/ItemPickerDialog";

import type { LineItem, FormValues, PurchaseOrderWithDetails, AttachmentWithUser } from "./types";
import { formSchema, MANUAL_ENTRY_ID } from "./types";
import { generatePurchaseOrderPdf } from "./print-utils";
import { SupplierDeliverySection } from "./SupplierDeliverySection";
import { LineItemsTable } from "./LineItemsTable";
import { NotesAttachmentsSection } from "./NotesAttachmentsSection";
import { PODialogs } from "./PODialogs";
import { ActionButtons } from "./ActionButtons";

export default function PurchaseOrderFormPage() {
  const [, params] = useRoute("/purchase-orders/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isNew = params?.id === "new";
  const poId = isNew ? null : params?.id;
  const capexId = isNew ? new URLSearchParams(window.location.search).get("capexId") : null;

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
  const [selectedCapexId, setSelectedCapexId] = useState<string | undefined>(capexId || undefined);
  const [capexManuallyCleared, setCapexManuallyCleared] = useState(false);

  const effectiveCapexId = capexManuallyCleared ? null : (selectedCapexId || capexId || null);

  const { data: capexData } = useQuery<any>({
    queryKey: ["/api/capex-requests", effectiveCapexId],
    queryFn: async () => {
      const res = await fetch(`/api/capex-requests/${effectiveCapexId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch CAPEX data");
      return res.json();
    },
    enabled: !!effectiveCapexId,
  });

  const { data: allCapexRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/capex-requests"],
    enabled: isNew,
  });

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEMS_ACTIVE],
  });

  const { data: itemCategories = [] } = useQuery<ItemCategory[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: costCodes = [] } = useQuery<{ id: string; code: string; name: string; isActive: boolean }[]>({
    queryKey: ["/api/cost-codes"],
  });

  const costCodeMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const cc of costCodes) {
      map.set(cc.id, { code: cc.code, name: cc.name });
    }
    return map;
  }, [costCodes]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: "",
      supplierName: "",
      supplierContact: "",
      supplierEmail: "",
      supplierPhone: "",
      supplierAddress: "",
      projectName: "",
      deliveryAddress: "",
      requiredByDate: isNew ? addDays(new Date(), 7) : null,
      notes: "",
      internalNotes: "",
    },
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

  const { data: settings } = useQuery<{ logoBase64: string | null; userLogoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });

  const { data: poTermsSettings } = useQuery<{ poTermsHtml: string; includePOTerms: boolean }>({
    queryKey: [SETTINGS_ROUTES.PO_TERMS],
  });

  const { data: existingPO, isLoading: loadingPO } = useQuery<PurchaseOrderWithDetails>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId],
    enabled: !!poId,
  });

  const { data: attachments = [] } = useQuery<AttachmentWithUser[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS, poId, "attachments"],
    enabled: !!poId,
  });

  useUnsavedChanges(form.formState.isDirty);

  useEffect(() => {
    if (capexData && isNew && !existingPO) {
      const updates: Partial<FormValues> = {};
      if (capexData.preferredSupplier?.id) {
        updates.supplierId = capexData.preferredSupplier.id;
        const supplier = suppliers.find((s: Supplier) => s.id === capexData.preferredSupplier.id);
        if (supplier) {
          updates.supplierName = supplier.name || "";
          updates.supplierContact = supplier.keyContact || "";
          updates.supplierEmail = supplier.email || "";
          updates.supplierPhone = supplier.phone || "";
        }
      }
      if (capexData.job) {
        updates.projectName = `${capexData.job.jobNumber} - ${capexData.job.name}`;
      }
      updates.notes = `CAPEX Request: ${capexData.capexNumber} - ${capexData.equipmentTitle}`;
      form.reset({ ...form.getValues(), ...updates });
      const hasCapexItem = lineItems.some(item => item.itemCode === "CAPEX");
      if (lineItems.length === 0 || !hasCapexItem) {
        const totalCost = parseFloat(capexData.totalEquipmentCost || "0");
        const capexLineItem = {
          id: crypto.randomUUID(),
          itemId: null,
          itemCode: "CAPEX",
          description: capexData.equipmentDescription || capexData.equipmentTitle || "",
          quantity: "1",
          unitOfMeasure: "EA",
          unitPrice: totalCost.toString(),
          lineTotal: totalCost.toString(),
          costCodeId: null,
          jobId: capexData.jobId || null,
          jobNumber: capexData.job?.jobNumber || "",
        };
        if (lineItems.length === 0) {
          setLineItems([capexLineItem]);
        } else {
          setLineItems(prev => [capexLineItem, ...prev.filter(i => i.itemCode !== "CAPEX")]);
        }
      }
    }
  }, [capexData, isNew, suppliers, effectiveCapexId]);

  useEffect(() => {
    if (existingPO) {
      form.reset({
        supplierId: existingPO.supplierId || "",
        supplierName: existingPO.supplierName || "",
        supplierContact: existingPO.supplierContact || "",
        supplierEmail: existingPO.supplierEmail || "",
        supplierPhone: existingPO.supplierPhone || "",
        supplierAddress: existingPO.supplierAddress || "",
        projectName: (existingPO as any).projectName || "",
        deliveryAddress: existingPO.deliveryAddress || "",
        requiredByDate: existingPO.requiredByDate ? new Date(existingPO.requiredByDate) : null,
        notes: existingPO.notes || "",
        internalNotes: existingPO.internalNotes || "",
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
        costCodeId: (item as any).costCodeId || null,
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
        ...(effectiveCapexId ? { capexRequestId: effectiveCapexId, capexDescription: capexData?.equipmentTitle || "" } : {}),
        items: data.items.map((item, index) => ({
          itemId: item.itemId === MANUAL_ENTRY_ID ? null : item.itemId,
          itemCode: item.itemCode,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unitOfMeasure: item.unitOfMeasure,
          unitPrice: parseFloat(item.unitPrice) || 0,
          lineTotal: parseFloat(item.lineTotal) || 0,
          costCodeId: item.costCodeId || null,
          sortOrder: index,
        })),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      if (effectiveCapexId) {
        queryClient.invalidateQueries({ queryKey: ["/api/capex-requests"] });
      }
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
          costCodeId: item.costCodeId || null,
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
        existingPO.items.filter((item: Record<string, unknown>) => item.received).map((item: Record<string, unknown>) => item.id as string)
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
        existingPO.items.filter((item: Record<string, unknown>) => item.received).map((item: Record<string, unknown>) => item.id as string)
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
      costCodeId: null,
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

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: string | null) => {
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

    let defaultCostCodeId: string | null = null;
    if (selectedItem.categoryId) {
      const category = itemCategories.find(c => c.id === selectedItem.categoryId);
      if (category?.defaultCostCodeId) {
        defaultCostCodeId = category.defaultCostCodeId;
      }
    }

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
        costCodeId: defaultCostCodeId,
      };
    }));
  }, [items, itemCategories]);

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

  const handleSave = useCallback(() => {
    const formData = form.getValues();
    if (isNew) {
      createMutation.mutate({ po: formData, items: lineItems });
    } else {
      updateMutation.mutate({ po: formData, items: lineItems });
    }
  }, [form, isNew, lineItems, createMutation, updateMutation]);

  const handleUpdate = useCallback(() => {
    const formData = form.getValues();
    updateMutation.mutate({ po: formData, items: lineItems });
  }, [form, lineItems, updateMutation]);

  const handleSubmit = useCallback(async () => {
    const formData = form.getValues();
    if (isNew) {
      createMutation.mutate({ po: formData, items: lineItems }, {
        onSuccess: (data) => {
          submitMutation.mutate(data.id);
        },
      });
    } else {
      await updateMutation.mutateAsync({ po: formData, items: lineItems });
      submitMutation.mutate(poId!);
    }
  }, [form, isNew, lineItems, createMutation, updateMutation, submitMutation, poId]);

  const handlePrint = useCallback(async () => {
    if (!existingPO) return;
    await generatePurchaseOrderPdf(existingPO, lineItems, settings, poTermsSettings);
  }, [existingPO, lineItems, settings, poTermsSettings]);

  const canEdit = true;
  const canApprove = useMemo(() => existingPO?.status === "SUBMITTED" && (user?.poApprover || user?.role === "ADMIN"), [existingPO?.status, user?.poApprover, user?.role]);
  const isApproved = existingPO?.status === "APPROVED";
  const isRejected = existingPO?.status === "REJECTED";

  const getStatusBadge = useCallback((status: string) => {
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
  }, []);

  if (!isNew && loadingPO) {
    return (
      <div className="space-y-6" role="main" aria-label="Purchase Order Form" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print:max-w-none" role="main" aria-label="Purchase Order Form">
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
          {capexData && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground" data-testid="text-capex-link-banner">
              <Package className="h-4 w-4" />
              Linked to CAPEX: {capexData.capexNumber} — {capexData.equipmentTitle}
            </div>
          )}
          {existingPO && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {getStatusBadge(existingPO.status)}
              {(existingPO as any).capexRequestId && (
                <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => navigate(`/capex-requests?open=${(existingPO as any).capexRequestId}`)} data-testid="badge-capex-header">
                  <Package className="h-3 w-3 mr-1" />
                  CAPEX Linked
                </Badge>
              )}
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
              {(settings?.userLogoBase64 || settings?.logoBase64) && (
                <img 
                  src={settings?.userLogoBase64 || settings?.logoBase64 || ""} 
                  alt="Company Logo" 
                  className="h-16 w-auto object-contain"
                  data-testid="img-company-logo"
                />
              )}
              <div>
                <CardTitle className="text-xl" data-testid="text-company-name">
                  {settings?.companyName || "BuildPlus Ai"}
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
          <SupplierDeliverySection
            form={form}
            canEdit={canEdit}
            isNew={isNew}
            existingPO={existingPO}
            suppliers={suppliers}
            loadingSuppliers={loadingSuppliers}
            handleSupplierChange={handleSupplierChange}
            effectiveCapexId={effectiveCapexId}
            allCapexRequests={allCapexRequests}
            setSelectedCapexId={setSelectedCapexId}
            setCapexManuallyCleared={setCapexManuallyCleared}
            navigate={navigate}
          />

          <Separator />

          <LineItemsTable
            lineItems={lineItems}
            canEdit={canEdit}
            receivingMode={receivingMode}
            receivedItemIds={receivedItemIds}
            toggleReceiveItem={toggleReceiveItem}
            addLineItem={addLineItem}
            removeLineItem={removeLineItem}
            updateLineItem={updateLineItem}
            openItemPicker={openItemPicker}
            openJobSelector={openJobSelector}
            clearJobFromLine={clearJobFromLine}
            items={items}
            costCodes={costCodes}
            costCodeMap={costCodeMap}
            subtotal={subtotal}
            tax={tax}
            total={total}
          />

          <Separator />

          <NotesAttachmentsSection
            form={form}
            canEdit={canEdit}
            isNew={isNew}
            existingPO={existingPO}
            attachments={attachments}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            uploadingFiles={uploadingFiles}
            handleFileDrop={handleFileDrop}
            handleFileSelect={handleFileSelect}
            deleteAttachmentMutation={deleteAttachmentMutation}
          />

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

          <ActionButtons
            canEdit={canEdit}
            canApprove={canApprove}
            isNew={isNew}
            isApproved={isApproved}
            existingPOStatus={existingPO?.status}
            lineItemsCount={lineItems.length}
            createIsPending={createMutation.isPending}
            updateIsPending={updateMutation.isPending}
            submitIsPending={submitMutation.isPending}
            approveIsPending={approveMutation.isPending}
            handleSave={handleSave}
            handleUpdate={handleUpdate}
            handleSubmit={handleSubmit}
            handleApprove={() => approveMutation.mutate()}
            handlePrint={handlePrint}
            setShowRejectDialog={setShowRejectDialog}
            setShowDeleteDialog={setShowDeleteDialog}
          />
        </CardContent>
      </Card>

      <PODialogs
        showRejectDialog={showRejectDialog}
        setShowRejectDialog={setShowRejectDialog}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        rejectMutation={rejectMutation}
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        deleteMutation={deleteMutation}
        showJobDialog={showJobDialog}
        setShowJobDialog={setShowJobDialog}
        jobSearchTerm={jobSearchTerm}
        setJobSearchTerm={setJobSearchTerm}
        filteredJobs={filteredJobs}
        handleJobSelect={handleJobSelect}
      />

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
