import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import type { RepresentativeLookupRequest, RepresentativeLookupResult } from "../../modules/representatives/contracts"

const nullableText = z.string().trim().min(1).max(500).nullish()
const nullableUrl = z.url({ protocol: /^https?$/ }).nullish()
const legislatorSchema = z.object({
  type: z.enum(["representative", "senator"]),
  bio: z.object({
    first_name: z.string().trim().min(1).max(200),
    last_name: z.string().trim().min(1).max(200),
    party: nullableText,
    photo_url: nullableUrl
  }),
  contact: z.object({ url: nullableUrl }).optional(),
  references: z
    .object({
      bioguide_id: z
        .string()
        .regex(/^[A-Za-z]\d{6}$/u)
        .nullish(),
      openstates_id: z
        .string()
        .regex(/^ocd-person\/[a-f0-9-]{36}$/u)
        .nullish()
    })
    .optional()
})
const districtSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ocd_id: z.string().trim().min(1).max(256).nullable(),
  current_legislators: z.array(legislatorSchema).max(30).optional()
})
const resultSchema = z.object({
  accuracy_type: nullableText,
  address_components: z.object({ country: nullableText }).optional(),
  fields: z.object({
    congressional_districts: z.array(districtSchema).max(10).optional(),
    state_legislative_districts: z
      .object({
        house: z.array(districtSchema).max(10).optional(),
        senate: z.array(districtSchema).max(10).optional()
      })
      .optional()
  })
})
const responseSchema = z.object({
  results: z.array(z.object({ response: z.object({ results: z.array(resultSchema).max(10) }) })).length(1)
})

export type RepresentativeIdentifier = Readonly<{ scheme: "bioguide" | "openstates"; value: string }>
export type GeocodioRepresentative = Omit<
  RepresentativeLookupResult["representatives"][number],
  "profile" | "matchStatus"
> &
  Readonly<{ identifier: RepresentativeIdentifier | null }>
export type GeocodioLookup = Readonly<{
  status: RepresentativeLookupResult["status"]
  jurisdictions: readonly Omit<RepresentativeLookupResult["jurisdictions"][number], "id" | "name">[]
  representatives: readonly GeocodioRepresentative[]
  warnings: readonly string[]
}>

export function createGeocodioClient(
  config: Readonly<{ apiKey: string; baseUrl: string }>,
  fetcher: typeof fetch = fetch
) {
  return async (input: RepresentativeLookupRequest, signal: AbortSignal): Promise<GeocodioLookup> => {
    const isCoordinates = "latitude" in input
    const url = new URL(`${config.baseUrl.replace(/\/$/u, "")}/${isCoordinates ? "reverse" : "geocode"}`)
    url.searchParams.set("api_key", config.apiKey)
    url.searchParams.set("fields", "cd,stateleg")
    url.searchParams.set("country", "USA")
    url.searchParams.set("limit", "2")
    if (isCoordinates) {
      // Match the supplied point, not a nearby street address across a district boundary.
      url.searchParams.set("skipGeocoding", "true")
    }
    let response: Response
    try {
      response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify([isCoordinates ? `${input.latitude},${input.longitude}` : input.address]),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      })
    } catch {
      // Fetch errors can contain the credential-bearing URL. Do not retain their causes.
      throw unavailable(signal.aborted ? "Representative lookup was cancelled." : "Geocodio could not be reached.")
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw unavailable(providerFailureMessage(response.status))
    }
    const parsed = responseSchema.safeParse(await readResponse(response))
    if (!parsed.success) {
      throw unavailable("Geocodio returned an unexpected response.")
    }
    const results = parsed.data.results[0]!.response.results
    if (results.length === 0) {
      return empty("no_match", "Geocodio did not find a matching location.")
    }
    if (results.length > 1 || (!isCoordinates && ["place", "street"].includes(results[0]!.accuracy_type ?? ""))) {
      return empty("ambiguous", "The location is not precise enough to identify representatives unambiguously.")
    }
    return projectResult(results[0]!)
  }
}

function unavailable(message: string) {
  return new LegislationError("dependency_unavailable", message)
}

function providerFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Geocodio rejected the configured API key or account permissions."
  }
  if (status === 429) {
    return "Geocodio's usage limit was reached. Try again later."
  }
  return "Geocodio could not complete the lookup."
}

function personIdentifier(
  person: z.infer<typeof legislatorSchema>,
  isFederal: boolean
): RepresentativeIdentifier | null {
  if (isFederal) {
    const value = person.references?.bioguide_id?.toUpperCase()
    return value ? { scheme: "bioguide", value } : null
  }
  const value = person.references?.openstates_id
  return value ? { scheme: "openstates", value } : null
}

function officeLabel(type: "representative" | "senator", chamber: "congress" | "upper" | "lower" | "unicameral") {
  if (chamber === "congress") {
    return type === "senator" ? "U.S. senator" : "U.S. representative or delegate"
  }
  if (chamber === "unicameral") {
    return "State legislator"
  }
  return chamber === "upper" ? "State senator" : "State representative"
}

async function readResponse(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw unavailable("Geocodio returned an empty response.")
  }
  const decoder = new TextDecoder()
  let length = 0
  let text = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      length += value.byteLength
      if (length > 1_048_576) {
        await reader.cancel()
        throw unavailable("Geocodio's response exceeded the allowed size.")
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw unavailable("Geocodio returned an unreadable response.")
  } finally {
    reader.releaseLock()
  }
}

function empty(status: GeocodioLookup["status"], warning: string): GeocodioLookup {
  return { status, jurisdictions: [], representatives: [], warnings: [warning] }
}

function stateCode(id: string | null): string | undefined {
  return id?.match(/^ocd-division\/country:us\/(?:state|territory|district):([a-z]{2})(?:\/|$)/u)?.[1]?.toUpperCase()
}

function projectResult(result: z.infer<typeof resultSchema>): GeocodioLookup {
  const federal = result.fields.congressional_districts ?? []
  const lower = result.fields.state_legislative_districts?.house ?? []
  const upper = result.fields.state_legislative_districts?.senate ?? []
  const allDistricts = [...federal, ...lower, ...upper]
  if (result.address_components?.country && !["US", "USA"].includes(result.address_components.country)) {
    return empty("unsupported", "Representative lookup currently supports U.S. locations only.")
  }
  const codes = new Set(allDistricts.map((district) => stateCode(district.ocd_id)).filter((code) => code !== undefined))
  if (codes.size > 1 || federal.length > 1 || lower.length > 1 || upper.length > 1) {
    return empty("ambiguous", "Geocodio returned overlapping jurisdiction or district matches.")
  }
  const code = [...codes][0]
  if (!code) {
    return empty("unsupported", "Geocodio did not return supported U.S. legislative districts for this location.")
  }
  const jurisdictions: RepresentativeLookupResult["jurisdictions"] = []
  const representatives: GeocodioRepresentative[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  function addDistrict(
    district: z.infer<typeof districtSchema>,
    jurisdictionCode: string,
    chamber: "congress" | "upper" | "lower" | "unicameral"
  ) {
    if (!district.ocd_id || stateCode(district.ocd_id) !== code) {
      throw unavailable("Geocodio returned an invalid district identifier.")
    }
    let jurisdiction = jurisdictions.find((entry) => entry.code === jurisdictionCode)
    if (!jurisdiction) {
      jurisdiction = { code: jurisdictionCode, id: null, name: null, districts: [] }
      jurisdictions.push(jurisdiction)
    }
    jurisdiction.districts.push({ id: district.ocd_id, name: district.name, chamber })
    if (!district.current_legislators?.length) {
      warnings.push(`Geocodio returned no current legislators for ${district.name}. This does not confirm a vacancy.`)
    }
    for (const person of district.current_legislators ?? []) {
      const name = `${person.bio.first_name} ${person.bio.last_name}`
      const identifier = personIdentifier(person, jurisdictionCode === "US")
      const office = officeLabel(person.type, chamber)
      const key = `${jurisdictionCode}:${office}:${identifier?.value ?? name}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      representatives.push({
        name,
        party: person.bio.party ?? null,
        office,
        districtName: jurisdictionCode === "US" && person.type === "senator" ? "Statewide" : district.name,
        jurisdictionCode,
        imageUrl: person.bio.photo_url ?? null,
        officialUrl: person.contact?.url ?? null,
        identifier
      })
    }
  }
  for (const district of federal) {
    addDistrict(district, "US", "congress")
  }
  for (const district of lower) {
    const isUnicameral = upper.some((entry) => entry.ocd_id === district.ocd_id)
    addDistrict(district, code, isUnicameral ? "unicameral" : "lower")
  }
  for (const district of upper) {
    if (!lower.some((entry) => entry.ocd_id === district.ocd_id)) {
      addDistrict(district, code, "upper")
    }
  }
  if (!federal.length || !lower.length || !upper.length) {
    warnings.push("Some legislative district coverage is missing from the provider response.")
  }
  return {
    status: warnings.length ? "partial" : "matched",
    jurisdictions: jurisdictions.map(({ code: jurisdictionCode, districts }) => ({
      code: jurisdictionCode,
      districts
    })),
    representatives,
    warnings
  }
}
