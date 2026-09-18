import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  source: vi.fn(),
  complete: vi.fn(),
  continue: vi.fn(),
  end: vi.fn()
}))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/discovery-publication.js", () => ({
  publishLegalDiscoveryUnit: mocks.publish,
  legalDiscoveryPublicationSource: mocks.source
}))
vi.mock("../../ingestion/regulations/discovery-dispatch.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/discovery-dispatch.js")>()),
  completeLegalDiscoveryDispatch: mocks.complete
}))
vi.mock("./regulatory-discovery-continuation.js", () => ({
  continueRegulatoryDiscoveryStage: mocks.continue
}))

import {
  continueRegulatoryDiscoveryPublication,
  runRegulatoryDiscoveryPublication
} from "./regulatory-discovery-publication.js"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/legislation")
  mocks.complete.mockResolvedValue({ sourceId: "ecfr", scopeKey: "d".repeat(64) })
  mocks.continue.mockResolvedValue({ id: "controller-run" })
  mocks.source.mockResolvedValue("ecfr")
})
afterEach(() => vi.unstubAllEnvs())

it("publishes one durable discovery identity", async () => {
  mocks.publish.mockResolvedValue({ generationId: "c".repeat(64), editionId: randomUUID(), state: "published" })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(runRegulatoryDiscoveryPublication(payload)).resolves.toMatchObject({ state: "published" })
  expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), payload)
  expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), "publication", payload)
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("closes the worker pool before replenishing the bounded controller", async () => {
  mocks.publish.mockResolvedValue({ generationId: "c".repeat(64), editionId: randomUUID(), state: "published" })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(continueRegulatoryDiscoveryPublication(payload)).resolves.toMatchObject({
    continuationRunId: "controller-run"
  })
  expect(mocks.end.mock.invocationCallOrder[0]).toBeLessThan(mocks.continue.mock.invocationCallOrder[0]!)
  expect(mocks.continue).toHaveBeenCalledWith("publication", payload, {
    sourceId: "ecfr",
    scopeKey: "d".repeat(64)
  })
})

it.each([
  { manifestId: "bad", unitKey: "b".repeat(64) },
  { manifestId: "a".repeat(64), unitKey: "bad" }
])("rejects malformed identities before opening the database", async (payload) => {
  await expect(runRegulatoryDiscoveryPublication(payload)).rejects.toThrow()
  expect(mocks.publish).not.toHaveBeenCalled()
})
