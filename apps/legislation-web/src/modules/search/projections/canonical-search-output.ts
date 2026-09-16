import {
  normalizeHttpBillSearchPage,
  type BillSearchPage
} from "@repo/legislation-core/research/canonical-search-output"
import {
  projectBillSearchHit,
  type BillSearchCandidateRead,
  type BillSearchExecution,
  type BillSearchMode
} from "../../request-handling/api/canonical-search.js"

export type DirectBillSearchPage = Readonly<{
  items: readonly BillSearchCandidateRead[]
  nextCursor?: string
  search: BillSearchExecution
  truncated: boolean
  warnings?: readonly string[]
}>

export type BillSearchNormalizationContext = Readonly<{
  apiBaseUrl: string
  correlationId: string
  limit: number
  mode: BillSearchMode
  rankOffset: number
}>

export function normalizeDirectBillSearchPage(
  page: DirectBillSearchPage,
  context: BillSearchNormalizationContext
): BillSearchPage {
  if (!Number.isSafeInteger(context.rankOffset) || context.rankOffset < 0) {
    throw new RangeError("rankOffset must be a non-negative safe integer")
  }
  const data = page.items.map((candidate, index) =>
    projectBillSearchHit(candidate, context.mode, context.rankOffset + index + 1, context.apiBaseUrl)
  )
  const nextCursor = page.nextCursor ?? null
  return normalizeHttpBillSearchPage({
    data,
    links: {
      next: nextCursor === null ? null : `/api/search/bills?cursor=${encodeURIComponent(nextCursor)}`,
      self: "/api/search/bills"
    },
    meta: {
      correlationId: context.correlationId,
      isReranked: page.search.isReranked,
      limit: context.limit,
      mode: context.mode,
      models: page.search.models.map((model) => ({ model: model.model, purpose: model.purpose })),
      nextCursor,
      truncated: page.truncated,
      warnings: [...(page.warnings ?? [])]
    }
  })
}
