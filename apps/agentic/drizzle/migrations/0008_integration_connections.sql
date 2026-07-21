CREATE TABLE "agentic"."integration_connections" (
  "connection_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "provider_config_key" text NOT NULL,
  "nango_connection_id" text NOT NULL,
  "display_name" text,
  "status" text NOT NULL,
  "error_code" text,
  "last_checked_at" timestamp with time zone,
  "disconnected_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_connections_provider_check" CHECK ("agentic"."integration_connections"."provider" in ('github', 'linear')),
  CONSTRAINT "integration_connections_status_check" CHECK ("agentic"."integration_connections"."status" in ('connected', 'degraded', 'disconnected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_nango_uidx" ON "agentic"."integration_connections" USING btree ("provider_config_key", "nango_connection_id");
--> statement-breakpoint
CREATE INDEX "integration_connections_provider_idx" ON "agentic"."integration_connections" USING btree ("provider", "status");
--> statement-breakpoint
CREATE TABLE "agentic"."integration_resources" (
  "connection_id" uuid NOT NULL,
  "resource_type" text NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "selected" integer DEFAULT 0 NOT NULL,
  "stale" integer DEFAULT 0 NOT NULL,
  "last_discovered_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_resources_connection_id_resource_type_external_id_pk" PRIMARY KEY("connection_id", "resource_type", "external_id"),
  CONSTRAINT "integration_resources_type_check" CHECK ("agentic"."integration_resources"."resource_type" in ('repository', 'team')),
  CONSTRAINT "integration_resources_selected_check" CHECK ("agentic"."integration_resources"."selected" in (0, 1)),
  CONSTRAINT "integration_resources_stale_check" CHECK ("agentic"."integration_resources"."stale" in (0, 1)),
  CONSTRAINT "integration_resources_connection_fk" FOREIGN KEY ("connection_id") REFERENCES "agentic"."integration_connections"("connection_id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "integration_resources_connection_idx" ON "agentic"."integration_resources" USING btree ("connection_id", "resource_type");