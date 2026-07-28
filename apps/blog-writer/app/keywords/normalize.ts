import { z } from "zod"

/**
 * One domain's position on one keyword, as the provider reported it. Every field is optional at the source, so the
 * type says nullable wherever the provider is allowed to say nothing rather than pretending to a completeness the
 * payload does not have.
 */
export type KeywordObservation = {
  keyword: string
  domain: string
  rankAbsolute: number
  rankGroup: number | null
  rankingUrl: string | null
  previousRankAbsolute: number | null
  searchVolume: number | null
  monthlySearches: { year: number; month: number; searchVolume: number }[] | null
  difficulty: number | null
  mainIntent: string | null
  foreignIntents: string[]
  serpItemTypes: string[]
  serpAverageDomainRank: number | null
  serpResultCount: number | null
  estimatedTrafficVolume: number | null
  fieldFreshness: Record<string, string>
}

export type NormalizedDomainKeywords = {
  domain: string
  /** The provider's authority score for the domain, which is a property of the domain and identical on every row. */
  domainRank: number | null
  /** How many keywords the provider holds for this domain, which is usually more than one page returns. */
  availableRowCount: number | null
  observations: KeywordObservation[]
}

const MonthlySearchSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  search_volume: z.number().int().nonnegative().nullish()
})

const KeywordDataSchema = z.object({
  keyword: z.string().min(1),
  keyword_info: z
    .object({
      search_volume: z.number().int().nonnegative().nullish(),
      monthly_searches: z.array(MonthlySearchSchema).nullish(),
      last_updated_time: z.string().nullish()
    })
    .nullish(),
  keyword_properties: z
    .object({
      keyword_difficulty: z.number().int().nullish()
    })
    .nullish(),
  serp_info: z
    .object({
      serp_item_types: z.array(z.string()).nullish(),
      se_results_count: z.number().nullish(),
      last_updated_time: z.string().nullish()
    })
    .nullish(),
  avg_backlinks_info: z
    .object({
      main_domain_rank: z.number().nullish(),
      last_updated_time: z.string().nullish()
    })
    .nullish(),
  search_intent_info: z
    .object({
      main_intent: z.string().nullish(),
      foreign_intent: z.array(z.string()).nullish(),
      last_updated_time: z.string().nullish()
    })
    .nullish()
})

const SerpItemSchema = z.object({
  domain: z.string().nullish(),
  url: z.string().nullish(),
  rank_absolute: z.number().int().positive(),
  rank_group: z.number().int().positive().nullish(),
  etv: z.number().nullish(),
  rank_info: z.object({ main_domain_rank: z.number().nullish() }).nullish(),
  rank_changes: z.object({ previous_rank_absolute: z.number().int().positive().nullish() }).nullish()
})

const RankedKeywordItemSchema = z.object({
  keyword_data: KeywordDataSchema,
  ranked_serp_element: z.object({ serp_item: SerpItemSchema }).nullish()
})

export const RankedKeywordsResultSchema = z.object({
  target: z.string().min(1),
  total_count: z.number().int().nonnegative().nullish(),
  items: z.array(RankedKeywordItemSchema).nullish()
})

function collectFreshness(keywordData: z.infer<typeof KeywordDataSchema>) {
  const groups = {
    demand: keywordData.keyword_info?.last_updated_time,
    results: keywordData.serp_info?.last_updated_time,
    authority: keywordData.avg_backlinks_info?.last_updated_time,
    intent: keywordData.search_intent_info?.last_updated_time
  }
  return Object.fromEntries(
    Object.entries(groups).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  )
}

/**
 * Turns one provider result page into rows for one domain.
 *
 * Rows without a position are dropped, because an observation is a claim that a page held a place on a results page
 * and there is nothing to record without one. A keyword the provider repeats is kept at its best position, so a
 * domain contributes one row per term and the primary key holds without silently discarding the stronger placement.
 */
export function normalizeRankedKeywords(result: unknown, domain: string): NormalizedDomainKeywords {
  const parsed = RankedKeywordsResultSchema.parse(result)
  const byKeyword = new Map<string, KeywordObservation>()
  let domainRank: number | null = null

  for (const item of parsed.items ?? []) {
    const serpItem = item.ranked_serp_element?.serp_item
    if (serpItem === undefined || serpItem === null) {
      continue
    }

    const keywordData = item.keyword_data
    const observation: KeywordObservation = {
      keyword: keywordData.keyword,
      domain,
      rankAbsolute: serpItem.rank_absolute,
      rankGroup: serpItem.rank_group ?? null,
      rankingUrl: serpItem.url ?? null,
      previousRankAbsolute: serpItem.rank_changes?.previous_rank_absolute ?? null,
      searchVolume: keywordData.keyword_info?.search_volume ?? null,
      monthlySearches:
        keywordData.keyword_info?.monthly_searches?.map((month) => ({
          year: month.year,
          month: month.month,
          searchVolume: month.search_volume ?? 0
        })) ?? null,
      difficulty: keywordData.keyword_properties?.keyword_difficulty ?? null,
      mainIntent: keywordData.search_intent_info?.main_intent ?? null,
      foreignIntents: keywordData.search_intent_info?.foreign_intent ?? [],
      serpItemTypes: keywordData.serp_info?.serp_item_types ?? [],
      serpAverageDomainRank: keywordData.avg_backlinks_info?.main_domain_rank ?? null,
      serpResultCount: keywordData.serp_info?.se_results_count ?? null,
      estimatedTrafficVolume: serpItem.etv ?? null,
      fieldFreshness: collectFreshness(keywordData)
    }

    const existing = byKeyword.get(observation.keyword)
    if (existing === undefined || observation.rankAbsolute < existing.rankAbsolute) {
      byKeyword.set(observation.keyword, observation)
    }
    domainRank ??= serpItem.rank_info?.main_domain_rank ?? null
  }

  return {
    domain,
    domainRank,
    availableRowCount: parsed.total_count ?? null,
    observations: [...byKeyword.values()]
  }
}
