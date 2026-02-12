import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  Package,
  FolderOpen,
  FileText,
  Eye,
  Download,
  Trash2,
  Plus,
  Copy,
  ExternalLink,
  Search,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DOCUMENT_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { Checkbox } from "@/components/ui/checkbox";
import {
  formatDate,
  formatFileSize,
  statusConfig,
  type DocumentBundle,
  type DocumentsResponse,
  type Job,
} from "./types";

export function BundleGridView() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [tendersOnly, setTendersOnly] = useState(false);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const [deleteBundleDialogOpen, setDeleteBundleDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<DocumentBundle | null>(null);
  const [addingFilesBundle, setAddingFilesBundle] = useState<string | null>(null);
  const [addFilesSearch, setAddFilesSearch] = useState("");
  const [selectedNewDocs, setSelectedNewDocs] = useState<Set<string>>(new Set());

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery<DocumentBundle[]>({
    queryKey: [DOCUMENT_ROUTES.BUNDLES],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const addFilesQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.append("page", "1");
    params.append("limit", "50");
    params.append("showLatestOnly", "true");
    params.append("excludeChat", "true");
    if (addFilesSearch) params.append("search", addFilesSearch);
    return params.toString();
  }, [addFilesSearch]);

  const { data: allDocsData } = useQuery<DocumentsResponse>({
    queryKey: [`${DOCUMENT_ROUTES.LIST}?${addFilesQueryString}`],
    enabled: !!addingFilesBundle,
  });

  const availableDocs = allDocsData?.documents || [];

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      await apiRequest("DELETE", DOCUMENT_ROUTES.BUNDLE_BY_ID(bundleId), {});
    },
    onSuccess: () => {
      toast({ title: "Bundle deleted" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
      setDeleteBundleDialogOpen(false);
      setBundleToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeDocMutation = useMutation({
    mutationFn: async ({ bundleId, documentId }: { bundleId: string; documentId: string }) => {
      await apiRequest("DELETE", DOCUMENT_ROUTES.BUNDLE_REMOVE_DOCUMENT(bundleId, documentId), {});
    },
    onSuccess: () => {
      toast({ title: "Document removed from bundle" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addDocumentsMutation = useMutation({
    mutationFn: async ({ bundleId, documentIds }: { bundleId: string; documentIds: string[] }) => {
      await apiRequest("POST", DOCUMENT_ROUTES.BUNDLE_ADD_DOCUMENTS(bundleId), { documentIds });
    },
    onSuccess: () => {
      toast({ title: "Documents added to bundle" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
      setAddingFilesBundle(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const toggleBundle = useCallback((bundleId: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) {
        next.delete(bundleId);
      } else {
        next.add(bundleId);
      }
      return next;
    });
  }, []);

  const filteredBundles = useMemo(() => {
    let result = bundles;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (b) =>
          b.bundleName.toLowerCase().includes(term) ||
          (b.description && b.description.toLowerCase().includes(term))
      );
    }

    if (jobFilter && jobFilter !== "all") {
      result = result.filter((b) => b.jobId === jobFilter);
    }

    if (tendersOnly) {
      result = result.filter((b) =>
        b.bundleName.toLowerCase().startsWith("tender package")
      );
    }

    return result;
  }, [bundles, searchTerm, jobFilter, tendersOnly]);

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setJobFilter("");
    setTendersOnly(false);
  };

  const copyBundleLink = (bundle: DocumentBundle) => {
    navigator.clipboard.writeText(`${window.location.origin}/bundle/${bundle.qrCodeId}`);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  };

  if (bundlesLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="bundle-grid-view">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bundles..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
            data-testid="input-bundle-search"
          />
        </div>
        <Button variant="outline" onClick={handleSearch} data-testid="button-bundle-search">
          Search
        </Button>

        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-bundle-job-filter">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs
              .slice()
              .sort((a, b) => (a.jobNumber || "").localeCompare(b.jobNumber || ""))
              .map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.jobNumber} - {job.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Button
          variant={tendersOnly ? "default" : "outline"}
          onClick={() => setTendersOnly(!tendersOnly)}
          data-testid="button-tenders-only"
        >
          <Package className="h-4 w-4 mr-2" />
          Tenders Only
        </Button>

        {(searchTerm || jobFilter || tendersOnly) && (
          <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-bundle-filters">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredBundles.length} bundle{filteredBundles.length !== 1 ? "s" : ""}
        </div>
      </div>

      {filteredBundles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No bundles found</p>
          <p className="text-sm mt-1">
            {bundles.length === 0
              ? "Create a bundle to share documents via QR code"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBundles.map((bundle) => {
            const isExpanded = expandedBundles.has(bundle.id);
            const isTender = bundle.bundleName.toLowerCase().startsWith("tender package");
            const isExpired = bundle.expiresAt && new Date(bundle.expiresAt) < new Date();

            return (
              <div
                key={bundle.id}
                className="border rounded-md overflow-visible"
                data-testid={`bundle-grid-row-${bundle.id}`}
              >
                <button
                  type="button"
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors"
                  onClick={() => toggleBundle(bundle.id)}
                  data-testid={`button-expand-bundle-${bundle.id}`}
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                      isExpanded ? "" : "-rotate-90"
                    }`}
                  />
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{bundle.bundleName}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {bundle.items?.length || 0} files
                  </Badge>
                  {isTender && (
                    <Badge variant="outline" className="shrink-0 text-blue-600 dark:text-blue-400">
                      Tender
                    </Badge>
                  )}
                  {bundle.allowGuestAccess ? (
                    <Badge variant="outline" className="shrink-0 text-green-600 dark:text-green-400">
                      Guest
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-yellow-600 dark:text-yellow-400">
                      Restricted
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive" className="shrink-0">
                      Expired
                    </Badge>
                  )}
                  {bundle.description && (
                    <span className="text-sm text-muted-foreground truncate hidden md:inline">
                      {bundle.description}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto shrink-0">
                    {formatDate(bundle.createdAt)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyBundleLink(bundle);
                          }}
                          data-testid={`button-copy-bundle-link-${bundle.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy share link</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/bundle/${bundle.qrCodeId}`, "_blank");
                          }}
                          data-testid={`button-open-bundle-link-${bundle.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open bundle page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBundleToDelete(bundle);
                            setDeleteBundleDialogOpen(true);
                          }}
                          data-testid={`button-delete-bundle-${bundle.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete bundle</TooltipContent>
                    </Tooltip>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-10">Document</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bundle.items?.length > 0 ? (
                          bundle.items.map((item) => {
                            const doc = item.document;
                            return (
                              <TableRow
                                key={item.id}
                                data-testid={`bundle-child-doc-${item.id}`}
                              >
                                <TableCell className="pl-10">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex flex-col">
                                      <span className="font-medium text-sm">
                                        {doc?.title || "Unknown Document"}
                                      </span>
                                      {doc?.originalName && (
                                        <span className="text-xs text-muted-foreground">
                                          {doc.originalName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-sm">
                                    v{(doc as any)?.version || "1"}
                                    {(doc as any)?.revision || ""}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatFileSize((doc as any)?.fileSize)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {formatDate(item.addedAt)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1">
                                    {doc && (
                                      <>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() =>
                                            window.open(
                                              DOCUMENT_ROUTES.VIEW(doc.id),
                                              "_blank"
                                            )
                                          }
                                          title="View"
                                          data-testid={`button-view-bundle-doc-${item.id}`}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => {
                                            const link = document.createElement("a");
                                            link.href = DOCUMENT_ROUTES.DOWNLOAD(doc.id);
                                            link.download = (doc as any).originalName || "download";
                                            link.click();
                                          }}
                                          title="Download"
                                          data-testid={`button-download-bundle-doc-${item.id}`}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        removeDocMutation.mutate({
                                          bundleId: bundle.id,
                                          documentId: item.documentId,
                                        })
                                      }
                                      title="Remove from bundle"
                                      data-testid={`button-remove-bundle-doc-${item.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center text-muted-foreground py-6"
                            >
                              No documents in this bundle
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell colSpan={5} className="pl-10">
                            {addingFilesBundle === bundle.id ? (
                              <div className="space-y-3 py-2" data-testid={`add-files-panel-${bundle.id}`}>
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Search documents to add..."
                                      value={addFilesSearch}
                                      onChange={(e) => setAddFilesSearch(e.target.value)}
                                      className="pl-10"
                                      data-testid={`input-add-files-search-${bundle.id}`}
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    disabled={selectedNewDocs.size === 0 || addDocumentsMutation.isPending}
                                    onClick={() => {
                                      addDocumentsMutation.mutate({
                                        bundleId: bundle.id,
                                        documentIds: Array.from(selectedNewDocs),
                                      });
                                    }}
                                    data-testid={`button-confirm-add-files-${bundle.id}`}
                                  >
                                    {addDocumentsMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4 mr-2" />
                                    )}
                                    Add {selectedNewDocs.size > 0 ? `(${selectedNewDocs.size})` : ""}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setAddingFilesBundle(null);
                                      setAddFilesSearch("");
                                      setSelectedNewDocs(new Set());
                                    }}
                                    data-testid={`button-cancel-add-files-${bundle.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="border rounded-md max-h-48 overflow-y-auto">
                                  {availableDocs.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground py-4">
                                      No documents found
                                    </div>
                                  ) : (
                                    <Table>
                                      <TableBody>
                                        {availableDocs
                                          .filter((d) => !bundle.items?.some((i) => i.documentId === d.id))
                                          .map((doc) => (
                                            <TableRow
                                              key={doc.id}
                                              className="cursor-pointer hover-elevate"
                                              onClick={() => {
                                                setSelectedNewDocs((prev) => {
                                                  const next = new Set(prev);
                                                  if (next.has(doc.id)) {
                                                    next.delete(doc.id);
                                                  } else {
                                                    next.add(doc.id);
                                                  }
                                                  return next;
                                                });
                                              }}
                                              data-testid={`row-add-doc-${doc.id}`}
                                            >
                                              <TableCell className="w-10">
                                                <Checkbox
                                                  checked={selectedNewDocs.has(doc.id)}
                                                  data-testid={`checkbox-add-doc-${doc.id}`}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <div className="flex items-center gap-2">
                                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                  <span className="text-sm font-medium">{doc.title}</span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {doc.documentNumber || "-"}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                v{doc.version}{doc.revision || ""}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAddingFilesBundle(bundle.id);
                                  setAddFilesSearch("");
                                  setSelectedNewDocs(new Set());
                                }}
                                data-testid={`button-add-files-bundle-${bundle.id}`}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Files
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteBundleDialogOpen} onOpenChange={setDeleteBundleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{bundleToDelete?.bundleName}&quot;? This will not delete the
              documents themselves, only the bundle grouping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bundleToDelete) {
                  deleteBundleMutation.mutate(bundleToDelete.id);
                }
              }}
              data-testid="button-confirm-delete-bundle"
            >
              {deleteBundleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
