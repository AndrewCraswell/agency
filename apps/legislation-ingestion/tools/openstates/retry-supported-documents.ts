import { createHash } from "node:crypto"
import { Command } from "commander"
import pg from "pg"
import { z } from "zod"
import { downloadDocument } from "../../src/ingestion/documents/download.js"
import { DocumentExtractionError, extractDocument } from "../../src/ingestion/documents/extract.js"

const options = new Command()
  .requiredOption("--state <state>", "state jurisdiction")
  .requiredOption("--session <session>", "exact legislative session")
  .requiredOption("--database-env <name>", "environment variable holding the database URL")
  .option("--limit <count>", "maximum candidates to validate", "10")
  .option("--category <category>", "previous terminal extraction category to revalidate", "unsupported-format")
  .option("--apply", "requeue successfully extracted, unchanged records")
  .parse()
  .opts<{ state: string; session: string; databaseEnv: string; limit: string; category: string; apply?: boolean }>()
const state = z.enum(["ak", "nc"]).parse(options.state)
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(options.session)
const limit = z.coerce.number().int().min(1).max(100).parse(options.limit)
const category = z.enum(["unsupported-format", "malformed-document"]).parse(options.category)
const pool = new pg.Pool({ connectionString: z.string().min(1).parse(process.env[options.databaseEnv]) })
const rowSchema = z.object({
  id: z.string(),
  source_url: z.string(),
  content_hash: z.string().nullable(),
  processing_error: z.string().nullable(),
  updated_at: z.string()
})
try {
  const client = await pool.connect()
  let rows: z.infer<typeof rowSchema>[]
  try {
    await client.query("begin read only")
    await client.query("set local statement_timeout='15s'")
    rows = z.array(rowSchema).parse(
      (
        await client.query(
          `select id,source_url,content_hash,processing_error,updated_at::text from legislation.bill_documents
       where bill_id like $1 and processing_status='unsupported' and processing_error_category=$3
       order by id limit $2`,
          [`bill:${state}:${session.toLowerCase()}:%`, limit, category]
        )
      ).rows
    )
  } finally {
    await client.query("rollback")
    client.release()
  }
  for (const row of rows) {
    let supported = false
    try {
      const downloaded = await downloadDocument(row.source_url, { allowHttp: true })
      const sourceSha256 = createHash("sha256").update(downloaded.bytes).digest("hex")
      if (row.content_hash !== null && row.content_hash !== sourceSha256) {
        throw new Error("Publisher bytes changed; requires source revision review")
      }
      let characters: number | null = null
      let requiresOcr = false
      try {
        const extracted = await extractDocument(row.id, downloaded.bytes, downloaded.contentType)
        characters = extracted.text.length
      } catch (error) {
        if (!(error instanceof DocumentExtractionError) || error.category !== "ocr-required") {
          throw error
        }
        requiresOcr = true
      }
      supported = true
      let requeued = false
      if (options.apply) {
        const writer = await pool.connect()
        try {
          await writer.query("begin")
          await writer.query("set local statement_timeout='15s'")
          const result = await writer.query(
            `update legislation.bill_documents set processing_status='pending',processing_attempts=0,
             processing_error=null,processing_error_category=null,next_attempt_at=null,updated_at=now()
             where id=$1 and source_url=$2 and updated_at=$3 and content_hash is not distinct from $4
               and processing_error is not distinct from $5 and processing_status='unsupported'
               and processing_error_category=$6 returning id`,
            [row.id, row.source_url, row.updated_at, row.content_hash, row.processing_error, category]
          )
          requeued = result.rowCount === 1
          if (!requeued) {
            throw new Error("Document changed during validation; no retry was queued")
          }
          await writer.query("commit")
        } catch (error) {
          await writer.query("rollback")
          throw error
        } finally {
          writer.release()
        }
      }
      process.stdout.write(
        JSON.stringify({
          id: row.id,
          supported: true,
          contentType: downloaded.contentType,
          sourceSha256,
          characters,
          requiresOcr,
          requeued
        }) + "\n"
      )
    } catch (error) {
      if (!(error instanceof DocumentExtractionError)) {
        process.exitCode = 1
      }
      process.stdout.write(
        JSON.stringify({
          id: row.id,
          supported,
          requeued: false,
          error: error instanceof Error ? error.message : String(error)
        }) + "\n"
      )
    }
  }
} finally {
  await pool.end()
}
