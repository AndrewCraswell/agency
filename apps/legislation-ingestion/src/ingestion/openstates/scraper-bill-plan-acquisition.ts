import { createHash } from "node:crypto"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { archiveAkBillPlan, archiveNcBillPlan } from "./scraper-batches.js"

const MAXIMUM_INVENTORY_BYTES = 16 * 1024 * 1024
const alaskaInventoryUrl = "https://www.akleg.gov/basis/Bill/Range/34"
const northCarolinaInventoryUrls = {
  H: "https://www.ncleg.gov/Legislation/Bills/FiledBillsFeed/2025/H",
  S: "https://www.ncleg.gov/Legislation/Bills/FiledBillsFeed/2025/S"
} as const

async function fetchInventory(request: typeof fetch, url: string, expected: "html" | "xml") {
  const response = await request(url, {
    headers: { Accept: expected === "html" ? "text/html" : "application/xml,text/xml,application/rss+xml" },
    redirect: "error",
    signal: AbortSignal.timeout(45_000)
  })
  if (!response.ok) throw new Error(`State bill inventory returned status ${response.status}`)
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (expected === "html" ? !contentType.includes("text/html") : !/(?:xml|rss)/.test(contentType)) {
    throw new Error("State bill inventory returned an unexpected content type")
  }
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAXIMUM_INVENTORY_BYTES) {
    throw new Error("State bill inventory exceeds the source size limit")
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAXIMUM_INVENTORY_BYTES) {
    throw new Error("State bill inventory has an invalid source size")
  }
  return Buffer.from(bytes).toString("utf8")
}

function cycleId(state: "ak" | "nc", sources: readonly string[]) {
  return `${state}-bills-${createHash("sha256").update(sources.join("\u001f")).digest("hex").slice(0, 32)}`
}

/** Acquire and freeze the complete publisher bill inventory before any extraction batch is dispatched. */
export async function acquireStateBillPlan(
  store: ArtifactStore,
  state: "ak" | "nc",
  dependencies: { fetch?: typeof fetch } = {}
) {
  const request = dependencies.fetch ?? fetch
  if (state === "ak") {
    const html = await fetchInventory(request, alaskaInventoryUrl, "html")
    const frozen = await archiveAkBillPlan(store, html, cycleId(state, [html]))
    return summarize(frozen)
  }
  const [house, senate] = await Promise.all([
    fetchInventory(request, northCarolinaInventoryUrls.H, "xml"),
    fetchInventory(request, northCarolinaInventoryUrls.S, "xml")
  ])
  const frozen = await archiveNcBillPlan(store, { H: house, S: senate }, cycleId(state, [house, senate]))
  return summarize(frozen)
}

function summarize(frozen: Awaited<ReturnType<typeof archiveAkBillPlan | typeof archiveNcBillPlan>>) {
  return {
    planPath: frozen.path,
    inventoryId: frozen.plan.inventoryId,
    batches: frozen.plan.batches.length,
    bills: frozen.plan.batches.reduce((sum, batch) => sum + batch.billIds.length, 0),
    state: frozen.plan.jurisdiction,
    session: frozen.plan.session
  }
}
