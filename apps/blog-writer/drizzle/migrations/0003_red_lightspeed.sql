CREATE TABLE "blog_writer"."article_publication_events" (
	"tenant_id" uuid NOT NULL,
	"event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"shopify_article_gid" text,
	"shopify_article_url" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_publication_events_tenant_id_event_id_pk" PRIMARY KEY("tenant_id","event_id"),
	CONSTRAINT "article_publication_events_type_check" CHECK ("blog_writer"."article_publication_events"."event_type" in ('shopify_draft_saved', 'published', 'unpublished'))
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."article_revisions" (
	"tenant_id" uuid NOT NULL,
	"revision_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"origin" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" char(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_revisions_tenant_id_revision_id_pk" PRIMARY KEY("tenant_id","revision_id"),
	CONSTRAINT "article_revisions_origin_check" CHECK ("blog_writer"."article_revisions"."origin" in ('generated', 'edited', 'regenerated', 'imported')),
	CONSTRAINT "article_revisions_number_check" CHECK ("blog_writer"."article_revisions"."revision_number" > 0),
	CONSTRAINT "article_revisions_content_hash_check" CHECK ("blog_writer"."article_revisions"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" DROP CONSTRAINT "articles_draft_fk";
--> statement-breakpoint
DROP INDEX "blog_writer"."articles_draft_uidx";--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ALTER COLUMN "draft_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "destination_blog_gid" text;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "current_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "published_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "shopify_article_gid" text;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD COLUMN "shopify_article_url" text;--> statement-breakpoint
UPDATE "blog_writer"."articles" AS "article"
SET
	"idea_id" = "draft"."idea_id",
	"shopify_article_gid" = "draft"."shopify_article_gid",
	"destination_blog_gid" = "draft"."destination_blog_gid",
	"status" = CASE "draft"."status"
		WHEN 'generating' THEN 'draft'
		WHEN 'review' THEN 'needs_review'
		WHEN 'approved' THEN 'ready_to_publish'
		WHEN 'published' THEN 'published'
		ELSE 'failed'
	END
FROM "blog_writer"."blog_drafts" AS "draft"
WHERE "draft"."tenant_id" = "article"."tenant_id" AND "draft"."draft_id" = "article"."draft_id";--> statement-breakpoint
DELETE FROM "blog_writer"."articles" WHERE "idea_id" IS NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ALTER COLUMN "idea_id" SET NOT NULL;--> statement-breakpoint
INSERT INTO "blog_writer"."article_revisions" ("tenant_id", "article_id", "revision_number", "origin", "title", "excerpt", "body", "content_hash", "created_at")
SELECT "article"."tenant_id", "article"."article_id", 1, 'generated', "draft"."title", "draft"."excerpt", "draft"."content", "draft"."content_hash", "draft"."created_at"
FROM "blog_writer"."articles" AS "article"
JOIN "blog_writer"."blog_drafts" AS "draft"
	ON "draft"."tenant_id" = "article"."tenant_id" AND "draft"."draft_id" = "article"."draft_id";--> statement-breakpoint
UPDATE "blog_writer"."articles" AS "article"
SET "current_revision_id" = "revision"."revision_id"
FROM "blog_writer"."article_revisions" AS "revision"
WHERE
	"revision"."tenant_id" = "article"."tenant_id"
	AND "revision"."article_id" = "article"."article_id"
	AND "revision"."revision_number" = 1;--> statement-breakpoint
UPDATE "blog_writer"."articles"
SET "published_revision_id" = "current_revision_id"
WHERE "status" = 'published' AND "current_revision_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_publication_events" ADD CONSTRAINT "article_publication_events_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_publication_events" ADD CONSTRAINT "article_publication_events_article_fk" FOREIGN KEY ("tenant_id","article_id") REFERENCES "blog_writer"."articles"("tenant_id","article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_publication_events" ADD CONSTRAINT "article_publication_events_revision_fk" FOREIGN KEY ("tenant_id","revision_id") REFERENCES "blog_writer"."article_revisions"("tenant_id","revision_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD CONSTRAINT "article_revisions_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD CONSTRAINT "article_revisions_article_fk" FOREIGN KEY ("tenant_id","article_id") REFERENCES "blog_writer"."articles"("tenant_id","article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_publication_events_article_idx" ON "blog_writer"."article_publication_events" USING btree ("tenant_id","article_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "article_revisions_number_uidx" ON "blog_writer"."article_revisions" USING btree ("tenant_id","article_id","revision_number");--> statement-breakpoint
CREATE INDEX "article_revisions_article_idx" ON "blog_writer"."article_revisions" USING btree ("tenant_id","article_id","created_at");--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_idea_fk" FOREIGN KEY ("tenant_id","idea_id") REFERENCES "blog_writer"."blog_ideas"("tenant_id","idea_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_current_revision_fk" FOREIGN KEY ("tenant_id","current_revision_id") REFERENCES "blog_writer"."article_revisions"("tenant_id","revision_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_published_revision_fk" FOREIGN KEY ("tenant_id","published_revision_id") REFERENCES "blog_writer"."article_revisions"("tenant_id","revision_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_draft_fk" FOREIGN KEY ("tenant_id","draft_id") REFERENCES "blog_writer"."blog_drafts"("tenant_id","draft_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "blog_writer"."articles" USING btree ("tenant_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_draft_uidx" ON "blog_writer"."articles" USING btree ("tenant_id","draft_id") WHERE "blog_writer"."articles"."draft_id" is not null;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_status_check" CHECK ("blog_writer"."articles"."status" in ('draft', 'needs_review', 'ready_to_publish', 'published', 'needs_attention', 'failed'));--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_published_revision_check" CHECK ("blog_writer"."articles"."published_revision_id" is null or "blog_writer"."articles"."current_revision_id" is not null);