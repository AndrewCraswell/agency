import { execFileSync } from "node:child_process"
import { appendFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

const outputNames = ["web", "mcp", "core", "database", "ingestion"]
const emptyTreeSha = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

const rootNodeFiles = new Set(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json"])
const sharedRuntimePrefixes = ["packages/oxlint-config/", "packages/typescript-config/"]
const databaseRoot = "packages/legislation-core/src/database/"
const migrationToolingPaths = new Set([
  "apps/legislation-web/scripts/migrate.ts",
  "packages/legislation-core/drizzle.config.ts",
  "packages/legislation-core/scripts/database.ts",
  `${databaseRoot}migrate.ts`
])

function hasPrefix(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix))
}

function normalizePath(rawPath) {
  return rawPath.replaceAll("\\", "/").replace(/^\.?\//, "")
}

export function isLegislationDatabaseChange(rawPath) {
  const path = normalizePath(rawPath)
  const migrationArtifact =
    /^packages\/legislation-core\/src\/database\/migrations\/\d{4}_[a-z0-9_]+\.sql$/.test(path) ||
    path === `${databaseRoot}migrations/meta/_journal.json` ||
    /^packages\/legislation-core\/src\/database\/migrations\/meta\/\d{4}_snapshot\.json$/.test(path)
  const schemaDefinition =
    path.startsWith(`${databaseRoot}schema/`) &&
    /\.(?:sql|ts)$/.test(path) &&
    !/\.(?:integration\.)?(?:spec|test)\.ts$/.test(path)

  return migrationArtifact || schemaDefinition || migrationToolingPaths.has(path)
}

export function classifyLegislationChanges(changedPaths) {
  const result = Object.fromEntries(outputNames.map((name) => [name, false]))

  for (const rawPath of changedPaths) {
    const path = normalizePath(rawPath)
    const rootNodeChange = rootNodeFiles.has(path)
    const coreChange = path.startsWith("packages/legislation-core/")
    const databaseChange = isLegislationDatabaseChange(path)
    const sharedRuntimeChange = hasPrefix(path, sharedRuntimePrefixes)

    result.core ||= coreChange
    result.database ||= databaseChange
    result.web ||=
      path.startsWith("apps/legislation-web/") ||
      path.startsWith("packages/legislation-diffing/") ||
      path.startsWith("packages/storybook-config/") ||
      coreChange ||
      sharedRuntimeChange ||
      rootNodeChange
    result.mcp ||= path.startsWith("apps/legislation-mcp/") || coreChange || sharedRuntimeChange || rootNodeChange
    result.ingestion ||=
      path.startsWith("apps/legislation-ingestion/") || coreChange || sharedRuntimeChange || rootNodeChange
  }

  return result
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing required ${name} argument`)
  return process.argv[index + 1]
}

function changedPathsBetween(base, head) {
  const resolvedBase = /^0+$/.test(base) ? emptyTreeSha : base
  return execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", resolvedBase, head], {
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .filter(Boolean)
}

async function main() {
  const base = readArgument("--base")
  const head = readArgument("--head")
  const changedPaths = changedPathsBetween(base, head)
  const changes = classifyLegislationChanges(changedPaths)
  const lines = outputNames.map((name) => `${name}=${String(changes[name])}`)

  console.log(JSON.stringify({ base, head, changedPaths, changes }, null, 2))
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
