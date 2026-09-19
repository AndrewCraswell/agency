import { fileURLToPath } from "node:url"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { and, eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { upsertBillAggregates } from "./bill-aggregates.js"
import { assertBillBatchOwnership, claimBillBatchOwnership, releaseBillBatchOwnership } from "./bill-batch-ownership.js"
import { commitOwnedEmptyPromotion } from "./promotion-receipt.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
if (databaseUrl && new URL(databaseUrl).pathname !== "/legislation_test") {
  throw new Error("Only the isolated legislation_test database is allowed")
}
const describePostgres = databaseUrl ? describe : describe.skip
describePostgres.sequential("atomic bill batch receipts", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 })
  const database = drizzle(pool, { schema })
  const jurisdictionId = "jurisdiction:receipt-test"
  const source = "bill-receipt-integration-test"
  const aggregate = (suffix: string) => ({
    jurisdiction: { id: jurisdictionId, name: "Receipt test", classification: "state", countryCode: "US" },
    session: { id: "session:receipt-test", jurisdictionId, identifier: "2025", name: "Receipt test" },
    bill: {
      id: `bill:receipt-test:2025:hb:${suffix}`,
      jurisdictionId,
      sessionId: "session:receipt-test",
      identifier: suffix,
      sourceUrl: `https://example.test/receipts/${suffix}`,
      title: "Original"
    }
  })
  beforeAll(async () => {
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await database.delete(schema.syncCheckpoints).where(eq(schema.syncCheckpoints.source, source))
    await database.delete(schema.bills).where(eq(schema.bills.jurisdictionId, jurisdictionId))
    await database.delete(schema.organizations).where(eq(schema.organizations.jurisdictionId, jurisdictionId))
    await database.delete(schema.people).where(eq(schema.people.jurisdictionId, jurisdictionId))
    await database
      .delete(schema.legislativeSessions)
      .where(eq(schema.legislativeSessions.jurisdictionId, jurisdictionId))
    await database.delete(schema.jurisdictions).where(eq(schema.jurisdictions.id, jurisdictionId))
  })
  afterAll(async () => {
    await database.delete(schema.syncCheckpoints).where(eq(schema.syncCheckpoints.source, source))
    await database.delete(schema.bills).where(eq(schema.bills.jurisdictionId, jurisdictionId))
    await database.delete(schema.organizations).where(eq(schema.organizations.jurisdictionId, jurisdictionId))
    await database.delete(schema.people).where(eq(schema.people.jurisdictionId, jurisdictionId))
    await database
      .delete(schema.legislativeSessions)
      .where(eq(schema.legislativeSessions.jurisdictionId, jurisdictionId))
    await database.delete(schema.jurisdictions).where(eq(schema.jurisdictions.id, jurisdictionId))
    await pool.end()
  })
  it("replaces changed archive vote identities without duplicates and rolls back failed replacement", async () => {
    const input = aggregate("archive-vote-identity")
    const snapshot = (identity: string, motion: string) => ({
      vote: { id: `${input.bill.id}:${identity}`, billId: input.bill.id, motion },
      positions: [{ voteId: `${input.bill.id}:${identity}`, sourceIdentity: "recorded-name", option: "yes" }]
    })
    const ordinal = snapshot("ordinal", "Passage")
    const stable = snapshot("stable", "Passage")
    await upsertBillAggregates(database, [{ ...input, votes: [ordinal] }])
    for (let replay = 0; replay < 2; replay++) {
      await upsertBillAggregates(database, [{ ...input, votes: [stable] }])
      const rows = await database.select().from(schema.votes).where(eq(schema.votes.billId, input.bill.id))
      expect(rows.map((row) => row.id)).toEqual([stable.vote.id])
      expect(
        await database.select().from(schema.votePositions).where(eq(schema.votePositions.voteId, ordinal.vote.id))
      ).toEqual([])
      expect(
        await database.select().from(schema.votePositions).where(eq(schema.votePositions.voteId, stable.vote.id))
      ).toHaveLength(1)
    }
    await expect(upsertBillAggregates(database, [{ ...input, votes: [ordinal, ordinal] }])).rejects.toThrow()
    expect(
      (await database.select().from(schema.votes).where(eq(schema.votes.billId, input.bill.id))).map((row) => row.id)
    ).toEqual([stable.vote.id])
    expect(
      await database.select().from(schema.votePositions).where(eq(schema.votePositions.voteId, stable.vote.id))
    ).toHaveLength(1)
  })

  it("commits empty-work receipts only under ownership and rejects conflicting replay", async () => {
    const owner = { source, stream: "ownership:empty-window", token: "empty-token" }
    const receipt = {
      source,
      stream: "empty-window",
      cursor: { status: "promoted", events: 0, manifestPath: "verified-empty.json" }
    }
    await expect(commitOwnedEmptyPromotion(database, owner, receipt)).rejects.toThrow()
    expect(
      await database
        .select()
        .from(schema.syncCheckpoints)
        .where(and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, receipt.stream)))
    ).toHaveLength(0)
    expect(await claimBillBatchOwnership(database, owner, 60)).toBe(true)
    await Promise.all([
      commitOwnedEmptyPromotion(database, owner, receipt),
      commitOwnedEmptyPromotion(database, owner, receipt)
    ])
    await releaseBillBatchOwnership(database, owner)
    await commitOwnedEmptyPromotion(database, owner, receipt)
    await expect(
      commitOwnedEmptyPromotion(database, owner, {
        ...receipt,
        cursor: { ...receipt.cursor, manifestPath: "other.json" }
      })
    ).rejects.toThrow(/conflicts/)
    expect(
      await database
        .select()
        .from(schema.syncCheckpoints)
        .where(and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, receipt.stream)))
    ).toHaveLength(1)
  })

  it("admits disjoint batches together while rejecting duplicate, conflicting-cycle and session claims", async () => {
    const group = { stream: "ownership:parallel-test", cohort: "a".repeat(64) }
    const first = { source, stream: `${group.stream}:${group.cohort}:first`, token: "worker-first" }
    const second = { source, stream: `${group.stream}:${group.cohort}:second`, token: "worker-second" }
    const options = { requireConfirmedRelease: true, group }
    expect(
      await Promise.all([
        claimBillBatchOwnership(database, first, 120, options),
        claimBillBatchOwnership(database, second, 120, options)
      ])
    ).toEqual([true, true])
    await expect(claimBillBatchOwnership(database, { ...first, token: "duplicate" }, 120, options)).rejects.toThrow(
      "active owner"
    )
    const otherGroup = { ...group, cohort: "b".repeat(64) }
    const other = { source, stream: `${otherGroup.stream}:${otherGroup.cohort}:first`, token: "new-cycle" }
    await expect(claimBillBatchOwnership(database, other, 120, { ...options, group: otherGroup })).rejects.toThrow(
      "blocks batch admission"
    )
    await expect(
      claimBillBatchOwnership(database, { source, stream: group.stream, token: "session" }, 120)
    ).rejects.toThrow("Batch holds block")
    await Promise.all([
      upsertBillAggregates(database, [aggregate("parallel-first")], {
        ownership: first,
        receipt: { source, stream: "parallel-first", cursor: { status: "promoted" } }
      }),
      upsertBillAggregates(database, [aggregate("parallel-second")], {
        ownership: second,
        receipt: { source, stream: "parallel-second", cursor: { status: "promoted" } }
      })
    ])
    await releaseBillBatchOwnership(database, first)
    await database
      .update(schema.syncCheckpoints)
      .set({
        cursor: sql`jsonb_set(${schema.syncCheckpoints.cursor}, '{expiresAt}', to_jsonb(clock_timestamp() - interval '1 hour'))`
      })
      .where(and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, second.stream)))
    await expect(claimBillBatchOwnership(database, other, 120, { ...options, group: otherGroup })).rejects.toThrow(
      "blocks batch admission"
    )
    await releaseBillBatchOwnership(database, second)
    expect(await claimBillBatchOwnership(database, other, 120, { ...options, group: otherGroup })).toBe(true)
    await releaseBillBatchOwnership(database, other)
  })
  it("commits a receipt with data and makes concurrent retries no-ops", async () => {
    const input = aggregate("replay")
    const receipt = { source, stream: "replay", cursor: { status: "promoted", archive: "immutable-1" } }
    await Promise.all([
      upsertBillAggregates(database, [input], { receipt }),
      upsertBillAggregates(database, [input], { receipt })
    ])
    await upsertBillAggregates(
      database,
      [{ ...input, bill: { ...input.bill, title: "Should not replace committed data" } }],
      { receipt }
    )
    expect(await database.query.bills.findFirst({ where: eq(schema.bills.id, input.bill.id) })).toMatchObject({
      title: "Original"
    })
    expect(
      await database
        .select()
        .from(schema.syncCheckpoints)
        .where(and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, receipt.stream)))
    ).toHaveLength(1)
    await expect(
      upsertBillAggregates(database, [input], { receipt: { ...receipt, cursor: { archive: "different" } } })
    ).rejects.toThrow("conflicts")
  })
  it("does not rewrite search columns for a status-only batch refresh", async () => {
    const input = aggregate("search-stable")
    await upsertBillAggregates(database, [input])
    await database
      .update(schema.bills)
      .set({ searchVector: sql`to_tsvector('simple', 'sentinel')` })
      .where(eq(schema.bills.id, input.bill.id))

    await upsertBillAggregates(database, [
      { ...input, bill: { ...input.bill, identifier: "SEARCH-STABLE", status: "Referred to committee" } }
    ])

    const [stored] = await database
      .select({ searchVector: sql<string>`${schema.bills.searchVector}::text`, status: schema.bills.status })
      .from(schema.bills)
      .where(eq(schema.bills.id, input.bill.id))
    expect(stored).toEqual({ searchVector: "'sentinel':1", status: "Referred to committee" })
  })
  it("releases only its own lease, rejects renewal, and allows the next batch immediately", async () => {
    const owner = { source, stream: "ownership:release", token: "first-attempt" }
    const next = { ...owner, token: "next-attempt" }
    expect(await releaseBillBatchOwnership(database, owner)).toBe(false)
    expect(await claimBillBatchOwnership(database, owner, 1800)).toBe(true)
    expect(await claimBillBatchOwnership(database, owner, 1800)).toBe(false)
    expect(await releaseBillBatchOwnership(database, next)).toBe(false)
    await database.transaction((transaction) => assertBillBatchOwnership(transaction, owner))
    expect(await releaseBillBatchOwnership(database, owner)).toBe(true)
    await expect(claimBillBatchOwnership(database, owner, 1800)).rejects.toThrow("cannot be renewed")
    await claimBillBatchOwnership(database, next, 1800)
    expect(await releaseBillBatchOwnership(database, owner)).toBe(false)
    await database.transaction((transaction) => assertBillBatchOwnership(transaction, next))
    await releaseBillBatchOwnership(database, next)
  })
  it("persists a shutdown hold before execution and blocks takeover after expiry until matching release", async () => {
    const owner = { source, stream: "ownership:shutdown-held", token: "unconfirmed-worker" }
    const next = { ...owner, token: "next-worker" }
    await claimBillBatchOwnership(database, owner, 120, { requireConfirmedRelease: true })
    await database
      .update(schema.syncCheckpoints)
      .set({ cursor: sql`jsonb_set(${schema.syncCheckpoints.cursor}, '{expiresAt}', '"2000-01-01T00:00:00Z"'::jsonb)` })
      .where(and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, owner.stream)))
    await expect(claimBillBatchOwnership(database, next, 120)).rejects.toThrow("shutdown confirmation")
    await expect(claimBillBatchOwnership(database, next, 120, { requireConfirmedRelease: false })).rejects.toThrow(
      "shutdown confirmation"
    )
    expect(await releaseBillBatchOwnership(database, next)).toBe(false)
    await expect(claimBillBatchOwnership(database, next, 120)).rejects.toThrow("shutdown confirmation")
    await expect(claimBillBatchOwnership(database, owner, 120)).rejects.toThrow("cannot be renewed")
    expect(await releaseBillBatchOwnership(database, owner)).toBe(true)
    await claimBillBatchOwnership(database, next, 120, { requireConfirmedRelease: true })
    expect(await releaseBillBatchOwnership(database, owner)).toBe(false)
    await database.transaction((transaction) => assertBillBatchOwnership(transaction, next))
    await releaseBillBatchOwnership(database, next)
  })
  it("rolls all bill data back when a later child write fails, then retries successfully", async () => {
    const input = aggregate("rollback")
    const receipt = { source, stream: "rollback", cursor: { status: "promoted" } }
    await expect(
      upsertBillAggregates(
        database,
        [
          {
            ...input,
            relations: [
              {
                billId: input.bill.id,
                relatedBillId: input.bill.id,
                classification: "related"
              }
            ]
          }
        ],
        { receipt }
      )
    ).rejects.toThrow(/Failed query/)
    expect(await database.query.bills.findFirst({ where: eq(schema.bills.id, input.bill.id) })).toBeUndefined()
    expect(
      await database.query.syncCheckpoints.findFirst({ where: eq(schema.syncCheckpoints.stream, "rollback") })
    ).toBeUndefined()
    await upsertBillAggregates(database, [input], { receipt })
    expect(await database.query.bills.findFirst({ where: eq(schema.bills.id, input.bill.id) })).toBeDefined()
  })
  it("cannot mark an empty batch complete", async () => {
    await expect(
      upsertBillAggregates(database, [], { receipt: { source, stream: "empty", cursor: {} } })
    ).rejects.toThrow("empty")
  })
  it("admits one concurrent owner, rejects stale writers and permits takeover only after expiry", async () => {
    const owner = { source, stream: "ownership:concurrent", token: "first" }
    const other = { ...owner, token: "second" }
    const outcomes = await Promise.allSettled([
      claimBillBatchOwnership(database, owner, 120),
      claimBillBatchOwnership(database, other, 120)
    ])
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    const winner = outcomes[0]?.status === "fulfilled" ? owner : other
    const loser = winner.token === owner.token ? other : owner
    const input = aggregate("owned")
    const receipt = { source, stream: "owned-promotion", cursor: { status: "promoted" } }
    await expect(upsertBillAggregates(database, [input], { ownership: loser, receipt })).rejects.toThrow("superseded")
    expect(await database.query.bills.findFirst({ where: eq(schema.bills.id, input.bill.id) })).toBeUndefined()
    const filter = and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, owner.stream))
    const before = await database.select().from(schema.syncCheckpoints).where(filter)
    await claimBillBatchOwnership(database, winner, 1800)
    expect(await database.select().from(schema.syncCheckpoints).where(filter)).toEqual(before)
    await database
      .update(schema.syncCheckpoints)
      .set({ cursor: { token: winner.token, expiresAt: "2000-01-01T00:00:00Z" } })
      .where(filter)
    await expect(claimBillBatchOwnership(database, winner, 120)).rejects.toThrow("cannot be renewed")
    await claimBillBatchOwnership(database, loser, 120)
    await expect(upsertBillAggregates(database, [input], { ownership: winner, receipt })).rejects.toThrow("superseded")
    await upsertBillAggregates(database, [input], { ownership: loser, receipt })
    expect(await database.query.bills.findFirst({ where: eq(schema.bills.id, input.bill.id) })).toBeDefined()
  })
  it("rolls back both data and receipt if ownership expires during the write", async () => {
    const owner = { source, stream: "ownership:late-expiry", token: "late" }
    await claimBillBatchOwnership(database, owner, 120)
    // A scoped trigger deterministically expires ownership during this bill insert, without sleeps.
    await database.execute(sql`create or replace function legislation.expire_receipt_test_owner() returns trigger language plpgsql as $$
      begin
        if NEW.id = 'bill:receipt-test:2025:hb:late-expiry' then
          update legislation.sync_checkpoints set cursor = jsonb_build_object('token', 'late', 'expiresAt', '2000-01-01T00:00:00Z')
          where source = 'bill-receipt-integration-test' and stream = 'ownership:late-expiry';
        end if;
        return NEW;
      end $$`)
    await database.execute(
      sql`create trigger receipt_test_expiry after insert on legislation.bills for each row execute function legislation.expire_receipt_test_owner()`
    )
    try {
      const input = aggregate("late-expiry")
      await expect(
        upsertBillAggregates(database, [input], {
          ownership: owner,
          receipt: { source, stream: "late-expiry", cursor: {} }
        })
      ).rejects.toThrow("expired")
      expect(await database.query.bills.findFirst({ where: eq(schema.bills.id, input.bill.id) })).toBeUndefined()
      expect(
        await database.query.syncCheckpoints.findFirst({
          where: and(eq(schema.syncCheckpoints.source, source), eq(schema.syncCheckpoints.stream, "late-expiry"))
        })
      ).toBeUndefined()
    } finally {
      await database.execute(sql`drop trigger receipt_test_expiry on legislation.bills`)
      await database.execute(sql`drop function legislation.expire_receipt_test_owner()`)
    }
  })
  it("preserves exact sponsor resolutions and observation bounds but never resolves a new same-name observation", async () => {
    const input = aggregate("sponsors")
    const personId = "person:receipt-test:sponsor"
    await upsertBillAggregates(database, [input])
    await database.insert(schema.people).values({
      id: personId,
      jurisdictionId,
      name: "Sponsor example",
      sourceId: "sponsor-example",
      sourceUrl: "https://example.test/sponsor"
    })
    const sponsor = {
      id: `${input.bill.id}:sponsor`,
      billId: input.bill.id,
      name: "Sponsor example",
      classification: "primary",
      sourceUrl: input.bill.sourceUrl
    }
    await upsertBillAggregates(database, [{ ...input, sponsors: [{ ...sponsor, personId }] }])
    const before = await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsor.id) })
    await upsertBillAggregates(database, [{ ...input, sponsors: [sponsor, { ...sponsor, id: `${sponsor.id}:new` }] }], {
      preserveResolvedLinks: true
    })
    expect(
      await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsor.id) })
    ).toMatchObject({ personId, firstObservedAt: before?.firstObservedAt })
    expect(
      (await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, `${sponsor.id}:new`) }))
        ?.personId
    ).toBeNull()
    await upsertBillAggregates(database, [{ ...input, sponsors: [{ ...sponsor, id: "different-source-id" }] }], {
      preserveResolvedLinks: true
    })
    expect(
      await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsor.id) })
    ).toMatchObject({
      personId
    })
    expect(
      (await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, "different-source-id") }))
        ?.personId
    ).toBeNull()
    await expect(
      upsertBillAggregates(database, [{ ...input, sponsors: [{ ...sponsor, name: "Changed identity" }] }], {
        preserveResolvedLinks: true
      })
    ).rejects.toThrow("source identity")
    expect(
      (await database.query.billSponsors.findFirst({ where: eq(schema.billSponsors.id, sponsor.id) }))?.personId
    ).toBe(personId)
    await upsertBillAggregates(database, [{ ...input, sponsors: [] }], { preserveResolvedLinks: true })
    expect(
      await database.select().from(schema.billSponsors).where(eq(schema.billSponsors.billId, input.bill.id))
    ).toHaveLength(0)
  })
  it("coalesces changed sponsor observation ids by resolved relationship", async () => {
    const input = aggregate("changed-sponsor-observation")
    const personId = "person:receipt-test:changed-sponsor-observation"
    await database.insert(schema.people).values({
      id: personId,
      jurisdictionId,
      name: "Stable sponsor",
      sourceId: "stable-sponsor",
      sourceUrl: "https://example.test/stable-sponsor"
    })
    const sponsor = {
      billId: input.bill.id,
      classification: "cosponsor",
      isPrimary: false,
      name: "Stable sponsor",
      personId,
      sourceUrl: input.bill.sourceUrl
    }
    await upsertBillAggregates(database, [{ ...input, sponsors: [{ ...sponsor, id: `${input.bill.id}:sponsor:old` }] }])
    const first = await database.query.billSponsors.findFirst({
      where: eq(schema.billSponsors.billId, input.bill.id)
    })
    if (first?.firstObservedAt === null || first?.latestObservedAt === null || first === undefined) {
      throw new Error("Expected the initial sponsor observation bounds")
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5))
    await upsertBillAggregates(database, [
      {
        ...input,
        sponsors: [
          { ...sponsor, id: `${input.bill.id}:sponsor:new` },
          { ...sponsor, id: `${input.bill.id}:sponsor:duplicate` }
        ]
      }
    ])
    const refreshed = await database
      .select()
      .from(schema.billSponsors)
      .where(eq(schema.billSponsors.billId, input.bill.id))
    expect(refreshed).toHaveLength(1)
    expect(refreshed[0]).toMatchObject({ id: first?.id, personId })
    expect(refreshed[0]?.firstObservedAt).toEqual(first.firstObservedAt)
    expect(refreshed[0]?.latestObservedAt?.getTime()).toBeGreaterThan(first.latestObservedAt.getTime())
  })
  it("retains exact resolved observations without name matching and rejects changed voter evidence atomically", async () => {
    const input = aggregate("resolved")
    const organizationId = "organization:receipt-test:resolved"
    const personId = "person:receipt-test:resolved"
    const voteId = `${input.bill.id}:vote`
    await upsertBillAggregates(database, [input])
    await database.insert(schema.organizations).values({
      id: organizationId,
      jurisdictionId,
      name: "Resolved committee",
      sourceId: "resolved-committee",
      sourceUrl: "https://example.test/committee"
    })
    await database.insert(schema.people).values({
      id: personId,
      jurisdictionId,
      name: "Example person",
      sourceId: "resolved-person",
      sourceUrl: "https://example.test/person"
    })
    const action = { id: `${input.bill.id}:action`, billId: input.bill.id, ordinal: 0, description: "Filed" }
    const vote = { id: voteId, billId: input.bill.id, motion: "Passage", sourceUrl: "https://example.test/rollcall" }
    const position = { voteId, sourceIdentity: "source-observation-1", sourceName: "Example person", option: "yes" }
    await upsertBillAggregates(database, [
      {
        ...input,
        actions: [{ ...action, organizationId }],
        votes: [
          {
            vote: { ...vote, organizationId },
            positions: [{ ...position, personId, sourcePersonId: "resolved-person" }]
          }
        ]
      }
    ])
    const refreshed = {
      ...input,
      actions: [action],
      votes: [
        {
          vote,
          positions: [
            { ...position, option: "no" },
            { ...position, sourceIdentity: "different-observation" }
          ]
        }
      ]
    }
    await upsertBillAggregates(database, [refreshed], { preserveResolvedLinks: true })
    expect(await database.query.billActions.findFirst({ where: eq(schema.billActions.id, action.id) })).toMatchObject({
      organizationId
    })
    expect(await database.query.votes.findFirst({ where: eq(schema.votes.id, voteId) })).toMatchObject({
      organizationId
    })
    const positions = await database.select().from(schema.votePositions).where(eq(schema.votePositions.voteId, voteId))
    expect(positions.find((entry) => entry.sourceIdentity === position.sourceIdentity)).toMatchObject({
      personId,
      sourcePersonId: "resolved-person",
      option: "no"
    })
    expect(positions.find((entry) => entry.sourceIdentity === "different-observation")?.personId).toBeNull()
    await expect(
      upsertBillAggregates(
        database,
        [{ ...input, votes: [{ vote, positions: [{ ...position, sourceName: "Different person" }] }] }],
        {
          preserveResolvedLinks: true,
          receipt: { source, stream: "identity-rejected", cursor: { status: "promoted" } }
        }
      )
    ).rejects.toThrow("changed source identity")
    expect(
      await database.query.syncCheckpoints.findFirst({ where: eq(schema.syncCheckpoints.stream, "identity-rejected") })
    ).toBeUndefined()
    await upsertBillAggregates(database, [{ ...input, votes: [{ vote }] }], { preserveResolvedLinks: true })
    expect(
      await database.select().from(schema.votePositions).where(eq(schema.votePositions.voteId, voteId))
    ).toHaveLength(2)
  })
  it("preserves omitted child collections per bill, while explicit empty collections clear them", async () => {
    const kept = aggregate("kept")
    const cleared = aggregate("cleared")
    const organizationId = "organization:receipt-test:committee"
    await upsertBillAggregates(database, [kept])
    await database
      .insert(schema.organizations)
      .values({
        id: organizationId,
        jurisdictionId,
        name: "Existing committee",
        classification: "committee",
        sourceId: "receipt-test-committee",
        sourceUrl: "https://example.test/committee"
      })
      .onConflictDoNothing()
    for (const input of [kept, cleared]) {
      await upsertBillAggregates(database, [
        {
          ...input,
          actions: [{ id: `${input.bill.id}:action`, billId: input.bill.id, ordinal: 0, description: "Filed" }],
          organizations: [{ billId: input.bill.id, organizationId, classification: "referral" }],
          votes: [
            {
              vote: { id: `${input.bill.id}:vote`, billId: input.bill.id, motion: "Passage" },
              positions: [
                {
                  voteId: `${input.bill.id}:vote`,
                  sourceIdentity: "unresolved-source-voter",
                  sourceName: "Example",
                  option: "yes"
                }
              ]
            }
          ],
          relations: [
            { billId: input.bill.id, relatedBillId: "bill:receipt-test:2025:hb:related", classification: "related" }
          ]
        }
      ])
    }
    await upsertBillAggregates(database, [
      kept,
      { ...cleared, actions: [], votes: [], relations: [], organizations: [] }
    ])
    expect(
      await database.select().from(schema.billOrganizations).where(eq(schema.billOrganizations.billId, kept.bill.id))
    ).toHaveLength(1)
    expect(
      await database.select().from(schema.billOrganizations).where(eq(schema.billOrganizations.billId, cleared.bill.id))
    ).toHaveLength(0)
    expect(
      await database.select().from(schema.billActions).where(eq(schema.billActions.billId, kept.bill.id))
    ).toHaveLength(1)
    expect(await database.select().from(schema.votes).where(eq(schema.votes.billId, kept.bill.id))).toHaveLength(1)
    expect(
      await database
        .select()
        .from(schema.votePositions)
        .where(eq(schema.votePositions.voteId, `${kept.bill.id}:vote`))
    ).toHaveLength(1)
    expect(
      await database.select().from(schema.billRelations).where(eq(schema.billRelations.billId, kept.bill.id))
    ).toHaveLength(1)
    expect(
      await database.select().from(schema.billActions).where(eq(schema.billActions.billId, cleared.bill.id))
    ).toHaveLength(0)
    expect(await database.select().from(schema.votes).where(eq(schema.votes.billId, cleared.bill.id))).toHaveLength(0)
    expect(
      await database
        .select()
        .from(schema.votePositions)
        .where(eq(schema.votePositions.voteId, `${cleared.bill.id}:vote`))
    ).toHaveLength(0)
    expect(
      await database.select().from(schema.billRelations).where(eq(schema.billRelations.billId, cleared.bill.id))
    ).toHaveLength(0)
  })
})
