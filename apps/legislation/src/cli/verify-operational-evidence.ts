import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { ZodError } from "zod"
import { validateOperationalEvidence } from "../validation/operational-evidence.js"

const evidencePath = process.argv[2]
if (evidencePath === undefined) {
  throw new Error("Usage: pnpm operations:verify -- <operational-evidence.json>")
}

try {
  const value: unknown = JSON.parse(await readFile(resolve(evidencePath), "utf8"))
  const evidence = validateOperationalEvidence(value)
  process.stdout.write(
    `${JSON.stringify({
      alerts: evidence.alerts.length,
      databaseRestore: "verified",
      deploymentRecovery: "verified",
      diagnostics: evidence.diagnostics.length,
      environment: evidence.environment,
      status: "operational-evidence-valid"
    })}\n`
  )
} catch (error) {
  if (error instanceof ZodError) {
    process.stderr.write(`${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")}\n`)
    process.exitCode = 1
  } else {
    throw error
  }
}
