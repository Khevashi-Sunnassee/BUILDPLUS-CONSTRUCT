export interface KbProject {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  color: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbDocument {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface KbConversation {
  id: string;
  projectId: string | null;
  title: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  mode: "KB_ONLY" | "HYBRID" | null;
  sourceChunkIds: string[] | null;
  createdAt: string;
}

export interface KbSource {
  id: string;
  documentTitle: string;
  section?: string;
  similarity: number;
}

export type AnswerMode = "KB_ONLY" | "HYBRID";

export interface KbMember {
  id: string;
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  status: "INVITED" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  userName: string;
  userEmail: string;
}

export interface KbCompanyUser {
  id: string;
  name: string;
  email: string;
}

export interface KbProjectDetail extends KbProject {
  documents: KbDocument[];
  members: KbMember[];
  userRole: string;
}

export interface KbInvitation {
  id: string;
  type: "project" | "conversation";
  entityId: string;
  role: string;
  status: string;
  createdAt: string;
  projectName?: string;
  conversationTitle?: string;
}
