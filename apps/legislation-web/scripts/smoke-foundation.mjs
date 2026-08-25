const baseUrl = process.env.LEGISLATION_WEB_SMOKE_BASE_URL?.trim()
if (baseUrl === undefined || baseUrl === "") {
  throw new Error("LEGISLATION_WEB_SMOKE_BASE_URL is required")
}

const configuredTimeoutMs = process.env.LEGISLATION_WEB_SMOKE_TIMEOUT_MS?.trim()
const timeoutMs = configuredTimeoutMs === undefined || configuredTimeoutMs === "" ? 10_000 : Number(configuredTimeoutMs)
if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_TIMEOUT_MS must be an integer between 1000 and 30000")
}

const configuredNx02a = process.env.LEGISLATION_WEB_SMOKE_NX_02A?.trim()
if (configuredNx02a !== undefined && configuredNx02a !== "" && configuredNx02a !== "1") {
  throw new TypeError("LEGISLATION_WEB_SMOKE_NX_02A must be 1 when it is set")
}
const configuredNx02b = process.env.LEGISLATION_WEB_SMOKE_NX_02B?.trim()
if (configuredNx02b !== undefined && configuredNx02b !== "" && configuredNx02b !== "1") {
  throw new TypeError("LEGISLATION_WEB_SMOKE_NX_02B must be 1 when it is set")
}
const configuredNx02c = process.env.LEGISLATION_WEB_SMOKE_NX_02C?.trim()
if (configuredNx02c !== undefined && configuredNx02c !== "" && configuredNx02c !== "1") {
  throw new TypeError("LEGISLATION_WEB_SMOKE_NX_02C must be 1 when it is set")
}
const configuredNx03a = process.env.LEGISLATION_WEB_SMOKE_NX_03A?.trim()
if (configuredNx03a !== undefined && configuredNx03a !== "" && configuredNx03a !== "1") {
  throw new TypeError("LEGISLATION_WEB_SMOKE_NX_03A must be 1 when it is set")
}
const smokeNx03a = configuredNx03a === "1"
const smokeNx02c = configuredNx02c === "1"
const smokeNx02b = configuredNx02b === "1"
const smokeNx02cCumulative = smokeNx02c || smokeNx03a
const smokeNx02bCumulative = smokeNx02b || smokeNx02cCumulative
const smokeNx02a = configuredNx02a === "1" || smokeNx02bCumulative

function fixtureEnvironmentValue(name) {
  const configured = process.env[name]
  if (configured === undefined || configured.trim() === "") {
    return undefined
  }
  const value = configured.trim()
  if (
    value.length > 256 ||
    [...value].some((character) => character.codePointAt(0) <= 0x1f || character === "\u007F")
  ) {
    throw new TypeError(`${name} must be a non-empty fixture ID of at most 256 safe characters`)
  }
  return value
}

const nx02bFixtures = {
  amendmentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_AMENDMENT_ID"),
  billId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_BILL_ID"),
  voteId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_VOTE_ID")
}

const nx02cFixtures = {
  documentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_ID"),
  documentSectionId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID"),
  supportingMaterialId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID"),
  supportingMaterialSectionId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID")
}

const nx03aFixtures = {
  membershipId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID"),
  organizationId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_ORGANIZATION_ID"),
  personId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_PERSON_ID"),
  termId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_TERM_ID")
}

function smokeBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new TypeError("LEGISLATION_WEB_SMOKE_BASE_URL must be a valid credential-free HTTP(S) origin at its root")
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError("LEGISLATION_WEB_SMOKE_BASE_URL must be a credential-free HTTP(S) origin at its root")
  }
  return url
}

function requestName(url, method) {
  return `${method} ${url.pathname}`
}

async function smokeFetch(url, options = {}) {
  const { diagnosticName, ...fetchOptions } = options
  const method = fetchOptions.method ?? "GET"
  const name = diagnosticName ?? requestName(url, method)
  try {
    return await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const reason = error instanceof Error ? error.name : "request failure"
    throw new Error(`${name} failed within ${timeoutMs}ms (${reason})`)
  }
}

function requireCorrelationId(response, name, expectedCorrelationId) {
  const correlationId = response.headers.get("x-correlation-id")
  if (correlationId === null || correlationId.trim() === "") {
    throw new Error(`${name} did not return an x-correlation-id`)
  }
  if (expectedCorrelationId !== undefined && correlationId !== expectedCorrelationId) {
    throw new Error(`${name} did not preserve its x-correlation-id`)
  }
}

function requireResponse(response, name, expectedStatus, expectedContentType) {
  if (response.status !== expectedStatus) {
    throw new Error(`${name} returned status ${response.status}, expected ${expectedStatus}`)
  }
  if (expectedContentType !== undefined && !response.headers.get("content-type")?.includes(expectedContentType)) {
    throw new Error(`${name} did not return ${expectedContentType}`)
  }
}

function requirePrivateNoStore(response, name) {
  if (response.headers.get("cache-control") !== "private, no-store") {
    throw new Error(`${name} did not return cache-control private, no-store`)
  }
}

function requireEtag(response, name) {
  const etag = response.headers.get("etag")
  if (etag === null || etag === "") {
    throw new Error(`${name} did not return an etag`)
  }
  return etag
}

function isExactJsonObject(value, key, expectedValue) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    value[key] === expectedValue
  )
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(value, expectedKeys) {
  return isRecord(value) && Object.keys(value).sort().join(",") === [...expectedKeys].sort().join(",")
}

function requireNonEmptyString(value, description) {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${description} must be a non-empty string`)
  }
}

function requireStringArray(value, description) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${description} must be an array of strings`)
  }
}

function isSafeNonEmptyMessage(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    ![...value].some((character) => character.codePointAt(0) <= 0x1f || character === "\u007F")
  )
}

function requirePageEnvelope(body, name, expectedCorrelationId) {
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.some((item) => !isRecord(item))
  ) {
    throw new Error(`${name} did not return an exact Page envelope`)
  }
  if (
    !hasExactKeys(body.meta, ["correlationId", "limit", "nextCursor", "truncated", "warnings"]) ||
    !hasExactKeys(body.links, ["next", "self"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.limit !== 1 ||
    (body.meta.nextCursor !== null && (typeof body.meta.nextCursor !== "string" || body.meta.nextCursor === "")) ||
    typeof body.meta.truncated !== "boolean" ||
    !Array.isArray(body.meta.warnings) ||
    typeof body.links.self !== "string" ||
    (body.links.next !== null && (typeof body.links.next !== "string" || body.links.next === ""))
  ) {
    throw new Error(`${name} did not return a valid Page envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)
}

function requireResourceEnvelope(body, name, expectedCorrelationId, expectedId) {
  if (!hasExactKeys(body, ["data", "links", "meta"]) || !isRecord(body.data)) {
    throw new Error(`${name} did not return an exact Resource envelope`)
  }
  if (
    !hasExactKeys(body.meta, ["correlationId", "warnings"]) ||
    !hasExactKeys(body.links, ["self"]) ||
    body.data.id !== expectedId ||
    body.meta.correlationId !== expectedCorrelationId ||
    !Array.isArray(body.meta.warnings) ||
    typeof body.links.self !== "string"
  ) {
    throw new Error(`${name} did not return the expected Resource envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)
}

function requireBatchEnvelope(body, name, expectedCorrelationId, expectedId, expectedKind) {
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.length !== 1 ||
    !hasExactKeys(body.links, ["self"]) ||
    !hasExactKeys(body.meta, ["correlationId", "requested", "returned", "warnings"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.requested !== 1 ||
    body.meta.returned !== 1 ||
    typeof body.links.self !== "string"
  ) {
    throw new Error(`${name} did not return an exact Batch envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)

  const item = body.data[0]
  if (!isRecord(item)) {
    throw new Error(`${name} did not return a valid Batch item`)
  }
  if (item.status === "ok") {
    const id = expectedKind === "bill-amendments" ? item.billId : item.id
    const payload = expectedKind === "bill-amendments" ? item.page : item.data
    if (
      !hasExactKeys(
        item,
        expectedKind === "bill-amendments" ? ["billId", "page", "status"] : ["data", "id", "status"]
      ) ||
      id !== expectedId
    ) {
      throw new Error(`${name} did not return the expected Batch item`)
    }
    if (expectedKind === "bill-amendments") {
      requirePageEnvelope(payload, name, expectedCorrelationId)
    } else if (!isRecord(payload) || payload.id !== expectedId) {
      throw new Error(`${name} did not return the expected Batch resource`)
    }
    return "passed"
  }
  if (item.status !== "error") {
    throw new Error(`${name} did not return a Batch item with status ok or error`)
  }
  if (
    !hasExactKeys(
      item,
      expectedKind === "bill-amendments" ? ["billId", "error", "status"] : ["error", "id", "status"]
    ) ||
    (expectedKind === "bill-amendments" ? item.billId : item.id) !== expectedId ||
    !isRecord(item.error) ||
    !hasExactKeys(item.error, ["category", "message", "retryable"]) ||
    item.error.category !== "not_found" ||
    typeof item.error.message !== "string" ||
    item.error.message === "" ||
    item.error.retryable !== false
  ) {
    throw new Error(`${name} did not return a canonical missing-fixture Batch item`)
  }
  return "fixture_missing"
}

function requireResourceBatchEnvelope(body, name, expectedCorrelationId, expectedItems) {
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.length !== expectedItems.length ||
    !hasExactKeys(body.links, ["self"]) ||
    !hasExactKeys(body.meta, ["correlationId", "requested", "returned", "warnings"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.requested !== expectedItems.length ||
    body.meta.returned !== expectedItems.length ||
    typeof body.links.self !== "string"
  ) {
    throw new Error(`${name} did not return an exact resource Batch envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)

  for (const [index, expectedItem] of expectedItems.entries()) {
    const item = body.data[index]
    if (!isRecord(item) || item.id !== expectedItem.id) {
      throw new Error(`${name} did not return the expected resource Batch item`)
    }
    if (item.status === "ok" && (expectedItem.status === "ok" || expectedItem.status === "ok_or_error")) {
      if (
        !hasExactKeys(item, ["data", "id", "status"]) ||
        !isRecord(item.data) ||
        item.data.id !== expectedItem.id ||
        item.data.type !== expectedItem.type
      ) {
        throw new Error(`${name} did not return the expected successful resource Batch item`)
      }
      continue
    }
    if (
      !hasExactKeys(item, ["error", "id", "status"]) ||
      item.status !== "error" ||
      !isRecord(item.error) ||
      !hasExactKeys(item.error, ["category", "message", "retryable"]) ||
      item.error.category !== expectedItem.category ||
      !isSafeNonEmptyMessage(item.error.message) ||
      item.error.retryable !== expectedItem.retryable
    ) {
      throw new Error(`${name} did not return the expected resource Batch error item`)
    }
  }
}

function requireCanonicalNotFound(body, name, expectedCorrelationId) {
  if (!hasExactKeys(body, ["error"]) || !isRecord(body.error)) {
    throw new Error(`${name} did not return a canonical ErrorResponse`)
  }
  const expectedErrorKeys =
    body.error.details === undefined
      ? ["category", "correlationId", "message", "retryable"]
      : ["category", "correlationId", "details", "message", "retryable"]
  if (
    !hasExactKeys(body.error, expectedErrorKeys) ||
    body.error.category !== "not_found" ||
    body.error.correlationId !== expectedCorrelationId ||
    typeof body.error.message !== "string" ||
    body.error.message === "" ||
    body.error.retryable !== false
  ) {
    throw new Error(`${name} did not return a canonical not_found ErrorResponse`)
  }
  if (
    body.error.details !== undefined &&
    (!Array.isArray(body.error.details) ||
      body.error.details.some(
        (detail) =>
          !hasExactKeys(detail, ["field", "reason"]) ||
          typeof detail.field !== "string" ||
          typeof detail.reason !== "string"
      ))
  ) {
    throw new Error(`${name} did not return valid ErrorResponse details`)
  }
}

function requireCanonicalDataIncomplete(body, name, expectedCorrelationId) {
  if (
    !hasExactKeys(body, ["error"]) ||
    !hasExactKeys(body.error, ["category", "correlationId", "message", "retryable"]) ||
    body.error.category !== "unprocessable" ||
    body.error.correlationId !== expectedCorrelationId ||
    !isSafeNonEmptyMessage(body.error.message) ||
    body.error.retryable !== false
  ) {
    throw new Error(`${name} did not return a canonical data-incomplete ErrorResponse`)
  }
}

async function smokeCanonicalApiNotFound(root, path, correlationId) {
  const url = new URL(path, root)
  const name = requestName(url, "GET")
  const response = await smokeFetch(url, {
    headers: { "x-correlation-id": correlationId },
    redirect: "manual"
  })
  requireResponse(response, name, 404, "application/json")
  requireCorrelationId(response, name, correlationId)
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`${name} did not return a JSON ErrorResponse body`)
  }
  requireCanonicalNotFound(body, name, correlationId)
}

async function smokeConditionalGet(url, name, etag, correlationId) {
  const response = await smokeFetch(url, {
    diagnosticName: name,
    headers: { "if-none-match": etag, "x-correlation-id": correlationId }
  })
  requireResponse(response, name, 304)
  requirePrivateNoStore(response, name)
  requireCorrelationId(response, name, correlationId)
  if (response.headers.get("etag") !== etag) {
    throw new Error(`${name} did not preserve its etag for a conditional request`)
  }
}

async function smokeNx02aRoutes(root) {
  const jurisdictionId = "jurisdiction:ak"
  const sessionId = "session:ak:30"
  const jurisdictionSegment = encodeURIComponent(jurisdictionId)
  const sessionSegment = encodeURIComponent(sessionId)
  const routes = [
    { kind: "page", name: "jurisdictions", path: "/api/jurisdictions?limit=1" },
    {
      expectedId: jurisdictionId,
      fixtureBound: true,
      kind: "resource",
      name: "jurisdiction",
      path: `/api/jurisdictions/${jurisdictionSegment}`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction sessions",
      path: `/api/jurisdictions/${jurisdictionSegment}/sessions?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction bills",
      path: `/api/jurisdictions/${jurisdictionSegment}/bills?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction organizations",
      path: `/api/jurisdictions/${jurisdictionSegment}/organizations?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction commissions",
      path: `/api/jurisdictions/${jurisdictionSegment}/commissions?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction committees",
      path: `/api/jurisdictions/${jurisdictionSegment}/committees?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction meetings",
      path: `/api/jurisdictions/${jurisdictionSegment}/meetings?limit=1`
    },
    {
      expectedId: sessionId,
      fixtureBound: true,
      kind: "resource",
      name: "session",
      path: `/api/sessions/${sessionSegment}`
    },
    { fixtureBound: true, kind: "page", name: "session bills", path: `/api/sessions/${sessionSegment}/bills?limit=1` },
    {
      fixtureBound: true,
      kind: "page",
      name: "session meetings",
      path: `/api/sessions/${sessionSegment}/meetings?limit=1`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const url = new URL(route.path, root)
    const correlationId = `nx-02a-smoke-${index + 1}`
    const name = requestName(url, "GET")
    const response = await smokeFetch(url, { headers: { "x-correlation-id": correlationId } })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }

    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }

    if (route.fixtureBound && response.status === 404) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else {
      requireResourceEnvelope(body, name, correlationId, route.expectedId)
    }
    passed.push(route.name)
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/__deployment-smoke-missing__", "nx-02a-smoke-api-missing"),
    smokeCanonicalApiNotFound(root, "/api/jurisdictions/", "nx-02a-smoke-api-trailing-slash")
  ])

  return { notFound: ["unknown_api_path", "trailing_slash_api_path"], passed, skipped }
}

async function smokeNx02bRoutes(root) {
  const routes = [
    {
      kind: "page",
      name: "bills",
      path: "/api/bills?jurisdictionId=jurisdiction:ak&limit=1"
    },
    {
      kind: "page",
      name: "amendments",
      path: "/api/amendments?recordType=structured&jurisdictionId=jurisdiction:us&sort=identifier-asc&limit=1"
    },
    { kind: "page", name: "votes", path: "/api/votes?limit=1" },
    {
      body: (id) => ({ ids: [id] }),
      fixture: "billId",
      kind: "batch",
      name: "bill batch",
      method: "POST",
      path: "/api/bills/batch"
    },
    {
      body: (id) => ({ billIds: [id], limitPerBill: 1 }),
      fixture: "billId",
      kind: "bill-amendments",
      name: "bill amendments batch",
      method: "POST",
      path: "/api/bills/amendments/batch"
    },
    { fixture: "billId", kind: "resource", name: "bill", path: (id) => `/api/bills/${encodeURIComponent(id)}` },
    {
      fixture: "billId",
      kind: "page",
      name: "bill timeline",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/timeline?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "related bills",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/related?mode=explicit&limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill sections",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/sections?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill amendments",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/amendments?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill votes",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/votes?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill documents",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/documents?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill changes",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/changes?limit=1`
    },
    {
      body: (id) => ({ ids: [id] }),
      fixture: "amendmentId",
      kind: "batch",
      name: "amendment batch",
      method: "POST",
      path: "/api/amendments/batch"
    },
    {
      fixture: "amendmentId",
      kind: "resource",
      name: "amendment",
      path: (id) => `/api/amendments/${encodeURIComponent(id)}`
    },
    {
      body: (id) => ({ ids: [id] }),
      fixture: "voteId",
      kind: "batch",
      name: "vote batch",
      method: "POST",
      path: "/api/votes/batch"
    },
    { fixture: "voteId", kind: "resource", name: "vote", path: (id) => `/api/votes/${encodeURIComponent(id)}` },
    {
      fixture: "voteId",
      kind: "page",
      name: "vote positions",
      path: (id) => `/api/votes/${encodeURIComponent(id)}/positions?limit=1`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const fixtureId = route.fixture === undefined ? undefined : nx02bFixtures[route.fixture]
    if (route.fixture !== undefined && fixtureId === undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${route.fixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(fixtureId) : route.path
    const url = new URL(path, root)
    const method = route.method ?? "GET"
    const correlationId = `nx-02b-smoke-${index + 1}`
    const name = `${method} ${route.name}`
    const response = await smokeFetch(url, {
      ...(route.body === undefined ? {} : { body: JSON.stringify(route.body(fixtureId)) }),
      diagnosticName: name,
      headers: {
        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
        "x-correlation-id": correlationId
      },
      method
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (response.status === 404 && route.fixture !== undefined) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    if (method === "GET") {
      requirePrivateNoStore(response, name)
      const etag = requireEtag(response, name)
      await smokeConditionalGet(url, `conditional GET ${route.name}`, etag, `nx-02b-smoke-conditional-${index + 1}`)
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
      passed.push(route.name)
    } else if (route.kind === "resource") {
      requireResourceEnvelope(body, name, correlationId, fixtureId)
      passed.push(route.name)
    } else if (requireBatchEnvelope(body, name, correlationId, fixtureId, route.kind) === "passed") {
      passed.push(route.name)
    } else {
      skipped.push({ name: route.name, reason: "fixture_missing" })
    }
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/bills/", "nx-02b-smoke-bills-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/amendments/", "nx-02b-smoke-amendments-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/votes/", "nx-02b-smoke-votes-trailing-slash")
  ])

  return { notFound: ["bills_trailing_slash", "amendments_trailing_slash", "votes_trailing_slash"], passed, skipped }
}

function missingFixtureName(route) {
  return route.fixtures.find((fixture) => nx02cFixtures[fixture] === undefined)
}

async function smokeNx02cRoutes(root) {
  const routes = [
    {
      fixtures: ["documentId"],
      kind: "resource",
      name: "document",
      path: ({ documentId }) => `/api/documents/${encodeURIComponent(documentId)}`
    },
    {
      fixtures: ["documentId"],
      kind: "page",
      name: "document sections",
      path: ({ documentId }) => `/api/documents/${encodeURIComponent(documentId)}/sections?limit=1`
    },
    {
      fixtures: ["documentId", "documentSectionId"],
      kind: "resource",
      name: "document section",
      path: ({ documentId, documentSectionId }) =>
        `/api/documents/${encodeURIComponent(documentId)}/sections/${encodeURIComponent(documentSectionId)}`
    },
    {
      fixtures: [],
      kind: "page",
      name: "supporting materials",
      path: "/api/supporting-materials?jurisdictionId=jurisdiction%3Aus&classification=committee-report&limit=1"
    },
    {
      fixtures: ["supportingMaterialId"],
      kind: "resource",
      name: "supporting material",
      path: ({ supportingMaterialId }) => `/api/supporting-materials/${encodeURIComponent(supportingMaterialId)}`
    },
    {
      fixtures: ["supportingMaterialId"],
      kind: "page",
      name: "supporting material sections",
      path: ({ supportingMaterialId }) =>
        `/api/supporting-materials/${encodeURIComponent(supportingMaterialId)}/sections?limit=1`
    },
    {
      fixtures: ["supportingMaterialId", "supportingMaterialSectionId"],
      kind: "resource",
      name: "supporting material section",
      path: ({ supportingMaterialId, supportingMaterialSectionId }) =>
        `/api/supporting-materials/${encodeURIComponent(supportingMaterialId)}/sections/${encodeURIComponent(
          supportingMaterialSectionId
        )}`
    },
    { fixtures: [], kind: "page", name: "changes", path: "/api/changes?limit=1" },
    {
      body: ({ documentId, supportingMaterialId }) => ({
        items: [
          { id: documentId, type: "document" },
          { id: supportingMaterialId, type: "supporting-material" },
          { id: "document:__deployment-smoke-missing__", type: "document" }
        ]
      }),
      fixtures: ["documentId", "supportingMaterialId"],
      kind: "resource-batch",
      method: "POST",
      name: "resource batch",
      path: "/api/resources/batch"
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const missingFixture = missingFixtureName(route)
    if (missingFixture !== undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${missingFixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(nx02cFixtures) : route.path
    const url = new URL(path, root)
    const method = route.method ?? "GET"
    const correlationId = `nx-02c-smoke-${index + 1}`
    const name = `${method} ${route.name}`
    const response = await smokeFetch(url, {
      ...(route.body === undefined ? {} : { body: JSON.stringify(route.body(nx02cFixtures)) }),
      diagnosticName: name,
      headers: {
        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
        "x-correlation-id": correlationId
      },
      method
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (["changes", "document", "document sections"].includes(route.name) && response.status === 422) {
      requireCanonicalDataIncomplete(body, name, correlationId)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (response.status === 404 && route.fixtures.length > 0) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    if (method === "GET") {
      requirePrivateNoStore(response, name)
      const etag = requireEtag(response, name)
      await smokeConditionalGet(url, `conditional GET ${route.name}`, etag, `nx-02c-smoke-conditional-${index + 1}`)
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else if (route.kind === "resource") {
      requireResourceEnvelope(body, name, correlationId, nx02cFixtures[route.fixtures.at(-1)])
    } else {
      requireResourceBatchEnvelope(body, name, correlationId, [
        {
          category: "dependency_unavailable",
          id: nx02cFixtures.documentId,
          retryable: true,
          status: "ok_or_error",
          type: "document"
        },
        { id: nx02cFixtures.supportingMaterialId, status: "ok", type: "supporting-material" },
        {
          category: "not_found",
          id: "document:__deployment-smoke-missing__",
          retryable: false,
          status: "error"
        }
      ])
    }
    passed.push(route.name)
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/documents/", "nx-02c-smoke-documents-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/supporting-materials/", "nx-02c-smoke-supporting-materials-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/changes/", "nx-02c-smoke-changes-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/resources/batch/", "nx-02c-smoke-resource-batch-trailing-slash")
  ])

  return {
    notFound: [
      "documents_trailing_slash",
      "supporting_materials_trailing_slash",
      "changes_trailing_slash",
      "resource_batch_trailing_slash"
    ],
    passed,
    skipped
  }
}

function missingNx03aFixtureName(route) {
  return route.fixtures.find((fixture) => nx03aFixtures[fixture] === undefined)
}

async function smokeNx03aRoutes(root) {
  const canonicalDataIncompleteRoutes = new Set(["organization", "organizations", "person", "person term"])
  const routes = [
    { fixtures: [], kind: "page", name: "people", path: "/api/people?limit=1" },
    {
      fixtures: ["personId"],
      kind: "resource",
      name: "person",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person bills",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/bills?limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person amendments",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/amendments?limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person votes",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/votes?limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person memberships",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/memberships?limit=1`
    },
    {
      fixtures: ["personId", "termId"],
      kind: "resource",
      name: "person term",
      path: ({ personId, termId }) => `/api/people/${encodeURIComponent(personId)}/terms/${encodeURIComponent(termId)}`
    },
    { fixtures: [], kind: "page", name: "organizations", path: "/api/organizations?limit=1" },
    {
      fixtures: ["organizationId"],
      kind: "resource",
      name: "organization",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization members",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/members?limit=1`
    },
    {
      fixtures: ["organizationId", "membershipId"],
      kind: "resource",
      name: "organization membership",
      path: ({ organizationId, membershipId }) =>
        `/api/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization meetings",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/meetings?limit=1`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization bills",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/bills?limit=1`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization calendars",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/calendars?limit=1`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const missingFixture = missingNx03aFixtureName(route)
    if (missingFixture !== undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${missingFixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(nx03aFixtures) : route.path
    const url = new URL(path, root)
    const correlationId = `nx-03a-smoke-${index + 1}`
    const name = `GET ${route.name}`
    const response = await smokeFetch(url, {
      diagnosticName: name,
      headers: { "x-correlation-id": correlationId }
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (canonicalDataIncompleteRoutes.has(route.name) && response.status === 422) {
      requireCanonicalDataIncomplete(body, name, correlationId)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (route.name === "organization membership" && response.status === 404) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    requirePrivateNoStore(response, name)
    const etag = requireEtag(response, name)
    await smokeConditionalGet(url, `conditional GET ${route.name}`, etag, `nx-03a-smoke-conditional-${index + 1}`)
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else {
      requireResourceEnvelope(body, name, correlationId, nx03aFixtures[route.fixtures.at(-1)])
    }
    passed.push(route.name)
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/people/", "nx-03a-smoke-people-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/organizations/", "nx-03a-smoke-organizations-trailing-slash")
  ])

  return {
    notFound: ["people_trailing_slash", "organizations_trailing_slash"],
    passed,
    skipped
  }
}

const root = smokeBaseUrl(baseUrl)
const healthUrl = new URL("/health", root)
const readyUrl = new URL("/ready", root)
const unknownUrl = new URL("/__deployment-smoke-missing__", root)
const healthCorrelationId = "foundation-smoke-health"
const readyCorrelationId = "foundation-smoke-ready"

const [health, ready, homepage, unknownRoute, healthPost, readyPost] = await Promise.all([
  smokeFetch(healthUrl, { headers: { "x-correlation-id": healthCorrelationId } }),
  smokeFetch(readyUrl, { headers: { "x-correlation-id": readyCorrelationId } }),
  smokeFetch(root),
  smokeFetch(unknownUrl),
  smokeFetch(healthUrl, { method: "POST" }),
  smokeFetch(readyUrl, { method: "POST" })
])

requireResponse(health, requestName(healthUrl, "GET"), 200, "application/json")
requireResponse(ready, requestName(readyUrl, "GET"), 200, "application/json")
requireResponse(homepage, requestName(root, "GET"), 200, "text/html")
requireResponse(unknownRoute, requestName(unknownUrl, "GET"), 404)
requireResponse(healthPost, requestName(healthUrl, "POST"), 404, "application/json")
requireResponse(readyPost, requestName(readyUrl, "POST"), 404, "application/json")
requireCorrelationId(health, requestName(healthUrl, "GET"), healthCorrelationId)
requireCorrelationId(ready, requestName(readyUrl, "GET"), readyCorrelationId)

const [healthBody, readyBody, homepageMarkup, healthPostBody, readyPostBody] = await Promise.all([
  health.json(),
  ready.json(),
  homepage.text(),
  healthPost.json(),
  readyPost.json()
])
if (!isExactJsonObject(healthBody, "status", "ok") || readyBody?.status !== "ready") {
  throw new Error("Health and readiness routes did not return their expected JSON status payloads")
}
if (
  !isExactJsonObject(healthPostBody, "error", "not_found") ||
  !isExactJsonObject(readyPostBody, "error", "not_found")
) {
  throw new Error("Unsupported methods did not return the expected JSON not-found payload")
}
if (!homepageMarkup.includes("<main")) {
  throw new Error("GET / did not render the foundation placeholder page")
}

const nx02a = smokeNx02a ? await smokeNx02aRoutes(root) : undefined
const nx02b = smokeNx02bCumulative ? await smokeNx02bRoutes(root) : undefined
const nx02c = smokeNx02cCumulative ? await smokeNx02cRoutes(root) : undefined
const nx03a = smokeNx03a ? await smokeNx03aRoutes(root) : undefined
let profile = "foundation"
if (smokeNx02a) {
  profile = "foundation+nx-02a"
}
if (smokeNx02bCumulative) {
  profile = "foundation+nx-02a+nx-02b"
}
if (smokeNx02c) {
  profile = "foundation+nx-02a+nx-02b+nx-02c"
}
if (smokeNx03a) {
  profile = "foundation+nx-02a+nx-02b+nx-02c+nx-03a"
}

process.stdout.write(
  `${JSON.stringify({
    health: health.status,
    homepage: homepage.status,
    ...(nx02a === undefined ? {} : { nx02a }),
    ...(nx02b === undefined ? {} : { nx02b }),
    ...(nx02c === undefined ? {} : { nx02c }),
    ...(nx03a === undefined ? {} : { nx03a }),
    profile,
    ready: ready.status,
    timeoutMs,
    unknownRoute: unknownRoute.status,
    unsupportedMethods: { health: healthPost.status, ready: readyPost.status }
  })}\n`
)
