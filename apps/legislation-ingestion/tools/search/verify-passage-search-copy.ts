import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import pg from "pg"
import { z } from "zod"
import { replicatePassageDocument } from "../../src/search/passage-search-replication.js"

const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
const sourceUrl = new URL(env.DATABASE_URL)
const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
assert.equal(targetUrl.pathname, "/legislation_passage_search")
assert.notEqual(targetUrl.host, sourceUrl.host)
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--initialize"))
const source = new pg.Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 10_000 })
const target = new pg.Client({ connectionString: targetUrl.href, connectionTimeoutMillis: 10_000 })
try {
  await source.connect()
  await target.connect()
  const identity = await target.query("select current_database() name")
  assert.equal(identity.rows[0]?.name, "legislation_passage_search")
  if (process.argv[2] === "--initialize") {
    await target.query("begin")
    await target.query("set local statement_timeout='60s'")
    await target.query(
      await readFile(
        new URL(
          "../../infra/passage-search/schema.sql",
          import.meta.resolve("@repo/legislation-core/database/migrate")
        ),
        "utf8"
      )
    )
    await target.query("commit")
  }
  await source.query("begin read only")
  await source.query("set local statement_timeout='15s'")
  const response = await source.query(`select document_id from legislation.document_sections
    order by id limit 10`)
  const documents = [
    ...new Set(
      z
        .array(z.object({ document_id: z.string() }))
        .parse(response.rows)
        .map((row) => row.document_id)
    )
  ]
  await source.query("commit")
  assert.ok(documents.length > 0)
  let copied = 0
  for (const documentId of documents) {
    const first = await replicatePassageDocument(source, target, documentId)
    const second = await replicatePassageDocument(source, target, documentId)
    assert.equal(first.sections, second.sections)
    copied += second.sections
  }
  assert.ok(copied > 0)
  await target.query("begin read only")
  await target.query("set local statement_timeout='5s'")
  const started = performance.now()
  const persisted = await target.query(
    "SELECT count(*)::integer AS count FROM legislation.document_sections WHERE document_id=ANY($1::text[])",
    [documents]
  )
  assert.equal(persisted.rows[0]?.count, copied)
  const elapsedMs = Math.round(performance.now() - started)
  await target.query("commit")
  process.stdout.write(
    `${JSON.stringify({ documents: documents.length, sections: copied, replay: "passed", persisted: persisted.rows[0]?.count, elapsedMs, scope: "copy canary, not full-corpus acceptance" })}\n`
  )
} finally {
  await Promise.allSettled([source.end(), target.end()])
}
