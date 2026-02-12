ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_code_id varchar(36);--> statement-breakpoint
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS child_cost_code_id varchar(36);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cost_code_id_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "public"."cost_codes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_child_cost_code_id_child_cost_codes_id_fk" FOREIGN KEY ("child_cost_code_id") REFERENCES "public"."child_cost_codes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_cost_code_idx" ON "purchase_orders" USING btree ("cost_code_id");
