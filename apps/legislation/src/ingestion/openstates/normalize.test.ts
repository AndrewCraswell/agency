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
    expect(result.aggregate.actions?.[0]).toMatchObject({
      organizationId: "organization:openstates:washington-house-of-representatives",
      sourceOrganizationId: "Washington House of Representatives"
    })
    expect(result.aggregate.organizations).toEqual([
      {
        billId: "bill:wa:2025-2026:hb:1234",
        classification: "origin",
        organizationId: "organization:openstates:washington-house-of-representatives"
      }
    ])
    expect(result.aggregate.sponsors).toHaveLength(2)
    expect(result.aggregate.people).toHaveLength(2)
    expect(result.aggregate.votes?.[0]).toMatchObject({
      positions: [
        { option: "yes", personId: "person:openstates:ocd-person-example" },
        { option: "no", personId: "person:openstates-voter-name:vote-name-wa-unmatched-member" }
      ],
      vote: { noCount: 8, result: "pass", yesCount: 90 }
    })
    expect(result.aggregate.votes?.[0]?.vote.id).toMatch(/^vote:openstates:/)
    expect(result.aggregate.documents).toHaveLength(3)
    expect(result.aggregate.documents?.map((item) => item.document.classification)).toEqual([
      "version",
      "version",
      "fiscal-note"
    ])
    expect(result.aggregate.relations).toEqual([
      {
        billId: "bill:wa:2025-2026:hb:1234",
        classification: "companion",
        relatedBillId: "bill:wa:2025-2026:sb:5678"
      }
    ])
    expect(result.diagnostics).toEqual([
      { field: "actions.date", reason: "fuzzy date was not fabricated", value: "2025" }
    ])
  })

  it("maps the Open States v3 bill shape with resolved sessions and organizations", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    source.session = "2025-2026"
    delete source.legislative_session
    source.from_organization = {
      classification: "lower",
      id: "ocd-organization/wa-house",
      name: "Washington House of Representatives"
    }
    source.actions = (source.actions as Array<Record<string, unknown>>).map((action) => {
      const { organization_id: _organizationId, ...rest } = action
      return {
        ...rest,
        organization: {
          classification: "lower",
          id: "ocd-organization/wa-house",
          name: "Washington House of Representatives"
        }
      }
    })
    source.votes = (source.votes as Array<Record<string, unknown>>).map((vote) => {
      const { classification: _classification, ...rest } = vote
      return {
        ...rest,
        motion_classification: ["passage"],
        organization: {
          classification: "lower",
          id: "ocd-organization/wa-house",
          name: "Washington House of Representatives"
        },
        votes: (vote.votes as Array<Record<string, unknown>>).map((position) => {
          if (position.voter_id !== "ocd-person/example") {
            return position
          }
          const { voter_id: _voterId, ...positionRest } = position
          return { ...positionRest, voter: { id: "ocd-person/example", name: "Representative Example" } }
        })
      }
    })
    source.sponsorships = (source.sponsorships as Array<Record<string, unknown>>).map((sponsor) => {
      if (sponsor.person_id !== "ocd-person/example") {
        return sponsor
      }
      const { person_id: _personId, ...rest } = sponsor
      return { ...rest, person: { id: "ocd-person/example", name: "Representative Example" } }
    })

    const { aggregate } = normalizeOpenStatesBill(source, {
      jurisdictionCode: "WA",
      jurisdictionName: "Washington"
    })

    expect(aggregate.bill).toMatchObject({
      chamber: "lower",
      id: "bill:wa:2025-2026:hb:1234",
      sessionId: "session:wa:2025-2026"
    })
    expect(aggregate.actions?.[0]).toMatchObject({
      chamber: "lower",
      organizationId: "organization:openstates:ocd-organization-wa-house",
      sourceOrganizationId: "ocd-organization/wa-house"
    })
    expect(aggregate.votes?.[0]?.vote).toMatchObject({
      chamber: "lower",
      classification: "passage",
      organizationId: "organization:openstates:ocd-organization-wa-house"
    })
    expect(aggregate.votes?.[0]?.positions).toContainEqual(
      expect.objectContaining({ personId: "person:openstates:ocd-person-example", sourceSequence: 0 })
    )
    expect(aggregate.organizations).toContainEqual({
      billId: "bill:wa:2025-2026:hb:1234",
      classification: "origin",
      organizationId: "organization:openstates:ocd-organization-wa-house"
    })
    expect(aggregate.people).toContainEqual(
      expect.objectContaining({
        id: "person:openstates:ocd-person-example",
        sourceId: "ocd-person/example"
      })
    )
  })

  it("converges formatting variations on the same canonical bill", () => {
    const source = { ...(fixture as Record<string, unknown>), identifier: " h.b. 001234 " }
    const result = normalizeOpenStatesBill(source, { jurisdictionCode: "wa", jurisdictionName: "Washington" })
    expect(result.aggregate.bill.id).toBe("bill:wa:2025-2026:hb:1234")
  })

  it("retains structured committee vote organization links", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    const sourceVotes = source.votes as Array<Record<string, unknown>>
    sourceVotes[0] = {
      ...sourceVotes[0],
      classification: ["committee-passage"],
      organization_id: "ocd-organization/committee-health",
      start_date: "2025-03-01T10:30:00-08:00"
    }

    const result = normalizeOpenStatesBill(source, { jurisdictionCode: "wa", jurisdictionName: "Washington" })

    expect(result.aggregate.votes?.[0]?.vote).toMatchObject({
      classification: "committee-passage",
      organizationId: "organization:openstates:ocd-organization-committee-health"
    })
    expect(result.aggregate.organizations).toContainEqual({
      billId: "bill:wa:2025-2026:hb:1234",
      classification: "vote",
      organizationId: "organization:openstates:ocd-organization-committee-health"
    })
  })

  it("treats blank historical vote identities as missing", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    const sourceVote = (source.votes as Array<Record<string, unknown>>)[0]
    sourceVote.id = ""
    sourceVote.identifier = " "
    sourceVote.organization_id = ""
    sourceVote.votes = (sourceVote.votes as Array<Record<string, unknown>>).map((position) => ({
      ...position,
      voter_id: ""
    }))

    const result = normalizeOpenStatesBill(source, { jurisdictionCode: "wa", jurisdictionName: "Washington" })

    expect(result.aggregate.votes?.[0]?.vote).toMatchObject({
      classification: "recorded",
      motion: "Third reading, final passage"
    })
    expect(result.aggregate.votes?.[0]?.vote.sourceId).toBeUndefined()
    expect(result.aggregate.votes?.[0]?.vote.rollCallNumber).toBeUndefined()
    expect(result.aggregate.votes?.[0]?.vote.organizationId).toBeUndefined()
    expect(result.aggregate.votes?.[0]?.positions).toEqual([
      expect.objectContaining({
        personId: "person:openstates-voter-name:vote-name-wa-representative-example",
        sourceSequence: 0
      }),
      expect.objectContaining({
        personId: "person:openstates-voter-name:vote-name-wa-unmatched-member",
        sourceSequence: 1
      })
    ])
  })

  it("sums provider vote-count aliases into canonical totals", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    const sourceVote = (source.votes as Array<Record<string, unknown>>)[0]
    sourceVote.counts = [
      { option: "yes", value: 40 },
      { option: "yea", value: 50 },
      { option: "absent", value: 4 },
      { option: "not voting", value: 2 },
      { option: "excused", value: 1 }
    ]

    const result = normalizeOpenStatesBill(source, { jurisdictionCode: "wa", jurisdictionName: "Washington" })

    expect(result.aggregate.votes?.[0]?.vote).toMatchObject({ otherCount: 7, yesCount: 90 })
    expect(result.aggregate.votes?.[0]?.vote.noCount).toBeUndefined()
  })

  it("retains unstructured amendment links as classified bill documents", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    source.documents = [
      {
        classification: "amendment",
        date: "2025-03-02",
        links: [
          {
            media_type: "application/pdf",
            text: "Floor amendment 12",
            url: "https://leg.wa.gov/amendments/12.pdf"
          }
        ],
        note: "Floor amendment 12"
      }
    ]

    const result = normalizeOpenStatesBill(source, { jurisdictionCode: "wa", jurisdictionName: "Washington" })

    expect(result.aggregate.documents).toContainEqual({
      document: expect.objectContaining({
        classification: "amendment",
        sourceUrl: "https://leg.wa.gov/amendments/12.pdf",
        title: "Floor amendment 12"
      })
    })
    expect(result.aggregate).not.toHaveProperty("amendments")
  })

  it.each([
    ["1361XD", "bill:ia:2025-2026:xd:1361"],
    ["HJR CA0002", "bill:il:2025-2026:hjrca:2"],
    ["HJR BB", "bill:mi:2025-2026:hjr:bb"],
    ["SS# 3 SB 1062", "bill:mo:2025-2026:ss3sb:1062"],
    ["SENATE CONCURRENT RESOLUTION NO. 2154", "bill:ri:2025-2026:senateconcurrentresolutionno:2154"]
  ])("preserves provider-specific printed identifier %s", (identifier, expectedId) => {
    const source = { ...(fixture as Record<string, unknown>), identifier, legislative_session: "2025-2026" }
    const result = normalizeOpenStatesBill(source, {
      jurisdictionCode: expectedId.split(":")[1] ?? "wa",
      jurisdictionName: "Test jurisdiction"
    })

    expect(result.aggregate.bill.id).toBe(expectedId)
    expect(result.aggregate.bill.identifier).toBe(identifier)
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

  it("uses the provider bill endpoint when an archived record has no source links", () => {
    const source = {
      ...(sparseFixture as Record<string, unknown>),
      _id: "ocd-bill/af76bfbd-d58a-4af3-9213-1ffe62d2a74b",
      id: undefined,
      sources: []
    }
    const result = normalizeOpenStatesBill(source, {
      jurisdictionCode: "ri",
      jurisdictionName: "Rhode Island"
    })

    expect(result.aggregate.bill.sourceUrl).toBe(
      "https://v3.openstates.org/bills/ocd-bill/af76bfbd-d58a-4af3-9213-1ffe62d2a74b"
    )
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
