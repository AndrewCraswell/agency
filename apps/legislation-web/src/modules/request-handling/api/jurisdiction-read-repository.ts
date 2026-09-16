import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { jurisdictions } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { eq } from "drizzle-orm"

export type JurisdictionRead = typeof jurisdictions.$inferSelect

export interface JurisdictionReadRepository {
  getJurisdiction(jurisdictionId: string): Promise<JurisdictionRead>
}

export interface JurisdictionReadStore {
  findJurisdiction(jurisdictionId: string): Promise<JurisdictionRead | undefined>
}

export class JurisdictionRepository implements JurisdictionReadRepository {
  readonly #store: JurisdictionReadStore

  constructor(store: JurisdictionReadStore) {
    this.#store = store
  }

  async getJurisdiction(jurisdictionId: string): Promise<JurisdictionRead> {
    const id = requiredInputText(jurisdictionId, "jurisdictionId")
    const jurisdiction = await this.#store.findJurisdiction(id)
    if (jurisdiction === undefined) {
      throw new LegislationError("not_found", `Jurisdiction ${id} was not found`)
    }
    return jurisdiction
  }
}

export function buildJurisdictionReadQuery(database: LegislationDatabase, jurisdictionId: string) {
  return database
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.id, requiredInputText(jurisdictionId, "jurisdictionId")))
    .limit(1)
}

export function createJurisdictionReadRepository(database: LegislationDatabase): JurisdictionReadRepository {
  return new JurisdictionRepository({
    findJurisdiction: async (jurisdictionId) => (await buildJurisdictionReadQuery(database, jurisdictionId))[0]
  })
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}
