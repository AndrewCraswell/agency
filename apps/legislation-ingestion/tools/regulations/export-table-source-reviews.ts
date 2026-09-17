import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  buildTableSourceReview,
  tableDiagnosticSchema,
  tableSourceReviewContract
} from "../../src/ingestion/regulations/table-source-review.js"

const { values } = parseArgs({
  options: {
    diagnostics: { type: "string" },
    output: { type: "string" },
    reason: { type: "string", default: "passage_table_unresolved_ditto" }
  }
})
const diagnosticsPath = resolve(z.string().min(1).parse(values.diagnostics))
const outputPath = resolve(z.string().min(1).parse(values.output))
const reason = z.enum(["passage_table_data_rows_required", "passage_table_unresolved_ditto"]).parse(values.reason)
const source = z
  .object({
    implementationHash: z.string().regex(/^[a-f0-9]{64}$/),
    rows: z.array(tableDiagnosticSchema)
  })
  .parse(JSON.parse(await readFile(diagnosticsPath, "utf8")))
const diagnostics = source.rows.filter((row) => row.reason === reason)
invariant(diagnostics.length > 0, "table_review_diagnostics_empty")

const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
  "table_review_requires_local_pilot"
)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  options: "-c default_transaction_read_only=on -c statement_timeout=60000"
})
const rowSchema = z.object({
  edition_id: z.uuid(),
  version_id: z.uuid(),
  content_hash: z.string(),
  input_contract: z.string(),
  heading: z.string(),
  body: z.string(),
  node_kind: z.string(),
  blocks: z.unknown(),
  language: z.string(),
  native_key: z.string(),
  native_id: z.string(),
  source_locator: z.string(),
  ordinal: z.int(),
  source_id: z.string(),
  generation_id: z.string(),
  artifact_hash: z.string(),
  unit: z.object({ sourceUrl: z.url() }),
  rights_profile_id: z.string(),
  policy: z.unknown(),
  policy_hash: z.string()
})

try {
  const pairs = diagnostics.map((row) => [row.editionId, row.versionId])
  const rows = z.array(rowSchema).parse(
    (
      await pool.query(
        `WITH requested(edition_id,version_id) AS (
          SELECT x.edition_id::uuid,x.version_id::uuid FROM jsonb_to_recordset($1::jsonb) AS x(edition_id text,version_id text)
        )
        SELECT m.edition_id,m.version_id,v.content_hash,v.input_contract,v.heading,v.body,v.node_kind,v.blocks,v.language,
          e.native_key,m.native_id,m.source_locator,m.ordinal,e.source_id,e.generation_id,g.artifact_hash,g.unit,
          e.rights_profile_id,r.policy,r.policy_hash
        FROM requested q
        JOIN legislation.legal_edition_provisions m ON m.edition_id=q.edition_id AND m.version_id=q.version_id
        JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.published_at IS NOT NULL
        JOIN legislation.legal_import_generations g ON g.id=e.generation_id AND g.state='published'
        JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id AND r.is_active
        ORDER BY m.edition_id,m.ordinal`,
        [JSON.stringify(pairs.map(([edition_id, version_id]) => ({ edition_id, version_id })))]
      )
    ).rows
  )
  const byIdentity = new Map(rows.map((row) => [`${row.edition_id}:${row.version_id}`, row]))
  const reviews = diagnostics.map((diagnostic) => {
    const row = byIdentity.get(`${diagnostic.editionId}:${diagnostic.versionId}`)
    invariant(row, "table_review_canonical_membership_missing")
    const policy = assertRights(row.policy, "displayText")
    assertRights(policy, "localSearch")
    invariant(digest(JSON.stringify(policy)) === row.policy_hash, "table_review_rights_hash_mismatch")
    return buildTableSourceReview(diagnostic, {
      editionId: row.edition_id,
      versionId: row.version_id,
      contentHash: row.content_hash,
      inputContract: row.input_contract,
      heading: row.heading,
      body: row.body,
      nodeKind: row.node_kind,
      blocks: row.blocks,
      language: row.language,
      nativeKey: row.native_key,
      nativeId: row.native_id,
      sourceLocator: row.source_locator,
      ordinal: row.ordinal,
      sourceId: row.source_id,
      generationId: row.generation_id,
      artifactHash: row.artifact_hash,
      sourceUrl: row.unit.sourceUrl,
      rightsProfileId: row.rights_profile_id,
      rightsHash: row.policy_hash
    })
  })
  invariant(reviews.length === diagnostics.length, "table_review_count_mismatch")
  const identity = {
    contract: tableSourceReviewContract,
    implementationHash: source.implementationHash,
    reason,
    diagnostics: diagnostics.length,
    versions: new Set(diagnostics.map((row) => row.versionId)).size,
    reviews
  }
  const report = { ...identity, reportHash: digest(JSON.stringify(identity)) }
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  console.log(
    JSON.stringify({
      output: outputPath,
      reportHash: report.reportHash,
      diagnostics: report.diagnostics,
      versions: report.versions
    })
  )
} finally {
  await pool.end()
}
