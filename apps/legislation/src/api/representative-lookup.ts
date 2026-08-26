import { randomUUID } from "node:crypto"
import { z } from "zod"
import { LegislationError } from "../legislation/errors.js"
import type { LegislativeTerm, PersonSummary, SourceReference } from "./canonical-projection.js"
import {
  apiResource,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000
const DEFAULT_RESULT_TTL_MS = 5 * 60_000
const MAXIMUM_DISTRICTS = 50
const MAXIMUM_REPRESENTATIVES = 100
const MAXIMUM_WARNINGS = 25

const addressSchema = z
  .object({
    city: z.string().trim().min(1).max(200),
    country: z.string().regex(/^[A-Z]{2}$/),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().min(1).max(200).nullable(),
    postalCode: z.string().trim().min(1).max(200),
    region: z.string().trim().min(1).max(200)
  })
  .strict()

const coordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180)
  })
  .strict()

const representativeLookupRequestSchema = z
  .union([z.object({ address: addressSchema }).strict(), z.object({ coordinates: coordinatesSchema }).strict()])
  .transform((value) => ("address" in value ? { address: value.address } : { coordinates: value.coordinates }))

export type RepresentativeLookupRequest =
  | Readonly<{
      address: Readonly<{
        line1: string
        line2: string | null
        city: string
        region: string
        postalCode: string
        country: string
      }>
    }>
  | Readonly<{ coordinates: Readonly<{ latitude: number; longitude: number }> }>

export interface ResolvedDistrict {
  classification: string
  label: string
  jurisdictionId: string
  organizationId: string | null
  boundarySourceUrl: string
  sources: readonly SourceReference[]
}

export interface RepresentativeMatch {
  person: PersonSummary
  term: LegislativeTerm
  district: ResolvedDistrict
  matchConfidence: number
}

export interface RepresentativeLookupResult {
  lookupId: string
  resolvedAt: string
  expiresAt: string
  quality: "exact" | "interpolated" | "postal-centroid" | "unresolved"
  districts: readonly ResolvedDistrict[]
  representatives: readonly RepresentativeMatch[]
  warnings: readonly string[]
}

export type DistrictResolution = Readonly<{
  quality: RepresentativeLookupResult["quality"]
  districts: readonly ResolvedDistrict[]
  representatives: readonly RepresentativeMatch[]
  warnings: readonly string[]
}>

/**
 * This boundary is deliberately location-only: it receives normalized input
 * for one request and must neither persist nor log it. The caller supplies an
 * abort signal so network adapters can keep their external work bounded.
 */
export interface AddressToDistrictProvider {
  resolve(input: RepresentativeLookupRequest, options: Readonly<{ signal: AbortSignal }>): Promise<DistrictResolution>
}

export interface RepresentativeLookupApi {
  lookup(input: RepresentativeLookupRequest): Promise<RepresentativeLookupResult>
}

export class RepresentativeLookupProviderUnavailableError extends LegislationError {
  constructor(message = "Representative lookup provider is unavailable") {
    super("dependency_unavailable", message)
    this.name = "RepresentativeLookupProviderUnavailableError"
  }
}

export class RepresentativeLookupProviderFailureError extends LegislationError {
  constructor() {
    super("dependency_unavailable", "Representative lookup provider failed")
    this.name = "RepresentativeLookupProviderFailureError"
  }
}

export class UnavailableAddressToDistrictProvider implements AddressToDistrictProvider {
  async resolve(): Promise<DistrictResolution> {
    throw new RepresentativeLookupProviderUnavailableError("Representative lookup provider is not configured")
  }
}

export function createRepresentativeLookupApi(
  provider: AddressToDistrictProvider,
  options: Readonly<{
    clock?: () => Date
    createLookupId?: () => string
    providerTimeoutMs?: number
    resultTtlMs?: number
  }> = {}
): RepresentativeLookupApi {
  const clock = options.clock ?? (() => new Date())
  const createLookupId = options.createLookupId ?? randomUUID
  const providerTimeoutMs = boundedPositiveInteger(
    options.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
    "providerTimeoutMs"
  )
  const resultTtlMs = boundedPositiveInteger(options.resultTtlMs ?? DEFAULT_RESULT_TTL_MS, "resultTtlMs")

  return {
    lookup: async (input) => {
      assertSupportedCountry(input)
      const resolvedAt = clock()
      if (Number.isNaN(resolvedAt.valueOf())) {
        throw new Error("Representative lookup clock returned an invalid date")
      }
      const resolution = await resolveWithinTimeout(provider, input, providerTimeoutMs)
      const lookupId = createLookupId()
      if (!isNonemptyString(lookupId) || lookupId.length > 256) {
        throw new Error("Representative lookup ID must be a non-empty string no longer than 256 characters")
      }
      const result: RepresentativeLookupResult = {
        districts: resolution.districts,
        expiresAt: new Date(resolvedAt.valueOf() + resultTtlMs).toISOString(),
        lookupId,
        quality: resolution.quality,
        representatives: resolution.representatives,
        resolvedAt: resolvedAt.toISOString(),
        warnings: resolution.warnings
      }
      validateRepresentativeLookupResult(result)
      return result
    }
  }
}

export function createRepresentativeLookupApiHandler(service: RepresentativeLookupApi): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/representative-lookups") {
      return false
    }
    try {
      assertAllowedQueryParameters(url, [])
      const input = representativeLookupRequestSchema.safeParse(await readJsonBody(request))
      if (!input.success) {
        throw new LegislationError("invalid_request", "Representative lookup request is invalid")
      }
      const result = await service.lookup(input.data)
      sendApiJson(response, 200, apiResource(request, result))
    } catch (error) {
      sendApiError(request, response, toRepresentativeLookupError(error))
    }
    return true
  }
}

function assertSupportedCountry(input: RepresentativeLookupRequest): void {
  if ("address" in input && input.address.country !== "US") {
    throw new LegislationError("unprocessable", "Representative lookup is supported only for US addresses")
  }
}

async function resolveWithinTimeout(
  provider: AddressToDistrictProvider,
  input: RepresentativeLookupRequest,
  timeoutMs: number
): Promise<DistrictResolution> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await Promise.race([
      provider.resolve(input, { signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new RepresentativeLookupProviderUnavailableError("Representative lookup provider timed out")),
          { once: true }
        )
      })
    ])
  } catch (error) {
    if (
      error instanceof RepresentativeLookupProviderUnavailableError ||
      error instanceof RepresentativeLookupProviderFailureError
    ) {
      throw error
    }
    throw new RepresentativeLookupProviderFailureError()
  } finally {
    clearTimeout(timeout)
  }
}

function toRepresentativeLookupError(error: unknown): unknown {
  if (error instanceof LegislationError) {
    return error
  }
  return new RepresentativeLookupProviderFailureError()
}

function validateRepresentativeLookupResult(result: RepresentativeLookupResult): void {
  if (
    !isBoundedText(result.lookupId) ||
    !isRfc3339Timestamp(result.resolvedAt) ||
    !isRfc3339Timestamp(result.expiresAt) ||
    Date.parse(result.expiresAt) <= Date.parse(result.resolvedAt) ||
    !isResolutionQuality(result.quality)
  ) {
    throw new LegislationError("unprocessable", "representative lookup result is incomplete")
  }
  if (result.quality === "unresolved" && result.representatives.length !== 0) {
    throw new LegislationError("unprocessable", "unresolved representative lookups must not contain representatives")
  }
  if (result.districts.length > MAXIMUM_DISTRICTS) {
    throw new LegislationError(
      "unprocessable",
      `representative lookup returned more than ${MAXIMUM_DISTRICTS} districts`
    )
  }
  if (result.representatives.length > MAXIMUM_REPRESENTATIVES) {
    throw new LegislationError(
      "unprocessable",
      `representative lookup returned more than ${MAXIMUM_REPRESENTATIVES} representatives`
    )
  }
  if (result.warnings.length > MAXIMUM_WARNINGS || result.warnings.some((warning) => !isBoundedText(warning))) {
    throw new LegislationError(
      "unprocessable",
      "representative lookup warnings must contain at most 25 bounded strings"
    )
  }
  const districts = new Set(result.districts.map((district) => districtKey(district)))
  result.districts.forEach(validateDistrict)
  result.representatives.forEach((representative) => {
    validatePerson(representative.person)
    validateTerm(representative.term)
    validateDistrict(representative.district)
    if (!districts.has(districtKey(representative.district))) {
      throw new LegislationError("unprocessable", "representative district is absent from the resolved districts")
    }
    if (representative.term.personId !== representative.person.id) {
      throw new LegislationError("unprocessable", "representative term does not belong to its person")
    }
    if (
      representative.term.jurisdictionId !== representative.district.jurisdictionId ||
      !representative.person.jurisdictionIds.includes(representative.district.jurisdictionId) ||
      (representative.district.organizationId !== null &&
        representative.term.organizationId !== representative.district.organizationId)
    ) {
      throw new LegislationError("unprocessable", "representative does not serve its resolved district")
    }
    if (
      !Number.isFinite(representative.matchConfidence) ||
      representative.matchConfidence < 0 ||
      representative.matchConfidence > 1
    ) {
      throw new LegislationError("unprocessable", "representative matchConfidence must be between 0 and 1")
    }
  })
}

function validateDistrict(district: ResolvedDistrict): void {
  if (
    !isBoundedText(district.classification) ||
    !isBoundedText(district.label) ||
    !isBoundedText(district.jurisdictionId) ||
    (district.organizationId !== null && !isBoundedText(district.organizationId)) ||
    !isAbsoluteUrl(district.boundarySourceUrl) ||
    district.sources.length < 1
  ) {
    throw new LegislationError("unprocessable", "representative district projection is incomplete")
  }
  district.sources.forEach(validateSource)
}

function validatePerson(person: PersonSummary): void {
  if (
    person.type !== "person" ||
    !isBoundedText(person.id) ||
    !isAbsoluteUrl(person.canonicalUrl) ||
    !isBoundedText(person.name) ||
    !isRfc3339Timestamp(person.updatedAt) ||
    (person.givenName !== null && !isBoundedText(person.givenName)) ||
    (person.familyName !== null && !isBoundedText(person.familyName)) ||
    (person.party !== null && !isBoundedText(person.party)) ||
    (person.imageUrl !== null && !isAbsoluteUrl(person.imageUrl)) ||
    typeof person.isActive !== "boolean" ||
    !Array.isArray(person.jurisdictionIds) ||
    person.jurisdictionIds.some((jurisdictionId) => !isBoundedText(jurisdictionId)) ||
    person.sources.length < 1
  ) {
    throw new LegislationError("unprocessable", "representative person projection is incomplete")
  }
  person.sources.forEach(validateSource)
}

function validateTerm(term: LegislativeTerm): void {
  if (
    term.type !== "legislative-term" ||
    !isBoundedText(term.id) ||
    !isAbsoluteUrl(term.canonicalUrl) ||
    !isBoundedText(term.personId) ||
    !isBoundedText(term.jurisdictionId) ||
    !isBoundedText(term.officeTitle) ||
    !isRfc3339Timestamp(term.updatedAt) ||
    (term.organizationId !== null && !isBoundedText(term.organizationId)) ||
    (term.district !== null && !isBoundedText(term.district)) ||
    (term.startDate !== null && !isIsoDate(term.startDate)) ||
    (term.endDate !== null && !isIsoDate(term.endDate)) ||
    typeof term.isCurrent !== "boolean" ||
    term.sources.length < 1
  ) {
    throw new LegislationError("unprocessable", "representative term projection is incomplete")
  }
  term.sources.forEach(validateSource)
}

function validateSource(source: SourceReference): void {
  if (
    !isBoundedText(source.provider) ||
    !isAbsoluteUrl(source.sourceUrl) ||
    !isRfc3339Timestamp(source.retrievedAt) ||
    (source.sourceUpdatedAt !== null && !isRfc3339Timestamp(source.sourceUpdatedAt)) ||
    typeof source.isOfficial !== "boolean"
  ) {
    throw new LegislationError("unprocessable", "representative source projection is incomplete")
  }
}

function districtKey(district: ResolvedDistrict): string {
  return [
    district.classification,
    district.label,
    district.jurisdictionId,
    district.organizationId ?? "",
    district.boundarySourceUrl
  ].join("\u0000")
}

function isBoundedText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isAbsoluteUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false
  }
  try {
    return new URL(value).protocol === "http:" || new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function isRfc3339Timestamp(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(new Date(value).valueOf()) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
}

function isIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
  )
}

function isResolutionQuality(value: unknown): value is RepresentativeLookupResult["quality"] {
  return value === "exact" || value === "interpolated" || value === "postal-centroid" || value === "unresolved"
}

function boundedPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 300_000) {
    throw new Error(`${name} must be a positive integer no greater than 300000`)
  }
  return value
}
