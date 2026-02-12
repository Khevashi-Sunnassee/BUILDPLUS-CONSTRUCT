import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import logger from "./lib/logger";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 100,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  statement_timeout: 60000,
  allowExitOnIdle: false,
});

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isTransient =
        err instanceof Error &&
        (err.message.includes("connection terminated") ||
          err.message.includes("Connection terminated") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("ETIMEDOUT") ||
          err.message.includes("too many clients") ||
          err.message.includes("remaining connection slots"));

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      logger.warn(
        { attempt, maxAttempts, error: err instanceof Error ? err.message : String(err) },
        `Transient DB error — retrying in ${delayMs * attempt}ms`
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("withRetry: unreachable");
}

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database pool error — client will be removed from pool");
});

let poolConnectionCount = 0;
pool.on("connect", () => {
  poolConnectionCount++;
  if (poolConnectionCount <= 5) {
    logger.debug(`Database pool connection #${poolConnectionCount} established`);
  }
});

export { pool };
export const db = drizzle(pool, { schema });
