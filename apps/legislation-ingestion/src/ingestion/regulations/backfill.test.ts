import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  canonicalScope,
  digest,
  officialUrl,
  validateManifest,
  type AcquisitionUnit,
  type InventoryEvidence
} from "@repo/legislation-core/legal-text/contracts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { acquireRegulatoryBackfill } from "./artifact-backfill.js"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { RegulatorySourceClient } from "./source-client.js"

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function outputDirectory() {
  const path = await mkdtemp(join(tmpdir(), "rostra-regulatory-test-"))
  directories.push(path)
  return path
}

// Fault/contract fixture, deliberately synthetic. Live evidence is retained by the planner separately.
function titles() {
  return {
    titles: Array.from({ length: 50 }, (_, i) => ({
      number: i + 1,
      name: `Synthetic title ${i + 1}`,
      latest_issue_date: i === 34 ? null : "2024-01-02",
      latest_amended_on: i === 34 ? null : "2023-11-30",
      up_to_date_as_of: i === 34 ? null : "2024-02-01",
      reserved: i === 34
    })),
    meta: { date: "2024-02-01", import_in_progress: false }
  }
}
function evidence(sourceId: AcquisitionUnit["sourceId"], url: string, value: unknown): InventoryEvidence {
  const body = JSON.stringify(value)
  return {
    sourceId,
    url,
    body,
    sha256: digest(body),
    bytes: Buffer.byteLength(body),
    contentType: "application/json",
    retrievedAt: "2026-09-14T00:00:00Z"
  }
}
const ecfrScope = { cutoff: "2024-02-01", ecfrTitles: [1, 35], federalRegister: null, annualCfr: null }
async function ecfrPlan(selected = [1]) {
  return planRegulatoryBackfill({ ...ecfrScope, ecfrTitles: selected }, async (source, url) =>
    evidence(source, url, titles())
  )
}
function xmlClient(body: string, contentType = "application/xml") {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { headers: { "content-type": contentType } }))
  return { client: new RegulatorySourceClient({ fetch: fetcher, minimumIntervalMs: 0 }), fetcher }
}

describe("regulatory backfill inventory", () => {
  it("freezes edition and currency independently and replays the same inventory deterministically", async () => {
    const manifest = await ecfrPlan([35, 1, 1])
    expect(manifest.units).toHaveLength(1)
    expect(manifest.units[0]).toMatchObject({
      nativeId: "title-1",
      issueDate: "2024-01-02",
      currencyDate: "2024-02-01",
      sourceUrl: "https://www.ecfr.gov/api/versioner/v1/full/2024-01-02/title-1.xml"
    })
    expect(manifest.exclusions).toEqual([{ sourceId: "ecfr", nativeId: "title-35", reason: "reserved_title" }])
    const replayed = await planRegulatoryBackfill(manifest.scope, async (source, url) => {
      const item = manifest.inventory.find((entry) => entry.sourceId === source && entry.url === url)
      if (item === undefined) {
        throw new Error("Missing fixture")
      }
      return item
    })
    expect(replayed).toEqual(manifest)
    expect(canonicalScope(ecfrScope).cutoff).toBe("2024-02-01")
    expect(() => validateManifest({ ...manifest, id: "0".repeat(64) })).toThrow("identity")
    expect(() => validateManifest({ ...manifest, unexpected: true })).toThrow("Unrecognized key")
  })

  it.each(["importing", "duplicate", "missing", "future", "missing_currency"])(
    "fails closed for %s eCFR inventories",
    async (fault) => {
      const data = titles()
      if (fault === "importing") {
        data.meta.import_in_progress = true
      }
      if (fault === "duplicate") {
        data.titles[1]!.number = 1
      }
      if (fault === "missing") {
        data.titles.pop()
      }
      if (fault === "future") {
        data.titles[0]!.latest_issue_date = "2024-02-02"
      }
      if (fault === "missing_currency") {
        data.titles[0]!.up_to_date_as_of = null
      }
      await expect(
        planRegulatoryBackfill(ecfrScope, async (source, url) => evidence(source, url, data))
      ).rejects.toThrow(/eCFR|Too small/)
    }
  )

  it("rejects unsupported history and empty scopes before requesting a source", async () => {
    const read = vi.fn<(source: AcquisitionUnit["sourceId"], url: string) => Promise<InventoryEvidence>>()
    await expect(
      planRegulatoryBackfill({ ...ecfrScope, federalRegister: { start: "1994-01-01", end: "2000-01-01" } }, read)
    ).rejects.toThrow("2000+")
    await expect(planRegulatoryBackfill({ ...ecfrScope, ecfrTitles: [] }, read)).rejects.toThrow("Select")
    await expect(planRegulatoryBackfill({ ...ecfrScope, cutoff: "2024-02-30" }, read)).rejects.toThrow(
      "Invalid ISO date"
    )
    expect(read).not.toHaveBeenCalled()
  })

  it("uses returned monthly issue links, retains genuine empty inventories, and never guesses weekend issues", async () => {
    const read = vi.fn<(source: AcquisitionUnit["sourceId"], url: string) => Promise<InventoryEvidence>>(
      async (source, url) =>
        evidence(source, url, {
          files: url.includes("/01/")
            ? [
                {
                  name: "FR-2024-01-02.xml",
                  folder: false,
                  link: "https://www.govinfo.gov/bulkdata/FR/2024/01/FR-2024-01-02.xml",
                  size: 100
                },
                {
                  name: "FR-2024-01.zip",
                  folder: false,
                  link: "https://www.govinfo.gov/bulkdata/FR/2024/01/FR-2024-01.zip",
                  size: 80
                }
              ]
            : []
        })
    )
    const manifest = await planRegulatoryBackfill(
      { ...ecfrScope, ecfrTitles: [], federalRegister: { start: "2024-01-01", end: "2024-02-01" } },
      read
    )
    expect(read).toHaveBeenCalledTimes(2)
    expect(manifest.units).toHaveLength(1)
    expect(manifest.estimatedKnownBytes).toBe(100)
    expect(manifest.inventory.every((item) => item.url.endsWith("/"))).toBe(true)
  })

  it("discovers all annual CFR volumes and does not fabricate January issue dates", async () => {
    const scope = { ...ecfrScope, ecfrTitles: [], annualCfr: { years: [2023], titles: [1] } }
    const manifest = await planRegulatoryBackfill(scope, async (source, url) =>
      evidence(source, url, {
        files: url.endsWith("/2023/")
          ? [{ name: "title-1", folder: true, link: "https://www.govinfo.gov/bulkdata/json/CFR/2023/title-1" }]
          : [1, 2].map((volume) => ({
              name: `CFR-2023-title1-vol${volume}.xml`,
              folder: false,
              link: `https://www.govinfo.gov/bulkdata/CFR/2023/title-1/CFR-2023-title1-vol${volume}.xml`,
              size: 100
            }))
      })
    )
    expect(manifest.units).toHaveLength(2)
    expect(manifest.units.map((unit) => unit.issueDate)).toEqual([null, null])
    await expect(
      planRegulatoryBackfill(scope, async (source, url) => evidence(source, url, { files: [] }))
    ).rejects.toThrow("not listed")
  })

  it("rejects alternate hosts, credentials, and arbitrary source paths", () => {
    for (const url of [
      "https://evil.test/bulkdata/x",
      "http://www.govinfo.gov/bulkdata/x",
      "https://user@www.govinfo.gov/bulkdata/x",
      "https://www.govinfo.gov/private",
      "https://www.govinfo.gov/bulkdata/x?api_key=secret"
    ]) {
      expect(() => officialUrl(url, "govinfo-fr")).toThrow("Unexpected regulatory source")
    }
  })
})

describe("regulatory raw acquisition", () => {
  it("returns a live body without buffering the title before byte limits can apply", async () => {
    let pulls = 0
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulls++
              controller.enqueue(new TextEncoder().encode("<DLPSTEXTCLASS>chunk</DLPSTEXTCLASS>"))
              if (pulls === 10) {
                controller.close()
              }
            }
          }),
          { headers: { "content-type": "application/xml" } }
        )
    )
    const client = new RegulatorySourceClient({ fetch: fetcher, minimumIntervalMs: 0 })
    const response = await client.response(
      "ecfr",
      "https://www.ecfr.gov/api/versioner/v1/full/2024-01-02/title-1.xml",
      "application/xml"
    )
    expect(pulls).toBeLessThan(10)
    await response.body?.cancel()
  })

  it("does not publish a receipt after a stream breaks partway through a title", async () => {
    const manifest = await ecfrPlan()
    const output = await outputDirectory()
    let pulls = 0
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (pulls++ === 0) {
                controller.enqueue(new TextEncoder().encode("<DLPSTEXTCLASS>"))
              } else {
                controller.error(new Error("connection interrupted"))
              }
            }
          }),
          { headers: { "content-type": "application/xml" } }
        )
    )
    const client = new RegulatorySourceClient({ fetch: fetcher, minimumIntervalMs: 0 })
    const report = await acquireRegulatoryBackfill(manifest, output, { client, limit: 1 })
    expect(report.failures[0]?.error).toBe("connection interrupted")
    expect(await readdir(join(output, "units"))).toEqual([])
    expect(await readdir(join(output, "temporary"))).toEqual([])
  })

  it("rejects source bytes that no longer match the frozen listing", async () => {
    const manifest = await planRegulatoryBackfill(
      { ...ecfrScope, ecfrTitles: [], federalRegister: { start: "2024-01-02", end: "2024-01-02" } },
      async (source, url) =>
        evidence(source, url, {
          files: [
            {
              name: "FR-2024-01-02.xml",
              folder: false,
              link: "https://www.govinfo.gov/bulkdata/FR/2024/01/FR-2024-01-02.xml",
              size: 100
            }
          ]
        })
    )
    const output = await outputDirectory()
    const { client } = xmlClient("<FEDREG>changed</FEDREG>")
    const report = await acquireRegulatoryBackfill(manifest, output, { client, limit: 1 })
    expect(report.failures[0]?.error).toContain("changed since discovery")
    expect(await readdir(join(output, "units"))).toEqual([])
  })

  it("resumes only complete, checksum-verified units and distinguishes raw from published coverage", async () => {
    const manifest = await ecfrPlan([1, 2])
    const output = await outputDirectory()
    const { client, fetcher } = xmlClient('<?xml version="1.0"?><DLPSTEXTCLASS><DIV1>sample</DIV1></DLPSTEXTCLASS>')
    const first = await acquireRegulatoryBackfill(manifest, output, { limit: 1, client })
    expect(first).toMatchObject({
      expected: 2,
      pending: 1,
      status: "partial",
      parsed: 0,
      published: 0,
      recurringIngestionEnabled: false
    })
    const second = await acquireRegulatoryBackfill(manifest, output, { limit: 1, client })
    expect(second).toMatchObject({ expected: 2, pending: 0, status: "acquired" })
    expect(second.acquired.map((item) => item.reused)).toEqual([true, false])
    await acquireRegulatoryBackfill(manifest, output, { limit: 1, client })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" })
    expect(await readdir(join(output, "temporary"))).toEqual([])
  })

  it.each([
    { body: "<html>service error</html>", contentType: "text/html", maximumBytes: 100 },
    { body: "<html>service error</html>", contentType: "application/xml", maximumBytes: 100 },
    { body: "<DLPSTEXTCLASS>too large</DLPSTEXTCLASS>", contentType: "application/xml", maximumBytes: 10 }
  ])(
    "does not checkpoint invalid/oversized XML ($contentType, $maximumBytes)",
    async ({ body, contentType, maximumBytes }) => {
      const manifest = await ecfrPlan()
      const output = await outputDirectory()
      const { client } = xmlClient(body, contentType)
      const report = await acquireRegulatoryBackfill(manifest, output, { client, limit: 1, maximumBytes })
      expect(report.failures).toHaveLength(1)
      expect(report.acquired).toEqual([])
      expect(await readdir(join(output, "units"))).toEqual([])
      expect(await readdir(join(output, "temporary"))).toEqual([])
    }
  )

  it("detects corrupted retained bytes rather than treating the checkpoint as proof", async () => {
    const manifest = await ecfrPlan()
    const output = await outputDirectory()
    const { client, fetcher } = xmlClient("<DLPSTEXTCLASS>valid</DLPSTEXTCLASS>")
    const initial = await acquireRegulatoryBackfill(manifest, output, { client, limit: 1 })
    const receipt = initial.acquired[0]
    expect(receipt).toBeDefined()
    if (receipt === undefined) {
      throw new Error("Missing receipt")
    }
    await writeFile(join(output, "blobs", `${receipt.sha256}.xml`), "corrupt")
    const replay = await acquireRegulatoryBackfill(manifest, output, { client, limit: 1 })
    expect(replay.failures[0]?.error).toContain("checksum mismatch")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("refuses to overlap an active local writer", async () => {
    const manifest = await ecfrPlan()
    const output = await outputDirectory()
    await writeFile(join(output, "acquisition.lock"), "owned by another process")
    await expect(acquireRegulatoryBackfill(manifest, output, { limit: 1 })).rejects.toThrow("EEXIST")
    expect(await readFile(join(output, "acquisition.lock"), "utf8")).toBe("owned by another process")
  })

  it("rejects an HTTP 200 HTML inventory instead of claiming zero files", async () => {
    const { client } = xmlClient("<html>Govinfo Bulkdata Service Error</html>", "text/html")
    await expect(client.inventory("govinfo-fr", "https://www.govinfo.gov/bulkdata/json/FR/2024/01/")).rejects.toThrow(
      "JSON"
    )
  })
})
