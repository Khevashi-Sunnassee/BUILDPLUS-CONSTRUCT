DO $$ BEGIN CREATE TYPE "public"."activity_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'STUCK', 'DONE', 'ON_HOLD', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."australian_state" AS ENUM('VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."broadcast_channel" AS ENUM('SMS', 'WHATSAPP', 'EMAIL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."broadcast_status" AS ENUM('PENDING', 'SENDING', 'COMPLETED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."call_log_level_status" AS ENUM('PENDING', 'ON_TIME', 'LATE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."cfmeu_calendar" AS ENUM('NONE', 'CFMEU_QLD', 'CFMEU_VIC'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."cfmeu_calendar_type" AS ENUM('VIC_ONSITE', 'VIC_OFFSITE', 'QLD'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."cfmeu_holiday_type" AS ENUM('RDO', 'PUBLIC_HOLIDAY', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."chat_notification_type" AS ENUM('MESSAGE', 'MENTION'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."checklist_instance_status" AS ENUM('draft', 'in_progress', 'completed', 'signed_off', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."contract_status" AS ENUM('AWAITING_CONTRACT', 'CONTRACT_REVIEW', 'CONTRACT_EXECUTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."contract_type" AS ENUM('LUMP_SUM', 'UNIT_PRICE', 'TIME_AND_MATERIALS', 'GMP'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."conversation_type" AS ENUM('DM', 'GROUP', 'CHANNEL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."discipline" AS ENUM('DRAFTING'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."doc_mgmt_status" AS ENUM('PRELIM', 'IFA', 'IFC', 'DRAFT', 'REVIEW', 'APPROVED', 'SUPERSEDED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'IFA', 'IFC', 'APPROVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."drafting_program_status" AS ENUM('NOT_SCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."employee_doc_category" AS ENUM('contract', 'variation', 'id', 'licence', 'induction', 'policy_acknowledgement', 'performance', 'termination', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."employment_status" AS ENUM('prospect', 'offer_sent', 'offer_accepted', 'pre_start', 'active', 'on_leave', 'inactive', 'terminated', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."employment_type_enum" AS ENUM('full_time', 'part_time', 'casual', 'contract'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."eot_claim_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."eot_delay_category" AS ENUM('WEATHER', 'CLIENT_DELAY', 'DESIGN_CHANGE', 'SITE_CONDITIONS', 'SUPPLY_CHAIN', 'SUBCONTRACTOR', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."help_scope" AS ENUM('PAGE', 'FIELD', 'ACTION', 'COLUMN', 'ERROR', 'GENERAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."help_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hire_charge_rule" AS ENUM('calendar_days', 'business_days', 'minimum_days'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hire_rate_type" AS ENUM('day', 'week', 'month', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hire_source" AS ENUM('internal', 'external'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hire_status" AS ENUM('DRAFT', 'REQUESTED', 'APPROVED', 'BOOKED', 'PICKED_UP', 'ON_HIRE', 'RETURNED', 'CANCELLED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."job_status" AS ENUM('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'OPPORTUNITY', 'QUOTING', 'WON', 'LOST', 'CANCELLED', 'CONTRACTED', 'IN_PROGRESS', 'PENDING_START', 'STARTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."load_list_status" AS ENUM('PENDING', 'COMPLETE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."log_status" AS ENUM('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."member_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."message_format" AS ENUM('PLAIN', 'MARKDOWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."onboarding_status" AS ENUM('not_started', 'in_progress', 'blocked', 'ready_to_start', 'started', 'complete', 'withdrawn'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."onboarding_task_owner" AS ENUM('employee', 'supervisor', 'hr', 'payroll'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."onboarding_task_status" AS ENUM('pending', 'in_progress', 'complete', 'blocked', 'skipped'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."opportunity_status" AS ENUM('NEW', 'CONTACTED', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'LOST', 'ON_HOLD'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."opportunity_type" AS ENUM('BUILDER_SELECTED', 'OPEN_TENDER', 'NEGOTIATED_CONTRACT', 'GENERAL_PRICING'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."panel_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'PENDING'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."pay_frequency" AS ENUM('weekly', 'fortnightly', 'monthly'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."permission_level" AS ENUM('HIDDEN', 'VIEW', 'VIEW_AND_UPDATE', 'VIEW_OWN', 'VIEW_AND_UPDATE_OWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."po_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'RECEIVED_IN_PART'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."production_slot_status" AS ENUM('SCHEDULED', 'PENDING_UPDATE', 'BOOKED', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."progress_claim_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."rate_basis" AS ENUM('hourly', 'salary'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."recipient_type" AS ENUM('ALL_USERS', 'SPECIFIC_USERS', 'CUSTOM_CONTACTS', 'SPECIFIC_CUSTOMERS', 'SPECIFIC_SUPPLIERS', 'SPECIFIC_EMPLOYEES'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."reo_schedule_item_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'ORDERED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."reo_schedule_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."return_type" AS ENUM('FULL', 'PARTIAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."role" AS ENUM('USER', 'MANAGER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."sales_stage" AS ENUM('OPPORTUNITY', 'PRE_QUALIFICATION', 'ESTIMATING', 'SUBMITTED', 'AWARDED', 'LOST'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."task_notification_type" AS ENUM('UPDATE', 'COMMENT', 'FILE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."task_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'STUCK', 'DONE', 'ON_HOLD'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."timer_event_type" AS ENUM('START', 'PAUSE', 'RESUME', 'STOP', 'CANCEL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."timer_status" AS ENUM('RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."user_type" AS ENUM('EMPLOYEE', 'EXTERNAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."weekly_report_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_consultants" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_stages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"stage_number" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_template_subtasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"estimated_days" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type_id" varchar(36) NOT NULL,
	"stage_id" varchar(36) NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"category" text,
	"name" text NOT NULL,
	"description" text,
	"estimated_days" integer DEFAULT 14 NOT NULL,
	"consultant_id" varchar(36),
	"consultant_name" text,
	"deliverable" text,
	"job_phase" text,
	"predecessor_sort_order" integer,
	"relationship" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" varchar(36) NOT NULL,
	"action" text NOT NULL,
	"actor_id" varchar(36) NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_maintenance_records" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar(36) NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"maintenance_type" text NOT NULL,
	"maintenance_date" text NOT NULL,
	"cost" numeric(14, 2),
	"service_provider" text,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_transfers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar(36) NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"from_location" text,
	"to_location" text,
	"from_department" text,
	"to_department" text,
	"from_assignee" text,
	"to_assignee" text,
	"transfer_date" text NOT NULL,
	"reason" text,
	"transferred_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"asset_tag" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"status" text DEFAULT 'active',
	"condition" text,
	"location" text,
	"department" text,
	"assigned_to" text,
	"funding_method" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"purchase_price" numeric(14, 2),
	"current_value" numeric(14, 2),
	"depreciation_method" text,
	"depreciation_rate" numeric(6, 2),
	"accumulated_depreciation" numeric(14, 2),
	"depreciation_this_period" numeric(14, 2),
	"book_value" numeric(14, 2),
	"years_depreciated" integer,
	"useful_life_years" integer,
	"purchase_date" text,
	"supplier" text,
	"supplier_id" varchar(36),
	"warranty_expiry" text,
	"lease_start_date" text,
	"lease_end_date" text,
	"lease_monthly_payment" numeric(14, 2),
	"balloon_payment" numeric(14, 2),
	"lease_term" integer,
	"lessor" text,
	"loan_amount" numeric(14, 2),
	"interest_rate" numeric(6, 2),
	"loan_term" integer,
	"lender" text,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"registration_number" text,
	"engine_number" text,
	"vin_number" text,
	"year_of_manufacture" text,
	"country_of_origin" text,
	"specifications" text,
	"operating_hours" numeric(10, 1),
	"insurance_provider" text,
	"insurance_policy_number" text,
	"insurance_premium" numeric(14, 2),
	"insurance_excess" numeric(14, 2),
	"insurance_start_date" text,
	"insurance_expiry_date" text,
	"insurance_status" text,
	"insurance_notes" text,
	"quantity" integer DEFAULT 1,
	"barcode" text,
	"qr_code" text,
	"remarks" text,
	"capex_request_id" text,
	"capex_description" text,
	"is_bookable" boolean DEFAULT false,
	"requires_transport" boolean DEFAULT false,
	"transport_type" text,
	"ai_summary" text,
	"last_audited" timestamp,
	"audit_notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"event_type" text NOT NULL,
	"meta_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broadcast_deliveries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_message_id" varchar(36) NOT NULL,
	"recipient_name" varchar(255),
	"recipient_phone" varchar(50),
	"recipient_email" varchar(255),
	"channel" "broadcast_channel" NOT NULL,
	"status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"external_message_id" varchar(255),
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broadcast_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"template_id" varchar(36),
	"subject" varchar(500),
	"message" text NOT NULL,
	"channels" text[] NOT NULL,
	"recipient_type" "recipient_type" NOT NULL,
	"recipient_ids" text[],
	"custom_recipients" jsonb,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" "broadcast_status" DEFAULT 'PENDING' NOT NULL,
	"sent_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broadcast_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500),
	"message" text NOT NULL,
	"category" varchar(100),
	"default_channels" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cfmeu_holidays" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"calendar_type" "cfmeu_calendar_type" NOT NULL,
	"date" timestamp NOT NULL,
	"name" text NOT NULL,
	"holiday_type" "cfmeu_holiday_type" DEFAULT 'RDO' NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_message_attachments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(36) NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_message_mentions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(36) NOT NULL,
	"mentioned_user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"sender_id" varchar(36) NOT NULL,
	"body" text,
	"body_format" "message_format" DEFAULT 'PLAIN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"reply_to_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"type" "chat_notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"conversation_id" varchar(36),
	"message_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_topics" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_instances" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"template_id" varchar(36) NOT NULL,
	"instance_number" varchar(50),
	"job_id" varchar(36),
	"panel_id" varchar(36),
	"customer_id" varchar(36),
	"supplier_id" varchar(36),
	"staff_id" varchar(36),
	"location" varchar(255),
	"assigned_to" varchar(36),
	"status" "checklist_instance_status" DEFAULT 'draft' NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" numeric(10, 2),
	"max_possible_score" integer DEFAULT 0,
	"completion_rate" numeric(5, 2) DEFAULT '0',
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar(36),
	"signed_off_by" varchar(36),
	"signed_off_at" timestamp,
	"sign_off_comments" text,
	"generated_work_orders" jsonb DEFAULT '[]'::jsonb,
	"entity_type_id" varchar(36),
	"entity_subtype_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"entity_type_id" varchar(36),
	"entity_subtype_id" varchar(36),
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phase" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"has_scoring_system" boolean DEFAULT false,
	"max_score" integer DEFAULT 0,
	"auto_create_work_orders" boolean DEFAULT false,
	"work_order_priority" varchar(20) DEFAULT 'medium',
	"is_mandatory_for_system_activity" boolean DEFAULT false,
	"system_activity_type" varchar(100),
	"required_outcomes" jsonb DEFAULT '[]'::jsonb,
	"enable_notifications" boolean DEFAULT false,
	"notification_settings" jsonb DEFAULT '{}'::jsonb,
	"qr_code_enabled" boolean DEFAULT false,
	"qr_code_token" varchar(100),
	"qr_code_expires_at" timestamp,
	"qr_code_generated_at" timestamp,
	"qr_code_usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"logo_base64" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"abn" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"contract_number" text,
	"project_name" text,
	"project_address" text,
	"owner_client_name" text,
	"general_contractor" text,
	"architect_engineer" text,
	"contract_status" "contract_status" DEFAULT 'AWAITING_CONTRACT' NOT NULL,
	"contract_type" "contract_type",
	"original_contract_date" timestamp,
	"notice_to_proceed_date" timestamp,
	"original_contract_value" numeric(14, 2),
	"revised_contract_value" numeric(14, 2),
	"unit_prices" text,
	"retention_percentage" numeric(5, 2) DEFAULT '10',
	"retention_cap" numeric(14, 2) DEFAULT '5',
	"payment_terms" text,
	"billing_method" text,
	"tax_responsibility" text,
	"escalation_clause" boolean,
	"escalation_clause_details" text,
	"liquidated_damages_rate" numeric(14, 2),
	"liquidated_damages_start_date" timestamp,
	"precast_scope_description" text,
	"precast_elements_included" jsonb,
	"estimated_piece_count" integer,
	"estimated_total_weight" numeric(14, 2),
	"estimated_total_volume" text,
	"finish_requirements" text,
	"connection_type_responsibility" text,
	"required_delivery_start_date" timestamp,
	"required_delivery_end_date" timestamp,
	"production_start_date" timestamp,
	"production_finish_date" timestamp,
	"erection_start_date" timestamp,
	"erection_finish_date" timestamp,
	"critical_milestones" text,
	"weekend_night_work_allowed" boolean,
	"weather_allowances" text,
	"design_responsibility" text,
	"shop_drawing_required" boolean,
	"submittal_due_date" timestamp,
	"submittal_approval_date" timestamp,
	"revision_count" integer,
	"connection_design_included" boolean,
	"stamped_calculations_required" boolean,
	"delivery_restrictions" text,
	"site_access_constraints" text,
	"crane_type_capacity" text,
	"unloading_responsibility" text,
	"laydown_area_available" boolean,
	"return_loads_allowed" boolean,
	"approved_change_order_value" numeric(14, 2),
	"pending_change_order_value" numeric(14, 2),
	"change_order_count" integer,
	"change_order_reference_numbers" text,
	"change_reason_codes" text,
	"time_impact_days" integer,
	"performance_bond_required" boolean,
	"payment_bond_required" boolean,
	"insurance_requirements" text,
	"warranty_period" text,
	"indemnification_clause_notes" text,
	"dispute_resolution_method" text,
	"governing_law" text,
	"force_majeure_clause" boolean,
	"quality_standard_reference" text,
	"mockups_required" boolean,
	"acceptance_criteria" text,
	"punch_list_responsibility" text,
	"final_acceptance_date" timestamp,
	"substantial_completion_date" timestamp,
	"final_completion_date" timestamp,
	"final_retention_release_date" timestamp,
	"as_builts_required" boolean,
	"om_manuals_required" boolean,
	"warranty_start_date" timestamp,
	"warranty_end_date" timestamp,
	"claimable_at_phase" integer,
	"risk_rating" integer,
	"risk_overview" text,
	"risk_highlights" jsonb,
	"ai_analyzed_at" timestamp,
	"ai_source_document_id" varchar(36),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_members" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"role" "member_role" DEFAULT 'MEMBER' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp,
	"last_read_msg_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"type" "conversation_type" NOT NULL,
	"name" text,
	"topic_id" varchar(36),
	"job_id" varchar(36),
	"panel_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"key_contact" text,
	"email" text,
	"phone" text,
	"abn" text,
	"acn" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postcode" text,
	"country" text DEFAULT 'Australia',
	"payment_terms" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"log_day" text NOT NULL,
	"tz" text DEFAULT 'Australia/Melbourne' NOT NULL,
	"discipline" "discipline" DEFAULT 'DRAFTING' NOT NULL,
	"factory" text DEFAULT 'QLD' NOT NULL,
	"factory_id" varchar(36),
	"status" "log_status" DEFAULT 'PENDING' NOT NULL,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" varchar(36),
	"manager_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_records" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_list_id" varchar(36) NOT NULL,
	"docket_number" text,
	"load_document_number" text,
	"truck_rego" text,
	"trailer_rego" text,
	"delivery_date" text,
	"preload" text,
	"load_number" text,
	"number_panels" integer,
	"comment" text,
	"start_time" text,
	"leave_depot_time" text,
	"arrive_lte_time" text,
	"pickup_location" text,
	"pickup_arrive_time" text,
	"pickup_leave_time" text,
	"delivery_location" text,
	"arrive_holding_time" text,
	"leave_holding_time" text,
	"site_first_lift_time" text,
	"site_last_lift_time" text,
	"return_depot_arrive_time" text,
	"total_hours" text,
	"entered_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_records_load_list_id_unique" UNIQUE("load_list_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"device_name" text NOT NULL,
	"os" text NOT NULL,
	"agent_version" text,
	"api_key_hash" text NOT NULL,
	"last_seen_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_bundle_access_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" varchar(36) NOT NULL,
	"document_id" varchar(36),
	"access_type" varchar(20) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_bundle_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" varchar(36) NOT NULL,
	"document_id" varchar(36) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"added_by" varchar(36) NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_bundles" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"bundle_name" text NOT NULL,
	"description" text,
	"qr_code_id" varchar(100) NOT NULL,
	"job_id" varchar(36),
	"supplier_id" varchar(36),
	"is_public" boolean DEFAULT false,
	"allow_guest_access" boolean DEFAULT false,
	"expires_at" timestamp,
	"created_by" varchar(36) NOT NULL,
	"updated_by" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_bundles_qr_code_id_unique" UNIQUE("qr_code_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_categories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"category_name" text NOT NULL,
	"short_form" varchar(20),
	"description" text,
	"color" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_disciplines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"discipline_name" text NOT NULL,
	"short_form" varchar(10),
	"color" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_type_statuses" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"type_id" varchar(36) NOT NULL,
	"status_name" text NOT NULL,
	"color" varchar(20) DEFAULT '#6b7280' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_types_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"type_name" text NOT NULL,
	"prefix" varchar(10) NOT NULL,
	"short_form" varchar(20),
	"description" text,
	"color" varchar(20),
	"icon" varchar(50),
	"requires_approval" boolean DEFAULT false,
	"retention_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"document_number" varchar(50),
	"title" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"file_sha256" varchar(64),
	"type_id" varchar(36),
	"discipline_id" varchar(36),
	"category_id" varchar(36),
	"tags" text,
	"status" "doc_mgmt_status" DEFAULT 'DRAFT' NOT NULL,
	"document_type_status_id" varchar(36),
	"version" varchar(10) DEFAULT '1.0' NOT NULL,
	"revision" varchar(5) DEFAULT 'A' NOT NULL,
	"is_latest_version" boolean DEFAULT true NOT NULL,
	"parent_document_id" varchar(36),
	"change_summary" text,
	"job_id" varchar(36),
	"panel_id" varchar(36),
	"supplier_id" varchar(36),
	"purchase_order_id" varchar(36),
	"task_id" varchar(36),
	"conversation_id" varchar(36),
	"message_id" varchar(36),
	"uploaded_by" varchar(36) NOT NULL,
	"approved_by" varchar(36),
	"approved_at" timestamp,
	"is_confidential" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drafting_program" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"production_slot_id" varchar(36),
	"level" text NOT NULL,
	"production_date" timestamp,
	"drawing_due_date" timestamp,
	"drafting_window_start" timestamp,
	"proposed_start_date" timestamp,
	"assigned_to_id" varchar(36),
	"status" "drafting_program_status" DEFAULT 'NOT_SCHEDULED' NOT NULL,
	"priority" integer DEFAULT 0,
	"estimated_hours" numeric(6, 2),
	"actual_hours" numeric(6, 2),
	"notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"category" "employee_doc_category" DEFAULT 'other' NOT NULL,
	"file_url" text,
	"file_name" text,
	"file_size" integer,
	"issued_date" text,
	"expiry_date" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_employments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"employment_type" "employment_type_enum" DEFAULT 'full_time' NOT NULL,
	"position_title" text,
	"job_title" text,
	"department" text,
	"reporting_manager_id" varchar(36),
	"work_location" text,
	"work_state" text,
	"start_date" text NOT NULL,
	"expected_start_date" text,
	"end_date" text,
	"probation_end_date" text,
	"classification_level" text,
	"instrument_id" varchar(36),
	"status" "employment_status" DEFAULT 'prospect' NOT NULL,
	"base_rate" numeric(14, 2),
	"rate_basis" "rate_basis" DEFAULT 'hourly',
	"pay_frequency" "pay_frequency" DEFAULT 'weekly',
	"ordinary_rate" numeric(14, 2),
	"overtime_1_5" numeric(14, 2),
	"overtime_2" numeric(14, 2),
	"saturday_rate" numeric(14, 2),
	"sunday_rate" numeric(14, 2),
	"public_holiday_rate" numeric(14, 2),
	"night_shift_rate" numeric(14, 2),
	"travel_allowance" numeric(14, 2),
	"meal_allowance" numeric(14, 2),
	"tool_allowance" numeric(14, 2),
	"uniform_allowance" numeric(14, 2),
	"phone_allowance" numeric(14, 2),
	"car_allowance" numeric(14, 2),
	"shift_allowance" numeric(14, 2),
	"annual_leave_hours_per_week" numeric(6, 2),
	"sick_leave_hours_per_week" numeric(6, 2),
	"long_service_leave_hours" numeric(8, 2),
	"rdo_count" integer,
	"rdo_accrual" numeric(6, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_licences" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"licence_type" text NOT NULL,
	"licence_number" text,
	"issuing_authority" text,
	"issue_date" text,
	"expiry_date" text,
	"document_url" text,
	"status" text DEFAULT 'active',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_onboarding_tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_id" varchar(36) NOT NULL,
	"template_task_id" varchar(36),
	"title" text NOT NULL,
	"description" text,
	"owner" "onboarding_task_owner" DEFAULT 'hr' NOT NULL,
	"status" "onboarding_task_status" DEFAULT 'pending' NOT NULL,
	"due_date" text,
	"completed_at" timestamp,
	"completed_by" varchar(36),
	"requires_evidence" boolean DEFAULT false NOT NULL,
	"evidence_document_id" varchar(36),
	"is_blocking" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_onboardings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"employee_id" varchar(36) NOT NULL,
	"employment_id" varchar(36) NOT NULL,
	"template_id" varchar(36),
	"status" "onboarding_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"user_id" varchar(36),
	"employee_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"preferred_name" text,
	"date_of_birth" text,
	"phone" text,
	"email" text,
	"address_line1" text,
	"address_line2" text,
	"suburb" text,
	"state" text,
	"postcode" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relationship" text,
	"is_drafting_resource" boolean DEFAULT false NOT NULL,
	"is_production_resource" boolean DEFAULT false NOT NULL,
	"is_site_resource" boolean DEFAULT false NOT NULL,
	"receive_escalated_work_orders" boolean DEFAULT false NOT NULL,
	"work_rights" boolean DEFAULT true NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_subtypes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36),
	"entity_type_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_types" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36),
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(20),
	"sort_order" integer DEFAULT 0,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eot_claims" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"weekly_report_id" varchar(36),
	"report_schedule_id" varchar(36),
	"status" "eot_claim_status" DEFAULT 'DRAFT' NOT NULL,
	"claim_number" text NOT NULL,
	"delay_category" "eot_delay_category" NOT NULL,
	"description" text NOT NULL,
	"requested_days" integer NOT NULL,
	"current_completion_date" text,
	"requested_completion_date" text,
	"supporting_notes" text,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"reviewed_by_id" varchar(36),
	"reviewed_at" timestamp,
	"review_notes" text,
	"approved_days" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "factories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"state" "australian_state" DEFAULT 'VIC' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"cfmeu_calendar" "cfmeu_calendar_type",
	"inherit_work_days" boolean DEFAULT true NOT NULL,
	"work_days" json DEFAULT '[false,true,true,true,true,true,false]'::json,
	"color" text DEFAULT '#3B82F6',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"tz" text DEFAULT 'Australia/Melbourne' NOT NULL,
	"capture_interval_s" integer DEFAULT 300 NOT NULL,
	"idle_threshold_s" integer DEFAULT 300 NOT NULL,
	"tracked_apps" text DEFAULT 'revit,acad' NOT NULL,
	"require_addins" boolean DEFAULT true NOT NULL,
	"logo_base64" text,
	"company_name" text DEFAULT 'LTE Precast Concrete Structures',
	"week_start_day" integer DEFAULT 1 NOT NULL,
	"production_window_days" integer DEFAULT 10 NOT NULL,
	"ifc_days_in_advance" integer DEFAULT 14 NOT NULL,
	"days_to_achieve_ifc" integer DEFAULT 21 NOT NULL,
	"production_days_in_advance" integer DEFAULT 10 NOT NULL,
	"procurement_days_in_advance" integer DEFAULT 7 NOT NULL,
	"procurement_time_days" integer DEFAULT 14 NOT NULL,
	"production_work_days" json DEFAULT '[false,true,true,true,true,true,false]'::json,
	"drafting_work_days" json DEFAULT '[false,true,true,true,true,true,false]'::json,
	"cfmeu_calendar" "cfmeu_calendar" DEFAULT 'NONE' NOT NULL,
	"po_terms_html" text,
	"include_po_terms" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "help_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"scope" "help_scope" DEFAULT 'GENERAL' NOT NULL,
	"title" text NOT NULL,
	"short_text" text,
	"body_md" text,
	"keywords" text[] DEFAULT '{}',
	"category" text,
	"page_route" text,
	"role_visibility" text[] DEFAULT '{}',
	"status" "help_status" DEFAULT 'PUBLISHED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "help_entries_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "help_entry_versions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"help_entry_id" varchar(36) NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "help_feedback" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"help_entry_id" varchar(36),
	"help_key" text,
	"user_id" text,
	"rating" integer,
	"comment" text,
	"page_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hire_bookings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"booking_number" text NOT NULL,
	"hire_source" "hire_source" DEFAULT 'external' NOT NULL,
	"equipment_description" text NOT NULL,
	"asset_category_index" integer NOT NULL,
	"asset_id" varchar(36),
	"supplier_id" varchar(36),
	"job_id" varchar(36) NOT NULL,
	"cost_code" text,
	"requested_by_user_id" varchar(36) NOT NULL,
	"responsible_person_user_id" varchar(36) NOT NULL,
	"site_contact_user_id" varchar(36),
	"hire_start_date" timestamp NOT NULL,
	"hire_end_date" timestamp NOT NULL,
	"expected_return_date" timestamp,
	"rate_type" "hire_rate_type" DEFAULT 'day' NOT NULL,
	"rate_amount" numeric(14, 2) NOT NULL,
	"charge_rule" "hire_charge_rule" DEFAULT 'calendar_days' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"delivery_required" boolean DEFAULT false NOT NULL,
	"delivery_address" text,
	"delivery_cost" numeric(14, 2),
	"pickup_required" boolean DEFAULT false NOT NULL,
	"pickup_cost" numeric(14, 2),
	"status" "hire_status" DEFAULT 'DRAFT' NOT NULL,
	"approved_by_user_id" varchar(36),
	"approved_at" timestamp,
	"supplier_reference" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "industrial_instruments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"instrument_type" text DEFAULT 'award',
	"state" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_categories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"category_id" varchar(36),
	"supplier_id" varchar(36),
	"unit_of_measure" text DEFAULT 'EA',
	"unit_price" numeric(12, 2),
	"min_order_qty" integer DEFAULT 1,
	"lead_time_days" integer,
	"hs_code" text,
	"ad_risk" text,
	"ad_reference_url" text,
	"compliance_notes" text,
	"supplier_shortlist" text,
	"sources" text,
	"item_type" text DEFAULT 'local' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_activities" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"template_id" varchar(36),
	"stage_id" varchar(36),
	"parent_id" varchar(36),
	"company_id" varchar(36) NOT NULL,
	"task_group_id" varchar(36),
	"category" text,
	"name" text NOT NULL,
	"description" text,
	"estimated_days" integer DEFAULT 14,
	"consultant_name" text,
	"deliverable" text,
	"job_phase" text,
	"status" "activity_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"reminder_date" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"predecessor_sort_order" integer,
	"relationship" text,
	"notes" text,
	"created_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_activity_assignees" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_activity_files" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" varchar(36) NOT NULL,
	"update_id" varchar(36),
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_activity_updates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_audit_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"action" text NOT NULL,
	"changed_fields" jsonb,
	"previous_phase" text,
	"new_phase" text,
	"previous_status" text,
	"new_status" text,
	"changed_by_id" varchar(36),
	"changed_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_cost_overrides" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"panel_type_id" varchar(36) NOT NULL,
	"component_name" text NOT NULL,
	"default_percentage" text NOT NULL,
	"revised_percentage" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_level_cycle_times" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"building_number" integer DEFAULT 1 NOT NULL,
	"level" text NOT NULL,
	"level_order" real NOT NULL,
	"pour_label" text,
	"sequence_order" integer DEFAULT 0 NOT NULL,
	"cycle_days" integer NOT NULL,
	"predecessor_sequence_order" integer,
	"relationship" text,
	"estimated_start_date" timestamp,
	"estimated_end_date" timestamp,
	"manual_start_date" timestamp,
	"manual_end_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_members" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"invited_by" varchar(36),
	"invited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_panel_rates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"panel_type_id" varchar(36) NOT NULL,
	"labour_cost_per_m2" numeric(14, 2),
	"labour_cost_per_m3" numeric(14, 2),
	"supply_cost_per_m2" numeric(14, 2),
	"supply_cost_per_m3" numeric(14, 2),
	"total_rate_per_m2" numeric(14, 2),
	"total_rate_per_m3" numeric(14, 2),
	"sell_rate_per_m2" numeric(14, 2),
	"sell_rate_per_m3" numeric(14, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_types" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"job_number" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"client" text,
	"customer_id" varchar(36),
	"address" text,
	"city" text,
	"state" "australian_state",
	"site_contact" text,
	"site_contact_phone" text,
	"description" text,
	"crane_capacity" text,
	"number_of_buildings" integer,
	"levels" text,
	"lowest_level" text,
	"highest_level" text,
	"production_start_date" timestamp,
	"expected_cycle_time_per_floor" integer,
	"days_in_advance" integer DEFAULT 7,
	"days_to_achieve_ifc" integer,
	"production_window_days" integer,
	"production_days_in_advance" integer,
	"procurement_days_in_advance" integer,
	"procurement_time_days" integer,
	"project_manager_id" varchar(36),
	"factory_id" varchar(36),
	"production_slot_color" text,
	"job_phase" integer DEFAULT 0 NOT NULL,
	"status" "job_status" DEFAULT 'ACTIVE' NOT NULL,
	"referrer" text,
	"engineer_on_job" text,
	"estimated_value" numeric(12, 2),
	"number_of_levels" integer,
	"opportunity_status" "opportunity_status",
	"sales_stage" "sales_stage",
	"sales_status" text,
	"opportunity_type" "opportunity_type",
	"primary_contact" text,
	"probability" integer,
	"estimated_start_date" timestamp,
	"comments" text,
	"job_type_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "load_list_panels" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_list_id" varchar(36) NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "load_lists" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"load_number" text NOT NULL,
	"load_date" text NOT NULL,
	"load_time" text NOT NULL,
	"trailer_type_id" varchar(36),
	"factory" text DEFAULT 'QLD' NOT NULL,
	"factory_id" varchar(36),
	"uhf" text,
	"status" "load_list_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "load_return_panels" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_return_id" varchar(36) NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "load_returns" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_list_id" varchar(36) NOT NULL,
	"return_type" "return_type" NOT NULL,
	"return_reason" text NOT NULL,
	"return_date" text,
	"left_factory_time" text,
	"arrived_factory_time" text,
	"unloaded_at_factory_time" text,
	"notes" text,
	"returned_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "log_rows" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" varchar(36) NOT NULL,
	"job_id" varchar(36),
	"panel_register_id" varchar(36),
	"work_type_id" integer,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"duration_min" integer NOT NULL,
	"idle_min" integer NOT NULL,
	"source" text NOT NULL,
	"source_event_id" text NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"tz" text DEFAULT 'Australia/Melbourne' NOT NULL,
	"app" text NOT NULL,
	"file_path" text,
	"file_name" text,
	"revit_view_name" text,
	"revit_sheet_number" text,
	"revit_sheet_name" text,
	"acad_layout_name" text,
	"raw_panel_mark" text,
	"raw_drawing_code" text,
	"panel_mark" text,
	"drawing_code" text,
	"notes" text,
	"is_user_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "log_rows_source_event_id_unique" UNIQUE("source_event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mapping_rules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"path_contains" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_template_tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner" "onboarding_task_owner" DEFAULT 'hr' NOT NULL,
	"due_days_offset" integer DEFAULT 0,
	"requires_evidence" boolean DEFAULT false NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"role" text,
	"employment_type" text,
	"state" text,
	"instrument_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "panel_audit_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"action" text NOT NULL,
	"changed_fields" jsonb,
	"previous_lifecycle_status" integer,
	"new_lifecycle_status" integer,
	"changed_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "panel_register" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"panel_mark" text NOT NULL,
	"panel_type" text DEFAULT 'WALL' NOT NULL,
	"description" text,
	"drawing_code" text,
	"sheet_number" text,
	"building" text,
	"zone" text,
	"level" text,
	"structural_elevation" text,
	"reckli_detail" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"work_type_id" integer DEFAULT 1,
	"takeoff_category" text,
	"concrete_strength_mpa" text,
	"source_file_name" text,
	"source_sheet" text,
	"source_row" integer,
	"panel_source_id" text,
	"source" integer DEFAULT 1 NOT NULL,
	"status" "panel_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"document_status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"estimated_hours" integer,
	"actual_hours" integer DEFAULT 0,
	"notes" text,
	"fire_rate" numeric(14, 2),
	"caulking_fire" text,
	"num_rebates" integer,
	"openings" text,
	"net_weight" numeric(14, 2),
	"gross_area" numeric(14, 2),
	"crane_capacity_weight" numeric(14, 2),
	"crane_check" text,
	"grout_table_manual" text,
	"grout_to_use" text,
	"grout_strength" text,
	"vertical_reo_qty" text,
	"vertical_reo_type" text,
	"horizontal_reo_qty" text,
	"horizontal_reo_type" text,
	"mesh_qty" text,
	"mesh_type" text,
	"fitments_reo_qty" text,
	"fitments_reo_type" text,
	"u_bars_qty" text,
	"u_bars_type" text,
	"ligs_qty" text,
	"ligs_type" text,
	"blockout_bars_qty" text,
	"blockout_bars_type" text,
	"additional_reo_qty_1" text,
	"additional_reo_type_1" text,
	"additional_reo_qty_2" text,
	"additional_reo_type_2" text,
	"additional_reo_qty_3" text,
	"additional_reo_type_3" text,
	"additional_reo_qty_4" text,
	"additional_reo_type_4" text,
	"top_fixing_qty" text,
	"top_fixing_type" text,
	"trimmer_bars_qty" text,
	"trimmer_bars_type" text,
	"ligs_reo_qty" text,
	"ligs_reo_type" text,
	"additional_reo_type" text,
	"tie_reinforcement" text,
	"additional_reo_qty" text,
	"additional_reo_frl_type" text,
	"grout_tubes_bottom_qty" text,
	"grout_tubes_bottom_type" text,
	"grout_tubes_top_qty" text,
	"grout_tubes_top_type" text,
	"ferrules_qty" text,
	"ferrules_type" text,
	"fitments_qty_2" text,
	"fitments_type_2" text,
	"fitments_qty_3" text,
	"fitments_type_3" text,
	"fitments_qty_4" text,
	"fitments_type_4" text,
	"plates_qty" text,
	"plates_type" text,
	"plates_qty_2" text,
	"plates_type_2" text,
	"plates_qty_3" text,
	"plates_type_3" text,
	"plates_qty_4" text,
	"plates_type_4" text,
	"dowel_bars_length" text,
	"dowel_bars_qty" text,
	"dowel_bars_type" text,
	"dowel_bars_length_2" text,
	"dowel_bars_qty_2" text,
	"dowel_bars_type_2" text,
	"lifter_qty_a" text,
	"lifters_type" text,
	"lifter_qty_b" text,
	"safety_lifters_type" text,
	"lifter_qty_c" text,
	"face_lifters_type" text,
	"inserts_qty_d" text,
	"insert_type_d" text,
	"unit_check" text,
	"order" text,
	"horizontal_reo_text" text,
	"horizontal_reo_at" text,
	"reo_r6" text,
	"reo_n10" text,
	"reo_n12" text,
	"reo_n16" text,
	"reo_n20" text,
	"reo_n24" text,
	"reo_n28" text,
	"reo_n32" text,
	"mesh_sl82" text,
	"mesh_sl92" text,
	"mesh_sl102" text,
	"dowel_n20" text,
	"dowel_n24" text,
	"dowel_n28" text,
	"dowel_n32" text,
	"dowel_n36" text,
	"reo_tons" text,
	"dowels_tons" text,
	"total_reo" text,
	"total_kg_m3" text,
	"contract" text,
	"reo_contract" text,
	"load_width" text,
	"load_height" text,
	"panel_thickness" text,
	"panel_volume" text,
	"panel_mass" text,
	"panel_area" numeric(14, 2),
	"day_28_fc" text,
	"lift_fcm" text,
	"rotational_lifters" text,
	"primary_lifters" text,
	"production_pdf_url" text,
	"approved_for_production" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp,
	"approved_by_id" varchar(36),
	"lifecycle_status" integer DEFAULT 0 NOT NULL,
	"consolidated_into_panel_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "panel_type_cost_components" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panel_type_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"percentage_of_revenue" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "panel_types" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"labour_cost_per_m2" numeric(14, 2),
	"labour_cost_per_m3" numeric(14, 2),
	"supply_cost_per_m2" numeric(14, 2),
	"supply_cost_per_m3" numeric(14, 2),
	"install_cost_per_m2" numeric(14, 2),
	"install_cost_per_m3" numeric(14, 2),
	"total_rate_per_m2" numeric(14, 2),
	"total_rate_per_m3" numeric(14, 2),
	"sell_rate_per_m2" numeric(14, 2),
	"sell_rate_per_m3" numeric(14, 2),
	"expected_weight_per_m3" numeric(14, 2) DEFAULT '2500',
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pm_call_log_levels" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_log_id" varchar(36) NOT NULL,
	"level_cycle_time_id" varchar(36) NOT NULL,
	"level" text NOT NULL,
	"building_number" integer DEFAULT 1 NOT NULL,
	"pour_label" text,
	"sequence_order" integer DEFAULT 0 NOT NULL,
	"status" "call_log_level_status" NOT NULL,
	"days_late" integer DEFAULT 0,
	"original_start_date" timestamp,
	"original_end_date" timestamp,
	"adjusted_start_date" timestamp,
	"adjusted_end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pm_call_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text,
	"call_date_time" timestamp NOT NULL,
	"delivery_time" text,
	"next_delivery_date" timestamp,
	"drafting_concerns" text,
	"client_design_changes" text,
	"issues_reported" text,
	"installation_problems" text,
	"notes" text,
	"notify_manager" boolean DEFAULT false NOT NULL,
	"notify_client" boolean DEFAULT false NOT NULL,
	"notify_production" boolean DEFAULT false NOT NULL,
	"update_production_schedule" boolean DEFAULT false NOT NULL,
	"update_drafting_schedule" boolean DEFAULT false NOT NULL,
	"notification_emails" text,
	"notification_phone" text,
	"notification_results" jsonb DEFAULT '[]'::jsonb,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_beds" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factory_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"length_mm" integer NOT NULL,
	"width_mm" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_days" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_date" text NOT NULL,
	"factory" text NOT NULL,
	"factory_id" varchar(36),
	"notes" text,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"production_date" text NOT NULL,
	"factory" text DEFAULT 'QLD' NOT NULL,
	"factory_id" varchar(36),
	"status" text DEFAULT 'PENDING' NOT NULL,
	"bay_number" text,
	"volume_m3" text,
	"area_m2" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_slot_adjustments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_slot_id" varchar(36) NOT NULL,
	"previous_date" timestamp NOT NULL,
	"new_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"changed_by_id" varchar(36) NOT NULL,
	"client_confirmed" boolean DEFAULT false,
	"cascaded_to_other_slots" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_slots" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"building_number" integer DEFAULT 1,
	"level" text NOT NULL,
	"level_order" real NOT NULL,
	"panel_count" integer DEFAULT 0,
	"production_slot_date" timestamp NOT NULL,
	"status" "production_slot_status" DEFAULT 'SCHEDULED' NOT NULL,
	"date_last_reported_onsite" timestamp,
	"is_booked" boolean DEFAULT false,
	"predecessor_slot_id" varchar(36),
	"relationship" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progress_claim_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progress_claim_id" varchar(36) NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"panel_mark" text NOT NULL,
	"level" text,
	"panel_revenue" numeric(14, 2) NOT NULL,
	"percent_complete" numeric(5, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progress_claims" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"claim_number" text NOT NULL,
	"status" "progress_claim_status" DEFAULT 'DRAFT' NOT NULL,
	"claim_date" timestamp DEFAULT now() NOT NULL,
	"claim_type" text DEFAULT 'DETAIL' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '10',
	"tax_amount" numeric(14, 2) DEFAULT '0',
	"total" numeric(14, 2) DEFAULT '0',
	"retention_rate" numeric(5, 2) DEFAULT '0',
	"retention_amount" numeric(14, 2) DEFAULT '0',
	"retention_held_to_date" numeric(14, 2) DEFAULT '0',
	"net_claim_amount" numeric(14, 2) DEFAULT '0',
	"notes" text,
	"internal_notes" text,
	"created_by_id" varchar(36) NOT NULL,
	"approved_by_id" varchar(36),
	"approved_at" timestamp,
	"rejected_by_id" varchar(36),
	"rejected_at" timestamp,
	"rejection_reason" text,
	"submitted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_attachments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar(36) NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar(36) NOT NULL,
	"item_id" varchar(36),
	"item_code" text,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_of_measure" text DEFAULT 'EA',
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"received" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" varchar(36),
	"supplier_name" text,
	"supplier_contact" text,
	"supplier_email" text,
	"supplier_phone" text,
	"supplier_address" text,
	"requested_by_id" varchar(36) NOT NULL,
	"status" "po_status" DEFAULT 'DRAFT' NOT NULL,
	"delivery_address" text,
	"required_by_date" timestamp,
	"subtotal" numeric(12, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '10',
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"internal_notes" text,
	"approved_by_id" varchar(36),
	"approved_at" timestamp,
	"rejected_by_id" varchar(36),
	"rejected_at" timestamp,
	"rejection_reason" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reo_schedule_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" varchar(36) NOT NULL,
	"reo_type" text NOT NULL,
	"bar_size" text,
	"bar_shape" text,
	"length" numeric(10, 2),
	"quantity" integer NOT NULL,
	"weight" numeric(10, 2),
	"spacing" text,
	"zone" text,
	"description" text,
	"notes" text,
	"status" "reo_schedule_item_status" DEFAULT 'PENDING' NOT NULL,
	"purchase_order_id" varchar(36),
	"purchase_order_item_id" varchar(36),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reo_schedules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"panel_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"source_document_id" varchar(36),
	"status" "reo_schedule_status" DEFAULT 'PENDING' NOT NULL,
	"processed_at" timestamp,
	"ai_model_used" text,
	"ai_response_raw" text,
	"notes" text,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_status_history" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"sales_stage" text NOT NULL,
	"sales_status" text NOT NULL,
	"note" text,
	"changed_by_user_id" varchar(36),
	"changed_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"key_contact" text,
	"email" text,
	"phone" text,
	"abn" text,
	"acn" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postcode" text,
	"country" text DEFAULT 'Australia',
	"payment_terms" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_assignees" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_files" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"update_id" varchar(36),
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_groups" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_collapsed" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"update_id" varchar(36),
	"type" "task_notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"from_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_updates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"parent_id" varchar(36),
	"job_id" varchar(36),
	"job_activity_id" varchar(36),
	"title" text NOT NULL,
	"status" "task_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"due_date" timestamp,
	"reminder_date" timestamp,
	"consultant" text,
	"project_stage" text,
	"priority" varchar(20),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timer_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timer_session_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"event_type" timer_event_type NOT NULL,
	"elapsed_ms_at_event" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timer_sessions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"daily_log_id" varchar(36),
	"job_id" varchar(36),
	"panel_register_id" varchar(36),
	"work_type_id" integer,
	"app" text,
	"status" timer_status DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp NOT NULL,
	"paused_at" timestamp,
	"completed_at" timestamp,
	"total_elapsed_ms" integer DEFAULT 0 NOT NULL,
	"pause_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"log_row_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trailer_types" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_chat_settings" (
	"user_id" varchar(36) PRIMARY KEY NOT NULL,
	"popup_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_permissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"function_key" text NOT NULL,
	"permission_level" "permission_level" DEFAULT 'VIEW_AND_UPDATE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"address" text,
	"password_hash" text,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"user_type" "user_type" DEFAULT 'EMPLOYEE' NOT NULL,
	"department_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"po_approver" boolean DEFAULT false,
	"po_approval_limit" numeric(12, 2),
	"monday_start_time" text DEFAULT '08:00',
	"monday_hours" numeric(4, 2) DEFAULT '8',
	"tuesday_start_time" text DEFAULT '08:00',
	"tuesday_hours" numeric(4, 2) DEFAULT '8',
	"wednesday_start_time" text DEFAULT '08:00',
	"wednesday_hours" numeric(4, 2) DEFAULT '8',
	"thursday_start_time" text DEFAULT '08:00',
	"thursday_hours" numeric(4, 2) DEFAULT '8',
	"friday_start_time" text DEFAULT '08:00',
	"friday_hours" numeric(4, 2) DEFAULT '8',
	"saturday_start_time" text DEFAULT '08:00',
	"saturday_hours" numeric(4, 2) DEFAULT '0',
	"sunday_start_time" text DEFAULT '08:00',
	"sunday_hours" numeric(4, 2) DEFAULT '0',
	"selected_factory_ids" text[],
	"default_factory_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_job_report_schedules" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar(36) NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"levels_7_days" text,
	"levels_14_days" text,
	"levels_21_days" text,
	"levels_28_days" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"site_progress" text,
	"current_level_onsite" text,
	"schedule_status" text DEFAULT 'ON_TRACK',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_job_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_manager_id" varchar(36) NOT NULL,
	"report_date" text NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"status" "weekly_report_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"submitted_at" timestamp,
	"approved_by_id" varchar(36),
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_wage_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"factory" text DEFAULT 'QLD' NOT NULL,
	"factory_id" varchar(36),
	"production_wages" text,
	"office_wages" text,
	"estimating_wages" text,
	"onsite_wages" text,
	"drafting_wages" text,
	"civil_wages" text,
	"notes" text,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" varchar(36) NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zones" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#3B82F6',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_consultants" ADD CONSTRAINT "activity_consultants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_stages" ADD CONSTRAINT "activity_stages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_template_subtasks" ADD CONSTRAINT "activity_template_subtasks_template_id_activity_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."activity_templates"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_job_type_id_job_types_id_fk" FOREIGN KEY ("job_type_id") REFERENCES "public"."job_types"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_stage_id_activity_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."activity_stages"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_consultant_id_activity_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."activity_consultants"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "asset_maintenance_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assets" ADD CONSTRAINT "assets_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_broadcast_message_id_broadcast_messages_id_fk" FOREIGN KEY ("broadcast_message_id") REFERENCES "public"."broadcast_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_template_id_broadcast_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."broadcast_templates"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "broadcast_templates" ADD CONSTRAINT "broadcast_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "broadcast_templates" ADD CONSTRAINT "broadcast_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "cfmeu_holidays" ADD CONSTRAINT "cfmeu_holidays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_message_mentions" ADD CONSTRAINT "chat_message_mentions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_message_mentions" ADD CONSTRAINT "chat_message_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_notifications" ADD CONSTRAINT "chat_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_notifications" ADD CONSTRAINT "chat_notifications_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_entity_subtype_id_entity_subtypes_id_fk" FOREIGN KEY ("entity_subtype_id") REFERENCES "public"."entity_subtypes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_entity_subtype_id_entity_subtypes_id_fk" FOREIGN KEY ("entity_subtype_id") REFERENCES "public"."entity_subtypes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_ai_source_document_id_documents_id_fk" FOREIGN KEY ("ai_source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_topic_id_chat_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_load_list_id_load_lists_id_fk" FOREIGN KEY ("load_list_id") REFERENCES "public"."load_lists"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_entered_by_id_users_id_fk" FOREIGN KEY ("entered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundle_access_logs" ADD CONSTRAINT "document_bundle_access_logs_bundle_id_document_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."document_bundles"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundle_access_logs" ADD CONSTRAINT "document_bundle_access_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundle_items" ADD CONSTRAINT "document_bundle_items_bundle_id_document_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."document_bundles"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundle_items" ADD CONSTRAINT "document_bundle_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundle_items" ADD CONSTRAINT "document_bundle_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_disciplines" ADD CONSTRAINT "document_disciplines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_type_statuses" ADD CONSTRAINT "document_type_statuses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_type_statuses" ADD CONSTRAINT "document_type_statuses_type_id_document_types_config_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_types_config" ADD CONSTRAINT "document_types_config_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_type_id_document_types_config_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types_config"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_discipline_id_document_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."document_disciplines"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_status_id_document_type_statuses_id_fk" FOREIGN KEY ("document_type_status_id") REFERENCES "public"."document_type_statuses"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "drafting_program" ADD CONSTRAINT "drafting_program_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "drafting_program" ADD CONSTRAINT "drafting_program_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "drafting_program" ADD CONSTRAINT "drafting_program_production_slot_id_production_slots_id_fk" FOREIGN KEY ("production_slot_id") REFERENCES "public"."production_slots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "drafting_program" ADD CONSTRAINT "drafting_program_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_employments" ADD CONSTRAINT "employee_employments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_employments" ADD CONSTRAINT "employee_employments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_employments" ADD CONSTRAINT "employee_employments_reporting_manager_id_users_id_fk" FOREIGN KEY ("reporting_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_licences" ADD CONSTRAINT "employee_licences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_licences" ADD CONSTRAINT "employee_licences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_onboarding_id_employee_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."employee_onboardings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_template_task_id_onboarding_template_tasks_id_fk" FOREIGN KEY ("template_task_id") REFERENCES "public"."onboarding_template_tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboarding_tasks" ADD CONSTRAINT "employee_onboarding_tasks_evidence_document_id_employee_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."employee_documents"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_employment_id_employee_employments_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employee_employments"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_template_id_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "entity_subtypes" ADD CONSTRAINT "entity_subtypes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "entity_subtypes" ADD CONSTRAINT "entity_subtypes_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "eot_claims" ADD CONSTRAINT "eot_claims_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "eot_claims" ADD CONSTRAINT "eot_claims_weekly_report_id_weekly_job_reports_id_fk" FOREIGN KEY ("weekly_report_id") REFERENCES "public"."weekly_job_reports"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "eot_claims" ADD CONSTRAINT "eot_claims_report_schedule_id_weekly_job_report_schedules_id_fk" FOREIGN KEY ("report_schedule_id") REFERENCES "public"."weekly_job_report_schedules"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "eot_claims" ADD CONSTRAINT "eot_claims_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "eot_claims" ADD CONSTRAINT "eot_claims_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "factories" ADD CONSTRAINT "factories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "help_entry_versions" ADD CONSTRAINT "help_entry_versions_help_entry_id_help_entries_id_fk" FOREIGN KEY ("help_entry_id") REFERENCES "public"."help_entries"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_help_entry_id_help_entries_id_fk" FOREIGN KEY ("help_entry_id") REFERENCES "public"."help_entries"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_requested_by_user_id_employees_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_responsible_person_user_id_employees_id_fk" FOREIGN KEY ("responsible_person_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_site_contact_user_id_employees_id_fk" FOREIGN KEY ("site_contact_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hire_bookings" ADD CONSTRAINT "hire_bookings_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "industrial_instruments" ADD CONSTRAINT "industrial_instruments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "items" ADD CONSTRAINT "items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "items" ADD CONSTRAINT "items_category_id_item_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."item_categories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "items" ADD CONSTRAINT "items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activities" ADD CONSTRAINT "job_activities_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activities" ADD CONSTRAINT "job_activities_template_id_activity_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."activity_templates"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activities" ADD CONSTRAINT "job_activities_stage_id_activity_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."activity_stages"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activities" ADD CONSTRAINT "job_activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activities" ADD CONSTRAINT "job_activities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_assignees" ADD CONSTRAINT "job_activity_assignees_activity_id_job_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."job_activities"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_assignees" ADD CONSTRAINT "job_activity_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_files" ADD CONSTRAINT "job_activity_files_activity_id_job_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."job_activities"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_files" ADD CONSTRAINT "job_activity_files_update_id_job_activity_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."job_activity_updates"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_files" ADD CONSTRAINT "job_activity_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_updates" ADD CONSTRAINT "job_activity_updates_activity_id_job_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."job_activities"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_activity_updates" ADD CONSTRAINT "job_activity_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_audit_logs" ADD CONSTRAINT "job_audit_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_audit_logs" ADD CONSTRAINT "job_audit_logs_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_cost_overrides" ADD CONSTRAINT "job_cost_overrides_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_cost_overrides" ADD CONSTRAINT "job_cost_overrides_panel_type_id_panel_types_id_fk" FOREIGN KEY ("panel_type_id") REFERENCES "public"."panel_types"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_level_cycle_times" ADD CONSTRAINT "job_level_cycle_times_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_members" ADD CONSTRAINT "job_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_members" ADD CONSTRAINT "job_members_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_members" ADD CONSTRAINT "job_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_members" ADD CONSTRAINT "job_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_panel_rates" ADD CONSTRAINT "job_panel_rates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_panel_rates" ADD CONSTRAINT "job_panel_rates_panel_type_id_panel_types_id_fk" FOREIGN KEY ("panel_type_id") REFERENCES "public"."panel_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "job_types" ADD CONSTRAINT "job_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_manager_id_users_id_fk" FOREIGN KEY ("project_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "jobs" ADD CONSTRAINT "jobs_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_list_panels" ADD CONSTRAINT "load_list_panels_load_list_id_load_lists_id_fk" FOREIGN KEY ("load_list_id") REFERENCES "public"."load_lists"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_list_panels" ADD CONSTRAINT "load_list_panels_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_lists" ADD CONSTRAINT "load_lists_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_lists" ADD CONSTRAINT "load_lists_trailer_type_id_trailer_types_id_fk" FOREIGN KEY ("trailer_type_id") REFERENCES "public"."trailer_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_lists" ADD CONSTRAINT "load_lists_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_lists" ADD CONSTRAINT "load_lists_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_return_panels" ADD CONSTRAINT "load_return_panels_load_return_id_load_returns_id_fk" FOREIGN KEY ("load_return_id") REFERENCES "public"."load_returns"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_return_panels" ADD CONSTRAINT "load_return_panels_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_returns" ADD CONSTRAINT "load_returns_load_list_id_load_lists_id_fk" FOREIGN KEY ("load_list_id") REFERENCES "public"."load_lists"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "load_returns" ADD CONSTRAINT "load_returns_returned_by_id_users_id_fk" FOREIGN KEY ("returned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "log_rows" ADD CONSTRAINT "log_rows_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "log_rows" ADD CONSTRAINT "log_rows_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "log_rows" ADD CONSTRAINT "log_rows_panel_register_id_panel_register_id_fk" FOREIGN KEY ("panel_register_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "log_rows" ADD CONSTRAINT "log_rows_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "public"."work_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "onboarding_template_tasks" ADD CONSTRAINT "onboarding_template_tasks_template_id_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_instrument_id_industrial_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."industrial_instruments"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_audit_logs" ADD CONSTRAINT "panel_audit_logs_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_audit_logs" ADD CONSTRAINT "panel_audit_logs_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_register" ADD CONSTRAINT "panel_register_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_register" ADD CONSTRAINT "panel_register_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "public"."work_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_register" ADD CONSTRAINT "panel_register_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_type_cost_components" ADD CONSTRAINT "panel_type_cost_components_panel_type_id_panel_types_id_fk" FOREIGN KEY ("panel_type_id") REFERENCES "public"."panel_types"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "panel_types" ADD CONSTRAINT "panel_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pm_call_log_levels" ADD CONSTRAINT "pm_call_log_levels_call_log_id_pm_call_logs_id_fk" FOREIGN KEY ("call_log_id") REFERENCES "public"."pm_call_logs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pm_call_log_levels" ADD CONSTRAINT "pm_call_log_levels_level_cycle_time_id_job_level_cycle_times_id_fk" FOREIGN KEY ("level_cycle_time_id") REFERENCES "public"."job_level_cycle_times"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pm_call_logs" ADD CONSTRAINT "pm_call_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pm_call_logs" ADD CONSTRAINT "pm_call_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pm_call_logs" ADD CONSTRAINT "pm_call_logs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_beds" ADD CONSTRAINT "production_beds_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_days" ADD CONSTRAINT "production_days_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_days" ADD CONSTRAINT "production_days_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_slot_adjustments" ADD CONSTRAINT "production_slot_adjustments_production_slot_id_production_slots_id_fk" FOREIGN KEY ("production_slot_id") REFERENCES "public"."production_slots"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_slot_adjustments" ADD CONSTRAINT "production_slot_adjustments_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "production_slots" ADD CONSTRAINT "production_slots_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claim_items" ADD CONSTRAINT "progress_claim_items_progress_claim_id_progress_claims_id_fk" FOREIGN KEY ("progress_claim_id") REFERENCES "public"."progress_claims"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claim_items" ADD CONSTRAINT "progress_claim_items_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_order_attachments" ADD CONSTRAINT "purchase_order_attachments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_order_attachments" ADD CONSTRAINT "purchase_order_attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedule_items" ADD CONSTRAINT "reo_schedule_items_schedule_id_reo_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."reo_schedules"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedule_items" ADD CONSTRAINT "reo_schedule_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedules" ADD CONSTRAINT "reo_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedules" ADD CONSTRAINT "reo_schedules_panel_id_panel_register_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel_register"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedules" ADD CONSTRAINT "reo_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedules" ADD CONSTRAINT "reo_schedules_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "reo_schedules" ADD CONSTRAINT "reo_schedules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sales_status_history" ADD CONSTRAINT "sales_status_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sales_status_history" ADD CONSTRAINT "sales_status_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sales_status_history" ADD CONSTRAINT "sales_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_files" ADD CONSTRAINT "task_files_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_files" ADD CONSTRAINT "task_files_update_id_task_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."task_updates"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_files" ADD CONSTRAINT "task_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_update_id_task_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."task_updates"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_updates" ADD CONSTRAINT "task_updates_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_updates" ADD CONSTRAINT "task_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_group_id_task_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."task_groups"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_events" ADD CONSTRAINT "timer_events_timer_session_id_timer_sessions_id_fk" FOREIGN KEY ("timer_session_id") REFERENCES "public"."timer_sessions"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_events" ADD CONSTRAINT "timer_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_panel_register_id_panel_register_id_fk" FOREIGN KEY ("panel_register_id") REFERENCES "public"."panel_register"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "public"."work_types"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_log_row_id_log_rows_id_fk" FOREIGN KEY ("log_row_id") REFERENCES "public"."log_rows"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "trailer_types" ADD CONSTRAINT "trailer_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_chat_settings" ADD CONSTRAINT "user_chat_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_job_report_schedules" ADD CONSTRAINT "weekly_job_report_schedules_report_id_weekly_job_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_job_reports"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_job_report_schedules" ADD CONSTRAINT "weekly_job_report_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_job_reports" ADD CONSTRAINT "weekly_job_reports_project_manager_id_users_id_fk" FOREIGN KEY ("project_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_job_reports" ADD CONSTRAINT "weekly_job_reports_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_wage_reports" ADD CONSTRAINT "weekly_wage_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_wage_reports" ADD CONSTRAINT "weekly_wage_reports_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "weekly_wage_reports" ADD CONSTRAINT "weekly_wage_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_types" ADD CONSTRAINT "work_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "zones" ADD CONSTRAINT "zones_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_consultants_company_idx" ON "activity_consultants" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_stages_company_idx" ON "activity_stages" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_stages_sort_order_idx" ON "activity_stages" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_template_subtasks_template_idx" ON "activity_template_subtasks" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_templates_job_type_idx" ON "activity_templates" USING btree ("job_type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_templates_stage_idx" ON "activity_templates" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_templates_company_idx" ON "activity_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_templates_sort_order_idx" ON "activity_templates" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_events_daily_log_id_idx" ON "approval_events" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_asset_idx" ON "asset_maintenance_records" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_company_idx" ON "asset_maintenance_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_asset_idx" ON "asset_transfers" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_company_idx" ON "asset_transfers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_company_idx" ON "assets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_category_idx" ON "assets" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assets_asset_tag_idx" ON "assets" USING btree ("asset_tag","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_event_type_idx" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cfmeu_holidays_calendar_date_company_idx" ON "cfmeu_holidays" USING btree ("calendar_type","date","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cfmeu_holidays_year_idx" ON "cfmeu_holidays" USING btree ("year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cfmeu_holidays_company_idx" ON "cfmeu_holidays" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_attachments_message_idx" ON "chat_message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_mention_unique" ON "chat_message_mentions" USING btree ("message_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_mention_user_idx" ON "chat_message_mentions" USING btree ("mentioned_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_reaction_unique" ON "chat_message_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_reactions_message_idx" ON "chat_message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conv_created_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_notif_user_created_idx" ON "chat_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_topics_company_idx" ON "chat_topics" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_company_idx" ON "checklist_instances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_template_idx" ON "checklist_instances" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_status_idx" ON "checklist_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_job_idx" ON "checklist_instances" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_panel_idx" ON "checklist_instances" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_assigned_to_idx" ON "checklist_instances" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_templates_company_idx" ON "checklist_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_templates_entity_type_idx" ON "checklist_templates" USING btree ("entity_type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_templates_entity_subtype_idx" ON "checklist_templates" USING btree ("entity_subtype_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_templates_active_idx" ON "checklist_templates" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_code_idx" ON "companies" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_active_idx" ON "companies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_company_id_idx" ON "contracts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_job_id_idx" ON "contracts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_contract_status_idx" ON "contracts" USING btree ("contract_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_job_company_unique_idx" ON "contracts" USING btree ("job_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conv_member_unique" ON "conversation_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_member_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_member_conv_idx" ON "conversation_members" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_type_idx" ON "conversations" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_topic_idx" ON "conversations" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_job_idx" ON "conversations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_panel_idx" ON "conversations" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_company_idx" ON "conversations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_abn_idx" ON "customers" USING btree ("abn");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_company_idx" ON "customers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_log_day_discipline_factory_idx" ON "daily_logs" USING btree ("user_id","log_day","discipline","factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_logs_log_day_idx" ON "daily_logs" USING btree ("log_day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_logs_factory_idx" ON "daily_logs" USING btree ("factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_records_load_list_id_idx" ON "delivery_records" USING btree ("load_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_records_delivery_date_idx" ON "delivery_records" USING btree ("delivery_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_code_company_idx" ON "departments" USING btree ("code","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_company_idx" ON "devices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_access_logs_bundle_idx" ON "document_bundle_access_logs" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_access_logs_document_idx" ON "document_bundle_access_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_access_logs_accessed_at_idx" ON "document_bundle_access_logs" USING btree ("accessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bundle_doc_unique_idx" ON "document_bundle_items" USING btree ("bundle_id","document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_items_bundle_idx" ON "document_bundle_items" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_items_document_idx" ON "document_bundle_items" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bundles_qr_code_idx" ON "document_bundles" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_company_idx" ON "document_bundles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_job_idx" ON "document_bundles" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_supplier_idx" ON "document_bundles" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_created_by_idx" ON "document_bundles" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_expires_idx" ON "document_bundles" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_categories_active_idx" ON "document_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_categories_company_idx" ON "document_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_disciplines_active_idx" ON "document_disciplines" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_disciplines_company_idx" ON "document_disciplines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_type_statuses_type_idx" ON "document_type_statuses" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_type_statuses_company_idx" ON "document_type_statuses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_type_statuses_active_idx" ON "document_type_statuses" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "doc_types_prefix_company_idx" ON "document_types_config" USING btree ("prefix","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_types_active_idx" ON "document_types_config" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_types_company_idx" ON "document_types_config" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_company_idx" ON "documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_doc_number_idx" ON "documents" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_type_idx" ON "documents" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_discipline_idx" ON "documents" USING btree ("discipline_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_job_idx" ON "documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_panel_idx" ON "documents" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_supplier_idx" ON "documents" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_po_idx" ON "documents" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_task_idx" ON "documents" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_conversation_idx" ON "documents" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_message_idx" ON "documents" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_uploaded_by_idx" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_latest_version_idx" ON "documents" USING btree ("is_latest_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_parent_doc_idx" ON "documents" USING btree ("parent_document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_job_latest_idx" ON "documents" USING btree ("job_id","is_latest_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_latest_idx" ON "documents" USING btree ("status","is_latest_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafting_program_panel_id_idx" ON "drafting_program" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafting_program_job_id_idx" ON "drafting_program" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafting_program_slot_id_idx" ON "drafting_program" USING btree ("production_slot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafting_program_assigned_to_idx" ON "drafting_program" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafting_program_status_idx" ON "drafting_program" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drafting_program_due_date_idx" ON "drafting_program" USING btree ("drawing_due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_documents_company_idx" ON "employee_documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_documents_employee_idx" ON "employee_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_documents_category_idx" ON "employee_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_documents_expiry_idx" ON "employee_documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_employments_company_idx" ON "employee_employments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_employments_employee_idx" ON "employee_employments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_employments_status_idx" ON "employee_employments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_employments_start_date_idx" ON "employee_employments" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_licences_company_idx" ON "employee_licences" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_licences_employee_idx" ON "employee_licences" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_licences_expiry_idx" ON "employee_licences" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emp_licences_type_idx" ON "employee_licences" USING btree ("licence_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboarding_tasks_onboarding_idx" ON "employee_onboarding_tasks" USING btree ("onboarding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboarding_tasks_status_idx" ON "employee_onboarding_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboarding_tasks_owner_idx" ON "employee_onboarding_tasks" USING btree ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboardings_company_idx" ON "employee_onboardings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboardings_employee_idx" ON "employee_onboardings" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboardings_employment_idx" ON "employee_onboardings" USING btree ("employment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_onboardings_status_idx" ON "employee_onboardings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_company_idx" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_user_idx" ON "employees" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employees_emp_number_company_idx" ON "employees" USING btree ("employee_number","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_last_name_idx" ON "employees" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_active_idx" ON "employees" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eot_claims_job_idx" ON "eot_claims" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eot_claims_status_idx" ON "eot_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eot_claims_created_by_idx" ON "eot_claims" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eot_claims_weekly_report_idx" ON "eot_claims" USING btree ("weekly_report_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "factories_code_company_idx" ON "factories" USING btree ("code","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "factories_active_idx" ON "factories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "factories_company_idx" ON "factories" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "global_settings_company_idx" ON "global_settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "help_key_idx" ON "help_entries" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_scope_idx" ON "help_entries" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_category_idx" ON "help_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_route_idx" ON "help_entries" USING btree ("page_route");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_status_idx" ON "help_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_status_updated_idx" ON "help_entries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_version_entry_idx" ON "help_entry_versions" USING btree ("help_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_version_key_idx" ON "help_entry_versions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hire_bookings_booking_number_company_idx" ON "hire_bookings" USING btree ("booking_number","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_status_idx" ON "hire_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_job_idx" ON "hire_bookings" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_supplier_idx" ON "hire_bookings" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_asset_idx" ON "hire_bookings" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_requested_by_idx" ON "hire_bookings" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_company_idx" ON "hire_bookings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hire_bookings_hire_source_idx" ON "hire_bookings" USING btree ("hire_source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "industrial_instruments_company_idx" ON "industrial_instruments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "industrial_instruments_active_idx" ON "industrial_instruments" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "item_categories_name_company_idx" ON "item_categories" USING btree ("name","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_categories_company_idx" ON "item_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_code_idx" ON "items" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_name_idx" ON "items" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_category_idx" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_supplier_idx" ON "items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_company_idx" ON "items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_item_type_idx" ON "items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_job_idx" ON "job_activities" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_stage_idx" ON "job_activities" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_template_idx" ON "job_activities" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_parent_idx" ON "job_activities" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_company_idx" ON "job_activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_status_idx" ON "job_activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_sort_order_idx" ON "job_activities" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_reminder_idx" ON "job_activities" USING btree ("reminder_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activities_job_phase_idx" ON "job_activities" USING btree ("job_phase");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_activity_assignees_activity_user_idx" ON "job_activity_assignees" USING btree ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activity_assignees_activity_idx" ON "job_activity_assignees" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activity_assignees_user_idx" ON "job_activity_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activity_files_activity_idx" ON "job_activity_files" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activity_files_update_idx" ON "job_activity_files" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activity_updates_activity_idx" ON "job_activity_updates" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_activity_updates_created_at_idx" ON "job_activity_updates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_audit_logs_job_id_idx" ON "job_audit_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_audit_logs_created_at_idx" ON "job_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_cost_overrides_job_id_idx" ON "job_cost_overrides" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_cost_overrides_panel_type_id_idx" ON "job_cost_overrides" USING btree ("panel_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_cost_overrides_unique_idx" ON "job_cost_overrides" USING btree ("job_id","panel_type_id","component_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_level_cycle_times_job_id_idx" ON "job_level_cycle_times" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_level_cycle_times_unique_idx" ON "job_level_cycle_times" USING btree ("job_id","building_number","level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_level_cycle_times_seq_idx" ON "job_level_cycle_times" USING btree ("job_id","sequence_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_members_job_user_idx" ON "job_members" USING btree ("job_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_members_job_id_idx" ON "job_members" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_members_user_id_idx" ON "job_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_members_company_idx" ON "job_members" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_panel_rates_job_panel_type_idx" ON "job_panel_rates" USING btree ("job_id","panel_type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_types_company_idx" ON "job_types" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_types_name_company_idx" ON "job_types" USING btree ("name","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_job_number_company_idx" ON "jobs" USING btree ("job_number","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_job_phase_idx" ON "jobs" USING btree ("job_phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_code_idx" ON "jobs" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_project_manager_idx" ON "jobs" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_factory_idx" ON "jobs" USING btree ("factory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_job_type_idx" ON "jobs" USING btree ("job_type_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_list_panels_load_list_id_idx" ON "load_list_panels" USING btree ("load_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_list_panels_panel_id_idx" ON "load_list_panels" USING btree ("panel_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "load_list_panels_unique_idx" ON "load_list_panels" USING btree ("load_list_id","panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_lists_job_id_idx" ON "load_lists" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_lists_load_date_idx" ON "load_lists" USING btree ("load_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_lists_status_idx" ON "load_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_lists_factory_idx" ON "load_lists" USING btree ("factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_return_panels_return_id_idx" ON "load_return_panels" USING btree ("load_return_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_return_panels_panel_id_idx" ON "load_return_panels" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_returns_load_list_id_idx" ON "load_returns" USING btree ("load_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_returns_return_date_idx" ON "load_returns" USING btree ("return_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_rows_daily_log_id_idx" ON "log_rows" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_rows_job_id_idx" ON "log_rows" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_rows_panel_register_id_idx" ON "log_rows" USING btree ("panel_register_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_rows_start_at_idx" ON "log_rows" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_rows_app_idx" ON "log_rows" USING btree ("app");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "log_rows_file_name_idx" ON "log_rows" USING btree ("file_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mapping_rules_priority_idx" ON "mapping_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mapping_rules_job_id_idx" ON "mapping_rules" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mapping_rules_company_idx" ON "mapping_rules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_template_tasks_template_idx" ON "onboarding_template_tasks" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_template_tasks_sort_idx" ON "onboarding_template_tasks" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_templates_company_idx" ON "onboarding_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_templates_active_idx" ON "onboarding_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_audit_logs_panel_id_idx" ON "panel_audit_logs" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_audit_logs_created_at_idx" ON "panel_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_audit_logs_panel_created_at_idx" ON "panel_audit_logs" USING btree ("panel_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_register_job_id_idx" ON "panel_register" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_register_panel_mark_idx" ON "panel_register" USING btree ("panel_mark");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_register_panel_type_idx" ON "panel_register" USING btree ("panel_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_register_status_idx" ON "panel_register" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "panel_register_job_panel_idx" ON "panel_register" USING btree ("job_id","panel_mark");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_register_approved_for_production_idx" ON "panel_register" USING btree ("approved_for_production");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_register_lifecycle_status_idx" ON "panel_register" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_components_panel_type_id_idx" ON "panel_type_cost_components" USING btree ("panel_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cost_components_panel_type_name_idx" ON "panel_type_cost_components" USING btree ("panel_type_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "panel_types_code_company_idx" ON "panel_types" USING btree ("code","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "panel_types_company_idx" ON "panel_types" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pm_call_log_levels_call_log_id_idx" ON "pm_call_log_levels" USING btree ("call_log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pm_call_log_levels_level_cycle_time_id_idx" ON "pm_call_log_levels" USING btree ("level_cycle_time_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pm_call_logs_job_id_idx" ON "pm_call_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pm_call_logs_company_id_idx" ON "pm_call_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pm_call_logs_created_by_idx" ON "pm_call_logs" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pm_call_logs_call_date_idx" ON "pm_call_logs" USING btree ("call_date_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_beds_factory_idx" ON "production_beds" USING btree ("factory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_beds_active_idx" ON "production_beds" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "production_days_date_factory_idx" ON "production_days" USING btree ("production_date","factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_days_factory_idx" ON "production_days" USING btree ("factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_days_date_idx" ON "production_days" USING btree ("production_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_entries_panel_id_idx" ON "production_entries" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_entries_job_id_idx" ON "production_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_entries_user_id_idx" ON "production_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_entries_production_date_idx" ON "production_entries" USING btree ("production_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_entries_factory_idx" ON "production_entries" USING btree ("factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_entries_status_idx" ON "production_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_slot_adjustments_slot_id_idx" ON "production_slot_adjustments" USING btree ("production_slot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_slots_job_id_idx" ON "production_slots" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_slots_status_idx" ON "production_slots" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_slots_date_idx" ON "production_slots" USING btree ("production_slot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claim_items_claim_idx" ON "progress_claim_items" USING btree ("progress_claim_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claim_items_panel_idx" ON "progress_claim_items" USING btree ("panel_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "progress_claims_claim_number_company_idx" ON "progress_claims" USING btree ("claim_number","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claims_status_idx" ON "progress_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claims_job_id_idx" ON "progress_claims" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claims_company_id_idx" ON "progress_claims" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claims_created_by_idx" ON "progress_claims" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progress_claims_job_status_idx" ON "progress_claims" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_attachments_po_idx" ON "purchase_order_attachments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_attachments_uploaded_by_idx" ON "purchase_order_attachments" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_items_item_idx" ON "purchase_order_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_items_sort_order_idx" ON "purchase_order_items" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_po_number_company_idx" ON "purchase_orders" USING btree ("po_number","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_requested_by_idx" ON "purchase_orders" USING btree ("requested_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_company_idx" ON "purchase_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedule_items_schedule_idx" ON "reo_schedule_items" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedule_items_type_idx" ON "reo_schedule_items" USING btree ("reo_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedule_items_status_idx" ON "reo_schedule_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedule_items_po_idx" ON "reo_schedule_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedules_company_idx" ON "reo_schedules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedules_panel_idx" ON "reo_schedules" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedules_job_idx" ON "reo_schedules" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reo_schedules_status_idx" ON "reo_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_status_history_job_idx" ON "sales_status_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_status_history_company_idx" ON "sales_status_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_abn_idx" ON "suppliers" USING btree ("abn");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_company_idx" ON "suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_assignees_task_user_idx" ON "task_assignees" USING btree ("task_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_assignees_task_idx" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_assignees_user_idx" ON "task_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_files_task_idx" ON "task_files" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_files_update_idx" ON "task_files" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_groups_sort_order_idx" ON "task_groups" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_groups_company_idx" ON "task_groups" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_notif_user_created_idx" ON "task_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_notif_task_idx" ON "task_notifications" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_updates_task_idx" ON "task_updates" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_updates_created_at_idx" ON "task_updates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_group_idx" ON "tasks" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_parent_idx" ON "tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_job_idx" ON "tasks" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_job_activity_idx" ON "tasks" USING btree ("job_activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_sort_order_idx" ON "tasks" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_reminder_idx" ON "tasks" USING btree ("reminder_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_events_timer_session_id_idx" ON "timer_events" USING btree ("timer_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_events_user_id_idx" ON "timer_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_events_event_type_idx" ON "timer_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_sessions_user_id_idx" ON "timer_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_sessions_daily_log_id_idx" ON "timer_sessions" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_sessions_status_idx" ON "timer_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_sessions_started_at_idx" ON "timer_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timer_sessions_user_started_at_idx" ON "timer_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trailer_types_name_company_idx" ON "trailer_types" USING btree ("name","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trailer_types_company_idx" ON "trailer_types" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_chat_settings_popup_idx" ON "user_chat_settings" USING btree ("popup_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_user_function_idx" ON "user_permissions" USING btree ("user_id","function_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_permissions_user_id_idx" ON "user_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_company_idx" ON "users" USING btree ("email","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_company_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_job_report_schedules_report_idx" ON "weekly_job_report_schedules" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_job_report_schedules_job_idx" ON "weekly_job_report_schedules" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_job_reports_pm_idx" ON "weekly_job_reports" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_job_reports_date_idx" ON "weekly_job_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_job_reports_status_idx" ON "weekly_job_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_wage_reports_week_factory_company_idx" ON "weekly_wage_reports" USING btree ("week_start_date","week_end_date","factory","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_wage_reports_factory_idx" ON "weekly_wage_reports" USING btree ("factory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_wage_reports_week_start_idx" ON "weekly_wage_reports" USING btree ("week_start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_wage_reports_company_idx" ON "weekly_wage_reports" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "work_types_code_company_idx" ON "work_types" USING btree ("code","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_types_sort_order_idx" ON "work_types" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_types_company_idx" ON "work_types" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zones_code_company_idx" ON "zones" USING btree ("code","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zones_company_idx" ON "zones" USING btree ("company_id");