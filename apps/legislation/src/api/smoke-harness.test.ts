import { afterEach, describe, expect, it } from "vitest"
import { AuthenticationError } from "../auth/workos.js"
import { close, createLegislationServer } from "../mcp/server.js"
import type { AmendmentSearchApi } from "./amendment-search.js"
import type { BillSummaryRead, SupportingMaterialDetailRead } from "./canonical-read.js"
import type { CivicSearchApi } from "./civic-search.js"
import type { CoreReadQueryApi } from "./core-read.js"
import type { DocumentReadApi } from "./document-read-routes.js"
import { createLegislationApiHandler } from "./handlers.js"
import { runApiSmoke, SMOKE_MANIFEST } from "./smoke-harness.js"
import type { Delivery, Subscription, SubscriptionEvent, SubscriptionRepository, Webhook } from "./subscriptions.js"
import type { WebhookReadRepository } from "./webhook-read-repository.js"

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

function billSummaryRead(id: string): BillSummaryRead {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-24T00:00:00Z"),
    id,
    identifier: "HB 1",
    introducedAt: "2026-01-01",
    jurisdictionId: "jurisdiction:fixture",
    latestActionAt: "2026-02-01T00:00:00.000Z",
    sessionId: "session:fixture",
    sourceUrl: `https://source.example.test/${encodeURIComponent(id)}`,
    status: null,
    subjects: ["Government"],
    title: "Fixture bill",
    updatedAt: new Date("2026-08-24T00:00:00Z"),
    upstreamIds: { fixture: id }
  }
}

function supportingMaterialRead(id: string): SupportingMaterialDetailRead {
  return {
    ...canonical(id),
    amendmentIds: ["amendment:fixture"],
    billIds: ["bill:fixture"],
    byteSize: null,
    classification: "committee-report",
    contentType: "application/pdf",
    createdAt: new Date("2026-08-24T00:00:00Z"),
    documentDate: "2026-01-01",
    id,
    jurisdictionId: "jurisdiction:fixture",
    meetingIds: ["event:fixture"],
    organizationIds: ["organization:fixture"],
    pageCount: null,
    processingStatus: "processed",
    sectionCount: 1,
    sourceUrl: `https://source.example.test/${encodeURIComponent(id)}`,
    storedUrl: null,
    textCharacterCount: 12,
    title: "Fixture supporting material",
    updatedAt: new Date("2026-08-24T00:00:00Z"),
    upstreamIds: { fixture: id }
  }
}

function documentRead(id = "document:fixture") {
  return {
    billId: "bill:fixture",
    byteSize: null,
    classification: "version" as const,
    contentHash: "a".repeat(64),
    createdAt: new Date("2026-08-24T00:00:00Z"),
    documentDate: "2026-01-01",
    failureCategory: null,
    id,
    mimeType: "application/pdf",
    ocrCompletedAt: new Date("2026-08-24T00:00:00Z"),
    ocrProvider: "fixture-ocr",
    ocrStatus: "processed" as const,
    pageCount: 2,
    processingStatus: "processed" as const,
    sourceUrl: `https://source.example.test/${encodeURIComponent(id)}`,
    storedUrl: null,
    title: "Fixture document",
    updatedAt: new Date("2026-08-24T00:00:00Z"),
    versionCode: "fixture"
  }
}

function documentSectionRead(documentId = "document:fixture", sectionId = "document-section:fixture") {
  return {
    document: {
      billId: "bill:fixture",
      createdAt: new Date("2026-08-24T00:00:00Z"),
      id: documentId,
      sourceUrl: `https://source.example.test/${encodeURIComponent(documentId)}`,
      updatedAt: new Date("2026-08-24T00:00:00Z")
    },
    section: {
      contentHash: "b".repeat(64),
      heading: "Fixture section",
      id: sectionId,
      ordinal: 0,
      pageEnd: 1,
      pageStart: 1,
      sourceEndOffset: 12,
      sourceStartOffset: 0,
      text: "Fixture text"
    }
  }
}

function subscriptionRead(): Subscription {
  return {
    cancelledAt: null,
    createdAt: new Date("2026-08-24T00:00:00Z"),
    delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
    eventTypes: ["record-updated"],
    frequency: "daily",
    id: "subscription:fixture",
    name: "Fixture subscription",
    owner: { organizationId: "organization:smoke", userId: "smoke-user" },
    revision: "subscription-revision",
    status: "active",
    target: { recordId: "bill:fixture", recordType: "bill", type: "record" },
    timezone: "America/Los_Angeles",
    updatedAt: new Date("2026-08-24T00:00:00Z")
  }
}

function subscriptionEventRead(): SubscriptionEvent {
  return {
    changeEventId: null,
    eventType: "record-updated",
    id: "subscription-event:fixture",
    matchedAt: new Date("2026-08-24T00:00:00Z"),
    occurredAt: new Date("2026-08-24T00:00:00Z"),
    recordId: "bill:fixture",
    recordType: "bill",
    sourceUrls: ["https://source.example.test/bill-fixture"],
    subscriptionId: "subscription:fixture",
    summary: "Fixture subscription event",
    title: "Fixture bill updated"
  }
}

function deliveryRead(): Delivery {
  return {
    attemptCount: 0,
    channel: "in-app",
    createdAt: new Date("2026-08-24T00:00:00Z"),
    deliveredAt: null,
    destinationId: null,
    failureCategory: null,
    id: "delivery:fixture",
    nextAttemptAt: null,
    status: "pending",
    subscriptionEventIds: ["subscription-event:fixture"],
    subscriptionId: "subscription:fixture"
  }
}

function webhookRead(): Webhook {
  return {
    activeKeyIds: ["webhook-key:fixture"],
    cancelledAt: null,
    createdAt: new Date("2026-08-24T00:00:00Z"),
    eventTypes: ["record-updated"],
    id: "webhook:fixture",
    lastFailedAt: null,
    lastSucceededAt: null,
    name: "Fixture webhook",
    overlapEndsAt: null,
    owner: { organizationId: "organization:smoke", userId: "smoke-user" },
    revision: "00000000-0000-0000-0000-000000000001",
    secretLastFour: "1234",
    status: "active",
    updatedAt: new Date("2026-08-24T00:00:00Z"),
    url: "https://hooks.example.test/legislation"
  }
}

function ownsFixture(
  owner: Readonly<{ organizationId: string | null; userId: string }>,
  resourceOwner: Readonly<{ organizationId: string | null; userId: string }>
): boolean {
  return owner.organizationId === resourceOwner.organizationId && owner.userId === resourceOwner.userId
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
      url.pathname === "/api/sessions/session%3Afixture/bills" ||
      url.pathname === "/api/bills"
    ) {
      return jsonResponse(
        {
          data: [billSummary("bill:fixture")],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (
      url.pathname === "/api/jurisdictions" ||
      url.pathname === "/api/amendments" ||
      url.pathname === "/api/votes" ||
      url.pathname === "/api/people" ||
      url.pathname === "/api/organizations" ||
      url.pathname === "/api/meetings" ||
      (init?.method === "POST" && url.pathname === "/api/document-diffs")
    ) {
      return jsonResponse(
        { error: { category: "not_found", correlationId, message: "not found", retryable: false } },
        404,
        correlationId
      )
    }
    if (url.pathname === "/api/subscriptions" || url.pathname === "/api/webhooks") {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (
      init?.method === "POST" &&
      url.pathname === "/api/search/bills" &&
      typeof init.body === "string" &&
      init.body.length > 1_048_576
    ) {
      return jsonResponse(
        {
          error: {
            category: "payload_too_large",
            correlationId,
            message: "Request body exceeds the allowed size",
            retryable: false
          }
        },
        413,
        correlationId
      )
    }
    if (init?.method === "POST" && url.pathname.startsWith("/api/search/")) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: `${url.pathname}${url.search}` },
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
    if (url.pathname.endsWith("/documents")) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname.includes("/sections/")) {
      return jsonResponse(
        {
          data: canonical("section:fixture"),
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/bills" || url.pathname.endsWith("/sessions") || url.pathname.endsWith("/bills")) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (init?.method === "POST" && url.pathname.endsWith("/batch")) {
      return jsonResponse(
        {
          data: [],
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId, requested: 0, returned: 0, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (init?.method === "POST" && url.pathname === "/api/document-diffs") {
      return jsonResponse(
        {
          data: canonical("diff:fixture"),
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId, warnings: [] }
        },
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
      url.pathname === "/api/changes" ||
      url.pathname === "/api/jurisdictions"
    ) {
      return jsonResponse(
        {
          data: [],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/supporting-materials") {
      return jsonResponse(
        {
          data: [
            {
              ...canonical("material:fixture"),
              amendmentIds: [],
              billIds: ["bill:fixture"],
              classification: "supporting-document",
              documentDate: "2026-01-01",
              jurisdictionId: "jurisdiction:fixture",
              meetingIds: [],
              mimeType: "text/html",
              organizationIds: [],
              processingStatus: "processed",
              sourceUrl: "https://source.example.test/material",
              title: "Fixture material",
              type: "supporting-material"
            }
          ],
          links: { next: null, self: `${url.pathname}${url.search}` },
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
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    return jsonResponse(
      {
        data: canonical("resource:fixture"),
        links: { self: `${url.pathname}${url.search}` },
        meta: { correlationId, warnings: [] }
      },
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
  it("keeps one manifest entry for every implemented or in-progress full-profile operation", () => {
    expect(SMOKE_MANIFEST).toHaveLength(18)
    expect(new Set(SMOKE_MANIFEST.map((entry) => entry.id)).size).toBe(SMOKE_MANIFEST.length)
    expect(SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "done")).toHaveLength(2)
    expect(SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "in-progress")).toHaveLength(16)
  })

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

  it.each([
    "ftp://legislation.example.test/",
    "https://user:pass@legislation.example.test/",
    "https://legislation.example.test/api",
    "https://legislation.example.test/?source=smoke",
    "https://legislation.example.test/#smoke"
  ])("rejects an unsafe smoke target base URL: %s", async (baseUrl) => {
    await expect(
      runApiSmoke({
        baseUrl,
        fetchImpl: async () => {
          throw new Error("fetch must not run for an unsafe base URL")
        }
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
    expect(report.blocked.some((check) => check.id === "absent-list-votes")).toBe(true)
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
    expect(report.passed.some((check) => check.id === "absent-list-votes")).toBe(true)
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
    const subscription = subscriptionRead()
    const event = subscriptionEventRead()
    const delivery = deliveryRead()
    const webhook = webhookRead()
    const documentReadApi: DocumentReadApi = {
      assertBillExists: async () => undefined,
      getDocumentDetail: async (id) => ({ ...documentRead(id), sectionCount: 1, textCharacterCount: 12 }),
      getDocumentSection: async ({ documentId, sectionId }) => documentSectionRead(documentId, sectionId),
      listBillDocuments: async () => ({ items: [documentRead()], truncated: false }),
      listDocumentSections: async (input) => ({ items: [documentSectionRead(input.documentId)], truncated: false })
    }
    const subscriptionRepository: SubscriptionRepository = {
      cancelSubscription: async () => {
        throw new Error("Subscription mutations are not composed by this smoke fixture")
      },
      createSubscription: async () => {
        throw new Error("Subscription mutations are not composed by this smoke fixture")
      },
      findExactSubscription: async () => undefined,
      getSubscription: async ({ id, owner }) =>
        id === subscription.id && ownsFixture(owner, subscription.owner) ? subscription : undefined,
      listDeliveries: async ({ owner, subscriptionId }) => ({
        items: ownsFixture(owner, subscription.owner) && subscriptionId === subscription.id ? [delivery] : [],
        truncated: false
      }),
      listSubscriptionEvents: async ({ owner, subscriptionId }) => ({
        items: ownsFixture(owner, subscription.owner) && subscriptionId === subscription.id ? [event] : [],
        truncated: false
      }),
      listSubscriptions: async ({ owner }) => ({
        items: ownsFixture(owner, subscription.owner) ? [subscription] : [],
        truncated: false
      }),
      updateSubscription: async () => {
        throw new Error("Subscription mutations are not composed by this smoke fixture")
      }
    }
    const webhookReadRepository: WebhookReadRepository = {
      getWebhook: async ({ id, owner }) =>
        id === webhook.id && ownsFixture(owner, webhook.owner) ? webhook : undefined,
      listWebhooks: async ({ owner }) => ({
        items: ownsFixture(owner, webhook.owner) ? [webhook] : [],
        truncated: false
      })
    }
    const service: CoreReadQueryApi & CivicSearchApi & AmendmentSearchApi = {
      browseBills: async () => ({ items: [billSummaryRead("bill:fixture")], truncated: false, warnings: [] }),
      compareBillVersions: async () => ({ changes: [] }),
      findRelatedBills: async () => page(),
      getAmendment: async () => canonical("amendment:fixture"),
      getBill: async () => canonical("bill:fixture"),
      getBillText: async () => ({ sections: [canonical("section:fixture")], truncated: false, warnings: [] }),
      getBillTimeline: async () => ({ events: [canonical("event:fixture")], truncated: false, warnings: [] }),
      getBillVotes: async () => page(),
      getDocument: async () => canonical("document:fixture"),
      getDocumentSection: async () => ({
        document: {
          billId: "bill:fixture",
          createdAt: new Date("2026-08-24T00:00:00Z"),
          id: "document:fixture",
          sourceUrl: "https://source.example.test/document",
          updatedAt: new Date("2026-08-24T00:00:00Z")
        },
        section: {
          contentHash: "a".repeat(64),
          heading: null,
          id: "document-section:fixture",
          ordinal: 0,
          sourceEndOffset: 12,
          sourceStartOffset: 0,
          text: "Fixture text"
        }
      }),
      getDocumentSections: async () => page(),
      getJurisdiction: async () => canonical("jurisdiction:fixture"),
      getSession: async () => canonical("session:fixture"),
      getSupportingMaterial: async () => ({ material: supportingMaterialRead("material:fixture") }),
      getSupportingMaterialSection: async () => ({
        material: supportingMaterialRead("material:fixture"),
        section: {
          contentHash: "b".repeat(64),
          heading: null,
          id: "supporting-material-section:fixture",
          ordinal: 0,
          text: "Fixture text"
        }
      }),
      getVote: async () => canonical("vote:fixture"),
      listJurisdictions: async () => page(),
      listSessions: async () => page(),
      searchAmendmentHits: async () => ({
        items: [],
        search: { isReranked: false, models: [] },
        truncated: false,
        warnings: []
      }),
      searchAmendments: async () => page(),
      searchBills: async () => ({ items: [], truncated: false, warnings: [] }),
      searchBillText: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
      searchChanges: async () => page(),
      searchSupportingMaterials: async () => ({
        items: [supportingMaterialRead("material:fixture")],
        truncated: false,
        warnings: []
      }),
      searchSupportingMaterialHits: async () => ({
        items: [],
        search: { isReranked: false, models: [] },
        truncated: false,
        warnings: []
      }),
      searchVotes: async () => page()
    }
    const apiHandler = createLegislationApiHandler(service, {
      apiBaseUrl: "https://api.example.test",
      documentReadApi,
      subscriptionRepository,
      webhookReadRepository
    })
    const server = createLegislationServer({
      apiHandler,
      apiAuthenticate: async (authorizationHeader) => {
        const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader
        if (value !== "Bearer smoke-token") {
          throw new AuthenticationError("invalid")
        }
        return { organizationId: "organization:smoke", userId: "smoke-user" }
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
    const unauthorized = await Promise.all([
      fetch(`http://127.0.0.1:${address.port}/api/subscriptions`),
      fetch(`http://127.0.0.1:${address.port}/api/webhooks`)
    ])
    expect(unauthorized.map((response) => response.status)).toEqual([401, 401])

    const report = await runApiSmoke({
      baseUrl: `http://127.0.0.1:${address.port}`,
      fixtures: {
        billId: "bill:fixture",
        documentId: "document:fixture",
        documentSectionId: "document-section:fixture",
        materialId: "material:fixture",
        materialSectionId: "supporting-material-section:fixture",
        subscriptionId: "subscription:fixture",
        webhookId: "webhook:fixture"
      },
      requireAuth: true,
      token: "smoke-token"
    })
    expect(JSON.stringify(report.failed)).toBe("[]")
    expect(report.blocked).toEqual([])
    expect(report.skipped.map((check) => check.id)).toEqual(
      expect.arrayContaining(["list-jurisdiction-bills", "list-session-bills"])
    )
    expect(report.passed.map((check) => check.id)).toContain("list-bills")
    expect(report.passed.map((check) => check.id)).toContain("list-supporting-materials")
    expect(report.passed.map((check) => check.id)).toContain("payload-too-large")
    expect(report.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["list-bill-documents", "get-document", "list-document-sections"])
    )
    expect(report.passed.map((check) => check.id)).toContain("get-supporting-material")
    expect(report.passed.map((check) => check.id)).toContain("get-document-section")
    expect(report.passed.map((check) => check.id)).toContain("get-supporting-material-section")
    expect(report.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining([
        "list-subscriptions",
        "get-subscription",
        "list-subscription-events",
        "list-subscription-deliveries",
        "list-webhooks",
        "get-webhook"
      ])
    )
    expect(report.passed.map((check) => check.id)).toContain("absent-list-votes")
    expect(report.passed.map((check) => check.id)).toContain("auth-rejection")

    const inProgressIds = new Set(
      SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "in-progress").map((entry) => entry.id)
    )
    expect(report.passed.filter((check) => inProgressIds.has(check.id))).toHaveLength(14)
    expect(
      report.skipped
        .filter((check) => inProgressIds.has(check.id))
        .map((check) => check.id)
        .sort()
    ).toEqual(["search-bills", "search-supporting-materials"])

    const revisionEtagMismatch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const response = await fetch(input, init)
      const pathname = new URL(input).pathname
      if (pathname !== "/api/subscriptions/subscription%3Afixture" && pathname !== "/api/webhooks/webhook%3Afixture") {
        return response
      }
      const headers = new Headers(response.headers)
      if (pathname.startsWith("/api/subscriptions/")) {
        headers.set("etag", "wrong-revision")
      } else {
        headers.delete("etag")
      }
      return new Response(await response.arrayBuffer(), {
        headers,
        status: response.status,
        statusText: response.statusText
      })
    }
    const etagReport = await runApiSmoke({
      baseUrl: `http://127.0.0.1:${address.port}`,
      fetchImpl: revisionEtagMismatch,
      fixtures: {
        subscriptionId: "subscription:fixture",
        webhookId: "webhook:fixture"
      },
      requireAuth: true,
      token: "smoke-token"
    })
    expect(etagReport.failed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["get-subscription", "get-webhook"])
    )

    const mismatchedDocumentIdentity = mutateJson(
      async (input, init) => await fetch(input, init),
      "/api/documents/document%3Afixture",
      (body) => {
        if (!isRecord(body) || !isRecord(body.data)) {
          return body
        }
        return {
          ...body,
          data: {
            ...body.data,
            canonicalUrl: "https://api.example.test/api/documents/document%3Aother",
            id: "document:other"
          }
        }
      }
    )
    const identityReport = await runApiSmoke({
      baseUrl: `http://127.0.0.1:${address.port}`,
      fetchImpl: mismatchedDocumentIdentity,
      fixtures: { documentId: "document:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })
    expect(identityReport.failed.map((check) => check.id)).toContain("get-document")
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

  it("rejects a 413 response that does not use the canonical payload-too-large category", async () => {
    const { fetchImpl } = fakeFetch()
    const malformed = mutateJson(fetchImpl, "/api/search/bills", (body) => {
      if (!isRecord(body) || !isRecord(body.error)) {
        return body
      }
      return { ...body, error: { ...body.error, category: "internal" } }
    })
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformed,
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("payload-too-large")
  })

  it("redacts bearer tokens echoed by a failing endpoint", async () => {
    const secret = "smoke-secret-must-not-appear"
    const leakingFetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      if (url.pathname !== "/api/__smoke_unknown__") {
        return await fakeFetch().fetchImpl(input, init)
      }
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing-correlation"
      return jsonResponse(
        { error: { category: "internal", correlationId, message: `echoed ${secret}`, retryable: false } },
        500,
        correlationId
      )
    }
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: leakingFetch,
      token: secret
    })

    expect(report.failed.find((check) => check.id === "unknown-route")?.detail).not.toContain(secret)
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

  it("fails when an intentionally absent endpoint becomes reachable", async () => {
    const { fetchImpl } = fakeFetch()
    const reachable = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      if (url.pathname !== "/api/votes") {
        return await fetchImpl(input, init)
      }
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing-correlation"
      return jsonResponse(
        { data: [], links: { next: null, self: `${url.pathname}${url.search}` }, meta: { correlationId } },
        200,
        correlationId
      )
    }
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: reachable,
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed.map((check) => check.id)).toContain("absent-list-votes")
  })
})
