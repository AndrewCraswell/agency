import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import { continueRegulatoryPassageCopy } from "./regulatory-passage-copy.js"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<() => void>(),
  end: vi.fn<() => Promise<void>>(),
  copy: vi.fn<typeof import("../../ingestion/regulations/passage-copy-batch.js").runLegalPassageCopyBatch>(),
  key: vi.fn<(key: string, options: { scope: string }) => Promise<string>>(),
  trigger: vi.fn<(id: string, payload: unknown, options: { idempotencyKey: string }) => Promise<{ id: string }>>()
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor() {
        mocks.pool()
      }
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  tasks: { trigger: mocks.trigger },
  idempotencyKeys: { create: mocks.key }
}))
vi.mock("../../ingestion/regulations/passage-copy-batch.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../ingestion/regulations/passage-copy-batch.js")>()),
  runLegalPassageCopyBatch: mocks.copy
}))
const payload = { preparationId: "a".repeat(64), afterOrdinal: -1, limit: 10 }
const result = {
  ...payload,
  afterOrdinal: 9,
  copied: 10,
  total: 20,
  exhausted: false,
  publicSearchReady: false as const
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://target/legislation_passage_search")
  mocks.copy.mockResolvedValue(result)
  mocks.key.mockResolvedValue("global-validation-key")
  mocks.trigger.mockResolvedValue({ id: "child" })
})
afterEach(() => vi.unstubAllEnvs())

it("rejects invalid selectors and unsafe targets before allocating connections", async () => {
  await expect(continueRegulatoryPassageCopy({ ...payload, afterOrdinal: -2 }, "parent")).rejects.toThrow(ZodError)
  await expect(continueRegulatoryPassageCopy({ ...payload, acknowledge: true }, "parent")).rejects.toThrow(ZodError)
  for (const url of [
    "postgresql://source/legislation_passage_search",
    "postgresql://target/canonical",
    "https://target/legislation_passage_search"
  ]) {
    vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", url)
    await expect(continueRegulatoryPassageCopy(payload, "parent")).rejects.toThrow("separate PostgreSQL")
  }
  expect(mocks.pool).not.toHaveBeenCalled()
})
it("closes both pools before advancing only the committed cursor", async () => {
  mocks.trigger.mockImplementation(async () => {
    expect(mocks.end).toHaveBeenCalledTimes(2)
    return { id: "child" }
  })
  expect(await continueRegulatoryPassageCopy(payload, "parent")).toMatchObject({
    continuationRunId: "child",
    publicSearchReady: false
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-passage-copy",
    { ...payload, afterOrdinal: 9 },
    { idempotencyKey: "regulatory-passage-copy:continue:parent" }
  )
})
it("reuses the successor key after uncertain dispatch and hands exhausted copy to validation", async () => {
  mocks.trigger.mockRejectedValueOnce(new Error("uncertain dispatch"))
  await expect(continueRegulatoryPassageCopy(payload, "parent")).rejects.toThrow("uncertain dispatch")
  await continueRegulatoryPassageCopy(payload, "parent")
  expect(mocks.trigger.mock.calls[0]).toEqual(mocks.trigger.mock.calls[1])
  mocks.copy.mockResolvedValueOnce({ ...result, exhausted: true })
  expect(await continueRegulatoryPassageCopy(payload, "child")).toMatchObject({
    continuationRunId: "child",
    publicSearchReady: false
  })
  expect(mocks.key).toHaveBeenCalledWith(`regulatory-passage-copy:validate:${payload.preparationId}`, {
    scope: "global"
  })
  expect(mocks.trigger).toHaveBeenLastCalledWith(
    "regulatory-copy-validation",
    { preparationId: payload.preparationId, afterOrdinal: -1, limit: payload.limit },
    { idempotencyKey: "global-validation-key" }
  )
  expect(mocks.trigger).toHaveBeenCalledTimes(3)
})
it("does not dispatch on copy failure or a nonadvancing batch", async () => {
  mocks.copy.mockRejectedValueOnce(new Error("target unavailable"))
  await expect(continueRegulatoryPassageCopy(payload, "parent")).rejects.toThrow("target unavailable")
  expect(mocks.end).toHaveBeenCalledTimes(2)
  mocks.copy.mockResolvedValueOnce({ ...result, copied: 0, afterOrdinal: -1 })
  await expect(continueRegulatoryPassageCopy(payload, "parent")).rejects.toThrow("regulatory_copy_no_progress")
  expect(mocks.trigger).not.toHaveBeenCalled()
})
