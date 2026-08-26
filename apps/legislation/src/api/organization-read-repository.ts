import type { LegislationDatabase } from "../db/database.js"
import {
  listOrganizations,
  type OrganizationListInput,
  type OrganizationPage,
  type OrganizationRow
} from "../db/queries/organization-relationships.js"

export type OrganizationCollectionPage = OrganizationPage<OrganizationRow>

export interface OrganizationReadRepository {
  listOrganizations(input: OrganizationListInput): Promise<OrganizationCollectionPage>
}

type OrganizationReadStore = {
  listOrganizations(input: OrganizationListInput): Promise<OrganizationCollectionPage>
}

export class OrganizationRepository implements OrganizationReadRepository {
  readonly #store: OrganizationReadStore

  constructor(store: OrganizationReadStore) {
    this.#store = store
  }

  async listOrganizations(input: OrganizationListInput): Promise<OrganizationCollectionPage> {
    return await this.#store.listOrganizations(input)
  }
}

export function createOrganizationReadRepository(database: LegislationDatabase): OrganizationReadRepository {
  return new OrganizationRepository({ listOrganizations: async (input) => await listOrganizations(database, input) })
}
