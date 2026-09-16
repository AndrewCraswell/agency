ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "tenure_ordinal" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_tenure_ordinal_check" CHECK ("legislation"."organization_memberships"."tenure_ordinal" > 0);
--> statement-breakpoint
DROP INDEX "legislation"."organization_memberships_source_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_source_tenure_uidx" ON "legislation"."organization_memberships" USING btree ("organization_id", "source_id", "tenure_ordinal") WHERE "legislation"."organization_memberships"."source_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_active_source_uidx" ON "legislation"."organization_memberships" USING btree ("organization_id", "source_id") WHERE "legislation"."organization_memberships"."source_id" is not null and "legislation"."organization_memberships"."is_active" is true;
