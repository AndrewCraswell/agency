import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { continueRegulatorySearchRights, runRegulatorySearchRights } from "./regulatory-search-rights.js"
const mocks = vi.hoisted(() => ({
  end: vi.fn<() => Promise<void>>(),
  reconcile: vi.fn<typeof import("../../ingestion/regulations/search-rights.js").reconcileLegalSearchRightsBatch>(),
  pool: vi.fn<() => void>(),
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
vi.mock("../../ingestion/regulations/search-rights.js", () => ({ reconcileLegalSearchRightsBatch: mocks.reconcile }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://target/legislation_passage_search")
})
afterEach(() => vi.unstubAllEnvs())
it("rejects unsafe targets and invalid cursors before allocating pools", async () => {
  vi.stubEnv("PASSAGE_SEARCH_DATABASE_URL", "postgresql://source/legislation_passage_search")
  await expect(runRegulatorySearchRights({})).rejects.toThrow("separate search host")
  await expect(runRegulatorySearchRights({ cursor: { kind: "edition", id: "invalid" } })).rejects.toThrow(/uuid/i)
  expect(mocks.pool).not.toHaveBeenCalled()
})
it("returns resumable work and closes both pools after success or failure", async () => {
  const result = { cursor: null, complete: false, results: [] }
  mocks.reconcile.mockResolvedValueOnce(result)
  expect(await runRegulatorySearchRights({})).toEqual(result)
  expect(mocks.end).toHaveBeenCalledTimes(2)
  mocks.reconcile.mockRejectedValueOnce(new Error("database unavailable"))
  await expect(runRegulatorySearchRights({})).rejects.toThrow("database unavailable")
  expect(mocks.end).toHaveBeenCalledTimes(4)
})

const scope = { kind: "edition" as const, id: "00000000-0000-4000-8000-000000000001" }
const incomplete = {
  cursor: null,
  complete: false,
  results: [{ scope, allowed: false, removedMemberships: 25, removedGenerations: 25, remaining: 8 }]
}
it("continues a partially drained scope with its unchanged cursor and stops when the sweep completes", async () => {
  mocks.reconcile
    .mockResolvedValueOnce(incomplete)
    .mockResolvedValueOnce({ cursor: scope, complete: true, results: [] })
  mocks.trigger.mockResolvedValue({ id: "child-run" })
  expect(await continueRegulatorySearchRights({}, "parent-run")).toMatchObject({
    complete: false,
    continuationRunId: "child-run"
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-search-rights",
    { cursor: null },
    { idempotencyKey: "regulatory-search-rights:continue:parent-run" }
  )
  expect(mocks.end).toHaveBeenCalledTimes(2)
  expect(await continueRegulatorySearchRights({ cursor: null }, "child-run")).toMatchObject({
    complete: true,
    continuationRunId: null
  })
  expect(mocks.trigger).toHaveBeenCalledTimes(1)
})
it("uses the same successor key after an uncertain dispatch and does not advance past a failed batch", async () => {
  mocks.reconcile.mockResolvedValue(incomplete)
  mocks.trigger.mockRejectedValueOnce(new Error("uncertain dispatch")).mockResolvedValueOnce({ id: "same-child" })
  await expect(continueRegulatorySearchRights({}, "retried-run")).rejects.toThrow("uncertain dispatch")
  expect(await continueRegulatorySearchRights({}, "retried-run")).toMatchObject({ continuationRunId: "same-child" })
  expect(mocks.trigger.mock.calls[0]).toEqual(mocks.trigger.mock.calls[1])
  mocks.reconcile.mockRejectedValueOnce(new Error("source unavailable"))
  await expect(continueRegulatorySearchRights({}, "failed-run")).rejects.toThrow("source unavailable")
  expect(mocks.trigger).toHaveBeenCalledTimes(2)
})
it("rejects an empty incomplete batch instead of spawning an endless continuation chain", async () => {
  mocks.reconcile.mockResolvedValue({ cursor: null, complete: false, results: [] })
  await expect(continueRegulatorySearchRights({}, "empty-run")).rejects.toThrow("regulatory_rights_no_progress")
  expect(mocks.trigger).not.toHaveBeenCalled()
})
