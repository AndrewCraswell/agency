import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { auditFrInventory } from "../src/ingestion/regulations/fr-inventory-audit.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    metadata: { type: "string" },
    output: { type: "string" }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const report = await auditFrInventory(
  JSON.parse(await readFile(path(values.manifest), "utf8")),
  JSON.parse(await readFile(path(values.metadata), "utf8"))
)
await writeFile(path(values.output), JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(JSON.stringify(report))
if (report.inventoryGaps > 0) {
  process.exitCode = 1
}
