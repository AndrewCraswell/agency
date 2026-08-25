import { LegislationError } from "../legislation/errors.js"
import type {
  AmendmentDetail,
  BillDetail,
  DocumentDetail,
  Jurisdiction,
  MeetingDetail,
  OrganizationDetail,
  PersonDetail,
  Session,
  SupportingMaterialDetail,
  VoteDetail
} from "./canonical-projection.js"
import { projectCoreSupportingMaterialDetailRead, type CoreReadQueryApi } from "./core-read.js"
import { projectDocumentDetailRead, type DocumentReadApi } from "./document-read-routes.js"

export const RESOURCE_TYPES = [
  "jurisdiction",
  "session",
  "bill",
  "amendment",
  "vote",
  "document",
  "supporting-material",
  "person",
  "organization",
  "meeting",
  "calendar"
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

/**
 * The API contract includes calendar in the request union, but there is no
 * canonical calendar projector in the current read layer. Keep that gap
 * explicit rather than allowing a raw or fabricated resource through.
 */
export type CanonicalResource =
  | Jurisdiction
  | Session
  | BillDetail
  | AmendmentDetail
  | VoteDetail
  | DocumentDetail
  | SupportingMaterialDetail
  | PersonDetail
  | OrganizationDetail
  | MeetingDetail

export type ResourceBatchRequestItem = Readonly<{
  type: ResourceType
  id: string
}>

export type ResourceResolver = (id: string) => Promise<CanonicalResource>

export type ResourceBatchResolvers = Partial<Record<ResourceType, ResourceResolver>>

export type CanonicalResourceBatchReadDependencies = Readonly<{
  apiBaseUrl: string
  coreReadApi?: Pick<CoreReadQueryApi, "getSupportingMaterial">
  documentReadApi?: Pick<DocumentReadApi, "getDocumentDetail">
}>

export interface ResourceBatchReadRepository {
  getResource: (input: ResourceBatchRequestItem) => Promise<CanonicalResource>
}

export class CanonicalResourceBatchRepository implements ResourceBatchReadRepository {
  readonly #resolvers: ResourceBatchResolvers

  constructor(resolvers: ResourceBatchResolvers) {
    this.#resolvers = resolvers
  }

  async getResource(input: ResourceBatchRequestItem): Promise<CanonicalResource> {
    const resolver = this.#resolvers[input.type]
    if (resolver === undefined) {
      throw new LegislationError(
        "dependency_unavailable",
        `Canonical ${input.type} reads are not available through the batch endpoint`
      )
    }
    return await resolver(input.id)
  }
}

export function createResourceBatchReadRepository(resolvers: ResourceBatchResolvers): ResourceBatchReadRepository {
  return new CanonicalResourceBatchRepository(resolvers)
}

/**
 * Composes only detail reads that already have a canonical query boundary and
 * projector. Other resource kinds remain absent from the resolver map and
 * therefore fail closed as per-item dependency errors.
 */
export function createCanonicalResourceBatchResolvers(
  dependencies: CanonicalResourceBatchReadDependencies
): ResourceBatchResolvers {
  const resolvers: ResourceBatchResolvers = {}
  const { apiBaseUrl, coreReadApi, documentReadApi } = dependencies

  if (coreReadApi !== undefined) {
    resolvers["supporting-material"] = async (id) => {
      const result = await coreReadApi.getSupportingMaterial({ id })
      return projectCoreSupportingMaterialDetailRead(result.material, apiBaseUrl)
    }
  }
  if (documentReadApi !== undefined) {
    resolvers.document = async (id) =>
      projectDocumentDetailRead(await documentReadApi.getDocumentDetail(id), apiBaseUrl)
  }
  return resolvers
}

export function createResourceBatchReadRepositoryFromCanonicalReads(
  dependencies: CanonicalResourceBatchReadDependencies
): ResourceBatchReadRepository {
  return createResourceBatchReadRepository(createCanonicalResourceBatchResolvers(dependencies))
}
