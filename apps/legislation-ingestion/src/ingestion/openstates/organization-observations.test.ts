import { describe, expect, it } from "vitest"
import { normalizeOpenStatesBill } from "./normalize.js"

const chamber = { id: "ocd-organization/lower", classification: "lower", name: "House" }
const committee = { id: "ocd-organization/rules", classification: "committee", name: "Rules" }
const source = {
  id: "ocd-bill/organizations",
  identifier: "HB 1234",
  legislative_session: "2026",
  title: "Organization evidence",
  sources: [{ url: "https://leg.wa.gov/bills/1234" }]
}
const context = {
  jurisdictionCode: "wa",
  jurisdictionName: "Washington",
  retrievedAt: new Date("2026-09-12T00:00:00Z")
}

describe("bill-embedded OpenStates organization observations", () => {
  it("retains explicit origin, action and vote organizations without inventing profile facts", () => {
    const { aggregate } = normalizeOpenStatesBill(
      {
        ...source,
        from_organization: chamber,
        actions: [{ description: "Referred", organization: committee }],
        votes: [{ organization: committee }]
      },
      context
    )
    expect(aggregate.organizationObservations).toHaveLength(2)
    expect(aggregate.organizationObservations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "House", classification: "chamber", chamber: "lower" }),
        expect.objectContaining({ name: "Rules", classification: "committee", chamber: null })
      ])
    )
    for (const observation of aggregate.organizationObservations ?? []) {
      expect(observation).toMatchObject({
        sourceProvider: "openstates",
        sourceUrl: source.sources[0]?.url,
        sourceRetrievedAt: context.retrievedAt,
        sourceIsOfficial: false,
        provenanceComplete: true,
        detailFactsComplete: false,
        childRelationsComplete: false,
        membershipRelationsComplete: false
      })
      expect(observation.isActive).toBeUndefined()
      expect(observation.sourceUpdatedAt).toBeUndefined()
      expect(observation.parentOrganizationId).toBeUndefined()
    }
  })

  it("does not fabricate organizations from bare references or claim missing provenance", () => {
    expect(
      normalizeOpenStatesBill({ ...source, from_organization: chamber.id }, context).aggregate.organizationObservations
    ).toEqual([])
    const observation = normalizeOpenStatesBill(
      { ...source, from_organization: chamber },
      {
        jurisdictionCode: "wa",
        jurisdictionName: "Washington"
      }
    ).aggregate.organizationObservations?.[0]
    expect(observation).toMatchObject({ provenanceComplete: false })
    expect(observation?.sourceRetrievedAt).toBeUndefined()
  })

  it("retains unknown source classification without guessing a canonical type", () => {
    const observation = normalizeOpenStatesBill(
      { ...source, from_organization: { ...chamber, classification: "unmapped" } },
      context
    ).aggregate.organizationObservations?.[0]
    expect(observation).toMatchObject({ classification: null, chamber: null })
  })
})
