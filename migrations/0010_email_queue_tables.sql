DO $$ BEGIN
  CREATE TYPE "email_queue_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "email_queue_jobs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" varchar NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "type" varchar(50) NOT NULL,
  "reference_id" varchar(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "email_queue_status" NOT NULL DEFAULT 'PENDING',
  "priority" integer NOT NULL DEFAULT 0,
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "next_retry_at" timestamp
);

CREATE TABLE IF NOT EXISTS "email_dead_letters" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "original_job_id" varchar(255) NOT NULL,
  "company_id" varchar NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "type" varchar(50) NOT NULL,
  "reference_id" varchar(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "error" text NOT NULL,
  "attempts" integer NOT NULL,
  "failed_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "resolved_by" varchar REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "email_queue_status_idx" ON "email_queue_jobs" ("status");
CREATE INDEX IF NOT EXISTS "email_queue_company_idx" ON "email_queue_jobs" ("company_id");
CREATE INDEX IF NOT EXISTS "email_queue_status_priority_idx" ON "email_queue_jobs" ("status", "priority");
CREATE INDEX IF NOT EXISTS "email_queue_next_retry_idx" ON "email_queue_jobs" ("next_retry_at");
CREATE INDEX IF NOT EXISTS "email_queue_reference_idx" ON "email_queue_jobs" ("reference_id");
CREATE INDEX IF NOT EXISTS "email_dead_letters_company_idx" ON "email_dead_letters" ("company_id");
CREATE INDEX IF NOT EXISTS "email_dead_letters_resolved_idx" ON "email_dead_letters" ("resolved_at");
CREATE INDEX IF NOT EXISTS "email_dead_letters_failed_at_idx" ON "email_dead_letters" ("failed_at");
