import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  Search,
  FileText,
  Image,
  File,
  ChevronLeft,
  Eye,
  Share2,
  Download,
  X,
  Loader2,
  Filter,
  Briefcase,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import { JOBS_ROUTES } from "@shared/api-routes";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Document {
  id: string;
  documentNumber: string | null;
  title: string;
  description: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  version: string;
  revision: string;
  createdAt: string;
  typeId: string | null;
  jobId: string | null;
}

interface DocumentType {
  id: string;
  typeName: string;
  prefix: string;
  color: string | null;
}

interface Job {
  id: number;
  jobNumber: string;
  name: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "APPROVED": return "text-green-400 bg-green-500/20";
    case "DRAFT": return "text-yellow-400 bg-yellow-500/20";
    case "REVIEW": return "text-blue-400 bg-blue-500/20";
    case "SUPERSEDED": return "text-white/40 bg-white/10";
    default: return "text-white/60 bg-white/10";
  }
}

export default function MobileDocumentsPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewingDoc, setViewingDoc] = useState(false);

  const queryPanelId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("panelId");
  }, [searchString]);

  const queryBundleId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("bundleId");
  }, [searchString]);

  const { data: bundleData, isLoading: isBundleLoading } = useQuery<any>({
    queryKey: [DOCUMENT_ROUTES.BUNDLES, queryBundleId],
    queryFn: async () => {
      const res = await fetch(`${DOCUMENT_ROUTES.BUNDLE_BY_ID(queryBundleId!)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bundle");
      return res.json();
    },
    enabled: !!queryBundleId,
  });

  const bundleDocIds = useMemo(() => {
    if (!queryBundleId || !bundleData?.items) return null;
    return new Set(bundleData.items.map((item: any) => item.documentId));
  }, [queryBundleId, bundleData]);

  const docsLimit = queryBundleId ? "200" : "50";
  const { data: docsResult, isLoading } = useQuery<{ documents: Document[]; total: number }>({
    queryKey: [DOCUMENT_ROUTES.LIST, { search: searchQuery, typeId: selectedTypeId, jobId: selectedJobId, panelId: queryPanelId, bundleId: queryBundleId, showLatestOnly: "true", limit: docsLimit }],
    queryFn: async () => {
      const params = new URLSearchParams({ showLatestOnly: "true", limit: docsLimit });
      if (searchQuery) params.set("search", searchQuery);
      if (selectedTypeId) params.set("typeId", selectedTypeId);
      if (selectedJobId) params.set("jobId", selectedJobId);
      if (queryPanelId) params.set("panelId", queryPanelId);
      const res = await fetch(`${DOCUMENT_ROUTES.LIST}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !queryBundleId || !!bundleData,
  });

  const { data: docTypes = [] } = useQuery<DocumentType[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const allDocuments = docsResult?.documents || [];
  const documents = bundleDocIds
    ? allDocuments.filter(d => bundleDocIds.has(d.id))
    : allDocuments;

  const handleView = (doc: Document) => {
    setSelectedDoc(doc);
    setViewingDoc(true);
  };

  const handleShare = async (doc: Document) => {
    const viewUrl = `${window.location.origin}/api/documents/${doc.id}/view`;
    const shareData = {
      title: doc.title,
      text: `Document: ${doc.title}${doc.documentNumber ? ` (${doc.documentNumber})` : ""}`,
      url: viewUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(viewUrl);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({ title: "Failed to share document", variant: "destructive" });
      }
    }
  };

  const handleDownload = (doc: Document) => {
    const link = document.createElement("a");
    link.href = `/api/documents/${doc.id}/download`;
    link.download = doc.originalName;
    link.click();
  };

  if (viewingDoc && selectedDoc) {
    const FileIcon = getFileIcon(selectedDoc.mimeType);
    const isViewable = selectedDoc.mimeType.includes("pdf") || selectedDoc.mimeType.startsWith("image/");
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => { setViewingDoc(false); setSelectedDoc(null); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-from-doc-view"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">{selectedDoc.title}</div>
              {selectedDoc.documentNumber && (
                <div className="text-xs text-white/60">{selectedDoc.documentNumber}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {isViewable ? (
            <iframe
              src={`/api/documents/${selectedDoc.id}/view`}
              className="flex-1 w-full bg-white"
              title={selectedDoc.title}
              data-testid="doc-viewer-iframe"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <FileIcon className="h-16 w-16 text-white/40 mb-4" />
              <p className="text-white/60 text-center mb-2">{selectedDoc.originalName}</p>
              <p className="text-white/40 text-sm mb-6">{formatFileSize(selectedDoc.fileSize)}</p>
              <p className="text-white/40 text-sm text-center">This file type cannot be previewed. Use the buttons below to download or share.</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-white/10 bg-[#0D1117] px-4 py-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
          <div className="flex gap-3">
            <button
              onClick={() => handleShare(selectedDoc)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-medium active:scale-[0.99]"
              data-testid="button-share-doc"
            >
              <Share2 className="h-5 w-5" />
              Share
            </button>
            <button
              onClick={() => handleDownload(selectedDoc)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/10 text-white font-medium active:scale-[0.99]"
              data-testid="button-download-doc"
            >
              <Download className="h-5 w-5" />
              Download
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                if (queryPanelId) setLocation(`/mobile/panels/${queryPanelId}`);
                else if (queryBundleId) setLocation("/mobile/scan");
                else setLocation("/mobile/more");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-to-more"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="text-2xl font-bold">{queryPanelId ? "Panel Documents" : queryBundleId ? "Bundle Documents" : "Documents"}</div>
              {queryPanelId && (
                <p className="text-xs text-white/50">Showing drawings for this panel</p>
              )}
              {queryBundleId && bundleData && (
                <p className="text-xs text-white/50">{bundleData.bundleName}</p>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-blue-400/50"
              data-testid="input-search-documents"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4 text-white/40" />
              </button>
            )}
          </div>
        </div>
      </div>

      {(docTypes.length > 0 || jobs.length > 0) && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-white/10 space-y-2">
          {jobs.length > 0 && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
              <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  onClick={() => setSelectedJobId(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                    selectedJobId === null
                      ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                  data-testid="filter-all-jobs"
                >
                  All Jobs
                </button>
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(selectedJobId === String(job.id) ? null : String(job.id))}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                      selectedJobId === String(job.id)
                        ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                        : "bg-white/5 border-white/10 text-white/60"
                    }`}
                    data-testid={`filter-job-${job.id}`}
                  >
                    {job.jobNumber}
                  </button>
                ))}
              </div>
            </div>
          )}
          {docTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
              <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  onClick={() => setSelectedTypeId(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                    selectedTypeId === null
                      ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                  data-testid="filter-all-types"
                >
                  All Types
                </button>
                {docTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedTypeId(selectedTypeId === type.id ? null : type.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                      selectedTypeId === type.id
                        ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                        : "bg-white/5 border-white/10 text-white/60"
                    }`}
                    data-testid={`filter-type-${type.id}`}
                  >
                    {type.typeName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">
              {searchQuery ? "No documents match your search" : "No documents available"}
            </p>
          </div>
        ) : (
          documents.map((doc) => {
            const FileIcon = getFileIcon(doc.mimeType);
            const statusColor = getStatusColor(doc.status);
            return (
              <button
                key={doc.id}
                onClick={() => handleView(doc)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
                data-testid={`doc-item-${doc.id}`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 flex-shrink-0">
                  <FileIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{doc.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.documentNumber && (
                      <span className="text-xs text-white/40">{doc.documentNumber}</span>
                    )}
                    <span className="text-xs text-white/40">{formatFileSize(doc.fileSize)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                    {doc.status}
                  </span>
                  <span className="text-[10px] text-white/30">v{doc.version}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
