import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  continue: vi.fn(),
  createKey: vi.fn(),
  end: vi.fn(),
  finalize: vi.fn(),
  process: vi.fn(),
  trigger: vi.fn()
}))

vi.mock("@trigger.dev/sdk", () => ({
  idempotencyKeys: { create: mocks.createKey },
  task: <T>(definition: T) => definition,
  tasks: { trigger: mocks.trigger }
}))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/fr-rendition-processing.js", () => ({
  processFrRendition: mocks.process
}))
vi.mock("../../ingestion/regulations/fr-publication-finalization.js", () => ({
  finalizeFrIssuePublication: mocks.finalize
}))
vi.mock("../../ingestion/regulations/discovery-dispatch.js", () => ({
  completeLegalDiscoveryDispatch: mocks.complete
}))
vi.mock("./regulatory-discovery-continuation.js", () => ({
  continueRegulatoryDiscoveryStage: mocks.continue
}))

import {
  continueRegulatoryFrPublicationFinalization,
  continueRegulatoryFrRendition,
  runRegulatoryFrPublicationFinalization,
  runRegulatoryFrRendition
} from "./regulatory-fr-publication.js"

const payload = {
  manifestId: "a".repeat(64),
  scopeKey: "b".repeat(64),
  unitKey: "c".repeat(64),
  documentNumber: "2026-12345"
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/legislation")
  vi.stubEnv("REGULATORY_FR_PDF_DIRECTORY", "D:\\regulatory-fr-pdfs")
  vi.stubEnv("AZURE_STORAGE_ACCOUNT", "regulatorytest")
  mocks.createKey.mockResolvedValue("stable-key")
})
afterEach(() => vi.unstubAllEnvs())

it("runs one bounded rendition worker against the configured retained directory", async () => {
  mocks.process.mockResolvedValue({ state: "validated", publicationReady: false })
  await expect(runRegulatoryFrRendition(payload)).resolves.toMatchObject({ state: "validated" })
  expect(mocks.process).toHaveBeenCalledWith(
    expect.anything(),
    { ...payload, pdfRoot: "D:\\regulatory-fr-pdfs" },
    { pdfStore: expect.anything() }
  )
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("submits the idempotent finalizer only when the last rendition opens the issue gate", async () => {
  mocks.process.mockResolvedValue({ state: "validated", publicationReady: true })
  mocks.trigger.mockResolvedValue({ id: "finalizer-run" })
  await expect(continueRegulatoryFrRendition(payload)).resolves.toMatchObject({ finalizationRunId: "finalizer-run" })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-fr-publication-finalize",
    { manifestId: payload.manifestId, unitKey: payload.unitKey },
    { idempotencyKey: "stable-key" }
  )
})

it("closes canonical publication and replenishes discovery only after the finalizer succeeds", async () => {
  const finalizationPayload = { manifestId: payload.manifestId, unitKey: payload.unitKey }
  mocks.finalize.mockResolvedValue({ generationId: "d".repeat(64), state: "published" })
  mocks.complete.mockResolvedValue({ sourceId: "govinfo-fr", scopeKey: payload.scopeKey })
  mocks.continue.mockResolvedValue({ id: "controller-run" })
  await expect(continueRegulatoryFrPublicationFinalization(finalizationPayload)).resolves.toMatchObject({
    state: "published",
    continuationRunId: "controller-run"
  })
  expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), "publication", finalizationPayload)
  expect(mocks.end.mock.invocationCallOrder[0]).toBeLessThan(mocks.continue.mock.invocationCallOrder[0]!)
})

it("materializes durable metadata and PDFs for finalization", async () => {
  const finalizationPayload = { manifestId: payload.manifestId, unitKey: payload.unitKey }
  mocks.finalize.mockResolvedValue({ generationId: "d".repeat(64), state: "published" })
  mocks.complete.mockResolvedValue({ sourceId: "govinfo-fr", scopeKey: payload.scopeKey })
  await expect(runRegulatoryFrPublicationFinalization(finalizationPayload)).resolves.toMatchObject({
    state: "published"
  })
  expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), finalizationPayload, {
    metadataStore: expect.anything(),
    pdfStore: expect.anything(),
    scratchRoot: "D:\\regulatory-fr-pdfs"
  })
})
