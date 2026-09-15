import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, opendir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { z } from "zod"
import { receiptSchema } from "./artifact-backfill.js"
import { replayRegulatoryBackfill } from "./backfill-plan.js"
import { digest, sameRegulatoryAcquisition, type AcquisitionUnit } from "./contracts.js"
import { validateRegulatoryOutput } from "./parser-bridge.js"
import { parserLimits, regulatoryParserContract, regulatoryParseSummarySchema } from "./parser-contract.js"

const retainedLocationsSchema = z
  .array(
    z.strictObject({
      rawDirectory: z.string().min(1),
      normalizedDirectory: z.string().min(1)
    })
  )
  .min(1)
  .max(100)

function missing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

async function inspectRaw(rawDirectory: string, unit: AcquisitionUnit) {
  const receiptPath = join(rawDirectory, "units", `${unit.key}.json`)
  let receipt
  try {
    const stat = await lstat(receiptPath)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) {
      return { status: "invalid" as const, reason: "receipt_file_invalid" }
    }
    receipt = receiptSchema.parse(JSON.parse(await readFile(receiptPath, "utf8")))
  } catch (error) {
    return {
      status: missing(error) ? ("missing" as const) : ("invalid" as const),
      reason: missing(error) ? "receipt_missing" : "receipt_invalid"
    }
  }
  if (!sameRegulatoryAcquisition(receipt.unit, unit)) {
    return { status: "invalid" as const, reason: "receipt_unit_mismatch" }
  }
  const artifactPath = join(rawDirectory, "blobs", `${receipt.sha256}.xml`)
  try {
    const stat = await lstat(artifactPath)
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== receipt.bytes ||
      stat.size > parserLimits.maximumInputBytes
    ) {
      return { status: "invalid" as const, reason: "artifact_file_mismatch" }
    }
    const hash = createHash("sha256")
    let bytes = 0
    for await (const chunk of createReadStream(artifactPath)) {
      bytes += chunk.length
      if (bytes > receipt.bytes) {
        return { status: "invalid" as const, reason: "artifact_changed_during_read" }
      }
      hash.update(chunk)
    }
    if (bytes !== receipt.bytes || hash.digest("hex") !== receipt.sha256) {
      return { status: "invalid" as const, reason: "artifact_checksum_mismatch" }
    }
    return { status: "verified" as const, reason: null, receipt, artifactPath }
  } catch (error) {
    return { status: "invalid" as const, reason: missing(error) ? "artifact_missing" : "artifact_read_failed" }
  }
}

async function readSummary(directory: string) {
  const path = join(directory, "summary.json")
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) {
    throw new Error("invalid_summary_file")
  }
  return regulatoryParseSummarySchema.parse(JSON.parse(await readFile(path, "utf8")))
}

async function inspectNormalized(
  directory: string,
  unit: AcquisitionUnit,
  artifactHash: string,
  codeHash: string,
  bytes: number
) {
  let hasDirectory = false
  try {
    const stat = await lstat(directory)
    hasDirectory = true
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("invalid_directory")
    }
    await readSummary(directory)
    const summary = await validateRegulatoryOutput(directory, unit, artifactHash, codeHash)
    if (summary.inputBytes !== bytes) {
      throw new Error("input_size_mismatch")
    }
    return { directory, status: "verified" as const, records: summary.records, summary }
  } catch (error) {
    return {
      directory,
      status: !hasDirectory && missing(error) ? ("missing" as const) : ("invalid" as const),
      records: null,
      summary: null
    }
  }
}

/** Discover committed generations only, with one bounded metadata pass across the explicit roots. */
async function inventoryNormalized(roots: string[]) {
  const generations = []
  const issues = []
  let entries = 0
  for (const root of roots) {
    let directory
    try {
      directory = await opendir(root)
    } catch (error) {
      if (!missing(error)) {
        issues.push({ directory: root, reason: "normalized_root_unreadable" })
      }
      continue
    }
    for await (const entry of directory) {
      entries++
      if (entries > 10_000) {
        throw new Error("Retained normalized inventory exceeds 10000 entries; use smaller location sets")
      }
      if (!/^[a-f0-9]{64}$/.test(entry.name)) {
        continue
      }
      const path = join(root, entry.name)
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        issues.push({ directory: path, reason: "normalized_directory_invalid" })
        continue
      }
      try {
        const summary = await readSummary(path)
        generations.push({
          directory: path,
          generation: entry.name,
          parserCodeHash: summary.parserCodeHash,
          artifactHash: summary.inputHash
        })
      } catch {
        issues.push({ directory: path, reason: "normalized_summary_invalid" })
      }
    }
  }
  generations.sort((left, right) => left.directory.localeCompare(right.directory))
  issues.sort((left, right) => left.directory.localeCompare(right.directory))
  return { generations, issues }
}

/** Local read-only audit. No acquisition, parser execution, database writes, automatic repairs or provider calls. */
export async function auditRetainedRegulatoryInputs(input: {
  manifest: unknown
  locations: unknown
  parserCodeHash: string
  unitKeys?: string[]
}) {
  const manifest = await replayRegulatoryBackfill(input.manifest)
  const requestedKeys =
    input.unitKeys === undefined
      ? null
      : z
          .array(z.string().regex(/^[a-f0-9]{64}$/))
          .min(1)
          .max(5)
          .parse(input.unitKeys)
  if (
    requestedKeys !== null &&
    (new Set(requestedKeys).size !== requestedKeys.length ||
      requestedKeys.some((key) => !manifest.units.some((unit) => unit.key === key)))
  ) {
    throw new Error("Retained audit selection contains duplicate or unknown units")
  }
  const selectedUnits = manifest.units.filter((unit) => requestedKeys === null || requestedKeys.includes(unit.key))
  const locations = retainedLocationsSchema.parse(input.locations).map((location) => ({
    rawDirectory: resolve(location.rawDirectory),
    normalizedDirectory: resolve(location.normalizedDirectory)
  }))
  const parserCodeHash = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.parserCodeHash)
  const normalizedRoots = [...new Set(locations.map((location) => location.normalizedDirectory))]
  const inventory = await inventoryNormalized(normalizedRoots)
  const units = []
  for (const unit of selectedUnits) {
    const rawCandidates = []
    for (const directory of new Set(locations.map((location) => location.rawDirectory))) {
      rawCandidates.push({ directory, ...(await inspectRaw(directory, unit)) })
    }
    const verified = rawCandidates.filter((candidate) => candidate.status === "verified")
    const hashes = new Set(verified.map((candidate) => candidate.receipt.sha256))
    const selected = hashes.size === 1 ? verified[0] : undefined
    let rawStatus: "verified" | "missing" | "invalid" = "missing"
    if (selected) {
      rawStatus = "verified"
    } else if (hashes.size > 1 || rawCandidates.some((candidate) => candidate.status === "invalid")) {
      rawStatus = "invalid"
    }
    const normalizedCandidates = []
    const retainedGenerations = []
    if (selected) {
      const generation = digest(
        JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, selected.receipt.sha256, parserLimits])
      )
      for (const root of normalizedRoots) {
        const directory = join(root, generation)
        normalizedCandidates.push(
          await inspectNormalized(directory, unit, selected.receipt.sha256, parserCodeHash, selected.receipt.bytes)
        )
      }
      for (const retained of inventory.generations) {
        if (retained.artifactHash !== selected.receipt.sha256 || retained.parserCodeHash === parserCodeHash) {
          continue
        }
        const expected = digest(
          JSON.stringify([
            regulatoryParserContract,
            retained.parserCodeHash,
            unit.key,
            selected.receipt.sha256,
            parserLimits
          ])
        )
        if (expected !== retained.generation) {
          continue
        }
        const result = await inspectNormalized(
          retained.directory,
          unit,
          retained.artifactHash,
          retained.parserCodeHash,
          selected.receipt.bytes
        )
        retainedGenerations.push({
          directory: retained.directory,
          parserCodeHash: retained.parserCodeHash,
          status: result.status,
          records: result.records,
          currentParser: false
        })
      }
    }
    const validNormalized = normalizedCandidates.filter((candidate) => candidate.status === "verified")
    const normalizedHashes = new Set(
      validNormalized.map((candidate) =>
        digest(JSON.stringify([candidate.summary.shards, candidate.summary.warnings, candidate.summary.sourceDates]))
      )
    )
    const normalized = normalizedHashes.size === 1 ? validNormalized[0] : undefined
    let normalizedStatus: "not_checked" | "verified" | "invalid" | "missing" = "not_checked"
    if (selected) {
      normalizedStatus = "missing"
      if (normalized) {
        normalizedStatus = "verified"
      } else if (
        normalizedHashes.size > 1 ||
        normalizedCandidates.some((candidate) => candidate.status === "invalid")
      ) {
        normalizedStatus = "invalid"
      }
    }
    let action = "inspect_canonical"
    if (rawStatus === "invalid") {
      action = "review_raw"
    } else if (rawStatus === "missing") {
      action = "acquire"
    } else if (normalizedStatus === "invalid") {
      action = "review_normalized"
    } else if (normalizedStatus === "missing") {
      action = "parse"
    }
    units.push({
      unitKey: unit.key,
      sourceId: unit.sourceId,
      nativeId: unit.nativeId,
      rawStatus,
      normalizedStatus,
      rawConflict: hashes.size > 1,
      normalizedConflict: normalizedHashes.size > 1,
      artifactHash: selected?.receipt.sha256 ?? null,
      artifactPath: selected?.artifactPath ?? null,
      normalizedDirectory: normalized?.directory ?? null,
      normalizedRecords: normalized?.records ?? null,
      retainedGenerations,
      rawCandidates: rawCandidates.map((candidate) => ({
        directory: candidate.directory,
        status: candidate.status,
        reason: candidate.reason
      })),
      normalizedCandidates: normalizedCandidates.map((candidate) => ({
        directory: candidate.directory,
        status: candidate.status
      })),
      canonicalStatus: "not_checked" as const,
      action
    })
  }
  return {
    manifestId: manifest.id,
    parserCodeHash,
    units,
    manifestUnits: manifest.units.length,
    expectedUnits: selectedUnits.length,
    verifiedRawUnits: units.filter((unit) => unit.rawStatus === "verified").length,
    verifiedNormalizedUnits: units.filter((unit) => unit.normalizedStatus === "verified").length,
    verifiedOlderNormalizedUnits: units.filter((unit) =>
      unit.retainedGenerations.some((generation) => generation.status === "verified")
    ).length,
    normalizedInventoryIssues: inventory.issues,
    canonicalWrites: false,
    networkRequests: 0,
    acquisitionPerformed: false,
    dispatchEnabled: false,
    completeCanonicalAudit: false
  }
}
