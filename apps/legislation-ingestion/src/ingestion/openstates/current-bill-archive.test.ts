import { describe, expect, it } from "vitest"
import type { SourceStore, StoredSource } from "../source-store.js"
import { retainOpenStatesBillPage } from "./current-bill-archive.js"

class MemorySourceStore implements SourceStore {
  readonly writes: Array<{ content: Uint8Array; metadata: Readonly<Record<string, unknown>>; scope: string }> = []

  async put(
    _provider: string,
    scope: string,
    content: Uint8Array,
    metadata: Readonly<Record<string, unknown>> = {}
  ): Promise<StoredSource> {
    this.writes.push({ content, metadata, scope })
    return {
      bytes: content.byteLength,
      contentHash: `hash-${scope}`,
      contentPath: `${scope}.source`,
      metadataPath: `${scope}.json`,
      unchanged: false
    }
  }
}

const bill = (session: string, identifier: string) => ({
  actions: [],
  identifier,
  session,
  sources: [{ url: `https://example.com/${identifier}` }],
  title: identifier
})

describe("retainOpenStatesBillPage", () => {
  it("partitions a provider page into immutable session-scoped evidence", async () => {
    const store = new MemorySourceStore()
    const from = new Date("2026-09-17T08:00:00.000Z")
    const retrievedAt = new Date("2026-09-17T08:01:00.000Z")

    const retained = await retainOpenStatesBillPage(
      store,
      [bill("2025-2026", "HB 2"), bill("34", "HB 1"), bill("34", "HB 3")],
      {
        from,
        jurisdiction: "ak",
        jurisdictionName: "Alaska",
        page: 2,
        providerEndpoint: "https://v3.openstates.org/bills",
        retrievedAt
      }
    )

    expect(
      retained.map(({ contentHash, records, session, stream }) => ({
        contentHash,
        records: records.length,
        session,
        stream
      }))
    ).toEqual([
      {
        contentHash: "hash-api-ak-2025-2026-2026-09-17t08-00-00-000z-2",
        records: 1,
        session: "2025-2026",
        stream: "api-ak-2025-2026-2026-09-17t08-00-00-000z-2"
      },
      {
        contentHash: "hash-api-ak-34-2026-09-17t08-00-00-000z-2",
        records: 2,
        session: "34",
        stream: "api-ak-34-2026-09-17t08-00-00-000z-2"
      }
    ])
    expect(store.writes).toHaveLength(2)
    expect(JSON.parse(new TextDecoder().decode(store.writes[1]?.content))).toEqual([
      bill("34", "HB 1"),
      bill("34", "HB 3")
    ])
    expect(store.writes[1]?.metadata).toMatchObject({
      from: from.toISOString(),
      jurisdiction: "ak",
      page: 2,
      records: 2,
      retrievedAt: retrievedAt.toISOString(),
      session: "34"
    })
  })

  it("writes nothing when the provider page is empty", async () => {
    const store = new MemorySourceStore()
    await expect(
      retainOpenStatesBillPage(store, [], {
        from: new Date("2026-09-17T08:00:00.000Z"),
        jurisdiction: "nc",
        jurisdictionName: "North Carolina",
        page: 1,
        providerEndpoint: "https://v3.openstates.org/bills",
        retrievedAt: new Date("2026-09-17T08:01:00.000Z")
      })
    ).resolves.toEqual([])
    expect(store.writes).toEqual([])
  })
})
