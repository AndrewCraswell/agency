import { describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../../db/database.js"
import { ProviderHttpError } from "../http-client.js"
import type { CongressBillReference } from "./client.js"

const billMocks = vi.hoisted(() => ({
  getBillById: vi.fn<() => Promise<undefined>>(),
  upsertBillAggregate: vi.fn<() => Promise<void>>()
}))

vi.mock("../../db/queries/bill-aggregates.js", () => billMocks)

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
