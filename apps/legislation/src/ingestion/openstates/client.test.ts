import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { OpenStatesClient } from "./client.js"

describe("Open States entity client", () => {
  it("formats bill and event windows using OpenStates-compatible ISO datetimes", async () => {
    const requestUrls: URL[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      requestUrls.push(new URL(input instanceof Request ? input.url : input.toString()))
      return Response.json({ pagination: { max_page: 1, page: 1 }, results: [] })
    })
    const client = new OpenStatesClient({
      apiKey: "test-key",
      baseUrl: new URL("https://openstates.test/v3/"),
      http: new RetryingHttpClient({ fetch, maxAttempts: 1, requestTimeoutMs: 1000 })
    })
    const from = new Date("2026-08-17T10:11:12.345Z")
    const to = new Date("2026-08-18T13:14:15.678Z")

    for await (const _page of client.bills({ from, jurisdiction: "California" })) {
      // Exhaust the page iterator so the request is issued.
    }
    for await (const _page of client.events({
      from,
      jurisdictionId: "ocd-jurisdiction/country:us/state:ca/government",
      to
    })) {
      // Exhaust the page iterator so the request is issued.
    }

    expect(requestUrls[0]?.searchParams.get("updated_since")).toBe("2026-08-17T10:11:12")
    expect(requestUrls[0]?.searchParams.get("per_page")).toBe("20")
    expect(requestUrls[1]?.searchParams.get("start_date")).toBe("2026-08-17T10:11:12")
    expect(requestUrls[1]?.searchParams.get("end_date")).toBe("2026-08-18T13:14:15")
    expect(requestUrls[1]?.searchParams.get("per_page")).toBe("20")
  })

  it("paginates jurisdiction-scoped people and committee snapshots", async () => {
    const requestUrls: string[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      requestUrls.push(url.href)
      const page = Number(url.searchParams.get("page"))
      return Response.json({
        pagination: { max_page: 2, page },
        results: [{ id: `${url.pathname}:${page}` }]
      })
    })
    const client = new OpenStatesClient({
      apiKey: "test-key",
      baseUrl: new URL("https://openstates.test/v3/"),
      http: new RetryingHttpClient({ fetch, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const people: unknown[] = []
    for await (const page of client.people({ jurisdictionId: "ocd-jurisdiction/example" })) {
      people.push(...page)
    }
    const committees: unknown[] = []
    for await (const page of client.committees({ jurisdictionId: "ocd-jurisdiction/example" })) {
      committees.push(...page)
    }

    expect(people).toHaveLength(2)
    expect(committees).toHaveLength(2)
    expect(requestUrls).toHaveLength(4)
    expect(new URL(requestUrls[0] ?? "").searchParams.get("jurisdiction")).toBe("ocd-jurisdiction/example")
    expect(new URL(requestUrls[0] ?? "").searchParams.get("per_page")).toBe("20")
    expect(new URL(requestUrls[2] ?? "").searchParams.get("include")).toBe("memberships")
  })

  it("uses the documented people.geo coordinate route with the configured API key", async () => {
    let request: Readonly<{ headers: Headers; url: URL }> | undefined
    const client = new OpenStatesClient({
      apiKey: "test-key",
      baseUrl: new URL("https://openstates.test/v3/"),
      http: new RetryingHttpClient({
        fetch: async (input, init) => {
          request = {
            headers: new Headers(init?.headers),
            url: new URL(input instanceof Request ? input.url : input.toString())
          }
          return Response.json({
            pagination: { max_page: 1, page: 1 },
            results: [
              {
                current_role: { district: 10, org_classification: "lower", title: "Representative" },
                family_name: "Example",
                given_name: "Alex",
                id: "ocd-person/example",
                image: null,
                jurisdiction: { id: "ocd-jurisdiction/country:us/state:ca/government" },
                name: "Alex Example",
                openstates_url: "https://openstates.test/person/example",
                party: "Independent",
                updated_at: "2026-08-25T12:00:00.000Z"
              }
            ]
          })
        },
        maxAttempts: 1,
        requestTimeoutMs: 1_000
      })
    })

    const people = await client.peopleAtCoordinates({
      latitude: 38.5816,
      longitude: -121.4944,
      signal: new AbortController().signal
    })

    expect(people).toHaveLength(1)
    expect(request).toMatchObject({ headers: expect.any(Headers) })
    expect(request?.headers.get("x-api-key")).toBe("test-key")
    expect(request?.url.pathname).toBe("/v3/people.geo")
    expect(request?.url.searchParams.get("lat")).toBe("38.5816")
    expect(request?.url.searchParams.get("lng")).toBe("-121.4944")
  })
})
