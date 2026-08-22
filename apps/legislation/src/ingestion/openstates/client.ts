import { z } from "zod"
import { RetryingHttpClient } from "../http-client.js"

const pageSchema = z.object({
  pagination: z.object({ max_page: z.number().int().nonnegative(), page: z.number().int().positive() }),
  results: z.array(z.unknown())
})

const includes = [
  "abstracts",
  "actions",
  "documents",
  "related_bills",
  "sources",
  "sponsorships",
  "versions",
  "votes"
] as const

export class OpenStatesClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #http: RetryingHttpClient

  constructor(options: Readonly<{ apiKey: string; baseUrl: URL; http: RetryingHttpClient }>) {
    this.#apiKey = options.apiKey
    this.#baseUrl = options.baseUrl
    this.#http = options.http
  }

  async *bills(
    options: Readonly<{ from: Date; jurisdiction: string; page?: number }>
  ): AsyncGenerator<readonly unknown[]> {
    let page = options.page ?? 1
    for (;;) {
      const url = new URL("bills", ensureTrailingSlash(this.#baseUrl))
      url.searchParams.set("updated_since", openStatesDateTime(options.from))
      url.searchParams.set("jurisdiction", options.jurisdiction)
      url.searchParams.set("sort", "updated_asc")
      url.searchParams.set("page", String(page))
      url.searchParams.set("per_page", "20")
      for (const include of includes) {
        url.searchParams.append("include", include)
      }
      const response = await this.#http.get(url, { headers: { "x-api-key": this.#apiKey } })
      const result = pageSchema.parse(await response.json())
      yield result.results
      if (page >= result.pagination.max_page) {
        return
      }
      page += 1
    }
  }

  async *people(options: Readonly<{ jurisdictionId: string; page?: number }>): AsyncGenerator<readonly unknown[]> {
    yield* this.#resourcePages("people", options)
  }

  async *committees(options: Readonly<{ jurisdictionId: string; page?: number }>): AsyncGenerator<readonly unknown[]> {
    yield* this.#resourcePages("committees", options, ["memberships"])
  }

  async *events(
    options: Readonly<{ from: Date; jurisdictionId: string; page?: number; to: Date }>
  ): AsyncGenerator<readonly unknown[]> {
    let page = options.page ?? 1
    for (;;) {
      const url = new URL("events", ensureTrailingSlash(this.#baseUrl))
      url.searchParams.set("jurisdiction", options.jurisdictionId)
      url.searchParams.set("start_date", openStatesDateTime(options.from))
      url.searchParams.set("end_date", openStatesDateTime(options.to))
      url.searchParams.set("page", String(page))
      url.searchParams.set("per_page", "20")
      for (const include of ["agenda", "documents", "participants"]) {
        url.searchParams.append("include", include)
      }
      const response = await this.#http.get(url, { headers: { "x-api-key": this.#apiKey } })
      const result = pageSchema.parse(await response.json())
      yield result.results
      if (page >= result.pagination.max_page) {
        return
      }
      page += 1
    }
  }

  async *#resourcePages(
    resource: "committees" | "people",
    options: Readonly<{ jurisdictionId: string; page?: number }>,
    resourceIncludes: readonly string[] = []
  ): AsyncGenerator<readonly unknown[]> {
    let page = options.page ?? 1
    for (;;) {
      const url = new URL(resource, ensureTrailingSlash(this.#baseUrl))
      url.searchParams.set("jurisdiction", options.jurisdictionId)
      url.searchParams.set("page", String(page))
      url.searchParams.set("per_page", "20")
      for (const include of resourceIncludes) {
        url.searchParams.append("include", include)
      }
      const response = await this.#http.get(url, { headers: { "x-api-key": this.#apiKey } })
      const result = pageSchema.parse(await response.json())
      yield result.results
      if (page >= result.pagination.max_page) {
        return
      }
      page += 1
    }
  }
}

function ensureTrailingSlash(url: URL): URL {
  return new URL(url.href.endsWith("/") ? url.href : `${url.href}/`)
}

function openStatesDateTime(value: Date): string {
  return value.toISOString().slice(0, 19)
}
