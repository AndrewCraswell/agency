/**
 * A document continuation is deliberately longer than ordinary sync work, but
 * is still bounded. The same window guards recovery of claims left behind by a
 * hard-killed Trigger worker: another lane must never reclaim them while the
 * original worker could still be making publisher calls.
 */
export const DERIVED_DOCUMENT_WORKER_MAX_DURATION_SECONDS = 14_400
export const DERIVED_DOCUMENT_BATCH_SIZE = 100
export const DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE = 25

export const DERIVED_BACKFILL_KINDS = ["bill-documents", "supporting-materials", "embeddings"] as const
export type DerivedBackfillKind = (typeof DERIVED_BACKFILL_KINDS)[number]

export const EMBEDDING_JOB_KINDS = ["amendments", "bills", "materials", "sections"] as const
export type EmbeddingJobKind = (typeof EMBEDDING_JOB_KINDS)[number]
