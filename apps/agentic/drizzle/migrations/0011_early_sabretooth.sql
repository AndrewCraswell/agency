CREATE TABLE "agentic"."workflow_run_links" (
	"parent_run_id" uuid NOT NULL,
	"parent_activation_id" char(64) NOT NULL,
	"child_run_id" uuid NOT NULL,
	"child_package_digest" char(64) NOT NULL,
	"interface_digest" char(64) NOT NULL,
	"terminal_status" text,
	"result" jsonb,
	"error" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_run_links_parent_run_id_parent_activation_id_pk" PRIMARY KEY("parent_run_id","parent_activation_id"),
	CONSTRAINT "workflow_run_links_parent_activation_check" CHECK ("agentic"."workflow_run_links"."parent_activation_id" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_run_links_package_digest_check" CHECK ("agentic"."workflow_run_links"."child_package_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_run_links_interface_digest_check" CHECK ("agentic"."workflow_run_links"."interface_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workflow_run_links_terminal_status_check" CHECK ("agentic"."workflow_run_links"."terminal_status" is null or "agentic"."workflow_run_links"."terminal_status" in ('succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_parent_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_child_run_id_workflow_journal_runs_run_id_fk" FOREIGN KEY ("child_run_id") REFERENCES "agentic"."workflow_journal_runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_child_package_digest_workflow_execution_packages_package_digest_fk" FOREIGN KEY ("child_package_digest") REFERENCES "agentic"."workflow_execution_packages"("package_digest") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic"."workflow_run_links" ADD CONSTRAINT "workflow_run_links_parent_activation_fk" FOREIGN KEY ("parent_run_id","parent_activation_id") REFERENCES "agentic"."workflow_activations"("run_id","activation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_run_links_child_uidx" ON "agentic"."workflow_run_links" USING btree ("child_run_id");