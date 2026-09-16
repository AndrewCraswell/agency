import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProviderHttpError } from "../http-client.js"
import type { CongressBillReference } from "./client.js"
import { CongressRequestBudgetExhaustedError } from "./request-budget.js"

const billMocks = vi.hoisted(() => ({
  getBillById: vi.fn<() => Promise<undefined>>(),
  upsertBillAggregate: vi.fn<() => Promise<void>>()
}))

vi.mock("@repo/legislation-core/database/bill-read", () => ({ getBillById: billMocks.getBillById }))
vi.mock("../../persistence/bill-aggregates.js", () => ({ upsertBillAggregate: billMocks.upsertBillAggregate }))

import {
  listUpdatedWithGapIsolation,
  parseCongressSyncGaps,
  synchronizeCongress,
  type CongressSyncGap
} from "./sync.js"

const NULL_DATE_ERROR = new ProviderHttpError(
  `Provider request failed with HTTP 500: {"error":"'NoneType' object has no attribute 'date'"}`,
  { retryable: true, status: 500 }
)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe("Congress bill scan continuation", () => {
  const from = new Date("2026-09-01T00:00:00.000Z")
  const to = new Date("2026-09-02T00:00:00.000Z")
  const reference = (number: string, updateDate = "2026-09-01"): CongressBillReference => ({
    congress: 119,
    number,
    type: "hr",
    updateDate,
    url: `https://api.congress.gov/v3/bill/119/hr/${number}`
  })
  const bundle = (record: CongressBillReference) => ({ bill: { ...record, title: "Test bill" } })

  it("resumes tied dates in changed order without downloading already committed bills", async () => {
    const harness = createDatabaseHarness()
    const first = reference("9")
    const second = reference("1")
    const exhausted = new CongressRequestBudgetExhaustedError(new Date(), "allocation_exhausted")
    let isResumed = false
    const ranges: Array<[string, string]> = []
    const getBillBundle = vi.fn<(record: CongressBillReference) => Promise<unknown>>(async (record) => {
      if (!isResumed && record.number === "1") {
        throw exhausted
      }
      return bundle(record)
    })
    const client = {
      getBillBundle,
      async *listUpdated(start: Date, end: Date) {
        ranges.push([start.toISOString(), end.toISOString()])
        yield* isResumed ? [second, first] : [first, second]
      }
    }
    await expect(synchronizeCongress(harness.database, client, { from, to })).rejects.toBe(exhausted)
    expect(harness.cursors.at(-1)).toMatchObject({
      pendingScan: {
        from: from.toISOString(),
        to: to.toISOString(),
        completedReferences: [JSON.stringify(["bill:us:119:hr:9", "2026-09-01"])]
      }
    })
    isResumed = true
    getBillBundle.mockClear()
    const result = await synchronizeCongress(harness.database, client)
    expect(ranges).toEqual([
      [from.toISOString(), to.toISOString()],
      [from.toISOString(), to.toISOString()]
    ])
    expect(getBillBundle).toHaveBeenCalledExactlyOnceWith(second)
    expect(result.counts).toMatchObject({ inserted: 1, skipped: 1, failed: 0 })
    expect(result.checkpoint).not.toHaveProperty("pendingScan")
    expect(result.checkpoint).toMatchObject({ scannedThrough: to.toISOString() })
  })

  it("retries failed records and refetches a changed reference instead of trusting an old receipt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(to)
    const harness = createDatabaseHarness()
    let isResumed = false
    const getBillBundle = vi.fn<(record: CongressBillReference) => Promise<unknown>>(async (record) => {
      if (!isResumed && record.number === "2") {
        throw new Error("Transient bundle failure")
      }
      return bundle(record)
    })
    const client = {
      getBillBundle,
      async *listUpdated() {
        yield reference("1", isResumed ? "2026-09-01T12:00:00Z" : "2026-09-01")
        yield reference("2")
      }
    }
    const failed = await synchronizeCongress(harness.database, client, { from, to })
    expect(failed.counts.failed).toBe(1)
    expect(failed.checkpoint).not.toHaveProperty("pendingScan")
    expect(failed.checkpoint).toMatchObject({
      scannedThrough: to.toISOString(),
      recordRetries: [expect.objectContaining({ attempts: 1 })]
    })
    isResumed = true
    vi.setSystemTime(new Date(to.getTime() + 3_600_001))
    getBillBundle.mockClear()
    const recovered = await synchronizeCongress(harness.database, client)
    expect(getBillBundle).toHaveBeenCalledTimes(2)
    expect(recovered.counts.failed).toBe(0)
    expect(recovered.checkpoint).toHaveProperty("recordRetries", [])
    expect(recovered.checkpoint).not.toHaveProperty("pendingScan")
    // A later explicit replay never inherits the previous scan's receipts.
    getBillBundle.mockClear()
    await synchronizeCongress(harness.database, client, { from, to })
    expect(getBillBundle).toHaveBeenCalledTimes(2)
  })

  it("advances fresh scans during backoff and retries missing references after their deadline", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(to)
    const harness = createDatabaseHarness()
    const failedReference = reference("2")
    let records = [failedReference]
    const getBillBundle = vi.fn<(record: CongressBillReference) => Promise<unknown>>(async (record) => bundle(record))
    getBillBundle.mockRejectedValueOnce(new Error("Source unavailable"))
    const client = {
      getBillBundle,
      async *listUpdated() {
        yield* records
      }
    }
    await synchronizeCongress(harness.database, client, { from, to })
    records = [failedReference, reference("3")]
    getBillBundle.mockClear()
    vi.setSystemTime(new Date(to.getTime() + 1_000))
    const fresh = await synchronizeCongress(harness.database, client)
    expect(getBillBundle).toHaveBeenCalledExactlyOnceWith(reference("3"))
    expect(fresh.checkpoint).toMatchObject({
      scannedThrough: new Date().toISOString(),
      recordRetries: [expect.objectContaining({ attempts: 1 })]
    })
    records = []
    vi.setSystemTime(new Date(to.getTime() + 3_600_001))
    getBillBundle.mockClear()
    const recovered = await synchronizeCongress(harness.database, client)
    expect(getBillBundle).toHaveBeenCalledExactlyOnceWith(failedReference)
    expect(recovered.checkpoint).toHaveProperty("recordRetries", [])
  })

  it("retains retry ownership across request-budget exhaustion and dry runs", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(to)
    const harness = createDatabaseHarness()
    let records = [reference("2")]
    const getBillBundle = vi.fn<(record: CongressBillReference) => Promise<unknown>>(async (record) => bundle(record))
    getBillBundle.mockRejectedValueOnce(new Error("Source unavailable"))
    const client = {
      getBillBundle,
      async *listUpdated() {
        yield* records
      }
    }
    await synchronizeCongress(harness.database, client, { from, to })
    const saved = harness.cursors.at(-1)
    await synchronizeCongress(harness.database, client, { from, to, dryRun: true })
    expect(harness.cursors.at(-1)).toBe(saved)
    records = []
    vi.setSystemTime(new Date(to.getTime() + 3_600_001))
    const exhausted = new CongressRequestBudgetExhaustedError(new Date(), "allocation_exhausted")
    getBillBundle.mockRejectedValueOnce(exhausted)
    await expect(synchronizeCongress(harness.database, client)).rejects.toBe(exhausted)
    expect(harness.cursors.at(-1)).toMatchObject({ recordRetries: [expect.objectContaining({ attempts: 1 })] })
    expect(harness.cursors.at(-1)).not.toHaveProperty("pendingScan")
    const recovered = await synchronizeCongress(harness.database, client)
    expect(recovered.checkpoint).toHaveProperty("recordRetries", [])
  })

  it("attempts a changed source revision immediately without retrying duplicate references", async () => {
    const harness = createDatabaseHarness()
    const old = reference("2")
    const changed = reference("2", "2026-09-01T12:00:00Z")
    const getBillBundle = vi.fn<(record: CongressBillReference) => Promise<unknown>>(async (record) => bundle(record))
    getBillBundle.mockRejectedValueOnce(new Error("Source unavailable"))
    const client = {
      getBillBundle,
      async *listUpdated() {
        yield* [old, old, changed]
      }
    }
    const result = await synchronizeCongress(harness.database, client, { from, to })
    expect(getBillBundle.mock.calls).toEqual([[old], [changed]])
    expect(result.checkpoint).toHaveProperty("recordRetries", [])
    expect(result.counts).toMatchObject({ failed: 1, inserted: 1, skipped: 1 })
  })
})

describe("Congress bill synchronization gap isolation", () => {
  it("continues around a poisoned provider minute and reports that minute for durable replay", async () => {
    const poison = new Date("2026-08-19T13:30:15.000Z")
    const gaps: CongressSyncGap[] = []
    const references: CongressBillReference[] = []
    const client = {
      async *listUpdated(from: Date, to: Date): AsyncGenerator<CongressBillReference> {
        if (from <= poison && poison <= to) {
          throw NULL_DATE_ERROR
        }
        yield {
          congress: 119,
          number: String(from.getTime()),
          type: "hr",
          updateDate: from.toISOString(),
          url: "https://api.congress.gov/v3/bill/119/hr/1"
        }
      }
    }

    for await (const reference of listUpdatedWithGapIsolation(
      client,
      new Date("2026-08-19T13:00:00.000Z"),
      new Date("2026-08-19T13:59:59.000Z"),
      (gap) => gaps.push(gap)
    )) {
      references.push(reference)
    }

    expect(references.length).toBeGreaterThan(0)
    expect(gaps).toHaveLength(1)
    expect(new Date(gaps[0]?.from ?? 0).getTime()).toBeLessThanOrEqual(poison.getTime())
    expect(new Date(gaps[0]?.to ?? 0).getTime()).toBeGreaterThanOrEqual(poison.getTime())
    expect(new Date(gaps[0]?.to ?? 0).getTime() - new Date(gaps[0]?.from ?? 0).getTime()).toBeLessThan(60_000)
  })

  it("does not hide unrelated provider failures", async () => {
    const error = new ProviderHttpError("Provider request failed with HTTP 500", { retryable: true, status: 500 })
    const client = {
      async *listUpdated(): AsyncGenerator<CongressBillReference> {
        yield await Promise.reject<CongressBillReference>(error)
      }
    }

    const consume = async () => {
      for await (const _reference of listUpdatedWithGapIsolation(
        client,
        new Date("2026-08-19T13:00:00.000Z"),
        new Date("2026-08-19T13:59:59.000Z"),
        () => undefined
      )) {
        // Consume the generator so its failure is observable.
      }
    }

    await expect(consume()).rejects.toBe(error)
  })

  it("restores only valid persisted gap ranges", () => {
    expect(
      parseCongressSyncGaps({
        gaps: [
          { from: "2026-08-19T13:00:00.000Z", to: "2026-08-19T13:00:59.000Z" },
          { from: "invalid", to: "2026-08-19T13:01:59.000Z" },
          null
        ]
      })
    ).toEqual([{ from: "2026-08-19T13:00:00.000Z", to: "2026-08-19T13:00:59.000Z" }])
  })

  it("persists a poisoned minute, advances around it, and clears it after a later replay", async () => {
    const harness = createDatabaseHarness()
    const poison = new Date("2026-08-19T13:30:15.000Z")
    let poisoned = true
    const client = {
      getBillBundle: vi.fn<(reference: CongressBillReference) => Promise<unknown>>(),
      async *listUpdated(from: Date, to: Date): AsyncGenerator<CongressBillReference> {
        if (poisoned && from <= poison && poison <= to) {
          throw NULL_DATE_ERROR
        }
        yield* []
      }
    }

    const partial = await synchronizeCongress(harness.database, client, {
      from: new Date("2026-08-19T13:00:00.000Z"),
      to: new Date("2026-08-19T13:59:59.000Z")
    })

    expect(partial.failures).toEqual([])
    expect(partial.counts).toMatchObject({ failed: 0, skipped: 1 })
    expect(partial.checkpoint).toMatchObject({ gaps: [expect.objectContaining({ from: expect.any(String) })] })

    poisoned = false
    const recovered = await synchronizeCongress(harness.database, client, {
      from: new Date("2026-08-19T15:00:00.000Z"),
      to: new Date("2026-08-19T15:59:59.000Z")
    })

    expect(recovered.failures).toEqual([])
    expect(recovered.checkpoint).not.toHaveProperty("gaps")
    expect(harness.cursors.some((cursor) => Array.isArray(cursor.gaps))).toBe(true)
  })
})

function createDatabaseHarness(): {
  cursors: Array<Record<string, unknown>>
  database: LegislationDatabase
} {
  let checkpoint: { cursor: Record<string, unknown>; watermark: Date } | undefined
  const cursors: Array<Record<string, unknown>> = []
  const database = {
    insert: () => ({
      values: (value: { cursor: Record<string, unknown>; watermark: Date }) => ({
        onConflictDoUpdate: async () => {
          checkpoint = { cursor: value.cursor, watermark: value.watermark }
          cursors.push(value.cursor)
        }
      })
    }),
    query: { syncCheckpoints: { findFirst: async () => checkpoint } }
  } as unknown as LegislationDatabase
  return { cursors, database }
}
