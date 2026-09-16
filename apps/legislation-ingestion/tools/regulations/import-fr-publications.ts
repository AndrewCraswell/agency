import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { digest, validateManifest } from "@repo/legislation-core/legal-text/contracts"
import { parserLimits, regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { receiptSchema } from "../../src/ingestion/regulations/artifact-backfill.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { frRenditionSchema, publishFrIssue } from "../../src/ingestion/regulations/fr-storage.js"
import { importNormalizedRegulatoryUnit } from "../../src/ingestion/regulations/import-normalized.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "../../src/ingestion/regulations/storage.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    metadata: { type: "string" },
    validation: { type: "string" },
    date: { type: "string" },
    raw: { type: "string" },
    normalized: { type: "string" },
    pdfs: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const manifest = validateManifest(JSON.parse(await readFile(path(values.manifest), "utf8")))
const date = z.iso.date().parse(values.date)
const unit = manifest.units.find((unit) => unit.sourceId === "govinfo-fr" && unit.issueDate === date)
invariant(unit, "fr_issue_missing_from_manifest")
if (!values.apply) {
  process.stdout.write(
    JSON.stringify({
      mode: "preview",
      unit: unit.nativeId,
      target: "local disposable regulations_test",
      recurringIngestionEnabled: false
    })
  )
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const target = new URL(connectionString)
  invariant(
    ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
    "local_disposable_database_required"
  )
  const metadata = await replayFrMetadata(JSON.parse(await readFile(path(values.metadata), "utf8")))
  const validation = z
    .object({
      metadataManifestId: z.string(),
      date: z.iso.date(),
      complete: z.literal(true),
      validatorCodeHash: z.string(),
      results: z.array(z.object({ status: z.literal("parsed"), receipt: z.unknown(), inspection: z.unknown() }))
    })
    .parse(JSON.parse(await readFile(path(values.validation), "utf8")))
  invariant(validation.metadataManifestId === metadata.id && validation.date === date, "fr_validation_scope_mismatch")
  invariant(
    validation.validatorCodeHash ===
      digest(await readFile(new URL("../../src/ingestion/regulations/fr-pdf-validation.ts", import.meta.url))),
    "fr_pdf_validator_changed"
  )
  const renditions = []
  for (const result of validation.results) {
    const parsed = frRenditionSchema.parse({
      receipt: result.receipt,
      inspection: result.inspection,
      storageLocator: "pending"
    })
    const storageLocator = join(path(values.pdfs), "blobs", `${parsed.receipt.sha256}.pdf`)
    const bytes = await readFile(storageLocator)
    invariant(
      bytes.length === parsed.receipt.bytes && digest(bytes) === parsed.receipt.sha256,
      "fr_pdf_retention_mismatch"
    )
    renditions.push({ ...parsed, storageLocator })
  }
  const receipt = receiptSchema.parse(
    JSON.parse(await readFile(join(path(values.raw), "units", `${unit.key}.json`), "utf8"))
  )
  const parserCodeHash = digest(await readFile(new URL("../../python/regulations/parse_xml.py", import.meta.url)))
  const generation = digest(
    JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, receipt.sha256, parserLimits])
  )
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10_000 })
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await pool.query(
      "INSERT INTO legislation.jurisdictions(id,name,classification,country_code) VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING"
    )
    const staged = await importNormalizedRegulatoryUnit(pool, {
      manifest,
      receipt,
      parserCodeHash,
      directory: join(path(values.normalized), generation),
      artifactLocator: join(path(values.raw), "blobs", `${receipt.sha256}.xml`)
    })
    const lease = await claimRegulatoryLease(pool, staged.generationId)
    try {
      const result = await publishFrIssue(pool, lease, { metadata, renditions })
      await writeFile(
        path(values.output),
        JSON.stringify(
          {
            ...result,
            date,
            metadataManifestId: metadata.id,
            observedAt: new Date().toISOString(),
            indexed: false,
            embedded: false,
            recurringIngestionEnabled: false
          },
          null,
          2
        ),
        { flag: "wx" }
      )
      process.stdout.write(JSON.stringify(result))
    } finally {
      await releaseRegulatoryLease(pool, lease)
    }
  } finally {
    await pool.end()
  }
}
