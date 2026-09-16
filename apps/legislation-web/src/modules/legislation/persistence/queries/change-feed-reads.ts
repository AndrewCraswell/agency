import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { changeEvents } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, desc, eq, gte, isNotNull, lt, lte, or, sql, type SQL } from "drizzle-orm"
import {
  isRfc3339Timestamp,
  projectChangeEvent,
  type ChangeEvent
} from "../../../request-handling/api/canonical-projection"
import type { CanonicalChangeType } from "./changes"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface ChangeFeedListInput {
  billId?: string
  classification?: CanonicalChangeType
  cursor?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  personId?: string
  recordId?: string
  recordType?: string
  observedFrom?: Date
  observedTo?: Date
}

export interface ChangeEventRead {
  event: typeof changeEvents.$inferSelect
}

export interface ChangeFeedPage {
  items: ChangeEventRead[]
  nextCursor?: string
  truncated: boolean
}

export function buildChangeEventQuery(database: LegislationDatabase, changeId: string) {
  return database
    .select()
    .from(changeEvents)
    .where(
      and(
        eq(changeEvents.id, changeId),
        isNotNull(changeEvents.sourceIsOfficial),
        isNotNull(changeEvents.sourceProvider),
        isNotNull(changeEvents.sourceRetrievedAt),
        isNotNull(changeEvents.sourceUrl)
      )
    )
    .limit(1)
}

export async function getChangeEvent(database: LegislationDatabase, changeId: string): Promise<ChangeEventRead> {
  const [event] = await buildChangeEventQuery(database, changeId)
  if (event === undefined) {
    throw new LegislationError("not_found", "Change was not found")
  }
  return { event }
}

type ChangeFeedCursorScope = Readonly<{
  billId: string | null
  classification: CanonicalChangeType | null
  jurisdictionId: string | null
  organizationId: string | null
  personId: string | null
  recordId: string | null
  recordType: string | null
  observedFrom: string | null
  observedTo: string | null
}>

type ChangeFeedCursor = Readonly<{
  id: string
  observedAt: string
  scope: ChangeFeedCursorScope
  version: 1
}>

export function buildChangeFeedQuery(database: LegislationDatabase, input: ChangeFeedListInput) {
  const limit = parseLimit(input.limit)
  const scope = cursorScope(input)
  const cursor = decodeCursor(input.cursor, scope)
  const conditions = [
    cursor === undefined ? undefined : afterCursor(cursor),
    isNotNull(changeEvents.sourceIsOfficial),
    isNotNull(changeEvents.sourceProvider),
    isNotNull(changeEvents.sourceRetrievedAt),
    isNotNull(changeEvents.sourceUrl),
    input.billId === undefined ? undefined : eq(changeEvents.recordType, "bill"),
    input.billId === undefined ? undefined : eq(changeEvents.recordId, input.billId),
    input.classification === undefined ? undefined : eq(changeEvents.changeType, input.classification),
    input.jurisdictionId === undefined ? undefined : eq(changeEvents.jurisdictionId, input.jurisdictionId),
    input.organizationId === undefined ? undefined : eq(changeEvents.organizationId, input.organizationId),
    input.personId === undefined ? undefined : eq(changeEvents.personId, input.personId),
    input.recordId === undefined ? undefined : eq(changeEvents.recordId, input.recordId),
    input.recordType === undefined ? undefined : eq(changeEvents.recordType, input.recordType),
    input.observedFrom === undefined ? undefined : gte(changeEvents.observedAt, input.observedFrom),
    input.observedTo === undefined ? undefined : lte(changeEvents.observedAt, input.observedTo)
  ].filter((condition) => condition !== undefined)

  return database
    .select()
    .from(changeEvents)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(changeEvents.observedAt), desc(changeEvents.id))
    .limit(limit + 1)
}

export async function listChangeFeed(
  database: LegislationDatabase,
  input: ChangeFeedListInput
): Promise<ChangeFeedPage> {
  const limit = parseLimit(input.limit)
  const rows = await buildChangeFeedQuery(database, input)
  const items = rows.slice(0, limit).map((event) => ({ event }))
  const last = rows[limit - 1]
  return {
    items,
    nextCursor:
      rows.length > limit && last !== undefined
        ? encodeChangeFeedCursor({
            id: last.id,
            observedAt: last.observedAt.toISOString(),
            scope: cursorScope(input)
          })
        : undefined,
    truncated: rows.length > limit
  }
}

export function projectChangeEventRead(value: ChangeEventRead, apiBaseUrl: string): ChangeEvent {
  const event = value.event
  if (
    event.sourceUrl === null ||
    event.sourceProvider === null ||
    event.sourceRetrievedAt === null ||
    event.sourceIsOfficial === null
  ) {
    throw incomplete(`Change ${event.id} has no captured canonical source provenance`)
  }
  return projectChangeEvent(
    {
      after: event.after ?? null,
      before: event.before ?? null,
      changedFields: event.changedFields,
      classification: changeClassification(event.changeType),
      id: event.id,
      jurisdictionId: event.jurisdictionId,
      organizationId: event.organizationId,
      personId: event.personId,
      observedAt: event.observedAt,
      recordId: event.recordId,
      recordType: event.recordType,
      sourceUpdatedAt: event.sourceUpdatedAt
    },
    {
      apiBaseUrl,
      sources: [
        {
          isOfficial: event.sourceIsOfficial,
          provider: event.sourceProvider,
          retrievedAt: event.sourceRetrievedAt,
          sourceUpdatedAt: event.sourceUpdatedAt,
          sourceUrl: event.sourceUrl
        }
      ],
      updatedAt: event.observedAt
    }
  )
}

function changeClassification(value: string): CanonicalChangeType {
  if (
    value === "cancel" ||
    value === "create" ||
    value === "delete" ||
    value === "relationship-change" ||
    value === "reschedule" ||
    value === "update"
  ) {
    return value
  }
  throw incomplete("Change classification is not canonical")
}

function afterCursor(cursor: ChangeFeedCursor): SQL {
  return (
    or(
      lt(changeEvents.observedAt, new Date(cursor.observedAt)),
      and(eq(changeEvents.observedAt, new Date(cursor.observedAt)), lt(changeEvents.id, cursor.id))
    ) ?? sql`false`
  )
}

function cursorScope(input: ChangeFeedListInput): ChangeFeedCursorScope {
  return {
    billId: input.billId ?? null,
    classification: input.classification ?? null,
    jurisdictionId: input.jurisdictionId ?? null,
    organizationId: input.organizationId ?? null,
    personId: input.personId ?? null,
    recordId: input.recordId ?? null,
    recordType: input.recordType ?? null,
    observedFrom: input.observedFrom?.toISOString() ?? null,
    observedTo: input.observedTo?.toISOString() ?? null
  }
}

export function encodeChangeFeedCursor(cursor: Omit<ChangeFeedCursor, "version">): string {
  return Buffer.from(JSON.stringify({ ...cursor, version: 1 }), "utf8").toString("base64url")
}

function decodeCursor(value: string | undefined, scope: ChangeFeedCursorScope): ChangeFeedCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !isNonEmptyString(parsed.id) ||
      !isRfc3339Timestamp(parsed.observedAt) ||
      !isRecord(parsed.scope) ||
      JSON.stringify(parsed.scope) !== JSON.stringify(scope)
    ) {
      throw new Error("invalid")
    }
    return { id: parsed.id, observedAt: parsed.observedAt, scope, version: 1 }
  } catch {
    throw new LegislationError("invalid_request", "Invalid change pagination cursor")
  }
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function incomplete(message: string): LegislationError {
  return new LegislationError("unprocessable", message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}
