import { digest } from "@repo/legislation-core/legal-text/contracts"
import { projectFederalRegisterAgencyReferences } from "@repo/legislation-core/legal-text/federal-register-agencies"
import { frMetadataRecordSchema, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"

export const frSourceReferenceContract = "fr-source-references-2026-09-14"
const sourceId = "federal-register"

export function projectFrAgencyReferences(documentNumberInput: string, input: unknown) {
  return projectFederalRegisterAgencyReferences(normalizeFrDocumentNumber(documentNumberInput), input)
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
