CREATE TABLE IF NOT EXISTS "ai_usage_tracking" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "usage_date" varchar(10) NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "last_request_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_unique_user_date_idx" ON "ai_usage_tracking" USING btree ("user_id","usage_date");
CREATE INDEX IF NOT EXISTS "ai_usage_company_date_idx" ON "ai_usage_tracking" USING btree ("company_id","usage_date");

CREATE INDEX IF NOT EXISTS "email_send_logs_status_idx" ON "email_send_logs" USING btree ("company_id","status");
CREATE INDEX IF NOT EXISTS "email_send_logs_sent_at_idx" ON "email_send_logs" USING btree ("company_id","sent_at" DESC);
