import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import logger from "./lib/logger";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
});

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
