import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserSettingsPopover } from "@/components/user-settings-popover";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import DailyReportsPage from "@/pages/daily-reports";
import DailyReportDetailPage from "@/pages/daily-report-detail";
import ManagerReviewPage from "@/pages/manager-review";
import ReportsPage from "@/pages/reports";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminDevicesPage from "@/pages/admin/devices";
import AdminUsersPage from "@/pages/admin/users";
import AdminJobsPage from "@/pages/admin/jobs";
import AdminPanelsPage from "@/pages/admin/panels";
import AdminPanelTypesPage from "@/pages/admin/panel-types";
import AdminUserPermissionsPage from "@/pages/admin/user-permissions";
import AdminZonesPage from "@/pages/admin/zones";
import AdminFactoriesPage from "@/pages/admin/factories";
import AdminSuppliersPage from "@/pages/admin/suppliers";
import AdminItemsPage from "@/pages/admin/items";
import DownloadsPage from "@/pages/downloads";
import ManualEntryPage from "@/pages/manual-entry";
import ProductionReportPage from "@/pages/production-report";
import ProductionReportDetailPage from "@/pages/production-report-detail";
import KPIDashboardPage from "@/pages/kpi-dashboard";
import LogisticsPage from "@/pages/logistics";
import WeeklyWageReportsPage from "@/pages/weekly-wage-reports";
import WeeklyJobLogsPage from "@/pages/weekly-job-logs";
import ProductionSlotsPage from "@/pages/production-slots";
import DraftingProgramPage from "@/pages/drafting-program";
import PurchaseOrdersPage from "@/pages/purchase-orders";
import PurchaseOrderFormPage from "@/pages/purchase-order-form";
import TasksPage from "@/pages/tasks";
import PanelDetailsPage from "@/pages/panel-details";
import ChatPage from "@/pages/chat";
import ProductionSchedulePage from "@/pages/production-schedule";
import DocumentRegisterPage from "@/pages/document-register";
import PublicBundlePage from "@/pages/public-bundle";
import AdminDocumentConfigPage from "@/pages/admin/document-config";
import AdminCompaniesPage from "@/pages/admin/companies";
import AdminChecklistTemplatesPage from "@/pages/admin/checklist-templates";
import ProcurementReoSchedulingPage from "@/pages/procurement-reo-scheduling";

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <UserSettingsPopover />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/dashboard" /> : <LoginPage />}
      </Route>

      <Route path="/bundle/:qrCodeId">
        <PublicBundlePage />
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DashboardPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DashboardPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/daily-reports">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DailyReportsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/daily-reports/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DailyReportDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/manual-entry">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ManualEntryPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ReportsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/downloads">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DownloadsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/production-report">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProductionReportPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/production-report/:date">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProductionReportDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/kpi-dashboard">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <KPIDashboardPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/logistics">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <LogisticsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/weekly-wages">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <WeeklyWageReportsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/weekly-job-logs">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <WeeklyJobLogsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/production-slots">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProductionSlotsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/production-schedule">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProductionSchedulePage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/drafting-program">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DraftingProgramPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/purchase-orders">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PurchaseOrdersPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/purchase-orders/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PurchaseOrderFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/procurement-reo">
        <ProtectedRoute requiredRole={["ADMIN", "MANAGER"]}>
          <AuthenticatedLayout>
            <ProcurementReoSchedulingPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/tasks">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <TasksPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/chat">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ChatPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/documents">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DocumentRegisterPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/panel/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PanelDetailsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/manager/review">
        <ProtectedRoute requiredRole={["MANAGER", "ADMIN"]}>
          <AuthenticatedLayout>
            <ManagerReviewPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/settings">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminSettingsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/devices">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminDevicesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminUsersPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/jobs">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminJobsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/panels">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminPanelsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/panel-types">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminPanelTypesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/document-config">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminDocumentConfigPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/user-permissions">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminUserPermissionsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/companies">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminCompaniesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/zones">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminZonesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/factories">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminFactoriesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/suppliers">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminSuppliersPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/items">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminItemsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/checklist-templates">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminChecklistTemplatesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
