import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../../db/database.js"
import type { CongressAmendmentReference, CongressClient } from "./client.js"

const mocks = vi.hoisted(() => ({
  upsertCongressAmendment: vi.fn<(database: unknown, snapshot: unknown) => Promise<void>>()
}))

vi.mock("../../db/queries/amendments.js", () => ({
  upsertCongressAmendmentSnapshot: mocks.upsertCongressAmendment
}))

import { synchronizeCongressAmendments } from "./amendments-sync.js"

type AmendmentClient = Pick<CongressClient, "amendments" | "getAmendmentBundle">

function amendmentReference(number: number): CongressAmendmentReference {
  return {
    congress: 114,
    number: String(number),
    type: "HAMDT",
    url: `https://api.congress.gov/v3/amendment/114/hamdt/${number}`
  }
}

function createDatabaseHarness(): { database: LegislationDatabase; offsets: number[] } {
  let checkpoint: { cursor: { nextOffset: number } } | undefined
  const offsets: number[] = []
  const database = {
    insert: () => ({
      values: (value: { cursor: { nextOffset: number } }) => ({
        onConflictDoUpdate: async () => {
          checkpoint = { cursor: value.cursor }
          offsets.push(value.cursor.nextOffset)
        }
      })
    }),
    query: { syncCheckpoints: { findFirst: async () => checkpoint } },
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) })
  } as unknown as LegislationDatabase
  return { database, offsets }
}

describe("Congress amendment synchronization", () => {
  beforeEach(() => {
    mocks.upsertCongressAmendment.mockReset().mockResolvedValue()
  })

  it("checkpoints a bounded chunk and resumes at the durable offset", async () => {
    const references = [1, 2, 3].map(amendmentReference)
    const starts: number[] = []
    const client: AmendmentClient = {
      async *amendments(_congress, startOffset = 0) {
        starts.push(startOffset)
        for (const [offset, reference] of references.entries()) {
          if (offset >= startOffset) {
            yield { offset, reference }
          }
        }
      },
      async getAmendmentBundle(reference) {
        return {
          actions: [],
          amendment: { congress: 114, number: reference.number, type: reference.type },
          sourceUrl: reference.url,
          textVersions: []
        }
      }
    }
    const harness = createDatabaseHarness()

    const first = await synchronizeCongressAmendments(harness.database, client, 114, { limit: 2 })
    const second = await synchronizeCongressAmendments(harness.database, client, 114, { limit: 2 })

    expect(first.checkpoint).toEqual({ complete: false, nextOffset: 2 })
    expect(second.checkpoint).toEqual({ complete: true, nextOffset: 3 })
    expect(starts).toEqual([0, 2])
    expect(harness.offsets).toEqual([1, 2, 3])
    expect(mocks.upsertCongressAmendment).toHaveBeenCalledTimes(3)
  })
})
