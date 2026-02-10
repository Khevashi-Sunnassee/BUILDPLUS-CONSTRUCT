import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { CHAT_ROUTES, TASKS_ROUTES, ADMIN_ROUTES, JOBS_ROUTES, PANELS_ROUTES, LOGISTICS_ROUTES, PROCUREMENT_ROUTES } from "@shared/api-routes";
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
  FolderOpen,
  ClipboardCheck,
  ImageIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { useMobilePermissions } from "@/hooks/use-mobile-permissions";

interface ChatConversation {
  id: string;
  unreadCount: number;
}

interface TaskGroup {
  id: string;
  tasks: Array<{
    id: string;
    status: string;
  }>;
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

function BadgeCount({ value }: { value: number }) {
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
          {badge && badge > 0 ? <BadgeCount value={badge} /> : null}
          <ChevronRight className="h-5 w-5 text-white/40" />
        </div>
      </button>
    </Link>
  );
}

export default function MobileDashboard() {
  const { user } = useAuth();
  const { isHidden } = useMobilePermissions();

  const showTasks = !isHidden("tasks");
  const showChat = !isHidden("chat");
  const showJobs = !isHidden("jobs");
  const showPanels = !isHidden("panels");
  const showLogistics = !isHidden("logistics");
  const showPOs = !isHidden("purchase-orders");
  const showDocuments = !isHidden("documents");
  const showChecklists = !isHidden("checklists");

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<ChatConversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
    enabled: showChat,
  });

  const { data: taskGroups = [], isLoading: loadingTasks } = useQuery<TaskGroup[]>({
    queryKey: [TASKS_ROUTES.GROUPS],
    enabled: showTasks,
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    enabled: showJobs,
  });

  const { data: panels = [], isLoading: loadingPanels } = useQuery<Panel[]>({
    queryKey: [PANELS_ROUTES.LIST],
    enabled: showPanels,
  });

  const { data: loadLists = [] } = useQuery<LoadList[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
    enabled: showLogistics,
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
    enabled: showPOs,
  });

  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  const isLoading = (showChat && loadingConversations) || (showTasks && loadingTasks) || (showJobs && loadingJobs) || (showPanels && loadingPanels);

  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const allTasks = taskGroups.flatMap(g => g.tasks);
  const totalTasks = allTasks.length;
  const openTasks = allTasks.filter(t => t.status !== "DONE").length;
  const activeJobs = jobs.filter(j => j.status === "ACTIVE").length;
  const inProgressPanels = panels.filter(p => p.productionApprovalStatus === "APPROVED").length;
  const criticalIssues = panels.filter(p => p.productionApprovalStatus === "REJECTED").length;

  const statCards = [];
  if (showTasks) statCards.push(<StatCard key="tasks" value={totalTasks} title="Tasks" subtitle={`${openTasks} open`} accent="blue" />);
  if (showJobs) statCards.push(<StatCard key="jobs" value={activeJobs} title="Jobs" subtitle="In Progress" accent="green" />);
  if (showPanels) statCards.push(<StatCard key="panels" value={inProgressPanels} title="Panels" subtitle="In Progress" accent="yellow" />);
  if (showPanels) statCards.push(<StatCard key="critical" value={criticalIssues} title="Critical" subtitle="Issues" accent="red" />);

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
            {showChat && (
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
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-2" data-testid="skeleton-stats">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Skeleton className="h-8 w-12 bg-white/10" />
                <Skeleton className="mt-2 h-4 w-16 bg-white/10" />
                <Skeleton className="mt-1 h-3 w-12 bg-white/10" />
              </div>
            ))}
          </div>
        ) : statCards.length > 0 ? (
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(statCards.length, 4)}, 1fr)` }}>
            {statCards}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {showTasks && (
            <NavRow
              icon={<ListTodo className="h-5 w-5 text-blue-400" />}
              iconBg="bg-blue-500/20"
              label="Tasks"
              count={openTasks}
              href="/mobile/tasks"
            />
          )}
          {showChat && (
            <NavRow
              icon={<MessageSquare className="h-5 w-5 text-purple-400" />}
              iconBg="bg-purple-500/20"
              label="Chat"
              badge={unreadMessages}
              href="/mobile/chat"
            />
          )}
          {showJobs && (
            <NavRow
              icon={<Briefcase className="h-5 w-5 text-emerald-400" />}
              iconBg="bg-emerald-500/20"
              label="Jobs"
              count={activeJobs}
              href="/mobile/jobs"
            />
          )}
          {showPanels && (
            <NavRow
              icon={<ClipboardList className="h-5 w-5 text-amber-400" />}
              iconBg="bg-amber-500/20"
              label="Panel Register"
              count={panels.length}
              href="/mobile/panels"
            />
          )}
          {showLogistics && (
            <NavRow
              icon={<Truck className="h-5 w-5 text-orange-400" />}
              iconBg="bg-orange-500/20"
              label="Logistics"
              count={loadLists.length}
              href="/mobile/logistics"
            />
          )}
          {showPOs && (
            <NavRow
              icon={<ShoppingCart className="h-5 w-5 text-fuchsia-400" />}
              iconBg="bg-fuchsia-500/20"
              label="Purchase Orders"
              count={purchaseOrders.length}
              href="/mobile/purchase-orders"
            />
          )}
          {showDocuments && (
            <NavRow
              icon={<FolderOpen className="h-5 w-5 text-cyan-400" />}
              iconBg="bg-cyan-500/20"
              label="Documents"
              href="/mobile/documents"
            />
          )}
          {showDocuments && (
            <NavRow
              icon={<ImageIcon className="h-5 w-5 text-pink-400" />}
              iconBg="bg-pink-500/20"
              label="Photo Gallery"
              href="/mobile/photo-gallery"
            />
          )}
          {showChecklists && (
            <NavRow
              icon={<ClipboardCheck className="h-5 w-5 text-teal-400" />}
              iconBg="bg-teal-500/20"
              label="Checklists"
              href="/mobile/checklists"
            />
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
