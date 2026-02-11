import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import logger from "./lib/logger";

export async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const migrationPool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: 30000,
      statement_timeout: 120000,
    });

    try {
      const db = drizzle(migrationPool);
      logger.info(`Running database migrations (attempt ${attempt}/${maxRetries})...`);
      await migrate(db, { migrationsFolder: "./migrations" });
      logger.info("Database migrations completed successfully");
      return;
    } catch (error: any) {
      logger.error({ err: error, attempt }, `Database migration attempt ${attempt}/${maxRetries} failed`);
      if (attempt >= maxRetries) {
        throw error;
      }
      logger.info(`Retrying migration in 3 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      await migrationPool.end().catch(() => {});
    }
  }
}
