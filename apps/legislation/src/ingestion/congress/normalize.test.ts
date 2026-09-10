import { readFile } from "node:fs/promises"
import { beforeAll, describe, expect, it } from "vitest"
import { congressBillBundleSchema, normalizeCongressBillBundle } from "./normalize.js"

let fixture: unknown

beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(new URL("../../../tests/fixtures/congress/119-hr-1234.json", import.meta.url), "utf8")
  )
})

describe("Congress.gov normalization", () => {
  it("collapses repeated source sponsor observations without changing their canonical identity", () => {
    const source = congressBillBundleSchema.parse(fixture)
    const expected = normalizeCongressBillBundle(source)
    source.bill.sponsors = [...source.bill.sponsors, ...source.bill.sponsors]
    source.cosponsors = [...source.cosponsors, ...source.cosponsors]
    expect(normalizeCongressBillBundle(source).sponsors).toEqual(expected.sponsors)
    expect(normalizeCongressBillBundle(source).people).toEqual(expected.people)
  })

  it("rejects conflicting sponsor observations rather than picking an arbitrary name or role", () => {
    const source = congressBillBundleSchema.parse(fixture)
    const member = source.bill.sponsors[0]!
    source.bill.sponsors.push({ ...member, fullName: "Conflicting name" })
    expect(() => normalizeCongressBillBundle(source)).toThrow("Conflicting Congress sponsor observations")
    source.bill.sponsors.pop()
    source.cosponsors.push(member)
    expect(() => normalizeCongressBillBundle(source)).toThrow("Conflicting Congress sponsor observations")
  })

  it("updates the same canonical federal bill as GovInfo while preserving omitted documents", () => {
    const aggregate = normalizeCongressBillBundle(fixture)
    expect(aggregate.bill).toMatchObject({
      id: "bill:us:119:hr:1234",
      summary: "Requires publication of structured legislative data and machine-readable updates.",
      upstreamIds: { congress: "119-hr-1234" }
    })
    expect(aggregate.actions).toHaveLength(3)
    expect(aggregate.people).toHaveLength(2)
    expect(aggregate.sponsors).toHaveLength(2)
    expect(aggregate.documents).toBeUndefined()
  })

  it("rejects malformed API bundles", () => {
    expect(() => normalizeCongressBillBundle({ bill: { congress: 119 } })).toThrow("Invalid input")
  })

  it("accepts null optional fields in older Congress records", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    source.textVersions = [
      { date: null, formats: [{ type: "PDF", url: "https://www.congress.gov/older.pdf" }], type: "Introduced" }
    ]
    const bill = source.bill as Record<string, unknown>
    bill.introducedDate = null
    bill.originChamber = null
    source.relatedBills = [
      { congress: 119, number: 22, relationshipDetails: [{ identifiedBy: "CRS", type: "Identical bill" }], type: "S" }
    ]

    const aggregate = normalizeCongressBillBundle(source)

    expect(aggregate.bill.introducedAt).toBeUndefined()
    expect(aggregate.documents?.[0]?.document).toMatchObject({
      documentDate: undefined,
      sourceUrl: "https://www.congress.gov/older.pdf"
    })
    expect(aggregate.relations?.[0]?.relatedBillId).toBe("bill:us:119:s:22")
  })

  it("persists source-declared relation direction and complete provenance when retrieved", () => {
    const aggregate = normalizeCongressBillBundle(fixture, { retrievedAt: new Date("2026-08-24T12:00:00.000Z") })

    expect(aggregate.relations?.[0]).toMatchObject({
      canonicalFactsComplete: true,
      direction: "outgoing",
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUpdatedAt: new Date("2025-03-01T09:30:00.000Z"),
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1234"
    })
  })

  it("keeps duplicate provider actions distinct by their source order", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    const actions = source.actions as unknown[]
    actions.push(structuredClone(actions[0]))

    const aggregate = normalizeCongressBillBundle(source)

    expect(new Set(aggregate.actions?.map((action) => action.id)).size).toBe(aggregate.actions?.length)
  })

  it("ignores actions without representable text while preserving source ordinals", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    const actions = source.actions as Array<Record<string, unknown>>
    actions.splice(1, 0, { actionDate: "2025-02-04", type: "Committee" })

    const aggregate = normalizeCongressBillBundle(source)

    expect(aggregate.actions?.map(({ description, ordinal }) => ({ description, ordinal }))).toEqual([
      { description: "Introduced in House", ordinal: 0 },
      { description: "Referred to the Committee on House Administration", ordinal: 2 },
      { description: "Ordered to be Reported", ordinal: 3 }
    ])
  })

  it("links structured committee identifiers without replacing source names", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    source.committees = [{ name: "House Administration", systemCode: "hsha00" }]

    const aggregate = normalizeCongressBillBundle(source)

    expect(aggregate.bill.committees).toEqual(["House Administration"])
    expect(aggregate.organizations).toEqual([
      {
        billId: "bill:us:119:hr:1234",
        classification: "committee",
        organizationId: "organization:congress:hsha00",
        sourceName: "House Administration"
      }
    ])
  })
})
