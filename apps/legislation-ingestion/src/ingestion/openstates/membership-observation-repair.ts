import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { organizationMemberships, organizations } from "@repo/legislation-core/database/schema/schema"
import { and, eq, isNotNull, isNull, or } from "drizzle-orm"

type Candidate = Readonly<{
  detectedStartDate: string | null
  id: string
  lastObservedDate: string | null
  sourceRetrievedAt: Date
}>

function isoDate(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("Membership observation has an invalid retrieval timestamp")
  return value.toISOString().slice(0, 10)
}

export function completeMembershipObservationDates(candidate: Candidate) {
  const observed = isoDate(candidate.sourceRetrievedAt)
  const detectedStartDate = candidate.detectedStartDate ?? minDate(observed, candidate.lastObservedDate)
  const lastObservedDate = candidate.lastObservedDate ?? maxDate(observed, candidate.detectedStartDate)
  return { detectedStartDate, lastObservedDate }
}

function minDate(left: string, right: string | null): string {
  return right === null || left <= right ? left : right
}

function maxDate(left: string, right: string | null): string {
  return right === null || left >= right ? left : right
}

function candidateQuery(database: LegislationDatabase, jurisdictionId: string) {
  return database
    .select({
      detectedStartDate: organizationMemberships.detectedStartDate,
      id: organizationMemberships.id,
      lastObservedDate: organizationMemberships.lastObservedDate,
      sourceRetrievedAt: organizationMemberships.sourceRetrievedAt
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(
      and(
        eq(organizations.jurisdictionId, jurisdictionId),
        eq(organizationMemberships.sourceProvider, "openstates"),
        eq(organizationMemberships.isActive, true),
        isNotNull(organizationMemberships.sourceRetrievedAt),
        or(isNull(organizationMemberships.detectedStartDate), isNull(organizationMemberships.lastObservedDate))
      )
    )
    .orderBy(organizationMemberships.id)
}

/**
 * Backfill first/last-observed dates from retained provider retrieval evidence.
 * Inspect is the default; apply locks and rechecks every exact active membership.
 */
export async function repairOpenStatesMembershipObservations(
  database: LegislationDatabase,
  input: Readonly<{ apply?: boolean; jurisdictionId: string }>
) {
  if (!input.jurisdictionId.startsWith("jurisdiction:")) throw new Error("Invalid jurisdiction repair scope")
  if (input.apply !== true) {
    const candidates = (await candidateQuery(database, input.jurisdictionId)) as Candidate[]
    return {
      candidates: candidates.map((candidate) => ({ ...candidate, ...completeMembershipObservationDates(candidate) })),
      repaired: 0,
      status: "inspected" as const
    }
  }
  return await database.transaction(async (transaction) => {
    const candidates = (await candidateQuery(transaction, input.jurisdictionId).for("update")) as Candidate[]
    let repaired = 0
    for (const candidate of candidates) {
      const dates = completeMembershipObservationDates(candidate)
      const rows = await transaction
        .update(organizationMemberships)
        .set({ ...dates, updatedAt: new Date() })
        .where(
          and(
            eq(organizationMemberships.id, candidate.id),
            eq(organizationMemberships.sourceProvider, "openstates"),
            eq(organizationMemberships.isActive, true),
            or(isNull(organizationMemberships.detectedStartDate), isNull(organizationMemberships.lastObservedDate))
          )
        )
        .returning({ id: organizationMemberships.id })
      if (rows.length !== 1) throw new Error("Membership observation changed during locked repair")
      repaired += 1
    }
    return { candidates, repaired, status: "repaired" as const }
  })
}
