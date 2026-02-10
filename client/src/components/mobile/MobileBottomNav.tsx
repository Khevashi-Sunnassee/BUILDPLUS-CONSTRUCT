import { Link, useLocation } from "wouter";
import { Home, Briefcase, MessageSquare, ListTodo, MoreHorizontal, ScanLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CHAT_ROUTES } from "@shared/api-routes";
import { useMobilePermissions } from "@/hooks/use-mobile-permissions";

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
  const { isHidden } = useMobilePermissions();
  
  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
    enabled: !isHidden("chat"),
  });
  
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const isActive = (path: string) => {
    if (path === "/mobile" || path === "/mobile/dashboard") {
      return location === "/mobile" || location === "/mobile/dashboard";
    }
    return location.startsWith(path);
  };

  const showJobs = !isHidden("jobs");
  const showChat = !isHidden("chat");
  const showScan = !isHidden("qr-scanner");

  const visibleTabs: React.ReactNode[] = [];

  visibleTabs.push(
    <TabButton
      key="home"
      label="Home"
      active={isActive("/mobile/dashboard") || location === "/mobile"}
      href="/mobile/dashboard"
      icon={<Home className="h-5 w-5" />}
    />
  );

  if (showJobs) {
    visibleTabs.push(
      <TabButton
        key="jobs"
        label="Jobs"
        active={isActive("/mobile/jobs")}
        href="/mobile/jobs"
        icon={<Briefcase className="h-5 w-5" />}
      />
    );
  }

  if (showScan) {
    const scanActive = isActive("/mobile/scan");
    visibleTabs.push(
      <Link key="scan" href="/mobile/scan">
        <div
          className="flex flex-col items-center justify-center py-1"
          data-testid="tab-scan"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${scanActive ? "bg-blue-500" : "bg-blue-500/20"}`}>
            <ScanLine className={`h-5 w-5 ${scanActive ? "text-white" : "text-blue-400"}`} />
          </div>
          <span className={`mt-0.5 text-[10px] font-medium ${scanActive ? "text-blue-400" : "text-white/60"}`}>Scan</span>
        </div>
      </Link>
    );
  }

  if (showChat) {
    visibleTabs.push(
      <TabButton
        key="chat"
        label="Chat"
        active={isActive("/mobile/chat")}
        href="/mobile/chat"
        icon={<MessageSquare className="h-5 w-5" />}
        badge={unreadCount}
      />
    );
  }

  visibleTabs.push(
    <TabButton
      key="more"
      label="More"
      active={isActive("/mobile/more") || isActive("/mobile/profile") || isActive("/mobile/panels") || isActive("/mobile/logistics") || isActive("/mobile/purchase-orders") || isActive("/mobile/weekly-report") || isActive("/mobile/documents") || isActive("/mobile/checklists") || isActive("/mobile/tasks")}
      href="/mobile/more"
      icon={<MoreHorizontal className="h-5 w-5" />}
    />
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0D1117]">
      <div
        className="grid h-16 items-center"
        style={{
          gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {visibleTabs}
      </div>
    </nav>
  );
}
