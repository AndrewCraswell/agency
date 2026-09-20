import { LegislationError } from "@repo/legislation-core/domain/errors"

type Bound = string | null | undefined
type FieldNames = readonly [from: string, to: string]

// Endpoint schemas validate individual bounds; this boundary checks their relationship.
export function validateSearchTemporalRange(from: Bound, to: Bound, [fromName, toName]: FieldNames): void {
  if (from === null || from === undefined || to === null || to === undefined) {
    return
  }
  if (from.includes("T") !== to.includes("T")) {
    throw new LegislationError("invalid_request", `${fromName} and ${toName} must use the same temporal format`)
  }
  if (Date.parse(from) > Date.parse(to)) {
    throw new LegislationError("invalid_request", `${fromName} must not be after ${toName}`)
  }
}

export function normalizeSearchTemporalRange(
  from: Bound,
  to: Bound,
  names: FieldNames
): { updatedFrom: Date | undefined; updatedTo: Date | undefined; updatedToExclusive: Date | undefined } {
  validateSearchTemporalRange(from, to, names)
  const updatedFrom = from === null || from === undefined ? undefined : new Date(from)
  if (to === null || to === undefined) {
    return { updatedFrom, updatedTo: undefined, updatedToExclusive: undefined }
  }
  if (to.includes("T")) {
    return { updatedFrom, updatedTo: new Date(to), updatedToExclusive: undefined }
  }
  const updatedToExclusive = new Date(to)
  updatedToExclusive.setUTCDate(updatedToExclusive.getUTCDate() + 1)
  return { updatedFrom, updatedTo: undefined, updatedToExclusive }
}
