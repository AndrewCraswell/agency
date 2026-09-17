import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  evaluationCodeSelectionSchema,
  verifyEvaluationCodeSnapshot
} from "../../src/ingestion/regulations/embedding-canonical-code.js"
import { prepareCommonRegulatoryPassages } from "../../src/ingestion/regulations/embedding-common-passages.js"

const { values } = parseArgs({
  options: {
    edition: { type: "string" },
    version: { type: "string" },
    "content-hash": { type: "string" },
    output: { type: "string" }
  }
})
const selection = evaluationCodeSelectionSchema.parse({
  editionId: values.edition,
  versionId: values.version,
  contentHash: values["content-hash"]
})
const output = resolve(z.string().min(1).parse(values.output))
const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
  "evaluation_code_local_database_required"
)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
  options: "-c default_transaction_read_only=on -c statement_timeout=60000"
})
try {
  // One statement binds membership, publication, source text and active rights to the same database snapshot.
  const result = await pool.query(
    `SELECT e.id AS edition_id, v.id AS version_id, v.content_hash, e.source_id,
    e.jurisdiction_id,e.generation_id,e.currency_date::text,e.issue_date::text,e.rights_profile_id,
    m.native_id,m.source_locator,r.policy,r.policy_hash,v.body,v.blocks,v.heading,v.node_kind,v.input_contract,v.language,
    left(concat_ws(E'\\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
    FROM legislation.legal_editions e JOIN legislation.legal_edition_provisions m ON m.edition_id=e.id AND m.code_id=e.code_id
    JOIN legislation.legal_provision_versions v ON v.id=m.version_id AND v.code_id=m.code_id
    JOIN legislation.legal_codes c ON c.id=e.code_id AND c.jurisdiction_id=e.jurisdiction_id AND c.kind='regulation'
    JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id AND r.is_active
    WHERE e.id=$1 AND v.id=$2 AND e.published_at IS NOT NULL
    AND octet_length(v.body)+octet_length(v.blocks::text)<=16777216`,
    [selection.editionId, selection.versionId]
  )
  invariant(result.rows.length === 1, "evaluation_code_published_membership_unavailable")
  const source = verifyEvaluationCodeSnapshot(result.rows[0], selection)
  const prepared = await prepareCommonRegulatoryPassages(source.input)
  invariant(prepared.passages.length <= 512, "evaluation_code_passage_limit")
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
