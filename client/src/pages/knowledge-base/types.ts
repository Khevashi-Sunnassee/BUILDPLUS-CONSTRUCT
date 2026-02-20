export interface KbProject {
  id: string;
  name: string;
  description: string | null;
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
