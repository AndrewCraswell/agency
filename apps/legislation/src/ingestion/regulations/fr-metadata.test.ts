import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { digest } from "./contracts.js"
import {
  frMetadataPageSchema,
  frTypeNames,
  normalizeFrDocumentNumber,
  type FrPageEvidence
} from "./fr-metadata-contract.js"
import {
  collectFrMetadata,
  collectFrMetadataToDirectory,
  createFrMetadataReader,
  replayFrMetadata,
  validateFrMetadataUrl
} from "./fr-metadata.js"

const scope = { start: "2024-01-02", end: "2024-01-02", cutoff: "2026-09-14" }
const fixtureBody = await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8")
const fixture = frMetadataPageSchema.parse(JSON.parse(fixtureBody))
const provenance = z
  .object({ sha256: z.string(), url: z.url() })
  .parse(
    JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata-provenance.json", import.meta.url), "utf8"))
  )
const directories: string[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})
function evidence(url: string, page: unknown): FrPageEvidence {
  const body = JSON.stringify(page)
  return {
    url,
    sha256: digest(body),
    bytes: Buffer.byteLength(body),
    body,
    retrievedAt: "2026-09-14T00:00:00Z",
    contentType: "application/json"
  }
}
function nextUrl(initial: string, page: number) {
  const url = new URL(initial)
  url.pathname = "/api/v1/documents"
  url.searchParams.set("format", "json")
  url.searchParams.set("page", String(page))
  url.searchParams.set("search_after_cursor", `opaque-cursor-${page}`)
  return url.href
}

describe("Federal Register metadata inventories", () => {
  it("retains a real complete day, correction prefixes and source date assertions", async () => {
    expect(digest(fixtureBody)).toBe(provenance.sha256)
    const result = await collectFrMetadata(scope, async (url) => evidence(url, fixture), { pageSize: 1000 })
    expect(result.records).toHaveLength(65)
    expect(result.records.find((row) => row.document_number === "C1-2023-27742")).toMatchObject({
      correction_of: "https://www.federalregister.gov/api/v1/documents/2023-27742"
    })
    expect(result.records.find((row) => row.document_number === "2023-28892")).toMatchObject({
      publication_date: "2024-01-02",
      effective_on: "2023-12-28"
    })
    expect(await replayFrMetadata(result)).toEqual(result)
    expect(result).toMatchObject({
      status: "metadata_complete",
      canonicalWrites: false,
      recurringIngestionEnabled: false
    })
  })

  it("follows publisher cursors verbatim through all pages and replays offline", async () => {
    const requests: string[] = []
    const records = fixture.results.slice(0, 5)
    const result = await collectFrMetadata(
      scope,
      async (url) => {
        requests.push(url)
        const page = Number(new URL(url).searchParams.get("page") ?? 1)
        return evidence(url, {
          count: 5,
          total_pages: 3,
          results: records.slice((page - 1) * 2, page * 2),
          next_page_url: page < 3 ? nextUrl(requests[0] ?? url, page + 1) : null
        })
      },
      { pageSize: 2 }
    )
    expect(requests).toHaveLength(3)
    expect(new URL(requests[2] ?? "").searchParams.get("search_after_cursor")).toBe("opaque-cursor-3")
    expect(result.records).toHaveLength(5)
    expect(await replayFrMetadata(result)).toEqual(result)
  })

  it("splits a saturated date range into days without counting the discarded parent page", async () => {
    const base = fixture.results[0]
    invariant(base, "missing_fixture")
    const result = await collectFrMetadata(
      { ...scope, start: "2024-01-01" },
      async (url) => {
        const query = new URL(url).searchParams
        const start = query.get("conditions[publication_date][gte]")
        const end = query.get("conditions[publication_date][lte]")
        if (start !== end) {
          return evidence(url, { count: 2, total_pages: 1, results: [base], next_page_url: null })
        }
        return evidence(url, {
          count: 1,
          total_pages: 1,
          results: [{ ...base, document_number: start === "2024-01-01" ? "00-001" : "E9-123", publication_date: start }]
        })
      },
      { pageSize: 2, saturationLimit: 2 }
    )
    expect(result.partitions.map((p) => p.state)).toEqual(["split", "complete", "complete"])
    expect(result.records.map((r) => r.document_number)).toEqual(["00-001", "E9-123"])
    expect(await replayFrMetadata(result)).toEqual(result)
  })

  it("splits a saturated single day by type and retains presidential exclusions for later reconciliation", async () => {
    const base = fixture.results[0]
    invariant(base, "missing_fixture")
    const result = await collectFrMetadata(
      scope,
      async (url) => {
        const type = new URL(url).searchParams.get("conditions[type][]")
        if (!type) {
          return evidence(url, { count: 2, total_pages: 1, results: [base] })
        }
        const types = z.enum(["RULE", "PRORULE", "NOTICE", "PRESDOCU"]).parse(type)
        return evidence(url, {
          count: 1,
          total_pages: 1,
          results: [{ ...base, document_number: `2000-${types}`, type: frTypeNames[types] }]
        })
      },
      { pageSize: 2, saturationLimit: 2 }
    )
    expect(result.records).toHaveLength(4)
    expect(result.partitions).toHaveLength(5)
  })

  it("fails rather than truncating an indivisible saturated day/type partition", async () => {
    await expect(
      collectFrMetadata(
        scope,
        async (url) => evidence(url, { count: 2, total_pages: 1, results: fixture.results.slice(0, 2) }),
        { pageSize: 2, saturationLimit: 2 }
      )
    ).rejects.toThrow("metadata_partition_saturated")
  })

  it("accepts an evidenced empty day", async () => {
    const result = await collectFrMetadata(scope, async (url) =>
      evidence(url, { count: 0, total_pages: 0, results: [] })
    )
    expect(result.records).toEqual([])
    expect(result.partitions).toMatchObject([{ state: "complete", reportedCount: 0, records: 0 }])
  })

  it.each([
    "missing_next",
    "duplicate",
    "changed_count",
    "empty_page",
    "scope_change",
    "untrusted_host",
    "unexpected_next"
  ])("rejects incomplete or inconsistent pagination: %s", async (fault) => {
    const base = fixture.results.slice(0, 2)
    await expect(
      collectFrMetadata(
        scope,
        async (url) => {
          const page = Number(new URL(url).searchParams.get("page") ?? 1)
          let next: string | null = page === 1 ? nextUrl(url, 2) : null
          if (fault === "missing_next") {
            next = null
          }
          if (fault === "scope_change" && next) {
            const changed = new URL(next)
            changed.searchParams.set("conditions[publication_date][lte]", "2024-01-03")
            next = changed.href
          }
          if (fault === "untrusted_host" && next) {
            next = next.replace("www.federalregister.gov", "example.test")
          }
          if (fault === "unexpected_next" && page === 2) {
            next = nextUrl(url, 3)
          }
          let results = base.slice(page - 1, page)
          if (page === 2 && fault === "empty_page") {
            results = []
          } else if (fault === "duplicate") {
            results = base.slice(0, 1)
          }
          return evidence(url, {
            count: page === 2 && fault === "changed_count" ? 3 : 2,
            total_pages: 2,
            next_page_url: next,
            results
          })
        },
        { pageSize: 1 }
      )
    ).rejects.toThrow(/metadata|duplicate/)
  })

  it("rejects outside dates, unknown types, altered evidence and replay tampering", async () => {
    const base = fixture.results[0]
    invariant(base, "missing_fixture")
    await expect(
      collectFrMetadata(scope, async (url) =>
        evidence(url, { count: 1, total_pages: 1, results: [{ ...base, publication_date: "2024-02-01" }] })
      )
    ).rejects.toThrow("outside_partition")
    await expect(
      collectFrMetadata(scope, async (url) => ({ ...evidence(url, fixture), sha256: "0".repeat(64) }))
    ).rejects.toThrow("invalid_metadata_evidence")
    await expect(
      collectFrMetadata(scope, async (url) =>
        evidence(url, { count: 1, total_pages: 1, results: [{ ...base, type: "New Type" }] })
      )
    ).rejects.toThrow(/Invalid option/)
    const valid = await collectFrMetadata(scope, async (url) => evidence(url, fixture), { pageSize: 1000 })
    await expect(replayFrMetadata({ ...valid, records: [] })).rejects.toThrow("replay_mismatch")
    await expect(replayFrMetadata({ ...valid, pages: [] })).rejects.toThrow("missing_metadata_replay_page")
  })

  it("bounds requests and scope independently from provider totals", async () => {
    await expect(
      collectFrMetadata(
        scope,
        async (url) =>
          evidence(url, {
            count: 2,
            total_pages: 2,
            results: fixture.results.slice(0, 1),
            next_page_url: nextUrl(url, 2)
          }),
        { pageSize: 1, maximumRequests: 1 }
      )
    ).rejects.toThrow("request_budget_exhausted")
    await expect(
      collectFrMetadata({ ...scope, start: "2023-01-01" }, async (url) => evidence(url, fixture))
    ).rejects.toThrow("31 frozen days")
  })

  it("reuses immutable cached response evidence and refuses damaged cache files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tabra-fr-metadata-"))
    directories.push(directory)
    const request = vi.fn<typeof fetch>(async () => Response.json(fixture))
    const read = createFrMetadataReader(directory, { fetch: request, minimumIntervalMs: 0 })
    const url = provenance.url
    const first = await read(url)
    expect(await read(url)).toEqual(first)
    expect(request).toHaveBeenCalledTimes(1)
    await writeFile(
      join(directory, "pages", `${digest(url)}.json`),
      JSON.stringify({ ...first, sha256: "f".repeat(64) })
    )
    await expect(read(url)).rejects.toThrow("invalid_metadata_evidence")
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["html", 200, "text/html"],
    ["throttle", 429, "application/json"],
    ["server", 503, "application/json"]
  ])("retains failure semantics for %s responses", async (_kind, status, contentType) => {
    const directory = await mkdtemp(join(tmpdir(), "tabra-fr-http-"))
    directories.push(directory)
    const request = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: Number(status), headers: { "content-type": String(contentType) } })
    )
    await expect(
      createFrMetadataReader(directory, { fetch: request, minimumIntervalMs: 0 })(provenance.url)
    ).rejects.toThrow(/metadata_response_not_json|Provider request failed/)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it("resumes saved pages after a provider failure and commits only a complete manifest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tabra-fr-resume-"))
    directories.push(directory)
    const first = fixture.results[0]
    const second = fixture.results[1]
    invariant(first && second, "missing_fixture")
    let calls = 0
    const request = vi.fn<typeof fetch>(async (url) => {
      calls++
      if (calls === 1) {
        return Response.json({ count: 2, total_pages: 2, results: [first], next_page_url: nextUrl(String(url), 2) })
      }
      if (calls === 2) {
        return new Response("{}", { status: 503, headers: { "content-type": "application/json" } })
      }
      return Response.json({ count: 2, total_pages: 2, results: [second] })
    })
    vi.stubGlobal("fetch", request)
    await expect(collectFrMetadataToDirectory(directory, scope, { pageSize: 1 })).rejects.toThrow(
      "Provider request failed"
    )
    expect(await readdir(directory)).toEqual(["pages"])
    const completed = await collectFrMetadataToDirectory(directory, scope, { pageSize: 1 })
    expect(completed.records).toHaveLength(2)
    expect(request).toHaveBeenCalledTimes(3)
    const saved = await readFile(join(directory, "manifest.json"), "utf8")
    await expect(collectFrMetadataToDirectory(directory, scope, { pageSize: 1 })).rejects.toMatchObject({
      code: "EEXIST"
    })
    expect(await readFile(join(directory, "manifest.json"), "utf8")).toBe(saved)
    expect((await readdir(directory)).sort()).toEqual(["manifest.json", "pages"])
  })

  it("preserves older IDs and correction prefixes and denies unapproved URLs", () => {
    expect(["00-001", "E9-123", " c1-2023-27742 "].map(normalizeFrDocumentNumber)).toEqual([
      "00-001",
      "E9-123",
      "C1-2023-27742"
    ])
    expect(() => validateFrMetadataUrl("https://www.federalregister.gov/api/v1/documents.json?api_key=secret")).toThrow(
      "unexpected_metadata_query"
    )
    expect(() => validateFrMetadataUrl("https://www.federalregister.gov.evil.test/api/v1/documents.json")).toThrow(
      "unsafe_metadata_url"
    )
    expect(() => validateFrMetadataUrl("https://user:secret@www.federalregister.gov/api/v1/documents.json")).toThrow(
      "unsafe_metadata_url"
    )
  })
})
