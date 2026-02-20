import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, Edit2, Briefcase, FileText, Award, User, ClipboardCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHelpButton } from "@/components/help/page-help-button";
import type { Employee, EmployeeEmployment, EmployeeDocument, EmployeeLicence, Department } from "@shared/schema";
import { EMPLOYEE_ROUTES, ONBOARDING_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import {
  employeeEditSchema, employmentSchema, documentSchema, licenceSchema,
  defaultEmploymentValues, defaultDocumentValues, defaultLicenceValues,
  CONSTRUCTION_TICKET_TYPES,
} from "./types";
import type { EmployeeEditFormData, EmploymentFormData, DocumentFormData, LicenceFormData } from "./types";
import { OverviewTab } from "./OverviewTab";
import { EmploymentsTab } from "./EmploymentsTab";
import { DocumentsTab } from "./DocumentsTab";
import { LicencesTab } from "./LicencesTab";
import { OnboardingTab } from "./OnboardingTab";
import {
  EditEmployeeDialog, EmploymentDialog, DocumentDialog, LicenceDialog,
  DeleteConfirmDialog, CreateOnboardingDialog,
} from "./EmployeeDialogs";

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
  const [useCustomLicenceType, setUseCustomLicenceType] = useState(false);

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

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: [ADMIN_ROUTES.DEPARTMENTS],
  });
  const activeDepartments = departmentsList.filter((d) => d.isActive);

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
      departmentId: emp.departmentId || null,
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
    setUseCustomLicenceType(false);
    licenceForm.reset(defaultLicenceValues);
    setLicenceDialogOpen(true);
  };

  const openEditLicence = (lic: EmployeeLicence) => {
    setEditingLicence(lic);
    const isPreset = CONSTRUCTION_TICKET_TYPES.some(t => t.value === lic.licenceType);
    setUseCustomLicenceType(!isPreset);
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
      <div className="space-y-6" role="main" aria-label="Employee Detail">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6" role="main" aria-label="Employee Detail">
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
    <div className="space-y-6" role="main" aria-label="Employee Detail">
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
          <OverviewTab employee={employee} />
        </TabsContent>

        <TabsContent value="employments" className="space-y-4">
          <EmploymentsTab
            employments={employments}
            onAdd={openCreateEmployment}
            onEdit={openEditEmployment}
            onDelete={(eid) => { setDeletingEmploymentId(eid); setDeleteEmploymentOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentsTab
            documents={documents}
            onAdd={openCreateDocument}
            onEdit={openEditDocument}
            onDelete={(did) => { setDeletingDocumentId(did); setDeleteDocumentOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="licences" className="space-y-4">
          <LicencesTab
            licences={licences}
            onAdd={openCreateLicence}
            onEdit={openEditLicence}
            onDelete={(lid) => { setDeletingLicenceId(lid); setDeleteLicenceOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <OnboardingTab
            onboardings={onboardings}
            onboardingsLoading={onboardingsLoading}
            employments={employments}
            onStartOnboarding={() => setCreateOnboardingOpen(true)}
            onUpdateTask={(params) => updateOnboardingTaskMutation.mutate(params)}
          />
        </TabsContent>
      </Tabs>

      <EditEmployeeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={editForm}
        onSubmit={(data) => updateEmployeeMutation.mutate(data)}
        isPending={updateEmployeeMutation.isPending}
      />

      <EmploymentDialog
        open={employmentDialogOpen}
        onOpenChange={setEmploymentDialogOpen}
        form={employmentForm}
        onSubmit={onSubmitEmployment}
        isPending={createEmploymentMutation.isPending || updateEmploymentMutation.isPending}
        isEditing={!!editingEmployment}
        instruments={instruments}
        activeDepartments={activeDepartments}
      />

      <DocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        form={documentForm}
        onSubmit={onSubmitDocument}
        isPending={createDocumentMutation.isPending || updateDocumentMutation.isPending}
        isEditing={!!editingDocument}
      />

      <LicenceDialog
        open={licenceDialogOpen}
        onOpenChange={setLicenceDialogOpen}
        form={licenceForm}
        onSubmit={onSubmitLicence}
        isPending={createLicenceMutation.isPending || updateLicenceMutation.isPending}
        isEditing={!!editingLicence}
        useCustomLicenceType={useCustomLicenceType}
        setUseCustomLicenceType={setUseCustomLicenceType}
      />

      <DeleteConfirmDialog
        open={deleteEmploymentOpen}
        onOpenChange={setDeleteEmploymentOpen}
        onConfirm={() => deletingEmploymentId && deleteEmploymentMutation.mutate(deletingEmploymentId)}
        title="Delete Employment Record"
        description="Are you sure you want to delete this employment record? This action cannot be undone."
        confirmTestId="button-confirm-delete-employment"
        cancelTestId="button-cancel-delete-employment"
      />

      <DeleteConfirmDialog
        open={deleteDocumentOpen}
        onOpenChange={setDeleteDocumentOpen}
        onConfirm={() => deletingDocumentId && deleteDocumentMutation.mutate(deletingDocumentId)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmTestId="button-confirm-delete-document"
        cancelTestId="button-cancel-delete-document"
      />

      <DeleteConfirmDialog
        open={deleteLicenceOpen}
        onOpenChange={setDeleteLicenceOpen}
        onConfirm={() => deletingLicenceId && deleteLicenceMutation.mutate(deletingLicenceId)}
        title="Delete Licence"
        description="Are you sure you want to delete this licence? This action cannot be undone."
        confirmTestId="button-confirm-delete-licence"
        cancelTestId="button-cancel-delete-licence"
      />

      <CreateOnboardingDialog
        open={createOnboardingOpen}
        onOpenChange={setCreateOnboardingOpen}
        employments={employments}
        templates={templates}
        selectedEmploymentId={selectedEmploymentIdForOnboarding}
        setSelectedEmploymentId={setSelectedEmploymentIdForOnboarding}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        onSubmit={() => {
          if (!selectedEmploymentIdForOnboarding) return;
          createOnboardingMutation.mutate({
            employmentId: selectedEmploymentIdForOnboarding,
            templateId: selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : undefined,
          });
        }}
        isPending={createOnboardingMutation.isPending}
      />
    </div>
  );
}
