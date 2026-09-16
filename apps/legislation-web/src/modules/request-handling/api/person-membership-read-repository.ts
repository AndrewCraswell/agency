import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { people, syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, eq, like } from "drizzle-orm"
import type { OrganizationMembershipRead } from "../../legislation/persistence/queries/civic-scoped-reads.js"
import {
  listPersonMemberships,
  type PersonMembershipListInput,
  type PersonMembershipPage
} from "../../legislation/persistence/queries/person-membership-reads.js"
import { personCommitteeCoverageWarnings } from "./committee-coverage-warnings.js"

export type PersonMembershipsListInput = PersonMembershipListInput
export type PersonMembershipsPage = Omit<PersonMembershipPage, "items"> & {
  items: OrganizationMembershipRead[]
  warnings?: readonly string[]
}

export interface PersonMembershipsReadRepository {
  listPersonMemberships(input: PersonMembershipsListInput): Promise<PersonMembershipsPage>
}

type PersonMembershipsStore = {
  listPersonMemberships(input: PersonMembershipsListInput): Promise<PersonMembershipsPage>
  personExists(personId: string): Promise<boolean>
  coverageWarnings(personId: string): Promise<string[]>
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
    const page = await this.#store.listPersonMemberships(input)
    if (input.isCurrent === true) {
      return page
    }
    const warnings = await this.#store.coverageWarnings(input.personId)
    return warnings.length === 0 ? page : { ...page, warnings: [...(page.warnings ?? []), ...warnings] }
  }
}

export function createPersonMembershipsRepository(database: LegislationDatabase): PersonMembershipsReadRepository {
  return new PersonMembershipsRepository({
    coverageWarnings: async (personId) => {
      if (!personId.startsWith("person:congress:")) {
        return []
      }
      const checkpoints = await database
        .select({ stream: syncCheckpoints.stream, cursor: syncCheckpoints.cursor })
        .from(syncCheckpoints)
        .where(
          and(eq(syncCheckpoints.source, "govinfo"), like(syncCheckpoints.stream, "govinfo:committee-directory:%"))
        )
      return personCommitteeCoverageWarnings(checkpoints, personId)
    },
    listPersonMemberships: async (input) => await listPersonMemberships(database, input),
    personExists: async (personId) => {
      const rows = await database.select({ id: people.id }).from(people).where(eq(people.id, personId)).limit(1)
      return rows[0] !== undefined
    }
  })
}
