import { z } from "zod";
import type { PurchaseOrder, PurchaseOrderItem, User, PurchaseOrderAttachment } from "@shared/schema";
import { formatCurrency } from "@/lib/format";
export { formatCurrency };

export interface AttachmentWithUser extends PurchaseOrderAttachment {
  uploadedBy?: User | null;
}

export interface LineItem {
  id: string;
  itemId: string | null;
  itemCode: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
  lineTotal: string;
  costCodeId: string | null;
  jobId: string | null;
  jobNumber?: string;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  requestedBy: User;
  approvedBy?: User | null;
  rejectedBy?: User | null;
  items: PurchaseOrderItem[];
}

export const MANUAL_ENTRY_ID = "MANUAL_ENTRY";

export const formSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  supplierContact: z.string().optional(),
  supplierEmail: z.string().email().optional().or(z.literal("")),
  supplierPhone: z.string().optional(),
  supplierAddress: z.string().optional(),
  projectName: z.string().optional(),
  deliveryAddress: z.string().optional(),
  requiredByDate: z.date().optional().nullable(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
