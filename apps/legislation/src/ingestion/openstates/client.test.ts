import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { OpenStatesClient } from "./client.js"

describe("Open States entity client", () => {
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
    expect(new URL(requestUrls[2] ?? "").searchParams.get("include")).toBe("memberships")
  })
})
