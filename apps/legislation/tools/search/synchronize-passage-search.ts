import pg from "pg"
import { z } from "zod"
import { drainPassageChanges, enqueuePassageBackfill } from "../../src/search/passage-search-queue.js"

const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
const sourceUrl = new URL(env.DATABASE_URL)
const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
if (targetUrl.pathname !== "/legislation_passage_search" || targetUrl.host === sourceUrl.host) {
  throw new Error("Passage target must be the isolated legislation_passage_search database")
}
const mode = process.argv[2]
if (mode !== "enqueue" && mode !== "drain") {
  throw new Error("Choose enqueue or drain")
}
const source = new pg.Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 10_000 })
const target = new pg.Client({ connectionString: targetUrl.href, connectionTimeoutMillis: 10_000 })
try {
  await source.connect()
  if (mode === "enqueue") {
    const enqueued = await enqueuePassageBackfill(source)
    process.stdout.write(`${JSON.stringify({ enqueued })}\n`)
  } else {
    await target.connect()
    const result = await drainPassageChanges(source, target)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
} finally {
  await Promise.allSettled([source.end(), target.end()])
}
