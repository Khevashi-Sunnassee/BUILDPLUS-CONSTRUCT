import { z } from "zod";
import { CheckCircle, Clock, History, Package } from "lucide-react";
import type {
  Document,
  DocumentTypeConfig,
  DocumentDiscipline,
  DocumentCategory,
  DocumentTypeStatus,
  DocumentWithDetails,
  Job,
  PanelRegister,
  Supplier,
  PurchaseOrder,
  Task,
} from "@shared/schema";

export const uploadFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  documentNumber: z.string().optional(),
  revision: z.string().optional(),
  description: z.string().optional(),
  typeId: z.string().optional(),
  disciplineId: z.string().optional(),
  categoryId: z.string().optional(),
  documentTypeStatusId: z.string().optional(),
  jobId: z.string().optional(),
  panelId: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  taskId: z.string().optional(),
  tags: z.string().optional(),
  isConfidential: z.boolean().default(false),
});

export type UploadFormValues = z.infer<typeof uploadFormSchema>;

export const bundleFormSchema = z.object({
  bundleName: z.string().min(1, "Bundle name is required"),
  description: z.string().optional(),
  allowGuestAccess: z.boolean().default(true),
  expiresAt: z.string().optional(),
});

export type BundleFormValues = z.infer<typeof bundleFormSchema>;

export interface DocumentBundle {
  id: string;
  bundleName: string;
  description: string | null;
  qrCodeId: string;
  jobId: string | null;
  supplierId: string | null;
  allowGuestAccess: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    documentId: string;
    document?: DocumentWithDetails;
    addedAt: string;
  }>;
}

export interface DocumentsResponse {
  documents: DocumentWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  REVIEW: { label: "In Review", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  SUPERSEDED: { label: "Superseded", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: History },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: Package },
};

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type {
  Document,
  DocumentTypeConfig,
  DocumentDiscipline,
  DocumentCategory,
  DocumentTypeStatus,
  DocumentWithDetails,
  Job,
  PanelRegister,
  Supplier,
  PurchaseOrder,
  Task,
};
