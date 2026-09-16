import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { receiptSchema } from "../../src/ingestion/regulations/artifact-backfill.js"
import { digest, validateManifest } from "../../src/ingestion/regulations/contracts.js"
import { validateRegulatoryOutput } from "../../src/ingestion/regulations/parser-bridge.js"
import {
  parserLimits,
  regulatoryParserContract,
  regulatoryRecordSchema
} from "../../src/ingestion/regulations/parser-contract.js"
import {
  buildLegalTextProjection,
  legalReaderContract,
  readLegalTextWindow
} from "../../src/ingestion/regulations/reader-text.js"
import { officialFederalRights } from "../../src/ingestion/regulations/storage-contract.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    raw: { type: "string" },
    normalized: { type: "string" },
    output: { type: "string" },
    limit: { type: "string", default: "5" }
  }
})
const required = (value: unknown) => resolve(z.string().min(1).parse(value))
const manifest = validateManifest(JSON.parse(await readFile(required(values.manifest), "utf8")))
const limit = z.coerce.number().int().min(1).max(10_000).parse(values.limit)
const parserCodeHash = digest(await readFile(new URL("../../python/regulations/parse_xml.py", import.meta.url)))
const readerCodeHash = digest(
  await readFile(new URL("../../src/ingestion/regulations/reader-text.ts", import.meta.url))
)
const started = Date.now()
const results = []
for (const unit of manifest.units.slice(0, limit)) {
  const receipt = receiptSchema.parse(
    JSON.parse(await readFile(join(required(values.raw), "units", `${unit.key}.json`), "utf8"))
  )
  invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "reader_receipt_unit_mismatch")
  const rawHash = createHash("sha256")
  for await (const chunk of createReadStream(join(required(values.raw), "blobs", `${receipt.sha256}.xml`))) {
    rawHash.update(chunk)
  }
  invariant(rawHash.digest("hex") === receipt.sha256, "reader_raw_artifact_mismatch")
  const generation = digest(
    JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, receipt.sha256, parserLimits])
  )
  const directory = join(required(values.normalized), generation)
  const summary = await validateRegulatoryOutput(directory, unit, receipt.sha256, parserCodeHash)
  let records = 0
  let blocks = 0
  let windows = 0
  let maximumWindowCharacters = 0
  let failedRecords = 0
  const failures: { nativeId: string; reason: string }[] = []
  const scope = {
    callerKey: "local-reader-smoke",
    editionId: unit.sourceId === "govinfo-fr" ? null : unit.key,
    sourceObservationId: unit.key,
    rightsPolicyHash: digest(JSON.stringify(officialFederalRights))
  }
  for (const shard of summary.shards) {
    const stream = createReadStream(join(directory, shard.file), { encoding: "utf8" })
    const lines = createInterface({ input: stream, crlfDelay: Infinity })
    try {
      for await (const line of lines) {
        const record = regulatoryRecordSchema.parse(JSON.parse(line))
        try {
          // Source record keys are preview identities only, not invented canonical version IDs.
          const projection = buildLegalTextProjection({
            versionId: record.recordKey,
            body: record.text,
            blocks: record.blocks
          })
          const outputHash = createHash("sha256")
          let cursor: string | undefined
          let ordinal = 0
          let offset = 0
          do {
            const page = readLegalTextWindow(projection, { scope, cursor })
            invariant(page.startBlock === ordinal, "reader_page_discontinuity")
            let pageCharacters = 0
            for (const block of page.blocks) {
              invariant(block.start === offset && block.text.isWellFormed(), "reader_text_interval_mismatch")
              outputHash.update(block.text)
              offset = block.end
              pageCharacters += block.text.length
              ordinal++
            }
            invariant(pageCharacters <= 100_000, "reader_window_exceeded")
            maximumWindowCharacters = Math.max(maximumWindowCharacters, pageCharacters)
            windows++
            cursor = page.nextCursor ?? undefined
          } while (cursor !== undefined)
          invariant(
            offset === record.text.length && outputHash.digest("hex") === record.textHash,
            "reader_body_hash_mismatch"
          )
          records++
          blocks += ordinal
        } catch (error) {
          failedRecords++
          if (failures.length < 20) {
            failures.push({
              nativeId: record.nativeId,
              reason: error instanceof Error ? error.message : "Reader failed"
            })
          }
        }
      }
    } finally {
      lines.close()
      stream.destroy()
    }
  }
  const result = {
    unit: unit.nativeId,
    sourceId: unit.sourceId,
    generation,
    expectedRecords: summary.records,
    records,
    blocks,
    windows,
    maximumWindowCharacters,
    failedRecords,
    failures
  }
  results.push(result)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
const passed = results.every((result) => result.failedRecords === 0 && result.records === result.expectedRecords)
const report = {
  observedAt: new Date().toISOString(),
  manifestId: manifest.id,
  readerContract: legalReaderContract,
  parserCodeHash,
  readerCodeHash,
  status: passed ? "passed" : "failed",
  results,
  elapsedSeconds: (Date.now() - started) / 1000,
  previewIdentities: true,
  publicApiTested: false,
  canonicalWrites: false,
  recurringIngestionEnabled: false
}
await writeFile(required(values.output), JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  `${JSON.stringify({ status: report.status, output: values.output, elapsedSeconds: report.elapsedSeconds })}\n`
)
if (!passed) {
  process.exitCode = 1
}
