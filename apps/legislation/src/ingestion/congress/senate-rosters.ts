import { XMLParser, XMLValidator } from "fast-xml-parser"
import { z } from "zod"
import type { organizationMemberships } from "../../db/schema/schema.js"
import { organizationId, organizationMembershipId, personId } from "../../legislation/identifiers.js"
import { RetryingHttpClient } from "../http-client.js"

const MAXIMUM_SENATE_ROSTER_BYTES = 2 * 1024 * 1024

export const senateCurrentCommitteeRosterSourceUrl = "https://www.senate.gov/legislative/LIS_MEMBER/cvc_member_data.xml"

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  isArray: (_name, path) =>
    path === "senators.senator" ||
    path === "senators.senator.committees.committee" ||
    path === "committee_membership.committees.subcommittee" ||
    path === "committee_membership.committees.members.member" ||
    path === "committee_membership.committees.subcommittee.members.member",
  parseTagValue: false,
  processEntities: false,
  removeNSPrefix: true,
  trimValues: true
})

const requiredText = z.string().trim().min(1)
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  requiredText.optional()
)
const committeeCode = requiredText.transform(normalizeCommitteeCode)
const bioguideId = requiredText
  .transform(normalizeBioguideId)
  .refine((value) => /^[A-Z]\d{6}$/.test(value), "Bioguide ID must be one uppercase letter followed by six digits")
const lisMemberId = requiredText
  .transform(normalizeLisMemberId)
  .refine((value) => /^[A-Z]\d{3}$/.test(value), "LIS member ID must be one uppercase letter followed by three digits")
const currentAssignmentSchema = z.object({ code: committeeCode, position: requiredText.optional() }).passthrough()
const currentAssignmentsSchema = z.preprocess(
  (value) => (value === "" ? { committee: [] } : value),
  z.object({ committee: z.array(currentAssignmentSchema).default([]) })
)
const currentSenatorSchema = z
  .object({
    bioguideId,
    committees: currentAssignmentsSchema.default({ committee: [] }),
    lis_member_id: lisMemberId,
    name: z.object({ first: requiredText, last: requiredText, middle: optionalText, suffix: optionalText }),
    party: requiredText,
    state: requiredText
  })
  .passthrough()
const currentRosterSchema = z.object({
  senators: z.preprocess(
    (value) => (value === "" ? { senator: [] } : value),
    z.object({
      senator: z.array(currentSenatorSchema).min(1, "Senate current roster must contain at least one senator")
    })
  )
})

const rosterMemberSchema = z.object({
  name: z.object({ first: requiredText, last: requiredText }),
  party: requiredText,
  position: requiredText,
  state: requiredText
})
const rosterMembersSchema = z.preprocess(
  (value) => (value === "" ? { member: [] } : value),
  z.object({ member: z.array(rosterMemberSchema).default([]) })
)
const subcommitteeSchema = z.object({
  committee_code: committeeCode,
  members: rosterMembersSchema,
  subcommittee_name: requiredText
})
const committeeRosterSchema = z.object({
  committee_membership: z.object({
    committees: z.object({
      committee_code: committeeCode,
      members: rosterMembersSchema,
      subcommittee: z.array(subcommitteeSchema).default([])
    })
  })
})

type MembershipInsert = typeof organizationMemberships.$inferInsert
type CurrentSenator = z.infer<typeof currentSenatorSchema>

export interface SenateCommitteeRosterClientOptions {
  http: Pick<RetryingHttpClient, "getBytes">
  maximumBytes?: number
}

/** Bounded reader for the Senate's official current committee-membership XML feeds. */
export class SenateCommitteeRosterClient {
  readonly #http: SenateCommitteeRosterClientOptions["http"]
  readonly #maximumBytes: number

  constructor(options: SenateCommitteeRosterClientOptions) {
    this.#http = options.http
    this.#maximumBytes = positiveSafeInteger(options.maximumBytes ?? MAXIMUM_SENATE_ROSTER_BYTES, "maximumBytes")
  }

  async current(): Promise<string> {
    return await this.#read(senateCurrentCommitteeRosterSourceUrl)
  }

  async committee(parentCode: string): Promise<string> {
    return await this.#read(senateCommitteeMembershipSourceUrl(parentCode))
  }

  async #read(sourceUrl: string): Promise<string> {
    const bytes = await this.#http.getBytes(new URL(sourceUrl), this.#maximumBytes)
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  }
}

export interface SenateCommitteeRosterNormalizationContext {
  /** The time these official feeds were successfully observed. */
  retrievedAt: Date
}

export interface SenateCommitteeRosterInput {
  parentCode: string
  xml: string
}

export interface SenateCommitteeRosterSnapshot {
  completeOrganizationIds: string[]
  memberships: MembershipInsert[]
}

/**
 * Normalizes the official current-Senators feed and exact parent committee XML
 * feeds. Senate subcommittee feeds do not publish Bioguide or LIS identifiers;
 * a subcommittee relation is therefore accepted only when its source facts
 * identify exactly one current-Senators record that declares the same parent.
 */
export function normalizeSenateCommitteeRosters(
  currentRosterXml: string,
  committeeRosters: readonly SenateCommitteeRosterInput[],
  context: SenateCommitteeRosterNormalizationContext
): SenateCommitteeRosterSnapshot {
  const retrievedAt = validRetrievedAt(context.retrievedAt)
  const senators = currentRosterSchema.parse(parseXml(currentRosterXml, "current roster")).senators.senator
  const senatorByBioguideId = new Map<string, CurrentSenator>()
  const senatorByLisMemberId = new Map<string, CurrentSenator>()
  const senatorByIdentity = new Map<string, CurrentSenator[]>()
  const memberships: MembershipInsert[] = []
  const completeOrganizationIds = new Set<string>()
  const membershipIdentities = new Set<string>()

  for (const senator of senators) {
    const bioguideId = normalizeBioguideId(senator.bioguideId)
    const lisMemberId = normalizeLisMemberId(senator.lis_member_id)
    if (senatorByBioguideId.has(bioguideId) || senatorByLisMemberId.has(lisMemberId)) {
      throw new Error(`Senate current roster has duplicate member identifiers for ${bioguideId}`)
    }
    senatorByBioguideId.set(bioguideId, senator)
    senatorByLisMemberId.set(lisMemberId, senator)
    const identity = rosterIdentity(currentSenatorName(senator), senator.state, senator.party)
    senatorByIdentity.set(identity, [...(senatorByIdentity.get(identity) ?? []), senator])
  }

  for (const senator of senators) {
    const bioguideId = normalizeBioguideId(senator.bioguideId)
    const lisMemberId = normalizeLisMemberId(senator.lis_member_id)
    const parentCodes = new Set<string>()
    for (const assignment of senator.committees.committee) {
      const parentCode = requiredParentCode(assignment.code)
      if (isJointCommitteeCode(parentCode)) {
        continue
      }
      if (parentCodes.has(parentCode)) {
        throw new Error(`Senate current roster has duplicate assignment ${parentCode} for ${bioguideId}`)
      }
      parentCodes.add(parentCode)
      const sourceIdentity = `senate:${parentCode}:${bioguideId}:${lisMemberId}`
      addMembership(memberships, membershipIdentities, {
        id: organizationMembershipId(
          organizationId("congress", parentCode),
          personId("congress", bioguideId),
          sourceIdentity
        ),
        isActive: true,
        label: assignment.position,
        organizationId: organizationId("congress", parentCode),
        personId: personId("congress", bioguideId),
        provenanceComplete: true,
        role: assignment.position ?? "member",
        sourceId: sourceIdentity,
        sourceIsOfficial: true,
        sourceProvider: "senate",
        sourceRetrievedAt: retrievedAt,
        sourceUrl: senateCurrentCommitteeRosterSourceUrl,
        title: assignment.position
      })
      completeOrganizationIds.add(organizationId("congress", parentCode))
    }
  }

  if (completeOrganizationIds.size === 0) {
    throw new Error("Senate current roster must contain at least one non-joint parent committee assignment")
  }

  const rosterParents = new Set<string>()
  for (const roster of committeeRosters) {
    const requestedParentCode = requiredParentCode(roster.parentCode)
    if (isJointCommitteeCode(requestedParentCode)) {
      throw new Error(
        `Senate joint committee roster ${requestedParentCode} cannot establish complete membership relations`
      )
    }
    if (rosterParents.has(requestedParentCode)) {
      throw new Error(`Senate committee roster was supplied more than once for ${requestedParentCode}`)
    }
    rosterParents.add(requestedParentCode)
    const parsed = committeeRosterSchema.parse(
      parseXml(roster.xml, `committee roster ${requestedParentCode}`)
    ).committee_membership
    const feedParentCode = requiredParentCode(parsed.committees.committee_code)
    if (feedParentCode !== requestedParentCode) {
      throw new Error(
        `Senate committee roster parent ${feedParentCode} does not match requested ${requestedParentCode}`
      )
    }
    normalizeSubcommittees(
      parsed.committees.subcommittee,
      feedParentCode,
      senatorByIdentity,
      memberships,
      membershipIdentities,
      retrievedAt,
      completeOrganizationIds
    )
  }

  return { completeOrganizationIds: [...completeOrganizationIds].sort(), memberships }
}

export function senateCommitteeMembershipSourceUrl(parentCode: string): string {
  const normalizedParentCode = requiredParentCode(parentCode)
  if (isJointCommitteeCode(normalizedParentCode)) {
    throw new Error(`Senate joint committee roster ${normalizedParentCode} is not source-complete`)
  }
  return `https://www.senate.gov/general/committee_membership/committee_memberships_${normalizedParentCode.slice(0, 4)}.xml`
}

function normalizeSubcommittees(
  subcommittees: readonly z.infer<typeof subcommitteeSchema>[],
  parentCode: string,
  senatorByIdentity: ReadonlyMap<string, readonly CurrentSenator[]>,
  memberships: MembershipInsert[],
  membershipIdentities: Set<string>,
  retrievedAt: Date,
  completeOrganizationIds: Set<string>
): void {
  const subcommitteeCodes = new Set<string>()
  for (const subcommittee of subcommittees) {
    const subcommitteeCode = requiredSubcommitteeCode(subcommittee.committee_code, parentCode)
    if (subcommitteeCodes.has(subcommitteeCode)) {
      throw new Error(`Senate committee roster has duplicate subcommittee ${subcommitteeCode}`)
    }
    subcommitteeCodes.add(subcommitteeCode)
    const people = new Set<string>()
    for (const member of subcommittee.members.member) {
      const candidates =
        senatorByIdentity.get(rosterIdentity(rosterMemberName(member), member.state, member.party)) ?? []
      const matches = candidates.filter((candidate) =>
        candidate.committees.committee.some((assignment) => requiredParentCode(assignment.code) === parentCode)
      )
      if (matches.length !== 1) {
        throw new Error(
          `Senate subcommittee roster member ${member.name.first} ${member.name.last} has ${matches.length} exact current-Senator matches for ${parentCode}`
        )
      }
      const senator = matches[0]
      if (senator === undefined) {
        throw new Error(`Senate subcommittee roster member is missing after exact match for ${parentCode}`)
      }
      const bioguideId = normalizeBioguideId(senator.bioguideId)
      const lisMemberId = normalizeLisMemberId(senator.lis_member_id)
      if (people.has(bioguideId)) {
        throw new Error(`Senate subcommittee roster has duplicate member ${bioguideId} for ${subcommitteeCode}`)
      }
      people.add(bioguideId)
      const sourceIdentity = `senate:${subcommitteeCode}:${bioguideId}:${lisMemberId}`
      addMembership(memberships, membershipIdentities, {
        id: organizationMembershipId(
          organizationId("congress", subcommitteeCode),
          personId("congress", bioguideId),
          sourceIdentity
        ),
        isActive: true,
        label: member.position,
        organizationId: organizationId("congress", subcommitteeCode),
        personId: personId("congress", bioguideId),
        provenanceComplete: true,
        role: member.position,
        sourceId: sourceIdentity,
        sourceIsOfficial: true,
        sourceProvider: "senate",
        sourceRetrievedAt: retrievedAt,
        sourceUrl: senateCommitteeMembershipSourceUrl(parentCode),
        title: member.position
      })
    }
    completeOrganizationIds.add(organizationId("congress", subcommitteeCode))
  }
}

function addMembership(memberships: MembershipInsert[], identities: Set<string>, membership: MembershipInsert): void {
  const sourceId = membership.sourceId
  if (typeof sourceId !== "string" || sourceId.length === 0 || identities.has(sourceId)) {
    throw new Error(`Senate roster has duplicate membership identity ${sourceId ?? membership.id}`)
  }
  identities.add(sourceId)
  memberships.push(membership)
}

function validRetrievedAt(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new Error("Senate roster normalization requires an explicit retrievedAt timestamp")
  }
  return value
}

function parseXml(xml: string, source: string): unknown {
  const validated = XMLValidator.validate(xml)
  if (validated !== true) {
    throw new Error(`Senate ${source} XML is malformed`)
  }
  return parser.parse(xml)
}

function requiredParentCode(value: string): string {
  const normalized = normalizeCommitteeCode(value)
  if (!/^[A-Z]{4}00$/.test(normalized)) {
    throw new Error(`Senate parent committee code is invalid: ${value}`)
  }
  return normalized
}

function requiredSubcommitteeCode(value: string, parentCode: string): string {
  const normalized = normalizeCommitteeCode(value)
  if (
    !/^[A-Z]{4}\d{2}$/.test(normalized) ||
    normalized.endsWith("00") ||
    !normalized.startsWith(parentCode.slice(0, 4))
  ) {
    throw new Error(`Senate subcommittee code ${value} is not declared by parent ${parentCode}`)
  }
  return normalized
}

function normalizeCommitteeCode(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase()
}

function normalizeBioguideId(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase()
}

function normalizeLisMemberId(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase()
}

function currentSenatorName(senator: CurrentSenator): string {
  return [senator.name.first, senator.name.middle, senator.name.last, senator.name.suffix]
    .filter((value): value is string => value !== undefined)
    .join(" ")
}

function rosterMemberName(member: z.infer<typeof rosterMemberSchema>): string {
  return [member.name.first, member.name.last].join(" ")
}

function rosterIdentity(name: string, state: string, party: string): string {
  return [name, state, party]
    .map((value) => value.normalize("NFKC").trim().replaceAll(/\s+/g, " ").toLocaleUpperCase("en-US"))
    .join("\u0000")
}

function isJointCommitteeCode(value: string): boolean {
  return value.startsWith("J")
}

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer`)
  }
  return value
}
