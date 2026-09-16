import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { replayRegulatoryParserBatch } from "../../src/ingestion/regulations/parser-replay.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    locations: { type: "string" },
    output: { type: "string" },
    report: { type: "string" },
    "after-unit": { type: "string" },
    limit: { type: "string", default: "5" }
  }
})
const reportPath = resolve(z.string().min(1).parse(values.report))
const report = await replayRegulatoryParserBatch({
  manifest: JSON.parse(await readFile(resolve(z.string().min(1).parse(values.manifest)), "utf8")),
  locations: JSON.parse(await readFile(resolve(z.string().min(1).parse(values.locations)), "utf8")),
  outputRoot: z.string().min(1).parse(values.output),
  afterUnitKey: values["after-unit"],
  limit: z.coerce.number().int().min(1).max(5).parse(values.limit)
})
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  `${JSON.stringify({ reportPath, completed: report.results.length, failures: report.failures, nextUnitKey: report.nextUnitKey, exhausted: report.exhausted, reviewRequired: report.reviewRequired, records: report.results.reduce((sum, result) => sum + result.records, 0), canonicalWrites: false })}\n`
)
if (report.failures.length > 0 || report.reviewRequired) {
  process.exitCode = 1
}
