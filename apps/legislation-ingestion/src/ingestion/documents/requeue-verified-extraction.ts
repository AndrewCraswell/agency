import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { extractionRepairEvidence as repairEvidence } from "./extraction-repair-evidence.js"

/** Re-enter normal extraction, preserving served text until replacement succeeds.
 * Never replace a changed source, changed text, or active worker based on a stale audit.
 */
export async function requeueVerifiedExtraction(
  database: LegislationDatabase,
  evidence: z.infer<typeof repairEvidence>,
  replacementArtifact?: Readonly<{ path: string; contentType: string }>
) {
  const input = repairEvidence.parse(evidence)
  const result = await database.execute(sql`
    update legislation.bill_documents set processing_status='pending', processing_attempts=0,
      processing_error=null, processing_error_category=null, next_attempt_at=null, updated_at=now()
      ${replacementArtifact ? sql`, blob_path=${replacementArtifact.path}, content_type=${replacementArtifact.contentType}` : sql``}
    where id=${input.documentId} and bill_id=${input.billId} and source_url=${input.sourceUrl}
      and content_hash=${input.sourceSha256} and md5(text)=${input.previousTextHash}
      and processing_status='processed'
    returning id
  `)
  return { requeued: result.rows.length === 1 }
}
