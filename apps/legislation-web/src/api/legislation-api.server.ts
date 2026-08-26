const defaultTimeoutMs = 5_000

export type LegislationApiReadiness = Readonly<{
  status: "ready"
}>

export type LegislationApiClientOptions = Readonly<{
  baseUrl: string
  fetch?: typeof fetch
  timeoutMs?: number
}>

export type LegislationApiClient = Readonly<{
  getReadiness: () => Promise<LegislationApiReadiness>
}>

export function createLegislationApiClient(options: LegislationApiClientOptions): LegislationApiClient {
  const baseUrl = parseBaseUrl(options.baseUrl)
  const request = options.fetch ?? fetch
  const timeoutMs = validateTimeout(options.timeoutMs ?? defaultTimeoutMs)

  return {
    async getReadiness() {
      const response = await request(new URL("/ready", baseUrl), {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (!response.ok) {
        throw new LegislationApiUnavailableError(`The legislation API returned HTTP ${response.status}`)
      }

      if (!response.headers.get("content-type")?.toLocaleLowerCase().includes("application/json")) {
        throw new LegislationApiUnavailableError("The legislation API readiness response must be JSON")
      }

      const payload = await parseJson(response)
      if (!isReadinessResponse(payload)) {
        throw new LegislationApiUnavailableError("The legislation API returned an invalid readiness response")
      }

      return payload
    }
  }
}

export function createLegislationApiClientFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env
): LegislationApiClient | undefined {
  const baseUrl = environment.LEGISLATION_API_BASE_URL?.trim()
  return baseUrl === undefined || baseUrl.length === 0 ? undefined : createLegislationApiClient({ baseUrl })
}

export class LegislationApiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LegislationApiUnavailableError"
  }
}

function parseBaseUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("LEGISLATION_API_BASE_URL must use HTTP or HTTPS")
  }
  if (
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new TypeError(
      "LEGISLATION_API_BASE_URL must be an origin without credentials, a path, a query, or a fragment"
    )
  }
  return url
}

function validateTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw new RangeError("timeoutMs must be an integer from 1 through 60000")
  }
  return value
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    const payload: unknown = await response.json()
    return payload
  } catch {
    throw new LegislationApiUnavailableError("The legislation API readiness response contained invalid JSON")
  }
}

function isReadinessResponse(value: unknown): value is LegislationApiReadiness {
  return isRecord(value) && value.status === "ready"
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
}
