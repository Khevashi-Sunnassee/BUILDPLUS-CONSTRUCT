import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  Mail,
  User,
  Phone,
  MapPin,
  Power,
  PowerOff,
  Clock,
  Search,
  KeyRound,
  Eye,
} from "lucide-react";
import { ADMIN_ROUTES, USER_ROUTES, INVITATION_ROUTES } from "@shared/api-routes";
import { Factory as FactoryIcon } from "lucide-react";
import type { Factory } from "@shared/schema";
import { QueryErrorState } from "@/components/query-error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User as UserType, Role, Department, UserInvitation, UserPermission, PermissionType } from "@shared/schema";
import { FUNCTION_KEYS } from "@shared/schema";
import type { PermissionLevel } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, EyeOff, Pencil, X } from "lucide-react";
import UserPermissionsPage from "./user-permissions";

const INVITE_FUNCTION_LABELS: Record<string, string> = {
  tasks: "Tasks",
  chat: "Chat",
  jobs: "Jobs",
  panel_register: "Panel Register",
  document_register: "Document Register",
  photo_gallery: "Photo Gallery",
  checklists: "Checklists",
  work_orders: "Work Orders",
  weekly_job_logs: "Weekly Job Logs",
  mail_register: "Mail Register",
  broadcast: "Broadcast",
  help_center: "Help Center",
  knowledge_base: "Knowledge Base",
  production_slots: "Production Slots",
  production_schedule: "Production Schedule",
  production_report: "Production Booking",
  drafting_program: "Drafting Program",
  daily_reports: "Drafting Register",
  drafting_emails: "Drafting Emails",
  reo_scheduling: "Reo Scheduling",
  pm_call_logs: "PM Call Logs",
  logistics: "Logistics",
  sales_pipeline: "Sales Pipeline",
  contract_hub: "Contract Hub",
  progress_claims: "Progress Claims",
  purchase_orders: "Purchase Orders",
  capex_requests: "CAPEX Requests",
  hire_bookings: "Hire Bookings",
  tenders: "Tenders",
  scopes: "Scope of Works",
  weekly_wages: "Weekly Wages",
  admin_assets: "Asset Register",
  ap_invoices: "AP Invoices",
  myob_integration: "MYOB Integration",
  kpi_dashboard: "KPI Dashboard",
  manager_review: "Manager Review",
  checklist_reports: "Checklist Reports",
  reports: "Reports & Downloads",
  job_activities: "Job Activities",
  tender_emails: "Tender Emails",
  email_processing: "Email Processing",
  budgets: "Budgets",
  admin_settings: "Settings",
  admin_companies: "Companies",
  admin_factories: "Factories",
  admin_panel_types: "Panel Types",
  admin_document_config: "Document Config",
  admin_checklist_templates: "Checklist Templates",
  admin_item_catalog: "Items & Categories",
  admin_devices: "Devices",
  admin_users: "Users",
  admin_user_permissions: "User Permissions",
  admin_job_types: "Job Types & Workflows",
  admin_jobs: "Jobs Management",
  admin_customers: "Customers",
  admin_suppliers: "Suppliers",
  admin_employees: "Employees",
  admin_zones: "Zones",
  admin_work_types: "Work Types",
  admin_trailer_types: "Trailer Types",
  admin_data_management: "Data Management",
  admin_cost_codes: "Cost Codes",
  admin_email_templates: "Email Templates",
  admin_external_api: "External API",
  mobile_qr_scanner: "QR Scanner (Mobile)",
  mobile_dashboard: "Dashboard (Mobile)",
  mobile_profile: "Profile (Mobile)",
};

const INVITE_PERMISSION_SECTIONS = [
  { label: "Core Features", keys: ["tasks", "chat", "jobs", "panel_register", "document_register", "photo_gallery", "checklists", "work_orders", "weekly_job_logs", "mail_register", "broadcast", "help_center", "knowledge_base", "job_activities"] },
  { label: "Production & Scheduling", keys: ["production_slots", "production_schedule", "production_report", "drafting_program", "daily_reports", "drafting_emails", "reo_scheduling", "pm_call_logs", "logistics"] },
  { label: "Finance & Commercial", keys: ["sales_pipeline", "contract_hub", "progress_claims", "purchase_orders", "capex_requests", "hire_bookings", "tenders", "scopes", "budgets", "weekly_wages", "admin_assets", "ap_invoices", "myob_integration", "tender_emails", "email_processing"] },
  { label: "Management & Reporting", keys: ["kpi_dashboard", "manager_review", "checklist_reports", "reports"] },
  { label: "Administration", keys: ["admin_settings", "admin_companies", "admin_factories", "admin_panel_types", "admin_document_config", "admin_checklist_templates", "admin_item_catalog", "admin_devices", "admin_users", "admin_user_permissions", "admin_job_types", "admin_jobs", "admin_data_management", "admin_cost_codes", "admin_email_templates", "admin_external_api"] },
  { label: "Contacts", keys: ["admin_customers", "admin_suppliers", "admin_employees"] },
  { label: "Other", keys: ["admin_zones", "admin_work_types", "admin_trailer_types"] },
  { label: "Mobile-Only Features", keys: ["mobile_qr_scanner", "mobile_dashboard", "mobile_profile"] },
];

const createUserSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  name: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["USER", "MANAGER", "ADMIN"]),
  userType: z.enum(["EMPLOYEE", "EXTERNAL"]),
  departmentId: z.string().nullable().optional(),
  poApprover: z.boolean().optional(),
  poApprovalLimit: z.string().optional(),
  defaultFactoryId: z.string().nullable().optional(),
});

const editUserSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  password: z.string().refine(
    (val) => val === "" || val.length >= 6,
    { message: "Password must be at least 6 characters" }
  ),
  role: z.enum(["USER", "MANAGER", "ADMIN"]),
  userType: z.enum(["EMPLOYEE", "EXTERNAL"]),
  departmentId: z.string().nullable().optional(),
  poApprover: z.boolean().optional(),
  poApprovalLimit: z.string().optional(),
  defaultFactoryId: z.string().nullable().optional(),
});

type UserFormData = z.infer<typeof editUserSchema>;

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const hoursValidation = z.string().refine((val) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0 && num <= 24;
}, { message: "Must be a number between 0 and 24" });

const workHoursSchema = z.object({
  mondayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  mondayHours: hoursValidation,
  tuesdayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  tuesdayHours: hoursValidation,
  wednesdayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  wednesdayHours: hoursValidation,
  thursdayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  thursdayHours: hoursValidation,
  fridayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  fridayHours: hoursValidation,
  saturdayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  saturdayHours: hoursValidation,
  sundayStartTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
  sundayHours: hoursValidation,
});

type WorkHoursFormData = z.infer<typeof workHoursSchema>;

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

const PERM_SECTIONS = [
  { label: "Main Navigation", keys: ["tasks", "chat", "jobs", "panel_register", "document_register", "photo_gallery", "checklists", "weekly_job_logs", "broadcast"] },
  { label: "Production & Scheduling", keys: ["production_slots", "production_report", "drafting_program", "daily_reports", "reo_scheduling", "pm_call_logs", "logistics"] },
  { label: "Finance & Commercial", keys: ["sales_pipeline", "contract_hub", "progress_claims", "purchase_orders", "hire_bookings", "weekly_wages", "admin_assets"] },
  { label: "Management & Reporting", keys: ["kpi_dashboard", "manager_review", "checklist_reports"] },
  { label: "Administration", keys: ["admin_settings", "admin_companies", "admin_factories", "admin_panel_types", "admin_document_config", "admin_checklist_templates", "admin_item_catalog", "admin_devices", "admin_users", "admin_user_permissions", "admin_job_types", "admin_jobs", "admin_data_management"] },
  { label: "Contacts", keys: ["admin_customers", "admin_suppliers", "admin_employees"] },
  { label: "Other", keys: ["admin_zones", "admin_work_types", "admin_trailer_types"] },
];

const PERM_LABELS: Record<string, string> = {
  tasks: "Tasks", chat: "Chat", jobs: "Jobs", panel_register: "Panel Register", document_register: "Document Register",
  photo_gallery: "Photo Gallery", checklists: "Checklists", weekly_job_logs: "Weekly Job Logs", broadcast: "Broadcast",
  production_slots: "Production Slots", production_report: "Production Schedule", drafting_program: "Drafting Program",
  daily_reports: "Drafting Register", reo_scheduling: "Reo Scheduling", pm_call_logs: "PM Call Logs", logistics: "Logistics",
  sales_pipeline: "Sales Pipeline", contract_hub: "Contract Hub", progress_claims: "Progress Claims",
  purchase_orders: "Purchase Orders", hire_bookings: "Hire Bookings", weekly_wages: "Weekly Wages", admin_assets: "Asset Register",
  kpi_dashboard: "KPI Dashboard", manager_review: "Manager Review", checklist_reports: "Checklist Reports",
  admin_settings: "Settings", admin_companies: "Companies", admin_factories: "Factories", admin_panel_types: "Panel Types",
  admin_document_config: "Document Config", admin_checklist_templates: "Checklist Templates", admin_item_catalog: "Items & Categories",
  admin_devices: "Devices", admin_users: "Users", admin_user_permissions: "User Permissions", admin_job_types: "Job Types & Workflows",
  admin_jobs: "Jobs Management", admin_customers: "Customers", admin_suppliers: "Suppliers", admin_employees: "Employees",
  admin_zones: "Zones", admin_work_types: "Work Types", admin_trailer_types: "Trailer Types", admin_data_management: "Data Management",
};

const SUPPORTS_OWN = ["purchase_orders", "tasks", "weekly_job_logs", "pm_call_logs"];

function UserPermissionsDialog({ open, onOpenChange, userId, userName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}) {
  const { toast } = useToast();
  const [applyTypeOpen, setApplyTypeOpen] = useState(false);

  interface UserWithPermissions {
    user: UserType;
    permissions: UserPermission[];
  }

  const { data: allUsersPerms, isLoading } = useQuery<UserWithPermissions[]>({
    queryKey: [ADMIN_ROUTES.USER_PERMISSIONS],
  });

  const userPerms = useMemo(() => {
    if (!allUsersPerms) return null;
    return allUsersPerms.find(up => up.user.id === userId);
  }, [allUsersPerms, userId]);

  const permissions = userPerms?.permissions || [];

  const initializeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.USER_PERMISSION_INITIALIZE(userId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permissions initialized" });
    },
    onError: () => {
      toast({ title: "Failed to initialize permissions", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ functionKey, permissionLevel }: { functionKey: string; permissionLevel: PermissionLevel }) => {
      return apiRequest("PUT", ADMIN_ROUTES.USER_PERMISSION_UPDATE(userId, functionKey), { permissionLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permission updated" });
    },
    onError: () => {
      toast({ title: "Failed to update permission", variant: "destructive" });
    },
  });

  const getPermLevel = (functionKey: string): PermissionLevel => {
    const p = permissions.find(p => p.functionKey === functionKey);
    return (p?.permissionLevel as PermissionLevel) || "VIEW_AND_UPDATE";
  };

  const hasUnset = useMemo(() => {
    const permMap = new Map(permissions.map(p => [p.functionKey, true]));
    return FUNCTION_KEYS.some(k => !permMap.has(k));
  }, [permissions]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-permissions-dialog-title">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Permissions — {userName}
              </div>
            </DialogTitle>
            <DialogDescription>
              Control which features this user can access and what level of access they have.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {hasUnset && (
                  <Button
                    size="sm"
                    onClick={() => initializeMutation.mutate()}
                    disabled={initializeMutation.isPending}
                    data-testid="button-initialize-permissions"
                  >
                    {initializeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Initialize All
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setApplyTypeOpen(true)}
                  data-testid="button-apply-type-dialog"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Apply Permission Type
                </Button>
              </div>

              {hasUnset && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Some permissions are not set</p>
                  <p className="text-amber-700 dark:text-amber-300">Click "Initialize All" to set defaults, or apply a permission type.</p>
                </div>
              )}

              {PERM_SECTIONS.map(section => (
                <div key={section.label}>
                  <div className="flex items-center gap-2 py-2 mb-1">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.label}</h4>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/2">Feature</TableHead>
                        <TableHead>Access Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.keys.map(functionKey => {
                        const currentLevel = getPermLevel(functionKey);
                        return (
                          <TableRow key={functionKey} data-testid={`row-perm-dialog-${functionKey}`}>
                            <TableCell className="font-medium">{PERM_LABELS[functionKey] || functionKey}</TableCell>
                            <TableCell>
                              <Select
                                value={currentLevel}
                                onValueChange={(value) => {
                                  updatePermissionMutation.mutate({ functionKey, permissionLevel: value as PermissionLevel });
                                }}
                                disabled={updatePermissionMutation.isPending}
                              >
                                <SelectTrigger className="w-48" data-testid={`select-perm-dialog-${functionKey}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="HIDDEN">
                                    <div className="flex items-center gap-2">
                                      <EyeOff className="h-4 w-4 text-red-500" />
                                      Hidden
                                    </div>
                                  </SelectItem>
                                  {SUPPORTS_OWN.includes(functionKey) && (
                                    <SelectItem value="VIEW_OWN">
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-blue-500" />
                                        View Own Only
                                      </div>
                                    </SelectItem>
                                  )}
                                  <SelectItem value="VIEW">
                                    <div className="flex items-center gap-2">
                                      <Eye className="h-4 w-4 text-yellow-500" />
                                      View All
                                    </div>
                                  </SelectItem>
                                  {SUPPORTS_OWN.includes(functionKey) && (
                                    <SelectItem value="VIEW_AND_UPDATE_OWN">
                                      <div className="flex items-center gap-2">
                                        <Pencil className="h-4 w-4 text-cyan-500" />
                                        View & Edit Own Only
                                      </div>
                                    </SelectItem>
                                  )}
                                  <SelectItem value="VIEW_AND_UPDATE">
                                    <div className="flex items-center gap-2">
                                      <Pencil className="h-4 w-4 text-green-500" />
                                      View & Edit All
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {applyTypeOpen && (
        <ApplyPermissionTypeDialogInline
          open={applyTypeOpen}
          onOpenChange={setApplyTypeOpen}
          userId={userId}
          userName={userName}
        />
      )}
    </>
  );
}

function ApplyPermissionTypeDialogInline({ open, onOpenChange, userId, userName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}) {
  const { toast } = useToast();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");

  const { data: permissionTypes } = useQuery<PermissionType[]>({
    queryKey: [ADMIN_ROUTES.PERMISSION_TYPES],
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.USER_PERMISSION_APPLY_TYPE(userId), { permissionTypeId: selectedTypeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permission type applied", description: `Permissions updated for ${userName}.` });
      setSelectedTypeId("");
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to apply permission type", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Permission Type</DialogTitle>
          <DialogDescription>
            Select a permission type to apply to <strong>{userName}</strong>. This will overwrite all existing permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger data-testid="select-apply-perm-type-inline">
              <SelectValue placeholder="Select a permission type..." />
            </SelectTrigger>
            <SelectContent>
              {permissionTypes?.map(pt => (
                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => {
              if (!selectedTypeId) {
                toast({ title: "Select a type first", variant: "destructive" });
                return;
              }
              applyMutation.mutate();
            }}
            disabled={applyMutation.isPending || !selectedTypeId}
            data-testid="button-confirm-apply-perm-type"
          >
            {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  useDocumentTitle("User Management");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<UserType | null>(null);
  const [workHoursDialogOpen, setWorkHoursDialogOpen] = useState(false);
  const [workHoursUser, setWorkHoursUser] = useState<UserType | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"USER" | "MANAGER" | "ADMIN">("USER");
  const [inviteUserType, setInviteUserType] = useState<"EMPLOYEE" | "EXTERNAL">("EMPLOYEE");
  const [invitePermissions, setInvitePermissions] = useState<Record<string, PermissionLevel>>(() => {
    const defaults: Record<string, PermissionLevel> = {};
    FUNCTION_KEYS.forEach(key => { defaults[key] = "VIEW_AND_UPDATE"; });
    return defaults;
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null);
  const [permissionsUserName, setPermissionsUserName] = useState<string>("");

  const { data: users, isLoading, isError, error, refetch } = useQuery<UserType[]>({
    queryKey: [ADMIN_ROUTES.USERS],
  });

  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: [ADMIN_ROUTES.DEPARTMENTS],
  });

  const activeDepartments = useMemo(() => departmentsList.filter((d) => d.isActive), [departmentsList]);
  const activeFactories = useMemo(() => factories.filter((f) => f.isActive), [factories]);

  type InvitationWithInviter = UserInvitation & { invitedByName: string };
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<InvitationWithInviter[]>({
    queryKey: [INVITATION_ROUTES.ADMIN_LIST],
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", INVITATION_ROUTES.ADMIN_CANCEL(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVITATION_ROUTES.ADMIN_LIST] });
      toast({ title: "Invitation cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [resendingId, setResendingId] = useState<string | null>(null);

  const resendInvitationMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", INVITATION_ROUTES.ADMIN_CREATE, {
        email,
        role: "USER",
        userType: "EMPLOYEE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVITATION_ROUTES.ADMIN_LIST] });
      toast({ title: "Invitation resent" });
      setResendingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setResendingId(null);
    },
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: "",
      name: "",
      phone: "",
      address: "",
      password: "",
      role: "USER",
      userType: "EMPLOYEE",
      departmentId: null,
      poApprover: false,
      poApprovalLimit: "",
      defaultFactoryId: null,
    },
  });

  const workHoursForm = useForm<WorkHoursFormData>({
    resolver: zodResolver(workHoursSchema),
    defaultValues: {
      mondayStartTime: "08:00",
      mondayHours: "8",
      tuesdayStartTime: "08:00",
      tuesdayHours: "8",
      wednesdayStartTime: "08:00",
      wednesdayHours: "8",
      thursdayStartTime: "08:00",
      thursdayHours: "8",
      fridayStartTime: "08:00",
      fridayHours: "8",
      saturdayStartTime: "08:00",
      saturdayHours: "0",
      sundayStartTime: "08:00",
      sundayHours: "0",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiRequest("POST", ADMIN_ROUTES.USERS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USERS] });
      queryClient.invalidateQueries({ queryKey: [USER_ROUTES.LIST] });
      toast({ title: "User created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      return apiRequest("PUT", ADMIN_ROUTES.USER_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USERS] });
      queryClient.invalidateQueries({ queryKey: [USER_ROUTES.LIST] });
      toast({ title: "User updated successfully" });
      setDialogOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PUT", ADMIN_ROUTES.USER_BY_ID(id), { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USERS] });
      queryClient.invalidateQueries({ queryKey: [USER_ROUTES.LIST] });
      toast({ title: "User status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.USER_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USERS] });
      queryClient.invalidateQueries({ queryKey: [USER_ROUTES.LIST] });
      toast({ title: "User deleted" });
      setDeleteDialogOpen(false);
      setDeletingUserId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  const updateWorkHoursMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkHoursFormData }) => {
      return apiRequest("PUT", ADMIN_ROUTES.USER_WORK_HOURS(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USERS] });
      toast({ title: "Work hours updated successfully" });
      setWorkHoursDialogOpen(false);
      setWorkHoursUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update work hours", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; userType: string; permissions?: Record<string, string> }) => {
      const res = await apiRequest("POST", INVITATION_ROUTES.ADMIN_CREATE, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USERS] });
      toast({ title: "Invitation sent", description: `An invitation email has been sent to ${inviteEmail}` });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("USER");
      setInviteUserType("EMPLOYEE");
      const defaults: Record<string, PermissionLevel> = {};
      FUNCTION_KEYS.forEach(key => { defaults[key] = "VIEW_AND_UPDATE"; });
      setInvitePermissions(defaults);
      setExpandedSections(new Set());
    },
    onError: (err: any) => {
      const msg = err.message || "An error occurred";
      if (msg.includes("Rate limit exceeded")) {
        const minutesMatch = msg.match(/(\d+)/);
        const retryMinutes = minutesMatch ? Math.ceil(parseInt(minutesMatch[0]) / 60) : null;
        toast({
          title: "Too many invitations",
          description: retryMinutes
            ? `You've reached the invitation limit. Please try again in ${retryMinutes} minute${retryMinutes !== 1 ? "s" : ""}.`
            : msg,
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to send invitation", description: msg, variant: "destructive" });
      }
    },
  });

  const openWorkHoursDialog = useCallback((user: UserType) => {
    setWorkHoursUser(user);
    workHoursForm.reset({
      mondayStartTime: user.mondayStartTime || "08:00",
      mondayHours: user.mondayHours || "8",
      tuesdayStartTime: user.tuesdayStartTime || "08:00",
      tuesdayHours: user.tuesdayHours || "8",
      wednesdayStartTime: user.wednesdayStartTime || "08:00",
      wednesdayHours: user.wednesdayHours || "8",
      thursdayStartTime: user.thursdayStartTime || "08:00",
      thursdayHours: user.thursdayHours || "8",
      fridayStartTime: user.fridayStartTime || "08:00",
      fridayHours: user.fridayHours || "8",
      saturdayStartTime: user.saturdayStartTime || "08:00",
      saturdayHours: user.saturdayHours || "0",
      sundayStartTime: user.sundayStartTime || "08:00",
      sundayHours: user.sundayHours || "0",
    });
    setWorkHoursDialogOpen(true);
  }, [workHoursForm]);

  const onWorkHoursSubmit = (data: WorkHoursFormData) => {
    if (workHoursUser) {
      updateWorkHoursMutation.mutate({ id: workHoursUser.id, data });
    }
  };

  const openEditUser = useCallback((user: UserType) => {
    setEditingUser(user);
    form.reset({
      email: user.email,
      name: user.name || "",
      phone: user.phone || "",
      address: user.address || "",
      password: "",
      role: user.role as "USER" | "MANAGER" | "ADMIN",
      userType: (user.userType as "EMPLOYEE" | "EXTERNAL") || "EMPLOYEE",
      departmentId: user.departmentId || null,
      poApprover: user.poApprover || false,
      poApprovalLimit: user.poApprovalLimit || "",
      defaultFactoryId: user.defaultFactoryId || null,
    });
    setDialogOpen(true);
  }, [form]);

  const openNewUser = () => {
    setEditingUser(null);
    form.reset({ email: "", name: "", phone: "", address: "", password: "", role: "USER", userType: "EMPLOYEE", departmentId: null, poApprover: false, poApprovalLimit: "", defaultFactoryId: null });
    setDialogOpen(true);
  };

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      const updateData: Record<string, any> = {
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        role: data.role,
        userType: data.userType,
        departmentId: data.userType === "EMPLOYEE" ? (data.departmentId || null) : null,
        poApprover: data.poApprover,
        poApprovalLimit: data.poApprovalLimit || "",
        defaultFactoryId: data.defaultFactoryId || null,
      };
      if (data.password) {
        updateData.password = data.password;
      }
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      let hasErrors = false;
      if (!data.phone) {
        form.setError("phone", { message: "Phone number is required for new users" });
        hasErrors = true;
      }
      if (!data.address) {
        form.setError("address", { message: "Address is required for new users" });
        hasErrors = true;
      }
      if (!data.password || data.password.length < 6) {
        form.setError("password", { message: "Password must be at least 6 characters" });
        hasErrors = true;
      }
      if (hasErrors) return;
      createUserMutation.mutate(data);
    }
  };

  const getRoleIcon = useCallback((role: Role) => {
    switch (role) {
      case "ADMIN":
        return <ShieldAlert className="h-4 w-4 text-red-600" />;
      case "MANAGER":
        return <ShieldCheck className="h-4 w-4 text-blue-600" />;
      default:
        return <Shield className="h-4 w-4 text-muted-foreground" />;
    }
  }, []);

  const getRoleBadge = useCallback((role: Role) => {
    const variants: Record<Role, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      ADMIN: { variant: "destructive", label: "Admin" },
      MANAGER: { variant: "default", label: "Manager" },
      USER: { variant: "secondary", label: "User" },
    };
    const config = variants[role] || variants.USER;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }, []);

  const sortedFilteredUsers = useMemo(() => {
    if (!users) return [];
    let filtered = [...users];
    if (userSearch.trim()) {
      const search = userSearch.toLowerCase().trim();
      filtered = filtered.filter(u =>
        (u.name || "").toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }
    if (roleFilter !== "all") {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    if (userTypeFilter !== "all") {
      filtered = filtered.filter(u => u.userType === userTypeFilter);
    }
    filtered.sort((a, b) => {
      const aName = a.name || "";
      const bName = b.name || "";
      if (!aName && bName) return 1;
      if (aName && !bName) return -1;
      const nameCompare = aName.localeCompare(bName);
      if (nameCompare !== 0) return nameCompare;
      return a.email.localeCompare(b.email);
    });
    return filtered;
  }, [users, userSearch, roleFilter, userTypeFilter]);

  const pendingInvitationsCount = useMemo(() => invitations.filter(i => i.status === "PENDING").length, [invitations]);

  const sortedInvitations = useMemo(() => invitations.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [invitations]);

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="User Management" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6" role="main" aria-label="User Management">
        <QueryErrorState error={error} onRetry={refetch} message="Failed to load users" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="User Management">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-users-title">
            User Management
          </h1>
            <PageHelpButton pageHelpKey="page.admin.users" />
          </div>
          <p className="text-muted-foreground">
            Manage users and their roles
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-user">
            <Mail className="h-4 w-4 mr-2" />
            Invite User
          </Button>
          <Button onClick={openNewUser} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-1.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="invitations" data-testid="tab-invitations">
            <Mail className="h-4 w-4 mr-1.5" />
            Invitations
            {pendingInvitationsCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">{pendingInvitationsCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36" data-testid="select-filter-role">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="USER">User</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-36" data-testid="select-filter-user-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="EXTERNAL">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sortedFilteredUsers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFilteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`} className="cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            {getRoleIcon(user.role as Role)}
                          </div>
                          <span className="font-medium">{user.name || "Unnamed"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-user-type-${user.id}`}>
                        <Badge variant={user.userType === "EMPLOYEE" ? "default" : "outline"}>
                          {user.userType === "EMPLOYEE" ? "Employee" : "External"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-department-${user.id}`}>
                        {user.userType === "EMPLOYEE" && user.departmentId
                          ? (departmentsList.find(d => d.id === user.departmentId)?.name || "—")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role as Role)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "outline" : "secondary"}>
                          {user.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.createdAt), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View user details"
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                            data-testid={`button-view-user-${user.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={user.isActive ? "Deactivate user" : "Activate user"}
                            onClick={() => toggleUserMutation.mutate({
                              id: user.id,
                              isActive: !user.isActive
                            })}
                            data-testid={`button-toggle-${user.id}`}
                          >
                            {user.isActive ? (
                              <PowerOff className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Power className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Work hours"
                            onClick={() => openWorkHoursDialog(user)}
                            title="Work Hours"
                            data-testid={`button-work-hours-${user.id}`}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit user"
                            onClick={() => openEditUser(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="User permissions"
                            title="Permissions"
                            onClick={() => {
                              setPermissionsUserId(user.id);
                              setPermissionsUserName(user.name || user.email);
                            }}
                            data-testid={`button-permissions-${user.id}`}
                          >
                            <KeyRound className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete user"
                            onClick={() => {
                              setDeletingUserId(user.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">{userSearch ? "No users found" : "No users yet"}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {userSearch ? `No results for "${userSearch}"` : "Create a user to get started"}
              </p>
              {!userSearch && (
                <Button className="mt-4" onClick={openNewUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardContent className="pt-6">
              {invitationsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : invitations.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invited By</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedInvitations.map((inv) => {
                        const isExpired = inv.status === "PENDING" && new Date(inv.expiresAt) < new Date();
                        const displayStatus = isExpired ? "EXPIRED" : inv.status;
                        return (
                          <TableRow key={inv.id} data-testid={`row-invitation-${inv.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{inv.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(inv.role as Role)}</TableCell>
                            <TableCell>
                              <Badge variant={inv.userType === "EMPLOYEE" ? "default" : "outline"}>
                                {inv.userType === "EMPLOYEE" ? "Employee" : "External"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  displayStatus === "ACCEPTED" ? "default" :
                                  displayStatus === "PENDING" ? "outline" :
                                  "secondary"
                                }
                                data-testid={`badge-status-${inv.id}`}
                              >
                                {displayStatus === "ACCEPTED" ? "Accepted" :
                                 displayStatus === "PENDING" ? "Pending" :
                                 displayStatus === "EXPIRED" ? "Expired" :
                                 "Cancelled"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {inv.invitedByName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(inv.createdAt), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(inv.expiresAt), "dd/MM/yyyy")}
                              {inv.acceptedAt && (
                                <div className="text-xs text-green-600">
                                  Accepted {format(new Date(inv.acceptedAt), "dd/MM/yyyy")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {inv.status === "PENDING" && !isExpired && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => cancelInvitationMutation.mutate(inv.id)}
                                  disabled={cancelInvitationMutation.isPending}
                                  title="Cancel invitation"
                                  data-testid={`button-cancel-invitation-${inv.id}`}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No invitations yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Invite users to join your organization
                  </p>
                  <Button className="mt-4" onClick={() => setInviteDialogOpen(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Invite User
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details and role"
                : "Create a new user account"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.error("Form validation errors:", JSON.stringify(errors)))} className="space-y-5">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Account Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="user@company.com" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{editingUser ? "New Password (optional)" : "Password"}</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="••••••••" data-testid="input-password" />
                        </FormControl>
                        {editingUser && (
                          <FormDescription>
                            Leave blank to keep current password
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Smith" data-testid="input-name" />
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
                          <Input {...field} type="tel" placeholder="0412 345 678" data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="123 Main St, Melbourne VIC" data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Role & Assignment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Managers approve time entries. Admins have full access.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="userType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Type</FormLabel>
                        <Select onValueChange={(val) => {
                          field.onChange(val);
                          if (val === "EXTERNAL") {
                            form.setValue("departmentId", null);
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-user-type">
                              <SelectValue placeholder="Select user type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EMPLOYEE">Employee</SelectItem>
                            <SelectItem value="EXTERNAL">External</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Employee = internal staff. External = contractors.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("userType") === "EMPLOYEE" && (
                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-department">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No department</SelectItem>
                              {activeDepartments.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name} ({dept.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="defaultFactoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Factory</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-default-factory">
                              <SelectValue placeholder="Select default factory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No default</SelectItem>
                            {activeFactories.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((factory) => (
                              <SelectItem key={factory.id} value={factory.id}>
                                {factory.name} ({factory.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Auto-selects on production and scheduling pages.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Purchase Order Approval</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="poApprover"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-2 rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>PO Approver</FormLabel>
                          <FormDescription>
                            Allow this user to approve purchase orders
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-po-approver"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch("poApprover") && (
                    <FormField
                      control={form.control}
                      name="poApprovalLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approval Limit ($)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="e.g. 5000.00"
                              data-testid="input-po-approval-limit"
                            />
                          </FormControl>
                          <FormDescription>
                            Max PO value this user can approve. Blank = unlimited.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  data-testid="button-save-user"
                >
                  {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingUser ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account and their associated devices.
              Time entries will be preserved for reporting purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUserId && deleteUserMutation.mutate(deletingUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={workHoursDialogOpen} onOpenChange={setWorkHoursDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Work Hours - {workHoursUser?.name || workHoursUser?.email}
            </DialogTitle>
            <DialogDescription>
              Configure the work schedule for this user. Set the start time and total hours for each day.
            </DialogDescription>
          </DialogHeader>
          <Form {...workHoursForm}>
            <form onSubmit={workHoursForm.handleSubmit(onWorkHoursSubmit)} className="space-y-4">
              <div className="grid gap-3">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.key} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
                    <span className="font-medium text-sm">{day.label}</span>
                    <FormField
                      control={workHoursForm.control}
                      name={`${day.key}StartTime` as keyof WorkHoursFormData}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              className="h-9"
                              data-testid={`input-${day.key}-start-time`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workHoursForm.control}
                      name={`${day.key}Hours` as keyof WorkHoursFormData}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                {...field}
                                className="h-9"
                                data-testid={`input-${day.key}-hours`}
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">hours</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    Total weekly hours:{" "}
                    <strong>
                      {DAYS_OF_WEEK.reduce((sum, day) => {
                        const hours = parseFloat(workHoursForm.watch(`${day.key}Hours` as keyof WorkHoursFormData) || "0");
                        return sum + (isNaN(hours) ? 0 : hours);
                      }, 0).toFixed(1)}
                    </strong>
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setWorkHoursDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateWorkHoursMutation.isPending}
                  data-testid="button-save-work-hours"
                >
                  {updateWorkHoursMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Work Hours
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Set up email, role, and module permissions in one step. The invited user will register with these permissions pre-configured.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address *</label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2 flex-1 min-w-[140px]">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "USER" | "MANAGER" | "ADMIN")}>
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex-1 min-w-[140px]">
                  <label className="text-sm font-medium">User Type</label>
                  <Select value={inviteUserType} onValueChange={(v) => setInviteUserType(v as "EMPLOYEE" | "EXTERNAL")}>
                    <SelectTrigger data-testid="select-invite-user-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="EXTERNAL">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <label className="text-sm font-medium">Module Permissions</label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = { ...invitePermissions };
                        FUNCTION_KEYS.forEach(key => { updated[key] = "VIEW_AND_UPDATE"; });
                        setInvitePermissions(updated);
                      }}
                      data-testid="button-permissions-all-full"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      All Full
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = { ...invitePermissions };
                        FUNCTION_KEYS.forEach(key => { updated[key] = "VIEW"; });
                        setInvitePermissions(updated);
                      }}
                      data-testid="button-permissions-all-view"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      All View
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updated = { ...invitePermissions };
                        FUNCTION_KEYS.forEach(key => { updated[key] = "HIDDEN"; });
                        setInvitePermissions(updated);
                      }}
                      data-testid="button-permissions-all-hidden"
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      All Hidden
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  {INVITE_PERMISSION_SECTIONS.map((section) => {
                    const isExpanded = expandedSections.has(section.label);
                    const sectionLevels = section.keys.map(k => invitePermissions[k] || "VIEW_AND_UPDATE");
                    const allSame = sectionLevels.every(l => l === sectionLevels[0]);
                    const summaryText = allSame
                      ? sectionLevels[0] === "VIEW_AND_UPDATE" ? "Full Access" : sectionLevels[0] === "VIEW" ? "View Only" : sectionLevels[0] === "HIDDEN" ? "Hidden" : "Mixed"
                      : "Mixed";

                    return (
                      <Collapsible
                        key={section.label}
                        open={isExpanded}
                        onOpenChange={() => {
                          setExpandedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(section.label)) next.delete(section.label);
                            else next.add(section.label);
                            return next;
                          });
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md cursor-pointer hover-elevate" data-testid={`section-${section.label.toLowerCase().replace(/\s+/g, '-')}`}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              <span className="text-sm font-medium">{section.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {summaryText}
                              </Badge>
                              <Select
                                value=""
                                onValueChange={(v) => {
                                  const updated = { ...invitePermissions };
                                  section.keys.forEach(key => { updated[key] = v as PermissionLevel; });
                                  setInvitePermissions(updated);
                                }}
                              >
                                <SelectTrigger
                                  className="h-7 w-[90px] text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`select-section-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <SelectValue placeholder="Set all" />
                                </SelectTrigger>
                                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                  <SelectItem value="VIEW_AND_UPDATE">Full Access</SelectItem>
                                  <SelectItem value="VIEW">View Only</SelectItem>
                                  <SelectItem value="HIDDEN">Hidden</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pl-8 pr-2 pb-2 space-y-1">
                            {section.keys.map(key => {
                              const level = invitePermissions[key] || "VIEW_AND_UPDATE";
                              return (
                                <div key={key} className="flex items-center justify-between gap-2 py-1">
                                  <span className="text-sm text-muted-foreground">{INVITE_FUNCTION_LABELS[key] || key}</span>
                                  <Select
                                    value={level}
                                    onValueChange={(v) => {
                                      setInvitePermissions(prev => ({ ...prev, [key]: v as PermissionLevel }));
                                    }}
                                  >
                                    <SelectTrigger
                                      className="h-7 w-[130px] text-xs"
                                      data-testid={`select-permission-${key}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                      <SelectItem value="VIEW_AND_UPDATE">Full Access</SelectItem>
                                      <SelectItem value="VIEW">View Only</SelectItem>
                                      <SelectItem value="HIDDEN">Hidden</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!inviteEmail || !inviteEmail.includes("@")) {
                  toast({ title: "Please enter a valid email address", variant: "destructive" });
                  return;
                }
                inviteMutation.mutate({ email: inviteEmail, role: inviteRole, userType: inviteUserType, permissions: invitePermissions });
              }}
              disabled={inviteMutation.isPending}
              data-testid="button-send-invite"
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {permissionsUserId && (
        <UserPermissionsDialog
          open={!!permissionsUserId}
          onOpenChange={(open) => { if (!open) { setPermissionsUserId(null); setPermissionsUserName(""); } }}
          userId={permissionsUserId}
          userName={permissionsUserName}
        />
      )}

      {detailUser && (
        <Dialog open={!!detailUser} onOpenChange={(open) => { if (!open) setDetailUser(null); }}>
          <DialogContent className="max-w-lg" data-testid="dialog-user-detail">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {detailUser.name || "Unnamed User"}
              </DialogTitle>
              <DialogDescription>
                User details
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="font-medium">{detailUser.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="font-medium">{detailUser.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Role</p>
                  <div>{getRoleBadge(detailUser.role as Role)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">User Type</p>
                  <Badge variant={detailUser.userType === "EMPLOYEE" ? "default" : "outline"}>
                    {detailUser.userType === "EMPLOYEE" ? "Employee" : "External"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Department</p>
                  <p className="font-medium">
                    {detailUser.userType === "EMPLOYEE" && detailUser.departmentId
                      ? (departmentsList.find(d => d.id === detailUser.departmentId)?.name || "—")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={detailUser.isActive ? "outline" : "secondary"}>
                    {detailUser.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium">{format(new Date(detailUser.createdAt), "dd/MM/yyyy")}</p>
                </div>
                {detailUser.position && (
                  <div>
                    <p className="text-muted-foreground text-xs">Position</p>
                    <p className="font-medium">{detailUser.position}</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailUser(null)} data-testid="button-close-user-detail">
                Close
              </Button>
              <Button onClick={() => { const u = detailUser; setDetailUser(null); openEditUser(u); }} data-testid="button-edit-from-detail">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
