CREATE TABLE "legislation"."event_outcome_links" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"action_id" text,
	"vote_id" text,
	"link_method" text NOT NULL,
	"source_reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_outcome_links_target_check" CHECK (("legislation"."event_outcome_links"."action_id" is not null and "legislation"."event_outcome_links"."vote_id" is null) or ("legislation"."event_outcome_links"."action_id" is null and "legislation"."event_outcome_links"."vote_id" is not null)),
	CONSTRAINT "event_outcome_links_method_check" CHECK ("legislation"."event_outcome_links"."link_method" in ('explicit', 'deterministic-id')),
	CONSTRAINT "event_outcome_links_reference_check" CHECK (length("legislation"."event_outcome_links"."source_reference") > 0)
);
--> statement-breakpoint
ALTER TABLE "legislation"."event_outcome_links" ADD CONSTRAINT "event_outcome_links_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_outcome_links" ADD CONSTRAINT "event_outcome_links_action_id_bill_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "legislation"."bill_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_outcome_links" ADD CONSTRAINT "event_outcome_links_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "legislation"."votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_outcome_links_action_uidx" ON "legislation"."event_outcome_links" USING btree ("event_id","action_id") WHERE "legislation"."event_outcome_links"."action_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "event_outcome_links_vote_uidx" ON "legislation"."event_outcome_links" USING btree ("event_id","vote_id") WHERE "legislation"."event_outcome_links"."vote_id" is not null;--> statement-breakpoint
CREATE INDEX "event_outcome_links_event_idx" ON "legislation"."event_outcome_links" USING btree ("event_id","created_at");