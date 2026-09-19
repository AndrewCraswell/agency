import type { billDocuments } from "@repo/legislation-core/database/schema/schema"
import { Command } from "commander"
import pg from "pg"
import { z } from "zod"
import { downloadDocument } from "../../src/ingestion/documents/download.js"
import {
  planUntouchedDocumentAliases,
  reconcileUntouchedDocumentAlias
} from "../../src/persistence/document-alias-reconciliation.js"

const options = new Command()
  .option("--bill-id <id>")
  .option("--keep-id <id>")
  .option("--remove-id <id>")
  .option("--session-id <id>", "scan an exact session in bounded bill pages")
  .option("--after-bill-id <id>", "exclusive bill cursor", "")
  .option("--limit <count>", "bills per page, at most 25", "10")
  .requiredOption("--database-env <name>")
  .option("--apply", "remove an untouched alias only after fresh byte verification and transactional revalidation")
  .parse()
  .opts<{
    billId?: string
    keepId?: string
    removeId?: string
    sessionId?: string
    afterBillId: string
    limit: string
    databaseEnv: string
    apply?: boolean
  }>()
const limit = z.coerce.number().int().min(1).max(25).parse(options.limit)
if (
  options.sessionId
    ? Boolean(options.billId || options.keepId || options.removeId)
    : !(options.billId && options.keepId && options.removeId)
)
  throw new Error("Specify either session-id or all of bill-id, keep-id and remove-id")
const pool = new pg.Pool({
  connectionString: z.string().min(1).parse(process.env[options.databaseEnv]),
  max: 1,
  connectionTimeoutMillis: 10000
})
try {
  const client = await pool.connect()
  try {
    let candidates: { billId: string; keepId: string; removeId: string; sourceUrl: string }[]
    let nextBillId: string | null = null
    await client.query("begin read only")
    try {
      await client.query("set local statement_timeout='15s'")
      if (options.sessionId) {
        const bills = await client.query<{ id: string }>(
          "select id from legislation.bills where session_id=$1 and id>$2 order by id limit $3",
          [options.sessionId, options.afterBillId, limit]
        )
        const ids = bills.rows.map(({ id }) => id)
        const rows = await client.query<typeof billDocuments.$inferSelect>(
          `select id, bill_id as "billId", classification, source_url as "sourceUrl", content_hash as "contentHash", processing_status as "processingStatus", processing_attempts as "processingAttempts", text, blob_path as "blobPath", ocr_status as "ocrStatus", ocr_provider as "ocrProvider", ocr_completed_at as "ocrCompletedAt", ocr_page_count as "ocrPageCount" from legislation.bill_documents where bill_id=any($1::text[]) order by id`,
          [ids]
        )
        const plan = planUntouchedDocumentAliases(rows.rows)
        candidates = plan.candidates
        nextBillId = ids.at(-1) ?? null
        console.log(
          JSON.stringify({
            sessionId: options.sessionId,
            billsScanned: ids.length,
            candidateCount: candidates.length,
            heldGroups: plan.held,
            dryRun: !options.apply
          })
        )
      } else {
        const target = await client.query<{ sourceUrl: string }>(
          'select source_url as "sourceUrl" from legislation.bill_documents where id=$1 and bill_id=$2',
          [options.keepId, options.billId]
        )
        if (target.rowCount !== 1 || !target.rows[0]) throw new Error("Exact retained document is missing")
        candidates = [
          {
            billId: z.string().parse(options.billId),
            keepId: z.string().parse(options.keepId),
            removeId: z.string().parse(options.removeId),
            sourceUrl: target.rows[0].sourceUrl
          }
        ]
      }
    } finally {
      await client.query("rollback")
    }
    // Sequential source requests; on failure no completion cursor is printed. Rerun the same page safely.
    for (const candidate of candidates) {
      const downloaded = await downloadDocument(candidate.sourceUrl, { timeoutMs: 30000 })
      const result = await reconcileUntouchedDocumentAlias(client, {
        ...candidate,
        bytes: downloaded.bytes,
        apply: options.apply === true
      })
      console.log(JSON.stringify({ ...result, productionWrites: result.status === "reconciled" }))
    }
    console.log(JSON.stringify({ pageComplete: true, nextBillId, dryRun: !options.apply }))
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}
