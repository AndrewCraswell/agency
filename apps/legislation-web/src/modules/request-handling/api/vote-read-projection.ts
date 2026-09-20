import { LegislationError } from "@repo/legislation-core/domain/errors"
import { voteOccurrence } from "../../legislation/persistence/queries/vote-occurrence"
import type {
  Page,
  PersonVotePositionRead,
  VoteOption,
  VotePositionRead,
  VoteRead,
  VoteResult
} from "../../legislation/persistence/queries/vote-reads"
import {
  projectBillSummary,
  projectPersonSummary,
  projectVoteDetail,
  projectVoteSummary,
  type BillSummary,
  type PersonSummary,
  type ProjectionContext,
  type VoteDetail,
  type VotePosition,
  type VoteSummary
} from "./canonical-projection"
import { sourceProjectionContext } from "./canonical-read"

export function projectVoteDetailRead(vote: VoteRead, page: Page<VotePositionRead>, apiBaseUrl: string): VoteDetail {
  return projectVoteDetail(
    {
      positions: page.items.map((item) => projectVotePosition(item, apiBaseUrl)),
      positionsPageInfo: { limit: 25, nextCursor: page.nextCursor ?? null, truncated: page.truncated },
      vote: voteInput(vote)
    },
    context(vote, apiBaseUrl)
  )
}

export function projectPersonVoteActivity(value: PersonVotePositionRead, apiBaseUrl: string) {
  return {
    bill: value.bill === null ? null : projectBill(value.bill, apiBaseUrl),
    position: projectVotePosition(value, apiBaseUrl),
    vote: projectVote(value.vote, apiBaseUrl)
  }
}

export function projectVote(vote: VoteRead, apiBaseUrl: string): VoteSummary {
  return projectVoteSummary(voteInput(vote), context(vote, apiBaseUrl))
}

function voteInput(vote: VoteRead) {
  const { date, heldAt } = voteOccurrence(vote)
  return {
    billId: vote.billId,
    classification: vote.classification,
    counts: {
      absent: count(vote.absentCount, "absent"),
      abstain: count(vote.abstainCount, "abstain"),
      no: count(vote.noCount, "no"),
      notVoting: count(vote.notVotingCount, "notVoting"),
      other: count(vote.otherCount, "other"),
      paired: count(vote.pairedCount, "paired"),
      present: count(vote.presentCount, "present"),
      proxy: count(vote.proxyCount, "proxy"),
      yes: count(vote.yesCount, "yes")
    },
    date,
    heldAt,
    id: vote.id,
    motion: vote.motion,
    organizationId: vote.organizationId,
    question: vote.question,
    result: storedVoteResult(vote.result),
    sourceUrl: requiredText(vote.sourceUrl, "Vote source URL")
  }
}

export function projectVotePosition(value: VotePositionRead, apiBaseUrl: string): VotePosition {
  const p = value.position
  return {
    canonicalUrl: new URL(
      `/api/votes/${encodeURIComponent(value.vote.id)}#${encodeURIComponent(p.sourceIdentity)}`,
      apiBaseUrl
    ).toString(),
    id: p.sourceIdentity,
    option: parseVoteOption(p.option) ?? fail("Vote position option is invalid"),
    person: value.person === null ? null : projectPerson(value.person, apiBaseUrl),
    sourceName: requiredText(p.sourceName, "Vote position source name"),
    sourcePersonId: p.sourcePersonId,
    sources: projectVote(value.vote, apiBaseUrl).sources,
    type: "vote-position",
    updatedAt: p.createdAt.toISOString(),
    voteId: value.vote.id
  }
}

function projectPerson(person: NonNullable<VotePositionRead["person"]>, apiBaseUrl: string): PersonSummary {
  if (!person.provenanceComplete || person.jurisdictionId === null || person.isActive === null) {
    fail("Vote position person canonical provenance is incomplete")
  }
  return projectPersonSummary(
    {
      familyName: person.familyName,
      givenName: person.givenName,
      id: person.id,
      imageUrl: null,
      isActive: person.isActive,
      jurisdictionIds: [person.jurisdictionId],
      name: person.name,
      party: person.party,
      sourceUrl: requiredText(person.sourceUrl, "Person source URL")
    },
    context(person, apiBaseUrl)
  )
}

function projectBill(bill: NonNullable<PersonVotePositionRead["bill"]>, apiBaseUrl: string): BillSummary {
  return projectBillSummary(
    {
      classification: bill.classification,
      id: bill.id,
      identifier: bill.identifier,
      introducedDate: bill.introducedAt,
      jurisdictionId: bill.jurisdictionId,
      latestActionAt: null,
      sessionId: bill.sessionId,
      sourceUrl: requiredText(bill.sourceUrl, "Bill source URL"),
      status: bill.status,
      subjects: bill.subjects,
      title: bill.title
    },
    sourceProjectionContext(bill, apiBaseUrl)
  )
}

function context(
  record: Readonly<{
    createdAt: Date
    sourceIsOfficial: boolean | null
    sourceProvider: string | null
    sourceRetrievedAt: Date | null
    sourceUpdatedAt: Date | null
    sourceUrl: string | null
  }>,
  apiBaseUrl: string
): ProjectionContext {
  return {
    apiBaseUrl,
    sources: [
      {
        isOfficial: requiredBoolean(record.sourceIsOfficial, "Source official status"),
        provider: requiredText(record.sourceProvider, "Source provider"),
        retrievedAt: requiredDate(record.sourceRetrievedAt, "Source retrieval time"),
        sourceUpdatedAt: record.sourceUpdatedAt,
        sourceUrl: requiredText(record.sourceUrl, "Source URL")
      }
    ],
    updatedAt: record.createdAt
  }
}

export function parseVoteOption(value: string | undefined): VoteOption | undefined {
  switch (value) {
    case "yes":
    case "no":
    case "absent":
    case "abstain":
    case "not-voting":
    case "present":
    case "proxy":
    case "paired":
    case "other":
      return value
    default:
      return undefined
  }
}

function storedVoteResult(value: string | null): VoteResult {
  if (value === "passed" || value === "failed" || value === "other") {
    return value
  }
  return fail("Vote result is incomplete")
}

function requiredText(value: string | null, name: string): string {
  if (value === null || !value.trim()) {
    fail(`${name} is incomplete`)
  }
  return value
}

function requiredDate(value: Date | null, name: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    fail(`${name} is incomplete`)
  }
  return value
}

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    fail(`${name} is incomplete`)
  }
  return value
}

function count(value: number | null, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(`Vote ${name} count is incomplete`)
  }
  return value
}

function fail(message: string): never {
  throw new LegislationError("unprocessable", message)
}
