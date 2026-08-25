import { afterEach, describe, expect, it, vi } from "vitest"
import type { OpenStatesGeoPerson } from "../ingestion/openstates/client.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import {
  createRepresentativeLookupApi,
  createRepresentativeLookupApiHandler,
  UnavailableAddressToDistrictProvider,
  type AddressToDistrictProvider,
  type DistrictResolution,
  type RepresentativeLookupRequest
} from "./representative-lookup.js"
import { UsRepresentativeLookupProvider } from "./us-representative-lookup-provider.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "representative-lookup-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(provider: AddressToDistrictProvider, timeoutMs?: number): Promise<string> {
  const api = createRepresentativeLookupApi(provider, {
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    createLookupId: () => "lookup:fixture",
    ...(timeoutMs === undefined ? {} : { providerTimeoutMs: timeoutMs })
  })
  const server = createLegislationServer({ apiHandler: createRepresentativeLookupApiHandler(api), logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function resolution(overrides: Partial<DistrictResolution> = {}): DistrictResolution {
  const source = {
    isOfficial: true,
    provider: "openstates",
    retrievedAt: "2026-08-25T11:59:00.000Z",
    sourceUpdatedAt: null,
    sourceUrl: "https://v3.openstates.org/people.geo"
  } as const
  const district = {
    boundarySourceUrl: "https://v3.openstates.org/people.geo",
    classification: "lower",
    jurisdictionId: "jurisdiction:us:ca",
    label: "10",
    organizationId: "organization:us:ca:assembly",
    sources: [source]
  } as const
  return {
    districts: [district],
    quality: "exact",
    representatives: [
      {
        district,
        matchConfidence: 1,
        person: {
          canonicalUrl: "https://api.example.test/api/people/person%3Aca%3Aexample",
          familyName: "Example",
          givenName: "Alex",
          id: "person:ca:example",
          imageUrl: null,
          isActive: true,
          jurisdictionIds: ["jurisdiction:us:ca"],
          name: "Alex Example",
          party: "Independent",
          sources: [source],
          type: "person",
          updatedAt: "2026-08-25T11:59:00.000Z"
        },
        term: {
          canonicalUrl: "https://api.example.test/api/people/person%3Aca%3Aexample/terms/term%3Aca%3Aexample%3A2025",
          district: "10",
          endDate: null,
          id: "term:ca:example:2025",
          isCurrent: true,
          jurisdictionId: "jurisdiction:us:ca",
          officeTitle: "Assembly Member",
          organizationId: "organization:us:ca:assembly",
          personId: "person:ca:example",
          sources: [source],
          startDate: "2025-12-01",
          type: "legislative-term",
          updatedAt: "2026-08-25T11:59:00.000Z"
        }
      }
    ],
    warnings: [],
    ...overrides
  }
}

describe("representative lookup API", () => {
  it("normalizes an address in memory, passes no raw input to the response, and returns the exact resource envelope", async () => {
    const resolve = vi.fn<AddressToDistrictProvider["resolve"]>(async (input: RepresentativeLookupRequest) => {
      expect(input).toEqual({
        address: {
          city: "Sacramento",
          country: "US",
          line1: "123 Main Street",
          line2: null,
          postalCode: "95814",
          region: "CA"
        }
      })
      return resolution()
    })
    const baseUrl = await startServer({ resolve })

    const response = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({
        address: {
          city: " Sacramento ",
          country: "US",
          line1: " 123 Main Street ",
          line2: null,
          postalCode: " 95814 ",
          region: " CA "
        }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(JSON.stringify(body)).not.toContain("123 Main Street")
    expect(resolve).toHaveBeenCalledOnce()
    expect(body).toEqual({
      data: {
        districts: resolution().districts,
        expiresAt: "2026-08-25T12:05:00.000Z",
        lookupId: "lookup:fixture",
        quality: "exact",
        representatives: resolution().representatives,
        resolvedAt: "2026-08-25T12:00:00.000Z",
        warnings: []
      },
      links: { self: "/api/representative-lookups" },
      meta: { correlationId: expect.any(String), warnings: [] }
    })
  })

  it("accepts bounded coordinates and allows unresolved calculations", async () => {
    const resolve = vi.fn<AddressToDistrictProvider["resolve"]>(async () =>
      resolution({ districts: [], quality: "unresolved", representatives: [] })
    )
    const baseUrl = await startServer({ resolve })

    const response = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({ coordinates: { latitude: 38.5816, longitude: -121.4944 } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    expect(resolve).toHaveBeenCalledWith(
      { coordinates: { latitude: 38.5816, longitude: -121.4944 } },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    await expect(response.json()).resolves.toMatchObject({
      data: { districts: [], quality: "unresolved", representatives: [] }
    })
  })

  it("has a typed dependency-unavailable default provider for unconfigured deployments", async () => {
    const baseUrl = await startServer(new UnavailableAddressToDistrictProvider())

    const response = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({ coordinates: { latitude: 0, longitude: 0 } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        category: "dependency_unavailable",
        message: "Representative lookup provider is not configured",
        retryable: true
      }
    })
  })

  it("reaches the composed Census and OpenStates provider through the public route", async () => {
    const baseUrl = await startServer(
      new UsRepresentativeLookupProvider({
        apiBaseUrl: "https://api.example.test",
        clock: () => new Date("2026-08-25T12:00:00.000Z"),
        geocoder: { geocode: async () => ({ latitude: 38.5816, longitude: -121.4944 }) },
        openStates: { peopleAtCoordinates: async () => [openStatesPerson()] }
      })
    )

    const response = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({
        address: {
          city: "Sacramento",
          country: "US",
          line1: "123 Main Street",
          line2: null,
          postalCode: "95814",
          region: "CA"
        }
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        quality: "interpolated",
        representatives: [
          {
            person: { id: "person:openstates:ocd-person-example" },
            term: { personId: "person:openstates:ocd-person-example" }
          }
        ]
      }
    })
  })

  it("rejects malformed, ambiguous, unsupported, and query-bearing requests before calling the provider", async () => {
    const resolve = vi.fn<AddressToDistrictProvider["resolve"]>(async () => resolution())
    const baseUrl = await startServer({ resolve })
    const requests = await Promise.all([
      fetch(`${baseUrl}/api/representative-lookups`, {
        body: JSON.stringify({
          address: { city: "Sacramento", country: "US" },
          coordinates: { latitude: 0, longitude: 0 }
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/representative-lookups`, {
        body: JSON.stringify({
          address: { city: "Sacramento", country: "US", line1: "1", line2: "", postalCode: "95814", region: "CA" }
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/representative-lookups`, {
        body: JSON.stringify({
          address: { city: "Ottawa", country: "CA", line1: "1 Main", line2: null, postalCode: "K1A", region: "ON" }
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      }),
      fetch(`${baseUrl}/api/representative-lookups?unexpected=true`, {
        body: JSON.stringify({ coordinates: { latitude: 0, longitude: 0 } }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    ])

    expect(requests.map((response) => response.status)).toEqual([400, 400, 422, 400])
    expect(resolve).not.toHaveBeenCalled()
  })

  it("returns typed dependency failures for provider errors and timeouts", async () => {
    const failed = await startServer({
      resolve: async () => Promise.reject(new Error("provider detail must not leak"))
    })
    const timedOut = await startServer(
      { resolve: async () => await new Promise<DistrictResolution>(() => undefined) },
      10
    )
    const request = {
      body: JSON.stringify({ coordinates: { latitude: 0, longitude: 0 } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    }

    const [failure, timeout] = await Promise.all([
      fetch(`${failed}/api/representative-lookups`, request),
      fetch(`${timedOut}/api/representative-lookups`, request)
    ])

    expect(failure.status).toBe(503)
    await expect(failure.json()).resolves.toMatchObject({
      error: { category: "dependency_unavailable", message: "Representative lookup provider failed", retryable: true }
    })
    expect(timeout.status).toBe(503)
    await expect(timeout.json()).resolves.toMatchObject({
      error: {
        category: "dependency_unavailable",
        message: "Representative lookup provider timed out",
        retryable: true
      }
    })
  })

  it("fails closed when a provider returns malformed or unbounded canonical projections", async () => {
    const baseUrl = await startServer({
      resolve: async () =>
        resolution({ representatives: Array.from({ length: 101 }, () => resolution().representatives[0]!) })
    })

    const response = await fetch(`${baseUrl}/api/representative-lookups`, {
      body: JSON.stringify({ coordinates: { latitude: 0, longitude: 0 } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })
})

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
