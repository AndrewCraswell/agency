ALTER TABLE "legislation"."vote_positions" DROP CONSTRAINT "vote_positions_vote_id_person_id_pk";--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD COLUMN "source_identity" text;--> statement-breakpoint
UPDATE "legislation"."vote_positions" SET "source_identity" = "person_id" WHERE "source_identity" IS NULL;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ALTER COLUMN "source_identity" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ALTER COLUMN "person_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ALTER COLUMN "bill_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD CONSTRAINT "vote_positions_vote_id_source_identity_pk" PRIMARY KEY("vote_id","source_identity");--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD COLUMN "source_person_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD COLUMN "source_name" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "amendment_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "classification" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "roll_call_number" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "vote_type" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "question" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD COLUMN "requirement" text;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_session_id_legislative_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "legislation"."legislative_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vote_positions_source_person_idx" ON "legislation"."vote_positions" USING btree ("source_person_id","option");--> statement-breakpoint
CREATE INDEX "votes_amendment_idx" ON "legislation"."votes" USING btree ("amendment_id","held_at");--> statement-breakpoint
CREATE INDEX "votes_event_idx" ON "legislation"."votes" USING btree ("event_id","held_at");--> statement-breakpoint
CREATE INDEX "votes_organization_idx" ON "legislation"."votes" USING btree ("organization_id","held_at");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_source_uidx" ON "legislation"."votes" USING btree ("source_id") WHERE "legislation"."votes"."source_id" is not null;--> statement-breakpoint
ALTER TABLE "legislation"."vote_positions" ADD CONSTRAINT "vote_positions_source_identity_check" CHECK (length("legislation"."vote_positions"."source_identity") > 0);--> statement-breakpoint
ALTER TABLE "legislation"."votes" ADD CONSTRAINT "votes_target_check" CHECK ("legislation"."votes"."bill_id" is not null or "legislation"."votes"."amendment_id" is not null or "legislation"."votes"."event_id" is not null or "legislation"."votes"."organization_id" is not null or "legislation"."votes"."chamber" is not null);
