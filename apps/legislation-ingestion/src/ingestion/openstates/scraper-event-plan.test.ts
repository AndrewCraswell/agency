import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { acquireAlaskaEventPlan } from "./scraper-event-plan.js"

class MemoryStore implements ArtifactStore {
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

const source = Buffer.from("<Meetings><Meeting /></Meetings>")
const sourceSha256 = createHash("sha256").update(source).digest("hex")
const key = "H:ADM:2025-02-04T15:45:00-09:00"
const batchId = createHash("sha256")
  .update(JSON.stringify([sourceSha256, [key]]))
  .digest("hex")
const plan = {
  jurisdiction: "ak" as const,
  session: "34" as const,
  source_sha256: sourceSha256,
  partition: { accepted_occurrences: 1, quarantined: [] },
  batches: [{ id: batchId, event_keys: [key] }],
  complete_snapshot: false as const
}

function response(bytes = source, contentType = "text/xml; charset=utf-8") {
  return new Response(bytes, { status: 200, headers: { "content-type": contentType } })
}

describe("Alaska event source planning", () => {
  it("retains the official source and its validated deterministic plan", async () => {
    const store = new MemoryStore()
    const result = await acquireAlaskaEventPlan(store, {
      fetch: async () => response(),
      plan: async () => plan
    })

    expect(result).toEqual({
      sourcePath: `openstates/scraper-plans/ak/events/${sourceSha256}.xml`,
      planPath: `openstates/scraper-plans/ak/events/${sourceSha256}.json`,
      inventoryId: sourceSha256,
      batches: 1,
      occurrences: 1,
      quarantined: 0
    })
    expect(Buffer.from(await store.read(result.sourcePath))).toEqual(source)
  })

  it("rejects a planner result for different source bytes", async () => {
    await expect(
      acquireAlaskaEventPlan(new MemoryStore(), {
        fetch: async () => response(),
        plan: async () => ({ ...plan, source_sha256: "f".repeat(64) })
      })
    ).rejects.toThrow("does not identify the acquired source")
  })

  it("rejects non-XML publisher responses before planning", async () => {
    await expect(
      acquireAlaskaEventPlan(new MemoryStore(), {
        fetch: async () => response(source, "text/html"),
        plan: async () => plan
      })
    ).rejects.toThrow("unexpected content type")
  })
})
