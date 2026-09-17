import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ acquire: vi.fn(), end: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/discovery-acquisition.js", () => ({
  acquireLegalDiscoveryArtifact: mocks.acquire
}))

import { runRegulatoryDiscoveryAcquisition } from "./regulatory-discovery-acquisition.js"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/legislation")
  vi.stubEnv("REGULATORY_ARTIFACT_DIRECTORY", "D:\\regulatory-artifacts")
})
afterEach(() => vi.unstubAllEnvs())

it("passes only durable identities and the configured artifact root to acquisition", async () => {
  mocks.acquire.mockResolvedValue({ artifactHash: "c".repeat(64), bytes: 42, reused: false })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(runRegulatoryDiscoveryAcquisition(payload)).resolves.toMatchObject({ bytes: 42 })
  expect(mocks.acquire).toHaveBeenCalledWith(expect.anything(), {
    ...payload,
    artifactDirectory: "D:\\regulatory-artifacts"
  })
  expect(mocks.end).toHaveBeenCalledOnce()
})

it.each([
  { manifestId: "bad", unitKey: "b".repeat(64) },
  { manifestId: "a".repeat(64), unitKey: "bad" }
])("rejects malformed identities before opening the database", async (payload) => {
  await expect(runRegulatoryDiscoveryAcquisition(payload)).rejects.toThrow()
  expect(mocks.acquire).not.toHaveBeenCalled()
})

it("rejects a missing artifact root before opening the database", async () => {
  vi.stubEnv("REGULATORY_ARTIFACT_DIRECTORY", "")
  await expect(
    runRegulatoryDiscoveryAcquisition({ manifestId: "a".repeat(64), unitKey: "b".repeat(64) })
  ).rejects.toThrow()
  expect(mocks.acquire).not.toHaveBeenCalled()
})
