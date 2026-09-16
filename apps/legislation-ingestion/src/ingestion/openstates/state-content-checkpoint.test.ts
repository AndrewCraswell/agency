import { expect, it } from "vitest"
import {
  advanceStateContentCheckpoint,
  readStateContentCheckpoint,
  prioritizeStateContentBills
} from "./state-content-checkpoint.js"

it("prioritizes repairs without losing the pre-existing continuation backlog", () => {
  const prefix = "bill:nc:2025:"
  const existing = Array.from({ length: 10 }, (_, n) => `${prefix}hb:${n + 1}`)
  const repair = `${prefix}hb:20`
  expect(prioritizeStateContentBills([repair, existing[0]!], existing, prefix)).toEqual([repair, ...existing])
  expect(() => prioritizeStateContentBills(["bill:ak:34:hb:1"], existing, prefix)).toThrow("scope")
  expect(() => prioritizeStateContentBills([""], existing, prefix)).toThrow("empty")
})

it("retains queued embeddings without falsely completing a round when no discovery slot remains", () => {
  expect(
    advanceStateContentCheckpoint({
      previous: "bill:nc:2025:hb:2",
      discovered: [],
      discoveryLimit: 0,
      pendingEmbeddingBillIds: ["bill:nc:2025:hb:1"]
    })
  ).toEqual({
    afterBillId: "bill:nc:2025:hb:2",
    pendingEmbeddingBillIds: ["bill:nc:2025:hb:1"],
    scanRoundComplete: false
  })
})
it("restarts discovery at its end while preserving unfinished embedding work", () => {
  expect(
    advanceStateContentCheckpoint({
      previous: "bill:nc:2025:hb:2",
      discovered: [],
      discoveryLimit: 1,
      pendingEmbeddingBillIds: ["bill:nc:2025:hb:1"]
    })
  ).toMatchObject({ afterBillId: "", scanRoundComplete: false })
  expect(
    advanceStateContentCheckpoint({
      previous: "bill:nc:2025:hb:2",
      discovered: [],
      discoveryLimit: 1,
      pendingEmbeddingBillIds: []
    })
  ).toMatchObject({ afterBillId: "", scanRoundComplete: true })
})
it("validates every carried ID and accepts the existing cursor with no queued work", () => {
  expect(
    readStateContentCheckpoint({ afterBillId: "bill:nc:2025:hb:2" }, "bill:nc:2025:").pendingEmbeddingBillIds
  ).toEqual([])
  for (const ids of [["bill:ak:34:hb:1"], [""], ["bill:nc:2025:hb:1", "bill:nc:2025:hb:1"]]) {
    expect(() =>
      readStateContentCheckpoint({ afterBillId: "", pendingEmbeddingBillIds: ids }, "bill:nc:2025:")
    ).toThrow(/Content checkpoint/)
  }
})
