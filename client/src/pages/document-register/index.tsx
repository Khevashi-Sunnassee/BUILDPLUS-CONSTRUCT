import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  FolderOpen,
  QrCode,
  ChevronDown,
  Layers,
  Mail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { useAuth } from "@/lib/auth";
import { ShieldAlert } from "lucide-react";
import { PageHelpButton } from "@/components/help/page-help-button";
import {
  statusConfig,
  type DocumentsResponse,
  type DocumentTypeConfig,
  type DocumentDiscipline,
  type DocumentWithDetails,
  type DocumentBundle,
  type Job,
} from "./types";
import { SendDocumentsEmailDialog } from "./SendDocumentsEmailDialog";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { NewVersionDialog } from "./NewVersionDialog";
import { VersionHistorySheet } from "./VersionHistorySheet";
import { CreateBundleDialog, BundleViewDialog, BundlesListDialog } from "./BundleDialogs";
import { VisualComparisonDialog } from "./VisualComparisonDialog";
import { DocumentTable } from "./DocumentTable";

export default function DocumentRegister() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [showLatestOnly, setShowLatestOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [groupBy, setGroupBy] = useState<string>("job_discipline");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [selectedDocumentForVersion, setSelectedDocumentForVersion] = useState<DocumentWithDetails | null>(null);

  const [versionHistoryDoc, setVersionHistoryDoc] = useState<DocumentWithDetails | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  const [isBundleDialogOpen, setIsBundleDialogOpen] = useState(false);
  const [selectedDocsForBundle, setSelectedDocsForBundle] = useState<string[]>([]);
  const [createdBundle, setCreatedBundle] = useState<DocumentBundle | null>(null);
  const [isBundleViewOpen, setIsBundleViewOpen] = useState(false);
  const [isBundlesListOpen, setIsBundlesListOpen] = useState(false);

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [versionEmailDocs, setVersionEmailDocs] = useState<DocumentWithDetails[]>([]);

  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", "25");
    if (search) params.append("search", search);
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (typeFilter && typeFilter !== "all") params.append("typeId", typeFilter);
    if (disciplineFilter && disciplineFilter !== "all") params.append("disciplineId", disciplineFilter);
    if (jobFilter && jobFilter !== "all") params.append("jobId", jobFilter);
    params.append("showLatestOnly", String(showLatestOnly));
    params.append("excludeChat", "true");
    return params.toString();
  }, [page, search, statusFilter, typeFilter, disciplineFilter, jobFilter, showLatestOnly]);

  const { data: documentsData, isLoading: documentsLoading } = useQuery<DocumentsResponse>({
    queryKey: [DOCUMENT_ROUTES.LIST, page, search, statusFilter, typeFilter, disciplineFilter, jobFilter, showLatestOnly, "excludeChat"],
    queryFn: async () => {
      const response = await fetch(`${DOCUMENT_ROUTES.LIST}?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });

  const { data: documentTypes = [] } = useQuery<DocumentTypeConfig[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE],
  });

  const { data: disciplines = [] } = useQuery<DocumentDiscipline[]>({
    queryKey: [DOCUMENT_ROUTES.DISCIPLINES_ACTIVE],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const isPrivileged = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: myJobMemberships = [] } = useQuery<string[]>({
    queryKey: [JOBS_ROUTES.MY_MEMBERSHIPS],
    enabled: !isPrivileged,
  });

  const isUnauthorizedJob = !isPrivileged && jobFilter && jobFilter !== "all" && !myJobMemberships.includes(jobFilter);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStatusFilter("");
    setTypeFilter("");
    setDisciplineFilter("");
    setJobFilter("");
    setPage(1);
  };

  const documents = documentsData?.documents || [];
  const pagination = documentsData?.pagination;

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const groupedDocuments = useMemo(() => {
    if (groupBy === "none" || groupBy === "job_discipline") return null;

    const groups = new Map<string, { label: string; docs: DocumentWithDetails[]; color?: string | null }>();

    for (const doc of documents) {
      let key = "";
      let label = "";
      let color: string | null | undefined;

      switch (groupBy) {
        case "job":
          key = doc.job?.id || "_unassigned";
          label = doc.job ? `${doc.job.jobNumber} - ${doc.job.name}` : "Unassigned";
          break;
        case "discipline":
          key = doc.discipline?.id || "_unassigned";
          label = doc.discipline?.disciplineName || "Unassigned";
          color = doc.discipline?.color;
          break;
        case "type":
          key = doc.type?.id || "_unassigned";
          label = doc.type ? `${doc.type.prefix} - ${doc.type.typeName}` : "Unassigned";
          break;
        case "category":
          key = doc.category?.id || "_unassigned";
          label = doc.category?.categoryName || "Unassigned";
          break;
        case "status": {
          const dts = doc.documentTypeStatus;
          key = dts?.id || doc.status;
          label = dts?.statusName || statusConfig[doc.status]?.label || doc.status;
          break;
        }
        default:
          key = "_all";
          label = "All Documents";
      }

      if (!groups.has(key)) {
        groups.set(key, { label, docs: [], color });
      }
      groups.get(key)!.docs.push(doc);
    }

    const sorted = Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === "_unassigned") return 1;
      if (keyB === "_unassigned") return -1;
      return a.label.localeCompare(b.label);
    });

    return sorted;
  }, [documents, groupBy]);

  const twoLevelGroupedDocuments = useMemo(() => {
    if (groupBy !== "job_discipline") return null;

    const jobGroups = new Map<string, {
      label: string;
      disciplines: Map<string, { label: string; color?: string | null; docs: DocumentWithDetails[] }>;
      totalCount: number;
    }>();

    for (const doc of documents) {
      const jobKey = doc.job?.id || "_unassigned";
      const jobLabel = doc.job ? `${doc.job.jobNumber} - ${doc.job.name}` : "Unassigned";
      const discKey = doc.discipline?.id || "_unassigned";
      const discLabel = doc.discipline?.disciplineName || "Unassigned";
      const discColor = doc.discipline?.color;

      if (!jobGroups.has(jobKey)) {
        jobGroups.set(jobKey, { label: jobLabel, disciplines: new Map(), totalCount: 0 });
      }
      const jobGroup = jobGroups.get(jobKey)!;
      jobGroup.totalCount++;

      if (!jobGroup.disciplines.has(discKey)) {
        jobGroup.disciplines.set(discKey, { label: discLabel, color: discColor, docs: [] });
      }
      jobGroup.disciplines.get(discKey)!.docs.push(doc);
    }

    const sorted = Array.from(jobGroups.entries())
      .sort(([keyA, a], [keyB, b]) => {
        if (keyA === "_unassigned") return 1;
        if (keyB === "_unassigned") return -1;
        return a.label.localeCompare(b.label);
      })
      .map(([jobKey, jobGroup]) => ({
        jobKey,
        jobLabel: jobGroup.label,
        totalCount: jobGroup.totalCount,
        disciplines: Array.from(jobGroup.disciplines.entries())
          .sort(([keyA, a], [keyB, b]) => {
            if (keyA === "_unassigned") return 1;
            if (keyB === "_unassigned") return -1;
            return a.label.localeCompare(b.label);
          })
          .map(([discKey, discGroup]) => ({
            discKey,
            discLabel: discGroup.label,
            discColor: discGroup.color,
            docs: discGroup.docs,
          })),
      }));

    return sorted;
  }, [documents, groupBy]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((docs: DocumentWithDetails[]) => {
    setSelectedDocIds((prev) => {
      const allIds = docs.map((d) => d.id);
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, []);

  const selectedDocuments = useMemo(() => {
    if (versionEmailDocs.length > 0) return versionEmailDocs;
    return documents.filter((d) => selectedDocIds.has(d.id));
  }, [documents, selectedDocIds, versionEmailDocs]);

  const handleBundleCreated = useCallback((bundle: DocumentBundle) => {
    setCreatedBundle(bundle);
    setIsBundleViewOpen(true);
  }, []);

  const handleEmailSuccess = useCallback(() => {
    setSelectedDocIds(new Set());
    setVersionEmailDocs([]);
  }, []);

  const handleVersionSendEmail = useCallback((doc: any) => {
    setVersionEmailDocs([doc as DocumentWithDetails]);
    setIsEmailDialogOpen(true);
  }, []);

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} documents
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center px-3 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasMore}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="document-register-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Document Register</h1>
              <PageHelpButton pageHelpKey="page.documents" />
            </div>
            <p className="text-muted-foreground">Manage project documents, versions, and bundles</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsBundlesListOpen(true)}
            data-testid="button-view-bundles"
          >
            <Package className="h-4 w-4 mr-2" />
            View Bundles
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIsOverlayDialogOpen(true);
            }}
            disabled={selectedDocIds.size !== 2 || !Array.from(selectedDocIds).every(id => {
              const doc = documents.find(d => d.id === id);
              return doc && (doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/"));
            })}
            data-testid="button-visual-overlay"
          >
            <Layers className="h-4 w-4 mr-2" />
            Compare ({selectedDocIds.size === 2 ? "2" : selectedDocIds.size})
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEmailDialogOpen(true)}
            disabled={selectedDocIds.size === 0}
            data-testid="button-email-documents"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email ({selectedDocIds.size})
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (selectedDocIds.size > 0) {
                setSelectedDocsForBundle(Array.from(selectedDocIds));
              } else {
                setSelectedDocsForBundle([]);
              }
              setIsBundleDialogOpen(true);
            }}
            data-testid="button-create-bundle"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Create Bundle{selectedDocIds.size > 0 ? ` (${selectedDocIds.size})` : ""}
          </Button>
          <Button onClick={() => setIsUploadOpen(true)} data-testid="button-upload-document">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 items-center mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} data-testid="button-search">
              Search
            </Button>
            <div className="flex items-center gap-2 ml-4">
              <Switch
                id="latest-only"
                checked={showLatestOnly}
                onCheckedChange={setShowLatestOnly}
                data-testid="switch-latest-only"
              />
              <Label htmlFor="latest-only" className="text-sm">Latest versions only</Label>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Group by</Label>
              <Select value={groupBy} onValueChange={(v) => { setGroupBy(v); setCollapsedGroups(new Set()); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="job_discipline">Job + Discipline</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="discipline">Discipline</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.slice().sort((a, b) => (a.typeName || '').localeCompare(b.typeName || '')).map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.typeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={disciplineFilter} onValueChange={(v) => { setDisciplineFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-discipline-filter">
                  <SelectValue placeholder="All Disciplines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Disciplines</SelectItem>
                  {disciplines.slice().sort((a, b) => (a.disciplineName || '').localeCompare(b.disciplineName || '')).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.disciplineName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={jobFilter} onValueChange={(v) => { setJobFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]" data-testid="select-job-filter">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
                    <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}

          {isUnauthorizedJob ? (
            <div className="text-center py-12" data-testid="unauthorized-job-message">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">You are currently not authorised to view this job</h3>
              <p className="text-muted-foreground">Contact the administrator for access</p>
            </div>
          ) : documentsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No documents found</h3>
              <p className="text-muted-foreground">Upload your first document to get started</p>
            </div>
          ) : twoLevelGroupedDocuments ? (
            <>
              <div className="space-y-4">
                {twoLevelGroupedDocuments.map((jobGroup) => {
                  const jobCollapsed = collapsedGroups.has(`job:${jobGroup.jobKey}`);
                  return (
                    <div key={jobGroup.jobKey} className="border rounded-md overflow-visible" data-testid={`group-job-${jobGroup.jobKey}`}>
                      <button
                        type="button"
                        className="flex items-center justify-between gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors"
                        onClick={() => toggleGroup(`job:${jobGroup.jobKey}`)}
                        data-testid={`button-toggle-group-job-${jobGroup.jobKey}`}
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${jobCollapsed ? "-rotate-90" : ""}`}
                          />
                          <span className="font-medium">{jobGroup.jobLabel}</span>
                          <Badge variant="secondary">{jobGroup.totalCount}</Badge>
                        </div>
                      </button>
                      {!jobCollapsed && (
                        <div className="border-t">
                          {jobGroup.disciplines.map((discGroup) => {
                            const discCollapsed = collapsedGroups.has(`disc:${jobGroup.jobKey}:${discGroup.discKey}`);
                            return (
                              <div key={discGroup.discKey} data-testid={`group-discipline-${discGroup.discKey}`}>
                                <button
                                  type="button"
                                  className="flex items-center gap-3 w-full pl-8 pr-4 py-2 text-left hover-elevate transition-colors border-b"
                                  onClick={() => toggleGroup(`disc:${jobGroup.jobKey}:${discGroup.discKey}`)}
                                  data-testid={`button-toggle-group-disc-${discGroup.discKey}`}
                                  style={discGroup.discColor ? { backgroundColor: `${discGroup.discColor}15` } : undefined}
                                >
                                  {discGroup.discColor && (
                                    <span
                                      className="inline-block w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: discGroup.discColor }}
                                    />
                                  )}
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${discCollapsed ? "-rotate-90" : ""}`}
                                  />
                                  <span className="text-sm font-medium text-muted-foreground">{discGroup.discLabel}</span>
                                  <Badge variant="secondary">{discGroup.docs.length}</Badge>
                                </button>
                                {!discCollapsed && (
                                  <DocumentTable
                                    documents={discGroup.docs}
                                    selectedDocIds={selectedDocIds}
                                    onToggleDocSelection={toggleDocSelection}
                                    onToggleSelectAll={toggleSelectAll}
                                    onOpenVersionHistory={(doc) => {
                                      setVersionHistoryDoc(doc);
                                      setIsVersionHistoryOpen(true);
                                    }}
                                    onOpenNewVersion={(doc) => {
                                      setSelectedDocumentForVersion(doc);
                                      setIsVersionDialogOpen(true);
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {renderPagination()}
            </>
          ) : groupedDocuments ? (
            <>
              <div className="space-y-4">
                {groupedDocuments.map(([key, { label, docs, color }]) => {
                  const isCollapsed = collapsedGroups.has(key);
                  return (
                    <div key={key} className="border rounded-md overflow-visible" data-testid={`group-${groupBy}-${key}`}>
                      <button
                        type="button"
                        className="flex items-center justify-between gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors"
                        onClick={() => toggleGroup(key)}
                        data-testid={`button-toggle-group-${key}`}
                        style={color ? { backgroundColor: `${color}15` } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          {color && (
                            <span
                              className="inline-block w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                          )}
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                          />
                          <span className="font-medium">{label}</span>
                          <Badge variant="secondary">{docs.length}</Badge>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="border-t">
                          <DocumentTable
                            documents={docs}
                            selectedDocIds={selectedDocIds}
                            onToggleDocSelection={toggleDocSelection}
                            onToggleSelectAll={toggleSelectAll}
                            onOpenVersionHistory={(doc) => {
                              setVersionHistoryDoc(doc);
                              setIsVersionHistoryOpen(true);
                            }}
                            onOpenNewVersion={(doc) => {
                              setSelectedDocumentForVersion(doc);
                              setIsVersionDialogOpen(true);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {renderPagination()}
            </>
          ) : (
            <>
              <DocumentTable
                documents={documents}
                selectedDocIds={selectedDocIds}
                onToggleDocSelection={toggleDocSelection}
                onToggleSelectAll={toggleSelectAll}
                onOpenVersionHistory={(doc) => {
                  setVersionHistoryDoc(doc);
                  setIsVersionHistoryOpen(true);
                }}
                onOpenNewVersion={(doc) => {
                  setSelectedDocumentForVersion(doc);
                  setIsVersionDialogOpen(true);
                }}
              />
              {renderPagination()}
            </>
          )}
        </CardContent>
      </Card>

      {isUploadOpen && (
        <UploadDocumentDialog
          open={isUploadOpen}
          onOpenChange={setIsUploadOpen}
        />
      )}

      {isVersionDialogOpen && (
        <NewVersionDialog
          open={isVersionDialogOpen}
          onOpenChange={setIsVersionDialogOpen}
          document={selectedDocumentForVersion}
        />
      )}

      {isVersionHistoryOpen && (
        <VersionHistorySheet
          open={isVersionHistoryOpen}
          onOpenChange={setIsVersionHistoryOpen}
          document={versionHistoryDoc}
          onSendEmail={handleVersionSendEmail}
        />
      )}

      {isBundleDialogOpen && (
        <CreateBundleDialog
          open={isBundleDialogOpen}
          onOpenChange={setIsBundleDialogOpen}
          documents={documents}
          selectedDocIds={selectedDocIds}
          initialSelectedDocs={selectedDocsForBundle}
          onBundleCreated={handleBundleCreated}
        />
      )}

      {isBundleViewOpen && (
        <BundleViewDialog
          open={isBundleViewOpen}
          onOpenChange={setIsBundleViewOpen}
          bundle={createdBundle}
        />
      )}

      {isBundlesListOpen && (
        <BundlesListDialog
          open={isBundlesListOpen}
          onOpenChange={setIsBundlesListOpen}
        />
      )}

      {isEmailDialogOpen && (
        <SendDocumentsEmailDialog
          open={isEmailDialogOpen}
          onOpenChange={(open) => {
            setIsEmailDialogOpen(open);
            if (!open) setVersionEmailDocs([]);
          }}
          selectedDocuments={selectedDocuments}
          onSuccess={handleEmailSuccess}
        />
      )}

      {isOverlayDialogOpen && (
        <VisualComparisonDialog
          open={isOverlayDialogOpen}
          onOpenChange={setIsOverlayDialogOpen}
          selectedDocIds={selectedDocIds}
          documents={documents}
        />
      )}
    </div>
  );
}
