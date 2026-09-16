import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { scoreReviewedRegulatoryJudgments } from "../../src/ingestion/regulations/embedding-reviewed-scores.js"
import { regulatoryEmbeddingSmokeSchema } from "../../src/ingestion/regulations/embedding-smoke.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    systems: { type: "string" },
    review: { type: "string" },
    output: { type: "string" }
  }
})
async function load(value: unknown) {
  const path = resolve(z.string().min(1).parse(value))
  invariant((await stat(path)).size <= 32 * 1024 * 1024, "regulatory_review_input_byte_limit")
  return JSON.parse(await readFile(path, "utf8"))
}
const manifest = z
  .object({
    records: regulatoryEmbeddingSmokeSchema.shape.records,
    queries: z.array(regulatoryEmbeddingSmokeSchema.shape.queries.element.strip())
  })
  .parse(await load(values.manifest))
const report = scoreReviewedRegulatoryJudgments(manifest, await load(values.systems), await load(values.review))
await writeFile(resolve(z.string().min(1).parse(values.output)), JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
process.stdout.write(
  JSON.stringify({
    systems: report.results.length,
    humanReviewComplete: false,
    modelSelected: false,
    externalRequests: false
  })
)
