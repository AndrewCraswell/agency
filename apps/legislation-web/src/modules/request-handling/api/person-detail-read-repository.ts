import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { getPersonDetailRead, type PersonDetailRead } from "../../legislation/persistence/queries/person-detail-read.js"

export interface PersonDetailReadRepository {
  getPersonDetail(personId: string): Promise<PersonDetailRead>
}

/** Production boundary for the canonical, complete person detail query. */
export function createPersonDetailReadRepository(database: LegislationDatabase): PersonDetailReadRepository {
  return { getPersonDetail: async (personId) => await getPersonDetailRead(database, personId) }
}
