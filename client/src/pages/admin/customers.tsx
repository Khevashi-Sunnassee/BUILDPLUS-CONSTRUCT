import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SuburbLookup } from "@/components/suburb-lookup";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { Customer } from "@shared/schema";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  keyContact: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  abn: z.string().optional(),
  acn: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const AUSTRALIAN_STATES = [
  { value: "VIC", label: "Victoria" },
  { value: "NSW", label: "New South Wales" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
];

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  details: {
    created: string[];
    updated: string[];
    skipped: string[];
    errors: string[];
  };
}

export default function AdminCustomersPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const toggleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }, [sortColumn]);

  const SortIcon = useCallback(({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  }, [sortColumn, sortDirection]);

  const { data: customersList, isLoading } = useQuery<Customer[]>({
    queryKey: [PROCUREMENT_ROUTES.CUSTOMERS],
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const res = await fetch(PROCUREMENT_ROUTES.CUSTOMERS_IMPORT, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        throw new Error(err.error || "Import failed");
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS_ACTIVE] });
      toast({
        title: "Import complete",
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} unchanged`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    importMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filteredCustomers = useMemo(() => {
    let list = customersList || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.keyContact && c.keyContact.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.abn && c.abn.includes(q))
      );
    }
    return [...list].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortColumn) {
        case "name": aVal = a.name || ""; bVal = b.name || ""; break;
        case "keyContact": aVal = a.keyContact || ""; bVal = b.keyContact || ""; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        case "phone": aVal = a.phone || ""; bVal = b.phone || ""; break;
        case "abn": aVal = a.abn || ""; bVal = b.abn || ""; break;
        case "location": aVal = [a.city, a.state].filter(Boolean).join(", "); bVal = [b.city, b.state].filter(Boolean).join(", "); break;
        case "status": aVal = a.isActive ? "Active" : "Inactive"; bVal = b.isActive ? "Active" : "Inactive"; break;
        default: aVal = a.name || ""; bVal = b.name || "";
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [customersList, searchQuery, sortColumn, sortDirection]);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      keyContact: "",
      email: "",
      phone: "",
      abn: "",
      acn: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
      paymentTerms: "",
      notes: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.CUSTOMERS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS] });
      toast({ title: "Customer created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create customer", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      return apiRequest("PATCH", PROCUREMENT_ROUTES.CUSTOMER_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS] });
      toast({ title: "Customer updated successfully" });
      setDialogOpen(false);
      setEditingCustomer(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update customer", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROCUREMENT_ROUTES.CUSTOMER_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS] });
      toast({ title: "Customer deleted" });
      setDeleteDialogOpen(false);
      setDeletingCustomerId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete customer", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingCustomer(null);
    form.reset({
      name: "",
      keyContact: "",
      email: "",
      phone: "",
      abn: "",
      acn: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
      paymentTerms: "",
      notes: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name,
      keyContact: customer.keyContact || "",
      email: customer.email || "",
      phone: customer.phone || "",
      abn: customer.abn || "",
      acn: customer.acn || "",
      addressLine1: customer.addressLine1 || "",
      addressLine2: customer.addressLine2 || "",
      city: customer.city || "",
      state: customer.state || "",
      postcode: customer.postcode || "",
      country: customer.country || "",
      paymentTerms: customer.paymentTerms || "",
      notes: customer.notes || "",
      isActive: customer.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Customers Management">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Customers Management">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-customers-title">Customer Management</h1>
            <PageHelpButton pageHelpKey="page.admin.customers" />
          </div>
          <p className="text-muted-foreground">Manage customers and their contact information</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.open(PROCUREMENT_ROUTES.CUSTOMERS_EXPORT, "_blank")} data-testid="button-export-customers">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => { setImportResult(null); setImportDialogOpen(true); }} data-testid="button-import-customers">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-customer">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customers
              </CardTitle>
              <CardDescription>
                {filteredCustomers?.length || 0} customer{filteredCustomers?.length !== 1 ? "s" : ""}{searchQuery ? " matching search" : " configured"}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-customers"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers && filteredCustomers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")} data-testid="sort-customer-name">
                    <span className="flex items-center">Name<SortIcon column="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keyContact")} data-testid="sort-customer-contact">
                    <span className="flex items-center">Key Contact<SortIcon column="keyContact" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")} data-testid="sort-customer-email">
                    <span className="flex items-center">Email<SortIcon column="email" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("phone")} data-testid="sort-customer-phone">
                    <span className="flex items-center">Phone<SortIcon column="phone" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("location")} data-testid="sort-customer-location">
                    <span className="flex items-center">Location<SortIcon column="location" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")} data-testid="sort-customer-status">
                    <span className="flex items-center">Status<SortIcon column="status" /></span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell className="font-medium" data-testid={`text-customer-name-${customer.id}`}>
                      {customer.name}
                    </TableCell>
                    <TableCell data-testid={`text-customer-contact-${customer.id}`}>
                      {customer.keyContact || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-customer-email-${customer.id}`}>
                      {customer.email || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-customer-phone-${customer.id}`}>
                      {customer.phone || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-customer-location-${customer.id}`}>
                      {[customer.city, customer.state].filter(Boolean).join(", ") || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.isActive ? "default" : "secondary"} data-testid={`badge-customer-status-${customer.id}`}>
                        {customer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(customer)}
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingCustomerId(customer.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-customer-${customer.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {searchQuery ? (
                <>
                  <p>No customers match your search</p>
                  <p className="text-sm">Try a different search term</p>
                </>
              ) : (
                <>
                  <p>No customers configured yet</p>
                  <p className="text-sm">Click "Add Customer" to create your first customer</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? "Update the customer details" : "Create a new customer for your organization"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer company name" {...field} data-testid="input-customer-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="keyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person" {...field} data-testid="input-customer-key-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-customer-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+61 400 000 000" {...field} data-testid="input-customer-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Net 30" {...field} data-testid="input-customer-payment-terms" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="abn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ABN</FormLabel>
                      <FormControl>
                        <Input placeholder="00 000 000 000" {...field} className="font-mono" data-testid="input-customer-abn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="acn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ACN</FormLabel>
                      <FormControl>
                        <Input placeholder="000 000 000" {...field} className="font-mono" data-testid="input-customer-acn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} data-testid="input-customer-address1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Unit, building, etc." {...field} data-testid="input-customer-address2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City / Suburb</FormLabel>
                      <FormControl>
                        <SuburbLookup
                          value={field.value || ""}
                          onChange={field.onChange}
                          onSelect={(result) => {
                            field.onChange(result.suburb);
                            form.setValue("state", result.state);
                            form.setValue("postcode", result.postcode);
                          }}
                          placeholder="Start typing suburb..."
                          data-testid="input-customer-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AUSTRALIAN_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input placeholder="0000" {...field} data-testid="input-customer-postcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Australia" {...field} data-testid="input-customer-country" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this customer" 
                        {...field} 
                        data-testid="input-customer-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Inactive customers won't appear in selection lists
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-customer-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-customer">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-customer"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingCustomer ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone. Any jobs linked to this customer will have their customer reference removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-customer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCustomerId && deleteMutation.mutate(deletingCustomerId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-customer"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Customers
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to import customers. Existing customers (matched by name) will have their missing details updated. New customers will be created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(PROCUREMENT_ROUTES.CUSTOMERS_TEMPLATE, "_blank")} data-testid="button-download-customer-template">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <p className="text-sm text-muted-foreground">Use this template for best results</p>
            </div>

            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-customer-import-file"
              />
              {importMutation.isPending ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Importing customers...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-select-customer-file"
                  >
                    Select File
                  </Button>
                  <p className="text-sm text-muted-foreground">Accepts .xlsx, .xls, or .csv files</p>
                </div>
              )}
            </div>

            {importResult && (
              <div className="space-y-3 border rounded-md p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{importResult.created}</Badge>
                    <span>New customers created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{importResult.updated}</Badge>
                    <span>Customers updated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{importResult.skipped}</Badge>
                    <span>Unchanged (skipped)</span>
                  </div>
                  {importResult.errors > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{importResult.errors}</Badge>
                      <span>Errors</span>
                    </div>
                  )}
                </div>

                {importResult.details.created.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Created:</p>
                    <p className="text-xs">{importResult.details.created.join(", ")}</p>
                  </div>
                )}
                {importResult.details.updated.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Updated:</p>
                    <p className="text-xs">{importResult.details.updated.join(", ")}</p>
                  </div>
                )}
                {importResult.details.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Errors:</p>
                    {importResult.details.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-close-customer-import-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
