import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  Save,
  Loader2,
  Briefcase,
  FileText,
  Award,
  User,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  SkipForward,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PageHelpButton } from "@/components/help/page-help-button";
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
import { Progress } from "@/components/ui/progress";
import type { Employee, EmployeeEmployment, EmployeeDocument, EmployeeLicence, EmployeeOnboarding, EmployeeOnboardingTask, OnboardingTemplate } from "@shared/schema";
import { EMPLOYEE_ROUTES, ONBOARDING_ROUTES } from "@shared/api-routes";

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

const employeeEditSchema = z.object({
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

type EmployeeEditFormData = z.infer<typeof employeeEditSchema>;

const employmentSchema = z.object({
  employmentType: z.string().default("full_time"),
  positionTitle: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  workLocation: z.string().optional(),
  workState: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  expectedStartDate: z.string().optional(),
  endDate: z.string().optional(),
  probationEndDate: z.string().optional(),
  classificationLevel: z.string().optional(),
  instrumentId: z.string().nullable().optional(),
  status: z.string().default("prospect"),
  baseRate: z.string().optional(),
  rateBasis: z.string().optional(),
  payFrequency: z.string().optional(),
  ordinaryRate: z.string().optional(),
  overtime1_5: z.string().optional(),
  overtime2: z.string().optional(),
  saturdayRate: z.string().optional(),
  sundayRate: z.string().optional(),
  publicHolidayRate: z.string().optional(),
  nightShiftRate: z.string().optional(),
  travelAllowance: z.string().optional(),
  mealAllowance: z.string().optional(),
  toolAllowance: z.string().optional(),
  uniformAllowance: z.string().optional(),
  phoneAllowance: z.string().optional(),
  carAllowance: z.string().optional(),
  shiftAllowance: z.string().optional(),
  annualLeaveHoursPerWeek: z.string().optional(),
  sickLeaveHoursPerWeek: z.string().optional(),
  longServiceLeaveHours: z.string().optional(),
  rdoCount: z.coerce.number().optional(),
  rdoAccrual: z.string().optional(),
  notes: z.string().optional(),
});

type EmploymentFormData = z.infer<typeof employmentSchema>;

const documentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().default("other"),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.coerce.number().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  version: z.coerce.number().default(1),
});

type DocumentFormData = z.infer<typeof documentSchema>;

const licenceSchema = z.object({
  licenceType: z.string().min(1, "Licence type is required"),
  licenceNumber: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  documentUrl: z.string().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type LicenceFormData = z.infer<typeof licenceSchema>;

function getExpiryBadgeVariant(expiryDate: string | null | undefined): { variant: "default" | "secondary" | "destructive" | "outline"; label: string } {
  if (!expiryDate) return { variant: "secondary", label: "No expiry" };
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { variant: "destructive", label: expiryDate };
  if (diffDays <= 30) return { variant: "outline", label: expiryDate };
  return { variant: "default", label: expiryDate };
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const defaultEmploymentValues: EmploymentFormData = {
  employmentType: "full_time",
  positionTitle: "",
  jobTitle: "",
  department: "",
  workLocation: "",
  workState: "",
  startDate: "",
  expectedStartDate: "",
  endDate: "",
  probationEndDate: "",
  classificationLevel: "",
  instrumentId: "",
  status: "prospect",
  baseRate: "",
  rateBasis: "hourly",
  payFrequency: "weekly",
  ordinaryRate: "",
  overtime1_5: "",
  overtime2: "",
  saturdayRate: "",
  sundayRate: "",
  publicHolidayRate: "",
  nightShiftRate: "",
  travelAllowance: "",
  mealAllowance: "",
  toolAllowance: "",
  uniformAllowance: "",
  phoneAllowance: "",
  carAllowance: "",
  shiftAllowance: "",
  annualLeaveHoursPerWeek: "",
  sickLeaveHoursPerWeek: "",
  longServiceLeaveHours: "",
  rdoCount: undefined,
  rdoAccrual: "",
  notes: "",
};

const defaultDocumentValues: DocumentFormData = {
  name: "",
  category: "other",
  fileUrl: "",
  fileName: "",
  fileSize: undefined,
  issuedDate: "",
  expiryDate: "",
  notes: "",
  version: 1,
};

const defaultLicenceValues: LicenceFormData = {
  licenceType: "",
  licenceNumber: "",
  issuingAuthority: "",
  issueDate: "",
  expiryDate: "",
  documentUrl: "",
  status: "active",
  notes: "",
};

export default function EmployeeDetailPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/employees/:id");
  const id = params?.id || "";

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [employmentDialogOpen, setEmploymentDialogOpen] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState<EmployeeEmployment | null>(null);
  const [deleteEmploymentOpen, setDeleteEmploymentOpen] = useState(false);
  const [deletingEmploymentId, setDeletingEmploymentId] = useState<string | null>(null);

  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<EmployeeDocument | null>(null);
  const [deleteDocumentOpen, setDeleteDocumentOpen] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const [licenceDialogOpen, setLicenceDialogOpen] = useState(false);
  const [editingLicence, setEditingLicence] = useState<EmployeeLicence | null>(null);
  const [deleteLicenceOpen, setDeleteLicenceOpen] = useState(false);
  const [deletingLicenceId, setDeletingLicenceId] = useState<string | null>(null);

  const [createOnboardingOpen, setCreateOnboardingOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedEmploymentIdForOnboarding, setSelectedEmploymentIdForOnboarding] = useState<string>("");

  const { data: employee, isLoading: employeeLoading } = useQuery<Employee>({
    queryKey: [EMPLOYEE_ROUTES.BY_ID(id)],
    enabled: !!id,
  });

  const { data: employments } = useQuery<EmployeeEmployment[]>({
    queryKey: [EMPLOYEE_ROUTES.EMPLOYMENTS(id)],
    enabled: !!id,
  });

  const { data: documents } = useQuery<EmployeeDocument[]>({
    queryKey: [EMPLOYEE_ROUTES.DOCUMENTS(id)],
    enabled: !!id,
  });

  const { data: licences } = useQuery<EmployeeLicence[]>({
    queryKey: [EMPLOYEE_ROUTES.LICENCES(id)],
    enabled: !!id,
  });

  const { data: onboardings, isLoading: onboardingsLoading } = useQuery<any[]>({
    queryKey: ['/api/employees', id, 'onboardings'],
    enabled: !!id,
  });

  const { data: instruments } = useQuery<any[]>({
    queryKey: ["/api/onboarding/instruments"],
    enabled: !!id,
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/onboarding/templates'],
    enabled: !!id,
  });

  const editForm = useForm<EmployeeEditFormData>({
    resolver: zodResolver(employeeEditSchema),
    defaultValues: {
      employeeNumber: "", firstName: "", lastName: "", middleName: "", preferredName: "",
      dateOfBirth: "", phone: "", email: "", addressLine1: "", addressLine2: "",
      suburb: "", state: "", postcode: "", emergencyContactName: "", emergencyContactPhone: "",
      emergencyContactRelationship: "", isDraftingResource: false, isProductionResource: false,
      isSiteResource: false, receiveEscalatedWorkOrders: false, workRights: true, notes: "", isActive: true,
    },
  });

  const employmentForm = useForm<EmploymentFormData>({
    resolver: zodResolver(employmentSchema),
    defaultValues: defaultEmploymentValues,
  });

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: defaultDocumentValues,
  });

  const licenceForm = useForm<LicenceFormData>({
    resolver: zodResolver(licenceSchema),
    defaultValues: defaultLicenceValues,
  });

  const invalidateEmployee = () => {
    queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.BY_ID(id)] });
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeEditFormData) => {
      return apiRequest("PATCH", EMPLOYEE_ROUTES.BY_ID(id), data);
    },
    onSuccess: () => {
      invalidateEmployee();
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LIST] });
      toast({ title: "Employee updated successfully" });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update employee", description: error.message, variant: "destructive" });
    },
  });

  const createEmploymentMutation = useMutation({
    mutationFn: async (data: EmploymentFormData) => {
      return apiRequest("POST", EMPLOYEE_ROUTES.EMPLOYMENTS(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.EMPLOYMENTS(id)] });
      invalidateEmployee();
      toast({ title: "Employment record created" });
      setEmploymentDialogOpen(false);
      employmentForm.reset(defaultEmploymentValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create employment", description: error.message, variant: "destructive" });
    },
  });

  const updateEmploymentMutation = useMutation({
    mutationFn: async ({ eid, data }: { eid: string; data: EmploymentFormData }) => {
      return apiRequest("PATCH", EMPLOYEE_ROUTES.EMPLOYMENT_BY_ID(id, eid), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.EMPLOYMENTS(id)] });
      invalidateEmployee();
      toast({ title: "Employment record updated" });
      setEmploymentDialogOpen(false);
      setEditingEmployment(null);
      employmentForm.reset(defaultEmploymentValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update employment", description: error.message, variant: "destructive" });
    },
  });

  const deleteEmploymentMutation = useMutation({
    mutationFn: async (eid: string) => {
      return apiRequest("DELETE", EMPLOYEE_ROUTES.EMPLOYMENT_BY_ID(id, eid), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.EMPLOYMENTS(id)] });
      invalidateEmployee();
      toast({ title: "Employment record deleted" });
      setDeleteEmploymentOpen(false);
      setDeletingEmploymentId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete employment", description: error.message, variant: "destructive" });
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      return apiRequest("POST", EMPLOYEE_ROUTES.DOCUMENTS(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.DOCUMENTS(id)] });
      invalidateEmployee();
      toast({ title: "Document created" });
      setDocumentDialogOpen(false);
      documentForm.reset(defaultDocumentValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create document", description: error.message, variant: "destructive" });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ did, data }: { did: string; data: DocumentFormData }) => {
      return apiRequest("PATCH", EMPLOYEE_ROUTES.DOCUMENT_BY_ID(id, did), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.DOCUMENTS(id)] });
      invalidateEmployee();
      toast({ title: "Document updated" });
      setDocumentDialogOpen(false);
      setEditingDocument(null);
      documentForm.reset(defaultDocumentValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update document", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (did: string) => {
      return apiRequest("DELETE", EMPLOYEE_ROUTES.DOCUMENT_BY_ID(id, did), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.DOCUMENTS(id)] });
      invalidateEmployee();
      toast({ title: "Document deleted" });
      setDeleteDocumentOpen(false);
      setDeletingDocumentId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete document", description: error.message, variant: "destructive" });
    },
  });

  const createLicenceMutation = useMutation({
    mutationFn: async (data: LicenceFormData) => {
      return apiRequest("POST", EMPLOYEE_ROUTES.LICENCES(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LICENCES(id)] });
      invalidateEmployee();
      toast({ title: "Licence created" });
      setLicenceDialogOpen(false);
      licenceForm.reset(defaultLicenceValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create licence", description: error.message, variant: "destructive" });
    },
  });

  const updateLicenceMutation = useMutation({
    mutationFn: async ({ lid, data }: { lid: string; data: LicenceFormData }) => {
      return apiRequest("PATCH", EMPLOYEE_ROUTES.LICENCE_BY_ID(id, lid), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LICENCES(id)] });
      invalidateEmployee();
      toast({ title: "Licence updated" });
      setLicenceDialogOpen(false);
      setEditingLicence(null);
      licenceForm.reset(defaultLicenceValues);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update licence", description: error.message, variant: "destructive" });
    },
  });

  const deleteLicenceMutation = useMutation({
    mutationFn: async (lid: string) => {
      return apiRequest("DELETE", EMPLOYEE_ROUTES.LICENCE_BY_ID(id, lid), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_ROUTES.LICENCES(id)] });
      invalidateEmployee();
      toast({ title: "Licence deleted" });
      setDeleteLicenceOpen(false);
      setDeletingLicenceId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete licence", description: error.message, variant: "destructive" });
    },
  });

  const createOnboardingMutation = useMutation({
    mutationFn: async (data: { employmentId: string; templateId?: string; notes?: string }) => {
      return apiRequest("POST", `/api/employees/${id}/onboardings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees', id, 'onboardings'] });
      setCreateOnboardingOpen(false);
      setSelectedTemplateId("");
      setSelectedEmploymentIdForOnboarding("");
      toast({ title: "Onboarding created" });
    },
    onError: () => {
      toast({ title: "Failed to create onboarding", variant: "destructive" });
    },
  });

  const updateOnboardingTaskMutation = useMutation({
    mutationFn: async ({ onboardingId, taskId, data }: { onboardingId: string; taskId: string; data: any }) => {
      return apiRequest("PATCH", `/api/employees/${id}/onboardings/${onboardingId}/tasks/${taskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees', id, 'onboardings'] });
      toast({ title: "Task updated" });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const openEditEmployee = () => {
    if (!employee) return;
    editForm.reset({
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
    setEditDialogOpen(true);
  };

  const openCreateEmployment = () => {
    setEditingEmployment(null);
    employmentForm.reset(defaultEmploymentValues);
    setEmploymentDialogOpen(true);
  };

  const openEditEmployment = (emp: EmployeeEmployment) => {
    setEditingEmployment(emp);
    employmentForm.reset({
      employmentType: emp.employmentType || "full_time",
      positionTitle: emp.positionTitle || "",
      jobTitle: emp.jobTitle || "",
      department: emp.department || "",
      workLocation: emp.workLocation || "",
      workState: emp.workState || "",
      startDate: emp.startDate,
      expectedStartDate: emp.expectedStartDate || "",
      endDate: emp.endDate || "",
      probationEndDate: emp.probationEndDate || "",
      classificationLevel: emp.classificationLevel || "",
      instrumentId: emp.instrumentId || "",
      status: emp.status || "prospect",
      baseRate: emp.baseRate || "",
      rateBasis: emp.rateBasis || "hourly",
      payFrequency: emp.payFrequency || "weekly",
      ordinaryRate: emp.ordinaryRate || "",
      overtime1_5: emp.overtime1_5 || "",
      overtime2: emp.overtime2 || "",
      saturdayRate: emp.saturdayRate || "",
      sundayRate: emp.sundayRate || "",
      publicHolidayRate: emp.publicHolidayRate || "",
      nightShiftRate: emp.nightShiftRate || "",
      travelAllowance: emp.travelAllowance || "",
      mealAllowance: emp.mealAllowance || "",
      toolAllowance: emp.toolAllowance || "",
      uniformAllowance: emp.uniformAllowance || "",
      phoneAllowance: emp.phoneAllowance || "",
      carAllowance: emp.carAllowance || "",
      shiftAllowance: emp.shiftAllowance || "",
      annualLeaveHoursPerWeek: emp.annualLeaveHoursPerWeek || "",
      sickLeaveHoursPerWeek: emp.sickLeaveHoursPerWeek || "",
      longServiceLeaveHours: emp.longServiceLeaveHours || "",
      rdoCount: emp.rdoCount ?? undefined,
      rdoAccrual: emp.rdoAccrual || "",
      notes: emp.notes || "",
    });
    setEmploymentDialogOpen(true);
  };

  const onSubmitEmployment = (data: EmploymentFormData) => {
    const payload = { ...data, instrumentId: data.instrumentId === "none" || !data.instrumentId ? null : data.instrumentId };
    if (editingEmployment) {
      updateEmploymentMutation.mutate({ eid: editingEmployment.id, data: payload });
    } else {
      createEmploymentMutation.mutate(payload);
    }
  };

  const openCreateDocument = () => {
    setEditingDocument(null);
    documentForm.reset(defaultDocumentValues);
    setDocumentDialogOpen(true);
  };

  const openEditDocument = (doc: EmployeeDocument) => {
    setEditingDocument(doc);
    documentForm.reset({
      name: doc.name,
      category: doc.category || "other",
      fileUrl: doc.fileUrl || "",
      fileName: doc.fileName || "",
      fileSize: doc.fileSize ?? undefined,
      issuedDate: doc.issuedDate || "",
      expiryDate: doc.expiryDate || "",
      notes: doc.notes || "",
      version: doc.version,
    });
    setDocumentDialogOpen(true);
  };

  const onSubmitDocument = (data: DocumentFormData) => {
    if (editingDocument) {
      updateDocumentMutation.mutate({ did: editingDocument.id, data });
    } else {
      createDocumentMutation.mutate(data);
    }
  };

  const openCreateLicence = () => {
    setEditingLicence(null);
    licenceForm.reset(defaultLicenceValues);
    setLicenceDialogOpen(true);
  };

  const openEditLicence = (lic: EmployeeLicence) => {
    setEditingLicence(lic);
    licenceForm.reset({
      licenceType: lic.licenceType,
      licenceNumber: lic.licenceNumber || "",
      issuingAuthority: lic.issuingAuthority || "",
      issueDate: lic.issueDate || "",
      expiryDate: lic.expiryDate || "",
      documentUrl: lic.documentUrl || "",
      status: lic.status || "active",
      notes: lic.notes || "",
    });
    setLicenceDialogOpen(true);
  };

  const onSubmitLicence = (data: LicenceFormData) => {
    if (editingLicence) {
      updateLicenceMutation.mutate({ lid: editingLicence.id, data });
    } else {
      createLicenceMutation.mutate(data);
    }
  };

  if (employeeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/admin/employees")} data-testid="button-back-employees">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Employees
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Employee not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/employees")} data-testid="button-back-employees">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-employee-detail-name">
                {employee.firstName} {employee.lastName}
              </h1>
              <PageHelpButton pageHelpKey="page.admin.employee-detail" />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" data-testid="badge-employee-number">{employee.employeeNumber}</Badge>
              <Badge variant={employee.isActive ? "default" : "secondary"} data-testid="badge-employee-status">
                {employee.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={openEditEmployee} data-testid="button-edit-employee">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Employee
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList data-testid="tabs-employee-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employments" data-testid="tab-employments">
            <Briefcase className="h-4 w-4 mr-2" />
            Employment History
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="licences" data-testid="tab-licences">
            <Award className="h-4 w-4 mr-2" />
            Licences
          </TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Onboarding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="First Name" value={employee.firstName} />
                <InfoRow label="Middle Name" value={employee.middleName} />
                <InfoRow label="Last Name" value={employee.lastName} />
                <InfoRow label="Preferred Name" value={employee.preferredName} />
                <InfoRow label="Date of Birth" value={employee.dateOfBirth} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Phone" value={employee.phone} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Address Line 1" value={employee.addressLine1} />
                <InfoRow label="Address Line 2" value={employee.addressLine2} />
                <InfoRow label="Suburb" value={employee.suburb} />
                <InfoRow label="State" value={employee.state} />
                <InfoRow label="Postcode" value={employee.postcode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Name" value={employee.emergencyContactName} />
                <InfoRow label="Phone" value={employee.emergencyContactPhone} />
                <InfoRow label="Relationship" value={employee.emergencyContactRelationship} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resource Flags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {employee.isDraftingResource && <Badge variant="secondary">Drafting</Badge>}
                  {employee.isProductionResource && <Badge variant="secondary">Production</Badge>}
                  {employee.isSiteResource && <Badge variant="secondary">Site</Badge>}
                  {employee.receiveEscalatedWorkOrders && <Badge variant="secondary">Escalated Work Orders</Badge>}
                  {employee.workRights && <Badge variant="secondary">Work Rights</Badge>}
                  {!employee.isDraftingResource && !employee.isProductionResource && !employee.isSiteResource && (
                    <span className="text-muted-foreground text-sm">No resource flags set</span>
                  )}
                </div>
              </CardContent>
            </Card>
            {employee.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{employee.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="employments" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg font-semibold">Employment History</h2>
            <Button onClick={openCreateEmployment} data-testid="button-add-employment">
              <Plus className="h-4 w-4 mr-2" />
              Add Employment
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {employments && employments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Employment Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Base Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employments.map((emp) => (
                      <TableRow key={emp.id} data-testid={`row-employment-${emp.id}`}>
                        <TableCell>
                          <Badge variant={emp.status === "active" ? "default" : "secondary"} data-testid={`badge-employment-status-${emp.id}`}>
                            {statusLabel(emp.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{emp.positionTitle || emp.jobTitle || "-"}</TableCell>
                        <TableCell>{statusLabel(emp.employmentType)}</TableCell>
                        <TableCell>{emp.startDate}</TableCell>
                        <TableCell>{emp.endDate || "-"}</TableCell>
                        <TableCell>{emp.baseRate ? `$${emp.baseRate}` : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditEmployment(emp)} data-testid={`button-edit-employment-${emp.id}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingEmploymentId(emp.id); setDeleteEmploymentOpen(true); }} data-testid={`button-delete-employment-${emp.id}`}>
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
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No employment records yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg font-semibold">Documents</h2>
            <Button onClick={openCreateDocument} data-testid="button-add-document">
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {documents && documents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Issued Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => {
                      const expiry = getExpiryBadgeVariant(doc.expiryDate);
                      return (
                        <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                          <TableCell className="font-medium">{doc.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`badge-document-category-${doc.id}`}>
                              {statusLabel(doc.category)}
                            </Badge>
                          </TableCell>
                          <TableCell>{doc.fileName || "-"}</TableCell>
                          <TableCell>{doc.issuedDate || "-"}</TableCell>
                          <TableCell>
                            {doc.expiryDate ? (
                              <Badge variant={expiry.variant} data-testid={`badge-document-expiry-${doc.id}`}>
                                {expiry.label}
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditDocument(doc)} data-testid={`button-edit-document-${doc.id}`}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingDocumentId(doc.id); setDeleteDocumentOpen(true); }} data-testid={`button-delete-document-${doc.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licences" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg font-semibold">Licences</h2>
            <Button onClick={openCreateLicence} data-testid="button-add-licence">
              <Plus className="h-4 w-4 mr-2" />
              Add Licence
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {licences && licences.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Authority</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licences.map((lic) => {
                      const expiry = getExpiryBadgeVariant(lic.expiryDate);
                      return (
                        <TableRow key={lic.id} data-testid={`row-licence-${lic.id}`}>
                          <TableCell className="font-medium">{lic.licenceType}</TableCell>
                          <TableCell>{lic.licenceNumber || "-"}</TableCell>
                          <TableCell>{lic.issuingAuthority || "-"}</TableCell>
                          <TableCell>{lic.issueDate || "-"}</TableCell>
                          <TableCell>
                            {lic.expiryDate ? (
                              <Badge variant={expiry.variant} data-testid={`badge-licence-expiry-${lic.id}`}>
                                {expiry.label}
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={lic.status === "active" ? "default" : lic.status === "expired" ? "destructive" : "secondary"} data-testid={`badge-licence-status-${lic.id}`}>
                              {statusLabel(lic.status || "active")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditLicence(lic)} data-testid={`button-edit-licence-${lic.id}`}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingLicenceId(lic.id); setDeleteLicenceOpen(true); }} data-testid={`button-delete-licence-${lic.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No licences yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg font-semibold" data-testid="text-onboarding-title">Onboarding</h2>
            <Button onClick={() => setCreateOnboardingOpen(true)} data-testid="button-start-onboarding">
              <Play className="h-4 w-4 mr-2" />
              Start Onboarding
            </Button>
          </div>
          {onboardingsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !onboardings || onboardings.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-onboarding">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No onboarding records yet</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            onboardings.map((ob: any) => {
              const totalTasks = ob.tasks?.length || 0;
              const completedTasks = ob.tasks?.filter((t: any) => t.status === "complete").length || 0;
              const progressValue = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              const employment = employments?.find((e) => e.id === ob.employmentId);
              return (
                <Card key={ob.id} data-testid={`card-onboarding-${ob.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-base">
                      {employment?.positionTitle || "Employment"}{" "}
                      {employment?.startDate ? `(${employment.startDate})` : ""}
                    </CardTitle>
                    <Badge
                      variant={
                        ob.status === "not_started" ? "secondary"
                        : ob.status === "blocked" ? "destructive"
                        : ob.status === "ready_to_start" ? "outline"
                        : ob.status === "complete" ? "default"
                        : ob.status === "withdrawn" ? "secondary"
                        : "default"
                      }
                      className={ob.status === "complete" ? "bg-green-600 text-white" : ""}
                      data-testid={`badge-onboarding-status-${ob.id}`}
                    >
                      {statusLabel(ob.status || "not_started")}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span data-testid={`text-onboarding-progress-${ob.id}`}>{completedTasks} / {totalTasks} tasks</span>
                      </div>
                      <Progress value={progressValue} data-testid={`progress-onboarding-${ob.id}`} />
                    </div>
                    {totalTasks > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ob.tasks.map((task: any) => (
                            <TableRow key={task.id} data-testid={`row-onboarding-task-${task.id}`}>
                              <TableCell className="font-medium">{task.title}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    task.owner === "employee" ? "secondary"
                                    : task.owner === "supervisor" ? "outline"
                                    : task.owner === "hr" ? "default"
                                    : "secondary"
                                  }
                                  data-testid={`badge-task-owner-${task.id}`}
                                >
                                  {statusLabel(task.owner || "employee")}
                                </Badge>
                              </TableCell>
                              <TableCell>{task.dueDate || "-"}</TableCell>
                              <TableCell>
                                {task.status === "complete" ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-task-status-${task.id}`}>
                                      Complete
                                    </Badge>
                                    {task.completedAt && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        {new Date(task.completedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Badge
                                    variant={
                                      task.status === "pending" ? "secondary"
                                      : task.status === "in_progress" ? "default"
                                      : task.status === "blocked" ? "destructive"
                                      : task.status === "skipped" ? "outline"
                                      : "secondary"
                                    }
                                    data-testid={`badge-task-status-${task.id}`}
                                  >
                                    {statusLabel(task.status || "pending")}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {task.status !== "complete" && task.status !== "skipped" && (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateOnboardingTaskMutation.mutate({ onboardingId: ob.id, taskId: task.id, data: { status: "complete" } })}
                                      data-testid={`button-complete-task-${task.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateOnboardingTaskMutation.mutate({ onboardingId: ob.id, taskId: task.id, data: { status: "blocked" } })}
                                      data-testid={`button-block-task-${task.id}`}
                                    >
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateOnboardingTaskMutation.mutate({ onboardingId: ob.id, taskId: task.id, data: { status: "skipped" } })}
                                      data-testid={`button-skip-task-${task.id}`}
                                    >
                                      <SkipForward className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee details</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateEmployeeMutation.mutate(data))} className="space-y-4">
              <FormField control={editForm.control} name="employeeNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Number *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-employee-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editForm.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-first-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="middleName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-middle-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-last-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="preferredName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-preferred-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-edit-dob" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} data-testid="input-edit-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="addressLine1" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-address1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="addressLine2" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-address2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editForm.control} name="suburb" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suburb</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-suburb" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-state"><SelectValue placeholder="Select state" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="postcode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-postcode" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editForm.control} name="emergencyContactName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-emergency-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="emergencyContactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-emergency-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="emergencyContactRelationship" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-emergency-relationship" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="isDraftingResource" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-drafting" /></FormControl>
                    <FormLabel className="!mt-0">Drafting Resource</FormLabel>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isProductionResource" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-production" /></FormControl>
                    <FormLabel className="!mt-0">Production Resource</FormLabel>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isSiteResource" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-site" /></FormControl>
                    <FormLabel className="!mt-0">Site Resource</FormLabel>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="receiveEscalatedWorkOrders" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-escalated" /></FormControl>
                    <FormLabel className="!mt-0">Receive Escalated Work Orders</FormLabel>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="workRights" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-work-rights" /></FormControl>
                    <FormLabel className="!mt-0">Work Rights</FormLabel>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-active" /></FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-edit-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={updateEmployeeMutation.isPending} data-testid="button-save-employee">
                  {updateEmployeeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={employmentDialogOpen} onOpenChange={setEmploymentDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployment ? "Edit Employment" : "Add Employment"}</DialogTitle>
            <DialogDescription>{editingEmployment ? "Update employment record" : "Create a new employment record"}</DialogDescription>
          </DialogHeader>
          <Form {...employmentForm}>
            <form onSubmit={employmentForm.handleSubmit(onSubmitEmployment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={employmentForm.control} name="employmentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-employment-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-employment-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {["prospect", "offer_sent", "offer_accepted", "pre_start", "active", "on_leave", "inactive", "terminated", "archived"].map((s) => (
                          <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={employmentForm.control} name="positionTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-employment-position" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="jobTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-employment-job-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl><Input {...field} data-testid="input-employment-department" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={employmentForm.control} name="workLocation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Location</FormLabel>
                    <FormControl><Input {...field} data-testid="input-employment-location" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="workState" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-employment-work-state"><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="classificationLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classification Level</FormLabel>
                    <FormControl><Input {...field} data-testid="input-employment-classification" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="instrumentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industrial Instrument</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employment-instrument">
                          <SelectValue placeholder="Select instrument (Award/EBA)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {instruments?.filter((i: any) => i.isActive).map((inst: any) => (
                          <SelectItem key={inst.id} value={inst.id}>{inst.name}{inst.code ? ` (${inst.code})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={employmentForm.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-employment-start-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="expectedStartDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-employment-expected-start" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-employment-end-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="probationEndDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probation End Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-employment-probation-end" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <h3 className="text-sm font-semibold pt-2 border-t">Pay Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={employmentForm.control} name="baseRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-base-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="rateBasis" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Basis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-employment-rate-basis"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="payFrequency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-employment-pay-frequency"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <FormField control={employmentForm.control} name="ordinaryRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordinary Rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-ordinary-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="overtime1_5" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime 1.5x</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-overtime15" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="overtime2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime 2x</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-overtime2" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="saturdayRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saturday Rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-saturday-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="sundayRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sunday Rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-sunday-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="publicHolidayRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Holiday Rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-public-holiday-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="nightShiftRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Night Shift Rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-night-shift-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <h3 className="text-sm font-semibold pt-2 border-t">Allowances</h3>
              <div className="grid grid-cols-4 gap-4">
                <FormField control={employmentForm.control} name="travelAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Travel</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-travel-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="mealAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-meal-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="toolAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tool</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-tool-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="uniformAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uniform</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-uniform-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="phoneAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-phone-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="carAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Car</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-car-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="shiftAllowance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-shift-allowance" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <h3 className="text-sm font-semibold pt-2 border-t">Leave</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={employmentForm.control} name="annualLeaveHoursPerWeek" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Leave Hrs/Week</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-annual-leave" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="sickLeaveHoursPerWeek" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sick Leave Hrs/Week</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-sick-leave" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="longServiceLeaveHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Long Service Leave Hrs</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-long-service" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="rdoCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>RDO Count</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value ?? ""} data-testid="input-employment-rdo-count" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employmentForm.control} name="rdoAccrual" render={({ field }) => (
                  <FormItem>
                    <FormLabel>RDO Accrual</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-rdo-accrual" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={employmentForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-employment-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="submit" disabled={createEmploymentMutation.isPending || updateEmploymentMutation.isPending} data-testid="button-save-employment">
                  {(createEmploymentMutation.isPending || updateEmploymentMutation.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {editingEmployment ? "Save Changes" : "Create Employment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDocument ? "Edit Document" : "Add Document"}</DialogTitle>
            <DialogDescription>{editingDocument ? "Update document details" : "Add a new document"}</DialogDescription>
          </DialogHeader>
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit(onSubmitDocument)} className="space-y-4">
              <FormField control={documentForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-document-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={documentForm.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-document-category"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["contract", "variation", "id", "licence", "induction", "policy_acknowledgement", "performance", "termination", "other"].map((c) => (
                        <SelectItem key={c} value={c}>{statusLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={documentForm.control} name="fileUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>File URL</FormLabel>
                    <FormControl><Input {...field} data-testid="input-document-file-url" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={documentForm.control} name="fileName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>File Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-document-file-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={documentForm.control} name="fileSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>File Size (bytes)</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ""} data-testid="input-document-file-size" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={documentForm.control} name="issuedDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-document-issued-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={documentForm.control} name="expiryDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-document-expiry-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={documentForm.control} name="version" render={({ field }) => (
                <FormItem>
                  <FormLabel>Version</FormLabel>
                  <FormControl><Input type="number" {...field} data-testid="input-document-version" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={documentForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-document-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending} data-testid="button-save-document">
                  {(createDocumentMutation.isPending || updateDocumentMutation.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {editingDocument ? "Save Changes" : "Create Document"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={licenceDialogOpen} onOpenChange={setLicenceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLicence ? "Edit Licence" : "Add Licence"}</DialogTitle>
            <DialogDescription>{editingLicence ? "Update licence details" : "Add a new licence"}</DialogDescription>
          </DialogHeader>
          <Form {...licenceForm}>
            <form onSubmit={licenceForm.handleSubmit(onSubmitLicence)} className="space-y-4">
              <FormField control={licenceForm.control} name="licenceType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Licence Type *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-licence-type" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={licenceForm.control} name="licenceNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Licence Number</FormLabel>
                    <FormControl><Input {...field} data-testid="input-licence-number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={licenceForm.control} name="issuingAuthority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuing Authority</FormLabel>
                    <FormControl><Input {...field} data-testid="input-licence-authority" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={licenceForm.control} name="issueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-licence-issue-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={licenceForm.control} name="expiryDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-licence-expiry-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={licenceForm.control} name="documentUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Document URL</FormLabel>
                  <FormControl><Input {...field} data-testid="input-licence-document-url" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={licenceForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-licence-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={licenceForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-licence-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={createLicenceMutation.isPending || updateLicenceMutation.isPending} data-testid="button-save-licence">
                  {(createLicenceMutation.isPending || updateLicenceMutation.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {editingLicence ? "Save Changes" : "Create Licence"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteEmploymentOpen} onOpenChange={setDeleteEmploymentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employment Record</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this employment record? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-employment">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingEmploymentId && deleteEmploymentMutation.mutate(deletingEmploymentId)} data-testid="button-confirm-delete-employment">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDocumentOpen} onOpenChange={setDeleteDocumentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this document? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-document">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDocumentId && deleteDocumentMutation.mutate(deletingDocumentId)} data-testid="button-confirm-delete-document">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteLicenceOpen} onOpenChange={setDeleteLicenceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Licence</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this licence? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-licence">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingLicenceId && deleteLicenceMutation.mutate(deletingLicenceId)} data-testid="button-confirm-delete-licence">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOnboardingOpen} onOpenChange={setCreateOnboardingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Onboarding</DialogTitle>
            <DialogDescription>Create a new onboarding process for this employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Employment</label>
              <Select value={selectedEmploymentIdForOnboarding} onValueChange={setSelectedEmploymentIdForOnboarding}>
                <SelectTrigger data-testid="select-onboarding-employment">
                  <SelectValue placeholder="Select employment" />
                </SelectTrigger>
                <SelectContent>
                  {employments?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} data-testid={`select-onboarding-employment-${emp.id}`}>
                      {emp.positionTitle || emp.jobTitle || "Employment"} - {emp.startDate || "No start date"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Template (Optional)</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger data-testid="select-onboarding-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates?.map((tmpl: any) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} data-testid={`select-onboarding-template-${tmpl.id}`}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!selectedEmploymentIdForOnboarding) return;
                createOnboardingMutation.mutate({
                  employmentId: selectedEmploymentIdForOnboarding,
                  templateId: selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : undefined,
                });
              }}
              disabled={!selectedEmploymentIdForOnboarding || createOnboardingMutation.isPending}
              data-testid="button-submit-onboarding"
            >
              {createOnboardingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Start Onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}
