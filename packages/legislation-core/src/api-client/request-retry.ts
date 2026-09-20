import { setTimeout } from "node:timers/promises"

const transientConnectionCodes = new Set([
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET"
])

export function isTransientRequestFailure(error: unknown): boolean {
  let current = error
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (current.name === "AbortError") {
      return false
    }
    if (
      current.name === "TimeoutError" ||
      ("code" in current && typeof current.code === "string" && transientConnectionCodes.has(current.code))
    ) {
      return true
    }
    current = current.cause
  }
  return false
}

export function isTransientHttpStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

export async function waitForRequestRetry(attempt: number, signal?: AbortSignal) {
  signal?.throwIfAborted()
  await setTimeout(Math.min(250 * 2 ** (attempt - 1), 2_000), undefined, { signal })
  signal?.throwIfAborted()
}
