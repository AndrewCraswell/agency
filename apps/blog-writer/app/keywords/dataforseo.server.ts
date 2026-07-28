import { z } from "zod"

const PROVIDER = "dataforseo"
const BASE_URL = "https://api.dataforseo.com/v3"
const RANKED_KEYWORDS_ENDPOINT = "dataforseo_labs/google/ranked_keywords/live"
const LOCATIONS_ENDPOINT = "dataforseo_labs/locations_and_languages"
const REQUEST_TIMEOUT_MS = 120_000
const PROVIDER_OK = 20_000

/** Raised when the provider could not be reached or refused the request. Carries a code the caller can record. */
export class KeywordProviderError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "KeywordProviderError"
    this.code = code
  }
}

const TaskSchema = z.object({
  status_code: z.number().int(),
  status_message: z.string(),
  cost: z.number().nonnegative().nullish(),
  result: z.array(z.unknown()).nullish()
})

const EnvelopeSchema = z.object({
  status_code: z.number().int(),
  status_message: z.string(),
  cost: z.number().nonnegative().nullish(),
  tasks: z.array(TaskSchema).nullish()
})

function authorizationHeader() {
  const credential = process.env.DATAFORSEO_API_KEY
  if (credential === undefined || credential.trim() === "") {
    throw new KeywordProviderError("credentialsMissing", "No keyword provider credential is configured")
  }
  return `Basic ${credential.trim()}`
}

async function send(path: string, init: RequestInit) {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/${path}`, {
      headers: { authorization: authorizationHeader(), "content-type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...init
    })
  } catch (error) {
    throw new KeywordProviderError("unreachable", `Could not reach the keyword provider: ${String(error)}`)
  }

  if (response.status === 401 || response.status === 402) {
    throw new KeywordProviderError("unauthorized", `The keyword provider rejected the credential (${response.status})`)
  }
  if (!response.ok) {
    throw new KeywordProviderError("httpError", `The keyword provider returned ${response.status}`)
  }

  const envelope = EnvelopeSchema.parse(await response.json())
  if (envelope.status_code !== PROVIDER_OK) {
    throw new KeywordProviderError("providerError", envelope.status_message)
  }

  const [task] = envelope.tasks ?? []
  if (task === undefined) {
    throw new KeywordProviderError("emptyResponse", "The keyword provider returned no task")
  }

  // Cost is read from the task rather than the envelope so that spend stays attributable to the request that caused
  // it. A task that failed still costs nothing, but it has to be reported before the caller can decide that.
  const cost = task.cost ?? envelope.cost ?? 0
  if (task.status_code !== PROVIDER_OK) {
    throw new KeywordProviderError("taskFailed", task.status_message)
  }

  return { cost, results: task.result ?? [] }
}

async function post(path: string, body: unknown) {
  return send(path, { method: "POST", body: JSON.stringify(body) })
}

const SupportedMarketSchema = z.object({
  location_name: z.string(),
  country_iso_code: z.string(),
  available_languages: z.array(z.object({ language_code: z.string() }))
})

/**
 * Every country and language pair the provider will measure, and what it calls each country.
 *
 * The list is short, free to read, and the only authority on the subject. Naming a country ourselves is what a market
 * picker cannot afford to do, because the provider refuses a location it does not recognise and the refusal arrives
 * only after a merchant has changed their market and paid for a collection that returns nothing.
 */
export async function fetchSupportedMarkets() {
  const { results } = await send(LOCATIONS_ENDPOINT, { method: "GET" })
  return results.flatMap((entry) => {
    const location = SupportedMarketSchema.parse(entry)
    return location.available_languages.map((language) => ({
      countryCode: location.country_iso_code,
      languageCode: language.language_code,
      providerLocationName: location.location_name
    }))
  })
}

export type RankedKeywordsRequest = {
  target: string
  locationName: string
  languageCode: string
  limit: number
  /** Provider filter expression, narrowing what is billed rather than what is read back. */
  filters?: unknown[]
}

/**
 * Asks the provider what one domain currently ranks for in one market.
 *
 * The caller sets the limit and the filters, because every returned row is billed and which rows are worth buying
 * depends on what the caller intends to reason about rather than on anything this function knows.
 */
export async function fetchRankedKeywords(request: RankedKeywordsRequest) {
  const { cost, results } = await post(RANKED_KEYWORDS_ENDPOINT, [
    {
      target: request.target,
      location_name: request.locationName,
      language_code: request.languageCode,
      limit: request.limit,
      // Biggest demand first, so a limit that cannot buy the whole domain buys the part of the market worth arguing
      // about. Ordering by position instead would spend the whole budget on terms the domain already wins, which is
      // the one slice that can never contain an opportunity.
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      ...(request.filters === undefined ? {} : { filters: request.filters }),
      ignore_synonyms: true,
      load_rank_absolute: true
    }
  ])

  return { provider: PROVIDER, endpoint: RANKED_KEYWORDS_ENDPOINT, cost, result: results[0] ?? null }
}

export const keywordProviderName = PROVIDER
export const rankedKeywordsEndpoint = RANKED_KEYWORDS_ENDPOINT
