import { lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import { HelpProvider } from "@/components/help/help-provider";
import { HelpDrawer } from "@/components/help/help-drawer";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const DailyReportsPage = lazy(() => import("@/pages/daily-reports"));
const DailyReportDetailPage = lazy(() => import("@/pages/daily-report-detail"));
const ManagerReviewPage = lazy(() => import("@/pages/manager-review"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/settings"));
const AdminDevicesPage = lazy(() => import("@/pages/admin/devices"));
const AdminUsersPage = lazy(() => import("@/pages/admin/users"));
const AdminJobsPage = lazy(() => import("@/pages/admin/jobs"));
const AdminPanelsPage = lazy(() => import("@/pages/admin/panels"));
const AdminPanelTypesPage = lazy(() => import("@/pages/admin/panel-types"));
const AdminUserPermissionsPage = lazy(() => import("@/pages/admin/user-permissions"));
const AdminZonesPage = lazy(() => import("@/pages/admin/zones"));
const AdminFactoriesPage = lazy(() => import("@/pages/admin/factories"));
const AdminCustomersPage = lazy(() => import("@/pages/admin/customers"));
const AdminSuppliersPage = lazy(() => import("@/pages/admin/suppliers"));
const AdminEmployeesPage = lazy(() => import("@/pages/admin/employees"));
const EmployeeDetailPage = lazy(() => import("@/pages/admin/employee-detail"));
const AdminItemsPage = lazy(() => import("@/pages/admin/items"));
const DownloadsPage = lazy(() => import("@/pages/downloads"));
const ManualEntryPage = lazy(() => import("@/pages/manual-entry"));
const ProductionReportPage = lazy(() => import("@/pages/production-report"));
const ProductionReportDetailPage = lazy(() => import("@/pages/production-report-detail"));
const KPIDashboardPage = lazy(() => import("@/pages/kpi-dashboard"));
const LogisticsPage = lazy(() => import("@/pages/logistics"));
const WeeklyWageReportsPage = lazy(() => import("@/pages/weekly-wage-reports"));
const WeeklyJobLogsPage = lazy(() => import("@/pages/weekly-job-logs"));
const ProductionSlotsPage = lazy(() => import("@/pages/production-slots"));
const DraftingProgramPage = lazy(() => import("@/pages/drafting-program"));
const PurchaseOrdersPage = lazy(() => import("@/pages/purchase-orders"));
const PurchaseOrderFormPage = lazy(() => import("@/pages/purchase-order-form"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const PanelDetailsPage = lazy(() => import("@/pages/panel-details"));
const ChatPage = lazy(() => import("@/pages/chat"));
const ProductionSchedulePage = lazy(() => import("@/pages/production-schedule"));
const DocumentRegisterPage = lazy(() => import("@/pages/document-register"));
const PublicBundlePage = lazy(() => import("@/pages/public-bundle"));
const AdminDocumentConfigPage = lazy(() => import("@/pages/admin/document-config"));
const AdminCompaniesPage = lazy(() => import("@/pages/admin/companies"));
const AdminChecklistTemplatesPage = lazy(() => import("@/pages/admin/checklist-templates"));
const AssetRegisterPage = lazy(() => import("@/pages/admin/asset-register"));
const AssetDetailPage = lazy(() => import("@/pages/admin/asset-detail"));
const TemplateEditorPage = lazy(() => import("@/pages/admin/template-editor"));
const DataManagementPage = lazy(() => import("@/pages/admin/data-management"));
const AdminItemCategoriesPage = lazy(() => import("@/pages/admin/item-categories"));
const ChecklistsPage = lazy(() => import("@/pages/checklists"));
const ChecklistFillPage = lazy(() => import("@/pages/checklist-fill"));
const ChecklistReportsPage = lazy(() => import("@/pages/checklist-reports"));
const ProcurementReoSchedulingPage = lazy(() => import("@/pages/procurement-reo-scheduling"));
const BroadcastPage = lazy(() => import("@/pages/broadcast"));
const ContractHubPage = lazy(() => import("@/pages/contract-hub"));
const ContractDetailPage = lazy(() => import("@/pages/contract-detail"));
const ProgressClaimsPage = lazy(() => import("@/pages/progress-claims"));
const ProgressClaimFormPage = lazy(() => import("@/pages/progress-claim-form"));
const RetentionReportPage = lazy(() => import("@/pages/retention-report"));

const MobileLoginPage = lazy(() => import("@/pages/mobile/login"));
const MobileDashboard = lazy(() => import("@/pages/mobile/dashboard"));
const MobileTasksPage = lazy(() => import("@/pages/mobile/tasks"));
const MobileChatPage = lazy(() => import("@/pages/mobile/chat"));
const MobileJobsPage = lazy(() => import("@/pages/mobile/jobs"));
const MobilePanelsPage = lazy(() => import("@/pages/mobile/panels"));
const MobilePanelDetailPage = lazy(() => import("@/pages/mobile/panel-detail"));
const MobileLogisticsPage = lazy(() => import("@/pages/mobile/logistics"));
const MobileCreateLoadListPage = lazy(() => import("@/pages/mobile/create-load-list"));
const MobileRecordDeliveryPage = lazy(() => import("@/pages/mobile/record-delivery"));
const MobileReturnLoadPage = lazy(() => import("@/pages/mobile/return-load"));
const MobilePurchaseOrdersPage = lazy(() => import("@/pages/mobile/purchase-orders"));
const MobileMore = lazy(() => import("@/pages/mobile/more"));
const MobileProfilePage = lazy(() => import("@/pages/mobile/profile"));
const MobileWeeklyJobReportPage = lazy(() => import("@/pages/mobile/weekly-job-report"));
const MobileDocumentsPage = lazy(() => import("@/pages/mobile/documents"));
const MobileChecklistsPage = lazy(() => import("@/pages/mobile/checklists"));
const MobileChecklistFillPage = lazy(() => import("@/pages/mobile/checklist-fill"));
const MobileBroadcastPage = lazy(() => import("@/pages/mobile/broadcast"));
const MobileQrScanner = lazy(() => import("@/pages/mobile/qr-scanner"));
const MobileNewOpportunity = lazy(() => import("@/pages/mobile/new-opportunity"));
const MobilePhotoGalleryPage = lazy(() => import("@/pages/mobile/photo-gallery"));
const MobilePhotoCapturePage = lazy(() => import("@/pages/mobile/photo-capture"));
const MobileJobDetailPage = lazy(() => import("@/pages/mobile/job-detail"));
const PhotoGalleryPage = lazy(() => import("@/pages/photo-gallery"));
const SalesPipelinePage = lazy(() => import("@/pages/sales-pipeline"));
const HelpCenterPage = lazy(() => import("@/pages/help-center"));
const AdminHelpPage = lazy(() => import("@/pages/admin/help"));

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

function getMobileEquivalentRoute(desktopPath: string): string {
  const routeMap: Record<string, string> = {
    '/': '/mobile/dashboard',
    '/dashboard': '/mobile/dashboard',
    '/tasks': '/mobile/tasks',
    '/chat': '/mobile/chat',
    '/logistics': '/mobile/logistics',
    '/purchase-orders': '/mobile/purchase-orders',
  };
  return routeMap[desktopPath] || '/mobile/dashboard';
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [location] = useLocation();

  if (isMobile && !location.startsWith('/mobile')) {
    const mobileRoute = getMobileEquivalentRoute(location);
    return <Redirect to={mobileRoute} />;
  }

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
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <Switch>
      <Route path="/login">
        {user ? <Redirect to={isMobile ? "/mobile/dashboard" : "/dashboard"} /> : (isMobile ? <MobileLoginPage /> : <LoginPage />)}
      </Route>

      <Route path="/mobile/login">
        {user ? <Redirect to="/mobile/dashboard" /> : <MobileLoginPage />}
      </Route>

      <Route path="/bundle/:qrCodeId">
        <PublicBundlePage />
      </Route>

      <Route path="/">
        {user ? (
          <ProtectedRoute>
            <AuthenticatedLayout>
              <DashboardPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        ) : (
          <LandingPage />
        )}
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

      <Route path="/photo-gallery">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PhotoGalleryPage />
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

      <Route path="/admin/customers">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminCustomersPage />
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

      <Route path="/admin/employees/:id">
        <ProtectedRoute requiredRole={["ADMIN", "MANAGER"]}>
          <AuthenticatedLayout>
            <EmployeeDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/employees">
        <ProtectedRoute requiredRole={["ADMIN", "MANAGER"]}>
          <AuthenticatedLayout>
            <AdminEmployeesPage />
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

      <Route path="/admin/asset-register">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AssetRegisterPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/assets/:id">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AssetDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/data-management">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <DataManagementPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/item-categories">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminItemCategoriesPage />
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

      <Route path="/admin/checklist-templates/:id/edit">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <TemplateEditorPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/checklists">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ChecklistsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/checklists/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ChecklistFillPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/checklist-reports">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ChecklistReportsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/broadcast">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <BroadcastPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/contracts/:jobId">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ContractDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/contracts">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ContractHubPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/progress-claims/retention-report">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <RetentionReportPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/progress-claims/new">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProgressClaimFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/progress-claims/:id/edit">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProgressClaimFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/progress-claims/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProgressClaimFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/progress-claims">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ProgressClaimsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/sales-pipeline">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <SalesPipelinePage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/help">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <HelpCenterPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/help">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminHelpPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      {/* Mobile Routes */}
      <Route path="/mobile">
        <ProtectedRoute>
          <Redirect to="/mobile/dashboard" />
        </ProtectedRoute>
      </Route>
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
      <Route path="/mobile/jobs/:id">
        <ProtectedRoute>
          <MobileJobDetailPage />
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
      <Route path="/mobile/panels/:id">
        <ProtectedRoute>
          <MobilePanelDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/logistics">
        <ProtectedRoute>
          <MobileLogisticsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/logistics/create-load">
        <ProtectedRoute>
          <MobileCreateLoadListPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/logistics/record-delivery">
        <ProtectedRoute>
          <MobileRecordDeliveryPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/logistics/return-load">
        <ProtectedRoute>
          <MobileReturnLoadPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/purchase-orders">
        <ProtectedRoute>
          <MobilePurchaseOrdersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/more">
        <ProtectedRoute>
          <MobileMore />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/profile">
        <ProtectedRoute>
          <MobileProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/weekly-report">
        <ProtectedRoute>
          <MobileWeeklyJobReportPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/documents">
        <ProtectedRoute>
          <MobileDocumentsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/photo-gallery">
        <ProtectedRoute>
          <MobilePhotoGalleryPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/photo-capture">
        <ProtectedRoute>
          <MobilePhotoCapturePage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/checklists/:id">
        <ProtectedRoute>
          <MobileChecklistFillPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/checklists">
        <ProtectedRoute>
          <MobileChecklistsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/scan">
        <ProtectedRoute>
          <MobileQrScanner />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/broadcast">
        <ProtectedRoute>
          <MobileBroadcastPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/opportunities/new">
        <ProtectedRoute>
          <MobileNewOpportunity />
        </ProtectedRoute>
      </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <HelpProvider>
              <Router />
              <HelpDrawer />
              <Toaster />
            </HelpProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
