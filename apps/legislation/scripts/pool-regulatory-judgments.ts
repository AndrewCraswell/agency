import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { buildRegulatoryJudgmentPool } from "../src/ingestion/regulations/embedding-judgments.js"
import { regulatoryEmbeddingSmokeSchema } from "../src/ingestion/regulations/embedding-smoke.js"

const { values } = parseArgs({
  options: { manifest: { type: "string" }, systems: { type: "string" }, output: { type: "string" } }
})
async function load(value: unknown) {
  const path = resolve(z.string().min(1).parse(value))
  invariant((await stat(path)).size <= 32 * 1024 * 1024, "judgment_pool_input_byte_limit")
  return JSON.parse(await readFile(path, "utf8"))
}
const manifest = z
  .object({
    records: regulatoryEmbeddingSmokeSchema.shape.records,
    queries: z.array(regulatoryEmbeddingSmokeSchema.shape.queries.element.strip())
  })
  .parse(await load(values.manifest))
const report = buildRegulatoryJudgmentPool(manifest, await load(values.systems))
await writeFile(resolve(z.string().min(1).parse(values.output)), JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  JSON.stringify({
    queries: report.queries.length,
    candidates: report.queries.reduce((sum, row) => sum + row.candidates.length, 0),
    humanReviewComplete: false,
    externalRequests: false
  })
)
