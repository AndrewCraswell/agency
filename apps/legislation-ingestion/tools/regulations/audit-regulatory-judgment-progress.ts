import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { auditRegulatoryJudgmentProgress } from "../../src/ingestion/regulations/embedding-review-progress.js"

const { values } = parseArgs({
  options: { review: { type: "string" }, output: { type: "string" } }
})
const review = resolve(z.string().min(1).parse(values.review))
invariant((await stat(review)).size <= 32 * 1024 * 1024, "regulatory_review_progress_input_limit")
const report = auditRegulatoryJudgmentProgress(JSON.parse(await readFile(review, "utf8")))
if (values.output !== undefined) {
  await writeFile(resolve(z.string().min(1).parse(values.output)), `${JSON.stringify(report, null, 2)}\n`, {
    flag: "wx"
  })
}
process.stdout.write(`${JSON.stringify(report)}\n`)
