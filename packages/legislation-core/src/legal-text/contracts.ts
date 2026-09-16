import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { z } from "zod"

export const regulatoryContract = "regulatory-acquisition-2026-09-14"
const date = z.iso.date()
const title = z.int().min(1).max(50)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const source = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])

export const backfillScopeSchema = z
  .strictObject({
    cutoff: date,
    ecfrTitles: z.array(title).max(50),
    federalRegister: z.strictObject({ start: date, end: date }).nullable(),
    annualCfr: z
      .strictObject({ years: z.array(z.int().min(1996).max(9999)).max(100), titles: z.array(title).max(50) })
      .nullable()
  })
  .superRefine((scope, context) => {
    if (
      scope.federalRegister !== null &&
      (scope.federalRegister.start < "2000-01-01" ||
        scope.federalRegister.start > scope.federalRegister.end ||
        scope.federalRegister.end > scope.cutoff)
    ) {
      context.addIssue({ code: "custom", message: "FR XML requires 2000+ and start <= end <= cutoff" })
    }
    if (
      scope.annualCfr !== null &&
      (scope.annualCfr.years.length === 0 ||
        scope.annualCfr.titles.length === 0 ||
        scope.annualCfr.years.some((year) => year > Number(scope.cutoff.slice(0, 4))))
    ) {
      context.addIssue({
        code: "custom",
        message: "Annual CFR requires nonempty years/titles no later than cutoff year"
      })
    }
    if (scope.ecfrTitles.length === 0 && scope.federalRegister === null && scope.annualCfr === null) {
      context.addIssue({ code: "custom", message: "Select at least one corpus" })
    }
  })
export type BackfillScope = z.infer<typeof backfillScopeSchema>

export function digest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

export function canonicalScope(input: unknown): BackfillScope {
  const scope = backfillScopeSchema.parse(input)
  const numbers = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)
  return {
    ...scope,
    ecfrTitles: numbers(scope.ecfrTitles),
    annualCfr:
      scope.annualCfr === null
        ? null
        : {
            years: numbers(scope.annualCfr.years),
            titles: numbers(scope.annualCfr.titles)
          }
  }
}

// Exact official hosts only. Redirects are checked again before the next request.
export function officialUrl(value: string, sourceId: z.infer<typeof source>) {
  const url = new URL(value)
  const host = sourceId === "ecfr" ? "www.ecfr.gov" : "www.govinfo.gov"
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.search !== ""
  ) {
    throw new Error("Unexpected regulatory source URL")
  }
  const prefix = sourceId === "ecfr" ? "/api/versioner/v1/" : "/bulkdata/"
  const isFrPdf =
    sourceId === "govinfo-fr" && /^\/content\/pkg\/FR-\d{4}-\d{2}-\d{2}\/pdf\/[A-Za-z0-9-]+\.pdf$/.test(url.pathname)
  const isFrHtml =
    sourceId === "govinfo-fr" && /^\/content\/pkg\/FR-\d{4}-\d{2}-\d{2}\/html\/[A-Za-z0-9-]+\.htm$/.test(url.pathname)
  if (!url.pathname.startsWith(prefix) && !isFrPdf && !isFrHtml) {
    throw new Error("Unexpected regulatory source path")
  }
  return url
}

export const acquisitionUnitSchema = z.strictObject({
  key: hash,
  sourceId: source,
  nativeId: z.string().min(1),
  edition: z.string().min(1),
  sourceUrl: z.url(),
  inventoryHash: hash,
  inventoryRevision: z.string().min(1),
  issueDate: date.nullable(),
  currencyDate: date.nullable(),
  sourceModifiedText: z.string().nullable(),
  expectedBytes: z.int().positive().nullable(),
  format: z.literal("xml"),
  historical: z.literal(true),
  rightsProfileId: z.literal("official-federal-text"),
  externalStandardsIncluded: z.literal(false)
})
export type AcquisitionUnit = z.infer<typeof acquisitionUnitSchema>

export function unitIdentity(unit: Pick<AcquisitionUnit, "sourceId" | "nativeId" | "edition" | "inventoryRevision">) {
  return digest(
    JSON.stringify([regulatoryContract, unit.sourceId, unit.nativeId, unit.edition, unit.inventoryRevision])
  )
}

export const inventoryEvidenceSchema = z.strictObject({
  sourceId: source,
  url: z.url(),
  sha256: hash,
  bytes: z.int().positive(),
  retrievedAt: z.iso.datetime(),
  contentType: z.string(),
  body: z.string()
})
export type InventoryEvidence = z.infer<typeof inventoryEvidenceSchema>

export const backfillManifestSchema = z.strictObject({
  contract: z.literal(regulatoryContract),
  id: hash,
  scope: backfillScopeSchema,
  inventory: z.array(inventoryEvidenceSchema),
  units: z.array(acquisitionUnitSchema),
  exclusions: z.array(z.strictObject({ sourceId: source, nativeId: z.string(), reason: z.literal("reserved_title") })),
  status: z.literal("inventoried"),
  recurringIngestionEnabled: z.literal(false),
  acquisitionOnly: z.literal(true),
  estimatedKnownBytes: z.int().nonnegative(),
  unknownSizeUnits: z.int().nonnegative()
})
export type BackfillManifest = z.infer<typeof backfillManifestSchema>

/** Inventory envelopes may differ while the complete acquisition semantics remain identical. */
export function sameRegulatoryAcquisition(left: AcquisitionUnit, right: AcquisitionUnit) {
  const { inventoryHash: _left, ...leftFields } = left
  const { inventoryHash: _right, ...rightFields } = right
  return (
    unitIdentity(left) === left.key && unitIdentity(right) === right.key && isDeepStrictEqual(leftFields, rightFields)
  )
}

export function manifestIdentity(manifest: Pick<BackfillManifest, "scope" | "inventory" | "units" | "exclusions">) {
  return digest(
    JSON.stringify([
      regulatoryContract,
      canonicalScope(manifest.scope),
      manifest.inventory.map((item) => [item.sourceId, item.url, item.sha256]),
      manifest.units,
      manifest.exclusions
    ])
  )
}

export function validateManifest(value: unknown) {
  const manifest = backfillManifestSchema.parse(value)
  const inventoryHashes = new Set(manifest.inventory.map((item) => `${item.sourceId}:${item.sha256}`))
  if (
    manifest.id !== manifestIdentity(manifest) ||
    new Set(manifest.units.map((unit) => unit.key)).size !== manifest.units.length
  ) {
    throw new Error("Backfill manifest identity or unit uniqueness mismatch")
  }
  if (new Set(manifest.inventory.map((item) => `${item.sourceId}:${item.url}`)).size !== manifest.inventory.length) {
    throw new Error("Backfill inventory request is duplicated")
  }
  if (
    manifest.estimatedKnownBytes !== manifest.units.reduce((sum, unit) => sum + (unit.expectedBytes ?? 0), 0) ||
    manifest.unknownSizeUnits !== manifest.units.filter((unit) => unit.expectedBytes === null).length
  ) {
    throw new Error("Backfill manifest size accounting mismatch")
  }
  for (const evidence of manifest.inventory) {
    officialUrl(evidence.url, evidence.sourceId)
    if (digest(evidence.body) !== evidence.sha256 || Buffer.byteLength(evidence.body) !== evidence.bytes) {
      throw new Error("Backfill inventory checksum mismatch")
    }
  }
  for (const unit of manifest.units) {
    officialUrl(unit.sourceUrl, unit.sourceId)
    if (unit.key !== unitIdentity(unit) || !inventoryHashes.has(`${unit.sourceId}:${unit.inventoryHash}`)) {
      throw new Error("Backfill unit identity or inventory evidence mismatch")
    }
  }
  return manifest
}
