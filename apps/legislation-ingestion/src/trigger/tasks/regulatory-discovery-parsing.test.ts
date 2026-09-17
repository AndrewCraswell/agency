import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ parse: vi.fn(), complete: vi.fn(), continue: vi.fn(), end: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/discovery-parsing.js", () => ({ parseLegalDiscoveryArtifact: mocks.parse }))
vi.mock("../../ingestion/regulations/discovery-dispatch.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/discovery-dispatch.js")>()),
  completeLegalDiscoveryDispatch: mocks.complete
}))
vi.mock("./regulatory-discovery-continuation.js", () => ({
  continueRegulatoryDiscoveryStage: mocks.continue
}))

import { continueRegulatoryDiscoveryParsing, runRegulatoryDiscoveryParsing } from "./regulatory-discovery-parsing.js"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/legislation")
  vi.stubEnv("REGULATORY_NORMALIZED_DIRECTORY", "D:\\regulatory-normalized")
  mocks.complete.mockResolvedValue({ sourceId: "ecfr", scopeKey: "d".repeat(64) })
  mocks.continue.mockResolvedValue({ id: "controller-run" })
})
afterEach(() => vi.unstubAllEnvs())

it("passes durable identities and the configured normalized root to parsing", async () => {
  mocks.parse.mockResolvedValue({ generation: "c".repeat(64), records: 2, reused: false })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(runRegulatoryDiscoveryParsing(payload)).resolves.toMatchObject({ records: 2 })
  expect(mocks.parse).toHaveBeenCalledWith(expect.anything(), { ...payload, outputRoot: "D:\\regulatory-normalized" })
  expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), "parsing", payload)
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("closes the worker pool before replenishing the bounded controller", async () => {
  mocks.parse.mockResolvedValue({ generation: "c".repeat(64), records: 2, reused: false })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(continueRegulatoryDiscoveryParsing(payload)).resolves.toMatchObject({
    continuationRunId: "controller-run"
  })
  expect(mocks.end.mock.invocationCallOrder[0]).toBeLessThan(mocks.continue.mock.invocationCallOrder[0]!)
  expect(mocks.continue).toHaveBeenCalledWith("parsing", payload, {
    sourceId: "ecfr",
    scopeKey: "d".repeat(64)
  })
})

it.each([
  { manifestId: "bad", unitKey: "b".repeat(64) },
  { manifestId: "a".repeat(64), unitKey: "bad" }
])("rejects malformed identities before opening the database", async (payload) => {
  await expect(runRegulatoryDiscoveryParsing(payload)).rejects.toThrow()
  expect(mocks.parse).not.toHaveBeenCalled()
})

it("rejects a missing normalized root before opening the database", async () => {
  vi.stubEnv("REGULATORY_NORMALIZED_DIRECTORY", "")
  await expect(runRegulatoryDiscoveryParsing({ manifestId: "a".repeat(64), unitKey: "b".repeat(64) })).rejects.toThrow()
  expect(mocks.parse).not.toHaveBeenCalled()
})
