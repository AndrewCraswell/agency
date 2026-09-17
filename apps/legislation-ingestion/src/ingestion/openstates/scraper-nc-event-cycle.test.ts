import { createHash } from "node:crypto"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { archiveScraperAttempt } from "./scraper-archive.js"
import { executeNorthCarolinaEventCloudCycle } from "./scraper-nc-event-cycle.js"
import { normalizeNcScraperEvents, prepareArchivedNcScraperEvents } from "./scraper-normalize.js"

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
    if (!value) throw new Error(`Missing ${path}`)
    return value
  }
}

const build = createHash("sha256").update("approved NC event build").digest("hex")
const retrievedAt = new Date("2026-09-17T00:00:00Z")
const event = {
  _id: "ephemeral-id",
  upstream_id: "10724",
  name: "House Committee Meeting",
  start_date: "2026-09-17T10:00:00-04:00",
  status: "confirmed",
  participants: [{ name: "House Committee", organization: '~{"name":"House Committee"}' }],
  agenda: [],
  sources: [{ url: "https://www.ncleg.gov/Committees/NoticeDocument/10724/Meeting" }]
}

async function archivedFixture() {
  const store = new Store()
  const bytes = Buffer.from(JSON.stringify(event))
  const path = "_data/nc/event_fixture.json"
  await store.put(path, bytes)
  await store.put(
    "attempt.json",
    Buffer.from(
      JSON.stringify({
        work_directory: "/fixture",
        status: "extracted",
        exit_code: 0,
        revision: "d43f853796ceeeb49205f7d144790647764ce105",
        build_inputs_sha256: build,
        canonical_writes: false,
        semantically_validated: false,
        reason: null,
        files: [{ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }],
        request: {
          jurisdiction: "nc",
          domain: "events",
          session: null,
          bill_ids: null,
          timeout_seconds: 1500,
          revision: "d43f853796ceeeb49205f7d144790647764ce105"
        }
      })
    )
  )
  return { store, ...(await archiveScraperAttempt(store, store, "nc-event-fixture")) }
}

describe("North Carolina hosted event cycle", () => {
  it("accepts only an approved checksum-verified event archive", async () => {
    const { store, manifestPath } = await archivedFixture()
    const prepared = await prepareArchivedNcScraperEvents({
      store,
      manifestPath,
      approvedBuildInputsSha256: build,
      retrievedAt
    })
    expect(prepared.snapshots).toHaveLength(1)
    expect(prepared.snapshots[0]?.event.sourceId).toBe("10724")
    expect(prepared.snapshots[0]?.sessionIds).toHaveLength(1)
    expect(prepared.snapshots[0]?.event.sessionRelationsComplete).toBe(true)
    await expect(
      prepareArchivedNcScraperEvents({
        store,
        manifestPath,
        approvedBuildInputsSha256: createHash("sha256").update("other").digest("hex"),
        retrievedAt
      })
    ).rejects.toThrow("not approved")
  })

  it("promotes through one owned transaction receipt and confirms release", async () => {
    const database = drizzle({ connection: "postgresql://unused", schema })
    const snapshots = normalizeNcScraperEvents([event], retrievedAt)
    const claim = vi.fn(async () => true)
    const release = vi.fn(async () => true)
    const promote = vi.fn(async () => undefined)
    const result = await executeNorthCarolinaEventCloudCycle(
      database,
      {
        store: new Store(),
        approvedBuildInputsSha256: build,
        storageAccount: "legislationtest",
        queueName: "openstates-scraper-dispatch",
        runId: "nc-event-test"
      },
      {
        claim,
        release,
        dispatch: async () => ({ manifestPath: "retained.json", settlementPath: "settled.json" }),
        prepare: async () => ({
          status: "prepared",
          canonicalWrites: false,
          provenance: {
            runId: "nc-event-test",
            manifestPath: "retained.json",
            manifestSha256: build,
            buildInputsSha256: build
          },
          snapshots
        }),
        promote,
        now: () => retrievedAt
      }
    )
    expect(result).toMatchObject({ status: "promoted", events: 1, manifestSha256: build })
    expect(claim).toHaveBeenCalledOnce()
    expect(promote).toHaveBeenCalledWith(
      database,
      snapshots,
      expect.objectContaining({
        receipt: expect.objectContaining({ stream: `nc-events:current:${build}` })
      })
    )
    expect(release).toHaveBeenCalledOnce()
  })
})
