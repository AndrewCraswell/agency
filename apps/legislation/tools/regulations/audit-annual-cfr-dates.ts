import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { assessAnnualCfrDates } from "../../src/ingestion/regulations/annual-cfr-dates.js"
import { receiptSchema } from "../../src/ingestion/regulations/artifact-backfill.js"
import { digest, validateManifest } from "../../src/ingestion/regulations/contracts.js"
import { validateRegulatoryOutput } from "../../src/ingestion/regulations/parser-bridge.js"
import { parserLimits, regulatoryParserContract } from "../../src/ingestion/regulations/parser-contract.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    raw: { type: "string" },
    normalized: { type: "string" },
    output: { type: "string" }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const manifest = validateManifest(JSON.parse(await readFile(path(values.manifest), "utf8")))
const parserCodeHash = digest(await readFile(new URL("../../python/regulations/parse_xml.py", import.meta.url)))
const observations = []
for (const unit of manifest.units.filter((unit) => unit.sourceId === "govinfo-cfr")) {
  const receipt = receiptSchema.parse(
    JSON.parse(await readFile(join(path(values.raw), "units", `${unit.key}.json`), "utf8"))
  )
  invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "annual_cfr_receipt_scope_mismatch")
  const checksum = createHash("sha256")
  let bytes = 0
  for await (const chunk of createReadStream(join(path(values.raw), "blobs", `${receipt.sha256}.xml`))) {
    checksum.update(chunk)
    bytes += chunk.length
  }
  invariant(checksum.digest("hex") === receipt.sha256 && bytes === receipt.bytes, "annual_cfr_artifact_mismatch")
  const generation = digest(
    JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, receipt.sha256, parserLimits])
  )
  const summary = await validateRegulatoryOutput(
    join(path(values.normalized), generation),
    unit,
    receipt.sha256,
    parserCodeHash
  )
  observations.push({
    unitKey: unit.key,
    nativeId: unit.nativeId,
    packageYear: Number(unit.edition),
    artifactHash: receipt.sha256,
    printedRevisionDates: summary.sourceDates
      .filter((date) => date.kind === "printed_revision")
      .map((date) => date.value)
  })
}
const result = assessAnnualCfrDates(observations)
await writeFile(
  path(values.output),
  JSON.stringify({ manifestId: manifest.id, parserCodeHash, observedAt: new Date().toISOString(), ...result }, null, 2),
  { flag: "wx" }
)
process.stdout.write(JSON.stringify(result))
if (result.dateReviewRequired) {
  process.exitCode = 1
}
