import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { UserSettingsPopover } from "@/components/user-settings-popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import { HelpProvider } from "@/components/help/help-provider";
import { HelpDrawer } from "@/components/help/help-drawer";
import { ErrorBoundary } from "@/components/error-boundary";
import { initGlobalErrorTracking } from "@/lib/error-tracker";

initGlobalErrorTracking();

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err: Error) => {
      if (
        err.message.includes("Failed to fetch dynamically imported module") ||
        err.message.includes("Loading chunk") ||
        err.message.includes("Loading CSS chunk")
      ) {
        const hasReloaded = sessionStorage.getItem("chunk_reload");
        if (!hasReloaded) {
          sessionStorage.setItem("chunk_reload", "1");
          window.location.reload();
        } else {
          sessionStorage.removeItem("chunk_reload");
        }
      }
      throw err;
    })
  );
}

const DashboardPage = lazyWithRetry(() => import("@/pages/dashboard"));
const DailyReportsPage = lazyWithRetry(() => import("@/pages/daily-reports"));
const DailyReportDetailPage = lazyWithRetry(() => import("@/pages/daily-report-detail"));
const ManagerReviewPage = lazyWithRetry(() => import("@/pages/manager-review"));
const ReportsPage = lazyWithRetry(() => import("@/pages/reports"));
const AdminSettingsPage = lazyWithRetry(() => import("@/pages/admin/settings"));
const AdminUsersPage = lazyWithRetry(() => import("@/pages/admin/users"));
const UserDetailPage = lazyWithRetry(() => import("@/pages/admin/user-detail"));
const AdminJobsPage = lazyWithRetry(() => import("@/pages/admin/jobs"));
const AdminPanelsPage = lazyWithRetry(() => import("@/pages/admin/panels"));
const AdminPanelTypesPage = lazyWithRetry(() => import("@/pages/admin/panel-types"));
const AdminZonesPage = lazyWithRetry(() => import("@/pages/admin/zones"));
const AdminCustomersPage = lazyWithRetry(() => import("@/pages/admin/customers"));
const CustomerDetailPage = lazyWithRetry(() => import("@/pages/admin/customer-detail"));
const AdminSuppliersPage = lazyWithRetry(() => import("@/pages/admin/suppliers"));
const SupplierDetailPage = lazyWithRetry(() => import("@/pages/admin/supplier-detail"));
const AdminEmployeesPage = lazyWithRetry(() => import("@/pages/admin/employees"));
const EmployeeDetailPage = lazyWithRetry(() => import("@/pages/admin/employee-detail"));
const AdminItemsPage = lazyWithRetry(() => import("@/pages/admin/items"));
const DownloadsPage = lazyWithRetry(() => import("@/pages/downloads"));
const ManualEntryPage = lazyWithRetry(() => import("@/pages/manual-entry"));
const ProductionReportPage = lazyWithRetry(() => import("@/pages/production-report"));
const ProductionReportDetailPage = lazyWithRetry(() => import("@/pages/production-report-detail"));
const KPIDashboardPage = lazyWithRetry(() => import("@/pages/kpi-dashboard"));
const LogisticsPage = lazyWithRetry(() => import("@/pages/logistics"));
const WeeklyWageReportsPage = lazyWithRetry(() => import("@/pages/weekly-wage-reports"));
const WeeklyJobLogsPage = lazyWithRetry(() => import("@/pages/weekly-job-logs"));
const ProductionSlotsPage = lazyWithRetry(() => import("@/pages/production-slots"));
const JobProgrammePage = lazyWithRetry(() => import("@/pages/job-programme"));
const DraftingProgramPage = lazyWithRetry(() => import("@/pages/drafting-program"));
const PurchaseOrdersPage = lazyWithRetry(() => import("@/pages/purchase-orders"));
const PurchaseOrderFormPage = lazyWithRetry(() => import("@/pages/purchase-order-form"));
const CapexRequestsPage = lazyWithRetry(() => import("@/pages/capex-requests"));
const ApInvoicesPage = lazyWithRetry(() => import("@/pages/ap-invoices"));
const ApInvoiceDetailPage = lazyWithRetry(() => import("@/pages/ap-invoice-detail"));
const ApApprovalRulesPage = lazyWithRetry(() => import("@/pages/ap-approval-rules"));
const HireBookingsPage = lazyWithRetry(() => import("@/pages/hire-bookings"));
const HireBookingFormPage = lazyWithRetry(() => import("@/pages/hire-booking-form"));
const TasksPage = lazyWithRetry(() => import("@/pages/tasks"));
const PanelDetailsPage = lazyWithRetry(() => import("@/pages/panel-details"));
const ChatPage = lazyWithRetry(() => import("@/pages/chat"));
const ProductionSchedulePage = lazyWithRetry(() => import("@/pages/production-schedule"));
const DocumentRegisterPage = lazyWithRetry(() => import("@/pages/document-register"));
const PublicBundlePage = lazyWithRetry(() => import("@/pages/public-bundle"));
const AdminDocumentConfigPage = lazyWithRetry(() => import("@/pages/admin/document-config"));
const AdminCompaniesPage = lazyWithRetry(() => import("@/pages/admin/companies"));
const SuperAdminPage = lazyWithRetry(() => import("@/pages/super-admin"));
const AdminChecklistTemplatesPage = lazyWithRetry(() => import("@/pages/admin/checklist-templates"));
const AdminEmailTemplatesPage = lazyWithRetry(() => import("@/pages/admin/email-templates"));
const MailRegisterPage = lazyWithRetry(() => import("@/pages/mail-register"));
const AssetRegisterPage = lazyWithRetry(() => import("@/pages/admin/asset-register"));
const AssetDetailPage = lazyWithRetry(() => import("@/pages/admin/asset-detail"));
const AssetRepairFormPage = lazyWithRetry(() => import("@/pages/admin/asset-repair-form"));
const TemplateEditorPage = lazyWithRetry(() => import("@/pages/admin/template-editor"));
const ChecklistsPage = lazyWithRetry(() => import("@/pages/checklists"));
const ChecklistFillPage = lazyWithRetry(() => import("@/pages/checklist-fill"));
const ChecklistReportsPage = lazyWithRetry(() => import("@/pages/checklist-reports"));
const ChecklistWorkOrdersPage = lazyWithRetry(() => import("@/pages/checklist-work-orders"));
const ProcurementReoSchedulingPage = lazyWithRetry(() => import("@/pages/procurement-reo-scheduling"));
const BroadcastPage = lazyWithRetry(() => import("@/pages/broadcast"));
const ContractHubPage = lazyWithRetry(() => import("@/pages/contract-hub"));
const ContractDetailPage = lazyWithRetry(() => import("@/pages/contract-detail"));
const ProgressClaimsPage = lazyWithRetry(() => import("@/pages/progress-claims"));
const ProgressClaimFormPage = lazyWithRetry(() => import("@/pages/progress-claim-form"));
const RetentionReportPage = lazyWithRetry(() => import("@/pages/retention-report"));
const AdminJobTypesPage = lazyWithRetry(() => import("@/pages/admin/job-types"));
const AdminCostCodesPage = lazyWithRetry(() => import("@/pages/admin/cost-codes"));
const TenderCenterPage = lazyWithRetry(() => import("@/pages/tender-center"));
const TenderDetailPage = lazyWithRetry(() => import("@/pages/tender-detail"));
const ScopeOfWorksPage = lazyWithRetry(() => import("@/pages/scope-of-works"));
const JobBudgetPage = lazyWithRetry(() => import("@/pages/job-budget"));
const JobTendersPage = lazyWithRetry(() => import("@/pages/job-tenders"));
const JobBoqPage = lazyWithRetry(() => import("@/pages/job-boq"));
const WorkflowBuilderPage = lazyWithRetry(() => import("@/pages/admin/workflow-builder"));
const JobActivitiesPage = lazyWithRetry(() => import("@/pages/job-activities"));
const MyobIntegrationPage = lazyWithRetry(() => import("@/pages/myob-integration"));
const TenderEmailsPage = lazyWithRetry(() => import("@/pages/tender-emails"));
const TenderEmailDetailPage = lazyWithRetry(() => import("@/pages/tender-email-detail"));
const DraftingEmailsPage = lazyWithRetry(() => import("@/pages/drafting-emails"));
const DraftingEmailDetailPage = lazyWithRetry(() => import("@/pages/drafting-email-detail"));
const ExternalApiPage = lazyWithRetry(() => import("@/pages/admin/external-api"));

const RegisterPage = lazyWithRetry(() => import("@/pages/register"));
const MobileLoginPage = lazyWithRetry(() => import("@/pages/mobile/login"));
const MobileDashboard = lazyWithRetry(() => import("@/pages/mobile/dashboard"));
const MobileTasksPage = lazyWithRetry(() => import("@/pages/mobile/tasks"));
const MobileChatPage = lazyWithRetry(() => import("@/pages/mobile/chat"));
const MobileJobsPage = lazyWithRetry(() => import("@/pages/mobile/jobs"));
const MobilePanelsPage = lazyWithRetry(() => import("@/pages/mobile/panels"));
const MobilePanelDetailPage = lazyWithRetry(() => import("@/pages/mobile/panel-detail"));
const MobileLogisticsPage = lazyWithRetry(() => import("@/pages/mobile/logistics"));
const MobileCreateLoadListPage = lazyWithRetry(() => import("@/pages/mobile/create-load-list"));
const MobileRecordDeliveryPage = lazyWithRetry(() => import("@/pages/mobile/record-delivery"));
const MobileReturnLoadPage = lazyWithRetry(() => import("@/pages/mobile/return-load"));
const MobilePurchaseOrdersPage = lazyWithRetry(() => import("@/pages/mobile/purchase-orders"));
const MobileCapexRequestsPage = lazyWithRetry(() => import("@/pages/mobile/capex-requests"));
const MobileApApprovalsPage = lazyWithRetry(() => import("@/pages/mobile/ap-approvals"));
const MobileMore = lazyWithRetry(() => import("@/pages/mobile/more"));
const MobileProfilePage = lazyWithRetry(() => import("@/pages/mobile/profile"));
const MobileWeeklyJobReportPage = lazyWithRetry(() => import("@/pages/mobile/weekly-job-report"));
const MobileDocumentsPage = lazyWithRetry(() => import("@/pages/mobile/documents"));
const MobileChecklistsPage = lazyWithRetry(() => import("@/pages/mobile/checklists"));
const MobileChecklistFillPage = lazyWithRetry(() => import("@/pages/mobile/checklist-fill"));
const MobileBroadcastPage = lazyWithRetry(() => import("@/pages/mobile/broadcast"));
const MobileQrScanner = lazyWithRetry(() => import("@/pages/mobile/qr-scanner"));
const MobileNewOpportunity = lazyWithRetry(() => import("@/pages/mobile/new-opportunity"));
const MobilePhotoGalleryPage = lazyWithRetry(() => import("@/pages/mobile/photo-gallery"));
const MobilePhotoCapturePage = lazyWithRetry(() => import("@/pages/mobile/photo-capture"));
const MobileJobDetailPage = lazyWithRetry(() => import("@/pages/mobile/job-detail"));
const MobilePmCallLogsPage = lazyWithRetry(() => import("@/pages/mobile/pm-call-logs"));
const MobilePmCallLogFormPage = lazyWithRetry(() => import("@/pages/mobile/pm-call-log-form"));
const MobilePmCallLogDetailPage = lazyWithRetry(() => import("@/pages/mobile/pm-call-log-detail"));
const MobileHireBookingsPage = lazyWithRetry(() => import("@/pages/mobile/hire-bookings"));
const MobileHireBookingFormPage = lazyWithRetry(() => import("@/pages/mobile/hire-booking-form"));
const MobileEmailProcessingPage = lazyWithRetry(() => import("@/pages/mobile/email-processing"));
const MobileDraftingEmailDetailPage = lazyWithRetry(() => import("@/pages/mobile/drafting-email-detail"));
const MobileTenderEmailDetailPage = lazyWithRetry(() => import("@/pages/mobile/tender-email-detail"));
const MobileApInvoiceDetailPage = lazyWithRetry(() => import("@/pages/mobile/ap-invoice-detail"));
const PhotoGalleryPage = lazyWithRetry(() => import("@/pages/photo-gallery"));
const SalesPipelinePage = lazyWithRetry(() => import("@/pages/sales-pipeline"));
const HelpCenterPage = lazyWithRetry(() => import("@/pages/help-center"));
const AdminHelpPage = lazyWithRetry(() => import("@/pages/admin/help"));
const PmCallLogsPage = lazyWithRetry(() => import("@/pages/pm-call-logs"));
const PmCallLogFormPage = lazyWithRetry(() => import("@/pages/pm-call-log-form"));
const PmCallLogDetailPage = lazyWithRetry(() => import("@/pages/pm-call-log-detail"));
const KnowledgeBasePage = lazyWithRetry(() => import("@/pages/knowledge-base"));

function ProtectedRoute({ children, requiredRole, requireSuperAdmin }: { children: React.ReactNode; requiredRole?: string[]; requireSuperAdmin?: boolean }) {
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

  if (requireSuperAdmin && !user.isSuperAdmin) {
    return <Redirect to="/dashboard" />;
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
    '/panels': '/mobile/panels',
    '/documents': '/mobile/documents',
    '/document-register': '/mobile/documents',
    '/checklists': '/mobile/checklists',
    '/broadcast': '/mobile/broadcast',
    '/photo-gallery': '/mobile/photo-gallery',
    '/hire-bookings': '/mobile/hire-bookings',
    '/pm-call-logs': '/mobile/pm-call-logs',
    '/capex-requests': '/mobile/capex-requests',
    '/ap-invoices': '/mobile/ap-approvals',
    '/jobs': '/mobile/jobs',
    '/sales-pipeline': '/mobile/more',
    '/profile': '/mobile/profile',
  };
  if (routeMap[desktopPath]) return routeMap[desktopPath];
  if (desktopPath.startsWith('/jobs/')) {
    const jobId = desktopPath.split('/')[2];
    if (jobId) return `/mobile/jobs/${jobId}`;
  }
  if (desktopPath.startsWith('/panels/')) {
    const panelId = desktopPath.split('/')[2];
    if (panelId) return `/mobile/panels/${panelId}`;
  }
  return '/mobile/dashboard';
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        data-testid="link-skip-navigation"
      >
        Skip to main content
      </a>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" role="banner">
            <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Toggle sidebar navigation" />
            <div className="flex items-center gap-2">
              <UserSettingsPopover />
            </div>
          </header>
          <main id="main-content" className="flex-1 overflow-auto p-6 bg-background" role="main" tabIndex={-1}>
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

      <Route path="/register/:token">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <RegisterPage />
        </Suspense>
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

      <Route path="/admin/jobs/:id/programme">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <JobProgrammePage />
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

      <Route path="/capex-requests">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <CapexRequestsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/ap-invoices/approval-rules">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ApApprovalRulesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/ap-invoices/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ApInvoiceDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/ap-invoices">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ApInvoicesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/tender-emails">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <TenderEmailsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/tender-emails/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <TenderEmailDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/drafting-emails">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DraftingEmailsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/drafting-emails/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DraftingEmailDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/hire-bookings">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <HireBookingsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/hire-bookings/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <HireBookingFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/tenders">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <TenderCenterPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/tenders/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <TenderDetailPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/scopes">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ScopeOfWorksPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/jobs/:id/budget">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <JobBudgetPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/jobs/:id/tenders">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <JobTendersPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/jobs/:id/boq">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <JobBoqPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/myob-integration">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <MyobIntegrationPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/pm-call-logs">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PmCallLogsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/pm-call-logs/new">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PmCallLogFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/pm-call-logs/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PmCallLogDetailPage />
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

      <Route path="/procurement/reo-scheduling">
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

      <Route path="/jobs/:jobId/activities">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <JobActivitiesPage />
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

      <Route path="/document-register">
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
        <Redirect to="/super-admin" />
      </Route>

      <Route path="/admin/users/:id">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <UserDetailPage />
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

      <Route path="/admin/external-api">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <ExternalApiPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/jobs">
        <ProtectedRoute>
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
        <Redirect to="/admin/users" />
      </Route>

      <Route path="/super-admin">
        <ProtectedRoute requireSuperAdmin>
          <AuthenticatedLayout>
            <SuperAdminPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/companies">
        <Redirect to="/super-admin" />
      </Route>

      <Route path="/admin/zones">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminZonesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>


      <Route path="/admin/customers/:id">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <CustomerDetailPage />
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

      <Route path="/admin/suppliers/:id">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <SupplierDetailPage />
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

      <Route path="/admin/asset-repair/new">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AssetRepairFormPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/job-types">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminJobTypesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/cost-codes">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminCostCodesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/job-types/:id/workflow">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <WorkflowBuilderPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/data-management">
        <Redirect to="/super-admin" />
      </Route>

      <Route path="/admin/item-categories">
        <Redirect to="/admin/items" />
      </Route>

      <Route path="/admin/checklist-templates">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminChecklistTemplatesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/email-templates">
        <ProtectedRoute requiredRole={["ADMIN"]}>
          <AuthenticatedLayout>
            <AdminEmailTemplatesPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mail-register">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <MailRegisterPage />
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

      <Route path="/work-orders">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ChecklistWorkOrdersPage />
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
        <Redirect to="/super-admin" />
      </Route>

      <Route path="/knowledge-base">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <KnowledgeBasePage />
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
      <Route path="/mobile/capex-requests/:id">
        <ProtectedRoute>
          <MobileCapexRequestsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/capex-requests">
        <ProtectedRoute>
          <MobileCapexRequestsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/ap-approvals">
        <ProtectedRoute>
          <MobileApApprovalsPage />
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
      <Route path="/mobile/pm-call-logs/new">
        <ProtectedRoute>
          <MobilePmCallLogFormPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/pm-call-logs/:id">
        <ProtectedRoute>
          <MobilePmCallLogDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/pm-call-logs">
        <ProtectedRoute>
          <MobilePmCallLogsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/hire-bookings/new">
        <ProtectedRoute>
          <MobileHireBookingFormPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/hire-bookings">
        <ProtectedRoute>
          <MobileHireBookingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/email-processing">
        <ProtectedRoute>
          <MobileEmailProcessingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/drafting-emails/:id">
        <ProtectedRoute>
          <MobileDraftingEmailDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/tender-emails/:id">
        <ProtectedRoute>
          <MobileTenderEmailDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/mobile/ap-invoices/:id">
        <ProtectedRoute>
          <MobileApInvoiceDetailPage />
        </ProtectedRoute>
      </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function RouteAnnouncer() {
  const [location] = useLocation();
  const [announcement, setAnnouncement] = useState("");
  const prevLocation = useRef(location);

  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;

    const timer = setTimeout(() => {
      const title = document.title;
      if (title) {
        setAnnouncement(`Navigated to ${title.split("|")[0].trim()}`);
      } else {
        const segments = location.split("/").filter(Boolean).filter(s => !/^[0-9a-f-]{8,}$/i.test(s));
        const pageName = segments.length === 0 ? "Dashboard" : segments.map(s => s.replace(/-/g, " ")).join(" - ");
        setAnnouncement(`Navigated to ${pageName}`);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="text-route-announcer"
    >
      {announcement}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <HelpProvider>
                <RouteAnnouncer />
                <Router />
                <HelpDrawer />
                <Toaster />
              </HelpProvider>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
