CREATE TABLE "blog_writer"."articles" (
	"tenant_id" uuid NOT NULL,
	"article_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_tenant_id_article_id_pk" PRIMARY KEY("tenant_id","article_id")
);
--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD COLUMN "article_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD COLUMN "destination_type" text;--> statement-breakpoint
INSERT INTO "blog_writer"."articles" ("tenant_id", "draft_id", "created_at", "updated_at")
SELECT "tenant_id", "draft_id", "created_at", "updated_at"
FROM "blog_writer"."blog_drafts";--> statement-breakpoint
UPDATE "blog_writer"."blog_recommendations" AS "recommendation"
SET
	"article_id" = "article"."article_id",
	"destination_type" = "resource"."resource_type"
FROM "blog_writer"."articles" AS "article", "blog_writer"."tenant_resources" AS "resource"
WHERE
	"article"."tenant_id" = "recommendation"."tenant_id"
	AND "article"."draft_id" = "recommendation"."draft_id"
	AND "resource"."tenant_id" = "recommendation"."tenant_id"
	AND "resource"."resource_id" = "recommendation"."destination_resource_id";--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."articles" ADD CONSTRAINT "articles_draft_fk" FOREIGN KEY ("tenant_id","draft_id") REFERENCES "blog_writer"."blog_drafts"("tenant_id","draft_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_draft_uidx" ON "blog_writer"."articles" USING btree ("tenant_id","draft_id");--> statement-breakpoint
CREATE INDEX "articles_updated_idx" ON "blog_writer"."articles" USING btree ("tenant_id","updated_at");--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_article_fk" FOREIGN KEY ("tenant_id","article_id") REFERENCES "blog_writer"."articles"("tenant_id","article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_recommendations_article_destination_uidx" ON "blog_writer"."blog_recommendations" USING btree ("tenant_id","article_id","objective","destination_resource_id") WHERE "blog_writer"."blog_recommendations"."article_id" is not null;--> statement-breakpoint
CREATE INDEX "blog_recommendations_article_review_idx" ON "blog_writer"."blog_recommendations" USING btree ("tenant_id","article_id","status");--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_article_type_check" CHECK (("blog_writer"."blog_recommendations"."article_id" is null and "blog_writer"."blog_recommendations"."destination_type" is null) or ("blog_writer"."blog_recommendations"."article_id" is not null and "blog_writer"."blog_recommendations"."destination_type" is not null));--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_destination_type_check" CHECK ("blog_writer"."blog_recommendations"."destination_type" is null or "blog_writer"."blog_recommendations"."destination_type" in ('product', 'collection', 'blog', 'article', 'page'));--> statement-breakpoint
ALTER TABLE "blog_writer"."blog_recommendations" ADD CONSTRAINT "blog_recommendations_further_reading_type_check" CHECK ("blog_writer"."blog_recommendations"."objective" <> 'further_reading' or "blog_writer"."blog_recommendations"."destination_type" is null or "blog_writer"."blog_recommendations"."destination_type" = 'article');