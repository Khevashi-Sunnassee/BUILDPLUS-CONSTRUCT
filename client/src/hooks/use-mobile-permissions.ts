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
  "photo-gallery": "document_register",
  checklists: "checklists",
  broadcast: "chat",
  "pm-call-logs": "production_report",
  "qr-scanner": "panel_register",
  "new-opportunity": "jobs",
  "photo-capture": "document_register",
};

export function useMobilePermissions() {
  const { user } = useAuth();

  const { data: myPermissions = [] } = useQuery<UserPermission[]>({
    queryKey: [USER_ROUTES.MY_PERMISSIONS],
    enabled: !!user,
  });

  const isHidden = (mobileKey: string): boolean => {
    const functionKey = mobileFunctionKeyMap[mobileKey];
    if (!functionKey) return false;
    const permission = myPermissions.find(p => p.functionKey === functionKey);
    if (!permission) {
      return myPermissions.length > 0;
    }
    return permission.permissionLevel === "HIDDEN";
  };

  return { isHidden, myPermissions };
}
