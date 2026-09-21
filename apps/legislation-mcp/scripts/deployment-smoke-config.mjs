const fullCommitSha = /^[0-9a-f]{40}$/u
const stagingMcpOrigin = "https://legislation-mcp-staging.up.railway.app"
const maximumTokenResponseBytes = 65_536
const maximumTokenLifetimeSeconds = 24 * 60 * 60
export const sentryCanaryRedactionValue = "Bearer staging-canary-must-be-redacted"

function required(environment, name) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export function deploymentSmokeConfig(environment) {
  const base = URL.parse(environment.LEGISLATION_MCP_SMOKE_BASE_URL ?? "")
  if (
    !base ||
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("LEGISLATION_MCP_SMOKE_BASE_URL must be a credential-free HTTPS origin")
  }
  const expectedCommitSha = (
    environment.LEGISLATION_DEPLOYMENT_COMMIT_SHA?.trim() ||
    environment.GITHUB_SHA?.trim() ||
    ""
  ).toLowerCase()
  if (!fullCommitSha.test(expectedCommitSha)) {
    throw new Error("LEGISLATION_DEPLOYMENT_COMMIT_SHA or GITHUB_SHA must be a full Git commit SHA")
  }
  const fullStateAcceptance = environment.LEGISLATION_MCP_SMOKE_FULL === "true"
  const jurisdictionId = environment.LEGISLATION_SMOKE_JURISDICTION_ID?.trim()
  const sessionId = environment.LEGISLATION_SMOKE_SESSION_ID?.trim()
  if (fullStateAcceptance && (!jurisdictionId || !sessionId)) {
    throw new Error(
      "LEGISLATION_SMOKE_JURISDICTION_ID and LEGISLATION_SMOKE_SESSION_ID are required for full acceptance"
    )
  }
  const sentryCanary = environment.LEGISLATION_SENTRY_CANARY === "true"
  if (sentryCanary) {
    if (base.origin !== stagingMcpOrigin || environment.LEGISLATION_SENTRY_ENVIRONMENT !== "staging") {
      throw new Error("The controlled Sentry canary is restricted to the canonical staging MCP environment")
    }
    for (const name of [
      "RAILWAY_PROJECT_ID",
      "RAILWAY_ENVIRONMENT_ID",
      "LEGISLATION_MCP_SERVICE_ID",
      "RAILWAY_DEPLOYMENT_ID"
    ]) {
      required(environment, name)
    }
    if (!/^legislation-staging-[0-9]+-[0-9]+$/u.test(environment.LEGISLATION_SENTRY_CANARY_MARKER ?? "")) {
      throw new Error("LEGISLATION_SENTRY_CANARY_MARKER is required for the controlled canary")
    }
  }
  return {
    base,
    machineClient: {
      id: required(environment, "WORKOS_MCP_SMOKE_CLIENT_ID"),
      secret: required(environment, "WORKOS_MCP_SMOKE_CLIENT_SECRET")
    },
    billId: required(environment, "LEGISLATION_SMOKE_BILL_ID"),
    expectedCommitSha,
    fullStateAcceptance,
    jurisdictionId,
    sessionId,
    sentryCanary,
    sentryCanaryMarker: sentryCanary ? environment.LEGISLATION_SENTRY_CANARY_MARKER : undefined,
    railway: sentryCanary
      ? {
          projectId: required(environment, "RAILWAY_PROJECT_ID"),
          environmentId: required(environment, "RAILWAY_ENVIRONMENT_ID"),
          serviceId: required(environment, "LEGISLATION_MCP_SERVICE_ID"),
          deploymentId: required(environment, "RAILWAY_DEPLOYMENT_ID")
        }
      : undefined
  }
}

export async function requestMachineAccessToken(configuration, issuer, fetch_ = fetch) {
  const issuerUrl = URL.parse(issuer)
  if (
    !issuerUrl ||
    issuerUrl.protocol !== "https:" ||
    issuerUrl.username ||
    issuerUrl.password ||
    issuerUrl.search ||
    issuerUrl.hash
  ) {
    throw new Error("MCP authorization server must be a credential-free HTTPS URL")
  }
  const response = await fetch_(new URL("/oauth2/token", issuerUrl), {
    body: new URLSearchParams({
      client_id: configuration.machineClient.id,
      client_secret: configuration.machineClient.secret,
      grant_type: "client_credentials",
      resource: new URL("/mcp", configuration.base).href
    }),
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    throw new Error("WorkOS machine access token request failed")
  }
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maximumTokenResponseBytes) {
    throw new Error("WorkOS machine access token response is too large")
  }
  const text = await response.text()
  if (Buffer.byteLength(text) > maximumTokenResponseBytes) {
    throw new Error("WorkOS machine access token response is too large")
  }
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("WorkOS machine access token response is invalid")
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof value.access_token !== "string" ||
    !/^[A-Za-z0-9\-._~+/]+={0,2}$/u.test(value.access_token) ||
    value.access_token.length > 16_384 ||
    typeof value.token_type !== "string" ||
    value.token_type.toLowerCase() !== "bearer" ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in <= 0 ||
    value.expires_in > maximumTokenLifetimeSeconds
  ) {
    throw new Error("WorkOS machine access token response is invalid")
  }
  return value.access_token
}

export function sentryCanaryHeaders(configuration) {
  if (!configuration.sentryCanary || !configuration.railway) {
    throw new Error("Sentry canary context is not configured")
  }
  return {
    "x-legislation-sentry-canary": configuration.sentryCanaryMarker,
    "x-legislation-sentry-redaction-check": sentryCanaryRedactionValue
  }
}
