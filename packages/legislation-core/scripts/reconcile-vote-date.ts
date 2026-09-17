import { createHash } from "node:crypto"
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { z } from "zod"
import { votes } from "../src/database/schema/schema.js"

// Explicit operations entrypoint for databases whose original migrations have already run.
const operation = z.enum(["inspect", "apply"]).parse(process.argv[2] ?? "inspect")
const constraintName = "votes_timeline_complete_check"
const constraint = getTableConfig(votes).checks.find((entry) => entry.name === constraintName)
if (!constraint) throw new Error("Canonical vote completeness constraint is missing")
const rendered = new PgDialect().sqlToQuery(constraint.value)
if (rendered.params.length > 0) throw new Error("Canonical DDL must not contain bound parameters")
const fingerprint = `vote-date-contract:${createHash("sha256").update(rendered.sql).digest("hex")}`
const client = new pg.Client({
  connectionString: z.url({ protocol: /^postgres(?:ql)?$/ }).parse(process.env.DATABASE_URL),
  connectionTimeoutMillis: 5000
})

async function inspect() {
  const column = await client.query<{ data_type: string }>(
    "select data_type from information_schema.columns where table_schema='legislation' and table_name='votes' and column_name='held_date'"
  )
  const constraints = await client.query<{ convalidated: boolean; fingerprint: string | null }>(
    "select convalidated,obj_description(oid,'pg_constraint') as fingerprint from pg_constraint where conrelid='legislation.votes'::regclass and conname=$1",
    [constraintName]
  )
  const type = column.rows[0]?.data_type
  if (type !== undefined && type !== "date") throw new Error("Existing held_date column has an unexpected type")
  return {
    hasColumn: type === "date",
    matches: constraints.rows[0]?.fingerprint === fingerprint,
    validated: constraints.rows[0]?.convalidated === true
  }
}

await client.connect()
try {
  await client.query("begin read only")
  await client.query("set local statement_timeout='15s'")
  const before = await inspect()
  await client.query("commit")
  if (operation === "apply" && (!before.hasColumn || !before.matches)) {
    await client.query("begin")
    await client.query("set local lock_timeout='3s'")
    await client.query("set local statement_timeout='15s'")
    await client.query("alter table legislation.votes add column if not exists held_date date")
    await client.query("alter table legislation.votes drop constraint if exists votes_timeline_complete_check")
    await client.query(
      `alter table legislation.votes add constraint votes_timeline_complete_check check (${rendered.sql}) not valid`
    )
    // Digest is derived exclusively from repository-owned SQL, not user-supplied text.
    await client.query(`comment on constraint votes_timeline_complete_check on legislation.votes is '${fingerprint}'`)
    await client.query("commit")
  }
  if (operation === "apply" && (!before.validated || !before.matches || !before.hasColumn)) {
    await client.query("begin")
    await client.query("set local lock_timeout='3s'")
    await client.query("set local statement_timeout='30s'")
    await client.query("alter table legislation.votes validate constraint votes_timeline_complete_check")
    await client.query("commit")
  }
  await client.query("begin read only")
  await client.query("set local statement_timeout='15s'")
  const after = await inspect()
  await client.query("commit")
  console.log(JSON.stringify({ operation, before, after, ready: after.hasColumn && after.matches && after.validated }))
} catch (error) {
  await client.query("rollback")
  throw error
} finally {
  await client.end()
}
