import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { acquireFrHtml } from "../../src/ingestion/regulations/fr-html.js"
import { isSupportedFrMetadataType } from "../../src/ingestion/regulations/fr-metadata-contract.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { RegulatorySourceClient } from "../../src/ingestion/regulations/source-client.js"

const { values } = parseArgs({
  options: {
    metadata: { type: "string" },
    date: { type: "string" },
    directory: { type: "string" },
    output: { type: "string" },
    limit: { type: "string", default: "100" }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const metadata = await replayFrMetadata(JSON.parse(await readFile(path(values.metadata), "utf8")))
const date = z.iso.date().parse(values.date)
invariant(date >= metadata.scope.start && date <= metadata.scope.end, "fr_html_date_outside_manifest")
const limit = z.coerce.number().int().min(1).max(1000).parse(values.limit)
const selected = metadata.records.filter(
  (record) => record.publication_date === date && isSupportedFrMetadataType(record.type)
)
const client = new RegulatorySourceClient()
const results = []
for (const record of selected.slice(0, limit)) {
  try {
    const result = await acquireFrHtml(
      { record, metadataManifestId: metadata.id, directory: path(values.directory) },
      client
    )
    results.push({ status: "parsed", ...result })
    process.stdout.write(
      `${JSON.stringify({ documentNumber: record.document_number, status: "parsed", reused: result.reused })}\n`
    )
  } catch (error) {
    const result = {
      documentNumber: record.document_number,
      status: "failed",
      reason: error instanceof Error ? error.message : "HTML acquisition failed"
    }
    results.push(result)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
}
const complete =
  selected.length > 0 && results.length === selected.length && results.every((row) => row.status === "parsed")
await writeFile(
  path(values.output),
  JSON.stringify(
    {
      metadataManifestId: metadata.id,
      date,
      expected: selected.length,
      complete,
      results,
      parserHash: digest(await readFile(new URL("../../src/ingestion/regulations/fr-html.ts", import.meta.url))),
      canonicalWrites: false,
      publicationReady: false
    },
    null,
    2
  ),
  { flag: "wx" }
)
if (!complete) {
  process.exitCode = 1
}
