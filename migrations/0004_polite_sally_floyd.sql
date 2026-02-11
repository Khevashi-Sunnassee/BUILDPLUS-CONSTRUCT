CREATE TYPE "public"."capex_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "capex_audit_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_request_id" varchar(36) NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" varchar(36) NOT NULL,
	"actor_name" text,
	"metadata" json,
	"correlation_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capex_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"capex_number" text NOT NULL,
	"status" "capex_status" DEFAULT 'DRAFT' NOT NULL,
	"job_id" varchar(36),
	"project_name" text,
	"department_id" varchar(36),
	"proposed_asset_manager_id" varchar(36),
	"approving_manager_id" varchar(36),
	"equipment_title" text NOT NULL,
	"equipment_category" text,
	"equipment_description" text,
	"purchase_reasons" json DEFAULT '[]'::json,
	"is_replacement" boolean DEFAULT false,
	"replacement_asset_id" varchar(36),
	"replacement_reason" text,
	"total_equipment_cost" numeric(14, 2) DEFAULT '0',
	"transportation_cost" numeric(14, 2),
	"insurance_cost" numeric(14, 2),
	"monthly_maintenance_cost" numeric(14, 2),
	"monthly_resource_cost" numeric(14, 2),
	"additional_costs" numeric(14, 2),
	"expected_payback_period" text,
	"expected_resource_savings" text,
	"risk_analysis" text,
	"expected_useful_life" text,
	"preferred_supplier_id" varchar(36),
	"alternative_suppliers" text,
	"equipment_location" text,
	"factory_id" varchar(36),
	"factory_zone" text,
	"proximity_to_input_materials" text,
	"site_readiness" text,
	"new_workflow_description" text,
	"safety_considerations" text,
	"purchase_order_id" varchar(36),
	"requested_by_id" varchar(36) NOT NULL,
	"requested_date" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"approved_by_id" varchar(36),
	"approved_at" timestamp,
	"rejected_by_id" varchar(36),
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "capex_approver" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "capex_approval_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "capex_audit_events" ADD CONSTRAINT "capex_audit_events_capex_request_id_capex_requests_id_fk" FOREIGN KEY ("capex_request_id") REFERENCES "public"."capex_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_audit_events" ADD CONSTRAINT "capex_audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_proposed_asset_manager_id_users_id_fk" FOREIGN KEY ("proposed_asset_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_approving_manager_id_users_id_fk" FOREIGN KEY ("approving_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_replacement_asset_id_assets_id_fk" FOREIGN KEY ("replacement_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_preferred_supplier_id_suppliers_id_fk" FOREIGN KEY ("preferred_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capex_requests" ADD CONSTRAINT "capex_requests_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capex_audit_events_capex_idx" ON "capex_audit_events" USING btree ("capex_request_id");--> statement-breakpoint
CREATE INDEX "capex_audit_events_type_idx" ON "capex_audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "capex_requests_number_company_idx" ON "capex_requests" USING btree ("capex_number","company_id");--> statement-breakpoint
CREATE INDEX "capex_requests_status_idx" ON "capex_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "capex_requests_requested_by_idx" ON "capex_requests" USING btree ("requested_by_id");--> statement-breakpoint
CREATE INDEX "capex_requests_company_idx" ON "capex_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "capex_requests_po_idx" ON "capex_requests" USING btree ("purchase_order_id");