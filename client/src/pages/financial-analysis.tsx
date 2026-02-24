import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ProfitAndLossTab } from "@/pages/myob-integration";
import { MYOB_ROUTES } from "@shared/api-routes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Link2, Printer } from "lucide-react";
import { Link } from "wouter";

export default function FinancialAnalysisPage() {
  useDocumentTitle("Financial Analysis");

  const { data: status, isLoading } = useQuery<{ connected: boolean }>({
    queryKey: [MYOB_ROUTES.STATUS],
  });

  const handlePrint = () => {
    const cleanup = () => {
      document.documentElement.classList.remove("printing-financial-report");
      window.removeEventListener("afterprint", cleanup);
    };
    document.documentElement.classList.add("printing-financial-report");
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 w-full" data-testid="page-financial-analysis">
        <div>
          <h1 className="text-2xl font-bold">Financial Analysis</h1>
          <p className="text-muted-foreground">Profit & Loss reporting, trend analysis, and BuildPlus adjustments</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="p-6 space-y-6 w-full" data-testid="page-financial-analysis">
        <div>
          <h1 className="text-2xl font-bold">Financial Analysis</h1>
          <p className="text-muted-foreground">Profit & Loss reporting, trend analysis, and BuildPlus adjustments</p>
        </div>
        <Card className="border-amber-500/30">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">MYOB Connection Required</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Financial analysis data is sourced from your MYOB account. Please connect your MYOB Business account first to access Profit & Loss reports, trend analysis, and BuildPlus adjustments.
              </p>
            </div>
            <Link href="/myob-integration">
              <Button className="gap-2" data-testid="button-connect-myob">
                <Link2 className="h-4 w-4" />
                Go to MYOB Integration
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 w-full" data-testid="page-financial-analysis" id="financial-analysis-report">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Financial Analysis</h1>
          <p className="text-muted-foreground">Profit & Loss reporting, trend analysis, and BuildPlus adjustments</p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="gap-2 no-print" data-testid="button-print-report">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>
      <div className="print-header hidden">
        <div className="flex items-center justify-between border-b pb-3 mb-2">
          <div>
            <h1 className="text-xl font-bold">Financial Analysis Report</h1>
            <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>BuildPlus AI</p>
            <p>Confidential</p>
          </div>
        </div>
      </div>
      <ProfitAndLossTab />
    </div>
  );
}
