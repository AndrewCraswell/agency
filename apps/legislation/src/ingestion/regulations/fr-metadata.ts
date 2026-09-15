import { randomUUID } from "node:crypto"
import { link, lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import invariant from "tiny-invariant"
import { z } from "zod"
import { readBounded, RetryingHttpClient } from "../http-client.js"
import { digest } from "./contracts.js"
import {
  frDocumentTypes,
  frMetadataContract,
  frMetadataFields,
  frMetadataManifestSchema,
  frMetadataPageSchema,
  frMetadataScopeSchema,
  frTypeNames,
  normalizeFrDocumentNumber,
  validateFrPageEvidence,
  type FrMetadataManifest,
  type FrMetadataScope,
  type FrPageEvidence
} from "./fr-metadata-contract.js"

type Partition = { start: string; end: string; type: (typeof frDocumentTypes)[number] | null }
type MetadataReader = (url: string) => Promise<FrPageEvidence>

function canonicalQuery(url: URL) {
  return JSON.stringify(
    [...url.searchParams]
      .filter(([key]) => !["format", "page", "search_after_cursor"].includes(key))
      .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv))
  )
}
export function validateFrMetadataUrl(input: string, initial?: string, nextPage?: number) {
  const url = new URL(input)
  invariant(
    url.protocol === "https:" &&
      url.hostname === "www.federalregister.gov" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      ["/api/v1/documents.json", "/api/v1/documents"].includes(url.pathname),
    "unsafe_metadata_url"
  )
  const allowed = new Set([
    "conditions[publication_date][gte]",
    "conditions[publication_date][lte]",
    "conditions[type][]",
    "fields[]",
    "per_page",
    "order",
    "page",
    "format",
    "search_after_cursor"
  ])
  for (const key of url.searchParams.keys()) {
    invariant(allowed.has(key), "unexpected_metadata_query")
  }
  for (const key of [...allowed].filter((key) => !["conditions[type][]", "fields[]"].includes(key))) {
    invariant(url.searchParams.getAll(key).length <= 1, "duplicate_metadata_query")
  }
  invariant(!url.searchParams.has("format") || url.searchParams.get("format") === "json", "unexpected_metadata_format")
  invariant((url.searchParams.get("search_after_cursor")?.length ?? 0) <= 4096, "metadata_cursor_limit")
  if (initial !== undefined) {
    invariant(canonicalQuery(url) === canonicalQuery(new URL(initial)), "metadata_pagination_scope_changed")
  }
  if (nextPage !== undefined) {
    invariant(url.searchParams.get("page") === String(nextPage), "metadata_page_sequence_changed")
  }
  return url
}

function partitionUrl(partition: Partition, pageSize: number) {
  const url = new URL("https://www.federalregister.gov/api/v1/documents.json")
  url.searchParams.set("conditions[publication_date][gte]", partition.start)
  url.searchParams.set("conditions[publication_date][lte]", partition.end)
  if (partition.type !== null) {
    url.searchParams.append("conditions[type][]", partition.type)
  }
  url.searchParams.set("per_page", String(pageSize))
  url.searchParams.set("order", "oldest")
  frMetadataFields.forEach((field) => url.searchParams.append("fields[]", field))
  return url.href
}

/** One frozen observation directory. Stored pages are immutable and can resume a failed collection without refetching. */
export function createFrMetadataReader(
  directory: string,
  options: { fetch?: typeof fetch; minimumIntervalMs?: number; beforeAttempt?: () => Promise<void> } = {}
): MetadataReader {
  const http = new RetryingHttpClient({
    fetch: options.fetch,
    minimumIntervalMs: options.minimumIntervalMs ?? 500,
    beforeAttempt: options.beforeAttempt,
    maxAttempts: 1,
    requestTimeoutMs: 30_000
  })
  return async (input) => {
    const url = validateFrMetadataUrl(input)
    await mkdir(join(directory, "pages"), { recursive: true })
    const path = join(directory, "pages", `${digest(input)}.json`)
    try {
      const stat = await lstat(path)
      invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32 * 1024 * 1024, "invalid_metadata_cache_file")
      const saved = validateFrPageEvidence(JSON.parse(await readFile(path, "utf8")))
      invariant(saved.url === input, "metadata_cache_url_mismatch")
      return saved
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error
      }
    }
    const response = await http.get(
      url,
      { redirect: "error", headers: { accept: "application/json" }, signal: AbortSignal.timeout(60_000) },
      { streamBody: true }
    )
    const contentType = response.headers.get("content-type") ?? ""
    if (response.status !== 200 || !contentType.toLowerCase().includes("json")) {
      await response.body?.cancel()
      throw new Error("metadata_response_not_json")
    }
    const bytes = await readBounded(response, 8 * 1024 * 1024)
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const evidence = validateFrPageEvidence({
      url: input,
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      body,
      retrievedAt: new Date().toISOString(),
      contentType
    })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(evidence), { flag: "wx" })
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
    return evidence
  }
}

export async function collectFrMetadata(
  input: unknown,
  read: MetadataReader,
  options: {
    pageSize?: number
    saturationLimit?: number
    maximumRequests?: number
  } = {}
): Promise<FrMetadataManifest> {
  const scope = frMetadataScopeSchema.parse(input)
  const pageSize = z
    .int()
    .min(1)
    .max(1000)
    .parse(options.pageSize ?? 200)
  const saturationLimit = z
    .int()
    .min(2)
    .max(10000)
    .parse(options.saturationLimit ?? 10000)
  const maximumRequests = z
    .int()
    .min(1)
    .max(1000)
    .parse(options.maximumRequests ?? 200)
  const pages: FrPageEvidence[] = []
  const partitions: FrMetadataManifest["partitions"] = []
  const records: FrMetadataManifest["records"] = []
  const visited = new Set<string>()
  const documentNumbers = new Set<string>()
  let bodyBytes = 0
  const get = async (url: string) => {
    validateFrMetadataUrl(url)
    invariant(!visited.has(url), "metadata_pagination_cycle")
    invariant(pages.length < maximumRequests, "metadata_request_budget_exhausted")
    visited.add(url)
    const evidence = validateFrPageEvidence(await read(url))
    invariant(evidence.url === url, "metadata_evidence_url_mismatch")
    bodyBytes += evidence.bytes
    invariant(bodyBytes <= 64 * 1024 * 1024, "metadata_manifest_byte_limit")
    pages.push(evidence)
    return { evidence, page: frMetadataPageSchema.parse(JSON.parse(evidence.body)) }
  }
  const visit = async (partition: Partition): Promise<void> => {
    const initial = partitionUrl(partition, pageSize)
    const first = await get(initial)
    const pageHashes = [first.evidence.sha256]
    const count = first.page.count
    if (count >= saturationLimit) {
      partitions.push({ ...partition, state: "split", reportedCount: count, records: 0, pageHashes })
      if (partition.start !== partition.end) {
        for (let time = Date.parse(partition.start); time <= Date.parse(partition.end); time += 86_400_000) {
          const day = new Date(time).toISOString().slice(0, 10)
          await visit({ start: day, end: day, type: partition.type })
        }
      } else if (partition.type === null) {
        for (const type of frDocumentTypes) {
          await visit({ ...partition, type })
        }
      } else {
        throw new Error("metadata_partition_saturated")
      }
      return
    }
    invariant(first.page.total_pages === Math.ceil(count / pageSize), "metadata_page_total_mismatch")
    let page = first.page
    let pageNumber = 1
    let observed = 0
    while (true) {
      invariant(page.count === count && page.total_pages === first.page.total_pages, "metadata_inventory_changed")
      invariant(
        page.results.length <= pageSize && (count === 0 || page.results.length > 0),
        "metadata_empty_or_oversized_page"
      )
      for (const record of page.results) {
        invariant(
          record.publication_date >= partition.start &&
            record.publication_date <= partition.end &&
            (partition.type === null || record.type === frTypeNames[partition.type]),
          "metadata_record_outside_partition"
        )
        const number = normalizeFrDocumentNumber(record.document_number)
        invariant(!documentNumbers.has(number), "duplicate_metadata_document")
        documentNumbers.add(number)
        records.push(record)
        observed++
        invariant(records.length <= 50000, "metadata_record_budget_exhausted")
      }
      if (!page.next_page_url) {
        break
      }
      invariant(pageNumber < first.page.total_pages, "metadata_unexpected_next_page")
      const next = validateFrMetadataUrl(page.next_page_url, initial, pageNumber + 1).href
      const fetched = await get(next)
      page = fetched.page
      pageNumber++
      pageHashes.push(fetched.evidence.sha256)
    }
    invariant(observed === count && pageNumber === Math.max(1, first.page.total_pages), "metadata_partition_incomplete")
    partitions.push({ ...partition, state: "complete", reportedCount: count, records: observed, pageHashes })
  }
  await visit({ start: scope.start, end: scope.end, type: null })
  records.sort(
    (a, b) => a.publication_date.localeCompare(b.publication_date) || a.document_number.localeCompare(b.document_number)
  )
  const id = digest(
    JSON.stringify([
      frMetadataContract,
      scope,
      pageSize,
      saturationLimit,
      pages.map((p) => [p.url, p.sha256]),
      partitions,
      records
    ])
  )
  return {
    contract: frMetadataContract,
    id,
    scope,
    pageSize,
    saturationLimit,
    pages,
    partitions,
    records,
    status: "metadata_complete",
    canonicalWrites: false,
    recurringIngestionEnabled: false
  }
}

export async function replayFrMetadata(value: unknown) {
  const saved = frMetadataManifestSchema.parse(value)
  const byUrl = new Map(saved.pages.map((page) => [page.url, page]))
  invariant(byUrl.size === saved.pages.length, "duplicate_metadata_evidence")
  const replay = await collectFrMetadata(
    saved.scope,
    async (url) => {
      const page = byUrl.get(url)
      invariant(page, "missing_metadata_replay_page")
      return page
    },
    { pageSize: saved.pageSize, saturationLimit: saved.saturationLimit, maximumRequests: 1000 }
  )
  invariant(JSON.stringify(replay) === JSON.stringify(saved), "metadata_manifest_replay_mismatch")
  return replay
}

export async function collectFrMetadataToDirectory(
  directory: string,
  scope: FrMetadataScope,
  options: {
    pageSize?: number
    maximumRequests?: number
  } = {}
) {
  await mkdir(directory, { recursive: true })
  const lockPath = join(directory, "metadata.lock")
  const lock = await open(lockPath, "wx")
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, scope }))
    const manifest = await collectFrMetadata(scope, createFrMetadataReader(directory), options)
    const temporary = join(directory, `manifest-${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, JSON.stringify(manifest, null, 2), { flag: "wx" })
      await link(temporary, join(directory, "manifest.json"))
    } finally {
      await rm(temporary, { force: true })
    }
    return manifest
  } finally {
    await lock.close()
    await rm(lockPath)
  }
}
