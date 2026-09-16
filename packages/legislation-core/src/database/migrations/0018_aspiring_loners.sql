CREATE TABLE "legislation"."document_download_leases" (
	"host" text NOT NULL,
	"slot" integer NOT NULL,
	"owner_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_download_leases_host_slot_pk" PRIMARY KEY("host","slot"),
	CONSTRAINT "document_download_leases_host_check" CHECK (length("legislation"."document_download_leases"."host") > 0 and "legislation"."document_download_leases"."host" = lower("legislation"."document_download_leases"."host")),
	CONSTRAINT "document_download_leases_slot_check" CHECK ("legislation"."document_download_leases"."slot" > 0)
);
--> statement-breakpoint
CREATE INDEX "document_download_leases_expiry_idx" ON "legislation"."document_download_leases" USING btree ("expires_at");