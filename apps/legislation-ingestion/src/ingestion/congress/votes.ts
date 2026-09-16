import type { votePositions, votes } from "@repo/legislation-core/database/schema/schema"
import {
  federalBillId,
  federalAmendmentId,
  legislativeSessionId,
  legislativeVoteId,
  organizationId,
  personId
} from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"

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
  members: z.object({ results: z.array(memberVoteSchema) }).passthrough(),
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
  const membersByIdentity = new Map<
    string,
    { member: (typeof source.members.results)[number]; sourceSequence: number }
  >()
  source.members.results.forEach((member, sourceSequence) => {
    if (!membersByIdentity.has(member.bioguideID)) {
      membersByIdentity.set(member.bioguideID, { member, sourceSequence })
    }
  })
  const uniqueMembers = [...membersByIdentity.values()]
  const positions = uniqueMembers.map(({ member, sourceSequence }) => ({
    option: normalizeOption(member.voteCast),
    personId: personId("congress", member.bioguideID),
    sourceIdentity: member.bioguideID,
    sourceName: [member.firstName, member.lastName].filter(Boolean).join(" "),
    sourcePersonId: member.bioguideID,
    sourceSequence,
    voteId: canonicalVoteId
  }))
  const yesCount = positions.filter((position) => position.option === "yes").length
  const noCount = positions.filter((position) => position.option === "no").length
  const absentCount = positions.filter((position) => position.option === "absent").length
  const abstainCount = positions.filter((position) => position.option === "abstain").length
  const notVotingCount = positions.filter((position) => position.option === "not-voting").length
  const presentCount = positions.filter((position) => position.option === "present").length
  const proxyCount = positions.filter((position) => position.option === "proxy").length
  const pairedCount = positions.filter((position) => position.option === "paired").length
  const otherCount = positions.filter((position) => position.option === "other").length
  const target = structuredLegislationTarget(reference)
  const heldAt = sourceDate(source.vote.startDate)

  return {
    positions,
    vote: {
      ...target,
      chamber: "lower",
      classification: "roll-call",
      heldAt,
      id: canonicalVoteId,
      motion: source.vote.voteQuestion,
      noCount,
      absentCount,
      abstainCount,
      notVotingCount,
      organizationId: organizationId("congress", "house"),
      otherCount,
      pairedCount,
      presentCount,
      proxyCount,
      question: source.vote.voteQuestion,
      result: canonicalResult(source.vote.result),
      rollCallNumber: String(reference.rollCallNumber),
      sessionId: legislativeSessionId("us", String(reference.congress)),
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: new Date(),
      sourceSequence: reference.rollCallNumber,
      sourceId: reference.identifier,
      sourceUrl: reference.url,
      timelineComplete: true,
      voteType: source.vote.voteType,
      yesCount
    }
  }
}

function canonicalResult(value: string | undefined): "failed" | "other" | "passed" {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (normalized.includes("fail") || normalized.includes("reject") || normalized.includes("not agreed")) {
    return "failed"
  }
  if (
    normalized.includes("pass") ||
    normalized.includes("agree") ||
    normalized.includes("adopt") ||
    normalized.includes("confirm")
  ) {
    return "passed"
  }
  return "other"
}

function sourceDate(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    throw new Error("Congress House vote startDate must be a valid timestamp")
  }
  return date
}
