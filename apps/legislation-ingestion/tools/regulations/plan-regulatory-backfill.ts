import { readFile, writeFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { type InventoryEvidence } from "@repo/legislation-core/legal-text/contracts"
import { z } from "zod"
import { planRegulatoryBackfill, replayRegulatoryBackfill } from "../../src/ingestion/regulations/backfill-plan.js"
import { planRegulatoryDelivery } from "../../src/ingestion/regulations/delivery-plan.js"
import { createCachedRegulatoryInventoryReader } from "../../src/ingestion/regulations/inventory-evidence-cache.js"
import { RegulatorySourceClient } from "../../src/ingestion/regulations/source-client.js"

const { values } = parseArgs({
  options: {
    cutoff: { type: "string" },
    "ecfr-titles": { type: "string" },
    "fr-start": { type: "string" },
    "fr-end": { type: "string" },
    "cfr-years": { type: "string" },
    "cfr-titles": { type: "string" },
    output: { type: "string" },
    replay: { type: "string" },
    "delivery-output": { type: "string" },
    "inventory-directory": { type: "string" },
    "maximum-requests": { type: "string", default: "100" }
  }
})
function list(value: string | undefined) {
  if (value === undefined) {
    return []
  }
  if (value === "all") {
    return Array.from({ length: 50 }, (_, i) => i + 1)
  }
  return value.split(",").map((item) => z.coerce.number().int().parse(item))
}
const output = resolve(z.string().min(1).parse(values.output))
const replay =
  values.replay === undefined
    ? null
    : await replayRegulatoryBackfill(JSON.parse(await readFile(resolve(values.replay), "utf8")))
const client = new RegulatorySourceClient()
const maximumRequests = z.coerce.number().int().min(1).max(500).parse(values["maximum-requests"])
const inventoryDirectory = replay === null ? resolve(z.string().min(1).parse(values["inventory-directory"])) : null
const inventoryReader =
  inventoryDirectory === null
    ? null
    : createCachedRegulatoryInventoryReader({
        directory: inventoryDirectory,
        maximumRequests,
        fetchEvidence: (source, url) => client.inventory(source, url)
      })
const scope = replay?.scope ?? {
  cutoff: values.cutoff,
  ecfrTitles: list(values["ecfr-titles"]),
  federalRegister:
    values["fr-start"] === undefined && values["fr-end"] === undefined
      ? null
      : { start: values["fr-start"], end: values["fr-end"] },
  annualCfr:
    values["cfr-years"] === undefined && values["cfr-titles"] === undefined
      ? null
      : { years: list(values["cfr-years"]), titles: list(values["cfr-titles"]) }
}
const evidence: InventoryEvidence[] = []
try {
  const manifest = await planRegulatoryBackfill(scope, async (source, url) => {
    const retained = replay?.inventory.find((item) => item.sourceId === source && item.url === url)
    if (replay !== null && retained === undefined) {
      throw new Error("Replay is missing requested inventory")
    }
    if (retained !== undefined) {
      evidence.push(retained)
      return retained
    }
    if (inventoryReader === null) {
      throw new Error("Replay is missing requested inventory")
    }
    const result = await inventoryReader.read(source, url)
    evidence.push(result)
    return result
  })
  await mkdir(resolve(output, ".."), { recursive: true })
  await writeFile(output, JSON.stringify(manifest, null, 2), { flag: "wx" })
  if (values["delivery-output"] !== undefined) {
    const delivery = await planRegulatoryDelivery(manifest)
    const deliveryOutput = resolve(values["delivery-output"])
    await mkdir(resolve(deliveryOutput, ".."), { recursive: true })
    await writeFile(deliveryOutput, JSON.stringify(delivery, null, 2), { flag: "wx" })
  }
  process.stdout.write(
    `${JSON.stringify({ output, id: manifest.id, units: manifest.units.length, exclusions: manifest.exclusions, estimatedKnownBytes: manifest.estimatedKnownBytes, unknownSizeUnits: manifest.unknownSizeUnits, inventory: inventoryReader?.stats() ?? { replay: true }, canonicalWrites: false, status: manifest.status })}\n`
  )
} catch (error) {
  await mkdir(resolve(output, ".."), { recursive: true })
  const requestLimitReached = error instanceof Error && error.message.startsWith("inventory_request_limit_reached:")
  const receiptPath = `${output}.${requestLimitReached ? "progress" : "failure"}-${Date.now()}.json`
  await writeFile(
    receiptPath,
    JSON.stringify(
      {
        status: requestLimitReached ? "request_limit_reached" : "failed",
        resumable: requestLimitReached,
        scope,
        evidence,
        inventoryDirectory,
        inventory: inventoryReader?.stats() ?? { replay: true },
        canonicalWrites: false,
        error: error instanceof Error ? error.message : "Planning failed"
      },
      null,
      2
    ),
    { flag: "wx" }
  )
  if (requestLimitReached) {
    process.stdout.write(
      `${JSON.stringify({ status: "request_limit_reached", receiptPath, inventory: inventoryReader?.stats() })}\n`
    )
    process.exitCode = 2
  } else {
    throw error
  }
}
