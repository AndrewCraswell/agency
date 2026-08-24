import { isRfc3339Timestamp } from "./canonical-projection.js"

export type SmokeCheckStatus = "blocked" | "failed" | "passed" | "skipped"

export type SmokeFixture = Readonly<{
  amendmentId?: string
  billId?: string
  documentId?: string
  documentIdB?: string
  jurisdictionId?: string
  materialId?: string
  meetingId?: string
  organizationId?: string
  personId?: string
  sessionId?: string
  voteId?: string
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
  expected: "batch" | "calculation" | "error" | "health" | "page" | "resource" | "search"
  healthStatus?: "ok" | "ready"
  id: string
  method?: "GET" | "POST"
  path: string
  protected?: boolean
  requiresAuthHeader?: boolean
  statusCode?: number
}>

const LIST_CHECKS: readonly CheckDefinition[] = [
  { expected: "page", id: "list-jurisdictions", path: "/api/jurisdictions?limit=1" },
  { expected: "page", id: "list-bills", path: "/api/bills?limit=1" },
  { expected: "page", id: "list-amendments", path: "/api/amendments?limit=1" },
  { expected: "page", id: "list-votes", path: "/api/votes?limit=1" },
  { expected: "page", id: "list-people", path: "/api/people?limit=1" },
  { expected: "page", id: "list-organizations", path: "/api/organizations?limit=1" },
  { expected: "page", id: "list-meetings", path: "/api/meetings?limit=1" },
  { expected: "page", id: "list-supporting-materials", path: "/api/supporting-materials?limit=1" },
  { expected: "page", id: "list-changes", path: "/api/changes?limit=1" },
  {
    body: { limit: 1, mode: "lexical", query: "legislation" },
    expected: "search",
    id: "search-bills",
    method: "POST",
    path: "/api/search/bills"
  },
  {
    body: { limit: 1, mode: "lexical", query: "legislation" },
    expected: "search",
    id: "search-amendments",
    method: "POST",
    path: "/api/search/amendments"
  },
  {
    body: { limit: 1, mode: "lexical", query: "legislation" },
    expected: "search",
    id: "search-passages",
    method: "POST",
    path: "/api/search/passages"
  },
  {
    body: { limit: 1, mode: "lexical", query: "legislation" },
    expected: "search",
    id: "search-supporting-materials",
    method: "POST",
    path: "/api/search/supporting-materials"
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

const OPTIONAL_CHECKS: readonly Readonly<{ definition: CheckDefinition; fixtures: readonly (keyof SmokeFixture)[] }>[] =
  [
    {
      definition: { expected: "resource", id: "get-jurisdiction", path: "/api/jurisdictions/{jurisdictionId}" },
      fixtures: ["jurisdictionId"]
    },
    {
      definition: {
        expected: "page",
        id: "list-jurisdiction-sessions",
        path: "/api/jurisdictions/{jurisdictionId}/sessions"
      },
      fixtures: ["jurisdictionId"]
    },
    {
      definition: {
        expected: "page",
        id: "list-jurisdiction-bills",
        path: "/api/jurisdictions/{jurisdictionId}/bills"
      },
      fixtures: ["jurisdictionId"]
    },
    {
      definition: {
        expected: "page",
        id: "list-jurisdiction-meetings",
        path: "/api/jurisdictions/{jurisdictionId}/meetings"
      },
      fixtures: ["jurisdictionId"]
    },
    {
      definition: { expected: "resource", id: "get-session", path: "/api/sessions/{sessionId}" },
      fixtures: ["sessionId"]
    },
    {
      definition: { expected: "page", id: "list-session-bills", path: "/api/sessions/{sessionId}/bills" },
      fixtures: ["sessionId"]
    },
    {
      definition: { expected: "resource", id: "get-bill", path: "/api/bills/{billId}" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "page", id: "get-bill-timeline", path: "/api/bills/{billId}/timeline" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "page", id: "get-related-bills", path: "/api/bills/{billId}/related" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "page", id: "get-bill-sections", path: "/api/bills/{billId}/sections" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "page", id: "list-bill-amendments", path: "/api/bills/{billId}/amendments" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "page", id: "list-bill-votes", path: "/api/bills/{billId}/votes" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "page", id: "list-bill-changes", path: "/api/bills/{billId}/changes" },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "batch", id: "batch-bills", method: "POST", path: "/api/bills/batch" },
      fixtures: ["billId"]
    },
    {
      definition: {
        expected: "batch",
        id: "batch-bill-amendments",
        method: "POST",
        path: "/api/bills/amendments/batch"
      },
      fixtures: ["billId"]
    },
    {
      definition: { expected: "resource", id: "get-amendment", path: "/api/amendments/{amendmentId}" },
      fixtures: ["amendmentId"]
    },
    {
      definition: { expected: "batch", id: "batch-amendments", method: "POST", path: "/api/amendments/batch" },
      fixtures: ["amendmentId"]
    },
    {
      definition: { expected: "resource", id: "get-vote", path: "/api/votes/{voteId}" },
      fixtures: ["voteId"]
    },
    {
      definition: { expected: "page", id: "list-vote-positions", path: "/api/votes/{voteId}/positions" },
      fixtures: ["voteId"]
    },
    {
      definition: { expected: "batch", id: "batch-votes", method: "POST", path: "/api/votes/batch" },
      fixtures: ["voteId"]
    },
    {
      definition: { expected: "resource", id: "get-document", path: "/api/documents/{documentId}" },
      fixtures: ["documentId"]
    },
    {
      definition: { expected: "page", id: "get-document-sections", path: "/api/documents/{documentId}/sections" },
      fixtures: ["documentId"]
    },
    {
      definition: {
        expected: "resource",
        id: "get-supporting-material",
        path: "/api/supporting-materials/{materialId}"
      },
      fixtures: ["materialId"]
    },
    {
      definition: { expected: "resource", id: "get-meeting", path: "/api/meetings/{meetingId}" },
      fixtures: ["meetingId"]
    },
    {
      definition: { expected: "resource", id: "get-person", path: "/api/people/{personId}" },
      fixtures: ["personId"]
    },
    {
      definition: { expected: "resource", id: "get-organization", path: "/api/organizations/{organizationId}" },
      fixtures: ["organizationId"]
    },
    {
      definition: {
        expected: "page",
        id: "list-organization-meetings",
        path: "/api/organizations/{organizationId}/meetings"
      },
      fixtures: ["organizationId"]
    },
    {
      definition: { expected: "calculation", id: "document-diff", method: "POST", path: "/api/document-diffs" },
      fixtures: ["billId", "documentId", "documentIdB"]
    }
  ]

function encoded(id: string): string {
  return encodeURIComponent(id)
}

function fixtureChecks(fixture: SmokeFixture): readonly CheckDefinition[] {
  const checks: CheckDefinition[] = []
  const add = (id: string, path: string, expected: CheckDefinition["expected"] = "resource", protectedRoute = true) =>
    checks.push({ expected, id, path, protected: protectedRoute })
  const addPage = (id: string, path: string) => add(id, path, "page")

  if (fixture.jurisdictionId !== undefined) {
    const id = encoded(fixture.jurisdictionId)
    add("get-jurisdiction", `/api/jurisdictions/${id}`)
    addPage("list-jurisdiction-sessions", `/api/jurisdictions/${id}/sessions?limit=1`)
    addPage("list-jurisdiction-bills", `/api/jurisdictions/${id}/bills?limit=1`)
    addPage("list-jurisdiction-meetings", `/api/jurisdictions/${id}/meetings?limit=1`)
  }
  if (fixture.sessionId !== undefined) {
    const id = encoded(fixture.sessionId)
    add("get-session", `/api/sessions/${id}`)
    addPage("list-session-bills", `/api/sessions/${id}/bills?limit=1`)
  }
  if (fixture.billId !== undefined) {
    const id = encoded(fixture.billId)
    add("get-bill", `/api/bills/${id}`)
    addPage("get-bill-timeline", `/api/bills/${id}/timeline?limit=1`)
    addPage("get-related-bills", `/api/bills/${id}/related?limit=1&mode=explicit`)
    addPage("get-bill-sections", `/api/bills/${id}/sections?limit=1`)
    addPage("list-bill-amendments", `/api/bills/${id}/amendments?limit=1`)
    addPage("list-bill-votes", `/api/bills/${id}/votes?limit=1`)
    addPage("list-bill-changes", `/api/bills/${id}/changes?limit=1`)
    checks.push({
      body: { ids: [fixture.billId] },
      expected: "batch",
      id: "batch-bills",
      method: "POST",
      path: "/api/bills/batch"
    })
    checks.push({
      body: { billIds: [fixture.billId], limitPerBill: 1 },
      expected: "batch",
      id: "batch-bill-amendments",
      method: "POST",
      path: "/api/bills/amendments/batch"
    })
  }
  if (fixture.amendmentId !== undefined) {
    const id = encoded(fixture.amendmentId)
    add("get-amendment", `/api/amendments/${id}`)
    checks.push({
      body: { ids: [fixture.amendmentId] },
      expected: "batch",
      id: "batch-amendments",
      method: "POST",
      path: "/api/amendments/batch"
    })
  }
  if (fixture.voteId !== undefined) {
    const id = encoded(fixture.voteId)
    add("get-vote", `/api/votes/${id}`)
    addPage("list-vote-positions", `/api/votes/${id}/positions?limit=1`)
    checks.push({
      body: { ids: [fixture.voteId] },
      expected: "batch",
      id: "batch-votes",
      method: "POST",
      path: "/api/votes/batch"
    })
  }
  if (fixture.documentId !== undefined) {
    const id = encoded(fixture.documentId)
    add("get-document", `/api/documents/${id}`)
    addPage("get-document-sections", `/api/documents/${id}/sections?limit=1`)
  }
  if (fixture.materialId !== undefined) {
    add("get-supporting-material", `/api/supporting-materials/${encoded(fixture.materialId)}`)
  }
  if (fixture.meetingId !== undefined) {
    add("get-meeting", `/api/meetings/${encoded(fixture.meetingId)}`)
  }
  if (fixture.personId !== undefined) {
    add("get-person", `/api/people/${encoded(fixture.personId)}`)
  }
  if (fixture.organizationId !== undefined) {
    add("get-organization", `/api/organizations/${encoded(fixture.organizationId)}`)
    addPage("list-organization-meetings", `/api/organizations/${encoded(fixture.organizationId)}/meetings?limit=1`)
  }
  if (fixture.billId !== undefined && fixture.documentId !== undefined && fixture.documentIdB !== undefined) {
    checks.push({
      body: {
        billId: fixture.billId,
        leftDocumentId: fixture.documentId,
        rightDocumentId: fixture.documentIdB
      },
      expected: "calculation",
      id: "document-diff",
      method: "POST",
      path: "/api/document-diffs"
    })
  }
  return checks
}

function missingFixtureChecks(fixture: SmokeFixture, present: ReadonlySet<string>): readonly SmokeCheck[] {
  return OPTIONAL_CHECKS.flatMap(({ definition, fixtures }) => {
    if (present.has(definition.id) || fixtures.every((name) => fixture[name] !== undefined)) {
      return []
    }
    const names = fixtures.map(
      (name) => `LEGISLATION_SMOKE_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`
    )
    return [skippedCheck(definition, `skipped: provide ${names.join(" and ")} to exercise this route`)]
  })
}

function skippedCheck(definition: CheckDefinition, detail: string, status: SmokeCheckStatus = "skipped"): SmokeCheck {
  return { detail, id: definition.id, method: definition.method ?? "GET", path: definition.path, status }
}

function responseDetail(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined
  }
  const error = "error" in body ? body.error : undefined
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return undefined
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
  return value.sources.every((source) => {
    if (
      !isRecord(source) ||
      typeof source.provider !== "string" ||
      source.provider.trim() === "" ||
      !isAbsoluteHttpUrl(source.sourceUrl) ||
      !isRfc3339(source.retrievedAt) ||
      typeof source.isOfficial !== "boolean"
    ) {
      return false
    }
    return source.sourceUpdatedAt === null || isRfc3339(source.sourceUpdatedAt)
  })
}

function hasPageEnvelope(body: Record<string, unknown>, itemsMustBeCanonical: boolean): boolean {
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
    !Array.isArray(body.data)
  ) {
    return false
  }
  return !itemsMustBeCanonical || body.data.every((item) => hasCanonicalRecord(item))
}

function hasSearchEnvelope(body: Record<string, unknown>): boolean {
  if (!hasPageEnvelope(body, true)) {
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

function hasBatchEnvelope(body: Record<string, unknown>): boolean {
  const data = body.data
  const links = body.links
  const meta = body.meta
  if (
    !isRecord(links) ||
    typeof links.self !== "string" ||
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

function hasErrorEnvelope(body: unknown, header: string | null, category: string | undefined): boolean {
  if (header === null || header.trim() === "" || !isRecord(body) || !("error" in body) || !isRecord(body.error)) {
    return false
  }
  return (
    typeof body.error.category === "string" &&
    (category === undefined || body.error.category === category) &&
    typeof body.error.message === "string" &&
    body.error.message.trim() !== "" &&
    body.error.correlationId === header &&
    typeof body.error.retryable === "boolean"
  )
}

function hasExpectedEnvelope(
  body: unknown,
  expected: CheckDefinition["expected"],
  healthStatus: CheckDefinition["healthStatus"]
): boolean {
  if (expected === "health") {
    return isRecord(body) && body.status === healthStatus
  }
  if (!isRecord(body)) {
    return false
  }
  if (expected === "resource") {
    return hasCanonicalRecord(body.data)
  }
  if (expected === "calculation") {
    return isRecord(body.data)
  }
  if (expected === "search") {
    return hasSearchEnvelope(body)
  }
  if (expected === "batch") {
    return hasBatchEnvelope(body)
  }
  return hasPageEnvelope(body, true)
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
  callerSignal: AbortSignal | undefined
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
  if (definition.expected === "error") {
    if (response.status !== definition.statusCode) {
      return {
        detail: `expected HTTP ${definition.statusCode}, got ${response.status}${responseDetail(body) === undefined ? "" : `: ${responseDetail(body)}`}`,
        id: definition.id,
        method: definition.method ?? "GET",
        path: definition.path,
        status: "failed",
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
      response.status === 404 || response.status === 501 || response.status === 503 ? "blocked" : "failed"
    return {
      detail: `HTTP ${response.status}${responseDetail(body) === undefined ? "" : `: ${responseDetail(body)}`}`,
      id: definition.id,
      method: definition.method ?? "GET",
      path: definition.path,
      status: category,
      statusCode: response.status
    }
  } else if (
    !hasExpectedEnvelope(body, definition.expected, definition.healthStatus) ||
    (definition.expected === "health"
      ? response.headers.get("x-correlation-id") !== `smoke-${definition.id}`
      : !hasApiCorrelation(body, response.headers.get("x-correlation-id")))
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

export async function runApiSmoke(options: {
  baseUrl: string | URL
  fetchImpl?: FetchLike
  fixtures?: SmokeFixture
  requireAuth?: boolean
  requestTimeoutMs?: number
  signal?: AbortSignal
  token?: string
}): Promise<SmokeReport> {
  const baseUrl = new URL(options.baseUrl)
  const fetchImpl = options.fetchImpl ?? fetch
  const requireAuth = options.requireAuth ?? false
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000) {
    throw new RangeError("requestTimeoutMs must be an integer between 1 and 60000")
  }
  const fixtures = options.fixtures ?? {}
  const fixtureDefinitions = fixtureChecks(fixtures)
  const definitions = [...ALWAYS_CHECKS, ...LIST_CHECKS, ...fixtureDefinitions]
  const checks: SmokeCheck[] = []
  checks.push(...missingFixtureChecks(fixtures, new Set(fixtureDefinitions.map((definition) => definition.id))))
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
        options.signal
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
    checks.push(await execute(baseUrl, fetchImpl, authDefinition, undefined, requestTimeoutMs, options.signal))
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
