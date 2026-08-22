import { z } from "zod"
import { readBounded, RetryingHttpClient } from "../http-client.js"
import type { GovInfoBillStatusPackage } from "./client.js"

const MAXIMUM_API_PAGE_BYTES = 5 * 1024 * 1024
const DEFAULT_PAGE_SIZE = 1_000
const DEFAULT_MAXIMUM_PAGES = 100

const collectionResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  nextPage: z.string().url().nullable(),
  packages: z.array(
    z.object({
      lastModified: z.string(),
      packageId: z.string()
    })
  )
})

export type GovInfoApiClientOptions = Readonly<{
  apiKey: string
  baseUrl?: URL
  http: RetryingHttpClient
  maximumPages?: number
  pageSize?: number
}>

export class GovInfoApiClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #http: RetryingHttpClient
  readonly #maximumPages: number
  readonly #pageSize: number

  constructor(options: GovInfoApiClientOptions) {
    this.#apiKey = options.apiKey.trim()
    if (this.#apiKey === "") {
      throw new Error("GovInfo API key is required")
    }
    this.#baseUrl = options.baseUrl ?? new URL("https://api.govinfo.gov/")
    this.#http = options.http
    this.#maximumPages = positiveInteger(options.maximumPages ?? DEFAULT_MAXIMUM_PAGES, "maximum pages")
    this.#pageSize = positiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, "page size")
    if (this.#pageSize > 1_000) {
      throw new Error("GovInfo API page size cannot exceed 1000")
    }
  }

  async discoverModified(
    congress: number,
    billTypes: readonly string[],
    modifiedSince: Date,
    modifiedThrough: Date
  ): Promise<GovInfoBillStatusPackage[]> {
    if (
      !Number.isSafeInteger(congress) ||
      congress < 1 ||
      !Number.isFinite(modifiedSince.getTime()) ||
      !Number.isFinite(modifiedThrough.getTime()) ||
      modifiedSince > modifiedThrough
    ) {
      throw new Error("GovInfo API discovery scope is invalid")
    }
    const requestedTypes = new Set(billTypes.map((value) => value.trim().toLowerCase()).filter(Boolean))
    const packages = new Map<string, GovInfoBillStatusPackage>()
    const seenOffsetMarks = new Set<string>()
    let offsetMark = "*"

    for (let page = 0; page < this.#maximumPages; page += 1) {
      if (seenOffsetMarks.has(offsetMark)) {
        throw new Error("GovInfo API returned a repeated pagination cursor")
      }
      seenOffsetMarks.add(offsetMark)
      const response = await this.#http.get(this.#collectionUrl(congress, modifiedSince, modifiedThrough, offsetMark), {
        headers: { "X-Api-Key": this.#apiKey, accept: "application/json" }
      })
      const parsed = collectionResponseSchema.safeParse(
        JSON.parse(new TextDecoder().decode(await readBounded(response, MAXIMUM_API_PAGE_BYTES)))
      )
      if (!parsed.success) {
        throw new Error("GovInfo API returned an invalid BILLSTATUS collection response")
      }
      for (const record of parsed.data.packages) {
        const packageScope = parsePackageId(record.packageId)
        const lastModified = new Date(record.lastModified)
        if (
          packageScope === undefined ||
          packageScope.congress !== congress ||
          !requestedTypes.has(packageScope.billType) ||
          Number.isNaN(lastModified.getTime()) ||
          lastModified < modifiedSince ||
          lastModified > modifiedThrough
        ) {
          continue
        }
        packages.set(record.packageId, {
          billType: packageScope.billType,
          congress,
          lastModified,
          packageId: record.packageId,
          url: new URL(
            `${congress}/${packageScope.billType}/${record.packageId}.xml`,
            "https://www.govinfo.gov/bulkdata/BILLSTATUS/"
          )
        })
      }
      if (parsed.data.nextPage === null) {
        return sortPackages(packages.values())
      }
      offsetMark = nextOffsetMark(parsed.data.nextPage, this.#baseUrl)
    }

    throw new Error(`GovInfo API pagination exceeded the ${this.#maximumPages} page safety limit`)
  }

  #collectionUrl(congress: number, modifiedSince: Date, modifiedThrough: Date, offsetMark: string): URL {
    const url = new URL(
      `collections/BILLSTATUS/${apiTimestamp(modifiedSince)}/${apiTimestamp(modifiedThrough)}`,
      this.#baseUrl
    )
    url.searchParams.set("offsetMark", offsetMark)
    url.searchParams.set("pageSize", String(this.#pageSize))
    url.searchParams.set("congress", String(congress))
    return url
  }
}

function apiTimestamp(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z")
}

function parsePackageId(packageId: string): Readonly<{ billType: string; congress: number }> | undefined {
  const match = /^BILLSTATUS-(\d+)([a-z]+)\d+$/i.exec(packageId)
  return match?.[1] === undefined || match[2] === undefined
    ? undefined
    : { billType: match[2].toLowerCase(), congress: Number(match[1]) }
}

function nextOffsetMark(nextPage: string, baseUrl: URL): string {
  const url = new URL(nextPage)
  if (url.origin !== baseUrl.origin || !url.pathname.startsWith("/collections/BILLSTATUS/")) {
    throw new Error("GovInfo API returned an invalid next-page URL")
  }
  const offsetMark = url.searchParams.get("offsetMark")
  if (offsetMark === null || offsetMark.trim() === "") {
    throw new Error("GovInfo API next-page URL is missing offsetMark")
  }
  return offsetMark
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`GovInfo API ${name} must be a positive integer`)
  }
  return value
}

function sortPackages(packages: Iterable<GovInfoBillStatusPackage>): GovInfoBillStatusPackage[] {
  return [...packages].sort((left, right) => {
    const modifiedOrder = (left.lastModified?.getTime() ?? 0) - (right.lastModified?.getTime() ?? 0)
    return modifiedOrder === 0 ? left.packageId.localeCompare(right.packageId) : modifiedOrder
  })
}
