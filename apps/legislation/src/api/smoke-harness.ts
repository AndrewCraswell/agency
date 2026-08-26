import { randomUUID } from "node:crypto"
import { isIsoDate, isRfc3339Timestamp } from "./canonical-projection.js"

export type SmokeCheckStatus = "blocked" | "failed" | "passed" | "skipped"
export type SmokeProfile = "full" | "scoped-bills" | "vote-change" | "subscription-lifecycle" | "webhook-lifecycle"

export type SmokeFixture = Readonly<{
  amendmentId?: string
  billId?: string
  billSearchQuery?: string
  changeId?: string
  documentId?: string
  documentIdB?: string
  documentSectionId?: string
  jurisdictionId?: string
  materialId?: string
  materialSectionId?: string
  materialSearchQuery?: string
  meetingId?: string
  organizationId?: string
  personId?: string
  sessionId?: string
  subscriptionId?: string
  voteId?: string
  webhookId?: string
}>

export type SmokeCheck = Readonly<{
  detail?: string
  id: string
  method?: string
  path?: string
  status: SmokeCheckStatus
  statusCode?: number
}>

export type SmokeReport = Readonly<{
  blocked: readonly SmokeCheck[]
  checks: readonly SmokeCheck[]
  failed: readonly SmokeCheck[]
  passed: readonly SmokeCheck[]
  skipped: readonly SmokeCheck[]
  status: "blocked" | "failed" | "passed"
}>

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type CheckDefinition = Readonly<{
  body?: unknown
  errorCategory?: string
  expected:
    | "batch"
    | "bill-page"
    | "calculation"
    | "change-page"
    | "change-resource"
    | "delivery-page"
    | "document-page"
    | "document-resource"
    | "document-section-resource"
    | "document-section-page"
    | "error"
    | "health"
    | "material-page"
    | "material-resource"
    | "material-section-resource"
    | "page"
    | "resource"
    | "search"
    | "subscription-event-page"
    | "subscription-page"
    | "subscription-resource"
    | "vote-batch"
    | "vote-page"
    | "vote-resource"
    | "webhook-page"
    | "webhook-resource"
  healthStatus?: "ok" | "ready"
  id: string
  method?: "GET" | "POST"
  path: string
  protected?: boolean
  requireNonEmptySearch?: boolean
  expectedId?: string
  expectedParent?: Readonly<{
    field: "billId" | "documentId" | "materialId" | "subscriptionId"
    id: string
  }>
  allowNotFound?: boolean
  requiresAuthHeader?: boolean
  requiresRevisionEtag?: boolean
  statusCode?: number
}>

export type SmokeManifestEntry = Readonly<{
  expected: CheckDefinition["expected"]
  fixture?: keyof SmokeFixture
  fixtures?: readonly (keyof SmokeFixture)[]
  id: string
  lifecycle: "blocked" | "done" | "in-progress"
  method: "GET" | "POST"
  path: string
}>

/**
 * The endpoint inventory covered by the full smoke profile. Lifecycle mirrors
 * the authoritative deployed endpoint ledger; a blocked entry can still pass
 * against a complete local fixture. Fixture-backed entries are represented
 * here even when their checks are skipped, so a report can distinguish missing
 * evidence from an endpoint that is absent or unavailable in the target
 * deployment.
 */
export const SMOKE_MANIFEST: readonly SmokeManifestEntry[] = [
  { expected: "bill-page", id: "list-bills", lifecycle: "done", method: "GET", path: "/api/bills" },
  {
    expected: "bill-page",
    fixtures: ["jurisdictionId"],
    id: "list-jurisdiction-bills",
    lifecycle: "done",
    method: "GET",
    path: "/api/jurisdictions/{jurisdictionId}/bills"
  },
  {
    expected: "bill-page",
    fixtures: ["sessionId"],
    id: "list-session-bills",
    lifecycle: "done",
    method: "GET",
    path: "/api/sessions/{sessionId}/bills"
  },
  {
    expected: "document-page",
    fixture: "billId",
    id: "list-bill-documents",
    lifecycle: "done",
    method: "GET",
    path: "/api/bills/{billId}/documents"
  },
  {
    expected: "document-resource",
    fixture: "documentId",
    id: "get-document",
    lifecycle: "blocked",
    method: "GET",
    path: "/api/documents/{documentId}"
  },
  {
    expected: "document-section-page",
    fixture: "documentId",
    id: "list-document-sections",
    lifecycle: "blocked",
    method: "GET",
    path: "/api/documents/{documentId}/sections"
  },
  {
    expected: "document-section-resource",
    fixtures: ["documentId", "documentSectionId"],
    id: "get-document-section",
    lifecycle: "done",
    method: "GET",
    path: "/api/documents/{documentId}/sections/{sectionId}"
  },
  {
    expected: "material-page",
    id: "list-supporting-materials",
    lifecycle: "done",
    method: "GET",
    path: "/api/supporting-materials"
  },
  {
    expected: "material-resource",
    fixture: "materialId",
    id: "get-supporting-material",
    lifecycle: "done",
    method: "GET",
    path: "/api/supporting-materials/{materialId}"
  },
  {
    expected: "material-section-resource",
    fixtures: ["materialId", "materialSectionId"],
    id: "get-supporting-material-section",
    lifecycle: "done",
    method: "GET",
    path: "/api/supporting-materials/{materialId}/sections/{sectionId}"
  },
  {
    expected: "search",
    fixture: "billSearchQuery",
    id: "search-bills",
    lifecycle: "in-progress",
    method: "POST",
    path: "/api/search/bills"
  },
  {
    expected: "search",
    fixture: "materialSearchQuery",
    id: "search-supporting-materials",
    lifecycle: "in-progress",
    method: "POST",
    path: "/api/search/supporting-materials"
  },
  {
    expected: "subscription-page",
    id: "list-subscriptions",
    lifecycle: "done",
    method: "GET",
    path: "/api/subscriptions"
  },
  {
    expected: "subscription-resource",
    fixture: "subscriptionId",
    id: "get-subscription",
    lifecycle: "done",
    method: "GET",
    path: "/api/subscriptions/{subscriptionId}"
  },
  {
    expected: "subscription-event-page",
    fixture: "subscriptionId",
    id: "list-subscription-events",
    lifecycle: "done",
    method: "GET",
    path: "/api/subscriptions/{subscriptionId}/events"
  },
  {
    expected: "delivery-page",
    fixture: "subscriptionId",
    id: "list-subscription-deliveries",
    lifecycle: "done",
    method: "GET",
    path: "/api/subscriptions/{subscriptionId}/deliveries"
  },
  {
    expected: "webhook-page",
    id: "list-webhooks",
    lifecycle: "done",
    method: "GET",
    path: "/api/webhooks"
  },
  {
    expected: "webhook-resource",
    fixture: "webhookId",
    id: "get-webhook",
    lifecycle: "done",
    method: "GET",
    path: "/api/webhooks/{webhookId}"
  },
  {
    expected: "vote-page",
    fixture: "voteId",
    id: "list-votes",
    lifecycle: "done",
    method: "GET",
    path: "/api/votes"
  },
  {
    expected: "vote-resource",
    fixture: "voteId",
    id: "get-vote",
    lifecycle: "done",
    method: "GET",
    path: "/api/votes/{voteId}"
  },
  {
    expected: "vote-batch",
    fixture: "voteId",
    id: "batch-votes",
    lifecycle: "done",
    method: "POST",
    path: "/api/votes/batch"
  },
  {
    expected: "change-page",
    fixture: "changeId",
    id: "list-changes",
    lifecycle: "done",
    method: "GET",
    path: "/api/changes"
  },
  {
    expected: "change-resource",
    fixture: "changeId",
    id: "get-change",
    lifecycle: "done",
    method: "GET",
    path: "/api/changes/{changeId}"
  }
]

const ALWAYS_CHECKS: readonly CheckDefinition[] = [
  { expected: "health", healthStatus: "ok", id: "health", path: "/health", protected: false },
  { expected: "health", healthStatus: "ready", id: "ready", path: "/ready", protected: false },
  {
    errorCategory: "not_found",
    expected: "error",
    id: "unknown-route",
    path: "/api/__smoke_unknown__",
    statusCode: 404
  },
  {
    errorCategory: "not_found",
    expected: "error",
    id: "unsupported-method",
    method: "POST",
    path: "/api/bills",
    statusCode: 404
  }
]

const REGISTERED_EXACT_CHECKS: readonly CheckDefinition[] = [
  { expected: "bill-page", id: "list-bills", path: "/api/bills?sort=introduced-desc&limit=1" },
  { expected: "material-page", id: "list-supporting-materials", path: "/api/supporting-materials?limit=1" },
  { expected: "subscription-page", id: "list-subscriptions", path: "/api/subscriptions?limit=1" },
  { expected: "webhook-page", id: "list-webhooks", path: "/api/webhooks?limit=1" }
]

const PAYLOAD_TOO_LARGE_CHECK: CheckDefinition = {
  body: { limit: 1, mode: "lexical", query: "x".repeat(1_048_577) },
  errorCategory: "payload_too_large",
  expected: "error",
  id: "payload-too-large",
  method: "POST",
  path: "/api/search/bills",
  statusCode: 413
}

const BLOCKED_ABSENCE_CHECKS: readonly CheckDefinition[] = [
  {
    allowNotFound: true,
    expected: "page",
    id: "absent-list-jurisdictions",
    path: "/api/jurisdictions?limit=1"
  },
  {
    allowNotFound: true,
    expected: "page",
    id: "absent-list-amendments",
    path: "/api/amendments?limit=1"
  },
  {
    allowNotFound: true,
    expected: "page",
    id: "absent-list-people",
    path: "/api/people?limit=1"
  },
  {
    allowNotFound: true,
    expected: "page",
    id: "absent-list-organizations",
    path: "/api/organizations?limit=1"
  },
  {
    allowNotFound: true,
    expected: "page",
    id: "absent-list-meetings",
    path: "/api/meetings?limit=1"
  },
  {
    body: { limit: 1, mode: "lexical", query: "legislation" },
    expected: "search",
    id: "search-amendments",
    method: "POST",
    path: "/api/search/amendments",
    statusCode: 200
  },
  {
    body: { limit: 1, mode: "lexical", query: "legislation" },
    expected: "search",
    id: "search-passages",
    method: "POST",
    path: "/api/search/passages",
    statusCode: 200
  },
  {
    body: {
      billId: "bill:__smoke_absent__",
      leftDocumentId: "document:__smoke_absent__:left",
      rightDocumentId: "document:__smoke_absent__:right"
    },
    errorCategory: "not_found",
    expected: "error",
    id: "absent-document-diff",
    method: "POST",
    path: "/api/document-diffs",
    statusCode: 404
  }
]

function encoded(id: string): string {
  return encodeURIComponent(id)
}

function fixtureChecks(fixture: SmokeFixture): readonly CheckDefinition[] {
  const checks = [...scopedBillChecks(fixture)]
  if (fixture.billId !== undefined) {
    checks.push({
      expected: "document-page",
      expectedParent: { field: "billId", id: fixture.billId },
      id: "list-bill-documents",
      path: `/api/bills/${encoded(fixture.billId)}/documents?limit=1`
    })
  }
  if (fixture.documentId !== undefined) {
    checks.push({
      expected: "document-resource",
      expectedId: fixture.documentId,
      id: "get-document",
      path: `/api/documents/${encoded(fixture.documentId)}`
    })
    checks.push({
      expected: "document-section-page",
      expectedParent: { field: "documentId", id: fixture.documentId },
      id: "list-document-sections",
      path: `/api/documents/${encoded(fixture.documentId)}/sections?limit=1`
    })
  }
  if (fixture.materialId !== undefined) {
    checks.push({
      expected: "material-resource",
      expectedId: fixture.materialId,
      id: "get-supporting-material",
      path: `/api/supporting-materials/${encoded(fixture.materialId)}`
    })
  }
  if (fixture.documentId !== undefined && fixture.documentSectionId !== undefined) {
    checks.push({
      expected: "document-section-resource",
      expectedId: fixture.documentSectionId,
      expectedParent: { field: "documentId", id: fixture.documentId },
      id: "get-document-section",
      path: `/api/documents/${encoded(fixture.documentId)}/sections/${encoded(fixture.documentSectionId)}`
    })
  }
  if (fixture.materialId !== undefined && fixture.materialSectionId !== undefined) {
    checks.push({
      expected: "material-section-resource",
      expectedId: fixture.materialSectionId,
      expectedParent: { field: "materialId", id: fixture.materialId },
      id: "get-supporting-material-section",
      path: `/api/supporting-materials/${encoded(fixture.materialId)}/sections/${encoded(fixture.materialSectionId)}`
    })
  }
  if (fixture.billSearchQuery !== undefined) {
    checks.push({
      body: { limit: 1, mode: "lexical", query: fixture.billSearchQuery },
      expected: "search",
      id: "search-bills",
      method: "POST",
      path: "/api/search/bills",
      requireNonEmptySearch: true
    })
  }
  if (fixture.materialSearchQuery !== undefined) {
    checks.push({
      body: { limit: 1, mode: "lexical", query: fixture.materialSearchQuery },
      expected: "search",
      id: "search-supporting-materials",
      method: "POST",
      path: "/api/search/supporting-materials",
      requireNonEmptySearch: true
    })
  }
  if (fixture.subscriptionId !== undefined) {
    checks.push({
      expected: "subscription-resource",
      expectedId: fixture.subscriptionId,
      id: "get-subscription",
      path: `/api/subscriptions/${encoded(fixture.subscriptionId)}`,
      requiresRevisionEtag: true
    })
    checks.push({
      expected: "subscription-event-page",
      expectedParent: { field: "subscriptionId", id: fixture.subscriptionId },
      id: "list-subscription-events",
      path: `/api/subscriptions/${encoded(fixture.subscriptionId)}/events?limit=1`
    })
    checks.push({
      expected: "delivery-page",
      expectedParent: { field: "subscriptionId", id: fixture.subscriptionId },
      id: "list-subscription-deliveries",
      path: `/api/subscriptions/${encoded(fixture.subscriptionId)}/deliveries?limit=1`
    })
  }
  if (fixture.webhookId !== undefined) {
    checks.push({
      expected: "webhook-resource",
      expectedId: fixture.webhookId,
      id: "get-webhook",
      path: `/api/webhooks/${encoded(fixture.webhookId)}`,
      requiresRevisionEtag: true
    })
  }
  if (fixture.voteId !== undefined) {
    checks.push(...voteChecks(fixture.voteId))
  }
  if (fixture.changeId !== undefined) {
    checks.push(...changeChecks(fixture.changeId))
  }
  return checks
}

function voteChecks(voteId: string): readonly CheckDefinition[] {
  return [
    {
      expected: "vote-page",
      id: "list-votes",
      path: "/api/votes?limit=1"
    },
    {
      expected: "vote-resource",
      expectedId: voteId,
      id: "get-vote",
      path: `/api/votes/${encoded(voteId)}`
    },
    {
      body: { ids: [voteId] },
      expected: "vote-batch",
      expectedId: voteId,
      id: "batch-votes",
      method: "POST",
      path: "/api/votes/batch"
    }
  ]
}

function changeChecks(changeId: string): readonly CheckDefinition[] {
  return [
    {
      expected: "change-page",
      id: "list-changes",
      path: "/api/changes?limit=1"
    },
    {
      expected: "change-resource",
      expectedId: changeId,
      id: "get-change",
      path: `/api/changes/${encoded(changeId)}`
    }
  ]
}

function voteChangeChecks(fixture: SmokeFixture): readonly CheckDefinition[] {
  if (fixture.voteId === undefined || fixture.changeId === undefined) {
    return []
  }
  return [...voteChecks(fixture.voteId), ...changeChecks(fixture.changeId)]
}

function scopedBillChecks(fixture: SmokeFixture): readonly CheckDefinition[] {
  const checks: CheckDefinition[] = []
  if (fixture.jurisdictionId !== undefined) {
    checks.push({
      expected: "bill-page",
      id: "list-jurisdiction-bills",
      path: `/api/jurisdictions/${encoded(fixture.jurisdictionId)}/bills?sort=introduced-desc&limit=1`
    })
  }
  if (fixture.sessionId !== undefined) {
    checks.push({
      expected: "bill-page",
      id: "list-session-bills",
      path: `/api/sessions/${encoded(fixture.sessionId)}/bills?sort=introduced-desc&limit=1`
    })
  }
  return checks
}

function missingFixtureChecks(fixture: SmokeFixture, present: ReadonlySet<string>): readonly SmokeCheck[] {
  const skipped: SmokeCheck[] = []
  if (!present.has("list-jurisdiction-bills") && fixture.jurisdictionId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "bill-page", id: "list-jurisdiction-bills", path: "/api/jurisdictions/{jurisdictionId}/bills" },
        "skipped: provide LEGISLATION_SMOKE_JURISDICTION_ID to exercise this exact bill page"
      )
    )
  }
  if (!present.has("list-session-bills") && fixture.sessionId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "bill-page", id: "list-session-bills", path: "/api/sessions/{sessionId}/bills" },
        "skipped: provide LEGISLATION_SMOKE_SESSION_ID to exercise this exact bill page"
      )
    )
  }
  if (fixture.materialId === undefined) {
    skipped.push(
      skippedCheck(
        {
          expected: "material-resource",
          id: "get-supporting-material",
          path: "/api/supporting-materials/{materialId}"
        },
        "skipped: provide LEGISLATION_SMOKE_MATERIAL_ID to exercise this exact route"
      )
    )
  }
  if (fixture.documentId === undefined || fixture.documentSectionId === undefined) {
    skipped.push(
      skippedCheck(
        {
          expected: "document-section-resource",
          id: "get-document-section",
          path: "/api/documents/{documentId}/sections/{sectionId}"
        },
        "skipped: provide LEGISLATION_SMOKE_DOCUMENT_ID and LEGISLATION_SMOKE_DOCUMENT_SECTION_ID to exercise this exact route"
      )
    )
  }
  if (fixture.materialId === undefined || fixture.materialSectionId === undefined) {
    skipped.push(
      skippedCheck(
        {
          expected: "material-section-resource",
          id: "get-supporting-material-section",
          path: "/api/supporting-materials/{materialId}/sections/{sectionId}"
        },
        "skipped: provide LEGISLATION_SMOKE_MATERIAL_ID and LEGISLATION_SMOKE_MATERIAL_SECTION_ID to exercise this exact route"
      )
    )
  }
  if (fixture.billId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "document-page", id: "list-bill-documents", path: "/api/bills/{billId}/documents" },
        "skipped: provide LEGISLATION_SMOKE_BILL_ID to exercise bill document listing"
      )
    )
  }
  if (fixture.documentId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "document-resource", id: "get-document", path: "/api/documents/{documentId}" },
        "skipped: provide LEGISLATION_SMOKE_DOCUMENT_ID to exercise document detail"
      )
    )
    skipped.push(
      skippedCheck(
        {
          expected: "document-section-page",
          id: "list-document-sections",
          path: "/api/documents/{documentId}/sections"
        },
        "skipped: provide LEGISLATION_SMOKE_DOCUMENT_ID to exercise document section listing"
      )
    )
  }
  if (fixture.subscriptionId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "subscription-resource", id: "get-subscription", path: "/api/subscriptions/{subscriptionId}" },
        "skipped: provide LEGISLATION_SMOKE_SUBSCRIPTION_ID to exercise subscription detail"
      )
    )
    skipped.push(
      skippedCheck(
        {
          expected: "subscription-event-page",
          id: "list-subscription-events",
          path: "/api/subscriptions/{subscriptionId}/events"
        },
        "skipped: provide LEGISLATION_SMOKE_SUBSCRIPTION_ID to exercise subscription events"
      )
    )
    skipped.push(
      skippedCheck(
        {
          expected: "delivery-page",
          id: "list-subscription-deliveries",
          path: "/api/subscriptions/{subscriptionId}/deliveries"
        },
        "skipped: provide LEGISLATION_SMOKE_SUBSCRIPTION_ID to exercise subscription deliveries"
      )
    )
  }
  if (fixture.webhookId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "webhook-resource", id: "get-webhook", path: "/api/webhooks/{webhookId}" },
        "skipped: provide LEGISLATION_SMOKE_WEBHOOK_ID to exercise webhook detail"
      )
    )
  }
  if (fixture.voteId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "vote-page", id: "list-votes", path: "/api/votes?limit=1" },
        "skipped: provide LEGISLATION_SMOKE_VOTE_ID to exercise the nonempty canonical vote collection"
      )
    )
    skipped.push(
      skippedCheck(
        { expected: "vote-resource", id: "get-vote", path: "/api/votes/{voteId}" },
        "skipped: provide LEGISLATION_SMOKE_VOTE_ID to exercise vote detail"
      )
    )
    skipped.push(
      skippedCheck(
        { expected: "vote-batch", id: "batch-votes", method: "POST", path: "/api/votes/batch" },
        "skipped: provide LEGISLATION_SMOKE_VOTE_ID to exercise the vote batch"
      )
    )
  }
  if (fixture.changeId === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "change-page", id: "list-changes", path: "/api/changes?limit=1" },
        "skipped: provide LEGISLATION_SMOKE_CHANGE_ID to exercise the nonempty canonical change collection"
      )
    )
    skipped.push(
      skippedCheck(
        { expected: "change-resource", id: "get-change", path: "/api/changes/{changeId}" },
        "skipped: provide LEGISLATION_SMOKE_CHANGE_ID to exercise change detail"
      )
    )
  }
  if (fixture.billSearchQuery === undefined) {
    skipped.push(
      skippedCheck(
        { expected: "search", id: "search-bills", method: "POST", path: "/api/search/bills" },
        "skipped: provide LEGISLATION_SMOKE_BILL_SEARCH_QUERY to exercise this route with a nonempty canonical result"
      )
    )
  }
  if (fixture.materialSearchQuery === undefined) {
    skipped.push(
      skippedCheck(
        {
          expected: "search",
          id: "search-supporting-materials",
          method: "POST",
          path: "/api/search/supporting-materials"
        },
        "skipped: provide LEGISLATION_SMOKE_MATERIAL_SEARCH_QUERY to exercise this route with a nonempty canonical result"
      )
    )
  }
  return skipped
}

function skippedCheck(definition: CheckDefinition, detail: string, status: SmokeCheckStatus = "skipped"): SmokeCheck {
  return { detail, id: definition.id, method: definition.method ?? "GET", path: definition.path, status }
}

function responseDetail(body: unknown, secret: string | undefined): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined
  }
  const error = "error" in body ? body.error : undefined
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    if (secret === undefined || secret === "") {
      return error.message
    }
    return error.message.split(secret).join("[REDACTED]")
  }
  return undefined
}

function expectedSelfPath(path: string): string {
  const url = new URL(path, "http://smoke.invalid")
  return `${url.pathname}${url.search}`
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isRfc3339(value: unknown): value is string {
  return isRfc3339Timestamp(value)
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function hasSourceReference(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.provider !== "string" ||
    value.provider.trim() === "" ||
    !isAbsoluteHttpUrl(value.sourceUrl) ||
    !isRfc3339(value.retrievedAt) ||
    typeof value.isOfficial !== "boolean"
  ) {
    return false
  }
  return value.sourceUpdatedAt === null || isRfc3339(value.sourceUpdatedAt)
}

function hasCanonicalRecord(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  if (
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    !isAbsoluteHttpUrl(value.canonicalUrl) ||
    !isRfc3339(value.updatedAt) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0
  ) {
    return false
  }
  return value.sources.every(hasSourceReference)
}

function hasPageEnvelope(body: Record<string, unknown>, itemsMustBeCanonical: boolean, expectedSelf?: string): boolean {
  const links = body.links
  const meta = body.meta
  if (
    !isRecord(links) ||
    typeof links.self !== "string" ||
    !(links.next === null || typeof links.next === "string") ||
    !isRecord(meta) ||
    typeof meta.correlationId !== "string" ||
    !isNonnegativeInteger(meta.limit) ||
    !(meta.nextCursor === null || typeof meta.nextCursor === "string") ||
    typeof meta.truncated !== "boolean" ||
    !isStringArray(meta.warnings) ||
    !Array.isArray(body.data) ||
    (expectedSelf !== undefined && links.self !== expectedSelf)
  ) {
    return false
  }
  return !itemsMustBeCanonical || body.data.every((item) => hasCanonicalRecord(item))
}

function hasBillSummary(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (!hasCanonicalRecord(value) || !isRecord(value)) {
    return false
  }
  if (
    value.type !== "bill" ||
    typeof value.jurisdictionId !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.identifier !== "string" ||
    typeof value.title !== "string" ||
    !isStringArray(value.classification) ||
    !(value.status === null || typeof value.status === "string") ||
    !isStringArray(value.subjects) ||
    !(value.introducedDate === null || isIsoDate(value.introducedDate)) ||
    !(value.latestActionAt === null || isRfc3339(value.latestActionAt))
  ) {
    return false
  }
  if (canonicalApiBaseUrl === undefined) {
    return true
  }
  return (
    typeof value.id === "string" &&
    value.canonicalUrl === new URL(`/api/bills/${encoded(value.id)}`, canonicalApiBaseUrl).toString()
  )
}

function hasBillPageEnvelope(body: Record<string, unknown>, canonicalApiBaseUrl: URL | undefined): boolean {
  return (
    hasPageEnvelope(body, true) &&
    Array.isArray(body.data) &&
    body.data.every((item) => hasBillSummary(item, canonicalApiBaseUrl))
  )
}

export function canonicalSmokeApiBaseUrl(value: string | URL): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TypeError(
      "canonicalApiBaseUrl must be a credential-free http or https origin with a root path and no query or hash"
    )
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError(
      "canonicalApiBaseUrl must be a credential-free http or https origin with a root path and no query or hash"
    )
  }
  return url
}

function hasSearchMatch(
  value: unknown,
  recordType: "bill" | "supporting-material"
): value is Record<string, unknown> & { mode: "hybrid" | "lexical" | "semantic" } {
  if (
    !isRecord(value) ||
    (value.mode !== "hybrid" && value.mode !== "lexical" && value.mode !== "semantic") ||
    !Array.isArray(value.matchedFields) ||
    value.matchedFields.length === 0 ||
    !value.matchedFields.every((field) => typeof field === "string" && field.trim() !== "") ||
    new Set(value.matchedFields).size !== value.matchedFields.length ||
    !(value.snippet === null || typeof value.snippet === "string") ||
    value.explanation !== null
  ) {
    return false
  }
  const allowedFields =
    recordType === "bill"
      ? new Set(["abstract", "identifier", "semantic", "sponsorNames", "subjects", "title", "versionText"])
      : new Set(["sectionText", "semantic", "title"])
  if (value.matchedFields.some((field) => !allowedFields.has(field))) {
    return false
  }
  const lexical = value.lexicalScore
  const semantic = value.semanticScore
  const rerank = value.rerankScore
  const finite = (score: unknown): score is number => typeof score === "number" && Number.isFinite(score)
  if (recordType === "bill") {
    if (value.mode === "lexical") {
      return finite(lexical) && semantic === null && rerank === null
    }
    if (value.mode === "semantic") {
      return lexical === null && finite(semantic) && finite(rerank)
    }
    return (finite(lexical) || finite(semantic)) && finite(rerank)
  }
  if (rerank !== null) {
    return false
  }
  if (value.mode === "lexical") {
    return finite(lexical) && semantic === null
  }
  if (value.mode === "semantic") {
    return lexical === null && finite(semantic)
  }
  return finite(lexical) || finite(semantic)
}

function hasSupportingMaterialSummary(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "supporting-material" ||
    typeof value.jurisdictionId !== "string" ||
    value.jurisdictionId.trim() === "" ||
    typeof value.classification !== "string" ||
    value.classification.trim() === "" ||
    typeof value.title !== "string" ||
    value.title.trim() === "" ||
    !isStringArray(value.billIds) ||
    !isStringArray(value.amendmentIds) ||
    !isStringArray(value.meetingIds) ||
    !isStringArray(value.organizationIds) ||
    !(value.documentDate === null || isIsoDate(value.documentDate)) ||
    !isAbsoluteHttpUrl(value.sourceUrl) ||
    !(value.mimeType === null || typeof value.mimeType === "string") ||
    (value.processingStatus !== "pending" &&
      value.processingStatus !== "processing" &&
      value.processingStatus !== "processed" &&
      value.processingStatus !== "failed" &&
      value.processingStatus !== "unsupported")
  ) {
    return false
  }
  return (
    canonicalApiBaseUrl === undefined ||
    value.canonicalUrl ===
      new URL(`/api/supporting-materials/${encoded(value.id as string)}`, canonicalApiBaseUrl).toString()
  )
}

function hasSupportingMaterialPageEnvelope(
  body: Record<string, unknown>,
  canonicalApiBaseUrl: URL | undefined
): boolean {
  return (
    hasPageEnvelope(body, true) &&
    Array.isArray(body.data) &&
    body.data.every((item) => hasSupportingMaterialSummary(item, canonicalApiBaseUrl))
  )
}

function hasVoteCounts(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  const names = ["yes", "no", "absent", "abstain", "notVoting", "present", "proxy", "paired", "other"]
  return Object.keys(value).length === names.length && names.every((name) => isNonnegativeInteger(value[name]))
}

function hasVoteSummary(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "vote" ||
    (value.billId !== null && (typeof value.billId !== "string" || value.billId.trim() === "")) ||
    (value.organizationId !== null &&
      (typeof value.organizationId !== "string" || value.organizationId.trim() === "")) ||
    typeof value.motion !== "string" ||
    value.motion.trim() === "" ||
    (value.question !== null && typeof value.question !== "string") ||
    (value.classification !== null && typeof value.classification !== "string") ||
    (value.heldAt !== null && !isRfc3339(value.heldAt)) ||
    !isIsoDate(value.date) ||
    (value.result !== "passed" && value.result !== "failed" && value.result !== "other") ||
    !hasVoteCounts(value.counts)
  ) {
    return false
  }
  return hasCanonicalPath(value.canonicalUrl, value.id as string, "/api/votes", canonicalApiBaseUrl)
}

function hasVotePositionPerson(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "person" ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    (value.givenName !== null && typeof value.givenName !== "string") ||
    (value.familyName !== null && typeof value.familyName !== "string") ||
    (value.party !== null && typeof value.party !== "string") ||
    (value.imageUrl !== null && !isAbsoluteHttpUrl(value.imageUrl)) ||
    typeof value.isActive !== "boolean" ||
    !isStringArray(value.jurisdictionIds) ||
    value.jurisdictionIds.length === 0 ||
    value.jurisdictionIds.some((id) => id.trim() === "") ||
    new Set(value.jurisdictionIds).size !== value.jurisdictionIds.length
  ) {
    return false
  }
  return hasCanonicalPath(value.canonicalUrl, value.id as string, "/api/people", canonicalApiBaseUrl)
}

function hasVotePosition(value: unknown, voteId: string, canonicalApiBaseUrl: URL | undefined): boolean {
  const options = new Set(["yes", "no", "absent", "abstain", "not-voting", "present", "proxy", "paired", "other"])
  return (
    isRecord(value) &&
    hasCanonicalRecord(value) &&
    value.type === "vote-position" &&
    value.voteId === voteId &&
    (value.person === null || hasVotePositionPerson(value.person, canonicalApiBaseUrl)) &&
    typeof value.option === "string" &&
    options.has(value.option) &&
    typeof value.sourceName === "string" &&
    value.sourceName.trim() !== "" &&
    (value.sourcePersonId === null || typeof value.sourcePersonId === "string")
  )
}

function hasVoteDetail(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (!hasVoteSummary(value, canonicalApiBaseUrl) || !isRecord(value) || !Array.isArray(value.positions)) {
    return false
  }
  const page = value.positionsPageInfo
  return (
    value.positions.every((position) => hasVotePosition(position, value.id as string, canonicalApiBaseUrl)) &&
    isRecord(page) &&
    isNonnegativeInteger(page.limit) &&
    page.limit > 0 &&
    (page.nextCursor === null || typeof page.nextCursor === "string") &&
    typeof page.truncated === "boolean"
  )
}

function hasVotePageEnvelope(
  body: Record<string, unknown>,
  canonicalApiBaseUrl: URL | undefined,
  expectedSelf: string
): boolean {
  return (
    hasPageEnvelope(body, false, expectedSelf) &&
    Array.isArray(body.data) &&
    body.data.length > 0 &&
    body.data.every((item) => hasVoteSummary(item, canonicalApiBaseUrl))
  )
}

function hasChangeEvent(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  const classifications = new Set(["create", "update", "delete", "cancel", "reschedule", "relationship-change"])
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "change" ||
    typeof value.recordType !== "string" ||
    value.recordType.trim() === "" ||
    typeof value.recordId !== "string" ||
    value.recordId.trim() === "" ||
    typeof value.classification !== "string" ||
    !classifications.has(value.classification) ||
    !isStringArray(value.changedFields) ||
    new Set(value.changedFields).size !== value.changedFields.length ||
    (value.before !== null && !isRecord(value.before)) ||
    (value.after !== null && !isRecord(value.after)) ||
    (value.jurisdictionId !== null && typeof value.jurisdictionId !== "string") ||
    (value.organizationId !== null && typeof value.organizationId !== "string") ||
    (value.personId !== null && typeof value.personId !== "string") ||
    !isRfc3339(value.observedAt) ||
    (value.sourceUpdatedAt !== null && !isRfc3339(value.sourceUpdatedAt))
  ) {
    return false
  }
  return hasCanonicalPath(value.canonicalUrl, value.id as string, "/api/changes", canonicalApiBaseUrl)
}

function hasChangePageEnvelope(
  body: Record<string, unknown>,
  canonicalApiBaseUrl: URL | undefined,
  expectedSelf: string
): boolean {
  return (
    hasPageEnvelope(body, false, expectedSelf) &&
    Array.isArray(body.data) &&
    body.data.length > 0 &&
    body.data.every((item) => hasChangeEvent(item, canonicalApiBaseUrl))
  )
}

function hasSupportingMaterialDetail(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !hasSupportingMaterialSummary(value, canonicalApiBaseUrl) ||
    !isRecord(value) ||
    !isNullableNonnegativeInteger(value.byteSize) ||
    !isNullableNonnegativeInteger(value.pageCount) ||
    !isNonnegativeInteger(value.sectionCount) ||
    !isNonnegativeInteger(value.textCharacterCount) ||
    (value.storedUrl !== null && !isAbsoluteHttpUrl(value.storedUrl))
  ) {
    return false
  }
  return true
}

function hasCanonicalPath(
  value: unknown,
  id: string,
  pathPrefix: string,
  canonicalApiBaseUrl: URL | undefined
): boolean {
  if (!isAbsoluteHttpUrl(value)) {
    return false
  }
  if (canonicalApiBaseUrl === undefined) {
    return true
  }
  return value === new URL(`${pathPrefix}/${encoded(id)}`, canonicalApiBaseUrl).toString()
}

function hasDocumentSummary(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "document" ||
    (typeof value.billId !== "string" && value.billId !== null) ||
    (value.classification !== "version" &&
      value.classification !== "amendment" &&
      value.classification !== "fiscal-note" &&
      value.classification !== "analysis" &&
      value.classification !== "supplemental") ||
    typeof value.title !== "string" ||
    value.title.trim() === "" ||
    (value.documentDate !== null && !isIsoDate(value.documentDate)) ||
    (value.versionCode !== null && typeof value.versionCode !== "string") ||
    (value.mimeType !== null && typeof value.mimeType !== "string") ||
    !isAbsoluteHttpUrl(value.sourceUrl) ||
    (value.storedUrl !== null && !isAbsoluteHttpUrl(value.storedUrl)) ||
    !isDocumentProcessingStatus(value.processingStatus) ||
    !isDocumentOcrStatus(value.ocrStatus) ||
    (value.contentHash !== null &&
      (typeof value.contentHash !== "string" || !/^[a-f0-9]{64}$/i.test(value.contentHash)))
  ) {
    return false
  }
  return hasCanonicalPath(value.canonicalUrl, value.id as string, "/api/documents", canonicalApiBaseUrl)
}

function hasDocumentDetail(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !hasDocumentSummary(value, canonicalApiBaseUrl) ||
    !isRecord(value) ||
    !isNullableNonnegativeInteger(value.byteSize) ||
    !isNullableNonnegativeInteger(value.pageCount) ||
    !isNonnegativeInteger(value.sectionCount) ||
    !isNonnegativeInteger(value.textCharacterCount) ||
    (value.failureCategory !== null && typeof value.failureCategory !== "string")
  ) {
    return false
  }
  return true
}

function hasDocumentSection(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "document-section" ||
    typeof value.documentId !== "string" ||
    (typeof value.billId !== "string" && value.billId !== null) ||
    !isNonnegativeInteger(value.ordinal) ||
    (value.heading !== null && typeof value.heading !== "string") ||
    typeof value.text !== "string" ||
    !isNonnegativeInteger(value.startOffset) ||
    !isNonnegativeInteger(value.endOffset) ||
    value.endOffset < value.startOffset ||
    (value.pageStart !== null && !isNonnegativeInteger(value.pageStart)) ||
    (value.pageEnd !== null && !isNonnegativeInteger(value.pageEnd)) ||
    (typeof value.pageStart === "number" && typeof value.pageEnd === "number" && value.pageEnd < value.pageStart) ||
    typeof value.contentHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(value.contentHash) ||
    !isAbsoluteHttpUrl(value.sourceUrl)
  ) {
    return false
  }
  if (canonicalApiBaseUrl === undefined) {
    return true
  }
  return (
    value.canonicalUrl ===
    new URL(
      `/api/documents/${encoded(value.documentId)}/sections/${encoded(value.id as string)}`,
      canonicalApiBaseUrl
    ).toString()
  )
}

function isDocumentProcessingStatus(value: unknown): boolean {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "processed" ||
    value === "failed" ||
    value === "unsupported"
  )
}

function isDocumentOcrStatus(value: unknown): boolean {
  return (
    value === "not-required" ||
    value === "pending" ||
    value === "processing" ||
    value === "processed" ||
    value === "failed" ||
    value === "unsupported"
  )
}

function isNullableNonnegativeInteger(value: unknown): boolean {
  return value === null || isNonnegativeInteger(value)
}

const SMOKE_EVENT_TYPES = new Set([
  "action-added",
  "amendment-added",
  "document-added",
  "meeting-cancelled",
  "meeting-rescheduled",
  "meeting-scheduled",
  "query-match",
  "record-created",
  "record-updated",
  "relationship-changed",
  "status-changed",
  "vote-added"
])

function hasSubscriptionOwner(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.userId === "string" &&
    value.userId.trim() !== "" &&
    (value.organizationId === null || (typeof value.organizationId === "string" && value.organizationId.trim() !== ""))
  )
}

function hasSubscriptionTarget(value: unknown): boolean {
  if (!isRecord(value) || (value.type !== "record" && value.type !== "query")) {
    return false
  }
  if (value.type === "record") {
    return (
      typeof value.recordId === "string" &&
      value.recordId.trim() !== "" &&
      typeof value.recordType === "string" &&
      value.recordType.trim() !== ""
    )
  }
  return (
    (value.searchType === "all" ||
      value.searchType === "amendments" ||
      value.searchType === "bills" ||
      value.searchType === "passages" ||
      value.searchType === "supporting-materials") &&
    isRecord(value.request)
  )
}

function hasSubscription(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    !hasSubscriptionOwner(value.owner) ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    !hasSubscriptionTarget(value.target) ||
    !Array.isArray(value.eventTypes) ||
    value.eventTypes.some((eventType) => typeof eventType !== "string" || !SMOKE_EVENT_TYPES.has(eventType)) ||
    new Set(value.eventTypes).size !== value.eventTypes.length ||
    !Array.isArray(value.delivery) ||
    !value.delivery.every(hasDeliveryPreference) ||
    (value.frequency !== "daily" && value.frequency !== "hourly" && value.frequency !== "immediate") ||
    typeof value.timezone !== "string" ||
    value.timezone.trim() === "" ||
    (value.status !== "active" && value.status !== "paused" && value.status !== "cancelled") ||
    typeof value.revision !== "string" ||
    value.revision.trim() === "" ||
    !isRfc3339(value.createdAt) ||
    !isRfc3339(value.updatedAt) ||
    (value.cancelledAt !== null && !isRfc3339(value.cancelledAt))
  ) {
    return false
  }
  return hasCanonicalPath(value.canonicalUrl, value.id, "/api/subscriptions", canonicalApiBaseUrl)
}

function hasDeliveryPreference(value: unknown): boolean {
  if (!isRecord(value) || typeof value.isEnabled !== "boolean") {
    return false
  }
  if (value.channel === "in-app") {
    return value.destinationId === null
  }
  if (value.channel === "email") {
    return value.destinationId === null || typeof value.destinationId === "string"
  }
  return value.channel === "webhook" && typeof value.destinationId === "string" && value.destinationId.trim() !== ""
}

function hasSubscriptionEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.subscriptionId === "string" &&
    value.subscriptionId.trim() !== "" &&
    typeof value.eventType === "string" &&
    SMOKE_EVENT_TYPES.has(value.eventType) &&
    (value.changeEventId === null || typeof value.changeEventId === "string") &&
    typeof value.recordType === "string" &&
    value.recordType.trim() !== "" &&
    typeof value.recordId === "string" &&
    value.recordId.trim() !== "" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isRfc3339(value.occurredAt) &&
    isRfc3339(value.matchedAt) &&
    Array.isArray(value.sourceUrls) &&
    value.sourceUrls.every(isAbsoluteHttpUrl)
  )
}

function hasDelivery(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.subscriptionId === "string" &&
    value.subscriptionId.trim() !== "" &&
    Array.isArray(value.subscriptionEventIds) &&
    value.subscriptionEventIds.length > 0 &&
    value.subscriptionEventIds.every((id) => typeof id === "string" && id.trim() !== "") &&
    (value.channel === "email" || value.channel === "webhook" || value.channel === "in-app") &&
    (value.destinationId === null || typeof value.destinationId === "string") &&
    (value.status === "pending" ||
      value.status === "processing" ||
      value.status === "delivered" ||
      value.status === "failed" ||
      value.status === "suppressed") &&
    isNonnegativeInteger(value.attemptCount) &&
    (value.nextAttemptAt === null || isRfc3339(value.nextAttemptAt)) &&
    (value.deliveredAt === null || isRfc3339(value.deliveredAt)) &&
    (value.failureCategory === null || typeof value.failureCategory === "string") &&
    isRfc3339(value.createdAt)
  )
}

function hasWebhook(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    !hasSubscriptionOwner(value.owner) ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    !isAbsoluteHttpUrl(value.url) ||
    !value.url.startsWith("https://") ||
    !Array.isArray(value.eventTypes) ||
    value.eventTypes.some((eventType) => typeof eventType !== "string" || !SMOKE_EVENT_TYPES.has(eventType)) ||
    new Set(value.eventTypes).size !== value.eventTypes.length ||
    (value.status !== "pending-verification" &&
      value.status !== "active" &&
      value.status !== "paused" &&
      value.status !== "cancelled") ||
    typeof value.revision !== "string" ||
    value.revision.trim() === "" ||
    typeof value.secretLastFour !== "string" ||
    value.secretLastFour.length > 4 ||
    !Array.isArray(value.activeKeyIds) ||
    value.activeKeyIds.some((keyId) => typeof keyId !== "string" || keyId.trim() === "") ||
    (value.overlapEndsAt !== null && !isRfc3339(value.overlapEndsAt)) ||
    (value.lastSucceededAt !== null && !isRfc3339(value.lastSucceededAt)) ||
    (value.lastFailedAt !== null && !isRfc3339(value.lastFailedAt)) ||
    !isRfc3339(value.createdAt) ||
    !isRfc3339(value.updatedAt) ||
    (value.cancelledAt !== null && !isRfc3339(value.cancelledAt)) ||
    "secret" in value
  ) {
    return false
  }
  return hasCanonicalPath(value.canonicalUrl, value.id, "/api/webhooks", canonicalApiBaseUrl)
}

function hasSupportingMaterialSection(
  value: unknown,
  materialId: string,
  canonicalApiBaseUrl: URL | undefined
): boolean {
  if (
    !isRecord(value) ||
    !hasCanonicalRecord(value) ||
    value.type !== "supporting-material-section" ||
    value.materialId !== materialId ||
    !isNonnegativeInteger(value.ordinal) ||
    !(value.heading === null || typeof value.heading === "string") ||
    typeof value.text !== "string" ||
    !(value.pageStart === null || isNonnegativeInteger(value.pageStart)) ||
    !(value.pageEnd === null || isNonnegativeInteger(value.pageEnd)) ||
    (typeof value.pageStart === "number" && typeof value.pageEnd === "number" && value.pageEnd < value.pageStart) ||
    typeof value.contentHash !== "string" ||
    !isAbsoluteHttpUrl(value.sourceUrl)
  ) {
    return false
  }
  return (
    canonicalApiBaseUrl === undefined ||
    value.canonicalUrl ===
      new URL(
        `/api/supporting-materials/${encoded(materialId)}/sections/${encoded(value.id as string)}`,
        canonicalApiBaseUrl
      ).toString()
  )
}

function hasCanonicalSearchHit(value: unknown, canonicalApiBaseUrl: URL | undefined): boolean {
  if (!isRecord(value) || typeof value.recordId !== "string" || value.recordId.trim() === "") {
    return false
  }
  if (
    !isNonnegativeInteger(value.rank) ||
    value.rank < 1 ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score)
  ) {
    return false
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0 || !value.sources.every(hasSourceReference)) {
    return false
  }
  if (value.recordType === "bill") {
    const record = value.record
    if (!hasSearchMatch(value.match, "bill")) {
      return false
    }
    return (
      isRecord(record) &&
      hasBillSummary(record, canonicalApiBaseUrl) &&
      record.id === value.recordId &&
      JSON.stringify(value.sources) === JSON.stringify(record.sources) &&
      value.score === (value.match.mode === "lexical" ? value.match.lexicalScore : value.match.rerankScore)
    )
  }
  if (value.recordType !== "supporting-material" || !isRecord(value.record)) {
    return false
  }
  const material = value.record.material
  if (!hasSearchMatch(value.match, "supporting-material")) {
    return false
  }
  const scoreMatchesMode =
    value.match.mode === "hybrid" ||
    (value.match.mode === "lexical" && value.score === value.match.lexicalScore) ||
    (value.match.mode === "semantic" && value.score === value.match.semanticScore)
  return (
    isRecord(material) &&
    hasSupportingMaterialSummary(material, canonicalApiBaseUrl) &&
    material.id === value.recordId &&
    hasSupportingMaterialSection(value.record.section, value.recordId, canonicalApiBaseUrl) &&
    isStringArray(value.record.relatedRecordIds) &&
    JSON.stringify(value.sources) === JSON.stringify(material.sources) &&
    scoreMatchesMode
  )
}

function hasSearchEnvelope(
  body: Record<string, unknown>,
  requireNonEmptySearch: boolean,
  canonicalApiBaseUrl: URL | undefined,
  expectedSelf?: string
): boolean {
  if (!hasPageEnvelope(body, false, expectedSelf)) {
    return false
  }
  if (
    requireNonEmptySearch &&
    (!Array.isArray(body.data) ||
      body.data.length === 0 ||
      !body.data.every((item) => hasCanonicalSearchHit(item, canonicalApiBaseUrl)))
  ) {
    return false
  }
  const meta = body.meta
  if (!isRecord(meta)) {
    return false
  }
  if (meta.mode !== "lexical" && meta.mode !== "semantic" && meta.mode !== "hybrid") {
    return false
  }
  if (typeof meta.isReranked !== "boolean" || !Array.isArray(meta.models)) {
    return false
  }
  return meta.models.every((model) => {
    if (
      !isRecord(model) ||
      (model.provider !== "openai" && model.provider !== "voyageai" && model.provider !== "cohere") ||
      typeof model.model !== "string" ||
      model.model.trim() === "" ||
      (model.purpose !== "embedding" && model.purpose !== "reranking" && model.purpose !== "generation") ||
      !(model.dimensions === null || isNonnegativeInteger(model.dimensions))
    ) {
      return false
    }
    return true
  })
}

function hasBatchEnvelope(body: Record<string, unknown>, expectedSelf: string): boolean {
  const data = body.data
  const links = body.links
  const meta = body.meta
  if (
    !isRecord(links) ||
    links.self !== expectedSelf ||
    !isRecord(meta) ||
    typeof meta.correlationId !== "string" ||
    !isNonnegativeInteger(meta.requested) ||
    !isNonnegativeInteger(meta.returned) ||
    !isStringArray(meta.warnings) ||
    !Array.isArray(data)
  ) {
    return false
  }
  if (meta.returned !== data.length || meta.returned > meta.requested) {
    return false
  }
  return data.every((item) => {
    if (!isRecord(item)) {
      return false
    }
    const itemId = item.id ?? item.billId
    if (typeof itemId !== "string" || itemId.trim() === "") {
      return false
    }
    if (item.status === "ok") {
      if ("data" in item) {
        return hasCanonicalRecord(item.data)
      }
      return isRecord(item.page) && hasPageEnvelope(item.page, true)
    }
    if (item.status !== "error" || !isRecord(item.error)) {
      return false
    }
    return (
      (item.error.category === "not_found" ||
        item.error.category === "forbidden" ||
        item.error.category === "dependency_unavailable") &&
      typeof item.error.message === "string" &&
      item.error.message.trim() !== "" &&
      typeof item.error.retryable === "boolean"
    )
  })
}

function hasVoteBatchEnvelope(
  body: Record<string, unknown>,
  canonicalApiBaseUrl: URL | undefined,
  expectedSelf: string
): boolean {
  if (!hasBatchEnvelope(body, expectedSelf) || !Array.isArray(body.data)) {
    return false
  }
  return body.data.every(
    (item) =>
      isRecord(item) &&
      item.status === "ok" &&
      typeof item.id === "string" &&
      isRecord(item.data) &&
      item.data.id === item.id &&
      hasVoteDetail(item.data, canonicalApiBaseUrl)
  )
}

const SMOKE_ERROR_CATEGORIES = new Set([
  "conflict",
  "dependency_unavailable",
  "forbidden",
  "internal",
  "invalid_request",
  "not_found",
  "payload_too_large",
  "precondition_failed",
  "unauthorized",
  "unprocessable"
])

function hasErrorEnvelope(body: unknown, header: string | null, category: string | undefined): boolean {
  if (header === null || header.trim() === "" || !isRecord(body) || !("error" in body) || !isRecord(body.error)) {
    return false
  }
  return (
    typeof body.error.category === "string" &&
    SMOKE_ERROR_CATEGORIES.has(body.error.category) &&
    (category === undefined || body.error.category === category) &&
    typeof body.error.message === "string" &&
    body.error.message.trim() !== "" &&
    body.error.correlationId === header &&
    typeof body.error.retryable === "boolean"
  )
}

function hasRevisionEtag(body: unknown, etag: string | null): boolean {
  if (!isRecord(body) || !isRecord(body.data) || typeof body.data.revision !== "string") {
    return false
  }
  return etag !== null && etag === body.data.revision
}

function hasExpectedResponseIdentity(
  body: unknown,
  expectedId: string | undefined,
  expectedParent: CheckDefinition["expectedParent"]
): boolean {
  if (expectedId === undefined && expectedParent === undefined) {
    return true
  }
  if (!isRecord(body)) {
    return false
  }
  const values = Array.isArray(body.data) ? body.data : [body.data]
  return values.every((value) => {
    if (!isRecord(value)) {
      return false
    }
    return (
      (expectedId === undefined || value.id === expectedId) &&
      (expectedParent === undefined || value[expectedParent.field] === expectedParent.id)
    )
  })
}

function hasExpectedEnvelope(
  body: unknown,
  expected: CheckDefinition["expected"],
  healthStatus: CheckDefinition["healthStatus"],
  canonicalApiBaseUrl: URL | undefined,
  requireNonEmptySearch: boolean,
  expectedSelf: string
): boolean {
  if (expected === "health") {
    return isRecord(body) && body.status === healthStatus
  }
  if (!isRecord(body)) {
    return false
  }
  if (expected === "page") {
    return hasPageEnvelope(body, true, expectedSelf)
  }
  if (expected === "resource") {
    return hasCanonicalRecord(body.data) && hasResourceLinks(body.links, expectedSelf)
  }
  if (expected === "bill-page") {
    return hasBillPageEnvelope(body, canonicalApiBaseUrl) && hasPageLinks(body.links, expectedSelf)
  }
  if (expected === "calculation") {
    return isRecord(body.data)
  }
  if (expected === "search") {
    return hasSearchEnvelope(body, requireNonEmptySearch, canonicalApiBaseUrl, expectedSelf)
  }
  if (expected === "material-page") {
    return hasSupportingMaterialPageEnvelope(body, canonicalApiBaseUrl) && hasPageLinks(body.links, expectedSelf)
  }
  if (expected === "material-resource") {
    return hasResourceLinks(body.links, expectedSelf) && hasSupportingMaterialDetail(body.data, canonicalApiBaseUrl)
  }
  if (expected === "material-section-resource") {
    return (
      hasResourceLinks(body.links, expectedSelf) &&
      isRecord(body.data) &&
      hasSupportingMaterialSection(body.data, String(body.data.materialId ?? ""), canonicalApiBaseUrl)
    )
  }
  if (expected === "batch") {
    return hasBatchEnvelope(body, expectedSelf)
  }
  if (expected === "vote-page") {
    return hasVotePageEnvelope(body, canonicalApiBaseUrl, expectedSelf)
  }
  if (expected === "vote-resource") {
    return hasResourceLinks(body.links, expectedSelf) && hasVoteDetail(body.data, canonicalApiBaseUrl)
  }
  if (expected === "vote-batch") {
    return hasVoteBatchEnvelope(body, canonicalApiBaseUrl, expectedSelf)
  }
  if (expected === "change-page") {
    return hasChangePageEnvelope(body, canonicalApiBaseUrl, expectedSelf)
  }
  if (expected === "change-resource") {
    return hasResourceLinks(body.links, expectedSelf) && hasChangeEvent(body.data, canonicalApiBaseUrl)
  }
  if (expected === "document-page") {
    return (
      hasPageEnvelope(body, false, expectedSelf) &&
      Array.isArray(body.data) &&
      body.data.every((item) => hasDocumentSummary(item, canonicalApiBaseUrl))
    )
  }
  if (expected === "document-section-page") {
    return (
      hasPageEnvelope(body, false, expectedSelf) &&
      Array.isArray(body.data) &&
      body.data.every((item) => hasDocumentSection(item, canonicalApiBaseUrl))
    )
  }
  if (expected === "document-resource") {
    return hasResourceLinks(body.links, expectedSelf) && hasDocumentDetail(body.data, canonicalApiBaseUrl)
  }
  if (expected === "document-section-resource") {
    return (
      hasResourceLinks(body.links, expectedSelf) &&
      isRecord(body.data) &&
      hasDocumentSection(body.data, canonicalApiBaseUrl)
    )
  }
  if (expected === "subscription-page") {
    return (
      hasPageEnvelope(body, false, expectedSelf) &&
      Array.isArray(body.data) &&
      body.data.every((item) => hasSubscription(item, canonicalApiBaseUrl))
    )
  }
  if (expected === "subscription-resource") {
    return hasResourceLinks(body.links, expectedSelf) && hasSubscription(body.data, canonicalApiBaseUrl)
  }
  if (expected === "subscription-event-page") {
    return (
      hasPageEnvelope(body, false, expectedSelf) && Array.isArray(body.data) && body.data.every(hasSubscriptionEvent)
    )
  }
  if (expected === "delivery-page") {
    return hasPageEnvelope(body, false, expectedSelf) && Array.isArray(body.data) && body.data.every(hasDelivery)
  }
  if (expected === "webhook-page") {
    return (
      hasPageEnvelope(body, false, expectedSelf) &&
      Array.isArray(body.data) &&
      body.data.every((item) => hasWebhook(item, canonicalApiBaseUrl))
    )
  }
  if (expected === "webhook-resource") {
    return hasResourceLinks(body.links, expectedSelf) && hasWebhook(body.data, canonicalApiBaseUrl)
  }
  return hasPageEnvelope(body, true)
}

function hasPageLinks(value: unknown, expectedSelf: string): boolean {
  return isRecord(value) && value.self === expectedSelf
}

function hasResourceLinks(value: unknown, expectedSelf: string): boolean {
  return hasPageLinks(value, expectedSelf)
}

function hasApiCorrelation(body: unknown, header: string | null): boolean {
  if (header === null || header.trim() === "" || !isRecord(body)) {
    return false
  }
  const meta = "meta" in body ? body.meta : undefined
  return isRecord(meta) && meta.correlationId === header
}

async function execute(
  baseUrl: URL,
  fetchImpl: FetchLike,
  definition: CheckDefinition,
  token: string | undefined,
  requestTimeoutMs: number,
  callerSignal: AbortSignal | undefined,
  canonicalApiBaseUrl: URL | undefined
): Promise<SmokeCheck> {
  const headers: Record<string, string> = { accept: "application/json", "x-correlation-id": `smoke-${definition.id}` }
  if (definition.body !== undefined) {
    headers["content-type"] = "application/json"
  }
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`
  }
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), requestTimeoutMs)
  const signal = AbortSignal.any(
    callerSignal === undefined ? [timeoutController.signal] : [callerSignal, timeoutController.signal]
  )
  let response: Response
  let body: unknown
  try {
    response = await fetchImpl(new URL(definition.path, baseUrl), {
      body: definition.body === undefined ? undefined : JSON.stringify(definition.body),
      headers,
      method: definition.method ?? "GET",
      signal
    })
    body = await parseJson(response)
  } catch {
    let detail = "request failed before a response was received"
    if (timeoutController.signal.aborted) {
      detail = `request timed out after ${requestTimeoutMs} ms`
    } else if (callerSignal?.aborted === true) {
      detail = "request was cancelled"
    }
    return {
      detail,
      id: definition.id,
      method: definition.method ?? "GET",
      path: definition.path,
      status: "failed"
    }
  } finally {
    clearTimeout(timeout)
  }
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return {
      detail: "response did not use the documented application/json content type",
      id: definition.id,
      method: definition.method ?? "GET",
      path: definition.path,
      status: "failed",
      statusCode: response.status
    }
  }
  if (definition.allowNotFound && response.status === 404) {
    if (!hasErrorEnvelope(body, response.headers.get("x-correlation-id"), "not_found")) {
      return {
        detail: "documented collection absence did not use the canonical not_found error envelope",
        id: definition.id,
        method: definition.method ?? "GET",
        path: definition.path,
        status: "failed",
        statusCode: response.status
      }
    }
    return {
      detail: "HTTP 404 (documented collection absence)",
      id: definition.id,
      method: definition.method ?? "GET",
      path: definition.path,
      status: "passed",
      statusCode: response.status
    }
  }
  if (definition.expected === "error") {
    if (response.status !== definition.statusCode) {
      const blockedWithoutAuth =
        definition.protected !== false && token === undefined && (response.status === 401 || response.status === 403)
      return {
        detail: blockedWithoutAuth
          ? "blocked: authentication is required before this error contract can be checked"
          : `expected HTTP ${definition.statusCode}, got ${response.status}${
              responseDetail(body, token) === undefined ? "" : `: ${responseDetail(body, token)}`
            }`,
        id: definition.id,
        method: definition.method ?? "GET",
        path: definition.path,
        status: blockedWithoutAuth ? "blocked" : "failed",
        statusCode: response.status
      }
    }
    if (!hasErrorEnvelope(body, response.headers.get("x-correlation-id"), definition.errorCategory)) {
      return {
        detail: "error response did not contain the documented category and matching correlation ID",
        id: definition.id,
        method: definition.method ?? "GET",
        path: definition.path,
        status: "failed",
        statusCode: response.status
      }
    }
    if (definition.requiresAuthHeader && !response.headers.get("www-authenticate")?.includes("invalid_token")) {
      return {
        detail: "authentication error omitted the documented WWW-Authenticate invalid_token challenge",
        id: definition.id,
        method: definition.method ?? "GET",
        path: definition.path,
        status: "failed",
        statusCode: response.status
      }
    }
  } else if (!response.ok) {
    const category =
      response.status === 404 ||
      response.status === 501 ||
      response.status === 503 ||
      (token === undefined && (response.status === 401 || response.status === 403))
        ? "blocked"
        : "failed"
    return {
      detail: `HTTP ${response.status}${
        responseDetail(body, token) === undefined ? "" : `: ${responseDetail(body, token)}`
      }`,
      id: definition.id,
      method: definition.method ?? "GET",
      path: definition.path,
      status: category,
      statusCode: response.status
    }
  } else if (
    (definition.allowNotFound && response.status !== 200) ||
    !hasExpectedEnvelope(
      body,
      definition.expected,
      definition.healthStatus,
      canonicalApiBaseUrl,
      definition.requireNonEmptySearch ?? false,
      expectedSelfPath(definition.path)
    ) ||
    (definition.expected === "health"
      ? response.headers.get("x-correlation-id") !== `smoke-${definition.id}`
      : !hasApiCorrelation(body, response.headers.get("x-correlation-id"))) ||
    !hasExpectedResponseIdentity(body, definition.expectedId, definition.expectedParent) ||
    (definition.requiresRevisionEtag && !hasRevisionEtag(body, response.headers.get("etag")))
  ) {
    return {
      detail: "response did not contain the documented envelope and matching correlation ID",
      id: definition.id,
      method: definition.method ?? "GET",
      path: definition.path,
      status: "failed",
      statusCode: response.status
    }
  }
  const detail = response.status !== 200 ? `HTTP ${response.status}` : undefined
  return {
    detail,
    id: definition.id,
    method: definition.method ?? "GET",
    path: definition.path,
    status: "passed",
    statusCode: response.status
  }
}

type LifecycleRequest = Readonly<{
  body?: unknown
  expectedStatus: number
  headers?: Readonly<Record<string, string>>
  id: string
  method: "DELETE" | "GET" | "PATCH" | "POST"
  path: string
  reportPath?: string
  validate: (body: unknown, response: Response) => boolean
}>

type LifecycleRequestResult = Readonly<{
  body: unknown | undefined
  check: SmokeCheck
  response: Response | undefined
}>

async function executeLifecycleRequest(
  baseUrl: URL,
  fetchImpl: FetchLike,
  request: LifecycleRequest,
  token: string,
  requestTimeoutMs: number,
  callerSignal: AbortSignal | undefined
): Promise<LifecycleRequestResult> {
  const reportPath = request.reportPath ?? request.path
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    "x-correlation-id": `smoke-${request.id}`,
    ...request.headers
  }
  if (request.body !== undefined && headers["content-type"] === undefined) {
    headers["content-type"] = "application/json"
  }
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), requestTimeoutMs)
  const signal = AbortSignal.any(
    callerSignal === undefined ? [timeoutController.signal] : [callerSignal, timeoutController.signal]
  )
  let response: Response
  let body: unknown
  try {
    response = await fetchImpl(new URL(request.path, baseUrl), {
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      headers,
      method: request.method,
      signal
    })
    body = await parseJson(response)
  } catch {
    clearTimeout(timeout)
    let detail = "request failed before a response was received"
    if (timeoutController.signal.aborted) {
      detail = `request timed out after ${requestTimeoutMs} ms`
    } else if (callerSignal?.aborted === true) {
      detail = "request was cancelled"
    }
    return {
      body: undefined,
      check: {
        detail,
        id: request.id,
        method: request.method,
        path: reportPath,
        status: "failed"
      },
      response: undefined
    }
  }
  clearTimeout(timeout)
  const valid =
    response.status === request.expectedStatus &&
    response.headers.get("content-type")?.toLowerCase().startsWith("application/json") === true &&
    request.validate(body, response)
  let detail: string | undefined = "response violated the lifecycle contract"
  if (valid && response.status !== 200) {
    detail = `HTTP ${response.status}`
  } else if (valid) {
    detail = undefined
  }
  return {
    body,
    check: {
      detail,
      id: request.id,
      method: request.method,
      path: reportPath,
      status: valid ? "passed" : "failed",
      statusCode: response.status
    },
    response
  }
}

function lifecycleResource(
  body: unknown,
  response: Response,
  correlationId: string,
  expectedPath: string,
  predicate: (value: unknown) => boolean
): boolean {
  return (
    hasApiCorrelation(body, response.headers.get("x-correlation-id")) &&
    response.headers.get("x-correlation-id") === correlationId &&
    isRecord(body) &&
    hasResourceLinks(body.links, expectedPath) &&
    predicate(body.data)
  )
}

function lifecyclePage(
  body: unknown,
  response: Response,
  correlationId: string,
  expectedPath: string,
  predicate: (value: unknown) => boolean
): boolean {
  return (
    hasApiCorrelation(body, response.headers.get("x-correlation-id")) &&
    response.headers.get("x-correlation-id") === correlationId &&
    isRecord(body) &&
    hasPageEnvelope(body, false, expectedPath) &&
    Array.isArray(body.data) &&
    body.data.every(predicate)
  )
}

function subscriptionData(body: unknown): Record<string, unknown> | undefined {
  if (!isRecord(body) || !isRecord(body.data)) {
    return undefined
  }
  return body.data
}

function webhookData(body: unknown): Record<string, unknown> | undefined {
  if (!isRecord(body) || !isRecord(body.data)) {
    return undefined
  }
  return body.data
}

function webhookWithSecretData(
  body: unknown,
  canonicalApiBaseUrl: URL | undefined
): Readonly<{ keyId: string; secret: string; webhook: Record<string, unknown> }> | undefined {
  const data = webhookData(body)
  if (
    data === undefined ||
    typeof data.keyId !== "string" ||
    data.keyId.trim() === "" ||
    typeof data.secret !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.secret) ||
    !isRecord(data.webhook) ||
    !hasWebhook(data.webhook, canonicalApiBaseUrl)
  ) {
    return undefined
  }
  return { keyId: data.keyId, secret: data.secret, webhook: data.webhook }
}

function webhookFixtureIdentity(body: unknown): Readonly<{ id: string; revision: string }> | undefined {
  const data = webhookData(body)
  if (!isRecord(data?.webhook) || typeof data.webhook.id !== "string" || typeof data.webhook.revision !== "string") {
    return undefined
  }
  if (data.webhook.id.trim() === "" || data.webhook.revision.trim() === "") {
    return undefined
  }
  return { id: data.webhook.id, revision: data.webhook.revision }
}

function isCancellationReceipt(value: unknown, id: string, revision: string): boolean {
  return isRecord(value) && value.id === id && isRfc3339(value.cancelledAt) && value.finalRevision === revision
}

function lifecycleCheckBlocked(id: string, detail: string): SmokeCheck {
  return { detail, id, status: "blocked" }
}

async function cancelLifecycleSubscription(
  input: Readonly<{
    baseUrl: URL
    canonicalApiBaseUrl: URL
    callerSignal: AbortSignal | undefined
    fetchImpl: FetchLike
    requestTimeoutMs: number
    token: string
  }>,
  id: string,
  path: string
): Promise<readonly SmokeCheck[]> {
  const read = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "subscription-lifecycle-cleanup-read",
      method: "GET",
      path,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-subscription-lifecycle-cleanup-read", path, (value) =>
          hasSubscription(value, input.canonicalApiBaseUrl)
        )
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  const subscription = subscriptionData(read.body)
  if (read.check.status !== "passed" || subscription === undefined || typeof subscription.revision !== "string") {
    return [
      read.check,
      lifecycleCheckBlocked(
        "subscription-lifecycle-cleanup",
        "blocked: the generated subscription revision could not be read for cancellation"
      )
    ]
  }
  if (subscription.status === "cancelled") {
    return [read.check]
  }
  const revision = subscription.revision
  const cancellation = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      headers: { "idempotency-key": randomUUID(), "if-match": revision },
      id: "subscription-lifecycle-cleanup",
      method: "DELETE",
      path,
      validate: (body, response) => {
        const finalRevision = response.headers.get("etag")
        return (
          typeof finalRevision === "string" &&
          lifecycleResource(body, response, "smoke-subscription-lifecycle-cleanup", path, (value) =>
            isCancellationReceipt(value, id, finalRevision)
          )
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  return [read.check, cancellation.check]
}

async function runSubscriptionLifecycleSmoke(input: {
  baseUrl: URL
  canonicalApiBaseUrl: URL
  callerSignal: AbortSignal | undefined
  fetchImpl: FetchLike
  requestTimeoutMs: number
  token: string
}): Promise<readonly SmokeCheck[]> {
  const checks: SmokeCheck[] = []
  const createKey = randomUUID()
  const patchKey = randomUUID()
  const staleKey = randomUUID()
  const deleteKey = randomUUID()
  const subscriptionName = `API lifecycle smoke ${randomUUID()}`
  const createBody = {
    delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
    eventTypes: ["query-match"],
    frequency: "immediate",
    name: subscriptionName,
    target: { request: { mode: "lexical", query: "smoke lifecycle" }, searchType: "bills", type: "query" },
    timezone: "Etc/UTC"
  }
  const list = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "subscription-lifecycle-list",
      method: "GET",
      path: "/api/subscriptions?limit=1",
      validate: (body, response) =>
        lifecyclePage(body, response, "smoke-subscription-lifecycle-list", "/api/subscriptions?limit=1", (value) =>
          hasSubscription(value, input.canonicalApiBaseUrl)
        )
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(list.check)
  const created = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: createBody,
      expectedStatus: 201,
      headers: { "idempotency-key": createKey },
      id: "subscription-lifecycle-create",
      method: "POST",
      path: "/api/subscriptions",
      validate: (body, response) => {
        const data = subscriptionData(body)
        return (
          lifecycleResource(body, response, "smoke-subscription-lifecycle-create", "/api/subscriptions", (value) =>
            hasSubscription(value, input.canonicalApiBaseUrl)
          ) &&
          data !== undefined &&
          response.headers.get("etag") === data.revision &&
          response.headers.get("location") === `/api/subscriptions/${encoded(String(data.id))}`
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(created.check)
  const postCreateCheckStart = checks.length
  const createdData = subscriptionData(created.body)
  if (createdData === undefined || typeof createdData.id !== "string" || typeof createdData.revision !== "string") {
    checks.push(
      lifecycleCheckBlocked(
        "subscription-lifecycle-dependent-checks",
        "blocked: subscription creation did not produce a usable fixture"
      )
    )
    return checks
  }
  const id = createdData.id
  const path = `/api/subscriptions/${encoded(id)}`
  if (created.check.status !== "passed") {
    checks.push(...(await cancelLifecycleSubscription(input, id, path)))
    return checks
  }
  const createReplay = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: createBody,
      expectedStatus: 201,
      headers: { "idempotency-key": createKey },
      id: "subscription-lifecycle-create-replay",
      method: "POST",
      path: "/api/subscriptions",
      validate: (body, response) => {
        const data = subscriptionData(body)
        return (
          lifecycleResource(
            body,
            response,
            "smoke-subscription-lifecycle-create-replay",
            "/api/subscriptions",
            (value) => hasSubscription(value, input.canonicalApiBaseUrl)
          ) &&
          data?.id === id &&
          data.revision === createdData.revision
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(createReplay.check)
  const filteredPath =
    "/api/subscriptions?targetType=query&eventType=query-match&channel=in-app&status=active&limit=100"
  const filtered = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "subscription-lifecycle-filtered-list",
      method: "GET",
      path: filteredPath,
      validate: (body, response) =>
        lifecyclePage(body, response, "smoke-subscription-lifecycle-filtered-list", filteredPath, (value) =>
          hasSubscription(value, input.canonicalApiBaseUrl)
        ) &&
        isRecord(body) &&
        Array.isArray(body.data) &&
        body.data.some((value) => isRecord(value) && value.id === id)
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(filtered.check)
  const detail = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "subscription-lifecycle-detail",
      method: "GET",
      path,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-subscription-lifecycle-detail", path, (value) =>
          hasSubscription(value, input.canonicalApiBaseUrl)
        ) &&
        subscriptionData(body)?.id === id &&
        response.headers.get("etag") === createdData.revision
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(detail.check)
  const patch = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { name: `${subscriptionName} updated` },
      expectedStatus: 200,
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": patchKey,
        "if-match": createdData.revision
      },
      id: "subscription-lifecycle-patch",
      method: "PATCH",
      path,
      validate: (body, response) => {
        const data = subscriptionData(body)
        return (
          lifecycleResource(body, response, "smoke-subscription-lifecycle-patch", path, (value) =>
            hasSubscription(value, input.canonicalApiBaseUrl)
          ) &&
          data?.id === id &&
          data.name === `${subscriptionName} updated` &&
          typeof data.revision === "string" &&
          data.revision !== createdData.revision &&
          response.headers.get("etag") === data.revision
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(patch.check)
  const patchedData = subscriptionData(patch.body)
  const patchedRevision = patchedData?.revision
  if (patch.check.status !== "passed" || typeof patchedRevision !== "string") {
    checks.push(...(await cancelLifecycleSubscription(input, id, path)))
    return checks
  }
  const stale = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { status: "paused" },
      expectedStatus: 412,
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": staleKey,
        "if-match": createdData.revision
      },
      id: "subscription-lifecycle-stale-revision",
      method: "PATCH",
      path,
      validate: (body, response) =>
        hasErrorEnvelope(body, response.headers.get("x-correlation-id"), "precondition_failed") &&
        response.headers.get("x-correlation-id") === "smoke-subscription-lifecycle-stale-revision"
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(stale.check)
  for (const child of ["events", "deliveries"] as const) {
    const childPath = `${path}/${child}?limit=1`
    const expected = child === "events" ? hasSubscriptionEvent : hasDelivery
    const childResult = await executeLifecycleRequest(
      input.baseUrl,
      input.fetchImpl,
      {
        expectedStatus: 200,
        id: `subscription-lifecycle-${child}`,
        method: "GET",
        path: childPath,
        validate: (body, response) =>
          lifecyclePage(body, response, `smoke-subscription-lifecycle-${child}`, childPath, expected) &&
          isRecord(body) &&
          Array.isArray(body.data) &&
          body.data.length === 0
      },
      input.token,
      input.requestTimeoutMs,
      input.callerSignal
    )
    checks.push(childResult.check)
  }
  const cancellation = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      headers: { "idempotency-key": deleteKey, "if-match": patchedRevision },
      id: "subscription-lifecycle-delete",
      method: "DELETE",
      path,
      validate: (body, response) => {
        const finalRevision = response.headers.get("etag")
        return (
          typeof finalRevision === "string" &&
          lifecycleResource(body, response, "smoke-subscription-lifecycle-delete", path, (value) =>
            isCancellationReceipt(value, id, finalRevision)
          )
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(cancellation.check)
  const cancellationReplay = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      headers: { "idempotency-key": deleteKey, "if-match": patchedRevision },
      id: "subscription-lifecycle-delete-replay",
      method: "DELETE",
      path,
      validate: (body, response) => {
        const finalRevision = response.headers.get("etag")
        return (
          typeof finalRevision === "string" &&
          lifecycleResource(body, response, "smoke-subscription-lifecycle-delete-replay", path, (value) =>
            isCancellationReceipt(value, id, finalRevision)
          )
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(cancellationReplay.check)
  const cancelled = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "subscription-lifecycle-cancelled-visibility",
      method: "GET",
      path,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-subscription-lifecycle-cancelled-visibility", path, (value) =>
          hasSubscription(value, input.canonicalApiBaseUrl)
        ) &&
        subscriptionData(body)?.id === id &&
        subscriptionData(body)?.status === "cancelled" &&
        isRfc3339(subscriptionData(body)?.cancelledAt)
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(cancelled.check)
  if (checks.slice(postCreateCheckStart).some((check) => check.status !== "passed")) {
    checks.push(...(await cancelLifecycleSubscription(input, id, path)))
  }
  return checks
}

const WEBHOOK_LIFECYCLE_DETAIL_PATH = "/api/webhooks/{webhookId}"
const WEBHOOK_LIFECYCLE_ROTATE_PATH = "/api/webhooks/{webhookId}/rotate-secret"

function hasWebhookWithSecretResource(
  body: unknown,
  response: Response,
  correlation: string,
  expectedPath: string,
  canonicalApiBaseUrl: URL
): boolean {
  return (
    lifecycleResource(body, response, correlation, expectedPath, () => true) &&
    webhookWithSecretData(body, canonicalApiBaseUrl) !== undefined
  )
}

async function cancelLifecycleWebhook(
  input: Readonly<{
    baseUrl: URL
    canonicalApiBaseUrl: URL
    callerSignal: AbortSignal | undefined
    fetchImpl: FetchLike
    requestTimeoutMs: number
    token: string
  }>,
  id: string,
  path: string
): Promise<readonly SmokeCheck[]> {
  const read = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "webhook-lifecycle-cleanup-read",
      method: "GET",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-webhook-lifecycle-cleanup-read", path, (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        )
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  const webhook = webhookData(read.body)
  if (
    read.check.status !== "passed" ||
    webhook === undefined ||
    webhook.id !== id ||
    typeof webhook.revision !== "string"
  ) {
    return [
      read.check,
      lifecycleCheckBlocked(
        "webhook-lifecycle-cleanup",
        "blocked: the generated webhook revision could not be read for cancellation"
      )
    ]
  }
  if (webhook.status === "cancelled") {
    return [read.check]
  }
  const revision = webhook.revision
  const cancellation = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      headers: { "idempotency-key": randomUUID(), "if-match": revision },
      id: "webhook-lifecycle-cleanup",
      method: "DELETE",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) => {
        const finalRevision = response.headers.get("etag")
        return (
          typeof finalRevision === "string" &&
          lifecycleResource(body, response, "smoke-webhook-lifecycle-cleanup", path, (value) =>
            isCancellationReceipt(value, id, finalRevision)
          )
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  return [read.check, cancellation.check]
}

async function runWebhookLifecycleSmoke(input: {
  baseUrl: URL
  canonicalApiBaseUrl: URL
  callerSignal: AbortSignal | undefined
  fetchImpl: FetchLike
  requestTimeoutMs: number
  token: string
}): Promise<readonly SmokeCheck[]> {
  if (input.canonicalApiBaseUrl.protocol !== "https:") {
    return [
      lifecycleCheckBlocked(
        "webhook-lifecycle-target",
        "blocked: webhook-lifecycle requires a public HTTPS canonical API origin"
      )
    ]
  }
  const checks: SmokeCheck[] = []
  const targetUrl = new URL("/health", input.canonicalApiBaseUrl).toString()
  const createKey = randomUUID()
  const patchKey = randomUUID()
  const staleKey = randomUUID()
  const rotateKey = randomUUID()
  const deleteKey = randomUUID()
  const name = `API webhook lifecycle smoke ${randomUUID()}`
  const createBody = { eventTypes: ["query-match"], name, url: targetUrl }
  const list = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "webhook-lifecycle-list",
      method: "GET",
      path: "/api/webhooks?limit=1",
      validate: (body, response) =>
        lifecyclePage(body, response, "smoke-webhook-lifecycle-list", "/api/webhooks?limit=1", (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        )
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(list.check)
  const created = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: createBody,
      expectedStatus: 201,
      headers: { "idempotency-key": createKey },
      id: "webhook-lifecycle-create",
      method: "POST",
      path: "/api/webhooks",
      validate: (body, response) => {
        const data = webhookWithSecretData(body, input.canonicalApiBaseUrl)
        return (
          hasWebhookWithSecretResource(
            body,
            response,
            "smoke-webhook-lifecycle-create",
            "/api/webhooks",
            input.canonicalApiBaseUrl
          ) &&
          data !== undefined &&
          response.headers.get("etag") === data.webhook.revision &&
          response.headers.get("location") === `/api/webhooks/${encoded(String(data.webhook.id))}`
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(created.check)
  let createdData = webhookWithSecretData(created.body, input.canonicalApiBaseUrl)
  let fixtureIdentity = webhookFixtureIdentity(created.body)
  if (fixtureIdentity === undefined) {
    const recoveryReplay = await executeLifecycleRequest(
      input.baseUrl,
      input.fetchImpl,
      {
        body: createBody,
        expectedStatus: 201,
        headers: { "idempotency-key": createKey },
        id: "webhook-lifecycle-create-recovery-replay",
        method: "POST",
        path: "/api/webhooks",
        validate: (body, response) =>
          hasWebhookWithSecretResource(
            body,
            response,
            "smoke-webhook-lifecycle-create-recovery-replay",
            "/api/webhooks",
            input.canonicalApiBaseUrl
          )
      },
      input.token,
      input.requestTimeoutMs,
      input.callerSignal
    )
    checks.push(recoveryReplay.check)
    fixtureIdentity = webhookFixtureIdentity(recoveryReplay.body)
    createdData = webhookWithSecretData(recoveryReplay.body, input.canonicalApiBaseUrl)
  }
  if (fixtureIdentity === undefined) {
    checks.push(
      lifecycleCheckBlocked(
        "webhook-lifecycle-dependent-checks",
        "blocked: webhook creation did not produce a usable fixture"
      )
    )
    return checks
  }
  const id = fixtureIdentity.id
  const path = `/api/webhooks/${encoded(id)}`
  if (
    created.check.status !== "passed" ||
    createdData === undefined ||
    typeof createdData.webhook.revision !== "string"
  ) {
    checks.push(...(await cancelLifecycleWebhook(input, id, path)))
    return checks
  }
  const createdRevision = createdData.webhook.revision
  const createReplay = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: createBody,
      expectedStatus: 201,
      headers: { "idempotency-key": createKey },
      id: "webhook-lifecycle-create-replay",
      method: "POST",
      path: "/api/webhooks",
      validate: (body, response) => {
        const data = webhookWithSecretData(body, input.canonicalApiBaseUrl)
        return (
          hasWebhookWithSecretResource(
            body,
            response,
            "smoke-webhook-lifecycle-create-replay",
            "/api/webhooks",
            input.canonicalApiBaseUrl
          ) &&
          data?.webhook.id === id &&
          data.webhook.revision === createdData.webhook.revision &&
          data.keyId === createdData.keyId &&
          data.secret === createdData.secret
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(createReplay.check)
  const filteredPath = "/api/webhooks?status=pending-verification&eventType=query-match&limit=100"
  const filtered = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "webhook-lifecycle-pending-list",
      method: "GET",
      path: filteredPath,
      validate: (body, response) =>
        lifecyclePage(body, response, "smoke-webhook-lifecycle-pending-list", filteredPath, (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        ) &&
        isRecord(body) &&
        Array.isArray(body.data) &&
        body.data.some((value) => isRecord(value) && value.id === id)
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(filtered.check)
  const detail = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "webhook-lifecycle-detail",
      method: "GET",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-webhook-lifecycle-detail", path, (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        ) &&
        webhookData(body)?.id === id &&
        response.headers.get("etag") === createdData.webhook.revision
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(detail.check)
  const updatedName = `${name} updated`
  const patch = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { name: updatedName },
      expectedStatus: 200,
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": patchKey,
        "if-match": createdRevision
      },
      id: "webhook-lifecycle-patch",
      method: "PATCH",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) => {
        const data = webhookData(body)
        return (
          lifecycleResource(body, response, "smoke-webhook-lifecycle-patch", path, (value) =>
            hasWebhook(value, input.canonicalApiBaseUrl)
          ) &&
          data?.id === id &&
          data.name === updatedName &&
          typeof data.revision === "string" &&
          data.revision !== createdRevision &&
          response.headers.get("etag") === data.revision
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(patch.check)
  const patchedData = webhookData(patch.body)
  const patchedRevision = patchedData?.revision
  if (patch.check.status !== "passed" || typeof patchedRevision !== "string") {
    checks.push(...(await cancelLifecycleWebhook(input, id, path)))
    return checks
  }
  const patchReplay = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { name: updatedName },
      expectedStatus: 200,
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": patchKey,
        "if-match": createdRevision
      },
      id: "webhook-lifecycle-patch-replay",
      method: "PATCH",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-webhook-lifecycle-patch-replay", path, (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        ) &&
        webhookData(body)?.id === id &&
        webhookData(body)?.revision === patchedRevision &&
        response.headers.get("etag") === patchedRevision
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(patchReplay.check)
  const stale = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { status: "paused" },
      expectedStatus: 412,
      headers: {
        "content-type": "application/merge-patch+json",
        "idempotency-key": staleKey,
        "if-match": createdRevision
      },
      id: "webhook-lifecycle-stale-revision",
      method: "PATCH",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) =>
        hasErrorEnvelope(body, response.headers.get("x-correlation-id"), "precondition_failed") &&
        response.headers.get("x-correlation-id") === "smoke-webhook-lifecycle-stale-revision"
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(stale.check)
  const rotatePath = `${path}/rotate-secret`
  const rotate = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { overlapSeconds: 0 },
      expectedStatus: 200,
      headers: { "idempotency-key": rotateKey, "if-match": patchedRevision },
      id: "webhook-lifecycle-rotate-secret",
      method: "POST",
      path: rotatePath,
      reportPath: WEBHOOK_LIFECYCLE_ROTATE_PATH,
      validate: (body, response) => {
        const data = webhookWithSecretData(body, input.canonicalApiBaseUrl)
        return (
          hasWebhookWithSecretResource(
            body,
            response,
            "smoke-webhook-lifecycle-rotate-secret",
            rotatePath,
            input.canonicalApiBaseUrl
          ) &&
          data?.webhook.id === id &&
          data.webhook.revision !== patchedRevision &&
          data.secret !== createdData.secret &&
          data.keyId !== createdData.keyId &&
          Array.isArray(data.webhook.activeKeyIds) &&
          data.webhook.activeKeyIds.length === 1 &&
          data.webhook.activeKeyIds[0] === data.keyId &&
          data.webhook.overlapEndsAt === null &&
          response.headers.get("etag") === data.webhook.revision
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(rotate.check)
  const rotatedData = webhookWithSecretData(rotate.body, input.canonicalApiBaseUrl)
  const rotatedRevision = rotatedData?.webhook.revision
  if (rotate.check.status !== "passed" || rotatedData === undefined || typeof rotatedRevision !== "string") {
    checks.push(...(await cancelLifecycleWebhook(input, id, path)))
    return checks
  }
  const rotateReplay = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      body: { overlapSeconds: 0 },
      expectedStatus: 200,
      headers: { "idempotency-key": rotateKey, "if-match": patchedRevision },
      id: "webhook-lifecycle-rotate-secret-replay",
      method: "POST",
      path: rotatePath,
      reportPath: WEBHOOK_LIFECYCLE_ROTATE_PATH,
      validate: (body, response) => {
        const data = webhookWithSecretData(body, input.canonicalApiBaseUrl)
        return (
          hasWebhookWithSecretResource(
            body,
            response,
            "smoke-webhook-lifecycle-rotate-secret-replay",
            rotatePath,
            input.canonicalApiBaseUrl
          ) &&
          data?.webhook.id === id &&
          data.webhook.revision === rotatedRevision &&
          data.keyId === rotatedData.keyId &&
          data.secret === rotatedData.secret
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(rotateReplay.check)
  const postRotateDetail = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "webhook-lifecycle-post-rotate-detail",
      method: "GET",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-webhook-lifecycle-post-rotate-detail", path, (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        ) &&
        webhookData(body)?.id === id &&
        webhookData(body)?.revision === rotatedRevision &&
        response.headers.get("etag") === rotatedRevision
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(postRotateDetail.check)
  const cancellation = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      headers: { "idempotency-key": deleteKey, "if-match": rotatedRevision },
      id: "webhook-lifecycle-delete",
      method: "DELETE",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) => {
        const finalRevision = response.headers.get("etag")
        return (
          typeof finalRevision === "string" &&
          lifecycleResource(body, response, "smoke-webhook-lifecycle-delete", path, (value) =>
            isCancellationReceipt(value, id, finalRevision)
          )
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(cancellation.check)
  const cancellationReplay = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      headers: { "idempotency-key": deleteKey, "if-match": rotatedRevision },
      id: "webhook-lifecycle-delete-replay",
      method: "DELETE",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) => {
        const finalRevision = response.headers.get("etag")
        return (
          typeof finalRevision === "string" &&
          lifecycleResource(body, response, "smoke-webhook-lifecycle-delete-replay", path, (value) =>
            isCancellationReceipt(value, id, finalRevision)
          )
        )
      }
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(cancellationReplay.check)
  const cancelled = await executeLifecycleRequest(
    input.baseUrl,
    input.fetchImpl,
    {
      expectedStatus: 200,
      id: "webhook-lifecycle-cancelled-visibility",
      method: "GET",
      path,
      reportPath: WEBHOOK_LIFECYCLE_DETAIL_PATH,
      validate: (body, response) =>
        lifecycleResource(body, response, "smoke-webhook-lifecycle-cancelled-visibility", path, (value) =>
          hasWebhook(value, input.canonicalApiBaseUrl)
        ) &&
        webhookData(body)?.id === id &&
        webhookData(body)?.status === "cancelled" &&
        isRfc3339(webhookData(body)?.cancelledAt)
    },
    input.token,
    input.requestTimeoutMs,
    input.callerSignal
  )
  checks.push(cancelled.check)
  if (checks.slice(1).some((check) => check.status !== "passed")) {
    checks.push(...(await cancelLifecycleWebhook(input, id, path)))
  }
  return checks
}

export async function runApiSmoke(options: {
  baseUrl: string | URL
  canonicalApiBaseUrl?: string | URL
  fetchImpl?: FetchLike
  fixtures?: SmokeFixture
  profile?: SmokeProfile
  requireAuth?: boolean
  requestTimeoutMs?: number
  signal?: AbortSignal
  token?: string
}): Promise<SmokeReport> {
  const baseUrl = canonicalSmokeApiBaseUrl(options.baseUrl)
  const profile = options.profile ?? "full"
  if (
    (profile === "scoped-bills" ||
      profile === "vote-change" ||
      profile === "subscription-lifecycle" ||
      profile === "webhook-lifecycle") &&
    options.canonicalApiBaseUrl === undefined
  ) {
    throw new TypeError(`canonicalApiBaseUrl is required for the ${profile} smoke profile`)
  }
  const canonicalApiBaseUrl =
    options.canonicalApiBaseUrl === undefined ? undefined : canonicalSmokeApiBaseUrl(options.canonicalApiBaseUrl)
  const fetchImpl = options.fetchImpl ?? fetch
  const requireAuth = options.requireAuth ?? false
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000) {
    throw new RangeError("requestTimeoutMs must be an integer between 1 and 60000")
  }
  if (profile === "vote-change" && (!requireAuth || options.token === undefined)) {
    throw new Error("vote-change smoke requires authenticated mode and an explicit token")
  }
  if (profile === "subscription-lifecycle" || profile === "webhook-lifecycle") {
    if (!requireAuth || options.token === undefined) {
      throw new Error(`${profile} smoke requires authenticated mode and an explicit token`)
    }
    const checks = await (
      profile === "subscription-lifecycle" ? runSubscriptionLifecycleSmoke : runWebhookLifecycleSmoke
    )({
      baseUrl,
      canonicalApiBaseUrl: canonicalApiBaseUrl!,
      callerSignal: options.signal,
      fetchImpl,
      requestTimeoutMs,
      token: options.token
    })
    const passed = checks.filter((check) => check.status === "passed")
    const skipped = checks.filter((check) => check.status === "skipped")
    const blocked = checks.filter((check) => check.status === "blocked")
    const failed = checks.filter((check) => check.status === "failed")
    let status: SmokeReport["status"] = "passed"
    if (failed.length > 0) {
      status = "failed"
    } else if (blocked.length > 0) {
      status = "blocked"
    }
    return {
      blocked,
      checks,
      failed,
      passed,
      skipped,
      status
    }
  }
  const fixtures = options.fixtures ?? {}
  let fixtureDefinitions: readonly CheckDefinition[]
  if (profile === "full") {
    fixtureDefinitions = fixtureChecks(fixtures)
  } else if (profile === "vote-change") {
    fixtureDefinitions = voteChangeChecks(fixtures)
  } else {
    fixtureDefinitions = scopedBillChecks(fixtures)
  }
  const definitions =
    profile === "full"
      ? [
          ...ALWAYS_CHECKS,
          ...REGISTERED_EXACT_CHECKS,
          PAYLOAD_TOO_LARGE_CHECK,
          ...BLOCKED_ABSENCE_CHECKS,
          ...fixtureDefinitions
        ]
      : [...ALWAYS_CHECKS, ...fixtureDefinitions]
  const checks: SmokeCheck[] = []
  if (profile === "full") {
    checks.push(...missingFixtureChecks(fixtures, new Set(fixtureDefinitions.map((definition) => definition.id))))
  } else if (profile === "vote-change" && (fixtures.voteId === undefined || fixtures.changeId === undefined)) {
    checks.push({
      detail: "blocked: vote-change requires LEGISLATION_SMOKE_VOTE_ID and LEGISLATION_SMOKE_CHANGE_ID",
      id: "vote-change-fixtures",
      status: "blocked"
    })
  } else if (
    profile === "scoped-bills" &&
    (fixtures.jurisdictionId === undefined || fixtures.sessionId === undefined)
  ) {
    checks.push({
      detail: "blocked: scoped-bills requires LEGISLATION_SMOKE_JURISDICTION_ID and LEGISLATION_SMOKE_SESSION_ID",
      id: "scoped-bills-fixtures",
      status: "blocked"
    })
  }
  for (const definition of definitions) {
    if (definition.protected !== false && requireAuth && options.token === undefined) {
      checks.push(
        skippedCheck(
          definition,
          "blocked: an explicit LEGISLATION_SMOKE_TOKEN is required for authenticated mode",
          "blocked"
        )
      )
      continue
    }
    checks.push(
      await execute(
        baseUrl,
        fetchImpl,
        definition,
        definition.protected === false ? undefined : options.token,
        requestTimeoutMs,
        options.signal,
        canonicalApiBaseUrl
      )
    )
  }

  const authDefinition: CheckDefinition = {
    errorCategory: "unauthorized",
    expected: "error",
    id: "auth-rejection",
    path: "/api/bills?limit=1",
    requiresAuthHeader: true,
    statusCode: 401
  }
  if (requireAuth) {
    checks.push(
      await execute(
        baseUrl,
        fetchImpl,
        authDefinition,
        undefined,
        requestTimeoutMs,
        options.signal,
        canonicalApiBaseUrl
      )
    )
  } else {
    checks.push(skippedCheck(authDefinition, "skipped: authenticated mode is not enabled"))
  }

  const passed = checks.filter((check) => check.status === "passed")
  const skipped = checks.filter((check) => check.status === "skipped")
  const blocked = checks.filter((check) => check.status === "blocked")
  const failed = checks.filter((check) => check.status === "failed")
  let status: SmokeReport["status"] = "passed"
  if (failed.length > 0) {
    status = "failed"
  } else if (blocked.length > 0) {
    status = "blocked"
  }
  return {
    blocked,
    checks,
    failed,
    passed,
    skipped,
    status
  }
}
