import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { afterEach, expect, it, vi } from "vitest"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { cacheRegulatoryInventoryEvidence, createCachedRegulatoryInventoryReader } from "./inventory-evidence-cache.js"

const directories: string[] = []
afterEach(async () => Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))))

function evidence(url: string, retrievedAt = "2026-09-17T12:00:00.000Z", body = JSON.stringify({ files: [] })) {
  return {
    sourceId: "govinfo-cfr" as const,
    url,
    sha256: digest(body),
    bytes: Buffer.byteLength(body),
    retrievedAt,
    contentType: "application/json",
    body
  }
}

it("retains one complete inventory response and reuses it without another request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tabra-inventory-cache-"))
  directories.push(directory)
  const url = "https://www.govinfo.gov/bulkdata/json/CFR/2025/"
  const fetchEvidence = vi.fn(async () => evidence(url))
  const first = await cacheRegulatoryInventoryEvidence(directory, "govinfo-cfr", url, fetchEvidence)
  const replay = await cacheRegulatoryInventoryEvidence(directory, "govinfo-cfr", url, fetchEvidence)
  expect(first).toMatchObject({ reused: false, evidence: evidence(url) })
  expect(replay).toEqual({ ...first, reused: true })
  expect(fetchEvidence).toHaveBeenCalledOnce()
})

it("resumes a bounded annual inventory plan from the last retained official listing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tabra-inventory-cache-"))
  directories.push(directory)
  const yearUrl = "https://www.govinfo.gov/bulkdata/json/CFR/2025/"
  const titleUrl = "https://www.govinfo.gov/bulkdata/json/CFR/2025/title-1/"
  const bodies = new Map([
    [
      yearUrl,
      JSON.stringify({
        files: [
          {
            name: "title-1",
            link: "https://www.govinfo.gov/bulkdata/json/CFR/2025/title-1",
            folder: true
          }
        ]
      })
    ],
    [
      titleUrl,
      JSON.stringify({
        files: [
          {
            name: "CFR-2025-title1-vol1.xml",
            link: "https://www.govinfo.gov/bulkdata/CFR/2025/title-1/CFR-2025-title1-vol1.xml",
            folder: false,
            size: 123
          }
        ]
      })
    ]
  ])
  const fetchEvidence = vi.fn(async (_source: "ecfr" | "govinfo-fr" | "govinfo-cfr", url: string) => {
    const body = bodies.get(url)
    if (body === undefined) throw new Error("unexpected_inventory_request")
    return evidence(url, "2026-09-17T12:00:00.000Z", body)
  })
  const scope = {
    cutoff: "2025-12-31",
    ecfrTitles: [],
    federalRegister: null,
    annualCfr: { years: [2025], titles: [1] }
  }
  const first = createCachedRegulatoryInventoryReader({ directory, maximumRequests: 1, fetchEvidence })
  await expect(planRegulatoryBackfill(scope, first.read)).rejects.toThrow("inventory_request_limit_reached")
  expect(first.stats()).toEqual({ maximumRequests: 1, requested: 1, reused: 0 })
  const resumed = createCachedRegulatoryInventoryReader({ directory, maximumRequests: 1, fetchEvidence })
  const manifest = await planRegulatoryBackfill(scope, resumed.read)
  expect(manifest.units).toHaveLength(1)
  expect(manifest.units[0]?.nativeId).toBe("CFR-2025-title1-vol1")
  expect(resumed.stats()).toEqual({ maximumRequests: 1, requested: 1, reused: 1 })
  expect(fetchEvidence).toHaveBeenCalledTimes(2)
})

it("rejects damaged retained evidence instead of silently refetching it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tabra-inventory-cache-"))
  directories.push(directory)
  const url = "https://www.govinfo.gov/bulkdata/json/CFR/2025/"
  const retained = await cacheRegulatoryInventoryEvidence(directory, "govinfo-cfr", url, async () => evidence(url))
  const damaged = JSON.parse(await readFile(retained.path, "utf8"))
  damaged.body = JSON.stringify({ files: ["changed"] })
  await writeFile(retained.path, JSON.stringify(damaged))
  await expect(
    cacheRegulatoryInventoryEvidence(directory, "govinfo-cfr", url, async () =>
      evidence(url, "2026-09-17T13:00:00.000Z")
    )
  ).rejects.toThrow("inventory_evidence_content_mismatch")
})

it("rejects a response for a different official request identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tabra-inventory-cache-"))
  directories.push(directory)
  const url = "https://www.govinfo.gov/bulkdata/json/CFR/2025/"
  await expect(
    cacheRegulatoryInventoryEvidence(directory, "govinfo-cfr", url, async () =>
      evidence("https://www.govinfo.gov/bulkdata/json/CFR/2024/")
    )
  ).rejects.toThrow("inventory_evidence_identity_mismatch")
})
