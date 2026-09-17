import { createHash } from "node:crypto"
import { Command } from "commander"
import pg from "pg"
import { z } from "zod"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"

const command = new Command()
  .argument("<state>")
  .argument("<session>")
  .requiredOption("--reference-database-env <name>", "environment variable for the reference OCR database")
  .requiredOption("--target-database-env <name>", "environment variable for the target database")
  .option("--output <directory>", "audit artifact directory", "artifacts/openstates-runtime/production-ocr-audit")
  .parse()
const options = command.opts<{ referenceDatabaseEnv: string; targetDatabaseEnv: string; output: string }>()
const state = z.enum(["ak", "nc"]).parse(command.args[0])
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(command.args[1])
const rowSchema = z.object({
  id: z.string(),
  bill_id: z.string(),
  source_url: z.string(),
  source_sha256: z.string().nullable(),
  text_hash: z.string().nullable(),
  characters: z.number().nullable(),
  processing_status: z.string(),
  ocr_status: z.string().nullable()
})
async function snapshot(variable: string) {
  const pool = new pg.Pool({ connectionString: z.string().min(1).parse(process.env[variable]) })
  const client = await pool.connect()
  try {
    await client.query("begin isolation level repeatable read read only")
    await client.query("set local statement_timeout='30s'")
    const observed = await client.query("select transaction_timestamp()::text as observed_at")
    const bills = await client.query("select id from legislation.bills where id like $1 order by id", [
      `bill:${state}:${session.toLowerCase()}:%`
    ])
    const billIds = z
      .array(z.object({ id: z.string() }))
      .parse(bills.rows)
      .map((bill) => bill.id)
    const rows: z.infer<typeof rowSchema>[] = []
    for (let offset = 0; offset < billIds.length; offset += 25) {
      const batch = await client.query(
        `select id,bill_id,source_url,content_hash as source_sha256,md5(text) as text_hash,
         length(text)::int as characters,ocr_status,processing_status from legislation.bill_documents
         where bill_id=any($1::text[]) order by id`,
        [billIds.slice(offset, offset + 25)]
      )
      rows.push(...z.array(rowSchema).parse(batch.rows))
    }
    return { observedAt: z.string().parse(observed.rows[0]?.observed_at), rows }
  } finally {
    await client.query("rollback")
    client.release()
    await pool.end()
  }
}
const reference = await snapshot(options.referenceDatabaseEnv)
const target = await snapshot(options.targetDatabaseEnv)
const referenceRows = reference.rows.filter(
  (entry) => entry.processing_status === "processed" && entry.ocr_status === "processed" && (entry.characters ?? 0) > 0
)
if (referenceRows.length === 0 || target.rows.length === 0) {
  throw new Error("Parity audit requires nonempty reference OCR and target document scopes")
}
const key = (row: z.infer<typeof rowSchema>) => JSON.stringify([row.bill_id, row.source_url])
const referenceCounts = new Map<string, number>()
for (const row of referenceRows) {
  referenceCounts.set(key(row), (referenceCounts.get(key(row)) ?? 0) + 1)
}
const targets = new Map<string, z.infer<typeof rowSchema>[]>()
for (const row of target.rows) {
  const matches = targets.get(key(row)) ?? []
  matches.push(row)
  targets.set(key(row), matches)
}
const differences = []
const unresolved = []
let identical = 0
for (const row of referenceRows) {
  if (referenceCounts.get(key(row)) !== 1) {
    unresolved.push({ referenceId: row.id, reason: "ambiguous-reference" })
    continue
  }
  const matches = targets.get(key(row)) ?? []
  const match = matches[0]
  if (matches.length !== 1 || !match) {
    unresolved.push({ referenceId: row.id, reason: "missing-or-ambiguous-target", matches: matches.length })
  } else if (match.processing_status !== "processed" || !match.text_hash || (match.characters ?? 0) === 0) {
    unresolved.push({
      referenceId: row.id,
      productionId: match.id,
      reason: "target-extraction-incomplete",
      processingStatus: match.processing_status
    })
  } else if (
    !row.source_sha256 ||
    !/^[a-f0-9]{64}$/.test(row.source_sha256) ||
    row.source_sha256 !== match.source_sha256
  ) {
    unresolved.push({ referenceId: row.id, productionId: match.id, reason: "different-or-missing-source-hash" })
  } else if (row.text_hash === match.text_hash) {
    identical += 1
  } else {
    differences.push({
      referenceId: row.id,
      productionId: match.id,
      billId: match.bill_id,
      sourceUrl: match.source_url,
      sourceSha256: match.source_sha256,
      productionTextHash: match.text_hash,
      referenceTextHash: row.text_hash,
      productionCharacters: match.characters,
      referenceCharacters: row.characters
    })
  }
}
const report = {
  state,
  session,
  referenceObservedAt: reference.observedAt,
  targetObservedAt: target.observedAt,
  identical,
  differences,
  unresolved,
  productionWrites: false,
  qualityJudgment: "Differences require normal pipeline re-extraction, not copying reference text."
}
const bytes = Buffer.from(JSON.stringify(report))
const digest = createHash("sha256").update(bytes).digest("hex")
const store = new LocalArtifactStore(options.output)
const path = `${state}/${digest}.json`
await store.put(path, bytes)
if (
  createHash("sha256")
    .update(await store.read(path))
    .digest("hex") !== digest
) {
  throw new Error("Audit artifact checksum verification failed")
}
process.stdout.write(
  JSON.stringify({
    path,
    digest,
    identical,
    differences: differences.length,
    unresolved: unresolved.length,
    productionWrites: false
  }) + "\n"
)
