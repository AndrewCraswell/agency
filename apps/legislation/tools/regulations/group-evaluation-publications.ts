import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { groupRegulatoryEvaluationPublications } from "../../src/ingestion/regulations/embedding-publication-families.js"

const { values } = parseArgs({ options: { input: { type: "string" }, output: { type: "string" } } })
const input = resolve(z.string().min(1).parse(values.input))
invariant((await stat(input)).size <= 16 * 1024 * 1024, "regulatory_family_input_byte_limit")
const report = groupRegulatoryEvaluationPublications(JSON.parse(await readFile(input, "utf8")))
await writeFile(resolve(z.string().min(1).parse(values.output)), JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
process.stdout.write(
  JSON.stringify({
    families: report.families.length,
    withWarnings: report.families.filter((f) => f.warnings.length > 0).length,
    externalRequests: false,
    canonicalWrites: false,
    splitAssigned: false
  })
)
