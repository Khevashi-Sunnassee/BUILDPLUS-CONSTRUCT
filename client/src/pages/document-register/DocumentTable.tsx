import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload,
  Download,
  Eye,
  Plus,
  History,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCode,
  File,
  FileVideo,
  FileAudio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { DocumentWithDetails } from "./types";
import { statusConfig, formatFileSize, formatDate } from "./types";

function getFileTypeIcon(mimeType: string | null | undefined, originalName: string | null | undefined) {
  const mime = (mimeType || "").toLowerCase();
  const ext = (originalName || "").split(".").pop()?.toLowerCase() || "";

  if (mime === "application/pdf" || ext === "pdf") {
    return { Icon: FileText, color: "text-red-500", label: "PDF" };
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    ["xlsx", "xls", "csv"].includes(ext)
  ) {
    return { Icon: FileSpreadsheet, color: "text-green-600", label: "Spreadsheet" };
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    ["doc", "docx", "rtf"].includes(ext)
  ) {
    return { Icon: FileText, color: "text-blue-500", label: "Document" };
  }
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    ["ppt", "pptx"].includes(ext)
  ) {
    return { Icon: FileText, color: "text-orange-500", label: "Presentation" };
  }
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff"].includes(ext)) {
    return { Icon: FileImage, color: "text-purple-500", label: "Image" };
  }
  if (mime.startsWith("video/") || ["mp4", "avi", "mov", "mkv", "wmv"].includes(ext)) {
    return { Icon: FileVideo, color: "text-pink-500", label: "Video" };
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "flac", "aac", "ogg"].includes(ext)) {
    return { Icon: FileAudio, color: "text-yellow-600", label: "Audio" };
  }
  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("archive") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return { Icon: FileArchive, color: "text-amber-600", label: "Archive" };
  }
  if (
    mime.includes("dwg") ||
    mime.includes("autocad") ||
    mime.includes("ifc") ||
    ["dwg", "dxf", "ifc", "rvt", "skp"].includes(ext)
  ) {
    return { Icon: FileCode, color: "text-cyan-600", label: "CAD" };
  }
  if (
    mime.includes("text") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    ["txt", "json", "xml", "html", "css", "js", "ts"].includes(ext)
  ) {
    return { Icon: FileCode, color: "text-muted-foreground", label: "Text" };
  }
  return { Icon: File, color: "text-muted-foreground", label: "File" };
}

interface DocumentTableProps {
  documents: DocumentWithDetails[];
  selectedDocIds: Set<string>;
  onToggleDocSelection: (docId: string) => void;
  onToggleSelectAll: (docs: DocumentWithDetails[]) => void;
  onOpenVersionHistory: (doc: DocumentWithDetails) => void;
  onOpenNewVersion: (doc: DocumentWithDetails) => void;
}

export function DocumentTable({
  documents,
  selectedDocIds,
  onToggleDocSelection,
  onToggleSelectAll,
  onOpenVersionHistory,
  onOpenNewVersion,
}: DocumentTableProps) {
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", DOCUMENT_ROUTES.STATUS(id), { status });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Status updated" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const renderDocumentRow = useCallback((doc: DocumentWithDetails) => {
    const legacyStatus = statusConfig[doc.status] || statusConfig.DRAFT;
    const StatusIcon = legacyStatus.icon;
    const docTypeStatus = doc.documentTypeStatus;
    const fileType = getFileTypeIcon(doc.mimeType, doc.originalName);

    return (
      <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
        <TableCell className="w-10">
          <Checkbox
            checked={selectedDocIds.has(doc.id)}
            onCheckedChange={() => onToggleDocSelection(doc.id)}
            data-testid={`checkbox-doc-${doc.id}`}
          />
        </TableCell>
        <TableCell className="w-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <div data-testid={`icon-filetype-${doc.id}`}>
                <fileType.Icon className={`h-5 w-5 ${fileType.color}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent>{fileType.label}</TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{doc.title}</span>
            <span className="text-xs text-muted-foreground">{doc.originalName}</span>
          </div>
        </TableCell>
        <TableCell>
          {doc.documentNumber ? (
            <span className="font-mono text-sm" data-testid={`text-doc-number-${doc.id}`}>{doc.documentNumber}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm" data-testid={`text-revision-${doc.id}`}>{doc.revision || "-"}</span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            {doc.type && <Badge variant="outline" className="w-fit">{doc.type.prefix}</Badge>}
            {doc.discipline && <Badge variant="secondary" className="w-fit text-xs">{doc.discipline.shortForm || doc.discipline.disciplineName}</Badge>}
          </div>
        </TableCell>
        <TableCell>
          {doc.job ? (
            <span className="text-sm">{doc.job.jobNumber} - {doc.job.name}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm">v{doc.version}{doc.revision || ""}</span>
        </TableCell>
        <TableCell>
          {docTypeStatus ? (
            <Badge
              variant="outline"
              className="w-fit border"
              style={{ backgroundColor: `${docTypeStatus.color}20`, borderColor: docTypeStatus.color, color: docTypeStatus.color }}
              data-testid={`badge-status-${doc.id}`}
            >
              <div className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0" style={{ backgroundColor: docTypeStatus.color }} />
              {docTypeStatus.statusName}
            </Badge>
          ) : (
            <Badge className={legacyStatus.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {legacyStatus.label}
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatFileSize(doc.fileSize)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(doc.createdAt)}
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => window.open(DOCUMENT_ROUTES.VIEW(doc.id), "_blank")}
              title="View"
              data-testid={`button-view-${doc.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const link = document.createElement("a");
                link.href = DOCUMENT_ROUTES.DOWNLOAD(doc.id);
                link.download = doc.originalName;
                link.click();
              }}
              title="Download"
              data-testid={`button-download-${doc.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenVersionHistory(doc)}
              title="Version History"
              data-testid={`button-history-${doc.id}`}
            >
              <History className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-actions-${doc.id}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onOpenNewVersion(doc)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Version
                </DropdownMenuItem>
                {doc.status === "DRAFT" && (
                  <DropdownMenuItem
                    onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "REVIEW" })}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Submit for Review
                  </DropdownMenuItem>
                )}
                {doc.status === "REVIEW" && (
                  <>
                    <DropdownMenuItem
                      onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "APPROVED" })}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "DRAFT" })}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Return to Draft
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  }, [updateStatusMutation, selectedDocIds, onToggleDocSelection, onOpenVersionHistory, onOpenNewVersion]);

  const allIds = documents.map((d) => d.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedDocIds.has(id));
  const someSelected = allIds.some((id) => selectedDocIds.has(id)) && !allSelected;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as unknown as HTMLInputElement).indeterminate = someSelected;
                }
              }}
              onCheckedChange={() => onToggleSelectAll(documents)}
              data-testid="checkbox-select-all"
            />
          </TableHead>
          <TableHead className="w-10"></TableHead>
          <TableHead>Document</TableHead>
          <TableHead>Doc No.</TableHead>
          <TableHead>Rev</TableHead>
          <TableHead>Type / Discipline</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => renderDocumentRow(doc))}
      </TableBody>
    </Table>
  );
}
