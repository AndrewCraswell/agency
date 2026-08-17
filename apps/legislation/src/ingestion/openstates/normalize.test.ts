import { readFile } from "node:fs/promises"
import { beforeAll, describe, expect, it } from "vitest"
import { normalizeOpenStatesBill } from "./normalize.js"

let fixture: unknown
let sparseFixture: unknown

beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(new URL("../../../tests/fixtures/openstates/wa-hb-1234.json", import.meta.url), "utf8")
  )
  sparseFixture = JSON.parse(
    await readFile(new URL("../../../tests/fixtures/openstates/ca-ab-7-sparse.json", import.meta.url), "utf8")
  )
})

describe("Open States normalization", () => {
  it("normalizes a representative state bill aggregate", () => {
    const result = normalizeOpenStatesBill(fixture, {
      jurisdictionCode: "WA",
      jurisdictionName: "Washington",
      sessionName: "2025-2026 Regular Session"
    })

    expect(result.aggregate.bill).toMatchObject({
      chamber: "lower",
      id: "bill:wa:2025-2026:hb:1234",
      jurisdictionId: "jurisdiction:wa",
      sessionId: "session:wa:2025-2026",
      summary: "Improves access to legislative information.",
      upstreamIds: { openstates: "ocd-bill/wa-hb-1234" }
    })
    expect(result.aggregate.actions).toHaveLength(2)
    expect(result.aggregate.sponsors).toHaveLength(2)
    expect(result.aggregate.people).toHaveLength(1)
    expect(result.aggregate.votes?.[0]).toMatchObject({
      positions: [{ option: "yes", personId: "person:openstates:ocd-person-example" }],
      vote: { noCount: 8, result: "pass", yesCount: 90 }
    })
    expect(result.aggregate.documents).toHaveLength(3)
    expect(result.aggregate.relations).toEqual([
      {
        billId: "bill:wa:2025-2026:hb:1234",
        classification: "companion",
        relatedBillId: "bill:wa:2025-2026:sb:5678"
      }
    ])
    expect(result.diagnostics).toEqual([
      { field: "votes.voter_id", reason: "unmatched vote position was omitted", value: expect.any(Object) },
      { field: "actions.date", reason: "fuzzy date was not fabricated", value: "2025" }
    ])
  })

  it("converges formatting variations on the same canonical bill", () => {
    const source = { ...(fixture as Record<string, unknown>), identifier: " h.b. 001234 " }
    const result = normalizeOpenStatesBill(source, { jurisdictionCode: "wa", jurisdictionName: "Washington" })
    expect(result.aggregate.bill.id).toBe("bill:wa:2025-2026:hb:1234")
  })

  it("normalizes a sparse record from a second state without fabricating children", () => {
    const result = normalizeOpenStatesBill(sparseFixture, {
      jurisdictionCode: "ca",
      jurisdictionName: "California"
    })

    expect(result.aggregate.bill).toMatchObject({
      id: "bill:ca:2023-2024:ab:7",
      summary: undefined,
      title: "A sparse provider record"
    })
    expect(result.aggregate.actions).toEqual([])
    expect(result.aggregate.documents).toEqual([])
    expect(result.aggregate.sponsors).toEqual([])
    expect(result.aggregate.votes).toEqual([])
  })

  it("rejects records missing minimum bill fields", () => {
    expect(() =>
      normalizeOpenStatesBill(
        { identifier: "HB 1", legislative_session: "2025", title: "Missing a source" },
        { jurisdictionCode: "WA", jurisdictionName: "Washington" }
      )
    ).toThrow("source URL")
  })

  it("deduplicates provider children that would violate persistence constraints", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    for (const field of ["actions", "documents", "related_bills", "sponsorships", "versions", "votes"] as const) {
      const values = source[field]
      if (Array.isArray(values) && values[0] !== undefined) {
        values.push(structuredClone(values[0]))
      }
    }
    const relatedBills = source.related_bills
    if (Array.isArray(relatedBills)) {
      relatedBills.push({ identifier: "HB 1234", relation_type: "related" })
    }

    const { aggregate } = normalizeOpenStatesBill(source, {
      jurisdictionCode: "WA",
      jurisdictionName: "Washington"
    })

    expect(new Set((aggregate.actions ?? []).map((action) => action.ordinal)).size).toBe(aggregate.actions?.length)
    expect(new Set((aggregate.documents ?? []).map((item) => item.document.sourceUrl)).size).toBe(
      aggregate.documents?.length
    )
    expect(new Set((aggregate.votes ?? []).map((vote) => vote.vote.id)).size).toBe(aggregate.votes?.length)
    expect((aggregate.relations ?? []).every((relation) => relation.relatedBillId !== aggregate.bill.id)).toBe(true)
  })

  it("keeps document identities stable when the provider reorders its arrays", () => {
    const original = normalizeOpenStatesBill(fixture, {
      jurisdictionCode: "WA",
      jurisdictionName: "Washington"
    }).aggregate
    const reordered = structuredClone(fixture) as Record<string, unknown>
    for (const field of ["documents", "versions"] as const) {
      const values = reordered[field]
      if (Array.isArray(values)) {
        values.reverse()
      }
    }
    const normalized = normalizeOpenStatesBill(reordered, {
      jurisdictionCode: "WA",
      jurisdictionName: "Washington"
    }).aggregate
    const identities = (aggregate: typeof original) =>
      new Map((aggregate.documents ?? []).map((document) => [document.document.sourceUrl, document.document.id]))

    expect(identities(normalized)).toEqual(identities(original))
  })

  it("retains a bill when optional child records are malformed", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    source.related_bills = [{ relation_type: "related" }]
    source.sponsorships = [{ primary: false }]
    source.votes = [{ counts: "unavailable" }]

    const { aggregate } = normalizeOpenStatesBill(source, {
      jurisdictionCode: "WA",
      jurisdictionName: "Washington"
    })

    expect(aggregate.bill.id).toBe("bill:wa:2025-2026:hb:1234")
    expect(aggregate.relations).toEqual([])
    expect(aggregate.sponsors).toEqual([])
    expect(aggregate.votes).toEqual([expect.objectContaining({ positions: [] })])
  })
})
