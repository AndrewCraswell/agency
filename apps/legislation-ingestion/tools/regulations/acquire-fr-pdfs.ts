import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { acquireFrPdfs } from "../../src/ingestion/regulations/fr-pdf.js"

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
invariant(date >= metadata.scope.start && date <= metadata.scope.end, "fr_pdf_date_outside_manifest")
const report = await acquireFrPdfs({
  metadataManifestId: metadata.id,
  records: metadata.records,
  date,
  directory: path(values.directory),
  limit: z.coerce.number().parse(values.limit),
  onProgress: (documentNumber, status) => process.stdout.write(`${JSON.stringify({ documentNumber, status })}\n`)
})
await writeFile(path(values.output), JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  `${JSON.stringify({ output: values.output, expected: report.expected, acquisitionComplete: report.acquisitionComplete })}\n`
)
if (!report.acquisitionComplete) {
  process.exitCode = 1
}
