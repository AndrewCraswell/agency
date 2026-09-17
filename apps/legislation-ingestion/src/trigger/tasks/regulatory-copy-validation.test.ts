import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ZodError } from "zod"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<() => void>(),
  end: vi.fn<() => Promise<void>>(),
  page: vi.fn<typeof import("../../ingestion/regulations/passage-copy-readiness.js").verifyLegalPassageCopyPage>(),
  finalize: vi.fn<typeof import("../../ingestion/regulations/passage-copy-readiness.js").finalizeLegalPassageCopy>(),
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
vi.mock("@trigger.dev/sdk", () => ({ task: (value: unknown) => value, tasks: { trigger: mocks.trigger } }))
vi.mock("../../ingestion/regulations/passage-copy-readiness.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/passage-copy-readiness.js")>()),
  verifyLegalPassageCopyPage: mocks.page,
  finalizeLegalPassageCopy: mocks.finalize
}))

import { continueRegulatoryCopyValidation } from "./regulatory-copy-validation.js"

const preparationId = "a".repeat(64)
const payload = { preparationId, afterOrdinal: -1, limit: 10 }
const page = {
  preparationId,
  scope: { kind: "edition" as const, id: "00000000-0000-4000-8000-000000000001" },
  copiedGenerations: 10,
  copiedPassages: 20,
  checkedAt: "2026-09-17T00:00:00.000Z",
  copyComplete: false,
  afterOrdinal: 9,
  exhausted: false,
  checkpointsWritten: 10,
  publicSearchReady: false,
  acknowledged: false
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://target/legislation_passage_search")
  mocks.page.mockResolvedValue(page)
  mocks.finalize.mockResolvedValue({
    preparationId,
    scope: page.scope,
    copiedGenerations: 20,
    copiedPassages: 40,
    checkedAt: page.checkedAt,
    copyComplete: true,
    publicSearchReady: false,
    acknowledged: true
  })
  mocks.trigger.mockResolvedValue({ id: "child" })
})
afterEach(() => vi.unstubAllEnvs())

it("continues bounded validation from its committed ordinal", async () => {
  mocks.trigger.mockImplementationOnce(async () => {
    expect(mocks.end).toHaveBeenCalledTimes(2)
    return { id: "child" }
  })
  await expect(continueRegulatoryCopyValidation(payload, "parent")).resolves.toMatchObject({
    continuationRunId: "child",
    afterOrdinal: 9
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-copy-validation",
    { ...payload, afterOrdinal: 9 },
    { idempotencyKey: "regulatory-copy-validation:continue:parent" }
  )
})

it("routes an exhausted validation page through finalization before acknowledgement", async () => {
  mocks.page.mockResolvedValueOnce({ ...page, exhausted: true })
  await expect(continueRegulatoryCopyValidation(payload, "parent")).resolves.toMatchObject({
    continuationRunId: "child",
    exhausted: true
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-copy-validation",
    { operation: "finalize", preparationId },
    { idempotencyKey: "regulatory-copy-validation:continue:parent" }
  )
  await expect(
    continueRegulatoryCopyValidation({ operation: "finalize", preparationId }, "finalizer")
  ).resolves.toMatchObject({ acknowledged: true, continuationRunId: null })
  expect(mocks.trigger).toHaveBeenCalledOnce()
})

it("rejects invalid input and a nonadvancing page without dispatching a successor", async () => {
  await expect(continueRegulatoryCopyValidation({ ...payload, afterOrdinal: -2 }, "parent")).rejects.toThrow(ZodError)
  mocks.page.mockResolvedValueOnce({ ...page, checkpointsWritten: 0, afterOrdinal: -1 })
  await expect(continueRegulatoryCopyValidation(payload, "parent")).rejects.toThrow(
    "regulatory_copy_validation_no_progress"
  )
  expect(mocks.trigger).not.toHaveBeenCalled()
})

it("propagates validation and finalization failures without admitting successor work", async () => {
  mocks.page.mockRejectedValueOnce(new Error("target unavailable"))
  await expect(continueRegulatoryCopyValidation(payload, "parent")).rejects.toThrow("target unavailable")
  mocks.finalize.mockRejectedValueOnce(new Error("checkpoint stale"))
  await expect(continueRegulatoryCopyValidation({ operation: "finalize", preparationId }, "finalizer")).rejects.toThrow(
    "checkpoint stale"
  )
  expect(mocks.trigger).not.toHaveBeenCalled()
})
