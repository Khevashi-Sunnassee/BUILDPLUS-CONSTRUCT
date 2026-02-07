import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { USER_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
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
  Radio,
  Scale,
} from "lucide-react";
import defaultLogo from "@assets/LTE_STRUCTURE_LOGO_1769926222936.png";
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
  { title: "Checklists", url: "/checklists", icon: CheckSquare },
  { title: "Weekly Job Logs", url: "/weekly-job-logs", icon: ClipboardList },
  { title: "Broadcast", url: "/broadcast", icon: Radio },
];

const productionNavItems = [
  { title: "Production Slots", url: "/production-slots", icon: Calendar },
  { title: "Production Schedule", url: "/production-schedule", icon: CalendarDays },
  { title: "Drafting Program", url: "/drafting-program", icon: Clock },
  { title: "Drafting Register", url: "/daily-reports", icon: FileText },
  { title: "Reo Scheduling", url: "/procurement-reo", icon: Layers },
  { title: "Logistics", url: "/logistics", icon: Truck },
];

const adminFinanceNavItems = [
  { title: "Contract Hub", url: "/contracts", icon: Scale },
  { title: "Progress Claims", url: "/progress-claims", icon: FileText },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Weekly Wages", url: "/weekly-wages", icon: DollarSign },
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
  { title: "Customers", url: "/admin/customers", icon: Handshake },
  { title: "Suppliers", url: "/admin/suppliers", icon: Building2 },
  { title: "Items", url: "/admin/items", icon: Package },
  { title: "Devices", url: "/admin/devices", icon: Monitor },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "User Permissions", url: "/admin/user-permissions", icon: Shield },
];

const urlToFunctionKey: Record<string, string> = {
  "/daily-reports": "daily_reports",
  "/kpi-dashboard": "kpi_dashboard",
  "/production-report": "production_report",
  "/production-slots": "production_report",
  "/production-schedule": "production_report",
  "/drafting-program": "production_report",
  "/logistics": "logistics",
  "/weekly-wages": "weekly_wages",
  "/weekly-job-logs": "weekly_job_logs",
  "/purchase-orders": "purchase_orders",
  "/procurement-reo": "purchase_orders",
  "/tasks": "tasks",
  "/chat": "chat",
  "/documents": "document_register",
  "/reports": "daily_reports",
  "/admin/jobs": "admin_jobs",
  "/admin/panels": "panel_register",
  "/admin/panel-types": "admin_panel_types",
  "/admin/customers": "admin_customers",
  "/admin/suppliers": "admin_suppliers",
  "/admin/items": "admin_item_catalog",
  "/admin/devices": "admin_devices",
  "/admin/users": "admin_users",
  "/admin/settings": "admin_settings",
  "/admin/factories": "admin_factories",
  "/admin/companies": "admin_companies",
  "/admin/checklist-templates": "admin_checklist_templates",
  "/checklists": "checklists",
  "/checklist-reports": "checklists",
  "/manager/review": "daily_reports",
  "/contracts": "contract_hub",
  "/progress-claims": "progress_claims",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  
  const [mainExpanded, setMainExpanded] = useState(true);
  const [productionExpanded, setProductionExpanded] = useState(true);
  const [adminFinanceExpanded, setAdminFinanceExpanded] = useState(true);
  const [managementExpanded, setManagementExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const { data: myPermissions = [] } = useQuery<UserPermission[]>({
    queryKey: [USER_ROUTES.MY_PERMISSIONS],
    enabled: !!user,
  });

  // Fetch dynamic logo from settings
  const { data: logoData } = useQuery<{ logoBase64: string | null }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const logoSrc = logoData?.logoBase64 || defaultLogo;

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
          <img 
            src={logoSrc} 
            alt="LTE Precast Concrete Structures" 
            className="h-[60px] w-auto max-w-full object-contain"
            data-testid="img-sidebar-logo"
          />
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

        {user?.role === "ADMIN" && (
          <Collapsible open={adminExpanded} onOpenChange={setAdminExpanded}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                  <span>Administration</span>
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
    </Sidebar>
  );
}
