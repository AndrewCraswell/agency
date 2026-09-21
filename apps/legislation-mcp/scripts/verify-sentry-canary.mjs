import { pathToFileURL } from "node:url"

const markerPattern = /^legislation-staging-[0-9]+-[0-9]+$/u
const slugPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/u

function required(environment, name) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export function sentryVerificationConfig(environment) {
  const apiBase = URL.parse(environment.SENTRY_API_BASE_URL?.trim() || "https://sentry.io")
  if (
    !apiBase ||
    apiBase.protocol !== "https:" ||
    apiBase.username ||
    apiBase.password ||
    apiBase.pathname !== "/" ||
    apiBase.search ||
    apiBase.hash
  ) {
    throw new Error("SENTRY_API_BASE_URL must be a credential-free HTTPS origin")
  }
  const marker = required(environment, "LEGISLATION_SENTRY_CANARY_MARKER")
  const organization = required(environment, "SENTRY_ORGANIZATION_SLUG")
  const project = required(environment, "SENTRY_MCP_PROJECT_SLUG")
  if (!markerPattern.test(marker)) throw new Error("LEGISLATION_SENTRY_CANARY_MARKER is invalid")
  if (!slugPattern.test(organization) || !slugPattern.test(project)) {
    throw new Error("Sentry organization and project slugs are invalid")
  }
  return {
    apiBase,
    marker,
    organization,
    project,
    token: required(environment, "SENTRY_STAGING_AUTH_TOKEN")
  }
}

export async function verifySentryCanary(
  configuration,
  { fetch: fetch_ = fetch, attempts = 12, delayMs = 10_000, delay = setTimeout } = {}
) {
  const endpoint = new URL(
    `/api/0/projects/${configuration.organization}/${configuration.project}/events/`,
    configuration.apiBase
  )
  endpoint.searchParams.set("query", `canary:${configuration.marker}`)
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch_(endpoint, {
      headers: { authorization: `Bearer ${configuration.token}` },
      redirect: "error",
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw new Error(`Sentry canary verification failed with status ${response.status}`)
    const declaredLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > 1_000_000) {
      throw new Error("Sentry canary verification response is too large")
    }
    const text = await response.text()
    if (Buffer.byteLength(text) > 1_000_000) throw new Error("Sentry canary verification response is too large")
    let events
    try {
      events = JSON.parse(text)
    } catch {
      throw new Error("Sentry canary verification returned invalid JSON")
    }
    if (!Array.isArray(events)) throw new Error("Sentry canary verification returned an invalid response")
    if (events.length > 0) return
    if (attempt < attempts) await new Promise((resolve) => delay(resolve, delayMs))
  }
  throw new Error(`Sentry did not ingest controlled canary ${configuration.marker}`)
}

async function main() {
  const configuration = sentryVerificationConfig(process.env)
  await verifySentryCanary(configuration)
  process.stdout.write(`${JSON.stringify({ marker: configuration.marker, status: "verified" })}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
