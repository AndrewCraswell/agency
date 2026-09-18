import { migrateDatabase } from "@repo/legislation-core/database/migrate"
import * as schema from "@repo/legislation-core/database/schema/schema"
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
          values ('jurisdiction:timeline','Timeline test','country','US');
        insert into legislation.legislative_sessions(id,jurisdiction_id,identifier,name)
          values ('session:timeline','jurisdiction:timeline','2025','Timeline test session');
        insert into legislation.bills(id,jurisdiction_id,session_id,identifier,title,source_url)
          values ('bill:us:119:hr:timeline','jurisdiction:timeline','session:timeline','HR Timeline','Timeline fixture','https://example.test/timeline');
        insert into legislation.bill_actions (id, bill_id, ordinal, description, action_at, action_date) values
          ('timeline:02-action-date', 'bill:us:119:hr:timeline', 0, 'Date-only action', null, '2025-07-03'),
          ('timeline:04-action-timestamp', 'bill:us:119:hr:timeline', 1, 'Timestamp-only action', '2025-07-03 17:15:12.345-07', null),
          ('timeline:06-action-both', 'bill:us:119:hr:timeline', 2, 'Timestamp takes precedence', '2025-07-04 12:30:01.456+00', '2020-01-01'),
          ('timeline:07-action-null', 'bill:us:119:hr:timeline', 3, 'Undated action', null, null);
        insert into legislation.votes (id, bill_id, motion, held_at, held_date, result, source_url) values
          ('timeline:01-vote-date', 'bill:us:119:hr:timeline', 'Date-only vote', null, '2025-07-03', null, null),
          ('timeline:03-vote-both', 'bill:us:119:hr:timeline', 'Timestamp takes precedence', '2025-07-04 01:30:00.123+02', '2020-01-01', null, null),
          ('timeline:05-vote-timestamp', 'bill:us:119:hr:timeline', 'Timestamp-only vote', '2025-07-04 12:30:01.456+00', null, 'passed', 'https://example.test/timeline/vote'),
          ('timeline:08-vote-null', 'bill:us:119:hr:timeline', 'Undated vote', null, null, null, null);
      `)
      const service = new LegislationQueryService(drizzle(client, { schema }))
      const billId = "bill:us:119:hr:timeline"
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
})
