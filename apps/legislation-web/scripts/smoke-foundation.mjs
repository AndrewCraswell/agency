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
const smokeNx02a = configuredNx02a === "1"

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
  const method = options.method ?? "GET"
  const name = requestName(url, method)
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
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

process.stdout.write(
  `${JSON.stringify({
    health: health.status,
    homepage: homepage.status,
    ...(nx02a === undefined ? {} : { nx02a }),
    profile: smokeNx02a ? "foundation+nx-02a" : "foundation",
    ready: ready.status,
    timeoutMs,
    unknownRoute: unknownRoute.status,
    unsupportedMethods: { health: healthPost.status, ready: readyPost.status }
  })}\n`
)
