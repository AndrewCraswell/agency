import { createHash } from "node:crypto"
import { Command } from "commander"
import pg from "pg"
import { z } from "zod"
import { loadConfig } from "../../src/config/config.js"
import { decodeArchiveRecords } from "../../src/ingestion/archive.js"
import { AzureBlobArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { normalizeOpenStatesBill } from "../../src/ingestion/openstates/normalize.js"
import { parseActionProvenanceScope, planActionProvenance } from "../../src/persistence/action-provenance.js"

const options = new Command()
  .requiredOption("--state <state>")
  .requiredOption("--session <session>")
  .requiredOption("--archive-stream <stream>")
  .requiredOption("--archive-sha256 <hash>")
  .requiredOption("--bill-id <id>")
  .requiredOption("--database-env <name>")
  .option("--apply", "fill missing action provenance from verified retained evidence")
  .parse()
  .opts<{
    state: string
    session: string
    archiveStream: string
    archiveSha256: string
    billId: string
    databaseEnv: string
    apply?: boolean
  }>()
const { state, jurisdictionName } = parseActionProvenanceScope(options)
const stream = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]*$/)
  .parse(options.archiveStream)
const hash = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(options.archiveSha256)
const config = loadConfig()
const store = new AzureBlobArtifactStore(
  z.string().min(1).parse(config.azure.storageAccount),
  config.azure.stateSourceContainer
)
const bytes = await store.read(`openstates/${stream}/${hash}.source`)
if (createHash("sha256").update(bytes).digest("hex") !== hash) {
  throw new Error("Retained archive checksum mismatch")
}
const matching = decodeArchiveRecords(bytes).flatMap((record) => {
  const normalized = normalizeOpenStatesBill(record, {
    jurisdictionCode: state,
    jurisdictionName
  })
  return normalized.aggregate.bill.id === options.billId ? [normalized.aggregate] : []
})
const aggregate = matching[0]
if (matching.length !== 1 || !aggregate) {
  throw new Error("Retained archive must contain exactly one matching bill")
}
const expected = aggregate.actions?.map((action) => ({
  ...action,
  actionDate: action.actionDate ?? null,
  sourceUrl: action.sourceUrl ?? null
}))
const client = new pg.Client({ connectionString: z.string().min(1).parse(process.env[options.databaseEnv]) })
await client.connect()
try {
  await client.query(options.apply ? "begin" : "begin read only")
  await client.query("set local statement_timeout='15s'")
  await client.query("set local lock_timeout='3s'")
  // All ordinary aggregate writers update the parent; lock it before reading the full child set.
  const bill = await client.query(`select id from legislation.bills where id=$1 ${options.apply ? "for update" : ""}`, [
    options.billId
  ])
  if (bill.rowCount !== 1) throw new Error("Canonical bill is missing")
  const stored = await client.query(
    `select id,ordinal,description,classification,action_date::text as "actionDate",source_url as "sourceUrl"
     from legislation.bill_actions where bill_id=$1 order by ordinal ${options.apply ? "for update" : ""}`,
    [options.billId]
  )
  const updates = planActionProvenance(expected, stored.rows)
  if (options.apply) {
    for (const update of updates) {
      const result = await client.query(
        "update legislation.bill_actions set source_url=$1 where id=$2 and bill_id=$3 and source_url is null returning id",
        [update.sourceUrl, update.id, options.billId]
      )
      if (result.rowCount !== 1) throw new Error("Action changed during reconciliation")
    }
  }
  await client.query(options.apply ? "commit" : "rollback")
  console.log(
    JSON.stringify({
      billId: options.billId,
      archiveStream: stream,
      archiveSha256: hash,
      actions: stored.rowCount,
      missingProvenance: updates.length,
      applied: options.apply === true
    })
  )
} catch (error) {
  await client.query("rollback")
  throw error
} finally {
  await client.end()
}
