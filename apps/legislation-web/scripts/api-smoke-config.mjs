const fullCommitSha = /^[0-9a-f]{40}$/u
const maximumTokenResponseBytes = 65_536
const maximumTokenLifetimeSeconds = 24 * 60 * 60

function required(environment, name) {
  const value = environment[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function httpsUrl(value, name, rootOnly = false) {
  const url = URL.parse(value)
  if (
    !url ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (rootOnly && url.pathname !== "/")
  ) {
    throw new Error(`${name} must be a credential-free HTTPS ${rootOnly ? "origin" : "URL"}`)
  }
  return url
}

export function apiSmokeConfig(environment) {
  const expectedCommitSha = (
    environment.LEGISLATION_DEPLOYMENT_COMMIT_SHA?.trim() ||
    environment.GITHUB_SHA?.trim() ||
    ""
  ).toLowerCase()
  if (!fullCommitSha.test(expectedCommitSha)) {
    throw new Error("LEGISLATION_DEPLOYMENT_COMMIT_SHA or GITHUB_SHA must be a full Git commit SHA")
  }
  return {
    base: httpsUrl(required(environment, "LEGISLATION_API_SMOKE_BASE_URL"), "LEGISLATION_API_SMOKE_BASE_URL", true),
    expectedCommitSha,
    issuer: httpsUrl(required(environment, "WORKOS_API_SMOKE_ISSUER"), "WORKOS_API_SMOKE_ISSUER"),
    machineClient: {
      id: required(environment, "WORKOS_API_SMOKE_CLIENT_ID"),
      secret: required(environment, "WORKOS_API_SMOKE_CLIENT_SECRET")
    }
  }
}

export async function requestApiMachineAccessToken(configuration, fetch_ = fetch) {
  const response = await fetch_(new URL("/oauth2/token", configuration.issuer), {
    body: new URLSearchParams({
      client_id: configuration.machineClient.id,
      client_secret: configuration.machineClient.secret,
      grant_type: "client_credentials"
    }),
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    throw new Error("WorkOS API machine access token request failed")
  }
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maximumTokenResponseBytes) {
    throw new Error("WorkOS API machine access token response is too large")
  }
  const text = await response.text()
  if (Buffer.byteLength(text) > maximumTokenResponseBytes) {
    throw new Error("WorkOS API machine access token response is too large")
  }
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("WorkOS API machine access token response is invalid")
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
    throw new Error("WorkOS API machine access token response is invalid")
  }
  return value.access_token
}
