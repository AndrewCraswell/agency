import pg from "pg"
import { z } from "zod"
import { inspectPassageSearchReadiness } from "../../src/search/passage-search-readiness.js"

const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
const source = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10_000 })
const target = new pg.Client({ connectionString: env.PASSAGE_SEARCH_DATABASE_URL, connectionTimeoutMillis: 10_000 })
try {
  await source.connect()
  await target.connect()
  const report = await inspectPassageSearchReadiness(source, target)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.synchronizationCaughtUpAtObservation) {
    process.exitCode = 2
  }
} finally {
  await Promise.allSettled([source.end(), target.end()])
}
