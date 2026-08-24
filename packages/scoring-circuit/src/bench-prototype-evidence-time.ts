/**
 * Canonical time parsing for bench-prototype evidence records.
 *
 * Evidence is serialized as UTC rather than being interpreted in the host
 * timezone. Timestamps use the exact `Date#toISOString()` shape and dates use
 * the strict four-digit `YYYY-MM-DD` shape. Invalid, impossible, or offset
 * values return null so callers can fail closed without guessing.
 */

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
const REAL_UTC_DATE = /^\d{4}-\d{2}-\d{2}$/u

export function parseCanonicalUtcTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || !CANONICAL_UTC_TIMESTAMP.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? null : date
}

export function parseRealUtcDate(value: unknown): Date | null {
  if (typeof value !== "string" || !REAL_UTC_DATE.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}
