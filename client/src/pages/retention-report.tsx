import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHelpButton } from "@/components/help/page-help-button";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Shield, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { PROGRESS_CLAIMS_ROUTES } from "@shared/api-routes";

interface RetentionClaim {
  id: string;
  claimNumber: string;
  status: string;
  claimDate: string;
  subtotal: string;
  total: string;
  retentionRate: string | null;
  retentionAmount: string | null;
  retentionHeldToDate: string | null;
  netClaimAmount: string | null;
  cumulativeRetention: string;
}

interface RetentionJobGroup {
  jobId: string;
  jobNumber: string | null;
  jobName: string | null;
  contractValue: string;
  retentionRate: number;
  retentionCapPct: number;
  retentionCapAmount: string;
  totalRetentionHeld: string;
  remainingRetention: string;
  claims: RetentionClaim[];
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  APPROVED: "outline",
  REJECTED: "destructive",
};

export default function RetentionReportPage() {
  const { data: jobGroups = [], isLoading } = useQuery<RetentionJobGroup[]>({
    queryKey: [PROGRESS_CLAIMS_ROUTES.RETENTION_REPORT],
  });

  const totals = {
    contractValue: jobGroups.reduce((s, g) => s + parseFloat(g.contractValue || "0"), 0),
    totalRetained: jobGroups.reduce((s, g) => s + parseFloat(g.totalRetentionHeld || "0"), 0),
    totalCapAmount: jobGroups.reduce((s, g) => s + parseFloat(g.retentionCapAmount || "0"), 0),
    totalRemaining: jobGroups.reduce((s, g) => s + parseFloat(g.remainingRetention || "0"), 0),
  };

  return (
    <div className="space-y-6 p-6" data-testid="page-retention-report">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/progress-claims">
          <Button variant="ghost" size="icon" data-testid="button-back-claims">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="heading-retention-report">Retention Report</h1>
            <PageHelpButton pageHelpKey="page.retention-report" />
          </div>
          <p className="text-muted-foreground text-sm">Cumulative retention tracking across all jobs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-contract">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Total Contract Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.contractValue)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-retained">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <Shield className="h-4 w-4" />
              <span>Total Retained</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalRetained)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-cap">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Total Retention Cap</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.totalCapAmount)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-remaining-capacity">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Remaining Capacity</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : jobGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No retention data available. Create progress claims to start tracking retention.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {jobGroups.map((group) => {
            const heldPct = parseFloat(group.retentionCapAmount) > 0
              ? (parseFloat(group.totalRetentionHeld) / parseFloat(group.retentionCapAmount) * 100)
              : 0;
            const atCap = heldPct >= 100;

            return (
              <Card key={group.jobId} data-testid={`card-retention-job-${group.jobId}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">
                      <span className="font-mono">{group.jobNumber}</span>
                      <span className="ml-2 text-muted-foreground font-normal">{group.jobName}</span>
                    </CardTitle>
                    {atCap && (
                      <Badge variant="destructive" data-testid={`badge-at-cap-${group.jobId}`}>
                        Cap Reached
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span>Contract: {formatCurrency(group.contractValue)}</span>
                    <span>Rate: {group.retentionRate}%</span>
                    <span>Cap: {group.retentionCapPct}% ({formatCurrency(group.retentionCapAmount)})</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        Retained: {formatCurrency(group.totalRetentionHeld)}
                      </span>
                      <span className="text-muted-foreground">
                        {heldPct.toFixed(1)}% of cap
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${atCap ? "bg-red-500" : "bg-orange-500"}`}
                        style={{ width: `${Math.min(heldPct, 100)}%` }}
                        data-testid={`progress-retention-${group.jobId}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Claim #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Claim Subtotal</TableHead>
                        <TableHead className="text-right">Retention</TableHead>
                        <TableHead className="text-right">Cumulative Retention</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.claims.map((claim) => (
                        <TableRow key={claim.id} data-testid={`row-retention-claim-${claim.id}`}>
                          <TableCell>
                            <Link href={`/progress-claims/${claim.id}`}>
                              <span className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                {claim.claimNumber}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant[claim.status] || "secondary"}>
                              {claim.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(claim.subtotal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600 dark:text-orange-400">
                            {parseFloat(claim.retentionAmount || "0") > 0
                              ? `-${formatCurrency(claim.retentionAmount)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(claim.cumulativeRetention)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {claim.claimDate ? format(new Date(claim.claimDate), "dd/MM/yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Remaining Retention Capacity</span>
                    <span className="font-mono">{formatCurrency(group.remainingRetention)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
