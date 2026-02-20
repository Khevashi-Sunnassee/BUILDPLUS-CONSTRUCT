import { z } from "zod";
import type { Job, PanelRegister, TrailerType } from "@shared/schema";

export interface LoadListWithDetails {
  id: string;
  jobId: string;
  loadNumber?: string | null;
  trailerTypeId?: string | null;
  docketNumber?: string | null;
  scheduledDate?: string | null;
  notes?: string | null;
  status: string;
  factory: string;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  job: Job;
  trailerType?: TrailerType | null;
  panels: { id: string; loadListId: string; panelId: string; sequence: number; panel: PanelRegister }[];
  deliveryRecord?: DeliveryRecord | null;
  loadReturn?: any;
  createdBy?: { id: string; name: string; email: string } | null;
}

export interface DeliveryRecord {
  id: string;
  loadListId: string;
  docketNumber?: string | null;
  loadDocumentNumber?: string | null;
  truckRego?: string | null;
  trailerRego?: string | null;
  deliveryDate?: string | null;
  preload?: string | null;
  loadNumber?: string | null;
  numberPanels?: number | null;
  comment?: string | null;
  startTime?: string | null;
  leaveDepotTime?: string | null;
  arriveLteTime?: string | null;
  pickupLocation?: string | null;
  pickupArriveTime?: string | null;
  pickupLeaveTime?: string | null;
  deliveryLocation?: string | null;
  arriveHoldingTime?: string | null;
  leaveHoldingTime?: string | null;
  siteFirstLiftTime?: string | null;
  siteLastLiftTime?: string | null;
  returnDepotArriveTime?: string | null;
  totalHours?: string | null;
  enteredById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const loadListSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  trailerTypeId: z.string().optional(),
  factory: z.string().default("QLD"),
  docketNumber: z.string().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
  panelIds: z.array(z.string()).default([]),
});

export const deliverySchema = z.object({
  loadDocumentNumber: z.string().optional(),
  truckRego: z.string().optional(),
  trailerRego: z.string().optional(),
  deliveryDate: z.string().optional(),
  preload: z.string().optional(),
  loadNumber: z.string().optional(),
  numberPanels: z.coerce.number().optional(),
  comment: z.string().optional(),
  leaveDepotTime: z.string().optional(),
  arriveLteTime: z.string().optional(),
  pickupLocation: z.string().optional(),
  pickupArriveTime: z.string().optional(),
  pickupLeaveTime: z.string().optional(),
  deliveryLocation: z.string().optional(),
  arriveHoldingTime: z.string().optional(),
  leaveHoldingTime: z.string().optional(),
  siteFirstLiftTime: z.string().optional(),
  siteLastLiftTime: z.string().optional(),
  returnDepotArriveTime: z.string().optional(),
});

export type LoadListFormData = z.infer<typeof loadListSchema>;
export type DeliveryFormData = z.infer<typeof deliverySchema>;
