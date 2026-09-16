import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { organizations } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { eq } from "drizzle-orm"
import type { BillSummaryRead } from "../../../request-handling/api/canonical-read.js"
import {
  listOrganizationBills,
  type OrganizationBillListInput,
  type OrganizationBillRow,
  type OrganizationPage
} from "./organization-relationships.js"

export type OrganizationBillRead = BillSummaryRead
export type OrganizationBillReadPage = OrganizationPage<OrganizationBillRead>

/** Distinguishes an absent organization from a public organization with no matching bills. */
export function buildOrganizationExistenceQuery(database: LegislationDatabase, organizationId: string) {
  return database
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, requiredOrganizationId(organizationId)))
    .limit(1)
}

export async function assertOrganizationExists(database: LegislationDatabase, organizationId: string): Promise<void> {
  if ((await buildOrganizationExistenceQuery(database, organizationId))[0] === undefined) {
    throw new LegislationError("not_found", `Organization ${organizationId} was not found`)
  }
}

/**
 * The relationship query owns persisted organization-link, latest-action, and
 * cursor logic. This boundary retains only canonical BillSummary facts.
 */
export async function listOrganizationBillReads(
  database: LegislationDatabase,
  input: OrganizationBillListInput
): Promise<OrganizationBillReadPage> {
  const page = await listOrganizationBills(database, input)
  return { ...page, items: page.items.map(organizationBillReadFromRow) }
}

export function organizationBillReadFromRow(row: OrganizationBillRow): OrganizationBillRead {
  return { ...row.bill, latestActionAt: row.latestActionAt }
}

function requiredOrganizationId(value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", "organizationId must be between 1 and 256 characters")
  }
  return normalized
}
