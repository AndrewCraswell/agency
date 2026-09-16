const DEFAULT_TIMEOUT_MILLISECONDS = 5_000
const DEFAULT_REFRESH_EARLY_MILLISECONDS = 60_000
const MAXIMUM_RESPONSE_BYTES = 65_536
const MAXIMUM_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60

export type ApiAccessTokenErrorCategory = "configuration" | "dependency_unavailable" | "invalid_response"

export class ApiAccessTokenError extends Error {
  readonly category: ApiAccessTokenErrorCategory

  constructor(category: ApiAccessTokenErrorCategory) {
    super("API access token could not be obtained")
    this.name = "ApiAccessTokenError"
    this.category = category
  }
}

export type ApiAccessTokenProviderConfig = Readonly<{
  clientId: string
  clientSecret: string
  issuer: string
  refreshEarlyMilliseconds?: number
  timeoutMilliseconds?: number
}>

export type ApiAccessTokenProviderDependencies = Readonly<{
  fetch?: typeof fetch
  now?: () => number
}>

type CachedToken = Readonly<{
  expiresAt: number
  value: string
}>

type TokenResponse = Readonly<{
  accessToken: string
  expiresInSeconds: number
}>

export function createApiAccessTokenProvider(
  config: ApiAccessTokenProviderConfig,
  dependencies: ApiAccessTokenProviderDependencies = {}
): () => Promise<string> {
  const tokenEndpoint = tokenEndpointFor(config.issuer)
  const clientId = requiredValue(config.clientId)
  const clientSecret = requiredValue(config.clientSecret)
  const timeoutMilliseconds = boundedPositiveInteger(
    config.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS,
    1,
    30_000
  )
  const refreshEarlyMilliseconds = boundedPositiveInteger(
    config.refreshEarlyMilliseconds ?? DEFAULT_REFRESH_EARLY_MILLISECONDS,
    0,
    300_000
  )
  const fetchImplementation = dependencies.fetch ?? fetch
  const now = dependencies.now ?? Date.now
  let cached: CachedToken | undefined
  let inFlight: Promise<string> | undefined

  return async () => {
    const requestStartedAt = now()
    if (cached !== undefined && cached.expiresAt > requestStartedAt) {
      return cached.value
    }
    if (inFlight !== undefined) {
      return await inFlight
    }

    const refresh = requestToken({
      clientId,
      clientSecret,
      fetchImplementation,
      timeoutMilliseconds,
      tokenEndpoint
    }).then((token) => {
      const expiresAt = requestStartedAt + token.expiresInSeconds * 1000 - refreshEarlyMilliseconds
      cached = expiresAt > now() ? { expiresAt, value: token.accessToken } : undefined
      return token.accessToken
    })
    inFlight = refresh
    try {
      return await refresh
    } finally {
      if (inFlight === refresh) {
        inFlight = undefined
      }
    }
  }
}

function tokenEndpointFor(issuer: string): URL {
  let issuerUrl: URL
  try {
    issuerUrl = new URL(issuer)
  } catch {
    throw new ApiAccessTokenError("configuration")
  }
  if (
    issuerUrl.protocol !== "https:" ||
    issuerUrl.username.length > 0 ||
    issuerUrl.password.length > 0 ||
    issuerUrl.search.length > 0 ||
    issuerUrl.hash.length > 0
  ) {
    throw new ApiAccessTokenError("configuration")
  }
  return new URL("/oauth2/token", issuerUrl)
}

function requiredValue(value: string): string {
  if (value.trim().length === 0) {
    throw new ApiAccessTokenError("configuration")
  }
  return value
}

function boundedPositiveInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ApiAccessTokenError("configuration")
  }
  return value
}

async function requestToken(input: {
  clientId: string
  clientSecret: string
  fetchImplementation: typeof fetch
  timeoutMilliseconds: number
  tokenEndpoint: URL
}): Promise<TokenResponse> {
  let response: Response
  try {
    response = await input.fetchImplementation(input.tokenEndpoint, {
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: "client_credentials"
      }),
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(input.timeoutMilliseconds)
    })
  } catch {
    throw new ApiAccessTokenError("dependency_unavailable")
  }
  if (!response.ok) {
    throw new ApiAccessTokenError("dependency_unavailable")
  }
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_RESPONSE_BYTES) {
    throw new ApiAccessTokenError("invalid_response")
  }
  const text = await boundedResponseText(response)
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ApiAccessTokenError("invalid_response")
  }
  if (!isObject(value) || !isBearerTokenResponse(value)) {
    throw new ApiAccessTokenError("invalid_response")
  }
  return { accessToken: value.access_token, expiresInSeconds: value.expires_in }
}

async function boundedResponseText(response: Response): Promise<string> {
  if (response.body === null) {
    throw new ApiAccessTokenError("invalid_response")
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return Buffer.concat(chunks, bytes).toString("utf8")
      }
      if (value === undefined) {
        continue
      }

      bytes += value.byteLength
      if (bytes > MAXIMUM_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new ApiAccessTokenError("invalid_response")
      }
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    if (error instanceof ApiAccessTokenError) {
      throw error
    }
    throw new ApiAccessTokenError("dependency_unavailable")
  } finally {
    reader.releaseLock()
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isBearerTokenResponse(value: Record<string, unknown>): value is {
  access_token: string
  expires_in: number
  token_type: string
} {
  return (
    typeof value.access_token === "string" &&
    /^[A-Za-z0-9\-._~+/]+={0,2}$/.test(value.access_token) &&
    value.access_token.length <= 16_384 &&
    typeof value.expires_in === "number" &&
    Number.isSafeInteger(value.expires_in) &&
    value.expires_in > 0 &&
    value.expires_in <= MAXIMUM_TOKEN_LIFETIME_SECONDS &&
    typeof value.token_type === "string" &&
    value.token_type.toLowerCase() === "bearer"
  )
}
