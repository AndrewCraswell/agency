import { replaceAuthoritativeOrganizationMembershipRoster } from "../../db/queries/entities.js"
import { jurisdictionId } from "../../legislation/identifiers.js"
import type { RetryingHttpClient } from "../http-client.js"
import {
  fetchHouseClerkCurrentCommitteeRoster,
  type HouseClerkCommitteeRosterContext,
  type HouseClerkCommitteeRosterSnapshot
} from "./house-clerk-committee-roster.js"
import {
  normalizeSenateCommitteeRosters,
  SenateCommitteeRosterClient,
  type SenateCommitteeRosterSnapshot
} from "./senate-rosters.js"

const senateParentCode = /^[A-Z]{4}00$/

export interface CurrentCongressCommitteeRosterOrganization {
  chamber?: string | null
  classification?: string | null
  id: string
  sourceId: string
}

export interface CurrentCongressCommitteeRosterReaders {
  fetchHouseRoster(context: HouseClerkCommitteeRosterContext): Promise<HouseClerkCommitteeRosterSnapshot>
  senate: Pick<SenateCommitteeRosterClient, "committee" | "current">
}

export interface CurrentCongressCommitteeRosterResult {
  house: HouseClerkCommitteeRosterSnapshot
  senate: SenateCommitteeRosterSnapshot
}

export interface SynchronizeCurrentCongressCommitteeRostersInput {
  database: Parameters<typeof replaceAuthoritativeOrganizationMembershipRoster>[0]
  organizations: readonly CurrentCongressCommitteeRosterOrganization[]
  readers: CurrentCongressCommitteeRosterReaders
  replaceRoster?: typeof replaceAuthoritativeOrganizationMembershipRoster
  retrievedAt: Date
}

/** Creates bounded official roster readers that share the caller's configured HTTP client. */
export function createCurrentCongressCommitteeRosterReaders(
  http: Pick<RetryingHttpClient, "getBytes">
): CurrentCongressCommitteeRosterReaders {
  return {
    fetchHouseRoster: async (context) => await fetchHouseClerkCurrentCommitteeRoster(http, context),
    senate: new SenateCommitteeRosterClient({ http })
  }
}

/**
 * Reconciles only current House and Senate committee rosters after the Congress
 * member and committee catalog has been persisted. Each chamber writes through
 * its own authoritative roster transaction, so a Senate failure cannot make a
 * House roster partial (or vice versa).
 */
export async function synchronizeCurrentCongressCommitteeRosters(
  input: SynchronizeCurrentCongressCommitteeRostersInput
): Promise<CurrentCongressCommitteeRosterResult> {
  const replaceRoster = input.replaceRoster ?? replaceAuthoritativeOrganizationMembershipRoster
  const knownOrganizations = new Map(input.organizations.map((organization) => [organization.id, organization]))
  const knownOrganizationIds = new Set(knownOrganizations.keys())

  const house = await input.readers.fetchHouseRoster({ knownOrganizationIds, retrievedAt: input.retrievedAt })
  assertKnownOrganizations(house, knownOrganizationIds, "House Clerk")
  if (house.completeOrganizationIds.length > 0) {
    await replaceRoster(input.database, {
      jurisdictionId: jurisdictionId("us"),
      memberships: house.memberships,
      organizationIds: house.completeOrganizationIds
    })
  }

  const senateCurrentRoster = await input.readers.senate.current()
  const senateCurrent = normalizeSenateCommitteeRosters(senateCurrentRoster, [], { retrievedAt: input.retrievedAt })
  assertKnownOrganizations(senateCurrent, knownOrganizationIds, "Senate current roster")
  const parentCodes = senateParentCodes(senateCurrent.completeOrganizationIds, knownOrganizations)
  const senateCommitteeRosters = []
  for (const parentCode of parentCodes) {
    senateCommitteeRosters.push({ parentCode, xml: await input.readers.senate.committee(parentCode) })
  }
  const senate = normalizeSenateCommitteeRosters(senateCurrentRoster, senateCommitteeRosters, {
    retrievedAt: input.retrievedAt
  })
  assertKnownOrganizations(senate, knownOrganizationIds, "Senate committee roster")
  if (senate.completeOrganizationIds.length > 0) {
    await replaceRoster(input.database, {
      jurisdictionId: jurisdictionId("us"),
      memberships: senate.memberships,
      organizationIds: senate.completeOrganizationIds
    })
  }

  return { house, senate }
}

function assertKnownOrganizations(
  snapshot: Pick<
    HouseClerkCommitteeRosterSnapshot | SenateCommitteeRosterSnapshot,
    "completeOrganizationIds" | "memberships"
  >,
  knownOrganizationIds: ReadonlySet<string>,
  source: string
): void {
  const unknownOrganizationId = [
    ...snapshot.completeOrganizationIds,
    ...snapshot.memberships.map((membership) => membership.organizationId)
  ].find((organizationId) => !knownOrganizationIds.has(organizationId))
  if (unknownOrganizationId !== undefined) {
    throw new Error(
      `${source} references an organization missing from the current Congress committee catalog: ${unknownOrganizationId}`
    )
  }
}

function senateParentCodes(
  organizationIds: readonly string[],
  knownOrganizations: ReadonlyMap<string, CurrentCongressCommitteeRosterOrganization>
): string[] {
  const codes = new Set<string>()
  for (const organizationId of organizationIds) {
    const organization = knownOrganizations.get(organizationId)
    if (
      organization === undefined ||
      organization.chamber !== "upper" ||
      organization.classification !== "committee" ||
      !senateParentCode.test(organization.sourceId) ||
      organization.sourceId.startsWith("J")
    ) {
      throw new Error(
        `Senate current roster parent is not an exact known non-joint Senate committee: ${organizationId}`
      )
    }
    codes.add(organization.sourceId)
  }
  return [...codes].sort()
}
