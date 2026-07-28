CREATE SCHEMA IF NOT EXISTS "blog_writer";
--> statement-breakpoint
CREATE TABLE "blog_writer"."blog_drafts" (
	"tenant_id" uuid NOT NULL,
	"draft_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"destination_blog_gid" text,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"content_hash" char(64) NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"shopify_article_gid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_drafts_tenant_id_draft_id_pk" PRIMARY KEY("tenant_id","draft_id"),
	CONSTRAINT "blog_drafts_content_hash_check" CHECK ("blog_writer"."blog_drafts"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "blog_drafts_status_check" CHECK ("blog_writer"."blog_drafts"."status" in ('generating', 'review', 'approved', 'published', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."blog_ideas" (
	"tenant_id" uuid NOT NULL,
	"idea_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"focus" text NOT NULL,
	"title" text NOT NULL,
	"angle" text NOT NULL,
	"target_keyword" text NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_ideas_tenant_id_idea_id_pk" PRIMARY KEY("tenant_id","idea_id"),
	CONSTRAINT "blog_ideas_status_check" CHECK ("blog_writer"."blog_ideas"."status" in ('proposed', 'selected', 'dismissed', 'drafted'))
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."blog_recommendations" (
	"tenant_id" uuid NOT NULL,
	"recommendation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"destination_resource_id" uuid NOT NULL,
	"objective" text NOT NULL,
	"source_revision" char(64) NOT NULL,
	"section_locator" text NOT NULL,
	"anchor_text" text NOT NULL,
	"rationale" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ranker" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_recommendations_tenant_id_recommendation_id_pk" PRIMARY KEY("tenant_id","recommendation_id"),
	CONSTRAINT "blog_recommendations_objective_check" CHECK ("blog_writer"."blog_recommendations"."objective" in ('commercial_crosslink', 'further_reading')),
	CONSTRAINT "blog_recommendations_revision_check" CHECK ("blog_writer"."blog_recommendations"."source_revision" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "blog_recommendations_status_check" CHECK ("blog_writer"."blog_recommendations"."status" in ('proposed', 'accepted', 'rejected', 'stale', 'applied'))
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."tenant_jobs" (
	"tenant_id" uuid NOT NULL,
	"job_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"cursor" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tenant_jobs_tenant_id_job_id_pk" PRIMARY KEY("tenant_id","job_id"),
	CONSTRAINT "tenant_jobs_type_check" CHECK ("blog_writer"."tenant_jobs"."job_type" in ('onboarding', 'catalog_sync', 'content_sync', 'indexing', 'reconciliation', 'idea_generation', 'draft_generation', 'crosslinks', 'further_reading')),
	CONSTRAINT "tenant_jobs_status_check" CHECK ("blog_writer"."tenant_jobs"."status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "tenant_jobs_attempt_count_check" CHECK ("blog_writer"."tenant_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."tenant_resource_chunks" (
	"tenant_id" uuid NOT NULL,
	"chunk_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"heading" text,
	"content" text NOT NULL,
	"source_hash" char(64) NOT NULL,
	"representation_version" integer NOT NULL,
	"embedding_model" text,
	"embedding_version" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "tenant_resource_chunks_tenant_id_chunk_id_pk" PRIMARY KEY("tenant_id","chunk_id"),
	CONSTRAINT "tenant_resource_chunks_ordinal_check" CHECK ("blog_writer"."tenant_resource_chunks"."ordinal" >= 0),
	CONSTRAINT "tenant_resource_chunks_source_hash_check" CHECK ("blog_writer"."tenant_resource_chunks"."source_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "tenant_resource_chunks_representation_version_check" CHECK ("blog_writer"."tenant_resource_chunks"."representation_version" > 0),
	CONSTRAINT "tenant_resource_chunks_embedding_check" CHECK (("blog_writer"."tenant_resource_chunks"."embedding_model" is null and "blog_writer"."tenant_resource_chunks"."embedding_version" is null) or ("blog_writer"."tenant_resource_chunks"."embedding_model" is not null and "blog_writer"."tenant_resource_chunks"."embedding_version" is not null)),
	CONSTRAINT "tenant_resource_chunks_deactivated_check" CHECK (("blog_writer"."tenant_resource_chunks"."is_active" and "blog_writer"."tenant_resource_chunks"."deactivated_at" is null) or (not "blog_writer"."tenant_resource_chunks"."is_active" and "blog_writer"."tenant_resource_chunks"."deactivated_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."tenant_resources" (
	"tenant_id" uuid NOT NULL,
	"resource_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"shopify_gid" text NOT NULL,
	"resource_type" text NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"canonical_url" text NOT NULL,
	"locale" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"indexing_status" text DEFAULT 'pending' NOT NULL,
	"representation_version" integer DEFAULT 1 NOT NULL,
	"content_hash" char(64) NOT NULL,
	"source_created_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"synchronized_at" timestamp with time zone NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_resources_tenant_id_resource_id_pk" PRIMARY KEY("tenant_id","resource_id"),
	CONSTRAINT "tenant_resources_type_check" CHECK ("blog_writer"."tenant_resources"."resource_type" in ('product', 'collection', 'blog', 'article', 'page')),
	CONSTRAINT "tenant_resources_indexing_status_check" CHECK ("blog_writer"."tenant_resources"."indexing_status" in ('pending', 'indexed', 'failed', 'stale')),
	CONSTRAINT "tenant_resources_representation_version_check" CHECK ("blog_writer"."tenant_resources"."representation_version" > 0),
	CONSTRAINT "tenant_resources_content_hash_check" CHECK ("blog_writer"."tenant_resources"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "tenant_resources_deactivated_check" CHECK (("blog_writer"."tenant_resources"."is_active" and "blog_writer"."tenant_resources"."deactivated_at" is null) or (not "blog_writer"."tenant_resources"."is_active" and "blog_writer"."tenant_resources"."deactivated_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."tenant_stores" (
	"tenant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_domain" text NOT NULL,
	"shop_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synchronized_at" timestamp with time zone,
	"uninstalled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_stores_domain_check" CHECK ("blog_writer"."tenant_stores"."shop_domain" ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
	CONSTRAINT "tenant_stores_status_check" CHECK ("blog_writer"."tenant_stores"."status" in ('active', 'uninstalled')),
	CONSTRAINT "tenant_stores_sync_status_check" CHECK ("blog_writer"."tenant_stores"."sync_status" in ('pending', 'syncing', 'ready', 'failed')),
	CONSTRAINT "tenant_stores_uninstalled_check" CHECK (("blog_writer"."tenant_stores"."status" = 'active' and "blog_writer"."tenant_stores"."uninstalled_at" is null) or ("blog_writer"."tenant_stores"."status" = 'uninstalled' and "blog_writer"."tenant_stores"."uninstalled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_drafts" ADD CONSTRAINT "blog_drafts_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_drafts" ADD CONSTRAINT "blog_drafts_idea_fk" FOREIGN KEY ("tenant_id","idea_id") REFERENCES "blog_writer"."blog_ideas"("tenant_id","idea_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_ideas" ADD CONSTRAINT "blog_ideas_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_draft_fk" FOREIGN KEY ("tenant_id","draft_id") REFERENCES "blog_writer"."blog_drafts"("tenant_id","draft_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_destination_fk" FOREIGN KEY ("tenant_id","destination_resource_id") REFERENCES "blog_writer"."tenant_resources"("tenant_id","resource_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_jobs" ADD CONSTRAINT "tenant_jobs_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_resource_chunks" ADD CONSTRAINT "tenant_resource_chunks_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_resource_chunks" ADD CONSTRAINT "tenant_resource_chunks_resource_fk" FOREIGN KEY ("tenant_id","resource_id") REFERENCES "blog_writer"."tenant_resources"("tenant_id","resource_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_resources" ADD CONSTRAINT "tenant_resources_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_drafts_idea_uidx" ON "blog_writer"."blog_drafts" USING btree ("tenant_id","idea_id");--> statement-breakpoint
CREATE INDEX "blog_drafts_status_idx" ON "blog_writer"."blog_drafts" USING btree ("tenant_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_ideas_title_uidx" ON "blog_writer"."blog_ideas" USING btree ("tenant_id","title");--> statement-breakpoint
CREATE INDEX "blog_ideas_status_idx" ON "blog_writer"."blog_ideas" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_recommendations_destination_uidx" ON "blog_writer"."blog_recommendations" USING btree ("tenant_id","draft_id","objective","destination_resource_id");--> statement-breakpoint
CREATE INDEX "blog_recommendations_review_idx" ON "blog_writer"."blog_recommendations" USING btree ("tenant_id","draft_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_jobs_idempotency_uidx" ON "blog_writer"."tenant_jobs" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "tenant_jobs_status_idx" ON "blog_writer"."tenant_jobs" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_resource_chunks_ordinal_uidx" ON "blog_writer"."tenant_resource_chunks" USING btree ("tenant_id","resource_id","representation_version","ordinal");--> statement-breakpoint
CREATE INDEX "tenant_resource_chunks_resource_idx" ON "blog_writer"."tenant_resource_chunks" USING btree ("tenant_id","resource_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_resources_shopify_gid_uidx" ON "blog_writer"."tenant_resources" USING btree ("tenant_id","shopify_gid");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_resources_canonical_url_uidx" ON "blog_writer"."tenant_resources" USING btree ("tenant_id","canonical_url");--> statement-breakpoint
CREATE INDEX "tenant_resources_retrieval_idx" ON "blog_writer"."tenant_resources" USING btree ("tenant_id","is_active","is_published","is_available","resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_stores_shop_domain_uidx" ON "blog_writer"."tenant_stores" USING btree ("shop_domain");