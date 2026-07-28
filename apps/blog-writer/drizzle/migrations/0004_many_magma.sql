ALTER TABLE "blog_writer"."article_revisions" ADD COLUMN "author" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD COLUMN "handle" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD COLUMN "seo_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD COLUMN "seo_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD COLUMN "image_alt_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."article_revisions" ADD CONSTRAINT "article_revisions_handle_check" CHECK ("blog_writer"."article_revisions"."handle" = '' or "blog_writer"."article_revisions"."handle" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');