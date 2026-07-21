ALTER TABLE "agentic"."workflow_definitions" RENAME COLUMN "published_version" TO "active_published_version";
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_definitions" DROP CONSTRAINT "workflow_definitions_published_version_check";
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_definitions" ADD CONSTRAINT "workflow_definitions_active_published_version_check" CHECK ("agentic"."workflow_definitions"."active_published_version" is null or "agentic"."workflow_definitions"."active_published_version" > 0);
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_definitions" DROP CONSTRAINT "workflow_definitions_status_check";
--> statement-breakpoint
UPDATE "agentic"."workflow_definitions" SET "status" = 'draft' WHERE "status" = 'published';
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_definitions" ADD CONSTRAINT "workflow_definitions_status_check" CHECK ("agentic"."workflow_definitions"."status" in ('draft', 'archived'));