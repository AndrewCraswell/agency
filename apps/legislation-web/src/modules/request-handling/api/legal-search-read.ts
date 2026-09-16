import { legalSearchRequestSchema } from "@repo/legislation-core/api-client/legal-search-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import { z } from "zod"
import { createLegalEditionSearch } from "./legal-edition-search"

/** Public search orchestration. Incomplete requested capabilities fail explicitly, never disappear from the scope. */
export function createLegalSearch(
  source: pg.Pool,
  target: pg.Pool | undefined,
  allowedOrganizations: readonly string[]
) {
  const searchEditions =
    target === undefined ? undefined : createLegalEditionSearch(source, target, allowedOrganizations)
  return async (value: unknown, origin: string) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowedOrganizations.includes(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = legalSearchRequestSchema.parse(value)
    if (input.asOf !== undefined) {
      throw new LegislationError("conflict", "Historical date selection is not available", {
        details: { reason: "historical_coverage_unavailable" }
      })
    }
    const unavailable = (reason: string) =>
      new LegislationError("dependency_unavailable", "Requested search capability is not available", {
        details: { reason }
      })
    if (input.corpora.length !== 1 || input.corpora[0] !== "regulation") {
      throw unavailable("corpus_search_unavailable")
    }
    if (input.jurisdictionIds?.some((id) => id !== "jurisdiction:us")) {
      throw unavailable("jurisdiction_search_unavailable")
    }
    if (input.agencyIds !== undefined) {
      throw unavailable("agency_search_unavailable")
    }
    if (input.mode !== "lexical" && !input.allowDegraded) {
      throw unavailable("semantic_search_unavailable")
    }
    if (searchEditions === undefined) {
      throw unavailable("lexical_search_unavailable")
    }
    const explicit = input.editionIds === undefined ? undefined : z.array(z.uuid()).safeParse(input.editionIds)
    const codes = input.codeIds === undefined ? undefined : z.array(z.uuid()).safeParse(input.codeIds)
    if ((explicit && !explicit.success) || (codes && !codes.success)) {
      throw new LegislationError("invalid_request", "Invalid code or edition ID")
    }
    // Metadata selection only. The edition service locks rights and all selected memberships before ranking/text.
    const result = await source.query<{ id: string; code_id: string }>(
      `SELECT e.id,e.code_id FROM legislation.legal_editions e
       WHERE e.published_at IS NOT NULL AND e.jurisdiction_id='jurisdiction:us'
         AND e.source_id IN ('ecfr','govinfo-cfr')
         AND ($1::uuid[] IS NULL OR e.id=ANY($1::uuid[]))
         AND ($2::uuid[] IS NULL OR e.code_id=ANY($2::uuid[]))
         AND ($1::uuid[] IS NOT NULL OR EXISTS (SELECT 1 FROM legislation.legal_code_heads h
           WHERE h.edition_id=e.id AND h.code_id=e.code_id AND h.source_id='ecfr'))
       ORDER BY e.id LIMIT 101`,
      [input.editionIds ?? null, input.codeIds ?? null]
    )
    if (result.rows.length > 100) {
      throw unavailable("search_scope_limit")
    }
    if (
      result.rows.length === 0 ||
      (input.editionIds !== undefined && result.rows.length !== input.editionIds.length) ||
      input.codeIds?.some((id) => !result.rows.some((row) => row.code_id === id))
    ) {
      throw new LegislationError("not_found", "Selected published code editions were not found")
    }
    const { cursor: _cursor, ...filters } = input
    const requestBinding = digest(
      JSON.stringify({
        ...filters,
        jurisdictionIds: input.jurisdictionIds?.toSorted(),
        codeIds: input.codeIds?.toSorted(),
        editionIds: input.editionIds?.toSorted(),
        corpora: input.corpora.toSorted()
      })
    )
    const page = await searchEditions({
      editionIds: result.rows.map((row) => row.id),
      query: input.query,
      limit: input.limit,
      requestBinding,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor })
    })
    return {
      items: page.hits.map((hit) => {
        const section = /^cfr:(\d+):section:(.+)$/.exec(hit.nativeId)
        return {
          kind: "provision",
          corpus: "regulation",
          id: hit.provisionId,
          versionId: hit.versionId,
          passageId: hit.passageId,
          canonicalUrl: new URL(hit.textUrl, origin).href,
          sources: [
            {
              provider: hit.sourceId,
              sourceUrl: hit.sourceUrl,
              sourceUpdatedAt: null,
              retrievedAt: hit.retrievedAt,
              isOfficial: true,
              publisher: hit.publisher,
              supplier: hit.publisher,
              attribution: hit.attribution
            }
          ],
          updatedAt: hit.updatedAt,
          title: hit.heading || hit.nativeId,
          heading: hit.heading || null,
          citation: section ? `${section[1]} CFR ${section[2]}` : hit.nativeId,
          jurisdiction: { id: "jurisdiction:us", name: "United States" },
          agencies: [],
          code: { id: hit.codeId, name: hit.codeName },
          snippet: hit.passage.text.slice(0, 500),
          matchMode: "lexical",
          sourceLocator: hit.sourceLocator,
          versionHash: hit.versionHash,
          coverageWarnings: [
            "Agency mapping is not available for this result.",
            ...(section ? [] : ["Citation is a source-native identifier."])
          ],
          selectedContext: {
            editionId: hit.editionId,
            provisionId: hit.provisionId,
            versionId: hit.versionId,
            sourceObservationId: hit.sourceObservationId,
            sourceId: hit.sourceId,
            rightsPolicyHash: hit.rightsPolicyHash,
            parentId: hit.parentId,
            sourceLocator: hit.sourceLocator,
            sourceCurrencyDate: hit.sourceCurrencyDate,
            selectedDate: hit.sourceId === "govinfo-cfr" ? hit.issueDate : null,
            basis: hit.sourceId === "govinfo-cfr" ? "published_edition" : "observed_snapshot",
            legalStatus: "unknown"
          }
        }
      }),
      ...(page.nextCursor === null ? {} : { nextCursor: page.nextCursor }),
      truncated: page.truncated,
      warnings: [
        ...page.warnings,
        ...(input.mode === "lexical"
          ? []
          : ["Semantic search is unavailable; the requested lexical fallback was used."])
      ],
      legal: {
        lexicalGeneration: page.generation,
        embeddingGeneration: null,
        effectiveMode: "lexical",
        degraded: input.mode !== "lexical",
        candidateSetTruncated: page.candidateSetTruncated
      }
    }
  }
}
