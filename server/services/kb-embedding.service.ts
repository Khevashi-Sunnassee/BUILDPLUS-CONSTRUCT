import OpenAI from "openai";
import { openAIBreaker } from "../lib/circuit-breaker";
import logger from "../lib/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 64;
const CACHE_MAX_SIZE = 5000;
const CACHE_TTL = 30 * 60 * 1000;

class LRUEmbeddingCache {
  private cache = new Map<string, { embedding: number[]; timestamp: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): number[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.embedding;
  }

  set(key: string, embedding: number[]): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { embedding, timestamp: Date.now() });
  }

  get size(): number {
    return this.cache.size;
  }
}

const embeddingCache = new LRUEmbeddingCache(CACHE_MAX_SIZE, CACHE_TTL);

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
  if (cached) return cached;

  return openAIBreaker.execute(async () => {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    const embedding = response.data[0].embedding;
    embeddingCache.set(cacheKey, embedding);
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
    if (cached) {
      results[i] = cached;
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
      embeddingCache.set(cacheKey, embeddings[j]);
    }

    logger.debug({ batchSize: batchTexts.length, batchStart }, "[KB] Embedding batch completed");
  }

  return results;
}
