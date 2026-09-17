import { z } from "zod"
import { digest } from "./contracts.js"
import { legalAgencyReferenceSchema } from "./reader-contract.js"

export const federalRegisterAgencyEvidenceSchema = z.object({
  raw_name: z.string(),
  name: z.string().optional(),
  id: z.int().optional(),
  slug: z.string().optional(),
  parent_id: z.int().nullable().optional()
})

/** Publisher identities only. Missing publisher IDs are scoped to one document occurrence, never merged by name. */
export function projectFederalRegisterAgencyReferences(documentNumberInput: string, input: unknown) {
  const documentNumber = z.string().trim().min(1).max(128).parse(documentNumberInput)
  return federalRegisterAgencyEvidenceSchema
    .array()
    .parse(input)
    .map((evidence, ordinal) => {
      const name = evidence.name?.trim() || evidence.raw_name.trim()
      const nativeId = evidence.id === undefined ? null : String(evidence.id)
      const sourceAgencyId =
        nativeId === null
          ? `fr-agency-unidentified-${digest(JSON.stringify([documentNumber, ordinal]))}`
          : `fr-agency-${nativeId}`
      return {
        ordinal,
        evidence,
        identityBasis: nativeId === null ? ("document_occurrence" as const) : ("publisher_id" as const),
        sourceParentAgencyId:
          evidence.parent_id === undefined || evidence.parent_id === null ? null : `fr-agency-${evidence.parent_id}`,
        reference:
          name.length === 0
            ? null
            : legalAgencyReferenceSchema.parse({
                status: "unresolved",
                organizationId: null,
                sourceAgencyId,
                nativeId,
                sourceId: "federal-register",
                name
              }),
        reason: name.length === 0 ? ("missing_source_agency_name" as const) : null
      }
    })
}
