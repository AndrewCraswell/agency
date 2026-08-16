CREATE TABLE "legislation"."ingestion_locks" (
	"source" text NOT NULL,
	"operation" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_locks_source_operation_pk" PRIMARY KEY("source","operation"),
	CONSTRAINT "ingestion_locks_source_check" CHECK (length("legislation"."ingestion_locks"."source") > 0),
	CONSTRAINT "ingestion_locks_operation_check" CHECK (length("legislation"."ingestion_locks"."operation") > 0)
);
--> statement-breakpoint
CREATE INDEX "ingestion_locks_expiry_idx" ON "legislation"."ingestion_locks" USING btree ("expires_at");