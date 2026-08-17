import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import { ZodError } from "zod"
import {
  createDevelopmentEvidenceAudit,
  verifyDevelopmentEvidenceArtifacts
} from "../src/validation/development-evidence.js"

const { values } = parseArgs({
  options: {
    input: { short: "i", type: "string" },
    output: { short: "o", type: "string" }
  },
  strict: true
})

if (values.input === undefined) {
  throw new Error("Usage: pnpm development:evidence -- --input <manifest.json> [--output <audit.json>]")
}

try {
  const inputPath = resolve(values.input)
  const value: unknown = JSON.parse(await readFile(inputPath, "utf8"))
  const artifactVerification = await verifyDevelopmentEvidenceArtifacts(value, dirname(inputPath))
  const audit = createDevelopmentEvidenceAudit(value, artifactVerification)
  const output = `${JSON.stringify(audit, undefined, 2)}\n`

  if (values.output === undefined) {
    process.stdout.write(output)
  } else {
    const outputPath = resolve(values.output)
    await writeFile(outputPath, output, "utf8")
    process.stdout.write(
      `${JSON.stringify({ output: outputPath, passedTasks: audit.tasks.filter((task) => task.passed).length, ready: audit.ready })}\n`
    )
  }
  if (!audit.ready) {
    process.exitCode = 1
  }
} catch (error) {
  if (error instanceof ZodError) {
    process.stderr.write(`${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")}\n`)
    process.exitCode = 1
  } else {
    throw error
  }
}
