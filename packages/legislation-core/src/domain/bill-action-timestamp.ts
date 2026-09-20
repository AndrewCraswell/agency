import { asc, desc, sql, type SQL } from "drizzle-orm"
import { billActions } from "../database/schema/schema"

/**
 * A date-only legislative action is interpreted as midnight UTC so every
 * projected timestamp has an explicit, deterministic timezone.
 */
export function billActionTimestamp(): SQL<Date | null> {
  return sql<Date | null>`coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp at time zone 'UTC')`.mapWith(
    billActions.actionAt
  )
}

export function billActionOrder(upstreamIds: Readonly<Record<string, string>>, direction: "asc" | "desc") {
  // Federal feeds retain newest-first source ordinals; OpenStates ordinals run oldest-first.
  const isNewestFirst = Boolean(upstreamIds.govinfo || upstreamIds.congress)
  const ordinalOrder = (direction === "asc") === isNewestFirst ? desc : asc
  return [
    direction === "desc"
      ? sql`${billActionTimestamp()} desc nulls last`
      : sql`${billActionTimestamp()} asc nulls first`,
    ordinalOrder(billActions.ordinal),
    direction === "desc" ? desc(billActions.id) : asc(billActions.id)
  ]
}
