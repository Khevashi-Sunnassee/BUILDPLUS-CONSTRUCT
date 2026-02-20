import OpenAI from "openai";
import { openAIBreaker } from "../lib/circuit-breaker";
import logger from "../lib/logger";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 64;
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

function getCacheKey(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `emb_${hash}_${text.length}`;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = getCacheKey(text);
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.embedding;
  }

  return openAIBreaker.execute(async () => {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    const embedding = response.data[0].embedding;

    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

    if (embeddingCache.size > 5000) {
      const now = Date.now();
      for (const [key, val] of embeddingCache) {
        if (now - val.timestamp > CACHE_TTL) embeddingCache.delete(key);
      }
    }

    return embedding;
  });
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cacheKey = getCacheKey(texts[i]);
    const cached = embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results[i] = cached.embedding;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i].slice(0, 8000));
    }
  }

  if (uncachedTexts.length === 0) return results;

  for (let batchStart = 0; batchStart < uncachedTexts.length; batchStart += BATCH_SIZE) {
    const batchTexts = uncachedTexts.slice(batchStart, batchStart + BATCH_SIZE);
    const batchIndices = uncachedIndices.slice(batchStart, batchStart + BATCH_SIZE);

    const embeddings = await openAIBreaker.execute(async () => {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batchTexts,
      });
      return response.data.map(d => d.embedding);
    });

    for (let j = 0; j < embeddings.length; j++) {
      const originalIdx = batchIndices[j];
      results[originalIdx] = embeddings[j];

      const cacheKey = getCacheKey(texts[originalIdx]);
      embeddingCache.set(cacheKey, { embedding: embeddings[j], timestamp: Date.now() });
    }

    logger.debug({ batchSize: batchTexts.length, batchStart }, "[KB] Embedding batch completed");
  }

  return results;
}
