import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
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
import { Switch } from "@/components/ui/switch";
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
import type { Company } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  code: z.string().min(1, "Company code is required").max(10, "Code must be 10 characters or less"),
  isActive: z.boolean().default(true),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function AdminCompaniesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: [ADMIN_ROUTES.COMPANIES],
  });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      code: "",
      isActive: true,
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      return apiRequest("POST", ADMIN_ROUTES.COMPANIES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.COMPANIES] });
      toast({ title: "Company created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create company", description: error.message, variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompanyFormData }) => {
      return apiRequest("PUT", ADMIN_ROUTES.COMPANY_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.COMPANIES] });
      toast({ title: "Company updated successfully" });
      setDialogOpen(false);
      setEditingCompany(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update company", description: error.message, variant: "destructive" });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.COMPANY_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.COMPANIES] });
      toast({ title: "Company deleted" });
      setDeleteDialogOpen(false);
      setDeletingCompanyId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete company", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingCompany(null);
    form.reset({
      name: "",
      code: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    form.reset({
      name: company.name,
      code: company.code,
      isActive: company.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: CompanyFormData) => {
    if (editingCompany) {
      updateCompanyMutation.mutate({ id: editingCompany.id, data });
    } else {
      createCompanyMutation.mutate(data);
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-companies-title">Company Management</h1>
            <PageHelpButton pageHelpKey="page.admin.companies" />
          </div>
          <p className="text-muted-foreground">Manage companies in the system</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-company">
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Companies
          </CardTitle>
          <CardDescription>
            {companies?.length || 0} companies configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies?.map((company) => (
                <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{company.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.isActive ? "default" : "secondary"}>
                      {company.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(company)}
                        data-testid={`button-edit-company-${company.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setDeletingCompanyId(company.id);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={company.id === "1"}
                        data-testid={`button-delete-company-${company.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!companies || companies.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No companies found. Click "Add Company" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Create Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany ? "Update company details" : "Add a new company to the system"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter company name" 
                        {...field} 
                        data-testid="input-company-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., LTE" 
                        {...field} 
                        maxLength={10}
                        data-testid="input-company-code"
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Whether this company is active in the system
                      </p>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-company-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
                  data-testid="button-submit-company"
                >
                  {(createCompanyMutation.isPending || updateCompanyMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
                  {editingCompany ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone.
              Note: Companies with existing users cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-company">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompanyId && deleteCompanyMutation.mutate(deletingCompanyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-company"
            >
              {deleteCompanyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
