import { useState, useMemo, Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { USER_ROUTES, SETTINGS_ROUTES, PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  BarChart3,
  Settings,
  Users,
  FolderOpen,
  Monitor,
  LogOut,
  Clock,
  ChevronDown,
  ChevronRight,
  Download,
  Briefcase,
  ClipboardList,
  Factory,
  Layers,
  Building2,
  Truck,
  DollarSign,
  Shield,
  Calendar,
  CalendarDays,
  Package,
  ShoppingCart,
  ListTodo,
  MessageSquare,
  Handshake,
  UserCheck,
  Radio,
  Scale,
  Target,
  Boxes,
  BookOpen,
  ImageIcon,
  Database,
  Tag,
  Wrench,
  Workflow,
  Phone,
} from "lucide-react";
import type { UserPermission } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Jobs", url: "/admin/jobs", icon: Briefcase },
  { title: "Panel Register", url: "/admin/panels", icon: ClipboardList },
  { title: "Document Register", url: "/documents", icon: FolderOpen },
  { title: "Photo Gallery", url: "/photo-gallery", icon: ImageIcon },
  { title: "Checklists", url: "/checklists", icon: CheckSquare },
  { title: "Weekly Job Logs", url: "/weekly-job-logs", icon: ClipboardList },
  { title: "Broadcast", url: "/broadcast", icon: Radio },
  { title: "Help Center", url: "/help", icon: BookOpen },
];

const productionNavItems = [
  { title: "Production Slots", url: "/production-slots", icon: Calendar },
  { title: "Production Schedule", url: "/production-schedule", icon: CalendarDays },
  { title: "Drafting Program", url: "/drafting-program", icon: Clock },
  { title: "Drafting Register", url: "/daily-reports", icon: FileText },
  { title: "Reo Scheduling", url: "/procurement-reo", icon: Layers },
  { title: "PM Call Logs", url: "/pm-call-logs", icon: Phone },
  { title: "Logistics", url: "/logistics", icon: Truck },
];

const adminFinanceNavItems = [
  { title: "Sales Pipeline", url: "/sales-pipeline", icon: Target },
  { title: "Contract Hub", url: "/contracts", icon: Scale },
  { title: "Progress Claims", url: "/progress-claims", icon: FileText },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Hire Bookings", url: "/hire-bookings", icon: Wrench },
  { title: "Weekly Wages", url: "/weekly-wages", icon: DollarSign },
  { title: "Asset Register", url: "/admin/asset-register", icon: Boxes },
];

const managerNavItems = [
  { title: "KPI Dashboard", url: "/kpi-dashboard", icon: BarChart3 },
  { title: "Manager Review", url: "/manager/review", icon: CheckSquare },
  { title: "Production Report", url: "/production-report", icon: Factory },
  { title: "Checklist Reports", url: "/checklist-reports", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: Clock },
];

const adminNavItems = [
  { title: "Settings", url: "/admin/settings", icon: Settings },
  { title: "Companies", url: "/admin/companies", icon: Building2 },
  { title: "Factories", url: "/admin/factories", icon: Factory },
  { title: "Panel Types", url: "/admin/panel-types", icon: Layers },
  { title: "Document Config", url: "/admin/document-config", icon: FileText },
  { title: "Checklist Templates", url: "/admin/checklist-templates", icon: ClipboardList },
  { title: "Items", url: "/admin/items", icon: Package },
  { title: "Devices", url: "/admin/devices", icon: Monitor },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "User Permissions", url: "/admin/user-permissions", icon: Shield },
  { title: "Item Categories", url: "/admin/item-categories", icon: Tag },
  { title: "Job Types & Workflows", url: "/admin/job-types", icon: Workflow },
  { title: "Data Management", url: "/admin/data-management", icon: Database },
  { title: "Help Management", url: "/admin/help", icon: BookOpen },
];

const contactsNavItems = [
  { title: "Customers", url: "/admin/customers", icon: Handshake },
  { title: "Suppliers", url: "/admin/suppliers", icon: Building2 },
  { title: "Employees", url: "/admin/employees", icon: UserCheck },
];

const urlToFunctionKey: Record<string, string> = {
  "/daily-reports": "daily_reports",
  "/kpi-dashboard": "kpi_dashboard",
  "/production-report": "production_report",
  "/production-slots": "production_report",
  "/production-schedule": "production_report",
  "/drafting-program": "production_report",
  "/pm-call-logs": "production_report",
  "/logistics": "logistics",
  "/weekly-wages": "weekly_wages",
  "/weekly-job-logs": "weekly_job_logs",
  "/purchase-orders": "purchase_orders",
  "/hire-bookings": "purchase_orders",
  "/procurement-reo": "purchase_orders",
  "/tasks": "tasks",
  "/chat": "chat",
  "/documents": "document_register",
  "/photo-gallery": "document_register",
  "/reports": "daily_reports",
  "/admin/jobs": "admin_jobs",
  "/admin/panels": "panel_register",
  "/admin/panel-types": "admin_panel_types",
  "/admin/customers": "admin_customers",
  "/admin/suppliers": "admin_suppliers",
  "/admin/employees": "admin_employees",
  "/admin/items": "admin_item_catalog",
  "/admin/asset-register": "admin_assets",
  "/admin/devices": "admin_devices",
  "/admin/users": "admin_users",
  "/admin/settings": "admin_settings",
  "/admin/factories": "admin_factories",
  "/admin/companies": "admin_companies",
  "/admin/checklist-templates": "admin_checklist_templates",
  "/admin/item-categories": "admin_item_catalog",
  "/admin/data-management": "admin_settings",
  "/admin/job-types": "admin_settings",
  "/checklists": "checklists",
  "/checklist-reports": "checklists",
  "/manager/review": "daily_reports",
  "/contracts": "contract_hub",
  "/progress-claims": "progress_claims",
  "/sales-pipeline": "sales_pipeline",
};

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  
  const [mainExpanded, setMainExpanded] = useState(true);
  const [productionExpanded, setProductionExpanded] = useState(true);
  const [adminFinanceExpanded, setAdminFinanceExpanded] = useState(true);
  const [managementExpanded, setManagementExpanded] = useState(true);
  const [contactsExpanded, setContactsExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [projectActivitiesOpen, setProjectActivitiesOpen] = useState(false);
  const [paSearch, setPaSearch] = useState("");
  const [paJobTypeFilter, setPaJobTypeFilter] = useState("all");

  const { data: myPermissions = [] } = useQuery<UserPermission[]>({
    queryKey: [USER_ROUTES.MY_PERMISSIONS],
    enabled: !!user,
  });

  const { data: paJobs = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/jobs'],
    enabled: projectActivitiesOpen,
  });

  const { data: paJobTypes = [] } = useQuery<any[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES],
    enabled: projectActivitiesOpen,
  });

  const filteredPaJobs = useMemo(() => {
    return paJobs.filter((job: any) => {
      const matchesSearch = !paSearch || 
        (job.name || "").toLowerCase().includes(paSearch.toLowerCase()) ||
        (job.jobNumber || "").toLowerCase().includes(paSearch.toLowerCase());
      const matchesType = paJobTypeFilter === "all" || job.jobTypeId === paJobTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [paJobs, paSearch, paJobTypeFilter]);

  // Fetch dynamic logo from settings
  const { data: logoData } = useQuery<{ logoBase64: string | null }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const logoSrc = logoData?.logoBase64 || null;

  const isItemHidden = (url: string): boolean => {
    const functionKey = urlToFunctionKey[url];
    if (!functionKey) return false;
    const permission = myPermissions.find(p => p.functionKey === functionKey);
    return permission?.permissionLevel === "HIDDEN";
  };

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/" || location === "/dashboard";
    return location.startsWith(url);
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-start">
          {logoSrc ? (
            <img 
              src={logoSrc} 
              alt="BuildPlusAI" 
              className="h-[60px] w-auto max-w-full object-contain"
              data-testid="img-sidebar-logo"
            />
          ) : (
            <div className="flex items-center gap-2" data-testid="img-sidebar-logo">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-lg font-bold text-foreground">
                BuildPlus<span className="text-primary">AI</span>
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible open={mainExpanded} onOpenChange={setMainExpanded}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                <span>Main</span>
                {mainExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNavItems.filter(item => !isItemHidden(item.url)).map((item) => (
                    <Fragment key={item.title}>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          className="transition-colors"
                        >
                          <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {item.title === "Jobs" && (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            isActive={location.includes("/activities")}
                            className="transition-colors cursor-pointer"
                            onClick={() => setProjectActivitiesOpen(true)}
                            data-testid="nav-project-activities"
                          >
                            <Workflow className="h-4 w-4" />
                            <span>Job Activities</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </Fragment>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible open={productionExpanded} onOpenChange={setProductionExpanded}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                <span>Production</span>
                {productionExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {productionNavItems.filter(item => !isItemHidden(item.url)).map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        className="transition-colors"
                      >
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible open={adminFinanceExpanded} onOpenChange={setAdminFinanceExpanded}>
          <SidebarGroup>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                <span>Admin & Finance</span>
                {adminFinanceExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminFinanceNavItems.filter(item => !isItemHidden(item.url)).map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        className="transition-colors"
                      >
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
          <Collapsible open={managementExpanded} onOpenChange={setManagementExpanded}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                  <span>Management</span>
                  {managementExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {managerNavItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          className="transition-colors"
                        >
                          <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
          <Collapsible open={contactsExpanded} onOpenChange={setContactsExpanded}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                  <span>Contacts</span>
                  {contactsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {contactsNavItems.filter(item => !isItemHidden(item.url)).map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          className="transition-colors"
                        >
                          <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {user?.role === "ADMIN" && (
          <Collapsible open={adminExpanded} onOpenChange={setAdminExpanded}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                  <span>Settings</span>
                  {adminExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavItems.filter(item => !isItemHidden(item.url)).map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          className="transition-colors"
                        >
                          <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2 px-2" data-testid="button-user-menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-sm font-medium truncate w-full text-left">
                  {user?.name || user?.email}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {user?.role?.toLowerCase()}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={logout} className="text-destructive" data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarRail />

      <Dialog open={projectActivitiesOpen} onOpenChange={(open) => {
        setProjectActivitiesOpen(open);
        if (!open) {
          setPaSearch("");
          setPaJobTypeFilter("all");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select a Job</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Search by job name or number..."
              value={paSearch}
              onChange={(e) => setPaSearch(e.target.value)}
              data-testid="input-pa-job-search"
            />
            <Select value={paJobTypeFilter} onValueChange={setPaJobTypeFilter}>
              <SelectTrigger data-testid="select-pa-job-type">
                <SelectValue placeholder="Filter by job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Types</SelectItem>
                {paJobTypes.map((jt: any) => (
                  <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="max-h-[360px]">
            <div className="flex flex-col gap-1 pr-3">
              {filteredPaJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No jobs found</p>
              ) : (
                filteredPaJobs.map((job: any) => {
                  const jobType = paJobTypes.find((jt: any) => jt.id === job.jobTypeId);
                  return (
                    <button
                      key={job.id}
                      className="flex items-center gap-3 p-3 rounded-md text-left hover-elevate active-elevate-2 w-full"
                      onClick={() => {
                        setProjectActivitiesOpen(false);
                        setPaSearch("");
                        setPaJobTypeFilter("all");
                        setLocation(`/jobs/${job.id}/activities`);
                      }}
                      data-testid={`button-pa-job-${job.id}`}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {job.jobNumber} - {job.name}
                        </span>
                        {jobType && (
                          <span className="text-xs text-muted-foreground">{jobType.name}</span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
