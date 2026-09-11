import { describe, expect, it } from "vitest"
import {
  congressWavePayloadScopes,
  congressRecurringDerivedPayloads,
  assertCongressWaveBatchCardinality,
  congressWaveChildIdempotencyKey,
  congressWaveLeaseHandoffResult,
  deferredCongressWaveChildResult,
  firstOtherActiveCongressWave,
  parseCongressEntityRangeScope
} from "./congress-wave-coordinator.js"

describe("Congress wave child deferred results", () => {
  it("refreshes historical identities through the singleton allocator without launching other domains", () => {
    expect(congressWavePayloadScopes({ kind: "entities", startCongress: 105, endCongress: 119 })).toEqual([
      "congress:entities-range:105-119"
    ])
    expect(() => congressWavePayloadScopes({ kind: "entities", startCongress: 119, endCongress: 105 })).toThrow(
      "valid inclusive Congress range"
    )
  })
  it("returns an overlapping scope to the coordinator after the active lease expires", () => {
    const retryAt = new Date("2026-08-19T08:27:45.000Z")
    expect(congressWaveLeaseHandoffResult("congress:events:119", 0, retryAt)).toEqual({
      attempts: 0,
      retryAt,
      scope: "congress:events:119",
      status: "incomplete"
    })
  })

  it("does not allocate a second wave while another coordinator is active", () => {
    expect(
      firstOtherActiveCongressWave(
        [
          { id: "current", status: "EXECUTING" },
          { id: "older", status: "WAITING" },
          { id: "finished", status: "COMPLETED" }
        ],
        "current"
      )
    ).toEqual({ id: "older", status: "WAITING" })
  })

  it("allows the only active coordinator to own the wave", () => {
    expect(
      firstOtherActiveCongressWave(
        [
          { id: "current", status: "EXECUTING" },
          { id: "finished", status: "COMPLETED" }
        ],
        "current"
      )
    ).toBeUndefined()
  })

  it("returns unused allocation to the coordinator after a runIngestionJob allocation handoff", () => {
    expect(
      deferredCongressWaveChildResult("congress:bills:current", 400, {
        deferKind: "allocation_exhausted",
        retryAt: new Date("2026-08-18T13:00:00.000Z"),
        status: "deferred"
      })
    ).toEqual({ attempts: 400, scope: "congress:bills:current", status: "incomplete" })
  })

  it("propagates only a provider cooldown to the coordinator waitpoint", () => {
    const retryAt = new Date("2026-08-18T12:15:00.000Z")
    expect(
      deferredCongressWaveChildResult("congress:bills:current", 400, {
        deferKind: "provider_cooldown",
        retryAt,
        status: "deferred"
      })
    ).toEqual({ attempts: 400, retryAt, scope: "congress:bills:current", status: "incomplete" })
  })

  it("uses a new child idempotency key when the same scope receives the same allocation next window", () => {
    expect(congressWaveChildIdempotencyKey("wave-run", 1, "congress:bills:current")).not.toBe(
      congressWaveChildIdempotencyKey("wave-run", 2, "congress:bills:current")
    )
  })

  it("fails closed when Trigger does not return every submitted child", () => {
    expect(() => assertCongressWaveBatchCardinality(2, 1)).toThrow("returned 1 child runs for 2 submitted children")
  })

  it("hands recurring federal records to documents and defers materials during a historical rebuild", () => {
    const documentsOnly = congressRecurringDerivedPayloads("wave-1", false)
    expect(documentsOnly).toEqual([
      {
        key: "documents",
        payload: {
          correlationId: "recurring-congress:wave-1:documents",
          jurisdictionId: "jurisdiction:us",
          kind: "bill-documents",
          maxContinuations: 100,
          rebuildId: "recurring-congress:wave-1",
          shardCount: 64,
          shardIndex: 52
        }
      }
    ])

    expect(congressRecurringDerivedPayloads("wave-2", true).map(({ key }) => key)).toEqual(["documents", "materials"])
  })

  it("parses the single inclusive entity-history range scope", () => {
    expect(parseCongressEntityRangeScope("congress:entities-range:113-119")).toEqual({
      endCongress: 119,
      startCongress: 113
    })
    expect(parseCongressEntityRangeScope("congress:entities:119")).toBeUndefined()
    expect(() => parseCongressEntityRangeScope("congress:entities-range:119-113")).toThrow("must be ascending")
  })
})
