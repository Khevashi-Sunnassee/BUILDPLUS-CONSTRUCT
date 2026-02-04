import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DASHBOARD_ROUTES, CHAT_ROUTES, TASKS_ROUTES } from "@shared/api-routes";
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  TrendingUp,
  Activity,
  Timer,
  MessageSquare,
  ListTodo,
  Check
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

interface ChatConversation {
  id: string;
  name: string | null;
  type: string;
  unreadCount: number;
  unreadMentions: number;
  lastMessage?: {
    body: string | null;
    createdAt: string;
  } | null;
  members?: Array<{
    user?: {
      name: string;
      email: string;
    };
  }>;
}

interface DashboardStats {
  todayMinutes: number;
  todayIdleMinutes: number;
  pendingDays: number;
  submittedAwaitingApproval: number;
  approvedThisWeek: number;
  recentLogs: Array<{
    id: string;
    logDay: string;
    status: string;
    totalMinutes: number;
    app: string;
  }>;
}

interface TaskNotification {
  id: string;
  userId: string;
  taskId: string;
  updateId: string | null;
  type: string;
  title: string;
  body: string | null;
  fromUserId: string | null;
  createdAt: string;
  readAt: string | null;
  fromUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: [DASHBOARD_ROUTES.STATS],
  });

  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
  });

  const { data: taskNotifications = [] } = useQuery<TaskNotification[]>({
    queryKey: [TASKS_ROUTES.NOTIFICATIONS],
  });

  const markTaskNotificationRead = useMutation({
    mutationFn: (id: string) => apiRequest("POST", TASKS_ROUTES.NOTIFICATION_READ(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.NOTIFICATIONS] });
    },
  });

  const markAllTaskNotificationsRead = useMutation({
    mutationFn: () => apiRequest("POST", TASKS_ROUTES.NOTIFICATIONS_READ_ALL),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.NOTIFICATIONS] });
    },
  });

  const unreadTaskNotifications = taskNotifications.filter(n => !n.readAt);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const totalMentions = conversations.reduce((sum, c) => sum + (c.unreadMentions || 0), 0);
  const unreadConversations = conversations.filter(c => c.unreadCount > 0);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDING: { variant: "secondary", label: "Pending" },
      SUBMITTED: { variant: "default", label: "Submitted" },
      APPROVED: { variant: "outline", label: "Approved" },
      REJECTED: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || user?.email?.split("@")[0]}
        </p>
      </div>

      {totalUnread > 0 && (
        <Card className="border-primary bg-primary/5" data-testid="card-unread-messages">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Unread Messages
            </CardTitle>
            <Badge variant="default" className="text-lg px-3 py-1">
              {totalUnread}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {totalMentions > 0 && (
                <p className="text-sm font-medium text-primary">
                  You have {totalMentions} mention{totalMentions > 1 ? 's' : ''} requiring your attention
                </p>
              )}
              <div className="space-y-2">
                {unreadConversations.slice(0, 3).map(conv => {
                  const displayName = conv.name || 
                    conv.members?.find(m => m.user)?.user?.name || 
                    conv.members?.find(m => m.user)?.user?.email || 
                    "Conversation";
                  return (
                    <div key={conv.id} className="flex items-center justify-between p-2 rounded-md bg-background">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{displayName}</p>
                        {conv.lastMessage?.body && (
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage.body}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {conv.unreadCount} new
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <a href="/chat" className="block">
                <Button className="w-full" data-testid="button-view-messages">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View All Messages
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {unreadTaskNotifications.length > 0 && (
        <Card className="border-blue-500 bg-blue-500/5" data-testid="card-task-notifications">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-blue-500" />
              Task Updates
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-lg px-3 py-1 bg-blue-500">
                {unreadTaskNotifications.length}
              </Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => markAllTaskNotificationsRead.mutate()}
                disabled={markAllTaskNotificationsRead.isPending}
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unreadTaskNotifications.slice(0, 5).map(notif => (
                <div 
                  key={notif.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-background cursor-pointer hover-elevate"
                  onClick={() => {
                    markTaskNotificationRead.mutate(notif.id);
                    navigate("/tasks");
                  }}
                  data-testid={`task-notif-${notif.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{notif.title}</p>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground truncate">
                        {notif.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(notif.createdAt), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
              {unreadTaskNotifications.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{unreadTaskNotifications.length - 5} more notifications
                </p>
              )}
            </div>
            <Link href="/tasks" className="block mt-3">
              <Button className="w-full" variant="outline" data-testid="button-view-tasks">
                <ListTodo className="h-4 w-4 mr-2" />
                View Tasks
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-today-minutes">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Today's Work</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatMinutes(stats?.todayMinutes || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(stats?.todayIdleMinutes || 0)} idle time
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-pending-days">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.pendingDays || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting your review
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-awaiting-approval">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Awaiting Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.submittedAwaitingApproval || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Submitted for manager review
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-approved-week">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Approved This Week</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.approvedThisWeek || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Days approved
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common tasks and navigation
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/daily-reports">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-view-daily-reports">
                <FileText className="h-4 w-4" />
                View Drafting Register
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-view-analytics">
                <TrendingUp className="h-4 w-4" />
                View Analytics
              </Button>
            </Link>
            {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
              <Link href="/manager/review">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-review-submissions">
                  <CheckCircle2 className="h-4 w-4" />
                  Review Submissions
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Your latest time entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : stats?.recentLogs && stats.recentLogs.length > 0 ? (
              <div className="space-y-3">
                {stats.recentLogs.map((log) => (
                  <Link key={log.id} href={`/daily-reports/${log.id}`}>
                    <div className="flex items-center justify-between p-2 rounded-md hover-elevate cursor-pointer transition-colors" data-testid={`log-item-${log.id}`}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {format(new Date(log.logDay), "dd/MM/yyyy")}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {log.app}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatMinutes(log.totalMinutes)}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs">Time entries will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
