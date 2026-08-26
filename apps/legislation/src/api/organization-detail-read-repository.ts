import type { LegislationDatabase } from "../db/database.js"
import type { OrganizationMembershipRead } from "../db/queries/civic-scoped-reads.js"
import { getOrganizationDetailRead, type OrganizationDetailRead } from "../db/queries/organization-detail-read.js"
import { listOrganizationMemberships, type OrganizationPage } from "../db/queries/organization-relationships.js"
import { LegislationError } from "../legislation/errors.js"
import {
  projectOrganizationDetail,
  type OrganizationDetail,
  type OrganizationSummary,
  type ProjectionContext
} from "./canonical-projection.js"
import { projectOrganizationMembershipRead } from "./membership-read-projection.js"
import { projectOrganizationRow } from "./organization-summary-read-projection.js"

export interface OrganizationDetailReadInput {
  childLimit: number
  organizationId: string
}

export interface OrganizationDetailReadRepository {
  getOrganizationDetail(input: OrganizationDetailReadInput): Promise<OrganizationDetail>
}

export function createOrganizationDetailReadRepository(
  database: LegislationDatabase,
  apiBaseUrl: string
): OrganizationDetailReadRepository {
  return {
    getOrganizationDetail: async (input) => {
      const [detail, memberships] = await Promise.all([
        getOrganizationDetailRead(database, input.organizationId),
        listOrganizationMemberships(database, {
          limit: input.childLimit,
          organizationId: input.organizationId
        })
      ])
      return projectOrganizationDetailRead(detail, memberships, apiBaseUrl, input.childLimit)
    }
  }
}

export function projectOrganizationDetailRead(
  detail: OrganizationDetailRead,
  memberships: OrganizationPage<OrganizationMembershipRead>,
  apiBaseUrl: string,
  childLimit: number
): OrganizationDetail {
  const organization = projectOrganizationRow(detail.organization, apiBaseUrl)
  const source = sourceContext(detail.organization, apiBaseUrl)
  return projectOrganizationDetail(
    {
      childPageInfo: {
        memberships: {
          limit: childLimit,
          nextCursor: memberships.nextCursor ?? null,
          truncated: memberships.truncated
        }
      },
      children: detail.children.map((child) => projectOrganizationRow(child, apiBaseUrl)),
      contact: publicContact(detail.organization),
      description: detail.organization.description,
      memberships: memberships.items.map((membership) => projectOrganizationMembershipRead(membership, apiBaseUrl)),
      organization: organizationInput(organization, source.sourceUrl),
      termsOfReference: detail.organization.termsOfReference,
      websiteUrl: detail.organization.websiteUrl
    },
    source.context
  )
}

function organizationInput(organization: OrganizationSummary, sourceUrl: string) {
  return {
    chamber: organization.chamber,
    classification: organization.classification,
    id: organization.id,
    isActive: organization.isActive,
    jurisdictionId: organization.jurisdictionId,
    name: organization.name,
    parentOrganizationId: organization.parentOrganizationId,
    sourceUrl
  }
}

function publicContact(row: OrganizationDetailRead["organization"]): OrganizationDetail["contact"] {
  if (!row.sourceIsOfficial) {
    return null
  }
  const values = [row.publicContactAddress, row.publicContactPhone, row.publicContactEmail]
  if (values.every((value) => value === null)) {
    return null
  }
  if (values.some((value) => typeof value === "string" && value.trim().length === 0)) {
    throw new LegislationError("unprocessable", `Organization ${row.id} has an invalid public contact`)
  }
  return { address: row.publicContactAddress, email: row.publicContactEmail, phone: row.publicContactPhone }
}

function sourceContext(row: OrganizationDetailRead["organization"], apiBaseUrl: string) {
  if (
    !row.provenanceComplete ||
    row.sourceIsOfficial === null ||
    row.sourceProvider === null ||
    row.sourceProvider.trim().length === 0 ||
    row.sourceRetrievedAt === null ||
    row.sourceUrl === null ||
    row.sourceUrl.trim().length === 0
  ) {
    throw new LegislationError("unprocessable", `Organization ${row.id} canonical provenance is incomplete`)
  }
  return {
    context: {
      apiBaseUrl,
      sources: [
        {
          isOfficial: row.sourceIsOfficial,
          provider: row.sourceProvider,
          retrievedAt: row.sourceRetrievedAt,
          sourceUpdatedAt: row.sourceUpdatedAt,
          sourceUrl: row.sourceUrl
        }
      ],
      updatedAt: row.updatedAt
    } satisfies ProjectionContext,
    sourceUrl: row.sourceUrl
  }
}
