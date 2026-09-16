import { createDatabase } from "@repo/legislation-core/database/database"
import { afterAll, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../../config/config.js"
import { createJobCounts, type JobResult, type runIngestionJob } from "../job.js"
import {
  drainBillDocuments,
  drainEmbeddings,
  drainSupportingMaterials,
  executeDerivedBackfill,
  type DerivedBackfillDependencies,
  type DerivedBackfillExecutionInput
} from "./derived.js"

const config = loadConfig({ NODE_ENV: "test", OPENROUTER_API_KEY: "embedding-key" })
const { database, pool } = createDatabase(config.database)

afterAll(async () => {
  await pool.end()
})

describe("derived backfill drains", () => {
  it("isolates bill targets while serializing repeated work on the same bill", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValue(documentResult(0))
    for (const billId of ["bill:nc:2025:hb:1", "bill:nc:2025:hb:2", "bill:nc:2025:hb:1"]) {
      await drainBillDocuments(
        executionInput(),
        { billId, jurisdictionId: "jurisdiction:nc", batchSize: 1 },
        {
          artifactStore: artifactStore(),
          processBillDocuments: processor,
          runIngestionJob: createJobRunner(inputs)
        }
      )
    }
    expect(inputs[0]?.scopeKey).not.toEqual(inputs[1]?.scopeKey)
    expect(inputs[0]?.scopeKey).toEqual(inputs[2]?.scopeKey)
  })
  it("separates unpartitioned jurisdiction leases and preserves processor scope", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValue(documentResult(0))
    for (const jurisdictionId of ["jurisdiction:nc", "jurisdiction:ak"]) {
      await drainBillDocuments(
        executionInput(),
        { jurisdictionId, batchSize: 1 },
        {
          artifactStore: artifactStore(),
          processBillDocuments: processor,
          runIngestionJob: createJobRunner(inputs)
        }
      )
      expect(processor).toHaveBeenCalledWith(database, expect.objectContaining({ jurisdictionId }))
    }
    expect(inputs.map((input) => input.scopeKey)).toEqual([
      "jurisdiction:jurisdiction:nc",
      "jurisdiction:jurisdiction:ak"
    ])
  })

  it("drains bill documents in finite batches under the legacy lease identity", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValueOnce(documentResult(3))
      .mockResolvedValueOnce(documentResult(1))
      .mockResolvedValueOnce(documentResult(0))

    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 3, maxBatches: 4 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(processor).toHaveBeenCalledTimes(3)
    expect(processor).toHaveBeenLastCalledWith(database, expect.objectContaining({ limit: 3, status: "failed" }))
    expect(inputs).toEqual([
      expect.objectContaining({
        operation: "process-documents",
        scopeKey: "all",
        source: "documents",
        workflowExecutionId: "trigger-execution"
      })
    ])
    expect(result.checkpoint).toEqual({ batches: 3, complete: true, deferred: 0, kind: "bill-documents" })
    expect(result.counts.discovered).toBe(4)
  })

  it("uses the document shard lease and rejects incompatible targeted sharding", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const requeue = vi
      .fn<NonNullable<DerivedBackfillDependencies["requeueInterruptedDocuments"]>>()
      .mockResolvedValue(0)
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValue(documentResult(0))

    await drainBillDocuments(
      executionInput(),
      { batchSize: 1, shardCount: 2, shardIndex: 1 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        requeueInterruptedDocuments: requeue,
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(inputs[0]).toEqual(
      expect.objectContaining({
        leaseDurationMinutes: 30,
        operation: "process-documents-shard-1",
        scope: expect.objectContaining({
          executionSettings: expect.objectContaining({
            databasePoolMaxConnections: 1,
            documentHostDefaultSlots: 2,
            downloadConcurrency: 4,
            shardCount: 2,
            shardIndex: 1
          })
        }),
        scopeKey: "shard:1-of-2"
      })
    )
    expect(requeue).toHaveBeenCalledWith(database, expect.any(Date), 1, { count: 2, index: 1 })
    await expect(
      drainBillDocuments(executionInput(), { billId: "bill-1", shardCount: 2, shardIndex: 0 })
    ).rejects.toThrow("Document sharding")
  })

  it("returns newly detected OCR documents to the calling Trigger task", async () => {
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValueOnce({ ...documentResult(1), ocrDocumentIds: ["document:image-only"] })
      .mockResolvedValueOnce(documentResult(0))

    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 2, maxBatches: 2 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(result.checkpoint).toMatchObject({ ocrDocumentIds: ["document:image-only"] })
  })

  it("uses distinct exact-jurisdiction leases for disjoint document partitions", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValue(documentResult(0))

    await drainBillDocuments(
      executionInput(),
      {
        batchSize: 1,
        documentPartitionCount: 4,
        documentPartitionIndex: 2,
        jurisdictionId: "jurisdiction:il",
        shardCount: 64,
        shardIndex: 12
      },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(inputs[0]).toEqual(
      expect.objectContaining({
        operation: "process-documents-jurisdiction-jurisdiction:il-partition-2-of-4",
        scopeKey: "jurisdiction:jurisdiction:il:partition:2-of-4"
      })
    )
    expect(processor).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        documentPartitionCount: 4,
        documentPartitionIndex: 2,
        jurisdictionId: "jurisdiction:il",
        shardCount: 64,
        shardIndex: 12
      })
    )
    await expect(
      drainBillDocuments(executionInput(), { documentPartitionCount: 4, documentPartitionIndex: 0 })
    ).rejects.toThrow("Document partitioning requires an exact jurisdiction ID")
  })

  it("drains due retryable failures only after the pending document queue is empty", async () => {
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValueOnce(documentResult(0))
      .mockResolvedValueOnce(documentResult(2))
      .mockResolvedValueOnce(documentResult(0))

    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 2, maxBatches: 3 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(processor.mock.calls.map(([, options]) => options.status)).toEqual(["pending", "failed", "failed"])
    expect(result.checkpoint).toEqual({ batches: 3, complete: true, deferred: 0, kind: "bill-documents" })
    expect(result.counts.discovered).toBe(2)
  })

  it("does not spend the productive batch budget on an empty pending probe", async () => {
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValueOnce(documentResult(0))
      .mockResolvedValueOnce(documentResult(1))

    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 2, maxBatches: 1 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(processor.mock.calls.map(([, options]) => options.status)).toEqual(["pending", "failed"])
    expect(result.checkpoint).toEqual({ batches: 2, complete: true, deferred: 0, kind: "bill-documents" })
    expect(result.counts.discovered).toBe(1)
  })

  it("completes after both document-status probes are empty", async () => {
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValue(documentResult(0))

    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 2, maxBatches: 1 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        processBillDocuments: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(processor.mock.calls.map(([, options]) => options.status)).toEqual(["pending", "failed"])
    expect(result.checkpoint).toEqual({ batches: 2, complete: true, deferred: 0, kind: "bill-documents" })
  })

  it("keeps a deferred document shard incomplete until its durable retry time", async () => {
    const nextAttemptAt = new Date("2026-08-18T16:00:00.000Z")
    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 1, maxBatches: 1 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: terminalClassifier(),
        nextDocumentBackfillAttempt: async () => ({ hasWork: true, nextAttemptAt }),
        processBillDocuments: async () => documentResult(1, 1),
        requeueInterruptedDocuments: async () => 0,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(result.status).toBe("succeeded")
    expect(result.counts.failed).toBe(0)
    expect(result.checkpoint).toEqual({
      batches: 1,
      complete: false,
      deferred: 1,
      kind: "bill-documents",
      nextAttemptAt: nextAttemptAt.toISOString()
    })
  })

  it("classifies proven unavailable California PDFs before allocating document download slots", async () => {
    const classifier = vi
      .fn<NonNullable<DerivedBackfillDependencies["classifyKnownUnavailableCaliforniaBillPdfs"]>>()
      .mockResolvedValue({ classified: 3, identifiers: ["document-1"] })
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processBillDocuments"]>>()
      .mockResolvedValue(documentResult(0))

    const result = await drainBillDocuments(
      executionInput(),
      { batchSize: 10, maxBatches: 2 },
      {
        artifactStore: artifactStore(),
        classifyKnownUnavailableCaliforniaBillPdfs: classifier,
        processBillDocuments: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(classifier).toHaveBeenCalledWith(database, 20)
    expect(result.counts).toMatchObject({ discovered: 3, updated: 3 })
  })

  it("drains supporting materials using the durable material processing queue", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const nextAttempt = vi
      .fn<NonNullable<DerivedBackfillDependencies["nextSupportingMaterialBackfillAttempt"]>>()
      .mockResolvedValue({ hasWork: false })
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processSupportingMaterials"]>>()
      .mockResolvedValue(supportingMaterialResult(0))

    const result = await drainSupportingMaterials(
      executionInput(),
      { batchSize: 10, jurisdictionId: "ca", shardCount: 16, shardIndex: 3 },
      {
        artifactStore: artifactStore(),
        nextSupportingMaterialBackfillAttempt: nextAttempt,
        processSupportingMaterials: processor,
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(processor).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        jurisdictionId: "ca",
        limit: 10,
        maximumAttempts: 4,
        shardCount: 16,
        shardIndex: 3,
        status: undefined
      })
    )
    expect(inputs[0]).toEqual(
      expect.objectContaining({
        leaseDurationMinutes: 60,
        operation: "process-supporting-materials-shard-3",
        scopeKey: "shard:3-of-16",
        source: "documents"
      })
    )
    expect(nextAttempt).toHaveBeenCalledWith(
      database,
      expect.objectContaining({ maximumAttempts: 4, maximumOcrAttempts: 5, shardCount: 16, shardIndex: 3 })
    )
    expect(result.checkpoint).toEqual({ batches: 1, complete: true, kind: "supporting-materials" })
  })

  it("keeps materials incomplete through a deferred retryable failure", async () => {
    const nextAttemptAt = new Date("2026-08-18T16:00:00.000Z")
    const recover = vi
      .fn<NonNullable<DerivedBackfillDependencies["requeueInterruptedSupportingMaterials"]>>()
      .mockResolvedValue(0)
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processSupportingMaterials"]>>()
      .mockResolvedValue(supportingMaterialResult(1, 1))

    const result = await drainSupportingMaterials(
      executionInput(),
      { batchSize: 1, maxBatches: 1 },
      {
        artifactStore: artifactStore(),
        nextSupportingMaterialBackfillAttempt: async () => ({ hasWork: true, nextAttemptAt }),
        processSupportingMaterials: processor,
        requeueInterruptedSupportingMaterials: recover,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(recover).toHaveBeenCalledWith(database, expect.any(Date), 1, { count: 1, index: 0 })
    expect(processor).toHaveBeenCalledWith(database, expect.objectContaining({ maximumAttempts: 4, status: undefined }))
    expect(result.checkpoint).toEqual({
      batches: 1,
      complete: false,
      kind: "supporting-materials",
      nextAttemptAt: nextAttemptAt.toISOString()
    })
    expect(result.status).toBe("partial")
  })

  it("returns newly detected OCR materials to the calling Trigger task", async () => {
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processSupportingMaterials"]>>()
      .mockResolvedValue({ ...supportingMaterialResult(1), ocrMaterialIds: ["material:image-only"] })

    const result = await drainSupportingMaterials(
      executionInput(),
      { batchSize: 2, maxBatches: 1 },
      {
        artifactStore: artifactStore(),
        nextSupportingMaterialBackfillAttempt: async () => ({ hasWork: false }),
        processSupportingMaterials: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(result.checkpoint).toMatchObject({ ocrMaterialIds: ["material:image-only"] })
  })

  it("embeds all derived record types in one bounded cycle and preserves the shard lease", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const amendments = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedAmendments"]>>()
      .mockResolvedValue({ complete: false, cursor: "amendment:1", embedded: 1, scanned: 2, skipped: 1 })
    const bills = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedBills"]>>()
      .mockResolvedValue({ complete: false, cursor: "bill:1", embedded: 1, scanned: 3, skipped: 2 })
    const sections = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedDocumentSections"]>>()
      .mockResolvedValue({ complete: false, cursor: "section:1", embedded: 0, scanned: 3, skipped: 3 })
    const materials = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedSupportingMaterialSections"]>>()
      .mockResolvedValue({ complete: false, cursor: "material:1", embedded: 0, scanned: 4, skipped: 4 })

    const result = await drainEmbeddings(
      executionInput(),
      { batchSize: 2, maxBatches: 1, shardCount: 2, shardIndex: 0 },
      {
        embedAmendments: amendments,
        embedBills: bills,
        embedDocumentSections: sections,
        embedSupportingMaterialSections: materials,
        embeddingClients: embeddingClients(),
        loadEmbeddingCheckpoint: async () => ({
          amendments: { complete: false, cursor: "" },
          bills: { complete: false, cursor: "" },
          materials: { complete: false, cursor: "" },
          sections: { complete: false, cursor: "" }
        }),
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(bills).toHaveBeenCalledWith(database, expect.anything(), {
      afterId: "",
      billId: undefined,
      limit: 2,
      rolloutId: "trigger-run",
      shardCount: 2,
      shardIndex: 0
    })
    expect(sections).toHaveBeenCalledTimes(1)
    expect(materials).toHaveBeenCalledTimes(1)
    expect(inputs[0]).toEqual(
      expect.objectContaining({
        leaseDurationMinutes: 30,
        operation: "refresh-embeddings-amendments+bills+materials+sections-shard-0",
        scopeKey: "amendments+bills+materials+sections:shard:0-of-2",
        source: "openrouter"
      })
    )
    expect(result.checkpoint).toEqual({
      batches: 1,
      complete: false,
      embedding: {
        amendments: { complete: false, cursor: "amendment:1" },
        bills: { complete: false, cursor: "bill:1" },
        materials: { complete: false, cursor: "material:1" },
        sections: { complete: false, cursor: "section:1" }
      },
      kind: "embeddings"
    })
    expect(result.counts).toMatchObject({ inserted: 2, skipped: 10 })
  })

  it("resumes each embedding kind from its durable shard cursor", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const amendments = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedAmendments"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 0, scanned: 1, skipped: 1 })
    const bills = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedBills"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 0, scanned: 1, skipped: 1 })
    const sections = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedDocumentSections"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 0, scanned: 1, skipped: 1 })
    const materials = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedSupportingMaterialSections"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 0, scanned: 1, skipped: 1 })

    await drainEmbeddings(
      executionInput(),
      { batchSize: 2, maxBatches: 1, shardCount: 2, shardIndex: 1 },
      {
        embedAmendments: amendments,
        embedBills: bills,
        embedDocumentSections: sections,
        embedSupportingMaterialSections: materials,
        embeddingClients: embeddingClients(),
        loadEmbeddingCheckpoint: async () => ({
          amendments: { complete: false, cursor: "amendment:500" },
          bills: { complete: false, cursor: "bill:500" },
          materials: { complete: false, cursor: "material:500" },
          sections: { complete: false, cursor: "section:500" }
        }),
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(bills).toHaveBeenCalledWith(database, expect.anything(), expect.objectContaining({ afterId: "bill:500" }))
    expect(amendments).toHaveBeenCalledWith(
      database,
      expect.anything(),
      expect.objectContaining({ afterId: "amendment:500" })
    )
    expect(sections).toHaveBeenCalledWith(
      database,
      expect.anything(),
      expect.objectContaining({ afterId: "section:500" })
    )
    expect(materials).toHaveBeenCalledWith(
      database,
      expect.anything(),
      expect.objectContaining({ afterId: "material:500" })
    )
    expect(inputs[0]).toEqual(
      expect.objectContaining({
        checkpointStream: "embeddings:amendments+bills+materials+sections:shard:1-of-2"
      })
    )
  })

  it("runs only the selected embedding products with an isolated checkpoint stream", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const amendments = vi.fn<NonNullable<DerivedBackfillDependencies["embedAmendments"]>>()
    const bills = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedBills"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 1, scanned: 1, skipped: 0 })
    const sections = vi.fn<NonNullable<DerivedBackfillDependencies["embedDocumentSections"]>>()
    const materials = vi.fn<NonNullable<DerivedBackfillDependencies["embedSupportingMaterialSections"]>>()

    const result = await drainEmbeddings(
      executionInput(),
      { batchSize: 2, maxBatches: 1, products: ["bills"] },
      {
        embedAmendments: amendments,
        embedBills: bills,
        embedDocumentSections: sections,
        embedSupportingMaterialSections: materials,
        embeddingClients: embeddingClients(),
        loadEmbeddingCheckpoint: async () => ({
          amendments: { complete: false, cursor: "" },
          bills: { complete: false, cursor: "" },
          materials: { complete: false, cursor: "" },
          sections: { complete: false, cursor: "" }
        }),
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(bills).toHaveBeenCalledOnce()
    expect(amendments).not.toHaveBeenCalled()
    expect(sections).not.toHaveBeenCalled()
    expect(materials).not.toHaveBeenCalled()
    expect(inputs[0]).toEqual(
      expect.objectContaining({ checkpointStream: "embeddings:bills", operation: "refresh-embeddings-bills" })
    )
    expect(result.checkpoint?.complete).toBe(true)
  })

  it("isolates bill targets and rechecks freshness after a completed targeted pass", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const bills = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedBills"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 1, scanned: 1, skipped: 0 })
    const sections = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedDocumentSections"]>>()
      .mockResolvedValue({ complete: true, cursor: "", embedded: 0, scanned: 0, skipped: 0 })
    const amendments = vi.fn<NonNullable<DerivedBackfillDependencies["embedAmendments"]>>()
    const materials = vi.fn<NonNullable<DerivedBackfillDependencies["embedSupportingMaterialSections"]>>()
    const load = vi.fn<NonNullable<DerivedBackfillDependencies["loadEmbeddingCheckpoint"]>>().mockResolvedValue({
      amendments: { complete: true, cursor: "old" },
      bills: { complete: true, cursor: "old" },
      materials: { complete: true, cursor: "old" },
      sections: { complete: true, cursor: "old" }
    })
    for (const billId of ["bill:nc:2025:hb:1", "bill:ak:34:hb:1"]) {
      await drainEmbeddings(
        executionInput(),
        { billId },
        {
          embedBills: bills,
          embedDocumentSections: sections,
          embedAmendments: amendments,
          embedSupportingMaterialSections: materials,
          embeddingClients: embeddingClients(),
          loadEmbeddingCheckpoint: load,
          runIngestionJob: createJobRunner(inputs)
        }
      )
      expect(bills).toHaveBeenLastCalledWith(
        database,
        expect.anything(),
        expect.objectContaining({ billId, afterId: "" })
      )
      expect(sections).toHaveBeenLastCalledWith(
        database,
        expect.anything(),
        expect.objectContaining({ billId, afterId: "" })
      )
    }
    expect(amendments).not.toHaveBeenCalled()
    expect(materials).not.toHaveBeenCalled()
    expect(load.mock.calls[0]?.[1]).toMatch(/^embeddings:bills\+sections:target:[a-f0-9]{64}$/)
    expect(load.mock.calls[0]?.[1]).not.toBe(load.mock.calls[1]?.[1])
    expect(inputs[0]?.scopeKey).not.toBe(inputs[1]?.scopeKey)
  })

  it("rejects an unscoped product or empty ID in a targeted embedding request", async () => {
    await expect(
      drainEmbeddings(executionInput(), { billId: "bill:nc:2025:hb:1", products: ["materials"] })
    ).rejects.toThrow("matching target ID")
    await expect(drainEmbeddings(executionInput(), { documentId: " " })).rejects.toThrow("must not be empty")
  })

  it("prefetches a bounded bulk page while preserving 64-input provider batches", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const bills = vi
      .fn<NonNullable<DerivedBackfillDependencies["embedBills"]>>()
      .mockResolvedValue({ complete: false, cursor: "bill:640", embedded: 640, scanned: 640, skipped: 0 })

    const result = await drainEmbeddings(
      executionInput(),
      { batchSize: 64, maxBatches: 10, products: ["bills"], shardCount: 200, shardIndex: 12 },
      {
        embedBills: bills,
        embeddingClients: embeddingClients(),
        loadEmbeddingCheckpoint: async () => ({
          amendments: { complete: true, cursor: "" },
          bills: { complete: false, cursor: "bill:0" },
          materials: { complete: true, cursor: "" },
          sections: { complete: true, cursor: "" }
        }),
        runIngestionJob: createJobRunner(inputs)
      }
    )

    expect(bills).toHaveBeenCalledOnce()
    expect(bills).toHaveBeenCalledWith(database, expect.anything(), {
      afterId: "bill:0",
      billId: undefined,
      limit: 640,
      persistenceBatchSize: 128,
      providerBatchSize: 64,
      rolloutId: "trigger-run",
      shardCount: 200,
      shardIndex: 12
    })
    expect(inputs[0]).toMatchObject({
      scope: {
        batchSize: 640,
        executionSettings: { persistenceBatchSize: 128, providerBatchSize: 64 },
        maxBatches: 1
      }
    })
    expect(result.counts.inserted).toBe(640)
  })

  it("dispatches each derived kind without a CLI child process", async () => {
    const processor = vi
      .fn<NonNullable<DerivedBackfillDependencies["processSupportingMaterials"]>>()
      .mockResolvedValue(supportingMaterialResult(0))

    const result = await executeDerivedBackfill(
      executionInput(),
      { kind: "supporting-materials", options: { batchSize: 1 } },
      {
        artifactStore: artifactStore(),
        nextSupportingMaterialBackfillAttempt: async () => ({ hasWork: false }),
        processSupportingMaterials: processor,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(processor).toHaveBeenCalledTimes(1)
    expect(result.operation).toBe("process-supporting-materials")
  })

  it("requires an embedding credential before acquiring a database lease", async () => {
    const missingKeyConfig = loadConfig({ NODE_ENV: "test" })
    const runner = vi.fn<NonNullable<DerivedBackfillDependencies["runIngestionJob"]>>()

    await expect(
      drainEmbeddings({ ...executionInput(), config: missingKeyConfig }, {}, { runIngestionJob: runner })
    ).rejects.toThrow("OPENROUTER_API_KEY")
    expect(runner).not.toHaveBeenCalled()
  })
})

function executionInput(): DerivedBackfillExecutionInput {
  return {
    config,
    correlationId: "trigger-run",
    database,
    workflowExecutionId: "trigger-execution"
  }
}

function documentResult(discovered: number, deferred = 0) {
  return { counts: { ...createJobCounts({ discovered }), processed: 0, unsupported: 0 }, deferred, failures: [] }
}

function supportingMaterialResult(discovered: number, failed = 0) {
  return {
    counts: { ...createJobCounts({ discovered, failed }), processed: 0, unsupported: 0 },
    failures: [],
    ocrMaterialIds: []
  }
}

function artifactStore() {
  return {
    exists: async () => false,
    put: async () => true,
    read: async () => new Uint8Array()
  }
}

function embeddingClient() {
  return { embed: async () => ({ embeddings: [], model: "openai/text-embedding-3-small" }) }
}

function embeddingClients() {
  const client = embeddingClient()
  return { amendments: client, bills: client, materials: client, sections: client }
}

function terminalClassifier(): NonNullable<DerivedBackfillDependencies["classifyKnownUnavailableCaliforniaBillPdfs"]> {
  return async () => ({ classified: 0, identifiers: [] })
}

function createJobRunner(
  inputs: Parameters<typeof runIngestionJob>[1][]
): DerivedBackfillDependencies["runIngestionJob"] {
  return async (_database, input, operation): Promise<JobResult> => {
    inputs.push(input)
    const result = await operation("run-1")
    return {
      ...result,
      correlationId: input.correlationId,
      operation: input.operation,
      runId: "run-1",
      source: input.source,
      status: result.counts.failed === 0 ? "succeeded" : "partial",
      workflowExecutionId: input.workflowExecutionId
    }
  }
}
