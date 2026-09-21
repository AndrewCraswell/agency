import { z } from "zod"

const legislationErrorSchema = z.object({
  name: z.literal("LegislationError"),
  category: z.enum([
    "conflict",
    "dependency_unavailable",
    "forbidden",
    "internal",
    "invalid_request",
    "not_found",
    "payload_too_large",
    "precondition_failed",
    "unprocessable",
    "unauthorized"
  ]),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional()
})

export type LegislationErrorCategory = z.infer<typeof legislationErrorSchema>["category"]

export type LegislationErrorOptions = ErrorOptions & Readonly<{ details?: Readonly<Record<string, unknown>> }>

export class LegislationError extends Error {
  readonly category: LegislationErrorCategory
  readonly details: Readonly<Record<string, unknown>> | undefined

  constructor(category: LegislationErrorCategory, message: string, options?: LegislationErrorOptions) {
    super(message, options)
    this.category = category
    this.details = options?.details
    this.name = "LegislationError"
  }
}

export function postgresErrorCode(error: unknown): string | undefined {
  const visited = new Set<unknown>()
  let current = error
  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current)
    if ("code" in current && typeof current.code === "string" && /^[0-9A-Z]{5}$/.test(current.code)) {
      return current.code
    }
    current = "cause" in current ? current.cause : undefined
  }
  return undefined
}

export function normalizeLegislationError(error: unknown): LegislationError {
  if (error instanceof LegislationError) {
    return error
  }
  const domainError = legislationErrorSchema.safeParse(error)
  if (domainError.success && error instanceof Error) {
    return new LegislationError(domainError.data.category, domainError.data.message, {
      cause: error,
      details: domainError.data.details
    })
  }
  const code = postgresErrorCode(error)
  if (code === "57014") {
    return new LegislationError("dependency_unavailable", "The database query timed out. Try again.", {
      cause: error,
      details: { reason: "timeout", retryable: true }
    })
  }
  if (code?.startsWith("08") || code === "53300" || code === "57P01") {
    return new LegislationError("dependency_unavailable", "The database is temporarily unavailable.", {
      cause: error,
      details: { retryable: true }
    })
  }
  return new LegislationError("internal", "The request could not be completed", { cause: error })
}
