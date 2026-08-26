import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const appDirectory = resolve(import.meta.dirname, "..")
const checker = resolve(appDirectory, "scripts/check-scoring-semantic-inventory.mjs")

function sourceDigest(source) {
  return createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex")
}

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "cw02-semantic-inventory-"))
  try {
    cpSync(resolve(appDirectory, "src"), resolve(directory, "src"), { recursive: true })
    cpSync(resolve(appDirectory, "simulator/src"), resolve(directory, "simulator/src"), { recursive: true })
    mkdirSync(resolve(directory, "docs"), { recursive: true })
    cpSync(
      resolve(appDirectory, "docs/c17-scoring-semantic-inventory.json"),
      resolve(directory, "docs/c17-scoring-semantic-inventory.json")
    )
    run(directory)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

function expectFailure(directory, expected) {
  const result = spawnSync(process.execPath, [checker, "--app-directory", directory], { encoding: "utf8" })
  if (result.status === 0 || !result.stderr.includes(expected))
    throw new Error(`Expected ${expected}; received ${result.stdout}${result.stderr}`)
}

fixture((directory) => {
  appendFileSync(resolve(directory, "src/epee.ts"), "\nif (true) throw new Error('added branch')\n")
  expectFailure(directory, "changed without an inventory refresh")
})

fixture((directory) => {
  const sourcePath = resolve(directory, "src/epee.ts")
  const changed = readFileSync(sourcePath, "utf8").replace(
    "contact.isTipClosed && !contact.isGrounded",
    "contact.isTipClosed"
  )
  writeFileSync(sourcePath, changed)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.ownership.find((entry) => entry.source === "src/epee.ts").sourceDigest = sourceDigest(changed)
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "branch signatures differ")
})

fixture((directory) => {
  const sourcePath = resolve(directory, "src/epee.ts")
  const changed = readFileSync(sourcePath, "utf8").replace(
    "contact.isTipClosed && !contact.isGrounded",
    "!contact.isTipClosed && !contact.isGrounded"
  )
  writeFileSync(sourcePath, changed)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.ownership.find((entry) => entry.source === "src/epee.ts").sourceDigest = sourceDigest(changed)
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "branch signatures differ")
})

fixture((directory) => {
  writeFileSync(
    resolve(directory, "src/rogue-scorer.ts"),
    "export function rogueScorer(value: boolean) { if (value) return 1; return 0 }\n"
  )
  expectFailure(directory, "production TypeScript source set changed")
})

fixture((directory) => {
  writeFileSync(resolve(directory, "src/device.ts"), "export const retiredDeviceBoundary = true\n")
  expectFailure(directory, "retired production source that reappeared")
})

fixture((directory) => {
  const sourcePath = resolve(directory, "src/event-journal.ts")
  const changed = `${readFileSync(sourcePath, "utf8")}\nexport function journalMutation(value: boolean) { if (value) return value; return false }\n`
  writeFileSync(sourcePath, changed)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.ownership.find((entry) => entry.source === "src/event-journal.ts").sourceDigest = sourceDigest(changed)
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "branch signatures differ")
})

fixture((directory) => {
  const sourcePath = resolve(directory, "src/event-journal.ts")
  const changed = readFileSync(sourcePath, "utf8").replace(
    'typeof value === "number" && Number.isSafeInteger(value)',
    'typeof value === "string" && Number.isSafeInteger(value)'
  )
  writeFileSync(sourcePath, changed)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.ownership.find((entry) => entry.source === "src/event-journal.ts").sourceDigest = sourceDigest(changed)
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "branch signatures differ")
})

fixture((directory) => {
  const rogueSource = 'import "./epee.js"\nexport const rogueDisplay = true\n'
  writeFileSync(resolve(directory, "src/rogue-display.ts"), rogueSource)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.productionSourceSet.push("src/rogue-display.ts")
  inventory.ownership.push({
    source: "src/rogue-display.ts",
    sourceDigest: sourceDigest(rogueSource),
    branchCount: 0,
    branchSignatureDigest: createHash("sha256").update("").digest("hex"),
    policy: "adapter",
    successorTasks: ["CW-17"],
    allowed: "Render an already-authoritative display state.",
    prohibited: "May not derive or alter a scoring outcome.",
    branchFamilies: [{ id: "ROGUE-DISPLAY", categories: ["ordering"] }]
  })
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "transitive scoring-consumer closure changed")
})

fixture((directory) => {
  const rogueSource = 'export { createEpeeScoringState } from "./epee.js"\n'
  writeFileSync(resolve(directory, "src/rogue-reexport.ts"), rogueSource)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.productionSourceSet.push("src/rogue-reexport.ts")
  inventory.ownership.push({
    source: "src/rogue-reexport.ts",
    sourceDigest: sourceDigest(rogueSource),
    branchCount: 0,
    branchSignatureDigest: createHash("sha256").update("").digest("hex"),
    policy: "adapter",
    successorTasks: ["CW-17"],
    allowed: "Re-export an already-authoritative display state.",
    prohibited: "May not derive or alter a scoring outcome.",
    branchFamilies: [{ id: "ROGUE-REEXPORT", categories: ["ordering"] }]
  })
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "transitive scoring-consumer closure changed")
})

fixture((directory) => {
  const rogueSource = 'export async function loadRogue() { return import("./epee.js") }\n'
  writeFileSync(resolve(directory, "src/rogue-dynamic.ts"), rogueSource)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.productionSourceSet.push("src/rogue-dynamic.ts")
  inventory.ownership.push({
    source: "src/rogue-dynamic.ts",
    sourceDigest: sourceDigest(rogueSource),
    branchCount: 0,
    branchSignatureDigest: createHash("sha256").update("").digest("hex"),
    policy: "adapter",
    successorTasks: ["CW-17"],
    allowed: "Load an already-authoritative display state.",
    prohibited: "May not derive or alter a scoring outcome.",
    branchFamilies: [{ id: "ROGUE-DYNAMIC", categories: ["ordering"] }]
  })
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "transitive scoring-consumer closure changed")
})

fixture((directory) => {
  const rogueSource = "export async function loadRogue(specifier: string) { return import(specifier) }\n"
  writeFileSync(resolve(directory, "src/rogue-unresolved.ts"), rogueSource)
  const inventoryPath = resolve(directory, "docs/c17-scoring-semantic-inventory.json")
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"))
  inventory.productionSourceSet.push("src/rogue-unresolved.ts")
  inventory.ownership.push({
    source: "src/rogue-unresolved.ts",
    sourceDigest: sourceDigest(rogueSource),
    branchCount: 0,
    branchSignatureDigest: createHash("sha256").update("").digest("hex"),
    policy: "adapter",
    successorTasks: ["CW-17"],
    allowed: "Load an explicitly reviewed authoritative module.",
    prohibited: "May not conceal an unresolved scoring consumer.",
    branchFamilies: [{ id: "ROGUE-UNRESOLVED", categories: ["ordering"] }]
  })
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  expectFailure(directory, "unresolved dynamic module specifier")
})

process.stdout.write("CW-02 adversarial branch and consumer-closure checks pass.\n")
