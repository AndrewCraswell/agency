import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { parserLimits, regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"
import { replayRegulatoryParserBatch } from "./parser-replay.js"

const roots: string[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture(titles = [1]) {
  const root = await mkdtemp(join(tmpdir(), "rostra-parser-replay-"))
  roots.push(root)
  const manifest = await planRegulatoryBackfill(
    { cutoff: "2026-09-14", ecfrTitles: titles, federalRegister: null, annualCfr: null },
    async (sourceId, url) => {
      const body = JSON.stringify({
        titles: Array.from({ length: 50 }, (_, index) => ({
          number: index + 1,
          name: `Title ${index + 1}`,
          reserved: index === 34,
          latest_issue_date: "2026-09-10",
          latest_amended_on: "2026-09-10",
          up_to_date_as_of: "2026-09-14"
        })),
        meta: { date: "2026-09-14", import_in_progress: false }
      })
      return {
        sourceId,
        url,
        body,
        bytes: Buffer.byteLength(body),
        sha256: digest(body),
        retrievedAt: "2026-09-15T00:00:00Z",
        contentType: "application/json"
      }
    }
  )
  const rawDirectory = join(root, "raw")
  const normalizedDirectory = join(root, "retained")
  await mkdir(join(rawDirectory, "units"), { recursive: true })
  await mkdir(join(rawDirectory, "blobs"), { recursive: true })
  const data = []
  for (const unit of manifest.units) {
    const number = unit.nativeId.replace("title-", "")
    const xml = `<ECFR><DIV1 N="${number}" TYPE="TITLE"><HEAD>Title ${number}</HEAD><DIV8 N="${number}.1" TYPE="SECTION"><P>Retained evidence.</P></DIV8></DIV1></ECFR>`
    const artifactHash = digest(xml)
    const path = join(rawDirectory, "blobs", `${artifactHash}.xml`)
    await writeFile(path, xml)
    await writeFile(
      join(rawDirectory, "units", `${unit.key}.json`),
      JSON.stringify({
        unit,
        sha256: artifactHash,
        bytes: Buffer.byteLength(xml),
        acquiredAt: "2026-09-15T00:00:00Z",
        contentType: "application/xml",
        etag: null,
        lastModified: null,
        stage: "acquired",
        parseValidated: false
      })
    )
    const parsed = await parseRegulatoryArtifact({
      unit,
      artifactHash,
      path,
      outputRoot: join(root, "fixture-generation")
    })
    const parserCodeHash = digest("retained parser fixture")
    const generation = digest(
      JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, artifactHash, parserLimits])
    )
    const directory = join(normalizedDirectory, generation)
    await cp(parsed.directory, directory, { recursive: true })
    const summary = { ...parsed.summary, parserCodeHash }
    await writeFile(join(directory, "summary.json"), JSON.stringify(summary))
    data.push({ unit, path, xml, directory, summary })
  }
  return {
    root,
    data,
    input: { manifest, locations: [{ rawDirectory, normalizedDirectory }], outputRoot: join(root, "current") }
  }
}

describe("bounded retained parser replay", { timeout: 30_000 }, () => {
  // Real parsing plus repeated retained-output validation can exceed five seconds under full coverage.
  it(
    "replays identical bytes offline and revalidates existing current output on retry",
    { timeout: 30_000 },
    async () => {
      const { input } = await fixture()
      const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("Network forbidden"))
      vi.stubGlobal("fetch", fetch)
      const first = await replayRegulatoryParserBatch(input)
      expect(first).toMatchObject({
        exhausted: true,
        reviewRequired: false,
        failures: [],
        canonicalWrites: false,
        publicationReady: false,
        networkRequests: 0
      })
      expect(first.results[0]).toMatchObject({
        reused: false,
        records: 2,
        disposition: "identical",
        comparisons: [expect.objectContaining({ identical: true, changedFields: [] })]
      })
      const retry = await replayRegulatoryParserBatch(input)
      expect(retry.results[0]).toMatchObject({ reused: true, disposition: "identical" })
      expect(retry.results[0]?.comparisons).toEqual(first.results[0]?.comparisons)
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it(
    "requires review when source-date evidence differs even with identical record shards",
    { timeout: 30_000 },
    async () => {
      const { input, data } = await fixture()
      const previous = data[0]
      invariant(previous, "Expected fixture")
      await writeFile(
        join(previous.directory, "summary.json"),
        JSON.stringify({
          ...previous.summary,
          warnings: [{ code: "source_date_mismatch", sourceLocator: "/ECFR", detail: "Fixture discrepancy" }]
        })
      )
      const result = await replayRegulatoryParserBatch(input)
      expect(result).toMatchObject({ exhausted: true, reviewRequired: true, failures: [] })
      expect(result.results[0]).toMatchObject({
        disposition: "review_required",
        comparisons: [expect.objectContaining({ changedFields: ["warnings"], identical: false })]
      })
    }
  )
  // Four real Python parses plus file validation need headroom during repository-wide coverage.
  it(
    "does not advance past a damaged title and resumes from the last completed unit",
    { timeout: 30_000 },
    async () => {
      const { input, data } = await fixture([1, 2])
      const second = data[1]
      invariant(second, "Expected second fixture")
      await writeFile(second.path, "damaged")
      const partial = await replayRegulatoryParserBatch(input)
      expect(partial.results).toHaveLength(1)
      expect(partial.failures).toHaveLength(1)
      expect(partial.exhausted).toBe(false)
      expect(partial.nextUnitKey).toBe(data[0]?.unit.key)
      await writeFile(second.path, second.xml)
      invariant(partial.nextUnitKey, "Expected continuation")
      const resumed = await replayRegulatoryParserBatch({ ...input, afterUnitKey: partial.nextUnitKey })
      expect(resumed).toMatchObject({ exhausted: true, reviewRequired: false, failures: [] })
      expect(resumed.results.map((result) => result.unitKey)).toEqual([second.unit.key])
    }
  )
  it("rejects an invalid cursor or oversized batch and allows an empty terminal continuation", async () => {
    const { input, data } = await fixture()
    await expect(replayRegulatoryParserBatch({ ...input, afterUnitKey: digest("unknown") })).rejects.toThrow(
      "cursor does not belong"
    )
    await expect(replayRegulatoryParserBatch({ ...input, limit: 6 })).rejects.toThrow(Error)
    const terminal = await replayRegulatoryParserBatch({ ...input, afterUnitKey: data[0]?.unit.key })
    expect(terminal).toMatchObject({ selectedUnits: 0, results: [], failures: [], exhausted: true })
  })
  it("refuses a corrupted retained shard rather than establishing parity from counts alone", async () => {
    const { input, data } = await fixture()
    const previous = data[0]
    invariant(previous, "Expected fixture")
    const shard = previous.summary.shards[0]
    invariant(shard, "Expected shard")
    const path = join(previous.directory, shard.file)
    await writeFile(path, (await readFile(path, "utf8")).replace("Retained evidence", "Altered evidence"))
    const result = await replayRegulatoryParserBatch(input)
    expect(result).toMatchObject({
      results: [],
      exhausted: false,
      nextUnitKey: null,
      failures: [expect.objectContaining({ error: "Parser replay requires verified, unambiguous retained inputs" })]
    })
  })
})
