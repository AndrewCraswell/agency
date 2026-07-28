CREATE TABLE "blog_writer"."keyword_import_domains" (
	"tenant_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"is_own_domain" boolean NOT NULL,
	"domain_rank" double precision,
	"status" text DEFAULT 'running' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"available_row_count" integer,
	"cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"error_code" text,
	CONSTRAINT "keyword_import_domains_tenant_id_import_id_domain_pk" PRIMARY KEY("tenant_id","import_id","domain"),
	CONSTRAINT "keyword_import_domains_status_check" CHECK ("blog_writer"."keyword_import_domains"."status" in ('running', 'succeeded', 'failed')),
	CONSTRAINT "keyword_import_domains_row_count_check" CHECK ("blog_writer"."keyword_import_domains"."row_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."keyword_imports" (
	"tenant_id" uuid NOT NULL,
	"import_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"location_name" text NOT NULL,
	"language_code" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	CONSTRAINT "keyword_imports_tenant_id_import_id_pk" PRIMARY KEY("tenant_id","import_id"),
	CONSTRAINT "keyword_imports_status_check" CHECK ("blog_writer"."keyword_imports"."status" in ('running', 'succeeded', 'partial', 'failed')),
	CONSTRAINT "keyword_imports_trigger_check" CHECK ("blog_writer"."keyword_imports"."trigger" in ('scheduled', 'manual')),
	CONSTRAINT "keyword_imports_row_count_check" CHECK ("blog_writer"."keyword_imports"."row_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."keyword_observations" (
	"tenant_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"domain" text NOT NULL,
	"is_own_domain" boolean NOT NULL,
	"rank_absolute" integer NOT NULL,
	"rank_group" integer,
	"ranking_url" text,
	"previous_rank_absolute" integer,
	"search_volume" integer,
	"monthly_searches" jsonb,
	"difficulty" integer,
	"main_intent" text,
	"foreign_intents" text[] DEFAULT '{}'::text[] NOT NULL,
	"serp_item_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"serp_average_domain_rank" double precision,
	"serp_result_count" integer,
	"estimated_traffic_volume" double precision,
	"field_freshness" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keyword_observations_tenant_id_import_id_keyword_domain_pk" PRIMARY KEY("tenant_id","import_id","keyword","domain"),
	CONSTRAINT "keyword_observations_rank_check" CHECK ("blog_writer"."keyword_observations"."rank_absolute" > 0),
	CONSTRAINT "keyword_observations_previous_rank_check" CHECK ("blog_writer"."keyword_observations"."previous_rank_absolute" is null or "blog_writer"."keyword_observations"."previous_rank_absolute" > 0),
	CONSTRAINT "keyword_observations_volume_check" CHECK ("blog_writer"."keyword_observations"."search_volume" is null or "blog_writer"."keyword_observations"."search_volume" >= 0)
);
--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_jobs" DROP CONSTRAINT "tenant_jobs_type_check";--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD COLUMN "market_country_code" char(2);--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD COLUMN "market_language_code" text;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD COLUMN "market_source" text;--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_import_domains" ADD CONSTRAINT "keyword_import_domains_import_fk" FOREIGN KEY ("tenant_id","import_id") REFERENCES "blog_writer"."keyword_imports"("tenant_id","import_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_imports" ADD CONSTRAINT "keyword_imports_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_observations" ADD CONSTRAINT "keyword_observations_import_fk" FOREIGN KEY ("tenant_id","import_id") REFERENCES "blog_writer"."keyword_imports"("tenant_id","import_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keyword_imports_requested_idx" ON "blog_writer"."keyword_imports" USING btree ("tenant_id","requested_at");--> statement-breakpoint
CREATE INDEX "keyword_observations_keyword_idx" ON "blog_writer"."keyword_observations" USING btree ("tenant_id","import_id","keyword");--> statement-breakpoint
CREATE INDEX "keyword_observations_domain_idx" ON "blog_writer"."keyword_observations" USING btree ("tenant_id","import_id","domain");--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_jobs" ADD CONSTRAINT "tenant_jobs_type_check" CHECK ("blog_writer"."tenant_jobs"."job_type" in ('onboarding', 'catalog_sync', 'content_sync', 'indexing', 'reconciliation', 'idea_generation', 'draft_generation', 'crosslinks', 'further_reading', 'keyword_import'));--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD CONSTRAINT "tenant_stores_market_country_check" CHECK ("blog_writer"."tenant_stores"."market_country_code" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD CONSTRAINT "tenant_stores_market_language_check" CHECK ("blog_writer"."tenant_stores"."market_language_code" ~ '^[a-z]{2}$');--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD CONSTRAINT "tenant_stores_market_source_check" CHECK ("blog_writer"."tenant_stores"."market_source" is null or "blog_writer"."tenant_stores"."market_source" in ('shopify', 'merchant'));--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_stores" ADD CONSTRAINT "tenant_stores_market_complete_check" CHECK (("blog_writer"."tenant_stores"."market_country_code" is null and "blog_writer"."tenant_stores"."market_language_code" is null and "blog_writer"."tenant_stores"."market_source" is null) or ("blog_writer"."tenant_stores"."market_country_code" is not null and "blog_writer"."tenant_stores"."market_language_code" is not null and "blog_writer"."tenant_stores"."market_source" is not null));