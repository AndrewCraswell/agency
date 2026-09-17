import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ publish: vi.fn(), end: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/discovery-publication.js", () => ({
  publishLegalDiscoveryUnit: mocks.publish
}))

import { runRegulatoryDiscoveryPublication } from "./regulatory-discovery-publication.js"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/legislation")
})
afterEach(() => vi.unstubAllEnvs())

it("publishes one durable discovery identity", async () => {
  mocks.publish.mockResolvedValue({ generationId: "c".repeat(64), editionId: randomUUID(), state: "published" })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(runRegulatoryDiscoveryPublication(payload)).resolves.toMatchObject({ state: "published" })
  expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), payload)
  expect(mocks.end).toHaveBeenCalledOnce()
})

it.each([
  { manifestId: "bad", unitKey: "b".repeat(64) },
  { manifestId: "a".repeat(64), unitKey: "bad" }
])("rejects malformed identities before opening the database", async (payload) => {
  await expect(runRegulatoryDiscoveryPublication(payload)).rejects.toThrow()
  expect(mocks.publish).not.toHaveBeenCalled()
})
