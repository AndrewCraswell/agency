import { createHash } from "node:crypto"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import type { upsertBillAggregates } from "../../persistence/bill-aggregates.js"
import { archiveScraperAttempt } from "./scraper-archive.js"
import { archiveNcBillPlan } from "./scraper-batches.js"
import { archiveScraperBillDispatch, readScraperBillDispatch } from "./scraper-dispatch.js"
import {
  normalizeArchivedScraperBills,
  normalizeNcScraperBills,
  normalizeNcScraperEvents,
  prepareArchivedScraperBillBatch
} from "./scraper-normalize.js"
import { promoteArchivedScraperBillBatch, scraperBillBatchOwnership } from "./scraper-promotion.js"

function fixture() {
  return {
    retrievedAt: new Date("2026-09-14T00:00:00Z"),
    requestedIds: ["S1"],
    bills: [
      {
        _id: "random-bill",
        identifier: "SB 1",
        legislative_session: "2025",
        title: "Example",
        sources: [{ url: "https://www.ncleg.gov/BillLookUp/2025/S1" }],
        actions: [{ description: "Filed", date: "2025-01-01", classification: ["introduction"] }],
        sponsorships: [{ name: "Example", primary: true, classification: "primary", person_id: '~{"name":"Example"}' }],
        versions: []
      }
    ],
    votes: [
      {
        _id: "random-vote",
        bill: "random-bill",
        sources: [{ url: "https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/S/1" }],
        votes: [{ voter_name: "Example", voter_id: '~{"name":"Example"}', option: "yes" }],
        counts: [{ option: "yes", value: 1 }],
        result: "pass",
        motion_text: "Passage",
        motion_classification: ["passage"]
      }
    ]
  }
}
describe("NC raw scraper mapping", () => {
  it("records the voting chamber from the official transcript rather than the bill chamber", () => {
    const input = fixture()
    input.votes[0]!.sources = [{ url: "https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/H/1" }]
    const rows = normalizeNcScraperBills(input)
    expect(rows[0]?.aggregate.bill.chamber).toBe("upper")
    expect(rows[0]?.aggregate.votes?.[0]?.vote.chamber).toBe("lower")
  })

  it("accepts corrected clocks only from checksum-verified approved build archives", async () => {
    const input = fixture()
    const objects = new Map<string, Uint8Array>()
    const store = {
      async exists(path: string) {
        return objects.has(path)
      },
      async put(path: string, bytes: Uint8Array) {
        if (objects.has(path)) {
          return false
        }
        objects.set(path, bytes)
        return true
      },
      async read(path: string) {
        const bytes = objects.get(path)
        if (!bytes) {
          throw new Error("Missing fixture")
        }
        return bytes
      }
    }
    const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
    const revision = "d43f853796ceeeb49205f7d144790647764ce105"
    const fingerprint = hash("verified corrected build")
    const rawVote = { ...input.votes[0], start_date: "2026-08-04T18:07:00-04:00" }
    const files = [
      { path: "_data/nc/bill_fixture.json", value: input.bills[0] },
      { path: "_data/nc/vote_event_fixture.json", value: rawVote }
    ].map(({ path, value }) => {
      const bytes = Buffer.from(JSON.stringify(value))
      objects.set(path, bytes)
      return { path, bytes: bytes.length, sha256: hash(bytes) }
    })
    const attempt = {
      work_directory: "/fixture",
      status: "extracted",
      exit_code: 0,
      revision,
      build_inputs_sha256: fingerprint,
      canonical_writes: false,
      semantically_validated: false,
      reason: null,
      files,
      request: {
        jurisdiction: "nc",
        domain: "bills",
        session: "2025",
        bill_ids: ["S1"],
        timeout_seconds: 1200,
        revision
      }
    }
    objects.set("attempt.json", Buffer.from(JSON.stringify(attempt)))
    const { manifestPath } = await archiveScraperAttempt(store, store, "verified-clock")
    const { work_directory: _workDirectory, ...retainedAttempt } = attempt
    const request = { store, manifestPath, approvedBuildInputsSha256: fingerprint, retrievedAt: input.retrievedAt }
    const feed = (ids: string[]) =>
      `<rss><channel>${ids.map((id) => `<item><bill>${id}</bill></item>`).join("")}</channel></rss>`
    const frozen = await archiveNcBillPlan(store, { H: feed(["H1"]), S: feed(["S1"]) }, "test-cycle")
    const dispatchInput = {
      planPath: frozen.path,
      batchId: frozen.plan.batches[1]!.id,
      runId: "verified-clock",
      issuedAt: input.retrievedAt,
      expiresAt: new Date(input.retrievedAt.getTime() + 30 * 60 * 1000)
    }
    const dispatched = await archiveScraperBillDispatch(store, dispatchInput)
    expect(await archiveScraperBillDispatch(store, dispatchInput)).toEqual(dispatched)
    await expect(
      archiveScraperBillDispatch(store, { ...dispatchInput, batchId: frozen.plan.batches[0]!.id })
    ).rejects.toThrow("conflict")
    await expect(archiveScraperBillDispatch(store, { ...dispatchInput, expiresAt: input.retrievedAt })).rejects.toThrow(
      "window"
    )
    await expect(
      archiveScraperBillDispatch(store, {
        ...dispatchInput,
        expiresAt: new Date(input.retrievedAt.getTime() + 31 * 60 * 1000)
      })
    ).rejects.toThrow("window")
    for (const now of [new Date(input.retrievedAt.getTime() - 1), dispatchInput.expiresAt]) {
      await expect(readScraperBillDispatch(store, dispatched.path, now)).rejects.toThrow("outside")
    }
    const preparation = {
      ...request,
      planPath: frozen.path,
      batchId: frozen.plan.batches[1]!.id,
      dispatchPath: dispatched.path,
      now: input.retrievedAt
    }
    const prepared = await prepareArchivedScraperBillBatch(preparation)
    expect(prepared.status).toBe("prepared")
    expect(prepared.canonicalWrites).toBe(false)
    expect(prepared.rows).toHaveLength(1)
    const database = drizzle({ connection: "postgresql://unused", schema })
    const persist = vi.fn<typeof upsertBillAggregates>().mockResolvedValue(new Set())
    const promoted = await promoteArchivedScraperBillBatch(database, preparation, persist, async (_database, rows) => [
      ...rows
    ])
    expect(promoted.sessionComplete).toBe(false)
    expect(persist).toHaveBeenCalledWith(
      database,
      prepared.rows.map((row) => row.aggregate),
      {
        ownership: scraperBillBatchOwnership(
          prepared.provenance.inventoryId,
          prepared.provenance.batchId,
          prepared.provenance.runId
        ),
        receipt: promoted.receipt,
        preserveResolvedLinks: true
      }
    )
    expect(promoted.receipt.cursor).toMatchObject({
      status: "promoted",
      bills: 1,
      unresolvedSponsors: 1,
      unresolvedPositions: 1
    })
    persist.mockRejectedValueOnce(new Error("expired owner"))
    await expect(
      promoteArchivedScraperBillBatch(database, preparation, persist, async (_database, rows) => [...rows])
    ).rejects.toThrow("expired owner")
    persist.mockClear()
    await expect(
      promoteArchivedScraperBillBatch(
        database,
        { ...preparation, now: dispatchInput.expiresAt },
        persist,
        async (_database, rows) => [...rows]
      )
    ).rejects.toThrow("outside")
    expect(persist).not.toHaveBeenCalled()
    expect(prepared.provenance).toMatchObject({
      inventoryId: frozen.plan.inventoryId,
      batchId: preparation.batchId,
      manifestSha256: hash(await store.read(manifestPath)),
      buildInputsSha256: fingerprint
    })
    await expect(
      prepareArchivedScraperBillBatch({ ...preparation, batchId: frozen.plan.batches[0]!.id })
    ).rejects.toThrow("dispatch does not match")
    const otherAttempt = await archiveScraperBillDispatch(store, { ...dispatchInput, runId: "other-attempt" })
    await expect(prepareArchivedScraperBillBatch({ ...preparation, dispatchPath: otherAttempt.path })).rejects.toThrow(
      "does not match dispatched attempt"
    )
    await expect(prepareArchivedScraperBillBatch({ ...preparation, now: dispatchInput.expiresAt })).rejects.toThrow(
      "outside"
    )
    await expect(
      prepareArchivedScraperBillBatch({ ...preparation, approvedBuildInputsSha256: hash("unapproved") })
    ).rejects.toThrow("not approved")
    await expect(prepareArchivedScraperBillBatch({ ...preparation, retrievedAt: new Date("invalid") })).rejects.toThrow(
      "Invalid input"
    )
    expect((await normalizeArchivedScraperBills(request))[0]?.aggregate.votes?.[0]?.vote.heldAt?.toISOString()).toBe(
      "2026-08-04T22:07:00.000Z"
    )
    expect(
      normalizeNcScraperBills({ ...input, votes: [rawVote] })[0]?.aggregate.votes?.[0]?.vote.heldAt
    ).toBeUndefined()
    await expect(
      normalizeArchivedScraperBills({ ...request, approvedBuildInputsSha256: hash("other") })
    ).rejects.toThrow("not approved")
    for (const changes of [
      { build_inputs_sha256: undefined },
      { status: "failed", exit_code: 1, reason: "subprocess_failure" }
    ]) {
      objects.set(
        manifestPath,
        Buffer.from(JSON.stringify({ runId: "verified-clock", attempt: { ...retainedAttempt, ...changes } }))
      )
      await expect(normalizeArchivedScraperBills(request)).rejects.toThrow(
        /not approved|extraction failed: subprocess_failure/
      )
    }
    objects.set(manifestPath, Buffer.from(JSON.stringify({ runId: "verified-clock", attempt: retainedAttempt })))
    objects.set(manifestPath.replace("retained.json", "files/_data/nc/vote_event_fixture.json"), Buffer.from("{}"))
    await expect(normalizeArchivedScraperBills(request)).rejects.toThrow("checksum")
  })
  it("uses official meeting notices across UUID and time corrections, rejecting missing identity", () => {
    const event = {
      _id: "random",
      upstream_id: "10724",
      name: "Meeting",
      start_date: "2026-09-15T10:00:00-04:00",
      status: "confirmed",
      participants: [],
      agenda: [],
      sources: [{ url: "https://www.ncleg.gov/Committees/NoticeDocument/10724/Meeting" }]
    }
    const date = new Date("2026-09-14T00:00:00Z")
    const first = normalizeNcScraperEvents([event], date)[0]
    const corrected = normalizeNcScraperEvents(
      [{ ...event, _id: "new", start_date: "2026-09-16T11:00:00-04:00" }],
      date
    )[0]
    expect(corrected?.event.id).toBe(first?.event.id)
    expect(corrected?.event.upstreamIds).toEqual({ ncNoticeDocument: "10724" })
    expect(corrected?.event.sessionRelationsComplete).toBe(false)
    expect(corrected?.sessionIds).toEqual([])
    expect(normalizeNcScraperEvents([{ ...event, status: "passed" }], date)[0]?.event.status).toBe("other")
    expect(normalizeNcScraperEvents([{ ...event, status: "cancelled" }], date)[0]?.event.status).toBe("cancelled")
    expect(() => normalizeNcScraperEvents([{ ...event, upstream_id: "10725" }], date)).toThrow(/notice identity/)
    expect(() => normalizeNcScraperEvents([event, event], date)).toThrow(/notice identity/)
  })
  it("links NC meetings only through exact publisher committee URLs", () => {
    const event = {
      _id: "random",
      upstream_id: "10724",
      name: "Meeting",
      start_date: "2026-09-15T10:00:00-04:00",
      status: "confirmed",
      participants: [],
      agenda: [],
      sources: [
        { url: "https://www.ncleg.gov/Committees/CommitteeInfo/HouseStanding/42" },
        { url: "https://www.ncleg.gov/Committees/NoticeDocument/10724/Meeting" }
      ]
    }
    const snapshot = normalizeNcScraperEvents([event], new Date("2026-09-14T00:00:00Z"))[0]
    expect(snapshot?.organizationReferences).toEqual([["ncCommittee:HouseStanding:42"]])
    expect(snapshot?.event.organizationRelationsComplete).toBe(true)
  })
  it("ignores per-run UUIDs and keeps name-only votes unresolved", () => {
    const input = fixture()
    const first = normalizeNcScraperBills(input)
    input.bills[0]!._id = "new-bill"
    input.votes[0]!.bill = "new-bill"
    input.votes[0]!._id = "new-vote"
    expect(normalizeNcScraperBills(input)).toEqual(first)
    expect(first[0]?.aggregate.people).toEqual([])
    expect(first[0]?.aggregate.bill.upstreamIds).toEqual({})
    expect(first[0]?.aggregate.organizations).toBeUndefined()
    expect(first[0]?.aggregate.relations).toBeUndefined()
    expect(first[0]?.unresolvedPositions).toBe(1)
    expect(first[0]?.aggregate.votes?.[0]?.positions?.[0]?.personId).toBeUndefined()
  })
  it("does not change existing action IDs when a new action is prepended", () => {
    const input = fixture()
    const before = normalizeNcScraperBills(input)[0]?.aggregate.actions?.[0]?.id
    input.bills[0]!.actions.unshift({ description: "Passed", date: "2025-02-01", classification: ["passage"] })
    expect(normalizeNcScraperBills(input)[0]?.aggregate.actions?.[1]?.id).toBe(before)
  })
  it("keeps sponsor IDs stable and coalesces only identical repeated observations", () => {
    const input = fixture()
    const before = normalizeNcScraperBills(input)[0]?.aggregate.sponsors?.[0]?.id
    input.bills[0]!.sponsorships[0]!.person_id = "ocd-person/11111111-1111-1111-1111-111111111111"
    expect(normalizeNcScraperBills(input)[0]?.aggregate.sponsors?.[0]?.id).toBe(before)
    const normalized = normalizeNcScraperBills(input)
    input.bills[0]!.sponsorships.push(structuredClone(input.bills[0]!.sponsorships[0]!))
    expect(normalizeNcScraperBills(input)).toEqual(normalized)
    input.bills[0]!.sponsorships[1]!.primary = false
    expect(() => normalizeNcScraperBills(input)).toThrow("duplicate sponsor")
  })
  it("rejects same-name observations with conflicting resolved identities", () => {
    const input = fixture()
    input.bills[0]!.sponsorships.push({
      ...input.bills[0]!.sponsorships[0]!,
      person_id: "ocd-person/11111111-1111-1111-1111-111111111111"
    })
    expect(() => normalizeNcScraperBills(input)).toThrow("duplicate sponsor")
  })
  it("rejects incomplete scope, orphan votes, duplicate roll calls and foreign source URLs", () => {
    for (const mutate of [
      (input: ReturnType<typeof fixture>) => {
        input.requestedIds.push("S2")
      },
      (input: ReturnType<typeof fixture>) => {
        input.votes[0]!.bill = "other"
      },
      (input: ReturnType<typeof fixture>) => {
        input.votes.push(input.votes[0]!)
      },
      (input: ReturnType<typeof fixture>) => {
        input.bills[0]!.sources[0]!.url = "https://example.com/bill"
      }
    ]) {
      const input = fixture()
      mutate(input)
      expect(() => normalizeNcScraperBills(input)).toThrow(/scope|orphaned|duplicate|mismatch/)
    }
  })
})
