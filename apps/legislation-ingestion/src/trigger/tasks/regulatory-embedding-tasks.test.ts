import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { runRegulatoryEmbeddingDispatch, runRegulatoryEmbeddingShardTask } from "./regulatory-embedding-tasks.js"

const generationId = "a".repeat(64)
const mocks = vi.hoisted(() => ({
  complete: vi.fn<() => Promise<void>>(),
  embedClient: vi.fn<(options: unknown) => void>(),
  end: vi.fn<() => Promise<void>>(),
  initialize: vi.fn<() => Promise<{ generationId: string; shardCount: 16 }>>(),
  key: vi.fn<(key: string, options: { scope: string }) => Promise<string>>(),
  pool: vi.fn<(options: unknown) => void>(),
  query: vi.fn<(text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(),
  runShard: vi.fn<() => Promise<Record<string, unknown>>>(),
  trigger: vi.fn<(task: string, payload: unknown, options: unknown) => Promise<{ id: string }>>()
}))

vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(options: unknown) {
        mocks.pool(options)
      }
      query = mocks.query
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  idempotencyKeys: { create: mocks.key },
  task: (value: unknown) => value,
  tasks: { trigger: mocks.trigger }
}))
vi.mock("@repo/legislation-core/embeddings/openrouter-embeddings", () => ({
  OpenRouterEmbeddingClient: class {
    constructor(options: unknown) {
      mocks.embedClient(options)
    }
  }
}))
vi.mock("../../ingestion/regulations/vector-jobs.js", () => ({
  initializeLegalEmbeddingShards: mocks.initialize,
  runLegalEmbeddingShardJob: mocks.runShard
}))
vi.mock("../../ingestion/regulations/vector-storage.js", () => ({
  completeLegalEmbeddingGeneration: mocks.complete
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://target/legislation_passage_search")
  vi.stubEnv("REGULATORY_EMBEDDING_MODEL", "openai/text-embedding-3-small")
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key")
  mocks.key.mockImplementation(async (key) => `global:${key}`)
  mocks.trigger.mockImplementation(async (_task, payload) => ({
    id: `run-${(payload as { shardIndex: number }).shardIndex}`
  }))
  mocks.initialize.mockResolvedValue({ generationId, shardCount: 16 })
})
afterEach(() => vi.unstubAllEnvs())

it("initializes and submits the fixed shard inventory with stable global keys", async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
    .mockResolvedValueOnce({ rows: [{ model: "openai/text-embedding-3-small", state: "pending" }] })

  await expect(runRegulatoryEmbeddingDispatch({ generationId })).resolves.toMatchObject({
    generationId,
    reused: false,
    runIds: Array.from({ length: 16 }, (_, index) => `run-${index}`),
    shardCount: 16
  })
  expect(mocks.initialize).toHaveBeenCalledWith(expect.anything(), generationId)
  expect(mocks.trigger).toHaveBeenCalledTimes(16)
  expect(mocks.key).toHaveBeenNthCalledWith(16, `regulatory-embedding:${generationId}:shard:15`, { scope: "global" })
  expect(mocks.trigger).toHaveBeenNthCalledWith(
    1,
    "regulatory-embedding-shard",
    { generationId, shardIndex: 0 },
    { idempotencyKey: `global:regulatory-embedding:${generationId}:shard:0`, idempotencyKeyTTL: "7d" }
  )
  expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({ max: 2 }))
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("does not fan out completed generations and rejects a configured model mismatch", async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
    .mockResolvedValueOnce({ rows: [{ model: "openai/text-embedding-3-small", state: "embedded" }] })
  await expect(runRegulatoryEmbeddingDispatch({ generationId })).resolves.toMatchObject({ reused: true, runIds: [] })
  expect(mocks.trigger).not.toHaveBeenCalled()

  mocks.query
    .mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
    .mockResolvedValueOnce({ rows: [{ model: "voyageai/voyage-4", state: "pending" }] })
  await expect(runRegulatoryEmbeddingDispatch({ generationId })).rejects.toThrow(
    "legal_embedding_configured_model_mismatch"
  )
  expect(mocks.initialize).not.toHaveBeenCalled()
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("rejects absent trusted model selection and unsafe search targets before side effects", async () => {
  vi.stubEnv("REGULATORY_EMBEDDING_MODEL", "")
  await expect(runRegulatoryEmbeddingDispatch({ generationId })).rejects.toThrow("REGULATORY_EMBEDDING_MODEL")
  expect(mocks.pool).not.toHaveBeenCalled()

  vi.stubEnv("REGULATORY_EMBEDDING_MODEL", "openai/text-embedding-3-small")
  vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://source/legislation_passage_search")
  await expect(runRegulatoryEmbeddingDispatch({ generationId })).rejects.toThrow("separate PostgreSQL search host")
  expect(mocks.pool).not.toHaveBeenCalled()
})

it("runs one shard page and submits one continuation from the durable cursor", async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
    .mockResolvedValueOnce({ rows: [{ model: "openai/text-embedding-3-small", state: "pending" }] })
  mocks.runShard.mockResolvedValue({ state: "pending", inserted: 64, reusedCheckpoint: false })
  mocks.trigger.mockResolvedValueOnce({ id: "continuation" })

  await expect(runRegulatoryEmbeddingShardTask({ generationId, shardIndex: 3 }, "parent-run")).resolves.toMatchObject({
    continuationRunId: "continuation",
    inserted: 64,
    state: "pending"
  })
  expect(mocks.embedClient).toHaveBeenCalledWith(
    expect.objectContaining({ route: expect.objectContaining({ model: "openai/text-embedding-3-small" }) })
  )
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-embedding-shard",
    { generationId, shardIndex: 3 },
    { idempotencyKey: "regulatory-embedding-shard:continue:parent-run" }
  )
  expect(mocks.complete).not.toHaveBeenCalled()
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("finalizes only when the last durable shard has completed", async () => {
  mocks.query
    .mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
    .mockResolvedValueOnce({ rows: [{ model: "openai/text-embedding-3-small", state: "pending" }] })
    .mockResolvedValueOnce({ rows: [{ count: 16 }] })
  mocks.runShard.mockResolvedValue({ state: "complete", reusedCheckpoint: false })
  await expect(runRegulatoryEmbeddingShardTask({ generationId, shardIndex: 15 }, "final-run")).resolves.toMatchObject({
    continuationRunId: null,
    state: "complete"
  })
  expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), generationId)
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("requires provider credentials and generation agreement before invoking the worker", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", undefined)
  await expect(runRegulatoryEmbeddingShardTask({ generationId, shardIndex: 0 }, "run")).rejects.toThrow(
    "OPENROUTER_API_KEY"
  )
  expect(mocks.pool).not.toHaveBeenCalled()

  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key")
  mocks.query
    .mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
    .mockResolvedValueOnce({ rows: [{ model: "voyageai/voyage-4", state: "pending" }] })
  await expect(runRegulatoryEmbeddingShardTask({ generationId, shardIndex: 0 }, "run")).rejects.toThrow(
    "legal_embedding_configured_model_mismatch"
  )
  expect(mocks.runShard).not.toHaveBeenCalled()
  expect(mocks.embedClient).not.toHaveBeenCalled()
  expect(mocks.end).toHaveBeenCalledOnce()
})
