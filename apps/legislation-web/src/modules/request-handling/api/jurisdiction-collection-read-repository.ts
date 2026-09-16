import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  listJurisdictions,
  type JurisdictionCollectionRead,
  type JurisdictionListInput,
  type JurisdictionPage
} from "../../legislation/persistence/queries/jurisdictions-read"

export type JurisdictionCollectionPage = JurisdictionPage<JurisdictionCollectionRead>

export interface JurisdictionCollectionReadRepository {
  listJurisdictions(input: JurisdictionListInput): Promise<JurisdictionCollectionPage>
}

type JurisdictionCollectionReadStore = {
  listJurisdictions(input: JurisdictionListInput): Promise<JurisdictionCollectionPage>
}

export class JurisdictionCollectionRepository implements JurisdictionCollectionReadRepository {
  readonly #store: JurisdictionCollectionReadStore

  constructor(store: JurisdictionCollectionReadStore) {
    this.#store = store
  }

  async listJurisdictions(input: JurisdictionListInput): Promise<JurisdictionCollectionPage> {
    return await this.#store.listJurisdictions(input)
  }
}

export function createJurisdictionCollectionReadRepository(
  database: LegislationDatabase
): JurisdictionCollectionReadRepository {
  return new JurisdictionCollectionRepository({
    listJurisdictions: async (input) => await listJurisdictions(database, input)
  })
}
