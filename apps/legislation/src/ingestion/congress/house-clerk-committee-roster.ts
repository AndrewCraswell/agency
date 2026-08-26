import { XMLParser, XMLValidator } from "fast-xml-parser"
import { z } from "zod"
import type { organizationMemberships } from "../../db/schema/schema.js"
import { organizationId, organizationMembershipId, personId } from "../../legislation/identifiers.js"
import { RetryingHttpClient } from "../http-client.js"

export const houseClerkMemberDataUrl = new URL("https://clerk.house.gov/xml/lists/MemberData.xml")
export const houseClerkMemberDataMaximumBytes = 5 * 1024 * 1024

const codeSchema = z.string().regex(/^[A-Z]{2}00$/, "House committee code must use two uppercase letters and 00.")
const subcommitteeCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}\d{2}$/, "House subcommittee code must use two uppercase letters and two digits.")
  .refine((value) => !value.endsWith("00"), "House subcommittee code must not end in 00.")
const positiveRankSchema = z.string().regex(/^[1-9]\d*$/, "House committee rank must be a positive integer.")
const nonEmptyStringSchema = z.string().trim().min(1)
const optionalLeadershipSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  nonEmptyStringSchema.optional()
)
const optionalBioguideIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z
    .string()
    .trim()
    .regex(/^[A-Z]\d{6}$/, "Bioguide ID must be one uppercase letter followed by six digits")
    .optional()
)
const committeeSchema = z
  .object({ comcode: codeSchema, leadership: optionalLeadershipSchema, rank: positiveRankSchema.optional() })
  .strict()
const subcommitteeSchema = z
  .object({
    leadership: optionalLeadershipSchema,
    rank: positiveRankSchema.optional(),
    subcomcode: subcommitteeCodeSchema
  })
  .strict()
const memberInfoSchema = z.object({ bioguideID: optionalBioguideIdSchema }).passthrough()
const memberSchema = z
  .object({ "committee-assignments": z.unknown().optional(), "member-info": memberInfoSchema })
  .passthrough()

type MembershipInsert = typeof organizationMemberships.$inferInsert

export interface HouseClerkCommitteeRosterContext {
  /** Successful observation time of the fixed official Clerk MemberData URL. */
  retrievedAt: Date
  /** Canonical committee and subcommittee IDs already established from an authoritative committee catalog. */
  knownOrganizationIds: ReadonlySet<string>
}

export interface HouseClerkCommitteeRosterSnapshot {
  completeOrganizationIds: string[]
  memberships: MembershipInsert[]
  publishDate: string
}

export type HouseClerkAssignment =
  | Readonly<{ code: string; kind: "committee"; leadership?: string; rank?: string }>
  | Readonly<{ code: string; kind: "subcommittee"; leadership?: string; rank?: string }>

export interface HouseClerkCurrentCommitteeRoster {
  completeOrganizationIds: readonly string[]
  members: readonly Readonly<{ assignments: readonly HouseClerkAssignment[]; bioguideId: string }>[]
  publishDate: string
}

/**
 * Parses the House Clerk's current MemberData roster. It intentionally retains
 * only membership facts: the feed does not define committee names, histories,
 * or membership dates.
 */
export function parseHouseClerkCurrentCommitteeRoster(xml: string): HouseClerkCurrentCommitteeRoster {
  const validation = XMLValidator.validate(xml)
  if (validation !== true) {
    throw new Error(`House Clerk MemberData XML is malformed: ${validation.err.msg}`)
  }
  const parsed = new XMLParser({
    attributeNamePrefix: "",
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    processEntities: false,
    trimValues: true
  }).parse(xml)
  const document = objectAt(parsed, "MemberData", "House Clerk MemberData root")
  const publishDate = nonEmptyStringSchema.parse(document["publish-date"])
  const completeOrganizationIds = parseCommitteeTree(document.committees)
  const members = object(document.members, "House Clerk MemberData members")
  const rawMembers = arrayValue(members.member)
  if (rawMembers.length === 0) {
    throw new Error("House Clerk MemberData must contain at least one member.")
  }
  return {
    completeOrganizationIds,
    members: rawMembers.flatMap((value) => {
      const member = memberSchema.parse(value)
      const assignments = parseAssignments(member["committee-assignments"])
      const bioguideId = member["member-info"].bioguideID
      if (bioguideId === undefined) {
        // The live roster includes vacant districts with a predecessor block and
        // an empty committee placeholder. They name no current member, so no
        // canonical person or membership can be emitted.
        if (assignments.length === 0 && isRecord(member["predecessor-info"])) {
          return []
        }
        throw new Error("House Clerk MemberData member is missing a Bioguide ID.")
      }
      return {
        assignments,
        bioguideId
      }
    }),
    publishDate
  }
}

/**
 * Normalizes one current roster into membership rows only. A caller must supply
 * canonical organizations from a separate authoritative committee catalog so an
 * unfamiliar code cannot create an organization by implication.
 */
export function normalizeHouseClerkCurrentCommitteeRoster(
  roster: HouseClerkCurrentCommitteeRoster,
  context: HouseClerkCommitteeRosterContext
): HouseClerkCommitteeRosterSnapshot {
  if (Number.isNaN(context.retrievedAt.getTime())) {
    throw new Error("House Clerk roster retrievedAt must be a valid date.")
  }
  for (const canonicalOrganizationId of roster.completeOrganizationIds) {
    if (!context.knownOrganizationIds.has(canonicalOrganizationId)) {
      throw new Error(`House Clerk committee tree references an unknown organization: ${canonicalOrganizationId}`)
    }
  }
  const completeOrganizationIds = new Set(roster.completeOrganizationIds)
  const memberships = new Map<string, MembershipInsert>()
  for (const member of roster.members) {
    const canonicalPersonId = personId("congress", member.bioguideId)
    for (const assignment of member.assignments) {
      const canonicalOrganizationId = houseClerkOrganizationId(assignment.code, assignment.kind)
      if (!context.knownOrganizationIds.has(canonicalOrganizationId)) {
        throw new Error(`House Clerk roster assignment references an unknown ${assignment.kind}: ${assignment.code}`)
      }
      if (!completeOrganizationIds.has(canonicalOrganizationId)) {
        throw new Error(
          `House Clerk roster assignment is not declared in the committee tree: ${assignment.kind}:${assignment.code}`
        )
      }
      const sourceId = `house-clerk:${member.bioguideId}:${assignment.kind}:${assignment.code}`
      const membership: MembershipInsert = {
        classification: assignment.kind,
        id: organizationMembershipId(canonicalOrganizationId, canonicalPersonId, sourceId),
        isActive: true,
        label: assignment.leadership ?? null,
        organizationId: canonicalOrganizationId,
        personId: canonicalPersonId,
        provenanceComplete: true,
        rank: assignment.rank ?? null,
        role: assignment.leadership ?? "member",
        sourceId,
        sourceIsOfficial: true,
        sourceProvider: "house-clerk",
        sourceRetrievedAt: context.retrievedAt,
        sourceUrl: houseClerkMemberDataUrl.toString(),
        title: assignment.leadership ?? null
      }
      const existing = memberships.get(membership.id)
      if (existing !== undefined && !sameMembership(existing, membership)) {
        throw new Error(`House Clerk roster repeats a conflicting assignment: ${sourceId}`)
      }
      memberships.set(membership.id, membership)
    }
  }
  return {
    completeOrganizationIds: [...roster.completeOrganizationIds],
    memberships: [...memberships.values()],
    publishDate: roster.publishDate
  }
}

/** Fetches the fixed official roster through the shared retrying, bounded HTTP client. */
export async function fetchHouseClerkCurrentCommitteeRoster(
  http: Pick<RetryingHttpClient, "getBytes">,
  context: HouseClerkCommitteeRosterContext
): Promise<HouseClerkCommitteeRosterSnapshot> {
  const bytes = await http.getBytes(houseClerkMemberDataUrl, houseClerkMemberDataMaximumBytes, {
    headers: { accept: "application/xml" }
  })
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  return normalizeHouseClerkCurrentCommitteeRoster(parseHouseClerkCurrentCommitteeRoster(xml), context)
}

function parseAssignments(input: unknown): readonly HouseClerkAssignment[] {
  if (input === undefined || (typeof input === "string" && input.trim().length === 0)) {
    return []
  }
  const assignments = object(input, "House Clerk committee assignments")
  assertOnlyKeys(assignments, ["committee", "subcommittee"], "House Clerk committee assignments")
  return [
    ...arrayValue(assignments.committee).flatMap((value) => {
      if (isEmptyAssignmentPlaceholder(value, "comcode")) {
        return []
      }
      const assignment = committeeSchema.parse(value)
      return {
        code: assignment.comcode,
        kind: "committee" as const,
        leadership: assignment.leadership,
        rank: assignment.rank
      }
    }),
    ...arrayValue(assignments.subcommittee).flatMap((value) => {
      if (isEmptyAssignmentPlaceholder(value, "subcomcode")) {
        return []
      }
      const assignment = subcommitteeSchema.parse(value)
      return {
        code: assignment.subcomcode,
        kind: "subcommittee" as const,
        leadership: assignment.leadership,
        rank: assignment.rank
      }
    })
  ]
}

function parseCommitteeTree(input: unknown): string[] {
  const tree = object(input, "House Clerk MemberData committees")
  assertOnlyKeys(tree, ["committee"], "House Clerk MemberData committees")
  const seen = new Set<string>()
  const organizationIds: string[] = []
  for (const value of arrayValue(tree.committee)) {
    const committee = object(value, "House Clerk committee tree entry")
    const committeeCode = codeSchema.parse(committee.comcode)
    addDeclaredCode(seen, organizationIds, committeeCode, "committee")
    for (const subcommitteeValue of arrayValue(committee.subcommittee)) {
      const subcommittee = object(subcommitteeValue, "House Clerk subcommittee tree entry")
      const subcommitteeCode = subcommitteeCodeSchema.parse(subcommittee.subcomcode)
      if (!subcommitteeCode.startsWith(committeeCode.slice(0, 2))) {
        throw new Error(
          `House Clerk subcommittee ${subcommitteeCode} is not declared under its committee ${committeeCode}.`
        )
      }
      addDeclaredCode(seen, organizationIds, subcommitteeCode, "subcommittee")
    }
  }
  if (organizationIds.length === 0) {
    throw new Error("House Clerk MemberData committee tree must contain at least one committee.")
  }
  return organizationIds
}

function addDeclaredCode(
  seen: Set<string>,
  organizationIds: string[],
  code: string,
  kind: HouseClerkAssignment["kind"]
): void {
  const key = `${kind}:${code}`
  if (seen.has(key)) {
    throw new Error(`House Clerk committee tree repeats a ${kind} code: ${code}`)
  }
  seen.add(key)
  organizationIds.push(houseClerkOrganizationId(code, kind))
}

/** Maps the Clerk's four-character House code onto Congress.gov's H-prefixed system code. */
export function houseClerkOrganizationId(code: string, kind: HouseClerkAssignment["kind"]): string {
  const validated = kind === "committee" ? codeSchema.parse(code) : subcommitteeCodeSchema.parse(code)
  return organizationId("congress", `HS${validated}`)
}

function arrayValue(value: unknown): unknown[] {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function assertOnlyKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[], label: string): void {
  const allowedKeys = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !allowedKeys.has(key))
  if (unknown !== undefined) {
    throw new Error(`${label} contains an unsupported assignment element: ${unknown}`)
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isEmptyAssignmentPlaceholder(value: unknown, codeKey: "comcode" | "subcomcode"): boolean {
  if (!isRecord(value) || value[codeKey] !== undefined) {
    return false
  }
  return Object.entries(value).every(
    ([key, entry]) => (key === "rank" || key === "leadership") && typeof entry === "string" && entry.trim().length === 0
  )
}

function objectAt(value: unknown, key: string, label: string): Record<string, unknown> {
  const record = object(value, label)
  return object(record[key], label)
}

function sameMembership(left: MembershipInsert, right: MembershipInsert): boolean {
  return (
    left.classification === right.classification &&
    left.label === right.label &&
    left.rank === right.rank &&
    left.role === right.role &&
    left.sourceId === right.sourceId
  )
}
