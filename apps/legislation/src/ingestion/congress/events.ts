import { z } from "zod"
import type { EventSnapshot } from "../../db/queries/events.js"
import type { supportingMaterialLinks, supportingMaterials } from "../../db/schema/schema.js"
import {
  eventChildId,
  federalBillId,
  jurisdictionId,
  legislativeEventId,
  legislativeSessionId,
  organizationId,
  supportingMaterialId
} from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const committeeSchema = z.object({ name: optionalString, systemCode: z.string().min(1) }).passthrough()
const documentSchema = z
  .object({
    description: optionalString,
    documentType: optionalString,
    format: optionalString,
    name: optionalString,
    url: z.string().url()
  })
  .passthrough()
const billSchema = z
  .object({ congress: z.number().int().positive(), number: z.string().min(1), type: z.string().min(1) })
  .passthrough()
const materialFormatSchema = z.object({ type: z.string().min(1), url: z.string().url() }).passthrough()
const meetingBundleSchema = z.object({
  meeting: z
    .object({
      chamber: z.string().min(1),
      committees: z.array(committeeSchema).default([]),
      congress: z.number().int().positive(),
      date: z.string().min(1),
      eventId: z.string().min(1),
      location: z.record(z.string(), z.unknown()).optional(),
      meetingDocuments: z.array(z.unknown()).default([]),
      meetingStatus: optionalString,
      relatedItems: z.object({ bills: z.array(billSchema).default([]) }).default({ bills: [] }),
      title: z.string().min(1),
      type: optionalString,
      updateDate: optionalString,
      videos: z.array(z.object({ name: optionalString, url: z.string().url() }).passthrough()).default([]),
      witnessDocuments: z.array(z.unknown()).default([]),
      witnesses: z
        .array(
          z.object({ name: z.string().min(1), organization: optionalString, position: optionalString }).passthrough()
        )
        .default([])
    })
    .passthrough(),
  sourceUrl: z.string().url()
})
const hearingBundleSchema = z.object({
  hearing: z
    .object({
      chamber: z.string().min(1),
      committees: z.array(committeeSchema).default([]),
      congress: z.number().int().positive(),
      dates: z.array(z.object({ date: z.string().min(1) }).passthrough()).default([]),
      formats: z.array(materialFormatSchema).default([]),
      jacketNumber: z.union([z.string(), z.number()]).transform(String),
      title: optionalString,
      updateDate: optionalString
    })
    .passthrough(),
  sourceUrl: z.string().url()
})

type MaterialInsert = typeof supportingMaterials.$inferInsert
type MaterialLinkInsert = typeof supportingMaterialLinks.$inferInsert

export interface CongressEventSnapshot extends EventSnapshot {
  billIds: string[]
  materials: Array<{ link: MaterialLinkInsert; material: MaterialInsert }>
}

export interface CongressEventNormalizationContext {
  retrievedAt?: Date
}

function committeeName(committee: z.infer<typeof committeeSchema>): string {
  return committee.name ?? committee.systemCode
}

/**
 * Congress.gov can repeat the same committee in a meeting or hearing payload.
 * Participant IDs are derived from the committee system code, so retain the
 * first occurrence before building durable child records.
 */
function uniqueCommittees(values: z.infer<typeof committeeSchema>[]): z.infer<typeof committeeSchema>[] {
  const unique = new Map<string, z.infer<typeof committeeSchema>>()
  for (const committee of values) {
    if (!unique.has(committee.systemCode)) {
      unique.set(committee.systemCode, committee)
    }
  }
  return [...unique.values()]
}

function hasExplicitCommitteeList(input: unknown): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false
  }
  const event = Reflect.get(input, "meeting")
  return typeof event === "object" && event !== null && !Array.isArray(event) && Array.isArray(event.committees)
}

function sourceDate(value: string, field: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Congress event ${field} must be a valid timestamp`)
  }
  return parsed
}

function publisherLocalDate(value: string): string | undefined {
  const date = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1]
  const parsed = date === undefined ? undefined : new Date(`${date}T00:00:00.000Z`)
  if (
    date === undefined ||
    parsed === undefined ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return undefined
  }
  return date
}

function officialCongressSourceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "api.congress.gov"
  } catch {
    return false
  }
}

function validRetrievedAt(value: Date | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.valueOf())
}

function eventProvenance(sourceUrl: string, context: CongressEventNormalizationContext) {
  const retrievedAt = validRetrievedAt(context.retrievedAt) ? context.retrievedAt : undefined
  const provenanceComplete = officialCongressSourceUrl(sourceUrl) && retrievedAt !== undefined
  return {
    provenanceComplete,
    sourceIsOfficial: provenanceComplete ? true : undefined,
    sourceProvider: provenanceComplete ? "congress" : undefined,
    sourceRetrievedAt: retrievedAt
  }
}

/**
 * Congress.gov does not expose a boolean remote flag for committee meetings.
 * Its declared location can prove a physical or virtual setting, but a hybrid
 * or otherwise unclassified location must remain unknown.
 */
function sourceRemoteStatus(location: Record<string, unknown> | undefined): boolean | undefined {
  if (location === undefined) {
    return undefined
  }
  const address = Reflect.get(location, "address")
  const hasPhysicalLocation =
    (typeof address === "string" && address.trim().length > 0 && !isVirtualLocationText(address)) ||
    ["building", "room"].some((field) => {
      const value = Reflect.get(location, field)
      return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        !/^-+$/.test(value.trim()) &&
        !isVirtualLocationText(value)
      )
    })
  const hasVirtualLocation = Object.values(location).some(isVirtualLocationText)
  if (hasPhysicalLocation === hasVirtualLocation) {
    return undefined
  }
  return hasPhysicalLocation ? false : true
}

function isVirtualLocationText(value: unknown): boolean {
  return typeof value === "string" && /\b(?:online|remote|virtual|webex)\b/i.test(value)
}

function sourceClassification(value: string | undefined): "hearing" | "meeting" | "other" | undefined {
  if (value === undefined) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "hearing") {
    return "hearing"
  }
  if (normalized === "markup" || normalized === "meeting") {
    return "meeting"
  }
  return "other"
}

function sourceStatus(value: string | undefined): "cancelled" | "other" | "postponed" | "scheduled" | undefined {
  if (value === undefined) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "scheduled") {
    return "scheduled"
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return "cancelled"
  }
  if (normalized === "postponed" || normalized === "rescheduled") {
    return "postponed"
  }
  return "other"
}

function materialClassification(value: string | undefined): string {
  const normalized = value?.toLowerCase() ?? ""
  if (normalized.includes("transcript")) {
    return "hearing-transcript"
  }
  if (normalized.includes("witness statement")) {
    return "witness-statement"
  }
  if (normalized.includes("testimony")) {
    return "testimony"
  }
  if (normalized.includes("member statement")) {
    return "member-statement"
  }
  return "meeting-document"
}

function contentType(value: string | undefined): string | undefined {
  const normalized = value?.toLowerCase()
  if (normalized === "pdf") {
    return "application/pdf"
  }
  if (normalized?.includes("text") === true || normalized === "html") {
    return "text/html"
  }
  return undefined
}

function uniqueDocuments<T extends { url: string }>(values: T[]): T[] {
  const unique = new Map<string, T>()
  for (const value of values) {
    if (!unique.has(value.url)) {
      unique.set(value.url, value)
    }
  }
  return [...unique.values()]
}

function usableDocuments(values: unknown[]): z.infer<typeof documentSchema>[] {
  return values.flatMap((value) => {
    const parsed = documentSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
  })
}

function materials(
  eventId: string,
  values: Array<{ description?: string; documentType?: string; format?: string; name?: string; url: string }>,
  date: string | undefined
): CongressEventSnapshot["materials"] {
  return values.map((value) => {
    const id = supportingMaterialId("congress", value.url)
    return {
      link: { eventId, materialId: id },
      material: {
        classification: materialClassification(value.documentType),
        contentType: contentType(value.format),
        documentDate: date,
        id,
        jurisdictionId: jurisdictionId("us"),
        sourceId: value.url,
        sourceUrl: value.url,
        title: value.name ?? value.description ?? value.documentType ?? "Meeting document"
      }
    }
  })
}

export function normalizeCongressCommitteeMeeting(
  input: unknown,
  context: CongressEventNormalizationContext
): CongressEventSnapshot {
  const source = meetingBundleSchema.parse(input)
  const meeting = source.meeting
  const eventId = legislativeEventId("congress", `committee-meeting-${meeting.eventId}`)
  const date = publisherLocalDate(meeting.date)
  const startAt = sourceDate(meeting.date, "meeting.date")
  const committees = uniqueCommittees(meeting.committees)
  const isRemote = sourceRemoteStatus(meeting.location)
  const classification = sourceClassification(meeting.type)
  const status = sourceStatus(meeting.meetingStatus)
  const organizationRelationsComplete = hasExplicitCommitteeList(input)
  const provenance = eventProvenance(source.sourceUrl, context)
  const sessionRelationsComplete = true
  // Congress.gov occasionally includes placeholder document objects without a
  // usable URL. They cannot become a durable material or event child, but must
  // not prevent the meeting itself from checkpointing and the replay advancing.
  const documents = uniqueDocuments(usableDocuments([...meeting.meetingDocuments, ...meeting.witnessDocuments]))
  return {
    agendaItems: [],
    billIds: meeting.relatedItems.bills.map((bill) => federalBillId(bill.congress, bill.type, bill.number)),
    documents: documents.map((document) => ({
      classification: materialClassification(document.documentType),
      contentType: contentType(document.format),
      documentDate: date,
      eventId,
      id: eventChildId("document", eventId, document.url),
      sourceUrl: document.url,
      title: document.name ?? document.description ?? document.documentType ?? "Meeting document"
    })),
    event: {
      allDay: false,
      canonicalFactsComplete:
        date !== undefined &&
        isRemote !== undefined &&
        classification !== undefined &&
        provenance.provenanceComplete &&
        organizationRelationsComplete &&
        sessionRelationsComplete &&
        status !== undefined,
      classification: classification ?? "other",
      id: eventId,
      isDeleted: false,
      isRemote,
      jurisdictionId: jurisdictionId("us"),
      location: meeting.location,
      name: meeting.title,
      organizationRelationsComplete,
      publisherLocalDate: date,
      ...provenance,
      sourceId: meeting.eventId,
      sourceUpdatedAt: meeting.updateDate === undefined ? undefined : new Date(meeting.updateDate),
      sourceUrl: source.sourceUrl,
      startAt,
      sessionRelationsComplete,
      status: status ?? "other",
      upstreamIds: { congress: meeting.eventId },
      virtualAccess: meeting.videos[0] === undefined ? undefined : { url: meeting.videos[0].url }
    },
    materials: materials(eventId, documents, date),
    organizationIds: committees.map((committee) => organizationId("congress", committee.systemCode)),
    participants: [
      ...committees.map((committee) => ({
        eventId,
        id: eventChildId("participant", eventId, `committee:${committee.systemCode}`),
        name: committeeName(committee),
        organizationId: organizationId("congress", committee.systemCode),
        role: "committee"
      })),
      ...meeting.witnesses.map((witness, index) => ({
        eventId,
        id: eventChildId("participant", eventId, `witness:${index}:${witness.name}`),
        name: witness.name,
        role: [witness.position, witness.organization].filter(Boolean).join(", ") || "witness"
      }))
    ],
    sessionIds: [legislativeSessionId("us", String(meeting.congress))]
  }
}

export function normalizeCongressHearing(input: unknown): CongressEventSnapshot | undefined {
  const source = hearingBundleSchema.parse(input)
  const hearing = source.hearing
  const hearingDate = hearing.dates[0]?.date
  const title = hearing.title
  if (hearingDate === undefined || title === undefined) {
    return undefined
  }
  const eventId = legislativeEventId("congress", `published-hearing-${hearing.jacketNumber}`)
  const date = hearingDate.slice(0, 10)
  const committees = uniqueCommittees(hearing.committees)
  const formats = uniqueDocuments(
    hearing.formats.map((format) => ({
      documentType: "Hearing transcript",
      format: format.type,
      name: title,
      url: format.url
    }))
  )
  return {
    agendaItems: [],
    billIds: [],
    documents: formats.map((format) => ({
      classification: "hearing-transcript",
      contentType: contentType(format.format),
      documentDate: date,
      eventId,
      id: eventChildId("document", eventId, format.url),
      sourceUrl: format.url,
      title
    })),
    event: {
      allDay: true,
      canonicalFactsComplete: false,
      classification: "hearing",
      id: eventId,
      isDeleted: false,
      organizationRelationsComplete: false,
      jurisdictionId: jurisdictionId("us"),
      name: title,
      sourceId: hearing.jacketNumber,
      sourceUpdatedAt: hearing.updateDate === undefined ? undefined : new Date(hearing.updateDate),
      sourceUrl: source.sourceUrl,
      startAt: new Date(`${date}T00:00:00Z`),
      sessionRelationsComplete: false,
      status: "other",
      upstreamIds: { congress: hearing.jacketNumber }
    },
    materials: materials(eventId, formats, date),
    organizationIds: [],
    participants: committees.map((committee) => ({
      eventId,
      id: eventChildId("participant", eventId, `committee:${committee.systemCode}`),
      name: committeeName(committee),
      organizationId: organizationId("congress", committee.systemCode),
      role: "committee"
    })),
    sessionIds: []
  }
}
