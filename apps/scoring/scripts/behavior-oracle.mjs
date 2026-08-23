import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryDirectory = resolve(applicationDirectory, "../..")
const oraclePath = resolve(applicationDirectory, "docs/behavior-oracle-manifest.json")
const goldenManifestPath = resolve(applicationDirectory, "docs/golden-scenario-manifest.json")
const mode = process.argv[2] ?? "--check"

const fixedArtifacts = [
  ["environment", ".nvmrc"],
  ["environment", "package.json"],
  ["environment", "pnpm-lock.yaml"],
  ["environment", "pnpm-workspace.yaml"],
  ["environment", "turbo.json"],
  ["environment", "packages/typescript-config/base.json"],
  ["environment", "packages/typescript-config/package.json"],
  ["environment", "apps/scoring/package.json"],
  ["environment", "apps/scoring/tsconfig.json"],
  ["environment", "apps/scoring/tsconfig.build.json"],
  ["environment", "apps/scoring/vitest.config.ts"],
  ["rules-1", "apps/scoring/docs/rules-1-release-review.md"],
  ["rules-1", "apps/scoring/src/bout-state.ts"],
  ["rules-1", "apps/scoring/src/bout-state.test.ts"],
  ["rules-1", "apps/scoring/src/epee.ts"],
  ["rules-1", "apps/scoring/src/epee.test.ts"],
  ["rules-1", "apps/scoring/src/foil.ts"],
  ["rules-1", "apps/scoring/src/foil.test.ts"],
  ["rules-1", "apps/scoring/src/sabre.ts"],
  ["rules-1", "apps/scoring/src/sabre.test.ts"],
  ["rules-1", "apps/scoring/src/scoring-property-harness.ts"],
  ["rules-1", "apps/scoring/src/scoring-property-harness.test.ts"],
  ["rules-1", "apps/scoring/src/timing-boundary.ts"],
  ["rules-1", "apps/scoring/src/timing-boundary.test.ts"],
  ["rules-1", "apps/scoring/src/timing-table.ts"],
  ["rules-1", "apps/scoring/src/timing-table.test.ts"],
  ["golden-corpus", "apps/scoring/docs/golden-scenario-manifest.json"],
  ["golden-corpus", "apps/scoring/docs/golden-scenario-manifest.schema.json"],
  ["golden-corpus", "apps/scoring/docs/golden-scenario.schema.json"],
  ["golden-corpus", "apps/scoring/scripts/run-scenarios.mjs"],
  ["golden-corpus", "apps/scoring/scripts/export-golden-vectors.mjs"],
  ["golden-corpus", "apps/scoring/src/scenario-runner.ts"],
  ["golden-corpus", "apps/scoring/src/scenario-runner.test.ts"],
  ["display-projection", "apps/scoring/src/scenario-display-projection.ts"],
  ["display-projection", "apps/scoring/src/scenario-display-projection.test.ts"],
  ["decision-schema", "apps/scoring/docs/decision-record-contract.md"],
  ["decision-schema", "apps/scoring/src/decision-record.ts"],
  ["decision-schema", "apps/scoring/src/decision-record.test.ts"],
  ["transport-frames", "apps/scoring/fixtures/transport-frame-golden.json"],
  ["transport-frames", "apps/scoring/src/transport-frame.ts"],
  ["transport-frames", "apps/scoring/src/transport-frame.test.ts"]
]

const testCommands = [
  "node apps/scoring/scripts/behavior-oracle.mjs --check",
  "pnpm --filter scoring test -- src/epee.test.ts src/foil.test.ts src/sabre.test.ts src/bout-state.test.ts src/timing-table.test.ts src/timing-boundary.test.ts src/scoring-property-harness.test.ts",
  "pnpm --filter scoring test -- src/decision-record.test.ts src/transport-frame.test.ts src/scenario-display-projection.test.ts",
  "pnpm --filter scoring run:scenarios -- docs/golden-scenario-manifest.json",
  "pnpm --filter scoring check:golden-vectors"
]

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}

function normalizedTextDigest(content) {
  return `sha256:${createHash("sha256").update(content.replaceAll("\r\n", "\n")).digest("hex")}`
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, item]) => [key, stableValue(item)])
  )
}

function canonicalJson(value) {
  return JSON.stringify(stableValue(value))
}

function withinRepository(path) {
  const local = relative(repositoryDirectory, path)
  return local !== "" && local !== ".." && !local.startsWith(`..${sep}`) && !local.includes(`${sep}..${sep}`)
}

async function createOracle() {
  const goldenManifest = JSON.parse(await readFile(goldenManifestPath, "utf8"))
  const goldenScenarioArtifacts = goldenManifest.scenarios.map((entry) => [
    "golden-scenario",
    `apps/scoring/docs/${entry.path}`
  ])
  const artifactInputs = [...fixedArtifacts, ...goldenScenarioArtifacts]
    .map(([category, path]) => ({ category, path }))
    .sort((left, right) => compareCodeUnits(left.path, right.path) || compareCodeUnits(left.category, right.category))

  const seen = new Set()
  const artifacts = []
  for (const artifact of artifactInputs) {
    if (seen.has(artifact.path)) continue
    seen.add(artifact.path)
    const absolutePath = resolve(repositoryDirectory, artifact.path)
    if (!withinRepository(absolutePath)) throw new RangeError(`Oracle artifact escapes repository: ${artifact.path}`)
    artifacts.push({
      category: artifact.category,
      path: artifact.path.replaceAll("\\", "/"),
      sha256: normalizedTextDigest(await readFile(absolutePath, "utf8"))
    })
  }

  const payload = {
    artifacts,
    commands: testCommands,
    format: "scoring-behavior-oracle",
    hashPolicy: "sha256 over UTF-8 text after CRLF-to-LF normalization",
    oracleRevision: "rules-1",
    schemaVersion: 1
  }
  return {
    ...payload,
    digest: `sha256:${createHash("sha256").update(canonicalJson(payload)).digest("hex")}`
  }
}

async function main() {
  if (!["--check", "--print", "--write"].includes(mode)) {
    fail("Usage: node scripts/behavior-oracle.mjs [--check|--print|--write]")
    return
  }

  const oracle = await createOracle()
  const rendered = `${JSON.stringify(oracle, null, 2)}\n`
  if (mode === "--print") {
    process.stdout.write(rendered)
    return
  }
  if (mode === "--write") {
    await writeFile(oraclePath, rendered, "utf8")
    process.stdout.write(`Wrote ${relative(applicationDirectory, oraclePath)} ${oracle.digest}\n`)
    return
  }

  let existing
  try {
    existing = await readFile(oraclePath, "utf8")
  } catch {
    fail("Behavior oracle manifest is missing; run with --write")
    return
  }
  if (existing !== rendered) {
    fail("Behavior oracle manifest is stale; inspect the change and run with --write only after review")
    return
  }
  process.stdout.write(`Behavior oracle verified ${oracle.digest}\n`)
}

await main()
