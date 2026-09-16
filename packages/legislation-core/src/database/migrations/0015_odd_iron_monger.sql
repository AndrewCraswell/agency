CREATE TABLE "legislation"."bill_organizations" (
	"bill_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"classification" text NOT NULL,
	"source_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_organizations_bill_id_organization_id_classification_pk" PRIMARY KEY("bill_id","organization_id","classification"),
	CONSTRAINT "bill_organizations_classification_check" CHECK (length("legislation"."bill_organizations"."classification") > 0)
);
--> statement-breakpoint
ALTER TABLE "legislation"."bill_actions" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."bill_actions" ADD COLUMN "source_organization_id" text;--> statement-breakpoint
ALTER TABLE "legislation"."bill_organizations" ADD CONSTRAINT "bill_organizations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."bill_organizations" ADD CONSTRAINT "bill_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_organizations_organization_idx" ON "legislation"."bill_organizations" USING btree ("organization_id","bill_id");--> statement-breakpoint
ALTER TABLE "legislation"."bill_actions" ADD CONSTRAINT "bill_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "legislation"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_actions_organization_idx" ON "legislation"."bill_actions" USING btree ("organization_id","action_date");