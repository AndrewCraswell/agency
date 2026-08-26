import { and, asc, eq, gt, ilike, inArray, isNotNull, or, type SQL } from "drizzle-orm"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { jurisdictions } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export const JURISDICTION_CLASSIFICATIONS = ["country", "state", "district", "territory"] as const

export type JurisdictionClassification = (typeof JURISDICTION_CLASSIFICATIONS)[number]

export interface JurisdictionListInput {
  classification?: readonly JurisdictionClassification[]
  cursor?: string
  isActive?: boolean
  limit?: number
  q?: string
}

export interface JurisdictionPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

export type JurisdictionCollectionRead = typeof jurisdictions.$inferSelect

export type JurisdictionCursorScope = {
  classification: readonly JurisdictionClassification[] | null
  isActive: boolean | null
  q: string | null
}

type JurisdictionCursor = {
  id: string
  name: string
  scope: JurisdictionCursorScope
  version: 1
}

/** Lists source-backed jurisdiction rows in the contract's stable name/ID order. */
export function buildJurisdictionListQuery(database: LegislationDatabase, input: JurisdictionListInput = {}) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const query = scope.q === null ? undefined : `${scope.q}%`

  return database
    .select()
    .from(jurisdictions)
    .where(
      and(
        eq(jurisdictions.provenanceComplete, true),
        isNotNull(jurisdictions.isActive),
        isNotNull(jurisdictions.sourceIsOfficial),
        isNotNull(jurisdictions.sourceProvider),
        isNotNull(jurisdictions.sourceRetrievedAt),
        isNotNull(jurisdictions.sourceUrl),
        scope.classification === null ? undefined : eqAnyClassification(scope.classification),
        scope.isActive === null ? undefined : eq(jurisdictions.isActive, scope.isActive),
        query === undefined
          ? undefined
          : or(
              ilike(jurisdictions.name, query),
              ilike(jurisdictions.countryCode, query),
              ilike(jurisdictions.subdivisionCode, query)
            ),
        cursorPredicate(cursor)
      )
    )
    .orderBy(asc(jurisdictions.name), asc(jurisdictions.id))
    .limit(limit + 1)
}

export async function listJurisdictions(
  database: LegislationDatabase,
  input: JurisdictionListInput = {}
): Promise<JurisdictionPage<JurisdictionCollectionRead>> {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const rows = await buildJurisdictionListQuery(database, input)
  const items = rows.slice(0, limit)
  const truncated = rows.length > limit
  const last = items.at(-1)
  return {
    items,
    nextCursor: truncated && last !== undefined ? encodeCursor(last, scope) : undefined,
    truncated
  }
}

function eqAnyClassification(values: readonly JurisdictionClassification[]): SQL {
  // The route rejects an empty repeated parameter. Keeping this guard here
  // protects direct repository callers from accidentally producing an invalid
  // SQL IN () predicate.
  if (values.length === 0) {
    throw new LegislationError("invalid_request", "classification must contain at least one value")
  }
  return values.length === 1
    ? eq(jurisdictions.classification, values[0]!)
    : inArray(jurisdictions.classification, values)
}

function cursorScope(input: JurisdictionListInput): JurisdictionCursorScope {
  const classification =
    input.classification === undefined
      ? null
      : [...new Set(input.classification)].sort((left, right) => left.localeCompare(right))
  return {
    classification,
    isActive: input.isActive ?? null,
    q: input.q === undefined ? null : requiredInputText(input.q, "q", 500)
  }
}

function cursorPredicate(cursor: JurisdictionCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  return or(
    gt(jurisdictions.name, cursor.name),
    and(eq(jurisdictions.name, cursor.name), gt(jurisdictions.id, cursor.id))
  )
}

function encodeCursor(row: JurisdictionCollectionRead, scope: JurisdictionCursorScope): string {
  return Buffer.from(
    JSON.stringify({
      id: requiredInputText(row.id, "jurisdiction ID", 256),
      name: requiredInputText(row.name, "jurisdiction name", 500),
      scope,
      version: 1
    } satisfies JurisdictionCursor),
    "utf8"
  ).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: JurisdictionCursorScope): JurisdictionCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length > 4_096) {
    throw invalidCursor()
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (!isCursor(parsed) || !sameScope(parsed.scope, scope)) {
      throw invalidCursor()
    }
    return parsed
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw invalidCursor()
  }
}

function isCursor(value: unknown): value is JurisdictionCursor {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.scope)) {
    return false
  }
  const classification = value.scope.classification
  return (
    isNonemptyString(value.id) &&
    isNonemptyString(value.name) &&
    (classification === null ||
      (Array.isArray(classification) &&
        classification.length > 0 &&
        classification.every((entry) =>
          (JURISDICTION_CLASSIFICATIONS as readonly string[]).includes(entry as string)
        ))) &&
    (value.scope.isActive === null || typeof value.scope.isActive === "boolean") &&
    (value.scope.q === null || isNonemptyString(value.scope.q))
  )
}

function sameScope(value: JurisdictionCursorScope, expected: JurisdictionCursorScope): boolean {
  return (
    value.isActive === expected.isActive &&
    value.q === expected.q &&
    JSON.stringify(value.classification) === JSON.stringify(expected.classification)
  )
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredInputText(value: string, name: string, maximum: number): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximum} characters`)
  }
  return normalized
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid jurisdictions pagination cursor")
}
