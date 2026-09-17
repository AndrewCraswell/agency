import { z } from "zod"
import { entityCardSchema, projectEntityResult } from "./entityResults"
import { sourceUrlSchema } from "./evidence"

export const recordDetailRequestSchema = z.strictObject({
  action: z.literal("inspect-record"),
  sessionKey: z.uuid(),
  resultId: z.uuid(),
  recordId: z.string().min(1).max(512),
  parentRecordId: z.string().min(1).max(512).optional(),
  cursor: z.string().min(1).max(4096).optional()
})

export const voteDetailsSchema = z.object({
  isPartial: z.boolean().optional(),
  record: entityCardSchema,
  heldAt: z.iso.datetime({ offset: true }).optional(),
  hasCompleteTally: z.boolean(),
  positions: z.array(z.object({ id: z.string(), name: z.string().optional(), option: z.string() })).max(1000)
})
export type VoteDetails = z.infer<typeof voteDetailsSchema>

export const meetingDetailsSchema = z.object({
  isPartial: z.boolean().optional(),
  record: entityCardSchema,
  description: z.string().optional(),
  agenda: z
    .array(
      z.object({
        id: z.string(),
        ordinal: z.number().int().nonnegative(),
        title: z.string(),
        description: z.string().optional()
      })
    )
    .max(1000),
  participants: z.array(z.object({ id: z.string(), name: z.string(), role: z.string().optional() })).max(1000),
  documents: z.array(z.object({ id: z.string(), title: z.string(), sourceUrl: sourceUrlSchema.nullable() })).max(1000)
})
export type MeetingDetails = z.infer<typeof meetingDetailsSchema>

export const profileDetailsSchema = z.object({
  record: entityCardSchema,
  party: z.string().optional(),
  officeLabel: z.string().optional(),
  terms: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        district: z.string().optional(),
        startDate: z.iso.date().optional(),
        endDate: z.iso.date().optional(),
        isActive: z.boolean().optional()
      })
    )
    .max(1000),
  description: z.string().optional(),
  processingStatus: z.string().optional(),
  sections: z.array(z.object({ id: z.string(), heading: z.string().optional(), text: z.string() })).max(100),
  nextCursor: z.string().optional()
})
export type ProfileDetails = z.infer<typeof profileDetailsSchema>

export function projectProfileDetails(kind: "person" | "organization" | "material", data: unknown): ProfileDetails {
  const toolNames = { person: "get_person", organization: "get_organization", material: "get_supporting_material" }
  const record = projectEntityResult(toolNames[kind], data)?.items[0]
  if (!record) {
    throw new Error("Record detail is unreadable")
  }
  const container = z.record(z.string(), z.unknown()).parse(data)
  const source = z.record(z.string(), z.unknown()).parse(container[kind])
  const terms =
    kind === "person"
      ? z
          .array(
            z.object({
              id: z.string(),
              officeTitle: z.string().nullish(),
              district: z.string().nullish(),
              startDate: z.iso.date().nullish(),
              endDate: z.iso.date().nullish(),
              isActive: z.boolean().nullish()
            })
          )
          .max(1000)
          .parse(container.terms)
      : []
  const sections =
    kind === "material"
      ? z
          .array(z.object({ id: z.string(), heading: z.string().nullish(), text: z.string() }))
          .max(100)
          .parse(container.sections)
      : []
  return profileDetailsSchema.parse({
    record,
    party: kind === "person" && typeof source.party === "string" ? source.party : undefined,
    officeLabel:
      kind === "person"
        ? [
            record.personSummary?.term?.officeTitle,
            record.personSummary?.term?.district ? `District ${record.personSummary.term.district}` : undefined
          ]
            .filter(Boolean)
            .join(", ") || undefined
        : undefined,
    terms: terms.map((term) => ({
      id: term.id,
      title: term.officeTitle ?? undefined,
      district: term.district ?? undefined,
      startDate: term.startDate ?? undefined,
      endDate: term.endDate ?? undefined,
      isActive: term.isActive ?? undefined
    })),
    description: typeof source.description === "string" ? source.description : undefined,
    processingStatus: typeof source.processingStatus === "string" ? source.processingStatus : undefined,
    sections:
      source.processingStatus === "processed"
        ? sections.map((section) => ({ ...section, heading: section.heading ?? undefined }))
        : [],
    nextCursor: kind === "material" && typeof container.nextCursor === "string" ? container.nextCursor : undefined
  })
}

export function projectMeetingDetails(data: unknown): MeetingDetails {
  const input = z
    .object({
      event: z.object({ description: z.string().nullish() }),
      truncated: z.boolean().optional(),
      agendaItems: z
        .array(
          z.object({
            id: z.string(),
            ordinal: z.number().int().nonnegative(),
            title: z.string().nullish(),
            description: z.string().nullish()
          })
        )
        .max(1000),
      participants: z
        .array(
          z.object({
            participant: z.object({ id: z.string(), name: z.string().nullish(), role: z.string().nullish() }),
            person: z.object({ name: z.string() }).nullish(),
            organization: z.object({ name: z.string() }).nullish()
          })
        )
        .max(1000),
      documents: z.array(z.object({ id: z.string(), title: z.string(), sourceUrl: z.string() })).max(1000)
    })
    .parse(data)
  const record = projectEntityResult("get_event", data)?.items[0]
  if (!record) {
    throw new Error("Meeting detail is unreadable")
  }
  return meetingDetailsSchema.parse({
    record,
    isPartial: input.truncated === true,
    description: input.event.description ?? undefined,
    agenda: input.agendaItems
      .toSorted((left, right) => left.ordinal - right.ordinal)
      .map((item) => ({
        id: item.id,
        ordinal: item.ordinal,
        title: item.title ?? item.description ?? "Untitled agenda item",
        description: item.title ? (item.description ?? undefined) : undefined
      })),
    participants: input.participants.map(({ participant, person, organization }) => ({
      id: participant.id,
      name: participant.name ?? person?.name ?? organization?.name ?? "Name not published",
      role: participant.role ?? undefined
    })),
    documents: input.documents.map((document) => {
      const source = sourceUrlSchema.safeParse(document.sourceUrl)
      return { id: document.id, title: document.title, sourceUrl: source.success ? source.data : null }
    })
  })
}

const voteInputSchema = z.object({
  positionsTruncated: z.boolean().optional(),
  vote: z.object({ heldAt: z.union([z.date(), z.iso.datetime({ offset: true })]).nullish() }),
  positions: z
    .array(
      z.object({
        person: z.object({ name: z.string().nullish() }).nullish(),
        position: z.object({ sourceIdentity: z.string(), sourceName: z.string().nullish(), option: z.string() })
      })
    )
    .max(1000)
})

export function projectVoteDetails(data: unknown): VoteDetails {
  const input = voteInputSchema.parse(data)
  const record = projectEntityResult("get_vote", data)?.items[0]
  if (!record) {
    throw new Error("Vote detail is unreadable")
  }
  let heldAt = input.vote.heldAt ?? undefined
  if (heldAt instanceof Date) {
    heldAt = heldAt.toISOString()
  }
  return voteDetailsSchema.parse({
    record,
    isPartial: input.positionsTruncated === true,
    heldAt,
    hasCompleteTally: record.tallies.length === 9,
    positions: input.positions.map(({ person, position }) => ({
      id: position.sourceIdentity,
      name: position.sourceName?.trim() || person?.name?.trim() || undefined,
      option: position.option
    }))
  })
}
