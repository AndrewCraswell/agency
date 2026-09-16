import type { billRelations } from "@repo/legislation-core/database/schema/schema"

type RelationProvenance = Pick<
  typeof billRelations.$inferInsert,
  | "canonicalFactsComplete"
  | "direction"
  | "provenanceComplete"
  | "sourceIsOfficial"
  | "sourceProvider"
  | "sourceRetrievedAt"
  | "sourceUpdatedAt"
  | "sourceUrl"
>

export function outgoingRelationProvenance(
  input: Readonly<{
    sourceIsOfficial?: boolean
    sourceProvider?: string
    sourceRetrievedAt?: Date
    sourceUpdatedAt?: Date
    sourceUrl?: string
  }>
): RelationProvenance {
  const sourceUrl = input.sourceUrl
  const sourceProvider = input.sourceProvider?.trim()
  const provenanceComplete =
    sourceUrl !== undefined &&
    isHttpsUrl(sourceUrl) &&
    sourceProvider !== undefined &&
    sourceProvider.length > 0 &&
    input.sourceRetrievedAt instanceof Date &&
    !Number.isNaN(input.sourceRetrievedAt.valueOf()) &&
    input.sourceIsOfficial !== undefined
  return {
    canonicalFactsComplete:
      provenanceComplete && input.sourceUpdatedAt instanceof Date && !Number.isNaN(input.sourceUpdatedAt.valueOf()),
    direction: "outgoing",
    provenanceComplete,
    sourceIsOfficial: input.sourceIsOfficial,
    sourceProvider,
    sourceRetrievedAt: input.sourceRetrievedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    sourceUrl
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch {
    return false
  }
}
