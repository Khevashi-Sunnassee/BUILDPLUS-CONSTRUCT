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
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#2563eb", "#7c3aed", "#c026d3",
  "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
  "#4f46e5", "#9333ea", "#db2777", "#dc2626", "#d97706",
  "#65a30d", "#059669", "#0d9488", "#0284c7", "#1d4ed8",
];
