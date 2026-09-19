import { migrateDatabase } from "@repo/legislation-core/database/migrate"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { analyticsQuerySchema } from "@repo/legislation-core/research/analytics-contract"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LegislationQueryService } from "./query-service"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
if (databaseUrl) {
  const target = new URL(databaseUrl)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.pathname !== "/legislation_test") {
    throw new Error("Query integration requires an isolated local legislation_test database")
  }
}
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 1 }) : undefined

afterAll(async () => {
  await pool?.end()
})

describe.skipIf(!pool)("legislation PostgreSQL queries", () => {
  beforeAll(async () => {
    if (!pool) {
      throw new Error("Missing isolated test database")
    }
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrateDatabase(drizzle(pool, { schema }))
  }, 60_000)

  afterAll(async () => {
    await pool?.query("drop schema if exists legislation cascade")
    await pool?.query("drop schema if exists legislation_migrations cascade")
  }, 60_000)

  it.each(["UTC", "America/Los_Angeles", "Asia/Tokyo"])(
    "filters and pages mixed-precision vote searches in %s",
    async (timezone) => {
      if (!pool) {
        throw new Error("Missing isolated test database")
      }
      const client = await pool.connect()
      try {
        await client.query("begin")
        await client.query("select set_config('TimeZone', $1, true)", [timezone])
        await client.query(`
          insert into legislation.votes (id, chamber, motion, held_at, held_date) values
            ('search-vote:01-before', 'lower', 'Vote search fixture', '2026-05-06 23:59:59.999+00', null),
            ('search-vote:02-day', 'lower', 'Vote search fixture', null, '2026-05-07'),
            ('search-vote:03-midnight', 'lower', 'Vote search fixture', '2026-05-07 00:00:00+00', null),
            ('search-vote:04-noon', 'lower', 'Vote search fixture', '2026-05-07 12:00:00+00', '2020-01-01'),
            ('search-vote:05-noon', 'lower', 'Vote search fixture', '2026-05-07 12:00:00+00', null),
            ('search-vote:06-end', 'lower', 'Vote search fixture', '2026-05-07 23:59:59.999+00', null),
            ('search-vote:07-next', 'lower', 'Vote search fixture', null, '2026-05-08'),
            ('search-vote:08-next', 'lower', 'Vote search fixture', '2026-05-08 00:00:00+00', null),
            ('search-vote:09-unknown', 'lower', 'Vote search fixture', null, null);
          insert into legislation.people (id, name) values ('person:vote-search', 'Vote search person');
          insert into legislation.vote_positions (vote_id, source_identity, person_id, option) values
            ('search-vote:02-day', 'search-person:1', 'person:vote-search', 'yes'),
            ('search-vote:02-day', 'search-person:2', null, 'no');
        `)
        const service = new LegislationQueryService(drizzle(client, { schema }))
        const query = "Vote search fixture"
        const all = await service.searchVotes({ query, limit: 100 })
        const expectedIds = [
          "search-vote:01-before",
          "search-vote:02-day",
          "search-vote:03-midnight",
          "search-vote:04-noon",
          "search-vote:05-noon",
          "search-vote:06-end",
          "search-vote:07-next",
          "search-vote:08-next",
          "search-vote:09-unknown"
        ]
        expect(all.items.map((vote) => vote.id)).toEqual(expectedIds)
        expect(all.items[1]).toMatchObject({ heldAt: null, heldDate: "2026-05-07" })
        expect(all.items.every((vote) => !("sortTimestamp" in vote))).toBe(true)
        expect(all.items[3]?.heldAt?.toISOString()).toBe("2026-05-07T12:00:00.000Z")

        const day = await service.searchVotes({ query, from: "2026-05-07", to: "2026-05-07" })
        expect(day.items.map((vote) => vote.id)).toEqual(expectedIds.slice(1, 6))
        const throughDay = await service.searchVotes({ query, to: "2026-05-07" })
        expect(throughDay.items.map((vote) => vote.id)).toEqual(expectedIds.slice(0, 6))
        const fromDay = await service.searchVotes({ query, from: "2026-05-07" })
        expect(fromDay.items.map((vote) => vote.id)).toEqual(expectedIds.slice(1, 8))
        const noon = await service.searchVotes({
          query,
          from: "2026-05-07T14:00:00+02:00",
          to: "2026-05-07T14:00:00+02:00"
        })
        expect(noon.items.map((vote) => vote.id)).toEqual([
          "search-vote:02-day",
          "search-vote:04-noon",
          "search-vote:05-noon"
        ])
        const afterNoon = await service.searchVotes({
          query,
          from: "2026-05-07T12:00:00.001Z",
          to: "2026-05-07T13:00:00Z"
        })
        expect(afterNoon.items.map((vote) => vote.id)).toEqual(["search-vote:02-day"])
        const person = await service.searchVotes({ query, personId: "person:vote-search" })
        expect(person.items.map((vote) => vote.id)).toEqual(["search-vote:02-day"])

        const ids: string[] = []
        let cursor: string | undefined
        for (let page = 0; page < 5; page += 1) {
          const result = await service.searchVotes({ query, limit: 2, cursor })
          ids.push(...result.items.map((vote) => vote.id))
          expect(result.truncated).toBe(page < 4)
          cursor = result.nextCursor
        }
        expect(cursor).toBeUndefined()
        expect(ids).toEqual(expectedIds)
        const empty = await service.searchVotes({ query, from: "2026-05-09" })
        expect(empty).toMatchObject({ items: [], truncated: false, nextCursor: undefined })
      } finally {
        await client.query("rollback")
        client.release()
      }
    }
  )

  it.each(["ISO, MDY", "SQL, DMY"])("preserves precision and pagination with DateStyle %s", async (dateStyle) => {
    if (!pool) {
      throw new Error("Missing isolated test database")
    }
    const client = await pool.connect()
    try {
      await client.query("begin")
      await client.query("select set_config('DateStyle', $1, true), set_config('TimeZone', $2, true)", [
        dateStyle,
        "America/Los_Angeles"
      ])
      await client.query(`
        insert into legislation.jurisdictions(id,name,classification,country_code)
          values ('jurisdiction:us','Timeline test','country','US');
        insert into legislation.legislative_sessions(id,jurisdiction_id,identifier,name)
          values ('session:us:119','jurisdiction:us','119','Timeline test session');
        insert into legislation.bills(id,jurisdiction_id,session_id,identifier,title,source_url)
          values ('bill:us:119:hr:1','jurisdiction:us','session:us:119','HR 1','Timeline fixture','https://example.test/timeline');
        insert into legislation.bill_actions (id, bill_id, ordinal, description, action_at, action_date) values
          ('timeline:02-action-date', 'bill:us:119:hr:1', 0, 'Date-only action', null, '2025-07-03'),
          ('timeline:04-action-timestamp', 'bill:us:119:hr:1', 1, 'Timestamp-only action', '2025-07-03 17:15:12.345-07', null),
          ('timeline:06-action-both', 'bill:us:119:hr:1', 2, 'Timestamp takes precedence', '2025-07-04 12:30:01.456+00', '2020-01-01'),
          ('timeline:07-action-null', 'bill:us:119:hr:1', 3, 'Undated action', null, null);
        insert into legislation.votes (id, bill_id, motion, held_at, held_date, result, source_url) values
          ('timeline:01-vote-date', 'bill:us:119:hr:1', 'Date-only vote', null, '2025-07-03', null, null),
          ('timeline:03-vote-both', 'bill:us:119:hr:1', 'Timestamp takes precedence', '2025-07-04 01:30:00.123+02', '2020-01-01', null, null),
          ('timeline:05-vote-timestamp', 'bill:us:119:hr:1', 'Timestamp-only vote', '2025-07-04 12:30:01.456+00', null, 'passed', 'https://example.test/timeline/vote'),
          ('timeline:08-vote-null', 'bill:us:119:hr:1', 'Undated vote', null, null, null, null);
      `)
      const service = new LegislationQueryService(drizzle(client, { schema }))
      const billId = "bill:us:119:hr:1"
      const timeline = await service.getBillTimeline({ id: billId, limit: 100 })
      expect(timeline).toMatchObject({ billId, nextCursor: undefined, truncated: false, warnings: [] })
      expect(timeline.events.map(({ id, date, type }) => ({ id, date, type }))).toEqual([
        { id: "timeline:01-vote-date", date: "2025-07-03", type: "vote" },
        { id: "timeline:02-action-date", date: "2025-07-03", type: "action" },
        { id: "timeline:03-vote-both", date: "2025-07-03T23:30:00.123Z", type: "vote" },
        { id: "timeline:04-action-timestamp", date: "2025-07-04T00:15:12.345Z", type: "action" },
        { id: "timeline:05-vote-timestamp", date: "2025-07-04T12:30:01.456Z", type: "vote" },
        { id: "timeline:06-action-both", date: "2025-07-04T12:30:01.456Z", type: "action" },
        { id: "timeline:07-action-null", date: null, type: "action" },
        { id: "timeline:08-vote-null", date: null, type: "vote" }
      ])
      expect(timeline.events[4]).toMatchObject({
        description: "Timestamp-only vote",
        result: "passed",
        sourceUrl: "https://example.test/timeline/vote"
      })
      const first = await service.getBillTimeline({ id: billId, limit: 3 })
      expect(first).toMatchObject({ nextCursor: expect.any(String), truncated: true })
      const second = await service.getBillTimeline({ id: billId, limit: 3, cursor: first.nextCursor })
      expect(second).toMatchObject({ nextCursor: expect.any(String), truncated: true })
      const third = await service.getBillTimeline({ id: billId, limit: 3, cursor: second.nextCursor })
      expect(third).toMatchObject({ nextCursor: undefined, truncated: false })
      expect([first.events.length, second.events.length, third.events.length]).toEqual([3, 3, 2])
      expect([...first.events, ...second.events, ...third.events]).toEqual(timeline.events)
      await expect(service.getBillTimeline({ id: "bill:timeline:missing" })).resolves.toEqual({
        billId: "bill:timeline:missing",
        events: [],
        nextCursor: undefined,
        truncated: false,
        warnings: []
      })
      await expect(
        service.getBillTimeline({
          id: billId,
          cursor: Buffer.from(JSON.stringify({ offset: timeline.events.length })).toString("base64url")
        })
      ).resolves.toMatchObject({ events: [], nextCursor: undefined, truncated: false })
    } finally {
      await client.query("rollback")
      client.release()
    }
  })

  it("grounds scoped analytics and paginated receipts in canonical PostgreSQL fixtures", async () => {
    if (!pool) {
      throw new Error("Missing isolated test database")
    }
    const client = await pool.connect()
    try {
      await client.query("begin")
      await client.query("set local statement_timeout = '5000'")
      await client.query(`
        insert into legislation.jurisdictions (id, name, classification, country_code) values
          ('jurisdiction:us', 'Analytics US fixture', 'country', 'US'),
          ('jurisdiction:ca', 'Analytics CA fixture', 'country', 'CA');
        insert into legislation.legislative_sessions (id, jurisdiction_id, identifier, name) values
          ('session:us:119', 'jurisdiction:us', '119', 'Analytics current session'),
          ('session:us:118', 'jurisdiction:us', '118', 'Analytics previous session'),
          ('session:ca:119', 'jurisdiction:ca', '119', 'Analytics other jurisdiction');
        insert into legislation.bills (id, jurisdiction_id, session_id, identifier, title, source_url) values
          ('bill:us:119:hr:1', 'jurisdiction:us', 'session:us:119', 'HR 1', 'Two recorded actions', 'https://example.test/analytics/1'),
          ('bill:us:119:hr:2', 'jurisdiction:us', 'session:us:119', 'HR 2', 'One recorded action', 'https://example.test/analytics/2'),
          ('bill:us:119:hr:3', 'jurisdiction:us', 'session:us:119', 'HR 3', 'No recorded actions', 'https://example.test/analytics/3'),
          ('bill:us:118:hr:1', 'jurisdiction:us', 'session:us:118', 'HR 1', 'Other session', 'https://example.test/analytics/old'),
          ('bill:ca:119:c:1', 'jurisdiction:ca', 'session:ca:119', 'C 1', 'Other jurisdiction', 'https://example.test/analytics/other');
        insert into legislation.bill_actions (id, bill_id, ordinal, description) values
          ('analytics-action:1', 'bill:us:119:hr:1', 0, 'First action'),
          ('analytics-action:2', 'bill:us:119:hr:1', 1, 'Second action'),
          ('analytics-action:3', 'bill:us:119:hr:2', 0, 'Third action'),
          ('analytics-action:4', 'bill:us:118:hr:1', 0, 'Previous-session action'),
          ('analytics-action:5', 'bill:us:118:hr:1', 1, 'Another previous-session action'),
          ('analytics-action:6', 'bill:ca:119:c:1', 0, 'Other-jurisdiction action');
      `)
      const service = new LegislationQueryService(drizzle(client, { schema }))
      const catalog = await service.describeAnalytics()
      expect(catalog.datasets).toContain("bills")
      expect(catalog.details.find((dataset) => dataset.name === "bills")).toMatchObject({
        fields: { id: "string", jurisdictionId: "string", sessionId: "string" },
        relations: { actions: { dataset: "actions", many: true } }
      })

      const input = analyticsQuerySchema.parse({
        dataset: "bills",
        filters: [
          { field: "jurisdictionId", op: "eq", values: ["jurisdiction:us"] },
          { field: "sessionId", op: "eq", values: ["session:us:119"] }
        ],
        metrics: [
          { name: "bills", operation: "countDistinct", field: "id" },
          { name: "actions", operation: "countDistinct", field: "actions.id" }
        ]
      })
      const total = await service.analyzeLegislation(input)
      expect(total.rows).toEqual([{ bills: 3, actions: 3 }])
      expect(total.query).toEqual(input)
      expect(total.receipt).toMatchObject({
        population: "locally_recorded",
        upstreamCompleteness: "unknown",
        returned: 1,
        nextOffset: null
      })
      expect(total.receipt.queryHash).toMatch(/^[a-f0-9]{64}$/)
      expect(total.receipt.queryId).toBe(`aq_${total.receipt.queryHash.slice(0, 16)}`)
      expect(total.warnings).toContain(
        "Results cover the data collected so far. Missing records or links may affect counts and rankings."
      )
      const allSessions = await service.analyzeLegislation({ ...input, filters: input.filters.slice(0, 1) })
      expect(allSessions.rows).toEqual([{ bills: 4, actions: 5 }])
      const allJurisdictions = await service.analyzeLegislation({ ...input, filters: [] })
      expect(allJurisdictions.rows).toEqual([{ bills: 5, actions: 6 }])

      const pageInput = analyticsQuerySchema.parse({
        ...input,
        select: ["id", "title"],
        orderBy: [{ field: "id", direction: "asc" }],
        limit: 2
      })
      const first = await service.analyzeLegislation(pageInput)
      expect(first.rows).toEqual([
        { id: "bill:us:119:hr:1", title: "Two recorded actions", bills: 1, actions: 2 },
        { id: "bill:us:119:hr:2", title: "One recorded action", bills: 1, actions: 1 }
      ])
      expect(first.receipt).toMatchObject({ returned: 2, nextOffset: 2 })
      const nextOffset = first.receipt.nextOffset
      if (nextOffset === null) {
        throw new Error("Missing analytics continuation")
      }
      const last = await service.analyzeLegislation({ ...pageInput, offset: nextOffset })
      expect(last.rows).toEqual([{ id: "bill:us:119:hr:3", title: "No recorded actions", bills: 1, actions: 0 }])
      expect(last.receipt).toMatchObject({ returned: 1, nextOffset: null })
      expect(last.query).toEqual({ ...pageInput, offset: 2 })
      const empty = await service.analyzeLegislation({
        ...input,
        filters: [{ field: "sessionId", op: "eq", values: ["session:us:117"] }]
      })
      expect(empty.rows).toEqual([{ bills: 0, actions: 0 }])
      expect(empty.receipt).toMatchObject({ population: "locally_recorded", upstreamCompleteness: "unknown" })
    } finally {
      await client.query("rollback")
      client.release()
    }
  })

  it("scopes lexical supporting-material evidence and explicitly rejects hybrid search without retrieval", async () => {
    if (!pool) {
      throw new Error("Missing isolated test database")
    }
    const client = await pool.connect()
    const fixtureComplete = new Error("Roll back supporting-material fixtures")
    try {
      await expect(
        drizzle(client, { schema }).transaction(async (transaction) => {
          await transaction.execute(sql`set local statement_timeout = '5000'`)
          await transaction.execute(sql`
            insert into legislation.jurisdictions (id, name, classification, country_code) values
              ('jurisdiction:us', 'Material US fixture', 'country', 'US'),
              ('jurisdiction:ca', 'Material CA fixture', 'country', 'CA');
            insert into legislation.legislative_sessions (id, jurisdiction_id, identifier, name) values
              ('session:us:119', 'jurisdiction:us', '119', 'Material current session'),
              ('session:us:118', 'jurisdiction:us', '118', 'Material previous session'),
              ('session:ca:119', 'jurisdiction:ca', '119', 'Material other jurisdiction');
            insert into legislation.bills (id, jurisdiction_id, session_id, identifier, title, source_url) values
              ('bill:us:119:hr:1', 'jurisdiction:us', 'session:us:119', 'HR 1', 'Material first bill', 'https://example.test/material/bill-1'),
              ('bill:us:119:hr:2', 'jurisdiction:us', 'session:us:119', 'HR 2', 'Material second bill', 'https://example.test/material/bill-2'),
              ('bill:us:118:hr:1', 'jurisdiction:us', 'session:us:118', 'HR 1', 'Material old bill', 'https://example.test/material/old-bill');
          `)
          const historicalInput = {
            limit: 20,
            sessionIds: ["session:us:119"],
            documentFrom: "2025-01-01",
            documentTo: "2026-09-18",
            jurisdictionId: "jurisdiction:us",
            mode: "hybrid" as const,
            query: "AI education claims procurement evidence schools tutoring assessment hearings testimony"
          }
          await transaction.execute(sql`
            with fixtures(id, jurisdiction_id, document_date) as (values
              ('material:us:001', 'jurisdiction:us', '2025-01-01'),
              ('material:us:002', 'jurisdiction:us', '2026-09-18'),
              ('material:us:before', 'jurisdiction:us', '2024-12-31'),
              ('material:us:after', 'jurisdiction:us', '2026-09-19'),
              ('material:us:undated', 'jurisdiction:us', null),
              ('material:ca:other', 'jurisdiction:ca', '2026-01-01'),
              ('material:us:old-session', 'jurisdiction:us', '2026-01-01'),
              ('material:us:unlinked', 'jurisdiction:us', '2026-01-01')
            )
            insert into legislation.supporting_materials
              (id, jurisdiction_id, session_id, source_id, classification, title, document_date, source_url, processing_status)
            select id, jurisdiction_id,
              case when jurisdiction_id = 'jurisdiction:us' then 'session:us:119' else 'session:ca:119' end,
              id, 'testimony', ${historicalInput.query}, document_date::date,
              'https://example.test/material/' || id, 'processed'
            from fixtures
          `)
          await transaction.execute(sql`
            insert into legislation.supporting_material_links (material_id, bill_id) values
              ('material:us:001', 'bill:us:119:hr:1'),
              ('material:us:001', 'bill:us:119:hr:2'),
              ('material:us:002', 'bill:us:119:hr:1'),
              ('material:us:before', 'bill:us:119:hr:1'),
              ('material:us:after', 'bill:us:119:hr:1'),
              ('material:us:undated', 'bill:us:119:hr:1'),
              ('material:ca:other', 'bill:us:119:hr:1'),
              ('material:us:old-session', 'bill:us:118:hr:1')
          `)
          const sectionText = `${historicalInput.query}. This qualification belongs to the retained fixture passage.`
          await transaction.execute(sql`
            insert into legislation.supporting_material_sections
              (id, material_id, ordinal, section_identifier, heading, source_start_offset, source_end_offset, text, content_hash)
            select 'section:' || id, id, 0, '1', 'Testimony', 0, length(${sectionText}), ${sectionText}, repeat('a', 64)
            from legislation.supporting_materials
          `)

          const service = new LegislationQueryService(transaction)
          const lexicalInput = { ...historicalInput, mode: "lexical" as const }
          const allMatches = await service.searchSupportingMaterials({
            query: historicalInput.query,
            mode: "lexical",
            limit: 20
          })
          expect(allMatches.items).toHaveLength(8)
          const scoped = await service.searchSupportingMaterials(lexicalInput)
          expect(scoped.items.map((material) => material.id)).toEqual(["material:us:001", "material:us:002"])
          expect(scoped).toMatchObject({ truncated: false, nextCursor: undefined })
          expect(scoped.items[0]).toMatchObject({
            jurisdictionId: "jurisdiction:us",
            documentDate: "2025-01-01",
            billIds: ["bill:us:119:hr:1", "bill:us:119:hr:2"],
            sourceUrl: "https://example.test/material/material:us:001",
            lexicalEvidence: {
              matchedFields: ["title", "sectionText"],
              section: { id: "section:material:us:001", materialId: "material:us:001", text: sectionText },
              snippet: expect.any(String)
            }
          })
          expect(scoped.items[1]?.documentDate).toBe("2026-09-18")

          const pageInput = { ...lexicalInput, limit: 1 }
          const first = await service.searchSupportingMaterials(pageInput)
          expect(first.items.map((material) => material.id)).toEqual(["material:us:001"])
          expect(first).toMatchObject({ truncated: true, nextCursor: expect.any(String) })
          const cursor = first.nextCursor
          if (cursor === undefined) {
            throw new Error("Missing supporting-material continuation")
          }
          const last = await service.searchSupportingMaterials({ ...pageInput, cursor })
          expect(last.items.map((material) => material.id)).toEqual(["material:us:002"])
          expect(last).toMatchObject({ truncated: false, nextCursor: undefined })
          expect([...first.items, ...last.items]).toEqual(scoped.items)

          await expect(service.searchSupportingMaterials(historicalInput)).rejects.toMatchObject({
            category: "dependency_unavailable",
            message: "Semantic search is not configured"
          })
          throw fixtureComplete
        })
      ).rejects.toBe(fixtureComplete)
    } finally {
      client.release()
    }
  })
})
