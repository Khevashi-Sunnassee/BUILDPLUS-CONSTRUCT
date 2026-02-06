# Mobile UI Integration Package

## For Replit Agent: Complete Mobile Pages for LTE Performance Management System

This document contains everything needed to add 10 dark-themed mobile pages (plus 2 shared components = 12 files total) to the application. Source code is provided in two ways:
1. **Inline in this guide** - 4 key files (MobileBottomNav, mobile-layout, dashboard, tasks)
2. **Companion document** - `MOBILE_PAGES_SOURCE.md` has the remaining 8 page files inline
3. **Ready-to-copy directory** - `mobile-export/` has all 12 files in correct paths (for same-project use)

---

## TABLE OF CONTENTS

1. [File List](#file-list)
2. [Route Registration (App.tsx changes)](#route-registration)
3. [Dependencies & Imports](#dependencies)
4. [API Route Constants Required](#api-routes)
5. [Design Specifications](#design-specs)
6. [Source Code: Shared Components (2 files)](#shared-components)
7. [Source Code: Page Components (10 files)](#page-components)

---

## FILE LIST

Create these 12 files:

```
client/src/components/mobile/MobileBottomNav.tsx
client/src/components/layout/mobile-layout.tsx
client/src/pages/mobile/dashboard.tsx
client/src/pages/mobile/tasks.tsx
client/src/pages/mobile/chat.tsx
client/src/pages/mobile/jobs.tsx
client/src/pages/mobile/panels.tsx
client/src/pages/mobile/logistics.tsx
client/src/pages/mobile/purchase-orders.tsx
client/src/pages/mobile/more.tsx
client/src/pages/mobile/profile.tsx
client/src/pages/mobile/weekly-job-report.tsx
```

---

## ROUTE REGISTRATION

Add these imports to the top of `client/src/App.tsx`:

```tsx
import MobileDashboard from "@/pages/mobile/dashboard";
import MobileTasksPage from "@/pages/mobile/tasks";
import MobileChatPage from "@/pages/mobile/chat";
import MobileLogisticsPage from "@/pages/mobile/logistics";
import MobileProfilePage from "@/pages/mobile/profile";
import MobileJobsPage from "@/pages/mobile/jobs";
import MobilePanelsPage from "@/pages/mobile/panels";
import MobilePurchaseOrdersPage from "@/pages/mobile/purchase-orders";
import MobileWeeklyJobReportPage from "@/pages/mobile/weekly-job-report";
import MobileMorePage from "@/pages/mobile/more";
```

Add these routes inside your `<Switch>` block, BEFORE the `<Route component={NotFound} />` catch-all. Each route must be wrapped in `<ProtectedRoute>` (or whatever auth wrapper your app uses):

```tsx
{/* Mobile Routes */}
<Route path="/mobile/dashboard">
  <ProtectedRoute>
    <MobileDashboard />
  </ProtectedRoute>
</Route>

<Route path="/mobile/tasks">
  <ProtectedRoute>
    <MobileTasksPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/chat">
  <ProtectedRoute>
    <MobileChatPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/logistics">
  <ProtectedRoute>
    <MobileLogisticsPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/profile">
  <ProtectedRoute>
    <MobileProfilePage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/jobs">
  <ProtectedRoute>
    <MobileJobsPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/panels">
  <ProtectedRoute>
    <MobilePanelsPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/purchase-orders">
  <ProtectedRoute>
    <MobilePurchaseOrdersPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/weekly-report">
  <ProtectedRoute>
    <MobileWeeklyJobReportPage />
  </ProtectedRoute>
</Route>

<Route path="/mobile/more">
  <ProtectedRoute>
    <MobileMorePage />
  </ProtectedRoute>
</Route>

<Route path="/mobile">
  <Redirect to="/mobile/dashboard" />
</Route>
```

---

## DEPENDENCIES

These pages require these npm packages (most should already be installed):

- `@tanstack/react-query` - data fetching
- `wouter` - routing (`Link`, `useLocation`)
- `lucide-react` - icons
- `date-fns` - date formatting (`format`, `parseISO`, `addDays`, `getDay`)

Shadcn UI components used (install any missing ones via `npx shadcn-ui@latest add <name>`):
- `badge`
- `button`
- `input`
- `skeleton`
- `sheet`
- `avatar`
- `label`
- `textarea`
- `select`

Project utility imports required:

| Import | From | Used By |
|--------|------|---------|
| `useAuth` | `@/lib/auth` | dashboard, chat, purchase-orders, profile, more, weekly-report |
| `useTheme` | `@/lib/theme` | profile |
| `queryClient`, `apiRequest` | `@/lib/queryClient` | tasks, chat, panels, purchase-orders, weekly-report |
| `useToast` | `@/hooks/use-toast` | tasks, chat, panels, purchase-orders, weekly-report |
| `cn` | `@/lib/utils` | tasks, chat, jobs, panels, logistics, purchase-orders, weekly-report |
| `MobileLayout` | `@/components/layout/mobile-layout` | weekly-report |
| `GlobalSettings` type | `@shared/schema` | dashboard |

---

## API ROUTES

These pages import route constants from `@shared/api-routes`. Ensure these exist:

```typescript
CHAT_ROUTES.CONVERSATIONS                      // GET list
CHAT_ROUTES.MESSAGES(conversationId)            // GET/POST
CHAT_ROUTES.MARK_READ_CONVERSATION(conversationId)  // POST

TASKS_ROUTES.NOTIFICATIONS                     // GET
TASKS_ROUTES.GROUPS                            // GET (with nested tasks)
TASKS_ROUTES.LIST                              // POST create
TASKS_ROUTES.BY_ID(taskId)                     // PATCH update

ADMIN_ROUTES.JOBS                              // GET list
ADMIN_ROUTES.SETTINGS                          // GET global settings
ADMIN_ROUTES.PANEL_BY_ID(panelId)              // PATCH update

PANELS_ROUTES.LIST                             // GET list

LOGISTICS_ROUTES.LOAD_LISTS                    // GET list

PROCUREMENT_ROUTES.PURCHASE_ORDERS             // GET list
PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(poId)  // GET detail
PROCUREMENT_ROUTES.PURCHASE_ORDER_APPROVE(poId) // POST
PROCUREMENT_ROUTES.PURCHASE_ORDER_REJECT(poId)  // POST

WEEKLY_REPORTS_ROUTES.JOB_REPORTS              // POST create
WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY           // GET my reports
WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING      // GET pending (manager)
WEEKLY_REPORTS_ROUTES.JOB_REPORT_SUBMIT(id)    // POST
WEEKLY_REPORTS_ROUTES.JOB_REPORT_APPROVE(id)   // POST
WEEKLY_REPORTS_ROUTES.JOB_REPORT_REJECT(id)    // POST

JOBS_ROUTES.LIST                               // GET list
```

---

## DESIGN SPECS

- **Background**: `#070B12` (main), `#0D1117` (sheets, bottom nav)
- **Cards**: `bg-white/5` with `border border-white/10 rounded-2xl`
- **Text**: white primary, `white/60` secondary, `white/50` tertiary
- **Borders**: `border-white/10`
- **Safe area**: Headers use `style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}`
- **Bottom nav**: `style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}`
- **Layout pattern**: Every page uses `flex flex-col h-screen overflow-hidden` with content area `flex-1 overflow-y-auto pb-24`
- **Bottom padding**: `pb-24` to clear the fixed 64px bottom nav bar
- **Target device**: iPhone 14+ (390px width)
- **Sheets**: Bottom sheets with `h-[70vh]` or `h-[80vh]`, `rounded-t-2xl`, `bg-[#0D1117]`

---

## SHARED COMPONENTS

---

### FILE: `client/src/components/mobile/MobileBottomNav.tsx`

```tsx
import { Link, useLocation } from "wouter";
import { Home, Briefcase, MessageSquare, ListTodo, MoreHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CHAT_ROUTES } from "@shared/api-routes";

interface ChatConversation {
  id: string;
  unreadCount: number;
}

interface TabButtonProps {
  label: string;
  active: boolean;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

function TabButton({ label, active, href, icon, badge }: TabButtonProps) {
  return (
    <Link href={href}>
      <div
        className={`flex flex-col items-center justify-center py-2 ${
          active ? "text-blue-400" : "text-white/60"
        }`}
        data-testid={`tab-${label.toLowerCase()}`}
      >
        <div className="relative">
          {icon}
          {badge && badge > 0 ? (
            <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </div>
        <span className="mt-1 text-[10px] font-medium">{label}</span>
      </div>
    </Link>
  );
}

export default function MobileBottomNav() {
  const [location] = useLocation();
  
  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
  });
  
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const isActive = (path: string) => {
    if (path === "/mobile" || path === "/mobile/dashboard") {
      return location === "/mobile" || location === "/mobile/dashboard";
    }
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0D1117]">
      <div className="grid h-16 grid-cols-5 items-center" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <TabButton 
          label="Home" 
          active={isActive("/mobile/dashboard") || location === "/mobile"} 
          href="/mobile/dashboard" 
          icon={<Home className="h-5 w-5" />} 
        />
        <TabButton 
          label="Jobs" 
          active={isActive("/mobile/jobs")} 
          href="/mobile/jobs" 
          icon={<Briefcase className="h-5 w-5" />} 
        />
        <TabButton 
          label="Chat" 
          active={isActive("/mobile/chat")} 
          href="/mobile/chat" 
          icon={<MessageSquare className="h-5 w-5" />}
          badge={unreadCount}
        />
        <TabButton 
          label="Tasks" 
          active={isActive("/mobile/tasks")} 
          href="/mobile/tasks" 
          icon={<ListTodo className="h-5 w-5" />} 
        />
        <TabButton 
          label="More" 
          active={isActive("/mobile/more") || isActive("/mobile/profile") || isActive("/mobile/panels") || isActive("/mobile/logistics") || isActive("/mobile/purchase-orders") || isActive("/mobile/weekly-report")} 
          href="/mobile/more" 
          icon={<MoreHorizontal className="h-5 w-5" />} 
        />
      </div>
    </nav>
  );
}
```

---

### FILE: `client/src/components/layout/mobile-layout.tsx`

```tsx
import { Link, useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function MobileLayout({ children, title, showBackButton = true }: MobileLayoutProps) {
  const [location, setLocation] = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/mobile/dashboard");
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex-shrink-0 flex items-center gap-2 px-2 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 safe-area-top">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-white hover:bg-white/20"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        <h1 className="text-white text-lg font-semibold flex-1">
          {title || "BuildPlus"}
        </h1>
      </header>
      
      <main 
        className="flex-1 overflow-y-auto overscroll-contain pb-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>
    </div>
  );
}
```

---

## PAGE COMPONENTS

---

### FILE: `client/src/pages/mobile/dashboard.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { CHAT_ROUTES, TASKS_ROUTES, ADMIN_ROUTES, PANELS_ROUTES, LOGISTICS_ROUTES, PROCUREMENT_ROUTES } from "@shared/api-routes";
import type { GlobalSettings } from "@shared/schema";
import {
  ListTodo,
  MessageSquare,
  Briefcase,
  Truck,
  ShoppingCart,
  ClipboardList,
  Search,
  ChevronRight,
  Home,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface ChatConversation {
  id: string;
  unreadCount: number;
}

interface TaskNotification {
  id: string;
  readAt: string | null;
}

interface Job {
  id: string;
  status: string;
}

interface Panel {
  id: string;
  productionApprovalStatus?: string;
}

interface LoadList {
  id: string;
}

interface PurchaseOrder {
  id: string;
}

function Badge({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span className="ml-2 inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-red-500 px-2 text-[12px] font-semibold text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function StatCard({
  value,
  title,
  subtitle,
  accent,
}: {
  value: number;
  title: string;
  subtitle?: string;
  accent: "blue" | "green" | "yellow" | "red";
}) {
  const accentMap = {
    blue: "text-blue-400",
    green: "text-green-400",
    yellow: "text-yellow-300",
    red: "text-red-400",
  } as const;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid={`stat-${title.toLowerCase()}`}>
      <div className={`text-3xl font-bold ${accentMap[accent]}`}>{value}</div>
      <div className="mt-1 text-sm font-semibold text-white">{title}</div>
      {subtitle ? <div className="mt-0.5 text-xs text-white/60">{subtitle}</div> : null}
    </div>
  );
}

function NavRow({
  icon,
  iconBg,
  label,
  count,
  onClick,
  badge,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  count?: number;
  badge?: number;
  onClick?: () => void;
  href: string;
}) {
  return (
    <Link href={href}>
      <button
        onClick={onClick}
        className="flex h-[70px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 text-left active:scale-[0.99]"
        data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>

        <div className="flex-1">
          <div className="text-base font-semibold text-white">{label}</div>
        </div>

        <div className="flex items-center gap-2">
          {typeof count === "number" && count > 0 ? (
            <span className="text-sm font-semibold text-white/80">{count}</span>
          ) : null}
          {badge && badge > 0 ? <Badge value={badge} /> : null}
          <ChevronRight className="h-5 w-5 text-white/40" />
        </div>
      </button>
    </Link>
  );
}

export default function MobileDashboard() {
  const { user } = useAuth();

  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
  });

  const { data: taskNotifications = [] } = useQuery<TaskNotification[]>({
    queryKey: [TASKS_ROUTES.NOTIFICATIONS],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const { data: panels = [] } = useQuery<Panel[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const { data: loadLists = [] } = useQuery<LoadList[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
  });

  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const openTasks = taskNotifications.filter(n => !n.readAt).length;
  const totalTasks = taskNotifications.length;
  const activeJobs = jobs.filter(j => j.status === "ACTIVE").length;
  const inProgressPanels = panels.filter(p => p.productionApprovalStatus === "APPROVED").length;
  const criticalIssues = panels.filter(p => p.productionApprovalStatus === "REJECTED").length;

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            {globalSettings?.logoBase64 ? (
              <img 
                src={globalSettings.logoBase64} 
                alt={globalSettings.companyName || "Company Logo"} 
                className="h-9 object-contain"
                data-testid="img-logo"
              />
            ) : (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <div className="text-lg font-bold">{globalSettings?.companyName || "BuildPlus Ai"}</div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button className="text-white/80" data-testid="button-search">
              <Search className="h-5 w-5" />
            </button>
            <Link href="/mobile/chat">
              <button className="relative text-white/80" data-testid="button-chat-header">
                <MessageSquare className="h-5 w-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <div className="grid grid-cols-4 gap-2">
          <StatCard value={totalTasks} title="Tasks" subtitle={`${openTasks} open`} accent="blue" />
          <StatCard value={activeJobs} title="Jobs" subtitle="In Progress" accent="green" />
          <StatCard value={inProgressPanels} title="Panels" subtitle="In Progress" accent="yellow" />
          <StatCard value={criticalIssues} title="Critical" subtitle="Issues" accent="red" />
        </div>

        <div className="mt-6 space-y-3">
          <NavRow
            icon={<ListTodo className="h-5 w-5 text-blue-400" />}
            iconBg="bg-blue-500/20"
            label="Tasks"
            count={openTasks}
            href="/mobile/tasks"
          />
          <NavRow
            icon={<MessageSquare className="h-5 w-5 text-purple-400" />}
            iconBg="bg-purple-500/20"
            label="Chat"
            badge={unreadMessages}
            href="/mobile/chat"
          />
          <NavRow
            icon={<Briefcase className="h-5 w-5 text-emerald-400" />}
            iconBg="bg-emerald-500/20"
            label="Jobs"
            count={activeJobs}
            href="/mobile/jobs"
          />
          <NavRow
            icon={<ClipboardList className="h-5 w-5 text-amber-400" />}
            iconBg="bg-amber-500/20"
            label="Panel Register"
            count={panels.length}
            href="/mobile/panels"
          />
          <NavRow
            icon={<Truck className="h-5 w-5 text-orange-400" />}
            iconBg="bg-orange-500/20"
            label="Logistics"
            count={loadLists.length}
            href="/mobile/logistics"
          />
          <NavRow
            icon={<ShoppingCart className="h-5 w-5 text-fuchsia-400" />}
            iconBg="bg-fuchsia-500/20"
            label="Purchase Orders"
            count={purchaseOrders.length}
            href="/mobile/purchase-orders"
          />
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
```

---

### FILE: `client/src/pages/mobile/tasks.tsx`

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TASKS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Pause, 
  Circle, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Calendar,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "STUCK" | "DONE" | "ON_HOLD";

interface TaskAssignee {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
}

interface Task {
  id: string;
  groupId: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: string | null;
  assignees: TaskAssignee[];
}

interface TaskGroup {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  tasks: Task[];
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; label: string; color: string; bgColor: string }> = {
  NOT_STARTED: { icon: Circle, label: "Not Started", color: "text-white/40", bgColor: "bg-white/10" },
  IN_PROGRESS: { icon: Clock, label: "In Progress", color: "text-blue-400", bgColor: "bg-blue-500" },
  STUCK: { icon: AlertCircle, label: "Stuck", color: "text-red-400", bgColor: "bg-red-500" },
  DONE: { icon: CheckCircle2, label: "Done", color: "text-green-400", bgColor: "bg-green-500" },
  ON_HOLD: { icon: Pause, label: "On Hold", color: "text-yellow-400", bgColor: "bg-yellow-500" },
};

const statusOrder: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "STUCK", "ON_HOLD", "DONE"];

const priorityColors: Record<string, string> = {
  LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function MobileTasksPage() {
  const { toast } = useToast();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskGroupId, setNewTaskGroupId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const { data: groups = [], isLoading } = useQuery<TaskGroup[]>({
    queryKey: [TASKS_ROUTES.GROUPS],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) => {
      return apiRequest("PATCH", TASKS_ROUTES.BY_ID(taskId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "Task updated" });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ groupId, title }: { groupId: string; title: string }) => {
      return apiRequest("POST", TASKS_ROUTES.LIST, { groupId, title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewTaskGroupId(null);
      setNewTaskTitle("");
      toast({ title: "Task created" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const cycleStatus = (task: Task) => {
    const currentIndex = statusOrder.indexOf(task.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    const nextStatus = statusOrder[nextIndex];
    updateTaskMutation.mutate({ taskId: task.id, data: { status: nextStatus } });
  };

  const handleCreateTask = (groupId: string) => {
    if (newTaskTitle.trim()) {
      createTaskMutation.mutate({ groupId, title: newTaskTitle.trim() });
    }
  };

  const totalTasks = groups.reduce((sum, g) => sum + (g.tasks?.length || 0), 0);
  const activeTasks = groups.reduce((sum, g) => sum + (g.tasks?.filter(t => t.status !== "DONE").length || 0), 0);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold" data-testid="text-tasks-title">Tasks</div>
          <div className="text-sm text-white/60">
            {activeTasks} active of {totalTasks} total
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-12 rounded-2xl bg-white/10" />
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No task groups yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id);
              const groupTasks = group.tasks || [];
              const activeCount = groupTasks.filter(t => t.status !== "DONE").length;

              return (
                <div key={group.id} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5"
                    data-testid={`group-${group.id}`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: group.color || "#6b7280" }}
                    />
                    <span className="font-semibold flex-1 text-left text-white">{group.name}</span>
                    <span className="text-sm text-white/60">
                      {activeCount}/{groupTasks.length}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-white/40" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white/40" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2 ml-2">
                      {groupTasks.map((task) => {
                        const statusInfo = statusConfig[task.status];
                        const StatusIcon = statusInfo.icon;

                        return (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 p-4 rounded-2xl border border-white/10 bg-white/5"
                            data-testid={`task-${task.id}`}
                          >
                            <button
                              onClick={() => cycleStatus(task)}
                              className="mt-0.5 flex-shrink-0"
                              data-testid={`task-status-${task.id}`}
                            >
                              <StatusIcon className={cn("h-6 w-6", statusInfo.color)} />
                            </button>
                            
                            <button 
                              onClick={() => setSelectedTask(task)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <h3 className={cn(
                                "font-medium text-sm leading-snug text-white",
                                task.status === "DONE" && "line-through text-white/40"
                              )}>
                                {task.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {task.priority && (
                                  <Badge variant="outline" className={cn("text-xs border", priorityColors[task.priority])}>
                                    {task.priority}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.dueDate), "dd MMM")}
                                  </span>
                                )}
                                {task.assignees?.length > 0 && (
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {task.assignees.length}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}

                      {newTaskGroupId === group.id ? (
                        <div className="flex items-center gap-2 p-3 rounded-2xl border border-white/10 bg-white/5">
                          <Input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Task name..."
                            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCreateTask(group.id);
                              if (e.key === "Escape") {
                                setNewTaskGroupId(null);
                                setNewTaskTitle("");
                              }
                            }}
                            data-testid="input-new-task"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleCreateTask(group.id)}
                            disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                            className="bg-blue-500 hover:bg-blue-600"
                            data-testid="button-create-task"
                          >
                            Add
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setNewTaskGroupId(null);
                              setNewTaskTitle("");
                            }}
                            className="text-white/60"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewTaskGroupId(group.id)}
                          className="w-full justify-start text-white/50"
                          data-testid={`button-add-task-${group.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add task
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedTask && (
            <TaskDetailSheet 
              task={selectedTask} 
              onClose={() => setSelectedTask(null)}
              onStatusChange={(status) => {
                updateTaskMutation.mutate({ taskId: selectedTask.id, data: { status } });
                setSelectedTask({ ...selectedTask, status });
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function TaskDetailSheet({ 
  task, 
  onClose,
  onStatusChange,
}: { 
  task: Task; 
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <SheetTitle className="text-left text-white">{task.title}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOrder.map((status) => {
              const config = statusConfig[status];
              const isActive = task.status === status;
              
              return (
                <Button
                  key={status}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onStatusChange(status)}
                  className={cn(
                    "flex items-center gap-2",
                    isActive ? config.bgColor : "border-white/20 text-white/70"
                  )}
                  data-testid={`status-option-${status}`}
                >
                  <config.icon className="h-4 w-4" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>

        {task.dueDate && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Due Date</label>
            <p className="text-sm text-white">{format(new Date(task.dueDate), "EEEE, MMMM d, yyyy")}</p>
          </div>
        )}

        {task.priority && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Priority</label>
            <Badge variant="outline" className={cn("border", priorityColors[task.priority])}>
              {task.priority}
            </Badge>
          </div>
        )}

        {task.assignees?.length > 0 && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-2 block">Assignees</label>
            <div className="space-y-2">
              {task.assignees.map((assignee) => (
                <div key={assignee.id} className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                    {assignee.user.name?.charAt(0) || assignee.user.email.charAt(0)}
                  </div>
                  <span className="text-white">{assignee.user.name || assignee.user.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4">
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
```

---

### REMAINING FILES (8 of 10 pages)

The remaining 8 page files are provided in full in the companion document:

**`MOBILE_PAGES_SOURCE.md`** - Contains complete inline source code for:
- `client/src/pages/mobile/chat.tsx` (358 lines)
- `client/src/pages/mobile/jobs.tsx` (255 lines)
- `client/src/pages/mobile/panels.tsx` (339 lines)
- `client/src/pages/mobile/logistics.tsx` (169 lines)
- `client/src/pages/mobile/purchase-orders.tsx` (403 lines)
- `client/src/pages/mobile/more.tsx` (105 lines)
- `client/src/pages/mobile/profile.tsx` (138 lines)
- `client/src/pages/mobile/weekly-job-report.tsx` (921 lines)

All source files are also available ready-to-copy in the `mobile-export/` directory.

---

## PAGE FEATURES REFERENCE

| Page | Route | Key Features |
|------|-------|-------------|
| Dashboard | `/mobile/dashboard` | 4-column KPI grid, navigation rows with colored icons, company logo, unread badges |
| Tasks | `/mobile/tasks` | Collapsible task groups, tap-to-cycle status icon, inline create, detail bottom sheet |
| Chat | `/mobile/chat` | Conversation list with unread sorting, full-screen messaging, iOS keyboard handling, auto-scroll |
| Jobs | `/mobile/jobs` | Active/other grouping, detail sheet with site contact call button, production info |
| Panels | `/mobile/panels` | Status management (NOT_STARTED/IN_PROGRESS/ON_HOLD/COMPLETED), detail sheet with specs |
| Logistics | `/mobile/logistics` | Active loads, recent deliveries, panel counts, scheduled dates, read-only |
| Purchase Orders | `/mobile/purchase-orders` | Pending/active/received grouping, approve/reject workflow (managers only), line items |
| More | `/mobile/more` | Menu linking to secondary pages (panels, logistics, POs, weekly report, profile), logout |
| Profile | `/mobile/profile` | Avatar, user info display, theme toggle (light/dark), sign out |
| Weekly Report | `/mobile/weekly-report` | Create/submit/approve reports, job schedule entries with 7/14/21/28 day levels |

---

## PROMPT FOR ANOTHER REPLIT AGENT

### Option A: Same Replit project (files already exist)

If the `mobile-export/` directory is in this project, paste this prompt to the agent:

---

I need you to integrate mobile pages into my application. All 12 source files are in the `mobile-export/` directory. For each file, read it from `mobile-export/` and create it at the corresponding path under `client/src/`. Then register all mobile routes in `App.tsx` following the instructions in `MOBILE_INTEGRATION_GUIDE.md`. The files are:

- `mobile-export/client/src/components/mobile/MobileBottomNav.tsx` -> `client/src/components/mobile/MobileBottomNav.tsx`
- `mobile-export/client/src/components/layout/mobile-layout.tsx` -> `client/src/components/layout/mobile-layout.tsx`
- `mobile-export/client/src/pages/mobile/dashboard.tsx` -> `client/src/pages/mobile/dashboard.tsx`
- `mobile-export/client/src/pages/mobile/tasks.tsx` -> `client/src/pages/mobile/tasks.tsx`
- `mobile-export/client/src/pages/mobile/chat.tsx` -> `client/src/pages/mobile/chat.tsx`
- `mobile-export/client/src/pages/mobile/jobs.tsx` -> `client/src/pages/mobile/jobs.tsx`
- `mobile-export/client/src/pages/mobile/panels.tsx` -> `client/src/pages/mobile/panels.tsx`
- `mobile-export/client/src/pages/mobile/logistics.tsx` -> `client/src/pages/mobile/logistics.tsx`
- `mobile-export/client/src/pages/mobile/purchase-orders.tsx` -> `client/src/pages/mobile/purchase-orders.tsx`
- `mobile-export/client/src/pages/mobile/more.tsx` -> `client/src/pages/mobile/more.tsx`
- `mobile-export/client/src/pages/mobile/profile.tsx` -> `client/src/pages/mobile/profile.tsx`
- `mobile-export/client/src/pages/mobile/weekly-job-report.tsx` -> `client/src/pages/mobile/weekly-job-report.tsx`

After creating files, add route imports and `<Route>` entries as documented in the guide. Verify Shadcn components (badge, button, input, skeleton, sheet, avatar, label, textarea, select) and npm packages (date-fns, wouter, @tanstack/react-query, lucide-react) are installed. Verify API route constants exist in `@shared/api-routes`.

---

### Option B: Different Replit project (no mobile-export/ directory)

If you're working in a different project, you need BOTH guide documents:

1. Copy `MOBILE_INTEGRATION_GUIDE.md` into the target project
2. Copy `MOBILE_PAGES_SOURCE.md` into the target project

Then paste this prompt to the agent:

---

I need you to integrate mobile pages into my application. The complete source code for all 12 files is documented in two files:

1. `MOBILE_INTEGRATION_GUIDE.md` - Contains instructions, route registration, dependencies, and inline source for 4 files (MobileBottomNav.tsx, mobile-layout.tsx, dashboard.tsx, tasks.tsx)
2. `MOBILE_PAGES_SOURCE.md` - Contains inline source for the remaining 8 files (chat.tsx, jobs.tsx, panels.tsx, logistics.tsx, purchase-orders.tsx, more.tsx, profile.tsx, weekly-job-report.tsx)

Read both documents. For each file section marked with `### FILE:`, extract the code from the tsx code block and create the file at the indicated path. Then register all mobile routes in `App.tsx` following the route registration instructions in the guide. Verify all Shadcn components and npm dependencies are installed. Verify API route constants exist in `@shared/api-routes`.

---

### Route summary for verification (all 10 pages + 1 redirect = 11 routes):

| # | Route | Component |
|---|-------|-----------|
| 1 | `/mobile/dashboard` | `MobileDashboard` |
| 2 | `/mobile/tasks` | `MobileTasksPage` |
| 3 | `/mobile/chat` | `MobileChatPage` |
| 4 | `/mobile/logistics` | `MobileLogisticsPage` |
| 5 | `/mobile/profile` | `MobileProfilePage` |
| 6 | `/mobile/jobs` | `MobileJobsPage` |
| 7 | `/mobile/panels` | `MobilePanelsPage` |
| 8 | `/mobile/purchase-orders` | `MobilePurchaseOrdersPage` |
| 9 | `/mobile/weekly-report` | `MobileWeeklyJobReportPage` |
| 10 | `/mobile/more` | `MobileMorePage` |
| 11 | `/mobile` | Redirect to `/mobile/dashboard` |
