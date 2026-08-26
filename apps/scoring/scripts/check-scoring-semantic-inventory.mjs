import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import process from "node:process"
import { parseSync, visitorKeys } from "oxc-parser"

const defaultAppDirectory = resolve(import.meta.dirname, "..")
const appDirectory = process.argv.at(2) === "--app-directory" ? resolve(process.argv.at(3) ?? "") : defaultAppDirectory
const inventoryPath = resolve(appDirectory, "docs/c17-scoring-semantic-inventory.json")
const expectedCategories = [
  "qualification",
  "resistance",
  "uncertainty",
  "grounding",
  "fault",
  "diagnostic",
  "lockout",
  "reset",
  "timing",
  "ordering"
]
const branchNodeTypes = new Set([
  "IfStatement",
  "ConditionalExpression",
  "SwitchStatement",
  "LogicalExpression",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement"
])
const functionNodeTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"])

function fail(message) {
  throw new Error(`CW-02 semantic inventory: ${message}`)
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function sameStrings(actual, expected) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected))
}

function productionTypeScriptSources(directory) {
  const sources = []
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry)
    if (statSync(path).isDirectory()) {
      sources.push(...productionTypeScriptSources(path))
      continue
    }
    if ((path.endsWith(".ts") || path.endsWith(".tsx")) && !path.includes(".test."))
      sources.push(relative(appDirectory, path).replaceAll("\\", "/"))
  }
  return sources
}

const productionSources = [
  ...productionTypeScriptSources(resolve(appDirectory, "src")),
  ...productionTypeScriptSources(resolve(appDirectory, "simulator/src"))
]
const productionSourceSet = new Set(productionSources)

function sourceText(source) {
  return readFileSync(resolve(appDirectory, source), "utf8")
}

function relativeImportSource(source, specifier) {
  if (!specifier.startsWith(".")) return null
  const resolved = resolve(appDirectory, dirname(source), specifier)
  const bare = relative(appDirectory, resolved)
    .replaceAll("\\", "/")
    .replace(/\.(?:c|m)?(?:js|ts|tsx)$/u, "")
  const candidates = [`${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`, `${bare}/index.tsx`]
  return candidates.find((candidate) => productionSourceSet.has(candidate)) ?? null
}

function importsFor(source) {
  const program = parseSync(source, sourceText(source)).program
  const imports = []
  const staticModuleSpecifier = (node) => {
    if (node?.type === "Literal" && typeof node.value === "string") return node.value
    if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
      return node.quasis[0]?.value?.cooked ?? node.quasis[0]?.value?.raw ?? null
    if (node?.type === "BinaryExpression" && node.operator === "+") {
      const left = staticModuleSpecifier(node.left)
      const right = staticModuleSpecifier(node.right)
      if (left !== null && right !== null) return left + right
    }
    return null
  }
  const add = (specifier) => {
    if (typeof specifier !== "string") return
    const resolved = relativeImportSource(source, specifier)
    if (resolved !== null) imports.push(resolved)
  }
  const visit = (node) => {
    if (node === null || typeof node !== "object") return
    if (node.type === "ImportDeclaration") {
      const hasRuntimeSpecifier =
        node.importKind !== "type" &&
        (node.specifiers.length === 0 || node.specifiers.some((specifier) => specifier.importKind !== "type"))
      if (hasRuntimeSpecifier) add(node.source.value)
    } else if (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") {
      const hasRuntimeSpecifier =
        node.exportKind !== "type" &&
        (node.type === "ExportAllDeclaration" || node.specifiers.some((specifier) => specifier.exportKind !== "type"))
      if (hasRuntimeSpecifier) add(node.source?.value)
    } else if (node.type === "ImportExpression") {
      const specifier = staticModuleSpecifier(node.source)
      if (specifier === null) fail(`${source} has an unresolved dynamic module specifier`)
      add(specifier)
    } else if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "require") {
      const specifier = staticModuleSpecifier(node.arguments[0]?.expression ?? node.arguments[0])
      if (specifier === null) fail(`${source} has an unresolved require module specifier`)
      add(specifier)
    }
    for (const key of visitorKeys[node.type] ?? []) {
      const child = node[key]
      if (Array.isArray(child)) for (const item of child) visit(item)
      else visit(child)
    }
  }
  visit(program)
  return sorted([...new Set(imports)])
}

function branchSignature(source) {
  const text = sourceText(source)
  const branchIds = []
  const visit = (node, functionAnchor = "<module>", ordinals = {}) => {
    if (node === null || typeof node !== "object") return
    const nextFunctionAnchor = functionNodeTypes.has(node.type) ? (node.id?.name ?? "<anonymous>") : functionAnchor
    if (branchNodeTypes.has(node.type)) {
      const probe = node.type === "LogicalExpression" ? node : (node.test ?? node.discriminant ?? node)
      const normalizedPredicate = text.slice(probe.start, probe.end).replace(/\s+/gu, " ").trim()
      const ordinalKey = `${nextFunctionAnchor}:${node.type}`
      const ordinal = (ordinals[ordinalKey] ?? 0) + 1
      ordinals[ordinalKey] = ordinal
      branchIds.push(`${ordinalKey}:${ordinal}:${digest(normalizedPredicate).slice(0, 16)}`)
    }
    for (const key of visitorKeys[node.type] ?? []) {
      const child = node[key]
      if (Array.isArray(child)) for (const item of child) visit(item, nextFunctionAnchor, ordinals)
      else visit(child, nextFunctionAnchor, ordinals)
    }
  }
  visit(parseSync(source, text).program)
  return {
    branchCount: branchIds.length,
    branchSignatureDigest: digest(branchIds.join("\n")),
    sourceDigest: digest(text.replaceAll("\r\n", "\n"))
  }
}

function isStandaloneScoringCandidate(source) {
  return /(?:\b\w*ScoringState\b|\b(?:advance|create)\w*Scoring\b|\bqualified-hit\b|scorer)/iu.test(
    `${source}\n${sourceText(source)}`
  )
}

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
if (
  inventory.format !== "c17-scoring-semantic-inventory" ||
  inventory.schemaVersion !== 1 ||
  inventory.task !== "CW-02"
)
  fail("format, version, or task is invalid")
if (!sameStrings(inventory.requiredCategories ?? [], expectedCategories)) fail("required categories are not exact")
if (inventory.branchSignatureFormat !== "function-anchor:ast-kind:ordinal:predicate-sha256-16")
  fail("branch signature format is invalid")
const retiredProductionSourceSet = inventory.retiredProductionSourceSet ?? []
if (
  !Array.isArray(retiredProductionSourceSet) ||
  retiredProductionSourceSet.some((source) => typeof source !== "string") ||
  new Set(retiredProductionSourceSet).size !== retiredProductionSourceSet.length
)
  fail("retired production source set is invalid")
for (const source of retiredProductionSourceSet)
  if (productionSourceSet.has(source)) fail(`${source} is a retired production source that reappeared`)
if (!sameStrings(inventory.productionSourceSet ?? [], productionSources))
  fail("production TypeScript source set changed")

const ownership = inventory.ownership ?? []
const ownershipBySource = new Map(ownership.map((entry) => [entry.source, entry]))
if (ownershipBySource.size !== ownership.length) fail("duplicate ownership source")
if (!sameStrings(ownershipBySource.keys(), productionSources))
  fail("ownership source set differs from production source set")

const ownedCategories = new Set()
for (const source of productionSources) {
  if (!productionSourceSet.has(source)) fail(`${source} does not exist`)
  const entry = ownershipBySource.get(source)
  if (entry.policy !== "c17-core" && entry.policy !== "adapter") fail(`${source} has an invalid policy`)
  if (!Array.isArray(entry.successorTasks) || entry.successorTasks.length === 0) fail(`${source} has no successor task`)
  if (entry.policy === "adapter" && (typeof entry.allowed !== "string" || typeof entry.prohibited !== "string"))
    fail(`${source} adapter policy is incomplete`)
  if (typeof entry.sourceDigest !== "string" || !/^[a-f0-9]{64}$/u.test(entry.sourceDigest))
    fail(`${source} has no valid source digest`)
  if (!Number.isInteger(entry.branchCount) || entry.branchCount < 0) fail(`${source} has no valid branch count`)
  if (typeof entry.branchSignatureDigest !== "string" || !/^[a-f0-9]{64}$/u.test(entry.branchSignatureDigest))
    fail(`${source} has no valid branch signature digest`)
  if (!Array.isArray(entry.branchFamilies) || entry.branchFamilies.length === 0) fail(`${source} has no branch family`)
  for (const family of entry.branchFamilies) {
    if (typeof family.id !== "string" || !Array.isArray(family.categories) || family.categories.length === 0)
      fail(`${source} has an invalid branch family`)
    for (const category of family.categories) {
      if (!expectedCategories.includes(category)) fail(`${source} uses unknown category ${category}`)
      ownedCategories.add(category)
    }
  }
  const actual = branchSignature(source)
  if (entry.sourceDigest !== actual.sourceDigest) fail(`${source} changed without an inventory refresh`)
  if (entry.branchCount !== actual.branchCount || entry.branchSignatureDigest !== actual.branchSignatureDigest)
    fail(`${source} branch signatures differ from the reviewed inventory`)
}
if (!sameStrings(ownedCategories, expectedCategories)) fail("a required semantic category is unowned")

const allImports = new Map(productionSources.map((source) => [source, importsFor(source)]))
const reverseImports = new Map(productionSources.map((source) => [source, []]))
for (const [source, imports] of allImports) for (const imported of imports) reverseImports.get(imported)?.push(source)
const coreSources = ownership.filter((entry) => entry.policy === "c17-core").map((entry) => entry.source)
const runtimeConsumerClosure = new Set(coreSources)
const pendingConsumers = [...coreSources]
while (pendingConsumers.length > 0) {
  const source = pendingConsumers.pop()
  for (const consumer of reverseImports.get(source) ?? []) {
    if (!runtimeConsumerClosure.has(consumer)) {
      runtimeConsumerClosure.add(consumer)
      pendingConsumers.push(consumer)
    }
  }
}
if (!sameStrings(inventory.runtimeConsumerClosure ?? [], runtimeConsumerClosure))
  fail("transitive scoring-consumer closure changed")
for (const source of runtimeConsumerClosure)
  if (!ownershipBySource.has(source)) fail(`${source} is an unowned scoring consumer`)
for (const source of productionSources) {
  if (isStandaloneScoringCandidate(source) && !ownershipBySource.has(source))
    fail(`${source} is an unowned standalone scoring source`)
}

process.stdout.write("CW-02 branch inventory, source-change gate, and transitive consumer closure pass.\n")
