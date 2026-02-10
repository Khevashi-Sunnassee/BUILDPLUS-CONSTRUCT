import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfWeek, endOfWeek, parseISO, addWeeks, subWeeks } from "date-fns";
import { WEEKLY_REPORTS_ROUTES, SETTINGS_ROUTES, USER_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import {
  DollarSign,
  Plus,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Edit2,
  Trash2,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PageHelpButton } from "@/components/help/page-help-button";

function CurrencyInput({ 
  value, 
  onChange, 
  ...props 
}: { 
  value: string; 
  onChange: (value: string) => void;
  [key: string]: any;
}) {
  const [displayValue, setDisplayValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => {
    if (!isFocused) {
      const num = parseFloat(value || "0");
      setDisplayValue(isNaN(num) ? "0" : num.toLocaleString("en-AU"));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    const num = parseFloat(value || "0");
    setDisplayValue(num === 0 ? "" : num.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    const num = parseFloat(value || "0");
    setDisplayValue(isNaN(num) ? "0" : num.toLocaleString("en-AU"));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, "");
    setDisplayValue(rawValue);
    onChange(rawValue || "0");
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="pl-7"
      />
    </div>
  );
}

interface WeeklyWageReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  factory: string;
  productionWages: string;
  officeWages: string;
  estimatingWages: string;
  onsiteWages: string;
  draftingWages: string;
  civilWages: string;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WageAnalysis {
  report: WeeklyWageReport;
  analysis: {
    weekStartDate: string;
    weekEndDate: string;
    factory: string;
    productionEntryCount: number;
    totalRevenue: number;
    actualWages: {
      production: number;
      office: number;
      estimating: number;
      onsite: number;
      drafting: number;
      civil: number;
      total: number;
    };
    estimatedWages: {
      production: number;
      drafting: number;
    };
    variance: {
      production: number;
      productionPercentage: number;
      drafting: number;
      draftingPercentage: number;
    };
  };
}

const wageReportSchema = z.object({
  weekStartDate: z.string().min(1, "Week start date is required"),
  weekEndDate: z.string().min(1, "Week end date is required"),
  factory: z.string().min(1, "Factory is required"),
  productionWages: z.string().default("0"),
  officeWages: z.string().default("0"),
  estimatingWages: z.string().default("0"),
  onsiteWages: z.string().default("0"),
  draftingWages: z.string().default("0"),
  civilWages: z.string().default("0"),
  notes: z.string().optional(),
});

type WageReportFormData = z.infer<typeof wageReportSchema>;

function formatDateDDMMYYYY(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `$${num.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WeeklyWageReportsPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyWageReport | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  const { data: factoriesList } = useQuery<{ id: string; name: string; code: string; state: string }[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings && factoriesList) {
      if (userSettings.defaultFactoryId) {
        const defaultFactory = factoriesList.find(f => f.id === userSettings.defaultFactoryId);
        if (defaultFactory) {
          setFactoryFilter(defaultFactory.state || defaultFactory.code);
        }
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoriesList, factoryFilterInitialized]);
  
  const today = new Date();
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => 
    startOfWeek(today, { weekStartsOn: 1 })
  );

  const { data: reports, isLoading } = useQuery<WeeklyWageReport[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.WAGE_REPORTS],
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "BuildPlusAI";

  const { data: analysisData, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<WageAnalysis>({
    queryKey: [WEEKLY_REPORTS_ROUTES.WAGE_REPORTS, selectedReport?.id, "analysis"],
    queryFn: async () => {
      const res = await fetch(WEEKLY_REPORTS_ROUTES.WAGE_REPORT_ANALYSIS(selectedReport?.id!), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return res.json();
    },
    enabled: analysisDialogOpen && !!selectedReport?.id,
  });

  const createForm = useForm<WageReportFormData>({
    resolver: zodResolver(wageReportSchema),
    defaultValues: {
      weekStartDate: format(selectedWeekStart, "yyyy-MM-dd"),
      weekEndDate: format(endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      factory: "QLD",
      productionWages: "0",
      officeWages: "0",
      estimatingWages: "0",
      onsiteWages: "0",
      draftingWages: "0",
      civilWages: "0",
      notes: "",
    },
  });

  const editForm = useForm<WageReportFormData>({
    resolver: zodResolver(wageReportSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: WageReportFormData) => {
      const res = await apiRequest("POST", WEEKLY_REPORTS_ROUTES.WAGE_REPORTS, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.WAGE_REPORTS] });
      setCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Weekly wage report created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WageReportFormData & { id: string }) => {
      const { id, ...rest } = data;
      const res = await apiRequest("PUT", WEEKLY_REPORTS_ROUTES.WAGE_REPORT_BY_ID(id), rest);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.WAGE_REPORTS] });
      setEditDialogOpen(false);
      setSelectedReport(null);
      toast({ title: "Weekly wage report updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", WEEKLY_REPORTS_ROUTES.WAGE_REPORT_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.WAGE_REPORTS] });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast({ title: "Weekly wage report deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (report: WeeklyWageReport) => {
    setSelectedReport(report);
    editForm.reset({
      weekStartDate: report.weekStartDate,
      weekEndDate: report.weekEndDate,
      factory: report.factory,
      productionWages: report.productionWages,
      officeWages: report.officeWages,
      estimatingWages: report.estimatingWages,
      onsiteWages: report.onsiteWages,
      draftingWages: report.draftingWages,
      civilWages: report.civilWages,
      notes: report.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleViewAnalysis = (report: WeeklyWageReport) => {
    setSelectedReport(report);
    setAnalysisDialogOpen(true);
  };

  const calculateTotalWages = (report: WeeklyWageReport): number => {
    return (
      parseFloat(report.productionWages || "0") +
      parseFloat(report.officeWages || "0") +
      parseFloat(report.estimatingWages || "0") +
      parseFloat(report.onsiteWages || "0") +
      parseFloat(report.draftingWages || "0") +
      parseFloat(report.civilWages || "0")
    );
  };

  const filteredReports = reports?.filter((r) => 
    factoryFilter === "all" || r.factory === factoryFilter
  ) || [];

  const goToPreviousWeek = () => {
    setSelectedWeekStart(subWeeks(selectedWeekStart, 1));
  };

  const goToNextWeek = () => {
    setSelectedWeekStart(addWeeks(selectedWeekStart, 1));
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const headerHeight = 35;
      const margin = 10;
      const footerHeight = 12;
      const usableHeight = pdfHeight - headerHeight - footerHeight - margin;
      const usableWidth = pdfWidth - (margin * 2);
      
      // Clean header with logo - proper aspect ratio
      const logoHeight = 12;
      const logoWidth = 24; // 2:1 aspect ratio for typical logo
      try {
        if (reportLogo) pdf.addImage(reportLogo, "PNG", margin, 6, logoWidth, logoHeight);
      } catch (e) {}
      
      // Report title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Weekly Wage Reports", margin + logoWidth + 6, 12);
      
      // Subtitle info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Week of ${format(selectedWeekStart, "dd/MM/yyyy")}`, margin + logoWidth + 6, 19);
      
      // Generated date on the right
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth - margin, 19, { align: "right" });
      
      // Draw a simple line under header
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, 24, pdfWidth - margin, 24);
      
      // Reset text color for content
      pdf.setTextColor(0, 0, 0);
      
      // Calculate scaled dimensions for content
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const imgRatio = imgWidth / imgHeight;
      let scaledWidth = usableWidth;
      let scaledHeight = scaledWidth / imgRatio;
      
      if (scaledHeight > usableHeight) {
        scaledHeight = usableHeight;
        scaledWidth = scaledHeight * imgRatio;
      }
      
      // Center the content
      const imgX = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(imgData, "PNG", imgX, headerHeight, scaledWidth, scaledHeight);
      
      pdf.save(`weekly-wage-reports-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      
      toast({ title: "PDF exported successfully" });
    } catch (error) {
      console.error("Export failed:", error);
      toast({ title: "Export failed", variant: "destructive" });
    }
    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Weekly Wage Reports
          </h1>
            <PageHelpButton pageHelpKey="page.weekly-wages" />
          </div>
          <p className="text-muted-foreground">
            Track weekly payroll costs by category and compare against production-based estimates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting}
            data-testid="button-export-pdf"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-report">
            <Plus className="h-4 w-4 mr-2" />
            Add Report
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Factory:</span>
          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-factory-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Factories</SelectItem>
              <SelectItem value="QLD">QLD</SelectItem>
              <SelectItem value="VIC">Victoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={reportRef} className="bg-white dark:bg-card rounded-lg">
        <div className="p-4 border-b flex items-center gap-4">
          <img src={reportLogo || ""} alt="Company Logo" className="h-10 w-auto" />
          <div>
            <h2 className="text-lg font-semibold">Weekly Wage Report Summary</h2>
            <p className="text-sm text-muted-foreground">
              Generated on {format(new Date(), "dd/MM/yyyy")}
            </p>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Wage Reports Found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first weekly wage report to start tracking payroll costs.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-report">
              <Plus className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </div>
        ) : (
          <Table data-testid="table-wage-reports">
            <TableHeader>
              <TableRow>
                <TableHead data-testid="header-week">Week</TableHead>
                <TableHead data-testid="header-factory">Factory</TableHead>
                <TableHead className="text-right" data-testid="header-production">Production</TableHead>
                <TableHead className="text-right" data-testid="header-office">Office</TableHead>
                <TableHead className="text-right" data-testid="header-estimating">Estimating</TableHead>
                <TableHead className="text-right" data-testid="header-onsite">Onsite</TableHead>
                <TableHead className="text-right" data-testid="header-drafting">Drafting</TableHead>
                <TableHead className="text-right" data-testid="header-civil">Civil</TableHead>
                <TableHead className="text-right" data-testid="header-total">Total</TableHead>
                <TableHead className="text-right" data-testid="header-actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                  <TableCell data-testid={`cell-week-${report.id}`}>
                    <div className="flex flex-col">
                      <span className="font-medium" data-testid={`text-week-${report.id}`}>
                        {formatDateDDMMYYYY(report.weekStartDate)} - {formatDateDDMMYYYY(report.weekEndDate)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`cell-factory-${report.id}`}>
                    <Badge variant="outline" data-testid={`badge-factory-${report.id}`}>{report.factory}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" data-testid={`cell-production-${report.id}`}>
                    {formatCurrency(report.productionWages)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" data-testid={`cell-office-${report.id}`}>
                    {formatCurrency(report.officeWages)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" data-testid={`cell-estimating-${report.id}`}>
                    {formatCurrency(report.estimatingWages)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" data-testid={`cell-onsite-${report.id}`}>
                    {formatCurrency(report.onsiteWages)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" data-testid={`cell-drafting-${report.id}`}>
                    {formatCurrency(report.draftingWages)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" data-testid={`cell-civil-${report.id}`}>
                    {formatCurrency(report.civilWages)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium" data-testid={`cell-total-${report.id}`}>
                    {formatCurrency(calculateTotalWages(report))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewAnalysis(report)}
                        title="View Analysis"
                        data-testid={`button-analysis-${report.id}`}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(report)}
                        title="Edit"
                        data-testid={`button-edit-${report.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingId(report.id);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete"
                        data-testid={`button-delete-${report.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Weekly Wage Report</DialogTitle>
            <DialogDescription>
              Enter weekly payroll costs by category
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="weekStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-week-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="weekEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-week-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="factory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factory</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-factory">
                          <SelectValue placeholder="Select factory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="VIC">Victoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />
              <h3 className="font-medium">Wage Categories</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="productionWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-production-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="officeWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Office Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-office-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="estimatingWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimating Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-estimating-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="onsiteWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Onsite Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-onsite-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="draftingWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drafting Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-drafting-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="civilWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Civil Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-civil-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Optional notes..." data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Report
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Weekly Wage Report</DialogTitle>
            <DialogDescription>
              Update weekly payroll costs
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate({ ...data, id: selectedReport!.id }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="weekStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="edit-input-week-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="weekEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="edit-input-week-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="factory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factory</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="edit-select-factory">
                          <SelectValue placeholder="Select factory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="VIC">Victoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />
              <h3 className="font-medium">Wage Categories</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="productionWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="edit-input-production-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="officeWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Office Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="edit-input-office-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="estimatingWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimating Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="edit-input-estimating-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="onsiteWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Onsite Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="edit-input-onsite-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="draftingWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drafting Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="edit-input-drafting-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="civilWages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Civil Wages</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={field.onChange} data-testid="edit-input-civil-wages" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Optional notes..." data-testid="edit-input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wage Analysis</DialogTitle>
            <DialogDescription>
              Compare actual wages vs estimated wages based on production data
            </DialogDescription>
          </DialogHeader>

          {analysisLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-48" />
            </div>
          ) : analysisData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">
                      {formatDateDDMMYYYY(analysisData.analysis.weekStartDate)} - {formatDateDDMMYYYY(analysisData.analysis.weekEndDate)}
                    </div>
                    <Badge variant="outline" className="mt-1">{analysisData.analysis.factory}</Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Production Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analysisData.analysis.productionEntryCount}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(analysisData.analysis.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Actual vs Estimated Wages</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Estimated</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Production</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(analysisData.analysis.actualWages.production)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(analysisData.analysis.estimatedWages.production)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={analysisData.analysis.variance.production > 0 ? "text-red-600" : "text-green-600"}>
                          {analysisData.analysis.variance.production > 0 && "+"}
                          {formatCurrency(analysisData.analysis.variance.production)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={analysisData.analysis.variance.productionPercentage > 0 ? "text-red-600" : "text-green-600"}>
                          {analysisData.analysis.variance.productionPercentage > 0 ? (
                            <TrendingUp className="inline h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="inline h-4 w-4 mr-1" />
                          )}
                          {analysisData.analysis.variance.productionPercentage}%
                        </span>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Drafting</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(analysisData.analysis.actualWages.drafting)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(analysisData.analysis.estimatedWages.drafting)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={analysisData.analysis.variance.drafting > 0 ? "text-red-600" : "text-green-600"}>
                          {analysisData.analysis.variance.drafting > 0 && "+"}
                          {formatCurrency(analysisData.analysis.variance.drafting)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={analysisData.analysis.variance.draftingPercentage > 0 ? "text-red-600" : "text-green-600"}>
                          {analysisData.analysis.variance.draftingPercentage > 0 ? (
                            <TrendingUp className="inline h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="inline h-4 w-4 mr-1" />
                          )}
                          {analysisData.analysis.variance.draftingPercentage}%
                        </span>
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total Actual Wages</TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(analysisData.analysis.actualWages.total)}
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Wage Breakdown by Category</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Production</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {formatCurrency(analysisData.analysis.actualWages.production)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Office</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {formatCurrency(analysisData.analysis.actualWages.office)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Estimating</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {formatCurrency(analysisData.analysis.actualWages.estimating)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Onsite</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {formatCurrency(analysisData.analysis.actualWages.onsite)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Drafting</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {formatCurrency(analysisData.analysis.actualWages.drafting)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Civil</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {formatCurrency(analysisData.analysis.actualWages.civil)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No analysis data available</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wage Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this weekly wage report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
