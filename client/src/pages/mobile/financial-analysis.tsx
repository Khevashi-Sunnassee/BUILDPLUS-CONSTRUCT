import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MYOB_ROUTES } from "@shared/api-routes";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  AlertTriangle,
  Link2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { useMobilePermissions } from "@/hooks/use-mobile-permissions";
import {
  MonthlyPnlResponse,
  extractMonthlyTotals,
  getFinancialYears,
} from "@/pages/myob-integration";

function computePeriodDates(periodValue: string): { startDate: string; endDate: string } {
  const now = new Date();
  const financialYears = getFinancialYears();
  const fy = financialYears.find((f) => f.value === periodValue);
  if (fy) return { startDate: fy.startDate, endDate: fy.endDate };

  if (periodValue === "last-month") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate();
    return {
      startDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`,
      endDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  const monthCount = parseInt(periodValue) || 12;
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const start = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  return { startDate, endDate };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
}

function KpiCard({
  label,
  value,
  accent,
  icon,
  subtitle,
  testId,
}: {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
  subtitle?: string;
  testId: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid={testId}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </div>
        <span className="text-xs text-white/60 font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold font-mono text-white mt-1">{value}</div>
      {subtitle && <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function MonthRow({
  label,
  income,
  expenses,
  netProfit,
  grossMargin,
  isExpanded,
  onToggle,
  index,
}: {
  label: string;
  income: number;
  expenses: number;
  netProfit: number;
  grossMargin: number;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 active:scale-[0.99]"
      data-testid={`month-row-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{label}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${netProfit >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {netProfit >= 0 ? "+" : ""}{formatCurrency(netProfit)}
          </Badge>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
      </div>
      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Income</span>
            <span className="font-mono text-green-400">{formatCurrencyFull(income)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Total Expenses</span>
            <span className="font-mono text-red-400">{formatCurrencyFull(expenses)}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-white/5 pt-2">
            <span className="text-white/80 font-medium">Net Profit</span>
            <span className={`font-mono font-semibold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrencyFull(netProfit)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Gross Margin</span>
            <span className="font-mono text-white/80">{grossMargin.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </button>
  );
}

export default function MobileFinancialAnalysis() {
  const { isHidden } = useMobilePermissions();
  const [periodPreset, setPeriodPreset] = useState("6");
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showAdjustments, setShowAdjustments] = useState(false);

  const financialYears = getFinancialYears();
  const dates = useMemo(() => computePeriodDates(periodPreset), [periodPreset]);

  const isRestricted = isHidden("financial-analysis");

  const { data: status, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: [MYOB_ROUTES.STATUS],
    enabled: !isRestricted,
  });

  const monthlyUrl = `${MYOB_ROUTES.MONTHLY_PNL}?months=24&startDate=${dates.startDate}&endDate=${dates.endDate}&reportingBasis=Accrual&yearEndAdjust=false`;
  const { data: monthlyData, isLoading, isFetching, refetch } = useQuery<MonthlyPnlResponse>({
    queryKey: [MYOB_ROUTES.MONTHLY_PNL, dates.startDate, dates.endDate, "Accrual", false],
    queryFn: async () => {
      const res = await apiRequest("GET", monthlyUrl);
      return res.json();
    },
    enabled: !!status?.connected && !isRestricted,
  });

  const adjustmentsUrl = `${MYOB_ROUTES.BUILDPLUS_ADJUSTMENTS}?months=24&startDate=${dates.startDate}&endDate=${dates.endDate}`;
  const { data: adjustmentsData } = useQuery<{
    period: { start: string; end: string };
    unprocessedInvoices: {
      summary: { count: number; totalEx: string; totalInc: string };
      byMonth: { month: string; count: number; totalEx: string; totalInc: string }[];
    };
    retention: {
      summary: { totalRetention: string; totalRetentionHeld: string; claimCount: number };
      byMonth: { month: string; totalRetention: string; totalRetentionHeld: string; claimCount: number }[];
    };
    assetPurchases: {
      summary: { count: number; totalPurchasePrice: string };
      byMonth: { month: string; count: number; totalPurchasePrice: string }[];
    };
  }>({
    queryKey: [MYOB_ROUTES.BUILDPLUS_ADJUSTMENTS, dates.startDate, dates.endDate],
    queryFn: async () => {
      const res = await apiRequest("GET", adjustmentsUrl);
      return res.json();
    },
    enabled: !!status?.connected && !isRestricted,
  });

  const months = monthlyData?.months || [];
  const monthlyTotals = months.map((m) => ({ ...extractMonthlyTotals(m), label: m.label }));

  const totalsAgg = monthlyTotals.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      cos: acc.cos + m.cos,
      grossProfit: acc.grossProfit + m.grossProfit,
      expenses: acc.expenses + m.expenses,
      netProfit: acc.netProfit + m.netProfit,
    }),
    { income: 0, cos: 0, grossProfit: 0, expenses: 0, netProfit: 0 }
  );

  const grossMarginPct = totalsAgg.income > 0 ? (totalsAgg.grossProfit / totalsAgg.income) * 100 : 0;
  const netMarginPct = totalsAgg.income > 0 ? (totalsAgg.netProfit / totalsAgg.income) * 100 : 0;

  const totalUnprocessedEx = adjustmentsData ? parseFloat(adjustmentsData.unprocessedInvoices.summary.totalEx) : 0;
  const totalRetentionHeld = adjustmentsData ? parseFloat(adjustmentsData.retention.summary.totalRetentionHeld) : 0;
  const totalAssetPurchases = adjustmentsData ? parseFloat(adjustmentsData.assetPurchases.summary.totalPurchasePrice) : 0;
  const adjustedNetProfit = totalsAgg.netProfit + totalRetentionHeld - totalUnprocessedEx + totalAssetPurchases;

  const momChange = useMemo(() => {
    if (monthlyTotals.length < 2) return null;
    const current = monthlyTotals[monthlyTotals.length - 1].netProfit;
    const prev = monthlyTotals[monthlyTotals.length - 2].netProfit;
    if (prev === 0) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
  }, [monthlyTotals]);

  if (isRestricted) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Financial Analysis Access Denied">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-4 flex items-center gap-3">
            <Link href="/mobile/more">
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="text-lg font-bold">Financial Analysis</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Access Restricted</h2>
          <p className="text-sm text-white/60 text-center">You don't have permission to view financial analysis data. Contact your administrator for access.</p>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Financial Analysis Loading">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-4 flex items-center gap-3">
            <Link href="/mobile/more">
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="text-lg font-bold">Financial Analysis</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl bg-white/5" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
          </div>
          <Skeleton className="h-40 w-full rounded-2xl bg-white/5" />
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Financial Analysis Not Connected">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-4 flex items-center gap-3">
            <Link href="/mobile/more">
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="text-lg font-bold">Financial Analysis</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">MYOB Not Connected</h2>
          <p className="text-sm text-white/60 text-center">Financial data is sourced from MYOB. Connect your MYOB account from a desktop browser to access P&L analysis.</p>
          <Link href="/myob-integration">
            <button className="flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97]" data-testid="button-connect-myob">
              <Link2 className="h-4 w-4" />
              Go to MYOB Integration
            </button>
          </Link>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Financial Analysis">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4 flex items-center gap-3">
          <Link href="/mobile/more">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1">
            <div className="text-lg font-bold">Financial Analysis</div>
            <div className="text-xs text-white/50">Profit & Loss · Accrual Basis</div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:scale-[0.95]"
            data-testid="button-refresh"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-4">
        <div className="flex items-center gap-3">
          <Select value={periodPreset} onValueChange={setPeriodPreset}>
            <SelectTrigger className="flex-1 h-10 bg-white/5 border-white/10 text-white" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="18">Last 18 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
              {financialYears.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Financial Years</div>
                  {financialYears.map((fy) => (
                    <SelectItem key={fy.value} value={fy.value}>{fy.label}</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <div className="text-xs text-white/40 shrink-0">{dates.startDate} → {dates.endDate}</div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-2xl bg-white/5" />
              <Skeleton className="h-24 rounded-2xl bg-white/5" />
              <Skeleton className="h-24 rounded-2xl bg-white/5" />
              <Skeleton className="h-24 rounded-2xl bg-white/5" />
            </div>
            <Skeleton className="h-40 w-full rounded-2xl bg-white/5" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Income"
                value={formatCurrency(totalsAgg.income)}
                accent="bg-green-500/20"
                icon={<DollarSign className="h-4 w-4 text-green-400" />}
                testId="kpi-income"
              />
              <KpiCard
                label="Net Profit"
                value={formatCurrency(totalsAgg.netProfit)}
                accent={totalsAgg.netProfit >= 0 ? "bg-green-500/20" : "bg-red-500/20"}
                icon={totalsAgg.netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                subtitle={`${netMarginPct.toFixed(1)}% margin`}
                testId="kpi-net-profit"
              />
              <KpiCard
                label="Gross Profit"
                value={formatCurrency(totalsAgg.grossProfit)}
                accent="bg-blue-500/20"
                icon={<BarChart3 className="h-4 w-4 text-blue-400" />}
                subtitle={`${grossMarginPct.toFixed(1)}% margin`}
                testId="kpi-gross-profit"
              />
              <KpiCard
                label="MoM Change"
                value={momChange !== null ? `${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}%` : "—"}
                accent={momChange !== null && momChange >= 0 ? "bg-green-500/20" : "bg-red-500/20"}
                icon={momChange !== null && momChange >= 0 ? <ArrowUpRight className="h-4 w-4 text-green-400" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                subtitle="Net profit trend"
                testId="kpi-mom-change"
              />
            </div>

            {(totalUnprocessedEx > 0 || totalRetentionHeld > 0 || totalAssetPurchases > 0) && (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4" data-testid="card-adjusted-net">
                <button
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className="w-full flex items-center justify-between"
                  data-testid="button-toggle-adjustments"
                >
                  <div>
                    <div className="text-xs text-white/60 font-medium">Adjusted Net Profit</div>
                    <div className={`text-xl font-bold font-mono mt-0.5 ${adjustedNetProfit >= 0 ? "text-purple-400" : "text-red-400"}`}>
                      {formatCurrency(adjustedNetProfit)}
                    </div>
                  </div>
                  {showAdjustments ? <ChevronUp className="h-5 w-5 text-white/40" /> : <ChevronDown className="h-5 w-5 text-white/40" />}
                </button>
                {showAdjustments && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">MYOB Net Profit</span>
                      <span className={`font-mono ${totalsAgg.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrencyFull(totalsAgg.netProfit)}</span>
                    </div>
                    {totalRetentionHeld > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-400">+ Retention Held</span>
                        <span className="font-mono text-blue-400">+{formatCurrencyFull(totalRetentionHeld)}</span>
                      </div>
                    )}
                    {totalUnprocessedEx > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-400">− Unprocessed Invoices</span>
                        <span className="font-mono text-amber-400">−{formatCurrencyFull(totalUnprocessedEx)}</span>
                      </div>
                    )}
                    {totalAssetPurchases > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-teal-400">+ Asset Purchases</span>
                        <span className="font-mono text-teal-400">+{formatCurrencyFull(totalAssetPurchases)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs border-t border-white/10 pt-2">
                      <span className="text-purple-400 font-medium">= Adjusted Net Profit</span>
                      <span className={`font-mono font-semibold ${adjustedNetProfit >= 0 ? "text-purple-400" : "text-red-400"}`}>{formatCurrencyFull(adjustedNetProfit)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="card-trend-bars">
              <div className="text-xs text-white/60 font-medium mb-3">Monthly Trend</div>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {monthlyTotals.map((m, idx) => {
                  const maxVal = Math.max(...monthlyTotals.map((t) => Math.max(Math.abs(t.netProfit), t.income)), 1);
                  const incomeH = (m.income / maxVal) * 100;
                  const netH = (Math.abs(m.netProfit) / maxVal) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end" data-testid={`bar-${idx}`}>
                      <div className="w-full flex flex-col items-center gap-0.5 flex-1 justify-end">
                        <div
                          className="w-full bg-green-500/40 rounded-t"
                          style={{ height: `${Math.max(incomeH, 2)}%`, minHeight: 2 }}
                        />
                        <div
                          className={`w-full rounded-t ${m.netProfit >= 0 ? "bg-blue-500/60" : "bg-red-500/60"}`}
                          style={{ height: `${Math.max(netH, 2)}%`, minHeight: 2 }}
                        />
                      </div>
                      <span className="text-[8px] text-white/40 mt-1 truncate w-full text-center">
                        {m.label.replace(/\s\d{4}$/, "").slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-green-500/40" />
                  <span className="text-[10px] text-white/50">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/60" />
                  <span className="text-[10px] text-white/50">Net Profit</span>
                </div>
              </div>
            </div>

            <div className="space-y-2" data-testid="section-monthly-breakdown">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-white">Monthly Breakdown</span>
                <span className="text-xs text-white/40">{monthlyTotals.length} months</span>
              </div>
              {[...monthlyTotals].reverse().map((m, idx) => {
                const realIdx = monthlyTotals.length - 1 - idx;
                return (
                  <MonthRow
                    key={realIdx}
                    label={m.label}
                    income={m.income}
                    expenses={m.cos + m.expenses}
                    netProfit={m.netProfit}
                    grossMargin={m.income > 0 ? (m.grossProfit / m.income) * 100 : 0}
                    isExpanded={expandedMonth === realIdx}
                    onToggle={() => setExpandedMonth(expandedMonth === realIdx ? null : realIdx)}
                    index={realIdx}
                  />
                );
              })}
            </div>

            {adjustmentsData && (totalUnprocessedEx > 0 || totalRetentionHeld > 0 || totalAssetPurchases > 0) && (
              <div className="space-y-2" data-testid="section-adjustments-summary">
                <div className="px-1">
                  <span className="text-sm font-semibold text-white">BuildPlus Adjustments</span>
                </div>
                {totalUnprocessedEx > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                          <div className="text-xs text-white/60">Unprocessed Invoices</div>
                          <div className="text-sm font-bold font-mono text-amber-400">{formatCurrency(totalUnprocessedEx)}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                        {adjustmentsData.unprocessedInvoices.summary.count} items
                      </Badge>
                    </div>
                  </div>
                )}
                {totalRetentionHeld > 0 && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                          <DollarSign className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <div className="text-xs text-white/60">Retention Held</div>
                          <div className="text-sm font-bold font-mono text-blue-400">{formatCurrency(totalRetentionHeld)}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {adjustmentsData.retention.summary.claimCount} claims
                      </Badge>
                    </div>
                  </div>
                )}
                {totalAssetPurchases > 0 && (
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20">
                          <BarChart3 className="h-4 w-4 text-teal-400" />
                        </div>
                        <div>
                          <div className="text-xs text-white/60">Asset Purchases</div>
                          <div className="text-sm font-bold font-mono text-teal-400">{formatCurrency(totalAssetPurchases)}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-400 border-teal-500/30">
                        {adjustmentsData.assetPurchases.summary.count} items
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
