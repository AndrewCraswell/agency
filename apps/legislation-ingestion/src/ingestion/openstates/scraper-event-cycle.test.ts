import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { describe, expect, it, vi } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { normalizeAlaskaScraperEvent } from "./scraper-event-batch.js"
import { executeAlaskaEventCloudBatch, readAlaskaEventPlan, type AlaskaEventPlan } from "./scraper-event-cycle.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

class Store implements ArtifactStore {
  readonly values = new Map<string, Uint8Array>()
  async exists(path: string) {
    return this.values.has(path)
  }
  async put(path: string, bytes: Uint8Array) {
    if (this.values.has(path)) return false
    this.values.set(path, bytes)
    return true
  }
  async read(path: string) {
    const value = this.values.get(path)
    if (!value) throw new Error("missing")
    return value
  }
}

const key = "H:L&C:2025-01-22T13:30:00-09:00"
const source = "a".repeat(64)
const batchId = createHash("sha256")
  .update(JSON.stringify([source, [key]]))
  .digest("hex")
const plan = (): AlaskaEventPlan => ({
  jurisdiction: "ak",
  session: "34",
  source_sha256: source,
  partition: { accepted_occurrences: 1, quarantined: [] },
  batches: [{ id: batchId, event_keys: [key] }],
  complete_snapshot: false
})
const snapshot = () =>
  normalizeAlaskaScraperEvent(
    {
      upstream_id: key,
      start_date: "2025-01-22T13:30:00-09:00",
      name: "House Labor and Commerce",
      status: "tentative",
      sources: [{ url: "https://www.akleg.gov/basis/Meeting/Detail?Meeting=HL%26C+2025-01-22+13:30:00" }],
      participants: [{ entity_type: "committee", note: "host", name: "House Labor and Commerce" }],
      agenda: []
    },
    new Date("2025-01-22T22:30:00Z")
  )

describe("Alaska event cloud cycle", () => {
  it("reads only a complete deterministic partition of accepted occurrences", async () => {
    const store = new Store()
    await store.put("plan.json", Buffer.from(JSON.stringify(plan())))
    await expect(readAlaskaEventPlan(store, "plan.json")).resolves.toEqual(plan())
    const bad = plan()
    bad.batches[0]!.id = "b".repeat(64)
    await store.put("bad.json", Buffer.from(JSON.stringify(bad)))
    await expect(readAlaskaEventPlan(store, "bad.json")).rejects.toThrow("batch identity mismatch")
  })

  it("promotes only after a settled matching archive and releases ownership", async () => {
    const store = new Store()
    const claim = vi.fn(async () => true)
    const release = vi.fn(async () => true)
    const promote = vi.fn(async () => undefined)
    const result = await executeAlaskaEventCloudBatch(
      {} as LegislationDatabase,
      {
        store,
        planPath: "plan.json",
        batchId,
        approvedBuildInputsSha256: "c".repeat(64),
        storageAccount: "legislationtest",
        queueName: "openstates-scraper-dispatch",
        runId: "run-1"
      },
      {
        inspect: async () => ({ plan: plan(), completed: [], pending: plan().batches }),
        dispatch: async () => ({ manifestPath: "manifest", settlementPath: "settled" }),
        claim,
        release,
        prepare: async () => ({ snapshots: [snapshot()], quarantinedOccurrences: 0, completeSnapshot: false }),
        promote,
        now: () => new Date("2025-01-22T22:30:00Z")
      }
    )
    expect(result).toMatchObject({ status: "promoted", events: 1, batchId, runId: "run-1" })
    expect(promote).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
  })

  it("preserves ownership when cloud shutdown is not confirmed", async () => {
    const release = vi.fn(async () => true)
    await expect(
      executeAlaskaEventCloudBatch(
        {} as LegislationDatabase,
        {
          store: new Store(),
          planPath: "plan.json",
          batchId,
          approvedBuildInputsSha256: "c".repeat(64),
          storageAccount: "legislationtest",
          queueName: "openstates-scraper-dispatch",
          runId: "run-uncertain"
        },
        {
          inspect: async () => ({ plan: plan(), completed: [], pending: plan().batches }),
          dispatch: async () => {
            throw new ScraperWorkerStopUnconfirmedError()
          },
          claim: async () => true,
          release,
          prepare: async () => ({ snapshots: [snapshot()], quarantinedOccurrences: 0, completeSnapshot: false }),
          promote: async () => undefined,
          now: () => new Date()
        }
      )
    ).rejects.toBeInstanceOf(ScraperWorkerStopUnconfirmedError)
    expect(release).not.toHaveBeenCalled()
  })
})
