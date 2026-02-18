import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DRAFTING_INBOX_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, FileText, CheckCircle2, Clock, Pencil,
  Loader2, LinkIcon, RefreshCw, Mail, Eye,
  Code, Type, Sparkles,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

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

interface EmailBody {
  html: string | null;
  text: string | null;
}

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  createdAt: string;
  assignees?: Array<{ userId: string; user?: { id: string; fullName: string } }>;
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

const STATUS_COLORS: Record<string, string> = {
  received: "bg-gray-500 text-white",
  processing: "bg-amber-500 text-white",
  processed: "bg-indigo-500 text-white",
  matched: "bg-green-600 text-white",
  archived: "bg-gray-400 text-white",
  failed: "bg-red-500 text-white",
};

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

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const DUE_DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "21d", days: 21 },
] as const;

type MobileTab = "email" | "attachments" | "details";

function MobileEmailBodyViewer({ emailId }: { emailId: string }) {
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
        doc.write(`<!DOCTYPE html><html><head><style>body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; background-color: #ffffff; margin: 12px; word-wrap: break-word; } img { max-width: 100%; height: auto; } a { color: #2563eb; } table { border-collapse: collapse; max-width: 100%; } td, th { padding: 4px 8px; }</style></head><body>${emailBody.html}</body></html>`);
        doc.close();
      }
    }
  }, [viewMode, emailBody?.html]);

  const hasHtml = !!emailBody?.html;
  const hasText = !!emailBody?.text;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48" data-testid="loader-email-body">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!hasHtml && !hasText) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-white/40 gap-2" data-testid="empty-email-body">
        <Mail className="h-10 w-10 opacity-30" />
        <p className="text-sm">No email body available</p>
      </div>
    );
  }

  const effectiveMode = viewMode === "html" && hasHtml ? "html" : "text";

  return (
    <div className="flex flex-col h-full" data-testid="panel-email-body-mobile">
      <div className="p-2 border-b border-white/10 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-white/70">Email Body</span>
        <div className="flex items-center gap-1">
          {hasHtml && (
            <Button
              variant={effectiveMode === "html" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("html")}
              className="text-xs h-7"
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
              className="text-xs h-7"
              data-testid="button-view-text"
            >
              <Type className="h-3 w-3 mr-1" />
              Text
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white rounded-b-lg" data-testid="container-email-body">
        {effectiveMode === "html" && hasHtml ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            className="w-full border-0 min-h-[300px] bg-white"
            style={{ height: "50vh" }}
            title="Email body"
            data-testid="iframe-email-body"
          />
        ) : (
          <pre className="p-3 text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-800 bg-white min-h-[200px]" data-testid="text-email-body">
            {emailBody?.text || ""}
          </pre>
        )}
      </div>
    </div>
  );
}

function MobileDocumentsPanel({ email }: { email: DraftingEmailDetail }) {
  const docs = email.documents || [];

  const handleViewDocument = useCallback(() => {
    window.open(DRAFTING_INBOX_ROUTES.DOCUMENT_VIEW(email.id), "_blank");
  }, [email.id]);

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40" data-testid="empty-attachments">
        <FileText className="h-10 w-10 opacity-30 mb-2" />
        <p className="text-sm">No attachments</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3" data-testid="panel-documents-mobile">
      <h3 className="text-sm font-semibold text-white/80">Attachments ({docs.length})</h3>
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5"
          data-testid={`doc-item-${doc.id}`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 shrink-0">
            <FileText className="h-4 w-4 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate" data-testid={`doc-name-${doc.id}`}>{doc.fileName}</p>
            <p className="text-xs text-white/50">
              {doc.mimeType} {doc.fileSize ? `\u00B7 ${formatFileSize(doc.fileSize)}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleViewDocument}
            className="text-white/60"
            data-testid={`button-view-doc-${doc.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function MobileJobMatchPanel({ email, emailId }: { email: DraftingEmailDetail; emailId: string }) {
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3" data-testid="card-job-match-mobile">
      <h3 className="text-sm font-semibold text-white/90">Job Match</h3>

      {isMatched && email.job ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30" data-testid="card-matched-job-mobile">
          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
          <div className="flex-1 text-sm min-w-0">
            <span className="text-green-300 font-medium">Matched: </span>
            <span className="text-green-200">
              {email.job.jobNumber ? `${email.job.jobNumber} - ` : ""}{email.job.name}
            </span>
            {email.matchedAt && (
              <span className="text-xs text-white/40 block mt-0.5">
                {formatDateTime(email.matchedAt)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs by name or number..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
            data-testid="input-job-search-mobile"
          />
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white" data-testid="select-job-mobile">
              <SelectValue placeholder="Select a job..." />
            </SelectTrigger>
            <SelectContent>
              {filteredJobs.map(job => (
                <SelectItem key={job.id} value={job.id} data-testid={`option-job-mobile-${job.id}`}>
                  {job.jobNumber ? `${job.jobNumber} - ${job.name}` : job.name}
                </SelectItem>
              ))}
              {filteredJobs.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No jobs found</div>
              )}
            </SelectContent>
          </Select>
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
            className="w-full"
            data-testid="button-match-job-mobile"
          >
            {matchMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LinkIcon className="h-3 w-3 mr-1" />}
            Match to Job
          </Button>
        </>
      )}
    </div>
  );
}

function mapRequestTypeToAction(requestType: string | null): string {
  if (!requestType) return "";
  const mapping: Record<string, string> = {
    change_request: "Update Drawing",
    drawing_update: "Update Drawing",
    rfi: "Respond to RFI",
    submittal: "Review Specification",
    approval: "Confirm Detail",
    general: "Other",
  };
  return mapping[requestType.toLowerCase().replace(/\s+/g, "_")] || "";
}

function mapUrgencyToPriority(urgency: string | null): string {
  if (!urgency) return "MEDIUM";
  const u = urgency.toLowerCase();
  if (u === "high" || u === "urgent" || u === "critical") return "HIGH";
  if (u === "low") return "LOW";
  return "MEDIUM";
}

function MobileCreateTaskPanel({ email, emailId }: { email: DraftingEmailDetail; emailId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [manualActionType, setManualActionType] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualDueDate, setManualDueDate] = useState("");
  const [manualPriority, setManualPriority] = useState("MEDIUM");
  const [manualAssigneeId, setManualAssigneeId] = useState("");
  const [aiDueDate, setAiDueDate] = useState("");
  const [aiReason, setAiReason] = useState("");
  const [manualAiReason, setManualAiReason] = useState("");
  const { toast } = useToast();

  const extractedAction = email.extractedFields?.find(f => f.fieldKey === "action_required");
  const extractedSummary = email.extractedFields?.find(f => f.fieldKey === "summary");
  const extractedUrgency = email.extractedFields?.find(f => f.fieldKey === "urgency");
  const extractedRequestType = email.extractedFields?.find(f => f.fieldKey === "request_type");

  const hasAiRecommendation = !!extractedAction?.fieldValue;
  const aiTitle = extractedAction?.fieldValue || "";
  const aiActionType = mapRequestTypeToAction(extractedRequestType?.fieldValue || email.requestType);
  const aiPriority = mapUrgencyToPriority(extractedUrgency?.fieldValue);
  const aiDescription = extractedSummary?.fieldValue || "";

  const { data: companyUsers = [] } = useQuery<Array<{ id: string; fullName: string; role: string }>>({
    queryKey: ["/api/users"],
    select: (data: any) => {
      const list = Array.isArray(data) ? data : data?.users || [];
      return list.filter((u: any) => u.fullName).sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
    },
  });

  const suggestDueDateMutation = useMutation({
    mutationFn: async (actionType?: string) => {
      const res = await apiRequest("POST", DRAFTING_INBOX_ROUTES.SUGGEST_DUE_DATE(emailId), { actionType: actionType || undefined });
      return res.json();
    },
    onSuccess: (data: { days: number; date: string; reason: string }) => {
      if (showManual) {
        setManualDueDate(data.date);
        setManualAiReason(data.reason);
      } else {
        setAiDueDate(data.date);
        setAiReason(data.reason);
      }
    },
    onError: () => {},
  });

  const dueDateFetched = useRef(false);
  useEffect(() => {
    if (hasAiRecommendation && !dismissed && !aiDueDate && !dueDateFetched.current) {
      dueDateFetched.current = true;
      suggestDueDateMutation.mutate(aiActionType || undefined);
    }
  }, [hasAiRecommendation, dismissed]);

  const switchToManualWithAiValues = () => {
    setManualTitle(aiTitle);
    setManualActionType(aiActionType || "");
    setManualDescription(aiDescription);
    setManualPriority(aiPriority);
    setManualDueDate(aiDueDate);
    setManualAiReason(aiReason);
    if (assigneeId) setManualAssigneeId(assigneeId);
    setShowManual(true);
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; actionType: string; description?: string; jobId?: string | null; dueDate?: string | null; priority?: string | null; assigneeIds?: string[] }) => {
      const res = await apiRequest("POST", DRAFTING_INBOX_ROUTES.CREATE_TASK(emailId), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.EMAIL_TASKS(emailId)] });
      queryClient.invalidateQueries({ queryKey: [DRAFTING_INBOX_ROUTES.ACTIVITY(emailId)] });
      toast({ title: "Task created successfully" });
      setDismissed(true);
      setShowManual(false);
      setAssigneeId("");
      setManualActionType("");
      setManualTitle("");
      setManualDescription("");
      setManualDueDate("");
      setManualPriority("MEDIUM");
      setManualAssigneeId("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    },
  });

  const handleAddRecommended = () => {
    if (!assigneeId) {
      toast({ title: "Select a user to assign this task to", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate({
      title: aiTitle,
      actionType: aiActionType || "Other",
      description: aiDescription || undefined,
      jobId: email.jobId || null,
      dueDate: aiDueDate || null,
      priority: aiPriority,
      assigneeIds: [assigneeId],
    });
  };

  const handleManualSubmit = () => {
    if (!manualActionType) {
      toast({ title: "Select an action type", variant: "destructive" });
      return;
    }
    if (!manualTitle.trim()) {
      toast({ title: "Enter a task title", variant: "destructive" });
      return;
    }
    if (!manualAssigneeId) {
      toast({ title: "Select a user to assign this task to", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate({
      title: manualTitle.trim(),
      actionType: manualActionType,
      description: manualDescription.trim() || undefined,
      jobId: email.jobId || null,
      dueDate: manualDueDate || null,
      priority: manualPriority,
      assigneeIds: [manualAssigneeId],
    });
  };

  const matchedJobLabel = email.job
    ? `${email.job.jobNumber ? `${email.job.jobNumber} - ` : ""}${email.job.name}`
    : null;

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-400 text-white",
    MEDIUM: "bg-amber-500 text-white",
    HIGH: "bg-orange-500 text-white",
    CRITICAL: "bg-red-600 text-white",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3" data-testid="card-create-task-mobile">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white/90">AI Recommended Action</h3>
        </div>
        {(dismissed || !hasAiRecommendation) && !showManual && (
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setShowManual(true); setDismissed(false); }} data-testid="button-open-create-task-mobile">
            <Pencil className="h-3 w-3 mr-1" />
            Custom
          </Button>
        )}
      </div>

      {hasAiRecommendation && !dismissed && !showManual && (
        <div className="space-y-3" data-testid="panel-ai-recommendation-mobile">
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-2">
            <p className="text-sm font-medium text-white" data-testid="text-ai-task-title-mobile">{aiTitle}</p>
            {aiDescription && (
              <p className="text-xs text-white/50 leading-relaxed" data-testid="text-ai-task-description-mobile">{aiDescription}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {aiActionType && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white/70" data-testid="badge-ai-action-type-mobile">{aiActionType}</Badge>
              )}
              <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[aiPriority]}`} data-testid="badge-ai-priority-mobile">{aiPriority}</Badge>
              {aiDueDate && (
                <span className="text-[10px] text-white/50" data-testid="text-ai-due-date-mobile">
                  Due: {new Date(aiDueDate).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                </span>
              )}
              {suggestDueDateMutation.isPending && (
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </span>
              )}
            </div>
            {aiReason && (
              <p className="text-[10px] text-white/40 italic" data-testid="text-ai-reason-mobile">{aiReason}</p>
            )}
            {matchedJobLabel && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                <LinkIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{matchedJobLabel}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Assign To <span className="text-red-400">*</span></label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className={`bg-white/10 border-white/20 text-white ${!assigneeId ? "border-red-500/50" : ""}`} data-testid="select-task-assignee-mobile">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {companyUsers.map(user => (
                  <SelectItem key={user.id} value={user.id} data-testid={`option-assignee-mobile-${user.id}`}>
                    {user.fullName}
                  </SelectItem>
                ))}
                {companyUsers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAddRecommended}
              disabled={createTaskMutation.isPending || !assigneeId}
              className="flex-1"
              data-testid="button-add-task-mobile"
            >
              {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissed(true)}
              className="flex-1"
              data-testid="button-ignore-task-mobile"
            >
              Ignore
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={switchToManualWithAiValues}
              data-testid="button-edit-task-mobile"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {!hasAiRecommendation && !showManual && !dismissed && (
        <div className="text-center py-3">
          <p className="text-xs text-white/40 mb-2">No AI recommendation available.</p>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowManual(true)} data-testid="button-open-create-task-mobile">
            <Pencil className="h-3 w-3 mr-1" />
            Create Task Manually
          </Button>
        </div>
      )}

      {showManual && (
        <div className="space-y-3" data-testid="panel-manual-task-mobile">
          {matchedJobLabel && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm" data-testid="field-task-job-display-mobile">
              <LinkIcon className="h-3.5 w-3.5 text-white/40 shrink-0" />
              <span className="text-white/50">Job:</span>
              <span className="font-medium text-white/80 truncate">{matchedJobLabel}</span>
            </div>
          )}
          {!matchedJobLabel && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm" data-testid="field-task-no-job-mobile">
              <span className="text-amber-300 text-xs">Match a job above first to link this task</span>
            </div>
          )}

          <Select value={manualActionType} onValueChange={setManualActionType}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white" data-testid="select-action-type-mobile">
              <SelectValue placeholder="Select action type..." />
            </SelectTrigger>
            <SelectContent>
              {DRAFTING_ACTION_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Task title..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
            data-testid="input-task-title-mobile"
          />

          <Input
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
            data-testid="input-task-description-mobile"
          />

          <Select value={manualPriority} onValueChange={setManualPriority}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white" data-testid="select-task-priority-mobile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Assign To <span className="text-red-400">*</span></label>
            <Select value={manualAssigneeId} onValueChange={setManualAssigneeId}>
              <SelectTrigger className={`bg-white/10 border-white/20 text-white ${!manualAssigneeId ? "border-red-500/50" : ""}`} data-testid="select-task-assignee-mobile">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {companyUsers.map(user => (
                  <SelectItem key={user.id} value={user.id} data-testid={`option-assignee-mobile-${user.id}`}>
                    {user.fullName}
                  </SelectItem>
                ))}
                {companyUsers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Input
              type="date"
              value={manualDueDate}
              onChange={(e) => { setManualDueDate(e.target.value); setManualAiReason(""); }}
              className="bg-white/10 border-white/20 text-white text-sm"
              data-testid="input-task-due-date-mobile"
            />
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {DUE_DATE_PRESETS.map(preset => (
                <Button
                  key={preset.days}
                  type="button"
                  variant={manualDueDate === addDays(preset.days) ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => { setManualDueDate(addDays(preset.days)); setManualAiReason(""); }}
                  data-testid={`button-due-${preset.days}d-mobile`}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2 ml-auto"
                onClick={() => suggestDueDateMutation.mutate(manualActionType || undefined)}
                disabled={suggestDueDateMutation.isPending}
                data-testid="button-ai-suggest-due-mobile"
              >
                {suggestDueDateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                AI
              </Button>
            </div>
            {manualAiReason && (
              <p className="text-xs text-white/50 mt-1.5 italic" data-testid="text-ai-reason-mobile">
                {manualAiReason}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleManualSubmit}
              disabled={createTaskMutation.isPending || !manualActionType || !manualTitle.trim() || !manualAssigneeId}
              className="flex-1"
              data-testid="button-submit-task-mobile"
            >
              {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Create Task
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManual(false)}
              data-testid="button-cancel-task-mobile"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLinkedTasks({ emailId }: { emailId: string }) {
  const { data: linkedTasks, isLoading } = useQuery<LinkedTask[]>({
    queryKey: [DRAFTING_INBOX_ROUTES.EMAIL_TASKS(emailId)],
    enabled: !!emailId,
  });

  if (isLoading) {
    return <Skeleton className="h-16 w-full bg-white/10 rounded-xl" />;
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2" data-testid="card-linked-tasks-mobile">
      <h3 className="text-sm font-semibold text-white/90">Linked Tasks ({linkedTasks.length})</h3>
      {linkedTasks.map((task) => (
        <div
          key={task.id}
          className="p-2.5 rounded-lg border border-white/10 bg-white/5 space-y-1"
          data-testid={`linked-task-mobile-${task.id}`}
        >
          <p className="text-sm font-medium text-white truncate">{task.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={`text-[10px] px-1.5 py-0 ${taskStatusColors[task.status] || "bg-gray-500 text-white"}`}>
              {task.status.replace(/_/g, " ")}
            </Badge>
            {task.priority && (
              <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[task.priority] || ""}`}>
                {task.priority}
              </Badge>
            )}
            {task.dueDate && (
              <span className="text-[10px] text-white/40">Due: {formatDate(task.dueDate)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileExtractedFields({ email, onReExtract, isExtracting }: { email: DraftingEmailDetail; onReExtract: () => void; isExtracting: boolean }) {
  const fields = email.extractedFields || [];
  if (fields.length === 0 && !isExtracting) return null;

  const priorityFields = [
    "request_type", "impact_area", "urgency", "summary", "job_reference",
    "action_required", "sender_company", "sender_name"
  ];

  const sorted = [...fields].sort((a, b) => {
    const aIdx = priorityFields.indexOf(a.fieldKey);
    const bIdx = priorityFields.indexOf(b.fieldKey);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.fieldKey.localeCompare(b.fieldKey);
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2" data-testid="card-extracted-fields-mobile">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/90">Extracted Info</h3>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={onReExtract}
          disabled={isExtracting}
          data-testid="button-re-extract-mobile"
        >
          {isExtracting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Re-extract
        </Button>
      </div>
      {sorted.slice(0, 8).map((field) => (
        <div key={field.id} className="flex items-start gap-2 text-sm py-1 border-b border-white/5 last:border-0">
          <span className="text-white/40 text-xs min-w-[90px] pt-0.5">
            {field.fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
          <span className="text-white/80 text-xs flex-1 break-words">
            {field.fieldValue || "\u2014"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MobileDraftingEmailDetail() {
  const [, params] = useRoute("/mobile/drafting-emails/:id");
  const emailId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<MobileTab>("email");

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

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
        <header className="flex-shrink-0 border-b border-white/10 px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <Skeleton className="h-5 w-5 bg-white/10" />
          <Skeleton className="h-5 w-48 bg-white/10" />
        </header>
        <div className="flex-1 p-4 space-y-3">
          <Skeleton className="h-32 w-full bg-white/10 rounded-xl" />
          <Skeleton className="h-48 w-full bg-white/10 rounded-xl" />
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
        <header className="flex-shrink-0 border-b border-white/10 px-4 py-3" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <button onClick={() => navigate("/mobile/email-processing")} className="text-white/80" data-testid="button-back-mobile">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Mail className="h-12 w-12 text-white/20 mb-3" />
          <p className="text-sm text-white/60">Email not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/mobile/email-processing")} data-testid="button-back-to-list-mobile">
            Back to Email Processing
          </Button>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const statusNorm = email.status.toLowerCase().replace(/\s+/g, "_");
  const statusColor = STATUS_COLORS[statusNorm] || "bg-gray-500 text-white";
  const docsCount = email.documents?.length || 0;

  const tabs: { key: MobileTab; label: string; icon: typeof Mail }[] = [
    { key: "email", label: "Email", icon: Mail },
    { key: "attachments", label: `Files (${docsCount})`, icon: FileText },
    { key: "details", label: "Details", icon: Pencil },
  ];

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate("/mobile/email-processing")} className="text-white/80" data-testid="button-back-mobile">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate" data-testid="text-email-subject-mobile">
              {email.subject || `Email from ${email.fromAddress}`}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
                {email.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-[10px] text-white/40">{formatDateTime(email.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex border-t border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo-400 text-white"
                  : "border-transparent text-white/50"
              }`}
              data-testid={`tab-${tab.key}-mobile`}
            >
              <tab.icon className="h-3.5 w-3.5 inline-block mr-1" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        {activeTab === "email" && (
          <div className="p-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-white/40 min-w-[40px]">From</span>
                <span className="text-xs text-white/80">{email.fromAddress}</span>
              </div>
              {email.toAddress && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-white/40 min-w-[40px]">To</span>
                  <span className="text-xs text-white/80">{email.toAddress}</span>
                </div>
              )}
              {email.requestType && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-white/40 min-w-[40px]">Type</span>
                  <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white">
                    {email.requestType.replace(/_/g, " ")}
                  </Badge>
                </div>
              )}
              {email.impactArea && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-white/40 min-w-[40px]">Impact</span>
                  <Badge className="text-[10px] px-1.5 py-0 bg-purple-500 text-white">
                    {email.impactArea.replace(/_/g, " ")}
                  </Badge>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <MobileEmailBodyViewer emailId={email.id} />
            </div>
          </div>
        )}

        {activeTab === "attachments" && (
          <MobileDocumentsPanel email={email} />
        )}

        {activeTab === "details" && (
          <div className="p-3 space-y-3">
            <MobileJobMatchPanel email={email} emailId={emailId!} />
            <MobileCreateTaskPanel email={email} emailId={emailId!} />
            <MobileLinkedTasks emailId={emailId!} />
            <MobileExtractedFields
              email={email}
              onReExtract={() => extractMutation.mutate()}
              isExtracting={extractMutation.isPending}
            />
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
