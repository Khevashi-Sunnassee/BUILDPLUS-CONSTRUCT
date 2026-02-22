import {
  MessageSquare,
  Users,
  Hash,
  Briefcase,
  ClipboardList,
  Image,
  FileText,
  File,
} from "lucide-react";
import { createElement } from "react";
import type { Conversation } from "./chat-types";

export function getConversationDisplayName(conv: Conversation): string {
  if (conv.name) return conv.name;
  if (conv.jobId && conv.job) return `Job: ${conv.job.jobNumber}`;
  if (conv.panelId && conv.panel) return `Panel: ${conv.panel.panelMark}`;
  if (conv.type === "DM" && conv.members) {
    const otherMembers = conv.members.filter(m => m.user);
    return otherMembers.map(m => m.user?.name || m.user?.email).join(", ");
  }
  return "Conversation";
}

export function getConversationIcon(conv: Conversation) {
  const iconClass = "h-4 w-4";
  if (conv.jobId) return createElement(Briefcase, { className: iconClass });
  if (conv.panelId) return createElement(ClipboardList, { className: iconClass });
  switch (conv.type) {
    case "DM": return createElement(MessageSquare, { className: iconClass });
    case "GROUP": return createElement(Users, { className: iconClass });
    case "CHANNEL": return createElement(Hash, { className: iconClass });
    default: return createElement(Hash, { className: iconClass });
  }
}

export function getFileIcon(fileType: string) {
  const iconClass = "h-4 w-4";
  if (fileType.startsWith("image/")) return createElement(Image, { className: iconClass });
  if (fileType.includes("pdf")) return createElement(FileText, { className: iconClass });
  return createElement(File, { className: iconClass });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(name?: string | null, email?: string): string {
  if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return email?.slice(0, 2).toUpperCase() || "?";
}
