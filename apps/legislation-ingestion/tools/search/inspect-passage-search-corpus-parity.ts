import assert from "node:assert/strict"
import pg from "pg"
import { z } from "zod"
import { inspectPassageCorpusParity } from "../../src/search/passage-search-corpus-parity.js"

const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
const jurisdictions = process.argv.slice(2)
assert.ok(jurisdictions.length > 0, "Provide one or more jurisdiction names")
assert.equal(new Set(jurisdictions.map((name) => name.toLocaleLowerCase())).size, jurisdictions.length)
const sourceUrl = new URL(env.DATABASE_URL)
const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
assert.equal(targetUrl.pathname, "/legislation_passage_search")
assert.notEqual(targetUrl.host, sourceUrl.host)

const source = new pg.Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 10_000 })
const target = new pg.Client({ connectionString: targetUrl.href, connectionTimeoutMillis: 10_000 })
try {
  await Promise.all([source.connect(), target.connect()])
  const results = []
  for (const jurisdiction of jurisdictions) {
    results.push(await inspectPassageCorpusParity(source, target, jurisdiction))
  }
  const matches = results.every((result) => result.matches)
  process.stdout.write(
    `${JSON.stringify(
      {
        matches,
        results: results.map((result) => ({
          jurisdictionId: result.jurisdictionId,
          jurisdictionName: result.jurisdictionName,
          matches: result.matches,
          mismatchedBuckets: result.mismatchedBuckets,
          source: {
            buckets: result.source.buckets.length,
            documents: result.source.documents,
            rows: result.source.rows
          },
          target: {
            buckets: result.target.buckets.length,
            documents: result.target.documents,
            rows: result.target.rows
          }
        }))
      },
      null,
      2
    )}\n`
  )
  assert.ok(matches, "Passage search corpus parity failed")
} finally {
  await Promise.allSettled([source.end(), target.end()])
}
