import { readFile, writeFile } from "node:fs/promises"
import { parseArgs } from "node:util"
import { z } from "zod"
import { auditRegulatoryQualification } from "../../src/ingestion/regulations/qualification-audit.js"

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    output: { type: "string" },
    implementation: { type: "string" },
    editions: { type: "string" },
    "source-review": { type: "string", multiple: true }
  }
})

try {
  const input = z.string().min(1).parse(values.input)
  const output = z.string().min(1).parse(values.output)
  const sourceReviews = await Promise.all(
    (values["source-review"] ?? []).map(async (path) => JSON.parse(await readFile(path, "utf8")))
  )
  const report = await auditRegulatoryQualification(input, {
    expectedEditions: z.coerce.number().int().positive().parse(values.editions),
    implementationHash: values.implementation,
    sourceReviews
  })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.tokenizerQualified || !report.tableShapeAccounted) process.exitCode = 1
} catch (error) {
  const message = error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : ""
  const reason = /^[a-z_]+$/.test(message) ? message : "qualification_audit_failed"
  process.stderr.write(`${JSON.stringify({ reason })}\n`)
  process.exitCode = 1
}
