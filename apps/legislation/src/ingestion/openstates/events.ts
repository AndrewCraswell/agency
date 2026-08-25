import { z } from "zod"
import type { EventAgendaItemSnapshot } from "../../db/queries/events.js"
import type { eventDocuments, eventParticipants, legislativeEvents } from "../../db/schema/schema.js"
import { eventChildId, jurisdictionId, legislativeEventId } from "../../legislation/identifiers.js"

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
  .object({ entity_type: optionalString, name: z.string().trim().min(1), note: optionalString })
  .passthrough()
const agendaSchema = z
  .object({
    classification: z.array(z.string()).default([]),
    description: optionalString,
    order: z.number().int().nonnegative(),
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
    location: z.record(z.string(), z.unknown()).optional(),
    name: z.string().trim().min(1),
    participants: z.array(participantSchema).default([]),
    sources: z.array(z.object({ url: z.string().trim().min(1) }).passthrough()).default([]),
    start_date: z.string().trim().min(1),
    status: z.string().trim().min(1),
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
  participants: ParticipantInsert[]
}

function exactDate(value: string | undefined): string | undefined {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

function uniqueBy<T>(values: T[], identity: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [identity(value), value])).values()]
}

function canonicalEventStatus(status: string, isDeleted: boolean): string {
  if (isDeleted) {
    return "deleted"
  }
  const normalized = status.trim().toLowerCase().replaceAll("_", "-")
  return normalized === "canceled" ? "cancelled" : normalized
}

export function normalizeOpenStatesEvent(
  input: unknown,
  context: { jurisdictionCode: string }
): OpenStatesEventSnapshot {
  const source = eventSchema.parse(input)
  const canonicalEventId = legislativeEventId("openstates", source.id)
  const locationUrl =
    typeof source.location?.url === "string" && source.location.url.length > 0 ? source.location.url : undefined
  return {
    agendaItems: uniqueBy(
      source.agenda.map((item) => ({
        agendaItem: {
          amendmentRelationsComplete: false,
          billRelationsComplete: false,
          canonicalFactsComplete: item.title !== undefined,
          classification: item.classification[0],
          description: item.description,
          eventId: canonicalEventId,
          id: eventChildId("agenda", canonicalEventId, `${item.order}:${item.title ?? item.description ?? ""}`),
          materialRelationsComplete: false,
          ordinal: item.order,
          status: item.status,
          title: item.title
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
      classification: source.classification,
      description: source.description,
      endAt: source.end_date === undefined ? undefined : new Date(source.end_date),
      id: canonicalEventId,
      isDeleted: source.deleted,
      jurisdictionId: jurisdictionId(context.jurisdictionCode),
      location: source.location,
      name: source.name,
      sourceId: source.id,
      sourceUpdatedAt: source.updated_at === undefined ? undefined : new Date(source.updated_at),
      sourceUrl: source.sources[0]?.url,
      startAt: new Date(source.start_date),
      status: canonicalEventStatus(source.status, source.deleted),
      upstreamIds: {
        openstates: source.id,
        ...(source.upstream_id === undefined ? {} : { provider: source.upstream_id })
      },
      virtualAccess: locationUrl === undefined ? undefined : { url: locationUrl }
    },
    participants: uniqueBy(
      source.participants.map((participant) => ({
        eventId: canonicalEventId,
        id: eventChildId(
          "participant",
          canonicalEventId,
          `${participant.entity_type ?? "unknown"}:${participant.name}`
        ),
        name: participant.name,
        role: participant.note ?? participant.entity_type
      })),
      (participant) => participant.id
    )
  }
}
