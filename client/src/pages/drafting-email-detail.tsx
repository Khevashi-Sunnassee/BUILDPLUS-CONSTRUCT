import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DRAFTING_INBOX_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, FileText, CheckCircle2, Clock, Pencil,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Loader2, LinkIcon, RefreshCw, Mail, Eye, Trash2, Archive,
  Code, Type, ExternalLink, Download, Sparkles
} from "lucide-react";

interface DraftingEmailDetail {
  id: string;
  companyId: string;
  resendEmailId: string;
  fromAddress: string;
  toAddress: string | null;
  subject: string | null;
  status: string;
  jobId: string | null;
  requestType: string | null;
  impactArea: string | null;
  attachmentCount: number | null;
  processingError: string | null;
  processedAt: string | null;
  matchedAt: string | null;
  createdAt: string;
  job?: { id: string; name: string; jobNumber?: string } | null;
  documents?: Array<{ id: string; fileName: string; mimeType: string; storageKey: string; fileSize?: number }>;
  extractedFields?: Array<{ id: string; fieldKey: string; fieldValue: string | null; confidence: number | null }>;
}

interface PageThumbnail {
  pageNumber: number;
  thumbnail: string;
  width: number;
  height: number;
}

interface EmailBody {
  html: string | null;
  text: string | null;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  received: { variant: "outline" },
  processing: { variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600" },
  processed: { variant: "default", className: "bg-indigo-500 text-white dark:bg-indigo-600" },
  matched: { variant: "default", className: "bg-green-600 text-white dark:bg-green-700" },
  archived: { variant: "secondary" },
  failed: { variant: "destructive" },
};

const REQUEST_TYPE_BADGE_CONFIG: Record<string, { className: string }> = {
  change_request: { className: "bg-red-500 text-white dark:bg-red-600" },
  drawing_update: { className: "bg-blue-500 text-white dark:bg-blue-600" },
  rfi: { className: "bg-amber-500 text-white dark:bg-amber-600" },
  submittal: { className: "bg-purple-500 text-white dark:bg-purple-600" },
  approval: { className: "bg-green-500 text-white dark:bg-green-600" },
  general: { className: "bg-gray-500 text-white dark:bg-gray-600" },
};

const IMPACT_AREA_BADGE_CONFIG: Record<string, { className: string }> = {
  production: { className: "bg-red-500 text-white dark:bg-red-600" },
  drawing: { className: "bg-blue-500 text-white dark:bg-blue-600" },
  design: { className: "bg-purple-500 text-white dark:bg-purple-600" },
  scheduling: { className: "bg-amber-500 text-white dark:bg-amber-600" },
  quality: { className: "bg-green-500 text-white dark:bg-green-600" },
  general: { className: "bg-gray-500 text-white dark:bg-gray-600" },
};

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const config = STATUS_BADGE_CONFIG[normalized] || { variant: "secondary" as const };
  const displayLabel = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

function RequestTypeBadge({ requestType }: { requestType: string | null }) {
  if (!requestType) return null;
  const normalized = requestType.toLowerCase().replace(/\s+/g, "_");
  const config = REQUEST_TYPE_BADGE_CONFIG[normalized] || { className: "bg-gray-500 text-white dark:bg-gray-600" };
  const displayLabel = requestType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge className={config.className} data-testid={`badge-request-type-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

function ImpactAreaBadge({ impactArea }: { impactArea: string | null }) {
  if (!impactArea) return null;
  const normalized = impactArea.toLowerCase().replace(/\s+/g, "_");
  const config = IMPACT_AREA_BADGE_CONFIG[normalized] || { className: "bg-gray-500 text-white dark:bg-gray-600" };
  const displayLabel = impactArea.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge className={config.className} data-testid={`badge-impact-area-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

function EmailBodyViewer({ emailId }: { emailId: string }) {
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: emailBody, isLoading } = useQuery<EmailBody>({
    queryKey: [DRAFTING_INBOX_ROUTES.EMAIL_BODY(emailId)],
    enabled: !!emailId,
  });

  useEffect(() => {
    if (viewMode === "html" && emailBody?.html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; background-color: #ffffff; margin: 12px; word-wrap: break-word; }
              img { max-width: 100%; height: auto; }
              a { color: #2563eb; }
              table { border-collapse: collapse; max-width: 100%; }
              td, th { padding: 4px 8px; }
            </style>
          </head>
          <body>${emailBody.html}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [viewMode, emailBody?.html]);

  const hasHtml = !!emailBody?.html;
  const hasText = !!emailBody?.text;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48" data-testid="loader-email-body">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasHtml && !hasText) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2" data-testid="empty-email-body">
        <Mail className="h-10 w-10 opacity-30" />
        <p className="text-sm">No email body available</p>
      </div>
    );
  }

  const effectiveMode = viewMode === "html" && hasHtml ? "html" : "text";

  return (
    <div className="flex flex-col h-full" data-testid="panel-email-body">
      <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">Email Body</span>
        </div>
        <div className="flex items-center gap-1">
          {hasHtml && (
            <Button
              variant={effectiveMode === "html" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("html")}
              data-testid="button-view-html"
            >
              <Code className="h-3 w-3 mr-1" />
              HTML
            </Button>
          )}
          {hasText && (
            <Button
              variant={effectiveMode === "text" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("text")}
              data-testid="button-view-text"
            >
              <Type className="h-3 w-3 mr-1" />
              Text
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-0 bg-white" data-testid="container-email-body">
        {effectiveMode === "html" && hasHtml ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            className="w-full h-full border-0 min-h-[300px] bg-white"
            title="Email body"
            data-testid="iframe-email-body"
          />
        ) : (
          <pre className="p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-800 bg-white" data-testid="text-email-body">
            {emailBody?.text || ""}
          </pre>
        )}
      </div>
    </div>
  );
}

function DocumentsPanel({ email }: { email: DraftingEmailDetail }) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const docs = email.documents || [];
  const selectedDoc = selectedDocId ? docs.find(d => d.id === selectedDocId) : null;

  const { data: thumbnailData, isLoading: thumbnailsLoading } = useQuery<{ totalPages: number; pages: PageThumbnail[] }>({
    queryKey: [DRAFTING_INBOX_ROUTES.PAGE_THUMBNAILS(email.id)],
    enabled: docs.length > 0,
  });

  const numPages = thumbnailData?.totalPages || 0;
  const currentPageData = thumbnailData?.pages?.find(p => p.pageNumber === currentPage);

  const handleViewDocument = useCallback((docId: string) => {
    window.open(DRAFTING_INBOX_ROUTES.DOCUMENT_VIEW(email.id), "_blank");
  }, [email.id]);

  if (docs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col" data-testid="panel-documents">
      <div className="p-2 border-b border-t bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">Documents ({docs.length})</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-2 rounded-md border text-sm"
            data-testid={`doc-item-${doc.id}`}
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium" data-testid={`doc-name-${doc.id}`}>{doc.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {doc.mimeType} {doc.fileSize ? `\u00B7 ${formatFileSize(doc.fileSize)}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewDocument(doc.id)}
              data-testid={`button-view-doc-${doc.id}`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {numPages > 0 && (
        <div className="border-t">
          <div className="p-2 bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Page Thumbnails</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} data-testid="button-zoom-out">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(5, z + 0.25))} data-testid="button-zoom-in">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="p-2 overflow-auto max-h-[400px]">
            {thumbnailsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentPageData ? (
              <div className="flex items-start justify-center">
                <img
                  src={`data:image/png;base64,${currentPageData.thumbnail}`}
                  alt={`Page ${currentPage}`}
                  className="shadow-lg rounded-sm"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    maxWidth: zoom <= 1 ? "100%" : "none",
                  }}
                  draggable={false}
                  data-testid="img-page-thumbnail"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No preview available</p>
            )}
          </div>
          {numPages > 1 && (
            <div className="p-2 border-t bg-muted/30 flex items-center justify-center gap-3">
              <Button variant="ghost" size="icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} data-testid="button-prev-page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-page-info">Page {currentPage} of {numPages}</span>
              <Button variant="ghost" size="icon" disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} data-testid="button-next-page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExtractedFieldsCard({ email, onReExtract, isExtracting }: { email: DraftingEmailDetail; onReExtract: () => void; isExtracting: boolean }) {
  const fields = email.extractedFields || [];

  const priorityFields = [
    "request_type", "impact_area", "urgency", "summary", "job_reference",
    "panel_references", "drawing_numbers", "change_description",
    "action_required", "sender_company", "sender_name"
  ];

  const sorted = useMemo(() => {
    return [...fields].sort((a, b) => {
      const aIdx = priorityFields.indexOf(a.fieldKey);
      const bIdx = priorityFields.indexOf(b.fieldKey);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.fieldKey.localeCompare(b.fieldKey);
    });
  }, [fields]);

  const arrayFields = ["panel_references", "drawing_numbers"];

  const renderFieldValue = (field: { fieldKey: string; fieldValue: string | null }) => {
    if (!field.fieldValue) return "\u2014";

    if (arrayFields.includes(field.fieldKey)) {
      try {
        const arr = JSON.parse(field.fieldValue);
        if (Array.isArray(arr)) {
          return (
            <div className="flex flex-wrap gap-1">
              {arr.map((item: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          );
        }
      } catch {}
    }

    if (field.fieldKey === "request_type") {
      return <RequestTypeBadge requestType={field.fieldValue} />;
    }

    if (field.fieldKey === "impact_area") {
      return <ImpactAreaBadge impactArea={field.fieldValue} />;
    }

    if (field.fieldKey === "urgency") {
      const urgencyColors: Record<string, string> = {
        high: "bg-red-500 text-white dark:bg-red-600",
        medium: "bg-amber-500 text-white dark:bg-amber-600",
        low: "bg-green-500 text-white dark:bg-green-600",
      };
      const normalized = field.fieldValue.toLowerCase();
      return (
        <Badge className={urgencyColors[normalized] || ""} data-testid={`badge-urgency-${normalized}`}>
          {field.fieldValue.replace(/\b\w/g, (c) => c.toUpperCase())}
        </Badge>
      );
    }

    if (field.fieldKey === "summary" || field.fieldKey === "change_description" || field.fieldKey === "action_required") {
      return <p className="text-sm leading-relaxed">{field.fieldValue}</p>;
    }

    return <span className="text-sm font-medium">{field.fieldValue}</span>;
  };

  return (
    <Card data-testid="card-extracted-fields">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold">Extracted Information</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onReExtract}
            disabled={isExtracting}
            data-testid="button-re-extract-fields"
          >
            {isExtracting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Re-extract
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No extracted fields yet. Click Re-extract to process.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Field</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                  <TableHead className="text-xs w-16">Conf.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((field) => (
                  <TableRow key={field.id} data-testid={`extracted-${field.fieldKey}`}>
                    <TableCell className="text-muted-foreground text-xs py-2 align-top">
                      {field.fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </TableCell>
                    <TableCell className="py-2">{renderFieldValue(field)}</TableCell>
                    <TableCell className="py-2">
                      {field.confidence != null && (
                        <Badge variant="outline" className="text-xs">
                          {(parseFloat(String(field.confidence)) * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobMatchPanel({ email, emailId }: { email: DraftingEmailDetail; emailId: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const { toast } = useToast();

  const { data: jobs } = useQuery<Array<{ id: string; name: string; jobNumber?: string }>>({
    queryKey: ["/api/jobs"],
    select: (data: any) => {
      if (Array.isArray(data)) return data;
      if (data?.jobs) return data.jobs;
      return [];
    },
  });

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!searchQuery.trim()) return jobs.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return jobs.filter(j =>
      j.name.toLowerCase().includes(q) ||
      (j.jobNumber && j.jobNumber.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [jobs, searchQuery]);

  const matchMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest("POST", DRAFTING_INBOX_ROUTES.MATCH_JOB(emailId), { jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.BY_ID(emailId)] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.ACTIVITY(emailId)] });
      toast({ title: "Email matched to job" });
    },
    onError: (err: Error) => {
      toast({ title: "Match failed", description: err.message, variant: "destructive" });
    },
  });

  const isMatched = !!email.job;

  return (
    <Card data-testid="card-job-match">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Job Match</h3>

        {isMatched && email.job ? (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" data-testid="card-matched-job">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <div className="flex-1 text-sm min-w-0">
              <span className="text-green-700 dark:text-green-400 font-medium">Matched to: </span>
              <span className="text-green-700 dark:text-green-300">
                {email.job.jobNumber ? `${email.job.jobNumber} - ` : ""}{email.job.name}
              </span>
              {email.matchedAt && (
                <span className="text-xs text-muted-foreground block mt-0.5">
                  Matched on {formatDateTime(email.matchedAt)}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" asChild data-testid="button-view-job">
              <a href={`/admin/jobs`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        ) : (
          <>
            <div data-testid="field-job-search">
              <label className="text-xs text-muted-foreground mb-1 block">Search Jobs</label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or number..."
                className="text-sm mb-2"
                data-testid="input-job-search"
              />
            </div>
            <div data-testid="field-job-select">
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredJobs.map(job => (
                    <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                      {job.jobNumber ? `${job.jobNumber} - ${job.name}` : job.name}
                    </SelectItem>
                  ))}
                  {filteredJobs.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No jobs found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!selectedJobId) {
                  toast({ title: "Select a job first", variant: "destructive" });
                  return;
                }
                matchMutation.mutate(selectedJobId);
              }}
              disabled={matchMutation.isPending || !selectedJobId}
              data-testid="button-match-job"
            >
              {matchMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LinkIcon className="h-3 w-3 mr-1" />}
              Match to Job
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const DRAFTING_ACTION_TYPES = [
  "Update Drawing",
  "Contact Customer",
  "Confirm Detail",
  "Review Specification",
  "Respond to RFI",
  "Issue Revised Drawing",
  "Schedule Meeting",
  "Update Production Schedule",
  "Notify Stakeholder",
  "Request Information",
  "Other",
] as const;

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  createdAt: string;
  assignees?: Array<{ userId: string; user?: { id: string; fullName: string } }>;
  job?: { id: string; name: string; jobNumber?: string } | null;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const DUE_DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "14 Days", days: 14 },
  { label: "21 Days", days: 21 },
] as const;

function CreateTaskPanel({ email, emailId }: { email: DraftingEmailDetail; emailId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionType, setActionType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [aiReason, setAiReason] = useState("");
  const { toast } = useToast();

  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; actionType: string; description?: string; jobId?: string | null; dueDate?: string | null; priority?: string | null }) => {
      const res = await apiRequest("POST", DRAFTING_INBOX_ROUTES.CREATE_TASK(emailId), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.EMAIL_TASKS(emailId)] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.ACTIVITY(emailId)] });
      toast({ title: "Task created successfully" });
      setIsOpen(false);
      setActionType("");
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("MEDIUM");
      setAiReason("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    },
  });

  const suggestDueDateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", DRAFTING_INBOX_ROUTES.SUGGEST_DUE_DATE(emailId), { actionType: actionType || undefined });
      return res.json();
    },
    onSuccess: (data: { days: number; date: string; reason: string }) => {
      setDueDate(data.date);
      setAiReason(data.reason);
    },
    onError: () => {
      toast({ title: "Could not get AI suggestion", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!actionType) {
      toast({ title: "Select an action type", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Enter a task title", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate({
      title: title.trim(),
      actionType,
      description: description.trim() || undefined,
      jobId: email.jobId || null,
      dueDate: dueDate || null,
      priority,
    });
  };

  const extractedAction = email.extractedFields?.find(f => f.fieldKey === "action_required");
  useEffect(() => {
    if (extractedAction?.fieldValue && !title) {
      setTitle(extractedAction.fieldValue);
    }
  }, [extractedAction?.fieldValue]);

  const matchedJobLabel = email.job
    ? `${email.job.jobNumber ? `${email.job.jobNumber} - ` : ""}${email.job.name}`
    : null;

  return (
    <Card data-testid="card-create-task">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Action Required</h3>
          {!isOpen && (
            <Button size="sm" onClick={() => setIsOpen(true)} data-testid="button-open-create-task">
              <Pencil className="h-3 w-3 mr-1" />
              Create Task
            </Button>
          )}
        </div>

        {isOpen && (
          <div className="space-y-3 pt-1">
            {matchedJobLabel && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm" data-testid="field-task-job-display">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Job:</span>
                <span className="font-medium truncate">{matchedJobLabel}</span>
              </div>
            )}
            {!matchedJobLabel && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm" data-testid="field-task-no-job">
                <span className="text-amber-700 dark:text-amber-400">Match a job above first to link this task</span>
              </div>
            )}

            <div data-testid="field-action-type">
              <label className="text-xs text-muted-foreground mb-1 block">Action Type</label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger data-testid="select-action-type">
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  {DRAFTING_ACTION_TYPES.map(type => (
                    <SelectItem key={type} value={type} data-testid={`option-action-${type}`}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div data-testid="field-task-title">
              <label className="text-xs text-muted-foreground mb-1 block">Task Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Update north elevation drawings"
                data-testid="input-task-title"
              />
            </div>

            <div data-testid="field-task-description">
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details..."
                data-testid="input-task-description"
              />
            </div>

            <div data-testid="field-task-priority">
              <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div data-testid="field-task-due-date">
              <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); setAiReason(""); }}
                data-testid="input-task-due-date"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {DUE_DATE_PRESETS.map(preset => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant={dueDate === addDays(preset.days) ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDueDate(addDays(preset.days)); setAiReason(""); }}
                    data-testid={`button-due-${preset.days}d`}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => suggestDueDateMutation.mutate()}
                  disabled={suggestDueDateMutation.isPending}
                  className="ml-auto"
                  data-testid="button-ai-suggest-due"
                >
                  {suggestDueDateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  AI Suggest
                </Button>
              </div>
              {aiReason && (
                <p className="text-xs text-muted-foreground mt-1.5 italic" data-testid="text-ai-reason">
                  {aiReason}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createTaskMutation.isPending || !actionType || !title.trim()}
                data-testid="button-submit-task"
              >
                {createTaskMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Create Task
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                data-testid="button-cancel-task"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkedTasksPanel({ emailId }: { emailId: string }) {
  const { data: linkedTasks, isLoading } = useQuery<LinkedTask[]>({
    queryKey: [DRAFTING_INBOX_ROUTES.EMAIL_TASKS(emailId)],
    enabled: !!emailId,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-linked-tasks">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Linked Tasks</h3>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!linkedTasks || linkedTasks.length === 0) return null;

  const taskStatusColors: Record<string, string> = {
    NOT_STARTED: "bg-gray-500 text-white",
    IN_PROGRESS: "bg-blue-500 text-white",
    STUCK: "bg-red-500 text-white",
    DONE: "bg-green-500 text-white",
    ON_HOLD: "bg-amber-500 text-white",
  };

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-400 text-white",
    MEDIUM: "bg-amber-500 text-white",
    HIGH: "bg-orange-500 text-white",
    CRITICAL: "bg-red-600 text-white",
  };

  return (
    <Card data-testid="card-linked-tasks">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">Linked Tasks ({linkedTasks.length})</h3>
        <div className="space-y-2">
          {linkedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-2 p-2.5 rounded-md border text-sm"
              data-testid={`linked-task-${task.id}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium truncate" data-testid={`text-task-title-${task.id}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge className={taskStatusColors[task.status] || "bg-gray-500 text-white"} data-testid={`badge-task-status-${task.id}`}>
                    {task.status.replace(/_/g, " ")}
                  </Badge>
                  {task.priority && (
                    <Badge className={priorityColors[task.priority] || ""} data-testid={`badge-task-priority-${task.id}`}>
                      {task.priority}
                    </Badge>
                  )}
                  {task.dueDate && (
                    <span className="text-xs text-muted-foreground" data-testid={`text-task-due-${task.id}`}>
                      Due: {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
                {task.assignees && task.assignees.length > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid={`text-task-assignees-${task.id}`}>
                    Assigned: {task.assignees.map(a => a.user?.fullName || "Unknown").join(", ")}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" asChild data-testid={`button-view-task-${task.id}`}>
                <a href="/tasks">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ emailId }: { emailId: string }) {
  const { data: activity } = useQuery<Array<{ id: string; activityType: string; message: string; createdAt: string }>>({
    queryKey: [DRAFTING_INBOX_ROUTES.ACTIVITY(emailId)],
    enabled: !!emailId,
  });

  if (!activity || activity.length === 0) return null;

  const activityIcons: Record<string, typeof Clock> = {
    received: Mail,
    processed: FileText,
    extraction_started: RefreshCw,
    extraction_completed: CheckCircle2,
    matched: LinkIcon,
  };

  return (
    <Card data-testid="card-activity">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">Activity Log</h3>
        <div className="space-y-3">
          {activity.map((act) => {
            const IconComponent = activityIcons[act.activityType] || Clock;
            return (
              <div key={act.id} className="flex items-start gap-2 text-xs" data-testid={`activity-${act.id}`}>
                <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                  <IconComponent className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{act.message}</p>
                  <span className="text-muted-foreground">{formatDateTime(act.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DraftingEmailDetailPage() {
  const [, params] = useRoute("/drafting-emails/:id");
  const emailId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useDocumentTitle("Drafting Email Detail");

  const [mobileTab, setMobileTab] = useState<"email" | "details">("email");

  const { data: email, isLoading } = useQuery<DraftingEmailDetail>({
    queryKey: [DRAFTING_INBOX_ROUTES.BY_ID(emailId || "")],
    queryFn: async () => {
      const res = await fetch(DRAFTING_INBOX_ROUTES.BY_ID(emailId!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email details");
      return res.json();
    },
    enabled: !!emailId,
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!emailId) return;
      await apiRequest("POST", DRAFTING_INBOX_ROUTES.EXTRACT(emailId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.BY_ID(emailId!)] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.ACTIVITY(emailId!)] });
      toast({ title: "Extraction started" });
    },
    onError: (err: Error) => {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!emailId) return;
      await apiRequest("DELETE", DRAFTING_INBOX_ROUTES.BY_ID(emailId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
      toast({ title: "Email deleted" });
      navigate("/drafting-emails");
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!emailId) return;
      await apiRequest("PATCH", DRAFTING_INBOX_ROUTES.BY_ID(emailId), { status: "ARCHIVED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.BY_ID(emailId!)] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.COUNTS] });
      toast({ title: "Email archived" });
    },
    onError: (err: Error) => {
      toast({ title: "Archive failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-73px)]" data-testid="page-drafting-email-detail">
        <div className="flex items-center gap-3 px-4 py-2 border-b">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[55%] border-r p-8">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="w-[45%] p-4 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)]" data-testid="page-drafting-email-detail">
        <div className="text-center">
          <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">Email not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/drafting-emails")} data-testid="button-back-to-list">
            Back to Drafting Emails
          </Button>
        </div>
      </div>
    );
  }

  const leftPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <EmailBodyViewer emailId={email.id} />
      </div>
      <DocumentsPanel email={email} />
    </div>
  );

  const detailsPanel = (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <Card data-testid="card-email-info">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Email Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">From</span>
                <span className="font-medium" data-testid="text-from">{email.fromAddress}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Received</span>
                <span data-testid="text-received">{formatDateTime(email.createdAt)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Subject</span>
                <span className="font-medium" data-testid="text-subject">{email.subject || "\u2014"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Attachments</span>
                <span data-testid="text-attachments">{email.attachmentCount || 0}</span>
              </div>
              {email.requestType && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Request Type</span>
                  <RequestTypeBadge requestType={email.requestType} />
                </div>
              )}
              {email.impactArea && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Impact Area</span>
                  <ImpactAreaBadge impactArea={email.impactArea} />
                </div>
              )}
              {email.processingError && (
                <div className="col-span-2">
                  <span className="text-xs text-destructive" data-testid="text-error">{email.processingError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <JobMatchPanel email={email} emailId={emailId!} />

        <CreateTaskPanel email={email} emailId={emailId!} />

        <LinkedTasksPanel emailId={emailId!} />

        <ExtractedFieldsCard
          email={email}
          onReExtract={() => extractMutation.mutate()}
          isExtracting={extractMutation.isPending}
        />

        <ActivityFeed emailId={emailId!} />
      </div>
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]" data-testid="page-drafting-email-detail">
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 border-b bg-background flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/drafting-emails")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-sm font-semibold truncate" data-testid="text-email-subject">
          {email.subject || `Email from ${email.fromAddress}`}
        </h1>
        <StatusBadge status={email.status} />
        <RequestTypeBadge requestType={email.requestType} />
        <ImpactAreaBadge impactArea={email.impactArea} />
        <div className="ml-auto hidden md:flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending}
            data-testid="button-extract"
          >
            {extractMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Re-extract
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            data-testid="button-archive"
          >
            {archiveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Archive className="h-3 w-3 mr-1" />}
            Archive
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete this email?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            data-testid="button-delete"
          >
            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
            Delete
          </Button>
        </div>
      </div>

      <div className="md:hidden flex border-b bg-background">
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "email" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
          onClick={() => setMobileTab("email")}
          data-testid="tab-mobile-email"
        >
          <Mail className="h-4 w-4 inline-block mr-1.5" />
          Email
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "details" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
          onClick={() => setMobileTab("details")}
          data-testid="tab-mobile-details"
        >
          <Pencil className="h-4 w-4 inline-block mr-1.5" />
          Details
        </button>
      </div>

      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r overflow-hidden">
          {leftPanel}
        </div>
        <div className="w-[45%] overflow-hidden flex flex-col">
          {detailsPanel}
        </div>
      </div>

      <div className="flex md:hidden flex-1 overflow-hidden flex-col">
        {mobileTab === "email" ? (
          <div className="flex-1 overflow-auto">
            {leftPanel}
          </div>
        ) : (
          <>
            {detailsPanel}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-background flex-wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("/drafting-emails")} data-testid="button-close-mobile">
                Close
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => extractMutation.mutate()}
                  disabled={extractMutation.isPending}
                  data-testid="button-extract-mobile"
                >
                  {extractMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Extract
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
