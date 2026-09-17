import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { embeddingTokenizer } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  inspectLegalPassagePreparation,
  legalPreparationInspectionSchema
} from "../../src/ingestion/regulations/passage-inspection.js"
import { inspectLegalPassageShape } from "../../src/ingestion/regulations/passage-shapes.js"
import {
  buildTableSourceReview,
  tableDiagnosticSchema,
  tableSourceReviewContract
} from "../../src/ingestion/regulations/table-source-review.js"

const contract = "reviewed-regulatory-version-recheck-2026-09-17"
const { values } = parseArgs({
  options: { reviews: { type: "string" }, output: { type: "string" } }
})
const reviewsPath = resolve(z.string().min(1).parse(values.reviews))
const outputPath = resolve(z.string().min(1).parse(values.output))
const reviewSchema = z.looseObject({
  contract: z.literal(tableSourceReviewContract),
  diagnostic: tableDiagnosticSchema,
  canonical: z.object({
    editionId: z.uuid(),
    versionId: z.uuid(),
    contentHash: z.string(),
    inputContract: z.string(),
    heading: z.string(),
    nodeKind: z.string(),
    nativeKey: z.string(),
    nativeId: z.string(),
    sourceLocator: z.string(),
    ordinal: z.int(),
    sourceId: z.string(),
    generationId: z.string(),
    artifactHash: z.string(),
    sourceUrl: z.url(),
    rightsProfileId: z.string(),
    rightsHash: z.string()
  }),
  table: z.looseObject({ blockHash: z.string(), text: z.string(), xml: z.string() }),
  reviewHash: z.string().regex(/^[a-f0-9]{64}$/)
})
const raw = z.record(z.string(), z.unknown()).parse(JSON.parse(await readFile(reviewsPath, "utf8")))
const reportHash = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(raw.reportHash)
const { reportHash: _reportHash, ...reportIdentity } = raw
invariant(digest(JSON.stringify(reportIdentity)) === reportHash, "reviewed_recheck_report_hash_mismatch")
const source = z
  .object({
    contract: z.literal(tableSourceReviewContract),
    implementationHash: z.string(),
    reason: z.literal("passage_table_unresolved_ditto"),
    diagnostics: z.int().positive(),
    versions: z.int().positive(),
    reviews: z.array(reviewSchema).min(1)
  })
  .parse(raw)
invariant(source.reviews.length === source.diagnostics, "reviewed_recheck_diagnostic_count_mismatch")

const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
  "reviewed_recheck_requires_local_pilot"
)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  options: "-c default_transaction_read_only=on -c statement_timeout=60000"
})
const canonicalSchema = z.object({
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
  policy_hash: z.string(),
  context: z.string().max(16000)
})
const models = ["openai/text-embedding-3-small", "voyageai/voyage-4"] as const
const tokenizers = await Promise.all(
  models.map(async (model) => ({ model, tokenizer: await embeddingTokenizer(model) }))
)
const implementationFiles = [
  new URL(import.meta.url),
  new URL("../../src/ingestion/regulations/table-source-review.ts", import.meta.url),
  new URL("../../src/ingestion/regulations/passage-inspection.ts", import.meta.url),
  new URL("../../src/ingestion/regulations/passage-shapes.ts", import.meta.url),
  new URL("../../src/ingestion/regulations/passages.ts", import.meta.url),
  new URL("../../src/ingestion/regulations/table-passages.ts", import.meta.url),
  new URL(import.meta.resolve("@repo/legislation-core/embeddings/embedding-tokenizer")),
  new URL(import.meta.resolve("@repo/legislation-core/legal-text/reader-text"))
]
const implementationHash = digest(
  (await Promise.all(implementationFiles.map(async (path) => digest(await readFile(path)))))
    .concat(
      tokenizers.map(({ model, tokenizer }) => `${model}:${tokenizer.id}`),
      process.versions.node
    )
    .join("\n")
)

try {
  const requested = [
    ...new Map(
      source.reviews.map((review) => [
        `${review.diagnostic.editionId}:${review.diagnostic.versionId}`,
        { edition_id: review.diagnostic.editionId, version_id: review.diagnostic.versionId }
      ])
    ).values()
  ]
  invariant(requested.length === source.versions, "reviewed_recheck_version_count_mismatch")
  const rows = z.array(canonicalSchema).parse(
    (
      await pool.query(
        `WITH requested(edition_id,version_id) AS (
          SELECT x.edition_id::uuid,x.version_id::uuid FROM jsonb_to_recordset($1::jsonb) AS x(edition_id text,version_id text)
        )
        SELECT m.edition_id,m.version_id,v.content_hash,v.input_contract,v.heading,v.body,v.node_kind,v.blocks,v.language,
          e.native_key,m.native_id,m.source_locator,m.ordinal,e.source_id,e.generation_id,g.artifact_hash,g.unit,
          e.rights_profile_id,r.policy,r.policy_hash,
          left(concat_ws(E'\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
        FROM requested q
        JOIN legislation.legal_edition_provisions m ON m.edition_id=q.edition_id AND m.version_id=q.version_id
        JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.published_at IS NOT NULL
        JOIN legislation.legal_codes c ON c.id=e.code_id
        JOIN legislation.legal_import_generations g ON g.id=e.generation_id AND g.state='published'
        JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id AND r.is_active
        ORDER BY m.edition_id,m.ordinal`,
        [JSON.stringify(requested)]
      )
    ).rows
  )
  invariant(rows.length === requested.length, "reviewed_recheck_canonical_membership_missing")
  const byIdentity = new Map(rows.map((row) => [`${row.edition_id}:${row.version_id}`, row]))
  const results = []
  for (const requestedVersion of requested) {
    const identity = `${requestedVersion.edition_id}:${requestedVersion.version_id}`
    const row = byIdentity.get(identity)
    invariant(row, "reviewed_recheck_canonical_membership_missing")
    const policy = assertRights(row.policy, "displayText")
    assertRights(policy, "localSearch")
    invariant(digest(JSON.stringify(policy)) === row.policy_hash, "reviewed_recheck_rights_hash_mismatch")
    const matchingReviews = source.reviews.filter(
      (review) => review.diagnostic.editionId === row.edition_id && review.diagnostic.versionId === row.version_id
    )
    for (const review of matchingReviews) {
      const rebuilt = buildTableSourceReview(review.diagnostic, {
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
      invariant(rebuilt.reviewHash === review.reviewHash, "reviewed_recheck_source_review_changed")
    }
    results.push({
      editionId: row.edition_id,
      versionId: row.version_id,
      contentHash: row.content_hash,
      nativeId: row.native_id,
      sourceLocator: row.source_locator,
      reviewHashes: matchingReviews.map((review) => review.reviewHash),
      inspection: inspectLegalPassageShape({
        versionId: row.version_id,
        body: row.body,
        blocks: row.blocks,
        inputContract: row.input_contract,
        nodeKind: row.node_kind
      }),
      preparation: tokenizers.map(({ model, tokenizer }) =>
        inspectLegalPassagePreparation({
          versionId: row.version_id,
          body: row.body,
          blocks: row.blocks,
          inputContract: row.input_contract,
          context: row.context,
          model,
          tokenizer
        })
      )
    })
  }
  const prepared = results.flatMap((result) =>
    result.preparation.map((item) => legalPreparationInspectionSchema.parse(item))
  )
  const identity = {
    contract,
    sourceReviewReportHash: reportHash,
    sourceReviewImplementationHash: source.implementationHash,
    implementationHash,
    tokenizers: tokenizers.map(({ model, tokenizer }) => ({ model, tokenizerId: tokenizer.id })),
    summary: {
      diagnostics: source.diagnostics,
      versions: results.length,
      blockedTableBlocks: results.reduce(
        (count, result) =>
          count + (result.inspection.status === "classified" ? result.inspection.blockedTableBlocks : 1),
        0
      ),
      preparations: prepared.length,
      prepared: prepared.filter((item) => item.status === "prepared").length,
      blocked: prepared.filter((item) => item.status === "blocked").length
    },
    results
  }
  const output = { ...identity, reportHash: digest(JSON.stringify(identity)) }
  await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ output: outputPath, reportHash: output.reportHash, ...output.summary }))
} finally {
  await pool.end()
}
