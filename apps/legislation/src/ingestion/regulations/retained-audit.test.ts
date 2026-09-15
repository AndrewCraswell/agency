import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import invariant from "tiny-invariant"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { planRegulatoryBackfill } from "./backfill-plan.js"
import { digest, manifestIdentity } from "./contracts.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"
import { regulatoryRecordSchema } from "./parser-contract.js"
import { auditRetainedRegulatoryInputs } from "./retained-audit.js"

const directories: string[] = []
const fetch = vi.fn<typeof globalThis.fetch>()
beforeEach(() => {
  fetch.mockRejectedValue(new Error("Network forbidden during retained audit"))
  vi.stubGlobal("fetch", fetch)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  fetch.mockClear()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tabra-retained-audit-"))
  directories.push(root)
  const manifest = await planRegulatoryBackfill(
    { cutoff: "2026-09-14", ecfrTitles: [1], federalRegister: null, annualCfr: null },
    async (sourceId, url) => {
      const body = JSON.stringify({
        titles: Array.from({ length: 50 }, (_, index) => ({
          number: index + 1,
          name: `Synthetic ${index + 1}`,
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
  const unit = manifest.units[0]
  invariant(unit, "Expected title unit")
  const rawDirectory = join(root, "raw")
  const normalizedDirectory = join(root, "normalized")
  const xml =
    '<ECFR><DIV1 N="1" TYPE="TITLE"><HEAD>Title 1</HEAD><DIV8 N="1.1" TYPE="SECTION"><HEAD>Section 1.1</HEAD><P>Retain the complete evidence.</P></DIV8></DIV1></ECFR>'
  const artifactHash = digest(xml)
  const artifactPath = join(rawDirectory, "blobs", `${artifactHash}.xml`)
  const receiptPath = join(rawDirectory, "units", `${unit.key}.json`)
  await mkdir(join(rawDirectory, "blobs"), { recursive: true })
  await mkdir(join(rawDirectory, "units"), { recursive: true })
  await writeFile(artifactPath, xml)
  const receipt = {
    unit,
    sha256: artifactHash,
    bytes: Buffer.byteLength(xml),
    acquiredAt: "2026-09-15T00:00:00Z",
    contentType: "application/xml",
    etag: null,
    lastModified: null,
    stage: "acquired",
    parseValidated: false
  }
  await writeFile(receiptPath, JSON.stringify(receipt))
  const parsed = await parseRegulatoryArtifact({
    unit,
    artifactHash,
    path: artifactPath,
    outputRoot: normalizedDirectory
  })
  return {
    root,
    manifest,
    unit,
    rawDirectory,
    normalizedDirectory,
    xml,
    artifactPath,
    receiptPath,
    receipt,
    parsed,
    input: {
      manifest,
      locations: [{ rawDirectory, normalizedDirectory }],
      parserCodeHash: parsed.summary.parserCodeHash
    }
  }
}

describe("retained regulatory reuse audit", () => {
  it("verifies retained files offline without promoting database reuse or changing the artifacts", async () => {
    const data = await fixture()
    const before = await readFile(data.receiptPath, "utf8")
    const report = await auditRetainedRegulatoryInputs(data.input)
    expect(report).toMatchObject({
      expectedUnits: 1,
      verifiedRawUnits: 1,
      verifiedNormalizedUnits: 1,
      canonicalWrites: false,
      acquisitionPerformed: false,
      completeCanonicalAudit: false,
      dispatchEnabled: false
    })
    expect(report.units[0]).toMatchObject({
      normalizedRecords: 2,
      rawConflict: false,
      normalizedConflict: false,
      canonicalStatus: "not_checked",
      action: "inspect_canonical"
    })
    expect(await readFile(data.receiptPath, "utf8")).toBe(before)
    expect(await readFile(data.artifactPath, "utf8")).toBe(data.xml)
    expect(await auditRetainedRegulatoryInputs(data.input)).toEqual(report)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("distinguishes an absent input from an absent parse and rejects a damaged existing parse", async () => {
    const data = await fixture()
    const absent = join(data.root, "absent")
    const missingRaw = await auditRetainedRegulatoryInputs({
      ...data.input,
      locations: [{ rawDirectory: absent, normalizedDirectory: data.normalizedDirectory }]
    })
    expect(missingRaw.units[0]).toMatchObject({
      rawStatus: "missing",
      normalizedStatus: "not_checked",
      action: "acquire"
    })
    const missingParse = await auditRetainedRegulatoryInputs({
      ...data.input,
      locations: [{ rawDirectory: data.rawDirectory, normalizedDirectory: absent }]
    })
    expect(missingParse.units[0]).toMatchObject({ rawStatus: "verified", normalizedStatus: "missing", action: "parse" })
    const shard = data.parsed.summary.shards[0]
    invariant(shard, "Expected shard")
    await rm(join(data.parsed.directory, shard.file))
    expect((await auditRetainedRegulatoryInputs(data.input)).units[0]).toMatchObject({
      normalizedStatus: "invalid",
      action: "review_normalized"
    })
  })
  it("detects same-length raw corruption and a missing artifact independently of its receipt", async () => {
    const data = await fixture()
    await writeFile(data.artifactPath, data.xml.replace("complete", "altered!"))
    expect((await auditRetainedRegulatoryInputs(data.input)).units[0]?.rawCandidates[0]).toMatchObject({
      status: "invalid",
      reason: "artifact_checksum_mismatch"
    })
    await rm(data.artifactPath)
    expect((await auditRetainedRegulatoryInputs(data.input)).units[0]?.rawCandidates[0]).toMatchObject({
      status: "invalid",
      reason: "artifact_missing"
    })
  })
  it("accepts a new enclosing inventory hash but rejects changed acquisition semantics", async () => {
    const data = await fixture()
    await writeFile(
      data.receiptPath,
      JSON.stringify({ ...data.receipt, unit: { ...data.unit, inventoryHash: digest("older inventory") } })
    )
    expect((await auditRetainedRegulatoryInputs(data.input)).verifiedRawUnits).toBe(1)
    await writeFile(
      data.receiptPath,
      JSON.stringify({ ...data.receipt, unit: { ...data.unit, currencyDate: "2026-09-13" } })
    )
    expect((await auditRetainedRegulatoryInputs(data.input)).units[0]?.rawCandidates[0]).toMatchObject({
      status: "invalid",
      reason: "receipt_unit_mismatch"
    })
  })
  it("refuses competing valid raw hashes while preserving candidate evidence", async () => {
    const data = await fixture()
    const other = join(data.root, "other-raw")
    await cp(data.rawDirectory, other, { recursive: true })
    const xml = data.xml.replace("complete", "different")
    const hash = digest(xml)
    await writeFile(join(other, "blobs", `${hash}.xml`), xml)
    await writeFile(
      join(other, "units", basename(data.receiptPath)),
      JSON.stringify({ ...data.receipt, sha256: hash, bytes: Buffer.byteLength(xml) })
    )
    const report = await auditRetainedRegulatoryInputs({
      ...data.input,
      locations: [...data.input.locations, { rawDirectory: other, normalizedDirectory: data.normalizedDirectory }]
    })
    expect(report.units[0]).toMatchObject({
      rawStatus: "invalid",
      rawConflict: true,
      artifactHash: null,
      normalizedStatus: "not_checked",
      action: "review_raw"
    })
    expect(report.units[0]?.rawCandidates.map((candidate) => candidate.status)).toEqual(["verified", "verified"])
  })
  it("rejects conflicting normalized outputs even when each copy passes its own shard hashes", async () => {
    const data = await fixture()
    const other = join(data.root, "other-normalized")
    await cp(data.normalizedDirectory, other, { recursive: true })
    const directory = join(other, basename(data.parsed.directory))
    const shard = data.parsed.summary.shards[0]
    invariant(shard, "Expected shard")
    const lines = (await readFile(join(directory, shard.file), "utf8")).trimEnd().split("\n")
    const record = regulatoryRecordSchema.parse(JSON.parse(lines[0] ?? "null"))
    lines[0] = JSON.stringify({ ...record, heading: "Conflicting heading" })
    const body = `${lines.join("\n")}\n`
    await writeFile(join(directory, shard.file), body)
    await writeFile(
      join(directory, "summary.json"),
      JSON.stringify({
        ...data.parsed.summary,
        shards: [{ ...shard, bytes: Buffer.byteLength(body), sha256: digest(body) }]
      })
    )
    const report = await auditRetainedRegulatoryInputs({
      ...data.input,
      locations: [...data.input.locations, { rawDirectory: data.rawDirectory, normalizedDirectory: other }]
    })
    expect(report.units[0]).toMatchObject({
      rawStatus: "verified",
      normalizedStatus: "invalid",
      normalizedConflict: true,
      normalizedDirectory: null,
      action: "review_normalized"
    })
    expect(report.units[0]?.normalizedCandidates.map((candidate) => candidate.status)).toEqual(["verified", "verified"])
  })
  it("reports a stale parser generation as missing and keeps a valid alternate raw copy usable", async () => {
    const data = await fixture()
    const other = join(data.root, "damaged-raw")
    await cp(data.rawDirectory, other, { recursive: true })
    await writeFile(join(other, "units", basename(data.receiptPath)), "invalid json")
    const report = await auditRetainedRegulatoryInputs({
      ...data.input,
      parserCodeHash: digest("new parser"),
      locations: [{ rawDirectory: other, normalizedDirectory: data.normalizedDirectory }, ...data.input.locations]
    })
    expect(report.units[0]).toMatchObject({ rawStatus: "verified", normalizedStatus: "missing", action: "parse" })
    expect(report.verifiedOlderNormalizedUnits).toBe(1)
    expect(report.units[0]?.retainedGenerations).toEqual([
      expect.objectContaining({
        status: "verified",
        records: 2,
        currentParser: false,
        parserCodeHash: data.parsed.summary.parserCodeHash
      })
    ])
    expect(report.units[0]?.rawCandidates.map((candidate) => candidate.status)).toEqual(["invalid", "verified"])
    const shard = data.parsed.summary.shards[0]
    invariant(shard, "Expected shard")
    await writeFile(join(data.parsed.directory, shard.file), "damaged")
    const damaged = await auditRetainedRegulatoryInputs({ ...data.input, parserCodeHash: digest("new parser") })
    expect(damaged.verifiedOlderNormalizedUnits).toBe(0)
    expect(damaged.units[0]?.retainedGenerations[0]?.status).toBe("invalid")
    await writeFile(join(data.parsed.directory, "summary.json"), "invalid")
    const unassigned = await auditRetainedRegulatoryInputs(data.input)
    expect(unassigned.normalizedInventoryIssues).toEqual([
      { directory: data.parsed.directory, reason: "normalized_summary_invalid" }
    ])
  })
  it("rejects a rehashed incomplete manifest before reading retained units", async () => {
    const data = await fixture()
    const omitted = { ...data.manifest, units: [], unknownSizeUnits: 0 }
    await expect(
      auditRetainedRegulatoryInputs({ ...data.input, manifest: { ...omitted, id: manifestIdentity(omitted) } })
    ).rejects.toThrow("replay mismatch")
  })
})
