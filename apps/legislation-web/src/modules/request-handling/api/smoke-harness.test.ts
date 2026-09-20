import { AuthenticationError } from "@repo/legislation-core/auth/workos"
import { afterEach, describe, expect, it } from "vitest"
import { close, createLegislationServer } from "../test-http-server"
import type { AmendmentSearchApi } from "./amendment-search"
import type { BillSummaryRead, SupportingMaterialDetailRead } from "./canonical-read"
import type { CivicSearchApi } from "./civic-search"
import type { CoreReadQueryApi } from "./core-read"
import type { DocumentReadApi } from "./document-read-routes"
import { createLegislationApiHandler } from "./handlers"
import type { PassageSearchApi } from "./passage-search"
import { runApiSmoke, SMOKE_MANIFEST } from "./smoke-harness"
import type { Delivery, Subscription, SubscriptionEvent, SubscriptionRepository, Webhook } from "./subscriptions"
import type { WebhookReadRepository } from "./webhook-read-repository"

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

function voteSummary(id = "vote:fixture"): Record<string, unknown> {
  return {
    ...canonical(id),
    billId: "bill:fixture",
    canonicalUrl: `https://legislation.example.test/api/votes/${encodeURIComponent(id)}`,
    classification: "passage",
    counts: { absent: 0, abstain: 0, no: 1, notVoting: 0, other: 0, paired: 0, present: 0, proxy: 0, yes: 2 },
    date: "2026-01-01",
    heldAt: "2026-01-01T12:00:00.000Z",
    motion: "Passage on the fixture bill",
    organizationId: "organization:fixture",
    question: null,
    result: "passed",
    type: "vote"
  }
}

function voteDetail(id = "vote:fixture"): Record<string, unknown> {
  return {
    ...voteSummary(id),
    positions: [votePosition(id)],
    positionsPageInfo: { limit: 25, nextCursor: null, truncated: false }
  }
}

function votePosition(voteId: string): Record<string, unknown> {
  const personId = "person:fixture"
  return {
    ...canonical("position:fixture"),
    canonicalUrl: `https://legislation.example.test/api/votes/${encodeURIComponent(voteId)}#position%3Afixture`,
    id: "position:fixture",
    option: "yes",
    person: {
      ...canonical(personId),
      canonicalUrl: `https://legislation.example.test/api/people/${encodeURIComponent(personId)}`,
      familyName: "Legislator",
      givenName: "Fixture",
      imageUrl: null,
      isActive: true,
      jurisdictionIds: ["jurisdiction:fixture"],
      name: "Fixture Legislator",
      party: null,
      type: "person"
    },
    sourceName: "Fixture Legislator",
    sourcePersonId: "fixture-person",
    type: "vote-position",
    voteId
  }
}

function changeEvent(id = "change:fixture"): Record<string, unknown> {
  return {
    ...canonical(id),
    after: { status: "introduced" },
    before: null,
    canonicalUrl: `https://legislation.example.test/api/changes/${encodeURIComponent(id)}`,
    changedFields: ["status"],
    classification: "create",
    jurisdictionId: "jurisdiction:fixture",
    observedAt: "2026-01-01T12:00:00.000Z",
    organizationId: null,
    personId: null,
    recordId: "vote:fixture",
    recordType: "vote",
    sourceUpdatedAt: null,
    type: "change"
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
    linksTruncated: false,
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
    if (url.pathname === "/api/votes" && init?.method !== "POST") {
      return jsonResponse(
        {
          data: [voteSummary()],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/votes/vote%3Afixture") {
      return jsonResponse(
        {
          data: voteDetail(),
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/votes/batch" && init?.method === "POST") {
      const parsed = typeof init.body === "string" ? JSON.parse(init.body) : undefined
      const ids = isRecord(parsed) && Array.isArray(parsed.ids) ? parsed.ids : []
      return jsonResponse(
        {
          data: ids.map((id) => ({ data: voteDetail(String(id)), id, status: "ok" })),
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId, requested: ids.length, returned: ids.length, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/changes" && init?.method !== "POST") {
      return jsonResponse(
        {
          data: [changeEvent()],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    if (url.pathname === "/api/changes/change%3Afixture") {
      return jsonResponse(
        {
          data: changeEvent(),
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId, warnings: [] }
        },
        200,
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
  it("keeps one release-state entry for every full-profile operation", () => {
    expect(SMOKE_MANIFEST).toHaveLength(23)
    expect(new Set(SMOKE_MANIFEST.map((entry) => entry.id)).size).toBe(SMOKE_MANIFEST.length)
    expect(SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "done")).toHaveLength(19)
    expect(SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "in-progress")).toHaveLength(2)
    expect(SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "blocked")).toHaveLength(2)
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

  it("runs only universal, vote, and change checks in the authenticated vote-change profile", async () => {
    const { calls, fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      fixtures: { changeId: "change:fixture", voteId: "vote:fixture" },
      profile: "vote-change",
      requireAuth: true,
      token: "do-not-log-this-token"
    })

    expect(report.status).toBe("passed")
    expect(report.passed.map((check) => check.id)).toEqual([
      "health",
      "ready",
      "unknown-route",
      "unsupported-method",
      "list-votes",
      "get-vote",
      "batch-votes",
      "list-changes",
      "get-change",
      "auth-rejection"
    ])
    expect(report.checks.some((check) => check.id === "search-bills")).toBe(false)
    expect(report.checks.some((check) => check.id === "absent-document-diff")).toBe(false)
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/votes", search: "?limit=1" }),
        expect.objectContaining({ method: "GET", path: "/api/votes/vote%3Afixture" }),
        expect.objectContaining({ method: "POST", path: "/api/votes/batch" }),
        expect.objectContaining({ method: "GET", path: "/api/changes", search: "?limit=1" }),
        expect.objectContaining({ method: "GET", path: "/api/changes/change%3Afixture" })
      ])
    )
    expect(calls.some((call) => call.path.startsWith("/api/search/") || call.path === "/api/document-diffs")).toBe(
      false
    )
  })

  it("blocks the vote-change profile without both fixture IDs while retaining universal checks", async () => {
    const { fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      fixtures: { voteId: "vote:fixture" },
      profile: "vote-change",
      requireAuth: true,
      token: "do-not-log-this-token"
    })

    expect(report.status).toBe("blocked")
    expect(report.blocked).toContainEqual(expect.objectContaining({ id: "vote-change-fixtures" }))
    expect(report.passed.map((check) => check.id)).toContain("health")
    expect(report.checks.some((check) => check.id === "list-votes")).toBe(false)
    expect(report.checks.some((check) => check.id === "list-changes")).toBe(false)
  })

  it.each([
    { requireAuth: false, token: "do-not-log-this-token" },
    { requireAuth: true, token: undefined }
  ])("requires authenticated mode and a token for the vote-change profile", async ({ requireAuth, token }) => {
    await expect(
      runApiSmoke({
        baseUrl: "http://localhost:3199",
        canonicalApiBaseUrl: "https://legislation.example.test",
        fetchImpl: fakeFetch().fetchImpl,
        fixtures: { changeId: "change:fixture", voteId: "vote:fixture" },
        profile: "vote-change",
        requireAuth,
        token
      })
    ).rejects.toThrow("vote-change smoke requires authenticated mode and an explicit token")
  })

  it("requires a canonical API base URL for the vote-change profile", async () => {
    await expect(
      runApiSmoke({
        baseUrl: "http://localhost:3199",
        fetchImpl: fakeFetch().fetchImpl,
        fixtures: { changeId: "change:fixture", voteId: "vote:fixture" },
        profile: "vote-change",
        requireAuth: true,
        token: "do-not-log-this-token"
      })
    ).rejects.toThrow("canonicalApiBaseUrl is required for the vote-change smoke profile")
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
    expect(report.blocked.some((check) => check.id === "list-bills")).toBe(true)
    expect(report.skipped.some((check) => check.id === "list-votes")).toBe(true)
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
    expect(report.skipped.some((check) => check.id === "list-votes")).toBe(true)
    expect(calls.some((call) => call.authorization === "Bearer do-not-log-this-token")).toBe(true)
    expect(JSON.stringify(report)).not.toContain("do-not-log-this-token")
  })

  it("requires a configured vote fixture to prove a nonempty canonical vote collection, detail, and batch", async () => {
    const { calls, fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl,
      fixtures: { voteId: "vote:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toEqual([])
    expect(report.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["list-votes", "get-vote", "batch-votes"])
    )
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/votes", search: "?limit=1" }),
        expect.objectContaining({ method: "GET", path: "/api/votes/vote%3Afixture" }),
        expect.objectContaining({ method: "POST", path: "/api/votes/batch" })
      ])
    )
  })

  it("rejects a vote batch whose nested detail does not match the item identity", async () => {
    const { fetchImpl } = fakeFetch()
    const malformedBatch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const response = await fetchImpl(input, init)
      if (new URL(input).pathname !== "/api/votes/batch") {
        return response
      }
      const body = (await response.json()) as Record<string, unknown>
      const data = Array.isArray(body.data) ? body.data : []
      return new Response(
        JSON.stringify({ ...body, data: data.map((item) => ({ ...item, data: voteDetail("vote:wrong") })) }),
        { headers: response.headers, status: response.status }
      )
    }

    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl: malformedBatch,
      fixtures: { voteId: "vote:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toContainEqual(expect.objectContaining({ id: "batch-votes", status: "failed" }))
  })

  it("rejects a vote detail position with an incomplete person summary", async () => {
    const { fetchImpl } = fakeFetch()
    const malformedDetail = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const response = await fetchImpl(input, init)
      if (new URL(input).pathname !== "/api/votes/vote%3Afixture") {
        return response
      }
      const body = (await response.json()) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          ...body,
          data: {
            ...voteDetail(),
            positions: [
              {
                ...votePosition("vote:fixture"),
                person: {
                  ...canonical("person:fixture"),
                  canonicalUrl: "https://legislation.example.test/api/people/person%3Afixture",
                  familyName: "Legislator",
                  givenName: "Fixture",
                  imageUrl: null,
                  jurisdictionIds: ["jurisdiction:fixture"],
                  name: "Fixture Legislator",
                  party: null,
                  type: "person"
                }
              }
            ]
          }
        }),
        { headers: response.headers, status: response.status }
      )
    }

    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformedDetail,
      fixtures: { voteId: "vote:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toContainEqual(expect.objectContaining({ id: "get-vote", status: "failed" }))
  })

  it("rejects a vote detail position that is bound to another vote", async () => {
    const { fetchImpl } = fakeFetch()
    const malformedDetail = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const response = await fetchImpl(input, init)
      if (new URL(input).pathname !== "/api/votes/vote%3Afixture") {
        return response
      }
      const body = (await response.json()) as Record<string, unknown>
      return new Response(
        JSON.stringify({ ...body, data: { ...voteDetail(), positions: [votePosition("vote:other")] } }),
        { headers: response.headers, status: response.status }
      )
    }

    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: malformedDetail,
      fixtures: { voteId: "vote:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toContainEqual(expect.objectContaining({ id: "get-vote", status: "failed" }))
  })

  it("requires a configured change fixture to prove a nonempty canonical change collection and detail", async () => {
    const { calls, fetchImpl } = fakeFetch()
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl,
      fixtures: { changeId: "change:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toEqual([])
    expect(report.passed.map((check) => check.id)).toEqual(expect.arrayContaining(["list-changes", "get-change"]))
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/changes", search: "?limit=1" }),
        expect.objectContaining({ method: "GET", path: "/api/changes/change%3Afixture" })
      ])
    )
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
    const service: CoreReadQueryApi & CivicSearchApi & AmendmentSearchApi & PassageSearchApi = {
      browseBills: async () => ({ items: [billSummaryRead("bill:fixture")], truncated: false, warnings: [] }),
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
      searchAmendmentHits: async () => ({
        items: [],
        search: { isReranked: false, models: [] },
        truncated: false,
        warnings: []
      }),
      searchBills: async () => ({ items: [], truncated: false, warnings: [] }),
      searchBillText: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
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
      })
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

    const universalSearch = await fetch(`http://127.0.0.1:${address.port}/api/search/all`, {
      body: JSON.stringify({ query: "fixture", recordTypes: ["bill"] }),
      headers: { authorization: "Bearer smoke-token", "content-type": "application/json" },
      method: "POST"
    })
    expect(universalSearch.status).toBe(200)
    const universalSearchBody: unknown = await universalSearch.json()
    if (!isRecord(universalSearchBody) || !isRecord(universalSearchBody.meta)) {
      throw new Error("Expected a universal search response")
    }
    expect(universalSearchBody.meta.groups).toEqual([{ nextCursor: null, recordType: "bill", returned: 0 }])

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
    expect(report.passed.map((check) => check.id)).toContain("auth-rejection")

    const inProgressIds = new Set(
      SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "in-progress").map((entry) => entry.id)
    )
    expect(report.passed.filter((check) => inProgressIds.has(check.id))).toHaveLength(0)
    expect(
      report.skipped
        .filter((check) => inProgressIds.has(check.id))
        .map((check) => check.id)
        .sort()
    ).toEqual(["search-bills", "search-supporting-materials"])

    const blockedIds = new Set(SMOKE_MANIFEST.filter((entry) => entry.lifecycle === "blocked").map((entry) => entry.id))
    expect(
      report.passed
        .filter((check) => blockedIds.has(check.id))
        .map((check) => check.id)
        .sort()
    ).toEqual(["get-document", "list-document-sections"])

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

  it("rejects a vote collection item that omits the documented vote fields", async () => {
    const { fetchImpl } = fakeFetch()
    const reachable = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      if (url.pathname !== "/api/votes") {
        return await fetchImpl(input, init)
      }
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing-correlation"
      return jsonResponse(
        {
          data: [canonical("vote:fixture")],
          links: { next: null, self: `${url.pathname}${url.search}` },
          meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    }
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl: reachable,
      fixtures: { voteId: "vote:fixture" },
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toContainEqual(expect.objectContaining({ id: "list-votes", status: "failed" }))
  })

  it("fails a no-fixture collection probe when canonical provenance is incomplete", async () => {
    const { fetchImpl } = fakeFetch()
    const incomplete = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      if (url.pathname !== "/api/organizations") {
        return await fetchImpl(input, init)
      }
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing-correlation"
      return jsonResponse(
        {
          error: {
            category: "unprocessable",
            correlationId,
            message: "Organization canonical provenance is incomplete",
            retryable: false
          }
        },
        422,
        correlationId
      )
    }
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      fetchImpl: incomplete,
      requireAuth: true,
      token: "smoke-token"
    })

    expect(report.failed).toContainEqual(
      expect.objectContaining({ id: "absent-list-organizations", status: "failed", statusCode: 422 })
    )
    expect(report.blocked.map((check) => check.id)).not.toContain("absent-list-organizations")
    expect(report.passed.map((check) => check.id)).not.toContain("absent-list-organizations")
  })

  it("runs the opt-in authenticated subscription lifecycle without exposing bearer or idempotency values", async () => {
    const token = "subscription-lifecycle-token-must-not-leak"
    const id = "subscription:lifecycle"
    const keys: string[] = []
    let createdName = ""
    let malformedCreateLocation = false
    let malformedPatch = false
    let revision = "revision:create"
    let status: "active" | "cancelled" = "active"
    const subscription = () => ({
      cancelledAt: status === "cancelled" ? "2026-08-26T00:00:00.000Z" : null,
      canonicalUrl: `https://legislation.example.test/api/subscriptions/${encodeURIComponent(id)}`,
      createdAt: "2026-08-26T00:00:00.000Z",
      delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
      eventTypes: ["query-match"],
      frequency: "immediate",
      id,
      name: createdName,
      owner: { organizationId: null, userId: "smoke-user" },
      revision,
      status,
      target: { request: { mode: "lexical", query: "smoke lifecycle" }, searchType: "bills", type: "query" },
      timezone: "Etc/UTC",
      updatedAt: "2026-08-26T00:00:00.000Z"
    })
    const response = (
      body: unknown,
      statusCode: number,
      correlationId: string,
      headers: Readonly<Record<string, string>> = {}
    ) =>
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "x-correlation-id": correlationId, ...headers },
        status: statusCode
      })
    const resource = (value: unknown, path: string, correlationId: string, statusCode = 200, location = path) =>
      response(
        { data: value, links: { self: path }, meta: { correlationId, warnings: [] } },
        statusCode,
        correlationId,
        { etag: revision, ...(statusCode === 201 ? { location } : {}) }
      )
    const page = (values: readonly unknown[], path: string, correlationId: string) =>
      response(
        {
          data: values,
          links: { next: null, self: path },
          meta: { correlationId, limit: 100, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      const headers = new Headers(init?.headers)
      const correlationId = headers.get("x-correlation-id") ?? "missing-correlation"
      expect(headers.get("authorization")).toBe(`Bearer ${token}`)
      const key = headers.get("idempotency-key")
      if (key !== null) {
        keys.push(key)
      }
      if (url.pathname === "/api/subscriptions" && init?.method === "GET") {
        return page(
          url.searchParams.has("targetType") ? [subscription()] : [],
          `${url.pathname}${url.search}`,
          correlationId
        )
      }
      if (url.pathname === "/api/subscriptions" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string }
        createdName = body.name
        return resource(
          subscription(),
          "/api/subscriptions",
          correlationId,
          201,
          malformedCreateLocation ? "/api/subscriptions/unexpected" : `/api/subscriptions/${encodeURIComponent(id)}`
        )
      }
      if (url.pathname === `/api/subscriptions/${encodeURIComponent(id)}` && init?.method === "GET") {
        return resource(subscription(), url.pathname, correlationId)
      }
      if (url.pathname === `/api/subscriptions/${encodeURIComponent(id)}` && init?.method === "PATCH") {
        if (headers.get("if-match") === "revision:create") {
          const body = JSON.parse(String(init.body)) as { name?: unknown }
          if (typeof body.name === "string" && body.name.endsWith("updated")) {
            if (malformedPatch) {
              return resource(subscription(), url.pathname, correlationId)
            }
            revision = "revision:updated"
            createdName = body.name
            return resource(subscription(), url.pathname, correlationId)
          }
          return response(
            {
              error: {
                category: "precondition_failed",
                correlationId,
                message: "stale revision",
                retryable: false
              }
            },
            412,
            correlationId
          )
        }
        throw new Error("Unexpected subscription revision")
      }
      if (url.pathname === `/api/subscriptions/${encodeURIComponent(id)}/events`) {
        return page([], `${url.pathname}${url.search}`, correlationId)
      }
      if (url.pathname === `/api/subscriptions/${encodeURIComponent(id)}/deliveries`) {
        return page([], `${url.pathname}${url.search}`, correlationId)
      }
      if (url.pathname === `/api/subscriptions/${encodeURIComponent(id)}` && init?.method === "DELETE") {
        status = "cancelled"
        revision = "revision:cancelled"
        return resource(
          { cancelledAt: "2026-08-26T00:00:00.000Z", finalRevision: revision, id },
          url.pathname,
          correlationId
        )
      }
      throw new Error(`Unexpected lifecycle request ${init?.method ?? "GET"} ${url.pathname}`)
    }

    const report = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "subscription-lifecycle",
      requireAuth: true,
      token
    })

    expect(report.status).toBe("passed")
    expect(report.passed.map((check) => check.id)).toEqual([
      "subscription-lifecycle-list",
      "subscription-lifecycle-create",
      "subscription-lifecycle-create-replay",
      "subscription-lifecycle-filtered-list",
      "subscription-lifecycle-detail",
      "subscription-lifecycle-patch",
      "subscription-lifecycle-stale-revision",
      "subscription-lifecycle-events",
      "subscription-lifecycle-deliveries",
      "subscription-lifecycle-delete",
      "subscription-lifecycle-delete-replay",
      "subscription-lifecycle-cancelled-visibility"
    ])
    expect(keys).toHaveLength(6)
    expect(new Set(keys)).toHaveLength(4)
    expect(JSON.stringify(report)).not.toContain(token)
    for (const key of keys) {
      expect(JSON.stringify(report)).not.toContain(key)
    }

    keys.length = 0
    createdName = ""
    malformedPatch = true
    revision = "revision:create"
    status = "active"
    const failedReport = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "subscription-lifecycle",
      requireAuth: true,
      token
    })

    expect(failedReport.status).toBe("failed")
    expect(failedReport.failed.map((check) => check.id)).toContain("subscription-lifecycle-patch")
    expect(failedReport.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["subscription-lifecycle-cleanup-read", "subscription-lifecycle-cleanup"])
    )
    expect(status).toBe("cancelled")
    expect(keys).toHaveLength(4)

    keys.length = 0
    createdName = ""
    malformedCreateLocation = true
    malformedPatch = false
    revision = "revision:create"
    status = "active"
    const malformedCreateReport = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "subscription-lifecycle",
      requireAuth: true,
      token
    })

    expect(malformedCreateReport.status).toBe("failed")
    expect(malformedCreateReport.failed.map((check) => check.id)).toContain("subscription-lifecycle-create")
    expect(malformedCreateReport.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["subscription-lifecycle-cleanup-read", "subscription-lifecycle-cleanup"])
    )
    expect(status).toBe("cancelled")
    expect(keys).toHaveLength(2)
  })

  it("runs the opt-in authenticated webhook lifecycle without exposing response identifiers or secrets", async () => {
    const token = "webhook-lifecycle-token-must-not-leak"
    const id = "webhook:lifecycle"
    const createSecret = "a".repeat(43)
    const rotatedSecret = "b".repeat(43)
    const createKeyId = "webhook-key:create"
    const rotatedKeyId = "webhook-key:rotated"
    const idempotencyKeys: string[] = []
    const requestErrors: string[] = []
    let ambiguousCreateFailure = false
    let createResponseDropped = false
    let deleteRequests = 0
    let malformedCreateSecret = false
    let mismatchedCleanupIdentity = false
    let name = ""
    let revision = "revision:create"
    let status: "pending-verification" | "cancelled" = "pending-verification"
    const webhook = () => ({
      activeKeyIds: [revision === "revision:rotated" || revision === "revision:cancelled" ? rotatedKeyId : createKeyId],
      cancelledAt: status === "cancelled" ? "2026-08-26T00:00:00.000Z" : null,
      canonicalUrl: `https://legislation.example.test/api/webhooks/${encodeURIComponent(id)}`,
      createdAt: "2026-08-26T00:00:00.000Z",
      eventTypes: ["query-match"],
      id,
      lastFailedAt: null,
      lastSucceededAt: null,
      name,
      overlapEndsAt: null,
      owner: { organizationId: null, userId: "smoke-user" },
      revision,
      secretLastFour: "aaaa",
      status,
      updatedAt: "2026-08-26T00:00:00.000Z",
      url: "https://legislation.example.test/health"
    })
    const response = (
      body: unknown,
      statusCode: number,
      correlationId: string,
      headers: Readonly<Record<string, string>> = {}
    ) =>
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "x-correlation-id": correlationId, ...headers },
        status: statusCode
      })
    const resource = (value: unknown, path: string, correlationId: string, statusCode = 200, location = path) =>
      response(
        { data: value, links: { self: path }, meta: { correlationId, warnings: [] } },
        statusCode,
        correlationId,
        { etag: revision, ...(statusCode === 201 ? { location } : {}) }
      )
    const page = (values: readonly unknown[], path: string, correlationId: string) =>
      response(
        {
          data: values,
          links: { next: null, self: path },
          meta: { correlationId, limit: 100, nextCursor: null, truncated: false, warnings: [] }
        },
        200,
        correlationId
      )
    const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      const headers = new Headers(init?.headers)
      const correlationId = headers.get("x-correlation-id") ?? "missing-correlation"
      if (headers.get("authorization") !== `Bearer ${token}`) {
        requestErrors.push("missing bearer authorization")
      }
      const idempotencyKey = headers.get("idempotency-key")
      if (idempotencyKey !== null) {
        idempotencyKeys.push(idempotencyKey)
      }
      const detailPath = `/api/webhooks/${encodeURIComponent(id)}`
      if (url.pathname === "/api/webhooks" && init?.method === "GET") {
        return page(url.searchParams.has("status") ? [webhook()] : [], `${url.pathname}${url.search}`, correlationId)
      }
      if (url.pathname === "/api/webhooks" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string; url: string }
        if (body.url !== "https://legislation.example.test/health") {
          requestErrors.push("create did not use canonical health target")
        }
        name = body.name
        if (ambiguousCreateFailure && !createResponseDropped) {
          createResponseDropped = true
          throw new Error("response was lost after creation")
        }
        return resource(
          { keyId: createKeyId, secret: malformedCreateSecret ? "invalid" : createSecret, webhook: webhook() },
          "/api/webhooks",
          correlationId,
          201,
          detailPath
        )
      }
      if (url.pathname === detailPath && init?.method === "GET") {
        if (mismatchedCleanupIdentity) {
          return resource(
            {
              ...webhook(),
              canonicalUrl: "https://legislation.example.test/api/webhooks/webhook%3Aother",
              id: "webhook:other"
            },
            detailPath,
            correlationId
          )
        }
        return resource(webhook(), detailPath, correlationId)
      }
      if (url.pathname === detailPath && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { name?: string; status?: string }
        if (body.status === "paused") {
          return response(
            { error: { category: "precondition_failed", correlationId, message: "stale revision", retryable: false } },
            412,
            correlationId
          )
        }
        if (headers.get("if-match") !== "revision:create") {
          requestErrors.push("patch did not use create revision")
        }
        name = body.name ?? name
        revision = "revision:patched"
        return resource(webhook(), detailPath, correlationId)
      }
      if (url.pathname === `${detailPath}/rotate-secret` && init?.method === "POST") {
        if (headers.get("if-match") !== "revision:patched") {
          requestErrors.push("rotate did not use patched revision")
        }
        if (JSON.stringify(JSON.parse(String(init.body))) !== JSON.stringify({ overlapSeconds: 0 })) {
          requestErrors.push("rotate did not use zero overlap")
        }
        revision = "revision:rotated"
        return resource(
          { keyId: rotatedKeyId, secret: rotatedSecret, webhook: webhook() },
          `${detailPath}/rotate-secret`,
          correlationId
        )
      }
      if (url.pathname === detailPath && init?.method === "DELETE") {
        deleteRequests += 1
        if (!["revision:rotated", "revision:cancelled", "revision:create"].includes(headers.get("if-match") ?? "")) {
          requestErrors.push("delete did not use an available revision")
        }
        status = "cancelled"
        revision = "revision:cancelled"
        return resource(
          { cancelledAt: "2026-08-26T00:00:00.000Z", finalRevision: revision, id },
          detailPath,
          correlationId
        )
      }
      throw new Error(`Unexpected webhook lifecycle request ${init?.method ?? "GET"} ${url.pathname}`)
    }

    const report = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "webhook-lifecycle",
      requireAuth: true,
      token
    })

    expect(report.status).toBe("passed")
    expect(requestErrors).toEqual([])
    expect(report.passed.map((check) => check.id)).toEqual([
      "webhook-lifecycle-list",
      "webhook-lifecycle-create",
      "webhook-lifecycle-create-replay",
      "webhook-lifecycle-pending-list",
      "webhook-lifecycle-detail",
      "webhook-lifecycle-patch",
      "webhook-lifecycle-patch-replay",
      "webhook-lifecycle-stale-revision",
      "webhook-lifecycle-rotate-secret",
      "webhook-lifecycle-rotate-secret-replay",
      "webhook-lifecycle-post-rotate-detail",
      "webhook-lifecycle-delete",
      "webhook-lifecycle-delete-replay",
      "webhook-lifecycle-cancelled-visibility"
    ])
    expect(status).toBe("cancelled")
    const serialized = JSON.stringify(report)
    for (const value of [token, id, createSecret, rotatedSecret, createKeyId, rotatedKeyId, ...idempotencyKeys]) {
      expect(serialized).not.toContain(value)
    }

    name = ""
    revision = "revision:create"
    status = "pending-verification"
    const malformedCreateLocation = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const original = await fetchImpl(input, init)
      if (new URL(input).pathname !== "/api/webhooks" || init?.method !== "POST") {
        return original
      }
      const headers = new Headers(original.headers)
      headers.set("location", "/api/webhooks/unexpected")
      return new Response(await original.arrayBuffer(), { headers, status: original.status })
    }
    const malformedCreateReport = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl: malformedCreateLocation,
      profile: "webhook-lifecycle",
      requireAuth: true,
      token
    })
    expect(malformedCreateReport.failed.map((check) => check.id)).toContain("webhook-lifecycle-create")
    expect(malformedCreateReport.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["webhook-lifecycle-cleanup-read", "webhook-lifecycle-cleanup"])
    )
    expect(status).toBe("cancelled")

    name = ""
    revision = "revision:create"
    status = "pending-verification"
    malformedCreateSecret = true
    const malformedSecretReport = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "webhook-lifecycle",
      requireAuth: true,
      token
    })
    expect(malformedSecretReport.failed.map((check) => check.id)).toContain("webhook-lifecycle-create")
    expect(malformedSecretReport.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["webhook-lifecycle-cleanup-read", "webhook-lifecycle-cleanup"])
    )
    expect(status).toBe("cancelled")
    malformedCreateSecret = false

    name = ""
    revision = "revision:create"
    status = "pending-verification"
    ambiguousCreateFailure = true
    createResponseDropped = false
    const ambiguousCreateReport = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "webhook-lifecycle",
      requireAuth: true,
      token
    })
    expect(ambiguousCreateReport.failed.map((check) => check.id)).toContain("webhook-lifecycle-create")
    expect(ambiguousCreateReport.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining([
        "webhook-lifecycle-create-recovery-replay",
        "webhook-lifecycle-cleanup-read",
        "webhook-lifecycle-cleanup"
      ])
    )
    expect(status).toBe("cancelled")
    ambiguousCreateFailure = false

    name = ""
    revision = "revision:create"
    status = "pending-verification"
    malformedCreateSecret = true
    mismatchedCleanupIdentity = true
    deleteRequests = 0
    const mismatchedCleanupReport = await runApiSmoke({
      baseUrl: "https://legislation.example.test",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      profile: "webhook-lifecycle",
      requireAuth: true,
      token
    })
    expect(mismatchedCleanupReport.blocked.map((check) => check.id)).toContain("webhook-lifecycle-cleanup")
    expect(deleteRequests).toBe(0)
    expect(status).toBe("pending-verification")
  })

  it("blocks webhook lifecycle smoke unless its canonical origin is public HTTPS", async () => {
    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "http://localhost:3199",
      fetchImpl: async () => {
        throw new Error("fetch must not run")
      },
      profile: "webhook-lifecycle",
      requireAuth: true,
      token: "webhook-lifecycle-token"
    })

    expect(report.status).toBe("blocked")
    expect(report.blocked).toEqual([expect.objectContaining({ id: "webhook-lifecycle-target", status: "blocked" })])
  })

  it("requires an explicit authenticated opt-in before a subscription lifecycle smoke can mutate", async () => {
    await expect(
      runApiSmoke({
        baseUrl: "https://legislation.example.test",
        canonicalApiBaseUrl: "https://legislation.example.test",
        fetchImpl: async () => {
          throw new Error("fetch must not run")
        },
        profile: "subscription-lifecycle"
      })
    ).rejects.toThrow("subscription-lifecycle smoke requires authenticated mode and an explicit token")
  })
})
