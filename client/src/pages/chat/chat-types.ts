import type { User, Job, PanelRegister } from "@shared/schema";

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user?: User;
}

export interface Conversation {
  id: string;
  name: string | null;
  type: "DM" | "GROUP" | "CHANNEL";
  topicId: string | null;
  jobId: string | null;
  panelId: string | null;
  createdAt: string;
  createdById?: string;
  members?: ConversationMember[];
  lastMessage?: Message;
  unreadCount?: number;
  unreadMentions?: number;
  job?: Job;
  panel?: PanelRegister;
}

export interface ChatTopic {
  id: string;
  companyId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  createdById: string | null;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
  url?: string;
  fileType?: string;
  fileSize?: number;
  filePath?: string;
}

export interface MessageMention {
  id: string;
  messageId: string;
  userId: string;
  user?: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  sender?: User;
  attachments?: MessageAttachment[];
  mentions?: MessageMention[];
}

export const TOPIC_COLOR_PALETTE = [
  "#ef4444", "#f43f5e", "#e11d48", "#ec4899", "#db2777",
  "#d946ef", "#c026d3", "#a855f7", "#9333ea", "#8b5cf6",
  "#7c3aed", "#6366f1", "#4f46e5", "#3b82f6", "#2563eb",
  "#1d4ed8", "#0ea5e9", "#0284c7", "#06b6d4", "#0891b2",
  "#14b8a6", "#0d9488", "#10b981", "#059669", "#22c55e",
  "#16a34a", "#84cc16", "#65a30d", "#eab308", "#ca8a04",
  "#f59e0b", "#d97706", "#f97316", "#ea580c", "#dc2626",
];
