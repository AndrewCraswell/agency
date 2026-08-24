import { afterEach, describe, expect, it } from "vitest"
import { AuthenticationError } from "../auth/workos.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createCivicSearchApiHandler, type CivicSearchApi } from "./civic-search.js"
import { createCoreReadApiHandler, type CoreReadQueryApi } from "./core-read.js"
import { createCompositeHttpApiHandler } from "./http.js"
import { runApiSmoke } from "./smoke-harness.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => close(server)))
  servers.clear()
})

function jsonResponse(body: unknown, status: number, correlationId?: string): Response {
  const headers = new Headers({ "content-type": "application/json" })
  if (correlationId !== undefined) {
    headers.set("x-correlation-id", correlationId)
  }
  if (status === 401) {
    headers.set("www-authenticate", 'Bearer realm="legislation", error="invalid_token"')
  }
  return new Response(JSON.stringify(body), { headers, status })
}

function canonical(id: string): Record<string, unknown> {
  return {
    canonicalUrl: `https://legislation.example.test/api/resources/${encodeURIComponent(id)}`,
    id,
    sources: [
      {
        isOfficial: true,
        provider: "fixture",
        retrievedAt: "2026-08-24T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: `https://source.example.test/${encodeURIComponent(id)}`
      }
    ],
    updatedAt: "2026-08-24T00:00:00.000Z"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function billSummary(id: string): Record<string, unknown> {
  return {
    ...canonical(id),
    canonicalUrl: `https://legislation.example.test/api/bills/${encodeURIComponent(id)}`,
    classification: ["bill"],
    identifier: "HB 1",
    introducedDate: "2026-01-01",
    jurisdictionId: "jurisdiction:fixture",
    latestActionAt: "2026-02-01T00:00:00.000Z",
    sessionId: "session:fixture",
    status: null,
    subjects: ["Government"],
    title: "Fixture bill",
    type: "bill"
  }
}

function fakeFetch() {
  const calls: Array<{ authorization: string | null; method: string; path: string; search: string }> = []
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input)
    const headers = new Headers(init?.headers)
    const correlationId = headers.get("x-correlation-id") ?? "missing-correlation"
    calls.push({
      authorization: headers.get("authorization"),
      method: init?.method ?? "GET",
      path: url.pathname,
      search: url.search
    })
    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok" }, 200, correlationId)
    }
    if (url.pathname === "/ready") {
      return jsonResponse({ status: "ready" }, 200, correlationId)
    }
    if (url.pathname === "/api/__smoke_unknown__") {
      return jsonResponse(
        { error: { category: "not_found", correlationId, message: "not found", retryable: false } },
        404,
        correlationId
      )
    }
    if (url.pathname === "/api/bills" && init?.method === "POST") {
      return jsonResponse(
        { error: { category: "not_found", correlationId, message: "not found", retryable: false } },
        404,
        correlationId
      )
    }
    if (url.pathname === "/api/bills" && headers.get("authorization") === null) {
      return jsonResponse(
        { error: { category: "unauthorized", correlationId, message: "Unauthorized", retryable: false } },
        401,
        correlationId
      )
    }
    if (
      url.pathname === "/api/jurisdictions/jurisdiction%3Afixture/bills" ||
      url.pathname === "/api/sessions/session%3Afixture/bills"
    ) {
      return jsonResponse(
        {
          data: [billSummary("bill:fixture")],
          links: { next: null, self: url.pathname },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (init?.method === "POST" && url.pathname.startsWith("/api/search/")) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: url.pathname },
          meta: {
            correlationId,
            limit: 1,
            mode: "lexical",
            isReranked: false,
            models: [],
            nextCursor: null,
            truncated: false,
            warnings: []
          }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/bills" || url.pathname.endsWith("/sessions") || url.pathname.endsWith("/bills")) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: url.pathname },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (init?.method === "POST" && url.pathname.endsWith("/batch")) {
      return jsonResponse(
        { data: [], links: { self: url.pathname }, meta: { correlationId, requested: 0, returned: 0, warnings: [] } },
        200,
        correlationId
      )
    }
    if (init?.method === "POST" && url.pathname === "/api/document-diffs") {
      return jsonResponse(
        { data: canonical("diff:fixture"), links: { self: url.pathname }, meta: { correlationId, warnings: [] } },
        200,
        correlationId
      )
    }
    if (
      url.pathname === "/api/people" ||
      url.pathname === "/api/organizations" ||
      url.pathname === "/api/meetings" ||
      url.pathname === "/api/amendments" ||
      url.pathname === "/api/votes" ||
      url.pathname === "/api/supporting-materials" ||
      url.pathname === "/api/changes" ||
      url.pathname === "/api/jurisdictions"
    ) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: url.pathname },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (
      url.pathname.includes("/timeline") ||
      url.pathname.includes("/related") ||
      url.pathname.includes("/sections") ||
      url.pathname.includes("/amendments") ||
      url.pathname.includes("/votes") ||
      url.pathname.includes("/changes") ||
      url.pathname.includes("/meetings")
    ) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: url.pathname },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    return jsonResponse(
      { data: canonical("resource:fixture"), links: { self: url.pathname }, meta: { correlationId, warnings: [] } },
      200,
      correlationId
    )
  }
  return { calls, fetchImpl }
}

function mutateJson(
  fetchImpl: (input: string | URL, init?: RequestInit) => Promise<Response>,
  path: string,
  mutate: (body: unknown) => unknown
): (input: string | URL, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const url = new URL(input)
    const response = await fetchImpl(input, init)
    if (url.pathname !== path) {
      return response
    }
    const body = await response.json()
    return new Response(JSON.stringify(mutate(body)), {
      headers: response.headers,
      status: response.status
    })
  }
}

describe("local API smoke harness", () => {
  it("runs only universal checks and exact canonical scoped bill pages in the scoped-bills profile", async () => {
    const { calls, fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      fixtures: { jurisdictionId: "jurisdiction:fixture", sessionId: "session:fixture" },
      profile: "scoped-bills",
      requireAuth: true,
      token: "do-not-log-this-token"
    })

    expect(report.status).toBe("passed")
    expect(report.passed.map((check) => check.id)).toEqual([
      "health",
      "ready",
      "unknown-route",
      "unsupported-method",
      "list-jurisdiction-bills",
      "list-session-bills",
      "auth-rejection"
    ])
    expect(report.checks.some((check) => check.id === "list-jurisdictions")).toBe(false)
    expect(
      calls
        .filter((call) => call.path.startsWith("/api/jurisdictions/") || call.path.startsWith("/api/sessions/"))
        .map((call) => ({ path: call.path, search: call.search }))
    ).toEqual([
      {
        path: "/api/jurisdictions/jurisdiction%3Afixture/bills",
        search: "?sort=introduced-desc&limit=1"
      },
      { path: "/api/sessions/session%3Afixture/bills", search: "?sort=introduced-desc&limit=1" }
    ])
  })

  it("blocks the scoped-bills profile without both required fixture IDs while retaining universal checks", async () => {
    const { fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      fixtures: { jurisdictionId: "jurisdiction:fixture" },
      profile: "scoped-bills"
    })

    expect(report.status).toBe("blocked")
    expect(report.blocked).toContainEqual(expect.objectContaining({ id: "scoped-bills-fixtures" }))
    expect(report.passed.map((check) => check.id)).toContain("health")
    expect(report.passed.map((check) => check.id)).toContain("unknown-route")
  })

  it("rejects a scoped bill page whose canonical URL does not match the configured public base URL", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/sessions/session%3Afixture/bills", (body) => {
      if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.data[0])) {
        return body
      }
      return {
        ...body,
        data: [{ ...body.data[0], canonicalUrl: "https://untrusted.example/api/bills/bill%3Afixture" }]
      }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl: malformed,
      fixtures: { jurisdictionId: "jurisdiction:fixture", sessionId: "session:fixture" },
      profile: "scoped-bills"
    })

    expect(report.status).toBe("failed")
    expect(report.failed).toContainEqual(expect.objectContaining({ id: "list-session-bills" }))
  })

  it("rejects rollover dates in scoped bill pages", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/jurisdictions/jurisdiction%3Afixture/bills", (body) => {
      if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.data[0])) {
        return body
      }
      return { ...body, data: [{ ...body.data[0], introducedDate: "2026-02-30" }] }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl: malformed,
      fixtures: { jurisdictionId: "jurisdiction:fixture", sessionId: "session:fixture" },
      profile: "scoped-bills"
    })

    expect(report.status).toBe("failed")
    expect(report.failed).toContainEqual(expect.objectContaining({ id: "list-jurisdiction-bills" }))
  })

  it.each([
    undefined,
    "ftp://legislation.example.test/",
    "https://user:pass@legislation.example.test/",
    "https://legislation.example.test/api",
    "https://legislation.example.test/?source=smoke",
    "https://legislation.example.test/#smoke"
  ])("rejects missing or unsafe canonical API base URLs for scoped bills: %s", async (canonicalApiBaseUrl) => {
    await expect(
      runApiSmoke({
        baseUrl: "http://localhost:3199",
        canonicalApiBaseUrl,
        fetchImpl: fakeFetch().fetchImpl,
        fixtures: { jurisdictionId: "jurisdiction:fixture", sessionId: "session:fixture" },
        profile: "scoped-bills"
      })
    ).rejects.toThrow(/canonicalApiBaseUrl/)
  })

  it("blocks protected checks when authenticated mode has no explicit token", async () => {
    const { calls, fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl,
      fixtures: { billId: "bill:1" },
      requireAuth: true
    })

    expect(report.status).toBe("blocked")
    expect(report.failed).toHaveLength(0)
    expect(report.blocked.some((check) => check.id === "get-bill")).toBe(true)
    expect(report.passed.some((check) => check.id === "auth-rejection")).toBe(true)
    expect(calls.every((call) => call.authorization === null)).toBe(true)
    expect(JSON.stringify(report)).not.toContain("bill:1")
  })

  it("uses the explicit bearer token and validates envelopes and correlation IDs", async () => {
    const { calls, fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl,
      fixtures: { billId: "bill:1" },
      requireAuth: true,
      token: "do-not-log-this-token"
    })
    expect(report.status).toBe("passed")
    expect(report.failed).toHaveLength(0)
    expect(report.passed.some((check) => check.id === "get-bill")).toBe(true)
    expect(calls.some((call) => call.authorization === "Bearer do-not-log-this-token")).toBe(true)
    expect(JSON.stringify(report)).not.toContain("do-not-log-this-token")
  })

  it("fails an abort-aware request at the configured timeout", async () => {
    const { fetchImpl } = fakeFetch()
    let observedAbort = false
    const hangingFetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      if (new URL(input).pathname !== "/health") {
        return await fetchImpl(input, init)
      }
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal === undefined || signal === null) {
          reject(new Error("Expected a request signal"))
          return
        }
        const onAbort = () => {
          observedAbort = true
          reject(signal.reason)
        }
        if (signal.aborted) {
          onAbort()
        } else {
          signal.addEventListener("abort", onAbort, { once: true })
        }
      })
    }
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: hangingFetch,
      requestTimeoutMs: 5
    })

    expect(observedAbort).toBe(true)
    expect(report.failed).toContainEqual(
      expect.objectContaining({ detail: "request timed out after 5 ms", id: "health", status: "failed" })
    )
  })

  it.each([0, 1.5, 60_001])("rejects the unsafe request timeout %s", async (requestTimeoutMs) => {
    await expect(
      runApiSmoke({
        baseUrl: "http://localhost:3199",
        fetchImpl: async () => {
          throw new Error("fetch must not run for an invalid timeout")
        },
        requestTimeoutMs
      })
    ).rejects.toThrow("requestTimeoutMs must be an integer between 1 and 60000")
  })

  it("runs against the composed Node server with canonical fixture records", async () => {
    const page = () => ({ items: [canonical("fixture:item")], truncated: false, warnings: [] })
    const service: CoreReadQueryApi & CivicSearchApi = {
      browseBills: async () => page(),
      compareBillVersions: async () => ({ changes: [] }),
      findRelatedBills: async () => page(),
      getAmendment: async () => canonical("amendment:fixture"),
      getBill: async () => canonical("bill:fixture"),
      getBillText: async () => ({ sections: [canonical("section:fixture")], truncated: false, warnings: [] }),
      getBillTimeline: async () => ({ events: [canonical("event:fixture")], truncated: false, warnings: [] }),
      getBillVotes: async () => page(),
      getDocument: async () => canonical("document:fixture"),
      getDocumentSections: async () => page(),
      getEvent: async () => canonical("event:fixture"),
      getJurisdiction: async () => canonical("jurisdiction:fixture"),
      getOrganization: async () => canonical("organization:fixture"),
      getPerson: async () => canonical("person:fixture"),
      getSession: async () => canonical("session:fixture"),
      getSupportingMaterial: async () => canonical("material:fixture"),
      getVote: async () => canonical("vote:fixture"),
      listJurisdictions: async () => page(),
      listSessions: async () => page(),
      searchAmendments: async () => page(),
      searchBills: async () => page(),
      searchBillText: async () => page(),
      searchChanges: async () => page(),
      searchEvents: async () => page(),
      searchOrganizations: async () => page(),
      searchPeople: async () => page(),
      searchSupportingMaterials: async () => page(),
      searchVotes: async () => page()
    }
    const apiHandler = createCompositeHttpApiHandler([
      createCoreReadApiHandler(service),
      createCivicSearchApiHandler(service)
    ])
    const server = createLegislationServer({
      apiHandler,
      authenticate: async (authorizationHeader) => {
        const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader
        if (value !== "Bearer smoke-token") {
          throw new AuthenticationError("invalid")
        }
        return { userId: "smoke-user" }
      },
      isReady: () => true,
      logger: {
        debug: () => undefined,
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined
      }
    })
    servers.add(server)
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (address === null || typeof address === "string") {
      throw new Error("Expected a TCP server address")
    }

    const report = await runApiSmoke({
      baseUrl: `http://127.0.0.1:${address.port}`,
      fixtures: { billId: "bill:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })
    expect(report.failed).toHaveLength(0)
    expect(report.blocked).toHaveLength(0)
    expect(report.skipped.some((check) => check.id === "get-jurisdiction")).toBe(true)
    expect(report.passed.map((check) => check.id)).toContain("get-bill")
    expect(report.passed.map((check) => check.id)).toContain("get-related-bills")
    expect(report.passed.map((check) => check.id)).toContain("auth-rejection")
  })

  it("rejects malformed error correlation and category responses", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/__smoke_unknown__", (body) => {
      if (typeof body !== "object" || body === null || !("error" in body)) {
        return body
      }
      return {
        ...body,
        error: { ...(body.error as Record<string, unknown>), category: "internal", correlationId: "wrong" }
      }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed,
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("unknown-route")
  })

  it("rejects an impossible RFC3339 timestamp in a canonical resource", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/bills/bill%3A1", (body) => {
      if (typeof body !== "object" || body === null || !("data" in body) || typeof body.data !== "object") {
        return body
      }
      return {
        ...body,
        data: { ...(body.data as Record<string, unknown>), updatedAt: "2026-02-30T00:00:00.000Z" }
      }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed,
      fixtures: { billId: "bill:1" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("get-bill")
  })

  it("rejects an invalid health status", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/health", (body) => {
      if (typeof body !== "object" || body === null) {
        return body
      }
      return { ...body, status: "degraded" }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed
    })

    expect(report.failed.map((check) => check.id)).toContain("health")
  })

  it("rejects an invalid readiness status", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/ready", (body) => {
      if (typeof body !== "object" || body === null) {
        return body
      }
      return { ...body, status: "unavailable" }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed
    })

    expect(report.failed.map((check) => check.id)).toContain("ready")
  })

  it("rejects malformed canonical resource responses", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/bills/bill%3A1", (body) => {
      if (typeof body !== "object" || body === null || !("data" in body) || typeof body.data !== "object") {
        return body
      }
      return { ...body, data: { ...(body.data as Record<string, unknown>), canonicalUrl: "/relative" } }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed,
      fixtures: { billId: "bill:1" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("get-bill")
  })

  it("rejects malformed page responses", async () => {
    const { fetchImpl } = fakeFetch()
    const malformedPage = mutateJson(fetchImpl, "/api/bills", (body) => {
      if (typeof body !== "object" || body === null) {
        return body
      }
      return { ...body, data: [{ id: "missing-canonical-fields" }] }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformedPage,
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("list-bills")
  })

  it("rejects malformed search responses", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/search/bills", (body) => {
      if (typeof body !== "object" || body === null || !("meta" in body) || typeof body.meta !== "object") {
        return body
      }
      return { ...body, meta: { ...(body.meta as Record<string, unknown>), mode: "unknown" } }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed,
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("search-bills")
  })

  it("rejects malformed batch responses", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/bills/batch", (body) => {
      if (typeof body !== "object" || body === null || !("meta" in body) || typeof body.meta !== "object") {
        return body
      }
      return { ...body, meta: { ...(body.meta as Record<string, unknown>), returned: 1 } }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed,
      fixtures: { billId: "bill:1" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("batch-bills")
  })
})
