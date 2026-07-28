CREATE TABLE IF NOT EXISTS "public"."blogs" (
	"hostname" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"last_sync" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."tenant_blog_subscriptions" (
	"tenant_id" uuid NOT NULL,
	"blog_hostname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_blog_subscriptions_tenant_id_blog_hostname_pk" PRIMARY KEY("tenant_id","blog_hostname")
);
--> statement-breakpoint
CREATE TABLE "blog_writer"."tenant_competitor_domains" (
	"tenant_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_competitor_domains_tenant_id_hostname_pk" PRIMARY KEY("tenant_id","hostname"),
	CONSTRAINT "tenant_competitor_domains_hostname_check" CHECK ("blog_writer"."tenant_competitor_domains"."hostname" ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$')
);
--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_blog_subscriptions" ADD CONSTRAINT "tenant_blog_subscriptions_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_blog_subscriptions" ADD CONSTRAINT "tenant_blog_subscriptions_blog_hostname_blogs_hostname_fk" FOREIGN KEY ("blog_hostname") REFERENCES "public"."blogs"("hostname") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_competitor_domains" ADD CONSTRAINT "tenant_competitor_domains_tenant_id_tenant_stores_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "blog_writer"."tenant_stores"("tenant_id") ON DELETE cascade ON UPDATE no action;