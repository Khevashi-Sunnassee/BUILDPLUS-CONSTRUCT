import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ImageIcon,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronDown,
  Layers,
  Mail,
  MessageSquare,
  Download,
  Eye,
  Loader2,
  CheckSquare,
  Square,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DOCUMENT_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { useAuth } from "@/lib/auth";
import { ShieldAlert } from "lucide-react";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  statusConfig,
  formatDate,
  formatFileSize,
  type DocumentsResponse,
  type DocumentTypeConfig,
  type DocumentDiscipline,
  type DocumentWithDetails,
  type Job,
} from "./document-register/types";
import { SendDocumentsEmailDialog } from "./document-register/SendDocumentsEmailDialog";

function ThumbnailCard({
  doc,
  isSelected,
  onToggleSelect,
  onViewFullscreen,
  onDelete,
}: {
  doc: DocumentWithDetails;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewFullscreen: (doc: DocumentWithDetails) => void;
  onDelete: (doc: DocumentWithDetails) => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const thumbnailUrl = DOCUMENT_ROUTES.THUMBNAIL(doc.id);
  const downloadUrl = DOCUMENT_ROUTES.DOWNLOAD(doc.id);

  return (
    <Card
      className={`group relative transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
      data-testid={`photo-card-${doc.id}`}
    >
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(doc.id)}
          className="bg-background/80 backdrop-blur-sm"
          data-testid={`checkbox-photo-${doc.id}`}
        />
      </div>
      <div
        className="aspect-square overflow-hidden rounded-t-md cursor-pointer relative bg-muted"
        onClick={() => onViewFullscreen(doc)}
        data-testid={`button-view-photo-${doc.id}`}
      >
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mb-1" />
            <span className="text-xs">Failed to load</span>
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt={doc.title}
            className={`w-full h-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Eye className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-sm font-medium truncate" data-testid={`text-photo-title-${doc.id}`}>
          {doc.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {doc.job && (
            <Badge variant="outline" className="text-xs">
              {doc.job.jobNumber}
            </Badge>
          )}
          {doc.conversationId && (
            <Badge variant="secondary" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Chat
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
          <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
        </div>
        <div className="flex gap-1 mt-2 invisible group-hover:visible">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onViewFullscreen(doc); }}
            data-testid={`button-fullscreen-${doc.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            asChild
            data-testid={`button-download-${doc.id}`}
          >
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
            data-testid={`button-delete-photo-${doc.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FullscreenViewer({
  doc,
  open,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDelete,
}: {
  doc: DocumentWithDetails | null;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDelete: (doc: DocumentWithDetails) => void;
}) {
  if (!doc) return null;
  const viewUrl = DOCUMENT_ROUTES.VIEW(doc.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden" data-testid="fullscreen-viewer">
        <DialogTitle className="sr-only">{doc.title}</DialogTitle>
        <DialogDescription className="sr-only">Full-size photo viewer</DialogDescription>
        <div className="flex flex-col h-[90vh]">
          <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium truncate" data-testid="text-viewer-title">{doc.title}</h3>
              <p className="text-sm text-muted-foreground">{doc.originalName} - {formatFileSize(doc.fileSize)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={!hasPrev}
                onClick={onPrev}
                data-testid="button-viewer-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                disabled={!hasNext}
                onClick={onNext}
                data-testid="button-viewer-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                asChild
                data-testid="button-viewer-download"
              >
                <a href={DOCUMENT_ROUTES.DOWNLOAD(doc.id)} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => onDelete(doc)}
                data-testid="button-viewer-delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-muted/50 overflow-auto p-4">
            <img
              src={viewUrl}
              alt={doc.title}
              style={{ imageOrientation: "from-image" }}
              className="max-w-full max-h-full object-contain"
              data-testid="img-viewer-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PhotoGallery() {
  useDocumentTitle("Photo Gallery");
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("job");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [excludeChat, setExcludeChat] = useState(false);

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentWithDetails | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentWithDetails | null>(null);
  const { toast } = useToast();

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", "48");
    params.append("mimeTypePrefix", "image/");
    if (search) params.append("search", search);
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (typeFilter && typeFilter !== "all") params.append("typeId", typeFilter);
    if (disciplineFilter && disciplineFilter !== "all") params.append("disciplineId", disciplineFilter);
    if (jobFilter && jobFilter !== "all") params.append("jobId", jobFilter);
    if (excludeChat) params.append("excludeChat", "true");
    params.append("showLatestOnly", "true");
    return params.toString();
  }, [page, search, statusFilter, typeFilter, disciplineFilter, jobFilter, excludeChat]);

  const { data: photosData, isLoading } = useQuery<DocumentsResponse>({
    queryKey: [DOCUMENT_ROUTES.LIST, "photos", page, search, statusFilter, typeFilter, disciplineFilter, jobFilter, excludeChat],
    queryFn: async () => {
      const response = await fetch(`${DOCUMENT_ROUTES.LIST}?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch photos");
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

  const photos = photosData?.documents || [];
  const pagination = photosData?.pagination;

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const groupedPhotos = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<string, { label: string; docs: DocumentWithDetails[] }>();

    for (const doc of photos) {
      let key = "";
      let label = "";

      switch (groupBy) {
        case "job":
          key = doc.job?.id || "_unassigned";
          label = doc.job ? `${doc.job.jobNumber} - ${doc.job.name}` : "Unassigned";
          break;
        case "discipline":
          key = doc.discipline?.id || "_unassigned";
          label = doc.discipline?.disciplineName || "Unassigned";
          break;
        case "type":
          key = doc.type?.id || "_unassigned";
          label = doc.type ? `${doc.type.prefix} - ${doc.type.typeName}` : "Unassigned";
          break;
        case "status": {
          const dts = doc.documentTypeStatus;
          key = dts?.id || doc.status;
          label = dts?.statusName || statusConfig[doc.status]?.label || doc.status;
          break;
        }
        default:
          key = "_all";
          label = "All Photos";
      }

      if (!groups.has(key)) groups.set(key, { label, docs: [] });
      groups.get(key)!.docs.push(doc);
    }

    return Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === "_unassigned") return 1;
      if (keyB === "_unassigned") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [photos, groupBy]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
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

  const selectedDocuments = photos.filter((d) => selectedDocIds.has(d.id));

  const openViewer = useCallback((doc: DocumentWithDetails) => {
    setViewerDoc(doc);
    setIsViewerOpen(true);
  }, []);

  const viewerIndex = viewerDoc ? photos.findIndex((p) => p.id === viewerDoc.id) : -1;
  const navigateViewer = useCallback(
    (direction: 1 | -1) => {
      const newIndex = viewerIndex + direction;
      if (newIndex >= 0 && newIndex < photos.length) {
        setViewerDoc(photos[newIndex]);
      }
    },
    [viewerIndex, photos]
  );

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", DOCUMENT_ROUTES.BY_ID(docId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      setDeleteTarget(null);
      setIsViewerOpen(false);
      toast({ title: "Photo deleted", description: "The image has been removed." });
    },
    onError: () => {
      toast({ title: "Delete failed", description: "Could not delete the photo. Please try again.", variant: "destructive" });
    },
  });

  const handleDeleteRequest = useCallback((doc: DocumentWithDetails) => {
    setDeleteTarget(doc);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const renderGrid = (docs: DocumentWithDetails[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {docs.map((doc) => (
        <ThumbnailCard
          key={doc.id}
          doc={doc}
          isSelected={selectedDocIds.has(doc.id)}
          onToggleSelect={toggleDocSelection}
          onViewFullscreen={openViewer}
          onDelete={handleDeleteRequest}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="photo-gallery-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ImageIcon className="h-8 w-8 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Photo Gallery</h1>
              <PageHelpButton pageHelpKey="page.photo-gallery" />
            </div>
            <p className="text-muted-foreground">Browse and manage project photos</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          {selectedDocIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => toggleSelectAll(photos)}
              data-testid="button-deselect-all"
            >
              <X className="h-4 w-4 mr-2" />
              Deselect All
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => toggleSelectAll(photos)}
            data-testid="button-select-all"
          >
            {photos.length > 0 && photos.every((p) => selectedDocIds.has(p.id)) ? (
              <CheckSquare className="h-4 w-4 mr-2" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            Select All
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEmailDialogOpen(true)}
            disabled={selectedDocIds.size === 0}
            data-testid="button-email-photos"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email ({selectedDocIds.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 items-center mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search photos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
                data-testid="input-search-photos"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} data-testid="button-search-photos">
              Search
            </Button>

            <div className="flex items-center gap-2 ml-4">
              <Switch
                id="exclude-chat"
                checked={excludeChat}
                onCheckedChange={(v) => { setExcludeChat(v); setPage(1); }}
                data-testid="switch-exclude-chat"
              />
              <Label htmlFor="exclude-chat" className="text-sm whitespace-nowrap">
                <MessageSquare className="h-3.5 w-3.5 inline-block mr-1" />
                Exclude chat photos
              </Label>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Group by</Label>
              <Select value={groupBy} onValueChange={(v) => { setGroupBy(v); setCollapsedGroups(new Set()); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="discipline">Discipline</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-md">
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
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No photos found</h3>
              <p className="text-muted-foreground">
                {excludeChat
                  ? "Upload images through the Document Register, or toggle 'Exclude chat photos' to see chat attachments"
                  : "No image files found in the document register"}
              </p>
            </div>
          ) : groupedPhotos ? (
            <div className="space-y-6">
              {groupedPhotos.map(([key, { label, docs }]) => {
                const isCollapsed = collapsedGroups.has(key);
                return (
                  <div key={key} data-testid={`group-${groupBy}-${key}`}>
                    <button
                      type="button"
                      className="flex items-center gap-3 w-full px-2 py-2 text-left hover-elevate transition-colors rounded-md mb-3"
                      onClick={() => toggleGroup(key)}
                      data-testid={`button-toggle-group-${key}`}
                    >
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                      <span className="font-medium">{label}</span>
                      <Badge variant="secondary">{docs.length}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={(e) => { e.stopPropagation(); toggleSelectAll(docs); }}
                        data-testid={`button-select-group-${key}`}
                      >
                        {docs.every((d) => selectedDocIds.has(d.id)) ? (
                          <CheckSquare className="h-4 w-4 mr-1" />
                        ) : (
                          <Square className="h-4 w-4 mr-1" />
                        )}
                        Select
                      </Button>
                    </button>
                    {!isCollapsed && renderGrid(docs)}
                  </div>
                );
              })}
            </div>
          ) : (
            renderGrid(photos)
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} photos
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
          )}
        </CardContent>
      </Card>

      <FullscreenViewer
        doc={viewerDoc}
        open={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        onPrev={() => navigateViewer(-1)}
        onNext={() => navigateViewer(1)}
        hasPrev={viewerIndex > 0}
        hasNext={viewerIndex < photos.length - 1}
        onDelete={handleDeleteRequest}
      />

      <SendDocumentsEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        selectedDocuments={selectedDocuments}
        onSuccess={() => setSelectedDocIds(new Set())}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This will permanently remove the image. If this photo was shared in chat, it will show as "Image removed".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
