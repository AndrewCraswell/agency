import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import type { OrganizationMembershipRead } from "../db/queries/civic-scoped-reads.js"
import {
  listOrganizationMemberships,
  type OrganizationMembershipListInput,
  type OrganizationPage
} from "../db/queries/organization-relationships.js"
import { organizations } from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"

export type OrganizationMembersListInput = OrganizationMembershipListInput
export type OrganizationMembersPage = OrganizationPage<OrganizationMembershipRead>

export interface OrganizationMembersReadRepository {
  listOrganizationMembers(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
}

type OrganizationMembersStore = {
  organizationExists(organizationId: string): Promise<boolean>
  listOrganizationMemberships(input: OrganizationMembersListInput): Promise<OrganizationMembersPage>
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
    return await this.#store.listOrganizationMemberships(input)
  }
}

export function createOrganizationMembersRepository(database: LegislationDatabase): OrganizationMembersReadRepository {
  return new OrganizationMembersRepository({
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
