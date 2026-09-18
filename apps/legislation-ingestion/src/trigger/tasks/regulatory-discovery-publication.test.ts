import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  source: vi.fn(),
  complete: vi.fn(),
  completeAnnual: vi.fn(),
  materializeAnnual: vi.fn(),
  inspectAnnual: vi.fn(),
  trigger: vi.fn(),
  continue: vi.fn(),
  end: vi.fn()
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  tasks: { trigger: mocks.trigger },
  idempotencyKeys: { create: async (value: string) => value }
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
  completeLegalDiscoveryDispatch: mocks.complete,
  completeAnnualCfrMaterializationDispatch: mocks.completeAnnual
}))
vi.mock("../../ingestion/regulations/annual-discovery-publication.js", () => ({
  materializeAnnualCfrDiscoveryUnit: mocks.materializeAnnual,
  inspectAnnualCfrDiscoveryPublication: mocks.inspectAnnual
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
  vi.stubEnv("AZURE_STORAGE_ACCOUNT", "regulatorytest")
  vi.stubEnv("REGULATORY_NORMALIZED_DIRECTORY", "D:\\regulatory-normalized")
  mocks.complete.mockResolvedValue({ sourceId: "ecfr", scopeKey: "d".repeat(64) })
  mocks.completeAnnual.mockResolvedValue({ sourceId: "govinfo-cfr", scopeKey: "d".repeat(64) })
  mocks.continue.mockResolvedValue({ id: "controller-run" })
  mocks.source.mockResolvedValue("ecfr")
})
afterEach(() => vi.unstubAllEnvs())

it("publishes one durable discovery identity", async () => {
  mocks.publish.mockResolvedValue({ generationId: "c".repeat(64), editionId: randomUUID(), state: "published" })
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  await expect(runRegulatoryDiscoveryPublication(payload)).resolves.toMatchObject({ state: "published" })
  expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), payload, {
    sourceStore: expect.anything(),
    normalizedStore: expect.anything(),
    scratchRoot: "D:\\regulatory-normalized"
  })
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

it("materializes an annual volume and submits the exact complete-title barrier", async () => {
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  const annualPayload = {
    manifestId: payload.manifestId,
    year: 2023,
    title: 1,
    generationIds: ["c".repeat(64)]
  }
  mocks.source.mockResolvedValue("govinfo-cfr")
  mocks.materializeAnnual.mockResolvedValue({
    generationId: "c".repeat(64),
    editionId: randomUUID(),
    state: "materialized",
    year: 2023,
    title: 1,
    volume: 1
  })
  mocks.inspectAnnual.mockResolvedValue({ ready: true, payload: annualPayload })
  mocks.trigger.mockResolvedValue({ id: "annual-publication-run" })
  await expect(continueRegulatoryDiscoveryPublication(payload)).resolves.toMatchObject({
    state: "annual_publication_pending",
    annualPublicationRunId: "annual-publication-run",
    continuationRunId: null
  })
  expect(mocks.completeAnnual).toHaveBeenCalledWith(expect.anything(), payload, "c".repeat(64))
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-annual-publication",
    annualPayload,
    expect.objectContaining({ idempotencyKey: expect.stringMatching(/^regulatory-annual-publication:/) })
  )
  expect(mocks.continue).not.toHaveBeenCalled()
})

it.each([
  { manifestId: "bad", unitKey: "b".repeat(64) },
  { manifestId: "a".repeat(64), unitKey: "bad" }
])("rejects malformed identities before opening the database", async (payload) => {
  await expect(runRegulatoryDiscoveryPublication(payload)).rejects.toThrow()
  expect(mocks.publish).not.toHaveBeenCalled()
})
