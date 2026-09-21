import type { votePositions, votes } from "@repo/legislation-core/database/schema/schema"
import {
  federalAmendmentId,
  federalBillId,
  legislativeSessionId,
  legislativeVoteId,
  organizationId,
  personId
} from "@repo/legislation-core/domain/identifiers"
import { XMLParser } from "fast-xml-parser"
import { z } from "zod"
import type { SenateVoteReference } from "./client.js"

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  isArray: (name) => name === "member"
})

const optionalString = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.string().trim().min(1).optional()
)
const voteCastSchema = z.preprocess(
  (value) => (typeof value === "object" && value !== null ? Reflect.get(value, "#text") : value),
  z.string().trim().min(1)
)
const memberSchema = z
  .object({
    first_name: optionalString,
    last_name: z.string().trim().min(1),
    lis_member_id: z.string().trim().min(1),
    member_full: optionalString,
    vote_cast: voteCastSchema
  })
  .passthrough()
const amendmentSchema = z.object({
  amendment_number: optionalString,
  amendment_to_document_number: optionalString
})
const documentSchema = z.object({
  document_number: optionalString,
  document_type: optionalString
})
const optionalArray = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(schema).optional()
  )
const voteSchema = z.object({
  roll_call_vote: z
    .object({
      amendment: optionalArray(amendmentSchema),
      congress: z.string().trim(),
      document: optionalArray(documentSchema),
      majority_requirement: optionalString,
      members: z.object({ member: z.array(memberSchema).default([]) }),
      question: optionalString,
      session: z.string().trim(),
      vote_date: z.string().trim().min(1),
      vote_document_text: optionalString,
      vote_number: z.string().trim(),
      vote_question_text: z.string().trim().min(1),
      vote_result: optionalString,
      vote_result_text: optionalString
    })
    .passthrough()
})

type VoteInsert = typeof votes.$inferInsert
type VotePositionInsert = typeof votePositions.$inferInsert

export interface SenateVoteSnapshot {
  positions: VotePositionInsert[]
  vote: VoteInsert
}

export function normalizeSenateVote(
  xml: string,
  reference: SenateVoteReference,
  memberIdentifiers: ReadonlyMap<string, string>,
  retrievedAt = new Date()
): SenateVoteSnapshot {
  const source = voteSchema.parse(parser.parse(xml)).roll_call_vote
  const voteNumber = Number(source.vote_number)
  if (
    Number(source.congress) !== reference.congress ||
    Number(source.session) !== reference.session ||
    voteNumber !== reference.voteNumber
  ) {
    throw new Error(
      `Senate vote identity mismatch for Congress ${reference.congress}, session ${reference.session}, vote ${reference.voteNumber}`
    )
  }

  const canonicalVoteId = legislativeVoteId(
    "congress",
    `senate-${reference.congress}-${reference.session}-${reference.voteNumber}`
  )
  const members = new Map<string, { member: z.infer<typeof memberSchema>; sourceSequence: number }>()
  source.members.member.forEach((member, sourceSequence) => {
    const existing = members.get(member.lis_member_id)
    if (existing === undefined) {
      members.set(member.lis_member_id, { member, sourceSequence })
      return
    }
    if (
      existing.member.vote_cast !== member.vote_cast ||
      existing.member.first_name !== member.first_name ||
      existing.member.last_name !== member.last_name ||
      existing.member.member_full !== member.member_full
    ) {
      throw new Error(`Conflicting Senate vote positions for ${member.lis_member_id}`)
    }
  })
  const positions = [...members.values()].map(({ member, sourceSequence }) => {
    const bioguideId = memberIdentifiers.get(member.lis_member_id)
    return {
      option: normalizeOption(member.vote_cast),
      personId: bioguideId === undefined ? undefined : personId("congress", bioguideId),
      sourceIdentity: member.lis_member_id,
      sourceName: member.member_full ?? [member.first_name, member.last_name].filter(Boolean).join(" "),
      sourcePersonId: member.lis_member_id,
      sourceSequence,
      voteId: canonicalVoteId
    }
  })
  const target = voteTarget(source, reference.congress)

  return {
    positions,
    vote: {
      ...target,
      absentCount: countOption(positions, "absent"),
      abstainCount: countOption(positions, "abstain"),
      chamber: "upper",
      classification: "roll-call",
      heldDate: senateVoteDate(source.vote_date),
      id: canonicalVoteId,
      motion: source.vote_question_text,
      noCount: countOption(positions, "no"),
      notVotingCount: countOption(positions, "not-voting"),
      organizationId: organizationId("congress", "senate"),
      otherCount: countOption(positions, "other"),
      pairedCount: countOption(positions, "paired"),
      presentCount: countOption(positions, "present"),
      proxyCount: countOption(positions, "proxy"),
      question: source.vote_document_text ?? source.vote_question_text,
      requirement: source.majority_requirement,
      result: canonicalResult(source.vote_result ?? source.vote_result_text),
      rollCallNumber: String(reference.voteNumber),
      sessionId: legislativeSessionId("us", String(reference.congress)),
      sourceId: `senate-${reference.congress}-${reference.session}-${reference.voteNumber}`,
      sourceIsOfficial: true,
      sourceProvider: "senate",
      sourceRetrievedAt: retrievedAt,
      sourceSequence: reference.voteNumber,
      sourceUrl: reference.sourceUrl,
      timelineComplete: true,
      voteType: source.question,
      yesCount: countOption(positions, "yes")
    }
  }
}

function voteTarget(source: z.infer<typeof voteSchema>["roll_call_vote"], congress: number) {
  const amendments = source.amendment ?? []
  const amendment = amendments.map((item) => parseIdentifier(item.amendment_number)).find((item) => item !== undefined)
  const document = [
    ...amendments.map((item) => parseIdentifier(item.amendment_to_document_number)),
    ...(source.document ?? []).map((item) =>
      parseIdentifier([item.document_type, item.document_number].filter(Boolean).join(" "))
    )
  ].find((item) => item !== undefined)
  return {
    ...(amendment?.type === "samdt"
      ? { amendmentId: federalAmendmentId(congress, amendment.type, amendment.number) }
      : {}),
    ...(document === undefined || document.type === "samdt"
      ? {}
      : { billId: federalBillId(congress, document.type, document.number) })
  }
}

function parseIdentifier(value: string | undefined): { number: string; type: string } | undefined {
  const match = /^([A-Za-z.]+)\s*(\d+)$/u.exec(value?.trim() ?? "")
  if (match?.[1] === undefined || match[2] === undefined) {
    return undefined
  }
  return { number: match[2], type: match[1].toLowerCase().replaceAll(/[^a-z]/g, "") }
}

function senateVoteDate(value: string): string {
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),/u.exec(value)
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`Invalid Senate vote date: ${value}`)
  }
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]} 00:00:00 UTC`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid Senate vote date: ${value}`)
  }
  return parsed.toISOString().slice(0, 10)
}

function normalizeOption(value: string): VotePositionInsert["option"] {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[_\s]+/g, "-")
  if (["aye", "guilty", "yea", "yes"].includes(normalized)) return "yes"
  if (["nay", "no", "not-guilty"].includes(normalized)) return "no"
  if (normalized === "present,-giving-live-pair") return "paired"
  if (["not-voting", "absent"].includes(normalized)) return normalized
  if (["abstain", "present", "proxy", "paired"].includes(normalized)) return normalized
  return "other"
}

function countOption(positions: readonly VotePositionInsert[], option: VotePositionInsert["option"]): number {
  return positions.filter((position) => position.option === option).length
}

function canonicalResult(value: string | undefined): "failed" | "other" | "passed" {
  const normalized = value?.trim().toLowerCase() ?? ""
  // Negation must win because results such as "Not Sustained" also contain affirmative substrings.
  if (
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    /\bnot\s+(agreed|sustained|confirmed|passed|guilty|well taken)\b/u.test(normalized)
  ) {
    return "failed"
  }
  if (
    normalized.includes("agree") ||
    normalized.includes("confirm") ||
    normalized.includes("overridden") ||
    normalized.includes("pass") ||
    normalized.includes("sustain")
  ) {
    return "passed"
  }
  return "other"
}
