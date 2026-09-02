import { describe, expect, it } from "vitest"
import { DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE } from "../../ingestion/backfill/derived.js"
import {
  createFullEmbeddingSyncStages,
  createDerivedLeaseHandoffResult,
  derivedBatchSizeFor,
  derivedDatabaseConnectionsFor,
  derivedPayloadSchema,
  derivedWorkerMaxBatchesFor,
  documentEmbeddingClassificationBackfillStatements,
  embeddingIndexMaintenanceStatements,
  embeddingIndexMaintenancePayload,
  FULL_EMBEDDING_PRODUCT_ORDER,
  isMaterialPhaseGateOpen,
  prepareDocumentEmbeddingClassificationBackfill,
  reconcileSupportingMaterialOcrCheckpoint
} from "./backfill-tasks.js"

describe("derived backfill task payload", () => {
  it("narrows an embedding wave to the strict index-maintenance contract", () => {
    expect(
      embeddingIndexMaintenancePayload({
        correlationId: "backfill:embedding-wave",
        rebuildId: "embedding-wave"
      })
    ).toEqual({ correlationId: "backfill:embedding-wave", rebuildId: "embedding-wave" })
  })

  it("drops invalid concurrent indexes before recreating them", () => {
    const statements = embeddingIndexMaintenanceStatements([
      "bill_embeddings_hnsw_idx",
      "document_section_embeddings_hnsw_idx"
    ])

    expect(statements).toContain("drop index concurrently if exists legislation.bill_embeddings_hnsw_idx")
    expect(statements).toContain("drop index concurrently if exists legislation.document_section_embeddings_hnsw_idx")
    expect(statements).not.toContain("drop index concurrently if exists legislation.amendment_embeddings_hnsw_idx")
    expect(statements.filter((statement) => statement.startsWith("create index concurrently"))).toHaveLength(5)
    expect(statements).toContain(
      "create index concurrently if not exists document_section_embeddings_amendment_hnsw_idx on legislation.document_section_embeddings using hnsw (embedding vector_cosine_ops) where document_classification = 'amendment' and model = 'openai/text-embedding-3-small' and input_contract = 'document-section-heading-text'"
    )
  })

  it("uses a restartable null-only classification backfill", () => {
    const statements = documentEmbeddingClassificationBackfillStatements()

    expect(statements.configureSession).toBe("set statement_timeout = 0")
    expect(statements.createHelperIndex).toContain(
      "on legislation.bill_documents (id) where classification = 'amendment'"
    )
    expect(statements.dropHelperIndex).toContain("bill_documents_amendment_classification_backfill_idx")
    expect(statements.refreshStatistics).toContain("document_classification")
    expect(statements.updateBatch).toContain("where embedding.document_classification is null")
    expect(statements.updateBatch).toContain("document.classification = 'amendment'")
    expect(statements.updateBatch).toContain("limit $1")
    expect(statements.updateBatch).toContain(
      "(document.id, embedding.section_id, embedding.model, embedding.input_contract)"
    )
    expect(statements.updateBatch).toContain("for update of embedding skip locked")
    expect(statements.verify).toContain("embedding.document_classification is distinct from document.classification")
    expect(statements.verify).toContain("where document.classification = 'amendment'")
  })

  it("disables the session statement timeout before classification maintenance SQL", async () => {
    const queries: string[] = []
    const client = {
      query: async (statement: string) => {
        queries.push(statement)
      }
    }

    await prepareDocumentEmbeddingClassificationBackfill(client)

    expect(queries).toEqual([
      "set statement_timeout = 0",
      expect.stringContaining("create index concurrently"),
      expect.stringContaining("analyze legislation.document_section_embeddings")
    ])
  })

  it("keeps material children inside the renewable ingestion lease", () => {
    expect(derivedWorkerMaxBatchesFor("bill-documents")).toBe(1)
    expect(derivedWorkerMaxBatchesFor("supporting-materials")).toBe(1)
    expect(derivedWorkerMaxBatchesFor("embeddings")).toBe(10)
    expect(derivedDatabaseConnectionsFor("bill-documents")).toBe(1)
    expect(derivedDatabaseConnectionsFor("supporting-materials")).toBe(2)
    expect(derivedDatabaseConnectionsFor("embeddings")).toBe(2)
    expect(DERIVED_SUPPORTING_MATERIAL_BATCH_SIZE).toBe(25)
    expect(derivedBatchSizeFor("bill-documents")).toBe(100)
    expect(derivedBatchSizeFor("supporting-materials")).toBe(25)
    expect(derivedBatchSizeFor("embeddings")).toBeUndefined()
  })

  it("accepts the final document and embedding lanes while keeping drains bounded", () => {
    expect(
      derivedPayloadSchema.parse({
        correlationId: "backfill:lane-64",
        kind: "bill-documents",
        rebuildId: "lane-64",
        shardCount: 64,
        shardIndex: 63
      })
    ).toMatchObject({ kind: "bill-documents", shardCount: 64, shardIndex: 63 })

    expect(
      derivedPayloadSchema.parse({
        correlationId: "backfill:embedding-lane-200",
        kind: "embeddings",
        rebuildId: "embedding-lane-200",
        shardCount: 200,
        shardIndex: 199
      })
    ).toMatchObject({ kind: "embeddings", shardCount: 200, shardIndex: 199 })

    expect(() =>
      derivedPayloadSchema.parse({
        correlationId: "backfill:embedding-lane-201",
        kind: "embeddings",
        rebuildId: "embedding-lane-201",
        shardCount: 201,
        shardIndex: 200
      })
    ).toThrow("Too big")

    expect(
      derivedPayloadSchema.parse({
        correlationId: "backfill:material-lane-24",
        kind: "supporting-materials",
        rebuildId: "material-lane-24",
        shardCount: 24,
        shardIndex: 23
      })
    ).toMatchObject({ kind: "supporting-materials", shardCount: 24, shardIndex: 23 })
  })

  it("moves a complete embedding rebuild through products at the full worker cap", () => {
    expect(FULL_EMBEDDING_PRODUCT_ORDER).toEqual(["amendments", "bills", "materials", "sections"])
    expect(createFullEmbeddingSyncStages()).toEqual([
      { product: "amendments", shardCount: 128 },
      { product: "bills", shardCount: 128 },
      { product: "materials", shardCount: 128 },
      { product: "sections", shardCount: 128 }
    ])
  })

  it("reports a lease overlap as a resumable shard checkpoint", () => {
    const retryAt = new Date("2026-08-18T16:00:00.000Z")

    expect(
      createDerivedLeaseHandoffResult({ kind: "bill-documents", shardCount: 64, shardIndex: 16 }, retryAt)
    ).toEqual({
      checkpoint: { complete: false, handoff: "ingestion-lease", nextAttemptAt: retryAt.toISOString() },
      kind: "bill-documents",
      shard: { shardCount: 64, shardIndex: 16 },
      status: "waiting-for-lease"
    })
  })

  it("accepts independent exact-jurisdiction document partitions and rejects ambiguous payloads", () => {
    expect(
      derivedPayloadSchema.parse({
        correlationId: "backfill:illinois:partition-3",
        documentPartitionCount: 4,
        documentPartitionIndex: 3,
        jurisdictionId: "jurisdiction:il",
        kind: "bill-documents",
        rebuildId: "illinois-partitions",
        shardCount: 64,
        shardIndex: 12
      })
    ).toMatchObject({
      documentPartitionCount: 4,
      documentPartitionIndex: 3,
      jurisdictionId: "jurisdiction:il"
    })

    expect(() =>
      derivedPayloadSchema.parse({
        correlationId: "backfill:illinois:missing-jurisdiction",
        documentPartitionCount: 4,
        documentPartitionIndex: 0,
        kind: "bill-documents",
        rebuildId: "illinois-partitions"
      })
    ).toThrow("Document partitioning requires an exact jurisdictionId")

    expect(() =>
      derivedPayloadSchema.parse({
        correlationId: "backfill:illinois:partition-overflow",
        documentPartitionCount: 4,
        documentPartitionIndex: 4,
        jurisdictionId: "jurisdiction:il",
        kind: "bill-documents",
        rebuildId: "illinois-partitions"
      })
    ).toThrow("documentPartitionIndex must be less than documentPartitionCount")
  })

  it("opens the material phase only after its federal document prerequisites are terminal", () => {
    expect(
      isMaterialPhaseGateOpen({
        ocrRequiredDocuments: 0,
        pendingDocuments: 0,
        processingDocuments: 0,
        retryableFailedDocuments: 0
      })
    ).toBe(true)

    for (const blocker of [
      "ocrRequiredDocuments",
      "pendingDocuments",
      "processingDocuments",
      "retryableFailedDocuments"
    ] as const) {
      expect(
        isMaterialPhaseGateOpen({
          ocrRequiredDocuments: 0,
          pendingDocuments: 0,
          processingDocuments: 0,
          retryableFailedDocuments: 0,
          [blocker]: 1
        })
      ).toBe(false)
    }
  })

  it("keeps a material shard active when OCR reroutes work back to the drain", () => {
    const result = {
      checkpoint: { complete: true, kind: "supporting-materials" },
      correlationId: "backfill:materials",
      counts: { discovered: 1, failed: 1, inserted: 0, read: 0, skipped: 0, unchanged: 0, updated: 0 },
      failures: [],
      operation: "process-supporting-materials-shard-0",
      runId: "material-run",
      source: "documents",
      status: "partial" as const
    }
    const nextAttemptAt = new Date("2026-08-21T01:00:00.000Z")

    expect(reconcileSupportingMaterialOcrCheckpoint(result, { hasWork: true, nextAttemptAt }).checkpoint).toEqual({
      complete: false,
      kind: "supporting-materials",
      nextAttemptAt: nextAttemptAt.toISOString()
    })
    expect(reconcileSupportingMaterialOcrCheckpoint(result, { hasWork: false }).checkpoint).toEqual({
      complete: true,
      kind: "supporting-materials",
      nextAttemptAt: undefined
    })
  })
})
