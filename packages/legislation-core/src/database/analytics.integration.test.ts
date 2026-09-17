import { compileAnalytics } from "@repo/legislation-core/research/analytics"
import { PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const url = process.env.LEGISLATION_ANALYTICS_TEST_DATABASE_URL
const suite = url ? describe : describe.skip
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 })
const fixtures = `with
test_bills(id,title,session_id,jurisdiction_id) as (values
 ('bill:us:119:hr:1','First','session:us:119','jurisdiction:us'),
 ('bill:us:119:hr:2','Second','session:us:119','jurisdiction:us'),
 ('bill:us:119:hr:3','No children','session:us:119','jurisdiction:us')),
test_people(id,name,party) as (values ('person:one','One','A'),('person:two','Two',null::text)),
test_bill_sponsors(id,bill_id,person_id,is_primary,name) as (values
 ('sponsor:1','bill:us:119:hr:1','person:one',true,'Rep. One [A]'),
 ('sponsor:2','bill:us:119:hr:1','person:two',false,'Rep. Two'),
 ('sponsor:3','bill:us:119:hr:2','person:one',true,'Rep. One [A]')),
test_amendments(id,bill_id,session_id) as (values
 ('amendment:1','bill:us:119:hr:1','session:us:118'),('amendment:2','bill:us:119:hr:1','session:us:119'),('amendment:3','bill:us:119:hr:2','session:us:119')),
test_bill_documents(id,bill_id,classification) as (values
 ('document:1','bill:us:119:hr:1','version'),('document:2','bill:us:119:hr:2',null::text)),
test_votes(id,session_id) as (values ('vote:1','session:us:119'),('vote:2','session:us:119')),
test_legislative_events(id,is_deleted) as (values ('event:visible',false),('event:deleted',true)),
test_event_bills(event_id,bill_id,classification) as (values
 ('event:visible','bill:us:119:hr:1','related'),('event:deleted','bill:us:119:hr:1','related')),
test_vote_positions(vote_id,source_identity,person_id,option) as (values
 ('vote:1','one-a','person:one','yes'),('vote:1','one-b','person:one','yes'),
 ('vote:2','one','person:one','absent'),('vote:1','two','person:two','no'),
 ('vote:2','unresolved',null::text,'not-voting'))
`

async function execute(input: unknown) {
  const query = new PgDialect().sqlToQuery(compileAnalytics(input).statement)
  let text = query.sql
  for (const table of [
    "bills",
    "people",
    "bill_sponsors",
    "amendments",
    "bill_documents",
    "votes",
    "vote_positions",
    "legislative_events",
    "event_bills"
  ]) {
    text = text.replaceAll(`"legislation"."${table}"`, `"test_${table}"`)
  }
  const client = await pool.connect()
  try {
    await client.query("begin read only")
    await client.query("set local statement_timeout = '5000'")
    const result = await client.query(`${fixtures} ${text}`, query.params)
    await client.query("rollback")
    return result.rows
  } finally {
    await client.query("rollback")
    client.release()
  }
}

beforeAll(() => {
  pg.types.setTypeParser(1700, Number)
})
afterAll(async () => {
  await pool.end()
})

suite("analytics SQL against isolated read-only fixtures", () => {
  it("preserves the published sponsorship label separately from the canonical person name", async () => {
    expect(
      await execute({
        dataset: "sponsorships",
        select: ["name", "person.name"],
        filters: [{ field: "id", op: "eq", values: ["sponsor:1"] }]
      })
    ).toEqual([{ name: "Rep. One [A]", "person.name": "One" }])
  })

  it("keeps bill-session scope distinct from amendment-session scope", async () => {
    const query = { dataset: "amendments", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] }
    expect(
      await execute({ ...query, filters: [{ field: "bill.sessionId", op: "eq", values: ["session:us:119"] }] })
    ).toEqual([{ total: 3 }])
    expect(
      await execute({ ...query, filters: [{ field: "sessionId", op: "eq", values: ["session:us:119"] }] })
    ).toEqual([{ total: 2 }])
  })

  it("groups actual child documents without inventing a missing-document group", async () => {
    const query = {
      dataset: "bills",
      select: ["documents.classification"],
      metrics: [{ name: "total", operation: "countDistinct", field: "documents.id" }]
    }
    expect(await execute(query)).toEqual([
      { "documents.classification": "version", total: 1 },
      { "documents.classification": null, total: 1 }
    ])
    expect(await execute({ ...query, filters: [{ field: "id", op: "eq", values: ["bill:us:119:hr:3"] }] })).toEqual([])
    expect(
      await execute({ ...query, select: ["id"], filters: [{ field: "id", op: "eq", values: ["bill:us:119:hr:3"] }] })
    ).toEqual([{ id: "bill:us:119:hr:3", total: 0 }])
  })

  it("keeps mixed parent and child measures on the same grouping population", async () => {
    const query = {
      dataset: "bills",
      select: ["documents.classification"],
      filters: [{ field: "id", op: "eq", values: ["bill:us:119:hr:3"] }],
      metrics: [
        { name: "documents", operation: "countDistinct", field: "documents.id" },
        { name: "bills", operation: "countDistinct", field: "id" }
      ]
    }
    expect(await execute(query)).toEqual([{ "documents.classification": null, documents: 0, bills: 1 }])
    expect(
      await execute({
        ...query,
        metrics: [query.metrics[0], { name: "first", operation: "min", field: "documents.id" }]
      })
    ).toEqual([])
  })
  it("excludes deleted meetings when counting foreign-key links without joining the meeting", async () => {
    const rows = await execute({
      dataset: "bills",
      select: ["id"],
      metrics: [{ name: "total", operation: "countDistinct", field: "meetingBills.eventId" }],
      filters: [{ field: "id", op: "eq", values: ["bill:us:119:hr:1"] }]
    })
    expect(rows).toEqual([{ id: "bill:us:119:hr:1", total: 1 }])
  })
  it("deduplicates independent one-to-many metrics and retains zero-child groups", async () => {
    const rows = await execute({
      dataset: "bills",
      select: ["id"],
      metrics: [
        { name: "amendments", operation: "countDistinct", field: "amendments.id" },
        { name: "sponsors", operation: "countDistinct", field: "sponsorships.personId" }
      ],
      orderBy: [{ field: "id", direction: "asc" }]
    })
    expect(rows).toEqual([
      { id: "bill:us:119:hr:1", amendments: 2, sponsors: 2 },
      { id: "bill:us:119:hr:2", amendments: 1, sponsors: 1 },
      { id: "bill:us:119:hr:3", amendments: 0, sponsors: 0 }
    ])
  })

  it("keeps distinct-vote and position-identity counts separate", async () => {
    const rows = await execute({
      dataset: "positions",
      select: ["personId"],
      metrics: [
        { name: "votes", operation: "countDistinct", field: "voteId" },
        { name: "positions", operation: "countDistinct", field: "_key" }
      ],
      orderBy: [{ field: "personId", direction: "asc" }]
    })
    expect(rows).toEqual([
      { personId: "person:one", votes: 2, positions: 3 },
      { personId: "person:two", votes: 1, positions: 1 },
      { personId: null, votes: 1, positions: 1 }
    ])
  })

  it("retains null groups and zero-numerator groups for conditional percentages", async () => {
    const rows = await execute({
      dataset: "positions",
      select: ["personId"],
      metrics: [
        {
          name: "matching",
          operation: "countDistinct",
          field: "voteId",
          filters: [{ field: "option", op: "eq", values: ["absent"] }]
        },
        { name: "total", operation: "countDistinct", field: "voteId" }
      ],
      rates: [{ name: "percent", numerator: "matching", denominator: "total" }],
      orderBy: [{ field: "personId", direction: "asc" }]
    })
    expect(rows).toEqual([
      { personId: "person:one", matching: 1, total: 2, percent: 50 },
      { personId: "person:two", matching: 0, total: 1, percent: 0 },
      { personId: null, matching: 0, total: 1, percent: 0 }
    ])
  })

  it("returns null for an empty denominator", async () => {
    const rows = await execute({
      dataset: "positions",
      filters: [{ field: "personId", op: "eq", values: ["missing"] }],
      metrics: [
        {
          name: "matching",
          operation: "countDistinct",
          field: "voteId",
          filters: [{ field: "option", op: "eq", values: ["absent"] }]
        },
        { name: "total", operation: "countDistinct", field: "voteId" }
      ],
      rates: [{ name: "percent", numerator: "matching", denominator: "total" }]
    })
    expect(rows).toEqual([{ matching: 0, total: 0, percent: null }])
  })

  it("applies having before stable pagination across tied groups", async () => {
    const rows = await execute({
      dataset: "bills",
      select: ["id"],
      metrics: [{ name: "total", operation: "countDistinct", field: "sponsorships.personId" }],
      having: [{ field: "total", op: "gte", value: 1 }],
      orderBy: [{ field: "total", direction: "desc" }],
      limit: 1,
      offset: 1
    })
    expect(rows).toEqual([{ id: "bill:us:119:hr:2", total: 1 }])
  })

  it("pushes positive conditional counts down without retaining zero groups", async () => {
    const query = {
      dataset: "people",
      select: ["id"],
      metrics: [
        {
          name: "total",
          operation: "countDistinct",
          field: "positions.voteId",
          filters: [{ field: "positions.option", op: "eq", values: ["absent"] }]
        }
      ],
      having: [{ field: "total", op: "gte", value: 1 }]
    }
    expect(await execute(query)).toEqual([{ id: "person:one", total: 1 }])
    const compiled = new PgDialect().sqlToQuery(compileAnalytics(query).statement)
    expect(compiled.sql).toContain('where "join1"."option" =')
    expect(await execute({ ...query, having: [] })).toEqual([
      { id: "person:one", total: 1 },
      { id: "person:two", total: 0 }
    ])
  })
})
