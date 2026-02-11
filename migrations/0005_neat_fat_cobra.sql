ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "project_name" text;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "capex_request_id" varchar(36);
