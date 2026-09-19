import { createHash } from "node:crypto"
import { load } from "cheerio"
import { XMLParser } from "fast-xml-parser"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { scraperBillProfiles } from "./scraper-bill-profiles.js"

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const item = z.object({ bill: z.string().regex(scraperBillProfiles.nc.identifier) })
const feed = z.object({ rss: z.object({ channel: z.object({ item: z.array(item).min(1).max(20_000) }) }) })

type BillPlan =
  | ReturnType<typeof planNcBillBatches>
  | ReturnType<typeof planAkBillBatches>
  | ReturnType<typeof planWaBillBatches>

/** A successful extraction of a subset is not a successful frozen batch. */
export function assertScraperBillBatchScope(
  plan: BillPlan,
  batchId: string,
  request: { jurisdiction: string; domain: string; session: string | null; bill_ids?: readonly string[] | null }
) {
  const batch = plan.batches.find((entry) => entry.id === batchId)
  if (!batch) {
    throw new Error("Batch is not part of this frozen inventory")
  }
  const ids = request.bill_ids
  if (
    request.jurisdiction !== plan.jurisdiction ||
    request.domain !== "bills" ||
    request.session !== plan.session ||
    !ids ||
    ids.length !== batch.billIds.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !batch.billIds.includes(id))
  ) {
    throw new Error("Archived extraction does not cover the exact frozen batch")
  }
  return batch
}

export async function archiveNcBillPlan(store: ArtifactStore, xml: { H: string; S: string }, cycleId: string) {
  const plan = planNcBillBatches(xml, cycleId)
  const prefix = `openstates/scraper-plans/nc/2025/${cycleId}`
  return archiveFrozenBillPlan(store, prefix, plan, { "H.xml": xml.H, "S.xml": xml.S })
}

export async function readScraperBillPlan(store: Pick<ArtifactStore, "read">, path: string) {
  const match =
    /^openstates\/scraper-plans\/(nc\/2025|ak\/34|wa\/2025-2026)\/([A-Za-z0-9][A-Za-z0-9-]{0,100})\/plan\.json$/.exec(
      path
    )
  const cycleId = match?.[2]
  if (!cycleId) {
    throw new Error("Invalid frozen discovery path")
  }
  const prefix = path.slice(0, -"plan.json".length)
  const plan =
    match?.[1] === "wa/2025-2026"
      ? planWaBillBatches(
          {
            "2025": Buffer.from(await store.read(prefix + "2025.xml")).toString("utf8"),
            "2026": Buffer.from(await store.read(prefix + "2026.xml")).toString("utf8")
          },
          cycleId
        )
      : match?.[1] === "ak/34"
        ? planAkBillBatches(Buffer.from(await store.read(`${prefix}range.html`)).toString("utf8"), cycleId)
        : planNcBillBatches(
            {
              H: Buffer.from(await store.read(`${prefix}H.xml`)).toString("utf8"),
              S: Buffer.from(await store.read(`${prefix}S.xml`)).toString("utf8")
            },
            cycleId
          )
  if (Buffer.from(await store.read(path)).toString("utf8") !== JSON.stringify(plan)) {
    throw new Error("Frozen discovery checksum mismatch")
  }
  return plan
}

/** Freeze both feeds before scheduling; no mutable feed offsets or success inferred from file counts. */
export function planNcBillBatches(xml: { H: string; S: string }, cycleId: string) {
  z.string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(cycleId)
  const parser = new XMLParser({ parseTagValue: false, processEntities: false, isArray: (name) => name === "item" })
  const inventories = (["H", "S"] as const).map((chamber) => {
    const text = xml[chamber]
    if (Buffer.byteLength(text) > 16 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) {
      throw new Error("Unsafe NC discovery feed")
    }
    const parsed: unknown = parser.parse(text)
    const ids = feed.parse(parsed).rss.channel.item.map((entry) => entry.bill)
    if (new Set(ids).size !== ids.length || ids.some((id) => !id.startsWith(chamber))) {
      throw new Error("Duplicate or wrong-chamber discovery record")
    }
    return {
      chamber,
      sha256: digest(text),
      ids: ids.toSorted((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
    }
  })
  return {
    jurisdiction: "nc" as const,
    session: scraperBillProfiles.nc.session,
    ...partitionBillInventory(inventories, cycleId, "nc/2025")
  }
}

function partitionBillInventory(
  inventories: Array<{ chamber: "H" | "S"; sha256: string; ids: string[] }>,
  cycleId: string,
  scope: string
) {
  z.string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(cycleId)
  const inventoryId = digest(
    JSON.stringify([scope, cycleId, inventories.map(({ chamber, ids }) => ({ chamber, ids }))])
  )
  const batches = inventories.flatMap(({ ids }) => {
    const output: Array<{ id: string; billIds: string[] }> = []
    for (let offset = 0; offset < ids.length; offset += 10) {
      const billIds = ids.slice(offset, offset + 10)
      output.push({ id: digest(JSON.stringify([inventoryId, billIds])), billIds })
    }
    return output
  })
  return { cycleId, inventoryId, inventories, batches }
}

const washingtonRecord = z.object({
  Biennium: z.literal("2025-26"),
  BillId: z.string(),
  BillNumber: z.string().regex(/^[1-9][0-9]{0,4}$/),
  OriginalAgency: z.enum(["House", "Senate"]),
  ShortLegislationType: z.object({ ShortLegislationType: z.enum(["B", "CR", "JM", "JR", "R", "GA", "I"]) })
})

/** Both years contain revisions and carryovers. Deduplicate only after checking source identity agreement. */
export function planWaBillBatches(xml: { "2025": string; "2026": string }, cycleId: string) {
  const parser = new XMLParser({
    parseTagValue: false,
    processEntities: false,
    ignoreAttributes: false,
    isArray: (name) => name === "LegislationInfo"
  })
  const ids = new Set<string>()
  const sources = [xml["2025"], xml["2026"]]
  for (const source of sources) {
    if (Buffer.byteLength(source) > 16 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(source)) {
      throw new Error("Unsafe Washington discovery feed")
    }
    const parsed: unknown = parser.parse(source)
    const rows = z
      .object({
        ArrayOfLegislationInfo: z.object({
          "@_xmlns": z.literal("http://WSLWebServices.leg.wa.gov/"),
          LegislationInfo: z.array(washingtonRecord).min(1).max(20_000)
        })
      })
      .parse(parsed).ArrayOfLegislationInfo.LegislationInfo
    for (const row of rows) {
      const chamber = row.OriginalAgency === "House" ? "H" : "S"
      const type = row.ShortLegislationType.ShortLegislationType
      if (type === "GA" || type === "I") {
        const initiative = /^([HS])I IL(\d{2})-(\d{3})$/.exec(row.BillId)
        const excludedId = initiative ? initiative[1] + "I " + Number(initiative[2]! + initiative[3]!) : row.BillId
        if (excludedId !== chamber + type + " " + row.BillNumber || (type === "GA" && Number(row.BillNumber) < 9000)) {
          throw new Error("Washington excluded record identity mismatch")
        }
        continue // Appointments and initiatives are outside the reviewed bill scraper's scope.
      }
      const match = /^(?:[1-9]?[ES])*([HS](?:B|CR|JM|JR|R)) ([1-9][0-9]{0,4})$/.exec(row.BillId)
      if (!match || match[1] !== chamber + type || match[2] !== row.BillNumber || Number(row.BillNumber) >= 9000) {
        throw new Error("Washington discovery source identity mismatch")
      }
      ids.add(match[1] + " " + match[2])
    }
  }
  const inventories = (["H", "S"] as const).map((chamber) => {
    const selected = [...ids]
      .filter((id) => id.startsWith(chamber))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    if (!selected.length) throw new Error("Missing Washington chamber inventory")
    return { chamber, ids: selected, sha256: digest(JSON.stringify(sources.map(digest))) }
  })
  return {
    jurisdiction: "wa" as const,
    session: scraperBillProfiles.wa.session,
    ...partitionBillInventory(inventories, cycleId, "wa/2025-2026")
  }
}

export async function archiveWaBillPlan(
  store: ArtifactStore,
  xml: { "2025": string; "2026": string },
  cycleId: string
) {
  const plan = planWaBillBatches(xml, cycleId)
  return archiveFrozenBillPlan(store, "openstates/scraper-plans/wa/2025-2026/" + cycleId, plan, {
    "2025.xml": xml["2025"],
    "2026.xml": xml["2026"]
  })
}

async function archiveFrozenBillPlan<T extends BillPlan>(
  store: ArtifactStore,
  prefix: string,
  plan: T,
  sources: Record<string, string>
) {
  for (const [name, value] of [...Object.entries(sources), ["plan.json", JSON.stringify(plan)]]) {
    const path = prefix + "/" + name
    const bytes = Buffer.from(value!)
    await store.put(path, bytes)
    if (!Buffer.from(await store.read(path)).equals(bytes)) throw new Error("Frozen discovery feed conflict")
  }
  return { path: prefix + "/plan.json", plan }
}

/** Alaska publishes one range table. Validate both chambers and every identity before freezing any work. */
export function planAkBillBatches(html: string, cycleId: string) {
  if (Buffer.byteLength(html) > 16 * 1024 * 1024 || /<!ENTITY/i.test(html)) {
    throw new Error("Unsafe Alaska discovery page")
  }
  const $ = load(html)
  const ids = $("tr td:first-child nobr:first-child a:first-child")
    .toArray()
    .map((node) => {
      const identifier = $(node).text().replace(/\s/g, "")
      z.string().regex(scraperBillProfiles.ak.identifier).parse(identifier)
      const url = new URL($(node).attr("href") ?? "", "https://www.akleg.gov/basis/Bill/Range/34")
      if (
        url.origin !== "https://www.akleg.gov" ||
        url.pathname !== "/basis/Bill/Detail/34" ||
        url.searchParams.get("Root")?.replace(/\s/g, "") !== identifier
      ) {
        throw new Error("Alaska discovery source identity mismatch")
      }
      return identifier
    })
  if (new Set(ids).size !== ids.length || ids.length > 20_000) {
    throw new Error("Duplicate or oversized Alaska discovery inventory")
  }
  const inventories = (["H", "S"] as const).map((chamber) => {
    const selected = ids
      .filter((id) => id.startsWith(chamber))
      .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
    if (!selected.length) {
      throw new Error("Missing Alaska chamber inventory")
    }
    return { chamber, ids: selected, sha256: digest(html) }
  })
  return {
    jurisdiction: "ak" as const,
    session: scraperBillProfiles.ak.session,
    ...partitionBillInventory(inventories, cycleId, "ak/34")
  }
}

export async function archiveAkBillPlan(store: ArtifactStore, html: string, cycleId: string) {
  const plan = planAkBillBatches(html, cycleId)
  const prefix = `openstates/scraper-plans/ak/34/${cycleId}`
  return archiveFrozenBillPlan(store, prefix, plan, { "range.html": html })
}

/** Only receipts from canonical promotion qualify. Extraction success alone cannot advance the session. */
export function pendingScraperBillBatches(
  plan: BillPlan,
  receipts: readonly {
    inventoryId: string
    batchId: string
    status: "promoted" | "extracted" | "failed"
  }[]
) {
  const expected = new Set(plan.batches.map((batch) => batch.id))
  if (receipts.some((receipt) => receipt.inventoryId !== plan.inventoryId || !expected.has(receipt.batchId))) {
    throw new Error("Batch receipt does not belong to frozen inventory")
  }
  const completed = new Set(
    receipts.filter((receipt) => receipt.status === "promoted").map((receipt) => receipt.batchId)
  )
  const pending = plan.batches.filter((batch) => !completed.has(batch.id))
  return { complete: pending.length === 0, pending }
}
