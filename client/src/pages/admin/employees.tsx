import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Search,
  Eye,
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
import type { Employee } from "@shared/schema";
import { EMPLOYEE_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

const employeeSchema = z.object({
  employeeNumber: z.string().min(1, "Employee number is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  isDraftingResource: z.boolean().default(false),
  isProductionResource: z.boolean().default(false),
  isSiteResource: z.boolean().default(false),
  receiveEscalatedWorkOrders: z.boolean().default(false),
  workRights: z.boolean().default(true),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

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

const defaultFormValues: EmployeeFormData = {
  employeeNumber: "",
  firstName: "",
  lastName: "",
  middleName: "",
  preferredName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  suburb: "",
  state: "",
  postcode: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  isDraftingResource: false,
  isProductionResource: false,
  isSiteResource: false,
  receiveEscalatedWorkOrders: false,
  workRights: true,
  notes: "",
  isActive: true,
};

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

export default function AdminEmployeesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortColumn, setSortColumn] = useState<string>("lastName");
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

  const { data: employeesList, isLoading } = useQuery<Employee[]>({
    queryKey: [EMPLOYEE_ROUTES.LIST],
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const res = await fetch(EMPLOYEE_ROUTES.IMPORT, {
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
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LIST] });
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

  const filteredEmployees = useMemo(() => {
    let list = employeesList || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) =>
        e.employeeNumber.toLowerCase().includes(q) ||
        e.firstName.toLowerCase().includes(q) ||
        e.lastName.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortColumn) {
        case "employeeNumber": aVal = a.employeeNumber || ""; bVal = b.employeeNumber || ""; break;
        case "lastName": aVal = `${a.lastName} ${a.firstName}`; bVal = `${b.lastName} ${b.firstName}`; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        case "phone": aVal = a.phone || ""; bVal = b.phone || ""; break;
        case "status": aVal = a.isActive ? "Active" : "Inactive"; bVal = b.isActive ? "Active" : "Inactive"; break;
        default: aVal = a.lastName || ""; bVal = b.lastName || "";
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [employeesList, searchQuery, sortColumn, sortDirection]);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaultFormValues,
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      return apiRequest("POST", EMPLOYEE_ROUTES.LIST, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LIST] });
      toast({ title: "Employee created successfully" });
      setDialogOpen(false);
      form.reset(defaultFormValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create employee", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EmployeeFormData }) => {
      return apiRequest("PATCH", EMPLOYEE_ROUTES.BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LIST] });
      toast({ title: "Employee updated successfully" });
      setDialogOpen(false);
      setEditingEmployee(null);
      form.reset(defaultFormValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update employee", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", EMPLOYEE_ROUTES.BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LIST] });
      toast({ title: "Employee deleted" });
      setDeleteDialogOpen(false);
      setDeletingEmployeeId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete employee", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingEmployee(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName || "",
      preferredName: employee.preferredName || "",
      dateOfBirth: employee.dateOfBirth || "",
      phone: employee.phone || "",
      email: employee.email || "",
      addressLine1: employee.addressLine1 || "",
      addressLine2: employee.addressLine2 || "",
      suburb: employee.suburb || "",
      state: employee.state || "",
      postcode: employee.postcode || "",
      emergencyContactName: employee.emergencyContactName || "",
      emergencyContactPhone: employee.emergencyContactPhone || "",
      emergencyContactRelationship: employee.emergencyContactRelationship || "",
      isDraftingResource: employee.isDraftingResource,
      isProductionResource: employee.isProductionResource,
      isSiteResource: employee.isSiteResource,
      receiveEscalatedWorkOrders: employee.receiveEscalatedWorkOrders,
      workRights: employee.workRights,
      notes: employee.notes || "",
      isActive: employee.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-employees-title">Employee Management</h1>
            <PageHelpButton pageHelpKey="page.admin.employees" />
          </div>
          <p className="text-muted-foreground">Manage employees and their information</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.open(EMPLOYEE_ROUTES.EXPORT, "_blank")} data-testid="button-export-employees">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => { setImportResult(null); setImportDialogOpen(true); }} data-testid="button-import-employees">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-employee">
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employees
              </CardTitle>
              <CardDescription>
                {filteredEmployees?.length || 0} employee{filteredEmployees?.length !== 1 ? "s" : ""}{searchQuery ? " matching search" : " configured"}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-employees"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEmployees && filteredEmployees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("employeeNumber")} data-testid="sort-employee-number">
                    <span className="flex items-center">Employee Number<SortIcon column="employeeNumber" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastName")} data-testid="sort-employee-name">
                    <span className="flex items-center">Name<SortIcon column="lastName" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")} data-testid="sort-employee-email">
                    <span className="flex items-center">Email<SortIcon column="email" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("phone")} data-testid="sort-employee-phone">
                    <span className="flex items-center">Phone<SortIcon column="phone" /></span>
                  </TableHead>
                  <TableHead>Role Tags</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")} data-testid="sort-employee-status">
                    <span className="flex items-center">Status<SortIcon column="status" /></span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-employee-number-${employee.id}`}>
                      {employee.employeeNumber}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-employee-name-${employee.id}`}>
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-employee-email-${employee.id}`}>
                      {employee.email || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-employee-phone-${employee.id}`}>
                      {employee.phone || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-employee-roles-${employee.id}`}>
                      <div className="flex items-center gap-1 flex-wrap">
                        {employee.isDraftingResource && <Badge variant="secondary" data-testid={`badge-employee-drafting-${employee.id}`}>Drafting</Badge>}
                        {employee.isProductionResource && <Badge variant="secondary" data-testid={`badge-employee-production-${employee.id}`}>Production</Badge>}
                        {employee.isSiteResource && <Badge variant="secondary" data-testid={`badge-employee-site-${employee.id}`}>Site</Badge>}
                        {!employee.isDraftingResource && !employee.isProductionResource && !employee.isSiteResource && "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.isActive ? "default" : "secondary"} data-testid={`badge-employee-status-${employee.id}`}>
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLocation(`/admin/employees/${employee.id}`)}
                          data-testid={`button-view-employee-${employee.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(employee)}
                          data-testid={`button-edit-employee-${employee.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingEmployeeId(employee.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-employee-${employee.id}`}
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
                  <p>No employees match your search</p>
                  <p className="text-sm">Try a different search term</p>
                </>
              ) : (
                <>
                  <p>No employees configured yet</p>
                  <p className="text-sm">Click "Add Employee" to create your first employee</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? "Update the employee details" : "Create a new employee for your organization"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employeeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="EMP-001" {...field} data-testid="input-employee-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} data-testid="input-employee-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Middle Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Middle name" {...field} data-testid="input-employee-middle-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} data-testid="input-employee-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="preferredName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Preferred name" {...field} data-testid="input-employee-preferred-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-employee-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-employee-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+61 400 000 000" {...field} data-testid="input-employee-phone" />
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
                      <Input placeholder="Street address" {...field} data-testid="input-employee-address1" />
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
                      <Input placeholder="Unit, building, etc." {...field} data-testid="input-employee-address2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="suburb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suburb</FormLabel>
                      <FormControl>
                        <Input placeholder="Suburb" {...field} data-testid="input-employee-suburb" />
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
                          <SelectTrigger data-testid="select-employee-state">
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
                        <Input placeholder="0000" {...field} data-testid="input-employee-postcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact name" {...field} data-testid="input-employee-emergency-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+61 400 000 000" {...field} data-testid="input-employee-emergency-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactRelationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Spouse, Parent" {...field} data-testid="input-employee-emergency-relationship" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="isDraftingResource"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Drafting Resource</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Employee works on drafting tasks
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-employee-drafting"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isProductionResource"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Production Resource</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Employee works on production tasks
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-employee-production"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isSiteResource"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Site Resource</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Employee works on site
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-employee-site"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiveEscalatedWorkOrders"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Receive Escalated Work Orders</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Employee receives escalated work order notifications
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-employee-escalated"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="workRights"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Work Rights</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Employee has valid work rights
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-employee-work-rights"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this employee"
                        {...field}
                        data-testid="input-employee-notes"
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
                        Inactive employees won't appear in selection lists
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-employee-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-employee">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-employee"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingEmployee ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone. All associated employment records, documents, and licences will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-employee">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEmployeeId && deleteMutation.mutate(deletingEmployeeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-employee"
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
              Import Employees
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to import employees. Existing employees (matched by last name + first name) will have their missing details updated. New employees will be created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(EMPLOYEE_ROUTES.TEMPLATE, "_blank")} data-testid="button-download-employee-template">
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
                data-testid="input-employee-import-file"
              />
              {importMutation.isPending ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Importing employees...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-select-employee-file"
                  >
                    Select File
                  </Button>
                  <p className="text-sm text-muted-foreground">Accepts .xlsx, .xls, or .csv files</p>
                </div>
              )}
            </div>

            {importResult && (
              <div className="space-y-3 border rounded-md p-4" data-testid="employee-import-result">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" data-testid="text-employee-import-created">{importResult.created}</Badge>
                    <span>New employees created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="text-employee-import-updated">{importResult.updated}</Badge>
                    <span>Employees updated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" data-testid="text-employee-import-skipped">{importResult.skipped}</Badge>
                    <span>Unchanged (skipped)</span>
                  </div>
                  {importResult.errors > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" data-testid="text-employee-import-errors">{importResult.errors}</Badge>
                      <span>Errors</span>
                    </div>
                  )}
                </div>

                {importResult.details.created.length > 0 && (
                  <div data-testid="text-employee-import-created-list">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Created:</p>
                    <p className="text-xs">{importResult.details.created.join(", ")}</p>
                  </div>
                )}
                {importResult.details.updated.length > 0 && (
                  <div data-testid="text-employee-import-updated-list">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Updated:</p>
                    <p className="text-xs">{importResult.details.updated.join(", ")}</p>
                  </div>
                )}
                {importResult.details.errors.length > 0 && (
                  <div data-testid="text-employee-import-errors-list">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Errors:</p>
                    {importResult.details.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive flex items-start gap-1" data-testid={`text-employee-import-error-${i}`}>
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
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-close-employee-import-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
