CREATE INDEX IF NOT EXISTS "amendments_embedding_shard_idx" ON "legislation"."amendments" USING btree ((((hashtextextended("id", 0) % 200) + 200) % 200),"id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bills_embedding_shard_idx" ON "legislation"."bills" USING btree ((((hashtextextended("id", 0) % 200) + 200) % 200),"id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_sections_embedding_shard_idx" ON "legislation"."document_sections" USING btree ((((hashtextextended("id", 0) % 200) + 200) % 200),"id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supporting_material_sections_embedding_shard_idx" ON "legislation"."supporting_material_sections" USING btree ((((hashtextextended("id", 0) % 200) + 200) % 200),"id");
