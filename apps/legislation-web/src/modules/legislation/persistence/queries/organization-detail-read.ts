import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { organizations } from "@repo/legislation-core/database/schema/schema"
import { isOrganizationCivicFoundationComplete } from "@repo/legislation-core/domain/civic-foundation"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { asc, eq } from "drizzle-orm"

const MAX_INGESTED_CHILDREN = 250

export interface OrganizationDetailRead {
  children: readonly OrganizationDetailOrganizationRow[]
  organization: OrganizationDetailOrganizationRow
}

export type OrganizationDetailOrganizationRow = typeof organizations.$inferSelect

/**
 * Reads the source-complete portion of an organization detail. Membership
 * pagination intentionally remains in the established relationship query so
 * its continuation cursor cannot be confused with the bounded detail view.
 */
export async function getOrganizationDetailRead(
  database: LegislationDatabase,
  organizationId: string
): Promise<OrganizationDetailRead> {
  const id = requiredOrganizationId(organizationId)
  const organization = (await buildOrganizationDetailLookupQuery(database, id))[0]
  if (organization === undefined) {
    throw new LegislationError("not_found", `Organization ${id} was not found`)
  }
  assertOrganizationDetailComplete(organization)

  const children = await buildOrganizationChildrenQuery(database, id)
  if (children.length > MAX_INGESTED_CHILDREN) {
    throw new LegislationError("unprocessable", `Organization ${id} exceeds the ${MAX_INGESTED_CHILDREN} child limit`)
  }
  for (const child of children) {
    if (!isOrganizationCivicFoundationComplete(child)) {
      throw new LegislationError("unprocessable", `Organization child ${child.id} is not canonically complete`)
    }
  }
  return { children, organization }
}

export function buildOrganizationDetailLookupQuery(database: LegislationDatabase, organizationId: string) {
  return database
    .select()
    .from(organizations)
    .where(eq(organizations.id, requiredOrganizationId(organizationId)))
    .limit(1)
}

export function buildOrganizationChildrenQuery(database: LegislationDatabase, organizationId: string) {
  return database
    .select()
    .from(organizations)
    .where(eq(organizations.parentOrganizationId, requiredOrganizationId(organizationId)))
    .orderBy(asc(organizations.name), asc(organizations.id))
    .limit(MAX_INGESTED_CHILDREN + 1)
}

export function assertOrganizationDetailComplete(row: OrganizationDetailOrganizationRow): void {
  if (!isOrganizationCivicFoundationComplete(row)) {
    throw new LegislationError("unprocessable", `Organization ${row.id} is not canonically complete`)
  }
  if (!row.detailFactsComplete) {
    throw new LegislationError("unprocessable", `Organization ${row.id} has no source-complete detail profile`)
  }
  if (!row.childRelationsComplete) {
    throw new LegislationError("unprocessable", `Organization ${row.id} has no source-complete child relationships`)
  }
  if (!row.membershipRelationsComplete) {
    throw new LegislationError("unprocessable", `Organization ${row.id} has no source-complete memberships`)
  }
}

function requiredOrganizationId(value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new LegislationError("invalid_request", "organizationId must not be empty")
  }
  return normalized
}
