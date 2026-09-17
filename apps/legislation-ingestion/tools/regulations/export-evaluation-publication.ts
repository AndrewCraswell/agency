import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  evaluationPublicationSelectionSchema,
  verifyEvaluationPublicationSnapshot
} from "../../src/ingestion/regulations/embedding-canonical-publication.js"
import { prepareCommonRegulatoryPassages } from "../../src/ingestion/regulations/embedding-common-passages.js"

const { values } = parseArgs({
  options: {
    observation: { type: "string" },
    version: { type: "string" },
    "content-hash": { type: "string" },
    output: { type: "string" }
  }
})
const selection = evaluationPublicationSelectionSchema.parse({
  observationId: values.observation,
  versionId: values.version,
  contentHash: values["content-hash"]
})
const output = resolve(z.string().min(1).parse(values.output))
const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
  "evaluation_publication_local_database_required"
)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
  options: "-c default_transaction_read_only=on -c statement_timeout=60000"
})
try {
  const result = await pool.query(
    `SELECT o.id AS observation_id,o.document_id,v.id AS version_id,v.content_hash,v.pdf_hash,
    o.source_id,o.jurisdiction_id,o.generation_id,o.publication_date::text,o.source_locator,o.metadata,o.rights_profile_id,
    r.policy,r.policy_hash,v.body,v.blocks,v.heading,v.publication_kind,v.input_contract,
    left(concat_ws(E'\\n',o.jurisdiction_id,s.publisher,o.metadata->>'document_number',v.publication_kind,v.heading),16001) AS context
    FROM legislation.regulatory_document_observations o
    JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id AND b.published_at IS NOT NULL
    JOIN legislation.regulatory_document_versions v ON v.id=o.version_id AND v.document_id=o.document_id
    JOIN legislation.legal_sources s ON s.id=o.source_id
    JOIN legislation.legal_rights_profiles r ON r.id=o.rights_profile_id AND r.is_active
    JOIN legislation.legal_artifacts a ON a.hash=v.pdf_hash AND a.bytes>0
    WHERE o.id=$1 AND v.id=$2 AND octet_length(v.body)+octet_length(v.blocks::text)<=16777216`,
    [selection.observationId, selection.versionId]
  )
  invariant(result.rows.length === 1, "evaluation_publication_observation_unavailable")
  const source = verifyEvaluationPublicationSnapshot(result.rows[0], selection)
  const prepared = await prepareCommonRegulatoryPassages(source.input)
  invariant(prepared.passages.length <= 512, "evaluation_publication_passage_limit")
  const evidence = { provenance: source.provenance, prepared }
  const report = {
    ...evidence,
    evidenceHash: digest(JSON.stringify(evidence)),
    canonicalSnapshotVerified: true,
    publisherArtifactReplayVerified: false,
    splitAssignmentVerified: false,
    humanReviewComplete: false,
    modelSelected: false,
    bulkEmbeddingAuthorized: false
  }
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  process.stdout.write(
    JSON.stringify({
      versionId: selection.versionId,
      passages: prepared.passages.length,
      evidenceHash: report.evidenceHash,
      canonicalWrites: false,
      providerCalls: 0,
      modelSelected: false
    }) + "\n"
  )
} finally {
  await pool.end()
}
