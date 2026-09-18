import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createKey: vi.fn(),
  end: vi.fn(),
  plan: vi.fn(),
  trigger: vi.fn()
}))
vi.mock("@trigger.dev/sdk", () => ({
  idempotencyKeys: { create: mocks.createKey },
  task: <T>(value: T) => value,
  tasks: { trigger: mocks.trigger }
}))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/fr-publication-recovery.js", async (original) => ({
  ...(await original<typeof import("../../ingestion/regulations/fr-publication-recovery.js")>()),
  planFrPublicationRecoveryPage: mocks.plan
}))

import { runRegulatoryFrPublicationRecovery } from "./regulatory-fr-publication-recovery.js"

const scopeKey = "a".repeat(64)
const manifestId = "b".repeat(64)
const unitKey = "c".repeat(64)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/legislation")
  mocks.createKey.mockResolvedValue("stable-key")
  mocks.trigger.mockResolvedValueOnce({ id: "rendition-run" }).mockResolvedValueOnce({ id: "continuation-run" })
  mocks.plan.mockResolvedValue({
    items: [
      {
        kind: "rendition",
        manifestId,
        scopeKey,
        unitKey,
        documentNumber: "2026-12345",
        updatedAt: "2026-09-18T00:00:00.000Z"
      }
    ],
    selected: 1,
    exhausted: false,
    afterUnitKey: unitKey,
    afterDocumentNumber: "2026-12345"
  })
})
afterEach(() => vi.unstubAllEnvs())

it("resubmits eligible work and continues a full bounded page without registering a schedule", async () => {
  await expect(runRegulatoryFrPublicationRecovery({ scopeKey, limit: 1 })).resolves.toMatchObject({
    runs: [{ kind: "rendition", runId: "rendition-run" }],
    continuationRunId: "continuation-run"
  })
  expect(mocks.trigger).toHaveBeenNthCalledWith(
    1,
    "regulatory-fr-rendition",
    { manifestId, scopeKey, unitKey, documentNumber: "2026-12345" },
    { idempotencyKey: "stable-key" }
  )
  expect(mocks.trigger).toHaveBeenNthCalledWith(
    2,
    "regulatory-fr-publication-recovery",
    { scopeKey, afterUnitKey: unitKey, afterDocumentNumber: "2026-12345", limit: 1 },
    { idempotencyKey: "stable-key" }
  )
  expect(mocks.end).toHaveBeenCalledOnce()
})
