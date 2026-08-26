import { describe, expect, it, vi } from "vitest"
import {
  LegislationApiAbortError,
  LegislationApiClient,
  LegislationApiError,
  LegislationApiProtocolError,
  LegislationApiTimeoutError,
  type FetchLike
} from "./client.js"

const correlationId = "4cfa19c5-0407-4227-8ddd-b0a1441624df"

function pageResponse(data: unknown[] = [{ id: "bill:ca:2025:ab:1" }]): Response {
  return jsonResponse({
    data,
    links: { next: null, self: "/api/bills" },
    meta: { correlationId, limit: 20, nextCursor: null, truncated: false, warnings: [] }
  })
}

function resourceResponse(data: object = { id: "resource:1" }): Response {
  return jsonResponse({ data, links: { self: "/api/resource" }, meta: { correlationId, warnings: [] } })
}

function batchResponse(): Response {
  return jsonResponse({
    data: [{ data: { id: "resource:1" }, id: "resource:1", status: "ok" }],
    links: { self: "/api/resources/batch" },
    meta: { correlationId, requested: 1, returned: 1, warnings: [] }
  })
}

function searchResponse(groups?: unknown[]): Response {
  return jsonResponse({
    data: [],
    links: { next: null, self: "/api/search" },
    meta: {
      correlationId,
      ...(groups === undefined ? {} : { groups }),
      isReranked: false,
      limit: 20,
      mode: "lexical",
      models: [],
      nextCursor: null,
      truncated: false,
      warnings: []
    }
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
    status
  })
}

function client(fetch: FetchLike): LegislationApiClient {
  return new LegislationApiClient({ baseUrl: "https://legislation.example.test", bearerToken: "top-secret", fetch })
}

describe("LegislationApiClient", () => {
  it("injects request auth and propagates correlation IDs without exposing the token", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(pageResponse())

    await client(fetch).listBills({ jurisdictionId: "jurisdiction:ca", limit: 20 }, { correlationId })

    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe("https://legislation.example.test/api/bills?jurisdictionId=jurisdiction%3Aca&limit=20")
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer top-secret")
    expect(new Headers(init?.headers).get("x-correlation-id")).toBe(correlationId)
  })

  it("maps documented ErrorResponse values", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse(
        {
          error: { category: "not_found", correlationId, message: "Not found", retryable: false }
        },
        404
      )
    )

    const request = client(fetch).getBill("bill:ca:2025:ab:404", undefined, { correlationId })

    await expect(request).rejects.toMatchObject({
      category: "not_found",
      correlationId,
      name: LegislationApiError.name,
      retryable: false,
      status: 404
    })
  })

  it("fails closed for malformed resource, page, search, and batch envelopes", async () => {
    const invalid = [
      jsonResponse({ data: {}, links: { self: "/api/bills/x" }, meta: { correlationId, warnings: "no" } }),
      jsonResponse({ data: {}, links: { next: null, self: "/api/bills" }, meta: { correlationId } }),
      jsonResponse({
        data: [],
        links: { next: null, self: "/api/search/bills" },
        meta: { correlationId, limit: 20, nextCursor: null, truncated: false, warnings: [] }
      }),
      jsonResponse({
        data: {},
        links: { self: "/api/bills/batch" },
        meta: { correlationId, requested: 1, returned: 1, warnings: [] }
      })
    ]
    const fetch = vi.fn<FetchLike>()
    for (const response of invalid) {
      fetch.mockResolvedValueOnce(response)
    }
    const api = client(fetch)

    await expect(api.getBill("bill:ca:2025:ab:1", undefined, { correlationId })).rejects.toBeInstanceOf(
      LegislationApiProtocolError
    )
    await expect(api.listBills(undefined, { correlationId })).rejects.toBeInstanceOf(LegislationApiProtocolError)
    await expect(api.searchBills({ query: "housing" }, { correlationId })).rejects.toBeInstanceOf(
      LegislationApiProtocolError
    )
    await expect(api.getBills(["bill:ca:2025:ab:1"], { correlationId })).rejects.toBeInstanceOf(
      LegislationApiProtocolError
    )
  })

  it("fails closed when batch metadata does not match its items", async () => {
    const mismatchedLength = jsonResponse({
      data: [{ id: "bill:ca:2025:ab:1" }],
      links: { self: "/api/bills/batch" },
      meta: { correlationId, requested: 2, returned: 2, warnings: [] }
    })
    const impossibleCount = jsonResponse({
      data: [{ id: "bill:ca:2025:ab:1" }, { id: "bill:ca:2025:ab:2" }],
      links: { self: "/api/bills/batch" },
      meta: { correlationId, requested: 1, returned: 2, warnings: [] }
    })
    const fetch = vi.fn<FetchLike>().mockResolvedValueOnce(mismatchedLength).mockResolvedValueOnce(impossibleCount)
    const api = client(fetch)

    await expect(api.getBills(["bill:ca:2025:ab:1"], { correlationId })).rejects.toBeInstanceOf(
      LegislationApiProtocolError
    )
    await expect(api.getBills(["bill:ca:2025:ab:1"], { correlationId })).rejects.toBeInstanceOf(
      LegislationApiProtocolError
    )
  })

  it("uses active search and diff endpoints with their documented envelopes", async () => {
    const search = jsonResponse({
      data: [],
      links: { next: null, self: "/api/search/bills" },
      meta: {
        correlationId,
        isReranked: false,
        limit: 20,
        mode: "lexical",
        models: [],
        nextCursor: null,
        truncated: false,
        warnings: []
      }
    })
    const diff = jsonResponse({
      data: { id: "diff:1" },
      links: { self: "/api/document-diffs" },
      meta: { correlationId, warnings: [] }
    })
    const fetch = vi.fn<FetchLike>().mockResolvedValueOnce(search).mockResolvedValueOnce(diff)
    const api = client(fetch)

    await api.searchBills({ mode: "lexical", query: "housing" }, { correlationId })
    await api.compareBillVersions("bill:ca:2025:ab:1", "document:left", "document:right", { correlationId })

    expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(["POST", "POST"])
    expect(String(fetch.mock.calls[1]?.[0])).toBe("https://legislation.example.test/api/document-diffs")
  })

  it("maps newly composed nested reads to their encoded paths", async () => {
    const fetch = vi.fn<FetchLike>().mockImplementation(async () => pageResponse())
    const api = client(fetch)

    await api.listBillDocuments("bill:1", undefined, { correlationId })
    await api.listVotePositions("vote:1", undefined, { correlationId })
    await api.listPersonAmendments("person:1", undefined, { correlationId })
    await api.listPersonVotes("person:1", undefined, { correlationId })
    await api.listOrganizationMeetings("organization:1", undefined, { correlationId })
    await api.listOrganizationCalendars("organization:1", undefined, { correlationId })
    await api.listJurisdictionMeetings("jurisdiction:1", undefined, { correlationId })
    await api.listSessionMeetings("session:1", undefined, { correlationId })
    await api.listCalendarMeetings("calendar:1", undefined, { correlationId })
    await api.listMeetingAgenda("meeting:1", undefined, { correlationId })
    await api.listMeetingDocuments("meeting:1", undefined, { correlationId })
    await api.listMeetingOutcomes("meeting:1", undefined, { correlationId })
    await api.listMeetingParticipants("meeting:1", undefined, { correlationId })

    expect(fetch.mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method])).toEqual([
      ["/api/bills/bill%3A1/documents", "GET"],
      ["/api/votes/vote%3A1/positions", "GET"],
      ["/api/people/person%3A1/amendments", "GET"],
      ["/api/people/person%3A1/votes", "GET"],
      ["/api/organizations/organization%3A1/meetings", "GET"],
      ["/api/organizations/organization%3A1/calendars", "GET"],
      ["/api/jurisdictions/jurisdiction%3A1/meetings", "GET"],
      ["/api/sessions/session%3A1/meetings", "GET"],
      ["/api/calendars/calendar%3A1/meetings", "GET"],
      ["/api/meetings/meeting%3A1/agenda", "GET"],
      ["/api/meetings/meeting%3A1/documents", "GET"],
      ["/api/meetings/meeting%3A1/outcomes", "GET"],
      ["/api/meetings/meeting%3A1/participants", "GET"]
    ])
  })

  it("maps a canonical change detail read to its encoded path", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValueOnce(resourceResponse())
    const api = client(fetch)

    await api.getChange("change:1", { correlationId })

    expect(fetch).toHaveBeenCalledOnce()
    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe("/api/changes/change%3A1")
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("GET")
  })

  it("maps composed search, batch, representative, and research requests", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(searchResponse([{ nextCursor: null, recordType: "bill", returned: 0 }]))
      .mockResolvedValueOnce(batchResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
    const api = client(fetch)

    await api.searchAll({ query: "housing" }, { correlationId })
    await api.getResources({ items: [{ id: "bill:1", type: "bill" }] }, { correlationId })
    await api.lookupRepresentatives({ address: { country: "US", postalCode: "94103" } }, { correlationId })
    await api.answerLegislativeResearchQuestion(
      { question: "What changed?", scope: { billIds: ["bill:1"] } },
      { correlationId }
    )

    expect(fetch.mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method, init?.body])).toEqual([
      ["/api/search/all", "POST", JSON.stringify({ query: "housing" })],
      ["/api/resources/batch", "POST", JSON.stringify({ items: [{ id: "bill:1", type: "bill" }] })],
      ["/api/representative-lookups", "POST", JSON.stringify({ address: { country: "US", postalCode: "94103" } })],
      ["/api/research/answers", "POST", JSON.stringify({ question: "What changed?", scope: { billIds: ["bill:1"] } })]
    ])
  })

  it("uses subscription and webhook mutations with required bodies and concurrency headers", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
      .mockResolvedValueOnce(resourceResponse())
    const api = client(fetch)
    const mutation = { correlationId, idempotencyKey: "mutation-key" }
    const revisioned = { ...mutation, ifMatch: '"revision:1"' }

    await api.createSubscription({ name: "Bills" }, mutation)
    await api.updateSubscription("subscription:1", { status: "paused" }, revisioned)
    await api.deleteSubscription("subscription:1", revisioned)
    await api.createWebhook({ name: "Webhook", url: "https://example.test/hook" }, mutation)
    await api.updateWebhook("webhook:1", { status: "paused" }, revisioned)
    await api.deleteWebhook("webhook:1", revisioned)
    await api.rotateWebhookSecret("webhook:1", { overlapSeconds: 60 }, revisioned)
    await api.verifyWebhook("webhook:1", revisioned)

    expect(fetch.mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method, init?.body])).toEqual([
      ["/api/subscriptions", "POST", JSON.stringify({ name: "Bills" })],
      ["/api/subscriptions/subscription%3A1", "PATCH", JSON.stringify({ status: "paused" })],
      ["/api/subscriptions/subscription%3A1", "DELETE", undefined],
      ["/api/webhooks", "POST", JSON.stringify({ name: "Webhook", url: "https://example.test/hook" })],
      ["/api/webhooks/webhook%3A1", "PATCH", JSON.stringify({ status: "paused" })],
      ["/api/webhooks/webhook%3A1", "DELETE", undefined],
      ["/api/webhooks/webhook%3A1/rotate-secret", "POST", JSON.stringify({ overlapSeconds: 60 })],
      ["/api/webhooks/webhook%3A1/verify", "POST", JSON.stringify({})]
    ])
    expect(fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get("idempotency-key"))).toEqual([
      "mutation-key",
      "mutation-key",
      "mutation-key",
      "mutation-key",
      "mutation-key",
      "mutation-key",
      "mutation-key",
      "mutation-key"
    ])
    expect(fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get("if-match"))).toEqual([
      null,
      '"revision:1"',
      '"revision:1"',
      null,
      '"revision:1"',
      '"revision:1"',
      '"revision:1"',
      '"revision:1"'
    ])
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get("content-type")).toBe("application/merge-patch+json")
  })

  it("turns a timed-out fetch into a dedicated timeout error and clears its timer", async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      )

    await expect(client(fetch).listBills(undefined, { correlationId, timeoutMs: 1 })).rejects.toBeInstanceOf(
      LegislationApiTimeoutError
    )
  })

  it("turns caller cancellation into a dedicated abort error", async () => {
    const controller = new AbortController()
    controller.abort()
    const fetch = vi.fn<FetchLike>().mockRejectedValue(new DOMException("aborted", "AbortError"))

    await expect(
      client(fetch).listBills(undefined, { correlationId, signal: controller.signal })
    ).rejects.toBeInstanceOf(LegislationApiAbortError)
  })

  it("rejects malformed error bodies and mismatched correlation IDs", async () => {
    const malformedError = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({ error: "not found" }, 404))
    const mismatchedCorrelation = vi.fn<FetchLike>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          links: { next: null, self: "/api/bills" },
          meta: { correlationId, limit: 20, nextCursor: null, truncated: false, warnings: [] }
        }),
        {
          headers: { "content-type": "application/json", "x-correlation-id": "unexpected" }
        }
      )
    )

    await expect(
      client(malformedError).getBill("bill:ca:2025:ab:1", undefined, { correlationId })
    ).rejects.toBeInstanceOf(LegislationApiProtocolError)
    await expect(client(mismatchedCorrelation).listBills(undefined, { correlationId })).rejects.toBeInstanceOf(
      LegislationApiProtocolError
    )
  })

  it("rejects surprising base URL components before a request is issued", () => {
    const fetch = vi.fn<FetchLike>()

    expect(() => new LegislationApiClient({ baseUrl: "https://token@example.test", fetch })).toThrow(
      "baseUrl must not contain credentials"
    )
    expect(() => new LegislationApiClient({ baseUrl: "https://example.test/api", fetch })).toThrow(
      "baseUrl must not contain a path"
    )
    expect(() => new LegislationApiClient({ baseUrl: "https://example.test?tenant=a", fetch })).toThrow(
      "baseUrl must not contain a query or hash"
    )
    expect(() => new LegislationApiClient({ baseUrl: "https://example.test#api", fetch })).toThrow(
      "baseUrl must not contain a query or hash"
    )
  })
})
