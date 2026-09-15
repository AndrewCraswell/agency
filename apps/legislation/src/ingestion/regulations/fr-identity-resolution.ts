import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { normalizeFrDocumentNumber } from "./fr-metadata-contract.js"

const kind = z.enum(["Rule", "Proposed Rule", "Notice"])
const identityEvidence = z
  .strictObject({
    documentNumber: z.string().min(1),
    date: z.iso.date(),
    volume: z.int().positive(),
    startPage: z.int().positive(),
    endPage: z.int().positive(),
    kind,
    title: z.string().min(1)
  })
  .refine((row) => row.endPage >= row.startPage, "invalid_page_interval")
const textEvidence = z.strictObject({
  evidence: identityEvidence,
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceLocator: z.string().startsWith("/")
})

/** Resolution plan only: a duplicated publisher number is an alias, never permission to merge documents. */
export function planFrIdentityResolution(input: { texts: unknown[]; metadata: unknown[] }) {
  const texts = z.array(textEvidence).min(1).max(10000).parse(input.texts)
  const metadata = z.array(identityEvidence).max(10000).parse(input.metadata)
  const alias = (row: z.infer<typeof identityEvidence>) =>
    `${row.date}:${normalizeFrDocumentNumber(row.documentNumber)}`
  const citation = (row: z.infer<typeof identityEvidence>) => `${row.date}:${row.volume}:${row.startPage}:${row.kind}`
  const locators = texts.map((row) => `${row.artifactHash}:${row.sourceLocator}`)
  invariant(new Set(locators).size === texts.length, "duplicate_fr_source_observation")
  const groups = new Map<string, number[]>()
  texts.forEach((row, index) => groups.set(alias(row.evidence), [...(groups.get(alias(row.evidence)) ?? []), index]))
  const resolutions = texts.map((row) => {
    const sameCitation = texts.filter((other) => citation(other.evidence) === citation(row.evidence))
    const candidates = metadata.filter(
      (other) =>
        alias(other) === alias(row.evidence) &&
        citation(other) === citation(row.evidence) &&
        other.endPage === row.evidence.endPage &&
        other.title.trim().replaceAll(/\s+/g, " ").toLowerCase() ===
          row.evidence.title.trim().replaceAll(/\s+/g, " ").toLowerCase()
    )
    const isNumberAmbiguous = (groups.get(alias(row.evidence))?.length ?? 0) > 1
    let status = "matched"
    if (sameCitation.length > 1) {
      status = "ambiguous_citation"
    } else if (candidates.length > 1) {
      status = "ambiguous_metadata"
    } else if (candidates.length === 0) {
      status = "unmatched_metadata"
    }
    return {
      ...row,
      sourceObservationKey: digest(JSON.stringify([row.artifactHash, row.sourceLocator])),
      citationKey: sameCitation.length === 1 ? citation(row.evidence) : null,
      publisherNumber: normalizeFrDocumentNumber(row.evidence.documentNumber),
      isNumberAmbiguous,
      status,
      metadataMatch: status === "matched" ? candidates[0] : null,
      publicationReady: false
    }
  })
  return {
    resolutions,
    ambiguousAliases: [...groups.entries()]
      .filter(([, indices]) => indices.length > 1)
      .map(([key, indices]) => ({
        alias: key,
        sourceObservationKeys: indices.map((index) => resolutions[index]?.sourceObservationKey)
      })),
    matched: resolutions.filter((row) => row.status === "matched").length,
    unresolved: resolutions.filter((row) => row.status !== "matched").length,
    canonicalWrites: false,
    publicationReady: false
  }
}
