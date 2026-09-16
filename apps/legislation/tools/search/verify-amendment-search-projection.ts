import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { getTableColumns } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "../../src/db/schema/schema.js"
import { buildDocumentAmendmentLexicalQuery } from "../../src/legislation/query-service.js"

function parseConnection(value: string | undefined) {
  try {
    return new URL(value ?? "")
  } catch {
    throw new Error("Explicit source and isolated benchmark PostgreSQL URLs are required")
  }
}
const target = parseConnection(process.env.TEXT_INDEX_BENCHMARK_URL)
const source = parseConnection(process.env.DATABASE_URL)
assert.ok(["postgres:", "postgresql:"].includes(target.protocol))
assert.equal(target.pathname, "/legislation_search_benchmark")
assert.notEqual(target.host, source.host)
const client = new pg.Client({ connectionString: target.href, connectionTimeoutMillis: 10_000 })
let ownsSchema = false
await client.connect()
try {
  assert.equal((await client.query("select current_database() name")).rows[0]?.name, "legislation_search_benchmark")
  await client.query("set statement_timeout=15000")
  await client.query("create schema legislation")
  ownsSchema = true
  for (const [name, table] of [
    ["bills", schema.bills],
    ["bill_documents", schema.billDocuments],
    ["document_sections", schema.documentSections]
  ] as const) {
    // Exercise actual query columns without provisioning the unrelated vector extension
    // or ingestion constraints. This is a projection/query fixture, not a schema migration test.
    const columns = Object.values(getTableColumns(table)).map(
      (column) =>
        `"${column.name}" ${column.getSQLType().startsWith("vector") ? "text" : column.getSQLType()}${column.name === "id" ? " primary key" : ""}`
    )
    await client.query(`create table legislation.${name} (${columns.join(",")})`)
  }
  await client.query(`alter table legislation.document_sections add foreign key(document_id)
    references legislation.bill_documents(id) on delete cascade`)
  await client.query(`create function legislation.fixture_section_vector() returns trigger language plpgsql as $$
    begin new.search_vector := setweight(to_tsvector('english',coalesce(new.heading,'')),'A') ||
      setweight(to_tsvector('english',new.text),'B'); return new; end $$;
    create trigger fixture_section_vector before insert or update of heading,text on legislation.document_sections
    for each row execute function legislation.fixture_section_vector()`)
  await client.query(
    await readFile(new URL("../../src/db/migrations/0046_amendment_section_search.sql", import.meta.url), "utf8")
  )
  await client.query(await readFile(new URL("./amendment-section-search-behavior.sql", import.meta.url), "utf8"))
  process.stdout.write("Projection SQL behavior checks passed\n")
  await client.query(`insert into legislation.bills(id,jurisdiction_id,session_id) values ('bill-fixture','jurisdiction:us','session:119');
    insert into legislation.bill_documents(id,bill_id,title,classification,processing_status) values
      ('a','bill-fixture','Health insurance reform','amendment','processed'),
      ('b','bill-fixture','Tax reform','amendment','processed'),
      ('c','bill-fixture','Health insurance reform','amendment','processed'),
      ('d','bill-fixture','Health insurance reform','amendment','failed'),
      ('e','bill-fixture','Health insurance reform','version','processed');
    insert into legislation.document_sections(id,document_id,heading,text) values
      ('a1','a','Health','insurance coverage and tax credits'),
      ('a2','a','Coverage','health insurance eligibility'),
      ('a3','a',null,'unrelated text'),
      ('b1','b',null,'health insurance tax legislation'),
      ('b2','b',null,'health insurance tax legislation'),
      ('c1','c',null,'unrelated text'),
      ('c2','c',null,'another unrelated passage'),
      ('d1','d','Health','health insurance'),
      ('e1','e','Health','health insurance');
    update legislation.document_sections set search_vector=null where id='c2';
    update legislation.bill_documents set document_date='2026-01-01',updated_at='2026-01-01T00:00:00Z' where id='a';
    update legislation.bill_documents set document_date='2026-02-01',updated_at='2026-02-01T00:00:00Z' where id='b';
    insert into legislation.bill_documents(id,bill_id,title,classification,processing_status)
      select 'bulk-'||n,'bill-fixture','Tax','amendment','processed' from generate_series(1,260) n;
    insert into legislation.document_sections(id,document_id,text)
      select 'bulk-section-'||n,'bulk-'||n,'tax' from generate_series(1,260) n`)
  // Exercise the actual resumable CLI, including a NULL vector and an idempotent rerun.
  await client.query("delete from legislation.amendment_section_search")
  for (let attempt = 0; attempt < 2; attempt++) {
    const backfill = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "tools/search/backfill-amendment-search.ts", "--apply"],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        env: { ...process.env, DATABASE_URL: target.href },
        timeout: 60_000
      }
    )
    assert.match(backfill.stdout, /"phase":"completed"/)
    if (attempt === 1) {
      assert.match(backfill.stdout, /"changedRows":0/)
    }
  }
  assert.equal(
    (await client.query("select count(*)::int count from legislation.amendment_section_search")).rows[0]?.count,
    268
  )
  process.stdout.write("Actual backfill CLI and idempotent rerun passed\n")
  const database = drizzle(client, { schema })
  let parityChecks = 0
  for (const query of ["health", "insurance", "tax", '"health insurance"', "health OR tax", "health -tax", "-tax"]) {
    for (const limit of [1, 2, 20]) {
      const reference = (
        await client.query(
          `with candidates as (
        select d.id, s.id section_id,
          case when s.search_vector @@ websearch_to_tsquery('english',$1)
            then ts_rank_cd(s.search_vector,websearch_to_tsquery('english',$1)) else 0 end +
            ts_rank_cd(to_tsvector('english',coalesce(d.title,'')),websearch_to_tsquery('english',$1)) rank,
          to_tsvector('english',coalesce(d.title,'')) @@ websearch_to_tsquery('english',$1) identifier_matches,
          s.search_vector @@ websearch_to_tsquery('english',$1) text_matches,
          left(ts_headline('english',s.text,websearch_to_tsquery('english',$1),
            'MaxWords=35, MinWords=10, MaxFragments=1'),1000) snippet
        from legislation.document_sections s join legislation.bill_documents d on d.id=s.document_id
        join legislation.bills b on b.id=d.bill_id where d.classification='amendment' and d.processing_status='processed'
          and s.search_vector is not null and (s.search_vector @@ websearch_to_tsquery('english',$1) or
            to_tsvector('english',coalesce(d.title,'')) @@ websearch_to_tsquery('english',$1))
      ), best as (select distinct on(id) * from candidates order by id,rank desc,section_id)
      select id,rank,identifier_matches,text_matches,snippet from best order by rank desc,id limit $2`,
          [query, limit]
        )
      ).rows
      const actual = await buildDocumentAmendmentLexicalQuery(database, { query, mode: "lexical", limit }, limit)
      assert.deepEqual(
        actual.map((row) => ({
          id: row.document.id,
          rank: row.rank,
          identifier_matches: row.identifierMatches,
          text_matches: row.textMatches,
          snippet: row.snippet
        })),
        reference
      )
      parityChecks++
    }
  }
  let filterChecks = 0
  for (const [filters, expectedCount] of [
    [{ billIds: ["bill-fixture"] }, 3],
    [{ billIds: ["missing"] }, 0],
    [{ billIds: [] }, 0],
    [{ jurisdictionIds: ["jurisdiction:us"] }, 3],
    [{ jurisdictionIds: ["missing"] }, 0],
    [{ sessionIds: ["session:119"] }, 3],
    [{ sessionIds: ["missing"] }, 0],
    [{ submittedFrom: "2026-01-01" }, 2],
    [{ submittedTo: "2026-01-01" }, 1],
    [{ submittedFrom: "2026-02-02" }, 0],
    [{ updatedFrom: new Date("2026-01-01T00:00:00Z") }, 2],
    [{ updatedTo: new Date("2026-01-01T00:00:00Z") }, 1],
    [{ updatedToExclusive: new Date("2026-01-01T00:00:00Z") }, 0]
  ] as const) {
    const rows = await buildDocumentAmendmentLexicalQuery(
      database,
      { ...filters, query: "health", mode: "lexical", limit: 20 },
      20
    )
    assert.equal(rows.length, expectedCount)
    filterChecks++
  }
  for (const ids of [["a"], []]) {
    const rows = await buildDocumentAmendmentLexicalQuery(
      database,
      { query: "health", mode: "lexical", limit: 20 },
      20,
      ids
    )
    assert.deepEqual(
      rows.map(({ document }) => document.id),
      ids
    )
    filterChecks++
  }
  // A second connection must wait for parent title changes, then use their committed value.
  const writer = new pg.Client({ connectionString: target.href, connectionTimeoutMillis: 10_000 })
  await writer.connect()
  try {
    await writer.query("set statement_timeout=15000")
    const writerPid = (await writer.query("select pg_backend_pid() pid")).rows[0]?.pid
    await client.query("begin")
    await client.query("update legislation.bill_documents set title='Concurrent title' where id='a'")
    const writing = writer
      .query("insert into legislation.document_sections(id,document_id,text) values ('concurrent','a','tax')")
      .then(
        () => ({ error: null }),
        (error: unknown) => ({ error })
      )
    let isBlocked = false
    for (let attempt = 0; attempt < 10 && !isBlocked; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      isBlocked =
        (await client.query("select cardinality(pg_blocking_pids($1))>0 blocked", [writerPid])).rows[0]?.blocked ===
        true
    }
    await client.query("commit")
    const written = await writing
    assert.equal(written.error, null)
    assert.equal(isBlocked, true, "Section writer must serialize with parent metadata maintenance")
    assert.equal(
      (
        await client.query(`select title_vector=to_tsvector('english','Concurrent title') correct
      from legislation.amendment_section_search where section_id='concurrent'`)
      ).rows[0]?.correct,
      true
    )
  } finally {
    await client.query("rollback").catch(() => undefined)
    await writer.end()
  }
  process.stdout.write(`${JSON.stringify({ parityChecks, filterChecks, concurrentParentAndSectionWrite: "passed" })}\n`)
} finally {
  await client.query("rollback").catch(() => undefined)
  if (ownsSchema) {
    await client.query("drop schema legislation cascade")
  }
  await client.end()
}
