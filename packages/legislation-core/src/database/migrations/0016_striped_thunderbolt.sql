CREATE TABLE "legislation"."supporting_material_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"material_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"section_identifier" text,
	"heading" text,
	"source_start_offset" integer NOT NULL,
	"source_end_offset" integer NOT NULL,
	"text" text NOT NULL,
	"content_hash" char(64) NOT NULL,
	"search_vector" "tsvector",
	"embedding" vector(1536),
	"embedding_input_hash" char(64),
	"embedding_model" text,
	"embedded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supporting_material_sections_ordinal_check" CHECK ("legislation"."supporting_material_sections"."ordinal" >= 0),
	CONSTRAINT "supporting_material_sections_offsets_check" CHECK ("legislation"."supporting_material_sections"."source_start_offset" >= 0 and "legislation"."supporting_material_sections"."source_end_offset" >= "legislation"."supporting_material_sections"."source_start_offset"),
	CONSTRAINT "supporting_material_sections_text_check" CHECK (length("legislation"."supporting_material_sections"."text") > 0),
	CONSTRAINT "supporting_material_sections_hash_check" CHECK ("legislation"."supporting_material_sections"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "legislation"."supporting_material_sections" ADD CONSTRAINT "supporting_material_sections_material_id_supporting_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "legislation"."supporting_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supporting_material_sections_ordinal_uidx" ON "legislation"."supporting_material_sections" USING btree ("material_id","ordinal");--> statement-breakpoint
CREATE INDEX "supporting_material_sections_identifier_idx" ON "legislation"."supporting_material_sections" USING btree ("material_id","section_identifier");--> statement-breakpoint
CREATE INDEX "supporting_material_sections_search_vector_gin_idx" ON "legislation"."supporting_material_sections" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "supporting_material_sections_embedding_hnsw_idx" ON "legislation"."supporting_material_sections" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE FUNCTION "legislation"."update_supporting_material_section_search_vector"() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."heading", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."text", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "supporting_material_sections_search_vector_trigger"
BEFORE INSERT OR UPDATE OF "heading", "text" ON "legislation"."supporting_material_sections"
FOR EACH ROW EXECUTE FUNCTION "legislation"."update_supporting_material_section_search_vector"();
