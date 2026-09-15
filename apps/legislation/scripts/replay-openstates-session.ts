import { z } from "zod"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"
import { executeOpenStatesArchiveImport, listOpenStatesHistoricalArchives } from "../src/ingestion/backfill/backfill.js"
import { LocalSourceStore } from "../src/ingestion/source-store.js"

const state = z.enum(["nc", "ak"]).parse(process.argv[2])
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(process.argv[3])
const archives = await listOpenStatesHistoricalArchives({
  config: loadConfig(),
  jurisdictions: [state],
  manifestBlob: "manifests/openstates/session-json-2017-onward-2026-08-17.json"
})
const archive = archives.find((entry) => entry.session === session)
if (!archive) {
  throw new Error("Requested session is absent from the retained manifest")
}
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
})
const { database, pool } = createDatabase(config.database)
try {
  const result = await executeOpenStatesArchiveImport(
    {
      config,
      database,
      archive: { ...archive, url: new URL(archive.url) },
      correlationId: `history-${state}-${session}-${Date.now()}`
    },
    { sourceStore: new LocalSourceStore("artifacts/openstates-history/session-replays") }
  )
  process.stdout.write(`${JSON.stringify({ state, session, ...result, productionWrites: false })}\n`)
  if (result.status !== "succeeded") {
    process.exitCode = 1
  }
} finally {
  await pool.end()
}
