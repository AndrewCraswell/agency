-- A 512-dimension embedding is not a re-encoding of a 1536-dimension one, so the stored vectors cannot be converted
-- in place and every row has to be embedded again under the new configuration. The three embedding columns are
-- cleared together because tenant_resource_chunks_embedding_check requires them to be null or populated as a set,
-- and clearing them is what lets the column type change proceed against rows that hold no value.
DROP INDEX "blog_writer"."tenant_resource_chunks_embedding_idx";--> statement-breakpoint
UPDATE "blog_writer"."tenant_resource_chunks" SET "embedding" = NULL, "embedding_model" = NULL, "embedding_version" = NULL;--> statement-breakpoint
ALTER TABLE "blog_writer"."tenant_resource_chunks" ALTER COLUMN "embedding" SET DATA TYPE halfvec(512);--> statement-breakpoint
CREATE INDEX "tenant_resource_chunks_embedding_idx" ON "blog_writer"."tenant_resource_chunks" USING hnsw ("embedding" halfvec_cosine_ops);