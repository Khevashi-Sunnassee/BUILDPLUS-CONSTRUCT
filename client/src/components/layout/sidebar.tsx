import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Package,
  ShoppingCart,
  ListTodo,
  MessageSquare,
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

const userNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Jobs", url: "/admin/jobs", icon: Briefcase },
  { title: "Panel Register", url: "/admin/panels", icon: ClipboardList },
  { title: "Production Slots", url: "/production-slots", icon: Calendar },
  { title: "Drafting Program", url: "/drafting-program", icon: Clock },
  { title: "Drafting Register", url: "/daily-reports", icon: FileText },
  { title: "Weekly Job Logs", url: "/weekly-job-logs", icon: ClipboardList },
  { title: "Production Schedule", url: "/production-report", icon: Factory },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Logistics", url: "/logistics", icon: Truck },
  { title: "Weekly Wages", url: "/weekly-wages", icon: DollarSign },
];

const managerNavItems = [
  { title: "KPI Dashboard", url: "/kpi-dashboard", icon: BarChart3 },
  { title: "Manager Review", url: "/manager/review", icon: CheckSquare },
  { title: "Reports", url: "/reports", icon: Clock },
];

const adminNavItems = [
  { title: "Settings", url: "/admin/settings", icon: Settings },
  { title: "Panel Types", url: "/admin/panel-types", icon: Layers },
  { title: "Suppliers", url: "/admin/suppliers", icon: Building2 },
  { title: "Item Categories", url: "/admin/item-categories", icon: FolderOpen },
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
  "/drafting-program": "production_report",
  "/logistics": "logistics",
  "/weekly-wages": "weekly_wages",
  "/weekly-job-logs": "weekly_job_logs",
  "/purchase-orders": "purchase_orders",
  "/tasks": "tasks",
  "/chat": "chat",
  "/reports": "daily_reports",
  "/admin/jobs": "admin_jobs",
  "/admin/panels": "panel_register",
  "/admin/panel-types": "admin_panel_types",
  "/admin/suppliers": "admin_suppliers",
  "/admin/item-categories": "admin_item_catalog",
  "/admin/items": "admin_item_catalog",
  "/admin/devices": "admin_devices",
  "/admin/users": "admin_users",
  "/admin/settings": "admin_settings",
  "/manager/review": "daily_reports",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  
  const [mainExpanded, setMainExpanded] = useState(true);
  const [managementExpanded, setManagementExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const { data: myPermissions = [] } = useQuery<UserPermission[]>({
    queryKey: ["/api/permissions/my-permissions"],
    enabled: !!user,
  });

  // Fetch dynamic logo from settings
  const { data: logoData } = useQuery<{ logoBase64: string | null }>({
    queryKey: ["/api/settings/logo"],
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
                  {userNavItems.filter(item => !isItemHidden(item.url)).map((item) => (
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
