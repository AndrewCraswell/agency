import { describe, expect, it, vi } from "vitest"
import type { GeocodioLookup } from "../../services/geocodio/geocodio"
import { representativeLookupRequestSchema } from "./contracts"
import { createRepresentativeLookup, type RepresentativeDirectoryReader } from "./representativeLookup"

const identifier = { scheme: "bioguide", value: "O000172" } as const
const providerResult: GeocodioLookup = {
  status: "matched",
  jurisdictions: [{ code: "US", districts: [{ id: "ocd-district", name: "District 14", chamber: "congress" }] }],
  representatives: [
    {
      name: "Alexandria Ocasio-Cortez",
      party: "Democrat",
      office: "U.S. representative or delegate",
      districtName: "District 14",
      jurisdictionCode: "US",
      imageUrl: null,
      officialUrl: null,
      identifier
    }
  ],
  warnings: []
}
const profile = {
  id: "person:congress:o000172",
  name: "Ocasio-Cortez, Alexandria",
  party: "Democratic",
  imageUrl: "https://www.congress.gov/img/member/o000172_200.jpg",
  officialUrl: "https://ocasio-cortez.house.gov/"
}
const stored = { identifier, jurisdictionId: "jurisdiction:us", profile }
const jurisdictions = [{ id: "jurisdiction:us", name: "United States" }]

describe("representative lookup", () => {
  it("joins exact provider identifiers and returns stored profile and jurisdiction facts", async () => {
    const read = vi.fn<RepresentativeDirectoryReader>().mockResolvedValue({ jurisdictions, profiles: [stored] })
    const lookup = createRepresentativeLookup(async () => providerResult, read)
    const result = await lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    expect(read).toHaveBeenCalledWith([identifier], ["jurisdiction:us"], expect.any(AbortSignal))
    expect(result.status).toBe("matched")
    expect(result.jurisdictions[0]?.name).toBe("United States")
    expect(result.representatives[0]).toMatchObject({ profile, matchStatus: "matched" })
    expect(result.representatives[0]).not.toHaveProperty("identifier")
  })

  it("deduplicates two provenance-backed identifiers pointing at the same person", async () => {
    const lookup = createRepresentativeLookup(
      async () => providerResult,
      async () => ({
        jurisdictions,
        profiles: [stored, stored]
      })
    )
    expect((await lookup({ address: "A full address" }, new AbortController().signal)).status).toBe("matched")
  })

  it("reports an ambiguous match rather than choosing a person", async () => {
    const lookup = createRepresentativeLookup(
      async () => providerResult,
      async () => ({
        jurisdictions,
        profiles: [stored, { ...stored, profile: { ...profile, id: "person:other:o000172" } }]
      })
    )
    const result = await lookup({ address: "A full address" }, new AbortController().signal)
    expect(result.status).toBe("partial")
    expect(result.representatives[0]).toMatchObject({ matchStatus: "ambiguous", profile: null })
  })

  it("does not use names or identifiers from the wrong jurisdiction to fill a missing profile", async () => {
    const lookup = createRepresentativeLookup(
      async () => providerResult,
      async () => ({
        jurisdictions: [],
        profiles: [{ ...stored, jurisdictionId: "jurisdiction:ny" }]
      })
    )
    const result = await lookup({ address: "A full address" }, new AbortController().signal)
    expect(result.status).toBe("partial")
    expect(result.jurisdictions[0]).toMatchObject({ id: null, name: null })
    expect(result.representatives[0]).toMatchObject({ matchStatus: "not_found", profile: null })
  })

  it("keeps missing provider identifiers explicit", async () => {
    const lookup = createRepresentativeLookup(
      async () => ({
        ...providerResult,
        representatives: providerResult.representatives.map((person) => ({ ...person, identifier: null }))
      }),
      async () => ({ jurisdictions, profiles: [stored] })
    )
    const result = await lookup({ address: "A full address" }, new AbortController().signal)
    expect(result.representatives[0]).toMatchObject({ matchStatus: "missing_identifier", profile: null })
  })

  it("does not replace database failure with a successful provider-only result", async () => {
    const lookup = createRepresentativeLookup(
      async () => providerResult,
      async () => {
        throw new Error("db failed")
      }
    )
    await expect(lookup({ address: "A full address" }, new AbortController().signal)).rejects.toThrow("db failed")
  })

  it("skips database access when the provider cannot resolve a location", async () => {
    const read = vi.fn<RepresentativeDirectoryReader>()
    const lookup = createRepresentativeLookup(
      async () => ({ status: "no_match", jurisdictions: [], representatives: [], warnings: ["No match."] }),
      read
    )
    expect((await lookup({ address: "No match" }, new AbortController().signal)).status).toBe("no_match")
    expect(read).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: "40", longitude: 0 },
    { latitude: 40, longitude: -73, address: "mixed" },
    { address: " " },
    { address: "x".repeat(501) }
  ])("rejects invalid or mixed input", (input) => {
    expect(representativeLookupRequestSchema.safeParse(input).success).toBe(false)
  })
})
