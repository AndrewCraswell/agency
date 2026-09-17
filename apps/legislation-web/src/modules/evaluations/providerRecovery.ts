import { setTimeout } from "node:timers/promises"
import { APICallError, StreamProviderError } from "ai"
import { z } from "zod"

const responseSchema = z.object({
  error: z.object({
    metadata: z
      .object({
        reason: z.string().optional(),
        limit_source: z.string().optional()
      })
      .nullish()
  })
})
const connectionSchema = z.object({ code: z.string() })

export function providerFailure(error: unknown) {
  let reason: string | null = null
  let limitSource: string | null = null
  const apiError = APICallError.isInstance(error) ? error : undefined
  const streamError = StreamProviderError.isInstance(error) ? error : undefined
  try {
    const parsed = responseSchema.safeParse(JSON.parse(apiError?.responseBody ?? "null"))
    if (parsed.success) {
      const rawReason = parsed.data.error.metadata?.reason
      const rawSource = parsed.data.error.metadata?.limit_source
      if (rawReason && /^[a-z0-9_-]{1,100}$/.test(rawReason)) {
        reason = rawReason
      }
      if (rawSource && /^[a-z0-9_-]{1,100}$/.test(rawSource)) {
        limitSource = rawSource
      }
    }
  } catch {
    reason = null
  }
  const connection = connectionSchema.safeParse(apiError?.cause)
  const dnsFailure = connection.success && ["ENOTFOUND", "EAI_AGAIN"].includes(connection.data.code)
  const status = apiError?.statusCode ?? streamError?.statusCode ?? null
  const infrastructure = apiError !== undefined || streamError !== undefined
  const temporary = status === 429 || (status === 402 && reason === "in_flight_budget_exhausted") || dnsFailure
  const retryHeader = apiError?.responseHeaders?.["retry-after"]
  let retryAfterMs: number | null = null
  if (retryHeader) {
    const seconds = Number(retryHeader)
    const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryHeader) - Date.now()
    if (Number.isFinite(milliseconds)) {
      retryAfterMs = Math.max(0, milliseconds)
    }
  }
  return {
    httpStatus: status,
    providerReason: reason,
    limitSource,
    networkCode: dnsFailure && connection.success ? connection.data.code : null,
    retryAfterMs,
    temporary,
    infrastructure,
    stopRun: infrastructure && (temporary || status === 401 || status === 402 || status === 403)
  }
}

export type ProviderAttempt = ReturnType<typeof providerFailure> & { attempt: number }

export async function recoverProviderCall<Result>(options: {
  operation: () => Promise<Result>
  claim: () => void
  signal: AbortSignal
  attempts: ProviderAttempt[]
  delay?: (milliseconds: number, signal: AbortSignal) => Promise<void>
}) {
  const delay =
    options.delay ??
    (async (milliseconds, signal) => {
      await setTimeout(milliseconds, undefined, { signal })
    })
  for (let attempt = 1; ; attempt++) {
    options.signal.throwIfAborted()
    options.claim()
    try {
      return await options.operation()
    } catch (error) {
      const failure = providerFailure(error)
      options.attempts.push({ attempt, ...failure })
      if (!failure.temporary || attempt >= 3 || (failure.retryAfterMs ?? 0) > 120000) {
        throw error
      }
      await delay(failure.retryAfterMs ?? 1000 * 2 ** (attempt - 1), options.signal)
    }
  }
}
