CREATE TYPE "legislation"."organization_membership_end_reason" AS ENUM('roster_removal_detected', 'congress_ended');
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" RENAME COLUMN "start_date" TO "effective_start_date";
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" RENAME COLUMN "end_date" TO "effective_end_date";
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "legislative_session_id" text;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "detected_start_date" date;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "detected_end_date" date;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "last_observed_date" date;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD COLUMN "ended_reason" "legislation"."organization_membership_end_reason";
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_legislative_session_id_legislative_sessions_id_fk" FOREIGN KEY ("legislative_session_id") REFERENCES "legislation"."legislative_sessions"("id") ON DELETE restrict ON UPDATE no action NOT VALID;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" DROP CONSTRAINT "organization_memberships_dates_check";
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_effective_dates_check" CHECK ("legislation"."organization_memberships"."effective_start_date" is null or "legislation"."organization_memberships"."effective_end_date" is null or "legislation"."organization_memberships"."effective_start_date" <= "legislation"."organization_memberships"."effective_end_date") NOT VALID;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_detected_dates_check" CHECK ("legislation"."organization_memberships"."detected_start_date" is null or "legislation"."organization_memberships"."detected_end_date" is null or "legislation"."organization_memberships"."detected_start_date" <= "legislation"."organization_memberships"."detected_end_date") NOT VALID;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_last_observed_check" CHECK ("legislation"."organization_memberships"."detected_start_date" is null or "legislation"."organization_memberships"."last_observed_date" is null or "legislation"."organization_memberships"."detected_start_date" <= "legislation"."organization_memberships"."last_observed_date") NOT VALID;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_roster_removal_check" CHECK ("legislation"."organization_memberships"."ended_reason" is distinct from 'roster_removal_detected' or "legislation"."organization_memberships"."detected_end_date" is not null) NOT VALID;
--> statement-breakpoint
ALTER TABLE "legislation"."organization_memberships" ADD CONSTRAINT "organization_memberships_congress_end_check" CHECK ("legislation"."organization_memberships"."ended_reason" is distinct from 'congress_ended' or ("legislation"."organization_memberships"."legislative_session_id" is not null and "legislation"."organization_memberships"."detected_end_date" is null)) NOT VALID;
--> statement-breakpoint
DROP INDEX "legislation"."organization_memberships_person_idx";
--> statement-breakpoint
CREATE INDEX "organization_memberships_person_idx" ON "legislation"."organization_memberships" USING btree ("person_id", "effective_start_date", "detected_start_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_session_tenure_uidx" ON "legislation"."organization_memberships" USING btree ("organization_id", "person_id", "legislative_session_id", "tenure_ordinal") WHERE "legislation"."organization_memberships"."legislative_session_id" is not null;
--> statement-breakpoint
CREATE INDEX "organization_memberships_session_idx" ON "legislation"."organization_memberships" USING btree ("legislative_session_id", "is_active");
