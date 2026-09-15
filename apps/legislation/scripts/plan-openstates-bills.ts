import { randomUUID } from "node:crypto"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { RetryingHttpClient, readBounded } from "../src/ingestion/http-client.js"
import { archiveAkBillPlan, archiveNcBillPlan } from "../src/ingestion/openstates/scraper-batches.js"

const [jurisdiction, directory] = process.argv.slice(2)
if (!directory || !["ak", "nc"].includes(jurisdiction ?? "")) {
  throw new Error("Usage: plan-openstates-bills <ak|nc> <local-archive-directory>")
}
const client = new RetryingHttpClient({ maxAttempts: 2, requestTimeoutMs: 30_000, minimumIntervalMs: 1000 })
const read = async (url: string) =>
  Buffer.from(await readBounded(await client.get(new URL(url)), 16 * 1024 * 1024)).toString("utf8")
const store = new LocalArtifactStore(directory)
const cycle = `local-${randomUUID()}`
const frozen =
  jurisdiction === "ak"
    ? await archiveAkBillPlan(store, await read("https://www.akleg.gov/basis/Bill/Range/34"), cycle)
    : await archiveNcBillPlan(
        store,
        {
          H: await read("https://www.ncleg.gov/Legislation/Bills/FiledBillsFeed/2025/H"),
          S: await read("https://www.ncleg.gov/Legislation/Bills/FiledBillsFeed/2025/S")
        },
        cycle
      )
process.stdout.write(
  `${JSON.stringify({ planPath: frozen.path, jurisdiction, bills: frozen.plan.inventories.reduce((count, inventory) => count + inventory.ids.length, 0), batches: frozen.plan.batches.length, canonicalWrites: false })}\n`
)
