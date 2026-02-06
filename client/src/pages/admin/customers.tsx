import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function AdminCustomersPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: customersList, isLoading } = useQuery<Customer[]>({
    queryKey: [PROCUREMENT_ROUTES.CUSTOMERS],
  });

  const filteredCustomers = customersList?.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.keyContact && c.keyContact.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.abn && c.abn.includes(q))
    );
  });

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
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-customers-title">Customer Management</h1>
          <p className="text-muted-foreground">Manage customers and their contact information</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-customer">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Key Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>ABN</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="font-mono text-sm" data-testid={`text-customer-abn-${customer.id}`}>
                      {customer.abn || "-"}
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
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} data-testid="input-customer-city" />
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
    </div>
  );
}
