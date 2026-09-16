import { z } from "zod"

export const canonicalChamberSchema = z.enum(["lower", "upper", "unicameral", "legislature"])
export const canonicalOrganizationClassificationSchema = z.enum([
  "legislature",
  "chamber",
  "committee",
  "subcommittee",
  "commission",
  "agency",
  "other"
])

const identifierSchema = z.string().trim().min(1).max(200)
const canonicalOrganizationIdSchema = identifierSchema.regex(/^organization:/, "organization ID must be canonical")
const sourceSchema = z
  .object({
    isOfficial: z.boolean(),
    provider: z.string().trim().min(1).max(120),
    retrievedAt: z.iso.datetime({ offset: true }),
    sourceUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    url: z.url({ protocol: /^https$/ })
  })
  .strict()

const personRecordSchema = z
  .object({
    id: identifierSchema,
    isActive: z.boolean(),
    jurisdictionId: identifierSchema,
    kind: z.literal("person"),
    name: z.string().trim().min(1).max(1000),
    source: sourceSchema
  })
  .strict()

const organizationRecordSchema = z
  .object({
    chamber: canonicalChamberSchema.nullable(),
    classification: canonicalOrganizationClassificationSchema.nullable(),
    id: identifierSchema,
    isActive: z.boolean(),
    jurisdictionId: identifierSchema,
    kind: z.literal("organization"),
    name: z.string().trim().min(1).max(1000),
    parentOrganizationId: canonicalOrganizationIdSchema.nullable(),
    source: sourceSchema
  })
  .strict()

const termRecordSchema = z
  .object({
    chamber: canonicalChamberSchema,
    id: identifierSchema,
    isActive: z.boolean(),
    jurisdictionId: identifierSchema,
    kind: z.literal("term"),
    officeTitle: z.string().trim().min(1).max(1000),
    organizationId: canonicalOrganizationIdSchema.nullable(),
    personId: identifierSchema,
    source: sourceSchema
  })
  .strict()

const membershipRecordSchema = z
  .object({
    id: identifierSchema,
    isActive: z.boolean(),
    kind: z.literal("membership"),
    label: z.string().trim().min(1).max(1000).nullable(),
    organizationId: canonicalOrganizationIdSchema,
    personId: identifierSchema,
    role: z.string().trim().min(1).max(240),
    source: sourceSchema
  })
  .strict()

export const canonicalCivicFoundationRecordSchema = z.discriminatedUnion("kind", [
  personRecordSchema,
  organizationRecordSchema,
  termRecordSchema,
  membershipRecordSchema
])

export type CanonicalCivicFoundationRecord = z.output<typeof canonicalCivicFoundationRecordSchema>

type ProvenanceRow = Readonly<{
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUrl: string | null
}>

function hasCompleteProvenance(row: ProvenanceRow): boolean {
  return (
    row.provenanceComplete &&
    row.sourceIsOfficial !== null &&
    row.sourceProvider !== null &&
    row.sourceProvider.trim().length > 0 &&
    row.sourceRetrievedAt !== null &&
    row.sourceUrl !== null &&
    row.sourceUrl.startsWith("https://")
  )
}

export type CanonicalCivicFoundationAudit = Readonly<{
  complete: boolean
  incompleteMembershipIds: readonly string[]
  incompleteOrganizationIds: readonly string[]
  incompletePersonIds: readonly string[]
  incompleteTermIds: readonly string[]
}>

export function isPersonCivicFoundationComplete(
  row: ProvenanceRow & Readonly<{ isActive: boolean | null; jurisdictionId: string | null; name: string }>
): boolean {
  return (
    hasCompleteProvenance(row) && row.isActive !== null && row.jurisdictionId !== null && row.name.trim().length > 0
  )
}

export function isOrganizationCivicFoundationComplete(
  row: ProvenanceRow &
    Readonly<{
      classification: string | null
      chamber: string | null
      isActive: boolean | null
      name: string
      parentOrganizationId: string | null
      upstreamIds: Record<string, string>
    }>
): boolean {
  const unresolvedOpenStatesParent =
    typeof row.upstreamIds.openstatesParent === "string" &&
    row.upstreamIds.openstatesParent.trim().length > 0 &&
    row.parentOrganizationId === null
  return (
    hasCompleteProvenance(row) &&
    row.isActive !== null &&
    canonicalOrganizationClassificationSchema.safeParse(row.classification).success &&
    (row.chamber === null || canonicalChamberSchema.safeParse(row.chamber).success) &&
    row.name.trim().length > 0 &&
    !unresolvedOpenStatesParent
  )
}

export function isTermCivicFoundationComplete(
  row: ProvenanceRow &
    Readonly<{
      chamber: string | null
      isActive: boolean | null
      jurisdictionId: string
      officeTitle: string | null
      personId: string
    }>
): boolean {
  return (
    hasCompleteProvenance(row) &&
    row.isActive !== null &&
    row.officeTitle !== null &&
    row.officeTitle.trim().length > 0 &&
    row.personId.length > 0 &&
    row.jurisdictionId.length > 0 &&
    canonicalChamberSchema.safeParse(row.chamber).success
  )
}

export function isMembershipCivicFoundationComplete(
  row: ProvenanceRow &
    Readonly<{ isActive: boolean | null; organizationId: string; personId: string; role: string | null }>
): boolean {
  return (
    hasCompleteProvenance(row) &&
    row.isActive !== null &&
    row.organizationId.length > 0 &&
    row.personId.length > 0 &&
    row.role !== null &&
    row.role.trim().length > 0
  )
}
