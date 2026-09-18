import { expect, it, vi } from "vitest"
import { inspectLegalPassageBackfillStart, requireLegalPassageBackfillApply } from "./passage-backfill-start.js"

const editionId = "00000000-0000-4000-8000-000000000001"
const waveId = "00000000-0000-4000-8000-000000000002"
const catalogHash = "a".repeat(64)
const mocks = vi.hoisted(() => ({ audit: vi.fn() }))
const admission = {
  catalogHash,
  model: "voyageai/voyage-4" as const,
  tokenizerId: "pinned:voyage-4",
  admission: {
    contract: "legal-passage-manifest-admission" as const,
    catalogHash,
    model: "voyageai/voyage-4" as const,
    tokenizerId: "pinned:voyage-4",
    scopeKind: "edition" as const,
    partitions: [{ ownerId: editionId, versions: 12, passages: 18 }]
  },
  totals: { partitions: 1, versions: 12, passages: 18, materialized: 2, pending: 10 },
  partitions: [{ ownerId: editionId, versions: 12, passages: 18, materialized: 2, pending: 10 }]
}

vi.mock("./passage-manifest-admission.js", () => ({
  auditLegalPassageManifestAdmission: mocks.audit
}))

const input = {
  catalogPath: "catalog.json",
  catalogHash,
  environment: "production",
  waveId,
  source: "ecfr" as const,
  publishedBefore: "2026-09-17T08:00:00-07:00",
  limit: 25
}

it("builds one immutable controller payload from the re-audited catalog", async () => {
  mocks.audit.mockResolvedValue(admission)
  const report = await inspectLegalPassageBackfillStart({} as never, input)

  expect(report).toMatchObject({
    status: "planned",
    environment: "production",
    catalog: { hash: catalogHash, model: "voyageai/voyage-4", tokenizerId: "pinned:voyage-4" },
    totals: admission.totals,
    canApply: true,
    payload: {
      controller: {
        waveId,
        source: "ecfr",
        model: "voyageai/voyage-4",
        publishedBefore: "2026-09-17T15:00:00.000Z",
        limit: 25,
        retryBlocked: false,
        pendingOnly: false,
        manifestAdmission: admission.admission
      }
    }
  })
  expect(report.planId).toMatch(/^[a-f0-9]{64}$/)
  expect(await inspectLegalPassageBackfillStart({} as never, input)).toEqual(report)
})

it("requires the exact preview, deployment environment and trusted selected model before apply", async () => {
  mocks.audit.mockResolvedValue(admission)
  const report = await inspectLegalPassageBackfillStart({} as never, input)

  expect(
    requireLegalPassageBackfillApply(report, {
      environment: "production",
      model: "voyageai/voyage-4",
      planId: report.planId
    })
  ).toEqual(report.payload)
  for (const changed of [
    { environment: "staging", model: "voyageai/voyage-4", planId: report.planId },
    { environment: "production", model: "openai/text-embedding-3-small", planId: report.planId },
    { environment: "production", model: "voyageai/voyage-4", planId: "b".repeat(64) }
  ]) {
    expect(() => requireLegalPassageBackfillApply(report, changed)).toThrow()
  }
})

it("rejects a catalog whose admitted owner kind does not match the requested source", async () => {
  mocks.audit.mockResolvedValue(admission)
  await expect(inspectLegalPassageBackfillStart({} as never, { ...input, source: "govinfo-fr" })).rejects.toThrow(
    "legal_passage_backfill_scope_mismatch"
  )
})
