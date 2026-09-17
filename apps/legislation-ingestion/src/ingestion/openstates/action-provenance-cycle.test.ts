import { describe, expect, it } from "vitest"
import { prepareActionProvenanceEvidence, selectActionProvenanceBatch } from "./action-provenance-cycle.js"

function archive(...identifiers: string[]) {
  return new TextEncoder().encode(
    JSON.stringify(
      identifiers.map((identifier) => ({
        identifier,
        legislative_session: "34",
        title: identifier,
        sources: [{ url: `https://legislature.example/${identifier.toLowerCase().replaceAll(" ", "")}` }],
        actions: [
          {
            order: 0,
            date: "2026-01-20",
            description: "Introduced",
            classification: ["introduction"]
          }
        ]
      }))
    )
  )
}

describe("session action provenance reconciliation", () => {
  it("normalizes and sorts one immutable session archive", () => {
    const evidence = prepareActionProvenanceEvidence(archive("SB 2", "HB 1"), { state: "ak", session: "34" })
    expect(evidence.map((bill) => bill.billId)).toEqual(["bill:ak:34:hb:1", "bill:ak:34:sb:2"])
    expect(evidence[0]?.actions).toEqual([
      expect.objectContaining({
        actionDate: "2026-01-20",
        description: "Introduced",
        sourceUrl: "https://legislature.example/hb1"
      })
    ])
  })

  it("uses an exact immutable cursor and reports remaining work", () => {
    const evidence = prepareActionProvenanceEvidence(archive("HB 1", "HB 2", "HB 3"), {
      state: "ak",
      session: "34"
    })
    expect(selectActionProvenanceBatch(evidence, { limit: 2 })).toMatchObject({
      complete: false,
      nextAfterBillId: "bill:ak:34:hb:2",
      remaining: 1,
      total: 3
    })
    expect(selectActionProvenanceBatch(evidence, { afterBillId: "bill:ak:34:hb:2", limit: 2 })).toMatchObject({
      complete: true,
      nextAfterBillId: "bill:ak:34:hb:3",
      remaining: 0
    })
    expect(() => selectActionProvenanceBatch(evidence, { afterBillId: "bill:ak:34:hb:999" })).toThrow(
      "cursor is not present"
    )
  })

  it("rejects duplicate and out-of-scope archive identities", () => {
    expect(() => prepareActionProvenanceEvidence(archive("HB 1", "HB 1"), { state: "ak", session: "34" })).toThrow(
      "duplicate bill identities"
    )
    expect(() => prepareActionProvenanceEvidence(archive("HB 1"), { state: "ak", session: "33" })).toThrow(
      "outside the requested state and session"
    )
  })
})
