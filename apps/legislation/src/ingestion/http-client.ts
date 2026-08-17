export interface RetryingHttpClientOptions {
  fetch?: typeof fetch
  maxAttempts: number
  minimumIntervalMs?: number
  requestTimeoutMs: number
}

export interface HttpClientMetrics {
  attempts: number
  failedRequests: number
  rateLimited: number
  retries: number
  successfulRequests: number
}

export class ProviderHttpError extends Error {
  readonly retryable: boolean
  readonly status?: number

  constructor(message: string, options: Readonly<{ retryable: boolean; status?: number }>) {
    super(message)
    this.name = "ProviderHttpError"
    this.retryable = options.retryable
    this.status = options.status
  }
}

export class RetryingHttpClient {
  readonly #fetch: typeof fetch
  readonly #maxAttempts: number
  readonly #minimumIntervalMs: number
  readonly #metrics: HttpClientMetrics = {
    attempts: 0,
    failedRequests: 0,
    rateLimited: 0,
    retries: 0,
    successfulRequests: 0
  }
  readonly #requestTimeoutMs: number
  #requestGate: Promise<void> = Promise.resolve()
  #nextRequestAt = 0

  constructor(options: RetryingHttpClientOptions) {
    this.#fetch = options.fetch ?? fetch
    this.#maxAttempts = options.maxAttempts
    this.#minimumIntervalMs = Math.max(0, options.minimumIntervalMs ?? 0)
    this.#requestTimeoutMs = options.requestTimeoutMs
  }

  get metrics(): Readonly<HttpClientMetrics> {
    return { ...this.#metrics }
  }

  async get(url: URL, init: RequestInit = {}): Promise<Response> {
    let lastError: unknown
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      try {
        await this.#paceRequest()
        this.#metrics.attempts += 1
        const response = await this.#fetch(url, {
          ...init,
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(this.#requestTimeoutMs)
        })
        if (response.ok) {
          this.#metrics.successfulRequests += 1
          return response
        }
        const responseDetail = response.status === 429 ? await boundedErrorDetail(response) : undefined
        const dailyQuotaExceeded =
          responseDetail?.toLowerCase().includes("exceeded limit") === true && responseDetail.includes("/day")
        const retryable =
          response.status === 408 || (response.status === 429 && !dailyQuotaExceeded) || response.status >= 500
        if (response.status === 429) {
          this.#metrics.rateLimited += 1
        }
        if (!retryable || attempt === this.#maxAttempts) {
          this.#metrics.failedRequests += 1
          throw new ProviderHttpError(
            `Provider request failed with HTTP ${response.status}${responseDetail === undefined ? "" : `: ${responseDetail}`}`,
            {
              retryable,
              status: response.status
            }
          )
        }
        this.#metrics.retries += 1
        await delay(retryDelay(response, attempt))
      } catch (error) {
        if (error instanceof ProviderHttpError && !error.retryable) {
          throw error
        }
        lastError = error
        if (attempt === this.#maxAttempts) {
          if (!(error instanceof ProviderHttpError)) {
            this.#metrics.failedRequests += 1
          }
          throw error instanceof ProviderHttpError
            ? error
            : new ProviderHttpError("Provider request failed after retries", { retryable: true })
        }
        this.#metrics.retries += 1
        await delay(Math.min(250 * 2 ** (attempt - 1), 4000))
      }
    }
    throw lastError
  }

  async getBytes(url: URL, maximumBytes: number, init: RequestInit = {}): Promise<Uint8Array> {
    let chunks: Uint8Array[] = []
    let receivedBytes = 0
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      try {
        await this.#paceRequest()
        const headers = new Headers(init.headers)
        if (receivedBytes > 0) {
          headers.set("range", `bytes=${receivedBytes}-`)
        }
        this.#metrics.attempts += 1
        const response = await this.#fetch(url, {
          ...init,
          headers,
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(this.#requestTimeoutMs)
        })
        if (!response.ok) {
          const responseDetail = response.status === 429 ? await boundedErrorDetail(response) : undefined
          const dailyQuotaExceeded =
            responseDetail?.toLowerCase().includes("exceeded limit") === true && responseDetail.includes("/day")
          const retryable =
            response.status === 408 || (response.status === 429 && !dailyQuotaExceeded) || response.status >= 500
          if (response.status === 429) {
            this.#metrics.rateLimited += 1
          }
          if (!retryable || attempt === this.#maxAttempts) {
            this.#metrics.failedRequests += 1
            throw new ProviderHttpError(
              `Provider request failed with HTTP ${response.status}${responseDetail === undefined ? "" : `: ${responseDetail}`}`,
              { retryable, status: response.status }
            )
          }
          this.#metrics.retries += 1
          await delay(retryDelay(response, attempt))
          continue
        }
        if (receivedBytes > 0 && response.status !== 206) {
          chunks = []
          receivedBytes = 0
        }
        const contentLength = Number(response.headers.get("content-length"))
        if (Number.isFinite(contentLength) && receivedBytes + contentLength > maximumBytes) {
          this.#metrics.failedRequests += 1
          throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
        }
        const reader = response.body?.getReader()
        if (reader === undefined) {
          const bytes = new Uint8Array(await response.arrayBuffer())
          chunks.push(bytes)
          receivedBytes += bytes.byteLength
        } else {
          for (;;) {
            const next = await reader.read()
            if (next.done) {
              break
            }
            if (receivedBytes + next.value.byteLength > maximumBytes) {
              await reader.cancel()
              this.#metrics.failedRequests += 1
              throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
            }
            chunks.push(next.value)
            receivedBytes += next.value.byteLength
          }
        }
        this.#metrics.successfulRequests += 1
        const result = new Uint8Array(receivedBytes)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.byteLength
        }
        return result
      } catch (error) {
        if (error instanceof ProviderHttpError && !error.retryable) {
          throw error
        }
        if (attempt === this.#maxAttempts) {
          if (!(error instanceof ProviderHttpError)) {
            this.#metrics.failedRequests += 1
          }
          throw error instanceof ProviderHttpError
            ? error
            : new ProviderHttpError("Provider download failed after retries", { retryable: true })
        }
        this.#metrics.retries += 1
        await delay(Math.min(250 * 2 ** (attempt - 1), 4000))
      }
    }
    throw new ProviderHttpError("Provider download failed after retries", { retryable: true })
  }

  async #paceRequest(): Promise<void> {
    const previous = this.#requestGate
    const gate = Promise.withResolvers<void>()
    this.#requestGate = gate.promise
    await previous
    try {
      const wait = this.#nextRequestAt - Date.now()
      if (wait > 0) {
        await delay(wait)
      }
      this.#nextRequestAt = Date.now() + this.#minimumIntervalMs
    } finally {
      gate.resolve()
    }
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after")
  if (retryAfter !== null) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 30_000)
    }
  }
  if (response.status === 429) {
    return Math.min(15_000 * 2 ** (attempt - 1), 120_000)
  }
  return Math.min(250 * 2 ** (attempt - 1), 4000)
}

async function boundedErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const detail = (await response.clone().text()).replaceAll(/\s+/g, " ").trim().slice(0, 300)
    return detail.length === 0 ? undefined : detail
  } catch {
    return undefined
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function readBounded(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maximumBytes) {
    throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
  }
  return bytes
}
