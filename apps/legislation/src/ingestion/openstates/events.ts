import { z } from "zod"
import type { EventAgendaItemSnapshot } from "../../db/queries/events.js"
import type { eventDocuments, eventParticipants, legislativeEvents } from "../../db/schema/schema.js"
import {
  eventChildId,
  jurisdictionId,
  legislativeEventId,
  legislativeSessionId,
  organizationId
} from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional()
)
const linkSchema = z
  .object({ media_type: optionalString, text: optionalString, url: z.string().trim().min(1) })
  .passthrough()
const documentSchema = z
  .object({
    classification: optionalString,
    date: optionalString,
    links: z.array(linkSchema).default([]),
    note: optionalString
  })
  .passthrough()
const participantSchema = z
  .object({
    entity_type: optionalString,
    name: z.string().trim().min(1),
    note: optionalString,
    organization: z
      .object({ id: z.string().trim().min(1) })
      .passthrough()
      .nullable()
      .optional()
  })
  .passthrough()
const agendaRelatedEntitySchema = z
  .object({
    bill: z.object({ session: optionalString }).passthrough().optional(),
    entity_type: optionalString
  })
  .passthrough()
const agendaSchema = z
  .object({
    classification: z.array(z.string()).default([]),
    description: optionalString,
    order: z.number().int().nonnegative(),
    related_entities: z.array(agendaRelatedEntitySchema).default([]),
    status: optionalString,
    title: optionalString
  })
  .passthrough()
const eventSchema = z
  .object({
    agenda: z.array(agendaSchema).default([]),
    all_day: z.boolean().default(false),
    classification: optionalString,
    deleted: z.boolean().default(false),
    description: optionalString,
    documents: z.array(documentSchema).default([]),
    end_date: optionalString,
    id: z.string().trim().min(1),
    is_remote: z.boolean().optional(),
    location: z
      .object({ address: optionalString, name: optionalString, room: optionalString, url: optionalString })
      .passthrough()
      .optional(),
    name: z.string().trim().min(1),
    participants: z.array(participantSchema).default([]),
    sources: z.array(z.object({ url: z.string().trim().min(1) }).passthrough()).default([]),
    start_date: z.string().trim().min(1),
    status: z.string().trim().min(1),
    timezone: optionalString,
    upstream_id: optionalString,
    updated_at: optionalString
  })
  .passthrough()

type EventInsert = typeof legislativeEvents.$inferInsert
type ParticipantInsert = typeof eventParticipants.$inferInsert
type DocumentInsert = typeof eventDocuments.$inferInsert

export interface OpenStatesEventSnapshot {
  agendaItems: EventAgendaItemSnapshot[]
  documents: DocumentInsert[]
  event: EventInsert
  organizationIds: string[]
  organizationReferences?: string[]
  participants: ParticipantInsert[]
  sessionIds: string[]
}

function exactDate(value: string | undefined): string | undefined {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

function sourceDate(value: string, name: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Open States event ${name} must be a valid timestamp`)
  }
  return parsed
}

function optionalSourceDate(value: string | undefined, name: string): Date | undefined {
  return value === undefined ? undefined : sourceDate(value, name)
}

function httpsSourceUrl(value: string | undefined): value is string {
  if (value === undefined) {
    return false
  }
  try {
    return value.startsWith("https://") && new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function uniqueBy<T>(values: T[], identity: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [identity(value), value])).values()]
}

function canonicalEventStatus(status: string): "cancelled" | "completed" | "other" | "postponed" | "scheduled" {
  const normalized = status.trim().toLowerCase().replaceAll("_", "-")
  if (["scheduled", "confirmed", "tentative"].includes(normalized)) {
    return "scheduled"
  }
  if (["completed", "passed", "held"].includes(normalized)) {
    return "completed"
  }
  if (["cancelled", "canceled"].includes(normalized)) {
    return "cancelled"
  }
  if (["postponed", "rescheduled", "deferred"].includes(normalized)) {
    return "postponed"
  }
  return "other"
}

function canonicalEventClassification(value: string | undefined): "hearing" | "meeting" | "other" | "session" {
  const normalized = value?.trim().toLowerCase().replaceAll("_", "-")
  if (normalized === "hearing" || normalized?.endsWith("-hearing")) {
    return "hearing"
  }
  if (normalized === "session" || normalized?.endsWith("-session")) {
    return "session"
  }
  if (normalized === "meeting" || normalized?.endsWith("-meeting")) {
    return "meeting"
  }
  return "other"
}

function sourceDeclaredLocation(location: z.infer<typeof eventSchema>["location"]): Record<string, string> | undefined {
  if (location === undefined) {
    return undefined
  }
  const values = Object.fromEntries(
    Object.entries({ address: location.address, name: location.name, room: location.room }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  return Object.keys(values).length === 0 ? undefined : values
}

export function normalizeOpenStatesEvent(
  input: unknown,
  context: { jurisdictionCode: string; retrievedAt?: Date }
): OpenStatesEventSnapshot {
  const source = eventSchema.parse(input)
  const canonicalEventId = legislativeEventId("openstates", source.id)
  const sourceUrl = source.sources[0]?.url
  const publisherLocalDate = exactDate(source.start_date)
  const startAt = sourceDate(source.start_date, "start_date")
  const provenanceComplete = httpsSourceUrl(sourceUrl) && context.retrievedAt !== undefined
  const agendaSessionIds = [
    ...new Set(source.agenda.flatMap((item) => item.related_entities.flatMap((entity) => entity.bill?.session ?? [])))
  ].map((session) => legislativeSessionId(context.jurisdictionCode, session))
  return {
    agendaItems: uniqueBy(
      source.agenda.map((item) => ({
        agendaItem: {
          amendmentRelationsComplete: false,
          billRelationsComplete: false,
          canonicalFactsComplete: item.title !== undefined || item.description !== undefined,
          classification: item.classification[0],
          description: item.description,
          eventId: canonicalEventId,
          id: eventChildId("agenda", canonicalEventId, `${item.order}:${item.title ?? item.description ?? ""}`),
          materialRelationsComplete: false,
          ordinal: item.order,
          status: item.status,
          title: item.title ?? item.description
        },
        amendmentIds: [],
        billIds: [],
        materialIds: []
      })),
      (item) => String(item.agendaItem.ordinal)
    ),
    documents: uniqueBy(
      source.documents.flatMap((document, documentIndex) =>
        document.links.map((link) => ({
          classification: document.classification,
          contentType: link.media_type,
          documentDate: exactDate(document.date),
          eventId: canonicalEventId,
          id: eventChildId("document", canonicalEventId, link.url),
          sourceUrl: link.url,
          title: document.note ?? link.text ?? `Event document ${documentIndex + 1}`
        }))
      ),
      (document) => document.sourceUrl
    ),
    event: {
      allDay: source.all_day,
      canonicalFactsComplete: false,
      classification: canonicalEventClassification(source.classification),
      description: source.description,
      endAt: optionalSourceDate(source.end_date, "end_date"),
      id: canonicalEventId,
      isRemote: source.is_remote,
      isDeleted: source.deleted,
      jurisdictionId: jurisdictionId(context.jurisdictionCode),
      location: sourceDeclaredLocation(source.location),
      name: source.name,
      organizationRelationsComplete: false,
      provenanceComplete,
      publisherLocalDate,
      sourceIsOfficial: provenanceComplete ? false : undefined,
      sourceProvider: provenanceComplete ? "openstates" : undefined,
      sourceRetrievedAt: context.retrievedAt,
      sourceId: source.id,
      sourceUpdatedAt: optionalSourceDate(source.updated_at, "updated_at"),
      sourceUrl,
      startAt,
      status: canonicalEventStatus(source.status),
      sessionRelationsComplete: false,
      timezone: source.timezone,
      upstreamIds: {
        openstates: source.id,
        ...(source.upstream_id === undefined ? {} : { provider: source.upstream_id })
      },
      virtualAccess: source.location?.url === undefined ? undefined : { url: source.location.url }
    },
    organizationIds: [],
    participants: uniqueBy(
      source.participants.map((participant) => ({
        eventId: canonicalEventId,
        id: eventChildId(
          "participant",
          canonicalEventId,
          `${participant.entity_type ?? "unknown"}:${participant.name}`
        ),
        name: participant.name,
        organizationId:
          participant.organization === undefined || participant.organization === null
            ? undefined
            : organizationId("openstates", participant.organization.id),
        role: participant.note ?? participant.entity_type
      })),
      (participant) => participant.id
    ),
    sessionIds: agendaSessionIds
  }
}
