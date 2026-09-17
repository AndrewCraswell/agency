import { votes } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { sql } from "drizzle-orm"
import { z } from "zod"

type Occurrence = { heldAt: Date | null; heldDate?: string | null }

export function voteOccurrence(vote: Occurrence) {
  const heldAt = vote.heldAt
  if (heldAt !== null && !Number.isFinite(heldAt.valueOf())) {
    throw new LegislationError("unprocessable", "Vote heldAt is invalid")
  }
  const date = z.iso.date().safeParse(vote.heldDate ?? heldAt?.toISOString().slice(0, 10))
  if (!date.success) {
    throw new LegislationError("unprocessable", "Vote date is incomplete")
  }
  return { date: date.data, heldAt }
}

/** Internal ordering anchor only, never an asserted or projected event instant. */
export function voteSortInstant(vote: Occurrence): Date | null {
  if (vote.heldAt !== null) {
    return vote.heldAt
  }
  return vote.heldDate ? new Date(`${z.iso.date().parse(vote.heldDate)}T00:00:00Z`) : null
}

export function voteSortTimestamp() {
  return sql<Date | null>`coalesce(${votes.heldAt}, ${votes.heldDate}::timestamp at time zone 'UTC')`.mapWith(
    votes.heldAt
  )
}

/** Date-only rows match calendar days, including a boundary day with an unknown time. */
export function voteDateBound(value: string, direction: "from" | "to") {
  const date = z.iso.date().safeParse(value)
  const calendar = date.success ? date.data : new Date(value).toISOString().slice(0, 10)
  let exact
  if (date.success) {
    exact =
      direction === "from"
        ? sql`${votes.heldAt} >= (${calendar}::date::timestamp at time zone 'UTC')`
        : sql`${votes.heldAt} < ((${calendar}::date + interval '1 day') at time zone 'UTC')`
  } else {
    exact =
      direction === "from"
        ? sql`${votes.heldAt} >= ${value}::timestamptz`
        : sql`${votes.heldAt} <= ${value}::timestamptz`
  }
  const day =
    direction === "from" ? sql`${votes.heldDate} >= ${calendar}::date` : sql`${votes.heldDate} <= ${calendar}::date`
  return sql`(${exact} or (${votes.heldAt} is null and ${day}))`
}
