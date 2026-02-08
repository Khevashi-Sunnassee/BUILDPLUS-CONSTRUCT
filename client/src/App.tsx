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
import AdminCustomersPage from "@/pages/admin/customers";
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
import AssetRegisterPage from "@/pages/admin/asset-register";
import AssetDetailPage from "@/pages/admin/asset-detail";
import TemplateEditorPage from "@/pages/admin/template-editor";
import ChecklistsPage from "@/pages/checklists";
import ChecklistFillPage from "@/pages/checklist-fill";
import ChecklistReportsPage from "@/pages/checklist-reports";
import ProcurementReoSchedulingPage from "@/pages/procurement-reo-scheduling";
import BroadcastPage from "@/pages/broadcast";
import ContractHubPage from "@/pages/contract-hub";
import ContractDetailPage from "@/pages/contract-detail";
import ProgressClaimsPage from "@/pages/progress-claims";
import ProgressClaimFormPage from "@/pages/progress-claim-form";
import RetentionReportPage from "@/pages/retention-report";

import MobileLoginPage from "@/pages/mobile/login";
import MobileDashboard from "@/pages/mobile/dashboard";
import MobileTasksPage from "@/pages/mobile/tasks";
import MobileChatPage from "@/pages/mobile/chat";
import MobileJobsPage from "@/pages/mobile/jobs";
import MobilePanelsPage from "@/pages/mobile/panels";
import MobilePanelDetailPage from "@/pages/mobile/panel-detail";
import MobileLogisticsPage from "@/pages/mobile/logistics";
import MobileCreateLoadListPage from "@/pages/mobile/create-load-list";
import MobileRecordDeliveryPage from "@/pages/mobile/record-delivery";
import MobileReturnLoadPage from "@/pages/mobile/return-load";
import MobilePurchaseOrdersPage from "@/pages/mobile/purchase-orders";
import MobileMore from "@/pages/mobile/more";
import MobileProfilePage from "@/pages/mobile/profile";
import MobileWeeklyJobReportPage from "@/pages/mobile/weekly-job-report";
import MobileDocumentsPage from "@/pages/mobile/documents";
import MobileChecklistsPage from "@/pages/mobile/checklists";
import MobileChecklistFillPage from "@/pages/mobile/checklist-fill";
import MobileBroadcastPage from "@/pages/mobile/broadcast";
import MobileQrScanner from "@/pages/mobile/qr-scanner";
import MobileNewOpportunity from "@/pages/mobile/new-opportunity";
import MobilePhotoGalleryPage from "@/pages/mobile/photo-gallery";
import MobilePhotoCapturePage from "@/pages/mobile/photo-capture";
import MobileJobDetailPage from "@/pages/mobile/job-detail";
import PhotoGalleryPage from "@/pages/photo-gallery";
import SalesPipelinePage from "@/pages/sales-pipeline";
import HelpCenterPage from "@/pages/help-center";
import AdminHelpPage from "@/pages/admin/help";
import DataManagementPage from "@/pages/admin/data-management";
import { HelpProvider } from "@/components/help/help-provider";
import { HelpDrawer } from "@/components/help/help-drawer";

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

      <Route path="/admin/data-management">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <DataManagementPage />
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
