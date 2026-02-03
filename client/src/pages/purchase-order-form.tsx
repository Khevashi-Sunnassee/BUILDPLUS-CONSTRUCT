import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Trash2, CalendarIcon, Printer, Send, Check, X, Save, AlertTriangle } from "lucide-react";
import type { Supplier, Item, PurchaseOrder, PurchaseOrderItem, User } from "@shared/schema";

interface LineItem {
  id: string;
  itemId: string | null;
  itemCode: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
  lineTotal: string;
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

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers/active"],
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<Item[]>({
    queryKey: ["/api/items/active"],
  });

  const { data: settings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: ["/api/settings/logo"],
  });

  const { data: existingPO, isLoading: loadingPO } = useQuery<PurchaseOrderWithDetails>({
    queryKey: ["/api/purchase-orders", poId],
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
      requiredByDate: null,
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
      }));
      setLineItems(mappedItems);
    }
  }, [existingPO, form]);

  const createMutation = useMutation({
    mutationFn: async (data: { po: FormValues; items: LineItem[] }) => {
      const response = await apiRequest("POST", "/api/purchase-orders", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order created successfully" });
      navigate(`/purchase-orders/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { po: FormValues; items: LineItem[] }) => {
      const response = await apiRequest("PATCH", `/api/purchase-orders/${poId}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", poId] });
      toast({ title: "Purchase order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/purchase-orders/${poId}/submit`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", poId] });
      toast({ title: "Purchase order submitted for approval" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/purchase-orders/${poId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", poId] });
      toast({ title: "Purchase order approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest("POST", `/api/purchase-orders/${poId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", poId] });
      setShowRejectDialog(false);
      toast({ title: "Purchase order rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/purchase-orders/${poId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order deleted" });
      navigate("/purchase-orders");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSupplierChange = useCallback((supplierId: string) => {
    form.setValue("supplierId", supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      form.setValue("supplierName", supplier.name || "");
      form.setValue("supplierContact", supplier.keyContact || "");
      form.setValue("supplierEmail", supplier.email || "");
      form.setValue("supplierPhone", supplier.phone || "");
      const addressParts = [
        supplier.addressLine1,
        supplier.addressLine2,
        supplier.city,
        supplier.state,
        supplier.postcode,
        supplier.country,
      ].filter(Boolean);
      form.setValue("supplierAddress", addressParts.join(", "));
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
    };
    setLineItems(prev => [...prev, newItem]);
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
          submitMutation.mutate();
        },
      });
    } else {
      await updateMutation.mutateAsync({ po: formData, items: lineItems });
      submitMutation.mutate();
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
        return <Badge className="bg-green-600" data-testid="badge-status">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" data-testid="badge-status">Rejected</Badge>;
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
    <div className="space-y-6 max-w-5xl mx-auto print:max-w-none">
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
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            {isNew ? "New Purchase Order" : `Purchase Order: ${existingPO?.poNumber}`}
          </h1>
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
                    <TableHead className="w-[200px]">Item</TableHead>
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
                        colSpan={canEdit ? 7 : 6} 
                        className="text-center py-8 text-muted-foreground"
                        data-testid="text-no-items"
                      >
                        No line items. {canEdit && "Click \"Add Line\" to add items."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((line, index) => (
                      <TableRow key={line.id} data-testid={`row-line-item-${index}`}>
                        <TableCell className="p-1">
                          {canEdit ? (
                            <Select
                              value={line.itemId || ""}
                              onValueChange={(value) => handleItemSelect(line.id, value)}
                            >
                              <SelectTrigger 
                                className="h-9"
                                data-testid={`select-item-${index}`}
                              >
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={MANUAL_ENTRY_ID}>
                                  -- Manual Entry --
                                </SelectItem>
                                {items.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.code ? `${item.code} - ` : ""}{item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">{line.itemCode || "-"}</span>
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

          {isApproved && existingPO?.approvedBy && (
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

            {isApproved && (
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
    </div>
  );
}
