import { sql, type SQL } from "drizzle-orm"
import { billActions } from "../schema/schema.js"

/**
 * A date-only legislative action is interpreted as midnight UTC so every
 * projected timestamp has an explicit, deterministic timezone.
 */
export function billActionTimestamp(): SQL<Date | null> {
  return sql<Date | null>`coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp at time zone 'UTC')`.mapWith(
    billActions.actionAt
  )
}
