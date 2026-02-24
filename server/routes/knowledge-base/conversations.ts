import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "../../db";
import {
  kbProjects, kbConversations, kbMessages, aiUsageTracking,
  kbProjectMembers, kbConversationMembers,
} from "@shared/schema";
import { eq, and, desc, sql, count, or, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import { searchKnowledgeBase, buildRAGContext, buildSystemPrompt, getConversationHistory, getProjectThreadContext } from "../../services/kb-retrieval.service";
import { searchHelpEntries, buildHelpContext } from "../../seed-kb-help";
import { openAIBreaker } from "../../lib/circuit-breaker";
import logger from "../../lib/logger";
import { getConversationAccess } from "./shared";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.get("/api/kb/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const projectId = req.query.projectId as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const sharedConvoIds = await db.select({ conversationId: kbConversationMembers.conversationId })
      .from(kbConversationMembers)
      .where(and(eq(kbConversationMembers.userId, String(userId)), eq(kbConversationMembers.status, "ACCEPTED")));

    const sharedProjectIds = await db.select({ projectId: kbProjectMembers.projectId })
      .from(kbProjectMembers)
      .where(and(eq(kbProjectMembers.userId, String(userId)), eq(kbProjectMembers.status, "ACCEPTED")));

    const convoMemberIds = sharedConvoIds.map(c => c.conversationId);
    const projectMemberIds = sharedProjectIds.map(p => p.projectId);

    const accessConditions = [eq(kbConversations.createdById, String(userId))];
    if (convoMemberIds.length > 0) accessConditions.push(inArray(kbConversations.id, convoMemberIds));
    if (projectMemberIds.length > 0) accessConditions.push(inArray(kbConversations.projectId, projectMemberIds));

    const baseConditions = [
      eq(kbConversations.companyId, String(companyId)),
      or(...accessConditions)!,
    ];
    if (projectId) baseConditions.push(eq(kbConversations.projectId, String(projectId)));

    const [totalResult] = await db.select({ count: count() })
      .from(kbConversations)
      .where(and(...baseConditions));

    const convos = await db
      .select()
      .from(kbConversations)
      .where(and(...baseConditions))
      .orderBy(desc(kbConversations.updatedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: convos,
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch conversations");
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/api/kb/conversations", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const { title, projectId } = req.body;

    const [convo] = await db.insert(kbConversations).values({
      companyId: String(companyId),
      projectId: projectId || null,
      title: title?.trim() || "New Chat",
      createdById: String(userId),
    }).returning();

    res.status(201).json(convo);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.patch("/api/kb/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    const { title } = req.body;
    const [updated] = await db.update(kbConversations)
      .set({ title: title?.trim() || "New Chat", updatedAt: new Date() })
      .where(and(eq(kbConversations.id, String(req.params.id)), eq(kbConversations.companyId, String(companyId))))
      .returning();

    if (!updated) return res.status(404).json({ error: "Conversation not found" });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to update conversation");
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

router.delete("/api/kb/conversations/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    if (!companyId) return res.status(403).json({ error: "Company context required" });

    await db.delete(kbConversations)
      .where(and(eq(kbConversations.id, String(req.params.id)), eq(kbConversations.companyId, String(companyId))));

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/api/kb/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const access = await getConversationAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });

    const messages = await db
      .select()
      .from(kbMessages)
      .where(and(
        eq(kbMessages.conversationId, String(req.params.id)),
        eq(kbMessages.companyId, String(companyId))
      ))
      .orderBy(kbMessages.createdAt)
      .limit(200);

    res.json(messages);
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to fetch messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/api/kb/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(403).json({ error: "Auth required" });

    const { content, mode } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Message content is required" });
    if (content.length > 10000) return res.status(400).json({ error: "Message too long (max 10,000 characters)" });

    const answerMode = mode === "HYBRID" ? "HYBRID" : "KB_ONLY";

    const access = await getConversationAccess(String(userId), String(req.params.id), String(companyId));
    if (!access.hasAccess) return res.status(403).json({ error: "Access denied" });
    if (access.role === "VIEWER") return res.status(403).json({ error: "Viewer access does not allow sending messages" });

    const [convo] = await db.select()
      .from(kbConversations)
      .where(and(eq(kbConversations.id, String(req.params.id)), eq(kbConversations.companyId, String(companyId))));

    if (!convo) return res.status(404).json({ error: "Conversation not found" });

    const today = new Date().toISOString().slice(0, 10);
    const [usage] = await db.select()
      .from(aiUsageTracking)
      .where(and(eq(aiUsageTracking.userId, String(userId)), eq(aiUsageTracking.usageDate, today)))
      .limit(1);

    const MAX_DAILY_REQUESTS = 200;
    if (usage && usage.requestCount >= MAX_DAILY_REQUESTS) {
      return res.status(429).json({ error: `Daily AI request limit reached (${MAX_DAILY_REQUESTS}). Try again tomorrow.` });
    }

    const monthStart = today.slice(0, 7) + "-01";
    const MAX_MONTHLY_TOKENS_PER_COMPANY = 1_000_000;
    const [monthlyUsage] = await db.execute(sql`
      SELECT COALESCE(SUM(total_tokens), 0)::int AS total_tokens
      FROM ai_usage_tracking
      WHERE company_id = ${companyId} AND usage_date >= ${monthStart}
    `) as any[];
    if (monthlyUsage && monthlyUsage.total_tokens >= MAX_MONTHLY_TOKENS_PER_COMPANY) {
      return res.status(429).json({ error: "Monthly AI token budget exceeded for your company. Contact your administrator." });
    }

    try {
      await db.execute(sql`
        INSERT INTO ai_usage_tracking (id, company_id, user_id, usage_date, request_count, total_tokens, last_request_at)
        VALUES (gen_random_uuid(), ${companyId}, ${userId}, ${today}, 1, 0, NOW())
        ON CONFLICT (user_id, usage_date)
        DO UPDATE SET request_count = ai_usage_tracking.request_count + 1, last_request_at = NOW()
      `);
    } catch (quotaErr) {
      logger.error({ err: quotaErr }, "[KB] Failed to update AI usage tracking — blocking request");
      return res.status(500).json({ error: "Unable to verify usage quota. Please try again." });
    }

    await db.insert(kbMessages).values({
      companyId: String(companyId),
      conversationId: convo.id,
      role: "USER",
      content: content.trim(),
      mode: answerMode,
    });

    const chunks = await searchKnowledgeBase(content.trim(), String(companyId), convo.projectId || undefined);
    const context = buildRAGContext(chunks, answerMode);

    const helpResults = await searchHelpEntries(content.trim());
    const helpContext = buildHelpContext(helpResults);

    let projectName: string | undefined;
    let projectInstructions: string | undefined;
    let threadContext = "";
    if (convo.projectId) {
      const [proj] = await db.select({ name: kbProjects.name, instructions: kbProjects.instructions })
        .from(kbProjects)
        .where(eq(kbProjects.id, convo.projectId));
      projectName = proj?.name;
      projectInstructions = proj?.instructions || undefined;
      threadContext = await getProjectThreadContext(convo.projectId, convo.id);
    }

    const fullContext = [context, helpContext, threadContext].filter(Boolean).join("\n\n---\n\n");
    const systemPrompt = buildSystemPrompt(answerMode, fullContext, projectName, projectInstructions);
    const history = await getConversationHistory(convo.id, 16);

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-14),
      { role: "user", content: content.trim() },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";
    const sourceChunkIds = chunks.map(c => c.id);
    let clientDisconnected = false;

    req.on("close", () => {
      clientDisconnected = true;
    });

    try {
      const stream = await openAIBreaker.execute(async () => {
        return openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: chatMessages,
          stream: true,
          stream_options: { include_usage: true },
          max_completion_tokens: 4096,
          temperature: 0.3,
        });
      });

      let streamUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

      for await (const chunk of stream as any) {
        if (clientDisconnected) break;
        const delta = chunk.choices?.[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
        if (chunk.usage) {
          streamUsage = chunk.usage;
        }
      }

      const tokensUsed = streamUsage?.total_tokens || (fullResponse.length > 0 ? Math.ceil(fullResponse.length / 3.5) : 0);
      if (tokensUsed > 0) {
        try {
          await db.execute(sql`
            UPDATE ai_usage_tracking
            SET total_tokens = ai_usage_tracking.total_tokens + ${tokensUsed}
            WHERE user_id = ${userId} AND usage_date = ${today}
          `);
        } catch (tokenErr) {
          logger.error({ err: tokenErr }, "[KB] Failed to update token usage");
        }
      }

      await db.insert(kbMessages).values({
        companyId: String(companyId),
        conversationId: convo.id,
        role: "ASSISTANT",
        content: fullResponse,
        mode: answerMode,
        sourceChunkIds,
      });

      const sources = chunks.map(c => ({
        id: c.id,
        documentTitle: c.documentTitle,
        section: c.metadata?.section,
        similarity: Math.round(c.similarity * 100),
      }));

      res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);

      if (history.length <= 1) {
        const shortTitle = content.trim().slice(0, 60) + (content.trim().length > 60 ? "..." : "");
        await db.update(kbConversations)
          .set({ title: shortTitle, updatedAt: new Date() })
          .where(eq(kbConversations.id, convo.id));

        res.write(`data: ${JSON.stringify({ titleUpdate: shortTitle })}\n\n`);
      } else {
        await db.update(kbConversations)
          .set({ updatedAt: new Date() })
          .where(eq(kbConversations.id, convo.id));
      }

      res.end();
    } catch (streamError: any) {
      logger.error({ err: streamError }, "[KB] Streaming error");
      const isRateLimit = streamError?.status === 429 || streamError?.message?.includes("rate limit");
      const isAuthError = streamError?.status === 401 || streamError?.status === 403;
      let userMessage = "AI service temporarily unavailable. Please try again.";
      if (isRateLimit) {
        userMessage = "AI service is currently busy. Please wait a moment and try again.";
      } else if (isAuthError) {
        userMessage = "AI service configuration error. Please contact your administrator.";
      }
      if (!res.headersSent) {
        res.status(isRateLimit ? 429 : 500).json({ error: userMessage });
      } else {
        res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    logger.error({ err: error }, "[KB] Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
});

export { router as conversationsRouter };
