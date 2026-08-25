import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import type { OrganizationMembershipRead } from "../db/queries/civic-scoped-reads.js"
import {
  listPersonMemberships,
  type PersonMembershipListInput,
  type PersonMembershipPage
} from "../db/queries/person-membership-reads.js"
import { people } from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"

export type PersonMembershipsListInput = PersonMembershipListInput
export type PersonMembershipsPage = Omit<PersonMembershipPage, "items"> & { items: OrganizationMembershipRead[] }

export interface PersonMembershipsReadRepository {
  listPersonMemberships(input: PersonMembershipsListInput): Promise<PersonMembershipsPage>
}

type PersonMembershipsStore = {
  listPersonMemberships(input: PersonMembershipsListInput): Promise<PersonMembershipsPage>
  personExists(personId: string): Promise<boolean>
}

/**
 * Parent-bound person membership reads. The parent check intentionally occurs
 * before an empty membership page is returned, so a missing person is never
 * indistinguishable from a person with no matching historical memberships.
 */
export class PersonMembershipsRepository implements PersonMembershipsReadRepository {
  readonly #store: PersonMembershipsStore

  constructor(store: PersonMembershipsStore) {
    this.#store = store
  }

  async listPersonMemberships(input: PersonMembershipsListInput): Promise<PersonMembershipsPage> {
    if (!(await this.#store.personExists(input.personId))) {
      throw new LegislationError("not_found", `Person ${input.personId} was not found`)
    }
    return await this.#store.listPersonMemberships(input)
  }
}

export function createPersonMembershipsRepository(database: LegislationDatabase): PersonMembershipsReadRepository {
  return new PersonMembershipsRepository({
    listPersonMemberships: async (input) => await listPersonMemberships(database, input),
    personExists: async (personId) => {
      const rows = await database.select({ id: people.id }).from(people).where(eq(people.id, personId)).limit(1)
      return rows[0] !== undefined
    }
  })
}
