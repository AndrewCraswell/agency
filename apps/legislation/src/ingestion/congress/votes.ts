import { z } from "zod"
import type { votePositions, votes } from "../../db/schema/schema.js"
import {
  federalBillId,
  federalAmendmentId,
  legislativeSessionId,
  legislativeVoteId,
  organizationId,
  personId
} from "../../legislation/identifiers.js"

const optionalString = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim().length === 0) ? undefined : value),
  z.string().trim().min(1).optional()
)
const referenceSchema = z
  .object({
    congress: z.number().int().positive(),
    identifier: z.union([z.string(), z.number()]).transform(String),
    legislationNumber: z.union([z.string(), z.number()]).transform(String).optional(),
    legislationType: optionalString,
    rollCallNumber: z.number().int().positive(),
    sessionNumber: z.number().int().positive(),
    sourceDataURL: z.string().url(),
    url: z.string().url()
  })
  .passthrough()
const voteSchema = z
  .object({
    result: optionalString,
    sourceDataURL: z.string().url(),
    startDate: z.string().min(1),
    voteQuestion: z.string().min(1),
    voteType: optionalString
  })
  .passthrough()
const memberVoteSchema = z
  .object({
    bioguideID: z.string().min(1),
    firstName: optionalString,
    lastName: z.string().min(1),
    voteCast: z.string().min(1)
  })
  .passthrough()
const bundleSchema = z.object({
  members: z.object({ results: z.array(memberVoteSchema).default([]) }).passthrough(),
  reference: referenceSchema,
  vote: voteSchema
})

type VoteInsert = typeof votes.$inferInsert
type VotePositionInsert = typeof votePositions.$inferInsert

export interface CongressHouseVoteSnapshot {
  positions: VotePositionInsert[]
  vote: VoteInsert
}

function normalizeOption(value: string): VotePositionInsert["option"] {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[_\s]+/g, "-")
  if (["aye", "yea", "yes"].includes(normalized)) {
    return "yes"
  }
  if (["nay", "no"].includes(normalized)) {
    return "no"
  }
  if (["not-voting", "absent"].includes(normalized)) {
    return normalized
  }
  if (["abstain", "present", "proxy", "paired"].includes(normalized)) {
    return normalized
  }
  return "other"
}

function structuredLegislationTarget(reference: z.infer<typeof referenceSchema>): {
  amendmentId?: string
  billId?: string
} {
  if (reference.legislationType === undefined || reference.legislationNumber === undefined) {
    return {}
  }
  const type = reference.legislationType.toLowerCase().replaceAll(/[^a-z0-9]/g, "")
  if (type === "hamdt" || type === "samdt") {
    return { amendmentId: federalAmendmentId(reference.congress, type, reference.legislationNumber) }
  }
  return { billId: federalBillId(reference.congress, type, reference.legislationNumber) }
}

export function normalizeCongressHouseVote(input: unknown): CongressHouseVoteSnapshot {
  const source = bundleSchema.parse(input)
  const reference = source.reference
  const canonicalVoteId = legislativeVoteId(
    "congress",
    `house-${reference.congress}-${reference.sessionNumber}-${reference.rollCallNumber}`
  )
  const uniqueMembers = [...new Map(source.members.results.map((member) => [member.bioguideID, member])).values()]
  const positions = uniqueMembers.map((member) => ({
    option: normalizeOption(member.voteCast),
    personId: personId("congress", member.bioguideID),
    sourceIdentity: member.bioguideID,
    sourceName: [member.firstName, member.lastName].filter(Boolean).join(" "),
    sourcePersonId: member.bioguideID,
    voteId: canonicalVoteId
  }))
  const yesCount = positions.filter((position) => position.option === "yes").length
  const noCount = positions.filter((position) => position.option === "no").length
  const otherCount = positions.length - yesCount - noCount
  const target = structuredLegislationTarget(reference)

  return {
    positions,
    vote: {
      ...target,
      chamber: "lower",
      classification: "roll-call",
      heldAt: new Date(source.vote.startDate),
      id: canonicalVoteId,
      motion: source.vote.voteQuestion,
      noCount,
      organizationId: organizationId("congress", "house"),
      otherCount,
      question: source.vote.voteQuestion,
      result: source.vote.result,
      rollCallNumber: String(reference.rollCallNumber),
      sessionId: legislativeSessionId("us", String(reference.congress)),
      sourceId: reference.identifier,
      sourceUrl: reference.url,
      voteType: source.vote.voteType,
      yesCount
    }
  }
}
