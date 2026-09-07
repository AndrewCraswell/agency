import { z } from "zod"
import { readBounded, RetryingHttpClient } from "../http-client.js"
import { createGovInfoAssignmentResolver } from "./committee-assignment-index.js"
import { parseGovInfoCompactCommitteeDirectory } from "./committee-compact-parser.js"
import { parseGovInfoCommitteeDirectory } from "./committee-directory-parser.js"
import { getGovInfoCommitteeGranules } from "./committee-granule-text.js"
import { parseGovInfoHistoricalCommitteeText } from "./committee-historical-parser.js"

const MAXIMUM_API_PAGE_BYTES = 5 * 1024 * 1024
const MAXIMUM_DIRECTORY_BYTES = 8 * 1024 * 1024
const DEFAULT_MAXIMUM_PAGES = 20
const DEFAULT_PAGE_SIZE = 100

const directoryCollectionSchema = z.object({
  nextPage: z.string().url().nullable(),
  packages: z.array(
    z
      .object({
        lastModified: z.string(),
        packageId: z.string().regex(/^CDIR-\d{4}-\d{2}-\d{2}$/)
      })
      .passthrough()
  )
})

export interface GovInfoDirectoryPackage {
  congress: number
  issuedAt: Date
  lastModified: Date
  packageId: string
  sourceUrl: URL
  textUrl: URL
}

export interface GovInfoCommitteeDirectoryClientOptions {
  apiKey: string
  apiUrl?: URL
  contentUrl?: URL
  http: RetryingHttpClient
  maximumPages?: number
  pageSize?: number
}

/** Discovers and downloads official Congressional Directory text renditions. */
export class GovInfoCommitteeDirectoryClient {
  readonly #apiKey: string
  readonly #apiUrl: URL
  readonly #contentUrl: URL
  readonly #http: RetryingHttpClient
  readonly #maximumPages: number
  readonly #pageSize: number

  constructor(options: GovInfoCommitteeDirectoryClientOptions) {
    this.#apiKey = options.apiKey.trim()
    if (this.#apiKey.length === 0) {
      throw new Error("GovInfo API key is required")
    }
    this.#apiUrl = options.apiUrl ?? new URL("https://api.govinfo.gov/")
    this.#contentUrl = options.contentUrl ?? new URL("https://www.govinfo.gov/content/pkg/")
    this.#http = options.http
    this.#maximumPages = positiveInteger(options.maximumPages ?? DEFAULT_MAXIMUM_PAGES, "maximum pages")
    this.#pageSize = positiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, "page size")
    if (this.#pageSize > 1_000) {
      throw new Error("GovInfo API page size cannot exceed 1000")
    }
  }

  async discover(congress: number): Promise<GovInfoDirectoryPackage[]> {
    const startYear = congressStartYear(congress)
    const from = new Date(`${startYear}-01-01T00:00:00Z`)
    const through = new Date(`${startYear + 2}-12-31T23:59:59Z`)
    const packages = new Map<string, GovInfoDirectoryPackage>()
    const seenCursors = new Set<string>()
    let offsetMark = "*"

    for (let page = 0; page < this.#maximumPages; page += 1) {
      if (seenCursors.has(offsetMark)) {
        throw new Error("GovInfo CDIR API returned a repeated pagination cursor")
      }
      seenCursors.add(offsetMark)
      const response = await this.#http.get(this.#collectionUrl(congress, offsetMark), {
        headers: { "X-Api-Key": this.#apiKey, accept: "application/json" }
      })
      const parsed = directoryCollectionSchema.safeParse(
        JSON.parse(new TextDecoder().decode(await readBounded(response, MAXIMUM_API_PAGE_BYTES)))
      )
      if (!parsed.success) {
        throw new Error("GovInfo API returned an invalid Congressional Directory collection response")
      }
      for (const record of parsed.data.packages) {
        const issuedAt = packageIssueDate(record.packageId)
        const lastModified = new Date(record.lastModified)
        if (Number.isNaN(lastModified.getTime()) || issuedAt < from || issuedAt > through) {
          continue
        }
        packages.set(record.packageId, {
          congress,
          issuedAt,
          lastModified,
          packageId: record.packageId,
          sourceUrl:
            congress < 119
              ? new URL(`https://www.govinfo.gov/app/details/${record.packageId}`)
              : new URL(`${record.packageId}/text/${record.packageId}.txt`, this.#contentUrl),
          textUrl: new URL(`${record.packageId}/text/${record.packageId}.txt`, this.#contentUrl)
        })
      }
      if (parsed.data.nextPage === null) {
        return [...packages.values()].sort(
          (left, right) =>
            left.issuedAt.getTime() - right.issuedAt.getTime() || left.packageId.localeCompare(right.packageId)
        )
      }
      offsetMark = nextOffsetMark(parsed.data.nextPage, this.#apiUrl)
    }
    throw new Error(`GovInfo CDIR pagination exceeded the ${this.#maximumPages} page safety limit`)
  }

  async getText(directoryPackage: GovInfoDirectoryPackage): Promise<string> {
    const bytes = await this.#http.getBytes(directoryPackage.textUrl, MAXIMUM_DIRECTORY_BYTES, {
      headers: { accept: "text/plain" }
    })
    const text = new TextDecoder().decode(bytes).replaceAll("\r\n", "\n")
    if (!text.includes("STANDING COMMITTEES OF THE SENATE") || !text.includes("STANDING COMMITTEES OF THE HOUSE")) {
      throw new Error(`GovInfo package ${directoryPackage.packageId} lacks required committee sections`)
    }
    return text
  }

  async getRecords(directoryPackage: GovInfoDirectoryPackage) {
    if (directoryPackage.congress < 118) {
      const granules = await getGovInfoCommitteeGranules({
        apiKey: this.#apiKey,
        http: this.#http,
        packageId: directoryPackage.packageId,
        includeAssignments: true,
        // Historical editions' advertised HTML loses portions of printed names.
        // Read the same official granules from their coordinate-preserving PDFs.
        rendition: "pdf"
      })
      return parseGovInfoHistoricalCommitteeText(
        granules.filter((granule) => !granule.title.startsWith("ASSIGNMENTS OF")),
        {
          resolveAbbreviatedMember: createGovInfoAssignmentResolver(
            granules.filter((granule) => granule.title.startsWith("ASSIGNMENTS OF"))
          )
        }
      )
    }
    if (directoryPackage.congress === 118) {
      const headers = { "X-Api-Key": this.#apiKey, accept: "application/json" }
      const response = await this.#http.get(new URL(`packages/${directoryPackage.packageId}/summary`, this.#apiUrl), {
        headers
      })
      const summary = z
        .object({ download: z.object({ pdfLink: z.url() }) })
        .parse(JSON.parse(new TextDecoder().decode(await readBounded(response, MAXIMUM_API_PAGE_BYTES))))
      const pdfUrl = new URL(summary.download.pdfLink)
      if (pdfUrl.origin !== this.#apiUrl.origin || pdfUrl.pathname !== `/packages/${directoryPackage.packageId}/pdf`) {
        throw new Error("GovInfo directory PDF link escaped its package")
      }
      const pdf = await this.#http.getBytes(pdfUrl, 100 * 1024 * 1024, {
        headers: { ...headers, accept: "application/pdf" }
      })
      const { extractGovInfoCommitteePdfText } = await import("./committee-pdf-text.js")
      return parseGovInfoCompactCommitteeDirectory(await extractGovInfoCommitteePdfText(pdf))
    }
    return parseGovInfoCommitteeDirectory(await this.getText(directoryPackage))
  }

  async getMemberAliases(
    directoryPackage: GovInfoDirectoryPackage,
    candidates: readonly { state: string; chamber: "upper" | "lower" }[]
  ) {
    const { getGovInfoCommitteeMemberAliases } = await import("./committee-member-aliases.js")
    return getGovInfoCommitteeMemberAliases({
      apiKey: this.#apiKey,
      http: this.#http,
      packageId: directoryPackage.packageId,
      congress: directoryPackage.congress,
      candidates
    })
  }

  #collectionUrl(congress: number, offsetMark: string): URL {
    // Collection bounds filter lastModified, not publication dates. Older
    // Congresses may have been republished years after their session ended.
    const url = new URL("collections/CDIR/1970-01-01T00:00:00Z", this.#apiUrl)
    url.searchParams.set("congress", String(congress))
    url.searchParams.set("offsetMark", offsetMark)
    url.searchParams.set("pageSize", String(this.#pageSize))
    return url
  }
}

function congressStartYear(congress: number): number {
  if (!Number.isSafeInteger(congress) || congress < 1) {
    throw new Error("GovInfo committee Congress must be a positive integer")
  }
  return 1789 + (congress - 1) * 2
}

function packageIssueDate(packageId: string): Date {
  const date = new Date(`${packageId.slice("CDIR-".length)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`GovInfo returned an invalid Congressional Directory package ID: ${packageId}`)
  }
  return date
}

function nextOffsetMark(nextPage: string, apiUrl: URL): string {
  const url = new URL(nextPage)
  if (url.origin !== apiUrl.origin || !url.pathname.startsWith("/collections/CDIR/")) {
    throw new Error("GovInfo CDIR API returned an invalid next-page URL")
  }
  const offsetMark = url.searchParams.get("offsetMark")?.trim()
  if (!offsetMark) {
    throw new Error("GovInfo CDIR API next-page URL is missing offsetMark")
  }
  return offsetMark
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`GovInfo CDIR ${name} must be a positive integer`)
  }
  return value
}
