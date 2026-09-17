import { parseArgs } from "node:util"
import { z } from "zod"
import { freezeLegalPassageManifests } from "../../src/ingestion/regulations/passage-manifest.js"

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    output: { type: "string" },
    implementation: { type: "string" },
    model: { type: "string" }
  }
})

try {
  const report = await freezeLegalPassageManifests({
    inventoryPath: z.string().min(1).parse(values.input),
    outputDirectory: z.string().min(1).parse(values.output),
    implementationHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(values.implementation),
    model: z.string().min(1).parse(values.model)
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} catch (error) {
  const message = error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : ""
  const reason = /^[a-z_]+$/.test(message) ? message : "legal_passage_manifest_failed"
  process.stderr.write(`${JSON.stringify({ reason })}\n`)
  process.exitCode = 1
}
