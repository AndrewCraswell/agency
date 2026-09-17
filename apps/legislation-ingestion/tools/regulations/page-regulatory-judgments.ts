import { readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  applyRegulatoryJudgmentReviewPage,
  extractRegulatoryJudgmentReviewPage
} from "../../src/ingestion/regulations/embedding-review-pages.js"

const { values } = parseArgs({
  options: {
    packet: { type: "string" },
    output: { type: "string" },
    apply: { type: "string" },
    after: { type: "string" },
    limit: { type: "string" }
  }
})
async function load(value: unknown) {
  const path = resolve(z.string().min(1).parse(value))
  invariant((await stat(path)).size <= 32 * 1024 * 1024, "regulatory_review_page_input_limit")
  return JSON.parse(await readFile(path, "utf8"))
}
const packet = await load(values.packet)
const output = resolve(z.string().min(1).parse(values.output))
if (values.apply === undefined) {
  const page = extractRegulatoryJudgmentReviewPage(packet, {
    afterQueryId: values.after,
    limit: values.limit === undefined ? undefined : z.coerce.number().int().parse(values.limit)
  })
  await writeFile(output, `${JSON.stringify(page, null, 2)}\n`, { flag: "wx" })
  process.stdout.write(
    `${JSON.stringify({ queries: page.queries.length, nextAfterQueryId: page.nextAfterQueryId, exhausted: page.exhausted })}\n`
  )
} else {
  invariant(values.after === undefined && values.limit === undefined, "regulatory_review_page_apply_options")
  const updated = applyRegulatoryJudgmentReviewPage(packet, await load(values.apply))
  await writeFile(output, `${JSON.stringify(updated, null, 2)}\n`, { flag: "wx" })
  process.stdout.write(`${JSON.stringify({ queries: updated.queries.length, applied: true })}\n`)
}
