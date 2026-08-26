export type LegislationErrorCategory =
  | "conflict"
  | "dependency_unavailable"
  | "forbidden"
  | "internal"
  | "invalid_request"
  | "not_found"
  | "payload_too_large"
  | "precondition_failed"
  | "rate_limited"
  | "unprocessable"
  | "unauthorized"

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
