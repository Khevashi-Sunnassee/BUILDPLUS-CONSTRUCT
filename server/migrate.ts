import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import logger from "./lib/logger";

export async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const migrationPool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 30000,
    statement_timeout: 120000,
  });

  try {
    const db = drizzle(migrationPool);
    logger.info("Running database migrations...");
    await migrate(db, { migrationsFolder: "./migrations" });
    logger.info("Database migrations completed successfully");
  } catch (error) {
    logger.error({ err: error }, "Database migration failed");
    throw error;
  } finally {
    await migrationPool.end();
  }
}
