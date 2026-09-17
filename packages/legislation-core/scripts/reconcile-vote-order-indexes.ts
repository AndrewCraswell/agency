import { readFile } from "node:fs/promises"
import pg from "pg"
import { z } from "zod"

// Direct PostgreSQL session required: transaction-pooler connections cannot own
// session locks or safely carry concurrent-index statement/lock timeouts.
const operation = z.enum(["inspect", "apply"]).parse(process.argv[2] ?? "inspect")
const baseline = await readFile(
  new URL("../src/database/migrations/0034_timeline-canonical-facts.sql", import.meta.url),
  "utf8"
)
const definitions = baseline.match(/CREATE INDEX IF NOT EXISTS "votes_occurrence_(?:asc|desc)_idx"[^;]+;/g)
if (definitions?.length !== 2) throw new Error("Expected exactly two canonical vote-order indexes")
const client = new pg.Client({
  connectionString: z.url({ protocol: /^postgres(?:ql)?$/ }).parse(process.env.VOTE_INDEX_DATABASE_URL),
  connectionTimeoutMillis: 5000,
  application_name: "vote-order-index-reconciliation",
  options: "-c statement_timeout=600000 -c lock_timeout=3000"
})

async function inspect(name: string) {
  const result = await client.query<{
    indisvalid: boolean
    indisready: boolean
    first: string
    second: string
    predicate: string
    options: string
    amname: string
    indnatts: number
    indnkeyatts: number
    correct_table: boolean
    definition: string
    size: string
  }>(
    `select i.indisvalid,i.indisready,pg_get_indexdef(c.oid,1,true) as first,
    pg_get_indexdef(c.oid,2,true) as second,pg_get_expr(i.indpred,i.indrelid) as predicate,
    i.indoption::text as options,am.amname,i.indnatts,i.indnkeyatts,
    i.indrelid='legislation.votes'::regclass as correct_table,pg_get_indexdef(c.oid) as definition,
    pg_size_pretty(pg_relation_size(c.oid)) as size
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_index i on i.indexrelid=c.oid join pg_am am on am.oid=c.relam
    where n.nspname='legislation' and c.relname=$1`,
    [name]
  )
  const row = result.rows[0]
  if (!row) return undefined
  const expectedOptions = name === "votes_occurrence_asc_idx" ? "0 0" : "3 0"
  if (
    row.first !== "COALESCE(held_at, (held_date::timestamp without time zone AT TIME ZONE 'UTC'::text))" ||
    row.second !== "id" ||
    row.predicate !== "timeline_complete" ||
    row.options !== expectedOptions ||
    row.amname !== "btree" ||
    row.indnatts !== 2 ||
    row.indnkeyatts !== 2 ||
    !row.correct_table
  ) {
    throw new Error(`Existing ${name} does not match the canonical ordering contract; no changes made to it`)
  }
  if (!row.indisvalid || !row.indisready) {
    throw new Error(`Existing ${name} is incomplete; inspect native progress/failure before recovery`)
  }
  return row
}

await client.connect()
try {
  if (operation === "apply") {
    const lock = await client.query<{ acquired: boolean }>("select pg_try_advisory_lock(731928,17) as acquired")
    if (!lock.rows[0]?.acquired) throw new Error("Another vote-order reconciliation owns the session lock")
  }
  for (const definition of definitions) {
    const name = /"(votes_occurrence_(?:asc|desc)_idx)"/.exec(definition)?.[1]
    if (!name) throw new Error("Missing canonical index name")
    let state = await inspect(name)
    if (!state && operation === "apply") {
      const progress = await client.query("select pid,phase from pg_stat_progress_create_index")
      if (progress.rowCount !== 0) throw new Error("An index build is active; refusing overlapping maintenance")
      console.log(JSON.stringify({ event: "building", name }))
      await client.query(definition.replace("CREATE INDEX IF NOT EXISTS", "CREATE INDEX CONCURRENTLY"))
      state = await inspect(name)
      if (!state) throw new Error(`Missing ${name} after successful build`)
    }
    console.log(JSON.stringify({ operation, name, ready: Boolean(state), state }))
  }
} finally {
  await client.end()
}
