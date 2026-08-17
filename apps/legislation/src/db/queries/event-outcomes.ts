import { createHash } from "node:crypto"
import type { LegislationDatabase } from "../database.js"
import { eventOutcomeLinks } from "../schema/schema.js"

type OutcomeTarget = { actionId: string; voteId?: never } | { actionId?: never; voteId: string }

export type EventOutcomeLinkInput = Readonly<
  {
    eventId: string
    linkMethod: "deterministic-id" | "explicit"
    sourceReference: string
  } & OutcomeTarget
>

export async function linkEventOutcome(
  database: LegislationDatabase,
  input: EventOutcomeLinkInput
): Promise<"inserted" | "unchanged"> {
  const target = input.actionId ?? input.voteId
  const id = `event-outcome:${createHash("sha256")
    .update(JSON.stringify([input.eventId, target, input.linkMethod, input.sourceReference]))
    .digest("hex")}`
  const inserted = await database
    .insert(eventOutcomeLinks)
    .values({ ...input, id })
    .onConflictDoNothing()
    .returning({ id: eventOutcomeLinks.id })
  return inserted.length === 0 ? "unchanged" : "inserted"
}
