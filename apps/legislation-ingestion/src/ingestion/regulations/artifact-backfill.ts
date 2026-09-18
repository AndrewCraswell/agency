import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { link, lstat, mkdir, open, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  acquisitionUnitSchema,
  type AcquisitionUnit,
  type BackfillManifest
} from "@repo/legislation-core/legal-text/contracts"
import { z } from "zod"
import { ProviderHttpError } from "../http-client.js"
import { legalDiscoveryUnitSchema, type LegalDiscoveryUnit } from "./discovery-checkpoint.js"
import { RegulatorySourceClient } from "./source-client.js"

export const receiptSchema = z.strictObject({
  unit: acquisitionUnitSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.int().positive(),
  acquiredAt: z.iso.datetime(),
  contentType: z.string(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  stage: z.literal("acquired"),
  parseValidated: z.literal(false)
})
export const currentReceiptSchema = receiptSchema.extend({ unit: legalDiscoveryUnitSchema })
export const regulatoryArtifactUnitSchema = z.union([acquisitionUnitSchema, legalDiscoveryUnitSchema])
export const regulatoryArtifactReceiptSchema = z.union([receiptSchema, currentReceiptSchema])
type RegulatoryArtifactUnit = AcquisitionUnit | LegalDiscoveryUnit
type RegulatoryArtifactReceipt = z.infer<typeof receiptSchema> | z.infer<typeof currentReceiptSchema>
type ReceiptSchema = typeof receiptSchema | typeof currentReceiptSchema

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function assertXmlPrefix(value: Uint8Array, sourceId: RegulatoryArtifactUnit["sourceId"]) {
  const text = Buffer.from(value)
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()
  const roots = { ecfr: /<(?:DLPSTEXTCLASS|ECFR)\b/, "govinfo-fr": /<FEDREG\b/, "govinfo-cfr": /<CFRDOC\b/ }
  const root = roots[sourceId]
  if (!text.startsWith("<") || /<!DOCTYPE\s+html|<html\b/i.test(text) || !root.test(text)) {
    throw new Error("Artifact does not have the expected regulatory XML root")
  }
}

async function checksum(path: string) {
  const hash = createHash("sha256")
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
    bytes += chunk.length
  }
  return { sha256: hash.digest("hex"), bytes }
}

export async function validateRegulatoryArtifactRetention(path: string, hash: string, bytes: number) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes) {
    throw new Error("artifact_retention_mismatch")
  }
  const actual = await checksum(path)
  if (actual.sha256 !== hash || actual.bytes !== bytes) {
    throw new Error("artifact_retention_mismatch")
  }
}

async function cachedReceipt(directory: string, unit: RegulatoryArtifactUnit, schema: ReceiptSchema) {
  let raw: string
  try {
    raw = await readFile(join(directory, "units", `${unit.key}.json`), "utf8")
  } catch (error) {
    if (isMissing(error)) {
      return null
    }
    throw error
  }
  const receipt = schema.parse(JSON.parse(raw)) as RegulatoryArtifactReceipt
  if (receipt.unit.key !== unit.key || receipt.unit.sourceUrl !== unit.sourceUrl) {
    throw new Error("Cached acquisition receipt belongs to another unit")
  }
  const actual = await checksum(join(directory, "blobs", `${receipt.sha256}.xml`))
  if (actual.sha256 !== receipt.sha256 || actual.bytes !== receipt.bytes) {
    throw new Error("Cached regulatory artifact checksum mismatch; repair the local unit before retry")
  }
  return receipt
}

async function acquireUnit(
  directory: string,
  unit: RegulatoryArtifactUnit,
  client: RegulatorySourceClient,
  maximumBytes: number,
  schema: ReceiptSchema
) {
  const cached = await cachedReceipt(directory, unit, schema)
  if (cached !== null) {
    return { ...cached, reused: true }
  }
  const tempPath = join(directory, "temporary", `${unit.key}-${randomUUID()}.partial`)
  const response = await client.response(unit.sourceId, unit.sourceUrl, "application/xml, text/xml")
  const contentType = response.headers.get("content-type") ?? ""
  if (!/^(application|text)\/xml(?:;|$)/i.test(contentType)) {
    await response.body?.cancel()
    throw new Error("Regulatory artifact did not return XML")
  }
  if (response.body === null) {
    throw new Error("Empty regulatory response body")
  }
  const reader = response.body.getReader()
  let handle
  try {
    handle = await open(tempPath, "wx")
    const hash = createHash("sha256")
    let bytes = 0
    let prefix = Buffer.alloc(0)
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) {
        break
      }
      bytes += chunk.value.byteLength
      if (bytes > maximumBytes) {
        throw new Error("Regulatory artifact exceeds configured byte limit")
      }
      if (prefix.byteLength < 8192) {
        prefix = Buffer.concat([prefix, chunk.value.subarray(0, 8192 - prefix.byteLength)])
      }
      hash.update(chunk.value)
      let offset = 0
      while (offset < chunk.value.byteLength) {
        const written = await handle.write(chunk.value.subarray(offset))
        if (written.bytesWritten === 0) {
          throw new Error("Regulatory artifact write stalled")
        }
        offset += written.bytesWritten
      }
    }
    assertXmlPrefix(prefix, unit.sourceId)
    if (unit.expectedBytes !== null && bytes !== unit.expectedBytes) {
      throw new Error(
        `Source bytes changed since discovery: expected ${unit.expectedBytes}, received ${bytes}; create a new inventory`
      )
    }
    await handle.sync()
    await handle.close()
    handle = undefined
    const sha256 = hash.digest("hex")
    const target = join(directory, "blobs", `${sha256}.xml`)
    try {
      await link(tempPath, target)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
      const existing = await checksum(target)
      if (existing.sha256 !== sha256 || existing.bytes !== bytes) {
        throw new Error("Existing immutable artifact is corrupt")
      }
    }
    const receipt = schema.parse({
      unit,
      sha256,
      bytes,
      acquiredAt: new Date().toISOString(),
      contentType,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      stage: "acquired",
      parseValidated: false
    })
    const receiptTemp = join(directory, "temporary", `${unit.key}-${randomUUID()}.receipt`)
    try {
      await writeFile(receiptTemp, JSON.stringify(receipt, null, 2), { flag: "wx", flush: true })
      await link(receiptTemp, join(directory, "units", `${unit.key}.json`))
    } finally {
      await rm(receiptTemp, { force: true })
    }
    return { ...(receipt as RegulatoryArtifactReceipt), reused: false }
  } finally {
    await reader.cancel().catch(() => undefined)
    await handle?.close()
    await rm(tempPath, { force: true })
  }
}

/** Acquires one current discovery unit using the same verified immutable-byte path as historical backfills. */
export async function acquireCurrentRegulatoryArtifact(
  directory: string,
  value: unknown,
  options: { maximumBytes?: number; client?: RegulatorySourceClient } = {}
) {
  return currentReceiptSchema
    .extend({ reused: z.boolean() })
    .parse(await acquireRegulatoryArtifact(directory, legalDiscoveryUnitSchema.parse(value), options))
}

/** Acquires either a frozen historical unit or a current-discovery unit through one immutable-byte path. */
export async function acquireRegulatoryArtifact(
  directory: string,
  value: unknown,
  options: { maximumBytes?: number; client?: RegulatorySourceClient } = {}
) {
  const unit = regulatoryArtifactUnitSchema.parse(value)
  const maximumBytes = z
    .int()
    .positive()
    .max(512 * 1024 * 1024)
    .parse(options.maximumBytes ?? 256 * 1024 * 1024)
  for (const name of ["blobs", "units", "temporary", "attempts"]) {
    await mkdir(join(directory, name), { recursive: true })
  }
  const client = options.client ?? new RegulatorySourceClient()
  let receipt
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      receipt = await acquireUnit(
        directory,
        unit,
        client,
        maximumBytes,
        unit.historical ? receiptSchema : currentReceiptSchema
      )
      break
    } catch (error) {
      if (!(error instanceof ProviderHttpError) || !error.retryable || attempt === 2) {
        throw error
      }
      await client.retryDelay(attempt)
    }
  }
  if (receipt === undefined) {
    throw new Error("Acquisition did not produce a receipt")
  }
  return z
    .union([receiptSchema.extend({ reused: z.boolean() }), currentReceiptSchema.extend({ reused: z.boolean() })])
    .parse(receipt)
}

/** One local writer per artifact directory. No database, Azure, Trigger or source-schedule mutations. */
export async function acquireRegulatoryBackfill(
  manifest: BackfillManifest,
  directory: string,
  options: {
    limit: number
    maximumBytes?: number
    client?: RegulatorySourceClient
    onUnit?: (result: { key: string; status: string; bytes?: number }) => void
  }
) {
  const limit = z.int().min(1).max(10_000).parse(options.limit)
  const maximumBytes = z
    .int()
    .positive()
    .max(512 * 1024 * 1024)
    .parse(options.maximumBytes ?? 256 * 1024 * 1024)
  await mkdir(directory, { recursive: true })
  const lock = await open(join(directory, "acquisition.lock"), "wx")
  try {
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, manifestId: manifest.id, startedAt: new Date().toISOString() })
    )
    for (const name of ["blobs", "units", "temporary", "attempts"]) {
      await mkdir(join(directory, name), { recursive: true })
    }
    const client = options.client ?? new RegulatorySourceClient()
    const acquired: { key: string; sha256: string; bytes: number; reused: boolean }[] = []
    const failures: { key: string; error: string }[] = []
    let attempted = 0
    for (const unit of manifest.units) {
      try {
        const cached = await cachedReceipt(directory, unit, receiptSchema)
        if (cached !== null) {
          acquired.push({ key: unit.key, sha256: cached.sha256, bytes: cached.bytes, reused: true })
          continue
        }
        if (attempted >= limit) {
          continue
        }
        attempted++
        let receipt
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            receipt = await acquireUnit(directory, unit, client, maximumBytes, receiptSchema)
            break
          } catch (error) {
            if (!(error instanceof ProviderHttpError) || !error.retryable || attempt === 2) {
              throw error
            }
            await client.retryDelay(attempt)
          }
        }
        if (receipt === undefined) {
          throw new Error("Acquisition did not produce a receipt")
        }
        acquired.push({ key: unit.key, sha256: receipt.sha256, bytes: receipt.bytes, reused: receipt.reused })
        options.onUnit?.({ key: unit.key, status: "acquired", bytes: receipt.bytes })
      } catch (error) {
        failures.push({
          key: unit.key,
          error: error instanceof Error ? error.message.slice(0, 300) : "Acquisition failed"
        })
        options.onUnit?.({ key: unit.key, status: "failed" })
      }
    }
    const report = {
      manifestId: manifest.id,
      finishedAt: new Date().toISOString(),
      expected: manifest.units.length,
      acquired,
      failures,
      pending: manifest.units.length - acquired.length,
      excluded: manifest.exclusions.length,
      status: acquired.length === manifest.units.length ? "acquired" : "partial",
      canonicalWrites: false,
      parsed: 0,
      published: 0,
      indexed: 0,
      embedded: 0,
      recurringIngestionEnabled: false
    }
    await writeFile(
      join(directory, "attempts", `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(report, null, 2),
      { flag: "wx" }
    )
    return report
  } finally {
    await lock.close()
    await rm(join(directory, "acquisition.lock"))
  }
}
