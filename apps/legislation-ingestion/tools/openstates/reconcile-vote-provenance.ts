import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { bills, votes, votePositions } from "@repo/legislation-core/database/schema/schema"
import { Command } from "commander"
import { eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../src/config/config.js"
import { AzureBlobArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { normalizeArchivedScraperBills } from "../../src/ingestion/openstates/scraper-normalize.js"
import { observeCanonicalRecord } from "../../src/persistence/changes.js"
import { planVoteProvenance } from "../../src/persistence/vote-provenance.js"

const options = new Command()
  .requiredOption("--manifest-path <path>")
  .requiredOption("--manifest-sha256 <hash>")
  .requiredOption("--approved-build-sha256 <hash>")
  .requiredOption("--retrieved-at <timestamp>")
  .requiredOption("--bill-id <id>")
  .requiredOption("--database-env <name>")
  .option("--apply", "reconcile only matched votes and their source voter observations")
  .parse()
  .opts<{
    manifestPath: string
    manifestSha256: string
    approvedBuildSha256: string
    retrievedAt: string
    billId: string
    databaseEnv: string
    apply?: boolean
  }>()
const config = loadConfig()
const store = new AzureBlobArtifactStore(
  z.string().min(1).parse(config.azure.storageAccount),
  config.azure.stateSourceContainer
)
const manifestSha256 = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(options.manifestSha256)
if (
  createHash("sha256")
    .update(await store.read(options.manifestPath))
    .digest("hex") !== manifestSha256
) {
  throw new Error("Scraper manifest checksum mismatch")
}
const rows = await normalizeArchivedScraperBills({
  store,
  manifestPath: options.manifestPath,
  approvedBuildInputsSha256: options.approvedBuildSha256,
  retrievedAt: new Date(z.iso.datetime({ offset: true }).parse(options.retrievedAt))
})
const matching = rows.filter((row) => row.aggregate.bill.id === options.billId)
const aggregate = matching[0]?.aggregate
if (matching.length !== 1 || !aggregate?.votes?.length)
  throw new Error("Exactly one source bill with votes is required")
const expected = aggregate.votes
const { database, pool } = createDatabase({
  url: z.string().min(1).parse(process.env[options.databaseEnv]),
  maxConnections: 1,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 1000
})
try {
  const result = await database.transaction(async (transaction) => {
    if (!options.apply) await transaction.execute(sql`set transaction read only`)
    await transaction.execute(sql`set local statement_timeout='15s'`)
    await transaction.execute(sql`set local lock_timeout='3s'`)
    const query = transaction.select({ id: bills.id }).from(bills).where(eq(bills.id, options.billId))
    const parents = await (options.apply ? query.for("update") : query)
    if (parents.length !== 1) throw new Error("Canonical bill is missing")
    const stored = await transaction.select().from(votes).where(eq(votes.billId, options.billId))
    const positions = stored.length
      ? await transaction
          .select()
          .from(votePositions)
          .where(
            inArray(
              votePositions.voteId,
              stored.map((vote) => vote.id)
            )
          )
      : []
    const planned = planVoteProvenance(
      expected,
      stored.map((vote) => ({ vote, positions: positions.filter((position) => position.voteId === vote.id) }))
    )
    if (options.apply) {
      for (const entry of planned) {
        await transaction.update(votes).set(entry.vote).where(eq(votes.id, entry.vote.id))
        await transaction.delete(votePositions).where(eq(votePositions.voteId, entry.vote.id))
        for (let offset = 0; offset < entry.positions.length; offset += 100) {
          await transaction.insert(votePositions).values(entry.positions.slice(offset, offset + 100))
        }
        await observeCanonicalRecord(transaction, {
          recordType: "vote",
          recordId: entry.vote.id,
          jurisdictionId: aggregate.bill.jurisdictionId,
          fields: {
            heldAt: entry.vote.heldAt,
            heldDate: entry.vote.heldDate,
            motion: entry.vote.motion,
            noCount: entry.vote.noCount,
            otherCount: entry.vote.otherCount,
            result: entry.vote.result,
            yesCount: entry.vote.yesCount
          }
        })
      }
    }
    return {
      billId: options.billId,
      manifestSha256,
      applied: options.apply === true,
      votes: planned.map((entry) => ({
        id: entry.vote.id,
        heldDate: entry.vote.heldDate,
        heldAt: entry.vote.heldAt,
        positions: entry.positions.length,
        unresolvedPositions: entry.positions.filter((position) => !position.personId).length
      }))
    }
  })
  console.log(JSON.stringify(result))
} finally {
  await pool.end()
}
