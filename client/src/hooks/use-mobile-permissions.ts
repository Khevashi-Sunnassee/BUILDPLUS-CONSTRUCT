import { useQuery } from "@tanstack/react-query";
import { USER_ROUTES } from "@shared/api-routes";
import type { UserPermission } from "@shared/schema";
import { useAuth } from "@/lib/auth";

const mobileFunctionKeyMap: Record<string, string> = {
  tasks: "tasks",
  jobs: "jobs",
  chat: "chat",
  panels: "panel_register",
  logistics: "logistics",
  "purchase-orders": "purchase_orders",
  "weekly-report": "weekly_job_logs",
  documents: "document_register",
  "photo-gallery": "photo_gallery",
  checklists: "checklists",
  broadcast: "broadcast",
  "pm-call-logs": "pm_call_logs",
  "qr-scanner": "panel_register",
  "new-opportunity": "sales_pipeline",
  "photo-capture": "document_register",
  "hire-bookings": "hire_bookings",
  "financial-analysis": "financial_analysis",
};

export function useMobilePermissions() {
  const { user } = useAuth();

  const { data: myPermissions, isLoading } = useQuery<UserPermission[]>({
    queryKey: [USER_ROUTES.MY_PERMISSIONS],
    enabled: !!user,
  });

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";

  const isHidden = (mobileKey: string): boolean => {
    if (isAdminOrManager) return false;
    if (isLoading || !myPermissions) return true;
    const functionKey = mobileFunctionKeyMap[mobileKey];
    if (!functionKey) return true;
    const permission = myPermissions.find(p => p.functionKey === functionKey);
    if (!permission) return true;
    return permission.permissionLevel === "HIDDEN";
  };

  return { isHidden, myPermissions: myPermissions || [], isLoading };
}
