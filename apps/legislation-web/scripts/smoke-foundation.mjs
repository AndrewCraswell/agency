const baseUrl = process.env.LEGISLATION_WEB_SMOKE_BASE_URL?.trim()
if (baseUrl === undefined || baseUrl === "") {
  throw new Error("LEGISLATION_WEB_SMOKE_BASE_URL is required")
}

const configuredTimeoutMs = process.env.LEGISLATION_WEB_SMOKE_TIMEOUT_MS?.trim()
const timeoutMs = configuredTimeoutMs === undefined || configuredTimeoutMs === "" ? 10_000 : Number(configuredTimeoutMs)
if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_TIMEOUT_MS must be an integer between 1000 and 30000")
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

process.stdout.write(
  `${JSON.stringify({
    health: health.status,
    homepage: homepage.status,
    profile: "foundation",
    ready: ready.status,
    timeoutMs,
    unknownRoute: unknownRoute.status,
    unsupportedMethods: { health: healthPost.status, ready: readyPost.status }
  })}\n`
)
