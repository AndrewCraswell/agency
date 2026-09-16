CREATE TABLE "legislation"."event_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"agenda_association" text NOT NULL,
	"agenda_item_id" text,
	"classification" text NOT NULL,
	"description" text NOT NULL,
	"action_id" text,
	"vote_id" text,
	"link_method" text NOT NULL,
	"source_sequence" integer NOT NULL,
	"source_url" text NOT NULL,
	"source_provider" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"source_retrieved_at" timestamp with time zone NOT NULL,
	"source_is_official" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_outcomes_description_check" CHECK (length(btrim("legislation"."event_outcomes"."description")) > 0),
	CONSTRAINT "event_outcomes_source_sequence_check" CHECK ("legislation"."event_outcomes"."source_sequence" >= 0),
	CONSTRAINT "event_outcomes_classification_check" CHECK ("legislation"."event_outcomes"."classification" in ('action', 'vote', 'disposition', 'note')),
	CONSTRAINT "event_outcomes_agenda_association_check" CHECK (("legislation"."event_outcomes"."agenda_association" = 'explicit' and "legislation"."event_outcomes"."agenda_item_id" is not null) or ("legislation"."event_outcomes"."agenda_association" = 'none' and "legislation"."event_outcomes"."agenda_item_id" is null)),
	CONSTRAINT "event_outcomes_target_check" CHECK (("legislation"."event_outcomes"."classification" = 'action' and "legislation"."event_outcomes"."action_id" is not null and "legislation"."event_outcomes"."vote_id" is null) or ("legislation"."event_outcomes"."classification" = 'vote' and "legislation"."event_outcomes"."action_id" is null and "legislation"."event_outcomes"."vote_id" is not null) or ("legislation"."event_outcomes"."classification" in ('disposition', 'note') and "legislation"."event_outcomes"."action_id" is null and "legislation"."event_outcomes"."vote_id" is null)),
	CONSTRAINT "event_outcomes_link_method_check" CHECK ("legislation"."event_outcomes"."link_method" in ('explicit', 'deterministic-id')),
	CONSTRAINT "event_outcomes_source_url_check" CHECK ("legislation"."event_outcomes"."source_url" ~ '^https://'),
	CONSTRAINT "event_outcomes_source_provider_check" CHECK (length(btrim("legislation"."event_outcomes"."source_provider")) > 0)
);
--> statement-breakpoint
ALTER TABLE "legislation"."event_outcomes" ADD CONSTRAINT "event_outcomes_event_id_legislative_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_outcomes" ADD CONSTRAINT "event_outcomes_agenda_item_id_event_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "legislation"."event_agenda_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_outcomes" ADD CONSTRAINT "event_outcomes_action_id_bill_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "legislation"."bill_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."event_outcomes" ADD CONSTRAINT "event_outcomes_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "legislation"."votes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_outcomes_event_idx" ON "legislation"."event_outcomes" USING btree ("event_id","source_sequence","id");--> statement-breakpoint
CREATE INDEX "event_outcomes_agenda_idx" ON "legislation"."event_outcomes" USING btree ("agenda_item_id","event_id");