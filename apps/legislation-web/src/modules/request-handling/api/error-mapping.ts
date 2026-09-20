import { LegislationError } from "@repo/legislation-core/domain/errors"
import { CanonicalProjectionError } from "./canonical-projection"

// SQLSTATE 53100/53200 cover bounded production resource exhaustion (including
// Railway shared-memory pressure); 42xxx syntax/schema failures remain 500.
const transientDatabaseErrorCodes = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "53100",
  "53200",
  "57014",
  "57P01",
  "57P02",
  "57P03",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE"
])
const transientDatabaseErrorMessages = new Set(["Connection terminated unexpectedly"])

/** Maps known boundary failures without hiding deterministic application errors. */
export function toPublicApiError(error: unknown): unknown {
  if (error instanceof LegislationError) {
    return error
  }
  if (error instanceof CanonicalProjectionError) {
    return new LegislationError(
      "unprocessable",
      "The record cannot be returned because its canonical provenance is incomplete",
      { cause: error }
    )
  }
  if (isTransientDatabaseError(error)) {
    return new LegislationError("dependency_unavailable", "Database is temporarily unavailable", { cause: error })
  }
  return error
}

function isTransientDatabaseError(error: unknown): boolean {
  const seen = new Set<object>()
  let current: unknown = error
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return false
    }
    if (seen.has(current)) {
      return false
    }
    seen.add(current)
    const code = Reflect.get(current, "code")
    if (typeof code === "string" && transientDatabaseErrorCodes.has(code.toUpperCase())) {
      return true
    }
    const message = Reflect.get(current, "message")
    if (typeof message === "string" && transientDatabaseErrorMessages.has(message)) {
      return true
    }
    current = Reflect.get(current, "cause")
  }
  return false
}
