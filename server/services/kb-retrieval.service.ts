import { db } from "../db";
import { kbChunks, kbDocuments, kbMessages, kbConversations } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { generateEmbedding } from "./kb-embedding.service";
import logger from "../lib/logger";

const TOP_K = 8;
const MIN_SIMILARITY = 0.3;

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
  metadata: { section?: string; headings?: string[] } | null;
}

export async function searchKnowledgeBase(
  query: string,
  companyId: string,
  projectId?: string,
  topK: number = TOP_K
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const conditions = [
    sql`c.company_id = ${companyId}`,
    sql`c.embedding IS NOT NULL`,
  ];

  if (projectId) {
    conditions.push(sql`c.project_id = ${projectId}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const results = await db.execute(sql`
    SELECT
      c.id,
      c.content,
      c.document_id,
      c.metadata,
      d.title as document_title,
      1 - (c.embedding <=> ${embeddingStr}::vector) as similarity
    FROM kb_chunks c
    JOIN kb_documents d ON d.id = c.document_id
    WHERE ${whereClause}
      AND 1 - (c.embedding <=> ${embeddingStr}::vector) > ${MIN_SIMILARITY}
    ORDER BY c.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  return (results.rows as any[]).map(row => ({
    id: row.id,
    content: row.content,
    documentId: row.document_id,
    documentTitle: row.document_title,
    similarity: parseFloat(row.similarity),
    metadata: row.metadata,
  }));
}

function sanitizeChunkContent(content: string): string {
  let sanitized = content;
  let filtered = false;

  const patterns: [RegExp, string][] = [
    [/^(system|assistant|user)\s*:/gim, '[role reference]:'],
    [/ignore\s+(all\s+)?previous\s+instructions/gi, '[filtered]'],
    [/forget\s+(all\s+)?(your\s+)?instructions/gi, '[filtered]'],
    [/you\s+are\s+now\s+a/gi, '[filtered]'],
    [/act\s+as\s+(if\s+you\s+are\s+)?a/gi, '[filtered]'],
    [/pretend\s+(to\s+be|you\s+are)/gi, '[filtered]'],
    [/disregard\s+(all\s+)?(previous\s+)?/gi, '[filtered]'],
    [/override\s+(your\s+)?(instructions|rules|system)/gi, '[filtered]'],
  ];

  for (const [pattern, replacement] of patterns) {
    const result = sanitized.replace(pattern, replacement);
    if (result !== sanitized) {
      filtered = true;
      sanitized = result;
    }
  }

  if (filtered) {
    logger.warn("[KB] Prompt injection pattern detected and sanitized in document chunk content");
  }

  return sanitized;
}

export function buildRAGContext(chunks: RetrievedChunk[], mode: "KB_ONLY" | "HYBRID"): string {
  if (chunks.length === 0) {
    if (mode === "KB_ONLY") {
      return "No relevant information was found in the knowledge base for this question.";
    }
    return "";
  }

  const contextParts = chunks.map((chunk, i) => {
    const source = chunk.documentTitle || "Unknown Document";
    const section = chunk.metadata?.section ? ` > ${chunk.metadata.section}` : "";
    const sanitizedContent = sanitizeChunkContent(chunk.content);
    return `[Source ${i + 1}: ${source}${section}]\n${sanitizedContent}`;
  });

  return contextParts.join("\n\n---\n\n");
}

export function buildSystemPrompt(mode: "KB_ONLY" | "HYBRID", context: string, projectName?: string, projectInstructions?: string): string {
  const kbName = projectName || "Knowledge Base";
  const instructionsBlock = projectInstructions
    ? `\n\nPROJECT INSTRUCTIONS (follow these carefully):\n${projectInstructions}\n`
    : "";

  if (mode === "KB_ONLY") {
    return `You are a helpful AI assistant that answers questions ONLY based on the provided knowledge base context from "${kbName}".${instructionsBlock}

IMPORTANT RULES:
- Only answer based on the provided context below
- If the answer is not found in the context, clearly state that the information is not available in the knowledge base
- Always cite which source document you are referencing
- Be precise and factual
- Format your responses clearly with markdown when appropriate

KNOWLEDGE BASE CONTEXT:
${context}`;
  }

  if (context) {
    return `You are a helpful AI assistant. You have access to a knowledge base called "${kbName}" and your general knowledge.${instructionsBlock}

When answering questions:
- First check the provided knowledge base context for relevant information
- If the context contains relevant information, prioritize it and cite the source
- You may supplement with your general knowledge where appropriate
- Clearly distinguish between information from the knowledge base and your general knowledge
- Format your responses clearly with markdown when appropriate

KNOWLEDGE BASE CONTEXT:
${context}`;
  }

  return `You are a helpful AI assistant. You have access to a knowledge base called "${kbName}" but no relevant documents were found for this query.${instructionsBlock} Answer using your general knowledge and let the user know that no specific documents matched their question.`;
}

export async function getConversationHistory(
  conversationId: string,
  limit: number = 20
): Promise<Array<{ role: "user" | "assistant" | "system"; content: string }>> {
  const messages = await db
    .select({ role: kbMessages.role, content: kbMessages.content })
    .from(kbMessages)
    .where(eq(kbMessages.conversationId, conversationId))
    .orderBy(desc(kbMessages.createdAt))
    .limit(limit);

  return messages.reverse().map(m => ({
    role: m.role.toLowerCase() as "user" | "assistant" | "system",
    content: m.content,
  }));
}

export async function getProjectThreadContext(
  projectId: string,
  excludeConversationId: string,
  maxThreads: number = 5,
  maxMessagesPerThread: number = 4
): Promise<string> {
  try {
    const otherConvos = await db
      .select({ id: kbConversations.id, title: kbConversations.title })
      .from(kbConversations)
      .where(and(
        eq(kbConversations.projectId, projectId),
        sql`${kbConversations.id} != ${excludeConversationId}`
      ))
      .orderBy(desc(kbConversations.updatedAt))
      .limit(maxThreads);

    if (otherConvos.length === 0) return "";

    const threadSummaries: string[] = [];
    for (const convo of otherConvos) {
      const recentMessages = await db
        .select({ role: kbMessages.role, content: kbMessages.content })
        .from(kbMessages)
        .where(eq(kbMessages.conversationId, convo.id))
        .orderBy(desc(kbMessages.createdAt))
        .limit(maxMessagesPerThread);

      if (recentMessages.length === 0) continue;

      const msgSummary = recentMessages.reverse().map(m => {
        const truncated = m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content;
        return `  ${m.role}: ${truncated}`;
      }).join("\n");

      threadSummaries.push(`Thread "${convo.title}":\n${msgSummary}`);
    }

    if (threadSummaries.length === 0) return "";

    return `PROJECT THREAD CONTEXT (other conversations in this project that may provide relevant context):\n\n${threadSummaries.join("\n\n")}`;
  } catch (error) {
    logger.warn({ err: error, projectId }, "[KB] Failed to get project thread context");
    return "";
  }
}
