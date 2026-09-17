import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ parse: vi.fn(), end: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/discovery-parsing.js", () => ({ parseLegalDiscoveryArtifact: mocks.parse }))

import { runRegulatoryDiscoveryParsing } from "./regulatory-discovery-parsing.js"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/legislation")
  vi.stubEnv("REGULATORY_NORMALIZED_DIRECTORY", "D:\\regulatory-normalized")
})
afterEach(() => vi.unstubAllEnvs())

it("passes durable identities and the configured normalized root to parsing", async () => {
  mocks.parse.mockResolvedValue({ generation: "c".repeat(64), records: 2, reused: false })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(runRegulatoryDiscoveryParsing(payload)).resolves.toMatchObject({ records: 2 })
  expect(mocks.parse).toHaveBeenCalledWith(expect.anything(), { ...payload, outputRoot: "D:\\regulatory-normalized" })
  expect(mocks.end).toHaveBeenCalledOnce()
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
