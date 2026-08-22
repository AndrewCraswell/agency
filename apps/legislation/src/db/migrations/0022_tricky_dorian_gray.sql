CREATE TABLE "legislation"."amendment_embeddings" (
	"amendment_id" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"input_contract" text NOT NULL,
	"input_hash" char(64) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"rollout_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amendment_embeddings_amendment_id_model_input_contract_pk" PRIMARY KEY("amendment_id","model","input_contract"),
	CONSTRAINT "amendment_embeddings_dimensions_check" CHECK ("legislation"."amendment_embeddings"."dimensions" = 1536),
	CONSTRAINT "amendment_embeddings_hash_check" CHECK ("legislation"."amendment_embeddings"."input_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "amendment_embeddings_model_check" CHECK (length("legislation"."amendment_embeddings"."model") > 0),
	CONSTRAINT "amendment_embeddings_contract_check" CHECK (length("legislation"."amendment_embeddings"."input_contract") > 0),
	CONSTRAINT "amendment_embeddings_rollout_check" CHECK (length("legislation"."amendment_embeddings"."rollout_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."bill_embeddings" (
	"bill_id" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"input_contract" text NOT NULL,
	"input_hash" char(64) NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"rollout_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_embeddings_bill_id_model_input_contract_pk" PRIMARY KEY("bill_id","model","input_contract"),
	CONSTRAINT "bill_embeddings_dimensions_check" CHECK ("legislation"."bill_embeddings"."dimensions" = 1024),
	CONSTRAINT "bill_embeddings_hash_check" CHECK ("legislation"."bill_embeddings"."input_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "bill_embeddings_model_check" CHECK (length("legislation"."bill_embeddings"."model") > 0),
	CONSTRAINT "bill_embeddings_contract_check" CHECK (length("legislation"."bill_embeddings"."input_contract") > 0),
	CONSTRAINT "bill_embeddings_rollout_check" CHECK (length("legislation"."bill_embeddings"."rollout_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."document_section_embeddings" (
	"section_id" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"input_contract" text NOT NULL,
	"input_hash" char(64) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"rollout_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_section_embeddings_section_id_model_input_contract_pk" PRIMARY KEY("section_id","model","input_contract"),
	CONSTRAINT "document_section_embeddings_dimensions_check" CHECK ("legislation"."document_section_embeddings"."dimensions" = 1536),
	CONSTRAINT "document_section_embeddings_hash_check" CHECK ("legislation"."document_section_embeddings"."input_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "document_section_embeddings_model_check" CHECK (length("legislation"."document_section_embeddings"."model") > 0),
	CONSTRAINT "document_section_embeddings_contract_check" CHECK (length("legislation"."document_section_embeddings"."input_contract") > 0),
	CONSTRAINT "document_section_embeddings_rollout_check" CHECK (length("legislation"."document_section_embeddings"."rollout_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "legislation"."supporting_material_section_embeddings" (
	"section_id" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"input_contract" text NOT NULL,
	"input_hash" char(64) NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"rollout_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supporting_material_section_embeddings_section_id_model_input_contract_pk" PRIMARY KEY("section_id","model","input_contract"),
	CONSTRAINT "supporting_material_section_embeddings_dimensions_check" CHECK ("legislation"."supporting_material_section_embeddings"."dimensions" = 1024),
	CONSTRAINT "supporting_material_section_embeddings_hash_check" CHECK ("legislation"."supporting_material_section_embeddings"."input_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "supporting_material_section_embeddings_model_check" CHECK (length("legislation"."supporting_material_section_embeddings"."model") > 0),
	CONSTRAINT "supporting_material_section_embeddings_contract_check" CHECK (length("legislation"."supporting_material_section_embeddings"."input_contract") > 0),
	CONSTRAINT "supporting_material_section_embeddings_rollout_check" CHECK (length("legislation"."supporting_material_section_embeddings"."rollout_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "legislation"."amendment_embeddings" ADD CONSTRAINT "amendment_embeddings_amendment_id_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "legislation"."amendments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."bill_embeddings" ADD CONSTRAINT "bill_embeddings_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "legislation"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."document_section_embeddings" ADD CONSTRAINT "document_section_embeddings_section_id_document_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "legislation"."document_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_section_embeddings" ADD CONSTRAINT "supporting_material_section_embeddings_section_id_supporting_material_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "legislation"."supporting_material_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amendment_embeddings_lookup_idx" ON "legislation"."amendment_embeddings" USING btree ("model","input_contract","amendment_id");--> statement-breakpoint
CREATE INDEX "amendment_embeddings_hnsw_idx" ON "legislation"."amendment_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "bill_embeddings_lookup_idx" ON "legislation"."bill_embeddings" USING btree ("model","input_contract","bill_id");--> statement-breakpoint
CREATE INDEX "bill_embeddings_hnsw_idx" ON "legislation"."bill_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "document_section_embeddings_lookup_idx" ON "legislation"."document_section_embeddings" USING btree ("model","input_contract","section_id");--> statement-breakpoint
CREATE INDEX "document_section_embeddings_hnsw_idx" ON "legislation"."document_section_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "supporting_material_section_embeddings_lookup_idx" ON "legislation"."supporting_material_section_embeddings" USING btree ("model","input_contract","section_id");--> statement-breakpoint
CREATE INDEX "supporting_material_section_embeddings_hnsw_idx" ON "legislation"."supporting_material_section_embeddings" USING hnsw ("embedding" vector_cosine_ops);