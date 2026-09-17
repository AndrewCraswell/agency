import {
  digest,
  inventoryEvidenceSchema,
  officialUrl,
  unitIdentity,
  type InventoryEvidence
} from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import { z } from "zod"
import { ecfrInventorySchema } from "./backfill-plan.js"
import {
  commitLegalDiscoveryPage,
  legalDiscoveryUnitSchema,
  startLegalDiscoveryAttempt,
  type LegalDiscoveryUnit
} from "./discovery-checkpoint.js"
import { RegulatorySourceClient } from "./source-client.js"

const currentSchema = z.strictObject({
  title: z.int().min(1).max(50),
  sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
  issueDate: z.iso.date().nullable(),
  currencyDate: z.iso.date().nullable()
})

export function planEcfrDiscoveryPage(input: {
  current: readonly z.infer<typeof currentSchema>[]
  evidence: InventoryEvidence
  titles: readonly number[]
}) {
  const evidence = inventoryEvidenceSchema.parse(input.evidence)
  if (
    evidence.sourceId !== "ecfr" ||
    evidence.url !== "https://www.ecfr.gov/api/versioner/v1/titles.json" ||
    evidence.sha256 !== digest(evidence.body) ||
    evidence.bytes !== Buffer.byteLength(evidence.body) ||
    !evidence.contentType.toLowerCase().includes("json")
  ) {
    throw new Error("eCFR discovery evidence does not match its source")
  }
  const inventory = ecfrInventorySchema.parse(JSON.parse(evidence.body))
  if (inventory.meta.import_in_progress) {
    throw new Error("ecfr_inventory_import_in_progress")
  }
  if (new Set(inventory.titles.map((item) => item.number)).size !== 50) {
    throw new Error("ecfr_inventory_titles_invalid")
  }
  const titles = z
    .array(z.int().min(1).max(50))
    .min(1)
    .max(50)
    .parse([...input.titles])
  if (new Set(titles).size !== titles.length) {
    throw new Error("duplicate_ecfr_discovery_title")
  }
  const current = new Map(
    z
      .array(currentSchema)
      .parse(input.current)
      .map((row) => [row.title, row])
  )
  const units: LegalDiscoveryUnit[] = []
  const reserved: number[] = []
  const unchanged: number[] = []
  for (const title of [...titles].sort((left, right) => left - right)) {
    const item = inventory.titles.find((candidate) => candidate.number === title)
    if (!item) {
      throw new Error("missing_ecfr_discovery_title")
    }
    if (item.reserved) {
      reserved.push(title)
      continue
    }
    if (
      item.latest_issue_date === null ||
      item.up_to_date_as_of === null ||
      item.latest_issue_date > item.up_to_date_as_of ||
      item.latest_issue_date > inventory.meta.date ||
      item.up_to_date_as_of > inventory.meta.date
    ) {
      throw new Error("ecfr_discovery_date_invalid")
    }
    const sourceRevision = digest(JSON.stringify(item))
    const stored = current.get(title)
    if (
      stored?.sourceRevision === sourceRevision &&
      stored.issueDate === item.latest_issue_date &&
      stored.currencyDate === item.up_to_date_as_of
    ) {
      unchanged.push(title)
      continue
    }
    const values = {
      sourceId: "ecfr" as const,
      nativeId: `title-${title}`,
      edition: item.latest_issue_date,
      inventoryHash: evidence.sha256,
      inventoryRevision: sourceRevision,
      sourceUrl: officialUrl(
        `https://www.ecfr.gov/api/versioner/v1/full/${item.latest_issue_date}/title-${title}.xml`,
        "ecfr"
      ).href,
      issueDate: item.latest_issue_date,
      currencyDate: item.up_to_date_as_of,
      sourceModifiedText: item.latest_amended_on,
      expectedBytes: null,
      format: "xml" as const,
      historical: false,
      rightsProfileId: "official-federal-text",
      externalStandardsIncluded: false
    }
    units.push(legalDiscoveryUnitSchema.parse({ ...values, key: unitIdentity(values) }))
  }
  return { inventory, reserved, unchanged, units }
}

function overlapStart(lastSuccessAt: string | null, fallback: string) {
  if (lastSuccessAt === null) {
    return fallback
  }
  return new Date(new Date(lastSuccessAt).getTime() - 60 * 60 * 1000).toISOString()
}

/** Bounded manual discovery. It registers durable work but never enables a recurring schedule. */
export async function discoverEcfrChanges(
  pool: pg.Pool,
  options: {
    client?: Pick<RegulatorySourceClient, "inventory">
    titles?: readonly number[]
  } = {}
) {
  const titles = options.titles ?? Array.from({ length: 50 }, (_, index) => index + 1)
  const query = { endpoint: "titles", titles: [...titles].sort((left, right) => left - right) }
  const attempt = await startLegalDiscoveryAttempt(pool, { sourceId: "ecfr", query })
  const client = options.client ?? new RegulatorySourceClient()
  const evidence = await client.inventory("ecfr", "https://www.ecfr.gov/api/versioner/v1/titles.json")
  const rows = await pool.query(
    `SELECT substring(c.code_key FROM '^cfr-title-([0-9]+)$')::integer AS title,
      e.source_revision AS "sourceRevision",e.issue_date::text AS "issueDate",e.currency_date::text AS "currencyDate"
     FROM legislation.legal_code_heads h
     JOIN legislation.legal_editions e ON e.id=h.edition_id AND e.code_id=h.code_id AND e.source_id=h.source_id
     JOIN legislation.legal_codes c ON c.id=e.code_id
     WHERE h.source_id='ecfr' AND c.jurisdiction_id='jurisdiction:us'
       AND c.code_key ~ '^cfr-title-[0-9]+$'`
  )
  const plan = planEcfrDiscoveryPage({ current: rows.rows, evidence, titles })
  const previousSuccess =
    attempt.lastSuccessAt !== null && attempt.lastSuccessAt <= evidence.retrievedAt ? attempt.lastSuccessAt : null
  const windowStartedAt = previousSuccess ?? evidence.retrievedAt
  const overlap = overlapStart(previousSuccess, windowStartedAt)
  const result = await commitLegalDiscoveryPage(pool, {
    sourceId: "ecfr",
    query,
    expectedRevision: attempt.revision,
    expectedCursor: attempt.committedCursor,
    nextCursor: { inventoryDate: plan.inventory.meta.date, inventoryHash: evidence.sha256 },
    windowStartedAt,
    windowEndedAt: evidence.retrievedAt,
    overlapStartedAt: overlap,
    sourceCutoff: { inventoryDate: plan.inventory.meta.date },
    units: plan.units
  })
  return {
    ...result,
    inventoryDate: plan.inventory.meta.date,
    reservedTitles: plan.reserved,
    unchangedTitles: plan.unchanged,
    changedTitles: plan.units.map((unit) => Number(unit.nativeId.slice("title-".length)))
  }
}
