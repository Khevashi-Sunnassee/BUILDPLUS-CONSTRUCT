import { z } from "zod";
import type { Job, PanelRegister } from "@shared/schema";

export const panelSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  panelMark: z.string().min(1, "Panel mark is required"),
  panelType: z.string().min(1, "Panel type is required"),
  description: z.string().optional(),
  drawingCode: z.string().optional(),
  sheetNumber: z.string().optional(),
  building: z.string().optional(),
  level: z.string().optional(),
  structuralElevation: z.string().optional(),
  reckliDetail: z.string().optional(),
  estimatedHours: z.number().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "PENDING"]),
  loadWidth: z.string().optional(),
  loadHeight: z.string().optional(),
  panelThickness: z.string().optional(),
  panelVolume: z.string().optional(),
  panelMass: z.string().optional(),
  qty: z.number().optional(),
  concreteStrengthMpa: z.string().optional(),
  workTypeId: z.number().optional(),
});

export type PanelFormData = z.infer<typeof panelSchema>;

export const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("en-AU");
};

export interface PanelWithJob extends PanelRegister {
  job: Job;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: User | null;
}

export interface PanelConversation {
  id: string;
  name: string | null;
  type: string;
  panelId: string | null;
  jobId: string | null;
  members: ConversationMember[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: User | null;
  attachments: Array<{ id: string; fileName: string; url: string; mimeType: string }>;
  mentions: Array<{ id: string; mentionedUserId: string; user: User | null }>;
}

export const COMMON_EMOJIS = [
  "\u{1F600}", "\u{1F602}", "\u{1F60A}", "\u{1F642}", "\u{1F60D}", "\u{1F914}", "\u{1F62E}", "\u{1F622}", "\u{1F621}", "\u{1F44D}",
  "\u{1F44E}", "\u{1F44F}", "\u{1F64C}", "\u{1F4AA}", "\u{1F389}", "\u{1F525}", "\u2B50", "\u2764\uFE0F", "\u{1F4AF}", "\u2705",
  "\u274C", "\u26A0\uFE0F", "\u{1F4CC}", "\u{1F4CE}", "\u{1F527}", "\u{1F528}", "\u{1F4D0}", "\u{1F4CF}", "\u{1F3D7}\uFE0F", "\u{1F9F1}",
];

export type PanelDocument = {
  id: string;
  title: string;
  documentNumber?: string | null;
  status: string;
  version: string;
  revision: string;
  mimeType: string;
  fileSize: number;
  originalName: string;
  isLatestVersion: boolean;
  createdAt: string;
  uploadedBy: string;
  uploadedByName?: string;
};

export type DocumentsResponse = {
  documents: PanelDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const DOC_STATUS_COLORS: Record<string, string> = {
  PRELIM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  IFA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IFC: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  SUPERSEDED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  ARCHIVED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export interface PaginatedResponse {
  panels: PanelWithJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkType {
  id: number;
  name: string;
  description: string | null;
}

export const sourceLabels: Record<number, string> = {
  1: "Manual",
  2: "Excel Template",
  3: "Estimate",
};

export const getSourceLabel = (source: number) => sourceLabels[source] || "Unknown";

export interface BuildFormData {
  loadWidth: string;
  loadHeight: string;
  panelThickness: string;
  panelVolume: string;
  panelMass: string;
  panelArea: string;
  liftFcm: string;
  concreteStrengthMpa: string;
  rotationalLifters: string;
  primaryLifters: string;
  productionPdfUrl: string;
}

export interface ConsolidationPanel {
  id: string;
  panelMark: string;
  loadWidth: string | null;
  loadHeight: string | null;
  level: string | null;
}

export interface ConsolidationData {
  primaryPanelId: string;
  panels: ConsolidationPanel[];
  newPanelMark: string;
  newWidth: string;
  newHeight: string;
}

export interface ConsolidationWarning {
  panelMark: string;
  draftingLogs: number;
  timerSessions: number;
  loadListEntries: number;
  lifecycleStatus: number;
}
