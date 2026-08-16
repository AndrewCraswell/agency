export type LegislationErrorCategory =
  | "conflict"
  | "dependency_unavailable"
  | "forbidden"
  | "internal"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "unauthorized"

export class LegislationError extends Error {
  readonly category: LegislationErrorCategory

  constructor(category: LegislationErrorCategory, message: string, options?: ErrorOptions) {
    super(message, options)
    this.category = category
    this.name = "LegislationError"
  }
}
