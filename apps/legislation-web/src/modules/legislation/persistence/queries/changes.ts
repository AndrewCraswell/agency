import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { changeEvents } from "@repo/legislation-core/database/schema/schema"
import { and, desc, eq, gte, lte, lt, or } from "drizzle-orm"

export type CanonicalChangeType = "cancel" | "create" | "delete" | "relationship-change" | "reschedule" | "update"

export type ChangeQuery = {
  before?: Date
  beforeId?: string
  changeType?: CanonicalChangeType
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  personId?: string
  recordId?: string
  recordType?: string
  observedFrom?: Date
  observedTo?: Date
}

export async function findChangeEvents(database: LegislationDatabase, query: ChangeQuery) {
  const beforeCondition = (() => {
    if (query.before === undefined) {
      return undefined
    }
    if (query.beforeId === undefined) {
      return lt(changeEvents.observedAt, query.before)
    }
    return or(
      lt(changeEvents.observedAt, query.before),
      and(eq(changeEvents.observedAt, query.before), lt(changeEvents.id, query.beforeId))
    )
  })()
  const conditions = [
    beforeCondition,
    query.changeType === undefined ? undefined : eq(changeEvents.changeType, query.changeType),
    query.jurisdictionId === undefined ? undefined : eq(changeEvents.jurisdictionId, query.jurisdictionId),
    query.organizationId === undefined ? undefined : eq(changeEvents.organizationId, query.organizationId),
    query.personId === undefined ? undefined : eq(changeEvents.personId, query.personId),
    query.recordId === undefined ? undefined : eq(changeEvents.recordId, query.recordId),
    query.recordType === undefined ? undefined : eq(changeEvents.recordType, query.recordType),
    query.observedFrom === undefined ? undefined : gte(changeEvents.observedAt, query.observedFrom),
    query.observedTo === undefined ? undefined : lte(changeEvents.observedAt, query.observedTo)
  ].filter((condition) => condition !== undefined)
  return database
    .select()
    .from(changeEvents)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(changeEvents.observedAt), desc(changeEvents.id))
    .limit(Math.min(Math.max(query.limit ?? 50, 1), 101))
}
