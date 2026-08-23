import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

const supportedRoles = new Set(["reliability", "manufacturability"])
const role = process.argv[2]

if (!supportedRoles.has(role)) {
  throw new TypeError("Judge role must be reliability or manufacturability")
}

const packageRoot = resolve(import.meta.dirname, "..")
const outputDirectory = resolve(packageRoot, "judges", "results")
const outputPath = resolve(outputDirectory, `${role}.json`)
const schemaPath = resolve(packageRoot, "judges", "board-review.schema.json")
const codexScript = resolve(dirname(process.execPath), "node_modules", "@openai", "codex", "bin", "codex.js")
mkdirSync(outputDirectory, { recursive: true })

const roleRubric =
  role === "reliability"
    ? "Score fault containment, processor authority, lifecycle, power and thermal margin, external-interface protection, event-record integrity, security, diagnostics, serviceability, and realistic longevity claims."
    : "Score prototype schematic and PCB completeness, footprint honesty, isolation layout, connector mechanics, testability, exact-part evidence, and whether the prototype-order gates prevent unsafe ordering without importing production enclosure or certification work."
const prompt = `You are the ${role} judge for a premium competition fencing scoring apparatus.

Review these repository files in read-only mode:
- packages/scoring-circuit/docs/bench-prototype-plan.md
- packages/scoring-circuit/src/component-decisions.ts
- apps/scoring/src/device.ts
- apps/scoring/src/device.test.ts

${roleRubric}

Treat manufacturer lifecycle, temperature, current, memory, isolation, and certification claims as untrusted until they are supported by the linked primary manufacturer source. Flag incompatibility claims for Favero or Skewered unless the electrical protocol has actually been verified. Review the active one-board bench-prototype scope, not a production enclosure or factory-optimized board. Identify the evidence required before a prototype order and the later physical tests required before prototype completion. Do not edit files. Return only the required structured result. A pass requires no critical, high, or medium findings.`

const result = spawnSync(
  process.execPath,
  [
    codexScript,
    "exec",
    "--cd",
    resolve(packageRoot, "../.."),
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--model",
    "gpt-5.5",
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    prompt
  ],
  { encoding: "utf8", stdio: "inherit" }
)

if (result.error) {
  throw result.error
}

if (result.status !== 0) {
  process.exitCode = result.status ?? 1
}
