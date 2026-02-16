import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
  File,
  Mail,
} from "lucide-react";

export function getFileIcon(mimeType: string | null, fileName?: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  const mime = (mimeType || "").toLowerCase();

  if (mime.includes("pdf") || ext === "pdf")
    return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","svg","bmp","webp","tiff"].includes(ext))
    return <FileImage className="h-5 w-5 text-purple-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || ["xls","xlsx","csv"].includes(ext))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (mime.includes("word") || mime.includes("document") || ["doc","docx","rtf"].includes(ext))
    return <FileText className="h-5 w-5 text-blue-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint") || ["ppt","pptx"].includes(ext))
    return <FileText className="h-5 w-5 text-orange-500" />;
  if (mime.startsWith("video/") || ["mp4","mov","avi","mkv","wmv","webm"].includes(ext))
    return <FileVideo className="h-5 w-5 text-pink-500" />;
  if (mime.startsWith("audio/") || ["mp3","wav","ogg","aac","flac"].includes(ext))
    return <FileAudio className="h-5 w-5 text-yellow-600" />;
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("archive") || ["zip","rar","7z","tar","gz"].includes(ext))
    return <FileArchive className="h-5 w-5 text-amber-600" />;
  if (["dwg","dxf","rvt","ifc","skp"].includes(ext))
    return <FileCode className="h-5 w-5 text-teal-500" />;
  if (mime.includes("text") || ["txt","log","md"].includes(ext))
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  if (["eml","msg"].includes(ext))
    return <Mail className="h-5 w-5 text-blue-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface EntitySidebarRoutes {
  UPDATES: (id: string | number) => string;
  UPDATE_BY_ID: (id: string | number) => string;
  FILES: (id: string | number) => string;
  FILE_BY_ID: (id: string | number) => string;
  EMAIL_DROP: (id: string | number) => string;
}

export interface SidebarUpdate {
  id: string;
  content: string;
  contentType?: string | null;
  emailSubject?: string | null;
  emailFrom?: string | null;
  emailTo?: string | null;
  emailDate?: string | null;
  emailBody?: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  files?: SidebarFile[];
}

export interface SidebarFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedById: string | null;
  updateId: string | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string | null; email: string } | null;
}
