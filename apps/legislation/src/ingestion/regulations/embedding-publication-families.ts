import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { frMetadataRecordSchema, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { correctionTarget } from "./fr-reconciliation.js"
import { projectFrSourceReferences } from "./fr-source-references.js"

/** Conservative evaluation coassignment hints, never canonical proceeding identities. */
export function groupRegulatoryEvaluationPublications(value: unknown) {
  const input = z
    .array(
      z.strictObject({
        documentId: z.string().min(1),
        versionId: z.string().min(1),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        metadata: z.unknown()
      })
    )
    .min(1)
    .max(512)
    .parse(value)
  invariant(new Set(input.map((row) => row.versionId)).size === input.length, "regulatory_family_duplicate_version")
  const rows = input
    .map((row) => {
      const metadata = frMetadataRecordSchema.safeParse(row.metadata)
      if (!metadata.success) {
        const identity = z
          .object({ document_number: z.string().min(1), metadata_basis: z.string().optional() })
          .parse(row.metadata)
        const documentNumber = normalizeFrDocumentNumber(identity.document_number)
        return {
          versionId: row.versionId,
          documentId: row.documentId,
          documentNumber,
          keys: [
            `canonical-document:${row.documentId}`,
            `document:${documentNumber}`,
            `content:${row.contentHash}`
          ].sort(),
          related: [],
          warnings:
            identity.metadata_basis === "reviewed_fields"
              ? ["incomplete_publisher_metadata", "source_review_restricts_metadata"]
              : ["incomplete_publisher_metadata"]
        }
      }
      const source = projectFrSourceReferences(metadata.data)
      const keys = new Set([
        `canonical-document:${row.documentId}`,
        `document:${source.documentNumber}`,
        `content:${row.contentHash}`
      ])
      const warnings = new Set<string>()
      let strongIdentifiers = 0
      for (const rin of source.rins) {
        if (rin.value) {
          keys.add(`rin:${rin.value}`)
          strongIdentifiers++
        }
      }
      const agencies = source.agencies
        .filter((a) => a.identityBasis === "publisher_id")
        .map((a) => a.reference?.nativeId)
        .filter((id) => id !== null && id !== undefined)
      for (const docket of source.dockets) {
        if (!docket.value) {
          continue
        }
        if (agencies.length === 0) {
          warnings.add("docket_without_publisher_agency")
          continue
        }
        for (const agency of agencies) {
          keys.add(`docket:${JSON.stringify([agency, docket.value])}`)
        }
        strongIdentifiers++
      }
      const related: string[] = []
      for (const link of [metadata.data.correction_of, ...metadata.data.corrections]) {
        if (link === null) {
          continue
        }
        try {
          const target = correctionTarget(link)
          related.push(target)
          keys.add(`document:${target}`)
        } catch {
          warnings.add("unsupported_document_relationship")
        }
      }
      if (strongIdentifiers === 0 && related.length === 0) {
        warnings.add("no_rulemaking_family_identifier")
      }
      return {
        versionId: row.versionId,
        documentId: row.documentId,
        documentNumber: source.documentNumber,
        keys: [...keys].sort(),
        related,
        warnings: [...warnings].sort()
      }
    })
    .sort((a, b) => a.versionId.localeCompare(b.versionId))
  const groups: { members: typeof rows; keys: Set<string> }[] = []
  for (const row of rows) {
    const connected = groups.filter((group) => row.keys.some((key) => group.keys.has(key)))
    const members = [row, ...connected.flatMap((group) => group.members)]
    const keys = new Set(members.flatMap((member) => member.keys))
    for (const group of connected) {
      groups.splice(groups.indexOf(group), 1)
    }
    groups.push({ members, keys })
  }
  const knownDocuments = new Set(rows.map((row) => row.documentNumber))
  const families = groups
    .map(({ members, keys }) => {
      const identifiers = [...keys].sort()
      const warnings = new Set(members.flatMap((row) => row.warnings))
      const numberIdentities = new Map<string, Set<string>>()
      for (const member of members) {
        const identities = numberIdentities.get(member.documentNumber) ?? new Set<string>()
        identities.add(member.documentId)
        numberIdentities.set(member.documentNumber, identities)
      }
      if ([...numberIdentities.values()].some((identities) => identities.size > 1)) {
        warnings.add("printed_document_number_collision")
      }
      if (members.some((row) => row.related.some((target) => !knownDocuments.has(target)))) {
        warnings.add("related_document_outside_inventory")
      }
      return {
        familyId: digest(JSON.stringify(identifiers)),
        members: members
          .map(({ documentId, versionId, documentNumber }) => ({ documentId, versionId, documentNumber }))
          .sort((a, b) => a.versionId.localeCompare(b.versionId)),
        identifiers,
        warnings: [...warnings].sort()
      }
    })
    .sort((a, b) => a.familyId.localeCompare(b.familyId))
  return {
    inputHash: digest(JSON.stringify(input)),
    families,
    familyAssignmentReviewed: false,
    canonicalActionsAssigned: false,
    splitAssigned: false,
    modelSelected: false
  }
}
