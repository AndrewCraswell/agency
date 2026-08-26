import { describe, expect, it, vi } from "vitest"
import type { OpenStatesGeoPerson } from "../ingestion/openstates/client.js"
import { RepresentativeLookupProviderFailureError } from "./representative-lookup.js"
import {
  CensusAddressGeocoder,
  UsRepresentativeLookupProvider,
  type AddressGeocoder,
  type OpenStatesGeoClient
} from "./us-representative-lookup-provider.js"

function openStatesPerson(): OpenStatesGeoPerson {
  return {
    current_role: { district: 10, org_classification: "lower", title: "Assembly Member" },
    family_name: "Example",
    given_name: "Alex",
    id: "ocd-person/example",
    image: null,
    jurisdiction: { id: "ocd-jurisdiction/country:us/state:ca/government" },
    name: "Alex Example",
    openstates_url: "https://openstates.example.test/person/example",
    party: "Independent",
    updated_at: "2026-08-25T12:00:00.000Z"
  }
}

describe("US representative lookup provider", () => {
  it("sends only structured minimum address fields to the Census geocoder and parses coordinates", async () => {
    let requestUrl: URL | undefined
    const geocoder = new CensusAddressGeocoder({
      fetch: async (input) => {
        requestUrl = new URL(input instanceof Request ? input.url : input.toString())
        return Response.json({
          result: { addressMatches: [{ coordinates: { x: -121.4944, y: 38.5816 } }] }
        })
      }
    })

    await expect(
      geocoder.geocode(
        {
          city: "Sacramento",
          country: "US",
          line1: "123 Main Street",
          line2: "Suite 2",
          postalCode: "95814",
          region: "CA"
        },
        { signal: new AbortController().signal }
      )
    ).resolves.toEqual({ latitude: 38.5816, longitude: -121.4944 })

    expect(requestUrl?.origin).toBe("https://geocoding.geo.census.gov")
    expect(requestUrl?.pathname).toBe("/geocoder/locations/address")
    expect(requestUrl?.searchParams.get("street")).toBe("123 Main Street Suite 2")
    expect(requestUrl?.searchParams.get("city")).toBe("Sacramento")
    expect(requestUrl?.searchParams.get("state")).toBe("CA")
    expect(requestUrl?.searchParams.get("zip")).toBe("95814")
    expect(requestUrl?.searchParams.get("benchmark")).toBe("Public_AR_Current")
    expect(requestUrl?.searchParams.get("format")).toBe("json")
    expect(requestUrl?.searchParams.has("country")).toBe(false)
  })

  it("maps malformed Census responses to a typed provider failure", async () => {
    const geocoder = new CensusAddressGeocoder({ fetch: async () => Response.json({ unexpected: true }) })

    await expect(
      geocoder.geocode(
        { city: "Sacramento", country: "US", line1: "123 Main Street", line2: null, postalCode: "95814", region: "CA" },
        { signal: new AbortController().signal }
      )
    ).rejects.toBeInstanceOf(RepresentativeLookupProviderFailureError)
  })

  it("composes geocoding and OpenStates into canonical, bounded representative projections", async () => {
    const geocode = vi.fn<AddressGeocoder["geocode"]>(async () => ({ latitude: 38.5816, longitude: -121.4944 }))
    const peopleAtCoordinates = vi.fn<OpenStatesGeoClient["peopleAtCoordinates"]>(async () => [openStatesPerson()])
    const provider = new UsRepresentativeLookupProvider({
      apiBaseUrl: "https://api.example.test",
      clock: () => new Date("2026-08-25T12:01:00.000Z"),
      geocoder: { geocode },
      openStates: { peopleAtCoordinates }
    })

    const result = await provider.resolve(
      {
        address: {
          city: "Sacramento",
          country: "US",
          line1: "123 Main Street",
          line2: null,
          postalCode: "95814",
          region: "CA"
        }
      },
      { signal: new AbortController().signal }
    )

    expect(geocode).toHaveBeenCalledOnce()
    expect(peopleAtCoordinates).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 38.5816, longitude: -121.4944, signal: expect.any(AbortSignal) })
    )
    expect(result).toMatchObject({
      districts: [
        {
          boundarySourceUrl: "https://v3.openstates.org/people.geo",
          jurisdictionId: "jurisdiction:ca",
          label: "10"
        }
      ],
      quality: "interpolated",
      representatives: [
        {
          person: {
            canonicalUrl: "https://api.example.test/api/people/person%3Aopenstates%3Aocd-person-example",
            id: "person:openstates:ocd-person-example",
            type: "person"
          },
          term: { personId: "person:openstates:ocd-person-example", type: "legislative-term" }
        }
      ]
    })
  })
})
