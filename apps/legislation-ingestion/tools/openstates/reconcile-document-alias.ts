import { Command } from "commander"
import pg from "pg"
import { z } from "zod"
import { downloadDocument } from "../../src/ingestion/documents/download.js"
import { reconcileUntouchedDocumentAlias } from "../../src/persistence/document-alias-reconciliation.js"

const options = new Command()
  .requiredOption("--bill-id <id>")
  .requiredOption("--keep-id <id>")
  .requiredOption("--remove-id <id>")
  .requiredOption("--database-env <name>")
  .option("--apply", "remove an untouched alias only after fresh byte verification and transactional revalidation")
  .parse()
  .opts<{ billId: string; keepId: string; removeId: string; databaseEnv: string; apply?: boolean }>()
const pool = new pg.Pool({
  connectionString: z.string().min(1).parse(process.env[options.databaseEnv]),
  max: 1,
  connectionTimeoutMillis: 10000
})
const client = await pool.connect()
try {
  const target = await client.query<{ sourceUrl: string }>(
    'select source_url as "sourceUrl" from legislation.bill_documents where id=$1 and bill_id=$2',
    [options.keepId, options.billId]
  )
  if (target.rowCount !== 1 || !target.rows[0]) throw new Error("Exact retained document is missing")
  const sourceUrl = target.rows[0].sourceUrl
  const downloaded = await downloadDocument(sourceUrl, { timeoutMs: 30000 })
  const result = await reconcileUntouchedDocumentAlias(client, {
    billId: options.billId,
    keepId: options.keepId,
    removeId: options.removeId,
    sourceUrl,
    bytes: downloaded.bytes,
    apply: options.apply === true
  })
  console.log(JSON.stringify({ ...result, productionWrites: options.apply === true }))
} finally {
  client.release()
  await pool.end()
}
