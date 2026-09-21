import { describe, expect, it } from "vitest"
import {
  backfillControllerPayloadSchema,
  backfillExecutionPolicy,
  backfillIdempotencyKey,
  createBackfillUnits,
  defaultGovInfoBillTypes,
  derivedBackfillShardCountFor,
  maximumDerivedBackfillShardCountFor
} from "./backfill-contract.js"

describe("backfill contract", () => {
  it("creates deterministic resumable units for selected phases", () => {
    const payload = backfillControllerPayloadSchema.parse({
      endCongress: 119,
      forceGovInfo: true,
      jurisdictions: ["ca", "tx"],
      openStatesManifestBlob: "manifests/openstates.json",
      phases: ["openstates-history", "govinfo-history", "congress-history", "materials"],
      rebuildId: "initial-production",
      startCongress: 118
    })

    const units = createBackfillUnits(payload)
    expect(units).toHaveLength(5)
    expect(units[0]?.key).toBe("openstates-history:ca")
    expect(units[2]?.key).toBe(`govinfo-history:118-119:${defaultGovInfoBillTypes.join("-")}`)
    expect(units[2]?.payload).toMatchObject({ force: true })
    expect(units.at(-1)?.key).toBe("materials")
    expect(backfillIdempotencyKey(payload.rebuildId, units[0]!.key)).toBe(
      "backfill:initial-production:openstates-history:ca"
    )
  })

  it("rejects an inverted Congress range", () => {
    expect(() =>
      backfillControllerPayloadSchema.parse({
        endCongress: 118,
        openStatesManifestBlob: "manifests/openstates.json",
        rebuildId: "invalid",
        startCongress: 119
      })
    ).toThrow("startCongress must not exceed endCongress")
  })

  it("rejects the removed execution-mode field", () => {
    expect(() =>
      backfillControllerPayloadSchema.parse({
        endCongress: 119,
        mode: "shadow",
        openStatesManifestBlob: "manifests/openstates.json",
        rebuildId: "invalid-mode",
        startCongress: 119
      })
    ).toThrow("Unrecognized key")
  })

  it("uses deterministic parallel shards only for safely partitioned derived drains", () => {
    expect(derivedBackfillShardCountFor("bill-documents")).toBe(64)
    expect(derivedBackfillShardCountFor("embeddings")).toBe(16)
    expect(maximumDerivedBackfillShardCountFor("embeddings")).toBe(200)
    expect(derivedBackfillShardCountFor("supporting-materials")).toBe(24)
    expect(backfillExecutionPolicy.derivedQueueConcurrencyLimit).toBe(128)
    expect(backfillExecutionPolicy.derivedShardControllerQueueConcurrencyLimit).toBe(128)
  })
})
