import { z } from "zod"
import type { OpenStatesGeoPerson } from "../ingestion/openstates/client.js"
import { jurisdictionId, legislativeTermId, personId } from "../legislation/identifiers.js"
import type { LegislativeTerm, PersonSummary, SourceReference } from "./canonical-projection.js"
import {
  RepresentativeLookupProviderFailureError,
  RepresentativeLookupProviderUnavailableError,
  type AddressToDistrictProvider,
  type DistrictResolution,
  type RepresentativeLookupRequest,
  type ResolvedDistrict
} from "./representative-lookup.js"

const CENSUS_GEOCODER_URL = new URL("https://geocoding.geo.census.gov/geocoder/locations/address")
const OPENSTATES_GEO_SOURCE_URL = "https://v3.openstates.org/people.geo"
const MAXIMUM_OPENSTATES_PEOPLE = 100
const DEFAULT_CENSUS_TIMEOUT_MS = 5_000

const censusResponseSchema = z.object({
  result: z.object({
    addressMatches: z
      .array(
        z.object({
          coordinates: z.object({ x: z.number().finite().min(-180).max(180), y: z.number().finite().min(-90).max(90) })
        })
      )
      .max(5)
  })
})

export interface AddressGeocoder {
  geocode(
    address: Extract<RepresentativeLookupRequest, { address: unknown }>["address"],
    options: Readonly<{ signal: AbortSignal }>
  ): Promise<Readonly<{ latitude: number; longitude: number }> | undefined>
}

export interface OpenStatesGeoClient {
  peopleAtCoordinates(
    input: Readonly<{ latitude: number; longitude: number; signal: AbortSignal }>
  ): Promise<readonly OpenStatesGeoPerson[]>
}

export class CensusAddressGeocoder implements AddressGeocoder {
  readonly #fetch: typeof fetch
  readonly #timeoutMs: number

  constructor(options: Readonly<{ fetch?: typeof fetch; timeoutMs?: number }> = {}) {
    this.#fetch = options.fetch ?? fetch
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_CENSUS_TIMEOUT_MS
  }

  async geocode(
    address: Extract<RepresentativeLookupRequest, { address: unknown }>["address"],
    options: Readonly<{ signal: AbortSignal }>
  ): Promise<Readonly<{ latitude: number; longitude: number }> | undefined> {
    const url = new URL(CENSUS_GEOCODER_URL)
    url.searchParams.set("benchmark", "Public_AR_Current")
    url.searchParams.set("city", address.city)
    url.searchParams.set("format", "json")
    url.searchParams.set("state", address.region)
    url.searchParams.set("street", [address.line1, address.line2].filter((value) => value !== null).join(" "))
    url.searchParams.set("zip", address.postalCode)
    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs)
    try {
      const response = await this.#fetch(url, {
        signal: AbortSignal.any([options.signal, timeoutSignal])
      })
      if (!response.ok) {
        throw new RepresentativeLookupProviderFailureError()
      }
      const body = await boundedJson(response, 64 * 1024)
      const match = censusResponseSchema.parse(body).result.addressMatches[0]
      return match === undefined ? undefined : { latitude: match.coordinates.y, longitude: match.coordinates.x }
    } catch (error) {
      if (error instanceof RepresentativeLookupProviderFailureError) {
        throw error
      }
      if (options.signal.aborted || timeoutSignal.aborted) {
        throw new RepresentativeLookupProviderUnavailableError("Representative lookup provider timed out")
      }
      throw new RepresentativeLookupProviderFailureError()
    }
  }
}

/**
 * A request-local adapter for the public Census geocoder and OpenStates V3.
 * It holds no address or coordinate state after `resolve` returns and emits no
 * logs, leaving the caller's normalized input inside the request lifetime.
 */
export class UsRepresentativeLookupProvider implements AddressToDistrictProvider {
  readonly #apiBaseUrl: string
  readonly #clock: () => Date
  readonly #geocoder: AddressGeocoder
  readonly #openStates: OpenStatesGeoClient

  constructor(
    options: Readonly<{
      apiBaseUrl: string
      clock?: () => Date
      geocoder: AddressGeocoder
      openStates: OpenStatesGeoClient
    }>
  ) {
    this.#apiBaseUrl = options.apiBaseUrl
    this.#clock = options.clock ?? (() => new Date())
    this.#geocoder = options.geocoder
    this.#openStates = options.openStates
  }

  async resolve(
    input: RepresentativeLookupRequest,
    options: Readonly<{ signal: AbortSignal }>
  ): Promise<DistrictResolution> {
    const coordinates = "address" in input ? await this.#geocoder.geocode(input.address, options) : input.coordinates
    if (coordinates === undefined) {
      return { districts: [], quality: "unresolved", representatives: [], warnings: [] }
    }
    let people: readonly OpenStatesGeoPerson[]
    try {
      people = await this.#openStates.peopleAtCoordinates({ ...coordinates, signal: options.signal })
    } catch (error) {
      if (
        error instanceof RepresentativeLookupProviderUnavailableError ||
        error instanceof RepresentativeLookupProviderFailureError
      ) {
        throw error
      }
      throw new RepresentativeLookupProviderFailureError()
    }
    return projectOpenStatesPeople(
      people,
      this.#apiBaseUrl,
      this.#clock(),
      "address" in input ? "interpolated" : "exact"
    )
  }
}

export function projectOpenStatesPeople(
  people: readonly OpenStatesGeoPerson[],
  apiBaseUrl: string,
  retrievedAt: Date,
  quality: DistrictResolution["quality"]
): DistrictResolution {
  if (Number.isNaN(retrievedAt.valueOf())) {
    throw new RepresentativeLookupProviderFailureError()
  }
  const included = people.filter((person) => person.current_role !== undefined && person.current_role !== null)
  const capped = included.slice(0, MAXIMUM_OPENSTATES_PEOPLE)
  const districts = new Map<string, ResolvedDistrict>()
  const representatives = capped.map((person) => {
    const representative = projectOpenStatesPerson(person, apiBaseUrl, retrievedAt)
    districts.set(districtKey(representative.district), representative.district)
    return representative
  })
  return {
    districts: [...districts.values()],
    quality: representatives.length === 0 ? "unresolved" : quality,
    representatives,
    warnings: included.length > MAXIMUM_OPENSTATES_PEOPLE ? ["Representative results were capped at 100."] : []
  }
}

function projectOpenStatesPerson(person: OpenStatesGeoPerson, apiBaseUrl: string, retrievedAt: Date) {
  const role = person.current_role
  if (role === undefined || role === null) {
    throw new RepresentativeLookupProviderFailureError()
  }
  const sourceUrl = person.openstates_url ?? OPENSTATES_GEO_SOURCE_URL
  const canonicalPersonId = personId("openstates", person.id)
  const canonicalJurisdictionId = jurisdictionFromOpenStatesId(person.jurisdiction.id)
  const source: SourceReference = {
    isOfficial: false,
    provider: "openstates",
    retrievedAt: retrievedAt.toISOString(),
    sourceUpdatedAt: person.updated_at,
    sourceUrl
  }
  const district: ResolvedDistrict = {
    boundarySourceUrl: OPENSTATES_GEO_SOURCE_URL,
    classification: role.org_classification,
    jurisdictionId: canonicalJurisdictionId,
    label: role.district === undefined || role.district === null ? role.title : String(role.district),
    organizationId: null,
    sources: [source]
  }
  const personSummary: PersonSummary = {
    canonicalUrl: new URL(`/api/people/${encodeURIComponent(canonicalPersonId)}`, apiBaseUrl).toString(),
    familyName: person.family_name ?? null,
    givenName: person.given_name ?? null,
    id: canonicalPersonId,
    imageUrl: person.image ?? null,
    isActive: true,
    jurisdictionIds: [canonicalJurisdictionId],
    name: person.name,
    party: person.party ?? null,
    sources: [source],
    type: "person",
    updatedAt: person.updated_at
  }
  const sourceIdentity = `current:${role.org_classification}:${role.division_id ?? role.district ?? "unknown"}`
  const termId = legislativeTermId(canonicalPersonId, sourceIdentity)
  const term: LegislativeTerm = {
    canonicalUrl: new URL(
      `/api/people/${encodeURIComponent(canonicalPersonId)}/terms/${encodeURIComponent(termId)}`,
      apiBaseUrl
    ).toString(),
    district: role.district === undefined || role.district === null ? null : String(role.district),
    endDate: null,
    id: termId,
    isCurrent: true,
    jurisdictionId: canonicalJurisdictionId,
    officeTitle: role.title,
    organizationId: null,
    personId: canonicalPersonId,
    sources: [source],
    startDate: null,
    type: "legislative-term",
    updatedAt: person.updated_at
  }
  return { district, matchConfidence: 1, person: personSummary, term }
}

function jurisdictionFromOpenStatesId(value: string): string {
  const match = /^ocd-jurisdiction\/country:us(?:\/state:([a-z]{2}))?\/government$/i.exec(value)
  if (match === null) {
    throw new RepresentativeLookupProviderFailureError()
  }
  return jurisdictionId(match[1] ?? "us")
}

async function boundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const body = await response.text()
  if (new TextEncoder().encode(body).byteLength > maximumBytes) {
    throw new RepresentativeLookupProviderFailureError()
  }
  try {
    return JSON.parse(body)
  } catch {
    throw new RepresentativeLookupProviderFailureError()
  }
}

function districtKey(district: ResolvedDistrict): string {
  return [district.classification, district.label, district.jurisdictionId, district.organizationId ?? ""].join(
    "\u0000"
  )
}
