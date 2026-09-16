import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { jurisdictions } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { eq } from "drizzle-orm"
import {
  listJurisdictionOrganizations as listJurisdictionOrganizationsQuery,
  listJurisdictionOrganizationsByClassification as listJurisdictionOrganizationsByClassificationQuery,
  type OrganizationListInput,
  type OrganizationPage,
  type OrganizationRow
} from "../../legislation/persistence/queries/organization-relationships.js"

export type JurisdictionOrganizationCollection = "organizations" | "commissions" | "committees"

export type JurisdictionOrganizationListInput =
  | ({
      collection: "organizations"
      classification?: string
      parentOrganizationId?: string
    } & JurisdictionOrganizationCommonInput)
  | ({ collection: "commissions" } & JurisdictionOrganizationCommonInput)
  | ({
      chamber?: string
      collection: "committees"
      parentOrganizationId?: string
    } & JurisdictionOrganizationCommonInput)

type JurisdictionOrganizationCommonInput = {
  cursor?: string
  isActive?: boolean
  jurisdictionId: string
  limit?: number
  query?: string
}

export type JurisdictionOrganizationPage = OrganizationPage<OrganizationRow>

export interface JurisdictionOrganizationReadRepository {
  assertJurisdictionExists(jurisdictionId: string): Promise<void>
  listOrganizations(input: JurisdictionOrganizationListInput): Promise<JurisdictionOrganizationPage>
}

type JurisdictionOrganizationStore = {
  jurisdictionExists(jurisdictionId: string): Promise<boolean>
  listJurisdictionOrganizations(
    jurisdictionId: string,
    input: Omit<OrganizationListInput, "jurisdictionId">
  ): Promise<JurisdictionOrganizationPage>
  listJurisdictionOrganizationsByClassification(
    jurisdictionId: string,
    classification: "commission" | "committee",
    input: Omit<OrganizationListInput, "classification" | "jurisdictionId">
  ): Promise<JurisdictionOrganizationPage>
}

export class JurisdictionOrganizationRepository implements JurisdictionOrganizationReadRepository {
  readonly #store: JurisdictionOrganizationStore

  constructor(store: JurisdictionOrganizationStore) {
    this.#store = store
  }

  async assertJurisdictionExists(jurisdictionId: string): Promise<void> {
    const id = requiredInputText(jurisdictionId, "jurisdictionId")
    if (!(await this.#store.jurisdictionExists(id))) {
      throw new LegislationError("not_found", `Jurisdiction ${id} was not found`)
    }
  }

  async listOrganizations(input: JurisdictionOrganizationListInput): Promise<JurisdictionOrganizationPage> {
    const jurisdictionId = requiredInputText(input.jurisdictionId, "jurisdictionId")
    switch (input.collection) {
      case "organizations":
        return await this.#store.listJurisdictionOrganizations(jurisdictionId, {
          classification: input.classification,
          cursor: input.cursor,
          isActive: input.isActive,
          limit: input.limit,
          parentOrganizationId: input.parentOrganizationId,
          query: input.query
        })
      case "commissions":
        return await this.#store.listJurisdictionOrganizationsByClassification(jurisdictionId, "commission", {
          cursor: input.cursor,
          isActive: input.isActive,
          limit: input.limit,
          query: input.query
        })
      case "committees":
        return await this.#store.listJurisdictionOrganizationsByClassification(jurisdictionId, "committee", {
          chamber: input.chamber,
          cursor: input.cursor,
          isActive: input.isActive,
          limit: input.limit,
          parentOrganizationId: input.parentOrganizationId,
          query: input.query
        })
    }
  }
}

export function buildJurisdictionExistenceQuery(database: LegislationDatabase, jurisdictionId: string) {
  return database
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, requiredInputText(jurisdictionId, "jurisdictionId")))
    .limit(1)
}

export function createJurisdictionOrganizationRepository(
  database: LegislationDatabase
): JurisdictionOrganizationReadRepository {
  return new JurisdictionOrganizationRepository({
    jurisdictionExists: async (jurisdictionId) => {
      const rows = await buildJurisdictionExistenceQuery(database, jurisdictionId)
      return rows[0] !== undefined
    },
    listJurisdictionOrganizations: async (jurisdictionId, input) =>
      await listJurisdictionOrganizationsQuery(database, jurisdictionId, input),
    listJurisdictionOrganizationsByClassification: async (jurisdictionId, classification, input) =>
      await listJurisdictionOrganizationsByClassificationQuery(database, jurisdictionId, classification, input)
  })
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}
