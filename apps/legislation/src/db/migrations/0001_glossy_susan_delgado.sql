CREATE INDEX "bills_classification_gin_idx" ON "legislation"."bills" USING gin ("classification");--> statement-breakpoint
CREATE INDEX "bills_subjects_gin_idx" ON "legislation"."bills" USING gin ("subjects");--> statement-breakpoint
CREATE INDEX "bills_search_vector_gin_idx" ON "legislation"."bills" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "bills_embedding_hnsw_idx" ON "legislation"."bills" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "document_sections_search_vector_gin_idx" ON "legislation"."document_sections" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "document_sections_embedding_hnsw_idx" ON "legislation"."document_sections" USING hnsw ("embedding" vector_cosine_ops);