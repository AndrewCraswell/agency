import { digest } from "@repo/legislation-core/legal-text/contracts"
import { legalAgencyReferenceSchema } from "@repo/legislation-core/legal-text/reader-contract"
import { frAgencyEvidenceSchema, frMetadataRecordSchema, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"

export const frSourceReferenceContract = "fr-source-references-2026-09-14"
const sourceId = "federal-register"

export function projectFrAgencyReferences(documentNumberInput: string, input: unknown) {
  const documentNumber = normalizeFrDocumentNumber(documentNumberInput)
  return frAgencyEvidenceSchema
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
                sourceId,
                name
              }),
        reason: name.length === 0 ? ("missing_source_agency_name" as const) : null
      }
    })
}

/** Publisher identities only. No name matching, canonical organization assignment or proceeding merge. */
export function projectFrSourceReferences(input: unknown) {
  const record = frMetadataRecordSchema.parse(input)
  const documentNumber = normalizeFrDocumentNumber(record.document_number)
  const agencies = projectFrAgencyReferences(documentNumber, record.agencies)
  const identifiers = (kind: "rin" | "docket", values: string[]) =>
    values.map((rawValue, ordinal) => {
      const value = rawValue.trim()
      // Docket strings can collide across agencies. Unreviewed dockets stay document-scoped.
      const identityScope = kind === "docket" ? documentNumber : sourceId
      return {
        kind,
        ordinal,
        rawValue,
        value,
        sourceReferenceId: value.length === 0 ? null : digest(JSON.stringify([sourceId, kind, identityScope, value])),
        identityScope: kind === "docket" ? ("document" as const) : ("publisher" as const),
        actionId: null,
        reason: value.length === 0 ? ("empty_source_identifier" as const) : null
      }
    })
  const result = {
    contract: frSourceReferenceContract,
    sourceId,
    documentNumber,
    evidenceUrl: record.json_url,
    agencies,
    rins: identifiers("rin", record.regulation_id_numbers),
    dockets: identifiers("docket", record.docket_ids),
    canonicalOrganizationsAssigned: false,
    canonicalActionsAssigned: false
  }
  return { ...result, hash: digest(JSON.stringify(result)) }
}
