import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { organizations, syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, eq, like } from "drizzle-orm"
import type { OrganizationMembershipRead } from "../../legislation/persistence/queries/civic-scoped-reads.js"
import {
  listOrganizationMemberships,
  type OrganizationMembershipListInput,
  type OrganizationPage
} from "../../legislation/persistence/queries/organization-relationships.js"
import { committeeCoverageWarnings } from "./committee-coverage-warnings.js"

export type OrganizationMembersListInput = OrganizationMembershipListInput
export type OrganizationMembersPage = OrganizationPage<OrganizationMembershipRead> & { warnings?: readonly string[] }

export interface OrganizationMembersReadRepository {
  listOrganizationMembers(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
}

type OrganizationMembersStore = {
  organizationExists(organizationId: string): Promise<boolean>
  listOrganizationMemberships(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
  coverageWarnings(organizationId: string, isCurrent: boolean): Promise<string[]>
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
    const warnings = await this.#store.coverageWarnings(input.organizationId, input.isCurrent === true)
    return warnings.length === 0 ? page : { ...page, warnings: [...(page.warnings ?? []), ...warnings] }
  }
}

export function createOrganizationMembersRepository(database: LegislationDatabase): OrganizationMembersReadRepository {
  return new OrganizationMembersRepository({
    coverageWarnings: async (organizationId, isCurrent) => {
      const rows = await database
        .select({
          chamber: organizations.chamber,
          name: organizations.name,
          sourceProvider: organizations.sourceProvider,
          membershipRelationsComplete: organizations.membershipRelationsComplete
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
      const organization = rows[0]
      if (organization === undefined) {
        return []
      }
      const warnings =
        organization.membershipRelationsComplete === true
          ? []
          : ["Committee membership coverage is incomplete. These are recorded observations, not a complete roster."]
      if (isCurrent || organization.sourceProvider !== "govinfo") {
        return warnings
      }
      const checkpoints = await database
        .select({ stream: syncCheckpoints.stream, cursor: syncCheckpoints.cursor })
        .from(syncCheckpoints)
        .where(
          and(eq(syncCheckpoints.source, "govinfo"), like(syncCheckpoints.stream, "govinfo:committee-directory:%"))
        )
      return [...warnings, ...committeeCoverageWarnings(checkpoints, organization)]
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
