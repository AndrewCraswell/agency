import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { prepareCommonRegulatoryPassages } from "../../src/ingestion/regulations/embedding-common-passages.js"

const { values } = parseArgs({ options: { input: { type: "string" }, output: { type: "string" } } })
const input = resolve(z.string().min(1).parse(values.input))
const output = resolve(z.string().min(1).parse(values.output))
invariant((await stat(input)).size <= 64 * 1024 * 1024, "regulatory_common_input_byte_limit")
const report = await prepareCommonRegulatoryPassages(JSON.parse(await readFile(input, "utf8")))
await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
process.stdout.write(
  JSON.stringify({
    passages: report.passages.length,
    manifestHash: report.manifestHash,
    externalRequests: false,
    canonicalWrites: false,
    modelSelected: false
  })
)
