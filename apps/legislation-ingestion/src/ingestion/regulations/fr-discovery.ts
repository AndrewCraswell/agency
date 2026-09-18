import {
  digest,
  inventoryEvidenceSchema,
  officialUrl,
  unitIdentity,
  type InventoryEvidence
} from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { readBounded, RetryingHttpClient } from "../http-client.js"
import {
  commitLegalDiscoveryPage,
  legalDiscoveryUnitSchema,
  startLegalDiscoveryAttempt,
  type LegalDiscoveryUnit
} from "./discovery-checkpoint.js"

const collection = "FR"
const pageSize = 100
const saturationLimit = 10_000
const overlapMilliseconds = 24 * 60 * 60 * 1000
const maximumPageBytes = 8 * 1024 * 1024
const cursorContract = "govinfo-fr-modification-cursor-2026-09-18" as const

const windowSchema = z
  .strictObject({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })
  .superRefine((value, context) => {
    if (value.start > value.end) context.addIssue({ code: "custom", message: "Invalid Federal Register window" })
  })
const activeWindowSchema = windowSchema.extend({ offsetMark: z.string().trim().min(1).max(2_048) })
export const frDiscoveryCursorSchema = z.strictObject({
  contract: z.literal(cursorContract),
  active: activeWindowSchema.nullable(),
  pending: z.array(windowSchema).max(64),
  latestWindowEnd: z.iso.datetime({ offset: true })
})
export type FrDiscoveryCursor = z.infer<typeof frDiscoveryCursorSchema>

const collectionPackageSchema = z.object({
  packageId: z.string().regex(/^FR-\d{4}-\d{2}-\d{2}$/),
  lastModified: z.iso.datetime({ offset: true }),
  packageLink: z.url()
})
const collectionPageSchema = z.object({
  count: z.int().nonnegative(),
  nextPage: z.url().nullable(),
  packages: z.array(collectionPackageSchema).max(pageSize)
})
type CollectionPage = z.infer<typeof collectionPageSchema>

export interface GovInfoFrPage {
  readonly evidence: InventoryEvidence
  readonly page: CollectionPage
  readonly nextOffsetMark: string | null
}

export interface GovInfoFrDiscoveryPageClient {
  fetchPage(window: z.infer<typeof windowSchema>, offsetMark: string): Promise<GovInfoFrPage>
}

/** Reads exactly one bounded GovInfo collection page. API credentials never enter retained evidence. */
export class GovInfoFrDiscoveryClient implements GovInfoFrDiscoveryPageClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #http: RetryingHttpClient

  constructor(options: { apiKey: string; baseUrl?: URL; http?: RetryingHttpClient; fetch?: typeof fetch }) {
    this.#apiKey = options.apiKey.trim()
    invariant(this.#apiKey !== "", "GovInfo API key is required")
    this.#baseUrl = options.baseUrl ?? new URL("https://api.govinfo.gov/")
    invariant(
      this.#baseUrl.protocol === "https:" && this.#baseUrl.username === "" && this.#baseUrl.password === "",
      "GovInfo API base URL is invalid"
    )
    this.#http =
      options.http ??
      new RetryingHttpClient({
        fetch: options.fetch,
        maxAttempts: 1,
        minimumIntervalMs: 500,
        requestTimeoutMs: 60_000
      })
  }

  async fetchPage(value: z.infer<typeof windowSchema>, offsetMark: string): Promise<GovInfoFrPage> {
    const window = windowSchema.parse(value)
    const cursor = z.string().trim().min(1).max(2_048).parse(offsetMark)
    const url = this.#collectionUrl(window, cursor)
    const response = await this.#http.get(url, {
      redirect: "error",
      headers: { "X-Api-Key": this.#apiKey, accept: "application/json" }
    })
    const contentType = response.headers.get("content-type") ?? ""
    invariant(contentType.toLowerCase().includes("json"), "GovInfo FR discovery did not return JSON")
    const bytes = await readBounded(response, maximumPageBytes)
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const page = collectionPageSchema.parse(JSON.parse(body))
    const evidence = inventoryEvidenceSchema.parse({
      sourceId: "govinfo-fr",
      url: url.href,
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      retrievedAt: new Date().toISOString(),
      contentType,
      body
    })
    return { evidence, page, nextOffsetMark: this.#nextOffsetMark(page.nextPage, window) }
  }

  #collectionUrl(window: z.infer<typeof windowSchema>, offsetMark: string) {
    const url = new URL(
      `collections/${collection}/${apiTimestamp(window.start)}/${apiTimestamp(window.end)}`,
      this.#baseUrl
    )
    url.searchParams.set("offsetMark", offsetMark)
    url.searchParams.set("pageSize", String(pageSize))
    return url
  }

  #nextOffsetMark(nextPage: string | null, window: z.infer<typeof windowSchema>) {
    if (nextPage === null) return null
    const next = new URL(nextPage)
    const expected = this.#collectionUrl(window, "*")
    invariant(
      next.origin === this.#baseUrl.origin && next.pathname === expected.pathname,
      "GovInfo FR discovery returned an invalid next-page URL"
    )
    const nextPageSize = next.searchParams.get("pageSize")
    invariant(nextPageSize === null || nextPageSize === String(pageSize), "GovInfo FR discovery changed page size")
    const offsetMark = next.searchParams.get("offsetMark")?.trim()
    invariant(offsetMark, "GovInfo FR discovery next-page URL is missing offsetMark")
    return z.string().max(2_048).parse(offsetMark)
  }
}

function apiTimestamp(value: string) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z")
}

function splitWindow(window: z.infer<typeof windowSchema>) {
  const start = new Date(window.start).getTime()
  const end = new Date(window.end).getTime()
  invariant(end - start >= 2_000, "govinfo_fr_saturated_one_second_window")
  const midpoint = new Date(Math.floor((start + end) / 2 / 1000) * 1000).toISOString()
  invariant(midpoint > window.start && midpoint < window.end, "govinfo_fr_window_split_invalid")
  return [
    windowSchema.parse({ start: window.start, end: midpoint }),
    windowSchema.parse({ start: midpoint, end: window.end })
  ]
}

function nextActive(pending: readonly z.infer<typeof windowSchema>[]) {
  const [first, ...remaining] = pending
  return {
    active: first === undefined ? null : { ...first, offsetMark: "*" },
    pending: remaining
  }
}

export function initializeFrDiscoveryCursor(input: {
  committedCursor: unknown
  bootstrapStart: string
  through: string
}): FrDiscoveryCursor {
  const through = z.iso.datetime({ offset: true }).parse(input.through)
  if (input.committedCursor === null) {
    const window = windowSchema.parse({ start: input.bootstrapStart, end: through })
    return { contract: cursorContract, active: { ...window, offsetMark: "*" }, pending: [], latestWindowEnd: through }
  }
  const previous = frDiscoveryCursorSchema.parse(input.committedCursor)
  if (previous.active !== null) {
    invariant(previous.latestWindowEnd === through, "govinfo_fr_discovery_window_changed")
    return previous
  }
  invariant(through >= previous.latestWindowEnd, "govinfo_fr_discovery_clock_moved_backwards")
  const start = new Date(new Date(previous.latestWindowEnd).getTime() - overlapMilliseconds).toISOString()
  const window = windowSchema.parse({ start, end: through })
  return { contract: cursorContract, active: { ...window, offsetMark: "*" }, pending: [], latestWindowEnd: through }
}

export function planFrDiscoveryPage(cursorValue: unknown, pageValue: GovInfoFrPage) {
  const cursor = frDiscoveryCursorSchema.parse(cursorValue)
  const active = cursor.active
  invariant(active, "govinfo_fr_discovery_cursor_complete")
  const evidence = inventoryEvidenceSchema.parse(pageValue.evidence)
  invariant(
    evidence.sourceId === "govinfo-fr" &&
      evidence.sha256 === digest(evidence.body) &&
      evidence.bytes === Buffer.byteLength(evidence.body),
    "GovInfo FR discovery evidence is invalid"
  )
  const page = collectionPageSchema.parse(pageValue.page)
  if (page.count > saturationLimit) {
    invariant(active.offsetMark === "*", "govinfo_fr_saturation_after_pagination")
    const [left, right] = splitWindow(active)
    return {
      cursor: frDiscoveryCursorSchema.parse({
        ...cursor,
        active: { ...left, offsetMark: "*" },
        pending: [right, ...cursor.pending]
      }),
      units: [] as LegalDiscoveryUnit[],
      split: true
    }
  }
  const seen = new Set<string>()
  const units = page.packages.map((item) => {
    invariant(!seen.has(item.packageId), "govinfo_fr_duplicate_package")
    seen.add(item.packageId)
    const modified = new Date(item.lastModified).getTime()
    invariant(
      modified >= new Date(active.start).getTime() && modified <= new Date(active.end).getTime(),
      "govinfo_fr_package_outside_window"
    )
    const issueDate = item.packageId.slice("FR-".length)
    const values = {
      sourceId: "govinfo-fr" as const,
      nativeId: item.packageId,
      edition: issueDate,
      inventoryHash: evidence.sha256,
      inventoryRevision: item.lastModified,
      sourceUrl: officialUrl(
        `https://www.govinfo.gov/bulkdata/FR/${issueDate.slice(0, 4)}/${issueDate.slice(5, 7)}/${item.packageId}.xml`,
        "govinfo-fr"
      ).href,
      issueDate,
      currencyDate: null,
      sourceModifiedText: item.lastModified,
      expectedBytes: null,
      format: "xml" as const,
      historical: false as const,
      rightsProfileId: "official-federal-text" as const,
      externalStandardsIncluded: false as const
    }
    return legalDiscoveryUnitSchema.parse({ ...values, key: unitIdentity(values) })
  })
  let continuation: Pick<FrDiscoveryCursor, "active" | "pending">
  if (pageValue.nextOffsetMark !== null) {
    invariant(page.packages.length > 0, "govinfo_fr_empty_continuation_page")
    continuation = { active: { ...active, offsetMark: pageValue.nextOffsetMark }, pending: cursor.pending }
  } else {
    continuation = nextActive(cursor.pending)
  }
  return {
    cursor: frDiscoveryCursorSchema.parse({ ...cursor, ...continuation }),
    units,
    split: false
  }
}

/** Processes one durable modified-time page. The caller must explicitly continue until complete. */
export async function discoverFrChanges(
  pool: pg.Pool,
  options: {
    apiKey?: string
    bootstrapStart: string
    client?: GovInfoFrDiscoveryPageClient
    through: string
  }
) {
  const query = { endpoint: "collections/FR", overlapHours: 24, pageSize, saturationLimit }
  const attempt = await startLegalDiscoveryAttempt(pool, { sourceId: "govinfo-fr", query })
  const cursor = initializeFrDiscoveryCursor({
    committedCursor: attempt.committedCursor,
    bootstrapStart: options.bootstrapStart,
    through: options.through
  })
  invariant(cursor.active, "govinfo_fr_discovery_cursor_complete")
  const client = options.client ?? new GovInfoFrDiscoveryClient({ apiKey: options.apiKey ?? "" })
  const response = await client.fetchPage(cursor.active, cursor.active.offsetMark)
  const plan = planFrDiscoveryPage(cursor, response)
  const result = await commitLegalDiscoveryPage(pool, {
    sourceId: "govinfo-fr",
    query,
    expectedRevision: attempt.revision,
    expectedCursor: attempt.committedCursor,
    nextCursor: plan.cursor,
    windowStartedAt: cursor.active.start,
    windowEndedAt: cursor.active.end,
    overlapStartedAt: cursor.active.start,
    sourceCutoff: {
      evidenceHash: response.evidence.sha256,
      modifiedThrough: cursor.active.end,
      packages: response.page.count
    },
    units: plan.units
  })
  return {
    ...result,
    complete: plan.cursor.active === null,
    cursor: plan.cursor,
    discoveredPackages: plan.units.map((unit) => unit.nativeId),
    split: plan.split
  }
}
