CREATE TABLE "blog_writer"."keyword_cluster_dismissals" (
	"tenant_id" uuid NOT NULL,
	"cluster_id" text NOT NULL,
	"head_keyword" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keyword_cluster_dismissals_tenant_id_cluster_id_pk" PRIMARY KEY("tenant_id","cluster_id")
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."keyword_clusters" (
	"tenant_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"cluster_id" text NOT NULL,
	"head_keyword" text NOT NULL,
	"head_demand" bigint DEFAULT 0 NOT NULL,
	"demand" bigint DEFAULT 0 NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"keyword_demand" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proof_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"competitor_top_ten" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"our_best_position" integer,
	"our_best_keyword" text,
	"our_head_position" integer,
	"our_ranking_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"largest_our_decline" jsonb,
	"main_intent" text,
	"intents" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty" integer,
	"serp_average_domain_rank" double precision,
	"serp_item_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"head_monthly_searches" jsonb,
	"has_editorial_proof" boolean DEFAULT false NOT NULL,
	"is_reachable" boolean DEFAULT false NOT NULL,
	"has_ai_overview" boolean DEFAULT false NOT NULL,
	"has_product_blocks" boolean DEFAULT false NOT NULL,
	"question_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "keyword_clusters_tenant_id_import_id_cluster_id_pk" PRIMARY KEY("tenant_id","import_id","cluster_id")
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."keyword_opportunities" (
	"tenant_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"cluster_id" text NOT NULL,
	"detector" text NOT NULL,
	"verdict" text NOT NULL,
	"rank" integer,
	"is_suppressed" boolean DEFAULT false NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"score_components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keyword_opportunities_tenant_id_import_id_cluster_id_detector_pk" PRIMARY KEY("tenant_id","import_id","cluster_id","detector"),
	CONSTRAINT "keyword_opportunities_verdict_check" CHECK ("blog_writer"."keyword_opportunities"."verdict" in ('new_article', 'refresh', 'schedule', 'no_action'))
);
--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_imports" ADD COLUMN "calibration" jsonb;--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_cluster_dismissals" ADD CONSTRAINT "keyword_cluster_dismissals_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_clusters" ADD CONSTRAINT "keyword_clusters_import_fk" FOREIGN KEY ("tenant_id","import_id") REFERENCES "blog_writer"."keyword_imports"("tenant_id","import_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."keyword_opportunities" ADD CONSTRAINT "keyword_opportunities_cluster_fk" FOREIGN KEY ("tenant_id","import_id","cluster_id") REFERENCES "blog_writer"."keyword_clusters"("tenant_id","import_id","cluster_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keyword_clusters_demand_idx" ON "blog_writer"."keyword_clusters" USING btree ("tenant_id","import_id","demand");--> statement-breakpoint
CREATE INDEX "keyword_opportunities_rank_idx" ON "blog_writer"."keyword_opportunities" USING btree ("tenant_id","import_id","is_suppressed","rank");