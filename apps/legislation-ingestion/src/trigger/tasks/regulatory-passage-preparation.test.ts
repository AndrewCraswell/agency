import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import {
  continueRegulatoryPassagePreparation,
  runRegulatoryPassagePreparation
} from "./regulatory-passage-preparation.js"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<(options: unknown) => void>(),
  end: vi.fn<() => Promise<void>>(),
  query: vi.fn<() => Promise<{ rows: { name: string }[] }>>(),
  prepare: vi.fn<typeof import("../../ingestion/regulations/passage-preparation.js").runLegalPassagePreparationBatch>(),
  trigger: vi.fn<(id: string, payload: unknown, options: { idempotencyKey: string }) => Promise<{ id: string }>>()
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(options: unknown) {
        mocks.pool(options)
      }
      end = mocks.end
      query = mocks.query
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({ task: (value: unknown) => value, tasks: { trigger: mocks.trigger } }))
vi.mock("../../ingestion/regulations/passage-preparation.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../ingestion/regulations/passage-preparation.js")>()),
  runLegalPassagePreparationBatch: mocks.prepare
}))

const payload = {
  scope: { kind: "edition", id: "00000000-0000-4000-8000-000000000001" },
  model: "voyageai/voyage-4",
  limit: 10
}
const pending = {
  preparationId: "a".repeat(64),
  state: "pending" as const,
  processed: 10,
  complete: 10,
  blocked: 0,
  total: 25
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  mocks.query.mockResolvedValue({ rows: [{ name: "canonical" }] })
  mocks.prepare.mockResolvedValue(pending)
  mocks.trigger.mockResolvedValue({ id: "child" })
})
afterEach(() => vi.unstubAllEnvs())

it.each([
  { ...payload, scope: { kind: "edition", id: "bad" } },
  { ...payload, model: "unknown" },
  { ...payload, limit: 26 },
  { ...payload, cursor: 10 },
  { ...payload, regenerateEmbeddings: true }
])("rejects unsupported dispatch before opening a database %j", async (input) => {
  await expect(continueRegulatoryPassagePreparation(input, "parent")).rejects.toThrow(ZodError)
  expect(mocks.pool).not.toHaveBeenCalled()
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("requires explicit model selection and a nonempty run identity", async () => {
  await expect(continueRegulatoryPassagePreparation({ scope: payload.scope }, "parent")).rejects.toThrow(ZodError)
  await expect(continueRegulatoryPassagePreparation(payload, " ")).rejects.toThrow(ZodError)
  expect(mocks.pool).not.toHaveBeenCalled()
})

it("rejects search targets and non-PostgreSQL URLs, including an actual database mismatch", async () => {
  for (const url of [
    "postgresql://source/legislation_passage_search",
    "https://source/canonical",
    "postgresql://source/"
  ]) {
    vi.stubEnv("DATABASE_URL", url)
    await expect(runRegulatoryPassagePreparation(payload)).rejects.toThrow("canonical PostgreSQL")
  }
  expect(mocks.pool).not.toHaveBeenCalled()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  mocks.query.mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
  await expect(runRegulatoryPassagePreparation(payload)).rejects.toThrow("canonical PostgreSQL")
  expect(mocks.end).toHaveBeenCalledOnce()
  expect(mocks.prepare).not.toHaveBeenCalled()
})

it("closes its bounded pool before enqueuing the same scope and tokenizer for continuation", async () => {
  mocks.trigger.mockImplementation(async () => {
    expect(mocks.end).toHaveBeenCalledOnce()
    return { id: "child" }
  })
  expect(await continueRegulatoryPassagePreparation(payload, "parent")).toMatchObject({ continuationRunId: "child" })
  expect(mocks.pool).toHaveBeenCalledWith({
    connectionString: "postgresql://source/canonical",
    max: 2,
    connectionTimeoutMillis: 10_000
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-passage-preparation",
    { ...payload, retryBlocked: false },
    {
      idempotencyKey: "regulatory-passage-preparation:continue:parent"
    }
  )
})

it("reuses its dispatch key after uncertain submission and resumes from canonical checkpoints", async () => {
  mocks.trigger.mockRejectedValueOnce(new Error("uncertain submission"))
  await expect(continueRegulatoryPassagePreparation(payload, "parent")).rejects.toThrow("uncertain submission")
  mocks.prepare.mockResolvedValueOnce({ ...pending, complete: 20 })
  expect(await continueRegulatoryPassagePreparation(payload, "parent")).toMatchObject({ complete: 20 })
  expect(mocks.trigger.mock.calls[0]).toEqual(mocks.trigger.mock.calls[1])
})

it("stops after completion, including a replay with no new passages", async () => {
  mocks.prepare.mockResolvedValueOnce({ ...pending, state: "prepared", processed: 0, complete: 25 })
  expect(await continueRegulatoryPassagePreparation(payload, "parent")).toMatchObject({ continuationRunId: null })
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("keeps failures retryable without starting successor work", async () => {
  for (const reason of ["legal_preparation_busy_or_delayed", "legal_preparation_lease_lost", "source unavailable"]) {
    mocks.prepare.mockRejectedValueOnce(new Error(reason))
    await expect(continueRegulatoryPassagePreparation(payload, "parent")).rejects.toThrow(reason)
  }
  expect(mocks.end).toHaveBeenCalledTimes(3)
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("continues past recorded source blockers and does not propagate an explicit retry to successors", async () => {
  mocks.prepare.mockResolvedValueOnce({ ...pending, complete: 8, blocked: 2 })
  expect(await continueRegulatoryPassagePreparation({ ...payload, retryBlocked: true }, "retry-parent")).toMatchObject({
    blocked: 2,
    continuationRunId: "child"
  })
  expect(mocks.prepare).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ retryBlocked: true }))
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-passage-preparation",
    { ...payload, retryBlocked: false },
    { idempotencyKey: "regulatory-passage-preparation:continue:retry-parent" }
  )
})

it("stops a fully accounted blocked scope without automatically retrying its source failures", async () => {
  for (const processed of [1, 0]) {
    mocks.prepare.mockResolvedValueOnce({ ...pending, state: "blocked", processed, complete: 24, blocked: 1 })
    expect(await continueRegulatoryPassagePreparation(payload, "parent")).toMatchObject({
      state: "blocked",
      blocked: 1,
      continuationRunId: null
    })
  }
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("refuses nonprogress and inconsistent completion receipts", async () => {
  const invalid = [
    { ...pending, processed: 0 },
    { ...pending, complete: 26 },
    { ...pending, blocked: 16 },
    { ...pending, state: "blocked" as const, blocked: 1 },
    { ...pending, complete: 24, blocked: 1 },
    { ...pending, state: "prepared" as const },
    { ...pending, processed: 11, complete: 11 }
  ]
  for (const result of invalid) {
    mocks.prepare.mockResolvedValueOnce(result)
    await expect(continueRegulatoryPassagePreparation(payload, "parent")).rejects.toThrow(/regulatory_preparation_/)
  }
  expect(mocks.trigger).not.toHaveBeenCalled()
})
