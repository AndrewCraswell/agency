import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { screenRegulatoryNearDuplicates } from "../../src/ingestion/regulations/embedding-near-duplicates.js"

const { values } = parseArgs({ options: { input: { type: "string" }, output: { type: "string" } } })
const input = resolve(z.string().min(1).parse(values.input))
invariant((await stat(input)).size <= 16 * 1024 * 1024, "regulatory_duplicate_input_byte_limit")
const report = screenRegulatoryNearDuplicates(JSON.parse(await readFile(input, "utf8")))
await writeFile(resolve(z.string().min(1).parse(values.output)), JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
process.stdout.write(
  JSON.stringify({
    groups: report.groups.length,
    crossSplitGroups: report.crossSplitGroups,
    semanticReviewComplete: false,
    providerCalls: 0,
    canonicalWrites: false
  }) + "\n"
)
// Retain diagnostics but prevent a leaking candidate split from being treated as a passing gate.
if (report.crossSplitGroups > 0) process.exitCode = 1
