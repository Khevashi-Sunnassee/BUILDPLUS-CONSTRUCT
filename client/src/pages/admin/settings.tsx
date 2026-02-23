import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Calendar, Clock, Mail, Database, Loader2, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { GlobalSettings, Department } from "@shared/schema";
import { ADMIN_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import "react-quill-new/dist/quill.snow.css";
import { CompanyTab } from "./settings/CompanyTab";
import { SchedulingTab } from "./settings/SchedulingTab";
import { TimeTrackingTab } from "./settings/TimeTrackingTab";
import { EmailTab } from "./settings/EmailTab";
import { DataTab } from "./settings/DataTab";
import { FactoriesTab } from "./settings/FactoriesTab";

const settingsSchema = z.object({
  tz: z.string().min(1, "Timezone is required"),
  captureIntervalS: z.number().int().min(60).max(900),
  idleThresholdS: z.number().int().min(60).max(900),
  trackedApps: z.string().min(1, "At least one app must be tracked"),
  requireAddins: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function AdminSettingsPage() {
  useDocumentTitle("Settings");
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [weekStartDay, setWeekStartDay] = useState<number>(1);
  const [productionWindowDays, setProductionWindowDays] = useState<number>(10);
  const [ifcDaysInAdvance, setIfcDaysInAdvance] = useState<number>(14);
  const [daysToAchieveIfc, setDaysToAchieveIfc] = useState<number>(21);
  const [productionDaysInAdvance, setProductionDaysInAdvance] = useState<number>(10);
  const [procurementDaysInAdvance, setProcurementDaysInAdvance] = useState<number>(7);
  const [procurementTimeDays, setProcurementTimeDays] = useState<number>(14);
  const [productionWorkDays, setProductionWorkDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [draftingWorkDays, setDraftingWorkDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [cfmeuCalendar, setCfmeuCalendar] = useState<string>("NONE");
  const [includePOTerms, setIncludePOTerms] = useState(false);
  const [jobNumberPrefix, setJobNumberPrefix] = useState("");
  const [jobNumberMinDigits, setJobNumberMinDigits] = useState(3);
  const [jobNumberNextSequence, setJobNumberNextSequence] = useState(1);
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDescription, setDeptDescription] = useState("");
  const [deptActive, setDeptActive] = useState(true);
  const [showDeleteDeptDialog, setShowDeleteDeptDialog] = useState(false);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const [emailTemplatePreviewHtml, setEmailTemplatePreviewHtml] = useState<string | null>(null);
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false);
  const [editTemplateValue, setEditTemplateValue] = useState("");
  const [templateEditMode, setTemplateEditMode] = useState<"visual" | "source">("visual");

  const [inboxApEmail, setInboxApEmail] = useState("");
  const [inboxTenderEmail, setInboxTenderEmail] = useState("");
  const [inboxDraftingEmail, setInboxDraftingEmail] = useState("");

  const deletionCategories = useMemo(() => [
    { key: "activity_templates", label: "Activity Templates", description: "Workflow activity templates and subtasks" },
    { key: "assets", label: "Assets", description: "Asset register entries, maintenance records and transfers" },
    { key: "boq", label: "Bill of Quantities", description: "BOQ groups and items across all jobs" },
    { key: "broadcast_templates", label: "Broadcast Templates", description: "Broadcast templates and messages" },
    { key: "budgets", label: "Budgets", description: "Job budgets, budget lines and files" },
    { key: "chats", label: "Chats", description: "All conversations and messages" },
    { key: "contracts", label: "Contracts", description: "All contract records" },
    { key: "cost_codes", label: "Cost Codes", description: "Parent and child cost codes, job defaults" },
    { key: "daily_logs", label: "Daily Logs", description: "Time tracking logs and entries" },
    { key: "documents", label: "Documents", description: "Document register entries and bundle links" },
    { key: "drafting_program", label: "Drafting Program", description: "Drafting program entries" },
    { key: "job_activities", label: "Job Activities", description: "Job activity instances, assignees, updates and files" },
    { key: "jobs", label: "Jobs", description: "All job records" },
    { key: "logistics", label: "Logistics", description: "Load lists and delivery records" },
    { key: "panels", label: "Panels", description: "Panel register entries" },
    { key: "production_slots", label: "Production Slots", description: "Scheduled production slots" },
    { key: "progress_claims", label: "Progress Claims", description: "Progress claims and line items" },
    { key: "purchase_orders", label: "Purchase Orders", description: "All purchase orders and line items" },
    { key: "suppliers", label: "Suppliers", description: "Suppliers and item catalog" },
    { key: "tasks", label: "Tasks", description: "Task groups and tasks" },
    { key: "tenders", label: "Tenders", description: "Tenders, submissions, line items and packages" },
    { key: "weekly_wages", label: "Weekly Wages", description: "Weekly wage reports" },
    { key: "ap_invoices", label: "Invoices", description: "AP invoices, documents, splits, approvals and comments" },
  ], []);

  const dayNames = useMemo(() => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], []);

  const { data: settings, isLoading } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  useEffect(() => {
    if (settings?.companyName) {
      setCompanyName(settings.companyName);
    }
    if (settings?.weekStartDay !== undefined) {
      setWeekStartDay(settings.weekStartDay);
    }
    if (settings?.productionWindowDays !== undefined) {
      setProductionWindowDays(settings.productionWindowDays);
    }
    if (settings?.ifcDaysInAdvance !== undefined) {
      setIfcDaysInAdvance(settings.ifcDaysInAdvance);
    }
    if (settings?.daysToAchieveIfc !== undefined) {
      setDaysToAchieveIfc(settings.daysToAchieveIfc);
    }
    if (settings?.productionDaysInAdvance !== undefined) {
      setProductionDaysInAdvance(settings.productionDaysInAdvance);
    }
    if (settings?.procurementDaysInAdvance !== undefined) {
      setProcurementDaysInAdvance(settings.procurementDaysInAdvance);
    }
    if (settings?.procurementTimeDays !== undefined) {
      setProcurementTimeDays(settings.procurementTimeDays);
    }
    if (settings?.productionWorkDays) {
      setProductionWorkDays(settings.productionWorkDays as boolean[]);
    }
    if (settings?.draftingWorkDays) {
      setDraftingWorkDays(settings.draftingWorkDays as boolean[]);
    }
    if (settings?.cfmeuCalendar) {
      setCfmeuCalendar(settings.cfmeuCalendar);
    }
    if (settings?.includePOTerms !== undefined) {
      setIncludePOTerms(settings.includePOTerms);
    }
    if (settings?.jobNumberPrefix !== undefined) {
      setJobNumberPrefix(settings.jobNumberPrefix || "");
    }
    if (settings?.jobNumberMinDigits !== undefined) {
      setJobNumberMinDigits(settings.jobNumberMinDigits);
    }
    if (settings?.jobNumberNextSequence !== undefined) {
      setJobNumberNextSequence(settings.jobNumberNextSequence);
    }
  }, [settings?.companyName, settings?.weekStartDay, settings?.productionWindowDays, settings?.ifcDaysInAdvance, settings?.daysToAchieveIfc, settings?.productionDaysInAdvance, settings?.procurementDaysInAdvance, settings?.procurementTimeDays, settings?.productionWorkDays, settings?.draftingWorkDays, settings?.cfmeuCalendar, settings?.includePOTerms, settings?.jobNumberPrefix, settings?.jobNumberMinDigits, settings?.jobNumberNextSequence]);

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: [ADMIN_ROUTES.DEPARTMENTS],
  });

  const openDeptDialog = useCallback((dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.name);
      setDeptCode(dept.code);
      setDeptDescription(dept.description || "");
      setDeptActive(dept.isActive ?? true);
    } else {
      setEditingDept(null);
      setDeptName("");
      setDeptCode("");
      setDeptDescription("");
      setDeptActive(true);
    }
    setShowDeptDialog(true);
  }, []);

  const closeDeptDialog = useCallback(() => {
    setShowDeptDialog(false);
    setEditingDept(null);
    setDeptName("");
    setDeptCode("");
    setDeptDescription("");
    setDeptActive(true);
  }, []);

  const saveDeptMutation = useMutation({
    mutationFn: async () => {
      const body = { name: deptName, code: deptCode, description: deptDescription || null, isActive: deptActive };
      if (editingDept) {
        return apiRequest("PUT", ADMIN_ROUTES.DEPARTMENT_BY_ID(editingDept.id), body);
      }
      return apiRequest("POST", ADMIN_ROUTES.DEPARTMENTS, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.DEPARTMENTS] });
      toast({ title: editingDept ? "Department updated" : "Department created" });
      closeDeptDialog();
    },
    onError: (error: Error) => {
      let description = error.message;
      try {
        const parsed = JSON.parse(error.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: "Error", description: description || "Failed to save department", variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.DEPARTMENT_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.DEPARTMENTS] });
      toast({ title: "Department deleted" });
      setShowDeleteDeptDialog(false);
      setDeletingDept(null);
    },
    onError: (error: Error) => {
      let description = error.message;
      try {
        const parsed = JSON.parse(error.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: "Error", description: description || "Failed to delete department", variant: "destructive" });
    },
  });

  const saveCompanyNameMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", ADMIN_ROUTES.SETTINGS_COMPANY_NAME, { companyName: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.LOGO] });
      toast({ title: "Company name saved" });
    },
    onError: () => {
      toast({ title: "Failed to save company name", variant: "destructive" });
    },
  });

  const saveWeekStartDayMutation = useMutation({
    mutationFn: async (day: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { weekStartDay: day });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Week start day saved" });
    },
    onError: () => {
      toast({ title: "Failed to save week start day", variant: "destructive" });
    },
  });

  const saveProductionWindowDaysMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { productionWindowDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Production window days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production window days", variant: "destructive" });
    },
  });

  const saveIfcDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { ifcDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "IFC days in advance saved" });
    },
    onError: () => {
      toast({ title: "Failed to save IFC days in advance", variant: "destructive" });
    },
  });

  const saveDaysToAchieveIfcMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { daysToAchieveIfc: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Days to achieve IFC saved" });
    },
    onError: () => {
      toast({ title: "Failed to save days to achieve IFC", variant: "destructive" });
    },
  });

  const saveProductionDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { productionDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Production days in advance saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production days in advance", variant: "destructive" });
    },
  });

  const saveProcurementDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      if (days >= ifcDaysInAdvance) {
        throw new Error(`Procurement days must be less than IFC days in advance (${ifcDaysInAdvance})`);
      }
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { procurementDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Procurement days in advance saved" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to save procurement days in advance", variant: "destructive" });
    },
  });

  const saveProcurementTimeDaysMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { procurementTimeDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Procurement time days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save procurement time days", variant: "destructive" });
    },
  });

  const saveProductionWorkDaysMutation = useMutation({
    mutationFn: async (days: boolean[]) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { productionWorkDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Production work days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production work days", variant: "destructive" });
    },
  });

  const saveDraftingWorkDaysMutation = useMutation({
    mutationFn: async (days: boolean[]) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { draftingWorkDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Drafting work days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save drafting work days", variant: "destructive" });
    },
  });

  const saveCfmeuCalendarMutation = useMutation({
    mutationFn: async (calendar: string) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { cfmeuCalendar: calendar });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "CFMEU calendar saved" });
    },
    onError: () => {
      toast({ title: "Failed to save CFMEU calendar", variant: "destructive" });
    },
  });

  const saveIncludePOTermsMutation = useMutation({
    mutationFn: async (val: boolean) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { includePOTerms: val });
    },
    onSuccess: (_data, val) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: val ? "PO Terms will be included on printed Purchase Orders" : "PO Terms will not be included on printed Purchase Orders" });
    },
    onError: () => {
      toast({ title: "Failed to save setting", variant: "destructive" });
    },
  });

  const saveJobNumberSettingsMutation = useMutation({
    mutationFn: async (data: { jobNumberPrefix: string; jobNumberMinDigits: number; jobNumberNextSequence: number }) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Job number settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save job number settings", variant: "destructive" });
    },
  });

  interface CfmeuCalendarData {
    holidays: Array<{
      id: string;
      calendarType: string;
      date: string;
      name: string;
      holidayType: string;
      year: number;
    }>;
    summary: Record<string, { count: number; years: number[] }>;
  }

  const { data: cfmeuCalendarData, isLoading: cfmeuLoading } = useQuery<CfmeuCalendarData>({
    queryKey: [ADMIN_ROUTES.CFMEU_CALENDARS],
  });

  const syncCfmeuCalendarMutation = useMutation({
    mutationFn: async (calendarType: string) => {
      const response = await apiRequest("POST", ADMIN_ROUTES.CFMEU_SYNC, { calendarType });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.CFMEU_CALENDARS] });
      toast({ title: data.message || "Calendar synced successfully" });
    },
    onError: () => {
      toast({ title: "Failed to sync calendar", variant: "destructive" });
    },
  });

  const syncAllCfmeuCalendarsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", ADMIN_ROUTES.CFMEU_SYNC_ALL, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.CFMEU_CALENDARS] });
      toast({ title: "All calendars synced successfully" });
    },
    onError: () => {
      toast({ title: "Failed to sync calendars", variant: "destructive" });
    },
  });

  const { data: dataCounts, refetch: refetchCounts } = useQuery<Record<string, number>>({
    queryKey: [ADMIN_ROUTES.DATA_DELETION_COUNTS],
    enabled: showDeletePanel,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const validateDeletionMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const response = await apiRequest("POST", ADMIN_ROUTES.DATA_DELETION_VALIDATE, { categories });
      return response.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      if (data.valid) {
        setShowConfirmDialog(true);
      }
    },
    onError: () => {
      toast({ title: "Failed to validate deletion", variant: "destructive" });
    },
  });

  const performDeletionMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const response = await apiRequest("POST", ADMIN_ROUTES.DATA_DELETION_DELETE, { categories });
      return response.json();
    },
    onSuccess: (data) => {
      setShowConfirmDialog(false);
      setSelectedCategories(new Set());
      setValidationResult(null);
      refetchCounts();
      const totalDeleted = Object.values(data.deleted as Record<string, number>).reduce((a, b) => a + b, 0);
      toast({ title: `Successfully deleted ${totalDeleted} records` });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({ title: "Failed to delete data", variant: "destructive" });
    },
  });

  const { data: inboxEmailsData, isLoading: inboxEmailsLoading } = useQuery<{ apInboxEmail: string | null; tenderInboxEmail: string | null; draftingInboxEmail: string | null }>({
    queryKey: ["/api/settings/inbox-emails"],
  });

  useEffect(() => {
    if (inboxEmailsData) {
      setInboxApEmail(inboxEmailsData.apInboxEmail || "");
      setInboxTenderEmail(inboxEmailsData.tenderInboxEmail || "");
      setInboxDraftingEmail(inboxEmailsData.draftingInboxEmail || "");
    }
  }, [inboxEmailsData]);

  const saveInboxEmailsMutation = useMutation({
    mutationFn: async (data: { apInboxEmail?: string | null; tenderInboxEmail?: string | null; draftingInboxEmail?: string | null }) => {
      const res = await apiRequest("PUT", "/api/settings/inbox-emails", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/inbox-emails"] });
      toast({ title: "Inbox email addresses saved successfully" });
    },
    onError: (err: Error) => {
      let description = err.message;
      try {
        const parsed = JSON.parse(err.message);
        description = parsed.error || parsed.message || description;
      } catch { /* use raw message */ }
      toast({ title: description || "Failed to save inbox emails", variant: "destructive" });
    },
  });

  const { data: emailTemplateData, isLoading: emailTemplateLoading } = useQuery<{ emailTemplateHtml: string | null; defaultTemplate: string }>({
    queryKey: ["/api/settings/email-template"],
  });

  const emailTemplatePreviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/email-template/preview");
      return response.json();
    },
    onSuccess: (data: { html: string }) => {
      setEmailTemplatePreviewHtml(data.html);
    },
    onError: () => {
      toast({ title: "Failed to generate preview", variant: "destructive" });
    },
  });

  const saveEmailTemplateMutation = useMutation({
    mutationFn: async (emailTemplateHtml: string | null) => {
      return apiRequest("PUT", "/api/settings/email-template", { emailTemplateHtml });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email-template"] });
      setShowEditTemplateDialog(false);
      toast({ title: "Email template saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save email template", variant: "destructive" });
    },
  });

  const resetEmailTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/settings/email-template", { emailTemplateHtml: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email-template"] });
      setEmailTemplatePreviewHtml(null);
      toast({ title: "Email template reset to default" });
    },
    onError: () => {
      toast({ title: "Failed to reset email template", variant: "destructive" });
    },
  });

  const handleCategoryToggle = useCallback((key: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
    setValidationResult(null);
  }, []);

  const handleValidateAndDelete = useCallback(() => {
    if (selectedCategories.size === 0) {
      toast({ title: "Please select at least one category", variant: "destructive" });
      return;
    }
    validateDeletionMutation.mutate(Array.from(selectedCategories));
  }, [selectedCategories, toast, validateDeletionMutation]);

  const handleConfirmDelete = useCallback(() => {
    performDeletionMutation.mutate(Array.from(selectedCategories));
  }, [selectedCategories, performDeletionMutation]);

  const uploadLogoMutation = useMutation({
    mutationFn: async (logoBase64: string) => {
      return apiRequest("POST", ADMIN_ROUTES.SETTINGS_LOGO, { logoBase64 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.LOGO] });
      toast({ title: "Logo uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.SETTINGS_LOGO, { logoBase64: "" });
    },
    onSuccess: () => {
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.LOGO] });
      toast({ title: "Logo removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove logo", variant: "destructive" });
    },
  });

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo must be less than 2MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setLogoPreview(base64);
      uploadLogoMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }, [toast, uploadLogoMutation, logoInputRef]);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      tz: "Australia/Melbourne",
      captureIntervalS: 300,
      idleThresholdS: 300,
      trackedApps: "revit,acad",
      requireAddins: true,
    },
    values: settings ? {
      tz: settings.tz,
      captureIntervalS: settings.captureIntervalS,
      idleThresholdS: settings.idleThresholdS,
      trackedApps: settings.trackedApps,
      requireAddins: settings.requireAddins,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const onSubmit = useCallback((data: SettingsFormData) => {
    updateMutation.mutate(data);
  }, [updateMutation]);

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="System Settings" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="System Settings">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
            Global Settings
          </h1>
          <PageHelpButton pageHelpKey="page.admin.settings" />
        </div>
        <p className="text-muted-foreground">
          Configure system-wide parameters and preferences
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tabs-settings">
          <TabsTrigger value="company" data-testid="tab-company">
            <Building2 className="h-4 w-4 mr-1.5" />
            Company
          </TabsTrigger>
          <TabsTrigger value="scheduling" data-testid="tab-scheduling">
            <Calendar className="h-4 w-4 mr-1.5" />
            Scheduling
          </TabsTrigger>
          <TabsTrigger value="time-tracking" data-testid="tab-time-tracking">
            <Clock className="h-4 w-4 mr-1.5" />
            Time Tracking
          </TabsTrigger>
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail className="h-4 w-4 mr-1.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="factories" data-testid="tab-factories">
            <Factory className="h-4 w-4 mr-1.5" />
            Factories
          </TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">
            <Database className="h-4 w-4 mr-1.5" />
            Data Management
          </TabsTrigger>
        </TabsList>

        <CompanyTab
          settings={settings}
          companyName={companyName}
          setCompanyName={setCompanyName}
          saveCompanyNameMutation={saveCompanyNameMutation}
          logoPreview={logoPreview}
          logoInputRef={logoInputRef}
          handleLogoUpload={handleLogoUpload}
          uploadLogoMutation={uploadLogoMutation}
          removeLogoMutation={removeLogoMutation}
          departments={departments}
          deptsLoading={deptsLoading}
          openDeptDialog={openDeptDialog}
          setDeletingDept={setDeletingDept}
          setShowDeleteDeptDialog={setShowDeleteDeptDialog}
          jobNumberPrefix={jobNumberPrefix}
          setJobNumberPrefix={setJobNumberPrefix}
          jobNumberMinDigits={jobNumberMinDigits}
          setJobNumberMinDigits={setJobNumberMinDigits}
          jobNumberNextSequence={jobNumberNextSequence}
          setJobNumberNextSequence={setJobNumberNextSequence}
          saveJobNumberSettingsMutation={saveJobNumberSettingsMutation}
          includePOTerms={includePOTerms}
          setIncludePOTerms={setIncludePOTerms}
          saveIncludePOTermsMutation={saveIncludePOTermsMutation}
        />

        <SchedulingTab
          settings={settings}
          dayNames={dayNames}
          weekStartDay={weekStartDay}
          setWeekStartDay={setWeekStartDay}
          saveWeekStartDayMutation={saveWeekStartDayMutation}
          productionWindowDays={productionWindowDays}
          setProductionWindowDays={setProductionWindowDays}
          saveProductionWindowDaysMutation={saveProductionWindowDaysMutation}
          ifcDaysInAdvance={ifcDaysInAdvance}
          setIfcDaysInAdvance={setIfcDaysInAdvance}
          saveIfcDaysInAdvanceMutation={saveIfcDaysInAdvanceMutation}
          daysToAchieveIfc={daysToAchieveIfc}
          setDaysToAchieveIfc={setDaysToAchieveIfc}
          saveDaysToAchieveIfcMutation={saveDaysToAchieveIfcMutation}
          productionDaysInAdvance={productionDaysInAdvance}
          setProductionDaysInAdvance={setProductionDaysInAdvance}
          saveProductionDaysInAdvanceMutation={saveProductionDaysInAdvanceMutation}
          procurementDaysInAdvance={procurementDaysInAdvance}
          setProcurementDaysInAdvance={setProcurementDaysInAdvance}
          saveProcurementDaysInAdvanceMutation={saveProcurementDaysInAdvanceMutation}
          procurementTimeDays={procurementTimeDays}
          setProcurementTimeDays={setProcurementTimeDays}
          saveProcurementTimeDaysMutation={saveProcurementTimeDaysMutation}
          productionWorkDays={productionWorkDays}
          setProductionWorkDays={setProductionWorkDays}
          saveProductionWorkDaysMutation={saveProductionWorkDaysMutation}
          draftingWorkDays={draftingWorkDays}
          setDraftingWorkDays={setDraftingWorkDays}
          saveDraftingWorkDaysMutation={saveDraftingWorkDaysMutation}
          cfmeuCalendar={cfmeuCalendar}
          setCfmeuCalendar={setCfmeuCalendar}
          saveCfmeuCalendarMutation={saveCfmeuCalendarMutation}
          cfmeuCalendarData={cfmeuCalendarData}
          cfmeuLoading={cfmeuLoading}
          syncCfmeuCalendarMutation={syncCfmeuCalendarMutation}
          syncAllCfmeuCalendarsMutation={syncAllCfmeuCalendarsMutation}
        />

        <TimeTrackingTab
          form={form}
          onSubmit={onSubmit}
          updateMutation={updateMutation}
        />

        <EmailTab
          inboxApEmail={inboxApEmail}
          setInboxApEmail={setInboxApEmail}
          inboxTenderEmail={inboxTenderEmail}
          setInboxTenderEmail={setInboxTenderEmail}
          inboxDraftingEmail={inboxDraftingEmail}
          setInboxDraftingEmail={setInboxDraftingEmail}
          inboxEmailsLoading={inboxEmailsLoading}
          saveInboxEmailsMutation={saveInboxEmailsMutation}
          emailTemplateData={emailTemplateData}
          emailTemplateLoading={emailTemplateLoading}
          emailTemplatePreviewMutation={emailTemplatePreviewMutation}
          emailTemplatePreviewHtml={emailTemplatePreviewHtml}
          showEditTemplateDialog={showEditTemplateDialog}
          setShowEditTemplateDialog={setShowEditTemplateDialog}
          editTemplateValue={editTemplateValue}
          setEditTemplateValue={setEditTemplateValue}
          templateEditMode={templateEditMode}
          setTemplateEditMode={setTemplateEditMode}
          saveEmailTemplateMutation={saveEmailTemplateMutation}
          resetEmailTemplateMutation={resetEmailTemplateMutation}
        />

        <FactoriesTab />

        <DataTab
          showDeletePanel={showDeletePanel}
          setShowDeletePanel={setShowDeletePanel}
          refetchCounts={refetchCounts}
          deletionCategories={deletionCategories}
          dataCounts={dataCounts}
          selectedCategories={selectedCategories}
          handleCategoryToggle={handleCategoryToggle}
          validationResult={validationResult}
          setValidationResult={setValidationResult}
          handleValidateAndDelete={handleValidateAndDelete}
          validateDeletionMutation={validateDeletionMutation}
          setSelectedCategories={setSelectedCategories}
          showConfirmDialog={showConfirmDialog}
          setShowConfirmDialog={setShowConfirmDialog}
          handleConfirmDelete={handleConfirmDelete}
          performDeletionMutation={performDeletionMutation}
        />
      </Tabs>

      <Dialog open={showDeptDialog} onOpenChange={(o) => !o && closeDeptDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>
              {editingDept ? "Update the department details below." : "Create a new department for your organisation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="deptName">Name</Label>
              <Input
                id="deptName"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. Engineering"
                data-testid="input-dept-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptCode">Code</Label>
              <Input
                id="deptCode"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="e.g. ENG"
                data-testid="input-dept-code"
              />
              <p className="text-xs text-muted-foreground">A short unique code for this department</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptDesc">Description (optional)</Label>
              <Textarea
                id="deptDesc"
                value={deptDescription}
                onChange={(e) => setDeptDescription(e.target.value)}
                placeholder="Brief description of this department"
                rows={2}
                data-testid="input-dept-description"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={deptActive}
                onCheckedChange={setDeptActive}
                data-testid="switch-dept-active"
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeptDialog} aria-label="Cancel department changes" data-testid="button-dept-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => saveDeptMutation.mutate()}
              disabled={!deptName.trim() || !deptCode.trim() || saveDeptMutation.isPending}
              aria-label={editingDept ? "Update department" : "Create department"}
              data-testid="button-dept-save"
            >
              {saveDeptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDept ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDeptDialog} onOpenChange={(o) => !o && setShowDeleteDeptDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingDept?.name}"? Users currently assigned to this department will become unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDeptDialog(false)} aria-label="Cancel department deletion" data-testid="button-delete-dept-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingDept && deleteDeptMutation.mutate(deletingDept.id)}
              disabled={deleteDeptMutation.isPending}
              aria-label={`Delete department ${deletingDept?.name || ""}`}
              data-testid="button-delete-dept-confirm"
            >
              {deleteDeptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
