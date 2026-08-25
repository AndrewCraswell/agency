import { createHash } from "node:crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import { LegislationError } from "../../legislation/errors.js"
import type { LegislationDatabase } from "../database.js"
import { eventAgendaItems, eventOutcomeLinks, eventOutcomes } from "../schema/schema.js"

type OutcomeTarget = { actionId: string; voteId?: never } | { actionId?: never; voteId: string }

export type EventOutcomeLinkInput = Readonly<
  {
    eventId: string
    linkMethod: "deterministic-id" | "explicit"
    sourceReference: string
  } & OutcomeTarget
>

type AgendaAssociation =
  | Readonly<{ agendaAssociation: "explicit"; agendaItemId: string }>
  | Readonly<{ agendaAssociation: "none"; agendaItemId?: never }>

type CanonicalOutcomeTarget =
  | Readonly<{ actionId: string; classification: "action"; voteId?: never }>
  | Readonly<{ actionId?: never; classification: "vote"; voteId: string }>
  | Readonly<{ actionId?: never; classification: "disposition" | "note"; voteId?: never }>

/** A source-complete outcome payload; no derived facts are accepted here. */
export type CanonicalEventOutcomeInput = Readonly<
  {
    description: string
    eventId: string
    id: string
    linkMethod: "deterministic-id" | "explicit"
    sourceIsOfficial: boolean
    sourceProvider: string
    sourceRetrievedAt: Date
    sourceSequence: number
    sourceUpdatedAt?: Date | null
    sourceUrl: string
  } & AgendaAssociation &
    CanonicalOutcomeTarget
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

/**
 * Upserts only source-declared canonical outcomes. Legacy relationship links
 * are never transformed into this table, and explicit agenda links must point
 * to a complete agenda record of the same event.
 */
export async function upsertCanonicalEventOutcomes(
  database: LegislationDatabase,
  inputs: readonly CanonicalEventOutcomeInput[]
): Promise<void> {
  if (inputs.length === 0) {
    return
  }
  const values = inputs.map(normalizeCanonicalEventOutcome)
  await assertAgendaAssociations(database, values)
  await database
    .insert(eventOutcomes)
    .values(values)
    .onConflictDoUpdate({
      set: {
        actionId: sql`excluded.action_id`,
        agendaAssociation: sql`excluded.agenda_association`,
        agendaItemId: sql`excluded.agenda_item_id`,
        classification: sql`excluded.classification`,
        description: sql`excluded.description`,
        eventId: sql`excluded.event_id`,
        linkMethod: sql`excluded.link_method`,
        sourceIsOfficial: sql`excluded.source_is_official`,
        sourceProvider: sql`excluded.source_provider`,
        sourceRetrievedAt: sql`excluded.source_retrieved_at`,
        sourceSequence: sql`excluded.source_sequence`,
        sourceUpdatedAt: sql`excluded.source_updated_at`,
        sourceUrl: sql`excluded.source_url`,
        updatedAt: new Date(),
        voteId: sql`excluded.vote_id`
      },
      target: eventOutcomes.id
    })
}

export function normalizeCanonicalEventOutcome(input: unknown): typeof eventOutcomes.$inferInsert {
  if (!isRecord(input)) {
    throw new LegislationError("invalid_request", "Canonical event outcome must be an object")
  }
  const agendaAssociation = input.agendaAssociation
  const agendaItemId = input.agendaItemId
  if (agendaAssociation === "explicit") {
    if (typeof agendaItemId !== "string") {
      throw new LegislationError("invalid_request", "Explicit agenda association requires agendaItemId")
    }
  } else if (agendaAssociation !== "none" || agendaItemId !== undefined) {
    throw new LegislationError("invalid_request", "Agenda association must be explicitly complete")
  }
  const classification = canonicalClassification(input.classification)
  const actionId = optionalInputText(input.actionId, "actionId")
  const voteId = optionalInputText(input.voteId, "voteId")
  assertTarget(classification, actionId, voteId)
  const sourceUrl = requiredInputText(input.sourceUrl, "sourceUrl")
  if (!sourceUrl.startsWith("https://")) {
    throw new LegislationError("invalid_request", "sourceUrl must use HTTPS")
  }
  return {
    actionId,
    agendaAssociation,
    agendaItemId: agendaAssociation === "explicit" ? requiredInputText(agendaItemId, "agendaItemId") : null,
    classification,
    description: requiredInputText(input.description, "description"),
    eventId: requiredInputText(input.eventId, "eventId"),
    id: requiredInputText(input.id, "id"),
    linkMethod: canonicalLinkMethod(input.linkMethod),
    sourceIsOfficial: requiredBoolean(input.sourceIsOfficial, "sourceIsOfficial"),
    sourceProvider: requiredInputText(input.sourceProvider, "sourceProvider"),
    sourceRetrievedAt: requiredDate(input.sourceRetrievedAt, "sourceRetrievedAt"),
    sourceSequence: requiredNonnegativeInteger(input.sourceSequence, "sourceSequence"),
    sourceUpdatedAt: optionalDate(input.sourceUpdatedAt, "sourceUpdatedAt"),
    sourceUrl,
    voteId
  }
}

async function assertAgendaAssociations(
  database: LegislationDatabase,
  values: readonly (typeof eventOutcomes.$inferInsert)[]
): Promise<void> {
  const explicit: Array<{ agendaItemId: string; eventId: string }> = []
  for (const value of values) {
    if (
      value.agendaAssociation === "explicit" &&
      typeof value.agendaItemId === "string" &&
      typeof value.eventId === "string"
    ) {
      explicit.push({ agendaItemId: value.agendaItemId, eventId: value.eventId })
    }
  }
  if (explicit.length === 0) {
    return
  }
  const agendaItemIds = [...new Set(explicit.map((value) => value.agendaItemId))]
  const rows = await database
    .select({ eventId: eventAgendaItems.eventId, id: eventAgendaItems.id })
    .from(eventAgendaItems)
    .where(and(inArray(eventAgendaItems.id, agendaItemIds), eq(eventAgendaItems.canonicalFactsComplete, true)))
  const persisted = new Set(rows.map((row) => `${row.eventId}\u0000${row.id}`))
  for (const value of explicit) {
    if (!persisted.has(`${value.eventId}\u0000${value.agendaItemId}`)) {
      throw new LegislationError("invalid_request", "agendaItemId must be complete and belong to eventId")
    }
  }
}

function canonicalClassification(value: unknown): "action" | "vote" | "disposition" | "note" {
  if (value === "action" || value === "vote" || value === "disposition" || value === "note") {
    return value
  }
  throw new LegislationError("invalid_request", "classification must be canonical")
}

function canonicalLinkMethod(value: unknown): "deterministic-id" | "explicit" {
  if (value === "deterministic-id" || value === "explicit") {
    return value
  }
  throw new LegislationError("invalid_request", "linkMethod must be canonical")
}

function assertTarget(
  classification: "action" | "vote" | "disposition" | "note",
  actionId: string | null,
  voteId: string | null
): void {
  if (classification === "action" && actionId !== null && voteId === null) {
    return
  }
  if (classification === "vote" && actionId === null && voteId !== null) {
    return
  }
  if ((classification === "disposition" || classification === "note") && actionId === null && voteId === null) {
    return
  }
  throw new LegislationError("invalid_request", "Outcome target must match its canonical classification")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function requiredInputText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LegislationError("invalid_request", `${name} must be non-empty`)
  }
  return value
}

function optionalInputText(value: unknown, name: string): string | null {
  if (value === undefined || value === null) {
    return null
  }
  return requiredInputText(value, name)
}

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("invalid_request", `${name} must be boolean`)
  }
  return value
}

function requiredDate(value: unknown, name: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new LegislationError("invalid_request", `${name} must be a valid Date`)
  }
  return value
}

function requiredNonnegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new LegislationError("invalid_request", `${name} must be a non-negative integer`)
  }
  return value
}

function optionalDate(value: unknown, name: string): Date | null {
  if (value === undefined || value === null) {
    return null
  }
  return requiredDate(value, name)
}
