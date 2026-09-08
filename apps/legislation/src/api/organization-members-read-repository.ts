import { and, eq, like } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import type { OrganizationMembershipRead } from "../db/queries/civic-scoped-reads.js"
import {
  listOrganizationMemberships,
  type OrganizationMembershipListInput,
  type OrganizationPage
} from "../db/queries/organization-relationships.js"
import { organizations, syncCheckpoints } from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"
import { committeeCoverageWarnings } from "./committee-coverage-warnings.js"

export type OrganizationMembersListInput = OrganizationMembershipListInput
export type OrganizationMembersPage = OrganizationPage<OrganizationMembershipRead> & { warnings?: readonly string[] }

export interface OrganizationMembersReadRepository {
  listOrganizationMembers(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
}

type OrganizationMembersStore = {
  organizationExists(organizationId: string): Promise<boolean>
  listOrganizationMemberships(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
  coverageWarnings(organizationId: string): Promise<string[]>
}

/**
 * Parent-bound organization membership reads. The parent check intentionally
 * occurs before an empty membership page is returned, so a missing
 * organization is never indistinguishable from an organization with no
 * matching historical members.
 */
export class OrganizationMembersRepository implements OrganizationMembersReadRepository {
  readonly #store: OrganizationMembersStore

  constructor(store: OrganizationMembersStore) {
    this.#store = store
  }

  async listOrganizationMembers(input: OrganizationMembersListInput): Promise<OrganizationMembersPage> {
    if (!(await this.#store.organizationExists(input.organizationId))) {
      throw new LegislationError("not_found", `Organization ${input.organizationId} was not found`)
    }
    const page = await this.#store.listOrganizationMemberships(input)
    if (input.isCurrent === true) {
      return page
    }
    const warnings = await this.#store.coverageWarnings(input.organizationId)
    return warnings.length === 0 ? page : { ...page, warnings: [...(page.warnings ?? []), ...warnings] }
  }
}

export function createOrganizationMembersRepository(database: LegislationDatabase): OrganizationMembersReadRepository {
  return new OrganizationMembersRepository({
    coverageWarnings: async (organizationId) => {
      const rows = await database
        .select({ chamber: organizations.chamber, name: organizations.name })
        .from(organizations)
        .where(and(eq(organizations.id, organizationId), eq(organizations.sourceProvider, "govinfo")))
        .limit(1)
      const organization = rows[0]
      if (organization === undefined) {
        return []
      }
      const checkpoints = await database
        .select({ stream: syncCheckpoints.stream, cursor: syncCheckpoints.cursor })
        .from(syncCheckpoints)
        .where(
          and(eq(syncCheckpoints.source, "govinfo"), like(syncCheckpoints.stream, "govinfo:committee-directory:%"))
        )
      return committeeCoverageWarnings(checkpoints, organization)
    },
    listOrganizationMemberships: async (input) => await listOrganizationMemberships(database, input),
    organizationExists: async (organizationId) => {
      const rows = await database
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
      return rows[0] !== undefined
    }
  })
}
