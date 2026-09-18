import { isDeepStrictEqual } from "node:util"
import {
  acquisitionUnitSchema,
  canonicalScope,
  digest,
  manifestIdentity,
  officialUrl,
  regulatoryContract,
  unitIdentity,
  validateManifest,
  type AcquisitionUnit,
  type BackfillManifest,
  type InventoryEvidence
} from "@repo/legislation-core/legal-text/contracts"
import { z } from "zod"

export const ecfrInventorySchema = z.object({
  titles: z
    .array(
      z.object({
        number: z.int().min(1).max(50),
        name: z.string().min(1),
        reserved: z.boolean(),
        latest_issue_date: z.iso.date().nullable(),
        latest_amended_on: z.iso.date().nullable(),
        up_to_date_as_of: z.iso.date().nullable()
      })
    )
    .length(50),
  meta: z.object({ date: z.iso.date(), import_in_progress: z.boolean() })
})
const directory = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      link: z.url(),
      folder: z.boolean(),
      size: z.int().nonnegative().optional(),
      formattedLastModifiedTime: z.string().optional()
    })
  )
})

/** Reconstruct the requested inventory using retained evidence only; a self-consistent hash is not completeness proof. */
export async function replayRegulatoryBackfill(value: unknown) {
  const manifest = validateManifest(value)
  const inventory = new Map(manifest.inventory.map((item) => [`${item.sourceId}:${item.url}`, item]))
  const replay = await planRegulatoryBackfill(manifest.scope, async (sourceId, url) => {
    const retained = inventory.get(`${sourceId}:${url}`)
    if (!retained) {
      throw new Error("Backfill replay is missing requested inventory")
    }
    return retained
  })
  if (!isDeepStrictEqual(manifest, replay)) {
    throw new Error("Backfill inventory replay mismatch")
  }
  return replay
}

export async function planRegulatoryBackfill(
  input: unknown,
  readInventory: (sourceId: AcquisitionUnit["sourceId"], url: string) => Promise<InventoryEvidence>
) {
  const scope = canonicalScope(input)
  const inventory: InventoryEvidence[] = []
  const units: AcquisitionUnit[] = []
  const exclusions: BackfillManifest["exclusions"] = []
  async function read(sourceId: AcquisitionUnit["sourceId"], url: string) {
    const result = await readInventory(sourceId, url)
    if (result.url !== url || result.sourceId !== sourceId || result.sha256 !== digest(result.body)) {
      throw new Error("Inventory response does not match request")
    }
    inventory.push(result)
    return result
  }
  function add(
    evidence: InventoryEvidence,
    values: Omit<
      AcquisitionUnit,
      "key" | "inventoryHash" | "sourceId" | "format" | "historical" | "rightsProfileId" | "externalStandardsIncluded"
    >
  ) {
    const unit = {
      ...values,
      sourceId: evidence.sourceId,
      inventoryHash: evidence.sha256,
      format: "xml",
      historical: true,
      rightsProfileId: "official-federal-text",
      externalStandardsIncluded: false
    }
    units.push(acquisitionUnitSchema.parse({ ...unit, key: unitIdentity(unit) }))
  }
  if (scope.ecfrTitles.length > 0) {
    const evidence = await read("ecfr", "https://www.ecfr.gov/api/versioner/v1/titles.json")
    const data = ecfrInventorySchema.parse(JSON.parse(evidence.body))
    if (
      data.meta.import_in_progress ||
      data.meta.date > scope.cutoff ||
      new Set(data.titles.map((item) => item.number)).size !== 50
    ) {
      throw new Error("eCFR inventory is importing, after cutoff, or has duplicate titles")
    }
    for (const number of scope.ecfrTitles) {
      const item = data.titles.find((candidate) => candidate.number === number)
      if (item === undefined) {
        throw new Error("Missing eCFR title")
      }
      if (item.reserved) {
        exclusions.push({ sourceId: "ecfr", nativeId: `title-${number}`, reason: "reserved_title" })
        continue
      }
      if (
        item.latest_issue_date === null ||
        item.up_to_date_as_of === null ||
        item.latest_issue_date > scope.cutoff ||
        item.up_to_date_as_of > scope.cutoff ||
        item.latest_issue_date > item.up_to_date_as_of
      ) {
        throw new Error("eCFR title lacks a usable issue/currency date at cutoff")
      }
      add(evidence, {
        nativeId: `title-${number}`,
        edition: item.latest_issue_date,
        inventoryRevision: digest(JSON.stringify(item)),
        sourceUrl: `https://www.ecfr.gov/api/versioner/v1/full/${item.latest_issue_date}/title-${number}.xml`,
        issueDate: item.latest_issue_date,
        currencyDate: item.up_to_date_as_of,
        sourceModifiedText: null,
        expectedBytes: null
      })
    }
  }
  const fr = scope.federalRegister
  if (fr !== null) {
    let month = fr.start.slice(0, 7)
    while (month <= fr.end.slice(0, 7)) {
      const evidence = await read("govinfo-fr", `https://www.govinfo.gov/bulkdata/json/FR/${month.replace("-", "/")}/`)
      const listing = directory.parse(JSON.parse(evidence.body))
      for (const file of listing.files) {
        if (file.folder || !file.name.endsWith(".xml")) {
          continue
        }
        const match = /^FR-(\d{4}-\d{2}-\d{2})\.xml$/.exec(file.name)
        const publicationDate = z.iso.date().parse(match?.[1])
        if (!publicationDate.startsWith(month)) {
          throw new Error("FR listing contains a different month")
        }
        if (publicationDate < fr.start || publicationDate > fr.end) {
          continue
        }
        const url = officialUrl(file.link, "govinfo-fr")
        if (url.pathname !== `/bulkdata/FR/${month.replace("-", "/")}/${file.name}`) {
          throw new Error("FR artifact does not match listed date")
        }
        add(evidence, {
          nativeId: file.name.slice(0, -4),
          edition: publicationDate,
          inventoryRevision: digest(JSON.stringify(file)),
          sourceUrl: url.href,
          issueDate: publicationDate,
          currencyDate: null,
          sourceModifiedText: file.formattedLastModifiedTime ?? null,
          expectedBytes: file.size ?? null
        })
      }
      const next = new Date(`${month}-01T00:00:00Z`)
      next.setUTCMonth(next.getUTCMonth() + 1)
      month = next.toISOString().slice(0, 7)
    }
  }
  if (scope.annualCfr !== null) {
    for (const year of scope.annualCfr.years) {
      const yearEvidence = await read("govinfo-cfr", `https://www.govinfo.gov/bulkdata/json/CFR/${year}/`)
      const yearListing = directory.parse(JSON.parse(yearEvidence.body))
      for (const number of scope.annualCfr.titles) {
        const folder = yearListing.files.find((file) => file.folder && file.name === `title-${number}`)
        if (folder === undefined) {
          if (number === 35) {
            exclusions.push({
              sourceId: "govinfo-cfr",
              nativeId: `CFR-${year}-title${number}`,
              reason: "reserved_title"
            })
            continue
          }
          throw new Error(`Annual CFR ${year} title ${number} is not listed; not evidence of an empty title`)
        }
        const url = officialUrl(folder.link, "govinfo-cfr")
        if (url.pathname.replace(/\/$/, "") !== `/bulkdata/json/CFR/${year}/title-${number}`) {
          throw new Error("Unexpected CFR directory")
        }
        url.pathname = `${url.pathname.replace(/\/$/, "")}/`
        const evidence = await read("govinfo-cfr", url.href)
        const files = directory
          .parse(JSON.parse(evidence.body))
          .files.filter((file) => !file.folder && file.name.endsWith(".xml"))
        if (files.length === 0) {
          throw new Error(`Annual CFR ${year} title ${number} has no XML volumes`)
        }
        const volumeNumbers = files.map((file) => {
          const match = new RegExp(`^CFR-${year}-title${number}-vol([1-9][0-9]*)\\.xml$`).exec(file.name)
          if (match === null) {
            throw new Error("Unexpected annual CFR volume identity")
          }
          return z.coerce.number().int().positive().parse(match[1])
        })
        const highestVolume = Math.max(...volumeNumbers)
        if (new Set(volumeNumbers).size !== files.length || highestVolume !== files.length) {
          throw new Error(`Annual CFR ${year} title ${number} has a missing or duplicate XML volume`)
        }
        for (const file of files) {
          const artifactUrl = officialUrl(file.link, "govinfo-cfr")
          if (artifactUrl.pathname !== `/bulkdata/CFR/${year}/title-${number}/${file.name}`) {
            throw new Error("Unexpected annual CFR artifact")
          }
          add(evidence, {
            nativeId: file.name.slice(0, -4),
            edition: String(year),
            inventoryRevision: digest(JSON.stringify(file)),
            sourceUrl: artifactUrl.href,
            issueDate: null,
            currencyDate: null,
            sourceModifiedText: file.formattedLastModifiedTime ?? null,
            expectedBytes: file.size ?? null
          })
        }
      }
    }
  }
  units.sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId) || a.nativeId.localeCompare(b.nativeId, "en", { numeric: true })
  )
  const contents = { scope, inventory, units, exclusions }
  return validateManifest({
    ...contents,
    id: manifestIdentity(contents),
    contract: regulatoryContract,
    status: "inventoried",
    recurringIngestionEnabled: false,
    acquisitionOnly: true,
    estimatedKnownBytes: units.reduce((sum, item) => sum + (item.expectedBytes ?? 0), 0),
    unknownSizeUnits: units.filter((item) => item.expectedBytes === null).length
  })
}
